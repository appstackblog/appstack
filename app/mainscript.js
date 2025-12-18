document.addEventListener("DOMContentLoaded", () => {
  const topMenu = document.querySelector(".top-menu");
  const panelOverlay = document.querySelector(".panel-overlay");
  const panelModal = document.querySelector(".panel-modal");
  const panelClose = document.querySelector(".panel-close");

  const closeDropdown = () => {
    panelOverlay?.classList.remove("open");
    document.body.classList.remove("modal-open");
    if (topMenu) topMenu.setAttribute("aria-expanded", "false");
  };

  if (topMenu && panelOverlay && panelModal) {
    const panelLinks = panelOverlay.querySelectorAll(".panel-link");

    topMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = panelOverlay.classList.toggle("open");
      topMenu.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("modal-open", isOpen);
    });

    panelLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (!href) return;

        if (href.startsWith("#")) {
          event.preventDefault();
          const target = document.querySelector(href);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          closeDropdown();
          return;
        }

        closeDropdown();
      });
    });

    panelClose?.addEventListener("click", closeDropdown);

    panelOverlay.addEventListener("click", (event) => {
      if (event.target === panelOverlay) closeDropdown();
    });

    document.addEventListener("click", (event) => {
      if (!panelOverlay.contains(event.target) && !topMenu.contains(event.target)) {
        closeDropdown();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDropdown();
    });
  }

  document.querySelectorAll(".panel-toggle-btn").forEach((btn) => {
    const targetId = btn.dataset.target;
    const panelList = targetId ? document.getElementById(targetId) : null;
    if (!panelList) return;

    const setPanelState = (open) => {
      btn.textContent = open ? "Thu gọn" : "Xem thêm";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    };

    setPanelState(false);

    btn.addEventListener("click", () => {
      const willOpen = panelList.hasAttribute("hidden");
      if (willOpen) {
        panelList.removeAttribute("hidden");
      } else {
        panelList.setAttribute("hidden", "");
      }
      setPanelState(willOpen);
    });
  });

  const tagline = document.querySelector(".tagline");
  if (!tagline) return;
});

// DNS download handler (ẩn link, chặn desktop)
(() => {
  const btn = document.querySelector(".dns-download");
  if (!btn) return;
  const dnsId = btn.getAttribute("data-dns-id");
  const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isMobile) {
      alert("Chỉ tải cấu hình DNS trên iPhone/iPad.");
      return;
    }
    if (dnsId) {
      window.location.href = `./dns.php?id=${encodeURIComponent(dnsId)}`;
    }
  });
})();
