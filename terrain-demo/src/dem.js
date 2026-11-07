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

// Гладкий value noise: значення −1…1, sc задає масштаб у кілометрах
export function makeNoise(rnd) {
  const LW = 64, LH = 48, lat = Float32Array.from({ length: LW * LH }, () => rnd() * 2 - 1);
  const g = (i, j) => lat[((j % LH) + LH) % LH * LW + (((i % LW) + LW) % LW)];
  return (x, y, sc) => {
    const fx = x / sc, fy = y / sc, i = Math.floor(fx), j = Math.floor(fy), u = sstep(0, 1, fx - i), v = sstep(0, 1, fy - j);
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };
}

export function buildTerrain() {
  const base = buildBase();
  const river = base.river;
  // шум: гладкий value noise кількох масштабів
  const noise = makeNoise(mulberry32(31337));
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
  // Балки і дрібний рельєф. Усе, що нижче за «рівень річки + 10,3 м», лишається як було,
  // тому розрахунок затоплення до +10 м від цього не змінюється.
  const CARVE = carveTributaries(H, river, mulberry32(4242));
  for (let k = 0; k < GX * GY; k++) {
    const x = ((k % GX) + 0.5) * STEP, y = (((k / GX) | 0) + 0.5) * STEP, floor = riverLevel(x) + 10.3;
    if (H[k] <= floor) continue;
    const fine = (noise(x + 13, y + 5, 0.9) * 2.2 + noise(x + 3, y + 29, 0.45) * 0.9) * sstep(floor, floor + 4, H[k]);
    H[k] = Math.max(H[k] + fine - CARVE[k], floor);
  }
  const hy = hydro(H, D);
  const streams = traceStreams(hy, D);
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
  return { base, H, D, SLOPE, ROADD, INSIDE, HF: hy.HF, DIR: hy.DIR, ACC: hy.ACC, streams, places, facilities, min, max, lobes, byId: new Map(places.map(p => [p.id, p])), cache: new Map() };
}

// ——— притоки-балки: від гирла біля заплави вгору схилом, з меандрами й відгалуженнями ———
// Повертає, на скільки метрів поглибити кожну клітинку. Поперечний профіль долини: гаусіана,
// глибша й ширша ближче до гирла, мілка й вузька біля витоку.
function carveTributaries(H, river, rnd) {
  const at = (x, y) => {
    const fx = clamp(x / STEP - 0.5, 0, GX - 1.001), fy = clamp(y / STEP - 0.5, 0, GY - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * GX + i;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + GX] * (1 - u) + H[k + GX + 1] * u) * v;
  };
  const grad = (x, y) => { const e = 0.4; return [(at(x + e, y) - at(x - e, y)) / (2 * e), (at(x, y + e) - at(x, y - e)) / (2 * e)]; };
  // зайнятість сітки 0,5 км, щоб долини не перетиналися
  const OW = Math.ceil(WORLD.w / 0.5), OH = Math.ceil(WORLD.h / 0.5), occ = new Int16Array(OW * OH).fill(-1);
  const oc = (x, y) => { const i = Math.floor(x / 0.5), j = Math.floor(y / 0.5); return i < 0 || j < 0 || i >= OW || j >= OH ? -2 : j * OW + i; };
  const busy = (x, y, self, r) => { for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const c = oc(x + a * 0.5, y + b * 0.5); if (c >= 0 && occ[c] >= 0 && occ[c] !== self) return true; } return false; };
  const paths = [];
  const walk = (x, y, dir, len, depth, width, parent) => {
    const id = paths.length, pts = [[x, y]];
    let ang = 0, top = at(x, y), dx = dir[0], dy = dir[1];
    const kids = [];
    for (let s = 0.25; s <= len; s += 0.25) {
      const g = grad(x, y), gl = Math.hypot(g[0], g[1]) || 1;
      ang = ang * 0.82 + (rnd() - 0.5) * 0.42;
      let nx = dx + 0.32 * g[0] / gl, ny = dy + 0.32 * g[1] / gl;
      const c = Math.cos(ang * 0.35), sn = Math.sin(ang * 0.35);
      [nx, ny] = [nx * c - ny * sn, nx * sn + ny * c];
      const nl = Math.hypot(nx, ny); dx = nx / nl; dy = ny / nl;
      x += dx * 0.25; y += dy * 0.25;
      if (x < 0.4 || y < 0.4 || x > WORLD.w - 0.4 || y > WORLD.h - 0.4) break;
      if (s > 1.2 && busy(x, y, parent ?? id, 1)) break;
      const h = at(x, y); if (h < top - 3) break; top = Math.max(top, h);
      pts.push([x, y]);
      if (depth > 9 && s > len * 0.3 && s < len * 0.75 && kids.length < 2 && rnd() < 0.07) kids.push([x, y, dx, dy, s]);
    }
    if (pts.length < 6) return;
    paths.push({ pts, depth, width });
    pts.forEach(([px, py]) => { const c = oc(px, py); if (c >= 0) occ[c] = parent ?? id; });
    for (const [kx, ky, kdx, kdy, s] of kids) {
      const turn = (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.45), c = Math.cos(turn), sn = Math.sin(turn);
      walk(kx, ky, [kdx * c - kdy * sn, kdx * sn + kdy * c], (len - s) * (0.45 + rnd() * 0.3), depth * 0.55, width * 0.7, parent ?? id);
    }
  };
  // гирла: кожні ≈4,4 км уздовж русла, по черзі на лівому й правому березі
  const cum = [0];
  for (let s = 1; s < river.length; s++) cum.push(cum[s - 1] + Math.hypot(river[s][0] - river[s - 1][0], river[s][1] - river[s - 1][1]));
  const total = cum[cum.length - 1];
  let side = 1;
  for (let a = 2.2; a < total - 1.5; a += 2.2 + rnd() * 0.6) {
    side = -side;
    let s = 1; while (s < cum.length - 1 && cum[s] < a) s++;
    const [ax, ay] = river[s - 1], [bx, by] = river[s], f = (a - cum[s - 1]) / (cum[s] - cum[s - 1] || 1);
    const px = ax + (bx - ax) * f, py = ay + (by - ay) * f, tl = Math.hypot(bx - ax, by - ay) || 1, tx = (bx - ax) / tl, ty = (by - ay) / tl;
    const nx = side > 0 ? ty : -ty, ny = side > 0 ? -tx : tx;           // side > 0: лівий (північний) берег
    const fpw = 0.6 + 1.6 * sstep(22, 40, px);
    const sx = px + nx * (fpw + 0.2), sy = py + ny * (fpw + 0.2);
    if (sx < 0.6 || sy < 0.6 || sx > WORLD.w - 0.6 || sy > WORLD.h - 0.6 || busy(sx, sy, -9, 2)) continue;
    const t = (rnd() - 0.5) * 0.5, c = Math.cos(t), sn = Math.sin(t);
    walk(sx, sy, [nx * c - ny * sn, nx * sn + ny * c], 7 + rnd() * 9, 13 + rnd() * 7, 0.55 + rnd() * 0.2);
  }
  const CARVE = new Float32Array(GX * GY);
  for (const p of paths) {
    const n = p.pts.length;
    p.pts.forEach(([x, y], i) => {
      const t = i / (n - 1), d = p.depth * (1 - 0.82 * t) ** 1.1 * sstep(0, 0.06, t + 0.02), w = 0.2 + p.width * (1 - 0.7 * t);
      const r = w * 2.2, i0 = Math.max(0, Math.floor((x - r) / STEP)), i1 = Math.min(GX - 1, Math.ceil((x + r) / STEP)), j0 = Math.max(0, Math.floor((y - r) / STEP)), j1 = Math.min(GY - 1, Math.ceil((y + r) / STEP));
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
        const dd = Math.hypot((ii + 0.5) * STEP - x, (j + 0.5) * STEP - y), v = d * Math.exp(-((dd / w) ** 2));
        const k = j * GX + ii; if (v > CARVE[k]) CARVE[k] = v;
      }
    });
  }
  return CARVE;
}

// ——— гідрологія: заповнення западин (priority-flood з малим ухилом), напрям стоку D8, накопичення стоку ———
// Стік закінчується в річці (D < 0,12 км) або на краю сітки. ACC: скільки клітинок 250 м стікає через клітинку.
export const STREAM_MIN = 100;          // ≈ 6,3 км² водозбору: з цього місця починається постійний водотік
const NB8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [-1, 1, 1.4142], [1, -1, 1.4142], [-1, -1, 1.4142]];
function hydro(H, D) {
  const N = GX * GY, HF = new Float32Array(N), DIR = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = new Int32Array(N);
  let hn = 0;
  const push = c => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (HF[heap[p]] <= HF[c]) break; heap[i] = heap[p]; i = p; } heap[i] = c; };
  const pop = () => {
    const top = heap[0], last = heap[--hn];
    let i = 0;
    for (;;) { let l = 2 * i + 1; if (l >= hn) break; if (l + 1 < hn && HF[heap[l + 1]] < HF[heap[l]]) l++; if (HF[heap[l]] >= HF[last]) break; heap[i] = heap[l]; i = l; }
    if (hn > 0) heap[i] = last;
    return top;
  };
  for (let k = 0; k < N; k++) {
    const i = k % GX, j = (k / GX) | 0;
    if (D[k] < 0.12 || i === 0 || j === 0 || i === GX - 1 || j === GY - 1) { HF[k] = H[k]; done[k] = 1; push(k); }
  }
  while (hn > 0) {
    const c = pop(), i = c % GX, j = (c / GX) | 0;
    for (const [di, dj] of NB8) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GX || b >= GY) continue;
      const n = b * GX + a; if (done[n]) continue;
      HF[n] = Math.max(H[n], HF[c] + 1e-3); done[n] = 1; push(n);
    }
  }
  // D8: найкрутіший спуск на заповненій поверхні
  for (let k = 0; k < N; k++) {
    const i = k % GX, j = (k / GX) | 0;
    if (D[k] < 0.12 || i === 0 || j === 0 || i === GX - 1 || j === GY - 1) continue;
    let best = -1, bs = 0;
    for (const [di, dj, w] of NB8) { const n = (j + dj) * GX + i + di, s = (HF[k] - HF[n]) / w; if (s > bs) { bs = s; best = n; } }
    DIR[k] = best;
  }
  const order = Uint32Array.from({ length: N }, (_, k) => k).sort((a, b) => HF[b] - HF[a]);
  const ACC = new Float32Array(N).fill(1);
  for (const c of order) if (DIR[c] >= 0) ACC[DIR[c]] += ACC[c];
  return { HF, DIR, ACC };
}

// Водотоки як лінії: від витоку вниз за стоком до річки або до впадіння в інший водотік
function traceStreams({ HF, DIR, ACC }, D) {
  const N = GX * GY, isS = c => ACC[c] >= STREAM_MIN && D[c] >= 0.12;
  const up = new Uint8Array(N);
  for (let c = 0; c < N; c++) if (isS(c) && DIR[c] >= 0 && isS(DIR[c])) up[DIR[c]]++;
  const heads = [];
  for (let c = 0; c < N; c++) if (isS(c) && !up[c]) heads.push(c);
  heads.sort((a, b) => HF[b] - HF[a]);
  const seen = new Uint8Array(N), out = [];
  for (const h of heads) {
    const cells = [];
    let c = h;
    while (c >= 0) {
      cells.push(c);
      if (seen[c]) break;
      seen[c] = 1;
      const d = DIR[c];
      if (d < 0) break;
      if (!isS(d)) { cells.push(d); break; }
      c = d;
    }
    if (cells.length < 3) continue;
    // згладжування Чайкіна: прибирає «сходинки» сітки, кінці лишаються на місці
    let pts = cells.map(k => [...cellXY(k), ACC[k]]);
    for (let it = 0; it < 2; it++) {
      const nx = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        nx.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]);
      }
      nx.push(pts[pts.length - 1]);
      pts = nx;
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    out.push({ pts, len, acc: ACC[cells[cells.length - 2]] });
  }
  return out;
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
export const SIGNALS = ['floodLow', 'floodMid', 'facility', 'isolated', 'sirens', 'steep', 'waterlog', 'erosion'];
