(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

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

  const driftFixLoop = (() => {
    let active = false;
    let raf = 0;
    let instance = null;
    let lastTs = 0;

    function enable() {
      if (active) return;
      active = true;
      instance = createBallistics();
      lastTs = 0;
      raf = requestAnimationFrame(loop);
    }

    function disable() {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
      instance = null;
      lastTs = 0;
    }

    function loop(ts) {
      if (!active || !instance) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.max(1 / 240, Math.min(1 / 20, (ts - lastTs) / 1000));
      lastTs = ts;
      instance.update(dt);
      raf = requestAnimationFrame(loop);
    }

    return { enable, disable };
  })();

  handlers.driftFix = {
    enable: driftFixLoop.enable,
    disable: driftFixLoop.disable,
  };
})();
