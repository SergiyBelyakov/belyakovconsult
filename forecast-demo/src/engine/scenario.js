// Сценарний прогноз: лог-лінійна регресія попиту на ціну, бюджет і ринок.
//   ln y = a + b·t + сезон місяця + e_ціна·ln(ціна) + e_бюджет·ln(бюджет) + e_ринок·ln(ринок)
// Коефіцієнти e це еластичності: на скільки відсотків зміниться попит, якщо фактор зросте на 1%.
// Сценарій змінює план факторів на горизонті: ціна й бюджет з першого місяця, ринок поступово за пів року.
import { ols, Z80 } from './util.js';

export const PRESETS = {
  base: { price: 0, budget: 0, market: 0 },
  optimistic: { price: -3, budget: 20, market: 5 },
  stress: { price: 6, budget: -30, market: -10 },
};
export const PRESET_IDS = Object.keys(PRESETS);

const seasonRow = (t, m) => { const r = new Array(m - 1).fill(0); const pos = t % m; if (pos > 0) r[pos - 1] = 1; return r; };

export function fitElastic(S) {
  const m = S.m || 12, X = S.drivers.X, n = S.y.length;
  const row = (t, x) => [1, t, ...seasonRow(t, m), ...x.map(Math.log)];
  const o = ols(X.map((x, t) => row(t, x)), S.y.map(Math.log));
  const k0 = 2 + (m - 1);
  const coef = S.drivers.names.map((id, j) => ({ id, b: o.beta[k0 + j], se: o.se[k0 + j] }));
  return { o, row, coef, s: Math.sqrt(o.s2), n, r2: 1 - o.sse / S.y.map(Math.log).reduce((a, v, _, all) => a + (v - all.reduce((p, q) => p + q, 0) / all.length) ** 2, 0) };
}

// План факторів за сценарієм: зміни у відсотках до базового плану
export function planFor(S, sc) {
  return S.drivers.Xf.map(([price, budget, market], k) => [
    price * (1 + sc.price / 100), budget * (1 + sc.budget / 100), market * (1 + (sc.market / 100) * Math.min(1, (k + 1) / 6)),
  ]);
}

export function predictElastic(fit, Xf) {
  return Xf.map((x, k) => {
    const r = fit.row(fit.n + k, x);
    let mu = 0; r.forEach((v, j) => { mu += v * fit.o.beta[j]; });
    const se = fit.s * Math.sqrt(1 + fit.o.lev(r));
    return { mean: Math.exp(mu), sd: NaN, lo80: Math.exp(mu - Z80 * se), hi80: Math.exp(mu + Z80 * se), lo95: Math.exp(mu - 1.96 * se), hi95: Math.exp(mu + 1.96 * se) };
  });
}

export const total = fc => fc.reduce((a, f) => a + f.mean, 0);

// Розклад різниці з базовим сценарієм: по черзі ринок, бюджет, ціна (кожен крок змінює один фактор)
export function decompose(fit, S, sc) {
  const order = ['market', 'budget', 'price'], cur = { price: 0, budget: 0, market: 0 };
  let prev = total(predictElastic(fit, planFor(S, cur)));
  const base = prev, steps = [];
  for (const k of order) {
    cur[k] = sc[k];
    const t = total(predictElastic(fit, planFor(S, cur)));
    steps.push({ id: k, value: t - prev });
    prev = t;
  }
  return { base, steps, end: prev };
}
