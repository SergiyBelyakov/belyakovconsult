// Геометрія на площині в кілометрах: випадкові числа з зерном, згладжування, вигини доріг, перетини, відстані.

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Сплайн Катмулла-Рома через контрольні точки
export function smooth(points, per = 8) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1].slice());
  return out;
}

// Дорога як плавна ламана з вузлами приблизно через 600 м: вигин залежить від класу дороги
export function bendy(A, B, amp, rnd) {
  const L = dist(A, B), n = Math.max(2, Math.ceil(L / 0.6));
  const ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
  const a1 = Math.min(1.4, amp * L) * (rnd() < 0.5 ? -1 : 1), a2 = Math.min(0.45, amp * L * 0.4);
  const ph = rnd() * Math.PI * 2, fr = 1.2 + rnd() * 1.6;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, env = Math.sin(Math.PI * s);
    const off = env * (a1 + a2 * Math.sin(2 * Math.PI * fr * s + ph));
    pts.push([A[0] + ux * L * s - uy * off, A[1] + uy * L * s + ux * off]);
  }
  pts[0] = [A[0], A[1]]; pts[n] = [B[0], B[1]];
  return pts;
}

export function segX(a, b, c, d) {
  const d1 = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (Math.abs(d1) < 1e-12) return null;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / d1;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / d1;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), t, u] : null;
}

// чи перетинає відрізок AB ламану (або замкнений контур)
export function crossesLine(A, B, line, closed = false) {
  const n = line.length;
  for (let i = 0; i < n - (closed ? 0 : 1); i++) if (segX(A, B, line[i], line[(i + 1) % n])) return true;
  return false;
}

export function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// відстань від точки до відрізка і до ламаної
export function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function distLine(p, line, closed = false) {
  let m = Infinity;
  const n = line.length;
  for (let i = 0; i < n - (closed ? 0 : 1); i++) m = Math.min(m, distSeg(p, line[i], line[(i + 1) % n]));
  return m;
}

export function polyLen(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

// накопичені довжини для руху вздовж ламаної
export function cumLen(pts) {
  const c = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + dist(pts[i - 1], pts[i]);
  return c;
}
export function along(pts, cum, s) {
  const L = cum[cum.length - 1];
  if (s <= 0) return [pts[0][0], pts[0][1], Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0])];
  if (s >= L) { const n = pts.length; return [pts[n - 1][0], pts[n - 1][1], Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0])]; }
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1), a = pts[lo], b = pts[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
}

// еліпс як многокутник
export function ellipse(cx, cy, rx, ry, rot = 0, n = 36, wob = 0, rnd = null) {
  const out = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + (wob && rnd ? (rnd() - 0.5) * wob : 0);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}
