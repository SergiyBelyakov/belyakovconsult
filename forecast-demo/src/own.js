// Ряд з файлу відвідувача: розбір дат, агрегування до періоду, заповнення пропусків, фактори й майбутні рядки,
// автоматичне визначення сезонності. Усе в браузері.
import { parseNum, parseDate } from '../../anomaly-demo/src/fileio.js';
import { seasonalStrength } from './engine/util.js';

const MAX_POINTS = 1500;
const pad = v => String(v).padStart(2, '0');
const dayToIso = day => { const d = new Date(day * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const isoToDay = s => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };

// Початок періоду, до якого належить день; тижні відраховуються від дня тижня першої дати файлу
function periodKey(day, freq, anchor) {
  const d = new Date(day * 864e5), y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (freq === 'D') return day;
  if (freq === 'W') return day - ((((day - anchor) % 7) + 7) % 7);
  if (freq === 'M') return Math.floor(Date.UTC(y, m, 1) / 864e5);
  if (freq === 'Q') return Math.floor(Date.UTC(y, m - (m % 3), 1) / 864e5);
  return Math.floor(Date.UTC(y, 0, 1) / 864e5);
}
function nextKey(key, freq) {
  const d = new Date(key * 864e5);
  if (freq === 'D') return key + 1;
  if (freq === 'W') return key + 7;
  if (freq === 'M') return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 864e5);
  if (freq === 'Q') return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1) / 864e5);
  return Math.floor(Date.UTC(d.getUTCFullYear() + 1, 0, 1) / 864e5);
}
export function guessFreq(days) {
  const u = [...new Set(days)].sort((a, b) => a - b);
  if (u.length < 3) return 'D';
  const gaps = []; for (let i = 1; i < u.length; i++) gaps.push(u[i] - u[i - 1]);
  gaps.sort((a, b) => a - b);
  const g = gaps[gaps.length >> 1];
  return g <= 1.5 ? 'D' : g <= 8 ? 'W' : g <= 40 ? 'M' : g <= 100 ? 'Q' : 'Y';
}
const SEASON_OF = { D: 7, W: 52, M: 12, Q: 4, Y: 0 };
const HOLD = { D: 28, W: 13, M: 12, Q: 4, Y: 3 };

// Колонки за замовчуванням: перша колонка з датами і перша числова, що не схожа на ідентифікатор
export function defaultMap(P) {
  const nums = P.cols.filter(c => c.type === 'num' && !c.idLike);
  return { date: P.def.date, value: nums.length ? nums[0].k : -1, agg: 'sum', freq: 'auto', season: 'auto', gaps: 'auto', drivers: [] };
}

export function buildSeries(P, map) {
  if (map.date < 0) return { err: 'date' };
  if (map.value < 0) return { err: 'num' };
  map = { ...map, drivers: map.drivers.filter(k => k !== map.value && k !== map.date) };
  const rows = [];
  for (const r of P.body) {
    const pd = parseDate(r[map.date]);
    if (!pd) continue;
    const v = parseNum(r[map.value]);
    rows.push({ day: pd.day, v, x: map.drivers.map(k => parseNum(r[k])) });
  }
  if (rows.length < 3) return { err: 'date' };
  const withVal = rows.filter(r => Number.isFinite(r.v));
  if (!withVal.length) return { err: 'num' };
  const freq = map.freq === 'auto' ? guessFreq(withVal.map(r => r.day)) : map.freq;
  const anchor = withVal.reduce((a, r) => Math.min(a, r.day), Infinity);
  // агрегування за періодами
  const groups = new Map();
  for (const r of rows) {
    const k = periodKey(r.day, freq, anchor);
    if (!groups.has(k)) groups.set(k, { vals: [], xs: [], last: null });
    const g = groups.get(k);
    if (Number.isFinite(r.v)) { g.vals.push(r.v); g.last = r.v; }
    if (map.drivers.length) g.xs.push(r.x);
  }
  const keys = [...groups.keys()].sort((a, b) => a - b);
  const withV = keys.filter(k => groups.get(k).vals.length), firstVal = withV[0], lastVal = withV[withV.length - 1];
  const aggOf = g => (!g.vals.length ? NaN : map.agg === 'mean' ? g.vals.reduce((a, b) => a + b, 0) / g.vals.length : map.agg === 'last' ? g.last : g.vals.reduce((a, b) => a + b, 0));
  const drvOf = g => map.drivers.map((_, j) => { const v = g.xs.map(x => x[j]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; });
  // суцільна шкала періодів з пропусками
  const seq = [];
  let total = 0;
  for (let k = firstVal; k <= lastVal; k = nextKey(k, freq)) { total++; seq.push(k); if (seq.length > 4 * MAX_POINTS) seq.splice(0, seq.length - MAX_POINTS); }
  let y = seq.map(k => (groups.has(k) ? aggOf(groups.get(k)) : NaN));
  let X = map.drivers.length ? seq.map(k => (groups.has(k) ? drvOf(groups.get(k)) : map.drivers.map(() => NaN))) : null;
  const gaps = y.filter(v => !Number.isFinite(v)).length;
  // «Авто»: для сум, де нулі трапляються й у самих даних, пропуск означає нуль; інакше пропуск це брак даних
  const seen = y.filter(Number.isFinite), zeroShare = seen.filter(v => v === 0).length / Math.max(1, seen.length);
  const gapsMode = map.gaps === 'auto' ? (map.agg === 'sum' && zeroShare >= 0.05 ? 'zero' : 'interp') : map.gaps;
  if (gaps) {
    if (gapsMode === 'zero') y = y.map(v => (Number.isFinite(v) ? v : 0));
    else {
      // лінійна інтерполяція між сусідніми відомими значеннями
      y = y.slice();
      for (let i = 0; i < y.length; i++) if (!Number.isFinite(y[i])) {
        let a = i - 1; while (a >= 0 && !Number.isFinite(y[a])) a--;
        let b = i + 1; while (b < y.length && !Number.isFinite(y[b])) b++;
        y[i] = a >= 0 && b < y.length ? y[a] + ((y[b] - y[a]) * (i - a)) / (b - a) : a >= 0 ? y[a] : y[b];
      }
    }
  }
  let dates = seq.map(dayToIso);
  if (y.length > MAX_POINTS) { const c = y.length - MAX_POINTS; y = y.slice(c); dates = dates.slice(c); if (X) X = X.slice(c); }
  const cut = total - y.length;
  if (y.length < 12) return { err: 'short', freq };
  // фактори: заповнюємо пропуски попереднім значенням
  let drivers = null, future = 0;
  if (X) {
    X = X.map((row, t) => row.map((v, j) => { if (Number.isFinite(v)) return v; for (let s = t - 1; s >= 0; s--) if (Number.isFinite(X[s][j])) return X[s][j]; return 0; }));
    // майбутні рядки: лише суцільно після останньої дати з фактом і з усіма заповненими факторами
    const fut = [];
    for (let k = nextKey(lastVal, freq); groups.has(k) && fut.length < 400; k = nextKey(k, freq)) {
      const x = drvOf(groups.get(k));
      if (!x.every(Number.isFinite)) break;
      fut.push({ k, x });
    }
    future = fut.length;
    const seen = new Set();
    const names = map.drivers.map(k => { let nm = P.cols[k].name; while (seen.has(nm)) nm += '\u2032'; seen.add(nm); return nm; });
    drivers = { names, X, Xf: fut.map(f => f.x), fdates: fut.map(f => dayToIso(f.k)) };
  }
  const n = y.length, cand = SEASON_OF[freq] || 0;
  let m = 0;
  if (map.season === 'auto') { if (cand > 1 && n >= 2 * cand + 2 && seasonalStrength(y, cand) > 0.3) m = cand; }
  else m = Number(map.season) || 0;
  if (m > 1 && n < 2 * m + 2) m = 0;
  const H = Math.max(2, Math.min(HOLD[freq] || 6, Math.floor(n / 4)));
  const mult = m > 1 && y.every(v => v > 0);
  return {
    S: { id: 'own', y, dates, freq, m, H, h: H, mult, flow: map.agg === 'sum', dec: y.every(v => Number.isInteger(v)) ? 0 : 2, drivers, seed: 11 },
    info: { n, from: dates[0], to: dates[n - 1], gaps, gapsMode, cut, future, freq, m },
  };
}

// Приклад як «файл»: рядки з датою, значенням і факторами (для кнопки «Спробувати на прикладі»)
export function sampleRows(S, T) {
  const dn = S.drivers ? S.drivers.names : [];
  const head = [T.xl.head.date, T.datasets[S.id].name, ...dn.map(k => T.drivers[k] || k)];
  const rows = S.y.map((v, t) => [S.dates[t], String(v), ...(S.drivers ? S.drivers.X[t].map(String) : [])]);
  if (S.drivers) S.drivers.Xf.forEach((x, k) => rows.push([S.drivers.fdates[k], '', ...x.map(String)]));
  return [head, ...rows];
}

export { isoToDay };
