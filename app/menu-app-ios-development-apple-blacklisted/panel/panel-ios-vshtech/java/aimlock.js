(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

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

  function createTargets(count) {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const list = [];
    for (let i = 0; i < count; i += 1) {
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
      });
    }
    return list;
  }

  function updateTargets(targets, dt) {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < 0 || t.x > w) t.vx *= -1;
      if (t.y < 0 || t.y > h) t.vy *= -1;
    }
  }

  const aimlockLoop = (() => {
    let active = false;
    let raf = 0;
    let instance = null;
    let targets = null;
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
      instance = createAimAssist();
      targets = createTargets(6);
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
      targets = null;
    }

    function loop(ts) {
      if (!active || !instance) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.max(1 / 240, Math.min(1 / 20, (ts - lastTs) / 1000));
      lastTs = ts;

      const delta = lastPos ? { x: mouse.x - lastPos.x, y: mouse.y - lastPos.y } : { x: 0, y: 0 };
      lastPos = { x: mouse.x, y: mouse.y };

      if (targets) updateTargets(targets, dt);
      const out = instance.update({ reticle: reticle || mouse, mouse, mouseDelta: delta, targets, dt });
      if (out && out.reticle) reticle = out.reticle;

      raf = requestAnimationFrame(loop);
    }

    return { enable, disable };
  })();

  handlers.aimlock = {
    enable: aimlockLoop.enable,
    disable: aimlockLoop.disable,
  };
})();
