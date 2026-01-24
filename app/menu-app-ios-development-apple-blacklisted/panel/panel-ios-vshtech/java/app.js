window.__panelScriptLoaded = true;
const MAX_ACTIVE = 3;
const featureHandlers = (window.featureHandlers = window.featureHandlers || {});

const CODE_COLUMNS = 8;
const CODE_SNIPPETS = [
  `namespace ios {
  float aim = 0.45f;
  bool lock = true;
}`,
  `template<typename T>
T smooth(T a, T b, float k){
  return a + (b - a) * k;
}`,
  `struct DriftFix {
  float spread; float decay;
};
DriftFix fix{1.2f, 0.04f};`,
  `constexpr int MAX_LOCK = 3;
volatile bool active = false;`,
  `std::array<float,4> recoil {0.2f,0.3f,0.1f,0.5f};`,
  `auto clamp = [](float v){
  return std::max(0.f, std::min(1.f, v));
};`,
  `for(size_t i=0;i<nodes.size();++i){
  nodes[i].update();
}`,
  `std::cout << "LOCK" << std::endl;
++tick;`,
];

const ping = createPing();

function initPanel() {
  const cards = document.querySelectorAll("[data-feature]");
  const limitToast = document.getElementById("limitToast");
  const limitOverlay = document.getElementById("limitOverlay");
  if (!cards.length) {
    return;
  }
  const featureState = {};
  const featureRefs = {};
  cards.forEach((card) => {
    const featureId = card.getAttribute("data-feature");
    const button = card.querySelector(".aimlock-switch");
    const status = card.querySelector(".status-pill");
    if (!featureId || !button || !status) {
      return;
    }
    featureState[featureId] = false;
    featureRefs[featureId] = { button, status, card };
    button.addEventListener("click", (event) => {
      event.preventDefault();
      toggleFeature(featureId);
    });
    card.addEventListener("click", (event) => {
      if (event.target.closest(".aimlock-switch")) {
        return;
      }
      toggleFeature(featureId);
    });
  });

  function activeCount() {
    return Object.keys(featureState).reduce((count, id) => count + (featureState[id] ? 1 : 0), 0);
  }

  function toggleFeature(id) {
    if (!featureRefs[id]) {
      return;
    }
    if (!featureState[id] && activeCount() >= MAX_ACTIVE) {
      showLimit();
      return;
    }
    featureState[id] = !featureState[id];
    renderFeature(id, featureState[id]);
    runFeatureHandler(id, featureState[id]);
    ping();
  }

  function renderFeature(id, isOn) {
    const refs = featureRefs[id];
    refs.button.classList.toggle("on", isOn);
    refs.button.setAttribute("aria-pressed", String(isOn));
    refs.card.classList.toggle("active", isOn);
    refs.status.textContent = isOn ? "On" : "Off";
    refs.status.classList.toggle("on", isOn);
    refs.status.classList.toggle("off", !isOn);
  }

  function showLimit() {
    if (!limitToast) {
      return;
    }
    limitToast.classList.add("show");
    if (limitOverlay) {
      limitOverlay.classList.add("show");
    }
    setTimeout(() => {
      limitToast.classList.remove("show");
      if (limitOverlay) {
        limitOverlay.classList.remove("show");
      }
    }, 1600);
  }

  function runFeatureHandler(id, isOn) {
    const handler = featureHandlers[id];
    if (!handler) {
      return;
    }
    if (isOn && handler.enable) {
      handler.enable();
    } else if (!isOn && handler.disable) {
      handler.disable();
    }
  }
}

function createPing() {
  const AudioApi = window.AudioContext || window.webkitAudioContext;
  if (!AudioApi) {
    return () => {};
  }
  const ctx = new AudioApi();
  return () => {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  };
}

function startCodeRain() {
  const layer = document.getElementById("codeRain");
  if (!layer) {
    return;
  }
  layer.innerHTML = "";
  const pickSnippet = () => CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
  const formatSnippet = (snippet) =>
    snippet
      .split("\n")
      .map((line) => (line.trim().length === 0 ? " " : line))
      .join("<br />");
  const spawnColumn = () => {
    const column = document.createElement("div");
    column.className = "code-column";
    layer.appendChild(column);
    const track = document.createElement("div");
    track.className = "code-track";
    column.appendChild(track);
    const duration = 12 + Math.random() * 14;
    column.style.setProperty("--duration", `${duration}s`);
    column.style.setProperty("--delay", `${-Math.random() * duration}s`);
    const refresh = () => {
      const snippet = formatSnippet(pickSnippet());
      track.innerHTML = `${snippet}<br />${snippet}`;
    };
    refresh();
    setInterval(refresh, 4500 + Math.random() * 5500);
  };
  for (let i = 0; i < CODE_COLUMNS; i += 1) {
    spawnColumn();
  }
}

function bootPanel() {
  initPanel();
  startCodeRain();
  console.log("Panel booted, features:", Object.keys(featureHandlers));
  const functionBtn = document.getElementById("btnFunction");
  const homeBtn = document.getElementById("btnHome");
  const boosterBtn = document.getElementById("btnBooster");
  const functionPanel = document.getElementById("functionPanel");
  const boosterPanel = document.getElementById("boosterPanel");
  const homePanel = document.getElementById("homePanel");
  const detailsBtn = document.getElementById("detailsBtn");
  const detailsPanel = document.getElementById("detailsPanel");
  const updateHomeLock = () => {
    const detailsOpen = detailsPanel ? detailsPanel.classList.contains("is-open") : false;
    const isHome = homePanel ? homePanel.classList.contains("is-active") : false;
    document.body.classList.toggle("home-locked", isHome && !detailsOpen);
    if (isHome && !detailsOpen) {
      if (!document.body.dataset.homeAnchorTop && homePanel) {
        const rect = homePanel.getBoundingClientRect();
        const top = rect.top + window.pageYOffset;
        document.body.dataset.homeAnchorTop = String(Math.max(0, Math.round(top)));
      }
      const top = Number(document.body.dataset.homeAnchorTop || 0);
      window.scrollTo({ top, left: 0, behavior: "auto" });
    }
  };
  const setView = (view) => {
    if (homePanel) homePanel.classList.toggle("is-active", view === "home");
    if (functionPanel) functionPanel.classList.toggle("is-active", view === "function");
    if (boosterPanel) boosterPanel.classList.toggle("is-active", view === "booster");
    document.body.classList.toggle("booster-lock", view === "booster");
    const scroller = document.querySelector(".screen");
    if (scroller) {
      scroller.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    updateHomeLock();
  };
  setView("home");
  if (homeBtn) homeBtn.addEventListener("click", () => setView("home"));
  if (functionBtn) functionBtn.addEventListener("click", () => setView("function"));
  if (boosterBtn) boosterBtn.addEventListener("click", () => setView("booster"));
  const groupBtn = document.getElementById("groupBtn");
  const groupPanel = document.getElementById("groupPanel");
  if (groupBtn && groupPanel) {
    groupBtn.addEventListener("click", () => {
      groupPanel.classList.toggle("is-open");
    });
  }
  if (detailsBtn && detailsPanel) {
    detailsBtn.addEventListener("click", () => {
      detailsPanel.classList.toggle("is-open");
      updateHomeLock();
    });
  }
  const boosterToast = document.getElementById("boosterToast");
  let toastTimer = null;
  const playChime = () => {
    const AudioApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioApi) return;
    const ctx = new AudioApi();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(920, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => {
      ctx.close();
    };
  };
  const showBoosterToast = (text) => {
    if (!boosterToast) return;
    boosterToast.textContent = text;
    boosterToast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      boosterToast.classList.remove("show");
    }, 1800);
  };
  const showNotification = (message) => {
    showBoosterToast(message);
  };
  const playLaunchTone = () => {
    playChime();
  };

  const log = (...args) => console.log("[Booster]", ...args);

  const ANDROID = {
    ff: { pkg: "com.dts.freefireth", store: "https://play.google.com/store/apps/details?id=com.dts.freefireth" },
    ffmax: { pkg: "com.dts.freefiremax", store: "https://play.google.com/store/apps/details?id=com.dts.freefiremax" }
  };

  const IOS = {
    ff: {
      store: "https://apps.apple.com/app/id1300146617",
      schemes: ["freefire://", "garenaff://", "ff://", "garena://", "freefireth://"]
    },
    ffmax: {
      store: "https://apps.apple.com/app/id1480516829",
      schemes: ["freefiremax://", "freefire-max://", "ffmax://", "garenaffmax://"]
    }
  };

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWebViewIOS = isIOS && !/Safari/i.test(ua);
  const isWebViewAndroid = isAndroid && /wv|Version\/\d+\.\d+|; wv\)/i.test(ua);

  log("UA:", ua);
  log("Platform:", isAndroid ? "Android" : isIOS ? "iOS" : "Other");
  log("WebView:", isWebViewIOS ? "iOS WebView" : isWebViewAndroid ? "Android WebView" : "Browser");

  const enc = (u) => encodeURIComponent(u);

  function withUserGesture(fn) {
    return (e) => {
      if (e && e.preventDefault) e.preventDefault();
      fn();
    };
  }

  function openAndroid(which) {
    const { pkg, store } = ANDROID[which];
    const intentUrl =
      `intent://#Intent;package=${pkg};` + `S.browser_fallback_url=${enc(store)};end`;
    log("Android intent:", intentUrl);
    let fallbackTimer = setTimeout(() => {
      log("Android fallback -> Play Store");
      window.location.href = store;
    }, 1200);

    try {
      window.location.href = intentUrl;
    } catch (err) {
      log("Android intent blocked:", err);
      clearTimeout(fallbackTimer);
      window.location.href = store;
    }
  }

  function openIOS(which) {
    const { store, schemes } = IOS[which];
    const itms = store.replace(/^https?:\/\//i, "itms-apps://");
    log("iOS schemes:", schemes);

    let usedFallback = false;
    let schemeIndex = 0;
    let visibilityHandled = false;
    let visibilityTimer = null;

    const cleanup = () => {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        visibilityHandled = true;
        log("iOS visibility hidden -> app opened");
        cleanup();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const tryScheme = (i) => {
      if (i >= schemes.length) {
        if (!usedFallback) {
          usedFallback = true;
          log("iOS fallback -> App Store itms-apps");
          window.location.href = itms;
          setTimeout(() => {
            if (!visibilityHandled) {
              log("iOS fallback -> App Store https");
              window.location.href = store;
            }
          }, 800);
        }
        cleanup();
        return;
      }

      const scheme = schemes[i];
      const start = Date.now();
      log("iOS try scheme:", scheme);
      window.location.href = scheme;

      visibilityTimer = setTimeout(() => {
        const elapsed = Date.now() - start;
        if (!document.hidden && elapsed < 1600) {
          log("iOS scheme failed, try next");
          tryScheme(i + 1);
        }
      }, 800);
    };

    tryScheme(0);

    setTimeout(() => {
      if (!usedFallback && !visibilityHandled) {
        log("iOS safety fallback -> App Store itms-apps");
        window.location.href = itms;
        setTimeout(() => (window.location.href = store), 800);
      }
    }, 1600);
  }

  function openGame(which) {
    const label = which === "ffmax" ? "Free Fire MAX" : "Free Fire";
    showNotification(`Launching ${label}...`);
    playLaunchTone();
    if (isAndroid) return openAndroid(which);
    if (isIOS) return openIOS(which);
    log("Desktop/Other: no redirect");
  }

  function matchByText(keyword) {
    const nodes = Array.from(document.querySelectorAll("button, a"));
    return nodes.find((el) => (el.textContent || "").toLowerCase().includes(keyword));
  }

  function bindButtons() {
    const btnFF =
      document.getElementById("btnFreeFire") ||
      document.querySelector('[data-app="ff"]') ||
      matchByText("free fire");

    const btnFFM =
      document.getElementById("btnFreeFireMax") ||
      document.querySelector('[data-app="ffmax"]') ||
      matchByText("max");

    if (btnFF) {
      btnFF.addEventListener("click", withUserGesture(() => openGame("ff")));
      log("Bind: Free Fire ->", btnFF);
    } else {
      log("Bind: Free Fire -> NOT FOUND");
    }

    if (btnFFM) {
      btnFFM.addEventListener("click", withUserGesture(() => openGame("ffmax")));
      log("Bind: Free Fire MAX ->", btnFFM);
    } else {
      log("Bind: Free Fire MAX -> NOT FOUND");
    }
  }

  bindButtons();
  document.querySelectorAll(".booster-btn").forEach((btn) => {
    btn.addEventListener("click", withUserGesture(() => {
      const game = (btn.getAttribute("data-game") || btn.textContent || "").toLowerCase();
      if (game.includes("max")) {
        openGame("ffmax");
        return;
      }
      if (game.includes("free fire")) {
        openGame("ff");
        return;
      }
      log("Booster button unmatched:", game);
    }));
  });
  window.__panelBooted = true;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPanel);
} else {
  bootPanel();
}
