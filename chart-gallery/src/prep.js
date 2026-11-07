// Підготовка даних для кожного типу графіка: читання колонок за ролями, агрегування, згортання хвоста в «Інші»,
// перевірки з поясненнями. Повертає модель для малювання і таблицю-двійника, або { error }.
import { parseNum, parseDate } from '../../anomaly-demo/src/fileio.js';
import { dayOf } from './format.js';

export const toNum = v => (typeof v === 'number' ? v : v == null || v === '' ? NaN : parseNum(v));
export function toDay(v) {
  if (v == null || v === '' || typeof v === 'number') return NaN;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return dayOf(+m[1], +m[2], 1);
  m = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return dayOf(+m[2], +m[1], 1);
  const p = parseDate(s);
  return p ? p.day : NaN;
}

export function access(table, map) {
  const rows = table.rows, n = rows.length;
  const k = r => (map && map[r] != null ? map[r] : -1);
  const col = (r, f) => { const c = k(r); return rows.map(row => f(c < 0 ? undefined : row[c])); };
  return {
    n,
    has: r => k(r) >= 0,
    name: r => (k(r) >= 0 ? String(table.head[k(r)]) : ''),
    text: r => col(r, v => (v == null ? '' : String(v).trim())),
    num: r => col(r, toNum),
    date: r => col(r, toDay),
    table, map,
  };
}

const sumBy = (keys, vals) => {
  const m = new Map();
  keys.forEach((key, i) => { const v = vals[i]; if (!key || !Number.isFinite(v)) return; m.set(key, (m.get(key) || 0) + v); });
  return m;
};
const countDup = keys => { const s = new Set(); let d = 0; keys.forEach(k => { if (!k) return; if (s.has(k)) d++; else s.add(k); }); return d; };
const badNums = (keys, vals) => vals.reduce((s, v, i) => s + (keys[i] && !Number.isFinite(v) ? 1 : 0), 0);
// Найбільші n-1 + «Інші»; порядок решти зберігається
function fold(entries, n, other) {
  if (entries.length <= n) return { items: entries.map(([label, value]) => ({ label, value })), folded: 0 };
  const sorted = [...entries].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const keep = new Set(sorted.slice(0, n - 1).map(e => e[0]));
  const items = entries.filter(e => keep.has(e[0])).map(([label, value]) => ({ label, value }));
  const rest = sorted.slice(n - 1);
  items.push({ label: other, value: rest.reduce((s, e) => s + e[1], 0), other: true });
  return { items, folded: rest.length };
}
const quant = (v, q) => { const p = (v.length - 1) * q, i = Math.floor(p), f = p - i; return i + 1 < v.length ? v[i] * (1 - f) + v[i + 1] * f : v[i]; };

// ——— категорія і значення ———
function catValue(get, L, max, sort) {
  const cats = get.text('cat'), vals = get.num('value');
  const warn = [];
  const bad = badNums(cats, vals); if (bad) warn.push(['dropped', bad, get.name('value')]);
  const dup = countDup(cats); if (dup) warn.push(['summed', dup]);
  const m = sumBy(cats, vals);
  if (!m.size) return { error: ['noRows', get.name('value')] };
  let entries = [...m.entries()];
  if (sort === 'value') entries.sort((a, b) => b[1] - a[1]);
  const { items, folded } = fold(entries, max, L.other);
  if (folded) warn.push(['folded', max - 1, folded]);
  return { items, warn, catName: get.name('cat'), valueName: get.name('value'), table: { head: [get.name('cat'), get.name('value')], rows: items.map(i => [i.label, i.value]) } };
}
export const prepColumn = (get, o, L) => catValue(get, L, 24, o.sort);
export const prepBar = (get, o, L) => catValue(get, L, 20, o.sort === 'file' ? 'file' : 'value');

// ——— категорія × серія × значення ———
function matrix(get, L, { maxS = 6, maxC = 24, noNeg } = {}) {
  const cats = get.text('cat'), ser = get.has('series') ? get.text('series') : cats.map(() => get.name('value')), vals = get.num('value');
  const warn = [];
  const bad = badNums(cats, vals); if (bad) warn.push(['dropped', bad, get.name('value')]);
  if (noNeg && vals.some(v => v < 0)) { warn.push(['negDropped', vals.filter(v => v < 0).length]); }
  const keep = (i) => cats[i] && ser[i] && Number.isFinite(vals[i]) && !(noNeg && vals[i] < 0);
  const sTot = new Map(), cOrder = [], cSet = new Set();
  cats.forEach((c, i) => { if (!keep(i)) return; if (!cSet.has(c)) { cSet.add(c); cOrder.push(c); } sTot.set(ser[i], (sTot.get(ser[i]) || 0) + Math.abs(vals[i])); });
  if (!cOrder.length) return { error: ['noRows', get.name('value')] };
  let sNames = [...sTot.keys()];
  let sFold = 0;
  if (sNames.length > maxS) {
    const top = new Set([...sTot.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxS - 1).map(e => e[0]));
    sFold = sNames.length - top.size;
    sNames = sNames.filter(s => top.has(s)).concat([L.other]);
    warn.push(['seriesFolded', maxS - 1, sFold]);
  }
  let cNames = cOrder, cFold = 0;
  if (cOrder.length > maxC) {
    const cTot = new Map(); cats.forEach((c, i) => { if (keep(i)) cTot.set(c, (cTot.get(c) || 0) + Math.abs(vals[i])); });
    const top = new Set([...cTot.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxC - 1).map(e => e[0]));
    cFold = cOrder.length - top.size;
    cNames = cOrder.filter(c => top.has(c)).concat([L.other]);
    warn.push(['folded', maxC - 1, cFold]);
  }
  const si = new Map(sNames.map((s, k) => [s, k])), ci = new Map(cNames.map((c, k) => [c, k]));
  const v = cNames.map(() => sNames.map(() => 0));
  cats.forEach((c, i) => {
    if (!keep(i)) return;
    const a = ci.has(c) ? ci.get(c) : cNames.length - 1, b = si.has(ser[i]) ? si.get(ser[i]) : sNames.length - 1;
    v[a][b] += vals[i];
  });
  const dupKeys = countDup(cats.map((c, i) => (keep(i) ? c + '\u0001' + ser[i] : ''))); if (dupKeys) warn.push(['summed', dupKeys]);
  return {
    cats: cNames, series: sNames, v, warn, hasSeries: get.has('series'), valueName: get.name('value'),
    otherS: sFold > 0, otherC: cFold > 0,
    table: { head: [get.name('cat'), ...sNames], rows: cNames.map((c, a) => [c, ...v[a]]) },
  };
}
export const prepGrouped = (get, o, L) => matrix(get, L, { maxS: 6, maxC: 16 });
export const prepStacked = (get, o, L) => matrix(get, L, { maxS: 6, maxC: 24, noNeg: true });
export const prepRadar = (get, o, L) => {
  const m = matrix({ ...get, text: r => get.text(r === 'cat' ? 'axis' : r), name: r => get.name(r === 'cat' ? 'axis' : r), has: r => get.has(r) }, L, { maxS: 3, maxC: 12 });
  if (m.error) return m;
  if (m.cats.length < 3) return { error: ['radarAxes'] };
  const max = Math.max(...m.v.flat());
  if (!(max > 0)) return { error: ['noRows', get.name('value')] };
  return m;
};

// ——— до і після ———
export function prepDumbbell(get, o) {
  const cats = get.text('cat'), a = get.num('before'), b = get.num('after');
  const warn = [], seen = new Set();
  let rows = [];
  cats.forEach((c, i) => { if (!c || !Number.isFinite(a[i]) || !Number.isFinite(b[i])) return; if (seen.has(c)) return; seen.add(c); rows.push({ label: c, a: a[i], b: b[i] }); });
  const bad = cats.filter(Boolean).length - rows.length; if (bad) warn.push(['droppedRows', bad]);
  if (!rows.length) return { error: ['noRows', get.name('before')] };
  if (o.sort === 'change') rows.sort((x, y) => (y.b - y.a) - (x.b - x.a));
  else if (o.sort !== 'file') rows.sort((x, y) => y.b - x.b);
  if (rows.length > 30) { warn.push(['cut', 30, rows.length - 30]); rows = rows.slice(0, 30); }
  return { rows, warn, names: [get.name('before'), get.name('after')], table: { head: [get.name('cat'), get.name('before'), get.name('after')], rows: rows.map(r => [r.label, r.a, r.b]) } };
}
export function prepBullet(get) {
  const cats = get.text('cat'), a = get.num('actual'), t = get.num('target');
  const warn = [];
  let rows = cats.map((c, i) => ({ label: c, a: a[i], t: t[i] })).filter(r => r.label && Number.isFinite(r.a) && Number.isFinite(r.t));
  const bad = cats.filter(Boolean).length - rows.length; if (bad) warn.push(['droppedRows', bad]);
  if (!rows.length) return { error: ['noRows', get.name('actual')] };
  if (rows.length > 20) { warn.push(['cut', 20, rows.length - 20]); rows = rows.slice(0, 20); }
  return { rows, warn, names: [get.name('actual'), get.name('target')], table: { head: [get.name('cat'), get.name('actual'), get.name('target')], rows: rows.map(r => [r.label, r.a, r.t]) } };
}
export const prepMeter = prepBullet;

// ——— час ———
function byDate(get, valueRole = 'value', agg = 'sum') {
  const d = get.date('date'), v = get.num(valueRole), warn = [];
  const badD = d.filter((x, i) => !Number.isFinite(x) && (get.text('date')[i] || '') !== '').length;
  if (badD) warn.push(['badDates', badD, get.name('date')]);
  const badV = v.filter((x, i) => Number.isFinite(d[i]) && !Number.isFinite(x)).length;
  if (badV) warn.push(['dropped', badV, get.name(valueRole)]);
  return { d, v, warn };
}
const monthStart = day => { const t = new Date(day * 864e5); return dayOf(t.getUTCFullYear(), t.getUTCMonth() + 1, 1); };

export function prepLine(get, o, L) {
  const { d, v, warn } = byDate(get);
  const ser = get.has('series') ? get.text('series') : d.map(() => get.name('value'));
  let ok = d.map((x, i) => Number.isFinite(x) && Number.isFinite(v[i]) && ser[i]);
  if (!ok.some(Boolean)) return { error: ['needDates', get.name('date')] };
  let dd = d;
  const distinct = new Set(d.filter((x, i) => ok[i])).size;
  if (distinct > 400) { dd = d.map(x => (Number.isFinite(x) ? monthStart(x) : x)); warn.push(['byMonth']); }
  const tot = new Map(); ser.forEach((s, i) => { if (ok[i]) tot.set(s, (tot.get(s) || 0) + Math.abs(v[i])); });
  let names = [...tot.keys()];
  if (names.length > 5) {
    const top = new Set([...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]));
    warn.push(['hiddenSeries', 5, names.length - 5]);
    names = names.filter(s => top.has(s));
  }
  const si = new Map(names.map((s, k) => [s, k]));
  const days = [...new Set(dd.filter((x, i) => ok[i] && si.has(ser[i])))].sort((a, b) => a - b);
  const di = new Map(days.map((x, k) => [x, k]));
  const val = names.map(() => days.map(() => null));
  dd.forEach((x, i) => { if (!ok[i] || !si.has(ser[i])) return; const a = si.get(ser[i]), b = di.get(x); val[a][b] = (val[a][b] || 0) + v[i]; });
  if (days.length < 2) return { error: ['needTwoDates'] };
  return { days, names, val, warn, hasSeries: get.has('series'), valueName: get.name('value'), table: { head: [get.name('date'), ...names], rows: days.map((x, b) => [x, ...names.map((_, a) => val[a][b])]) }, dateCols: [0] };
}
export function prepArea(get, o) {
  const { d, v, warn } = byDate(get);
  const m = new Map();
  d.forEach((x, i) => { if (Number.isFinite(x) && Number.isFinite(v[i])) m.set(x, (m.get(x) || 0) + v[i]); });
  let days = [...m.keys()].sort((a, b) => a - b);
  if (days.length < 2) return { error: ['needTwoDates'] };
  if (days.length > 400) { const mm = new Map(); days.forEach(x => { const k = monthStart(x); mm.set(k, (mm.get(k) || 0) + m.get(x)); }); m.clear(); mm.forEach((val, k) => m.set(k, val)); days = [...m.keys()].sort((a, b) => a - b); warn.push(['byMonth']); }
  const vals = days.map(x => m.get(x));
  const ma = o.smooth === 'ma' ? vals.map((_, k) => { const s = vals.slice(Math.max(0, k - 2), k + 1); return s.length < 3 ? null : s.reduce((a, b) => a + b, 0) / 3; }) : null;
  return { days, vals, ma, warn, valueName: get.name('value'), table: { head: [get.name('date'), get.name('value')], rows: days.map((x, k) => [x, vals[k]]) }, dateCols: [0] };
}
export function prepKpi(get, o) {
  const { d, v, warn } = byDate(get);
  const m = new Map();
  d.forEach((x, i) => { if (Number.isFinite(x) && Number.isFinite(v[i])) { const e = m.get(x) || [0, 0]; e[0] += v[i]; e[1]++; m.set(x, e); } });
  const days = [...m.keys()].sort((a, b) => a - b);
  if (days.length < 2) return { error: ['needTwoDates'] };
  if ([...m.values()].some(e => e[1] > 1)) warn.push(['averaged']);
  const vals = days.map(x => m.get(x)[0] / m.get(x)[1]);
  const tail = vals.slice(-26), tdays = days.slice(-26);
  return { days: tdays, vals: tail, all: vals.length, warn, valueName: get.name('value'), better: o.better || 'less', table: { head: [get.name('date'), get.name('value')], rows: tdays.map((x, k) => [x, tail[k]]) }, dateCols: [0] };
}
export function prepCalendar(get) {
  const { d, v, warn } = byDate(get);
  const m = new Map();
  d.forEach((x, i) => { if (Number.isFinite(x) && Number.isFinite(v[i])) m.set(x, (m.get(x) || 0) + v[i]); });
  if (m.size < 7) return { error: ['needDays'] };
  const last = Math.max(...m.keys()), first = Math.max(Math.min(...m.keys()), last - 370);
  const cut = [...m.keys()].filter(x => x < first).length; if (cut) warn.push(['lastYear', cut]);
  const days = [...m.keys()].filter(x => x >= first).sort((a, b) => a - b);
  return { first, last, map: m, warn, valueName: get.name('value'), table: { head: [get.name('date'), get.name('value')], rows: days.map(x => [x, m.get(x)]) }, dateCols: [0] };
}
export function prepGantt(get, o, L) {
  const task = get.text('task'), s = get.date('start'), e = get.date('end'), g = get.has('group') ? get.text('group') : null, warn = [];
  let rows = [];
  let bad = 0, swapped = 0;
  task.forEach((t, i) => {
    if (!t) return;
    if (!Number.isFinite(s[i]) || !Number.isFinite(e[i])) { bad++; return; }
    let a = s[i], b = e[i]; if (b < a) { [a, b] = [b, a]; swapped++; }
    rows.push({ label: t, s: a, e: b, g: g ? g[i] || L.other : '' });
  });
  if (bad) warn.push(['badDates', bad, get.name('start') + ' / ' + get.name('end')]);
  if (swapped) warn.push(['swapped', swapped]);
  if (!rows.length) return { error: ['needDates', get.name('start')] };
  if (rows.length > 30) { warn.push(['cut', 30, rows.length - 30]); rows = rows.slice(0, 30); }
  if (o.sort !== 'file') rows.sort((a, b) => a.s - b.s || a.e - b.e);
  let groups = g ? [...new Set(rows.map(r => r.g))] : [];
  if (groups.length > 5) { const top = groups.slice(0, 4); rows.forEach(r => { if (!top.includes(r.g)) r.g = L.other; }); groups = [...top, L.other]; warn.push(['seriesFolded', 4, groups.length - 4]); }
  return { rows, groups, warn, table: { head: [get.name('task'), get.name('start'), get.name('end'), ...(g ? [get.name('group')] : [])], rows: rows.map(r => [r.label, r.s, r.e, ...(g ? [r.g] : [])]) }, dateCols: [1, 2] };
}

// ——— частки ———
export function prepDonut(get, o, L) {
  const r = catValue(get, L, 6, 'file');
  if (r.error) return r;
  if (r.items.some(i => i.value < 0)) return { error: ['negPart'] };
  r.total = r.items.reduce((s, i) => s + i.value, 0);
  if (!(r.total > 0)) return { error: ['noRows', get.name('value')] };
  // від найбільшої частки до найменшої, «Інші» в кінці
  r.items.sort((a, b) => (a.other ? 1 : b.other ? -1 : b.value - a.value));
  r.table.rows = r.items.map(i => [i.label, i.value]);
  r.table.head.push(L.share); r.table.rows.forEach((row, k) => row.push(r.items[k].value / r.total));
  r.pctCols = [2];
  return r;
}
export function prepTreemap(get, o, L) {
  const cats = get.text('cat'), vals = get.num('value'), grp = get.has('group') ? get.text('group') : null, warn = [];
  const bad = badNums(cats, vals); if (bad) warn.push(['dropped', bad, get.name('value')]);
  const neg = vals.filter(v => v <= 0).length; if (neg) warn.push(['nonPositive', neg]);
  const leaves = new Map();
  cats.forEach((c, i) => { if (!c || !(vals[i] > 0)) return; const gname = grp ? grp[i] || L.other : ''; const k = gname + '\u0001' + c; leaves.set(k, { g: gname, label: c, value: (leaves.get(k)?.value || 0) + vals[i] }); });
  if (!leaves.size) return { error: ['noRows', get.name('value')] };
  const gt = new Map(); leaves.forEach(l => gt.set(l.g, (gt.get(l.g) || 0) + l.value));
  let gNames = [...gt.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  if (gNames.length > 6) { const top = new Set(gNames.slice(0, 5)); warn.push(['seriesFolded', 5, gNames.length - 5]); leaves.forEach(l => { if (!top.has(l.g)) l.g = L.other; }); gNames = [...gNames.slice(0, 5), L.other]; }
  const groups = gNames.map(g => {
    let items = [...leaves.values()].filter(l => l.g === g).sort((a, b) => b.value - a.value);
    if (items.length > 14) { const rest = items.slice(13); items = items.slice(0, 13); items.push({ g, label: L.other, value: rest.reduce((s, x) => s + x.value, 0), other: true }); }
    return { name: g, items, value: items.reduce((s, x) => s + x.value, 0) };
  });
  const total = groups.reduce((s, g) => s + g.value, 0);
  return { groups, total, hasGroups: !!grp, warn, table: { head: [...(grp ? [get.name('group')] : []), get.name('cat'), get.name('value')], rows: groups.flatMap(g => g.items.map(i => [...(grp ? [g.name] : []), i.label, i.value])) } };
}
export function prepWaterfall(get, o, L) {
  const steps = get.text('step'), vals = get.num('value'), warn = [];
  let rows = steps.map((s, i) => ({ label: s, v: vals[i] })).filter(r => r.label && Number.isFinite(r.v));
  const bad = steps.filter(Boolean).length - rows.length; if (bad) warn.push(['droppedRows', bad]);
  if (rows.length < 2) return { error: ['needTwoRows'] };
  if (rows.length > 20) { warn.push(['cut', 20, rows.length - 20]); rows = rows.slice(0, 20); }
  const bars = [];
  let acc = 0;
  rows.forEach((r, k) => {
    if (k === 0 && o.first !== 'delta') { bars.push({ label: r.label, from: 0, to: r.v, kind: 'total' }); acc = r.v; return; }
    bars.push({ label: r.label, from: acc, to: acc + r.v, kind: r.v >= 0 ? 'up' : 'down', delta: r.v });
    acc += r.v;
  });
  bars.push({ label: L.endTotal, from: 0, to: acc, kind: 'total' });
  return { bars, warn, table: { head: [get.name('step'), get.name('value'), L.running], rows: bars.map(b => [b.label, b.kind === 'total' ? b.to : b.delta, b.to]) } };
}
export function prepFunnel(get, o, L) {
  const st = get.text('stage'), vals = get.num('value'), warn = [];
  const m = sumBy(st, vals);
  let rows = [...m.entries()].map(([label, value]) => ({ label, value }));
  if (rows.length < 2) return { error: ['needTwoRows'] };
  if (rows.length > 10) { warn.push(['cut', 10, rows.length - 10]); rows = rows.slice(0, 10); }
  if (rows.some((r, k) => k && r.value > rows[k - 1].value)) warn.push(['funnelUp']);
  return { rows, warn, valueName: get.name('value'), table: { head: [get.name('stage'), get.name('value'), L.fromPrev, L.fromFirst], rows: rows.map((r, k) => [r.label, r.value, k ? r.value / rows[k - 1].value : 1, r.value / rows[0].value]) }, pctCols: [2, 3] };
}
const SCALE_WORDS = [
  /(зовсім|повністю|категорично|абсолютно)\s+не\s+(згод|задовол)|strongly\s+disagree|very\s+dissatisf|very\s+poor|дуже\s+пога/i,
  /(скоріше|частково)\s+не\s+(згод|задовол)|^не\s+згод|^disagree|dissatisf|^poor|^погано/i,
  /важко\s+сказати|нейтрал|ні\s+те\s*,?\s+ні\s+інше|neutral|neither|не\s+знаю|don.?t\s+know/i,
  /(скоріше|частково)\s+(згод|задовол)|^згоден|^agree|^satisf|^good|^добре/i,
  /(повністю|цілком|абсолютно)\s+(згод|задовол)|strongly\s+agree|very\s+satisf|excellent|дуже\s+добре|відмінно/i,
];
export function prepLikert(get, o, L) {
  const q = get.text('question'), a = get.text('answer'), c = get.has('count') ? get.num('count') : q.map(() => 1), warn = [];
  const order = [];
  a.forEach(x => { if (x && !order.includes(x)) order.push(x); });
  if (order.length < 2) return { error: ['likertLevels'] };
  if (order.length > 7) return { error: ['likertMany', order.length] };
  const rank = x => SCALE_WORDS.findIndex(re => re.test(x));
  if (order.every(x => rank(x) >= 0) && new Set(order.map(rank)).size === order.length) order.sort((x, y) => rank(x) - rank(y));
  const qs = [];
  q.forEach(x => { if (x && !qs.includes(x)) qs.push(x); });
  if (qs.length > 15) { warn.push(['cut', 15, qs.length - 15]); qs.length = 15; }
  const qi = new Map(qs.map((x, k) => [x, k])), ai = new Map(order.map((x, k) => [x, k]));
  const v = qs.map(() => order.map(() => 0));
  q.forEach((x, i) => { if (qi.has(x) && ai.has(a[i]) && Number.isFinite(c[i])) v[qi.get(x)][ai.get(a[i])] += c[i]; });
  return { qs, levels: order, v, warn, table: { head: [get.name('question'), ...order], rows: qs.map((x, k) => [x, ...v[k]]) } };
}

// ——— розподіл ———
export function prepHistogram(get, o, L) {
  const raw = get.num('value'), warn = [];
  const v = Float64Array.from(raw.filter(Number.isFinite)).sort();
  const bad = raw.length - v.length; if (bad) warn.push(['dropped', bad, get.name('value')]);
  if (v.length < 10) return { error: ['needTen'] };
  const lo = v[0], hi = v[v.length - 1];
  const iqr = quant(v, 0.75) - quant(v, 0.25);
  let k = o.bins && o.bins !== 'auto' ? +o.bins : Math.round((hi - lo) / Math.max(1e-9, 2 * iqr / Math.cbrt(v.length)));
  k = Math.max(5, Math.min(60, k || 10));
  const step = (hi - lo) / k || 1;
  const counts = new Array(k).fill(0);
  v.forEach(x => { counts[Math.min(k - 1, Math.floor((x - lo) / step))]++; });
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  return { lo, hi, step, counts, n: v.length, median: quant(v, 0.5), mean, warn, valueName: get.name('value'), table: { head: [L.binFrom, L.binTo, L.count], rows: counts.map((cnt, i) => [lo + i * step, lo + (i + 1) * step, cnt]) } };
}
export function prepBox(get, o, L) {
  const g = get.has('group') ? get.text('group') : null, raw = get.num('value'), warn = [];
  const bad = raw.filter(x => !Number.isFinite(x)).length; if (bad) warn.push(['dropped', bad, get.name('value')]);
  const m = new Map();
  raw.forEach((x, i) => { if (!Number.isFinite(x)) return; const k = g ? g[i] || L.other : get.name('value'); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  let names = [...m.keys()];
  if (names.length > 12) { const top = new Set([...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 11).map(e => e[0])); const rest = []; names.filter(n => !top.has(n)).forEach(n => rest.push(...m.get(n))); warn.push(['seriesFolded', 11, names.length - 11]); names = names.filter(n => top.has(n)); m.set(L.other, rest); names.push(L.other); }
  const small = names.filter(n => m.get(n).length < 5);
  if (small.length) warn.push(['smallGroups', small.length]);
  const boxes = names.filter(n => m.get(n).length >= 5).map(n => {
    const v = Float64Array.from(m.get(n)).sort();
    const q1 = quant(v, 0.25), q3 = quant(v, 0.75), med = quant(v, 0.5), iqr = q3 - q1;
    const loF = q1 - 1.5 * iqr, hiF = q3 + 1.5 * iqr;
    let wl = q3, wh = q1;
    for (const x of v) { if (x >= loF && x < wl) wl = x; if (x <= hiF && x > wh) wh = x; }
    wl = Math.min(wl, q1); wh = Math.max(wh, q3);
    return { label: n, n: v.length, q1, q3, med, wl, wh, out: Array.from(v).filter(x => x < loF || x > hiF), pts: Array.from(v), mean: v.reduce((s, x) => s + x, 0) / v.length };
  });
  if (!boxes.length) return { error: ['needFive'] };
  if (o.sort === 'median') boxes.sort((a, b) => b.med - a.med);
  return { boxes, warn, valueName: get.name('value'), table: { head: [get.name('group') || '', L.n, 'Q1', L.median, 'Q3', L.wl, L.wh, L.outliers], rows: boxes.map(b => [b.label, b.n, b.q1, b.med, b.q3, b.wl, b.wh, b.out.length]) } };
}

// ——— зв'язки ———
function points(get, L, roles, max) {
  const xs = get.num(roles[0]), ys = get.num(roles[1]), ss = roles[2] ? get.num(roles[2]) : null;
  const lab = get.has('label') ? get.text('label') : null, grp = get.has('group') ? get.text('group') : null, warn = [];
  let pts = [];
  xs.forEach((x, i) => { if (!Number.isFinite(x) || !Number.isFinite(ys[i]) || (ss && !(ss[i] > 0))) return; pts.push({ x, y: ys[i], s: ss ? ss[i] : 0, label: lab ? lab[i] : '', g: grp ? grp[i] || L.other : '' }); });
  const bad = xs.length - pts.length; if (bad) warn.push(['droppedRows', bad]);
  if (pts.length < 3) return { error: ['needThree'] };
  let groups = [];
  if (grp) {
    const cnt = new Map(); pts.forEach(p => cnt.set(p.g, (cnt.get(p.g) || 0) + 1));
    groups = [...cnt.keys()];
    if (groups.length > 3) { const top = new Set([...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])); pts.forEach(p => { if (!top.has(p.g)) p.g = L.other; }); warn.push(['groups3', groups.length - 2]); groups = [...groups.filter(g => top.has(g)), L.other]; }
  }
  if (pts.length > max) { warn.push(['cut', max, pts.length - max]); pts = ss ? pts.sort((a, b) => b.s - a.s).slice(0, max) : pts.slice(0, max); }
  return { pts, groups, warn, names: roles.map(r => get.name(r)), hasLabel: !!lab };
}
export function prepScatter(get, o, L) {
  const r = points(get, L, ['x', 'y'], 5000);
  if (r.error) return r;
  if (o.logx === 'log' && r.pts.some(p => p.x <= 0)) { r.warn.push(['logDropped', r.pts.filter(p => p.x <= 0).length]); r.pts = r.pts.filter(p => p.x > 0); }
  r.log = o.logx === 'log';
  // лінія тренду (найменші квадрати) у тих самих координатах, що й вісь
  const X = r.pts.map(p => (r.log ? Math.log10(p.x) : p.x)), Y = r.pts.map(p => p.y), n = X.length;
  const mx = X.reduce((s, v) => s + v, 0) / n, my = Y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; X.forEach((x, i) => { sxy += (x - mx) * (Y[i] - my); sxx += (x - mx) ** 2; syy += (Y[i] - my) ** 2; });
  r.fit = sxx > 0 ? { b: sxy / sxx, a: my - (sxy / sxx) * mx, r: syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0 } : null;
  r.trend = o.trend === 'on';
  r.table = { head: [...(r.hasLabel ? [get.name('label')] : []), r.names[0], r.names[1], ...(r.groups.length ? [get.name('group')] : [])], rows: r.pts.map(p => [...(r.hasLabel ? [p.label] : []), p.x, p.y, ...(r.groups.length ? [p.g] : [])]) };
  return r;
}
export function prepBubble(get, o, L) {
  const r = points(get, L, ['x', 'y', 'size'], 200);
  if (r.error) return r;
  r.table = { head: [...(r.hasLabel ? [get.name('label')] : []), ...r.names, ...(r.groups.length ? [get.name('group')] : [])], rows: r.pts.map(p => [...(r.hasLabel ? [p.label] : []), p.x, p.y, p.s, ...(r.groups.length ? [p.g] : [])]) };
  return r;
}
export function prepHeatmap(get) {
  const rr = get.text('row'), cc = get.text('col'), vals = get.num('value'), warn = [];
  const bad = badNums(rr, vals); if (bad) warn.push(['dropped', bad, get.name('value')]);
  const rows = [], cols = [];
  rr.forEach((r, i) => { if (!r || !cc[i] || !Number.isFinite(vals[i])) return; if (!rows.includes(r)) rows.push(r); if (!cols.includes(cc[i])) cols.push(cc[i]); });
  if (!rows.length) return { error: ['noRows', get.name('value')] };
  if (rows.length > 30 || cols.length > 40) { warn.push(['heatCut', Math.min(rows.length, 30), Math.min(cols.length, 40)]); rows.length = Math.min(rows.length, 30); cols.length = Math.min(cols.length, 40); }
  const ri = new Map(rows.map((r, k) => [r, k])), ci = new Map(cols.map((c, k) => [c, k]));
  const v = rows.map(() => cols.map(() => null));
  rr.forEach((r, i) => { if (ri.has(r) && ci.has(cc[i]) && Number.isFinite(vals[i])) { const a = ri.get(r), b = ci.get(cc[i]); v[a][b] = (v[a][b] || 0) + vals[i]; } });
  const dup = countDup(rr.map((r, i) => (r && cc[i] ? r + '\u0001' + cc[i] : ''))); if (dup) warn.push(['summed', dup]);
  return { rows, cols, v, warn, valueName: get.name('value'), table: { head: [get.name('row'), ...cols], rows: rows.map((r, a) => [r, ...v[a]]) } };
}

// ——— потоки й мережі ———
export function prepSankey(get) {
  const s = get.text('from'), t = get.text('to'), vals = get.num('value'), warn = [];
  const m = new Map();
  let self = 0;
  s.forEach((a, i) => { const b = t[i]; if (!a || !b || !(vals[i] > 0)) return; if (a === b) { self++; return; } const k = a + '\u0001' + b; m.set(k, (m.get(k) || 0) + vals[i]); });
  if (self) warn.push(['selfLoops', self]);
  const links = [...m.entries()].map(([k, value]) => { const [a, b] = k.split('\u0001'); return { s: a, t: b, value }; });
  if (!links.length) return { error: ['noRows', get.name('value')] };
  const names = [...new Set(links.flatMap(l => [l.s, l.t]))];
  if (names.length > 40) return { error: ['sankeyMany', names.length] };
  // шари: найдовший шлях від джерел; цикл = помилка
  const out = new Map(names.map(n => [n, []])), indeg = new Map(names.map(n => [n, 0]));
  links.forEach(l => { out.get(l.s).push(l.t); indeg.set(l.t, indeg.get(l.t) + 1); });
  const layer = new Map(names.map(n => [n, 0])), q = names.filter(n => indeg.get(n) === 0), deg = new Map(indeg);
  let seen = 0;
  while (q.length) { const n = q.shift(); seen++; out.get(n).forEach(m2 => { layer.set(m2, Math.max(layer.get(m2), layer.get(n) + 1)); deg.set(m2, deg.get(m2) - 1); if (deg.get(m2) === 0) q.push(m2); }); }
  if (seen < names.length) return { error: ['cycle'] };
  // кінцеві вузли в останній шар
  const L = Math.max(...layer.values());
  names.forEach(n => { if (!out.get(n).length && indeg.get(n) > 0) layer.set(n, L); });
  return { names, links, layer, layers: L + 1, warn, table: { head: [get.name('from'), get.name('to'), get.name('value')], rows: links.map(l => [l.s, l.t, l.value]) } };
}
export function prepNetwork(get) {
  const s = get.text('from'), t = get.text('to'), w = get.has('weight') ? get.num('weight') : s.map(() => 1), warn = [];
  const m = new Map();
  s.forEach((a, i) => { const b = t[i]; if (!a || !b || a === b) return; const k = a < b ? a + '\u0001' + b : b + '\u0001' + a; m.set(k, (m.get(k) || 0) + (Number.isFinite(w[i]) ? w[i] : 1)); });
  let edges = [...m.entries()].map(([k, value]) => { const [a, b] = k.split('\u0001'); return { s: a, t: b, value }; });
  if (!edges.length) return { error: ['noEdges'] };
  const deg = new Map(); edges.forEach(e => { deg.set(e.s, (deg.get(e.s) || 0) + 1); deg.set(e.t, (deg.get(e.t) || 0) + 1); });
  let names = [...deg.keys()];
  if (names.length > 150) { const top = new Set([...deg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 150).map(e => e[0])); warn.push(['netCut', 150, names.length - 150]); names = names.filter(n => top.has(n)); edges = edges.filter(e => top.has(e.s) && top.has(e.t)); }
  return { names, edges, deg, warn, weighted: get.has('weight'), table: { head: [get.name('from'), get.name('to'), get.name('weight') || 'n'], rows: edges.map(e => [e.s, e.t, e.value]) } };
}

// ——— таблиця ———
export function prepTable(get, o) {
  const tb = get.table, lab = get.map.label, warn = [];
  const numCols = tb.head.map((h, k) => k).filter(k => k !== lab && tb.rows.filter(r => r[k] !== '' && r[k] != null).length > 0 && tb.rows.every(r => r[k] === '' || r[k] == null || Number.isFinite(toNum(r[k]))));
  if (!numCols.length) return { error: ['tableNoNum'] };
  const cols = numCols.slice(0, 8); if (numCols.length > 8) warn.push(['colsCut', 8, numCols.length - 8]);
  let rows = tb.rows.map((r, i) => ({ i, label: lab >= 0 ? String(r[lab] ?? '') : String(i + 1), v: cols.map(k => toNum(r[k])) }));
  if (rows.length > 300) { warn.push(['cut', 300, rows.length - 300]); rows = rows.slice(0, 300); }
  return { cols: cols.map(k => String(tb.head[k])), labelName: lab >= 0 ? String(tb.head[lab]) : '#', rows, warn, table: { head: [lab >= 0 ? String(tb.head[lab]) : '#', ...cols.map(k => String(tb.head[k]))], rows: rows.map(r => [r.label, ...r.v]) } };
}
