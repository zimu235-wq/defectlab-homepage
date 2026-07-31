const services = {
  download: "https://dl.defectlab.xyz:20443/",
  astrbot: "https://as.defectlab.xyz:18443/",
  book: "https://book.defectlab.xyz:21443/admin",
};

const clock = document.querySelector("#server-time");
const toast = document.querySelector("#toast");
const checkButton = document.querySelector("#check-services");
const summary = document.querySelector("#network-summary");
const detail = document.querySelector("#network-detail");
let toastTimer;

function updateClock() {
  clock.textContent = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`已复制：${value}`);
  } catch {
    showToast(`请手动复制：${value}`);
  }
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    await fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function checkServices() {
  checkButton.disabled = true;
  checkButton.textContent = "检测中…";
  summary.textContent = navigator.onLine ? "网络已连接" : "设备处于离线状态";
  detail.textContent = "正在逐项连接服务器入口";

  const results = await Promise.all(
    Object.entries(services).map(async ([key, url]) => {
      const label = document.querySelector(`[data-check="${key}"] b`);
      label.textContent = "检测中";
      label.className = "";
      const ok = navigator.onLine && await probe(url);
      label.textContent = ok ? "可连接" : "暂不可达";
      label.className = ok ? "ok" : "fail";
      return ok;
    }),
  );

  const available = results.filter(Boolean).length;
  summary.textContent = available ? `${available}/${results.length} 个服务可连接` : "服务器入口暂不可达";
  detail.textContent = available === results.length
    ? "当前设备可以访问全部公开 Web 服务"
    : "可能缺少 IPv6，仍可尝试直接打开服务";
  checkButton.disabled = false;
  checkButton.textContent = "重新检测";
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => copyText(button.dataset.copy));
});
checkButton.addEventListener("click", checkServices);
updateClock();
setInterval(updateClock, 1000);
checkServices();
