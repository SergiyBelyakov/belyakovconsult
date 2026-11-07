// Фізико-географічні показники громади на сітці 250 м: форми рельєфу, експозиція, сонячна радіація, клімат,
// ґрунтові води, ґрунти, земний покрив, ерозія, повторюваність паводків.
// Дані синтетичні, але формули й порядок величин узято з практики для лісостепу України.
// Рахується один раз і кешується в T.geo (≈100 мс).
import { GX, GY, STEP, WORLD, flood, floodStageOf, makeNoise, STREAM_MIN } from './dem.js';
import { mulberry32 } from '../../transport-demo/src/model.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pctl = (arr, p) => { const s = Float32Array.from(arr).sort(); return s[Math.floor(p * (s.length - 1))]; };
const CELL_KM2 = STEP * STEP, CELL_HA = CELL_KM2 * 100;
// Схили на сітці 250 м занижені проти реальних (30 м). Для ерозії, інсоляції й мікроклімату
// перераховуємо їх до дрібнішого масштабу сталим коефіцієнтом.
export const SLOPE_K = 1.8;

// Кліматичні норми умовної метеостанції в центрі громади (1991–2020)
export const CLIMATE = {
  t: [-4.6, -3.8, 0.8, 8.6, 14.6, 18.1, 20.0, 19.2, 13.8, 7.9, 2.2, -2.3],   // °C
  p: [36, 34, 34, 40, 60, 78, 86, 62, 54, 40, 40, 42],                        // мм
  wind: { freq: [9, 7, 9, 11, 12, 13, 21, 18], speed: [3.4, 3.2, 3.3, 3.4, 3.5, 3.8, 4.2, 4.0], calm: 7 }, // Пн, ПнСх, … ПнЗх
  frostFree: 166, activeSum: 2720, sunshine: 1880, snowDays: 86, insol: 1150,
};
export const T0 = CLIMATE.t.reduce((a, b) => a + b, 0) / 12;
export const P0 = CLIMATE.p.reduce((a, b) => a + b, 0);
// Гідротермічний коефіцієнт Селянінова: опади за місяці з t > 10 °C × 10 / сума активних температур
export const HTC = (CLIMATE.p.filter((_, i) => CLIMATE.t[i] > 10).reduce((a, b) => a + b, 0) * 10) / CLIMATE.activeSum;

// Паводки: річні максимуми підйому рівня за розподілом Гумбеля
export const GUMBEL = { mu: 1.0, beta: 1.1 };
export const annualChance = s => 1 - Math.exp(-Math.exp(-(s - GUMBEL.mu) / GUMBEL.beta));
export const returnPeriod = s => 1 / annualChance(s);

// Ґрунти: колір на карті, гумус %, pH, бал бонітету, коефіцієнт еродованості K (RUSLE)
export const SOILS = [
  { id: 'chern', color: '#73401a', humus: 4.8, ph: 6.9, bon: 90, k: 0.030 },
  { id: 'podz', color: '#a4732b', humus: 3.6, ph: 6.1, bon: 76, k: 0.033 },
  { id: 'gray', color: '#aa97bf', humus: 2.1, ph: 5.5, bon: 54, k: 0.038 },
  { id: 'sand', color: '#ebd87e', humus: 1.1, ph: 5.1, bon: 31, k: 0.018 },
  { id: 'alluv', color: '#64b87c', humus: 3.0, ph: 6.7, bon: 62, k: 0.028 },
  { id: 'bog', color: '#4378b2', humus: 8.5, ph: 5.8, bon: 34, k: 0.012 },
  { id: 'eroded', color: '#fe893a', humus: 2.7, ph: 7.1, bon: 47, k: 0.042 },
];
// Земний покрив: колір і коефіцієнт рослинного покриву C (RUSLE)
export const COVERS = [
  { id: 'water', color: '#2d68c9', c: 0 },
  { id: 'built', color: '#dedfec', c: 0 },
  { id: 'forest', color: '#12573c', c: 0.003 },
  { id: 'arable', color: '#eeb44e', c: 0.24 },
  { id: 'meadow', color: '#829a13', c: 0.03 },
  { id: 'wetland', color: '#33a5bb', c: 0 },
];
export const MORPHS = ['valley', 'lower', 'flat', 'mid', 'upper', 'ridge'];
export const ASPECTS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
export const EROSION_BREAKS = [2, 5, 10];   // т/га на рік: допустимо, слабка, помірна, сильна
export const GW_BREAKS = [1, 3, 10];        // м: дуже близько, близько, середньо, глибоко
export const classOf = (v, br) => (v < br[0] ? 0 : v < br[1] ? 1 : v < br[2] ? 2 : 3);
export const RUSLE_R = 650;                 // ерозійний потенціал опадів, МДж·мм/(га·год·рік)

// Середній напрямок прямого сонячного проміння за рік для 50,4° пн. ш. (схід, північ, верх), зважений інтенсивністю
function sunVector(lat = 50.4) {
  const phi = (lat * Math.PI) / 180;
  let e = 0, n = 0, u = 0;
  for (let d = 0; d < 365; d += 3) {
    const dec = ((23.44 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + d)) / 365);
    for (let h = 3; h <= 21; h += 0.25) {
      const w = ((h - 12) * 15 * Math.PI) / 180;
      const se = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(w);
      if (se <= 0.03) continue;
      const elev = Math.asin(se), az = Math.atan2(Math.sin(w), Math.cos(w) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
      const am = 1 / (se + 0.50572 * ((elev * 180) / Math.PI + 6.07995) ** -1.6364);
      const I = 0.7 ** (am ** 0.678), hor = Math.cos(elev);
      e += -I * hor * Math.sin(az); n += -I * hor * Math.cos(az); u += I * se;
    }
  }
  return [e / u, n / u, 1];
}

export function geo(T) {
  if (T.geo) return T.geo;
  const N = GX * GY, H = T.H, noise = makeNoise(mulberry32(777));
  const X = k => ((k % GX) + 0.5) * STEP, Y = k => (((k / GX) | 0) + 0.5) * STEP;
  const ins = [];
  for (let k = 0; k < N; k++) if (T.INSIDE[k]) ins.push(k);

  // ——— схил, експозиція, нормаль ———
  const ASPECT = new Float32Array(N), SF = new Float32Array(N), NX = new Float32Array(N), NY = new Float32Array(N), NZ = new Float32Array(N);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const at = (a, b) => H[clamp(b, 0, GY - 1) * GX + clamp(a, 0, GX - 1)], k = j * GX + i;
    const dzdx = (SLOPE_K * (at(i + 1, j) - at(i - 1, j))) / (2 * STEP * 1000), dzdy = (SLOPE_K * (at(i, j + 1) - at(i, j - 1))) / (2 * STEP * 1000);
    const l = Math.hypot(dzdx, dzdy, 1);
    NX[k] = -dzdx / l; NY[k] = dzdy / l; NZ[k] = 1 / l;      // схід, північ, верх
    ASPECT[k] = T.SLOPE[k] < 0.12 ? -1 : (((Math.atan2(-dzdx, dzdy) * 180) / Math.PI) + 360) % 360;
    SF[k] = ASPECT[k] < 0 ? 0 : -Math.cos((ASPECT[k] * Math.PI) / 180) * Math.min(1, (SLOPE_K * T.SLOPE[k]) / 3);
  }

  // ——— форми рельєфу: індекс топографічної позиції (висота мінус середня в радіусі ≈1,4 км) ———
  const W1 = GX + 1, SAT = new Float64Array((GX + 1) * (GY + 1));
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) SAT[(j + 1) * W1 + i + 1] = H[j * GX + i] + SAT[j * W1 + i + 1] + SAT[(j + 1) * W1 + i] - SAT[j * W1 + i];
  const TPI = new Float32Array(N), R = 5;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const a = Math.max(0, i - R), b = Math.max(0, j - R), c = Math.min(GX, i + R + 1), d = Math.min(GY, j + R + 1);
    TPI[j * GX + i] = H[j * GX + i] - (SAT[d * W1 + c] - SAT[b * W1 + c] - SAT[d * W1 + a] + SAT[b * W1 + a]) / ((c - a) * (d - b));
  }
  let sd = 0; for (const k of ins) sd += TPI[k] ** 2; sd = Math.sqrt(sd / ins.length) || 1;
  const TPIZ = TPI.map(v => v / sd);
  const midSlope = pctl(ins.filter(k => Math.abs(TPIZ[k]) <= 0.5).map(k => T.SLOPE[k]), 0.6);
  const MORPH = new Uint8Array(N);
  for (let k = 0; k < N; k++) { const z = TPIZ[k]; MORPH[k] = z < -1 ? 0 : z < -0.5 ? 1 : z <= 0.5 ? (T.SLOPE[k] < midSlope ? 2 : 3) : z <= 1 ? 4 : 5; }

  // ——— вода: висота над найближчим водотоком (HAND), западини, перша стадія затоплення ———
  const DRAIN = new Float32Array(N), HAND = new Float32Array(N), DEP = new Uint8Array(N);
  const asc = Uint32Array.from({ length: N }, (_, k) => k).sort((a, b) => T.HF[a] - T.HF[b]);
  for (const k of asc) {
    const d = T.DIR[k];
    DRAIN[k] = T.D[k] < 0.12 || T.ACC[k] >= STREAM_MIN || d < 0 ? H[k] : DRAIN[d];
    HAND[k] = Math.max(0, H[k] - DRAIN[k]);
    DEP[k] = T.HF[k] - H[k] > 1 ? 1 : 0;
  }
  floodStageOf(T);
  const FS = new Float32Array(N).fill(99);
  for (let s = 0; s <= 50; s++) { const st = s / 5, Wf = flood(T, st).W; for (let k = 0; k < N; k++) if (Wf[k] && FS[k] > 50) FS[k] = st; }
  const GW = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    if (T.D[k] < 0.12) { GW[k] = 0; continue; }
    let g = (0.5 + 0.32 * HAND[k] ** 0.93) * (1 + 0.18 * noise(X(k) + 17, Y(k) + 3, 2.2));
    if (DEP[k]) g = Math.min(g, 0.45);
    if (FS[k] <= 1 && T.D[k] > 0.3) g = Math.min(g, 0.7);
    GW[k] = clamp(g, 0.2, 40);
  }

  // ——— ґрунти: правила за положенням у рельєфі, водою й заплавою ———
  const river = T.base.river;
  const riverY = x => { for (let s = 1; s < river.length; s++) if (river[s][0] >= x) { const [ax, ay] = river[s - 1], [bx, by] = river[s]; return ay + (by - ay) * clamp((x - ax) / (bx - ax || 1), 0, 1); } return river[river.length - 1][1]; };
  const sEr = Math.max(0.7, pctl(ins.map(k => T.SLOPE[k]), 0.86));
  const hp = [pctl(ins.map(k => H[k]), 0.55), pctl(ins.map(k => H[k]), 0.95)];
  const SOIL = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const x = X(k), y = Y(k);
    if (T.D[k] < 0.12) { SOIL[k] = 255; continue; }
    const fpw = 0.6 + 1.6 * sstep(22, 40, x), north = y < riverY(x);
    const gray = (H[k] - hp[0]) / (hp[1] - hp[0]) + 0.5 * noise(x + 40, y, 5) + 0.25 * TPIZ[k] - 1.4 * Math.max(0, x / WORLD.w - 0.4);
    const chern = (x / WORLD.w - 0.4) * 2.6 + 0.65 * noise(x + 9, y + 21, 6) - 0.25 * Math.max(0, TPIZ[k]);
    SOIL[k] = DEP[k] || (FS[k] <= 1.2 && T.D[k] > 0.25 && noise(x + 7, y + 3, 0.8) > -0.1) ? 5
      : FS[k] <= 4 || (HAND[k] < 1.2 && T.ACC[k] >= STREAM_MIN * 0.6) ? 4
      : GW[k] < 0.7 && T.SLOPE[k] < 0.6 ? 5
      : T.SLOPE[k] >= sEr && GW[k] > 1 ? 6
      : north && T.D[k] > fpw + 0.15 && T.D[k] < fpw + 4.5 && HAND[k] > 2 && HAND[k] < 30 && noise(x, y, 2.6) > -0.3 ? 3
      : gray > 0.45 ? 2
      : chern > 0 ? 0 : 1;
  }

  // ——— земний покрив ———
  const BUILT = new Uint8Array(N);
  T.places.forEach(p => {
    const r = 0.3 + Math.sqrt(p.pop) / 110, ri = Math.ceil((r * 1.4) / STEP), ci = Math.floor(p.x / STEP), cj = Math.floor(p.y / STEP);
    for (let j = cj - ri; j <= cj + ri; j++) for (let i = ci - ri; i <= ci + ri; i++) {
      if (i < 0 || j < 0 || i >= GX || j >= GY) continue;
      const x = (i + 0.5) * STEP, y = (j + 0.5) * STEP;
      if (Math.hypot(x - p.x, y - p.y) < r * (1 + 0.35 * noise(x + 3, y + 3, 0.6))) BUILT[j * GX + i] = 1;
    }
  });
  const LC = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const x = X(k), y = Y(k), s = SOIL[k];
    if (s === 255) { LC[k] = 0; continue; }
    if (BUILT[k]) { LC[k] = 1; continue; }
    if (s === 5) { LC[k] = 5; continue; }
    if (s === 3) { LC[k] = noise(x + 5, y + 11, 1.6) > -0.45 ? 2 : 4; continue; }
    if (s === 2) { LC[k] = noise(x + 21, y + 2, 2.3) > -0.05 ? 2 : 3; continue; }
    if (s === 6) { const r = noise(x + 2, y + 8, 1.1); LC[k] = r > 0.35 ? 2 : r > -0.15 ? 4 : 3; continue; }
    if (s === 4) { LC[k] = FS[k] > 2.6 && noise(x, y + 7, 1.5) > 0.3 ? 3 : 4; continue; }
    LC[k] = 3;
  }

  // ——— клімат і сонячна радіація ———
  const href = T.byId.get('vrc').h, sun = sunVector();
  const TEMP = new Float32Array(N), FFD = new Float32Array(N), ACT = new Float32Array(N), PREC = new Float32Array(N), INSOL = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const dH = H[k] - href, x = X(k), y = Y(k), tz = clamp(TPIZ[k], -2, 1.5), urb = LC[k] === 1 ? 1 : 0;
    TEMP[k] = T0 - 0.0065 * dH + 0.16 * tz + 0.22 * SF[k] + 0.35 * urb;
    FFD[k] = CLIMATE.frostFree - 0.06 * dH + 8 * tz + 4 * SF[k] + 5 * urb;
    ACT[k] = CLIMATE.activeSum + 215 * (TEMP[k] - T0) + 25 * SF[k];
    PREC[k] = P0 + 0.28 * dH + 15 * (1 - (2 * x) / WORLD.w) + 5 * noise(x + 3, y + 3, 4);
    const beam = Math.max(0, NX[k] * sun[0] + NY[k] * sun[1] + NZ[k] * sun[2]);
    INSOL[k] = CLIMATE.insol * (0.5 * beam + 0.5 * (1 + NZ[k]) / 2);
  }

  // ——— ерозія ґрунту за RUSLE: A = R · K · LS · C ———
  const EROS = new Float32Array(N), BON = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const s = SOIL[k];
    if (s === 255) continue;
    const sl = (SLOPE_K * T.SLOPE[k] * Math.PI) / 180, As = Math.min(T.ACC[k], 5) * STEP * 1000;
    const LS = (As / 22.13) ** 0.4 * (Math.sin(sl) / 0.0896) ** 1.3;
    EROS[k] = RUSLE_R * (PREC[k] / P0) ** 1.5 * SOILS[s].k * LS * COVERS[LC[k]].c;
    BON[k] = clamp(SOILS[s].bon + 5 * noise(X(k) + 1, Y(k) + 1, 1.8) - (s === 6 ? 6 * Math.max(0, T.SLOPE[k] - sEr) : 0), 8, 100);
  }

  const G = { ASPECT, SF, TPIZ, MORPH, HAND, DEP, FS, GW, SOIL, LC, TEMP, FFD, ACT, PREC, INSOL, EROS, BON, ins, sEr, midSlope };
  G.range = {};
  for (const [id, A] of Object.entries({ TEMP, FFD, ACT, PREC, INSOL, BON })) {
    const v = ins.map(k => A[k]);
    G.range[id] = [pctl(v, 0.02), pctl(v, 0.98), v.reduce((a, b) => a + b, 0) / v.length];
  }
  G.range.SLOPE = [0, pctl(ins.map(k => T.SLOPE[k]), 0.99)];
  G.summary = summarize(T, G);
  T.geo = G;
  return G;
}

// Частки площі, водотоки, ерозія, ґрунтові води, паводки, населені пункти
function summarize(T, G) {
  const { ins } = G, area = ins.length * CELL_KM2;
  const shares = (A, n) => { const c = new Array(n).fill(0); for (const k of ins) if (A[k] < n) c[A[k]]++; return c.map(v => ({ km2: v * CELL_KM2, share: v / ins.length })); };
  const soil = shares(G.SOIL, SOILS.length), cover = shares(G.LC, COVERS.length), morph = shares(G.MORPH, MORPHS.length);
  const asp = new Array(9).fill(0);
  for (const k of ins) asp[G.ASPECT[k] < 0 ? 8 : Math.round(G.ASPECT[k] / 45) % 8]++;
  const aspect = asp.map(v => v / ins.length);
  // ерозія лише на ріллі
  const arable = ins.filter(k => G.LC[k] === 3), ec = [0, 0, 0, 0];
  let loss = 0;
  for (const k of arable) { ec[classOf(G.EROS[k], EROSION_BREAKS)]++; loss += G.EROS[k] * CELL_HA; }
  const erosion = { classes: ec.map(v => ({ km2: v * CELL_KM2, share: v / arable.length })), mean: loss / (arable.length * CELL_HA), total: loss, arableKm2: arable.length * CELL_KM2 };
  const gc = [0, 0, 0, 0];
  for (const k of ins) if (G.SOIL[k] !== 255) gc[classOf(G.GW[k], GW_BREAKS)]++;
  const gw = gc.map(v => ({ km2: v * CELL_KM2, share: v / ins.length }));
  // водотоки: довжина відрізків усередині громади
  let len = 0;
  for (const s of T.streams) for (let i = 1; i < s.pts.length; i++) {
    const a = s.pts[i - 1], b = s.pts[i], c = Math.floor((a[1] + b[1]) / 2 / STEP) * GX + Math.floor((a[0] + b[0]) / 2 / STEP);
    if (T.INSIDE[c]) len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  let riverLen = 0;
  const rv = T.base.river;
  for (let i = 1; i < rv.length; i++) { const c = Math.floor((rv[i][1] + rv[i - 1][1]) / 2 / STEP) * GX + Math.floor((rv[i][0] + rv[i - 1][0]) / 2 / STEP); if (c >= 0 && c < GX * GY && T.INSIDE[c]) riverLen += Math.hypot(rv[i][0] - rv[i - 1][0], rv[i][1] - rv[i - 1][1]); }
  const water = { streamKm: len, riverKm: riverLen, density: (len + riverLen) / area };
  // повторюваність: стадія → площа, села, мешканці, відрізані
  const recurrence = [1, 2, 3, 4, 5, 6, 7, 8, 10].map(s => { const f = flood(T, s); return { stage: s, period: returnPeriod(s), chance: annualChance(s), area: f.area, places: f.places.length, pop: f.pop, isolated: f.isolated.length }; });
  // населені пункти: умови в центрі й навколо
  const st = floodStageOf(T);
  const places = T.places.map(p => {
    const k = p.cell, near = [], ring = [];
    const ri = Math.ceil(2 / STEP), ci = k % GX, cj = (k / GX) | 0;
    for (let j = cj - ri; j <= cj + ri; j++) for (let i = ci - ri; i <= ci + ri; i++) {
      if (i < 0 || j < 0 || i >= GX || j >= GY) continue;
      const c = j * GX + i, d = Math.hypot((i - ci) * STEP, (j - cj) * STEP);
      if (d <= 2 && G.LC[c] === 3) near.push(G.EROS[c]);
      if (d <= 0.6) ring.push(c);
    }
    const soilAt = mode(ring.map(c => G.SOIL[c]).filter(s => s !== 255)) ?? 0;
    return {
      p, h: p.h, soil: soilAt, gw: G.GW[k], ffd: G.FFD[k], temp: G.TEMP[k], insol: G.INSOL[k],
      eros: near.length ? near.reduce((a, b) => a + b, 0) / near.length : 0, arableNear: near.length * CELL_KM2,
      stage: st.has(p.id) ? st.get(p.id) : null,
    };
  });
  return { area, soil, cover, morph, aspect, erosion, gw, water, recurrence, places };
}
function mode(arr) { const m = new Map(); let best = null, bc = 0; for (const v of arr) { const c = (m.get(v) || 0) + 1; m.set(v, c); if (c > bc) { bc = c; best = v; } } return best; }

// Показники однієї клітинки для підказки над моделлю
export function cellInfo(T, k) {
  const G = geo(T);
  return {
    k, h: T.H[k], slope: T.SLOPE[k], aspect: G.ASPECT[k], morph: G.MORPH[k], soil: G.SOIL[k], cover: G.LC[k], gw: G.GW[k],
    temp: G.TEMP[k], prec: G.PREC[k], ffd: G.FFD[k], insol: G.INSOL[k], eros: G.EROS[k], bon: G.BON[k],
    stage: G.FS[k] <= 10 ? G.FS[k] : null, river: T.D[k] < 0.12, inside: !!T.INSIDE[k],
  };
}

// Нові сигнали на природних показниках
export function geoSignals(T) {
  const S = geo(T).summary;
  return {
    waterlog: S.places.filter(x => x.gw < 1.5 && (x.stage == null || x.stage > 7)).map(x => ({ p: x.p, gw: x.gw, level: x.gw < 0.9 ? 'critical' : 'warning' })).sort((a, b) => a.gw - b.gw),
    erosion: S.places.filter(x => x.eros > 4 && x.arableNear > 1).map(x => ({ p: x.p, eros: x.eros, level: x.eros > 5.5 ? 'critical' : 'warning' })).sort((a, b) => b.eros - a.eros),
  };
}
