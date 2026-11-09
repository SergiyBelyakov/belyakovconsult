// Рівні гри: кожна траса це графік даних з типовою для звітів ситуацією.
// Дані синтетичні й детерміновані (той самий ряд щоразу), тож рекорд і розбір рівня завжди про ту саму трасу.
// Значення v переводяться у висоту траси y (метри) через шкалу рівня; «ворота» змінюють шкалу ділянки попереду.
import { Terrain } from './terrain.js';

export const LEVEL_IDS = ['trend', 'season', 'outliers', 'axis', 'log', 'forecast'];
const COLORS = { trend: '#60A5FA', season: '#2DD4BF', outliers: '#C084FC', axis: '#22D3EE', log: '#F472B6', forecast: '#60A5FA' };

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

const BUILDERS = { trend, season, outliers, axis, log, forecast };
export function buildLevel(id) {
  const L = BUILDERS[id]();
  L.spawnX = L.x0 - 9;
  L.finishX = L.x1 + 7;
  L.checkpoints = L.checkpoints.map(x => ({ x, hit: false }));
  // баги даних: сидять на лінії між точками (або над нею, якщо летять); на стовпчиках ближче до правого краю
  const S = L.samples;
  L.bugs = (L.bugSpots || []).map(([i, fly]) => ({ x: L.kind === 'bars' ? S[i].x + L.barW * 0.25 : (S[i].x + S[Math.min(S.length - 1, i + 1)].x) / 2, fly: !!fly, alive: true, dead: null }));
  L.terrain.applyMorphs();
  return L;
}
