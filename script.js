const STATUS_API = "https://dl.defectlab.xyz:20443/api/public/minecraft";
const CHAT_API = "https://dl.defectlab.xyz:20443/api/public/chat";

const elements = {
  clock: document.querySelector("#server-time"),
  toast: document.querySelector("#toast"),
  refresh: document.querySelector("#refresh-status"),
  status: document.querySelector("#server-status"),
  statusText: document.querySelector("#status-text"),
  name: document.querySelector("#server-name"),
  motd: document.querySelector("#server-motd"),
  address: document.querySelector("#server-address"),
  online: document.querySelector("#players-online"),
  max: document.querySelector("#players-max"),
  playerAvatars: document.querySelector("#player-avatars"),
  latency: document.querySelector("#network-latency"),
  minecraft: document.querySelector("#minecraft-version"),
  updated: document.querySelector("#last-updated"),
  loader: document.querySelector("#server-loader"),
  modpack: document.querySelector("#current-modpack"),
  modpackVersion: document.querySelector("#current-modpack-version"),
  packSelect: document.querySelector("#modpack-select"),
  packMeta: document.querySelector("#modpack-meta"),
  packDownload: document.querySelector("#modpack-download"),
  chatLog: document.querySelector("#chat-log"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  chatCount: document.querySelector("#chat-count"),
  chatSend: document.querySelector("#chat-send"),
};

let modpacks = [];
let chatHistory = [];
let toastTimer;

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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "文件大小未知";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
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
    return;
  }
  elements.packMeta.textContent = `${pack.minecraft} · ${pack.loader} · ${formatBytes(pack.size_bytes)}`;
  elements.packDownload.href = pack.url;
  elements.packDownload.classList.remove("disabled");
  elements.packDownload.removeAttribute("aria-disabled");
}

function renderModpacks(items) {
  modpacks = Array.isArray(items) ? items : [];
  elements.packSelect.replaceChildren();
  if (!modpacks.length) {
    const option = new Option("暂无可用整合包", "");
    elements.packSelect.add(option);
    elements.packMeta.textContent = "请稍后再试";
    updateSelectedPack();
    return;
  }
  modpacks.forEach((pack) => {
    elements.packSelect.add(new Option(`${pack.name} ${pack.version}`, pack.id));
  });
  updateSelectedPack();
}

function renderPlayerAvatars(items, onlineCount) {
  const players = Array.isArray(items) ? items : [];
  const visiblePlayers = players.slice(0, 6);
  elements.playerAvatars.replaceChildren();

  visiblePlayers.forEach((player) => {
    const name = String(player?.name || "玩家").trim();
    const identity = String(player?.id || name).replaceAll("-", "");
    const avatar = document.createElement("span");
    avatar.className = "player-avatar";
    avatar.title = name;

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
    avatar.append(image, fallback);
    elements.playerAvatars.append(avatar);
  });

  const hiddenCount = Math.max(0, Number(onlineCount || 0) - visiblePlayers.length);
  if (hiddenCount > 0) {
    const more = document.createElement("span");
    more.className = "player-avatar more";
    more.textContent = `+${hiddenCount}`;
    more.title = players.length ? `还有 ${hiddenCount} 名玩家在线` : "服务器未公开玩家名称";
    elements.playerAvatars.append(more);
  }
}

function renderStatus(payload, networkMs) {
  const { server, status } = payload;
  elements.name.textContent = server.name;
  elements.address.textContent = server.address;
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.dataset.copy = server.address;
  });
  elements.minecraft.textContent = status.version?.name || server.minecraft;
  elements.loader.textContent = server.loader;
  elements.online.textContent = status.players?.online ?? 0;
  elements.max.textContent = status.players?.max ?? "--";
  renderPlayerAvatars(status.players?.list, status.players?.online);
  elements.latency.textContent = networkMs;
  elements.updated.textContent = formatUpdateTime(payload.updated_at);
  elements.motd.textContent = status.motd || (status.online ? "服务器正在运行" : "服务器当前不可用");
  setServerState(status.online ? "online" : "offline");

  const matchedPack = payload.modpacks?.[0];
  if (matchedPack) {
    elements.modpack.textContent = matchedPack.name;
    elements.modpackVersion.textContent = matchedPack.version;
  }
  renderModpacks(payload.modpacks);
}

async function refreshStatus() {
  setServerState("loading");
  elements.refresh.disabled = true;
  const started = performance.now();
  try {
    const response = await fetch(STATUS_API, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const networkMs = Math.max(1, Math.round(performance.now() - started));
    renderStatus(payload, networkMs);
  } catch {
    setServerState("offline");
    elements.motd.textContent = "无法读取服务器状态，请检查当前网络是否支持 IPv6。";
    elements.online.textContent = "--";
    elements.max.textContent = "--";
    renderPlayerAvatars([], 0);
    elements.latency.textContent = "--";
  } finally {
    elements.refresh.disabled = false;
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
elements.refresh.addEventListener("click", refreshStatus);
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
refreshStatus();
setInterval(refreshStatus, 30000);
