const STATUS_API = "https://dl.defectlab.xyz:20443/api/public/minecraft";

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
  latency: document.querySelector("#network-latency"),
  minecraft: document.querySelector("#minecraft-version"),
  updated: document.querySelector("#last-updated"),
  loader: document.querySelector("#server-loader"),
  modpack: document.querySelector("#current-modpack"),
  modpackVersion: document.querySelector("#current-modpack-version"),
  packSelect: document.querySelector("#modpack-select"),
  packMeta: document.querySelector("#modpack-meta"),
  packDownload: document.querySelector("#modpack-download"),
};

let modpacks = [];
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
    elements.latency.textContent = "--";
  } finally {
    elements.refresh.disabled = false;
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
updateClock();
setInterval(updateClock, 1000);
refreshStatus();
setInterval(refreshStatus, 30000);
