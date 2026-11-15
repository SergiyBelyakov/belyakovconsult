// Синтетичні ряди для навчання (зерна фіксовані, тож у всіх відвідувачів однакові числа).
// Кожен ряд показує одну типову ситуацію: тренд і сезонність, сильна сезонність, тижневий ритм, переривчастий попит,
// насичення ринку, вплив факторів, випадкове блукання, зсув рівня, загасаючий тренд.
import { rng } from './engine/util.js';

const pad = v => String(v).padStart(2, '0');
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function dates(start, n, freq) {
  const [y, m, d] = start.split('-').map(Number), out = [];
  for (let i = 0; i < n; i++) {
    const dt = freq === 'M' ? new Date(Date.UTC(y, m - 1 + i, 1)) : new Date(Date.UTC(y, m - 1, d + i * (freq === 'W' ? 7 : 1)));
    out.push(iso(dt));
  }
  return out;
}
const norm = (a, mult = true) => { const avg = a.reduce((s, v) => s + v, 0) / a.length; return a.map(v => (mult ? v / avg : v - avg)); };
const r1 = v => Math.round(v * 10) / 10;

function cafe() {
  const R = rng(20261115), n = 72, S = norm([0.88, 0.86, 0.95, 0.98, 1.04, 1.06, 1.02, 1.0, 1.03, 1.05, 1.03, 1.1]);
  const y = Array.from({ length: n }, (_, t) => r1(820 * 1.009 ** t * S[t % 12] * (1 + 0.032 * R.normal())));
  return { y, dates: dates('2020-01-01', n, 'M'), freq: 'M', m: 12, H: 12, h: 12, mult: true, flow: true, unit: 'thUAH', dec: 1 };
}
function power() {
  const R = rng(4242), n = 84, S = norm([1.32, 1.24, 1.08, 0.92, 0.82, 0.78, 0.8, 0.8, 0.84, 0.96, 1.14, 1.3]);
  const y = Array.from({ length: n }, (_, t) => Math.round(5200 * 0.9975 ** t * S[t % 12] * (1 + 0.03 * R.normal())));
  return { y, dates: dates('2019-01-01', n, 'M'), freq: 'M', m: 12, H: 12, h: 12, mult: true, flow: true, unit: 'mwh', dec: 0 };
}
function calls() {
  const R = rng(777), n = 365, W = norm([1.25, 1.12, 1.05, 1.02, 0.98, 0.42, 0.2]);
  const D = dates('2025-01-01', n, 'D'), off = new Set(['2025-01-01', '2025-08-24', '2025-12-25']);
  // 1 січня 2025 року середа: позиція дня тижня від понеділка
  const y = D.map((d, t) => {
    const dow = (t + 2) % 7, season = 1 + 0.1 * Math.cos(((t - 15) / 365) * 2 * Math.PI), lvl = 420 * (1 + 0.0005 * t) * season;
    let v = lvl * W[dow] * (off.has(d) ? 0.35 : 1);
    v += Math.sqrt(Math.max(v, 1)) * 1.6 * R.normal();
    return Math.max(0, Math.round(v));
  });
  return { y, dates: D, freq: 'D', m: 7, H: 28, h: 28, mult: true, flow: true, unit: 'calls', dec: 0 };
}
function parts() {
  const R = rng(5150), n = 104;
  const y = Array.from({ length: n }, () => (R() < 0.28 ? 1 + R.poisson(2) : 0));
  return { y, dates: dates('2024-01-01', n, 'W'), freq: 'W', m: 0, H: 13, h: 13, flow: true, unit: 'pcs', dec: 0 };
}
function app() {
  const R = rng(31), n = 36, K = 48000, r = 0.27, t0 = 22;
  const y = Array.from({ length: n }, (_, t) => Math.round((K / (1 + Math.exp(-r * (t - t0)))) * (1 + 0.02 * R.normal()) + 120 * R.normal()));
  return { y: y.map(v => Math.max(50, v)), dates: dates('2023-01-01', n, 'M'), freq: 'M', m: 0, H: 6, h: 12, flow: false, unit: 'users', dec: 0 };
}
function icecream() {
  const R = rng(2023), n = 156, f = 13, all = dates('2023-01-02', n + f, 'W');
  const tempNorm = t => 9 + 13 * Math.sin(((t - 15) / 52) * 2 * Math.PI);
  // базова ціна щороку зростає, а тижнями коливається через локальні знижки й тести цін
  const prices = Array.from({ length: n + f }, (_, t) => (t >= n ? 54 : (t < 52 ? 45 : t < 104 ? 49 : 54) + Math.round(1.3 * R.normal())));
  const price = t => prices[t];
  const promo = Array.from({ length: n + f }, (_, t) => {
    if (t >= n) return [5, 9].includes(t - n) ? 1 : 0;
    const summer = Math.sin(((t - 15) / 52) * 2 * Math.PI) > 0.3;
    return R() < (summer ? 0.22 : 0.06) ? 1 : 0;
  });
  const X = [], y = [];
  for (let t = 0; t < n + f; t++) {
    const temp = t < n ? r1(tempNorm(t) + 3 * R.normal()) : r1(tempNorm(t));
    X.push([temp, price(t), promo[t]]);
    if (t < n) y.push(Math.max(40, Math.round(980 + 92 * temp - 24 * (price(t) - 45) * 2.2 + 430 * promo[t] + 1.1 * t + 115 * R.normal())));
  }
  return {
    y, dates: all.slice(0, n), freq: 'W', m: 52, H: 13, h: 13, flow: true, unit: 'pcs', dec: 0,
    drivers: { names: ['temp', 'price', 'promo'], X: X.slice(0, n), Xf: X.slice(n), fdates: all.slice(n) },
  };
}
function fuel() {
  const R = rng(9090), n = 156;
  let x = 52;
  const y = Array.from({ length: n }, () => { x += 0.04 + 0.42 * R.normal(); return Math.round(x * 100) / 100; });
  return { y, dates: dates('2023-01-02', n, 'W'), freq: 'W', m: 0, H: 13, h: 13, flow: false, unit: 'uahL', dec: 2 };
}
function support() {
  const R = rng(1201), n = 104;
  let ar = 0;
  const y = Array.from({ length: n }, (_, t) => { ar = 0.35 * ar + 10 * R.normal(); return Math.round((t < 80 ? 120 : 146) + ar); });
  return { y, dates: dates('2024-01-01', n, 'W'), freq: 'W', m: 0, H: 13, h: 13, flow: true, unit: 'tickets', dec: 0 };
}
function isp() {
  const R = rng(48), n = 48;
  let x = 18;
  const y = Array.from({ length: n }, (_, t) => { x += 0.56 * 0.975 ** t; return r1(x + 0.22 * R.normal()); });
  return { y, dates: dates('2022-01-01', n, 'M'), freq: 'M', m: 0, H: 12, h: 12, flow: false, unit: 'thSubs', dec: 1 };
}

const GEN = { cafe, power, calls, icecream, isp, support, fuel, parts, app };
export const DATASET_IDS = Object.keys(GEN);
const cache = {};
export function dataset(id) {
  if (!cache[id]) cache[id] = { id, seed: 11, ...GEN[id]() };
  return cache[id];
}

// Набір, на якому модель видно найкраще
export const DEFAULT_DS = {
  naive: 'fuel', snaive: 'power', drift: 'fuel', ma: 'support', ses: 'support', holt: 'isp', hw: 'cafe', theta: 'power',
  linear: 'isp', trendseason: 'cafe', drivers: 'icecream', growth: 'app', arima: 'cafe', decomp: 'power', croston: 'parts',
  montecarlo: 'fuel', knn: 'calls', ensemble: 'cafe',
};
