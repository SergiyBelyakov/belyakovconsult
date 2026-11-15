// Синтетичні ряди для навчання (зерна фіксовані, тож у всіх відвідувачів однакові числа).
// Кожен ряд показує одну типову ситуацію: тренд і сезонність, сильна сезонність, тижневий ритм, переривчастий попит,
// насичення ринку, вплив факторів, випадкове блукання, зсув рівня, загасаючий тренд, свята й зломи тренду,
// два сезонні цикли одночасно, сценарії з ціною й бюджетом; окремо ієрархія область → громада → послуга.
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
  // попит має інерцію (частина шуму накопичується, AR(1) з φ = 0,6), а з травня 2025 року поруч працює конкурент:
  // мінус 320 порцій на тиждень, яких фактори не пояснюють
  let ar = 0;
  for (let t = 0; t < n + f; t++) {
    const temp = t < n ? r1(tempNorm(t) + 3 * R.normal()) : r1(tempNorm(t));
    X.push([temp, price(t), promo[t]]);
    ar = 0.6 * ar + 60 * R.normal();
    if (t < n) y.push(Math.max(40, Math.round(980 + 92 * temp - 24 * (price(t) - 45) * 2.2 + 430 * promo[t] + 1.1 * t - (t >= 116 ? 320 : 0) + ar + 70 * R.normal())));
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

// Щоденні дані з датами подій: (позиція дня від понеділка, день року від 0)
const dayInfo = iso => { const d = new Date(iso + 'T00:00:00Z'); return { dow: (d.getUTCDay() + 6) % 7, doy: Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5), y: d.getUTCFullYear() }; };
// Періодична лінійна інтерполяція між значеннями в середині кожного місяця
const yearly = anchors => doy => { const x = ((doy - 15 + 365) % 365) / (365 / 12), i = Math.floor(x), f = x - i; return anchors[i % 12] * (1 - f) + anchors[(i + 1) % 12] * f; };

// Свята й події, що змінюють попит на квіти й подарунки (дати на історію і на рік уперед)
export const DELIVERY_EVENTS = [
  { id: 'valentine', dates: ['2023-02-14', '2024-02-14', '2025-02-14', '2026-02-14'], win: [-1, 0], eff: [150, 420] },
  { id: 'womensday', dates: ['2023-03-08', '2024-03-08', '2025-03-08', '2026-03-08'], win: [-1, 0], eff: [260, 520] },
  { id: 'mothersday', dates: ['2023-05-14', '2024-05-12', '2025-05-11', '2026-05-10'], win: [-1, 0], eff: [60, 170] },
  { id: 'knowledge', dates: ['2023-09-01', '2024-09-01', '2025-09-01', '2026-09-01'], win: [-1, 0], eff: [90, 200] },
  { id: 'blackfriday', dates: ['2023-11-24', '2024-11-29', '2025-11-28', '2026-11-27'], win: [0, 3], eff: [150, 70, 40, 60] },
  { id: 'newyear', dates: ['2023-12-31', '2024-12-31', '2025-12-31', '2026-12-31'], win: [-3, 1], eff: [40, 70, 110, 60, -180] },
];
function delivery() {
  const R = rng(14022), D = dates('2023-01-01', 1096, 'D'), n = D.length;
  const W = [-18, -12, -6, 4, 26, 22, -16];
  const Y = yearly([-10, 10, 24, 26, 30, 6, -24, -26, 4, -8, -6, 6]);
  const extra = new Float64Array(n), at = Object.fromEntries(D.map((d, i) => [d, i]));
  DELIVERY_EVENTS.forEach(ev => ev.dates.forEach(d => { const i = at[d]; if (i == null) return; ev.eff.forEach((v, k) => { const j = i + ev.win[0] + k; if (j >= 0 && j < n) extra[j] += v; }); }));
  // тренд: повільне зростання, прискорення після запуску реклами (квітень 2024), насичення з березня 2025
  const trend = t => 260 + 0.05 * Math.min(t, 455) + 0.16 * Math.max(0, Math.min(t, 789) - 455) - 0.02 * Math.max(0, t - 789);
  const y = D.map((d, t) => { const { dow, doy } = dayInfo(d); return Math.max(0, Math.round(trend(t) + W[dow] + Y(doy) + extra[t] + 15 * R.normal())); });
  return {
    y, dates: D, freq: 'D', m: 7, periods: [7, 365.25], H: 56, h: 90, mult: false, flow: true, unit: 'orders', dec: 0,
    events: DELIVERY_EVENTS.map(({ id, dates: ds, win }) => ({ id, dates: ds, win })),
  };
}
function energy() {
  const R = rng(3650), D = dates('2023-01-01', 1096, 'D');
  const W = norm([1.05, 1.05, 1.04, 1.04, 1.03, 0.92, 0.87]);
  const Y = yearly([1.24, 1.2, 1.07, 0.93, 0.86, 0.9, 1.0, 0.98, 0.88, 0.94, 1.08, 1.2]);
  let ar = 0;
  const y = D.map((d, t) => {
    const { dow, doy } = dayInfo(d);
    ar = 0.7 * ar + 0.018 * R.normal();
    return Math.round(1460 * (1 - 0.00002 * t) * W[dow] * Y(doy) * (1 + ar + 0.012 * R.normal()));
  });
  return { y, dates: D, freq: 'D', m: 7, periods: [7, 365.25], H: 56, h: 90, mult: true, flow: true, unit: 'mwh', dec: 0 };
}
// Інтернет-магазин: замовлення залежать від відносної ціни, рекламного бюджету й стану ринку (лог-лінійно)
export const SHOP_TRUE = { price: -1.3, budget: 0.22, market: 0.9 };
function shop() {
  const R = rng(6012), n = 60, f = 12, all = dates('2021-01-01', n + f, 'M');
  const S = norm([0.86, 0.85, 0.95, 0.97, 0.98, 0.93, 0.92, 0.95, 1.0, 1.04, 1.25, 1.3]);
  const X = [];
  let mk = 100;
  for (let t = 0; t < n + f; t++) {
    const mo = t % 12;
    // ринок: падіння навесні 2022 року і поступове відновлення
    if (t < n) mk = t === 14 ? 79 : t > 14 ? mk + (104 - mk) * 0.06 + 0.6 * R.normal() : 100 + 0.8 * R.normal();
    const market = t < n ? r1(mk) : r1(mk + 0.15 * (t - n + 1));
    const price = t < n ? r1((t >= 36 && t < 46 ? 105 : 100) + (mo === 10 ? -5 : 0) + 1.6 * R.normal()) : mo === 10 ? 95 : 100;
    const budget = t < n ? Math.round((380 + 5.2 * t) * (mo === 10 ? 1.6 : mo === 3 ? 1.25 : 1) * (1 + 0.12 * R.normal())) : Math.round(700 * (mo === 10 ? 1.5 : mo === 3 ? 1.2 : 1));
    X.push([price, budget, market]);
  }
  const y = X.slice(0, n).map(([price, budget, market], t) => Math.round(9000 * Math.exp(0.004 * t + SHOP_TRUE.price * Math.log(price / 100) + SHOP_TRUE.budget * Math.log(budget / 500) + SHOP_TRUE.market * Math.log(market / 100) + 0.035 * R.normal()) * S[t % 12]));
  return {
    y, dates: all.slice(0, n), freq: 'M', m: 12, H: 12, h: 12, mult: true, flow: true, unit: 'orders', dec: 0,
    drivers: { names: ['relprice', 'budget', 'market'], X: X.slice(0, n), Xf: X.slice(n), fdates: all.slice(n) },
  };
}

// Ієрархія звернень до ЦНАП: область → 4 громади → 3 види послуг (щомісячно, 2021–2025)
export const HIER = {
  communities: [
    { id: 'city', level: 5200, growth: 0.004, social: 0.22 },
    { id: 'suburb', level: 1800, growth: 0.008, social: 0.24 },
    { id: 'north', level: 900, growth: -0.003, social: 0.34 },
    { id: 'south', level: 700, growth: -0.005, social: 0.36 },
  ],
  services: [
    { id: 'docs', share: 0.47, season: [0.85, 0.88, 0.95, 1.0, 1.08, 1.22, 1.25, 1.2, 0.98, 0.92, 0.85, 0.82] },
    { id: 'reg', share: 0.31, season: [0.8, 0.92, 1.02, 1.02, 1.0, 0.98, 0.94, 0.96, 1.1, 1.06, 1.05, 1.15] },
    { id: 'social', share: 0.22, season: [1.12, 1.02, 0.95, 0.88, 0.8, 0.78, 0.8, 0.85, 0.98, 1.22, 1.32, 1.28] },
  ],
};
let hierCache = null;
export function hierarchy() {
  if (hierCache) return hierCache;
  const R = rng(1708), n = 60, D = dates('2021-01-01', n, 'M'), nodes = [];
  const bottom = [];
  HIER.communities.forEach(c => {
    const rest = 1 - c.social, base = HIER.services[0].share + HIER.services[1].share;
    HIER.services.forEach(sv => {
      const share = sv.id === 'social' ? c.social : (sv.share / base) * rest, S = norm(sv.season);
      const y = Array.from({ length: n }, (_, t) => { const mu = c.level * share * Math.exp(c.growth * t) * S[t % 12]; return Math.max(0, Math.round(mu * (1 + 0.04 * R.normal()) + 1.4 * Math.sqrt(mu) * R.normal())); });
      bottom.push({ id: `${c.id}.${sv.id}`, level: 2, parent: c.id, community: c.id, service: sv.id, y });
    });
  });
  const add = (a, b) => a.map((v, i) => v + b[i]);
  HIER.communities.forEach(c => nodes.push({ id: c.id, level: 1, parent: 'total', community: c.id, y: bottom.filter(b => b.parent === c.id).map(b => b.y).reduce(add) }));
  nodes.unshift({ id: 'total', level: 0, parent: null, y: nodes.map(x => x.y).reduce(add) });
  hierCache = { dates: D, freq: 'M', m: 12, H: 12, h: 12, unit: 'requests', dec: 0, nodes: [...nodes, ...bottom] };
  return hierCache;
}

const GEN = { cafe, power, calls, icecream, isp, support, fuel, parts, app, delivery, energy, shop };
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
  montecarlo: 'fuel', knn: 'calls', ensemble: 'cafe', prophet: 'delivery', tbats: 'energy', sarimax: 'icecream', boost: 'icecream',
};
