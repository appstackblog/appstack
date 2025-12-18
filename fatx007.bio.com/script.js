const sky = document.getElementById("sky");
const totalStars = 260;

for (let i = 0; i < totalStars; i++) {
  const s = document.createElement("div");
  s.className = "star";

  const size = 1 + Math.random() * 2; // 1–3px
  s.style.width = size + "px";
  s.style.height = size + "px";

  s.style.top = Math.random() * 100 + "%";
  s.style.left = Math.random() * 100 + "%";

  s.style.opacity = (0.2 + Math.random() * 0.8).toFixed(2);
  s.style.animationDuration = (3 + Math.random() * 4) + "s";
  s.style.animationDelay = (Math.random() * -6) + "s";

  sky.appendChild(s);
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const timeEl = document.getElementById("localTime");
if (timeEl) {
  const fmt = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const tick = () => (timeEl.textContent = fmt.format(new Date()));
  tick();
  setInterval(tick, 30_000);
}

const toast = document.getElementById("toast");
const showToast = (msg) => {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1600);
};

document.querySelectorAll("[data-copy]").forEach(btn => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      showToast("Đã copy số Zalo ✨");
    } catch {
      showToast("Không copy được 😅");
    }
  });
});
