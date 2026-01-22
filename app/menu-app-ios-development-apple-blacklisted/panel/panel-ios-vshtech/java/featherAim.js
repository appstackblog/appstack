(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hypot(x, y) { return Math.hypot(x, y); }

  function vec(x = 0, y = 0) { return { x, y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len(a) { return Math.hypot(a.x, a.y); }
  function norm(a) { const d = len(a); return d > 1e-9 ? { x: a.x / d, y: a.y / d, d } : { x: 0, y: 0, d: 0 }; }

  function expAlpha(rate, dt) {
    const r = Math.max(0, rate);
    const t = Math.max(0, dt);
    return 1 - Math.exp(-r * t);
  }

  function softsign(x) { return x / (1 + Math.abs(x)); }

  function applyResponseCurve(v, mode, strength) {
    const s = clamp(strength ?? 0.0, 0, 1);
    if (!s) return v;

    if (mode === "power") {
      const p = lerp(1.0, 2.2, s);
      const ax = Math.sign(v.x) * Math.pow(Math.abs(v.x), p);
      const ay = Math.sign(v.y) * Math.pow(Math.abs(v.y), p);
      return { x: ax, y: ay };
    }

    if (mode === "softsign") {
      const k = lerp(0.0, 1.75, s);
      return { x: softsign(v.x * k), y: softsign(v.y * k) };
    }

    if (mode === "sCurve") {
      const k = lerp(0.0, 1.5, s);
      const sx = v.x;
      const sy = v.y;
      const fx = Math.tanh(sx * (1 + k));
      const fy = Math.tanh(sy * (1 + k));
      return { x: fx, y: fy };
    }

    return v;
  }

  function clampDelta(delta, maxAbs) {
    const m = Math.max(0, maxAbs);
    if (!m) return delta;
    const dx = clamp(delta.x, -m, m);
    const dy = clamp(delta.y, -m, m);
    return { x: dx, y: dy };
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
    const n = norm(delta);
    if (n.d <= r) return { x: 0, y: 0 };
    const k = (n.d - r) / n.d;
    return { x: delta.x * k, y: delta.y * k };
  }

  function accelGain(speed, cfg) {
    const {
      accelEnabled = true,
      accelBase = 1.0,
      accelMax = 1.35,
      accelRefSpeed = 900,
      accelCurve = 1.2
    } = cfg;

    if (!accelEnabled) return 1.0;

    const s = Math.max(0, speed);
    const ref = Math.max(1e-6, accelRefSpeed);
    const t = clamp(s / ref, 0, 1);
    const shaped = Math.pow(t, accelCurve);
    return clamp(lerp(accelBase, accelMax, shaped), 0.1, 5.0);
  }

  function frictionGain(speed, cfg) {
    const {
      frictionEnabled = true,
      frictionMax = 0.22,
      frictionRefSpeed = 450,
      frictionCurve = 1.0
    } = cfg;

    if (!frictionEnabled) return 0.0;

    const ref = Math.max(1e-6, frictionRefSpeed);
    const t = clamp(1 - (speed / ref), 0, 1);
    const shaped = Math.pow(t, frictionCurve);
    return clamp(frictionMax * shaped, 0, 0.95);
  }

  class LowPass {
    constructor() {
      this.inited = false;
      this.y = 0;
    }
    reset(v = 0) {
      this.inited = true;
      this.y = v;
    }
    filter(x, alpha) {
      if (!this.inited) {
        this.inited = true;
        this.y = x;
        return x;
      }
      this.y = alpha * x + (1 - alpha) * this.y;
      return this.y;
    }
  }

  class OneEuro {
    constructor() {
      this.xLP = new LowPass();
      this.dxLP = new LowPass();
    }
    reset(x = 0) {
      this.xLP.reset(x);
      this.dxLP.reset(0);
    }
    filter(x, dt, cfg) {
      const {
        euroMinCutoff = 1.2,
        euroBeta = 0.02,
        euroDerivCutoff = 1.0
      } = cfg;

      const t = Math.max(1e-6, dt);
      const dx = (x - (this.xLP.inited ? this.xLP.y : x)) / t;

      const aD = this._alpha(euroDerivCutoff, t);
      const edx = this.dxLP.filter(dx, aD);

      const cutoff = euroMinCutoff + euroBeta * Math.abs(edx);
      const aX = this._alpha(cutoff, t);
      return this.xLP.filter(x, aX);
    }
    _alpha(cutoff, dt) {
      const c = Math.max(1e-6, cutoff);
      const tau = 1 / (2 * Math.PI * c);
      return 1 / (1 + tau / dt);
    }
  }

  function defaultConfig() {
    return {
      enabled: true,

      inputMode: "delta",

      sensitivity: 1.0,
      dtClampMin: 1 / 240,
      dtClampMax: 1 / 20,

      antiSpikeEnabled: true,
      spikeMaxDeltaAbs: 80,
      spikeMaxSpeed: 3500,

      deadzonePx: 0.0,

      responseCurveEnabled: true,
      responseCurveMode: "sCurve",
      responseCurveStrength: 0.45,

      emaEnabled: true,
      emaRate: 28,

      euroEnabled: true,
      euroMinCutoff: 1.35,
      euroBeta: 0.03,
      euroDerivCutoff: 1.0,

      accelEnabled: true,
      accelBase: 1.0,
      accelMax: 1.28,
      accelRefSpeed: 1200,
      accelCurve: 1.25,

      frictionEnabled: true,
      frictionMax: 0.18,
      frictionRefSpeed: 520,
      frictionCurve: 1.1,

      maxSpeed: 0,
      boundsEnabled: false,
      bounds: { xMin: 0, yMin: 0, xMax: 1280, yMax: 720 },

      debug: false
    };
  }

  function createAimController(options = {}) {
    const cfg = { ...defaultConfig(), ...options };

    let reticle = vec(0, 0);
    let lastMouseAbs = null;

    const emaX = new LowPass();
    const emaY = new LowPass();

    const euroX = new OneEuro();
    const euroY = new OneEuro();

    const state = {
      filteredDelta: vec(0, 0),
      rawDelta: vec(0, 0),
      speed: 0,
      accel: 1,
      friction: 0,
      dt: 0
    };

    function setConfig(patch = {}) {
      Object.assign(cfg, patch);
    }

    function setReticle(p) {
      reticle = { x: p.x, y: p.y };
      lastMouseAbs = null;
      emaX.reset(reticle.x);
      emaY.reset(reticle.y);
      euroX.reset(reticle.x);
      euroY.reset(reticle.y);
    }

    function getReticle() {
      return { x: reticle.x, y: reticle.y };
    }

    function update(input) {
      const enabled = !!cfg.enabled;
      let dt = input.dt ?? (1 / 60);
      dt = clamp(dt, cfg.dtClampMin, cfg.dtClampMax);

      const mode = input.mode ?? cfg.inputMode;
      const sens = Math.max(0, input.sensitivity ?? cfg.sensitivity);

      let rawDelta = vec(0, 0);

      if (mode === "absolute") {
        const m = input.mouse;
        if (!m) throw new Error("inputMode=absolute requires input.mouse={x,y}");
        if (lastMouseAbs) rawDelta = sub(m, lastMouseAbs);
        lastMouseAbs = { x: m.x, y: m.y };
      } else {
        const d = input.mouseDelta;
        if (!d) throw new Error("inputMode=delta requires input.mouseDelta={x,y}");
        rawDelta = { x: d.x, y: d.y };
      }

      rawDelta = mul(rawDelta, sens);

      if (!enabled) {
        reticle = add(reticle, rawDelta);
        if (cfg.boundsEnabled) reticle = applyBounds(reticle, cfg.bounds);
        if (cfg.debug) {
          state.rawDelta = rawDelta;
          state.filteredDelta = rawDelta;
          state.speed = len(rawDelta) / dt;
          state.accel = 1;
          state.friction = 0;
          state.dt = dt;
        }
        return { reticle: getReticle(), state: cfg.debug ? { ...state } : null };
      }

      if (cfg.antiSpikeEnabled) {
        rawDelta = clampDelta(rawDelta, cfg.spikeMaxDeltaAbs);
        rawDelta = clampSpeed(rawDelta, dt, cfg.spikeMaxSpeed);
      }

      rawDelta = deadzone(rawDelta, cfg.deadzonePx);

      const speed = len(rawDelta) / dt;
      const aGain = accelGain(speed, cfg);
      const fGain = frictionGain(speed, cfg);

      let shaped = mul(rawDelta, aGain);
      shaped = mul(shaped, 1 - fGain);

      if (cfg.responseCurveEnabled) {
        const nx = clamp(shaped.x / 50, -1, 1);
        const ny = clamp(shaped.y / 50, -1, 1);
        const curved = applyResponseCurve({ x: nx, y: ny }, cfg.responseCurveMode, cfg.responseCurveStrength);
        shaped = {
          x: lerp(shaped.x, curved.x * 50, cfg.responseCurveStrength),
          y: lerp(shaped.y, curved.y * 50, cfg.responseCurveStrength)
        };
      }

      if (cfg.maxSpeed && cfg.maxSpeed > 0) {
        shaped = clampSpeed(shaped, dt, cfg.maxSpeed);
      }

      let next = add(reticle, shaped);

      if (cfg.emaEnabled) {
        const a = expAlpha(cfg.emaRate, dt);
        next = { x: emaX.filter(next.x, a), y: emaY.filter(next.y, a) };
      }

      if (cfg.euroEnabled) {
        next = { x: euroX.filter(next.x, dt, cfg), y: euroY.filter(next.y, dt, cfg) };
      }

      if (cfg.boundsEnabled) next = applyBounds(next, cfg.bounds);

      reticle = next;

      if (cfg.debug) {
        state.rawDelta = rawDelta;
        state.filteredDelta = shaped;
        state.speed = speed;
        state.accel = aGain;
        state.friction = fGain;
        state.dt = dt;
      }

      return { reticle: getReticle(), state: cfg.debug ? { ...state } : null };
    }

    function applyBounds(p, b) {
      return {
        x: clamp(p.x, b.xMin, b.xMax),
        y: clamp(p.y, b.yMin, b.yMax)
      };
    }

    return {
      update,
      setReticle,
      getReticle,
      setConfig,
      config: cfg
    };
  }

  const featherAimLoop = (() => {
    let active = false;
    let raf = 0;
    let instance = null;
    let lastPos = null;
    let lastTs = 0;
    let reticle = null;
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    function onMove(e) {
      mouse = { x: e.clientX, y: e.clientY };
    }

    function enable() {
      if (active) return;
      active = true;
      instance = createAimController();
      lastPos = null;
      lastTs = 0;
      reticle = { x: mouse.x, y: mouse.y };
      window.addEventListener("mousemove", onMove, { passive: true });
      raf = requestAnimationFrame(loop);
    }

    function disable() {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("mousemove", onMove);
      instance = null;
    }

    function loop(ts) {
      if (!active || !instance) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.max(1 / 240, Math.min(1 / 20, (ts - lastTs) / 1000));
      lastTs = ts;

      const delta = lastPos ? { x: mouse.x - lastPos.x, y: mouse.y - lastPos.y } : { x: 0, y: 0 };
      lastPos = { x: mouse.x, y: mouse.y };

      const out = instance.update({ reticle: reticle || mouse, mouse, mouseDelta: delta, dt });
      if (out && out.reticle) reticle = out.reticle;

      raf = requestAnimationFrame(loop);
    }

    return { enable, disable };
  })();

  handlers.featherAim = {
    enable: featherAimLoop.enable,
    disable: featherAimLoop.disable,
  };
})();
