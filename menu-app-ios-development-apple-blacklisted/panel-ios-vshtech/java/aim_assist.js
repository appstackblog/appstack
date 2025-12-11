// aim_assist.js
// M?c dích h?c thu?t/mô ph?ng. Ð?ng dùng d? gian l?n trong trò choi.

// ---------- Helpers ----------
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function lerpPt(p, q, t){ return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) }; }
function dist2(a, b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx + dy*dy; }
function dot(a, b){ return a.x*b.x + a.y*b.y; }
function len(v){ return Math.hypot(v.x, v.y); }

// ---------- Core ----------
export function getNearestInFOV(origin, targets, fovPx){
  const f2 = fovPx * fovPx;
  let best = null, bestD2 = Infinity;
  for(const t of targets){
    const d2 = dist2(origin, t);
    if(d2 <= f2 && d2 < bestD2){ best = t; bestD2 = d2; }
  }
  return best;
}

// D?n b?n: nghi?m giao nhau c?a viên d?n t?c d? s v?i m?c tiêu có v?n t?c v.
// Gi?i (v·v - s^2) t^2 + 2(r·v) t + (r·r) = 0, l?y t duong nh? nh?t.
export function leadPoint(target, shooterPos, bulletSpeed = 700){
  const r = { x: target.x - shooterPos.x, y: target.y - shooterPos.y };
  const v = { x: target.vx || 0, y: target.vy || 0 };
  const vv = dot(v, v);
  const rr = dot(r, r);
  const s2 = bulletSpeed * bulletSpeed;

  const a = vv - s2;
  const b = 2 * dot(r, v);
  const c = rr;

  let t;
  if (Math.abs(a) < 1e-6) {
    t = (Math.abs(b) > 1e-6) ? (-c / b) : 0;
  } else {
    const disc = b*b - 4*a*c;
    if (disc < 0) t = 0;
    else {
      const sqrtD = Math.sqrt(disc);
      const t1 = (-b - sqrtD) / (2*a);
      const t2 = (-b + sqrtD) / (2*a);
      const candidates = [t1, t2].filter(x => x > 0);
      t = candidates.length ? Math.min(...candidates) : 0;
    }
  }
  t = clamp(t, 0, 1.0);
  return { x: target.x + v.x * t, y: target.y + v.y * t };
}

export function updateReticle(reticle, mouse, targets, opts = {}){
  const cfg = {
    enabled: true,
    mode: 'soft',
    strength: 0.35,
    smoothing: 0.25,
    fov: 180,
    predict: false,
    bulletSpeed: 700,
    ...opts
  };

  const nearest = getNearestInFOV(mouse, targets, cfg.fov);
  let aimPoint = null;
  if (nearest) {
    aimPoint = cfg.predict
      ? leadPoint(nearest, mouse, cfg.bulletSpeed)
      : { x: nearest.x, y: nearest.y };
  }

  let desired;
  if (!cfg.enabled || !aimPoint) {
    desired = mouse;
  } else if (cfg.mode === 'snap') {
    desired = aimPoint;
  } else {
    const k = clamp(cfg.strength, 0, 1);
    desired = lerpPt(mouse, aimPoint, k);
  }

  const s = clamp(cfg.smoothing, 0, 1);
  const newReticle = lerpPt(reticle, desired, s);

  return { reticle: newReticle, target: nearest, aimPoint };
}
