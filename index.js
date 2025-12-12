(() => {
  const toggle = document.querySelector(".nav-toggle");
  const overlay = document.querySelector(".nav-overlay");
  const drawer = document.querySelector(".side-menu");
  const closeBtn = document.querySelector(".close-btn");

  const closeMenu = () => {
    drawer?.classList.remove("open");
    overlay?.setAttribute("hidden", "true");
  };

  const openMenu = () => {
    drawer?.classList.add("open");
    overlay?.removeAttribute("hidden");
  };

  const toggleMenu = () => {
    if (drawer?.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  toggle?.addEventListener("click", toggleMenu);
  overlay?.addEventListener("click", closeMenu);
  closeBtn?.addEventListener("click", closeMenu);
  drawer?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 992) closeMenu();
  });
})();
