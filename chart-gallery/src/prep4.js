// Підготовка даних для потоків у часі, ієрархій, біваріантної карти й карти часу доїзду.
import { matchRegion, REGIONS } from './geo.js';
import { quant } from './prep2.js';

// ——— streamgraph і складена площа: повна сітка дата × серія, пропуски нулями ———
export function prepStream(get, o, L) {
  const d = get.date('date'), v = get.num('value'), ser = get.text('series'), warn = [];
  const badD = d.filter((x, i) => !Number.isFinite(x) && (get.text('date')[i] || '') !== '').length;
  if (badD) warn.push(['badDates', badD, get.name('date')]);
  const ok = i => Number.isFinite(d[i]) && Number.isFinite(v[i]) && ser[i];
  const neg = v.filter((x, i) => ok(i) && x < 0).length; if (neg) warn.push(['negDropped', neg]);
  const tot = new Map(); ser.forEach((s, i) => { if (ok(i) && v[i] >= 0) tot.set(s, (tot.get(s) || 0) + v[i]); });
  if (!tot.size) return { error: ['needDates', get.name('date')] };
  let names = [...tot.keys()];
  const fold = names.length > 5;
  if (fold) { const top = new Set([...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0])); warn.push(['seriesFolded', 4, names.length - 4]); names = [...names.filter(s => top.has(s)), L.other]; }
  const si = s => (names.includes(s) ? names.indexOf(s) : names.length - 1);
  const days = [...new Set(d.filter((x, i) => ok(i)))].sort((a, b) => a - b);
  if (days.length < 3) return { error: ['needTwoDates'] };
  const di = new Map(days.map((x, k) => [x, k]));
  const val = names.map(() => days.map(() => 0));
  d.forEach((x, i) => { if (ok(i) && v[i] >= 0) val[si(ser[i])][di.get(x)] += v[i]; });
  return { days, names, val, otherLast: fold, warn, valueName: get.name('value'), table: { head: [get.name('date'), ...names], rows: days.map((x, k) => [x, ...names.map((_, a) => val[a][k])]) }, dateCols: [0] };
}

// ——— ієрархія для sunburst і icicle: до трьох рівнів, у вузлі не більше 12 дітей ———
export function prepSun(get, o, L) {
  const l1 = get.text('level1'), l2 = get.text('level2'), l3 = get.has('level3') ? get.text('level3') : null, v = get.num('value'), warn = [];
  const bad = l1.reduce((s, x, i) => s + (x && !Number.isFinite(v[i]) ? 1 : 0), 0); if (bad) warn.push(['dropped', bad, get.name('value')]);
  const np = v.filter((x, i) => l1[i] && Number.isFinite(x) && x <= 0).length; if (np) warn.push(['nonPositive', np]);
  const root = { name: L.total, value: 0, children: [], depth: 0, map: new Map() };
  const child = (node, name) => { if (!node.map.has(name)) { const c = { name, value: 0, children: [], depth: node.depth + 1, map: new Map(), parent: node }; node.map.set(name, c); node.children.push(c); } return node.map.get(name); };
  let n = 0;
  l1.forEach((a, i) => {
    if (!a || !(v[i] > 0)) return;
    const path = [a, l2[i] || L.na, ...(l3 ? [l3[i] || L.na] : [])];
    let node = root; root.value += v[i];
    path.forEach(p => { node = child(node, p); node.value += v[i]; });
    n++;
  });
  if (!n) return { error: ['noRows', get.name('value')] };
  let folded = 0;
  const tidy = node => {
    node.children.sort((a, b) => b.value - a.value);
    if (node.children.length > 12) { const rest = node.children.slice(11); node.children = node.children.slice(0, 11); node.children.push({ name: L.other, value: rest.reduce((s, c) => s + c.value, 0), children: [], depth: node.depth + 1, parent: node, other: true, n: rest.length }); folded++; }
    node.children.forEach(tidy); delete node.map;
  };
  tidy(root);
  if (folded) warn.push(['sunFolded', 11]);
  // розбиття: частка від кореня на відрізку [x0, x1]
  let id = 0;
  const part = (node, x0) => { node.id = id++; node.x0 = x0; node.x1 = x0 + node.value / root.value; let x = x0; node.children.forEach(c => { part(c, x); x = c.x1; }); };
  part(root, 0);
  const nodes = []; const walk = nd => { nodes.push(nd); nd.children.forEach(walk); }; walk(root);
  const depth = Math.max(...nodes.map(nd => nd.depth));
  const leaves = nodes.filter(nd => !nd.children.length);
  const pathOf = nd => { const p = []; for (let x = nd; x && x.depth > 0; x = x.parent) p.unshift(x.name); return p; };
  return {
    root, nodes, depth, warn, valueName: get.name('value'), levelNames: [get.name('level1'), get.name('level2'), ...(l3 ? [get.name('level3')] : [])],
    table: { head: [get.name('level1'), get.name('level2'), ...(l3 ? [get.name('level3')] : []), get.name('value'), L.share], rows: leaves.map(lf => { const p = pathOf(lf); while (p.length < depth) p.push(''); return [...p, lf.value, lf.value / root.value]; }) }, pctCols: [depth + 1],
  };
}

// ——— біваріантна карта: два показники за регіонами, класи за терцилями ———
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
export function prepBimap(get, o, L) {
  const names = get.text('region'), xs = get.num('ind1'), ys = get.num('ind2'), warn = [];
  const acc = new Map(), unknown = new Set();
  names.forEach((nm, i) => {
    if (!nm) return;
    const id = matchRegion(nm); if (!id) { unknown.add(nm); return; }
    const e = acc.get(id) || { x: [], y: [] };
    if (Number.isFinite(xs[i])) e.x.push(xs[i]); if (Number.isFinite(ys[i])) e.y.push(ys[i]);
    acc.set(id, e);
  });
  if (unknown.size) warn.push(['unknownRegions', unknown.size, [...unknown].slice(0, 4).join(', ')]);
  if ([...acc.values()].some(e => e.x.length > 1 || e.y.length > 1)) warn.push(['bimapAvg']);
  const vals = new Map();
  acc.forEach((e, id) => vals.set(id, { x: e.x.length ? mean(e.x) : null, y: e.y.length ? mean(e.y) : null }));
  const both = [...vals.entries()].filter(([, v]) => v.x != null && v.y != null);
  if (both.length < 3) return { error: ['bimapFew'] };
  const brk = key => { const s = Float64Array.from([...vals.values()].map(v => v[key]).filter(v => v != null)).sort(); return [quant(s, 1 / 3), quant(s, 2 / 3)]; };
  const bx = brk('x'), by = brk('y');
  const cls = (v, b) => (v == null ? null : v <= b[0] ? 0 : v <= b[1] ? 1 : 2);
  vals.forEach(v => { v.cx = cls(v.x, bx); v.cy = cls(v.y, by); });
  // кореляція Пірсона між показниками по регіонах з обома значеннями
  const X = both.map(([, v]) => v.x), Y = both.map(([, v]) => v.y), mx = mean(X), my = mean(Y);
  let sxy = 0, sxx = 0, syy = 0; X.forEach((x, i) => { sxy += (x - mx) * (Y[i] - my); sxx += (x - mx) ** 2; syy += (Y[i] - my) ** 2; });
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const ext = key => { const a = [...vals.values()].map(v => v[key]).filter(v => v != null); return [Math.min(...a), Math.max(...a)]; };
  return {
    vals, bx, by, r, n: both.length, ex: ext('x'), ey: ext('y'), warn, xName: get.name('ind1'), yName: get.name('ind2'),
    table: { head: [get.name('region'), get.name('ind1'), get.name('ind2')], rows: REGIONS.map(rg => { const v = vals.get(rg[0]); return [L.lang === 'en' ? rg[2] : rg[1], v ? v.x : null, v ? v.y : null]; }) },
  };
}

// ——— карта часу доїзду: точки з часом і населенням, поле часу між ними ———
const KMLAT = 110.57, KMLON = 111.32;
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o2, a, b) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
  const lo = [], up = [];
  p.forEach(q => { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
  [...p].reverse().forEach(q => { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export const ISO_STEPS = [15, 30, 45, 60];
export function prepIso(get, o, L) {
  const lx = get.num('lon'), ly = get.num('lat'), t = get.num('time'), pop = get.has('pop') ? get.num('pop') : null, lab = get.has('label') ? get.text('label') : null, warn = [];
  let pts = [];
  lx.forEach((x, i) => { if (!Number.isFinite(x) || !Number.isFinite(ly[i]) || !Number.isFinite(t[i]) || t[i] < 0) return; pts.push({ x, y: ly[i], t: t[i], pop: pop && Number.isFinite(pop[i]) ? Math.max(0, pop[i]) : null, label: lab ? lab[i] : '' }); });
  const bad = lx.length - pts.length; if (bad) warn.push(['droppedRows', bad]);
  if (pts.length < 3) return { error: ['needThree'] };
  if (pts.length > 600) { warn.push(['cut', 600, pts.length - 600]); pts = pts.slice(0, 600); }
  // градуси чи площина: за назвами колонок або параметром
  const deg = o.coords === 'deg' || (o.coords !== 'plane' && /lon|lng|довгот/i.test(get.name('lon')) && /lat|широт/i.test(get.name('lat')));
  const lat0 = mean(pts.map(p => p.y)), lon0 = mean(pts.map(p => p.x));
  pts.forEach(p => { if (deg) { p.kx = (p.x - lon0) * KMLON * Math.cos((lat0 * Math.PI) / 180); p.ky = (p.y - lat0) * KMLAT; } else { p.kx = p.x; p.ky = p.y; } });
  // поле часу: найменше з (час населеного пункту + шлях до нього зі швидкістю 20 км/год)
  const speed = 20 / 60;   // км за хвилину
  const xs = pts.map(p => p.kx), ys = pts.map(p => p.ky);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const pad = span * 0.1, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const nx = 150, step = (x1 - x0) / (nx - 1), ny = Math.max(2, Math.round((y1 - y0) / step) + 1);
  const grid = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const gx = x0 + i * step, gy = y1 - j * step;   // рядок 0 зверху (північ)
    let best = Infinity;
    for (const p of pts) { const v = p.t + Math.hypot(gx - p.kx, gy - p.ky) / speed; if (v < best) best = v; }
    grid[j * nx + i] = best;
  }
  // межа поля: опукла оболонка, розширена від центру на 12%
  const h = hull(pts.map(p => [p.kx, p.ky])), cx = mean(h.map(q => q[0])), cy = mean(h.map(q => q[1]));
  const shell = h.map(([x, y]) => [cx + (x - cx) * 1.12 + Math.sign(x - cx) * span * 0.02, cy + (y - cy) * 1.12 + Math.sign(y - cy) * span * 0.02]);
  const T = +(o.limit || 30), out = pts.filter(p => p.t > T);
  const popAll = pts.reduce((s, p) => s + (p.pop || 0), 0), popOut = out.reduce((s, p) => s + (p.pop || 0), 0);
  return {
    pts, grid, nx, ny, x0, y1, step, shell, deg, T, out: out.length, popAll, popOut, hasPop: !!pop, warn, timeName: get.name('time'), popName: get.name('pop'),
    table: { head: [get.name('label') || '#', get.name('lon'), get.name('lat'), get.name('time'), ...(pop ? [get.name('pop')] : [])], rows: [...pts].sort((a, b) => b.t - a.t).map((p, i) => [p.label || String(i + 1), p.x, p.y, p.t, ...(pop ? [p.pop] : [])]) },
  };
}
