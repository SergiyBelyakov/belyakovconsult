// ARIMA(p, d, q)(0, D, 0)m: умовна сума квадратів, стаціонарність і оборотність через параметризацію Монахана.
// Спільне для ARIMA, SARIMAX і узгоджених прогнозів.
import { mean, sum, sd, nanArr, nelderMead, diff, kpss, seasonalStrength, band } from './util.js';

function pacToCoef(r) {
  let phi = [];
  r.forEach((rk, i) => { const next = phi.map((v, j) => v - rk * phi[i - 1 - j]); next.push(rk); phi = next; });
  return phi;
}
const polyMul = (a, b) => { const out = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((z, j) => { out[i + j] += x * z; })); return out; };
export function arimaFitOrder(y, m, P, d, Q, D) {
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
export function arimaForecast(y, f, h) {
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

// Автопідбір: диференціювання за тестами, потім p, q від 0 до 2 за AIC
export function arimaBest(y, m, dD) {
  const { d, D } = dD || arimaAuto(y, m);
  let best = null;
  for (let P = 0; P <= 2; P++) for (let Q = 0; Q <= 2; Q++) {
    const f = arimaFitOrder(y, m, P, d, Q, D);
    if (f && (!best || f.aic < best.aic)) best = f;
  }
  return best || arimaFitOrder(y, m, 0, 1, 0, 0);
}
