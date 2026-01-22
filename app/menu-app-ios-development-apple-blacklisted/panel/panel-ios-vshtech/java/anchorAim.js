(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hypot(x, y) { return Math.hypot(x, y); }

  function v2(x = 0, y = 0) { return { x, y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len(a) { return Math.hypot(a.x, a.y); }
  function norm(a) {
    const d = len(a);
    return d > 1e-9 ? { x: a.x / d, y: a.y / d, d } : { x: 0, y: 0, d: 0 };
  }

  function expAlpha(rate, dt) {
    return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt));
  }

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
    const n = norm(delta);
    if (n.d <= r) return v2(0, 0);
    const k = (n.d - r) / n.d;
    return mul(delta, k);
  }

  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  class LowPass {
    constructor() { this.inited = false; this.y = 0; }
    reset(v = 0) { this.inited = true; this.y = v; }
    filter(x, a) {
      if (!this.inited) { this.inited = true; this.y = x; return x; }
      this.y = a * x + (1 - a) * this.y;
      return this.y;
    }
  }

  class OneEuro {
    constructor() { this.xLP = new LowPass(); this.dxLP = new LowPass(); }
    reset(x = 0) { this.xLP.reset(x); this.dxLP.reset(0); }
    alpha(cutoff, dt) {
      const c = Math.max(1e-6, cutoff);
      const tau = 1 / (2 * Math.PI * c);
      return 1 / (1 + tau / Math.max(1e-6, dt));
    }
    filter(x, dt, minCutoff, beta, dCutoff) {
      const prev = this.xLP.inited ? this.xLP.y : x;
      const dx = (x - prev) / Math.max(1e-6, dt);
      const aD = this.alpha(dCutoff, dt);
      const edx = this.dxLP.filter(dx, aD);
      const cutoff = minCutoff + beta * Math.abs(edx);
      const aX = this.alpha(cutoff, dt);
      return this.xLP.filter(x, aX);
    }
  }

  function defaultCfg() {
    return {
      enabled: true,

      inputMode: "delta",
      sensitivity: 1.0,

      dtClampMin: 1 / 240,
      dtClampMax: 1 / 20,

      antiSpikeEnabled: true,
      spikeMaxDeltaAbs: 90,
      spikeMaxSpeed: 3600,

      deadzonePx: 0,

      boundsEnabled: false,
      bounds: { xMin: 0, yMin: 0, xMax: 1280, yMax: 720 },

      smoothingEnabled: true,
      emaRate: 26,

      euroEnabled: true,
      euroMinCutoff: 1.3,
      euroBeta: 0.02,
      euroDerivCutoff: 1.0,

      brakeEnabled: true,

      brakeMode: "friction",

      anchorEnabled: false,
      anchorPoint: { x: 640, y: 360 },
      anchorRadius: 60,
      anchorStrength: 0.35,
      anchorCurve: 1.25,
      anchorMaxPullSpeed: 900,

      frictionMax: 0.35,
      frictionRefSpeed: 520,
      frictionCurve: 1.1,

      holdMax: 0.55,
      holdRadius: 38,
      holdCurve: 1.2,

      maxSpeed: 0,

      debug: false
    };
  }

  function createReticleBrakeController(options = {}) {
    const cfg = { ...defaultCfg(), ...options };

    let reticle = v2(0, 0);
    let lastAbs = null;

    const emaX = new LowPass();
    const emaY = new LowPass();
    const euroX = new OneEuro();
    const euroY = new OneEuro();

    const state = {
      dt: 0,
      rawDelta: v2(0, 0),
      shapedDelta: v2(0, 0),
      speed: 0,
      brake: 0,
      anchorPull: 0
    };

    function setConfig(patch = {}) { Object.assign(cfg, patch); }
    function enable(v = true) { cfg.enabled = !!v; }
    function setReticle(p) {
      reticle = v2(p.x, p.y);
      lastAbs = null;
      emaX.reset(reticle.x); emaY.reset(reticle.y);
      euroX.reset(reticle.x); euroY.reset(reticle.y);
    }
    function getReticle() { return v2(reticle.x, reticle.y); }

    function applyBounds(p) {
      if (!cfg.boundsEnabled) return p;
      const b = cfg.bounds;
      return { x: clamp(p.x, b.xMin, b.xMax), y: clamp(p.y, b.yMin, b.yMax) };
    }

    function brakeFriction(speed) {
      const ref = Math.max(1e-6, cfg.frictionRefSpeed);
      const t = clamp(1 - speed / ref, 0, 1);
      const shaped = Math.pow(t, cfg.frictionCurve);
      return clamp(cfg.frictionMax * shaped, 0, 0.95);
    }

    function brakeHold(distToAnchor) {
      const r = Math.max(1e-6, cfg.holdRadius);
      const t = clamp(1 - distToAnchor / r, 0, 1);
      const shaped = Math.pow(t, cfg.holdCurve);
      return clamp(cfg.holdMax * shaped, 0, 0.98);
    }

    function anchorMagnet(ret, anchor, dt) {
      if (!cfg.anchorEnabled) return { out: ret, pull: 0 };

      const dx = anchor.x - ret.x;
      const dy = anchor.y - ret.y;
      const n = norm(v2(dx, dy));
      const d = n.d;

      const R = Math.max(1e-6, cfg.anchorRadius);
      const t = clamp(1 - d / R, 0, 1);
      const shaped = smoothstep(Math.pow(t, cfg.anchorCurve));

      const k = clamp(cfg.anchorStrength * shaped, 0, 1);

      const desired = { x: ret.x + dx * k, y: ret.y + dy * k };

      const maxDelta = Math.max(0, cfg.anchorMaxPullSpeed) * dt;
      const moved = moveTowards(ret, desired, maxDelta);

      return { out: moved, pull: k };
    }

    function moveTowards(cur, dst, maxDelta) {
      const dx = dst.x - cur.x, dy = dst.y - cur.y;
      const d = Math.hypot(dx, dy);
      if (d <= maxDelta || d === 0) return { x: dst.x, y: dst.y };
      const k = maxDelta / d;
      return { x: cur.x + dx * k, y: cur.y + dy * k };
    }

    function update(input) {
      let dt = input.dt ?? 1 / 60;
      dt = clamp(dt, cfg.dtClampMin, cfg.dtClampMax);

      const mode = input.mode ?? cfg.inputMode;
      const sens = Math.max(0, input.sensitivity ?? cfg.sensitivity);

      let rawDelta = v2(0, 0);

      if (mode === "absolute") {
        const m = input.mouse;
        if (!m) throw new Error("absolute mode requires input.mouse={x,y}");
        if (lastAbs) rawDelta = sub(m, lastAbs);
        lastAbs = v2(m.x, m.y);
      } else {
        const d = input.mouseDelta;
        if (!d) throw new Error("delta mode requires input.mouseDelta={x,y}");
        rawDelta = v2(d.x, d.y);
      }

      rawDelta = mul(rawDelta, sens);

      if (cfg.antiSpikeEnabled) {
        rawDelta = clampDelta(rawDelta, cfg.spikeMaxDeltaAbs);
        rawDelta = clampSpeed(rawDelta, dt, cfg.spikeMaxSpeed);
      }

      rawDelta = deadzone(rawDelta, cfg.deadzonePx);

      const speed = len(rawDelta) / Math.max(1e-6, dt);

      let brake = 0;

      if (cfg.brakeEnabled) {
        if (cfg.brakeMode === "hold" || cfg.brakeMode === "hybrid") {
          const anchor = input.anchor ?? cfg.anchorPoint;
          const dA = hypot(reticle.x - anchor.x, reticle.y - anchor.y);
          brake = Math.max(brake, brakeHold(dA));
        }
        if (cfg.brakeMode === "friction" || cfg.brakeMode === "hybrid") {
          brake = Math.max(brake, brakeFriction(speed));
        }
      }

      let shaped = mul(rawDelta, 1 - brake);

      if (cfg.maxSpeed && cfg.maxSpeed > 0) shaped = clampSpeed(shaped, dt, cfg.maxSpeed);

      let next = add(reticle, shaped);

      if (cfg.smoothingEnabled) {
        const a = expAlpha(cfg.emaRate, dt);
        next = { x: emaX.filter(next.x, a), y: emaY.filter(next.y, a) };
      }

      if (cfg.euroEnabled) {
        next = {
          x: euroX.filter(next.x, dt, cfg.euroMinCutoff, cfg.euroBeta, cfg.euroDerivCutoff),
          y: euroY.filter(next.y, dt, cfg.euroMinCutoff, cfg.euroBeta, cfg.euroDerivCutoff)
        };
      }

      const anchor = input.anchor ?? cfg.anchorPoint;
      const mag = anchorMagnet(next, anchor, dt);
      next = mag.out;

      next = applyBounds(next);

      reticle = next;

      if (cfg.debug) {
        state.dt = dt;
        state.rawDelta = rawDelta;
        state.shapedDelta = shaped;
        state.speed = speed;
        state.brake = brake;
        state.anchorPull = mag.pull;
      }

      return { reticle: getReticle(), state: cfg.debug ? { ...state } : null };
    }

    return { update, setReticle, getReticle, setConfig, enable, config: cfg };
  }

  const anchorAimLoop = (() => {
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
      instance = createReticleBrakeController();
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

  handlers.anchorAim = {
    enable: anchorAimLoop.enable,
    disable: anchorAimLoop.disable,
  };
})();
