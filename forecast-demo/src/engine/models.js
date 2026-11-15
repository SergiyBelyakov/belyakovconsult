// Моделі прогнозування. Кожна модель: fit(y, ctx) → { fitted, fc, used, explain }.
//   y       значення ряду (історія для навчання)
//   ctx.m   довжина сезону (0, якщо сезонності немає), ctx.h горизонт прогнозу
//   ctx.p   параметри з інтерфейсу; null або відсутній означає «підібрати автоматично»
//   ctx.X / ctx.Xf  фактори на історії й на горизонті (лише для регресії з факторами)
// fitted: значення моделі на історії (NaN там, де модель ще не має прогнозу), fc: прогноз зі смугами 80% і 95%.
import {
  mean, sum, rms, sd, variance, quantile, nanArr, clamp, sig, logit, residuals, nelderMead, golden, ols, acf, pacf, kpss, diff,
  classicDecomp, seasonalStrength, band, rng,
} from './util.js';

const finite = a => a.filter(Number.isFinite);
const sigmaOf = (y, fitted) => { const e = residuals(y, fitted); return e.length ? rms(e) : NaN; };
const auto = (v, d) => (v == null || v === 'auto' ? d : v);

// ——— Базові орієнтири ———
function naive(y, { h }) {
  const n = y.length, fitted = nanArr(n);
  for (let t = 1; t < n; t++) fitted[t] = y[t - 1];
  const s = sigmaOf(y, fitted);
  return { fitted, fc: Array.from({ length: h }, (_, k) => band(y[n - 1], s * Math.sqrt(k + 1))), used: {}, explain: { kind: 'weights', w: [1], lag0: 1 } };
}

function snaive(y, { h, m }) {
  const n = y.length, fitted = nanArr(n);
  for (let t = m; t < n; t++) fitted[t] = y[t - m];
  const s = sigmaOf(y, fitted);
  const fc = Array.from({ length: h }, (_, k) => band(y[n - m + (k % m)], s * Math.sqrt(Math.floor(k / m) + 1)));
  const w = new Array(m).fill(0); w[m - 1] = 1;
  return { fitted, fc, used: { m }, explain: { kind: 'weights', w, lag0: 1, seasonal: true } };
}

function drift(y, { h }) {
  const n = y.length, b = (y[n - 1] - y[0]) / (n - 1), fitted = nanArr(n);
  for (let t = 1; t < n; t++) fitted[t] = y[t - 1] + b;
  const s = sigmaOf(y, fitted);
  const fc = Array.from({ length: h }, (_, k) => band(y[n - 1] + (k + 1) * b, s * Math.sqrt((k + 1) * (1 + (k + 1) / (n - 1)))));
  return { fitted, fc, used: { slope: b }, explain: { kind: 'line', from: [0, y[0]], to: [n - 1, y[n - 1]], slope: b } };
}

function ma(y, { h, m, p }) {
  const n = y.length, w = clamp(Math.round(auto(p.w, m > 1 ? m : 4)), 2, Math.max(2, Math.min(60, n - 2)));
  const fitted = nanArr(n);
  let s = 0;
  for (let t = 0; t < n; t++) {
    if (t >= w) fitted[t] = s / w;
    s += y[t]; if (t >= w) s -= y[t - w];
  }
  const last = mean(y.slice(n - w)), sg = sigmaOf(y, fitted), a = 2 / (w + 1);
  const fc = Array.from({ length: h }, (_, k) => band(last, sg * Math.sqrt(1 + a * a * k)));
  return { fitted, fc, used: { w }, explain: { kind: 'weights', w: new Array(w).fill(1 / w), lag0: 1 } };
}

// ——— Експоненційне згладжування ———
function sesRun(y, a) {
  const n = y.length, fitted = nanArr(n);
  let l = y[0], sse = 0;
  for (let t = 0; t < n; t++) {
    if (t) { fitted[t] = l; sse += (y[t] - l) ** 2; }
    l = a * y[t] + (1 - a) * l;
  }
  return { fitted, l, sse };
}
export function sesFit(y, aUser) {
  const a = aUser != null ? aUser : golden(x => sesRun(y, x).sse, 0.01, 0.99);
  return { a, ...sesRun(y, a) };
}
function ses(y, { h, p }) {
  const r = sesFit(y, p.alpha ?? null), sg = sigmaOf(y, r.fitted);
  const fc = Array.from({ length: h }, (_, k) => band(r.l, sg * Math.sqrt(1 + r.a * r.a * k)));
  const w = Array.from({ length: Math.min(24, y.length) }, (_, j) => r.a * (1 - r.a) ** j);
  return { fitted: r.fitted, fc, used: { alpha: r.a }, explain: { kind: 'weights', w, lag0: 1 } };
}

function holtRun(y, a, b, phi) {
  const n = y.length, fitted = nanArr(n), L = new Array(n), B = new Array(n);
  const k = Math.min(4, n - 1);
  let tr = (y[k] - y[0]) / k, l = y[0] - tr, sse = 0;
  for (let t = 0; t < n; t++) {
    const f = l + phi * tr;
    fitted[t] = f; sse += (y[t] - f) ** 2;
    const lp = l;
    l = a * y[t] + (1 - a) * (l + phi * tr);
    tr = b * (l - lp) + (1 - b) * phi * tr;
    L[t] = l; B[t] = tr;
  }
  return { fitted, l, b: tr, sse, L, B };
}
function holt(y, { h, p }) {
  const damped = !!p.damped;
  const fixed = { a: p.alpha ?? null, b: p.beta ?? null, phi: damped ? p.phi ?? null : 1 };
  const unpack = u => ({
    a: fixed.a ?? 0.01 + 0.98 * sig(u[0]),
    b: fixed.b ?? 0.01 + 0.98 * sig(u[1]),
    phi: fixed.phi ?? 0.8 + 0.18 * sig(u[2]),
  });
  const best = nelderMead(u => { const q = unpack(u); return holtRun(y, q.a, q.b, q.phi).sse; }, [logit(0.5), logit(0.1), logit(0.6)]);
  const q = unpack(best), r = holtRun(y, q.a, q.b, q.phi), sg = sigmaOf(y, r.fitted);
  let acc = 0, phiSum = 0;
  const fc = [];
  for (let k = 1; k <= h; k++) {
    phiSum += q.phi ** k;
    fc.push(band(r.l + phiSum * r.b, sg * Math.sqrt(1 + acc)));
    let ps = 0; for (let i = 1; i <= k; i++) ps += q.phi ** i;
    const c = q.a + q.a * q.b * ps;
    acc += c * c;
  }
  return { fitted: r.fitted, fc, used: { alpha: q.a, beta: q.b, phi: q.phi, damped }, explain: { kind: 'components', parts: [{ id: 'level', v: r.L }, { id: 'trend', v: r.B, zero: true }] } };
}

function hwInit(y, m, mult) {
  const L1 = mean(y.slice(0, m)), L2 = mean(y.slice(m, 2 * m)), b = (L2 - L1) / m;
  let s = y.slice(0, m).map((v, i) => { const base = L1 + b * (i - (m - 1) / 2); return mult ? v / base : v - base; });
  const avg = mean(s);
  s = s.map(v => (mult ? v / avg : v - avg));
  return { l: L1 - b * ((m - 1) / 2 + 1), b, s };
}
function hwRun(y, m, mult, a, b, g, phi, st0) {
  const n = y.length, fitted = nanArr(n), s = st0.s.slice(), L = new Array(n), B = new Array(n);
  let l = st0.l, tr = st0.b, sse = 0, ok = true;
  for (let t = 0; t < n; t++) {
    const si = s[t % m], base = l + phi * tr, f = mult ? base * si : base + si;
    fitted[t] = f; sse += (y[t] - f) ** 2;
    const lp = l;
    l = mult ? a * (y[t] / si) + (1 - a) * base : a * (y[t] - si) + (1 - a) * base;
    tr = b * (l - lp) + (1 - b) * phi * tr;
    s[t % m] = mult ? g * (y[t] / l) + (1 - g) * si : g * (y[t] - l) + (1 - g) * si;
    if (!Number.isFinite(l) || (mult && l <= 0)) ok = false;
    L[t] = l; B[t] = tr;
  }
  return { fitted, l, b: tr, s, sse: ok && Number.isFinite(sse) ? sse : 1e300, L, B };
}
function hw(y, { h, m, p }) {
  const mult = p.season === 'mult' && y.every(v => v > 0), damped = !!p.damped, st0 = hwInit(y, m, mult);
  const fixed = { a: p.alpha ?? null, b: p.beta ?? null, g: p.gamma ?? null, phi: damped ? p.phi ?? null : 1 };
  const unpack = u => {
    const a = fixed.a ?? 0.01 + 0.98 * sig(u[0]);
    return { a, b: fixed.b ?? 0.01 + 0.6 * sig(u[1]), g: fixed.g ?? (1 - a) * (0.01 + 0.98 * sig(u[2])), phi: fixed.phi ?? 0.8 + 0.18 * sig(u[3]) };
  };
  const best = nelderMead(u => { const q = unpack(u); return hwRun(y, m, mult, q.a, q.b, q.g, q.phi, st0).sse; }, [logit(0.3), logit(0.1), logit(0.2), logit(0.6)]);
  const q = unpack(best), r = hwRun(y, m, mult, q.a, q.b, q.g, q.phi, st0), n = y.length;
  const e = residuals(y, r.fitted), sg = mult ? rms(y.map((v, t) => (v - r.fitted[t]) / r.fitted[t]).filter(Number.isFinite)) : rms(e);
  let acc = 0, phiSum = 0;
  const fc = [];
  for (let k = 1; k <= h; k++) {
    phiSum += q.phi ** k;
    const si = r.s[(n + k - 1) % m], base = r.l + phiSum * r.b, mu = mult ? base * si : base + si;
    fc.push(band(mu, (mult ? Math.abs(mu) : 1) * sg * Math.sqrt(1 + acc)));
    let ps = 0; for (let i = 1; i <= k; i++) ps += q.phi ** i;
    const c = q.a + q.a * q.b * ps + (k % m === 0 ? q.g : 0);
    acc += c * c;
  }
  // сезонні коефіцієнти за позицією в календарі: позиція (n + i) % m
  const season = Array.from({ length: m }, (_, i) => r.s[i]);
  return {
    fitted: r.fitted, fc, used: { alpha: q.a, beta: q.b, gamma: q.g, phi: q.phi, season: mult ? 'mult' : 'add', damped },
    explain: { kind: 'components', parts: [{ id: 'level', v: r.L }, { id: 'trend', v: r.B, zero: true }], season, mult },
  };
}

// Метод Тета: лінія тренду (θ = 0) і подвоєна кривизна (θ = 2), прогноз як середнє двох ліній
function theta(y, { h, m, p }) {
  const n = y.length;
  let idx = null;
  if (m > 1 && n >= 2 * m + 2 && y.every(v => v > 0)) {
    const r = acf(y, m), lim = 1.645 * Math.sqrt((1 + 2 * sum(r.slice(0, m - 1).map(v => v * v))) / n);
    if (Math.abs(r[m - 1]) > lim) idx = classicDecomp(y, m, true).idx;
  }
  const sa = idx ? y.map((v, t) => v / idx[t % m]) : y.slice();
  const X = sa.map((_, t) => [1, t]), o = ols(X, sa), [a0, b0] = o.beta;
  const lrl = sa.map((_, t) => a0 + b0 * t), th2 = sa.map((v, t) => 2 * v - lrl[t]);
  const s2 = sesFit(th2, p.alpha ?? null);
  const fitSA = sa.map((_, t) => (Number.isFinite(s2.fitted[t]) ? 0.5 * lrl[t] + 0.5 * s2.fitted[t] : NaN));
  const fitted = fitSA.map((v, t) => (idx ? v * idx[t % m] : v));
  const sg = sigmaOf(sa, fitSA);
  const fc = Array.from({ length: h }, (_, k) => {
    const mu = 0.5 * (a0 + b0 * (n - 1 + k + 1)) + 0.5 * s2.l, sc = idx ? idx[(n + k) % m] : 1;
    return band(mu * sc, sg * sc * Math.sqrt(1 + s2.a * s2.a * k));
  });
  return {
    fitted, fc, used: { alpha: s2.a, seasonal: !!idx },
    explain: { kind: 'theta', sa, lrl, th2, slope: b0, fcLine: Array.from({ length: h }, (_, k) => a0 + b0 * (n + k)), sesLevel: s2.l, seasonal: !!idx },
  };
}

// ——— Регресія ———
const tVal = (t, n) => t / Math.max(1, n - 1);
function linear(y, { h }) {
  const n = y.length, X = y.map((_, t) => [1, t]), o = ols(X, y), s = Math.sqrt(o.s2);
  const fc = Array.from({ length: h }, (_, k) => { const x0 = [1, n + k]; return band(o.beta[0] + o.beta[1] * (n + k), s * Math.sqrt(1 + o.lev(x0))); });
  return { fitted: o.fitted, fc, used: { slope: o.beta[1], intercept: o.beta[0] }, explain: { kind: 'resid', coef: [{ id: 'slope', b: o.beta[1], se: o.se[1] }] } };
}

function seasonRow(t, m) { const r = new Array(m - 1).fill(0); const pos = t % m; if (pos > 0) r[pos - 1] = 1; return r; }
function trendseason(y, { h, m }) {
  const n = y.length, X = y.map((_, t) => [1, t, ...seasonRow(t, m)]), o = ols(X, y), s = Math.sqrt(o.s2);
  const fc = Array.from({ length: h }, (_, k) => { const t = n + k, x0 = [1, t, ...seasonRow(t, m)]; let mu = 0; x0.forEach((v, j) => { mu += v * o.beta[j]; }); return band(mu, s * Math.sqrt(1 + o.lev(x0))); });
  const raw = [0, ...o.beta.slice(2)], avg = mean(raw), eff = raw.map(v => v - avg);
  const se = [NaN, ...o.se.slice(2)];
  return { fitted: o.fitted, fc, used: { slope: o.beta[1] }, explain: { kind: 'season', eff, se, slope: o.beta[1], level: o.beta[0] + avg } };
}

function driversModel(y, { h, m, p, X, Xf, names }) {
  const n = y.length, useTrend = p.trend !== false, useSeason = !!p.seasonDummies && m > 1;
  const row = (t, x) => [1, ...(useTrend ? [t] : []), ...x, ...(useSeason ? seasonRow(t, m) : [])];
  const D = y.map((_, t) => row(t, X[t])), o = ols(D, y), s = Math.sqrt(o.s2);
  const fc = Array.from({ length: h }, (_, k) => { const x0 = row(n + k, Xf[k]); let mu = 0; x0.forEach((v, j) => { mu += v * o.beta[j]; }); return band(mu, s * Math.sqrt(1 + o.lev(x0))); });
  const off = useTrend ? 2 : 1;
  const coef = names.map((nm, j) => ({ id: nm, b: o.beta[off + j], se: o.se[off + j] }));
  if (useTrend) coef.unshift({ id: 'trend', b: o.beta[1], se: o.se[1] });
  const r2 = 1 - o.sse / (variance(y) * (n - 1));
  return { fitted: o.fitted, fc, used: { trend: useTrend, seasonDummies: useSeason }, explain: { kind: 'coef', coef, r2 } };
}

function growth(y, { h, p }) {
  const n = y.length, shape = p.shape === 'exp' ? 'exp' : 'logistic', pos = y.every(v => v > 0);
  if (shape === 'exp' || !pos) {
    const ly = y.map(v => Math.log(Math.max(v, 1e-9))), X = y.map((_, t) => [1, t]), o = ols(X, ly), s = Math.sqrt(o.s2);
    const fitted = o.fitted.map(Math.exp);
    const fc = Array.from({ length: h }, (_, k) => {
      const t = n + k, mu = o.beta[0] + o.beta[1] * t, se = s * Math.sqrt(1 + o.lev([1, t]));
      return { mean: Math.exp(mu), sd: NaN, lo80: Math.exp(mu - 1.2816 * se), hi80: Math.exp(mu + 1.2816 * se), lo95: Math.exp(mu - 1.96 * se), hi95: Math.exp(mu + 1.96 * se) };
    });
    return { fitted, fc, used: { shape: 'exp', rate: Math.exp(o.beta[1]) - 1 }, explain: { kind: 'growth', shape: 'exp', rate: Math.exp(o.beta[1]) - 1, curve: t => Math.exp(o.beta[0] + o.beta[1] * t) } };
  }
  const ymax = Math.max(...y), half = y.findIndex(v => v >= ymax / 2);
  const f = (q, t) => q.K / (1 + Math.exp(-q.r * (t - q.t0)));
  const unpack = u => ({ K: ymax * (1 + Math.exp(u[0])), r: Math.exp(u[1]), t0: u[2] });
  const sse = u => { const q = unpack(u); let s = 0; for (let t = 0; t < n; t++) s += (y[t] - f(q, t)) ** 2; return Number.isFinite(s) ? s : 1e300; };
  const best = nelderMead(sse, [Math.log(0.3), Math.log(4 / Math.max(4, n)), half > 0 ? half : n], { iters: 900 });
  const q = unpack(best), fitted = y.map((_, t) => f(q, t)), sg = sigmaOf(y, fitted);
  // похідні кривої за K, r, t0: невизначеність параметрів переходить у ширину коридору (метод дельти)
  const grad = t => { const E = Math.exp(-q.r * (t - q.t0)), D = (1 + E) ** 2; return [1 / (1 + E), (q.K * E * (t - q.t0)) / D, (-q.K * E * q.r) / D]; };
  const J = y.map((_, t) => grad(t)), JtJ = [0, 1, 2].map(i => [0, 1, 2].map(j => J.reduce((s, g) => s + g[i] * g[j], 0)));
  const s2 = (sg * sg * n) / Math.max(1, n - 3), Cov = inv3(JtJ).map(r => r.map(v => v * s2));
  // шум росте разом із масштабом: беремо відносну похибку на точках, де крива вже помітна
  const rel = y.map((v, t) => (fitted[t] > 0.05 * q.K ? (v - fitted[t]) / fitted[t] : NaN)).filter(Number.isFinite), sRel = rel.length >= 4 ? rms(rel) : sg / Math.max(1, mean(y));
  const fc = Array.from({ length: h }, (_, k) => {
    const g = grad(n + k), mu = f(q, n + k); let v = (sRel * mu) ** 2;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += g[i] * Cov[i][j] * g[j];
    return band(mu, Math.sqrt(Math.max(v, 0)));
  });
  return { fitted, fc, used: { shape: 'logistic', K: q.K, r: q.r, t0: q.t0 }, explain: { kind: 'growth', shape: 'logistic', K: q.K, t0: q.t0, r: q.r, curve: t => f(q, t) } };
}

function inv3(A) {
  const [[a, b, c], [d, e, f], [g, h, i]] = A, det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!det) return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  return [[e * i - f * h, c * h - b * i, b * f - c * e], [f * g - d * i, a * i - c * g, c * d - a * f], [d * h - e * g, b * g - a * h, a * e - b * d]].map(r => r.map(v => v / det));
}

// ——— ARIMA(p, d, q)(0, D, 0)m: умовна сума квадратів, стаціонарність і оборотність через параметризацію Монахана ———
function pacToCoef(r) {
  let phi = [];
  r.forEach((rk, i) => { const next = phi.map((v, j) => v - rk * phi[i - 1 - j]); next.push(rk); phi = next; });
  return phi;
}
const polyMul = (a, b) => { const out = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((z, j) => { out[i + j] += x * z; })); return out; };
function arimaFitOrder(y, m, P, d, Q, D) {
  let w = y.slice();
  for (let i = 0; i < D; i++) w = diff(w, m);
  for (let i = 0; i < d; i++) w = diff(w, 1);
  const N = w.length, useConst = d + D <= 1, lagSkip = Math.max(P, Q);
  if (N < lagSkip + 8) return null;
  const k = P + Q + (useConst ? 1 : 0);
  const unpack = u => ({
    phi: pacToCoef(u.slice(0, P).map(Math.tanh)).map(v => v * 0.995),
    th: pacToCoef(u.slice(P, P + Q).map(Math.tanh)).map(v => -v * 0.995),
    c: useConst ? u[P + Q] : 0,
  });
  const scaleW = sd(w) || 1, muW = mean(w);
  const css = q => {
    const e = new Array(N).fill(0); let s = 0;
    for (let t = lagSkip; t < N; t++) {
      let v = w[t] - q.c * scaleW - (useConst ? muW : 0);
      for (let i = 0; i < P; i++) v -= q.phi[i] * (w[t - 1 - i] - q.c * scaleW - (useConst ? muW : 0));
      for (let j = 0; j < Q; j++) v -= q.th[j] * e[t - 1 - j];
      e[t] = v; s += v * v;
    }
    return { s, e };
  };
  const u0 = new Array(k).fill(0);
  const best = k ? nelderMead(u => { const r = css(unpack(u)).s; return Number.isFinite(r) ? r : 1e300; }, u0, { iters: 300 + 120 * k }) : u0;
  const q = unpack(best), { s, e } = css(q), nEff = N - lagSkip, sigma2 = s / Math.max(1, nEff - k);
  const aic = nEff * Math.log(s / nEff) + 2 * (k + 1);
  const mu = useConst ? q.c * scaleW + muW : 0;
  return { P, d, Q, D, m, phi: q.phi, th: q.th, mu, useConst, sigma2, aic, e, w, lagSkip, N };
}
function arimaForecast(y, f, h) {
  const n = y.length, { phi, th, mu, m, d, D } = f;
  let A = [1, ...phi.map(v => -v)];
  for (let i = 0; i < d; i++) A = polyMul(A, [1, -1]);
  for (let i = 0; i < D; i++) { const s = new Array(m + 1).fill(0); s[0] = 1; s[m] = -1; A = polyMul(A, s); }
  const a = A.slice(1).map(v => -v);   // y_t = c + Σ a_i y_{t−i} + e_t + Σ θ_j e_{t−j}
  const c = mu * (1 - sum(phi));
  const off = n - f.N, eY = new Array(n).fill(0);
  for (let t = 0; t < f.N; t++) eY[t + off] = f.e[t];
  const fitted = nanArr(n), start = off + f.lagSkip;
  for (let t = Math.max(start, a.length); t < n; t++) {
    let v = c; for (let i = 0; i < a.length; i++) v += a[i] * y[t - 1 - i];
    for (let j = 0; j < th.length; j++) v += th[j] * eY[t - 1 - j];
    fitted[t] = v;
  }
  const ext = y.slice(), eExt = eY.slice(), fc = [];
  const psi = [1];
  for (let j = 1; j < h; j++) { let v = j <= th.length ? th[j - 1] : 0; for (let i = 1; i <= Math.min(j, a.length); i++) v += a[i - 1] * psi[j - i]; psi.push(v); }
  let acc = 0;
  for (let k = 1; k <= h; k++) {
    const t = n + k - 1;
    let v = c; for (let i = 0; i < a.length; i++) v += a[i] * ext[t - 1 - i];
    for (let j = 0; j < th.length; j++) v += th[j] * (eExt[t - 1 - j] || 0);
    ext.push(v); eExt.push(0);
    acc += psi[k - 1] ** 2;
    fc.push(band(v, Math.sqrt(f.sigma2 * acc)));
  }
  return { fitted, fc };
}
export function arimaAuto(y, m) {
  const n = y.length;
  let D = 0;
  if (m > 1 && n >= 3 * m && seasonalStrength(y, m) > 0.64) D = 1;
  let w = y.slice(); for (let i = 0; i < D; i++) w = diff(w, m);
  const d = kpss(w) > 0.463 ? 1 : 0;
  return { d, D };
}
function arima(y, { h, m, p }) {
  const isAuto = p.auto !== false, n = y.length;
  let best = null;
  if (isAuto) {
    const { d, D } = arimaAuto(y, m);
    for (let P = 0; P <= 2; P++) for (let Q = 0; Q <= 2; Q++) {
      const f = arimaFitOrder(y, m, P, d, Q, D);
      if (f && (!best || f.aic < best.aic)) best = f;
    }
  } else best = arimaFitOrder(y, m, clamp(p.p ?? 1, 0, 3), clamp(p.d ?? 1, 0, 2), clamp(p.q ?? 1, 0, 3), m > 1 ? clamp(p.D ?? 0, 0, 1) : 0);
  if (!best) best = arimaFitOrder(y, m, 0, 1, 0, 0);
  const { fitted, fc } = arimaForecast(y, best, h);
  const K = Math.min(m > 1 ? Math.max(2 * m, 12) : 16, Math.floor(best.w.length / 3));
  const r = acf(best.w, K);
  let steps = [{ id: 'y', v: y }];
  let cur = y.slice();
  for (let i = 0; i < best.D; i++) { cur = diff(cur, m); steps.push({ id: 'D', v: cur }); }
  for (let i = 0; i < best.d; i++) { cur = diff(cur, 1); steps.push({ id: 'd', v: cur }); }
  return {
    fitted, fc, used: { auto: isAuto, p: best.P, d: best.d, q: best.Q, D: best.D, phi: best.phi, th: best.th, mu: best.mu, aic: best.aic },
    explain: { kind: 'acf', acf: r, pacf: pacf(r), n: best.w.length, steps, order: { p: best.P, d: best.d, q: best.Q, D: best.D, m: best.D ? m : 0 }, phi: best.phi, th: best.th },
  };
}

// ——— Декомпозиція: тренд, сезонність, залишок; тренд продовжуємо прямою, сезонність повторюємо ———
function decomp(y, { h, m, p }) {
  const mult = p.season === 'mult' && y.every(v => v > 0), n = y.length;
  const dc = classicDecomp(y, m, mult), sa = y.map((v, t) => (mult ? v / dc.season[t] : v - dc.season[t]));
  const X = sa.map((_, t) => [1, t]), o = ols(X, sa), s = Math.sqrt(o.s2);
  const fitted = o.fitted.map((v, t) => (mult ? v * dc.season[t] : v + dc.season[t]));
  const fc = Array.from({ length: h }, (_, k) => {
    const t = n + k, si = dc.idx[t % m], mu = o.beta[0] + o.beta[1] * t, se = s * Math.sqrt(1 + o.lev([1, t]));
    return band(mult ? mu * si : mu + si, mult ? se * si : se);
  });
  return { fitted, fc, used: { season: mult ? 'mult' : 'add' }, explain: { kind: 'decomp', trend: dc.trend, season: dc.season, remainder: dc.remainder, idx: dc.idx, mult } };
}

// ——— Переривчастий попит: Кростон і поправка SBA ———
function croston(y, { h, p }) {
  const n = y.length, sba = p.variant !== 'croston';
  const runC = a => {
    const fitted = nanArr(n), Z = nanArr(n), Pp = nanArr(n);
    let i0 = y.findIndex(v => v > 0);
    if (i0 < 0) return { fitted, z: 0, pr: 1, sse: 0, Z, Pp };
    let z = y[i0], pr = i0 + 1, q = 1, sse = 0;
    const k = sba ? 1 - a / 2 : 1;
    for (let t = i0 + 1; t < n; t++) {
      fitted[t] = (z / pr) * k; sse += (y[t] - fitted[t]) ** 2;
      if (y[t] > 0) { z = a * y[t] + (1 - a) * z; pr = a * q + (1 - a) * pr; q = 1; } else q++;
      Z[t] = z; Pp[t] = pr;
    }
    return { fitted, z, pr, sse, Z, Pp, k };
  };
  const a = p.alpha ?? golden(x => runC(x).sse, 0.02, 0.5);
  const r = runC(a), rate = (r.z / r.pr) * (r.k ?? 1);
  const fc = Array.from({ length: h }, () => ({ mean: rate, sd: NaN, lo80: NaN, hi80: NaN, lo95: NaN, hi95: NaN }));
  const nz = y.filter(v => v > 0);
  return {
    fitted: r.fitted, fc, used: { alpha: a, variant: sba ? 'sba' : 'croston', size: r.z, interval: r.pr },
    explain: { kind: 'intermittent', Z: r.Z, P: r.Pp, zeros: 1 - nz.length / n, size: r.z, interval: r.pr, rate },
  };
}

// ——— Імітаційне моделювання (Монте-Карло): тисяча можливих траєкторій з історичних змін ———
function monteCarlo(y, { h, m, p, seed = 7, flow }) {
  const n = y.length, N = 1000, R = rng(seed), paths = [];
  const seasonal = m > 1 && n >= 2 * m;
  const ratio = seasonal && y.every(v => v > 0);
  const pool = [];
  if (seasonal) for (let t = m; t < n; t++) pool.push(ratio ? y[t] / y[t - m] : y[t] - y[t - m]);
  else for (let t = 1; t < n; t++) pool.push(y[t] - y[t - 1]);
  for (let s = 0; s < N; s++) {
    const path = new Float64Array(h);
    let x = y[n - 1];
    for (let k = 0; k < h; k++) {
      const g = pool[R.int(pool.length)];
      if (seasonal) { const base = k < m ? y[n - m + k] : path[k - m]; x = ratio ? base * g : base + g; }
      else x += g;
      path[k] = x;
    }
    paths.push(path);
  }
  const fc = Array.from({ length: h }, (_, k) => {
    const v = Float64Array.from(paths.map(pt => pt[k])).sort();
    return { mean: mean(v), sd: sd(Array.from(v)), lo80: quantile(v, 0.1), hi80: quantile(v, 0.9), lo95: quantile(v, 0.025), hi95: quantile(v, 0.975) };
  });
  const totals = paths.map(pt => (flow ? sum(pt) : pt[h - 1]));
  return { fitted: nanArr(n), fc, used: { method: seasonal ? (ratio ? 'yoy' : 'sdiff') : 'diff', N }, explain: { kind: 'paths', sample: paths.slice(0, 60), totals, flow: !!flow } };
}

// ——— Пошук аналогів (k найближчих сусідів) ———
function knnCore(y, end, L, k, h, maxEnd) {
  const win = y.slice(end - L + 1, end + 1), mw = mean(win), byRatio = mw > 0 && y.every(v => v >= 0);
  const norm = (arr, base) => arr.map(v => (byRatio ? v / base : v - base));
  const target = norm(win, mw), cands = [];
  for (let e = L - 1; e <= maxEnd; e++) {
    const cw = y.slice(e - L + 1, e + 1), cm = mean(cw);
    if (byRatio && !(cm > 0)) continue;
    const z = norm(cw, cm);
    let dist = 0; for (let i = 0; i < L; i++) dist += (z[i] - target[i]) ** 2;
    cands.push({ e, dist: Math.sqrt(dist / L), cm });
  }
  cands.sort((a, b) => a.dist - b.dist);
  const nb = cands.slice(0, k);
  if (!nb.length) return null;
  const ws = nb.map(c => 1 / (c.dist + 1e-6)), W = sum(ws);
  const conts = nb.map(c => y.slice(c.e + 1, c.e + 1 + h).map(v => (byRatio ? v / c.cm : v - c.cm)));
  const out = [];
  for (let j = 0; j < h; j++) {
    const vals = conts.map(cn => (byRatio ? cn[j] * mw : cn[j] + mw));
    let mu = 0; vals.forEach((v, i) => { mu += ws[i] * v; }); mu /= W;
    const sv = Float64Array.from(vals).sort();
    out.push({ mean: mu, sd: NaN, lo80: quantile(sv, 0.1), hi80: quantile(sv, 0.9), lo95: sv[0], hi95: sv[sv.length - 1] });
  }
  return { out, nb };
}
function knn(y, { h, m, p }) {
  const n = y.length, L = clamp(Math.round(auto(p.L, m > 1 ? Math.min(2 * m, 28) : 8)), 3, Math.floor(n / 3)), k = clamp(Math.round(auto(p.k, 5)), 1, 15);
  const fitted = nanArr(n);
  for (let t = 2 * L + 2; t < n; t++) { const r = knnCore(y, t - 1, L, k, 1, t - 2); if (r) fitted[t] = r.out[0].mean; }
  const r = knnCore(y, n - 1, L, k, h, n - 1 - h);
  const fc = r ? r.out : Array.from({ length: h }, () => band(y[n - 1], NaN));
  return { fitted, fc, used: { L, k }, explain: { kind: 'analogs', L, nb: r ? r.nb.map(c => ({ end: c.e, dist: c.dist })) : [], h } };
}

// ——— Реєстр моделей ———
export const MODELS = [
  { id: 'naive', family: 'base', fit: naive, caps: { trend: false, season: false }, params: () => [] },
  { id: 'snaive', family: 'base', fit: snaive, needs: { season: true }, caps: { trend: false, season: true }, params: () => [] },
  { id: 'drift', family: 'base', fit: drift, caps: { trend: true, season: false }, params: () => [] },
  { id: 'ma', family: 'base', fit: ma, caps: { trend: false, season: false }, params: ds => [{ id: 'w', type: 'range', min: 2, max: Math.min(52, Math.max(6, ds.m * 2 || 12)), step: 1, def: ds.m > 1 ? ds.m : 4 }] },
  { id: 'ses', family: 'smooth', fit: ses, caps: { trend: false, season: false }, params: () => [{ id: 'alpha', type: 'range', min: 0.01, max: 0.99, step: 0.01, auto: true }] },
  { id: 'holt', family: 'smooth', fit: holt, caps: { trend: true, season: false }, params: () => [
    { id: 'alpha', type: 'range', min: 0.01, max: 0.99, step: 0.01, auto: true },
    { id: 'beta', type: 'range', min: 0.01, max: 0.99, step: 0.01, auto: true },
    { id: 'damped', type: 'toggle', def: true },
    { id: 'phi', type: 'range', min: 0.8, max: 0.98, step: 0.01, auto: true, when: 'damped' },
  ] },
  { id: 'hw', family: 'smooth', fit: hw, needs: { season: true }, caps: { trend: true, season: true }, params: ds => [
    { id: 'season', type: 'select', options: ['add', 'mult'], def: ds.mult ? 'mult' : 'add' },
    { id: 'alpha', type: 'range', min: 0.01, max: 0.99, step: 0.01, auto: true },
    { id: 'beta', type: 'range', min: 0.01, max: 0.6, step: 0.01, auto: true },
    { id: 'gamma', type: 'range', min: 0.01, max: 0.99, step: 0.01, auto: true },
    { id: 'damped', type: 'toggle', def: false },
    { id: 'phi', type: 'range', min: 0.8, max: 0.98, step: 0.01, auto: true, when: 'damped' },
  ] },
  { id: 'theta', family: 'smooth', fit: theta, caps: { trend: true, season: true }, params: () => [{ id: 'alpha', type: 'range', min: 0.01, max: 0.99, step: 0.01, auto: true }] },
  { id: 'linear', family: 'reg', fit: linear, caps: { trend: true, season: false }, params: () => [] },
  { id: 'trendseason', family: 'reg', fit: trendseason, needs: { season: true }, caps: { trend: true, season: true }, params: () => [] },
  { id: 'drivers', family: 'reg', fit: driversModel, needs: { drivers: true }, caps: { trend: true, season: true, drivers: true }, params: ds => [
    { id: 'trend', type: 'toggle', def: true },
    ...(ds.m > 1 ? [{ id: 'seasonDummies', type: 'toggle', def: false }] : []),
  ] },
  { id: 'growth', family: 'reg', fit: growth, caps: { trend: true, season: false }, params: ds => [{ id: 'shape', type: 'select', options: ['logistic', 'exp'], def: ds.id === 'app' ? 'logistic' : 'exp' }] },
  { id: 'arima', family: 'stat', fit: arima, caps: { trend: true, season: true }, params: ds => [
    { id: 'auto', type: 'toggle', def: true },
    { id: 'p', type: 'range', min: 0, max: 3, step: 1, def: 1, when: '!auto' },
    { id: 'd', type: 'range', min: 0, max: 2, step: 1, def: 1, when: '!auto' },
    { id: 'q', type: 'range', min: 0, max: 3, step: 1, def: 1, when: '!auto' },
    ...(ds.m > 1 ? [{ id: 'D', type: 'range', min: 0, max: 1, step: 1, def: 1, when: '!auto' }] : []),
  ] },
  { id: 'decomp', family: 'stat', fit: decomp, needs: { season: true }, caps: { trend: true, season: true }, params: ds => [{ id: 'season', type: 'select', options: ['add', 'mult'], def: ds.mult ? 'mult' : 'add' }] },
  { id: 'croston', family: 'special', fit: croston, needs: { nonneg: true }, caps: { trend: false, season: false, intermittent: true }, params: () => [
    { id: 'variant', type: 'select', options: ['sba', 'croston'], def: 'sba' },
    { id: 'alpha', type: 'range', min: 0.02, max: 0.5, step: 0.01, auto: true },
  ] },
  { id: 'montecarlo', family: 'special', fit: monteCarlo, caps: { trend: true, season: true }, params: () => [] },
  { id: 'knn', family: 'ml', fit: knn, caps: { trend: false, season: true }, params: ds => [
    { id: 'k', type: 'range', min: 1, max: 15, step: 1, def: 5 },
    { id: 'L', type: 'range', min: 3, max: Math.min(56, Math.max(8, ds.m * 4 || 24)), step: 1, def: ds.m > 1 ? Math.min(2 * ds.m, 28) : 8 },
  ] },
  { id: 'ensemble', family: 'ml', fit: null, caps: { trend: true, season: true }, params: () => [] },
];
export const BY_ID = Object.fromEntries(MODELS.map(x => [x.id, x]));
export const FAMILIES = ['base', 'smooth', 'reg', 'stat', 'special', 'ml'];

// Параметри за замовчуванням: значення def, а «авто» лишається null (модель підбирає сама)
export function defaultParams(id, meta) {
  const model = BY_ID[id];
  if (!model) return {};
  const out = {};
  model.params(meta).forEach(s => { out[s.id] = s.auto ? null : s.def ?? null; });
  return out;
}

// Чи підходить модель до ряду: true або код причини
export function applies(model, info) {
  const { n, m, drivers, zeros, nonneg, futureDrivers } = info;
  if (model.needs?.season && !(m > 1 && n >= 2 * m + 2)) return 'season';
  if (model.needs?.drivers && !drivers) return 'drivers';
  if (model.needs?.drivers && !futureDrivers) return 'future';
  if (model.needs?.nonneg && !nonneg) return 'nonneg';
  if (model.id === 'knn' && n < 30) return 'short';
  if (model.id === 'arima' && n < 16) return 'short';
  if (model.id === 'growth' && n < 8) return 'short';
  if (n < 6) return 'short';
  return true;
}

// Учасники ансамблю залежно від ряду
export function ensembleMembers(info) {
  if (info.zeros > 0.4 && info.nonneg) return ['croston', 'ses', 'ma'];
  return info.m > 1 && info.n >= 2 * info.m + 2 ? ['hw', 'arima', 'theta', 'trendseason'] : ['ses', 'holt', 'arima', 'theta'];
}
