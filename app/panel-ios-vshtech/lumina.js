document.addEventListener("DOMContentLoaded", () => {
  // Chặn mở DevTools nhanh (F12 / Ctrl+Shift+I)
  document.addEventListener("keydown", (e) => {
    const key = e.key?.toLowerCase();
    if (key === "f12" || (e.ctrlKey && e.shiftKey && (key === "i" || key === "j"))) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Nút "See more" toggle danh sách app
  const toggleBtn = document.querySelector(".panel-toggle-btn");
  const panelList = document.getElementById("panel-list-panel");
  if (toggleBtn && panelList) {
    const updateState = (open) => {
      if (open) {
        panelList.removeAttribute("hidden");
      } else {
        panelList.setAttribute("hidden", "");
      }
      toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      toggleBtn.textContent = open ? "See less" : "See more";
    };
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const willOpen = panelList.hasAttribute("hidden");
      updateState(willOpen);
    });
  }

  // Xử lý install qua itms-services, không lộ link khi hover
  const appLinks = document.querySelectorAll(".app-download[data-app-id]");
  appLinks.forEach((link) => {
    const id = link.getAttribute("data-app-id");
    if (!id) return;

    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      const manifestUrl = `${window.location.origin}/app/panel-ios-vshtech/install.php?id=${encodeURIComponent(id)}`;
      const itms = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
      window.location.href = itms;
    });

    // Gỡ href để tránh hiện link trên status bar
    link.removeAttribute("href");
  });
});
