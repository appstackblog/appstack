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

  function clampSpeed(delta, dt, maxSpeed) {
    const ms = Math.max(0, maxSpeed);
    if (!ms || dt <= 0) return delta;
    const d = len(delta);
    const maxD = ms * dt;
    if (d <= maxD || d < 1e-9) return delta;
    return mul(delta, maxD / d);
  }

  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  class LowPass {
    constructor() { this.i = false; this.y = 0; }
    reset(v = 0) { this.i = true; this.y = v; }
    f(x, a) { if (!this.i) { this.i = true; this.y = x; return x; } this.y = a * x + (1 - a) * this.y; return this.y; }
  }

  function createAntiOvershootController(options = {}) {
    const cfg = {
      enabled: true,
      dtMin: 1 / 240,
      dtMax: 1 / 20,

      sensitivity: 1.0,

      maxSpeed: 0,

      targetRadius: 18,
      innerRadius: 8,

      overshootStrength: 0.75,
      overshootCurve: 1.25,

      dampRate: 26,

      softClampEnabled: true,
      softClampStrength: 0.65,

      deadzoneNearTarget: 0.0,

      ...options
    };

    let ret = v2(0, 0);
    const dampX = new LowPass();
    const dampY = new LowPass();

    function setConfig(p) { Object.assign(cfg, p || {}); }
    function setReticle(p) {
      ret = v2(p.x, p.y);
      dampX.reset(ret.x);
      dampY.reset(ret.y);
    }
    function getReticle() { return v2(ret.x, ret.y); }

    function update(input) {
      let dt = input.dt ?? (1 / 60);
      dt = clamp(dt, cfg.dtMin, cfg.dtMax);

      let dx = (input.dx ?? input.mouseDelta?.x ?? 0) * cfg.sensitivity;
      let dy = (input.dy ?? input.mouseDelta?.y ?? 0) * cfg.sensitivity;
      let delta = v2(dx, dy);

      if (cfg.maxSpeed && cfg.maxSpeed > 0) {
        delta = clampSpeed(delta, dt, cfg.maxSpeed);
      }

      if (!cfg.enabled) {
        ret = add(ret, delta);
        return { reticle: getReticle(), delta };
      }

      const target = input.target;
      if (!target) {
        const a = expAlpha(cfg.dampRate, dt);
        const nx = dampX.f(ret.x + delta.x, a);
        const ny = dampY.f(ret.y + delta.y, a);
        ret = v2(nx, ny);
        return { reticle: getReticle(), delta: v2(nx - ret.x, ny - ret.y) };
      }

      const t = v2(target.x, target.y);
      const toT = sub(t, ret);
      const dist = toT.d ?? len(toT);
      const n = norm(toT);

      const R = Math.max(1e-6, cfg.targetRadius);
      const Rin = Math.max(1e-6, Math.min(cfg.innerRadius, R));

      const radial = n.d > 0 ? (delta.x * n.x + delta.y * n.y) : 0;

      const towards = radial > 0 ? radial : 0;
      const away = radial < 0 ? -radial : 0;

      const tOuter = clamp(1 - (dist / R), 0, 1);
      const shaped = smoothstep(Math.pow(tOuter, cfg.overshootCurve));

      const strength = clamp(cfg.overshootStrength, 0, 1) * shaped;

      let adjusted = delta;

      if (dist <= R) {
        const reduce = strength * (0.55 + 0.45 * clamp(away / (away + towards + 1e-6), 0, 1));
        const newRadial = radial >= 0 ? (radial * (1 - reduce)) : (radial * (1 - reduce));
        const tangential = sub(delta, mul(v2(n.x, n.y), radial));
        adjusted = add(tangential, mul(v2(n.x, n.y), newRadial));
      }

      if (cfg.softClampEnabled && dist <= R) {
        const pinT = clamp(1 - (dist / R), 0, 1);
        const pin = smoothstep(pinT) * clamp(cfg.softClampStrength, 0, 1);
        const next = add(ret, adjusted);
        const toNext = sub(next, t);
        const dNext = len(toNext);
        if (dNext > R) {
          const nn = norm(toNext);
          const clampedPos = add(t, mul(v2(nn.x, nn.y), R));
          adjusted = sub(clampedPos, ret);
          adjusted = lerpVec(delta, adjusted, pin);
        }
      }

      if (cfg.deadzoneNearTarget > 0 && dist <= Rin) {
        const dz = cfg.deadzoneNearTarget;
        const move = len(adjusted);
        if (move <= dz) adjusted = v2(0, 0);
        else adjusted = mul(adjusted, (move - dz) / move);
      }

      const a = expAlpha(cfg.dampRate, dt);
      const nx = dampX.f(ret.x + adjusted.x, a);
      const ny = dampY.f(ret.y + adjusted.y, a);

      const outDelta = v2(nx - ret.x, ny - ret.y);
      ret = v2(nx, ny);
      return { reticle: getReticle(), delta: outDelta };
    }

    function lerpVec(a, b, t) { return v2(lerp(a.x, b.x, t), lerp(a.y, b.y, t)); }

    return { update, setReticle, getReticle, setConfig, config: cfg };
  }

  const headFixLoop = (() => {
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
      instance = createAntiOvershootController();
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

  handlers.headFix = {
    enable: headFixLoop.enable,
    disable: headFixLoop.disable,
  };
})();
