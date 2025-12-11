// steady_aim_damper.js
// "Dam tam" = bo loc spring-damper bac 2 giup giu reticle on dinh.

export class SteadyAimDamper {
  constructor(opts = {}) {
    this.k = num(opts.stiffness, 40);
    this.z = clamp(valueOr(opts.dampingRatio, 1.1), 0, 5);
    this.m = clamp(valueOr(opts.mass, 1), 0.1, 10);
    this.vmax = clamp(valueOr(opts.maxSpeed, 1200), 50, 10000);
    this.dead = clamp(valueOr(opts.deadzone, 0), 0, 20);
    this.aIn = clamp(valueOr(opts.inputSmoothing, 0.2), 0, 0.95);
    const p0 = opts.initPos || { x: 0, y: 0 };
    this.pos = { x: p0.x, y: p0.y };
    this.vel = { x: 0, y: 0 };
    this.goalRaw = { x: p0.x, y: p0.y };
    this.goal = { x: p0.x, y: p0.y };
  }

  setTarget(x, y) {
    this.goalRaw.x = x;
    this.goalRaw.y = y;
  }

  setStiffness(v) {
    this.k = num(v, this.k);
    return this;
  }

  setDampingRatio(v) {
    this.z = clamp(v, 0, 5);
    return this;
  }

  setMass(v) {
    this.m = clamp(v, 0.1, 10);
    return this;
  }

  setMaxSpeed(v) {
    this.vmax = clamp(v, 50, 10000);
    return this;
  }

  setDeadzone(px) {
    this.dead = clamp(px, 0, 20);
    return this;
  }

  setInputSmoothing(a) {
    this.aIn = clamp(a, 0, 0.95);
    return this;
  }

  update(dt) {
    const t = Math.min(Math.max(dt, 0), 0.05);
    const a = this.aIn;
    this.goal.x = lerp(this.goal.x, this.goalRaw.x, a);
    this.goal.y = lerp(this.goal.y, this.goalRaw.y, a);
    const dx = this.goal.x - this.pos.x;
    const dy = this.goal.y - this.pos.y;
    const dead = this.dead;
    let ex = dx;
    let ey = dy;
    if (dead > 0) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < dead) {
        ex = 0;
        ey = 0;
      }
    }
    const omega = Math.sqrt(Math.max(this.k, 1e-6));
    const ax = ((omega * omega) * ex - (2 * this.z * omega) * this.vel.x) / this.m;
    const ay = ((omega * omega) * ey - (2 * this.z * omega) * this.vel.y) / this.m;
    this.vel.x += ax * t;
    this.vel.y += ay * t;
    const v = Math.hypot(this.vel.x, this.vel.y);
    if (v > this.vmax) {
      const s = this.vmax / Math.max(v, 1e-6);
      this.vel.x *= s;
      this.vel.y *= s;
    }
    this.pos.x += this.vel.x * t;
    this.pos.y += this.vel.y * t;
    return { x: this.pos.x, y: this.pos.y };
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(s, e, t) {
  return s + (e - s) * t;
}

function num(v, d) {
  return Number.isFinite(v) ? v : d;
}

function valueOr(v, fallback) {
  return v === undefined || v === null ? fallback : v;
}
