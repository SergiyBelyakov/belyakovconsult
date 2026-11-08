// Прогноз експоненційним згладжуванням у формі простору станів з адитивними похибками (Hyndman et al., 2008):
// ETS(A,Ad,N) і ETS(A,Ad,A) із загасаючим трендом. Параметри підбираються мінімізацією суми квадратів похибок
// на один крок (Нелдер-Мід), модель обирається за AICc. Інтервали прогнозу аналітичні:
//   Var(h) = σ² · (1 + Σ_{j=1}^{h-1} c_j²),  c_j = α + β·(φ + … + φ^j) + γ·[j кратне m]
// тобто коридор випливає з дисперсії помилок моделі, а не малюється довільно.

const sig = x => 1 / (1 + Math.exp(-x));

// параметри з необмежених змінних: 0 < α < 1, 0 < β < α, 0 < γ < 1 − α, 0,8 ≤ φ ≤ 0,98
function params(u, seasonal) {
  const a = 0.01 + 0.98 * sig(u[0]), b = a * 0.98 * sig(u[1]), g = seasonal ? (1 - a) * 0.98 * sig(u[2]) : 0, phi = 0.8 + 0.18 * sig(u[3]);
  return { a, b, g, phi };
}
function init(y, m) {
  // стан на момент перед першим спостереженням
  if (!m) { const k = Math.min(4, y.length - 1), b = (y[k] - y[0]) / k; return { l: y[0] - b, b, s: [] }; }
  const mean = (i0, i1) => y.slice(i0, i1).reduce((s, v) => s + v, 0) / (i1 - i0);
  const l = mean(0, m), b = (mean(m, 2 * m) - l) / m;
  const s = y.slice(0, m).map((v, i) => v - (l + b * (i - (m - 1) / 2)));
  const ms = s.reduce((x, v) => x + v, 0) / m;
  return { l: l - b * ((m - 1) / 2 + 1), b, s: s.map(v => v - ms) };
}
// прогін фільтра: похибки на один крок і кінцевий стан
function run(y, m, p, st0) {
  let l = st0.l, b = st0.b; const s = [...st0.s];
  const e = new Float64Array(y.length), fit = new Float64Array(y.length);
  for (let t = 0; t < y.length; t++) {
    const st = m ? s[t % m] : 0, f = l + p.phi * b + st;
    fit[t] = f; e[t] = y[t] - f;
    const lp = l;
    l = lp + p.phi * b + p.a * e[t];
    b = p.phi * b + p.b * e[t];
    if (m) s[t % m] = st + p.g * e[t];
  }
  return { e, fit, l, b, s, t0: y.length };
}
function nelderMead(fn, x0, iters = 400) {
  const n = x0.length;
  let pts = [x0, ...x0.map((_, i) => x0.map((v, j) => v + (i === j ? 0.8 : 0)))].map(x => ({ x, f: fn(x) }));
  for (let it = 0; it < iters; it++) {
    pts.sort((p, q) => p.f - q.f);
    const c = x0.map((_, j) => pts.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n);
    const worst = pts[n], mv = (k) => c.map((v, j) => v + k * (worst.x[j] - v));
    const r = { x: mv(-1) }; r.f = fn(r.x);
    if (r.f < pts[0].f) { const e = { x: mv(-2) }; e.f = fn(e.x); pts[n] = e.f < r.f ? e : r; }
    else if (r.f < pts[n - 1].f) pts[n] = r;
    else {
      const k = { x: mv(0.5) }; k.f = fn(k.x);
      if (k.f < worst.f) pts[n] = k;
      else { const best = pts[0].x; pts = pts.map((p, i) => { if (!i) return p; const x = p.x.map((v, j) => best[j] + 0.5 * (v - best[j])); return { x, f: fn(x) }; }); }
    }
    if (Math.abs(pts[n].f - pts[0].f) < 1e-10 * (1 + Math.abs(pts[0].f))) break;
  }
  pts.sort((p, q) => p.f - q.f);
  return pts[0].x;
}
export function fitEts(y, m) {
  const seasonal = m > 1, st0 = init(y, seasonal ? m : 0);
  const sse = u => { const r = run(y, seasonal ? m : 0, params(u, seasonal), st0); let s = 0; for (const v of r.e) s += v * v; return Number.isFinite(s) ? s : 1e300; };
  const u = nelderMead(sse, [0, -1, -1, 1]);
  const p = params(u, seasonal), r = run(y, seasonal ? m : 0, p, st0);
  const n = y.length, S = r.e.reduce((s, v) => s + v * v, 0);
  const k = (seasonal ? 3 : 2) + 1 + 2 + (seasonal ? m - 1 : 0);   // параметри згладжування, φ, початкові рівень і тренд, сезонні стани
  const aicc = n * Math.log(S / n) + 2 * k + (2 * k * (k + 1)) / Math.max(1, n - k - 1);
  const sigma2 = S / Math.max(1, n - k);
  return { m: seasonal ? m : 0, p, state: r, aicc, sigma2, fitted: Array.from(r.fit) };
}
// прогноз на h кроків з дисперсією похибки для кожного кроку
export function forecast(model, h) {
  const { p, state, m, sigma2 } = model, out = [];
  let phiH = 0, acc = 0;
  for (let k = 1; k <= h; k++) {
    phiH += p.phi ** k;
    const st = m ? state.s[(state.t0 + k - 1) % m] : 0;
    const mean = state.l + phiH * state.b + st;
    const v = sigma2 * (1 + acc);
    out.push({ mean, sd: Math.sqrt(v) });
    // c_k для наступного кроку
    let phiK = 0; for (let i = 1; i <= k; i++) phiK += p.phi ** i;
    const c = p.a + p.b * phiK + (m && k % m === 0 ? p.g : 0);
    acc += c * c;
  }
  return out;
}
export const Z80 = 1.2816, Z95 = 1.96;

// Автоматичний вибір: сезонна модель, якщо даних щонайменше на два повні сезони і AICc менший
export function chooseModel(y, m, want = 'auto') {
  const canSeason = m > 1 && y.length >= 2 * m + 4;
  const trend = fitEts(y, 0);
  if (want === 'trend' || !canSeason) return { model: trend, noSeason: want === 'season' && !canSeason };
  const season = fitEts(y, m);
  if (want === 'season') return { model: season };
  return { model: season.aicc < trend.aicc ? season : trend };
}
