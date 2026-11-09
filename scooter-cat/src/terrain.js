// Траса гри: ламана з неспадними x, тобто графік функції (вертикальні відрізки дозволені, це краї стовпчиків).
// Тут пошук зіткнення кола з ламаною, висота й нахил у точці та «ворота», які змінюють шкалу ділянки попереду.

export class Terrain {
  constructor(X, Y) {
    this.X = Float64Array.from(X);
    this.Y0 = Float64Array.from(Y);   // базова форма
    this.Y = Float64Array.from(Y);    // поточна форма (з урахуванням воріт)
    this.n = this.X.length;
    this.morphs = [];                 // { i0, D: Float64Array, t }
  }

  // перший відрізок i, у якого X[i + 1] >= x
  seg(x) {
    const X = this.X;
    if (x <= X[0]) return 0;
    let lo = 0, hi = this.n - 2;
    if (x >= X[hi + 1]) return hi;
    while (lo < hi) { const m = (lo + hi) >> 1; if (X[m + 1] < x) lo = m + 1; else hi = m; }
    return lo;
  }

  height(x) {
    const X = this.X, Y = this.Y;
    let i = this.seg(x);
    while (i < this.n - 2 && X[i + 1] - X[i] < 1e-9) i++;
    const dx = X[i + 1] - X[i];
    if (dx < 1e-9) return Math.max(Y[i], Y[i + 1]);
    const t = Math.max(0, Math.min(1, (x - X[i]) / dx));
    return Y[i] + t * (Y[i + 1] - Y[i]);
  }

  // середній нахил між x - h і x + h (радіани)
  angle(x, h = 0.5) { return Math.atan2(this.height(x + h) - this.height(x - h), 2 * h); }

  // Найглибший дотик кола до траси: { nx, ny, pen } або null. Центр під поверхнею виштовхується вгору.
  contact(cx, cy, r) {
    const X = this.X, Y = this.Y;
    let best = null;
    for (let i = this.seg(cx - r); i < this.n - 1 && X[i] <= cx + r; i++) {
      const ax = X[i], ay = Y[i], dx = X[i + 1] - ax, dy = Y[i + 1] - ay, L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) continue;
      let t = ((cx - ax) * dx + (cy - ay) * dy) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + t * dx, py = ay + t * dy, ex = cx - px, ey = cy - py;
      const L = Math.sqrt(L2), snx = -dy / L, sny = dx / L;
      if (t > 0 && t < 1 && ex * snx + ey * sny < 0) continue;   // центр за відрізком: цей випадок ловить перевірка висоти нижче
      const d2 = ex * ex + ey * ey;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2), pen = r - d;
      if (!best || pen > best.pen) best = d > 1e-9 ? { nx: ex / d, ny: ey / d, pen } : { nx: snx, ny: sny, pen };
    }
    const h = this.height(cx);
    if (cy < h) {   // центр під землею (поява на трасі, зміна шкали): просто вгору
      const pen = h - cy + r;
      if (!best || pen > best.pen) best = { nx: 0, ny: 1, pen };
    }
    return best;
  }

  // Ворота: ділянка [i0, i0 + D.length) плавно переходить у нову форму (Y0 + D) за параметром t від 0 до 1
  addMorph(i0, D) { const m = { i0, D, t: 0 }; this.morphs.push(m); return m; }
  applyMorphs() {
    this.Y.set(this.Y0);
    for (const m of this.morphs) if (m.t > 0) for (let k = 0; k < m.D.length; k++) this.Y[m.i0 + k] += m.D[k] * m.t;
  }
  resetMorphs() { for (const m of this.morphs) m.t = 0; this.applyMorphs(); }
}
