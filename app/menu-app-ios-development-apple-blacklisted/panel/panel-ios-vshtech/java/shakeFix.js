(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function expAlpha(rate, dt) { return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt)); }
  function hypot(x, y) { return Math.hypot(x, y); }

  function v2(x = 0, y = 0) { return { x, y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
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

  function defaultConfig() {
    return {
      enabled: true,
      inputMode: "delta",

      sensitivity: 1.0,

      dtMin: 1 / 240,
      dtMax: 1 / 20,

      antiSpike: true,
      maxDeltaAbs: 90,
      maxSpeed: 3800,

      deadzonePx: 0.0,

      emaEnabled: true,
      emaRate: 28,

      euroEnabled: true,
      euroMinCutoff: 1.35,
      euroBeta: 0.03,
      euroDerivCutoff: 1.0,

      outMaxSpeed: 0,

      microJitterKill: true,
      microWindowPx: 0.8,
      microHoldFrames: 1,

      axisX: 1.0,
      axisY: 1.0,
      invertY: false
    };
  }

  function createAntiJitterController(options = {}) {
    const cfg = { ...defaultConfig(), ...options };

    const emaX = new LowPass();
    const emaY = new LowPass();
    const euroX = new OneEuro();
    const euroY = new OneEuro();

    let ret = v2(0, 0);
    let lastAbs = null;

    let microCount = 0;

    function setConfig(p) { Object.assign(cfg, p || {}); }
    function setReticle(p) {
      ret = v2(p.x, p.y);
      lastAbs = null;
      emaX.reset(ret.x); emaY.reset(ret.y);
      euroX.reset(ret.x); euroY.reset(ret.y);
      microCount = 0;
    }
    function getReticle() { return v2(ret.x, ret.y); }

    function update(input) {
      let dt = input.dt ?? (1 / 60);
      dt = clamp(dt, cfg.dtMin, cfg.dtMax);

      const mode = input.mode ?? cfg.inputMode;
      const sens = Math.max(0, input.sensitivity ?? cfg.sensitivity);

      let dx = 0, dy = 0;

      if (mode === "absolute") {
        const m = input.mouse;
        if (!m) throw new Error("absolute requires input.mouse={x,y}");
        if (lastAbs) { dx = m.x - lastAbs.x; dy = m.y - lastAbs.y; }
        lastAbs = v2(m.x, m.y);
      } else {
        const d = input.mouseDelta;
        if (!d) throw new Error("delta requires input.mouseDelta={x,y}");
        dx = d.x; dy = d.y;
      }

      dx *= sens * cfg.axisX;
      dy *= sens * cfg.axisY * (cfg.invertY ? -1 : 1);

      let d = v2(dx, dy);

      if (cfg.antiSpike) {
        d = clampDelta(d, cfg.maxDeltaAbs);
        d = clampSpeed(d, dt, cfg.maxSpeed);
      }

      d = deadzone(d, cfg.deadzonePx);

      if (!cfg.enabled) {
        ret = add(ret, d);
        return { reticle: getReticle(), delta: d, dt };
      }

      if (cfg.microJitterKill) {
        const mag = len(d);
        if (mag > 0 && mag <= cfg.microWindowPx) {
          microCount = Math.min(60, microCount + 1);
        } else {
          microCount = Math.max(0, microCount - 1);
        }
        if (microCount >= cfg.microHoldFrames) {
          d = v2(0, 0);
        }
      }

      let nx = ret.x + d.x;
      let ny = ret.y + d.y;

      if (cfg.emaEnabled) {
        const a = expAlpha(cfg.emaRate, dt);
        nx = emaX.f(nx, a);
        ny = emaY.f(ny, a);
      }

      if (cfg.euroEnabled) {
        nx = euroX.f(nx, dt, cfg.euroMinCutoff, cfg.euroBeta, cfg.euroDerivCutoff);
        ny = euroY.f(ny, dt, cfg.euroMinCutoff, cfg.euroBeta, cfg.euroDerivCutoff);
      }

      let out = v2(nx, ny);

      if (cfg.outMaxSpeed && cfg.outMaxSpeed > 0) {
        const od = sub(out, ret);
        const capped = clampSpeed(od, dt, cfg.outMaxSpeed);
        out = add(ret, capped);
      }

      const outDelta = sub(out, ret);
      ret = out;

      return { reticle: getReticle(), delta: outDelta, dt };
    }

    return { update, setReticle, getReticle, setConfig, config: cfg };
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

    function start(e) { down = true; last = pos(e); }
    function move(e) {
      if (!down) return;
      const p = pos(e);
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      last = p;
      onDelta(dx, dy, e);
    }
    function end() { down = false; last = null; }

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

  const shakeFixLoop = (() => {
    let active = false;
    let controller = null;
    let lastTs = 0;
    let unbind = null;

    function enable() {
      if (active) return;
      const canvas = document.getElementById("aimCanvas");
      if (!canvas) return;
      active = true;
      controller = createAntiJitterController();
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

  handlers.shakeFix = {
    enable: shakeFixLoop.enable,
    disable: shakeFixLoop.disable,
  };
})();
