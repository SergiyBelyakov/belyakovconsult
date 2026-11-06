// Синтетичний рельєф під умовною громадою з демо транспортної доступності та аналізи на ньому:
// затоплення від рівня річки, видимість і покриття (сирени, вежі зв'язку), схили, придатність ділянок, сигнали.
// Висоти в метрах, координати в кілометрах (x праворуч, y донизу), крок сітки 250 м.
import { buildBase, mulberry32 } from '../../transport-demo/src/model.js';
import { WORLD, BOUNDARY, FACILITIES } from '../../transport-demo/src/data.js';

export const STEP = 0.25;
export const GX = Math.round(WORLD.w / STEP), GY = Math.round(WORLD.h / STEP);
export { WORLD, FACILITIES };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  const x = ax + t * dx, y = ay + t * dy;
  return [Math.hypot(px - x, py - y), t];
}
function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Рівень води в річці в нормі: падає із заходу на схід
export const riverLevel = x => 118 - 14 * clamp(x / WORLD.w, 0, 1);

// Низини біля сіл: «язики» заплави від річки до села. s: на скільки метрів має піднятися вода, щоб дійти до центру села
const LOBES = [
  { place: 'ost', s: 2.2, r: 1.6 }, { place: 'zap', s: 3.0, r: 1.9 }, { place: 'luh', s: 4.2, r: 1.6 },
  { place: 'mal', s: 5.4, r: 1.2 }, { place: 'vre', s: 6.6, r: 1.1 }, { place: 'ber', s: 7.4, r: 1.0 },
];
const HILLS = [[8, 4, 95, 7], [28, 1.5, 70, 6], [47, 11, 62, 6], [13, 36, 55, 7], [45, 36, 40, 6], [34, 33, 35, 4], [4, 24, 40, 5]];

export function buildTerrain() {
  const base = buildBase();
  const river = base.river;
  const rnd = mulberry32(31337);
  // шум: гладкий value noise кількох масштабів
  const LW = 64, LH = 48, lat = Float32Array.from({ length: LW * LH }, () => rnd() * 2 - 1);
  const g = (i, j) => lat[((j % LH) + LH) % LH * LW + (((i % LW) + LW) % LW)];
  const noise = (x, y, sc) => {
    const fx = x / sc, fy = y / sc, i = Math.floor(fx), j = Math.floor(fy), u = sstep(0, 1, fx - i), v = sstep(0, 1, fy - j);
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };
  const lobes = LOBES.map(l => {
    const p = base.byId.get(l.place);
    let best = [1e9, 0, 0];
    river.forEach(([rx, ry]) => { const d = Math.hypot(rx - p.x, ry - p.y); if (d < best[0]) best = [d, rx, ry]; });
    return { ...l, x: p.x, y: p.y, rx: best[1], ry: best[2] };
  });
  const H = new Float32Array(GX * GY), D = new Float32Array(GX * GY), INSIDE = new Uint8Array(GX * GY);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const x = (i + 0.5) * STEP, y = (j + 0.5) * STEP, k = j * GX + i;
    let d = 1e9;
    for (let s = 1; s < river.length; s++) { const [dd] = segDist(x, y, river[s - 1][0], river[s - 1][1], river[s][0], river[s][1]); if (dd < d) d = dd; }
    D[k] = d;
    const h0 = riverLevel(x);
    const fpw = 0.6 + 1.6 * sstep(22, 40, x);
    const n = noise(x, y, 9) * 0.6 + noise(x + 31, y + 17, 3.5) * 0.3 + noise(x + 7, y + 41, 1.4) * 0.1;
    let hills = 0;
    for (const [hx, hy, a, r] of HILLS) hills += a * Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (r * r));
    let h;
    if (d < 0.12) h = h0 - 2.2;
    else if (d < fpw) h = h0 + 0.7 + 3.0 * (d / fpw) ** 1.6 + n * 0.6;
    else { const e = d - fpw; h = h0 + 3.7 + 48 * (1 - Math.exp(-e / 4)) + 0.9 * e + n * 16 + hills; }
    // язики заплави: від річки до села висота плавно росте до (рівень + s)
    for (const L of lobes) {
      const [dl, t] = segDist(x, y, L.rx, L.ry, L.x, L.y);
      if (dl < L.r * 1.8) {
        const hl = riverLevel(L.x) + 0.6 + (L.s - 0.9) * t + 7 * (dl / L.r) ** 2 + n * 0.3;
        h = Math.min(h, hl);
      }
    }
    H[k] = h;
    INSIDE[k] = inside([x, y], BOUNDARY) ? 1 : 0;
  }
  // схил у градусах
  const SLOPE = new Float32Array(GX * GY);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const at = (a, b) => H[clamp(b, 0, GY - 1) * GX + clamp(a, 0, GX - 1)];
    const dzdx = (at(i + 1, j) - at(i - 1, j)) / (2 * STEP * 1000), dzdy = (at(i, j + 1) - at(i, j - 1)) / (2 * STEP * 1000);
    SLOPE[j * GX + i] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  }
  // відстань до найближчої дороги (км), хвильовий прохід від точок доріг
  const ROADD = new Float32Array(GX * GY).fill(99);
  const q = [];
  base.roads.forEach(r => r.pts.forEach((p, k) => {
    if (k === 0) return;
    const a = r.pts[k - 1], len = Math.hypot(p[0] - a[0], p[1] - a[1]), n = Math.max(1, Math.ceil(len / (STEP / 2)));
    for (let s = 0; s <= n; s++) { const x = a[0] + (p[0] - a[0]) * s / n, y = a[1] + (p[1] - a[1]) * s / n, c = cellAt(x, y); if (c >= 0 && ROADD[c] > 0) { ROADD[c] = 0; q.push(c); } }
  }));
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % GX, j = (c / GX) | 0;
    for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GX || b >= GY) continue;
      const nc = b * GX + a, nd = ROADD[c] + w * STEP;
      if (nd < ROADD[nc] - 1e-6) { ROADD[nc] = nd; q.push(nc); }
    }
  }
  const places = base.places.map(p => ({ ...p, cell: cellAt(p.x, p.y), h: H[cellAt(p.x, p.y)] }));
  const facilities = FACILITIES.filter(fc => !fc.outside).map(fc => { const p = base.byId.get(fc.node); return { ...fc, x: p.x + 0.25, y: p.y - 0.2, cell: cellAt(p.x + 0.25, p.y - 0.2), place: p.id }; });
  let min = 1e9, max = -1e9;
  for (let k = 0; k < H.length; k++) if (INSIDE[k]) { if (H[k] < min) min = H[k]; if (H[k] > max) max = H[k]; }
  return { base, H, D, SLOPE, ROADD, INSIDE, places, facilities, min, max, lobes, byId: new Map(places.map(p => [p.id, p])), cache: new Map() };
}

export function cellAt(x, y) {
  const i = Math.floor(x / STEP), j = Math.floor(y / STEP);
  return i < 0 || j < 0 || i >= GX || j >= GY ? -1 : j * GX + i;
}
export const cellXY = c => [((c % GX) + 0.5) * STEP, (((c / GX) | 0) + 0.5) * STEP];

// ——— затоплення: вода піднімається на stage метрів над нормою і заходить у з'єднані з руслом низини ———
export function flood(T, stage) {
  const key = 'f' + stage.toFixed(1);
  if (T.cache.has(key)) return T.cache.get(key);
  const W = new Uint8Array(GX * GY), q = [];
  for (let k = 0; k < W.length; k++) if (T.D[k] < 0.12) { W[k] = 1; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % GX, j = (c / GX) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GX || b >= GY) continue;
      const nc = b * GX + a;
      if (!W[nc] && T.H[nc] <= riverLevel((a + 0.5) * STEP) + stage) { W[nc] = 1; q.push(nc); }
    }
  }
  let area = 0;
  for (let k = 0; k < W.length; k++) if (W[k] && T.INSIDE[k] && T.D[k] >= 0.12) area += STEP * STEP;
  const near = (x, y, r) => { for (let dy = -r; dy <= r; dy += STEP) for (let dx = -r; dx <= r; dx += STEP) { const c = cellAt(x + dx, y + dy); if (c >= 0 && W[c] && T.D[c] >= 0.12) return true; } return false; };
  const places = T.places.filter(p => W[p.cell] || near(p.x, p.y, 0.25));
  const facilities = T.facilities.filter(fc => W[fc.cell]);
  // дороги: ребро затоплене, якщо його середина під водою (мости над руслом не топимо)
  const base = T.base, cut = new Set();
  base.edges.forEach((e, ei) => {
    const x = (base.X[e.u] + base.X[e.v]) / 2, y = (base.Y[e.u] + base.Y[e.v]) / 2, c = cellAt(x, y);
    if (c >= 0 && W[c] && !(e.bridge && T.D[c] < 0.6)) cut.add(ei);
  });
  // хто втратив дорогу до лікарні громади (у Великій Руті) і до лікарні сусідньої громади
  const adj = new Map();
  base.edges.forEach((e, ei) => {
    if (cut.has(ei) || (e.bridge === 'b3')) return;
    if (!adj.has(e.u)) adj.set(e.u, []); if (!adj.has(e.v)) adj.set(e.v, []);
    adj.get(e.u).push(e.v); adj.get(e.v).push(e.u);
  });
  const seen = new Set([base.idx.get('vrc'), base.idx.get('nb')]), bq = [...seen];
  for (let h = 0; h < bq.length; h++) for (const n of adj.get(bq[h]) || []) if (!seen.has(n)) { seen.add(n); bq.push(n); }
  const isolated = T.places.filter(p => !seen.has(p.node));
  const cutRoads = new Set([...cut].map(ei => base.edges[ei].road));
  const res = { W, area, places, facilities, isolated, cutRoads, pop: places.reduce((a, p) => a + p.pop, 0), isoPop: isolated.reduce((a, p) => a + p.pop, 0) };
  T.cache.set(key, res);
  return res;
}

// Стадія, за якої вода вперше доходить до кожного села (для таблиці й сигналів)
export function floodStageOf(T) {
  if (T.cache.has('stages')) return T.cache.get('stages');
  const out = new Map();
  for (let s = 0; s <= 10.0001; s += 0.2) { const f = flood(T, Math.round(s * 10) / 10); f.places.forEach(p => { if (!out.has(p.id)) out.set(p.id, Math.round(s * 10) / 10); }); }
  T.cache.set('stages', out);
  return out;
}

// ——— видимість із точки: промені від спостерігача, прямий огляд до землі + 2 м ———
export const COVER = { siren: { h: 15, r: 3 }, tower: { h: 40, r: 12 } };
export function viewshed(T, cell, kind) {
  const key = 'v' + kind + cell;
  if (T.cache.has(key)) return T.cache.get(key);
  const { h: oh, r } = COVER[kind];
  const [ox, oy] = cellXY(cell), oz = T.H[cell] + oh;
  const V = new Uint8Array(GX * GY);
  const ri = Math.ceil(r / STEP), ci = cell % GX, cj = (cell / GX) | 0;
  for (let j = Math.max(0, cj - ri); j <= Math.min(GY - 1, cj + ri); j++) for (let i = Math.max(0, ci - ri); i <= Math.min(GX - 1, ci + ri); i++) {
    const tx = (i + 0.5) * STEP, ty = (j + 0.5) * STEP, dist = Math.hypot(tx - ox, ty - oy);
    if (dist > r) continue;
    const k = j * GX + i, tz = T.H[k] + 2;
    const n = Math.max(1, Math.ceil(dist / (STEP * 0.8)));
    let ok = true;
    for (let s = 1; s < n; s++) {
      const f = s / n, c = cellAt(ox + (tx - ox) * f, oy + (ty - oy) * f);
      if (c >= 0 && T.H[c] > oz + (tz - oz) * f) { ok = false; break; }
    }
    if (ok) V[k] = 1;
  }
  T.cache.set(key, V);
  return V;
}
// Кандидати: для сирен центри населених пунктів, для веж локальні вершини
export function candidates(T, kind) {
  const key = 'cand' + kind;
  if (T.cache.has(key)) return T.cache.get(key);
  let out;
  if (kind === 'siren') out = T.places.map(p => ({ id: p.id, cell: p.cell, place: p.id }));
  else {
    const R = Math.round(1.0 / STEP), peaks = [];
    for (let j = R; j < GY - R; j++) for (let i = R; i < GX - R; i++) {
      const k = j * GX + i; if (!T.INSIDE[k] || T.H[k] < T.min + (T.max - T.min) * 0.3) continue;
      let top = true;
      for (let b = -R; b <= R && top; b++) for (let a = -R; a <= R; a++) if (T.H[(j + b) * GX + i + a] > T.H[k]) { top = false; break; }
      if (top) peaks.push(k);
    }
    out = peaks.sort((a, b) => T.H[b] - T.H[a]).slice(0, 24).map((cell, n) => ({ id: 'T' + (n + 1), cell }));
  }
  T.cache.set(key, out);
  return out;
}
// Покриття населення набором точок
export function coverage(T, kind, cells) {
  const V = cells.map(c => viewshed(T, c, kind));
  const cov = T.places.map(p => ({ p, ok: V.some(v => v[p.cell]) }));
  const pop = cov.filter(c => c.ok).reduce((a, c) => a + c.p.pop, 0);
  return { V, covered: cov.filter(c => c.ok).map(c => c.p), missed: cov.filter(c => !c.ok).map(c => c.p), pop, share: pop / T.base.total.all };
}
// Жадібний підбір k точок, що покривають найбільше людей
export function bestSites(T, kind, k) {
  const cand = candidates(T, kind), chosen = [];
  for (let n = 0; n < k; n++) {
    let best = null, bestPop = -1;
    for (const c of cand) {
      if (chosen.includes(c)) continue;
      const pop = coverage(T, kind, [...chosen, c].map(x => x.cell)).pop;
      if (pop > bestPop) { bestPop = pop; best = c; }
    }
    if (best) chosen.push(best);
  }
  return chosen;
}
export const EXISTING_SIRENS = ['vrc', 'vrn', 'yas', 'oze', 'kle'];

// ——— придатність ділянок для нового об'єкта (укриття, амбулаторія, пожежне депо) ———
export function suitability(T, { maxSlope, stage, roadKm, target = 'far' }) {
  const key = `s${maxSlope}-${stage}-${roadKm}-${target}`;
  // «far»: рахуємо лише людей, яким до чинної амбулаторії понад 5 км
  const amb = T.facilities.filter(fc => fc.service === 'primary');
  const weight = new Map(T.places.map(p => [p.id, target === 'all' || Math.min(...amb.map(a => Math.hypot(a.x - p.x, a.y - p.y))) > 5 ? 1 : 0]));
  if (T.cache.has(key)) return T.cache.get(key);
  const F = flood(T, stage).W;
  const S = new Float32Array(GX * GY);
  // доступність населення: люди в радіусі 6 км із вагою за відстанню
  for (let j = 0; j < GY; j += 1) for (let i = 0; i < GX; i += 1) {
    const k = j * GX + i;
    if (!T.INSIDE[k] || F[k] || T.SLOPE[k] > maxSlope || T.ROADD[k] > roadKm || T.D[k] < 0.3) continue;
    const [x, y] = cellXY(k);
    let pop = 0;
    for (const p of T.places) { const d = Math.hypot(p.x - x, p.y - y); if (d < 6) pop += weight.get(p.id) * p.pop * (1 - d / 6); }
    S[k] = pop * (1 - 0.5 * T.SLOPE[k] / maxSlope) * (1 - 0.3 * T.ROADD[k] / roadKm);
  }
  let max = 0; for (const v of S) if (v > max) max = v;
  const order = [...S.keys()].filter(k => S[k] > 0).sort((a, b) => S[b] - S[a]);
  const top = [];
  for (const k of order) {
    const [x, y] = cellXY(k);
    if (top.every(t => Math.hypot(t.x - x, t.y - y) > 4)) top.push({ cell: k, x, y, score: S[k] / max, h: T.H[k], slope: T.SLOPE[k], road: T.ROADD[k], near: nearestPlace(T, x, y) });
    if (top.length >= 5) break;
  }
  let share = 0; for (const v of S) if (v > 0) share++;
  const res = { S, max, top, area: share * STEP * STEP };
  T.cache.set(key, res);
  return res;
}
export function nearestPlace(T, x, y) {
  let best = null, bd = 1e9;
  for (const p of T.places) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
  return { p: best, d: bd };
}

// Профіль висот по прямій між двома точками
export function profile(T, a, b, n = 160) {
  const out = [];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  for (let s = 0; s <= n; s++) { const f = s / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, c = cellAt(x, y); out.push({ km: L * f, h: T.H[c], water: riverLevel(x), river: T.D[c] < 0.15 }); }
  return out;
}

// Ухил ділянок доріг: найкрутіші відрізки на регіональних і місцевих дорогах
export function steepRoads(T, limit = 0.07) {
  const out = [];
  T.base.roads.forEach(r => {
    if (r.cls === 'national' || r.cls === 'town') return;
    let worst = 0;
    for (let k = 1; k < r.pts.length; k++) {
      const a = r.pts[k - 1], b = r.pts[k], ca = cellAt(a[0], a[1]), cb = cellAt(b[0], b[1]);
      if (ca < 0 || cb < 0) continue;
      const g = Math.abs(T.H[cb] - T.H[ca]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) * 1000);
      if (g > worst) worst = g;
    }
    if (worst > limit) out.push({ road: r, grade: worst });
  });
  return out.sort((a, b) => b.grade - a.grade);
}

// ——— сигнали ———
export function signals(T) {
  const st = floodStageOf(T);
  const out = {};
  out.floodLow = T.places.filter(p => st.has(p.id) && st.get(p.id) <= 3).map(p => ({ p, stage: st.get(p.id), level: 'critical' }));
  out.floodMid = T.places.filter(p => st.has(p.id) && st.get(p.id) > 3 && st.get(p.id) <= 7).map(p => ({ p, stage: st.get(p.id), level: 'warning' }));
  const f8 = flood(T, 8);
  out.facility = f8.facilities.map(fc => ({ fc, level: 'critical', stage: [...Array(41).keys()].map(s => s * 0.2).find(s => flood(T, Math.round(s * 10) / 10).W[fc.cell]) }));
  const f4 = flood(T, 4);
  out.isolated = f4.isolated.map(p => ({ p, level: 'critical' }));
  const sirens = coverage(T, 'siren', EXISTING_SIRENS.map(id => T.byId.get(id).cell));
  out.sirens = sirens.missed.filter(p => p.pop >= 400).map(p => ({ p, level: p.pop >= 600 ? 'critical' : 'warning' }));
  out.steep = steepRoads(T).slice(0, 8).map(s => ({ ...s, level: s.grade > 0.1 ? 'critical' : 'warning' }));
  return out;
}
export const SIGNALS = ['floodLow', 'floodMid', 'facility', 'isolated', 'sirens', 'steep'];
