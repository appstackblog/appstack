(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hypot(x, y) { return Math.hypot(x, y); }
  function expAlpha(rate, dt) { return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt)); }

  function v2(x = 0, y = 0) { return { x, y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len(a) { return Math.hypot(a.x, a.y); }

  function clampDelta(d, maxAbs) {
    const m = Math.max(0, maxAbs);
    if (!m) return d;
    return { x: clamp(d.x, -m, m), y: clamp(d.y, -m, m) };
  }
  function clampSpeed(delta, dt, maxSpeed) {
    const ms = Math.max(0, maxSpeed);
    if (!ms || dt <= 0) return delta;
    const d = len(delta);
    const maxD = ms * dt;
    if (d <= maxD || d < 1e-9) return delta;
    return mul(delta, maxD / d);
  }
  function deadzone(delta, dz) {
    const r = Math.max(0, dz);
    if (!r) return delta;
    const d = len(delta);
    if (d <= r) return v2(0, 0);
    const k = (d - r) / d;
    return mul(delta, k);
  }

  class LowPass {
    constructor() { this.i = false; this.y = 0; }
    reset(v = 0) { this.i = true; this.y = v; }
    f(x, a) { if (!this.i) { this.i = true; this.y = x; return x; } this.y = a * x + (1 - a) * this.y; return this.y; }
  }

  function curveApply(x, mode, intensity) {
    const s = clamp(intensity ?? 0, 0, 1);
    if (!s) return x;

    if (mode === "linear") return x;

    if (mode === "power") {
      const p = lerp(1.0, 2.6, s);
      return Math.sign(x) * Math.pow(Math.abs(x), p);
    }

    if (mode === "tanh") {
      const k = lerp(1.0, 3.5, s);
      return Math.tanh(x * k);
    }

    if (mode === "softsign") {
      const k = lerp(1.0, 4.0, s);
      const v = x * k;
      return v / (1 + Math.abs(v));
    }

    if (mode === "scurve") {
      const k = lerp(1.0, 3.0, s);
      const v = x;
      const y = Math.tanh(v * k);
      return lerp(v, y, s);
    }

    return x;
  }

  function accelGain(speed, cfg) {
    const base = Math.max(0, cfg.accelBase);
    const max = Math.max(base, cfg.accelMax);
    const ref = Math.max(1e-6, cfg.accelRefSpeed);
    const curve = Math.max(0.1, cfg.accelCurve);
    const t = clamp(speed / ref, 0, 1);
    const shaped = Math.pow(t, curve);
    return lerp(base, max, shaped);
  }

  function createSensitivityController(options = {}) {
    const cfg = {
      enabled: true,
      dtMin: 1 / 240,
      dtMax: 1 / 20,

      sensitivity: 2.2,
      axisX: 1.0,
      axisY: 1.0,

      accelEnabled: true,
      accelBase: 1.0,
      accelMax: 1.85,
      accelRefSpeed: 1200,
      accelCurve: 1.25,

      curveEnabled: true,
      curveMode: "scurve",
      curveIntensity: 0.55,
      curveNormalize: 50,

      deadzonePx: 0.0,

      antiSpike: true,
      maxDeltaAbs: 120,
      maxSpeed: 5200,

      maxOutSpeed: 0,

      smoothingEnabled: true,
      smoothingRate: 0,

      outputScale: 1.0,

      ...options
    };

    const smX = new LowPass();
    const smY = new LowPass();

    function setConfig(patch) { Object.assign(cfg, patch || {}); }
    function reset() { smX.i = false; smY.i = false; }

    function update(input) {
      let dt = input.dt ?? (1 / 60);
      dt = clamp(dt, cfg.dtMin, cfg.dtMax);

      let dx = (input.dx ?? 0);
      let dy = (input.dy ?? 0);

      dx *= cfg.sensitivity * cfg.axisX;
      dy *= cfg.sensitivity * cfg.axisY;

      let d = v2(dx, dy);

      if (cfg.antiSpike) {
        d = clampDelta(d, cfg.maxDeltaAbs);
        d = clampSpeed(d, dt, cfg.maxSpeed);
      }

      d = deadzone(d, cfg.deadzonePx);

      if (!cfg.enabled) {
        return { dx: d.x, dy: d.y, dt };
      }

      const speed = len(d) / Math.max(1e-6, dt);

      if (cfg.accelEnabled) {
        const g = accelGain(speed, cfg);
        d = mul(d, g);
      }

      if (cfg.curveEnabled) {
        const n = Math.max(1e-6, cfg.curveNormalize);
        const nx = clamp(d.x / n, -1, 1);
        const ny = clamp(d.y / n, -1, 1);
        const cx = curveApply(nx, cfg.curveMode, cfg.curveIntensity);
        const cy = curveApply(ny, cfg.curveMode, cfg.curveIntensity);
        d = { x: cx * n, y: cy * n };
      }

      if (cfg.maxOutSpeed && cfg.maxOutSpeed > 0) {
        d = clampSpeed(d, dt, cfg.maxOutSpeed);
      }

      if (cfg.smoothingEnabled && cfg.smoothingRate > 0) {
        const a = expAlpha(cfg.smoothingRate, dt);
        d = { x: smX.f(d.x, a), y: smY.f(d.y, a) };
      }

      d = mul(d, cfg.outputScale);

      return { dx: d.x, dy: d.y, dt, speed };
    }

    return { update, setConfig, reset, config: cfg };
  }

  function bindPointerDelta(element, onDelta) {
    let down = false;
    let last = null;

    function pos(e) {
      if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    function start(e) {
      down = true;
      last = pos(e);
    }
    function move(e) {
      if (!down) return;
      const p = pos(e);
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      last = p;
      onDelta(dx, dy, e);
    }
    function end() {
      down = false;
      last = null;
    }

    element.addEventListener("mousedown", start, { passive: true });
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseup", end, { passive: true });

    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: true });
    element.addEventListener("touchend", end, { passive: true });
    element.addEventListener("touchcancel", end, { passive: true });

    return function unbind() {
      element.removeEventListener("mousedown", start);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);

      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
    };
  }

  const quickSwipeLoop = (() => {
    let active = false;
    let controller = null;
    let lastTs = 0;
    let unbind = null;

    function enable() {
      if (active) return;
      const canvas = document.getElementById("aimCanvas");
      if (!canvas) return;
      active = true;
      controller = createSensitivityController();
      lastTs = 0;
      unbind = bindPointerDelta(canvas, (dx, dy) => {
        if (!active || !controller) return;
        const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        if (!lastTs) lastTs = now;
        const dt = Math.max(1 / 240, Math.min(1 / 20, (now - lastTs) / 1000));
        lastTs = now;
        controller.update({ dx, dy, dt });
      });
    }

    function disable() {
      if (!active) return;
      active = false;
      if (typeof unbind === "function") unbind();
      unbind = null;
      controller = null;
      lastTs = 0;
    }

    return { enable, disable };
  })();

  handlers.quickSwipe = {
    enable: quickSwipeLoop.enable,
    disable: quickSwipeLoop.disable,
  };
})();
