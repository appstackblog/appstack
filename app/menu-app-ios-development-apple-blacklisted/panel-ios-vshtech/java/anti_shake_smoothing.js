// anti_shake_smoothing.js
// Bo loc fix rung cho cursor/reticle 2D trong sandbox.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class EMASmoother2D {
  constructor(opts = {}) {
    this.alpha = clamp(opts.alpha ?? 0.25, 0, 0.95);
    this.deadzone = clamp(opts.deadzone ?? 0, 0, 20);
    const p = opts.init ?? { x: 0, y: 0 };
    this.p = { x: p.x, y: p.y };
    this.initialized = Boolean(opts.init);
  }

  setAlpha(a) {
    this.alpha = clamp(a, 0, 0.95);
    return this;
  }

  setDeadzone(px) {
    this.deadzone = clamp(px, 0, 20);
    return this;
  }

  reset(x, y) {
    this.p.x = x;
    this.p.y = y;
    this.initialized = true;
    return this;
  }

  update(x, y) {
    if (!this.initialized) {
      return this.reset(x, y);
    }
    const dx = x - this.p.x;
    const dy = y - this.p.y;
    if (this.deadzone > 0 && dx * dx + dy * dy < this.deadzone * this.deadzone) {
      return { x: this.p.x, y: this.p.y };
    }
    const a = this.alpha;
    this.p.x = this.p.x + a * (x - this.p.x);
    this.p.y = this.p.y + a * (y - this.p.y);
    return { x: this.p.x, y: this.p.y };
  }
}

class LowPass {
  constructor(alpha = 0.5, init = 0) {
    this.alpha = alpha;
    this.s = init;
    this.initialized = false;
  }

  setAlpha(a) {
    this.alpha = clamp(a, 0, 1);
  }

  reset(v) {
    this.s = v;
    this.initialized = true;
  }

  filter(v) {
    if (!this.initialized) {
      this.reset(v);
      return v;
    }
    this.s = this.s + this.alpha * (v - this.s);
    return this.s;
  }
}

function alphaFrom(fc, dt) {
  const te = Math.max(dt, 1 / 240);
  const tau = 1 / (2 * Math.PI * Math.max(fc, 1e-6));
  return 1 / (1 + tau / te);
}

export class OneEuroSmoother2D {
  constructor(opts = {}) {
    this.minCutoff = Math.max(0.01, opts.minCutoff ?? 1.2);
    this.beta = Math.max(0, opts.beta ?? 0.003);
    this.dCutoff = Math.max(0.01, opts.dCutoff ?? 1.0);
    this.deadzone = clamp(opts.deadzone ?? 0, 0, 20);
    const p = opts.init ?? { x: 0, y: 0 };
    this.last = { x: p.x, y: p.y };
    this.fX = new LowPass();
    this.fY = new LowPass();
    this.fdX = new LowPass();
    this.fdY = new LowPass();
    this.initialized = false;
  }

  setMinCutoff(v) {
    this.minCutoff = Math.max(0.01, v);
    return this;
  }

  setBeta(v) {
    this.beta = Math.max(0, v);
    return this;
  }

  setDerivativeCutoff(v) {
    this.dCutoff = Math.max(0.01, v);
    return this;
  }

  setDeadzone(px) {
    this.deadzone = clamp(px, 0, 20);
    return this;
  }

  reset(x, y) {
    this.last = { x, y };
    this.fX.reset(x);
    this.fY.reset(y);
    this.fdX.reset(0);
    this.fdY.reset(0);
    this.initialized = true;
    return this;
  }

  update(x, y, dt) {
    const _dt = clamp(dt ?? 1 / 120, 1 / 240, 0.05);
    if (!this.initialized) {
      return this.reset(x, y);
    }
    const dx0 = x - this.last.x;
    const dy0 = y - this.last.y;
    if (this.deadzone > 0 && dx0 * dx0 + dy0 * dy0 < this.deadzone * this.deadzone) {
      x = this.last.x;
      y = this.last.y;
    }
    const dx = (x - this.last.x) / _dt;
    const dy = (y - this.last.y) / _dt;
    this.fdX.setAlpha(alphaFrom(this.dCutoff, _dt));
    this.fdY.setAlpha(alphaFrom(this.dCutoff, _dt));
    const dxf = this.fdX.filter(dx);
    const dyf = this.fdY.filter(dy);
    const speed = Math.hypot(dxf, dyf);
    const fc = this.minCutoff + this.beta * speed;
    this.fX.setAlpha(alphaFrom(fc, _dt));
    this.fY.setAlpha(alphaFrom(fc, _dt));
    const xf = this.fX.filter(x);
    const yf = this.fY.filter(y);
    this.last.x = xf;
    this.last.y = yf;
    return { x: xf, y: yf };
  }
}
