(() => {
  const toggle = document.querySelector(".nav-toggle");
  const overlay = document.querySelector(".nav-overlay");
  const drawer = document.querySelector(".side-menu");
  const closeBtn = document.querySelector(".close-btn");

  const closeSubmenus = () => {
    drawer?.querySelectorAll(".side-dropdown").forEach(group => {
      const submenu = group.querySelector(".side-drop-menu");
      const arrow = group.querySelector(".side-arrow");
      const btn = group.querySelector(".side-drop-toggle");
      submenu?.setAttribute("hidden", "true");
      if (submenu) submenu.style.maxHeight = null;
      group.classList.remove("open");
      btn?.setAttribute("aria-expanded", "false");
      if (arrow) arrow.style.transform = "";
    });
  };

  const closeMenu = () => {
    closeSubmenus();
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

  // Mobile dropdowns
  drawer?.querySelectorAll(".side-dropdown").forEach(group => {
    const btn = group.querySelector(".side-drop-toggle");
    const submenu = group.querySelector(".side-drop-menu");
    const arrow = group.querySelector(".side-arrow");
    btn?.addEventListener("click", () => {
      const isOpen = group.classList.contains("open");
      if (isOpen) {
        submenu?.setAttribute("hidden", "true");
        if (submenu) {
          submenu.style.maxHeight = null;
          submenu.classList.remove("show");
        }
        group.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        if (arrow) arrow.style.transform = "";
      } else {
        submenu?.removeAttribute("hidden");
        if (submenu) {
          submenu.style.maxHeight = submenu.scrollHeight + "px";
          submenu.classList.add("show");
        }
        group.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
        if (arrow) arrow.style.transform = "rotate(180deg)";
      }
    });
  });

  // Desktop dropdown
  const deskDrop = document.querySelector(".nav-dropdown");
  const deskBtn = deskDrop?.querySelector(".nav-drop-toggle");
  const deskMenu = deskDrop?.querySelector(".nav-drop-menu");
  const deskArrow = deskDrop?.querySelector(".nav-arrow");

  const closeDesk = () => {
    deskDrop?.classList.remove("open");
    deskBtn?.setAttribute("aria-expanded", "false");
    if (deskMenu) deskMenu.style.pointerEvents = "none";
    if (deskArrow) deskArrow.style.transform = "";
  };

  deskBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = deskDrop?.classList.contains("open");
    if (isOpen) {
      closeDesk();
    } else {
      deskDrop?.classList.add("open");
      deskBtn?.setAttribute("aria-expanded", "true");
      if (deskMenu) deskMenu.style.pointerEvents = "auto";
    }
  });

  document.addEventListener("click", (e) => {
    if (deskDrop && !deskDrop.contains(e.target)) closeDesk();
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeMenu();
      closeDesk();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 992) closeMenu();
  });
})();
