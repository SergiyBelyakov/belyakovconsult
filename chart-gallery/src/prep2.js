// Підготовка даних для розширеного набору: рейтинги в часі, повні розподіли, багатовимірні дані, взаємні потоки,
// малі мультиплі. Ті самі правила, що й у prep.js: модель для малювання, таблиця-двійник, попередження з поясненнями.
import { toNum, toDay } from './prep.js';

export const quant = (v, q) => { const p = (v.length - 1) * q, i = Math.floor(p), f = p - i; return i + 1 < v.length ? v[i] * (1 - f) + v[i + 1] * f : v[i]; };
const meanOf = v => v.reduce((s, x) => s + x, 0) / v.length;

// Порядок періодів: числа (роки) і дати сортуємо, решту лишаємо як у файлі
export function sortKeys(keys) {
  if (keys.length && keys.every(k => Number.isFinite(toNum(k)))) return [...keys].sort((a, b) => toNum(a) - toNum(b));
  if (keys.length && keys.every(k => Number.isFinite(toDay(k)))) return [...keys].sort((a, b) => toDay(a) - toDay(b));
  return keys;
}

// Ядрова оцінка щільності: гаусове ядро, ширина вікна за правилом Сільвермана
export function bandwidth(v) {
  const n = v.length, sd = Math.sqrt(v.reduce((s, x) => s + (x - meanOf(v)) ** 2, 0) / Math.max(1, n - 1));
  const iqr = quant(v, 0.75) - quant(v, 0.25);
  const s = Math.min(sd, iqr / 1.34) || sd || Math.abs(v[0]) * 0.1 || 1;
  return 0.9 * s * n ** -0.2;
}
export function kde(v, grid, h) {
  const k = 1 / (v.length * h * Math.sqrt(2 * Math.PI));
  return grid.map(x => { let s = 0; for (let i = 0; i < v.length; i++) { const u = (x - v[i]) / h; if (u > -5 && u < 5) s += Math.exp(-0.5 * u * u); } return s * k; });
}
const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

// Групи значень (необов'язкова колонка групи): спільна частина для скрипкової і хвиль розподілів
function groupValues(get, L, { need, maxG }) {
  const g = get.has('group') ? get.text('group') : null, raw = get.num('value'), warn = [];
  if (need && !g) return { error: ['needGroup'] };
  const bad = raw.filter((x, i) => !Number.isFinite(x) && (!g || g[i])).length; if (bad) warn.push(['dropped', bad, get.name('value')]);
  const m = new Map();
  raw.forEach((x, i) => { if (!Number.isFinite(x)) return; const k = g ? g[i] || L.other : get.name('value'); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  let names = [...m.keys()];
  if (names.length > maxG) {
    const top = new Set([...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, maxG - 1).map(e => e[0]));
    const rest = []; names.filter(n => !top.has(n)).forEach(n => rest.push(...m.get(n)));
    warn.push(['seriesFolded', maxG - 1, names.length - (maxG - 1)]);
    names = names.filter(n => top.has(n)); m.set(L.other, rest); names.push(L.other);
  }
  const small = names.filter(n => m.get(n).length < 5);
  if (small.length) warn.push(['smallGroups', small.length]);
  names = sortKeys(names.filter(n => m.get(n).length >= 5));
  if (!names.length) return { error: ['needFive'] };
  return { names, m, warn };
}
function summary(label, arr) {
  const v = Float64Array.from(arr).sort();
  return { label, n: v.length, v, min: v[0], max: v[v.length - 1], q1: quant(v, 0.25), med: quant(v, 0.5), q3: quant(v, 0.75), mean: meanOf(v), h: bandwidth(v) };
}

// ——— скрипкова діаграма і рій точок ———
export function prepViolin(get, o, L) {
  const r = groupValues(get, L, { need: false, maxG: 8 });
  if (r.error) return r;
  const groups = r.names.map(n => summary(n, r.m.get(n)));
  // щільність на власному діапазоні групи: за межі даних скрипка не виходить
  groups.forEach(g => { g.grid = linspace(g.min, g.max, 72); g.dens = g.max > g.min ? kde(g.v, g.grid, g.h) : g.grid.map(() => 1); });
  if (o.sort === 'median') groups.sort((a, b) => b.med - a.med);
  const big = groups.filter(g => g.n > 600).length; if (big) r.warn.push(['swarmThin', 600]);
  return {
    groups, warn: r.warn, valueName: get.name('value'), hasGroups: get.has('group'),
    dmax: Math.max(...groups.map(g => Math.max(...g.dens))), lo: Math.min(...groups.map(g => g.min)), hi: Math.max(...groups.map(g => g.max)),
    table: { head: [get.name('group') || '', L.n, 'Min', 'Q1', L.median, 'Q3', 'Max', L.mean], rows: groups.map(g => [g.label, g.n, g.min, g.q1, g.med, g.q3, g.max, g.mean]) },
  };
}

// ——— хвилі розподілів (ridgeline) ———
export function prepRidge(get, o, L) {
  const r = groupValues(get, L, { need: true, maxG: 24 });
  if (r.error) return r;
  let groups = r.names.map(n => summary(n, r.m.get(n)));
  if (groups.length < 2) return { error: ['needTwoGroups'] };
  const lo = Math.min(...groups.map(g => g.min)), hi = Math.max(...groups.map(g => g.max));
  const pad = (hi - lo) * 0.04, grid = linspace(lo - pad, hi + pad, 110);
  groups.forEach(g => { g.dens = kde(g.v, grid, g.h || (hi - lo) / 30 || 1); g.dmax = Math.max(...g.dens); });
  if (o.sort === 'median') groups = [...groups].sort((a, b) => a.med - b.med);
  return {
    groups, grid, warn: r.warn, valueName: get.name('value'), groupName: get.name('group'),
    dmax: Math.max(...groups.map(g => g.dmax)), lo: grid[0], hi: grid[grid.length - 1], medLo: Math.min(...groups.map(g => g.med)), medHi: Math.max(...groups.map(g => g.med)),
    table: { head: [get.name('group'), L.n, 'Q1', L.median, 'Q3', L.mean], rows: groups.map(g => [g.label, g.n, g.q1, g.med, g.q3, g.mean]) },
  };
}

// ——— рейтинг у часі (bump) ———
export function prepBump(get, o, L) {
  const per = get.text('period'), it = get.text('item'), v = get.num('value'), warn = [];
  const bad = per.reduce((s, p, i) => s + (p && it[i] && !Number.isFinite(v[i]) ? 1 : 0), 0); if (bad) warn.push(['dropped', bad, get.name('value')]);
  const m = new Map(), pList = [], pSeen = new Set();
  let dup = 0;
  per.forEach((p, i) => {
    if (!p || !it[i] || !Number.isFinite(v[i])) return;
    if (!pSeen.has(p)) { pSeen.add(p); pList.push(p); }
    if (!m.has(it[i])) m.set(it[i], new Map());
    const mm = m.get(it[i]); if (mm.has(p)) dup++;
    mm.set(p, (mm.get(p) || 0) + v[i]);
  });
  if (dup) warn.push(['summed', dup]);
  let periods = sortKeys(pList);
  if (periods.length < 2) return { error: ['bumpPeriods'] };
  if (m.size < 3) return { error: ['bumpItems'] };
  if (periods.length > 16) { warn.push(['lastPeriods', 16, periods.length - 16]); periods = periods.slice(-16); }
  const desc = o.rank !== 'asc';
  const rankAll = names => {
    const out = new Map(names.map(n => [n, []]));
    let prev = new Map();
    periods.forEach(p => {
      const here = names.filter(n => m.get(n).has(p));
      here.sort((a, b) => (desc ? m.get(b).get(p) - m.get(a).get(p) : m.get(a).get(p) - m.get(b).get(p)) || (prev.get(a) ?? 1e9) - (prev.get(b) ?? 1e9) || a.localeCompare(b));
      const cur = new Map(here.map((n, k) => [n, k + 1]));
      names.forEach(n => out.get(n).push(cur.get(n) ?? null));
      prev = cur;
    });
    return out;
  };
  let names = [...m.keys()], ranks = rankAll(names);
  if (names.length > 15) {
    const avg = n => { const r = ranks.get(n).filter(x => x != null); return r.reduce((s, x) => s + x, 0) / r.length; };
    const keep = [...names].sort((a, b) => avg(a) - avg(b)).slice(0, 15);
    warn.push(['bumpCut', 15, names.length - 15]);
    names = names.filter(n => keep.includes(n)); ranks = rankAll(names);
  }
  const items = names.map(n => ({ name: n, r: ranks.get(n), v: periods.map(p => (m.get(n).has(p) ? m.get(n).get(p) : null)) }));
  // хто піднявся і хто опустився найбільше між першим і останнім періодом
  const moved = items.filter(i => i.r[0] != null && i.r[i.r.length - 1] != null).map(i => ({ name: i.name, d: i.r[0] - i.r[i.r.length - 1] }));
  const rise = moved.length ? moved.reduce((a, b) => (b.d > a.d ? b : a)) : null, fall = moved.length ? moved.reduce((a, b) => (b.d < a.d ? b : a)) : null;
  return {
    periods, items, N: Math.max(...items.flatMap(i => i.r.filter(x => x != null))), desc, warn, valueName: get.name('value'), itemName: get.name('item'),
    rise: rise && rise.d > 0 ? rise.name : null, fall: fall && fall.d < 0 && (!rise || fall.name !== rise.name) ? fall.name : null,
    table: { head: [get.name('period'), get.name('item'), get.name('value'), L.rank], rows: periods.flatMap((p, t) => items.filter(i => i.r[t] != null).sort((a, b) => a.r[t] - b.r[t]).map(i => [p, i.name, i.v[t], i.r[t]])) },
  };
}

// ——— паралельні координати: кожна числова колонка стає віссю ———
export function prepParallel(get, o, L) {
  const tb = get.table, lab = get.map.label ?? -1, grp = get.map.group ?? -1, warn = [];
  const numCols = tb.head.map((h, k) => k).filter(k => k !== lab && k !== grp && tb.rows.some(r => r[k] !== '' && r[k] != null) && tb.rows.every(r => r[k] === '' || r[k] == null || Number.isFinite(toNum(r[k]))));
  if (numCols.length < 3) return { error: ['parallelAxes'] };
  const cols = numCols.slice(0, 8); if (numCols.length > 8) warn.push(['colsCut', 8, numCols.length - 8]);
  let rows = tb.rows.map((r, i) => ({ label: lab >= 0 ? String(r[lab] ?? '').trim() : String(i + 1), g: grp >= 0 ? String(r[grp] ?? '').trim() || L.other : '', v: cols.map(k => toNum(r[k])) }))
    .filter(r => r.v.filter(Number.isFinite).length >= 2);
  const dropped = tb.rows.length - rows.length; if (dropped) warn.push(['droppedRows', dropped]);
  if (rows.length < 3) return { error: ['needThree'] };
  if (rows.length > 500) { warn.push(['cut', 500, rows.length - 500]); rows = rows.slice(0, 500); }
  let groups = [];
  if (grp >= 0) {
    const cnt = new Map(); rows.forEach(r => cnt.set(r.g, (cnt.get(r.g) || 0) + 1));
    groups = [...cnt.keys()];
    if (groups.length > 3) { const top = new Set([...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])); rows.forEach(r => { if (!top.has(r.g)) r.g = L.other; }); warn.push(['groups3', groups.length - 2]); groups = [...groups.filter(g => top.has(g)), L.other]; }
  }
  const axes = cols.map((k, j) => { const vs = rows.map(r => r.v[j]).filter(Number.isFinite); return { name: String(tb.head[k]), min: Math.min(...vs), max: Math.max(...vs) }; });
  return {
    axes, rows, groups, warn, labelName: lab >= 0 ? String(tb.head[lab]) : '#', groupName: grp >= 0 ? String(tb.head[grp]) : '',
    table: { head: [lab >= 0 ? String(tb.head[lab]) : '#', ...(grp >= 0 ? [String(tb.head[grp])] : []), ...axes.map(a => a.name)], rows: rows.map(r => [r.label, ...(grp >= 0 ? [r.g] : []), ...r.v.map(x => (Number.isFinite(x) ? x : null))]) },
  };
}

// ——— хордова діаграма: взаємні потоки між тими самими учасниками ———
export function prepChord(get, o, L) {
  const s = get.text('from'), t = get.text('to'), vals = get.num('value'), warn = [];
  const m = new Map(), tot = new Map();
  let self = 0, neg = 0;
  s.forEach((a, i) => {
    const b = t[i]; if (!a || !b || !Number.isFinite(vals[i])) return;
    if (vals[i] < 0) { neg++; return; }
    if (a === b) { self++; return; }
    const k = a + '\u0001' + b; m.set(k, (m.get(k) || 0) + vals[i]);
    tot.set(a, (tot.get(a) || 0) + vals[i]); tot.set(b, (tot.get(b) || 0) + vals[i]);
  });
  if (self) warn.push(['selfLoops', self]);
  if (neg) warn.push(['negDropped', neg]);
  if (!m.size) return { error: ['noEdges'] };
  let names = [...tot.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  if (names.length < 3) return { error: ['chordFew'] };
  const fold = names.length > 10;
  if (fold) { warn.push(['seriesFolded', 9, names.length - 9]); names = [...names.slice(0, 9), L.other]; }
  const idx = new Map(names.map((n, k) => [n, k]));
  const at = n => (idx.has(n) ? idx.get(n) : names.length - 1);
  const mat = names.map(() => names.map(() => 0));
  let folded = 0;
  m.forEach((v, k) => { const [a, b] = k.split('\u0001'); const i = at(a), j = at(b); if (i === j) { folded += v; return; } mat[i][j] += v; });
  if (folded > 0) warn.push(['chordInner']);
  const out = mat.map(r => r.reduce((x, y) => x + y, 0)), inn = names.map((_, j) => mat.reduce((x, r) => x + r[j], 0));
  return {
    names, mat, out, inn, total: out.reduce((x, y) => x + y, 0), otherLast: fold, warn, valueName: get.name('value'),
    table: { head: [get.name('from'), ...names], rows: names.map((n, i) => [n, ...mat[i]]) },
  };
}

// ——— малі мультиплі: одна панель на значення колонки «панель» ———
export function prepSmall(get, o, L) {
  const d = get.date('date'), v = get.num('value'), fc = get.text('facet'), warn = [];
  const badD = d.filter((x, i) => !Number.isFinite(x) && (get.text('date')[i] || '') !== '').length;
  if (badD) warn.push(['badDates', badD, get.name('date')]);
  const ok = d.map((x, i) => Number.isFinite(x) && Number.isFinite(v[i]) && fc[i]);
  if (!ok.some(Boolean)) return { error: ['needDates', get.name('date')] };
  const order = [], seen = new Set();
  fc.forEach((x, i) => { if (ok[i] && !seen.has(x)) { seen.add(x); order.push(x); } });
  let names = order;
  if (names.length > 24) { warn.push(['hiddenFacets', 24, names.length - 24]); names = names.slice(0, 24); }
  const ni = new Map(names.map((x, k) => [x, k]));
  const days = [...new Set(d.filter((x, i) => ok[i] && ni.has(fc[i])))].sort((a, b) => a - b);
  if (days.length < 2) return { error: ['needTwoDates'] };
  const di = new Map(days.map((x, k) => [x, k]));
  const val = names.map(() => days.map(() => null));
  let dup = 0;
  d.forEach((x, i) => { if (!ok[i] || !ni.has(fc[i])) return; const a = ni.get(fc[i]), b = di.get(x); if (val[a][b] != null) dup++; val[a][b] = (val[a][b] || 0) + v[i]; });
  if (dup) warn.push(['summed', dup]);
  return { days, names, val, warn, valueName: get.name('value'), facetName: get.name('facet'), table: { head: [get.name('date'), ...names], rows: days.map((x, b) => [x, ...names.map((_, a) => val[a][b])]) }, dateCols: [0] };
}
