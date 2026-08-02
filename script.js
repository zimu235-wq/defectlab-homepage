const STATUS_API = "https://dl.defectlab.xyz:20443/api/public/minecraft";
const CHAT_API = "https://dl.defectlab.xyz:20443/api/public/chat";

const elements = {
  clock: document.querySelector("#server-time"),
  adminEntry: document.querySelector("#admin-entry"),
  adminEntryLabel: document.querySelector("#admin-entry-label"),
  toast: document.querySelector("#toast"),
  refresh: document.querySelector("#refresh-status"),
  status: document.querySelector("#server-status"),
  statusText: document.querySelector("#status-text"),
  serverSelect: document.querySelector("#server-select"),
  packSummary: document.querySelector("#server-pack-summary"),
  motd: document.querySelector("#server-motd"),
  address: document.querySelector("#server-address"),
  online: document.querySelector("#players-online"),
  max: document.querySelector("#players-max"),
  playerAvatars: document.querySelector("#player-avatars"),
  latency: document.querySelector("#network-latency"),
  minecraft: document.querySelector("#minecraft-version"),
  updated: document.querySelector("#last-updated"),
  backupLastSuccess: document.querySelector("#backup-last-success"),
  backupEnabled: document.querySelector("#backup-enabled"),
  backupCount: document.querySelector("#backup-count"),
  packSelect: document.querySelector("#modpack-select"),
  packSingle: document.querySelector("#modpack-single"),
  packDownload: document.querySelector("#modpack-download"),
  chatLog: document.querySelector("#chat-log"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  chatCount: document.querySelector("#chat-count"),
  chatSend: document.querySelector("#chat-send"),
};

let servers = [];
let selectedServerId = getPreferredServerId();
let modpacks = [];
let latestNetworkMs = "--";
let latestUpdatedAt = null;
let chatHistory = [];
let toastTimer;

function getPreferredServerId() {
  const fromUrl = new URLSearchParams(window.location.search).get("server");
  if (fromUrl) return fromUrl;
  try {
    return window.localStorage.getItem("defectlab-selected-server") || "";
  } catch {
    return "";
  }
}

function rememberSelectedServer() {
  if (!selectedServerId) return;
  try {
    window.localStorage.setItem("defectlab-selected-server", selectedServerId);
  } catch {
    // Selection still works when storage is unavailable.
  }
  const url = new URL(window.location.href);
  url.searchParams.set("server", selectedServerId);
  window.history.replaceState(null, "", url);
}

function updateClock() {
  elements.clock.textContent = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function formatUpdateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatBackupTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚无成功备份";
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 60 * 1000) return "刚刚";
  if (elapsed >= 0 && elapsed < 60 * 60 * 1000) return `${Math.floor(elapsed / 60000)} 分钟前`;
  if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / 3600000)} 小时前`;
  if (elapsed >= 0 && elapsed < 48 * 60 * 60 * 1000) {
    const time = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return `昨天 ${time}`;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function refreshAdminEntry() {
  if (!elements.adminEntry || !elements.adminEntryLabel) return;
  try {
    const response = await fetch("/admin/api/auth/session", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return;
    const session = await response.json();
    if (session.authenticated) {
      elements.adminEntryLabel.textContent = "进入管理台";
      elements.adminEntry.classList.add("signed-in");
    }
  } catch {
    // The public server page remains usable when the private admin service is unavailable.
  }
}

function formatBackupExactTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function renderBackup(backup) {
  const value = backup && typeof backup === "object" ? backup : {};
  if (value.enabled === false) {
    elements.backupEnabled.className = "backup-enabled disabled";
    elements.backupEnabled.textContent = "未启用";
    elements.backupLastSuccess.textContent = "尚无备份";
    elements.backupLastSuccess.removeAttribute("title");
    elements.backupCount.textContent = Number.isFinite(value.snapshot_count) ? value.snapshot_count : 0;
    return;
  }

  const labels = {
    healthy: ["enabled", "保护正常"],
    idle: ["waiting", "等待玩家活动"],
    running: ["waiting", "正在备份"],
    restoring: ["waiting", "正在恢复"],
    stale: ["warning", "备份延迟"],
    error: ["warning", "备份异常"],
    unavailable: ["warning", "状态未知"],
  };
  const [className, label] = labels[value.state] || labels.unavailable;
  elements.backupEnabled.className = `backup-enabled ${className}`;
  elements.backupEnabled.textContent = label;
  elements.backupLastSuccess.textContent = formatBackupTime(value.last_success_at);
  const exactTime = formatBackupExactTime(value.last_success_at);
  if (exactTime) {
    elements.backupLastSuccess.title = `北京时间 ${exactTime}`;
  } else {
    elements.backupLastSuccess.removeAttribute("title");
  }
  elements.backupCount.textContent = Number.isFinite(value.snapshot_count) ? value.snapshot_count : "--";
}

function setServerState(state) {
  elements.status.className = `status-pill ${state}`;
  elements.statusText.textContent = state === "online" ? "服务器在线" : state === "offline" ? "暂时离线" : "正在连接";
}

function updateSelectedPack() {
  const pack = modpacks.find((item) => item.id === elements.packSelect.value);
  if (!pack) {
    elements.packDownload.classList.add("disabled");
    elements.packDownload.setAttribute("aria-disabled", "true");
    elements.packDownload.href = "#";
    elements.packDownload.textContent = "暂无客户端包";
    return;
  }
  elements.packDownload.href = pack.url;
  elements.packDownload.textContent = pack.required ? "下载必需客户端" : "下载可选增强包";
  elements.packDownload.classList.remove("disabled");
  elements.packDownload.removeAttribute("aria-disabled");
}

function formatPackLabel(pack) {
  const requirement = pack.required ? "必需" : "可选";
  let name = pack.name;
  let version = pack.version;
  if (String(pack.id).startsWith("farmingtales-")) {
    name = "FarmingTales";
    version = String(pack.version).replace(/-auth\d+$/i, "");
  } else if (String(pack.id).startsWith("defectlab-vanilla-plus-")) {
    name = "Vanilla+";
    version = String(pack.version).replace(`${pack.minecraft}-`, "");
  }
  return `${requirement} · ${name} ${version}`;
}

function renderModpacks(items) {
  modpacks = Array.isArray(items) ? items : [];
  elements.packSelect.replaceChildren();
  elements.packSingle.hidden = true;
  elements.packSelect.hidden = false;
  if (!modpacks.length) {
    const option = new Option("暂无可用整合包", "");
    elements.packSelect.add(option);
    updateSelectedPack();
    return;
  }
  modpacks.forEach((pack) => {
    elements.packSelect.add(new Option(formatPackLabel(pack), pack.id));
  });
  if (modpacks.length === 1) {
    elements.packSingle.textContent = formatPackLabel(modpacks[0]);
    elements.packSingle.hidden = false;
    elements.packSelect.hidden = true;
  }
  updateSelectedPack();
}

function renderPlayerAvatars(items, onlineCount) {
  const players = Array.isArray(items) ? items : [];
  const visiblePlayers = players.slice(0, 6);
  elements.playerAvatars.replaceChildren();

  if (Number(onlineCount || 0) === 0) {
    const empty = document.createElement("p");
    empty.className = "player-empty";
    empty.textContent = "暂无玩家在线";
    elements.playerAvatars.append(empty);
    return;
  }

  visiblePlayers.forEach((player) => {
    const name = String(player?.name || "玩家").trim();
    // This server runs in offline mode, so status UUIDs do not map to Mojang skins.
    // Resolve the public skin by player name instead.
    const identity = name;
    const entry = document.createElement("div");
    entry.className = "player-entry";
    const avatar = document.createElement("span");
    avatar.className = "player-avatar";

    const image = document.createElement("img");
    image.src = `https://mc-heads.net/avatar/${encodeURIComponent(identity)}/40`;
    image.alt = `${name} 的 Minecraft 头像`;
    image.width = 40;
    image.height = 40;
    image.loading = "lazy";
    image.addEventListener("error", () => avatar.classList.add("failed"), { once: true });

    const fallback = document.createElement("span");
    fallback.className = "avatar-fallback";
    fallback.textContent = name.slice(0, 1).toUpperCase();
    const label = document.createElement("span");
    label.className = "player-name";
    label.textContent = name;
    avatar.append(image, fallback);
    entry.append(avatar, label);
    elements.playerAvatars.append(entry);
  });

  const hiddenCount = Math.max(0, Number(onlineCount || 0) - visiblePlayers.length);
  if (hiddenCount > 0) {
    const entry = document.createElement("div");
    entry.className = "player-entry";
    const more = document.createElement("span");
    more.className = "player-avatar more";
    more.textContent = `+${hiddenCount}`;
    const label = document.createElement("span");
    label.className = "player-name";
    label.textContent = players.length ? "更多玩家" : "名单未公开";
    entry.append(more, label);
    elements.playerAvatars.append(entry);
  }
}

function renderSelectedServer() {
  const entry = servers.find((item) => item.server?.id === selectedServerId) || servers[0];
  if (!entry) return;
  const { server, status = {}, backup, modpacks: serverModpacks } = entry;
  selectedServerId = server.id;
  elements.serverSelect.value = selectedServerId;
  const primaryPack = Array.isArray(serverModpacks) ? serverModpacks[0] : null;
  const packPrefix = primaryPack?.required ? "所需客户端" : "可选增强包";
  elements.packSummary.textContent = `${packPrefix}：${server.current_modpack || "未配置"}`;
  elements.address.textContent = server.address;
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.dataset.copy = server.address;
  });
  elements.minecraft.textContent = server.minecraft;
  elements.online.textContent = status.players?.online ?? 0;
  elements.max.textContent = status.players?.max ?? "--";
  renderPlayerAvatars(status.players?.list, status.players?.online);
  elements.latency.textContent = latestNetworkMs;
  elements.updated.textContent = formatUpdateTime(latestUpdatedAt);
  elements.motd.textContent = status.motd || (status.online ? "服务器正在运行" : "服务器当前不可用");
  setServerState(status.online ? "online" : "offline");

  renderBackup(backup);
  renderModpacks(serverModpacks);
}

function renderServers(payload, networkMs) {
  const items = Array.isArray(payload.servers) && payload.servers.length
    ? payload.servers
    : [{ server: payload.server, status: payload.status, backup: payload.backup, modpacks: payload.modpacks }];
  servers = items.filter((item) => item?.server?.id);
  latestNetworkMs = networkMs;
  latestUpdatedAt = payload.updated_at;
  if (!servers.some((item) => item.server.id === selectedServerId)) {
    selectedServerId = servers[0]?.server?.id || "";
  }

  elements.serverSelect.replaceChildren();
  servers.forEach((item) => {
    elements.serverSelect.add(new Option(item.server.name, item.server.id));
  });
  elements.serverSelect.disabled = servers.length < 2;
  renderSelectedServer();
}

async function refreshStatus({ manual = false } = {}) {
  if (!servers.length) setServerState("loading");
  elements.refresh.disabled = true;
  if (manual) elements.refresh.textContent = "刷新中…";
  const started = performance.now();
  try {
    const response = await fetch(STATUS_API, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const networkMs = Math.max(1, Math.round(performance.now() - started));
    renderServers(payload, networkMs);
    if (manual) showToast("服务器状态已更新");
  } catch {
    setServerState("offline");
    elements.motd.textContent = "无法读取服务器状态，请检查当前网络是否支持 IPv6。";
    elements.online.textContent = "--";
    elements.max.textContent = "--";
    renderPlayerAvatars([], 0);
    elements.latency.textContent = "--";
    if (!servers.length) {
      elements.packSummary.textContent = "当前整合包：暂时无法读取";
      elements.backupLastSuccess.textContent = "--";
      elements.backupEnabled.className = "backup-enabled warning";
      elements.backupEnabled.textContent = "状态未知";
      elements.backupCount.textContent = "--";
    }
    if (manual) showToast("刷新失败，请稍后重试");
  } finally {
    elements.refresh.disabled = false;
    if (manual) elements.refresh.textContent = "刷新状态";
  }
}

function appendChatMessage(role, text, extraClass = "") {
  const message = document.createElement("div");
  message.className = `chat-message ${role} ${extraClass}`.trim();
  message.textContent = text;
  elements.chatLog.append(message);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
  return message;
}

function updateChatCount() {
  elements.chatCount.textContent = elements.chatInput.value.length;
}

async function sendChatMessage(event) {
  event.preventDefault();
  const message = elements.chatInput.value.trim();
  if (!message || elements.chatSend.disabled) return;

  const historyForRequest = chatHistory.slice(-16);
  appendChatMessage("user", message);
  chatHistory.push({ role: "user", content: message });
  elements.chatInput.value = "";
  updateChatCount();
  elements.chatSend.disabled = true;
  elements.chatInput.disabled = true;
  const typing = appendChatMessage("bot", "正在回复…", "typing");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000);

  try {
    const response = await fetch(CHAT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: historyForRequest }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    typing.remove();
    if (!response.ok) {
      appendChatMessage("error", payload.message || "发送失败，请稍后再试。", "error");
      return;
    }
    const reply = String(payload.reply || "").trim();
    if (!reply) throw new Error("empty reply");
    appendChatMessage("bot", reply);
    chatHistory.push({ role: "assistant", content: reply });
    chatHistory = chatHistory.slice(-16);
  } catch (error) {
    typing.remove();
    const messageText = error.name === "AbortError" ? "回复超时，请稍后再试。" : "机器人暂时无法连接。";
    appendChatMessage("error", messageText, "error");
  } finally {
    clearTimeout(timer);
    elements.chatSend.disabled = false;
    elements.chatInput.disabled = false;
    elements.chatInput.focus();
  }
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      showToast(`已复制：${value}`);
    } catch {
      showToast(`请手动复制：${value}`);
    }
  });
});

elements.packSelect.addEventListener("change", updateSelectedPack);
elements.serverSelect.addEventListener("change", () => {
  selectedServerId = elements.serverSelect.value;
  rememberSelectedServer();
  renderSelectedServer();
});
elements.refresh.addEventListener("click", () => refreshStatus({ manual: true }));
elements.chatForm.addEventListener("submit", sendChatMessage);
elements.chatInput.addEventListener("input", updateChatCount);
elements.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});
updateClock();
setInterval(updateClock, 1000);
refreshAdminEntry();
refreshStatus();
setInterval(refreshStatus, 30000);
