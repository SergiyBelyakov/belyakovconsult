// Підготовка даних для управлінських графіків: прогноз з коридором, контрольна карта, когорти, дерево декомпозиції,
// діаграма Мерімекко. Усі розрахунки тут, у графіках лише геометрія.
import { toNum } from './prep.js';
import { dayOf, ymd } from './format.js';
import { chooseModel, forecast, Z80, Z95 } from './forecast.js';
import { sortKeys } from './prep2.js';

// ——— ряд за датами: одна точка на дату, крок ряду і сезон ———
function series(get, agg = 'sum') {
  const d = get.date('date'), v = get.num('value'), warn = [];
  const badD = d.filter((x, i) => !Number.isFinite(x) && (get.text('date')[i] || '') !== '').length;
  if (badD) warn.push(['badDates', badD, get.name('date')]);
  const badV = v.filter((x, i) => Number.isFinite(d[i]) && !Number.isFinite(x)).length;
  if (badV) warn.push(['dropped', badV, get.name('value')]);
  const m = new Map();
  d.forEach((x, i) => { if (!Number.isFinite(x) || !Number.isFinite(v[i])) return; const e = m.get(x) || [0, 0]; e[0] += v[i]; e[1]++; m.set(x, e); });
  if ([...m.values()].some(e => e[1] > 1)) warn.push([agg === 'mean' ? 'averaged' : 'summedDates']);
  const days = [...m.keys()].sort((a, b) => a - b);
  const vals = days.map(x => (agg === 'mean' ? m.get(x)[0] / m.get(x)[1] : m.get(x)[0]));
  return { days, vals, warn };
}
const gapsOf = days => days.slice(1).map((d, k) => d - days[k]).sort((a, b) => a - b);
export function stepOf(days) {
  const g = gapsOf(days), med = g[g.length >> 1] || 1;
  return med <= 1 ? 'day' : med <= 8 ? 'week' : med <= 31 ? 'month' : med <= 92 ? 'quarter' : 'year';
}
const SEASON = { day: 7, week: 52, month: 12, quarter: 4, year: 0 };
// наступна дата ряду: місяці й квартали додаються календарно
function nextDay(day, step, k) {
  if (step === 'day') return day + k;
  if (step === 'week') return day + 7 * k;
  if (step === 'year') { const [y, m, d] = ymd(day); return dayOf(y + k, m, d); }
  const [y, m, d] = ymd(day), add = step === 'month' ? k : 3 * k, mm = m - 1 + add;
  return dayOf(y + Math.floor(mm / 12), (mm % 12) + 1, Math.min(d, 28));
}
function irregular(days, step) {
  if (step === 'month' || step === 'quarter') { const idx = days.map(x => { const [y, m] = ymd(x); return y * 12 + m; }), k = step === 'month' ? 1 : 3; return idx.slice(1).some((v, i) => v - idx[i] !== k); }
  const k = step === 'day' ? 1 : step === 'week' ? 7 : 365;
  return days.slice(1).some((v, i) => Math.abs(v - days[i] - k) > (step === 'year' ? 1 : 0));
}

// ——— прогноз з коридором невизначеності ———
export function prepFan(get, o) {
  const s = series(get), warn = s.warn;
  const n = s.days.length;
  if (n < 10) return { error: ['fanShort'] };
  const step = stepOf(s.days), m = SEASON[step];
  if (irregular(s.days, step)) warn.push(['gaps']);
  const want = o.model || 'auto';
  const pick = chooseModel(s.vals, m, want);
  if (pick.noSeason) warn.push(['noSeason', 2 * m + 4]);
  const h = Math.max(1, +(o.horizon || 12));
  const fc = forecast(pick.model, h);
  const fdays = Array.from({ length: h }, (_, k) => nextDay(s.days[n - 1], step, k + 1));
  // перевірка на останніх точках: модель того ж виду, навчена без них
  const ht = Math.min(h, 12, Math.floor(n / 4));
  let check = null;
  if (ht >= 3) {
    const train = s.vals.slice(0, n - ht), back = chooseModel(train, pick.model.m ? m : 0, pick.model.m ? 'season' : 'trend').model;
    const bf = forecast(back, ht), act = s.vals.slice(n - ht);
    const pos = act.every(v => v > 0);
    const err = act.map((v, k) => Math.abs(v - bf[k].mean)), inside = act.filter((v, k) => Math.abs(v - bf[k].mean) <= Z80 * bf[k].sd).length;
    check = { k: ht, mape: pos ? err.reduce((a, e, k) => a + e / act[k], 0) / ht : null, mae: err.reduce((a, e) => a + e, 0) / ht, inside };
  }
  const rows = fc.map((f, k) => ({ day: fdays[k], mean: f.mean, lo80: f.mean - Z80 * f.sd, hi80: f.mean + Z80 * f.sd, lo95: f.mean - Z95 * f.sd, hi95: f.mean + Z95 * f.sd }));
  return {
    days: s.days, vals: s.vals, fitted: pick.model.fitted, fc: rows, step, season: pick.model.m, phi: pick.model.p.phi, check, warn, valueName: get.name('value'),
    table: { head: [get.name('date'), get.name('value'), 'P10', 'P50', 'P90', 'P2.5', 'P97.5'], rows: [...s.days.map((d, k) => [d, s.vals[k], null, null, null, null, null]), ...rows.map(r => [r.day, null, r.lo80, r.mean, r.hi80, r.lo95, r.hi95])] }, dateCols: [0],
  };
}

// ——— контрольна карта (XmR) з правилами Western Electric ———
export function prepSpc(get, o) {
  const s = series(get, 'mean'), warn = s.warn, x = s.vals, n = x.length;
  if (n < 12) return { error: ['spcShort'] };
  const nb = o.base === 'all' ? n : Math.min(n, 20);
  if (o.base !== 'all' && n < 20) warn.push(['spcBase', n]);
  const base = x.slice(0, nb), cl = base.reduce((a, v) => a + v, 0) / nb;
  const mr = x.slice(1).map((v, i) => Math.abs(v - x[i])), mrBar = mr.slice(0, nb - 1).reduce((a, v) => a + v, 0) / Math.max(1, nb - 1);
  const sd = mrBar / 1.128;
  const nonNeg = x.every(v => v >= 0);
  let lcl = cl - 3 * sd; const lclCut = nonNeg && lcl < 0; if (lclCut) lcl = 0;
  const ucl = cl + 3 * sd, side = v => (v > cl ? 1 : v < cl ? -1 : 0), z = v => (sd > 0 ? (v - cl) / sd : 0);
  // основні правила: точка за межею і вісім поспіль з одного боку; усі правила Western Electric і тренд за бажанням
  const allowed = new Set(o.rules === 'all' ? [1, 2, 3, 4, 5] : [1, 4]);
  const sig = x.map(() => ({ s: new Set(), add(r) { if (allowed.has(r)) this.s.add(r); } }));
  x.forEach((v, i) => { if (v > ucl || (v < lcl)) sig[i].add(1); });
  for (let i = 2; i < n; i++) for (const sgn of [1, -1]) { const w = [i - 2, i - 1, i].filter(k => z(x[k]) * sgn > 2); if (w.length >= 2 && z(x[i]) * sgn > 2) w.forEach(k => sig[k].add(2)); }
  for (let i = 4; i < n; i++) for (const sgn of [1, -1]) { const w = [i - 4, i - 3, i - 2, i - 1, i].filter(k => z(x[k]) * sgn > 1); if (w.length >= 4 && z(x[i]) * sgn > 1) w.forEach(k => sig[k].add(3)); }
  for (let i = 7; i < n; i++) { const s0 = side(x[i]); if (s0 && [1, 2, 3, 4, 5, 6, 7].every(k => side(x[i - k]) === s0)) for (let k = 0; k < 8; k++) sig[i - k].add(4); }
  for (let i = 5; i < n; i++) { let up = true, dn = true; for (let k = i - 4; k <= i; k++) { if (!(x[k] > x[k - 1])) up = false; if (!(x[k] < x[k - 1])) dn = false; } if (up || dn) for (let k = i - 5; k <= i; k++) sig[k].add(5); }
  const S = sig.map(o2 => o2.s);
  const rules = [1, 2, 3, 4, 5].map(r => ({ r, n: S.filter(s2 => s2.has(r)).length })).filter(r => r.n);
  // серії точок за правилами 2-5: на графіку дужкою над серією, а не номером біля кожної точки
  const runs = [];
  [2, 3, 4, 5].forEach(r => { let a = -1; for (let i = 0; i <= n; i++) { const on = i < n && S[i].has(r); if (on && a < 0) a = i; if (!on && a >= 0) { runs.push({ r, a, b: i - 1 }); a = -1; } } });
  return {
    days: s.days, x, mr, cl, ucl, lcl, sd, mrBar, mrUcl: 3.267 * mrBar, nb, lclCut, sig: S.map(s2 => [...s2].sort()), rules, runs, warn, valueName: get.name('value'), step: stepOf(s.days),
    table: { head: [get.name('date'), get.name('value'), 'mR', 'CL', 'UCL', 'LCL', '#'], rows: s.days.map((d, i) => [d, x[i], i ? mr[i - 1] : null, cl, ucl, lcl, S[i].size ? [...S[i]].sort().join(', ') : '']) }, dateCols: [0],
  };
}

// ——— когортна матриця з журналу подій ———
const monthIdx = day => { const [y, m] = ymd(day); return y * 12 + (m - 1); };
const weekIdx = day => Math.floor((day + 3) / 7);   // тиждень з понеділка
export function prepCohort(get, o, L) {
  const ids = get.text('id'), d = get.date('date'), warn = [];
  const bad = d.filter((x, i) => ids[i] && !Number.isFinite(x)).length; if (bad) warn.push(['badDates', bad, get.name('date')]);
  const per = o.period === 'week' ? 'week' : 'month', idx = per === 'week' ? weekIdx : monthIdx;
  const first = new Map(), acts = new Map();
  ids.forEach((id, i) => { if (!id || !Number.isFinite(d[i])) return; const p = idx(d[i]); if (!first.has(id) || p < first.get(id)) first.set(id, p); if (!acts.has(id)) acts.set(id, new Set()); acts.get(id).add(p); });
  if (first.size < 10) return { error: ['cohortFew'] };
  const last = Math.max(...[...acts.values()].flatMap(s => [...s]));
  const maxC = per === 'week' ? 16 : 12;
  const c0 = Math.max(Math.min(...first.values()), last - maxC + 1);
  const cut = [...first.values()].filter(p => p < c0).length; if (cut) warn.push(['cohortCut', maxC, cut]);
  const C = last - c0 + 1;
  if (C < 2) return { error: ['cohortPeriods'] };
  const size = new Array(C).fill(0), mat = Array.from({ length: C }, (_, c) => new Array(C - c).fill(0));
  first.forEach((p, id) => {
    if (p < c0) return;
    const c = p - c0; size[c]++;
    acts.get(id).forEach(q => { const k = q - p; if (k >= 0 && k < C - c) mat[c][k]++; });
  });
  // середнє утримання за кожен період: зважене на розмір когорт, у яких цей період уже настав
  const avg = Array.from({ length: C }, (_, k) => { let a = 0, b = 0; for (let c = 0; c + k < C; c++) { a += mat[c][k]; b += size[c]; } return b ? a / b : null; });
  const label = c => (per === 'week' ? (c0 + c) * 7 - 3 : dayOf(Math.floor((c0 + c) / 12), ((c0 + c) % 12) + 1, 1));
  const cohorts = Array.from({ length: C }, (_, c) => label(c));
  return {
    cohorts, size, mat, avg, per, warn, idName: get.name('id'),
    table: { head: [L.cohort, L.cohortSize, ...Array.from({ length: C }, (_, k) => '+' + k)], rows: cohorts.map((c, i) => [c, size[i], ...Array.from({ length: C }, (_, k) => (k < C - i && size[i] ? mat[i][k] / size[i] : null))]) }, dateCols: [0], pctCols: Array.from({ length: C }, (_, k) => k + 2),
  };
}

// ——— дерево декомпозиції: показник і всі текстові колонки як виміри ———
export function prepDecomp(get, o, L) {
  const tb = get.table, vk = get.map.value ?? -1, warn = [];
  const count = o.agg === 'count';
  if (vk < 0 && !count) return { error: ['decompValue'] };
  const dimCols = tb.head.map((h, k) => k).filter(k => k !== vk && tb.rows.some(r => r[k] !== '' && r[k] != null) && !tb.rows.every(r => r[k] === '' || r[k] == null || Number.isFinite(toNum(r[k]))));
  if (!dimCols.length) return { error: ['decompDims'] };
  const dims = dimCols.slice(0, 6); if (dimCols.length > 6) warn.push(['dimsCut', 6, dimCols.length - 6]);
  const rows = [];
  let bad = 0;
  tb.rows.forEach(r => { const v = count ? 1 : toNum(r[vk]); if (!Number.isFinite(v)) { bad++; return; } rows.push({ k: dims.map(c => String(r[c] ?? '').trim() || L.na), v }); });
  if (bad) warn.push(['dropped', bad, vk >= 0 ? String(tb.head[vk]) : '']);
  if (!rows.length) return { error: ['noRows', vk >= 0 ? String(tb.head[vk]) : ''] };
  if (rows.some(r => r.v < 0)) warn.push(['decompNeg']);
  const total = rows.reduce((s, r) => s + r.v, 0);
  // таблиця: усі комбінації вимірів від більшої до меншої
  const comb = new Map(); rows.forEach(r => { const key = r.k.join('\u0001'); comb.set(key, (comb.get(key) || 0) + r.v); });
  const flat = [...comb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 400);
  const valueName = count ? L.count : String(tb.head[vk]);
  return {
    dims: dims.map(c => String(tb.head[c])), rows, total, count, warn, valueName,
    table: { head: [...dims.map(c => String(tb.head[c])), valueName], rows: flat.map(([k, v]) => [...k.split('\u0001'), v]) },
  };
}
// групування рядків за виміром: найбільші 7 окремо, решта «Інші»
export function splitBy(rows, j, L, max = 8) {
  const m = new Map(); rows.forEach(r => m.set(r.k[j], (m.get(r.k[j]) || 0) + r.v));
  let items = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, v]) => ({ key, v }));
  if (items.length > max) { const rest = items.slice(max - 1); items = items.slice(0, max - 1); items.push({ key: null, label: L.other, v: rest.reduce((s, x) => s + x.v, 0), n: rest.length, other: true }); }
  return items;
}

// ——— Мерімекко: ширина стовпчика = сума категорії, висота сегмента = частка серії ———
export function prepMekko(get, o, L) {
  const cats = get.text('cat'), ser = get.text('series'), vals = get.num('value'), warn = [];
  const bad = cats.reduce((s, c, i) => s + (c && ser[i] && !Number.isFinite(vals[i]) ? 1 : 0), 0); if (bad) warn.push(['dropped', bad, get.name('value')]);
  const neg = vals.filter(v => v < 0).length; if (neg) warn.push(['negDropped', neg]);
  const ok = i => cats[i] && ser[i] && Number.isFinite(vals[i]) && vals[i] >= 0;
  const cTot = new Map(), sTot = new Map();
  cats.forEach((c, i) => { if (!ok(i)) return; cTot.set(c, (cTot.get(c) || 0) + vals[i]); sTot.set(ser[i], (sTot.get(ser[i]) || 0) + vals[i]); });
  if (!cTot.size) return { error: ['noRows', get.name('value')] };
  let cNames = [...cTot.keys()], sNames = sortKeys([...sTot.keys()]);
  if (o.sort !== 'file') cNames.sort((a, b) => cTot.get(b) - cTot.get(a));
  if (cNames.length > 12) { const keep = new Set([...cNames].sort((a, b) => cTot.get(b) - cTot.get(a)).slice(0, 11)); warn.push(['folded', 11, cNames.length - 11]); cNames = [...cNames.filter(c => keep.has(c)), L.other]; }
  if (sNames.length > 6) { const keep = new Set([...sNames].sort((a, b) => sTot.get(b) - sTot.get(a)).slice(0, 5)); warn.push(['seriesFolded', 5, sNames.length - 5]); sNames = [...sNames.filter(s => keep.has(s)), L.other]; }
  const ci = c => (cNames.includes(c) ? cNames.indexOf(c) : cNames.length - 1), si = s => (sNames.includes(s) ? sNames.indexOf(s) : sNames.length - 1);
  const v = cNames.map(() => sNames.map(() => 0));
  cats.forEach((c, i) => { if (ok(i)) v[ci(c)][si(ser[i])] += vals[i]; });
  const tot = v.map(r => r.reduce((a, b) => a + b, 0)), total = tot.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return { error: ['noRows', get.name('value')] };
  return {
    cats: cNames, series: sNames, v, tot, total, warn, valueName: get.name('value'), catName: get.name('cat'), otherS: sNames.length === 6 && sNames[5] === L.other,
    table: { head: [get.name('cat'), ...sNames, L.total, L.share], rows: cNames.map((c, a) => [c, ...v[a], tot[a], tot[a] / total]) }, pctCols: [sNames.length + 2],
  };
}
