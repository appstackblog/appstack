(function () {
  "use strict";

  const handlers = (window.featureHandlers = window.featureHandlers || {});

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

  const steadyHoldLoop = (() => {
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
      instance = createDamTam();
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

  handlers.steadyHold = {
    enable: steadyHoldLoop.enable,
    disable: steadyHoldLoop.disable,
  };
})();
