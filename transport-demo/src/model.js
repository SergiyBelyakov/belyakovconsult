// Модель транспортної доступності: дорожній граф, автобусні маршрути, найкоротший час до найближчого закладу,
// поле часу для ізохрон, покриття населення, сигнали, сценарії й пошук місця для нового пункту.
// Усе рахується в браузері за кілька мілісекунд: граф має близько тисячі вузлів.
import { WORLD, CELL, RIVER, BOUNDARY, PLACES, JUNCTIONS, ROADS, BRIDGES, FACILITIES, ROUTES, SCENARIOS } from './data.js';

export const MODES = ['car', 'pt', 'walk'];
export const PERIODS = ['am', 'day', 'pm'];
export const SERVICES = ['primary', 'hospital', 'cnap'];
export const BANDS = [15, 30, 45, 60, 90];
export const DEFAULT_TH = { primary: 30, hospital: 60, cnap: 45 };
export const WINDOW = { am: 120, day: 360, pm: 180 };
export const CAR = { national: 90, regional: 70, local: 50, dirt: 30, town: 35 };
export const BUS = { factor: 0.8, max: 65, dwell: 0.6, board: 3, waitCap: 60 };
export const WALK = 4.5;
export const DETOUR = 1.3;
export const CONN = { car: 20, pt: WALK, walk: WALK };
export const ACCESS = { district: { car: 3, walk: 0.6 }, town: { car: 2, walk: 0.5 }, village: { car: 1, walk: 0.3 } };
export const EGRESS = { car: 3, pt: 3, walk: 3 };
export const STOP_KM = 1.5;
export const MAXT = 120;

// ——— утиліти ———
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const busSpeed = cls => Math.min(BUS.max, CAR[cls] * BUS.factor);

// Згладжування ламаної сплайном Катмулла-Рома
export function smooth(points, per = 8) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Дорога як плавна ламана з вузлами приблизно через 400 м
const BEND = { national: 0.022, regional: 0.04, local: 0.06, dirt: 0.085, town: 0.018 };
function bendy(A, B, cls, rnd) {
  const L = dist(A, B);
  const n = Math.max(2, Math.ceil(L / 0.4));
  const ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
  const amp = Math.min(1.1, BEND[cls] * L) * (rnd() < 0.5 ? -1 : 1);
  const amp2 = Math.min(0.35, BEND[cls] * L * 0.35);
  const ph = rnd() * Math.PI * 2, fr = 1.5 + rnd() * 1.5;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const env = Math.sin(Math.PI * s);
    const off = env * (amp * (0.6 + 0.4 * Math.sin(ph * 0.7)) + amp2 * Math.sin(2 * Math.PI * fr * s + ph));
    pts.push([A[0] + ux * L * s - uy * off, A[1] + uy * L * s + ux * off]);
  }
  pts[0] = [A[0], A[1]]; pts[n] = [B[0], B[1]];
  return pts;
}

function segX(a, b, c, d) {
  const d1 = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (Math.abs(d1) < 1e-12) return null;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / d1;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / d1;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] : null;
}
export function crossings(line, poly) {
  const out = [];
  for (let i = 0; i < line.length - 1; i++)
    for (let j = 0; j < poly.length - 1; j++) {
      const p = segX(line[i], line[i + 1], poly[j], poly[j + 1]);
      if (p) out.push({ p, i, a: Math.atan2(line[i + 1][1] - line[i][1], line[i + 1][0] - line[i][0]) });
    }
  return out;
}
export function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Бінарна купа для Дейкстри
class Heap {
  constructor(n) { this.k = new Float64Array(n * 4 + 16); this.v = new Int32Array(n * 4 + 16); this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2); k.set(this.k); this.k = k; const v = new Int32Array(this.v.length * 2); v.set(this.v); this.v = v; }
    let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop() {
    const top = this.v[0], key = this.k[0];
    const lk = this.k[--this.n], lv = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= lk) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = lk; this.v[i] = lv;
    this.lastKey = key;
    return top;
  }
}

// ——— базова мережа ———
export function buildBase() {
  const rnd = mulberry32(20261106);
  const river = smooth(RIVER, 10);
  const named = new Map();
  PLACES.forEach(p => named.set(p.id, [p.x, p.y]));
  Object.entries(JUNCTIONS).forEach(([id, xy]) => named.set(id, xy));

  const X = [], Y = [];
  const idx = new Map();
  const add = (x, y) => { X.push(x); Y.push(y); return X.length - 1; };
  for (const [id, [x, y]] of named) idx.set(id, add(x, y));

  const roads = [], edges = [];
  ROADS.forEach(([a, b, cls, bridge], ri) => {
    const pts = bendy(named.get(a), named.get(b), cls, rnd);
    let len = 0;
    let prev = idx.get(a);
    const nodes = [prev];
    for (let i = 1; i < pts.length; i++) {
      const cur = i === pts.length - 1 ? idx.get(b) : add(pts[i][0], pts[i][1]);
      const l = dist(pts[i - 1], pts[i]);
      edges.push({ u: prev, v: cur, len: l, cls, bridge: bridge || null, road: ri });
      len += l; prev = cur; nodes.push(cur);
    }
    const cross = bridge ? crossings(pts, river)[0] : null;
    roads.push({ id: ri, a, b, cls, bridge: bridge || null, pts, len, nodes, cross });
  });
  const N = X.length;

  // суміжність доріг (неорієнтована): для маршрутів і пішої відстані до зупинок
  const roadAdj = Array.from({ length: N }, () => []);
  edges.forEach((e, i) => { roadAdj[e.u].push(i); roadAdj[e.v].push(i); });

  // маршрути: шлях між зупинками по дорогах (найшвидший для автобуса)
  const routeDefs = [...ROUTES, ...SCENARIOS.drt.routes];
  const routes = routeDefs.map(r => {
    const segs = [];
    for (let i = 0; i < r.stops.length - 1; i++) {
      const s = idx.get(r.stops[i]), t = idx.get(r.stops[i + 1]);
      const path = roadPath(s, t, edges, roadAdj, N, e => (e.bridge === 'b3' && r.needs !== 'b3' ? Infinity : e.len / busSpeed(e.cls)));
      let ride = 0; const pts = [[X[s], Y[s]]];
      for (const { e, fwd } of path) {
        ride += (edges[e].len / busSpeed(edges[e].cls)) * 60;
        pts.push(fwd ? [X[edges[e].v], Y[edges[e].v]] : [X[edges[e].u], Y[edges[e].u]]);
      }
      segs.push({ from: r.stops[i], to: r.stops[i + 1], ride, pts, km: path.reduce((a, x) => a + edges[x.e].len, 0) });
    }
    const pts = segs.flatMap((s, i) => (i ? s.pts.slice(1) : s.pts));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    const oneWay = segs.reduce((a, s) => a + s.ride, 0) + BUS.dwell * (r.stops.length - 2);
    return { ...r, segs, pts, cum, km: cum[cum.length - 1], oneWay };
  });

  // сітка для поля часу: найближчі вузли дороги для кожної клітинки
  const gx = Math.ceil(WORLD.w / CELL), gy = Math.ceil(WORLD.h / CELL);
  const K = 5, R = 2.8;
  const B = 0.8;
  const bw = Math.ceil(WORLD.w / B) + 2, bh = Math.ceil(WORLD.h / B) + 2;
  const buckets = Array.from({ length: bw * bh }, () => []);
  // вузли посередині переправи, яка може не працювати, не беремо: інакше біля річки з’являються «дірки» в полі часу
  const skip = new Set(roads.filter(r => r.bridge === 'b3').flatMap(r => r.nodes.slice(1, -1)));
  for (let i = 0; i < N; i++) {
    if (skip.has(i)) continue;
    const bx = Math.floor(X[i] / B) + 1, by = Math.floor(Y[i] / B) + 1;
    if (bx >= 0 && by >= 0 && bx < bw && by < bh) buckets[by * bw + bx].push(i);
  }
  const cellNode = new Int32Array(gx * gy * K).fill(-1);
  const cellDist = new Float32Array(gx * gy * K).fill(Infinity);
  const span = Math.ceil(R / B);
  for (let cy = 0; cy < gy; cy++) for (let cx = 0; cx < gx; cx++) {
    const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL;
    const bx = Math.floor(x / B) + 1, by = Math.floor(y / B) + 1;
    const off = (cy * gx + cx) * K;
    for (let j = Math.max(0, by - span); j <= Math.min(bh - 1, by + span); j++) for (let i = Math.max(0, bx - span); i <= Math.min(bw - 1, bx + span); i++) {
      for (const n of buckets[j * bw + i]) {
        const d = Math.hypot(X[n] - x, Y[n] - y);
        if (d > R || d >= cellDist[off + K - 1]) continue;
        let k = K - 1;
        while (k > 0 && cellDist[off + k - 1] > d) { cellDist[off + k] = cellDist[off + k - 1]; cellNode[off + k] = cellNode[off + k - 1]; k--; }
        cellDist[off + k] = d; cellNode[off + k] = n;
      }
    }
    // клітинка далеко від доріг: шукаємо найближчий вузол ширше, щоб поле часу було неперервним
    if (cellNode[off] < 0) {
      let best = -1, bd = Infinity;
      for (let ring = span + 1; ring < 60 && best < 0; ring++) {
        for (let j = by - ring; j <= by + ring; j++) for (let i = bx - ring; i <= bx + ring; i++) {
          if (Math.max(Math.abs(i - bx), Math.abs(j - by)) !== ring || i < 0 || j < 0 || i >= bw || j >= bh) continue;
          for (const n of buckets[j * bw + i]) { const d = Math.hypot(X[n] - x, Y[n] - y); if (d < bd) { bd = d; best = n; } }
        }
      }
      cellNode[off] = best; cellDist[off] = bd;
    }
  }
  const inTerr = new Uint8Array(gx * gy);
  for (let cy = 0; cy < gy; cy++) for (let cx = 0; cx < gx; cx++) inTerr[cy * gx + cx] = inside([(cx + 0.5) * CELL, (cy + 0.5) * CELL], BOUNDARY) ? 1 : 0;

  const places = PLACES.map(p => ({ ...p, node: idx.get(p.id), old65: Math.round(p.pop * p.old), kid: Math.round(p.pop * p.kids) }));
  const byId = new Map(places.map(p => [p.id, p]));
  const total = { all: places.reduce((a, p) => a + p.pop, 0), old: places.reduce((a, p) => a + p.old65, 0), kids: places.reduce((a, p) => a + p.kid, 0) };

  // пішки до найближчої зупинки (для сигналу і профілю)
  const base = { X, Y, N, idx, edges, roadAdj, roads, routes, river, places, byId, total, gx, gy, K, cellNode, cellDist, inTerr, cache: new Map() };
  base.terrain = terrain();
  return base;
}

// Найкоротший шлях по дорогах (для геометрії маршрутів)
function roadPath(s, t, edges, adj, N, w) {
  const d = new Float64Array(N).fill(Infinity), pe = new Int32Array(N).fill(-1);
  const h = new Heap(N); d[s] = 0; h.push(0, s);
  while (h.n) {
    const u = h.pop(); if (h.lastKey > d[u]) continue; if (u === t) break;
    for (const ei of adj[u]) {
      const e = edges[ei], v = e.u === u ? e.v : e.u, c = w(e);
      if (d[u] + c < d[v]) { d[v] = d[u] + c; pe[v] = ei; h.push(d[v], v); }
    }
  }
  const out = [];
  let v = t;
  while (v !== s && pe[v] >= 0) { const e = edges[pe[v]]; const u = e.u === v ? e.v : e.u; out.push({ e: pe[v], fwd: e.u === u }); v = u; }
  return out.reverse();
}

// Декоративний рельєф: шум значень на решітці 1 км, бікубічна інтерполяція до 0,5 км
function terrain() {
  const rnd = mulberry32(7741);
  const lw = 56, lh = 42;
  const lat = new Float32Array(lw * lh).map(() => rnd());
  const g = (i, j) => lat[Math.max(0, Math.min(lh - 1, j)) * lw + Math.max(0, Math.min(lw - 1, i))];
  const s = t => t * t * (3 - 2 * t);
  const sample = (x, y, sc) => {
    const fx = x / sc, fy = y / sc, i = Math.floor(fx), j = Math.floor(fy), u = s(fx - i), v = s(fy - j);
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };
  const w = 105, h = 77, vals = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = i * 0.5, y = j * 0.5;
    vals[j * w + i] = sample(x, y, 9) * 0.62 + sample(x + 40, y + 13, 4) * 0.28 + sample(x + 7, y + 31, 2) * 0.1;
  }
  return { w, h, step: 0.5, vals };
}

// ——— граф для способу пересування ———
// Ребра в прямому напрямку; пошук іде у зворотному (від закладів), тож маємо час від кожного вузла до найближчого закладу.
function scenarioRoutes(base, scen, period) {
  const extra = SCENARIOS.rural.trips;
  return base.routes.filter(r => r.kind !== 'drt' || scen.drt).map(r => {
    let trips = r.trips[period];
    if (r.id === '7' && scen.ponton) trips = SCENARIOS.ponton.trips['7'][period];
    if (scen.rural && extra[r.id]) trips = extra[r.id][period];
    const active = trips > 0 && (!r.needs || bridgeOpen(r.needs, scen));
    const headway = trips > 0 ? WINDOW[period] / trips : Infinity;
    return { r, trips, active, headway, wait: Math.min(headway / 2, BUS.waitCap) };
  });
}
export const bridgeOpen = (b, scen) => (b === 'b3' ? !!scen.ponton : scen.closed !== b && BRIDGES[b].open);

function buildGraph(base, mode, period, scen) {
  const key = 'g|' + mode + '|' + (mode === 'pt' ? period : '') + '|' + scenKey(scen, mode);
  if (base.cache.has(key)) return base.cache.get(key);
  const { edges, N, idx } = base;
  const from = [], to = [], cost = [], kind = [], ref = [];
  const E = (a, b, c, k, r) => { from.push(a); to.push(b); cost.push(c); kind.push(k); ref.push(r); };
  edges.forEach((e, i) => {
    if (e.bridge && !bridgeOpen(e.bridge, scen)) return;
    const c = mode === 'car' ? (e.len / CAR[e.cls]) * 60 : (e.len / WALK) * 60;
    E(e.u, e.v, c, 0, i); E(e.v, e.u, c, 0, i);
  });
  let M = N;
  const rnodes = [];
  if (mode === 'pt') {
    for (const sr of scenarioRoutes(base, scen, period)) {
      if (!sr.active) continue;
      const { r } = sr;
      const S = r.stops.length;
      for (const dir of [0, 1]) {
        const ids = [];
        for (let i = 0; i < S; i++) { ids.push(M); rnodes.push({ route: r.id, dir, i }); M++; }
        const order = dir === 0 ? r.stops.map((_, i) => i) : r.stops.map((_, i) => S - 1 - i);
        for (let k = 0; k < S; k++) {
          const si = order[k], stop = idx.get(r.stops[si]), rn = ids[k];
          if (k < S - 1) E(stop, rn, sr.wait + BUS.board, 1, { route: r.id, stop: r.stops[si], wait: sr.wait, headway: sr.headway, trips: sr.trips });
          if (k > 0) E(rn, stop, 0, 3, null);
          if (k < S - 1) {
            const segI = dir === 0 ? si : si - 1;
            const seg = r.segs[segI];
            E(rn, ids[k + 1], seg.ride + (k + 1 < S - 1 ? BUS.dwell : 0), 2, { route: r.id, seg: segI, rev: dir === 1 });
          }
        }
      }
    }
  }
  // зворотна суміжність (CSR): для вузла v зберігаємо ребра u→v
  const cnt = new Int32Array(M + 1);
  for (let i = 0; i < to.length; i++) cnt[to[i] + 1]++;
  for (let i = 0; i < M; i++) cnt[i + 1] += cnt[i];
  const fill = cnt.slice(0, M);
  const rev = new Int32Array(to.length);
  for (let i = 0; i < to.length; i++) rev[fill[to[i]]++] = i;
  const g = { M, from: Int32Array.from(from), to: Int32Array.from(to), cost: Float64Array.from(cost), kind: Uint8Array.from(kind), ref, start: cnt, rev, rnodes };
  base.cache.set(key, g);
  return g;
}

function dijkstra(g, sources) {
  const d = new Float64Array(g.M).fill(Infinity);
  const nxt = new Int32Array(g.M).fill(-1);   // ребро, яким іти далі до закладу
  const src = new Int16Array(g.M).fill(-1);
  const h = new Heap(g.M);
  for (const [node, c, s] of sources) if (c < d[node]) { d[node] = c; src[node] = s; h.push(c, node); }
  while (h.n) {
    const v = h.pop();
    if (h.lastKey > d[v]) continue;
    if (d[v] > MAXT * 2) break;
    for (let p = g.start[v]; p < g.start[v + 1]; p++) {
      const ei = g.rev[p], u = g.from[ei], nd = d[v] + g.cost[ei];
      if (nd < d[u]) { d[u] = nd; nxt[u] = ei; src[u] = src[v]; h.push(nd, u); }
    }
  }
  return { d, nxt, src };
}

export function scenKey(s, mode) {
  if (!s) return 'base';
  const k = [];
  if (s.ponton) k.push('p');
  if (s.closed) k.push('x' + s.closed);
  if (mode === 'pt' || mode == null) { if (s.drt) k.push('d'); if (s.rural) k.push('r'); }
  return k.join('') || 'base';
}

export function facilitiesFor(base, service, scen) {
  const list = FACILITIES.filter(f => f.service === service).map(f => ({ ...f, n: base.idx.get(f.node) }));
  if (scen && scen.newPoint && service === 'primary') list.push({ id: 'new', service, node: scen.newPoint, n: base.idx.get(scen.newPoint), cap: 4000, isNew: true });
  return list;
}

const accessMin = (p, mode) => (mode === 'car' ? ACCESS[p.kind].car : (ACCESS[p.kind].walk / WALK) * 60);

// Головний розрахунок: час від кожного вузла, поле для карти, час для кожного населеного пункту
export function solve(base, service, mode, period, scen = {}, only = null) {
  const key = ['s', service, mode, mode === 'pt' ? period : '', scenKey(scen, mode), service === 'primary' ? scen.newPoint || '' : '', only ? only.join(',') : ''].join('|');
  if (base.cache.has(key)) return base.cache.get(key);
  const g = buildGraph(base, mode, period, scen);
  const facs = facilitiesFor(base, service, scen).filter(f => !only || only.includes(f.id));
  const { d, nxt, src } = dijkstra(g, facs.map((f, i) => [f.n, EGRESS[mode], i]));
  const { gx, gy, K, cellNode, cellDist } = base;
  const field = new Float32Array(gx * gy), fsrc = new Int16Array(gx * gy).fill(-1);
  const sp = (DETOUR / CONN[mode]) * 60;
  for (let c = 0; c < gx * gy; c++) {
    let best = Infinity, bs = -1;
    for (let k = 0; k < K; k++) {
      const n = cellNode[c * K + k]; if (n < 0) break;
      const t = d[n] + cellDist[c * K + k] * sp;
      if (t < best) { best = t; bs = src[n]; }
    }
    field[c] = best; fsrc[c] = bs;
  }
  const placeT = new Map();
  for (const p of base.places) {
    const t = d[p.node] + accessMin(p, mode);
    const path = mode === 'pt' ? tracePath(base, g, nxt, p.node) : null;
    placeT.set(p.id, { t, fac: src[p.node], bus: path ? path.some(x => x.kind === 2) : false });
  }
  const sol = { service, mode, period, scen, g, d, nxt, src, facs, field, fsrc, placeT };
  base.cache.set(key, sol);
  return sol;
}

function tracePath(base, g, nxt, node) {
  const out = [];
  let v = node, guard = 0;
  while (nxt[v] >= 0 && guard++ < 5000) { const ei = nxt[v]; out.push({ kind: g.kind[ei], ei }); v = g.to[ei]; }
  return out;
}

// Маршрут від населеного пункту до закладу: етапи для профілю і геометрія для карти
export function pathOf(base, sol, placeId) {
  const p = base.byId.get(placeId);
  const { g, nxt, d, mode } = sol;
  const steps = tracePath(base, g, nxt, p.node);
  const legs = [];
  const acc = accessMin(p, mode);
  legs.push({ kind: mode === 'car' ? 'drive0' : 'walk0', min: acc, km: mode === 'car' ? 0 : ACCESS[p.kind].walk, pts: [] });
  const cur = () => legs[legs.length - 1];
  let at = p.node;
  const pt = n => [base.X[n], base.Y[n]];
  for (const s of steps) {
    const ei = s.ei, k = g.kind[ei], c = g.cost[ei], r = g.ref[ei];
    if (k === 0) {
      const lk = mode === 'car' ? 'drive' : 'walk';
      if (cur().kind !== lk) legs.push({ kind: lk, min: 0, km: 0, pts: [pt(at)] });
      const e = base.edges[r];
      cur().min += c; cur().km += e.len; at = g.to[ei]; cur().pts.push(pt(at));
    } else if (k === 1) {
      legs.push({ kind: 'wait', min: c, stop: r.stop, route: r.route, wait: r.wait, headway: r.headway, trips: r.trips, pts: [pt(at)] });
      at = g.to[ei];
    } else if (k === 2) {
      const route = base.routes.find(x => x.id === r.route);
      const seg = route.segs[r.seg];
      if (cur().kind !== 'ride' || cur().route !== r.route) legs.push({ kind: 'ride', route: r.route, min: 0, km: 0, pts: [], from: null, to: null, stops: 0 });
      const L = cur();
      const sp = r.rev ? [...seg.pts].reverse() : seg.pts;
      L.pts.push(...(L.pts.length ? sp.slice(1) : sp));
      L.min += c; L.km += seg.km; L.stops++;
      L.from = L.from || (r.rev ? seg.to : seg.from); L.to = r.rev ? seg.from : seg.to;
      at = g.to[ei];
    } else {
      at = g.to[ei];
    }
  }
  legs.push({ kind: mode === 'car' ? 'park' : 'walk1', min: EGRESS[mode], km: 0, pts: [] });
  const fac = sol.facs[sol.src[p.node]] || null;
  const geom = legs.filter(l => l.pts && l.pts.length > 1).map(l => ({ kind: l.kind, route: l.route, pts: l.pts }));
  return { legs: legs.filter(l => l.min > 0.05 || l.kind === 'wait'), total: d[p.node] + acc, fac, geom, reachable: Number.isFinite(d[p.node]) };
}

export const bandOf = t => { for (let i = 0; i < BANDS.length; i++) if (t <= BANDS[i]) return i; return BANDS.length; };

// Покриття і розподіл населення
export function stats(base, sol, th) {
  const groups = { all: 0, old: 0, kids: 0 };
  const within = { all: 0, old: 0, kids: 0 };
  const bands = new Array(BANDS.length + 1).fill(0);
  const list = [];
  for (const p of base.places) {
    const r = sol.placeT.get(p.id);
    const t = r.t;
    list.push({ p, t, bus: r.bus });
    groups.all += p.pop; groups.old += p.old65; groups.kids += p.kid;
    if (t <= th) { within.all += p.pop; within.old += p.old65; within.kids += p.kid; }
    bands[bandOf(t)] += p.pop;
  }
  list.sort((a, b) => a.t - b.t);
  const median = (w => { let acc = 0; for (const x of list) { acc += w(x.p); if (acc >= base.total.all / 2) return x.t; } return Infinity; })(p => p.pop);
  const curve = g => {
    const out = new Float32Array(MAXT + 1);
    const tot = groups[g];
    let i = 0, acc = 0;
    for (let t = 0; t <= MAXT; t++) {
      while (i < list.length && list[i].t <= t) { acc += g === 'all' ? list[i].p.pop : g === 'old' ? list[i].p.old65 : list[i].p.kid; i++; }
      out[t] = acc / tot;
    }
    return out;
  };
  const beyond = list.filter(x => x.t > th);
  return {
    share: { all: within.all / groups.all, old: within.old / groups.old, kids: within.kids / groups.kids },
    withinPop: within.all, beyondPop: groups.all - within.all, median, bands, list, curve,
    beyondN: beyond.length, noConn: sol.mode === 'pt' ? beyond.filter(x => !x.bus).length : 0,
  };
}

// Навантаження закладів: населення в зоні, де цей заклад найближчий
export function loads(base, sol) {
  const out = sol.facs.map(f => ({ f, pop: 0, old: 0, places: [], tw: 0 }));
  for (const p of base.places) {
    const r = sol.placeT.get(p.id);
    if (r.fac < 0) continue;
    const o = out[r.fac];
    o.pop += p.pop; o.old += p.old65; o.places.push(p.id); o.tw += r.t * p.pop;
  }
  out.forEach(o => { o.avg = o.pop ? o.tw / o.pop : 0; });
  return out;
}

// Пішки до найближчої зупинки активного маршруту (денний розклад базового стану)
export function stopDistances(base, scen = {}, period = 'day') {
  const key = 'stops|' + scenKey(scen, 'pt') + '|' + period;
  if (base.cache.has(key)) return base.cache.get(key);
  const active = scenarioRoutes(base, scen, period).filter(x => x.active);
  const stops = new Set(active.flatMap(x => x.r.stops.map(s => base.idx.get(s))));
  const d = new Float64Array(base.N).fill(Infinity);
  const h = new Heap(base.N);
  stops.forEach(s => { d[s] = 0; h.push(0, s); });
  while (h.n) {
    const u = h.pop(); if (h.lastKey > d[u]) continue;
    for (const ei of base.roadAdj[u]) {
      const e = base.edges[ei];
      if (e.bridge && !bridgeOpen(e.bridge, scen)) continue;
      const v = e.u === u ? e.v : e.u;
      if (d[u] + e.len < d[v]) { d[v] = d[u] + e.len; h.push(d[v], v); }
    }
  }
  const m = new Map(base.places.map(p => [p.id, d[p.node]]));
  base.cache.set(key, m);
  return m;
}

export function routeInfo(base, scen, period) {
  return scenarioRoutes(base, scen, period);
}

// Найкраще місце для нового пункту (задача максимального покриття, один пункт)
export function bestSites(base, mode, period, scen, th) {
  const key = ['best', mode, period, scenKey(scen, mode), th].join('|');
  if (base.cache.has(key)) return base.cache.get(key);
  const cur = solve(base, 'primary', mode, period, { ...scen, newPoint: null });
  const g = buildGraph(base, mode, period, scen);
  const hosts = new Set(facilitiesFor(base, 'primary', {}).map(f => f.node));
  const cands = base.places.filter(p => !hosts.has(p.id) && p.kind !== 'district');
  const out = cands.map(c => {
    const { d } = dijkstra(g, [[c.node, EGRESS[mode], 0]]);
    let gain = 0, gainOld = 0, saved = 0, moved = [];
    for (const p of base.places) {
      const was = cur.placeT.get(p.id).t;
      const now = Math.min(was, d[p.node] + accessMin(p, mode));
      if (now < was) saved += (Math.min(was, MAXT) - now) * p.pop;
      if (now <= th && was > th) { gain += p.pop; gainOld += p.old65; moved.push(p.id); }
    }
    return { id: c.id, gain, gainOld, saved: saved / base.total.all, moved };
  }).sort((a, b) => b.gain - a.gain || b.saved - a.saved);
  base.cache.set(key, out);
  return out;
}

// Сигнали на базовому стані
export const SIGNALS = [
  { id: 'hospitalBus', level: 'critical', kind: 'place' },
  { id: 'elderly', level: 'critical', kind: 'place' },
  { id: 'eveningCut', level: 'warning', kind: 'place' },
  { id: 'noStop', level: 'warning', kind: 'place' },
  { id: 'rare', level: 'warning', kind: 'route' },
  { id: 'overload', level: 'warning', kind: 'facility' },
  { id: 'bridge', level: 'warning', kind: 'place' },
  { id: 'border', level: 'info', kind: 'place' },
];

export function signals(base) {
  if (base.cache.has('signals')) return base.cache.get('signals');
  const S = {};
  const hosp = solve(base, 'hospital', 'pt', 'day', {});
  S.hospitalBus = base.places.filter(p => hosp.placeT.get(p.id).t > 60).map(p => ({ id: p.id, t: hosp.placeT.get(p.id).t, bus: hosp.placeT.get(p.id).bus }));
  const prim = solve(base, 'primary', 'pt', 'day', {});
  S.elderly = base.places.filter(p => p.old >= 0.35 && prim.placeT.get(p.id).t > 30).map(p => ({ id: p.id, t: prim.placeT.get(p.id).t, old: p.old }));
  const primPm = solve(base, 'primary', 'pt', 'pm', {});
  S.eveningCut = base.places.filter(p => prim.placeT.get(p.id).bus && prim.placeT.get(p.id).t <= 90 && (!primPm.placeT.get(p.id).bus || primPm.placeT.get(p.id).t > prim.placeT.get(p.id).t + 25))
    .map(p => ({ id: p.id, t: prim.placeT.get(p.id).t, t2: primPm.placeT.get(p.id).t }));
  const sd = stopDistances(base, {}, 'day');
  S.noStop = base.places.filter(p => sd.get(p.id) > STOP_KM).map(p => ({ id: p.id, km: sd.get(p.id) }));
  S.rare = routeInfo(base, {}, 'day').filter(x => x.r.kind !== 'drt' && x.trips <= 2).map(x => ({ id: x.r.id, trips: x.trips, suspended: !x.active }));
  const carPrim = solve(base, 'primary', 'car', 'day', {});
  S.overload = loads(base, carPrim).filter(o => o.f.cap && o.pop > o.f.cap).map(o => ({ id: o.f.id, pop: o.pop, cap: o.f.cap }));
  const carHosp = solve(base, 'hospital', 'car', 'day', {});
  const own = solve(base, 'hospital', 'car', 'day', {}, ['h1']);
  const noB1 = solve(base, 'hospital', 'car', 'day', { closed: 'b1' }, ['h1']);
  S.bridge = base.places.filter(p => noB1.placeT.get(p.id).t - own.placeT.get(p.id).t > 15).map(p => ({ id: p.id, t: own.placeT.get(p.id).t, t2: noB1.placeT.get(p.id).t }));
  S.border = base.places.filter(p => carHosp.facs[carHosp.placeT.get(p.id).fac]?.outside).map(p => ({ id: p.id, t: carHosp.placeT.get(p.id).t }));
  base.cache.set('signals', S);
  return S;
}

export const placesOfSignal = (S, id) => (SIGNALS.find(s => s.id === id).kind === 'place' ? S[id].map(x => x.id) : []);
