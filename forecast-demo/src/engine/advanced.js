// Розширені моделі: Prophet (тренд із точками зламу, сезонності Фур’є, свята й події), TBATS (кілька сезонних
// циклів у просторі станів), SARIMAX (ARIMA з факторами) і градієнтний бустинг на лагах з поясненням SHAP.
// Усе рахується в браузері без сторонніх бібліотек. Контекст моделі як у models.js, плюс:
//   ctx.dates / ctx.fdates  дати історії й горизонту, ctx.freq частота,
//   ctx.periods сезонні періоди в кроках ряду (наприклад [7, 365.25] для щоденних даних),
//   ctx.events  події з відомими датами: [{ id, dates: ['2025-02-14', …], win: [-1, 0] }].
import { mean, sum, sd, rms, quantile, nanArr, clamp, sig, logit, nelderMead, ols, band, rng, diff, Z80 } from './util.js';
import { arimaFitOrder, arimaForecast, arimaAuto, arimaBest } from './arima.js';

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// Сезонні періоди, для яких вистачає історії (щонайменше два повні цикли)
export function usablePeriods(ctx, n) {
  const P = ctx.periods && ctx.periods.length ? ctx.periods : ctx.m > 1 ? [ctx.m] : [];
  return P.filter(q => q > 1 && n >= 2 * q + 2);
}

// Розв’язок (A + diag(d)) x = b для симетричної додатно визначеної матриці
function solveSPD(A, d, b) {
  const p = b.length, L = Array.from({ length: p }, () => new Float64Array(p));
  for (let j = 0; j < p; j++) {
    let s = A[j][j] + d[j];
    for (let k = 0; k < j; k++) s -= L[j][k] * L[j][k];
    L[j][j] = Math.sqrt(Math.max(s, 1e-12));
    for (let i = j + 1; i < p; i++) {
      let t = A[i][j];
      for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k];
      L[i][j] = t / L[j][j];
    }
  }
  const z = new Float64Array(p), x = new Float64Array(p);
  for (let i = 0; i < p; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * z[k]; z[i] = s / L[i][i]; }
  for (let i = p - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < p; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}

// Індекс періоду для дати події: останній період, що починається не пізніше за дату
function eventIndexer(allDates) {
  const ms = allDates.map(d => Date.parse(d + 'T00:00:00Z')), N = ms.length;
  const step = N > 1 ? (ms[N - 1] - ms[0]) / (N - 1) : 864e5;
  return iso => {
    const x = Date.parse(iso + 'T00:00:00Z');
    if (!(x >= ms[0]) || x >= ms[N - 1] + step) return -1;
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ms[mid] <= x) lo = mid; else hi = mid - 1; }
    return lo;
  };
}

// ——— Prophet: y = тренд з точками зламу + сезонності Фур’є + свята + фактори ———
// Оцінка MAP як у Prophet: ряд ділиться на max|y|, час на довжину історії, зміни нахилу мають апріорний розподіл
// Лапласа з масштабом τ (L1), сезонність, свята й фактори нормальний N(0, 10). L1 розв’язується ітеративно
// зваженими гребеневими регресіями (локальна квадратична апроксимація).
const fourierK = P => (P <= 7.5 ? Math.floor(P / 2) : P <= 13 ? Math.min(5, Math.floor(P / 2)) : 10);

export function prophet(y, ctx) {
  const { h, p = {}, X, Xf, names = [] } = ctx;
  const n = y.length, N = n + h, tau = Number(p.cps ?? 0.05);
  const scale = Math.max(...y.map(Math.abs)) || 1, Y = y.map(v => v / scale);
  const cols = [];
  const tt = new Float64Array(N);
  for (let t = 0; t < N; t++) tt[t] = t / Math.max(1, n - 1);
  cols.push({ kind: 'm', v: new Float64Array(N).fill(1) }, { kind: 'k', v: tt });
  // кандидати в точки зламу: рівномірно на перших 80% історії
  const hist = Math.floor(0.8 * n), nCp = Math.min(25, Math.max(0, hist - 2)), cpIdx = [];
  for (let j = 1; j <= nCp; j++) cpIdx.push(Math.round((j * (hist - 1)) / nCp));
  cpIdx.forEach(c => { const v = new Float64Array(N); for (let t = c + 1; t < N; t++) v[t] = tt[t] - tt[c]; cols.push({ kind: 'cp', v, at: c }); });
  // сезонності
  const periods = usablePeriods(ctx, n);
  periods.forEach((P, si) => {
    for (let k = 1; k <= fourierK(P); k++) {
      const c = new Float64Array(N), s = new Float64Array(N);
      for (let t = 0; t < N; t++) { const a = (2 * Math.PI * k * t) / P; c[t] = Math.cos(a); s[t] = Math.sin(a); }
      [c, s].forEach(v => { if (sd(Array.from(v.subarray(0, n))) > 1e-6) cols.push({ kind: 'season', v, si }); });
    }
  });
  // свята й події: окрема колонка для кожного дня вікна навколо дати
  const evList = [];
  if (ctx.events && ctx.events.length && p.events !== false && ctx.dates) {
    const idxOf = eventIndexer([...ctx.dates, ...(ctx.fdates || [])].slice(0, N));
    ctx.events.forEach(ev => {
      const at = ev.dates.map(idxOf).filter(i => i >= 0), [lo, hi] = ev.win || [0, 0], offs = [];
      for (let o = lo; o <= hi; o++) {
        const v = new Float64Array(N);
        at.forEach(i => { if (i + o >= 0 && i + o < N) v[i + o] = 1; });
        let cnt = 0; for (let t = 0; t < n; t++) cnt += v[t];
        if (cnt > 0) { cols.push({ kind: 'event', v, ev: ev.id, o }); offs.push(o); }
      }
      if (offs.length) evList.push({ id: ev.id, at });
    });
  }
  // фактори, стандартизовані як add_regressor у Prophet
  const regs = [];
  if (X && Xf && Xf.length >= h && names.length) {
    names.forEach((id, j) => {
      const xs = X.map(r => r[j]), mu = mean(xs), s = sd(xs) || 1, v = new Float64Array(N);
      for (let t = 0; t < N; t++) v[t] = ((t < n ? X[t][j] : Xf[t - n][j]) - mu) / s;
      cols.push({ kind: 'reg', v, id, s });
      regs.push(id);
    });
  }

  const P = cols.length, A = Array.from({ length: P }, () => new Float64Array(P)), b = new Float64Array(P);
  for (let i = 0; i < P; i++) {
    const vi = cols[i].v;
    let s = 0; for (let t = 0; t < n; t++) s += vi[t] * Y[t];
    b[i] = s;
    for (let j = 0; j <= i; j++) { const vj = cols[j].v; let q = 0; for (let t = 0; t < n; t++) q += vi[t] * vj[t]; A[i][j] = q; A[j][i] = q; }
  }
  let yy = 0; for (let t = 0; t < n; t++) yy += Y[t] * Y[t];
  const sseOf = beta => { let s = yy - 2 * dot(beta, b); for (let i = 0; i < P; i++) { let r = 0; for (let j = 0; j < P; j++) r += A[i][j] * beta[j]; s += beta[i] * r; } return Math.max(s, 1e-12); };
  // старт: без зламів тренду, щоб оцінити шум
  let beta = solveSPD(A, cols.map(c => (c.kind === 'cp' ? 1e6 : 1e-6)), b);
  let s2 = sseOf(beta) / n;
  for (let it = 0; it < 60; it++) {
    const d = cols.map((c, j) => (c.kind === 'cp' ? s2 / tau / Math.max(Math.abs(beta[j]), 1e-7) : c.kind === 'm' || c.kind === 'k' ? s2 / 25 : s2 / 100));
    const nb = solveSPD(A, d, b);
    let ch = 0; for (let j = 0; j < P; j++) ch = Math.max(ch, Math.abs(nb[j] - beta[j]));
    beta = nb; s2 = sseOf(beta) / n;
    if (ch < 1e-7) break;
  }

  const part = pred => { const out = new Float64Array(N); cols.forEach((c, j) => { if (pred(c)) for (let t = 0; t < N; t++) out[t] += beta[j] * c.v[t] * scale; }); return out; };
  const trend = part(c => c.kind === 'm' || c.kind === 'k' || c.kind === 'cp');
  const seasons = periods.map((Pd, si) => ({ P: Pd, v: part(c => c.kind === 'season' && c.si === si) }));
  const evPart = part(c => c.kind === 'event'), regPart = part(c => c.kind === 'reg');
  const yhat = new Float64Array(N);
  for (let t = 0; t < N; t++) yhat[t] = trend[t] + evPart[t] + regPart[t] + seasons.reduce((s, q) => s + q.v[t], 0);
  const fitted = Array.from(yhat.subarray(0, n));

  // невизначеність тренду: нові зломи в майбутньому з тією ж частотою і середнім розміром, плюс шум
  const deltas = cols.map((c, j) => (c.kind === 'cp' ? beta[j] : null)).filter(v => v != null);
  const lam = mean(deltas.map(Math.abs)) + 1e-8, sigma = Math.sqrt(s2), Tend = tt[N - 1];
  const R = rng((ctx.seed || 7) + 101), NS = 300, sims = Array.from({ length: h }, () => new Float64Array(NS));
  for (let s = 0; s < NS; s++) {
    const nc = Tend > 1 ? R.poisson(nCp * (Tend - 1)) : 0, ts = [], ds = [];
    for (let c = 0; c < nc; c++) { ts.push(1 + R() * (Tend - 1)); const u = R() - 0.5; ds.push(-lam * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))); }
    for (let k = 0; k < h; k++) {
      const t = n + k; let extra = 0;
      for (let c = 0; c < nc; c++) if (tt[t] > ts[c]) extra += ds[c] * (tt[t] - ts[c]);
      sims[k][s] = yhat[t] + (extra + sigma * R.normal()) * scale;
    }
  }
  const fc = sims.map((v, k) => {
    const sv = v.slice().sort();
    return { mean: yhat[n + k], sd: sd(Array.from(v)), lo80: quantile(sv, 0.1), hi80: quantile(sv, 0.9), lo95: quantile(sv, 0.025), hi95: quantile(sv, 0.975) };
  });

  const cps = cols.map((c, j) => (c.kind === 'cp' ? { i: c.at, d: (beta[j] * scale) / Math.max(1, n - 1) } : null)).filter(Boolean);
  const maxD = Math.max(...cps.map(c => Math.abs(c.d)), 0);
  const events = evList.map(ev => {
    const eff = cols.map((c, j) => (c.kind === 'event' && c.ev === ev.id ? { o: c.o, b: beta[j] * scale } : null)).filter(Boolean);
    return { id: ev.id, eff, total: sum(eff.map(x => x.b)), at: ev.at };
  });
  const regCoef = cols.map((c, j) => (c.kind === 'reg' ? { id: c.id, b: (beta[j] * scale) / c.s } : null)).filter(Boolean);
  return {
    fitted, fc,
    used: { cps: tau, events: evList.length > 0, changepoints: cps.filter(c => Math.abs(c.d) > 0.1 * maxD).length },
    explain: {
      kind: 'prophet', trend: Array.from(trend), seasons: seasons.map(q => ({ P: q.P, v: Array.from(q.v) })), events, regs: regCoef,
      evPart: Array.from(evPart), cps, big: cps.filter(c => maxD > 0 && Math.abs(c.d) > 0.1 * maxD).map(c => c.i), tau, sigma: sigma * scale,
    },
  };
}

// ——— TBATS: Box-Cox, загасаючий тренд і тригонометрична сезонність для кожного періоду ———
// Спрощена версія De Livera, Hyndman, Snyder (2011): без ARMA-помилок; кількість гармонік фіксована,
// початкові стани з регресії на перші цикли, параметри згладжування за мінімумом суми квадратів похибок.
const harmonics = P => (P <= 12 ? Math.max(1, Math.floor((P - 1) / 2)) : 5);
const bcF = (v, lam) => (lam === 0 ? Math.log(v) : (Math.pow(v, lam) - 1) / lam);
const bcInv = (w, lam) => (lam === 0 ? Math.exp(w) : Math.pow(Math.max(lam * w + 1, 0), 1 / lam));

function tbatsSetup(w, periods, trend) {
  const n = w.length, maxP = Math.max(...periods);
  const n0 = Math.min(n, Math.max(Math.ceil(2 * maxP), 20));
  const blocks = periods.map(P => { const K = harmonics(P); return { P, K, c: Array.from({ length: K }, (_, j) => Math.cos((2 * Math.PI * (j + 1)) / P)), s: Array.from({ length: K }, (_, j) => Math.sin((2 * Math.PI * (j + 1)) / P)) }; });
  const rows = [];
  for (let t = 0; t < n0; t++) {
    const r = [1]; if (trend) r.push(t);
    blocks.forEach(bk => { for (let j = 1; j <= bk.K; j++) { const a = (2 * Math.PI * j * t) / bk.P; r.push(Math.cos(a), Math.sin(a)); } });
    rows.push(r);
  }
  const o = ols(rows, w.slice(0, n0));
  let k = trend ? 2 : 1;
  const s0 = blocks.map(bk => { const v = new Float64Array(2 * bk.K); for (let j = 0; j < bk.K; j++) { v[2 * j] = o.beta[k++]; v[2 * j + 1] = o.beta[k++]; } return v; });
  return { blocks, l0: o.beta[0], b0: trend ? o.beta[1] : 0, s0 };
}

function tbatsRun(w, st, q, h = 0, keep = false) {
  const n = w.length, { blocks } = st;
  let l = st.l0, b = st.b0, sse = 0;
  const S = st.s0.map(v => Float64Array.from(v));
  const lev = keep ? new Float64Array(n + h) : null, comp = keep ? blocks.map(() => new Float64Array(n + h)) : null, fitted = keep ? new Float64Array(n) : null;
  const scale = Math.max(1, ...w.map(Math.abs)) * 1e3;
  for (let t = 0; t < n + h; t++) {
    let seas = 0;
    for (let i = 0; i < blocks.length; i++) { let c = 0; for (let j = 0; j < blocks[i].K; j++) c += S[i][2 * j]; seas += c; if (keep) comp[i][t] = c; }
    const base = l + q.phi * b, f = base + seas;
    if (keep) lev[t] = base;
    const d = t < n ? w[t] - f : 0;
    if (t < n) { sse += d * d; if (keep) fitted[t] = f; }
    l = base + q.a * d; b = q.phi * b + q.b * d;
    for (let i = 0; i < blocks.length; i++) {
      const bk = blocks[i], v = S[i], g1 = q.g1[i] * d, g2 = q.g2[i] * d;
      for (let j = 0; j < bk.K; j++) { const s = v[2 * j], ss = v[2 * j + 1]; v[2 * j] = s * bk.c[j] + ss * bk.s[j] + g1; v[2 * j + 1] = -s * bk.s[j] + ss * bk.c[j] + g2; }
    }
    if (!(Math.abs(l) < scale) || !Number.isFinite(sse)) return { sse: 1e300 };
  }
  return { sse, lev, comp, fitted };
}

// Імпульсна характеристика c_j = w' F^{j−1} g для дисперсії прогнозу на j кроків
function tbatsPsi(st, q, h) {
  const { blocks } = st;
  let l = q.a, b = q.b;
  const S = blocks.map((bk, i) => { const v = new Float64Array(2 * bk.K); for (let j = 0; j < bk.K; j++) { v[2 * j] = q.g1[i]; v[2 * j + 1] = q.g2[i]; } return v; });
  const c = [];
  for (let j = 1; j < h; j++) {
    let seas = 0; blocks.forEach((bk, i) => { for (let k = 0; k < bk.K; k++) seas += S[i][2 * k]; });
    c.push(l + q.phi * b + seas);
    l = l + q.phi * b; b = q.phi * b;
    blocks.forEach((bk, i) => { const v = S[i]; for (let k = 0; k < bk.K; k++) { const s = v[2 * k], ss = v[2 * k + 1]; v[2 * k] = s * bk.c[k] + ss * bk.s[k]; v[2 * k + 1] = -s * bk.s[k] + ss * bk.c[k]; } });
  }
  return c;
}

function tbatsFit(w, periods, trend) {
  const st = tbatsSetup(w, periods, trend), np = periods.length;
  const gmax = periods.map(P => (P <= 12 ? 0.1 : 0.02));
  const unpack = u => {
    const a = 0.001 + 0.998 * sig(u[0]);
    let k = 1;
    const b = trend ? a * 0.3 * sig(u[k++]) : 0, phi = trend ? 0.8 + 0.18 * sig(u[k++]) : 1;
    const g1 = [], g2 = [];
    for (let i = 0; i < np; i++) { g1.push(gmax[i] * Math.tanh(u[k++])); g2.push(gmax[i] * Math.tanh(u[k++])); }
    return { a, b, phi, g1, g2 };
  };
  const u0 = [logit((0.1 - 0.001) / 0.998), ...(trend ? [0, 1] : []), ...new Array(2 * np).fill(0)];
  const best = nelderMead(u => tbatsRun(w, st, unpack(u)).sse, u0, { iters: 160 * u0.length });
  const q = unpack(best), r = tbatsRun(w, st, q);
  const kPar = u0.length + 1 + (trend ? 1 : 0) + st.s0.reduce((s, v) => s + v.length, 0);
  return { st, q, sse: r.sse, k: kPar, trend };
}

export function tbats(y, ctx) {
  const { h, p = {} } = ctx;
  const n = y.length, periods = usablePeriods(ctx, n);
  const pos = y.every(v => v > 0);
  const lams = p.bc === 'none' || !pos ? [1] : p.bc === 'log' ? [0] : [1, 0];
  const trends = p.tbTrend === 'none' ? [false] : p.tbTrend === 'damped' ? [true] : [false, true];
  const sumLog = pos ? sum(y.map(Math.log)) : 0;
  const tried = [];
  let best = null;
  for (const lam of lams) {
    const w = lam === 1 ? y.slice() : y.map(v => bcF(v, lam));
    for (const tr of trends) {
      const f = tbatsFit(w, periods, tr);
      const aic = n * Math.log(f.sse / n) - 2 * (lam - 1) * sumLog + 2 * f.k;
      tried.push({ lam, trend: tr, aic });
      if (!best || aic < best.aic) best = { ...f, lam, w, aic };
    }
  }
  const { st, q, lam, w } = best;
  const r = tbatsRun(w, st, q, h, true), s2 = best.sse / Math.max(1, n - best.k);
  const psi = tbatsPsi(st, q, h);
  const back = v => (lam === 1 ? v : bcInv(v, lam));
  const fitted = Array.from(r.fitted, back);
  let acc = 0;
  const fc = Array.from({ length: h }, (_, k) => {
    if (k > 0) acc += psi[k - 1] ** 2;
    const mu = r.lev[n + k] + r.comp.reduce((s, c) => s + c[n + k], 0), sdv = Math.sqrt(s2 * (1 + acc));
    const lo80 = back(mu - Z80 * sdv), hi80 = back(mu + Z80 * sdv), lo95 = back(mu - 1.96 * sdv), hi95 = back(mu + 1.96 * sdv);
    return { mean: back(mu), sd: (hi80 - lo80) / (2 * Z80), lo80, hi80, lo95, hi95 };
  });
  return {
    fitted, fc,
    used: { lambda: lam, trend: q.phi < 1 ? 'damped' : 'none', alpha: q.a, beta: q.b, phi: q.phi, harmonics: st.blocks.map(bk => bk.K) },
    explain: {
      kind: 'tbats', lam, damped: best.trend, phi: q.phi, alpha: q.a, beta: q.b,
      level: Array.from(r.lev), comps: st.blocks.map((bk, i) => ({ P: bk.P, K: bk.K, g1: q.g1[i], g2: q.g2[i], v: Array.from(r.comp[i]) })),
      tried: tried.sort((a, b) => a.aic - b.aic),
    },
  };
}

// ——— SARIMAX: регресія на фактори з помилками ARIMA ———
// Порядки різниць за залишками регресії, β за різницевими даними, далі ARIMA для η = y − Xβ і кілька
// ітерацій узагальнених найменших квадратів (Кокрейн-Оркатт): ряд і фактори «вибілюються» фільтром ARMA.
function armaWhiten(w, phi, th, skip) {
  const n = w.length, e = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    let v = w[t];
    for (let i = 0; i < phi.length; i++) v -= phi[i] * (t - 1 - i >= 0 ? w[t - 1 - i] : 0);
    for (let j = 0; j < th.length; j++) v -= th[j] * (t - 1 - j >= 0 ? e[t - 1 - j] : 0);
    e[t] = v;
  }
  return Array.from(e).slice(skip);
}

export function sarimax(y, ctx) {
  const { h, m, p = {} } = ctx;
  const n = y.length, isAuto = p.auto !== false;
  const o0 = ols(ctx.X.map((r, t) => [1, t, ...r]), y), u0 = y.map((v, t) => v - o0.fitted[t]);
  const dD = isAuto ? arimaAuto(u0, m) : { d: clamp(p.d ?? 1, 0, 2), D: m > 1 ? clamp(p.D ?? 0, 0, 1) : 0 };
  // без різниць тренд іде в рівняння окремою змінною часу (як drift в auto.arima); з різницею його бере константа
  const withT = dD.d + dD.D === 0;
  const X = withT ? ctx.X.map((r, t) => [t, ...r]) : ctx.X, Xf = withT ? ctx.Xf.map((r, k) => [n + k, ...r]) : ctx.Xf;
  const names = withT ? ['trend', ...ctx.names] : ctx.names;
  const dif = a => { let w = a.slice(); for (let i = 0; i < dD.D; i++) w = diff(w, m); for (let i = 0; i < dD.d; i++) w = diff(w, 1); return w; };
  const yd = dif(y), Xd = names.map((_, j) => dif(X.map(r => r[j]))), useConst = dD.d + dD.D <= 1, nd = yd.length;
  const rowsOf = (cols, cst, len) => Array.from({ length: len }, (_, t) => [...(useConst ? [cst[t]] : []), ...cols.map(c => c[t])]);
  let o = ols(rowsOf(Xd, new Array(nd).fill(1), nd), yd);
  let beta = o.beta.slice(useConst ? 1 : 0), se = o.se.slice(useConst ? 1 : 0), fit = null;
  for (let it = 0; it < 3; it++) {
    const eta = y.map((v, t) => v - dot(X[t], beta));
    fit = isAuto ? arimaBest(eta, m, dD) : arimaFitOrder(eta, m, clamp(p.p ?? 1, 0, 3), dD.d, clamp(p.q ?? 1, 0, 3), dD.D) || arimaFitOrder(eta, m, 0, dD.d, 0, dD.D);
    if (!fit || (!fit.phi.length && !fit.th.length)) break;
    const skip = Math.max(fit.phi.length, fit.th.length);
    const wy = armaWhiten(yd, fit.phi, fit.th, skip), wX = Xd.map(c => armaWhiten(c, fit.phi, fit.th, skip)), wc = armaWhiten(new Array(nd).fill(1), fit.phi, fit.th, skip);
    o = ols(rowsOf(wX, wc, wy.length), wy);
    beta = o.beta.slice(useConst ? 1 : 0); se = o.se.slice(useConst ? 1 : 0);
  }
  // остаточна ARIMA на η з фінальними β (той самий порядок, параметри переоцінено)
  const eta = y.map((v, t) => v - dot(X[t], beta));
  fit = (fit && arimaFitOrder(eta, m, fit.P, fit.d, fit.Q, fit.D)) || arimaBest(eta, m, dD);
  const fe = arimaForecast(eta, fit, h);
  const xb = Xf.slice(0, h).map(r => dot(r, beta));
  const fitted = fe.fitted.map((v, t) => v + dot(X[t], beta));
  const fc = fe.fc.map((f, i) => band(f.mean + xb[i], f.sd));
  // для порівняння: сезонна ARIMA без факторів
  const plain = arimaBest(y, m), pf = arimaForecast(y, plain, h);
  return {
    fitted, fc,
    used: { auto: isAuto, p: fit.P, d: fit.d, q: fit.Q, D: fit.D, beta },
    explain: {
      kind: 'sarimax', coef: names.map((id, j) => ({ id, b: beta[j], se: se[j] })), xb, eta: fe.fc.map(f => f.mean),
      order: { p: fit.P, d: fit.d, q: fit.Q, D: fit.D, m: fit.D ? m : 0 }, plain: pf.fc.map(f => f.mean),
      plainOrder: { p: plain.P, d: plain.d, q: plain.Q, D: plain.D, m: plain.D ? m : 0 },
    },
  };
}

// ——— Градієнтний бустинг дерев на лагах, сезоні й факторах; пояснення внеском ознак (SHAP) ———
// Дерева глибини 2–5 на квадратичній втраті, кожне вчиться на випадкових 80% рядків. Точки розбиття шукаються
// за попередньо відсортованими ознаками. Тренд знімається прямою заздалегідь, бо дерева не продовжують тренд.
function growTree(F, order, g, nodeOf, depth, minLeaf) {
  const N = g.length, nf = F.length, maxNodes = 2 ** (depth + 1);
  const feat = new Int32Array(maxNodes).fill(-1), thr = new Float64Array(maxNodes), left = new Int32Array(maxNodes).fill(-1), right = new Int32Array(maxNodes).fill(-1);
  const sumG = new Float64Array(maxNodes), cnt = new Float64Array(maxNodes);
  for (let i = 0; i < N; i++) if (nodeOf[i] === 0) { sumG[0] += g[i]; cnt[0]++; }
  let nNodes = 1, frontier = [0];
  for (let d = 0; d < depth && frontier.length; d++) {
    const isF = new Uint8Array(maxNodes); frontier.forEach(x => { isF[x] = 1; });
    const bestGain = new Float64Array(maxNodes), bestF = new Int32Array(maxNodes).fill(-1), bestT = new Float64Array(maxNodes);
    const sL = new Float64Array(maxNodes), nL = new Float64Array(maxNodes), prev = new Float64Array(maxNodes);
    for (let f = 0; f < nf; f++) {
      const col = F[f], ord = order[f];
      frontier.forEach(x => { sL[x] = 0; nL[x] = 0; prev[x] = NaN; });
      for (let q = 0; q < N; q++) {
        const i = ord[q], x = nodeOf[i];
        if (x < 0 || !isF[x]) continue;
        const v = col[i];
        if (nL[x] >= minLeaf && cnt[x] - nL[x] >= minLeaf && v > prev[x]) {
          const sR = sumG[x] - sL[x], nR = cnt[x] - nL[x];
          const gain = (sL[x] * sL[x]) / nL[x] + (sR * sR) / nR - (sumG[x] * sumG[x]) / cnt[x];
          if (gain > bestGain[x] + 1e-12) { bestGain[x] = gain; bestF[x] = f; bestT[x] = (prev[x] + v) / 2; }
        }
        sL[x] += g[i]; nL[x]++; prev[x] = v;
      }
    }
    const next = [];
    for (const x of frontier) {
      if (bestF[x] < 0) continue;
      feat[x] = bestF[x]; thr[x] = bestT[x]; left[x] = nNodes++; right[x] = nNodes++;
      next.push(left[x], right[x]);
    }
    if (!next.length) break;
    for (let i = 0; i < N; i++) {
      const x = nodeOf[i];
      if (x >= 0 && isF[x] && feat[x] >= 0) { const c = F[feat[x]][i] <= thr[x] ? left[x] : right[x]; nodeOf[i] = c; sumG[c] += g[i]; cnt[c]++; }
    }
    frontier = next;
  }
  const val = new Float64Array(nNodes);
  for (let x = 0; x < nNodes; x++) val[x] = cnt[x] > 0 ? sumG[x] / cnt[x] : 0;
  return { feat: feat.slice(0, nNodes), thr: thr.slice(0, nNodes), left: left.slice(0, nNodes), right: right.slice(0, nNodes), val, cover: cnt.slice(0, nNodes) };
}
const treeVal = (tr, x) => { let k = 0; while (tr.feat[k] >= 0) k = x[tr.feat[k]] <= tr.thr[k] ? tr.left[k] : tr.right[k]; return tr.val[k]; };

export function gbmFit(F, target, o) {
  const N = target.length, nf = F.length;
  const order = F.map(col => Int32Array.from({ length: N }, (_, i) => i).sort((a, b) => col[a] - col[b]));
  const init = mean(Array.from(target)), pred = new Float64Array(N).fill(init), g = new Float64Array(N), nodeOf = new Int32Array(N);
  const R = rng(o.seed || 7), trees = [], row = new Float64Array(nf);
  for (let m = 0; m < o.trees; m++) {
    for (let i = 0; i < N; i++) { g[i] = target[i] - pred[i]; nodeOf[i] = R() < (o.sub ?? 0.8) ? 0 : -1; }
    const tr = growTree(F, order, g, nodeOf, o.depth, o.minLeaf ?? 5);
    for (let x = 0; x < tr.val.length; x++) tr.val[x] *= o.lr;
    for (let i = 0; i < N; i++) { for (let f = 0; f < nf; f++) row[f] = F[f][i]; pred[i] += treeVal(tr, row); }
    trees.push(tr);
  }
  return { init, trees, predict: x => { let s = init; for (const tr of trees) s += treeVal(tr, x); return s; } };
}

// Точні значення Шеплі для дерева (умовні очікування за шляхом, як у TreeSHAP): перебір підмножин ознак дерева
export function treeShap(model, x, nf) {
  const phi = new Float64Array(nf);
  let base = model.init;
  for (const tr of model.trees) {
    const used = [...new Set(Array.from(tr.feat).filter(f => f >= 0))], M = used.length;
    const ev = (k, mask) => {
      const f = tr.feat[k];
      if (f < 0) return tr.val[k];
      if (mask & (1 << used.indexOf(f))) return ev(x[f] <= tr.thr[k] ? tr.left[k] : tr.right[k], mask);
      const L = tr.left[k], Rr = tr.right[k];
      return (tr.cover[L] * ev(L, mask) + tr.cover[Rr] * ev(Rr, mask)) / (tr.cover[L] + tr.cover[Rr]);
    };
    const E = new Float64Array(1 << M);
    for (let mask = 0; mask < 1 << M; mask++) E[mask] = ev(0, mask);
    base += E[0];
    if (!M) continue;
    const fact = [1]; for (let i = 1; i <= M; i++) fact[i] = fact[i - 1] * i;
    for (let i = 0; i < M; i++) {
      let s = 0;
      for (let mask = 0; mask < 1 << M; mask++) {
        if (mask & (1 << i)) continue;
        let sz = 0; for (let b = mask; b; b &= b - 1) sz++;
        s += ((fact[sz] * fact[M - sz - 1]) / fact[M]) * (E[mask | (1 << i)] - E[mask]);
      }
      phi[used[i]] += s;
    }
  }
  return { base, phi };
}

export function boost(y, ctx) {
  const { h, m, p = {}, X, Xf, names = [] } = ctx;
  const n = y.length, nTrees = clamp(Math.round(p.trees ?? 200), 10, 600), depth = clamp(Math.round(p.depth ?? 3), 1, 5), lr = clamp(p.lr ?? 0.08, 0.005, 1);
  const detrend = p.detrend !== false;
  let a0 = 0, b0 = 0;
  if (detrend) { const o = ols(y.map((_, t) => [1, t]), y); [a0, b0] = o.beta; }
  const trendAt = t => a0 + b0 * t;
  const hasX = !!(X && Xf && names.length && Xf.length >= h);
  const feats = [{ id: 'lag1', lag: 1 }, { id: 'lag2', lag: 2 }];
  if (m > 1 && m <= 12) feats.push({ id: 'lagm', lag: m });
  if (m > 1) feats.push({ id: 'pos' });
  if (hasX) names.forEach((id, j) => feats.push({ id, x: j }));
  const nf = feats.length, maxLag = Math.max(...feats.map(f => f.lag || 0));
  const fill = (t, r, out) => {
    feats.forEach((f, j) => { out[j] = f.lag ? r[t - f.lag] : f.id === 'pos' ? t % m : t < n ? X[t][f.x] : Xf[t - n][f.x]; });
    return out;
  };
  const r = new Float64Array(n + h);
  for (let t = 0; t < n; t++) r[t] = y[t] - trendAt(t);
  const rows = [];
  for (let t = maxLag; t < n; t++) rows.push(t);
  const design = idx => { const F = feats.map(() => new Float64Array(idx.length)), tmp = new Float64Array(nf); idx.forEach((t, i) => { fill(t, r, tmp); for (let j = 0; j < nf; j++) F[j][i] = tmp[j]; }); return F; };
  const opts = { trees: nTrees, depth, lr, minLeaf: Math.max(3, Math.min(8, Math.floor(rows.length / 30))), sub: 0.8, seed: (ctx.seed || 7) + 17 };
  // залишки для коридору: модель на перших 80% рядків прогнозує решту на крок уперед
  const cut = Math.floor(rows.length * 0.8), tr80 = rows.slice(0, cut), va = rows.slice(cut);
  const m80 = gbmFit(design(tr80), Float64Array.from(tr80, t => r[t]), opts);
  const tmp = new Float64Array(nf);
  const pool = va.map(t => r[t] - m80.predict(fill(t, r, tmp)));
  const model = gbmFit(design(rows), Float64Array.from(rows, t => r[t]), opts);
  const fitted = nanArr(n);
  rows.forEach(t => { fitted[t] = trendAt(t) + model.predict(fill(t, r, tmp)); });
  // рекурсивний прогноз: прогнозовані значення стають лагами наступних кроків
  const xs = [];
  for (let k = 0; k < h; k++) { const t = n + k, x = Float64Array.from(fill(t, r, tmp)); xs.push(x); r[t] = model.predict(x); }
  const R = rng((ctx.seed || 7) + 29), NS = h > 30 ? 100 : 200, sims = Array.from({ length: h }, () => new Float64Array(NS)), rs = new Float64Array(n + h);
  for (let s = 0; s < NS; s++) {
    rs.set(r.subarray(0, n));
    for (let k = 0; k < h; k++) { const t = n + k; rs[t] = model.predict(fill(t, rs, tmp)) + (pool.length ? pool[R.int(pool.length)] : 0); sims[k][s] = trendAt(t) + rs[t]; }
  }
  // коридор з розкиду траєкторій навколо їхньої медіани, перенесений на основний (детермінований) прогноз
  const fc = sims.map((v, k) => {
    const sv = v.slice().sort(), mu = trendAt(n + k) + r[n + k], md = quantile(sv, 0.5);
    return { mean: mu, sd: sd(Array.from(v)), lo80: mu + quantile(sv, 0.1) - md, hi80: mu + quantile(sv, 0.9) - md, lo95: mu + quantile(sv, 0.025) - md, hi95: mu + quantile(sv, 0.975) - md };
  });
  const used = { trees: nTrees, depth, lr, detrend, features: feats.map(f => f.id) };
  // при перевірці на відкладених даних пояснення не потрібне: SHAP рахується лише для показу
  if (ctx.part === 'train') return { fitted, fc, used, explain: { kind: 'shap', lazy: true } };
  // SHAP: внесок кожної ознаки в прогноз кожного кроку і середній |внесок| на історії
  const meanTrend = detrend ? mean(rows.map(trendAt)) : 0;
  let base = meanTrend + model.init;
  const steps = xs.map((x, k) => { const s = treeShap(model, x, nf); base = meanTrend + s.base; return { t: n + k, trendC: trendAt(n + k) - meanTrend, phi: Array.from(s.phi), x: Array.from(x), pred: fc[k].mean }; });
  const every = Math.max(1, Math.floor(rows.length / 80)), imp = new Float64Array(nf);
  let cntImp = 0;
  for (let i = 0; i < rows.length; i += every) { const s = treeShap(model, fill(rows[i], r, tmp), nf); for (let j = 0; j < nf; j++) imp[j] += Math.abs(s.phi[j]); cntImp++; }
  for (let j = 0; j < nf; j++) imp[j] /= Math.max(1, cntImp);
  return {
    fitted, fc, used,
    explain: { kind: 'shap', feats: feats.map(f => f.id), base, steps, imp: Array.from(imp), detrend, slope: b0, valErr: pool.length ? rms(pool) : NaN },
  };
}
