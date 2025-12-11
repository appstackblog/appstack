// crosshair_light.js
// Chuc nang "nhe tam" (crosshair weight & alpha) dung cho canvas demo.

export class Crosshair {
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
