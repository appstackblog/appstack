// recoil_control.js
// Chuc nang ghim tam (RecoilControl) cho demo sandbox.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function approach(v, goal, delta) {
  if (v < goal) return Math.min(v + delta, goal);
  if (v > goal) return Math.max(v - delta, goal);
  return v;
}

function num(v, d) {
  return Number.isFinite(v) ? v : d;
}

function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampNum(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class RecoilControl {
  constructor(opts = {}) {
    this.fireRate = clampNum(opts.fireRate ?? 10, 1, 30);
    this.kickY = num(opts.kickY, 36);
    this.kickX = num(opts.kickX, 8);
    this.recoveryY = num(opts.recoveryY, 18);
    this.recoveryX = num(opts.recoveryX, 24);
    this.reduction = clampNum(opts.reduction ?? 0.5, 0, 1);
    this.smoothing = clampNum(opts.smoothing ?? 0.25, 0, 0.95);
    this.jitter = num(opts.jitter, 1.5);
    this.pattern = opts.pattern ?? "alt";
    this.vScaleUp = num(opts.verticalScaleUp, 0.015);
    this._firing = false;
    this._tSince = 0;
    this._shot = 0;
    this._target = { x: 0, y: 0 };
    this._curr = { x: 0, y: 0 };
  }

  triggerDown() {
    this._firing = true;
  }

  triggerUp() {
    this._firing = false;
  }

  setReduction(r) {
    this.reduction = clampNum(r, 0, 1);
    return this;
  }

  setSmoothing(a) {
    this.smoothing = clampNum(a, 0, 0.95);
    return this;
  }

  setFireRate(r) {
    this.fireRate = clampNum(r, 1, 30);
    return this;
  }

  update(dt) {
    const interval = 1 / this.fireRate;
    if (this._firing) {
      this._tSince += dt;
      while (this._tSince >= interval) {
        this._tSince -= interval;
        this._emitShot();
      }
      this._target.x += randn() * this.jitter * Math.sqrt(dt);
      this._target.y += randn() * this.jitter * Math.sqrt(dt);
    } else {
      this._target.x = approach(this._target.x, 0, this.recoveryX * dt);
      this._target.y = approach(this._target.y, 0, this.recoveryY * dt);
    }
    const a = this.smoothing;
    this._curr.x = lerp(this._curr.x, this._target.x, a);
    this._curr.y = lerp(this._curr.y, this._target.y, a);
    const comp = { x: -this._curr.x * this.reduction, y: -this._curr.y * this.reduction };
    return { recoil: { ...this._curr }, compensation: comp };
  }

  applyTo(point) {
    const { compensation } = this.update(0);
    return { x: point.x + compensation.x, y: point.y + compensation.y };
  }

  _emitShot() {
    this._shot += 1;
    const scale = 1 + (this._shot - 1) * this.vScaleUp;
    const dy = this.kickY * scale;
    let dx = 0;
    if (Array.isArray(this.pattern) && this.pattern.length) {
      const p = this.pattern[(this._shot - 1) % this.pattern.length];
      const px = p && typeof p.x === "number" ? p.x : 0;
      const py = p && typeof p.y === "number" ? p.y : 0;
      dx = this.kickX * px;
      this._target.y += this.kickY * py;
    } else if (this.pattern === "alt") {
      dx = this.kickX * (this._shot % 2 ? 1 : -1);
    }
    this._target.x += dx;
    this._target.y += dy;
  }
}
