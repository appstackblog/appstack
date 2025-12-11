const MAX_ACTIVE = 3;
const featureHandlers = {
  aimlock: {
    enable: startAimAssistDemo,
    disable: stopAimAssistDemo,
  },
  nheTam: {
    enable: startFeatherAim,
    disable: stopFeatherAim,
  },
  nhay: {
    enable: startQuickSwipe,
    disable: stopQuickSwipe,
  },
  damTam: {
    enable: startSteadyHold,
    disable: stopSteadyHold,
  },
  fixRung: {
    enable: startShakeFix,
    disable: stopShakeFix,
  },
  ghimTam: {
    enable: startAnchorAim,
    disable: stopAnchorAim,
  },
};
const CODE_COLUMNS = 8;
const CODE_SNIPPETS = [
  `namespace ios {
  float aim = 0.45f;
  bool lock = true;
}`,
  `template<typename T>
T smooth(T a, T b, float k){
  return a + (b - a) * k;
}`,
  `struct DriftFix {
  float spread; float decay;
};
DriftFix fix{1.2f, 0.04f};`,
  `constexpr int MAX_LOCK = 3;
volatile bool active = false;`,
  `std::array<float,4> recoil {0.2f,0.3f,0.1f,0.5f};`,
  `auto clamp = [](float v){
  return std::max(0.f, std::min(1.f, v));
};`,
  `for(size_t i=0;i<nodes.size();++i){
  nodes[i].update();
}`,
  `std::cout << "LOCK" << std::endl;
++tick;`,
];

const ping = createPing();

// ---------- Aim Assist Helpers ----------
function clampValue(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function defaultValue(value, fallback) {
  return value === undefined || value === null ? fallback : value;
}
function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}
function lerpPoint(p, q, t) {
  return { x: lerpNumber(p.x, q.x, t), y: lerpNumber(p.y, q.y, t) };
}
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function dotVec(a, b) {
  return a.x * b.x + a.y * b.y;
}

function getNearestInFOV(origin, targets, fovPx) {
  const f2 = fovPx * fovPx;
  let best = null;
  let bestD2 = Infinity;
  for (const t of targets) {
    const d2 = dist2(origin, t);
    if (d2 <= f2 && d2 < bestD2) {
      best = t;
      bestD2 = d2;
    }
  }
  return best;
}

function leadPoint(target, shooterPos, bulletSpeed = 700) {
  const r = { x: target.x - shooterPos.x, y: target.y - shooterPos.y };
  const v = { x: target.vx || 0, y: target.vy || 0 };
  const vv = dotVec(v, v);
  const rr = dotVec(r, r);
  const s2 = bulletSpeed * bulletSpeed;
  const a = vv - s2;
  const b = 2 * dotVec(r, v);
  const c = rr;
  let t;
  if (Math.abs(a) < 1e-6) {
    t = Math.abs(b) > 1e-6 ? -c / b : 0;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) {
      t = 0;
    } else {
      const sqrtD = Math.sqrt(disc);
      const t1 = (-b - sqrtD) / (2 * a);
      const t2 = (-b + sqrtD) / (2 * a);
      const candidates = [t1, t2].filter((x) => x > 0);
      t = candidates.length ? Math.min(...candidates) : 0;
    }
  }
  t = clampValue(t, 0, 1);
  return { x: target.x + v.x * t, y: target.y + v.y * t };
}

function updateReticle(reticle, mouse, targets, opts = {}) {
  const cfg = {
    enabled: true,
    mode: "soft",
    strength: 0.35,
    smoothing: 0.25,
    fov: 180,
    predict: false,
    bulletSpeed: 700,
    ...opts,
  };
  const nearest = getNearestInFOV(mouse, targets, cfg.fov);
  let aimPoint = null;
  if (nearest) {
    aimPoint = cfg.predict ? leadPoint(nearest, mouse, cfg.bulletSpeed) : { x: nearest.x, y: nearest.y };
  }
  let desired;
  if (!cfg.enabled || !aimPoint) {
    desired = mouse;
  } else if (cfg.mode === "snap") {
    desired = aimPoint;
  } else {
    const k = clampValue(cfg.strength, 0, 1);
    desired = lerpPoint(mouse, aimPoint, k);
  }
  const s = clampValue(cfg.smoothing, 0, 1);
  const newReticle = lerpPoint(reticle, desired, s);
  return { reticle: newReticle, target: nearest, aimPoint };
}

class Crosshair {
  constructor(opts = {}) {
    this.weight = opts.weight || 2;
    this.alpha = opts.alpha === undefined ? 0.85 : opts.alpha;
    this.size = opts.size || 12;
    this.gap = opts.gap === undefined ? 4 : opts.gap;
    this.dot = opts.dot === undefined ? 3 : opts.dot;
    this.color = opts.color || "#e6e6e6";
  }
  setWeight(px) {
    this.weight = Math.max(1, Number(px) || 1);
    return this;
  }
  setAlpha(a) {
    const v = Number(a);
    if (!Number.isNaN(v)) {
      this.alpha = Math.max(0, Math.min(1, v));
    }
    return this;
  }
  setColor(css) {
    this.color = String(css || this.color);
    return this;
  }
  setSize(px) {
    this.size = Math.max(1, Number(px) || this.size);
    return this;
  }
  setGap(px) {
    this.gap = Math.max(0, Number(px) || this.gap);
    return this;
  }
  setDot(px) {
    this.dot = Math.max(0, Number(px) || this.dot);
    return this;
  }
  draw(ctx, x, y) {
    if (!ctx) {
      return;
    }
    const { weight, alpha, size, gap, dot, color } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = weight;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(-(gap + size), 0);
    ctx.lineTo(-gap, 0);
    ctx.moveTo(gap, 0);
    ctx.lineTo(gap + size, 0);
    ctx.moveTo(0, -(gap + size));
    ctx.lineTo(0, -gap);
    ctx.moveTo(0, gap);
    ctx.lineTo(0, gap + size);
    ctx.stroke();
    if (dot > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, dot, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class SensitivityPointer {
  constructor(canvas, opts = {}) {
    if (!canvas || !canvas.getContext) {
      throw new Error("Can truyen vao <canvas>.");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sensitivity = clampNumber(opts.sensitivity === undefined ? 0.6 : opts.sensitivity, 0.05, 5);
    this.smoothing = clampNumber(opts.smoothing === undefined ? 0 : opts.smoothing, 0, 0.95);
    this.usePLock = Boolean(opts.pointerLock);
    this.doClamp = opts.clamp === undefined ? true : Boolean(opts.clamp);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    this.phys = { x: cx, y: cy };
    this.lastPhys = null;
    this.virt = { x: cx, y: cy };
    this.target = { x: cx, y: cy };
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onResize = this._onResize.bind(this);
    this._tick = this._tick.bind(this);
    this._raf = 0;
    this.onchange = null;
    this.attach();
  }
  setSensitivity(value) {
    this.sensitivity = clampNumber(Number(value) || 0.6, 0.05, 5);
    return this;
  }
  setSmoothing(alpha) {
    this.smoothing = clampNumber(Number(alpha) || 0, 0, 0.95);
    return this;
  }
  setClamp(enabled) {
    this.doClamp = Boolean(enabled);
    return this;
  }
  get position() {
    return { x: this.virt.x, y: this.virt.y };
  }
  attach() {
    this.canvas.addEventListener("mousemove", this._onMouseMove);
    this.canvas.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);
    window.addEventListener("resize", this._onResize);
    this._raf = requestAnimationFrame(this._tick);
  }
  detach() {
    this.canvas.removeEventListener("mousemove", this._onMouseMove);
    this.canvas.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mouseup", this._onMouseUp);
    window.removeEventListener("resize", this._onResize);
    cancelAnimationFrame(this._raf);
  }
  _tick() {
    if (this.smoothing > 0) {
      this.virt.x = lerpNumber(this.virt.x, this.target.x, this.smoothing);
      this.virt.y = lerpNumber(this.virt.y, this.target.y, this.smoothing);
      if (typeof this.onchange === "function") {
        this.onchange(this.position);
      }
    }
    this._raf = requestAnimationFrame(this._tick);
  }
  _onResize() {
    if (!this.doClamp) {
      return;
    }
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.virt.x = clampNumber(this.virt.x, 0, width);
    this.virt.y = clampNumber(this.virt.y, 0, height);
    this.target.x = clampNumber(this.target.x, 0, width);
    this.target.y = clampNumber(this.target.y, 0, height);
  }
  _toCanvasCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }
  _onMouseDown() {
    if (this.usePLock && this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  }
  _onMouseUp() {
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }
  _onMouseMove(event) {
    let dx = typeof event.movementX === "number" ? event.movementX : 0;
    let dy = typeof event.movementY === "number" ? event.movementY : 0;
    const pos = this._toCanvasCoords(event);
    if (this.lastPhys === null || (dx === 0 && dy === 0)) {
      if (this.lastPhys) {
        dx = pos.x - this.lastPhys.x;
        dy = pos.y - this.lastPhys.y;
      }
      this.lastPhys = { x: pos.x, y: pos.y };
    }
    const k = this.sensitivity;
    this.target.x += dx * k;
    this.target.y += dy * k;
    if (this.doClamp) {
      this.target.x = clampNumber(this.target.x, 0, this.canvas.width);
      this.target.y = clampNumber(this.target.y, 0, this.canvas.height);
    }
    if (this.smoothing === 0) {
      this.virt.x = this.target.x;
      this.virt.y = this.target.y;
      if (typeof this.onchange === "function") {
        this.onchange(this.position);
      }
    }
  }
}

function clampNumber(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

class SteadyAimDamper {
  constructor(opts = {}) {
    this.k = num(opts.stiffness, 40);
    this.z = clampNumber(defaultValue(opts.dampingRatio, 1.1), 0, 5);
    this.m = clampNumber(defaultValue(opts.mass, 1), 0.1, 10);
    this.vmax = clampNumber(defaultValue(opts.maxSpeed, 1200), 50, 10000);
    this.dead = clampNumber(defaultValue(opts.deadzone, 0), 0, 20);
    this.aIn = clampNumber(defaultValue(opts.inputSmoothing, 0.2), 0, 0.95);
    const p0 = defaultValue(opts.initPos, { x: 0, y: 0 });
    this.pos = { x: p0.x, y: p0.y };
    this.vel = { x: 0, y: 0 };
    this.goalRaw = { x: p0.x, y: p0.y };
    this.goal = { x: p0.x, y: p0.y };
  }
  setTarget(x, y) {
    this.goalRaw.x = x;
    this.goalRaw.y = y;
  }
  update(dt) {
    const t = Math.min(Math.max(dt, 0), 0.05);
    const a = this.aIn;
    this.goal.x = lerpNumber(this.goal.x, this.goalRaw.x, a);
    this.goal.y = lerpNumber(this.goal.y, this.goalRaw.y, a);
    const dx = this.goal.x - this.pos.x;
    const dy = this.goal.y - this.pos.y;
    const dead = this.dead;
    let ex = dx;
    let ey = dy;
    if (dead > 0) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < dead) {
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

class RecoilControl {
  constructor(opts = {}) {
    this.fireRate = clampNumber(defaultValue(opts.fireRate, 10), 1, 30);
    this.kickY = num(opts.kickY, 36);
    this.kickX = num(opts.kickX, 8);
    this.recoveryY = num(opts.recoveryY, 18);
    this.recoveryX = num(opts.recoveryX, 24);
    this.reduction = clampNumber(defaultValue(opts.reduction, 0.5), 0, 1);
    this.smoothing = clampNumber(defaultValue(opts.smoothing, 0.25), 0, 0.95);
    this.jitter = num(opts.jitter, 1.5);
    this.pattern = defaultValue(opts.pattern, "alt");
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
    this.reduction = clampNumber(r, 0, 1);
    return this;
  }
  setSmoothing(a) {
    this.smoothing = clampNumber(a, 0, 0.95);
    return this;
  }
  setFireRate(r) {
    this.fireRate = clampNumber(r, 1, 30);
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
      this._target.x += randGaussian() * this.jitter * Math.sqrt(dt);
      this._target.y += randGaussian() * this.jitter * Math.sqrt(dt);
    } else {
      this._target.x = approachValue(this._target.x, 0, this.recoveryX * dt);
      this._target.y = approachValue(this._target.y, 0, this.recoveryY * dt);
    }
    const a = this.smoothing;
    this._curr.x = lerpNumber(this._curr.x, this._target.x, a);
    this._curr.y = lerpNumber(this._curr.y, this._target.y, a);
    const comp = { x: -this._curr.x * this.reduction, y: -this._curr.y * this.reduction };
    return { recoil: { ...this._curr }, compensation: comp };
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

function num(v, d) {
  return Number.isFinite(v) ? v : d;
}

function approachValue(v, goal, delta) {
  if (v < goal) return Math.min(v + delta, goal);
  if (v > goal) return Math.max(v - delta, goal);
  return v;
}

function randGaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

class LowPass {
  constructor(alpha = 0.5, init = 0) {
    this.alpha = alpha;
    this.s = init;
    this.initialized = false;
  }
  setAlpha(a) {
    this.alpha = clampValue(a, 0, 1);
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

class OneEuroSmoother2D {
  constructor(opts = {}) {
    this.minCutoff = Math.max(0.01, defaultValue(opts.minCutoff, 1.2));
    this.beta = Math.max(0, defaultValue(opts.beta, 0.003));
    this.dCutoff = Math.max(0.01, defaultValue(opts.dCutoff, 1));
    this.deadzone = clampValue(defaultValue(opts.deadzone, 0), 0, 20);
    const p = defaultValue(opts.init, { x: 0, y: 0 });
    this.last = { x: p.x, y: p.y };
    this.fX = new LowPass();
    this.fY = new LowPass();
    this.fdX = new LowPass();
    this.fdY = new LowPass();
    this.initialized = false;
  }
  update(x, y, dt) {
    const _dt = clampValue(defaultValue(dt, 1 / 120), 1 / 240, 0.05);
    if (!this.initialized) {
      this.reset(x, y);
      return { x, y };
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
  reset(x, y) {
    this.last = { x, y };
    this.fX.reset(x);
    this.fY.reset(y);
    this.fdX.reset(0);
    this.fdY.reset(0);
    this.initialized = true;
    return this;
  }
}

function initPanel() {
  const cards = document.querySelectorAll("[data-feature]");
  const limitToast = document.getElementById("limitToast");
  const limitOverlay = document.getElementById("limitOverlay");
  if (!cards.length) {
    return;
  }
  const featureState = {};
  const featureRefs = {};
  cards.forEach((card) => {
    const featureId = card.getAttribute("data-feature");
    const button = card.querySelector(".aimlock-switch");
    const status = card.querySelector(".status-pill");
    if (!featureId || !button || !status) {
      return;
    }
    featureState[featureId] = false;
    featureRefs[featureId] = { button, status, card };
    button.addEventListener("click", (event) => {
      event.preventDefault();
      toggleFeature(featureId);
    });
    card.addEventListener("click", (event) => {
      if (event.target.closest(".aimlock-switch")) {
        return;
      }
      toggleFeature(featureId);
    });
  });

  function activeCount() {
    return Object.keys(featureState).reduce((count, id) => count + (featureState[id] ? 1 : 0), 0);
  }

  function toggleFeature(id) {
    if (!featureRefs[id]) {
      return;
    }
    if (!featureState[id] && activeCount() >= MAX_ACTIVE) {
      showLimit();
      return;
    }
    featureState[id] = !featureState[id];
    renderFeature(id, featureState[id]);
    runFeatureHandler(id, featureState[id]);
    ping();
  }

  function renderFeature(id, isOn) {
    const refs = featureRefs[id];
    refs.button.classList.toggle("on", isOn);
    refs.button.setAttribute("aria-pressed", String(isOn));
    refs.card.classList.toggle("active", isOn);
    refs.status.textContent = isOn ? "On" : "Off";
    refs.status.classList.toggle("on", isOn);
    refs.status.classList.toggle("off", !isOn);
  }

  function showLimit() {
    if (!limitToast) {
      return;
    }
    limitToast.classList.add("show");
    if (limitOverlay) {
      limitOverlay.classList.add("show");
    }
    setTimeout(() => {
      limitToast.classList.remove("show");
      if (limitOverlay) {
        limitOverlay.classList.remove("show");
      }
    }, 1600);
  }

  function runFeatureHandler(id, isOn) {
    const handler = featureHandlers[id];
    if (!handler) {
      return;
    }
    if (isOn && handler.enable) {
      handler.enable();
    } else if (!isOn && handler.disable) {
      handler.disable();
    }
  }
}

function createPing() {
  const AudioApi = window.AudioContext || window.webkitAudioContext;
  if (!AudioApi) {
    return () => {};
  }
  const ctx = new AudioApi();
  return () => {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  };
}

function startCodeRain() {
  const layer = document.getElementById("codeRain");
  if (!layer) {
    return;
  }
  layer.innerHTML = "";
  const pickSnippet = () => CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
  const formatSnippet = (snippet) =>
    snippet
      .split("\n")
      .map((line) => (line.trim().length === 0 ? " " : line))
      .join("<br />");
  const spawnColumn = () => {
    const column = document.createElement("div");
    column.className = "code-column";
    layer.appendChild(column);
    const track = document.createElement("div");
    track.className = "code-track";
    column.appendChild(track);
    const duration = 12 + Math.random() * 14;
    column.style.setProperty("--duration", `${duration}s`);
    column.style.setProperty("--delay", `${-Math.random() * duration}s`);
    const refresh = () => {
      const snippet = formatSnippet(pickSnippet());
      track.innerHTML = `${snippet}<br />${snippet}`;
    };
    refresh();
    setInterval(refresh, 4500 + Math.random() * 5500);
  };
  for (let i = 0; i < CODE_COLUMNS; i += 1) {
    spawnColumn();
  }
}

function bootPanel() {
  initPanel();
  startCodeRain();
  console.log("Panel booted, features:", Object.keys(featureHandlers));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPanel);
} else {
  bootPanel();
}

const aimDemoState = {
  active: false,
  reticle: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  targets: [],
  raf: 0,
  lastTime: null,
};
const aimMouseHandler = (event) => {
  aimDemoState.mouse.x = event.clientX;
  aimDemoState.mouse.y = event.clientY;
};

function startAimAssistDemo() {
  if (aimDemoState.active) {
    return;
  }
  aimDemoState.active = true;
  aimDemoState.reticle = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  aimDemoState.mouse = { ...aimDemoState.reticle };
  aimDemoState.targets = createAimTargets();
  window.addEventListener("mousemove", aimMouseHandler);
  aimDemoState.raf = requestAnimationFrame(runAimAssistLoop);
}

function stopAimAssistDemo() {
  if (!aimDemoState.active) {
    return;
  }
  aimDemoState.active = false;
  aimDemoState.lastTime = null;
  cancelAnimationFrame(aimDemoState.raf);
  aimDemoState.raf = 0;
  window.removeEventListener("mousemove", aimMouseHandler);
}

function createAimTargets() {
  const targets = [];
  for (let i = 0; i < 6; i += 1) {
    targets.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160,
    });
  }
  return targets;
}

function updateAimTargets(targets, dt) {
  targets.forEach((t) => {
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    if (t.x < 0 || t.x > window.innerWidth) {
      t.vx *= -1;
    }
    if (t.y < 0 || t.y > window.innerHeight) {
      t.vy *= -1;
    }
  });
}

function runAimAssistLoop(timestamp) {
  if (!aimDemoState.active) {
    return;
  }
  if (!aimDemoState.lastTime) {
    aimDemoState.lastTime = timestamp;
  }
  const dt = (timestamp - aimDemoState.lastTime) / 1000;
  aimDemoState.lastTime = timestamp;
  updateAimTargets(aimDemoState.targets, dt);
  const result = updateReticle(
    aimDemoState.reticle,
    aimDemoState.mouse,
    aimDemoState.targets,
    {
      enabled: true,
      predict: true,
      bulletSpeed: 700,
      smoothing: 0.3,
      strength: 0.45,
      fov: 260,
    }
  );
  aimDemoState.reticle = result.reticle;
  aimDemoState.raf = requestAnimationFrame(runAimAssistLoop);
}

const featherAimState = {
  active: false,
  instance: null,
  canvas: null,
  ctx: null,
  raf: 0,
  mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  moveHandler: null,
  resizeHandler: null,
};

function startFeatherAim() {
  if (featherAimState.active) {
    return;
  }
  const canvas = document.getElementById("aimCanvas");
  if (!canvas) {
    console.warn("Feather aim: canvas not found");
    return;
  }
  const ctx = canvas.getContext("2d");
  featherAimState.instance = new Crosshair({
    weight: 1.2,
    alpha: 0.55,
    size: 16,
    gap: 5,
    dot: 2,
    color: "#cbd5f5",
  });
  featherAimState.canvas = canvas;
  featherAimState.ctx = ctx;
  featherAimState.active = true;
  resizeFeatherCanvas();
  featherAimState.moveHandler = (event) => {
    featherAimState.mouse.x = event.clientX;
    featherAimState.mouse.y = event.clientY;
  };
  featherAimState.resizeHandler = () => resizeFeatherCanvas();
  window.addEventListener("mousemove", featherAimState.moveHandler);
  window.addEventListener("resize", featherAimState.resizeHandler);
  featherAimState.raf = requestAnimationFrame(runFeatherAimLoop);
}

function stopFeatherAim() {
  if (!featherAimState.active) {
    return;
  }
  featherAimState.active = false;
  cancelAnimationFrame(featherAimState.raf);
  featherAimState.raf = 0;
  if (featherAimState.moveHandler) {
    window.removeEventListener("mousemove", featherAimState.moveHandler);
  }
  if (featherAimState.resizeHandler) {
    window.removeEventListener("resize", featherAimState.resizeHandler);
  }
  if (featherAimState.ctx && featherAimState.canvas) {
    featherAimState.ctx.clearRect(0, 0, featherAimState.canvas.width, featherAimState.canvas.height);
  }
  featherAimState.instance = null;
  featherAimState.canvas = null;
  featherAimState.ctx = null;
}

function resizeFeatherCanvas() {
  if (!featherAimState.canvas || !featherAimState.ctx) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  featherAimState.canvas.width = Math.floor(window.innerWidth * dpr);
  featherAimState.canvas.height = Math.floor(window.innerHeight * dpr);
  featherAimState.canvas.style.width = `${window.innerWidth}px`;
  featherAimState.canvas.style.height = `${window.innerHeight}px`;
  featherAimState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function runFeatherAimLoop() {
  if (!featherAimState.active || !featherAimState.instance || !featherAimState.ctx) {
    return;
  }
  featherAimState.ctx.clearRect(0, 0, featherAimState.canvas.width, featherAimState.canvas.height);
  featherAimState.instance.draw(featherAimState.ctx, featherAimState.mouse.x, featherAimState.mouse.y);
  featherAimState.raf = requestAnimationFrame(runFeatherAimLoop);
}

const quickSwipeState = {
  active: false,
  module: null,
  instance: null,
};

function startQuickSwipe() {
  if (quickSwipeState.active) {
    return;
  }
  const canvas = document.getElementById("aimCanvas");
  if (!canvas) {
    console.warn("Quick swipe: canvas not found");
    return;
  }
  quickSwipeState.instance = new SensitivityPointer(canvas, {
    sensitivity: 0.9,
    smoothing: 0.08,
    pointerLock: false,
    clamp: true,
  });
  quickSwipeState.active = true;
}

function stopQuickSwipe() {
  if (!quickSwipeState.active) {
    return;
  }
  quickSwipeState.active = false;
  if (quickSwipeState.instance && typeof quickSwipeState.instance.detach === "function") {
    quickSwipeState.instance.detach();
  }
  quickSwipeState.instance = null;
}

const steadyState = {
  active: false,
  instance: null,
  raf: 0,
  lastTime: null,
  mouseHandler: null,
};

function startSteadyHold() {
  if (steadyState.active) {
    return;
  }
  steadyState.instance = new SteadyAimDamper({
    stiffness: 45,
    dampingRatio: 1.2,
    inputSmoothing: 0.25,
    initPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  });
  steadyState.mouseHandler = (event) => {
    if (steadyState.instance) {
      steadyState.instance.setTarget(event.clientX, event.clientY);
    }
  };
  window.addEventListener("mousemove", steadyState.mouseHandler);
  steadyState.active = true;
  steadyState.lastTime = null;
  steadyState.raf = requestAnimationFrame(runSteadyLoop);
}

function stopSteadyHold() {
  if (!steadyState.active) {
    return;
  }
  steadyState.active = false;
  cancelAnimationFrame(steadyState.raf);
  steadyState.raf = 0;
  if (steadyState.mouseHandler) {
    window.removeEventListener("mousemove", steadyState.mouseHandler);
  }
  steadyState.mouseHandler = null;
  steadyState.instance = null;
}

function runSteadyLoop(timestamp) {
  if (!steadyState.active || !steadyState.instance) {
    return;
  }
  if (!steadyState.lastTime) {
    steadyState.lastTime = timestamp;
  }
  const dt = Math.min((timestamp - steadyState.lastTime) / 1000, 0.05);
  steadyState.lastTime = timestamp;
  steadyState.instance.update(dt);
  steadyState.raf = requestAnimationFrame(runSteadyLoop);
}

const anchorState = {
  active: false,
  instance: null,
  raf: 0,
  lastTime: null,
};

function startAnchorAim() {
  if (anchorState.active) {
    return;
  }
  anchorState.instance = new RecoilControl({
    fireRate: 12,
    kickY: 28,
    kickX: 6,
    reduction: 0.6,
    smoothing: 0.25,
  });
  anchorState.instance.triggerDown();
  anchorState.active = true;
  anchorState.lastTime = null;
  anchorState.raf = requestAnimationFrame(runAnchorLoop);
}

function stopAnchorAim() {
  if (!anchorState.active) {
    return;
  }
  anchorState.active = false;
  if (anchorState.instance) {
    anchorState.instance.triggerUp();
  }
  cancelAnimationFrame(anchorState.raf);
  anchorState.raf = 0;
  anchorState.instance = null;
}

function runAnchorLoop(timestamp) {
  if (!anchorState.active || !anchorState.instance) {
    return;
  }
  if (!anchorState.lastTime) {
    anchorState.lastTime = timestamp;
  }
  const dt = Math.min((timestamp - anchorState.lastTime) / 1000, 0.05);
  anchorState.lastTime = timestamp;
  anchorState.instance.update(dt);
  anchorState.raf = requestAnimationFrame(runAnchorLoop);
}

const shakeState = {
  active: false,
  smoother: null,
  handler: null,
  raf: 0,
  lastTime: null,
  mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
};

function startShakeFix() {
  if (shakeState.active) {
    return;
  }
  shakeState.smoother = new OneEuroSmoother2D({
    init: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    minCutoff: 1.2,
    beta: 0.004,
    deadzone: 0.2,
  });
  shakeState.mouse.x = window.innerWidth / 2;
  shakeState.mouse.y = window.innerHeight / 2;
  shakeState.handler = (event) => {
    shakeState.mouse.x = event.clientX;
    shakeState.mouse.y = event.clientY;
  };
  window.addEventListener("mousemove", shakeState.handler);
  shakeState.active = true;
  shakeState.lastTime = null;
  shakeState.raf = requestAnimationFrame(runShakeLoop);
}

function stopShakeFix() {
  if (!shakeState.active) {
    return;
  }
  shakeState.active = false;
  cancelAnimationFrame(shakeState.raf);
  shakeState.raf = 0;
  shakeState.lastTime = null;
  if (shakeState.handler) {
    window.removeEventListener("mousemove", shakeState.handler);
  }
  shakeState.handler = null;
  shakeState.smoother = null;
}

function runShakeLoop(timestamp) {
  if (!shakeState.active || !shakeState.smoother) {
    return;
  }
  if (!shakeState.lastTime) {
    shakeState.lastTime = timestamp;
  }
  const dt = Math.min((timestamp - shakeState.lastTime) / 1000, 0.05);
  shakeState.lastTime = timestamp;
  shakeState.smoother.update(shakeState.mouse.x, shakeState.mouse.y, dt);
  shakeState.raf = requestAnimationFrame(runShakeLoop);
}

const steadyState = {
  active: false,
  instance: null,
  raf: 0,
  reticle: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  target: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  mouseHandler: null,
};

function startSteadyHold() {
  if (steadyState.active) {
    return;
  }
  steadyState.instance = new SteadyAimDamper({
    stiffness: 45,
    dampingRatio: 1.2,
    inputSmoothing: 0.3,
    initPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  });
  steadyState.mouseHandler = (event) => {
    steadyState.target.x = event.clientX;
    steadyState.target.y = event.clientY;
    if (steadyState.instance) {
      steadyState.instance.setTarget(event.clientX, event.clientY);
    }
  };
  window.addEventListener("mousemove", steadyState.mouseHandler);
  steadyState.active = true;
  steadyState.raf = requestAnimationFrame(runSteadyLoop);
}

function stopSteadyHold() {
  if (!steadyState.active) {
    return;
  }
  steadyState.active = false;
  cancelAnimationFrame(steadyState.raf);
  steadyState.raf = 0;
  if (steadyState.mouseHandler) {
    window.removeEventListener("mousemove", steadyState.mouseHandler);
  }
  steadyState.instance = null;
}

function runSteadyLoop(timestamp) {
  if (!steadyState.active || !steadyState.instance) {
    return;
  }
  if (!steadyState.lastTime) {
    steadyState.lastTime = timestamp;
  }
  const dt = Math.min((timestamp - steadyState.lastTime) / 1000, 0.05);
  steadyState.lastTime = timestamp;
  const pos = steadyState.instance.update(dt);
  steadyState.reticle = pos;
  if (aimDemoState.active) {
    aimDemoState.reticle = { ...pos };
  }
  steadyState.raf = requestAnimationFrame(runSteadyLoop);
}

const anchorState = {
  active: false,
  instance: null,
  raf: 0,
  lastTime: null,
};

function startAnchorAim() {
  if (anchorState.active) {
    return;
  }
  anchorState.instance = new RecoilControl({
    fireRate: 12,
    kickY: 28,
    kickX: 6,
    reduction: 0.6,
    smoothing: 0.2,
  });
  anchorState.instance.triggerDown();
  anchorState.active = true;
  anchorState.lastTime = null;
  anchorState.raf = requestAnimationFrame(runAnchorLoop);
}

function stopAnchorAim() {
  if (!anchorState.active) {
    return;
  }
  anchorState.active = false;
  if (anchorState.instance) {
    anchorState.instance.triggerUp();
  }
  cancelAnimationFrame(anchorState.raf);
  anchorState.raf = 0;
  anchorState.instance = null;
}

function runAnchorLoop(timestamp) {
  if (!anchorState.active || !anchorState.instance) {
    return;
  }
  if (!anchorState.lastTime) {
    anchorState.lastTime = timestamp;
  }
  const dt = Math.min((timestamp - anchorState.lastTime) / 1000, 0.05);
  anchorState.lastTime = timestamp;
  anchorState.instance.update(dt);
  anchorState.raf = requestAnimationFrame(runAnchorLoop);
}
