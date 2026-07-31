const clock = document.querySelector("#server-time");
const toast = document.querySelector("#toast");
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

updateClock();
setInterval(updateClock, 1000);
