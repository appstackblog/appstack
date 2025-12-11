// sensitivity_pointer.js
// Chuc nang "nhay man" – scale chuot thuc -> chuot ao trong canvas demo.

export class SensitivityPointer {
  constructor(canvas, opts = {}) {
    if (!canvas || !canvas.getContext) {
      throw new Error("Can truyen vao <canvas>.");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sensitivity = clampNum(opts.sensitivity === undefined ? 0.6 : opts.sensitivity, 0.05, 5);
    this.smoothing = clampNum(opts.smoothing === undefined ? 0 : opts.smoothing, 0, 0.95);
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
    this.sensitivity = clampNum(Number(value) || 0.6, 0.05, 5);
    return this;
  }

  setSmoothing(alpha) {
    this.smoothing = clampNum(Number(alpha) || 0, 0, 0.95);
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
      this.virt.x = lerp(this.virt.x, this.target.x, this.smoothing);
      this.virt.y = lerp(this.virt.y, this.target.y, this.smoothing);
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
    this.virt.x = clampNum(this.virt.x, 0, width);
    this.virt.y = clampNum(this.virt.y, 0, height);
    this.target.x = clampNum(this.target.x, 0, width);
    this.target.y = clampNum(this.target.y, 0, height);
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
      this.target.x = clampNum(this.target.x, 0, this.canvas.width);
      this.target.y = clampNum(this.target.y, 0, this.canvas.height);
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

function clampNum(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
