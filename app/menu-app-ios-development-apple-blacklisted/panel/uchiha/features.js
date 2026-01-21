"use strict";

(() => {
  const aimlockToggle = document.getElementById("aimlockToggle");
  if (!aimlockToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.aimlock =
    featureHandlers.aimlock ||
    {
      enable() {},
      disable() {},
    };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpPt(p, q, t) { return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) }; }
  function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
  function hypot2(x, y) { return Math.hypot(x, y); }
  function norm2(x, y) { const d = Math.hypot(x, y); return d > 1e-9 ? { x: x / d, y: y / d, d } : { x: 0, y: 0, d: 0 }; }
  function expAlpha(rate, dt) { return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt)); }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function moveTowardsPt(cur, dst, maxDelta) {
    const dx = dst.x - cur.x, dy = dst.y - cur.y;
    const d = Math.hypot(dx, dy);
    if (d <= maxDelta || d === 0) return { x: dst.x, y: dst.y };
    const k = maxDelta / d;
    return { x: cur.x + dx * k, y: cur.y + dy * k };
  }

  function leadPoint2D(p, v, shooterPos, bulletSpeed, tMax) {
    const rx = p.x - shooterPos.x;
    const ry = p.y - shooterPos.y;
    const vx = v.x;
    const vy = v.y;
    const s2 = bulletSpeed * bulletSpeed;
    const vv = vx * vx + vy * vy;
    const rr = rx * rx + ry * ry;
    const rv = rx * vx + ry * vy;
    const a = vv - s2;
    const b = 2 * rv;
    const c = rr;

    let t = 0;

    if (Math.abs(a) < 1e-6) {
      if (Math.abs(b) > 1e-6) t = -c / b;
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sd = Math.sqrt(disc);
        const t1 = (-b - sd) / (2 * a);
        const t2 = (-b + sd) / (2 * a);
        const cand = (t1 > 0 ? [t1] : []).concat(t2 > 0 ? [t2] : []);
        t = cand.length ? Math.min(...cand) : 0;
      }
    }

    t = clamp(t, 0, tMax);

    return { x: p.x + vx * t, y: p.y + vy * t, t };
  }

  function getAimPoints(target, cfg) {
    const id = target.id ?? target._id ?? target.uid ?? target.name ?? null;
    const vx = target.vx ?? 0;
    const vy = target.vy ?? 0;

    const head = target.head
      ? { x: target.head.x, y: target.head.y, r: target.head.r ?? cfg.headRadius, w: cfg.headWeight, type: "head" }
      : { x: target.x, y: target.y - (target.headOffsetY ?? cfg.headOffsetY), r: cfg.headRadius, w: cfg.headWeight, type: "head" };

    const body = target.body
      ? { x: target.body.x, y: target.body.y, r: target.body.r ?? cfg.bodyRadius, w: cfg.bodyWeight, type: "body" }
      : { x: target.x, y: target.y, r: cfg.bodyRadius, w: cfg.bodyWeight, type: "body" };

    const points = cfg.aimMode === "head"
      ? [head]
      : cfg.aimMode === "body"
        ? [body]
        : [head, body];

    return {
      id: id ?? String(targetsIndexFallback(target)),
      vx, vy,
      points
    };
  }

  function targetsIndexFallback(t) {
    if (typeof t.__idx === "number") return t.__idx;
    return 0;
  }

  function pickBest(mouse, reticle, targets, cfg, locked) {
    const outer2 = cfg.fovOuter * cfg.fovOuter;
    const inner2 = cfg.fovInner * cfg.fovInner;

    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t && typeof t === "object") t.__idx = i;

      const wrap = getAimPoints(t, cfg);
      const baseId = wrap.id;
      const vel = { x: wrap.vx, y: wrap.vy };

      for (const p0 of wrap.points) {
        const p = cfg.predict
          ? leadPoint2D({ x: p0.x, y: p0.y }, vel, mouse, cfg.bulletSpeed, cfg.predictTMax)
          : { x: p0.x, y: p0.y, t: 0 };

        const d2m = dist2(mouse, p);
        if (d2m > outer2) continue;

        const d2r = dist2(reticle, p);

        const dm = Math.sqrt(d2m);
        const dr = Math.sqrt(d2r);

        const nearOuter = 1 - clamp(dm / cfg.fovOuter, 0, 1);
        const nearInner = 1 - clamp(dm / cfg.fovInner, 0, 1);

        const focus = cfg.focusReticle ? (1 - clamp(dr / cfg.fovOuter, 0, 1)) : nearOuter;
        const typeWeight = p0.w;

        const stickyBonus = locked && locked.id === baseId ? cfg.stickyBonus : 0;

        const speed = Math.hypot(vel.x, vel.y);
        const speedPenalty = cfg.speedRef > 0 ? clamp(speed / cfg.speedRef, 0, 1) : 0;

        const innerBoost = d2m <= inner2 ? cfg.innerBoost : 0;

        const score =
          (cfg.wOuter * nearOuter) +
          (cfg.wInner * nearInner) +
          (cfg.wFocus * focus) +
          (cfg.wType * typeWeight) +
          stickyBonus +
          innerBoost -
          (cfg.wSpeedPenalty * speedPenalty) -
          (cfg.wLeadPenalty * clamp(p.t / cfg.predictTMax, 0, 1));

        if (score > bestScore) {
          bestScore = score;
          best = { id: baseId, point: { x: p.x, y: p.y, type: p0.type }, score, target: t };
        }
      }
    }

    return best;
  }

  function createAimAssist(options = {}) {
    const cfg = {
      enabled: true,

      aimMode: "auto",
      focusReticle: true,

      fovOuter: 220,
      fovInner: 70,

      headOffsetY: 18,
      headRadius: 10,
      bodyRadius: 18,

      headWeight: 1.0,
      bodyWeight: 0.55,

      wOuter: 0.45,
      wInner: 0.55,
      wFocus: 0.35,
      wType: 0.50,
      wSpeedPenalty: 0.25,
      wLeadPenalty: 0.10,

      innerBoost: 0.12,

      predict: false,
      bulletSpeed: 700,
      predictTMax: 0.65,

      magnetMax: 0.22,
      magnetCurve: 1.0,

      frictionMax: 0.35,
      frictionCurve: 1.1,

      maxPullSpeed: 1400,
      smoothRate: 18,

      stickyMs: 220,
      stickyBonus: 0.25,
      switchGate: 0.10,
      releaseFovMul: 1.05,

      speedRef: 650,

      ...options
    };

    let locked = null;

    function reset() { locked = null; }

    function update(input) {
      const {
        reticle,
        mouse,
        targets,
        dt,
        mouseDelta
      } = input;

      const dts = Math.max(0, dt ?? (1 / 60));

      if (!cfg.enabled) {
        const a = expAlpha(cfg.smoothRate, dts);
        const out = lerpPt(reticle, mouse, a);
        locked = null;
        return { reticle: out, targetId: null, aimPoint: null, locked: null };
      }

      const best = pickBest(mouse, reticle, targets ?? [], cfg, locked);

      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

      if (locked && best) {
        const improvedEnough = best.id !== locked.id ? (best.score > locked.score * (1 + cfg.switchGate)) : true;
        if (!improvedEnough) {
          best.id = locked.id;
          best.point = locked.aimPoint;
          best.score = locked.score;
          best.target = locked.target;
        }
      }

      if (best) {
        const outer = cfg.fovOuter * cfg.releaseFovMul;
        const outer2 = outer * outer;
        const inRelease = dist2(mouse, best.point) <= outer2;

        if (!locked) {
          locked = { id: best.id, until: now + cfg.stickyMs, score: best.score, aimPoint: best.point, target: best.target };
        } else if (best.id === locked.id) {
          locked.until = now + cfg.stickyMs;
          locked.score = best.score;
          locked.aimPoint = best.point;
          locked.target = best.target;
        } else {
          if (now > locked.until && inRelease) {
            locked = { id: best.id, until: now + cfg.stickyMs, score: best.score, aimPoint: best.point, target: best.target };
          }
        }
      } else {
        if (locked && now > locked.until) locked = null;
      }

      const aimPoint = locked ? locked.aimPoint : null;

      let desired = { x: mouse.x, y: mouse.y };

      if (aimPoint) {
        const dx = aimPoint.x - mouse.x;
        const dy = aimPoint.y - mouse.y;
        const n = norm2(dx, dy);
        const dist = n.d;

        const tOuter = 1 - clamp(dist / cfg.fovOuter, 0, 1);
        const tInner = 1 - clamp(dist / cfg.fovInner, 0, 1);

        const magT = smoothstep(Math.pow(tOuter, cfg.magnetCurve));
        const fricT = smoothstep(Math.pow(tInner, cfg.frictionCurve));

        const inputDx = mouseDelta?.x ?? 0;
        const inputDy = mouseDelta?.y ?? 0;
        const inputSpeed = hypot2(inputDx, inputDy) / Math.max(1e-6, dts);

        const inputFactor = cfg.speedRef > 0 ? clamp(1 - (inputSpeed / (cfg.speedRef * 2)), 0.35, 1.0) : 1.0;

        const magnet = cfg.magnetMax * magT * inputFactor;
        const friction = cfg.frictionMax * fricT * inputFactor;

        const movedMouse = {
          x: mouse.x + inputDx * (1 - friction),
          y: mouse.y + inputDy * (1 - friction)
        };

        desired = {
          x: movedMouse.x + (aimPoint.x - movedMouse.x) * magnet,
          y: movedMouse.y + (aimPoint.y - movedMouse.y) * magnet
        };
      }

      const maxDelta = Math.max(0, cfg.maxPullSpeed) * dts;
      if (maxDelta > 0) desired = moveTowardsPt(reticle, desired, maxDelta);

      const a = expAlpha(cfg.smoothRate, dts);
      const out = lerpPt(reticle, desired, a);

      return { reticle: out, targetId: locked ? locked.id : null, aimPoint, locked };
    }

    return { update, reset, config: cfg };
  }

  window.createAimAssist = createAimAssist;

  const runAimlock = () => {
    if (aimlockToggle.checked) {
      featureHandlers.aimlock.enable();
    } else {
      featureHandlers.aimlock.disable();
    }
  };

  aimlockToggle.addEventListener("change", runAimlock);
  runAimlock();
})();

(() => {
  const stabilityAssistToggle = document.getElementById("stabilityAssistToggle");
  if (!stabilityAssistToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.stabilityAssist =
    featureHandlers.stabilityAssist ||
    {
      enable() {},
      disable() {},
    };

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

  window.createAimController = createAimController;

  const runStabilityAssist = () => {
    if (stabilityAssistToggle.checked) {
      featureHandlers.stabilityAssist.enable();
    } else {
      featureHandlers.stabilityAssist.disable();
    }
  };

  stabilityAssistToggle.addEventListener("change", runStabilityAssist);
  runStabilityAssist();
})();

(() => {
  const aimHoldToggle = document.getElementById("aimHoldToggle");
  if (!aimHoldToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.aimHold =
    featureHandlers.aimHold ||
    {
      enable() {},
      disable() {},
    };

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

  window.createReticleBrakeController = createReticleBrakeController;

  const runAimHold = () => {
    if (aimHoldToggle.checked) {
      featureHandlers.aimHold.enable();
    } else {
      featureHandlers.aimHold.disable();
    }
  };

  aimHoldToggle.addEventListener("change", runAimHold);
  runAimHold();
})();

(() => {
  const aimLockdownToggle = document.getElementById("aimLockdownToggle");
  if (!aimLockdownToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.aimLockdown =
    featureHandlers.aimLockdown ||
    {
      enable() {},
      disable() {},
    };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function expAlpha(rate, dt) { return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt)); }

  class LowPass {
    constructor() { this.i = false; this.y = 0; }
    reset(v = 0) { this.i = true; this.y = v; }
    f(x, a) { if (!this.i) { this.i = true; this.y = x; return x; } this.y = a * x + (1 - a) * this.y; return this.y; }
  }

  class OneEuro {
    constructor() { this.x = new LowPass(); this.dx = new LowPass(); }
    reset(v = 0) { this.x.reset(v); this.dx.reset(0); }
    a(c, dt) { c = Math.max(1e-6, c); dt = Math.max(1e-6, dt); const tau = 1 / (2 * Math.PI * c); return 1 / (1 + tau / dt); }
    f(v, dt, minCut, beta, derCut) {
      const prev = this.x.i ? this.x.y : v;
      const dv = (v - prev) / Math.max(1e-6, dt);
      const ad = this.a(derCut, dt);
      const edv = this.dx.f(dv, ad);
      const cut = minCut + beta * Math.abs(edv);
      const ax = this.a(cut, dt);
      return this.x.f(v, ax);
    }
  }

  function createDamTam(cfg = {}) {
    const c = {
      enabled: true,
      inputMode: "delta",
      sensitivity: 1.0,
      dtMin: 1 / 240,
      dtMax: 1 / 20,
      antiSpike: true,
      maxDeltaAbs: 90,
      maxSpeed: 3800,
      emaEnabled: true,
      emaRate: 30,
      euroEnabled: true,
      euroMinCutoff: 1.45,
      euroBeta: 0.03,
      euroDerivCutoff: 1.0,
      ...cfg
    };

    let ret = { x: 0, y: 0 };
    let lastAbs = null;

    const emaX = new LowPass(), emaY = new LowPass();
    const euroX = new OneEuro(), euroY = new OneEuro();

    function setReticle(p) {
      ret = { x: p.x, y: p.y };
      lastAbs = null;
      emaX.reset(ret.x); emaY.reset(ret.y);
      euroX.reset(ret.x); euroY.reset(ret.y);
    }

    function setConfig(patch) { Object.assign(c, patch || {}); }

    function update(input) {
      let dt = input.dt ?? (1 / 60);
      dt = clamp(dt, c.dtMin, c.dtMax);

      const mode = input.mode ?? c.inputMode;
      const sens = Math.max(0, input.sensitivity ?? c.sensitivity);

      let dx = 0, dy = 0;
      if (mode === "absolute") {
        const m = input.mouse;
        if (!m) throw new Error("absolute requires input.mouse");
        if (lastAbs) { dx = m.x - lastAbs.x; dy = m.y - lastAbs.y; }
        lastAbs = { x: m.x, y: m.y };
      } else {
        const d = input.mouseDelta;
        if (!d) throw new Error("delta requires input.mouseDelta");
        dx = d.x; dy = d.y;
      }

      dx *= sens; dy *= sens;

      if (c.antiSpike) {
        dx = clamp(dx, -c.maxDeltaAbs, c.maxDeltaAbs);
        dy = clamp(dy, -c.maxDeltaAbs, c.maxDeltaAbs);
        const sp = Math.hypot(dx, dy) / Math.max(1e-6, dt);
        if (c.maxSpeed > 0 && sp > c.maxSpeed) {
          const k = (c.maxSpeed * dt) / Math.max(1e-9, Math.hypot(dx, dy));
          dx *= k; dy *= k;
        }
      }

      if (!c.enabled) {
        ret = { x: ret.x + dx, y: ret.y + dy };
        return { reticle: { x: ret.x, y: ret.y }, delta: { x: dx, y: dy } };
      }

      let nx = ret.x + dx;
      let ny = ret.y + dy;

      if (c.emaEnabled) {
        const a = expAlpha(c.emaRate, dt);
        nx = emaX.f(nx, a);
        ny = emaY.f(ny, a);
      }

      if (c.euroEnabled) {
        nx = euroX.f(nx, dt, c.euroMinCutoff, c.euroBeta, c.euroDerivCutoff);
        ny = euroY.f(ny, dt, c.euroMinCutoff, c.euroBeta, c.euroDerivCutoff);
      }

      const outDx = nx - ret.x;
      const outDy = ny - ret.y;

      ret = { x: nx, y: ny };
      return { reticle: { x: ret.x, y: ret.y }, delta: { x: outDx, y: outDy } };
    }

    return { update, setReticle, setConfig, config: c };
  }

  window.createDamTam = createDamTam;

  const runAimLockdown = () => {
    if (aimLockdownToggle.checked) {
      featureHandlers.aimLockdown.enable();
    } else {
      featureHandlers.aimLockdown.disable();
    }
  };

  aimLockdownToggle.addEventListener("change", runAimLockdown);
  runAimLockdown();
})();

(() => {
  const sensitivityBoostToggle = document.getElementById("sensitivityBoostToggle");
  if (!sensitivityBoostToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.sensitivityBoost =
    featureHandlers.sensitivityBoost ||
    {
      enable() {},
      disable() {},
    };

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

  window.createSensitivityController = createSensitivityController;
  window.bindPointerDelta = bindPointerDelta;

  const runSensitivityBoost = () => {
    if (sensitivityBoostToggle.checked) {
      featureHandlers.sensitivityBoost.enable();
    } else {
      featureHandlers.sensitivityBoost.disable();
    }
  };

  sensitivityBoostToggle.addEventListener("change", runSensitivityBoost);
  runSensitivityBoost();
})();

(() => {
  const screenBoostToggle = document.getElementById("screenBoostToggle");
  if (!screenBoostToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.screenBoost =
    featureHandlers.screenBoost ||
    {
      enable() {},
      disable() {},
    };

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

  window.createBuffManController = createBuffManController;
  window.bindPointerDelta = bindPointerDelta;

  const runScreenBoost = () => {
    if (screenBoostToggle.checked) {
      featureHandlers.screenBoost.enable();
    } else {
      featureHandlers.screenBoost.disable();
    }
  };

  screenBoostToggle.addEventListener("change", runScreenBoost);
  runScreenBoost();
})();

(() => {
  const headshotFixToggle = document.getElementById("headshotFixToggle");
  if (!headshotFixToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.headshotFix =
    featureHandlers.headshotFix ||
    {
      enable() {},
      disable() {},
    };

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

  window.createAntiOvershootController = createAntiOvershootController;

  const runHeadshotFix = () => {
    if (headshotFixToggle.checked) {
      featureHandlers.headshotFix.enable();
    } else {
      featureHandlers.headshotFix.disable();
    }
  };

  headshotFixToggle.addEventListener("change", runHeadshotFix);
  runHeadshotFix();
})();

(() => {
  const bulletAlignToggle = document.getElementById("bulletAlignToggle");
  if (!bulletAlignToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.bulletAlign =
    featureHandlers.bulletAlign ||
    {
      enable() {},
      disable() {},
    };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function expAlpha(rate, dt) { return 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt)); }

  function v2(x = 0, y = 0) { return { x, y }; }
  function add2(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub2(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul2(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len2(a) { return Math.hypot(a.x, a.y); }
  function norm2(a) { const d = len2(a); return d > 1e-9 ? { x: a.x / d, y: a.y / d, d } : { x: 0, y: 0, d: 0 }; }

  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function smootherstep(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }

  function rot2(v, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  }

  function hash32(x) {
    x |= 0;
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x >>> 0;
  }

  function u01FromU32(u) {
    return ((u >>> 8) & 0x00ffffff) / 0x01000000;
  }

  function rng2(seedU32, saltU32) {
    const a = hash32(seedU32 ^ (saltU32 * 0x9e3779b1));
    const b = hash32(a ^ 0x85ebca6b);
    return { u1: u01FromU32(a), u2: u01FromU32(b) };
  }

  function sampleDiskConcentric(u1, u2) {
    const sx = 2 * u1 - 1;
    const sy = 2 * u2 - 1;

    if (sx === 0 && sy === 0) return { x: 0, y: 0 };

    let r, theta;
    if (Math.abs(sx) > Math.abs(sy)) {
      r = sx;
      theta = (Math.PI / 4) * (sy / sx);
    } else {
      r = sy;
      theta = (Math.PI / 2) - (Math.PI / 4) * (sx / sy);
    }
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  }

  function degToRad(d) { return d * Math.PI / 180; }

  function defaultWeaponConfig() {
    return {
      id: "weapon",
      rpm: 600,
      baseSpreadDeg: 0.9,
      minSpreadDeg: 0.1,
      maxSpreadDeg: 6.0,

      adsMul: 0.55,
      crouchMul: 0.75,
      proneMul: 0.65,

      moveMul: 1.5,
      sprintMul: 2.2,
      jumpMul: 2.6,

      firstShotAccuracyWindowS: 0.22,
      firstShotMul: 0.55,

      bloomPerShotDeg: 0.32,
      bloomPerShotCurve: 1.0,
      heatMax: 1.0,

      heatRecoveryRate: 2.8,
      heatRecoveryDelayS: 0.08,

      recoilPerShotDeg: { x: 0.0, y: 0.55 },
      recoilJitterDeg: { x: 0.10, y: 0.10 },
      recoilMaxDeg: { x: 3.5, y: 10.0 },

      recoilRecoveryRate: 14.0,
      recoilRecoveryDelayS: 0.06,

      recoilPattern: null,

      randomYawBiasDeg: 0.0,
      randomPitchBiasDeg: 0.0,

      deterministic: true
    };
  }

  function defaultPlayerModifiers() {
    return {
      ads: false,
      stance: "stand",
      moveSpeed01: 0,
      sprint: false,
      airborne: false
    };
  }

  function stanceMul(stance, cfg) {
    if (stance === "crouch") return cfg.crouchMul;
    if (stance === "prone") return cfg.proneMul;
    return 1.0;
  }

  function spreadFromHeat(heat01, cfg) {
    const h = clamp(heat01, 0, cfg.heatMax);
    const shaped = cfg.bloomPerShotCurve === 1 ? h : Math.pow(h, cfg.bloomPerShotCurve);
    const s = cfg.baseSpreadDeg + shaped * (cfg.maxSpreadDeg - cfg.baseSpreadDeg);
    return clamp(s, cfg.minSpreadDeg, cfg.maxSpreadDeg);
  }

  function computeMovementMul(mod, cfg) {
    const mv = clamp(mod.moveSpeed01 ?? 0, 0, 1);
    let mul = lerp(1.0, cfg.moveMul, mv);
    if (mod.sprint) mul *= cfg.sprintMul;
    if (mod.airborne) mul *= cfg.jumpMul;
    return mul;
  }

  function computeAimMul(mod, cfg) {
    let mul = 1.0;
    if (mod.ads) mul *= cfg.adsMul;
    mul *= stanceMul(mod.stance, cfg);
    return mul;
  }

  function patternAt(pattern, idx) {
    if (!pattern || !pattern.length) return null;
    const i = idx % pattern.length;
    const p = pattern[i];
    return p ? { x: p.x ?? 0, y: p.y ?? 0 } : { x: 0, y: 0 };
  }

  function createBallistics(weaponConfig = {}, opts = {}) {
    const cfg = { ...defaultWeaponConfig(), ...weaponConfig };
    const o = {
      seed: (opts.seed ?? 0x12345678) >>> 0,
      now: () => (typeof performance !== "undefined" && performance.now ? performance.now() / 1000 : Date.now() / 1000),
      ...opts
    };

    const state = {
      lastShotTimeS: -1e9,
      lastUpdateTimeS: -1e9,

      shotIndex: 0,

      heat01: 0,
      recoilDeg: v2(0, 0),

      pendingHeatRecoverDelayS: 0,
      pendingRecoilRecoverDelayS: 0,

      lastAimAnglesDeg: v2(0, 0)
    };

    function setSeed(seedU32) { o.seed = (seedU32 >>> 0); }
    function getState() { return JSON.parse(JSON.stringify(state)); }
    function setState(s) {
      if (!s || typeof s !== "object") return;
      state.lastShotTimeS = Number.isFinite(s.lastShotTimeS) ? s.lastShotTimeS : state.lastShotTimeS;
      state.lastUpdateTimeS = Number.isFinite(s.lastUpdateTimeS) ? s.lastUpdateTimeS : state.lastUpdateTimeS;
      state.shotIndex = (s.shotIndex >>> 0) ?? state.shotIndex;
      state.heat01 = clamp(s.heat01 ?? state.heat01, 0, cfg.heatMax);
      state.recoilDeg = v2(s.recoilDeg?.x ?? state.recoilDeg.x, s.recoilDeg?.y ?? state.recoilDeg.y);
      state.pendingHeatRecoverDelayS = Math.max(0, s.pendingHeatRecoverDelayS ?? state.pendingHeatRecoverDelayS);
      state.pendingRecoilRecoverDelayS = Math.max(0, s.pendingRecoilRecoverDelayS ?? state.pendingRecoilRecoverDelayS);
      state.lastAimAnglesDeg = v2(s.lastAimAnglesDeg?.x ?? state.lastAimAnglesDeg.x, s.lastAimAnglesDeg?.y ?? state.lastAimAnglesDeg.y);
    }

    function update(dt, mod = defaultPlayerModifiers()) {
      dt = Math.max(0, dt ?? 0);
      if (dt <= 0) return;

      if (state.pendingHeatRecoverDelayS > 0) {
        state.pendingHeatRecoverDelayS = Math.max(0, state.pendingHeatRecoverDelayS - dt);
      } else {
        const a = expAlpha(cfg.heatRecoveryRate, dt);
        state.heat01 = lerp(state.heat01, 0, a);
        state.heat01 = clamp(state.heat01, 0, cfg.heatMax);
      }

      if (state.pendingRecoilRecoverDelayS > 0) {
        state.pendingRecoilRecoverDelayS = Math.max(0, state.pendingRecoilRecoverDelayS - dt);
      } else {
        const a = expAlpha(cfg.recoilRecoveryRate, dt);
        state.recoilDeg = v2(
          lerp(state.recoilDeg.x, 0, a),
          lerp(state.recoilDeg.y, 0, a)
        );
      }

      state.lastUpdateTimeS += dt;
    }

    function canShoot(nowS) {
      const spm = cfg.rpm / 60;
      const minInterval = spm > 0 ? (1 / spm) : 0;
      return (nowS - state.lastShotTimeS) >= (minInterval - 1e-6);
    }

    function computeFirstShotMul(nowS, mod) {
      const dtSince = nowS - state.lastShotTimeS;
      const within = dtSince >= cfg.firstShotAccuracyWindowS;
      return within ? cfg.firstShotMul : 1.0;
    }

    function computeSpreadDeg(nowS, mod) {
      const aimMul = computeAimMul(mod, cfg);
      const moveMul = computeMovementMul(mod, cfg);
      const firstMul = computeFirstShotMul(nowS, mod);
      const base = spreadFromHeat(state.heat01, cfg);
      const spread = base * aimMul * moveMul * firstMul;
      return clamp(spread, cfg.minSpreadDeg, cfg.maxSpreadDeg);
    }

    function computeRecoilKickDeg(shotIdxU32) {
      let kick = v2(cfg.recoilPerShotDeg.x, cfg.recoilPerShotDeg.y);

      const pat = patternAt(cfg.recoilPattern, shotIdxU32);
      if (pat) kick = add2(kick, pat);

      if (cfg.deterministic) {
        const r = rng2(o.seed, (shotIdxU32 * 0x632be59b) >>> 0);
        const jx = (r.u1 * 2 - 1) * (cfg.recoilJitterDeg.x ?? 0);
        const jy = (r.u2 * 2 - 1) * (cfg.recoilJitterDeg.y ?? 0);
        kick = add2(kick, v2(jx, jy));
      } else {
        const jx = (Math.random() * 2 - 1) * (cfg.recoilJitterDeg.x ?? 0);
        const jy = (Math.random() * 2 - 1) * (cfg.recoilJitterDeg.y ?? 0);
        kick = add2(kick, v2(jx, jy));
      }

      kick.x += cfg.randomYawBiasDeg ?? 0;
      kick.y += cfg.randomPitchBiasDeg ?? 0;

      return v2(kick.x, kick.y);
    }

    function applyRecoilKick(kickDeg) {
      const next = add2(state.recoilDeg, kickDeg);
      state.recoilDeg = v2(
        clamp(next.x, -(cfg.recoilMaxDeg.x ?? 0), (cfg.recoilMaxDeg.x ?? 0)),
        clamp(next.y, 0, (cfg.recoilMaxDeg.y ?? 0))
      );
    }

    function addHeatOnShot(mod) {
      const moveMul = computeMovementMul(mod, cfg);
      const aimMul = computeAimMul(mod, cfg);
      const addDeg = cfg.bloomPerShotDeg * moveMul * (0.85 + 0.15 * (1 / Math.max(0.1, aimMul)));
      const inc = (cfg.maxSpreadDeg > cfg.baseSpreadDeg) ? (addDeg / (cfg.maxSpreadDeg - cfg.baseSpreadDeg)) : 0.05;
      state.heat01 = clamp(state.heat01 + inc, 0, cfg.heatMax);
      state.pendingHeatRecoverDelayS = cfg.heatRecoveryDelayS;
    }

    function sampleSpreadOffsetRad(spreadDeg, shotIdxU32) {
      const r = cfg.deterministic ? rng2(o.seed, (shotIdxU32 * 0xa511e9b3) >>> 0) : { u1: Math.random(), u2: Math.random() };
      const p = sampleDiskConcentric(r.u1, r.u2);
      const spreadRad = degToRad(spreadDeg);
      return { x: p.x * spreadRad, y: p.y * spreadRad };
    }

    function fire(params = {}) {
      const nowS = Number.isFinite(params.nowS) ? params.nowS : o.now();
      const mod = { ...defaultPlayerModifiers(), ...(params.mod ?? {}) };

      if (!canShoot(nowS)) {
        return {
          ok: false,
          reason: "cooldown",
          nowS,
          shotIndex: state.shotIndex >>> 0
        };
      }

      const shotIdx = state.shotIndex >>> 0;

      const spreadDeg = computeSpreadDeg(nowS, mod);
      const spreadOffsetRad = sampleSpreadOffsetRad(spreadDeg, shotIdx);

      const kickDeg = computeRecoilKickDeg(shotIdx);

      addHeatOnShot(mod);
      applyRecoilKick(kickDeg);

      state.pendingRecoilRecoverDelayS = cfg.recoilRecoveryDelayS;

      state.lastShotTimeS = nowS;
      state.shotIndex = (state.shotIndex + 1) >>> 0;

      const recoilRad = { x: degToRad(state.recoilDeg.x), y: degToRad(state.recoilDeg.y) };

      const totalAimOffsetRad = {
        x: spreadOffsetRad.x + recoilRad.x,
        y: spreadOffsetRad.y + recoilRad.y
      };

      return {
        ok: true,
        nowS,
        shotIndex: shotIdx,
        spreadDeg,
        spreadOffsetRad,
        recoilDeg: { x: state.recoilDeg.x, y: state.recoilDeg.y },
        recoilKickDeg: { x: kickDeg.x, y: kickDeg.y },
        aimOffsetRad: totalAimOffsetRad
      };
    }

    function getCurrentAimOffsetRad() {
      return { x: degToRad(state.recoilDeg.x), y: degToRad(state.recoilDeg.y) };
    }

    function getCurrentSpreadDeg(mod = defaultPlayerModifiers(), nowS = o.now()) {
      return computeSpreadDeg(nowS, { ...defaultPlayerModifiers(), ...mod });
    }

    function setRecoilPattern(patternArray) {
      cfg.recoilPattern = Array.isArray(patternArray) ? patternArray.map(p => ({ x: Number(p.x ?? 0), y: Number(p.y ?? 0) })) : null;
    }

    function setWeaponConfig(patch = {}) { Object.assign(cfg, patch); }

    return {
      fire,
      update,
      canShoot,
      setSeed,
      getState,
      setState,
      getCurrentAimOffsetRad,
      getCurrentSpreadDeg,
      setRecoilPattern,
      setWeaponConfig,
      config: cfg
    };
  }

  window.createBallistics = createBallistics;

  const runBulletAlign = () => {
    if (bulletAlignToggle.checked) {
      featureHandlers.bulletAlign.enable();
    } else {
      featureHandlers.bulletAlign.disable();
    }
  };

  bulletAlignToggle.addEventListener("change", runBulletAlign);
  runBulletAlign();
})();

(() => {
  const shakeFixToggle = document.getElementById("shakeFixToggle");
  if (!shakeFixToggle) return;

  const featureHandlers = (window.featureHandlers = window.featureHandlers || {});
  featureHandlers.shakeFix =
    featureHandlers.shakeFix ||
    {
      enable() {},
      disable() {},
    };

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

  window.createAntiJitterController = createAntiJitterController;
  window.bindPointerDelta = bindPointerDelta;

  const runShakeFix = () => {
    if (shakeFixToggle.checked) {
      featureHandlers.shakeFix.enable();
    } else {
      featureHandlers.shakeFix.disable();
    }
  };

  shakeFixToggle.addEventListener("change", runShakeFix);
  runShakeFix();
})();
