// Спільна математика рушія прогнозів: генератор випадкових чисел із зерном, описова статистика,
// оптимізація (Нелдер-Мід, золотий перетин), найменші квадрати, автокореляції, тест KPSS.
// Без сторонніх бібліотек: усе рахується в браузері відвідувача.

export const Z80 = 1.2816, Z95 = 1.96;

export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  next.normal = () => {
    if (spare != null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0;
    while (u <= 1e-12) u = next();
    v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  next.int = n => Math.floor(next() * n);
  next.poisson = lam => { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= next(); } while (p > L); return k - 1; };
  return next;
}

export const sum = a => { let s = 0; for (const v of a) s += v; return s; };
export const mean = a => (a.length ? sum(a) / a.length : NaN);
export function variance(a) { const m = mean(a); let s = 0; for (const v of a) s += (v - m) ** 2; return a.length > 1 ? s / (a.length - 1) : 0; }
export const sd = a => Math.sqrt(variance(a));
export function rms(a) { let s = 0, k = 0; for (const v of a) if (Number.isFinite(v)) { s += v * v; k++; } return k ? Math.sqrt(s / k) : NaN; }
export function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const x = (sorted.length - 1) * q, i = Math.floor(x), f = x - i;
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * f : sorted[i];
}
export const nanArr = n => new Array(n).fill(NaN);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const sig = x => 1 / (1 + Math.exp(-x));
export const logit = p => Math.log(p / (1 - p));

// Залишки там, де модель дала значення на історії
export function residuals(y, fitted) {
  const e = [];
  for (let t = 0; t < y.length; t++) if (Number.isFinite(fitted[t]) && Number.isFinite(y[t])) e.push(y[t] - fitted[t]);
  return e;
}

// Нелдер-Мід: мінімум функції без похідних
export function nelderMead(fn, x0, { iters = 500, step = 0.6, tol = 1e-10 } = {}) {
  const n = x0.length;
  let pts = [x0, ...x0.map((_, i) => x0.map((v, j) => v + (i === j ? step : 0)))].map(x => ({ x, f: fn(x) }));
  for (let it = 0; it < iters; it++) {
    pts.sort((p, q) => p.f - q.f);
    const c = x0.map((_, j) => pts.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n);
    const worst = pts[n], mv = k => c.map((v, j) => v + k * (worst.x[j] - v));
    const r = { x: mv(-1) }; r.f = fn(r.x);
    if (r.f < pts[0].f) { const e = { x: mv(-2) }; e.f = fn(e.x); pts[n] = e.f < r.f ? e : r; }
    else if (r.f < pts[n - 1].f) pts[n] = r;
    else {
      const k = { x: mv(0.5) }; k.f = fn(k.x);
      if (k.f < worst.f) pts[n] = k;
      else { const best = pts[0].x; pts = pts.map((p, i) => { if (!i) return p; const x = p.x.map((v, j) => best[j] + 0.5 * (v - best[j])); return { x, f: fn(x) }; }); }
    }
    if (Math.abs(pts[n].f - pts[0].f) <= tol * (1 + Math.abs(pts[0].f))) break;
  }
  pts.sort((p, q) => p.f - q.f);
  return pts[0].x;
}

// Золотий перетин на відрізку для однієї змінної
export function golden(fn, lo, hi, tol = 1e-4) {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - g * (b - a), d = a + g * (b - a), fc = fn(c), fd = fn(d);
  while (b - a > tol) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = fn(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = fn(d); }
  }
  return (a + b) / 2;
}

// Найменші квадрати через розклад Холецького (з дуже малою регуляризацією від виродженості)
export function ols(X, y) {
  const n = X.length, p = X[0].length;
  const A = Array.from({ length: p }, () => new Float64Array(p)), b = new Float64Array(p);
  for (let i = 0; i < n; i++) {
    const r = X[i];
    for (let j = 0; j < p; j++) { b[j] += r[j] * y[i]; for (let k = 0; k <= j; k++) A[j][k] += r[j] * r[k]; }
  }
  for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) A[k][j] = A[j][k];
  const scale = Math.max(1e-12, ...A.map((r, j) => r[j]));
  for (let j = 0; j < p; j++) A[j][j] += 1e-10 * scale;
  const L = cholesky(A);
  const beta = cholSolve(L, b);
  const inv = Array.from({ length: p }, (_, j) => { const e = new Float64Array(p); e[j] = 1; return cholSolve(L, e); });
  const fitted = X.map(r => dot(r, beta));
  let sse = 0; for (let i = 0; i < n; i++) sse += (y[i] - fitted[i]) ** 2;
  const df = Math.max(1, n - p), s2 = sse / df;
  const se = Array.from(beta, (_, j) => Math.sqrt(Math.max(0, s2 * inv[j][j])));
  const lev = x0 => { let v = 0; for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) v += x0[j] * inv[j][k] * x0[k]; return v; };
  return { beta: Array.from(beta), se, s2, sse, df, fitted, inv, lev, n, p };
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function cholesky(A) {
  const p = A.length, L = Array.from({ length: p }, () => new Float64Array(p));
  for (let j = 0; j < p; j++) {
    let s = A[j][j];
    for (let k = 0; k < j; k++) s -= L[j][k] * L[j][k];
    L[j][j] = Math.sqrt(Math.max(s, 1e-300));
    for (let i = j + 1; i < p; i++) {
      let t = A[i][j];
      for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k];
      L[i][j] = t / L[j][j];
    }
  }
  return L;
}
function cholSolve(L, b) {
  const p = L.length, z = new Float64Array(p), x = new Float64Array(p);
  for (let i = 0; i < p; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * z[k]; z[i] = s / L[i][i]; }
  for (let i = p - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < p; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}

// Автокореляції до лагу K і часткові автокореляції (Дурбін-Левінсон)
export function acf(x, K) {
  const n = x.length, m = mean(x);
  let c0 = 0; for (const v of x) c0 += (v - m) ** 2;
  const r = [];
  for (let k = 1; k <= K; k++) {
    let c = 0; for (let t = k; t < n; t++) c += (x[t] - m) * (x[t - k] - m);
    r.push(c0 > 0 ? c / c0 : 0);
  }
  return r;
}
export function pacf(r) {
  const K = r.length, out = [];
  let phi = [];
  for (let k = 1; k <= K; k++) {
    let num = r[k - 1], den = 1;
    for (let j = 1; j < k; j++) { num -= phi[j - 1] * r[k - j - 1]; den -= phi[j - 1] * r[j - 1]; }
    const pkk = den !== 0 ? num / den : 0;
    const next = phi.map((v, j) => v - pkk * phi[k - j - 2]);
    next.push(pkk);
    phi = next;
    out.push(pkk);
  }
  return out;
}

// KPSS на стаціонарність рівня: статистика більша за 0,463 означає, що ряд варто диференціювати
export function kpss(x) {
  const n = x.length, m = mean(x), e = x.map(v => v - m);
  let S = 0, num = 0;
  for (const v of e) { S += v; num += S * S; }
  const L = Math.floor(4 * Math.pow(n / 100, 0.25));
  let lr = 0; for (const v of e) lr += v * v; lr /= n;
  for (let l = 1; l <= L; l++) {
    let g = 0; for (let t = l; t < n; t++) g += e[t] * e[t - l];
    lr += 2 * (1 - l / (L + 1)) * (g / n);
  }
  return lr > 0 ? num / (n * n * lr) : 0;
}

// Різниці: звичайна (lag 1) і сезонна (lag m)
export function diff(x, lag = 1) { const out = []; for (let t = lag; t < x.length; t++) out.push(x[t] - x[t - lag]); return out; }

// Класичний розклад: центроване ковзне середнє як тренд, сезонні індекси за позицією в сезоні
export function classicDecomp(y, m, mult) {
  const n = y.length, trend = nanArr(n), half = Math.floor(m / 2);
  for (let t = half; t < n - half; t++) {
    let s = 0;
    if (m % 2 === 0) { for (let k = -half; k <= half; k++) s += (Math.abs(k) === half ? 0.5 : 1) * y[t + k]; s /= m; }
    else { for (let k = -half; k <= half; k++) s += y[t + k]; s /= m; }
    trend[t] = s;
  }
  const buckets = Array.from({ length: m }, () => []);
  for (let t = 0; t < n; t++) if (Number.isFinite(trend[t]) && (!mult || trend[t] !== 0)) buckets[t % m].push(mult ? y[t] / trend[t] : y[t] - trend[t]);
  let idx = buckets.map(b => (b.length ? mean(b) : mult ? 1 : 0));
  const avg = mean(idx);
  idx = idx.map(v => (mult ? v / avg : v - avg));
  const season = y.map((_, t) => idx[t % m]);
  const remainder = y.map((v, t) => (Number.isFinite(trend[t]) ? (mult ? v / (trend[t] * season[t]) : v - trend[t] - season[t]) : NaN));
  return { trend, season, remainder, idx };
}

// Сила сезонності (Хайндман): 1 − Var(R) / Var(S + R), від 0 до 1
export function seasonalStrength(y, m) {
  if (!(m > 1) || y.length < 2 * m + 2) return 0;
  const { season, remainder } = classicDecomp(y, m, false);
  const R = [], SR = [];
  remainder.forEach((r, t) => { if (Number.isFinite(r)) { R.push(r); SR.push(r + season[t]); } });
  const vSR = variance(SR);
  return vSR > 0 ? Math.max(0, 1 - variance(R) / vSR) : 0;
}

// Смуги прогнозу з середнього і стандартного відхилення похибки
export const band = (mean_, sdv) => ({
  mean: mean_, sd: sdv,
  lo80: Number.isFinite(sdv) ? mean_ - Z80 * sdv : NaN, hi80: Number.isFinite(sdv) ? mean_ + Z80 * sdv : NaN,
  lo95: Number.isFinite(sdv) ? mean_ - Z95 * sdv : NaN, hi95: Number.isFinite(sdv) ? mean_ + Z95 * sdv : NaN,
});
