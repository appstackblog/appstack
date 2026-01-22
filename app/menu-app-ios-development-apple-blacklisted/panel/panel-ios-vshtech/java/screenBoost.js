(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hypot(x, y) { return Math.hypot(x, y); }
  function expAlpha(rate, dt) { return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt)); }

  function v2(x = 0, y = 0) { return { x, y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len(a) { return Math.hypot(a.x, a.y); }
  function norm(a) { const d = len(a); return d > 1e-9 ? { x: a.x / d, y: a.y / d, d } : { x: 0, y: 0, d: 0 }; }

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
    f(x, a) {
      if (!this.i) { this.i = true; this.y = x; return x; }
      this.y = a * x + (1 - a) * this.y;
      return this.y;
    }
  }

  class OneEuro {
    constructor() { this.x = new LowPass(); this.dx = new LowPass(); }
    reset(v = 0) { this.x.reset(v); this.dx.reset(0); }
    alpha(cutoff, dt) {
      const c = Math.max(1e-6, cutoff);
      const t = Math.max(1e-6, dt);
      const tau = 1 / (2 * Math.PI * c);
      return 1 / (1 + tau / t);
    }
    f(v, dt, minCut, beta, derCut) {
      const prev = this.x.i ? this.x.y : v;
      const dv = (v - prev) / Math.max(1e-6, dt);
      const aD = this.alpha(derCut, dt);
      const edv = this.dx.f(dv, aD);
      const cut = minCut + beta * Math.abs(edv);
      const aX = this.alpha(cut, dt);
      return this.x.f(v, aX);
    }
  }

  function curveApply(x, mode, intensity) {
    const s = clamp(intensity ?? 0, 0, 1);
    if (!s) return x;

    if (mode === "linear") return x;

    if (mode === "power") {
      const p = lerp(1.0, 2.8, s);
      return Math.sign(x) * Math.pow(Math.abs(x), p);
    }

    if (mode === "tanh") {
      const k = lerp(1.0, 4.2, s);
      return Math.tanh(x * k);
    }

    if (mode === "softsign") {
      const k = lerp(1.0, 5.0, s);
      const v = x * k;
      return v / (1 + Math.abs(v));
    }

    if (mode === "scurve") {
      const k = lerp(1.0, 3.6, s);
      const y = Math.tanh(x * k);
      return lerp(x, y, s);
    }

    if (mode === "expo") {
      const e = lerp(1.0, 3.0, s);
      return Math.sign(x) * (1 - Math.exp(-Math.abs(x) * e));
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

  function boostByDistance(delta, cfg) {
    if (!cfg.boostEnabled) return delta;
    const n = norm(delta);
    if (n.d < 1e-9) return delta;
    const d = n.d;
    const ref = Math.max(1e-6, cfg.boostRefDelta);
    const t = clamp(d / ref, 0, 1);
    const shaped = Math.pow(t, cfg.boostCurve);
    const g = lerp(cfg.boostMin, cfg.boostMax, shaped);
    return mul(delta, g);
  }

  function axisTransform(delta, cfg) {
    const ax = clamp(cfg.axisX, 0, 10);
    const ay = clamp(cfg.axisY, 0, 10);
    const inv = !!cfg.invertY;
    return { x: delta.x * ax, y: delta.y * ay * (inv ? -1 : 1) };
  }

  function createBuffManController(options = {}) {
    const cfg = {
      enabled: true,

      inputMode: "delta",
      dtMin: 1 / 240,
      dtMax: 1 / 20,

      sensitivity: 3.6,
      axisX: 1.0,
      axisY: 1.0,
      invertY: false,

      antiSpike: true,
      maxDeltaAbs: 180,
      maxSpeed: 7000,

      deadzonePx: 0.0,

      accelEnabled: true,
      accelBase: 1.0,
      accelMax: 2.4,
      accelRefSpeed: 900,
      accelCurve: 1.12,

      curveEnabled: true,
      curveMode: "tanh",
      curveIntensity: 0.72,
      curveNormalize: 60,

      boostEnabled: true,
      boostMin: 1.0,
      boostMax: 1.35,
      boostRefDelta: 20,
      boostCurve: 1.15,

      maxOutSpeed: 0,

      smoothingEnabled: true,
      smoothingMode: "oneeuro",
      emaRate: 32,
      euroMinCutoff: 1.45,
      euroBeta: 0.03,
      euroDerivCutoff: 1.0,

      outputScale: 1.0,

      ...options
    };

    const smX = new LowPass();
    const smY = new LowPass();
    const euroX = new OneEuro();
    const euroY = new OneEuro();

    let lastAbs = null;

    function setConfig(patch) { Object.assign(cfg, patch || {}); }
    function reset() {
      lastAbs = null;
      smX.i = false; smY.i = false;
      euroX.reset(0); euroY.reset(0);
    }

    function update(input) {
      if (!cfg.enabled) {
        const dt = clamp(input.dt ?? 1 / 60, cfg.dtMin, cfg.dtMax);
        return { dx: (input.dx ?? 0), dy: (input.dy ?? 0), dt, raw: { dx: (input.dx ?? 0), dy: (input.dy ?? 0) } };
      }

      let dt = clamp(input.dt ?? 1 / 60, cfg.dtMin, cfg.dtMax);

      let raw = v2(0, 0);

      if ((input.mode ?? cfg.inputMode) === "absolute") {
        const m = input.mouse;
        if (!m) throw new Error("absolute mode requires input.mouse={x,y}");
        if (lastAbs) raw = sub(v2(m.x, m.y), lastAbs);
        lastAbs = v2(m.x, m.y);
      } else {
        raw = v2(input.dx ?? input.mouseDelta?.x ?? 0, input.dy ?? input.mouseDelta?.y ?? 0);
      }

      let d = mul(raw, Math.max(0, cfg.sensitivity));
      d = axisTransform(d, cfg);

      if (cfg.antiSpike) {
        d = clampDelta(d, cfg.maxDeltaAbs);
        d = clampSpeed(d, dt, cfg.maxSpeed);
      }

      d = deadzone(d, cfg.deadzonePx);

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
        d = v2(cx * n, cy * n);
      }

      d = boostByDistance(d, cfg);

      if (cfg.maxOutSpeed && cfg.maxOutSpeed > 0) {
        d = clampSpeed(d, dt, cfg.maxOutSpeed);
      }

      if (cfg.smoothingEnabled) {
        if (cfg.smoothingMode === "ema") {
          const a = expAlpha(cfg.emaRate, dt);
          d = v2(smX.f(d.x, a), smY.f(d.y, a));
        } else {
          d = v2(
            euroX.f(d.x, dt, cfg.euroMinCutoff, cfg.euroBeta, cfg.euroDerivCutoff),
            euroY.f(d.y, dt, cfg.euroMinCutoff, cfg.euroBeta, cfg.euroDerivCutoff)
          );
        }
      }

      d = mul(d, Math.max(0, cfg.outputScale));

      return { dx: d.x, dy: d.y, dt, speed, raw: { dx: raw.x, dy: raw.y } };
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

  const screenBoostLoop = (() => {
    let active = false;
    let controller = null;
    let lastTs = 0;
    let unbind = null;

    function enable() {
      if (active) return;
      const canvas = document.getElementById("aimCanvas");
      if (!canvas) return;
      active = true;
      controller = createBuffManController();
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

  handlers.screenBoost = {
    enable: screenBoostLoop.enable,
    disable: screenBoostLoop.disable,
  };
})();
