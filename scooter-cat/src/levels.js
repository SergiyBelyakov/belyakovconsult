// Рівні гри: кожна траса це графік даних з типовою для звітів ситуацією.
// Дані синтетичні й детерміновані (той самий ряд щоразу), тож рекорд і розбір рівня завжди про ту саму трасу.
// Значення v переводяться у висоту траси y (метри) через шкалу рівня; «ворота» змінюють шкалу ділянки попереду.
import { Terrain } from './terrain.js';

// Перелік рівнів і їхня складність живуть у catalog.js (його бере й функція рейтингу на Cloudflare)
import { LEVEL_IDS, DIFF, LIMIT } from './catalog.js';
export { LEVEL_IDS, DIFF };
const COLORS = {
  trend: '#60A5FA', hist: '#FBBF24', season: '#2DD4BF', pareto: '#34D399', outliers: '#C084FC', axis: '#22D3EE',
  stacked: '#E2E8F0', waterfall: '#60A5FA', log: '#F472B6', control: '#FB923C', multiples: '#818CF8', forecast: '#60A5FA',
  candles: '#FDE047', gantt: '#F97316', tunnel: '#22D3EE', saw: '#F87171',
};
// свічки: зростання і падіння (синій і червоний замість зеленого й червоного: так розрізняють і люди з дальтонізмом)
export const CANDLE_COLORS = { up: '#60A5FA', down: '#F87171' };
// шари складеної площі (знизу вгору) і кольори водоспаду: категорії з перевіреної палітри для темного тла
export const LAYER_COLORS = ['#3987E5', '#D95926', '#199E70'];
export const WF_COLORS = { total: '#94A3B8', down: '#E66767' };

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = R => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

// Монотонна кубічна інтерполяція (Фріч і Карлсон): плавна лінія без вигаданих горбів між точками
function monotone(xs, ys) {
  const n = xs.length, d = new Float64Array(n), m = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);   // крок однаковий: середнє гармонійне нахилів
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const k = (lo + hi) >> 1; if (xs[k] > x) hi = k; else lo = k; }
    const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}

// Вершини траси з рядом точок: старт, дані (плавно, ламаною або стовпчиками), фініш, бортики по краях
function geometry(xs, ys, mode, { barW = 0, step = 0.25, lead = 16, tail = 34 } = {}) {
  const X = [], Y = [];
  const push = (x, y) => { X.push(x); Y.push(y); };
  const x0 = mode === 'bars' ? xs[0] - barW / 2 : xs[0], x1 = mode === 'bars' ? xs[xs.length - 1] + barW / 2 : xs[xs.length - 1];
  push(x0 - lead, ys[0] + 3); push(x0 - lead, ys[0]);
  if (mode === 'smooth') {
    const f = monotone(xs, ys);
    for (let x = x0; x < x1; x += step) push(x, f(x));
    push(x1, ys[ys.length - 1]);
  } else if (mode === 'linear') {
    xs.forEach((x, i) => push(x, ys[i]));
  } else {
    xs.forEach((x, i) => { push(x - barW / 2, ys[i]); push(x + barW / 2, ys[i]); });
  }
  push(x1 + tail, ys[ys.length - 1]); push(x1 + tail, ys[ys.length - 1] + 3);
  return { X, Y, x0, x1 };
}

// Траса з готових вершин (x не спадає): бортик і рівний розгін перед першою, рівний фініш і бортик після останньої
function track(V, { lead = 16, tail = 34 } = {}) {
  const X = [], Y = [];
  const [xa, ya] = V[0], [xb, yb] = V[V.length - 1];
  X.push(xa - lead, xa - lead); Y.push(ya + 3, ya);
  for (const [x, y] of V) { X.push(x); Y.push(y); }
  X.push(xb + tail, xb + tail); Y.push(yb, yb + 3);
  return { X, Y, x0: xa, x1: xb };
}

// Ковзне середнє з центром у точці (для пунктиру тренду)
const centeredMA = (v, k) => v.map((_, i) => { const a = Math.max(0, i - (k >> 1)), b = Math.min(v.length - 1, i + (k >> 1)); return mean(v.slice(a, b + 1)); });

// Ворота: зміна форми ділянки попереду (D = нова висота мінус стара для вершин від першої з x >= fromX)
function gateMorph(terrain, fromX, toY) {
  const X = terrain.X; let i0 = 0;
  while (i0 < X.length && X[i0] < fromX - 1e-6) i0++;
  const D = new Float64Array(X.length - i0);
  for (let k = 0; k < D.length; k++) D[k] = toY(X[i0 + k], terrain.Y0[i0 + k], i0 + k) - terrain.Y0[i0 + k];
  return terrain.addMorph(i0, D);
}

function base(id, extra) {
  return { id, index: LEVEL_IDS.indexOf(id), color: COLORS[id], kind: 'line', gates: [], ghosts: [], notes: [], band: null, reveal: null, ...extra };
}

// ——— 1. Тренд і шум: продажі за тижнями ———
function trend() {
  const R = rng(11), N = 52, dx = 4.5;
  const promo = { 9: 11, 22: 10, 35: 11, 47: 10 }, dip = { 16: -9, 41: -8 };
  const v = Array.from({ length: N }, (_, i) => 100 + 0.9 * i + 5 * gauss(R) + (promo[i] || 0) + (dip[i] || 0));
  const xs = v.map((_, i) => i * dx), yOf = val => (val - 88) * 0.075;
  const ys = v.map(yOf), g = geometry(xs, ys, 'smooth');
  const ma = centeredMA(v, 7);
  // нахил лінійної регресії: тренд за тиждень
  const mx = mean(xs.map((_, i) => i)), my = mean(v);
  const slope = v.reduce((s, y, i) => s + (i - mx) * (y - my), 0) / v.reduce((s, _, i) => s + (i - mx) ** 2, 0);
  let turns = 0;
  for (let i = 2; i < N; i++) if (Math.sign(v[i] - v[i - 1]) !== Math.sign(v[i - 1] - v[i - 2])) turns++;
  return base('trend', {
    bugSpots: [[7], [14], [20, 1], [28], [33], [37, 1], [43]],
    samples: v.map((val, i) => ({ i, x: xs[i], v: val })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'k', xLabel: i => ({ k: 'week', n: i + 1 }), xEvery: 4,
    ghosts: [{ key: 'ma', style: 'dash', pts: xs.map((x, i) => [x, yOf(ma[i])]) }],
    notes: [{ i: 9, key: 'promo' }, { i: 16, key: 'holidays', down: true }, { i: 30, key: 'noise' }, { i: 48, key: 'trendNote', args: { w: slope } }],
    checkpoints: [13, 26, 39].map(i => xs[i] + 1),
    ticks: [100, 120, 140, 160], stats: { turns, weeks: N, slope, year: ma[N - 4] / ma[3] - 1 },
  });
}

// ——— 2. Сезонність: продажі за місяцями, пік у грудні ———
function season() {
  const R = rng(23), F = [0.8, 0.82, 0.93, 0.98, 1.0, 0.96, 0.92, 0.94, 1.02, 1.07, 1.16, 1.32], N = 37, dx = 6.5;
  const v = Array.from({ length: N }, (_, i) => 100 * (1 + 0.009 * i) * F[i % 12] + 1.8 * gauss(R));
  const xs = v.map((_, i) => i * dx), yOf = val => (val - 72) * 0.052;
  const ys = v.map(yOf), g = geometry(xs, ys, 'smooth');
  const jans = [12, 24, 36].map(i => ({ i, mom: v[i] / v[i - 1] - 1, yoy: v[i] / v[i - 12] - 1 }));
  return base('season', {
    bugSpots: [[3], [9], [15], [18, 1], [21], [27], [30, 1], [33]],
    samples: v.map((val, i) => ({ i, x: xs[i], v: val })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'k', xLabel: i => ({ k: 'month', m: i % 12, y: 2023 + Math.floor(i / 12) }), xEvery: 3,
    ghosts: [{ key: 'lastYear', style: 'dash', pts: xs.slice(12).map((x, k) => [x, yOf(v[k])]) }],
    notes: [{ i: 11, key: 'dec' }, ...jans.map(j => ({ i: j.i, key: 'jan', args: j, down: true }))],
    checkpoints: [4, 16, 28].map(i => xs[i]),
    ticks: [80, 100, 120, 140, 160, 180], stats: { jan: jans[2], year: 2026 },
  });
}

// ——— 3. Викиди: платежі за днями; справжні сплески лишаються, помилки прибирають правила перевірки ———
function outliers() {
  const R = rng(37), N = 70, dx = 3;
  const v = Array.from({ length: N }, (_, i) => 50 + 2.2 * gauss(R) - (i % 7 >= 5 ? 5 : 0));
  Object.assign(v, { 18: 62, 19: 88, 20: 124, 21: 96, 22: 72, 23: 58 });           // Чорна п'ятниця і розпродаж після неї
  Object.assign(v, { 61: 64, 62: 92, 63: 72 });                                      // день народження мережі: акція
  const errors = [{ i: 33, rec: 0, key: 'zeroExtra' }, { i: 45, rec: 0, key: 'zeroDay' }, { i: 54, rec: 0, key: 'double' }];
  errors.forEach(e => { e.v = v[e.i]; });
  errors[0].rec = Math.round(errors[0].v) * 10; errors[1].rec = 0; errors[2].rec = Math.round(errors[2].v) * 2;
  const recorded = v.slice(); errors.forEach(e => { recorded[e.i] = e.rec; });
  const xs = v.map((_, i) => i * dx), yOf = val => val * 0.06;
  const g = geometry(xs, recorded.map(yOf), 'linear'), terrain = new Terrain(g.X, g.Y);
  // у ламаній вершина точки i має індекс 2 + i (перед даними дві вершини старту); ворота міняють лише цю вершину
  const gates = errors.map(e => ({
    x: xs[e.i] - 16, at: xs[e.i - 1], i: e.i, key: e.key, args: { rec: e.rec, v: Math.round(e.v) },
    morph: terrain.addMorph(2 + e.i, Float64Array.of(yOf(e.v) - yOf(e.rec))), dur: 0.7,
    ghost: [[xs[e.i - 1], yOf(v[e.i - 1])], [xs[e.i], yOf(e.rec)], [xs[e.i + 1], yOf(v[e.i + 1])]],
  }));
  return base('outliers', {
    bugSpots: [[8], [14], [27], [30, 1], [39], [42, 1], [50], [58]],
    samples: v.map((val, i) => ({ i, x: xs[i], v: val, rec: recorded[i] })), terrain, x0: g.x0, x1: g.x1,
    yOf, unit: 'k', xLabel: i => ({ k: 'day', n: i + 1 }), xEvery: 7, gates,
    notes: [{ i: 20, key: 'blackFriday' }, { i: 62, key: 'birthday' }],
    checkpoints: [12, 28, 41, 50].map(i => xs[i] + 1),
    ticks: [0, 20, 40, 60, 80, 100, 120, 140],
    stats: { meanRec: mean(recorded), meanClean: mean(v), median: median(recorded), err: errors.map(e => ({ key: e.key, rec: e.rec, v: Math.round(e.v) })) },
  });
}

// ——— 4. Обрізана вісь: виручка стовпчиками, вісь з 95; на воротах вісь іде від нуля ———
function axis() {
  const A = [103.0, 102.6, 102.65, 101.6, 101.65, 100.4, 100.45, 99.2, 98.4, 98.45, 97.3, 96.6, 96.65];
  const B = [97.4, 96.9, 98.2, 99.1, 98.6, 100.2, 101.0, 100.7, 102.1, 101.6, 103.0, 103.8, 104.2];
  const v = [...A, ...B], w = 6, xs = v.map((_, i) => i * w), anchor = A.length - 1;
  const sT = 1.1, sZ = 0.035, yT = val => (val - 95) * sT, yZ = val => yT(v[anchor]) + (val - v[anchor]) * sZ;
  const g = geometry(xs, v.map(yT), 'bars', { barW: w }), terrain = new Terrain(g.X, g.Y);
  const at = xs[anchor] + w / 2;   // правий край стовпчика-якоря: далі нова шкала
  // вершини стовпчика j мають індекси 2 + 2j (лівий край) і 3 + 2j (правий), далі дві вершини фінішу
  const i0 = 3 + 2 * anchor, D = new Float64Array(terrain.n - i0);
  for (let k = 0; k < D.length; k++) { const j = Math.min(v.length - 1, Math.floor((i0 + k - 2) / 2)); D[k] = yZ(v[j]) - yT(v[j]); }
  const morph = terrain.addMorph(i0, D);
  const gate = { x: xs[anchor - 2] + 1, at, key: 'zeroAxis', morph, dur: 0.8,
    ghost: [[at, yT(v[anchor])], ...B.flatMap((val, k) => { const x = xs[anchor + 1 + k]; return [[x - w / 2, yT(val)], [x + w / 2, yT(val)]]; })] };
  const drop = v[anchor] / v[0] - 1, rise = v[v.length - 1] / v[anchor] - 1;
  return base('axis', {
    bugSpots: [[2], [5], [9], [15], [19, 1], [23]],
    kind: 'bars', barW: w, samples: v.map((val, i) => ({ i, x: xs[i], v: val })), terrain, x0: g.x0, x1: g.x1,
    yOf: yT, yZ, sT, sZ, anchor, unit: 'k', xLabel: i => ({ k: 'month', m: i % 12, y: 2024 + Math.floor(i / 12) }), xEvery: 2, gates: [gate],
    notes: [{ i: 1, key: 'truncated' }, { i: anchor, key: 'zeroGate' }, { i: v.length - 2, key: 'flatRise', args: { rise } }],
    checkpoints: [6, anchor - 1, 19].map(i => xs[i]),
    ticksA: [95, 97, 99, 101, 103], ticksB: [0, 20, 40, 60, 80, 100],
    stats: { from: v[0], to: v[anchor], drop, share: (v[0] - v[anchor]) / (v[0] - 95), rise },
  });
}

// ——— 5. Логарифмічна шкала: користувачі ростуть на 16% щомісяця, потім ріст сповільнюється ———
function log() {
  const R = rng(51), N = 41, dx = 5;
  const gr = Array.from({ length: N }, (_, m) => (m < 24 ? 0.16 + 0.018 * gauss(R) : Math.max(0.004, 0.16 * (40 - m) / 16 + 0.008 * gauss(R))));
  gr[17] = -0.04; gr[21] = 0.3;   // поганий реліз і вірусний місяць
  const v = [1000];
  for (let m = 1; m < N; m++) v.push(v[m - 1] * (1 + gr[m]));
  const xs = v.map((_, i) => i * dx), anchor = 12;
  const sL = 0.0005, sG = 32, yL = val => val * sL, yG = val => yL(v[anchor]) + (Math.log10(val) - Math.log10(v[anchor])) * sG;
  const step = 0.25, fL = monotone(xs, v.map(yL)), fG = monotone(xs, v.map(yG));
  const g = geometry(xs, v.map(yL), 'smooth', { step }), terrain = new Terrain(g.X, g.Y);
  const at = xs[anchor];
  // фініш і бортик після даних теж переходять на нову висоту
  // перехід зі шкали на шкалу плавний на перших 10 м, щоб злам схилу не був сходинкою
  const morph = gateMorph(terrain, at, (x, y0) => (x > g.x1 + 1e-6 ? yG(v[N - 1]) + (y0 - yL(v[N - 1])) : fL(x) + (fG(x) - fL(x)) * smooth((x - at) / 10)));
  const gate = { x: at - 14, at, key: 'logScale', morph, dur: 0.9, ghost: [] };
  for (let x = at; x <= Math.min(g.x1, at + 140); x += 1) gate.ghost.push([x, fL(x)]);
  const slowFrom = gr.findIndex((q, m) => m >= 24 && q < 0.15);
  return base('log', {
    bugSpots: [[3], [9], [14], [19], [25], [29, 1], [33], [36]],
    samples: v.map((val, i) => ({ i, x: xs[i], v: val })), terrain, x0: g.x0, x1: g.x1,
    yOf: yL, yG, anchor, unit: 'users', xLabel: i => ({ k: 'monthN', n: i }), xEvery: 4, gates: [gate],
    notes: [{ i: 6, key: 'exp' }, { i: anchor, key: 'logGate' }, { i: 17, key: 'badMonth', down: true }, { i: 21, key: 'viral' }, { i: 28, key: 'slowing', args: { m: slowFrom } }, { i: 38, key: 'saturation' }],
    checkpoints: [8, 20, 30].map(i => xs[i]),
    ticksA: [0, 2000, 4000, 6000], ticksB: [5000, 7000, 10000, 15000, 20000, 30000, 50000, 70000, 100000, 150000, 200000],
    stats: { g: 0.16, slowFrom, last: gr[N - 1], end: v[N - 1] },
  });
}

// ——— 6. Прогноз: праворуч від «сьогодні» видно лише медіану й коридор, справжня дорога відкривається перед колесами ———
function forecast() {
  const R = rng(77), H = 30, F = 24, N = H + F, dx = 5;
  const model = m => 100 + 0.55 * m + 13 * Math.sin((2 * Math.PI * (m - 2)) / 12);
  const v = [];
  for (let m = 0; m < H; m++) v.push(model(m) + 3 * gauss(R));
  const z = 1.2816, sd = h => 3.2 * Math.sqrt(h);
  let dev = (v[H - 1] - model(H - 1)) * 0.6;
  for (let h = 1; h <= F; h++) {
    dev = dev * 0.86 + 5.2 * gauss(R);
    const lim = z * sd(h) * 1.15;
    dev = Math.max(-lim, Math.min(lim, dev));
    const raw = model(H - 1 + h) + dev + (h === 8 ? -8 : h === 16 ? 10 : 0), prev = v[v.length - 1];
    v.push(Math.max(prev - 20, Math.min(prev + 20, raw)));   // місяць до місяця не більше ±20: дорога крута, але проїзна
  }
  const xs = v.map((_, i) => i * dx), yOf = val => (val - 64) * 0.1;
  const g = geometry(xs, v.map(yOf), 'linear');
  const rows = [];
  for (let h = 0; h <= F; h++) { const m = H - 1 + h, mid = model(m), e = z * sd(h); rows.push({ x: xs[m], mid, lo: mid - e, hi: mid + e, lo95: mid - 1.96 * sd(h), hi95: mid + 1.96 * sd(h) }); }
  const inside = rows.slice(1).filter((r, k) => v[H + k] >= r.lo && v[H + k] <= r.hi).length / F;
  const mae = mean(rows.slice(1).map((r, k) => Math.abs(v[H + k] - r.mid)));
  return base('forecast', {
    bugSpots: [[5], [12], [20], [24, 1], [33], [40], [44, 1], [49]],
    samples: v.map((val, i) => ({ i, x: xs[i], v: val, future: i >= H })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'k', xLabel: i => ({ k: 'month', m: i % 12, y: 2024 + Math.floor(i / 12) }), xEvery: 3,
    band: { rows }, reveal: { x0: xs[H - 1], dist: 7.5 },
    notes: [{ i: H - 1, key: 'today' }, { i: H + 6, key: 'band' }, { i: N - 3, key: 'wider' }],
    checkpoints: [10, 22, 34, 44].map(i => xs[i]),
    ticks: [80, 100, 120, 140, 160], stats: { inside, mae, horizon: F },
  });
}

// ——— 7. Гістограма: суми чеків за тиждень. Розподіл скошений, тому середній чек більший за типовий ———
function hist() {
  const R = rng(91), n = 4000, bw = 50, nb = 32, dx = 5;
  const mu = Math.log(290), sg = 0.72, wq = 0.05, wm = 1350, ws = 110;   // звичайні покупки і 5% великих закупівель
  const vals = Array.from({ length: n }, () => (R() < wq ? wm + ws * gauss(R) : Math.exp(mu + sg * gauss(R))));
  const counts = new Array(nb).fill(0);
  for (const u of vals) { const b = Math.floor(u / bw); if (b >= 0 && b < nb) counts[b]++; }
  const pdf = u => (u <= 0 ? 0 : ((1 - wq) * Math.exp(-((Math.log(u) - mu) ** 2) / (2 * sg * sg))) / (u * sg * Math.sqrt(2 * Math.PI)))
    + (wq * Math.exp(-((u - wm) ** 2) / (2 * ws * ws))) / (ws * Math.sqrt(2 * Math.PI));
  const peak = Math.max(...counts), sY = 4.6 / peak, yOf = c => c * sY, xOf = u => (u / bw) * dx;
  // траса: крива розподілу (скільки чеків очікувано потрапляє в кошик шириною 50 грн), стовпчики гістограми під нею
  const V = [];
  for (let x = 0; x < nb * dx; x += 0.25) V.push([x, yOf(n * bw * pdf((x / dx) * bw))]);
  V.push([nb * dx, yOf(n * bw * pdf(nb * bw))]);
  const g = track(V);
  const med = median(vals), avg = mean(vals), below = vals.filter(u => u < avg).length / n, mode = counts.indexOf(peak);
  const xs = counts.map((_, b) => (b + 0.5) * dx);
  return base('hist', {
    kind: 'hist', barW: dx, bugSpots: [[5], [9], [12, 1], [17], [21], [24, 1], [28]],
    samples: counts.map((c, b) => ({ i: b, x: xs[b], v: c })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'count', xTicks: counts.map((_, b) => b).filter(b => b % 2 === 0).map(b => ({ x: b * dx, o: { k: 'uah', n: b * bw } })),
    marks: [{ x: xOf(med), key: 'median', v: med }, { x: xOf(avg), key: 'mean', v: avg }],
    notes: [{ i: mode, key: 'mode', args: { lo: mode * bw, hi: (mode + 1) * bw } }, { i: Math.round(avg / bw) + 3, key: 'meanPull', down: true }, { i: 27, key: 'tail' }],
    checkpoints: [8, 15, 23].map(b => xs[b]),
    ticks: [0, 100, 200, 300, 400], stats: { med, avg, below, n },
  });
}

// ——— 8. Парето: виручка за товарними групами. Їдемо накопиченою часткою, стовпчики груп під нею ———
function pareto() {
  const R = rng(17), n = 20, w = 7, s = 0.042;
  const raw = Array.from({ length: n }, (_, k) => Math.pow(k + 1, -1.3) * (1 + 0.06 * gauss(R))).sort((a, b) => b - a);
  const tot = raw.reduce((a, b) => a + b, 0), share = raw.map(x => (100 * x) / tot);
  let c = 0;
  const cum = share.map(x => (c += x));
  const k80 = cum.findIndex(q => q >= 80), k95 = cum.findIndex(q => q >= 95), yOf = p => p * s;
  // накопичена частка в кінці кожного стовпчика; лінія починається з нуля на лівому краї першого
  const g = track([[0, 0], ...cum.map((q, k) => [(k + 1) * w, yOf(q)])], { lead: 18 });
  return base('pareto', {
    kind: 'pareto', barW: w, camDrop: 1.6, bugSpots: [[1], [4, 1], [7], [10], [12, 1], [15], [17]],
    samples: cum.map((q, k) => ({ i: k, x: (k + 1) * w, v: q, share: share[k], abc: k <= k80 ? 'A' : k <= k95 ? 'B' : 'C' })),
    terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1, k80, k95,
    yOf, unit: 'pct', xTicks: share.map((_, k) => ({ x: (k + 0.5) * w, o: { k: 'cat', n: k } })),
    notes: [{ i: 0, key: 'leader', args: { p: share[0] } }, { i: k80, key: 'p80', args: { k: k80 + 1, n } }, { i: n - 4, key: 'longTail', args: { k: n - k80 - 1, p: 100 - cum[k80] } }],
    checkpoints: [5, 10, 15].map(k => (k + 0.5) * w),
    ticks: [0, 20, 40, 60, 80, 100], stats: { k: k80 + 1, n, top: share[0], cum: cum[k80], kb: k95 + 1 },
  });
}

// ——— 9. Складена площа: виручка за каналами. Опт зникає, а ріст онлайну ховається на хвилях магазинів ———
function stacked() {
  const R = rng(63), N = 36, dx = 5, s = 0.065, lost = 20;
  const F = [0.86, 0.84, 0.95, 0.98, 1.0, 0.97, 0.95, 0.98, 1.02, 1.05, 1.1, 1.3];
  const layers = [[], [], []];   // знизу вгору: магазини, опт, онлайн
  for (let m = 0; m < N; m++) {
    layers[0].push(60 * (1 + 0.002 * m) * F[m % 12] + 1.5 * gauss(R));
    layers[1].push(m < lost ? 24 + 1.2 * gauss(R) : 0);
    layers[2].push(8 * Math.pow(1.047, m) * (0.6 + 0.4 * F[m % 12]) + 0.6 * gauss(R));
  }
  const tot = layers[0].map((v, m) => v + layers[1][m] + layers[2][m]);
  const xs = tot.map((_, m) => m * dx), yOf = v => v * s;
  const g = geometry(xs, tot.map(yOf), 'linear');
  const on = layers[2], drop = tot[lost] / tot[lost - 1] - 1;
  return base('stacked', {
    kind: 'stacked', layers, camDrop: 1, bugSpots: [[4], [8, 1], [14], [17], [22], [27, 1], [31]],
    samples: tot.map((v, m) => ({ i: m, x: xs[m], v })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'k', xLabel: i => ({ k: 'month', m: i % 12, y: 2023 + Math.floor(i / 12) }), xEvery: 3,
    notes: [{ i: 6, key: 'bottomLayer', down: true }, { i: lost, key: 'lostWholesale', args: { d: drop }, warn: true }, { i: 29, key: 'onlineHidden', down: true }],
    checkpoints: [9, 18, 27].map(m => xs[m] + 1),
    ticks: [0, 40, 80, 120], stats: { growth: mean(on.slice(24)) / mean(on.slice(0, 12)), drop, whole: mean(layers[1].slice(0, lost)), on0: mean(on.slice(0, 12)), on2: mean(on.slice(24)) },
  });
}

// ——— 10. Водоспад: від виручки до чистого прибутку. Сходинки вниз, проміжні підсумки стоять від нуля ———
function waterfall() {
  const steps = [['revenue', 132, 1], ['returns', -12], ['netRevenue', 0, 1], ['cogs', -62], ['gross', 0, 1], ['salaries', -21], ['rent', -7],
    ['marketing', -9], ['logistics', -6], ['ebitda', 0, 1], ['depreciation', -4], ['interest', -2], ['tax', -1.62], ['net', 0, 1]];
  const w = 7, gap = 2, s = 0.07, yOf = v => v * s;
  let run = 0;
  const bars = steps.map(([key, d, total], k) => {
    const x = k * (w + gap);
    if (total) { if (d) run = d; return { key, x, lo: 0, hi: run, d: run, total: true }; }
    const a = run; run += d;
    return { key, x, lo: Math.min(a, run), hi: Math.max(a, run), d, total: false };
  });
  // траса: верх кожного стовпчика і сполучна лінія на рівні поточної суми, з якої починається наступний стовпчик
  const V = [];
  bars.forEach((b, k) => {
    V.push([b.x - w / 2, yOf(b.hi)], [b.x + w / 2, yOf(b.hi)]);
    const nx = bars[k + 1];
    if (nx && nx.hi < b.hi - 1e-9) V.push([b.x + w / 2, yOf(nx.hi)]);
  });
  const g = track(V);
  const rev = bars[0].hi, net = bars[bars.length - 1].hi, cogs = -steps[3][1];
  return base('waterfall', {
    kind: 'waterfall', barW: w, bars, camDrop: 0.8, bugSpots: [[1], [3, 1], [6], [8], [10, 1], [12]],
    samples: bars.map((b, k) => ({ i: k, x: b.x, v: b.d, total: b.total })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'k', xTicks: bars.map(b => ({ x: b.x, o: { k: 'wf', key: b.key } })),
    notes: [{ i: 3, key: 'bigStep', args: { p: cogs / rev }, warn: true }, { i: 4, key: 'subtotal' }, { i: 12, key: 'netMargin', args: { p: net / rev } }],
    checkpoints: [2, 5, 9].map(k => bars[k].x - w / 2 + 1.5),
    ticks: [0, 40, 80, 120], stats: { rev, net, margin: net / rev, cogs, cogsShare: cogs / rev, ebitda: bars[9].hi },
  });
}

// ——— 11. Контрольна карта: час доставки за днями. Між межами звичайний шум, за межами сигнал ———
function control() {
  const R = rng(29), N = 60, dx = 2.6, s = 0.17;
  const raw = Array.from({ length: N }, () => 24 + 1.8 * gauss(R));
  const b0 = raw.slice(0, 20), m0 = mean(b0);
  let mr = 0;
  for (let d = 1; d < 20; d++) mr += Math.abs(b0[d] - b0[d - 1]);
  mr /= 19;
  const ucl = m0 + 2.66 * mr, lcl = m0 - 2.66 * mr;   // межі XmR за першими 20 днями
  const spike = 22, run0 = 38, run1 = 48, low = 53;
  const v = raw.map(x => Math.max(lcl + 0.5, Math.min(ucl - 0.5, x)));
  v[spike - 1] = ucl - 0.8; v[spike] = ucl + 4.5; v[spike + 1] = ucl - 1.2;   // збій на складі: три дні, один за межею
  for (let d = run0; d <= run1; d++) v[d] = Math.min(ucl - 0.4, Math.max(m0 + 0.6, raw[d] + 2.4));   // новий перевізник: процес зсунувся
  // яма нижче нижньої межі: пологий спуск і вихід, щоб у неї можна було заїхати, а не лише перестрибнути
  v[low - 2] = m0 + 0.4; v[low - 1] = m0 - 1.6; v[low] = lcl - 1.4; v[low + 1] = lcl + 0.4; v[low + 2] = m0 - 0.6; v[low + 4] = Math.max(v[low + 4], m0 - 2);
  const xs = v.map((_, d) => d * dx), yOf = h => (h - 12) * s;
  const g = geometry(xs, v.map(yOf), 'linear');
  const sig = v.map((x, d) => (x > ucl || x < lcl ? 'out' : d >= run0 && d <= run1 ? 'run' : null));
  return base('control', {
    kind: 'control', bugSpots: [[5], [11, 1], [17], [27], [33, 1], [44], [50]],
    samples: v.map((x, d) => ({ i: d, x: xs[d], v: x, sig: sig[d] })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'h', xLabel: i => ({ k: 'day', n: i + 1 }), xEvery: 5, limits: { mean: m0, ucl, lcl, run: [run0, run1] },
    notes: [{ i: 8, key: 'routine' }, { i: spike, key: 'signalOut', args: { d: spike + 1 }, warn: true }, { i: run0 + 4, key: 'signalRun', args: { d: run0 + 1, n: run1 - run0 + 1 } }, { i: low, key: 'signalLow', down: true }],
    checkpoints: [15, 30, 45].map(d => xs[d] + 1),
    ticks: [16, 20, 24, 28, 32, 36], stats: { mean: m0, ucl, lcl, spike: spike + 1, run: run0 + 1, runN: run1 - run0 + 1, low: low + 1 },
  });
}

// ——— 12. Малі мультиплікатори: продажі п'яти регіонів, кожен на своїй панелі з однаковою шкалою ———
function multiples() {
  const R = rng(47), dx = 3.2, gap = 3, s = 0.022, floor = -4;
  const F = [0.94, 0.9, 0.96, 0.98, 1.0, 0.98, 0.96, 0.98, 1.01, 1.04, 1.09, 1.24];
  const regs = [['kyiv', 240, 0.06], ['lviv', 200, 0.4], ['dnipro', 170, 0.03], ['odesa', 150, -0.3], ['kharkiv', 120, 0.08]];
  const samples = [], V = [], pits = [], panels = [];
  let px = 0;
  regs.forEach(([key, b, gr], r) => {
    const xs = F.map((_, m) => px + m * dx), v = F.map((f, m) => b * (1 + (gr * (m - 5.5)) / 12) * f + 2 * gauss(R));
    const ys = v.map(val => val * s), f = monotone(xs, ys);
    // між панелями провалля: стрибок з грудня однієї панелі на січень наступної
    if (r) { const [ex, ey] = V[V.length - 1]; V.push([ex, floor], [xs[0], floor]); pits.push({ x0: ex, x1: xs[0], y: Math.min(ey, ys[0]) - 0.8 }); }
    for (let x = xs[0]; x < xs[11] - 1e-6; x += 0.25) V.push([x, f(x)]);
    V.push([xs[11], ys[11]]);
    v.forEach((val, m) => samples.push({ i: r * 12 + m, x: xs[m], v: val, r }));
    panels.push({ key, x0: xs[0], x1: xs[11], v, g: v[10] / v[0] - 1, avg: mean(v) });
    px = xs[11] + gap;
  });
  const g = track(V);
  return base('multiples', {
    kind: 'multiples', panels, pits, floor, panelTop: Math.max(...samples.map(q => q.v)) * s + 2.6, bugSpots: [[4], [8, 1], [15], [20], [27, 1], [32], [39], [44, 1], [51], [56]],
    samples, terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf: val => val * s, sY: s, unit: 'k', xLabel: i => ({ k: 'monthShort', m: i % 12 }), xEvery: 3,
    notes: [{ i: 2, key: 'sameScale' }, { i: 21, key: 'lvivGrowth', args: { g: panels[1].g } }, { i: 44, key: 'odesaFall', args: { g: panels[3].g }, warn: true }],
    checkpoints: [12, 24, 36, 48].map(i => samples[i].x + 1.2),
    ticks: [0, 100, 200, 300], stats: { lviv: panels[1].g, odesa: panels[3].g, ratio: panels[0].avg / panels[4].avg },
  });
}

// ——— «Адіще»: чотири траси з правилами ігор 90-х. Без контрольних точок: одне падіння і рівень спочатку ———
const niceTicks = (lo, hi, step) => { const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v); return out; };

// Параметри пекельних трас підібрано прогонами: автопілот проходить кожну кожним героєм хоча б на двох швидкостях,
// а «людина» (автопілот із затримкою реакції 70-150 мс і випадковими помилками) з першої спроби лише у 10-40% випадків.
// Ліміт часу (LIMIT у catalog.js) не дає повзти: у коридорі повільна їзда безпечна, тож таймер змушує ризикувати

// Адіще 1. Свічки: ціна акції щогодини; тихі години і сплески волатильності, коли кожна свічка це трамплін
function candles() {
  const R = rng(101), N = 72, dx = 2.3, s = 0.3;
  const burst = i => (i >= 14 && i < 25) || (i >= 38 && i < 50) || (i >= 58 && i < 67);
  const O = [], Hi = [], Lo = [], C = [];
  let p = 100;
  for (let i = 0; i < N; i++) {
    const sd = burst(i) ? 2.2 : 0.75;
    const d = Math.max(-3.7, Math.min(3.7, sd * gauss(R) + 0.05));   // година до години не більше ±3,7: круто, але проїзно
    const o = p, c = o + d;
    O.push(o); C.push(c);
    Hi.push(Math.max(o, c) + Math.abs(gauss(R)) * sd * 0.45);
    Lo.push(Math.min(o, c) - Math.abs(gauss(R)) * sd * 0.45);
    p = c;
  }
  const xs = C.map((_, i) => i * dx), lo0 = Math.floor(Math.min(...Lo) / 2) * 2 - 2, yOf = v => (v - lo0) * s;
  const g = geometry(xs, C.map(yOf), 'linear');
  const ma = centeredMA(C, 12), rng_ = C.map((_, i) => (Hi[i] - Lo[i]) / O[i]);
  const calmR = mean(rng_.filter((_, i) => !burst(i))), burstR = mean(rng_.filter((_, i) => burst(i)));
  const peak = rng_.indexOf(Math.max(...rng_));
  return base('candles', {
    kind: 'candles', hell: true, ohlc: { O, H: Hi, L: Lo, C }, barW: dx * 0.6,
    bugSpots: [[8], [19], [27, 1], [33], [44], [53, 1], [63]],
    samples: C.map((c, i) => ({ i, x: xs[i], v: c })), terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf, unit: 'k', xLabel: i => ({ k: 'hour', n: i }), xEvery: 6,
    ghosts: [{ key: 'ma', style: 'dash', pts: xs.map((x, i) => [x, yOf(ma[i])]) }],
    notes: [{ i: 6, key: 'calmHours' }, { i: peak, key: 'volBurst', args: { r: rng_[peak] }, warn: true }, { i: 56, key: 'maTrend', down: true }],
    checkpoints: [], ticks: niceTicks(lo0, Math.max(...Hi) + 4, 4),
    stats: { change: C[N - 1] / O[0] - 1, maxRange: rng_[peak], calmR, burstR },
  });
}

// Адіще 2. Гантт: критичний шлях проєкту. Задачі на ньому це платформи над прірвою, перерви між ними провалля,
// а задачі з резервом намальовано пунктиром: вони не на критичному шляху і героя не тримають
function gantt() {
  const dx = 2.7, rowH = 0.9, floor = -6;
  const T = [['brief', 0, 5, 1], ['data', 5, 6, 1], ['design', 6, 5, 0], ['model', 12, 4, 1], ['etl', 15, 7, 1], ['qa', 23, 3, 1], ['dash', 25, 6, 1],
    ['docs', 26, 4, 0], ['review', 32, 2, 1], ['fix', 34, 4, 1], ['uat', 39, 3, 1], ['train', 41, 5, 1], ['comms', 43, 3, 0], ['launch', 47, 2, 1], ['support', 49, 6, 1]];
  const top = T.length * rowH;
  const tasks = T.map(([key, st, dur, crit], r) => ({ key, st, dur, crit: !!crit, r, x0: st * dx, x1: (st + dur) * dx, y: top - r * rowH }));
  const cp = tasks.filter(t => t.crit), V = [], pits = [];
  let wait = 0;
  cp.forEach((t, k) => {
    const nx = cp[k + 1];
    if (!k) V.push([t.x0, t.y]);
    V.push([t.x1, t.y]);
    if (!nx) return;
    if (nx.x0 > t.x1 + 1e-6) {   // перерва на критичному шляху: провалля до наступної задачі
      V.push([t.x1, floor], [nx.x0, floor], [nx.x0, nx.y]);
      pits.push({ x0: t.x1, x1: nx.x0, y: nx.y - 0.9 });
      wait += nx.st - (t.st + t.dur);
    } else V.push([t.x1, nx.y]);   // наступна задача вже йде: уступ униз
  });
  const g = track(V);
  const end = cp[cp.length - 1].st + cp[cp.length - 1].dur;
  // точка даних посередині тієї частини задачі, на яку можна заїхати (початок може ховатися під попередньою)
  const samples = cp.map((t, i) => ({ i, x: ((i ? Math.max(t.x0, cp[i - 1].x1) : t.x0) + t.x1) / 2, v: t.dur, key: t.key }));
  return base('gantt', {
    kind: 'gantt', hell: true, tasks, pits, floor, rowH,
    // баги: [задача критичного шляху, відступ від її початку, летить]; один сидить там, куди приземляєшся після провалля
    bugAt: [[1, 6, 0], [2, 1.6, 0], [3, 7, 0], [4, 3.5, 1], [6, 2, 0], [8, 4, 0], [9, 4, 1], [10, 3, 1]].map(([k, d, f]) => [cp[k].x0 + d, f]),
    samples, terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf: v => v, unit: 'k', xTicks: niceTicks(0, end, 7).map(d => ({ x: d * dx, o: { k: 'dayN', n: d } })),
    notes: [{ i: 0, key: 'critPath' }, { i: 1, key: 'waitGap', warn: true, down: true }, { i: 5, key: 'slack' }, { i: 11, key: 'launch', args: { d: end } }],
    checkpoints: [], ticks: [],
    stats: { days: end, crit: cp.length, wait, tasks: tasks.length },
  });
}

// Адіще 3. Коридор: мінімум і максимум температури в холодильній камері за кожні 2 години.
// Мінімум це підлога, максимум це стеля: торкнувся стелі головою, і рівень спочатку
function tunnel() {
  const R = rng(131), N = 60, dx = 2.5, s = 0.62;
  const door = { 9: 4.6, 21: 5.8, 22: 2.2, 33: 4.1, 45: 6.2, 46: 2.6, 57: 3.8 }, defrost = { 15: 1.6, 16: 2.1, 39: 1.8, 40: 2.2 };
  const mn = [], mx = [];
  for (let i = 0; i < N; i++) {
    const h = (i % 12) * 2, night = h >= 0 && h < 6;   // ніч: камеру не відчиняють, коридор найвужчий
    const lo = 3.1 + 0.5 * Math.sin((2 * Math.PI * i) / 12) + 0.25 * gauss(R) + (defrost[i] || 0) * 0.7;
    const gap = (night ? 2.5 + 0.06 * gauss(R) : 3.1 + 0.3 * gauss(R)) + (door[i] || 0) + (defrost[i] || 0) * 0.4;
    mn.push(lo); mx.push(lo + Math.max(2.45, gap));
  }
  const xs = mn.map((_, i) => i * dx), yOf = v => v * s;
  const gf = geometry(xs, mn.map(yOf), 'smooth'), gc = geometry(xs, mx.map(yOf), 'smooth');
  const avg = mean(mn.map((v, i) => (v + mx[i]) / 2)), exc = mx.filter(v => v > 8).length;
  return base('tunnel', {
    kind: 'tunnel', hell: true, ceil: new Terrain(gc.X, gc.Y), ceilRange: [gf.x0, gf.x1], lim: 8, mins: mn, maxs: mx,
    bugSpots: [[7], [18], [27], [36], [43], [52]],
    samples: mn.map((v, i) => ({ i, x: xs[i], v })), terrain: new Terrain(gf.X, gf.Y), x0: gf.x0, x1: gf.x1,
    yOf, unit: 't', xLabel: i => ({ k: 'clock', n: (i % 12) * 2, d: Math.floor(i / 12) + 1 }), xEvery: 6,
    ghosts: [{ key: 'avg', style: 'dash', pts: xs.map((x, i) => [x, yOf((mn[i] + mx[i]) / 2)]) }],
    notes: [{ i: 1, key: 'nightSqueeze', down: true }, { i: 21, key: 'doorOpen', args: { v: mx[21] }, warn: true }, { i: 39, key: 'defrost' }, { i: 50, key: 'avgOk', args: { v: avg } }],
    checkpoints: [], ticks: [0, 2, 4, 6, 8, 10, 12],
    stats: { avg, exc, hours: exc * 2, max: Math.max(...mx) },
  });
}

// Адіще 4. Пила дебіторки: рахунки накопичуються щодня, клієнти платять пачками. Кожна оплата це обрив,
// а за ним новий підйом: на швидкості героя розбиває при приземленні. Дно пилки росте
function saw() {
  const R = rng(149), D = 120, dx = 1.6, s = 0.018;
  const pay = [9, 18, 28, 37, 46, 56, 65, 74, 84, 93, 102, 112];
  let b = 150, k = 0;
  const V = [], samples = [], mins = [];
  for (let d = 0; d <= D; d++) {
    b += 10.5 + 1.2 * gauss(R);   // нові рахунки за день
    const x = d * dx;
    if (pay.includes(d)) {
      const after = 150 + 10 * (k + 1) + 3 * gauss(R);   // після оплати лишається дедалі більше: дно росте
      V.push([x, b * s], [x, after * s]);
      mins.push({ d, v: after, before: b }); b = after; k++;
    } else V.push([x, b * s]);
    samples.push({ i: d, x, v: b });
  }
  const g = track(V);
  const first = mins[0].v, last = mins[mins.length - 1].v;
  return base('saw', {
    kind: 'saw', hell: true, pays: mins,
    bugSpots: [[16], [26], [44], [63], [82], [100], [110]],
    samples, terrain: new Terrain(g.X, g.Y), x0: g.x0, x1: g.x1,
    yOf: v => v * s, unit: 'k', xLabel: i => ({ k: 'day', n: i + 1 }), xEvery: 10,
    ghosts: [{ key: 'bottom', style: 'dash', pts: mins.map(m => [m.d * dx, m.v * s]) }],
    notes: [{ i: 9, key: 'payBatch', args: { v: mins[0].before - mins[0].v } }, { i: 40, key: 'peaks' }, { i: 84, key: 'bottomRises', args: { a: first, b: last }, warn: true, down: true }],
    checkpoints: [], ticks: niceTicks(100, 400, 50),
    stats: { first, last, growth: last / first - 1, pays: mins.length },
  });
}

const BUILDERS = { trend, hist, season, pareto, outliers, axis, stacked, waterfall, log, control, multiples, forecast, candles, gantt, tunnel, saw };
export function buildLevel(id) {
  const L = BUILDERS[id]();
  L.diff = DIFF[id];
  if (LIMIT[id]) L.limit = LIMIT[id];
  L.pits = L.pits || [];
  L.spawnX = L.x0 - 9;
  L.finishX = L.x1 + 7;
  L.checkpoints = L.checkpoints.map(x => ({ x, hit: false }));
  // баги даних: сидять на лінії між точками (або над нею, якщо летять); на стовпчиках ближче до правого краю
  const S = L.samples, onBar = L.kind === 'bars' || L.kind === 'waterfall';
  L.bugs = L.bugAt ? L.bugAt.map(([x, fly]) => ({ x, fly: !!fly, alive: true, dead: null }))
    : (L.bugSpots || []).map(([i, fly]) => ({ x: onBar ? S[i].x + L.barW * 0.25 : (S[i].x + S[Math.min(S.length - 1, i + 1)].x) / 2, fly: !!fly, alive: true, dead: null }));
  L.terrain.applyMorphs();
  return L;
}
