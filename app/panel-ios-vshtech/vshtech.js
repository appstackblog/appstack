document.addEventListener("DOMContentLoaded", () => {
  // Prevent opening devtools via F12 / Ctrl+Shift+I
  document.addEventListener("keydown", (e) => {
    const key = e.key?.toLowerCase();
    if (key === "f12" || (e.ctrlKey && e.shiftKey && (key === "i" || key === "j"))) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  const translations = {
    en: {
      "site.title": "PANEL IOS",
      "nav.home": "Home",
      "nav.dns": "DNS Config",
      "nav.apps": "Apps",
      "nav.languages": "Languages",
      "banner.title": "First, you need to download the DNS configuration file to your phone before installing the PANEL IOS.",
      "banner.link": "MOVE THERE",
      "hero.feature.simple": "Simple",
      "hero.feature.efficient": "Efficient",
      "hero.feature.phone": "Phone",
      "button.install": "Install",
      "button.download": "Download",
      toggleMore: "See more",
      toggleLess: "Collapse",
    },
    vi: {
      "site.title": "PANEL IOS",
      "nav.home": "Trang chủ",
      "nav.dns": "Cấu hình DNS",
      "nav.apps": "Ứng dụng",
      "nav.languages": "Ngôn ngữ",
      "banner.title": "Bạn cần tải cấu hình DNS về máy trước khi cài đặt PANEL IOS.",
      "banner.link": "DI CHUYỂN",
      "hero.feature.simple": "Đơn giản",
      "hero.feature.efficient": "Hiệu quả",
      "hero.feature.phone": "Điện thoại",
      "button.install": "Cài đặt",
      "button.download": "Tải về",
      toggleMore: "Xem thêm",
      toggleLess: "Thu gọn",
    },
  };

  const LANG_KEY = "site_lang";
  let currentLang = localStorage.getItem(LANG_KEY) || "en";

  const applyLang = (lang) => {
    const dict = translations[lang] || translations.en;
    document.documentElement.setAttribute("lang", lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll(".panel-toggle-btn").forEach((btn) => {
      const targetId = btn.dataset.target;
      const panelList = targetId ? document.getElementById(targetId) : null;
      if (!panelList) return;
      const setPanelState = (open) => {
        btn.textContent = open ? dict.toggleLess : dict.toggleMore;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      };
      setPanelState(!panelList.hasAttribute("hidden"));
      if (!btn.dataset.langHooked) {
        btn.addEventListener("click", () => {
          const willOpen = panelList.hasAttribute("hidden");
          if (willOpen) {
            panelList.removeAttribute("hidden");
          } else {
            panelList.setAttribute("hidden", "");
          }
          setPanelState(willOpen);
        });
        btn.dataset.langHooked = "true";
      }
    });
  };

  const langOptions = document.querySelectorAll(".lang-option[data-lang]");
  const langSelector = document.querySelector(".lang-selector");
  const langBtn = langSelector?.querySelector(".lang-btn");

  const closeLang = () => {
    langSelector?.classList.remove("open");
  };

  langBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    langSelector?.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (langSelector && !langSelector.contains(e.target)) {
      closeLang();
    }
  });

  langOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      const lang = opt.dataset.lang || "en";
      currentLang = lang;
      localStorage.setItem(LANG_KEY, lang);
      applyLang(lang);
      closeLang();
    });
  });

  applyLang(currentLang);

  const topMenu = document.querySelector(".top-menu");
  const panelOverlay = document.querySelector(".panel-overlay");
  const panelModal = document.querySelector(".panel-modal");
  const panelClose = document.querySelector(".panel-close");

  const closeDropdown = () => {
    panelOverlay?.classList.remove("open");
    document.body.classList.remove("modal-open");
    if (topMenu) {
      topMenu.setAttribute("aria-expanded", "false");
    }
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
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          closeDropdown();
          return;
        }

        closeDropdown();
      });
    });

    if (panelClose) {
      panelClose.addEventListener("click", closeDropdown);
    }

    panelOverlay.addEventListener("click", (event) => {
      if (event.target === panelOverlay) {
        closeDropdown();
      }
    });

    document.addEventListener("click", (event) => {
      if (!panelOverlay.contains(event.target) && !topMenu.contains(event.target)) {
        closeDropdown();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    });
  }

  const tagline = document.querySelector(".tagline");
  if (!tagline) return;

  const appLinks = document.querySelectorAll(".app-download[data-app-id]");
  appLinks.forEach((link) => {
    const id = link.getAttribute("data-app-id");
    if (!id) return;
    const target = `itms-services://?action=download-manifest&url=${window.location.origin}/app/panel-ios-vshtech/install.php?id=${encodeURIComponent(id)}`;
    link.setAttribute("href", target);
  });
});
