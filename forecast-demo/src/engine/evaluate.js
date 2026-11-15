// Запуск моделей, ансамбль, перевірка на відкладених даних (останні H точок) і автоматичний вибір.
import { BY_ID, MODELS, applies, ensembleMembers, defaultParams } from './models.js';
import { mean, rms, sum } from './util.js';
import { futureDates } from '../format.js';

// Опис ряду для правил застосовності
export function seriesInfo(S) {
  const y = S.y, n = y.length;
  return {
    n, m: S.m || 0,
    drivers: !!(S.drivers && S.drivers.names.length),
    futureDrivers: !!(S.drivers && S.drivers.Xf && S.drivers.Xf.length),
    zeros: y.filter(v => v === 0).length / n,
    nonneg: y.every(v => v >= 0),
  };
}

// Сезонні періоди для моделей з кількома циклами: з опису набору або за частотою й сезоном ряду
export function periodsOf(S) {
  if (S.periods) return S.periods;
  const m = S.m || 0;
  if (m <= 1) return [];
  if (S.freq === 'D' && m === 7) return S.y.length >= 2 * 365.25 + 2 ? [7, 365.25] : [7];
  if (S.freq === 'W' && m === 52) return [365.25 / 7];
  return [m];
}

function ctxFor(S, h, p, part) {
  const d = S.drivers, n = S.y.length;
  let X = null, Xf = null, fdates;
  if (d) {
    if (part === 'train') { X = d.X.slice(0, n); Xf = d.Xtest; }
    else { X = d.X; Xf = d.Xf; }
  }
  if (part === 'train' && S.testDates) fdates = S.testDates.slice(0, h);
  else if (d && d.fdates && d.fdates.length >= h) fdates = d.fdates.slice(0, h);
  else fdates = futureDates(S.dates[n - 1], h, S.freq);
  return {
    m: S.m || 0, h, p: p || {}, X, Xf, names: d ? d.names : [], seed: S.seed || 7, flow: !!S.flow, part,
    dates: S.dates, fdates, freq: S.freq, periods: periodsOf(S), events: S.events || null,
  };
}

// Один прогін моделі на ряді S з горизонтом h
export function runModel(id, S, p = {}, h = 12, part = 'full') {
  if (id === 'ensemble') {
    const info = seriesInfo(S), ids = ensembleMembers(info).filter(mid => applies(BY_ID[mid], info) === true);
    const parts = ids.map(mid => ({ id: mid, r: runModel(mid, S, defaultParams(mid, S), h, part) }));
    const n = S.y.length;
    const fitted = Array.from({ length: n }, (_, t) => { const v = parts.map(x => x.r.fitted[t]); return v.every(Number.isFinite) ? mean(v) : NaN; });
    const avg = (k, key) => { const v = parts.map(x => x.r.fc[k][key]).filter(Number.isFinite); return v.length === parts.length ? mean(v) : NaN; };
    const fc = Array.from({ length: h }, (_, k) => ({ mean: avg(k, 'mean'), sd: avg(k, 'sd'), lo80: avg(k, 'lo80'), hi80: avg(k, 'hi80'), lo95: avg(k, 'lo95'), hi95: avg(k, 'hi95') }));
    return { fitted, fc, used: { members: ids }, explain: { kind: 'members', members: parts.map(x => ({ id: x.id, fc: x.r.fc.map(f => f.mean) })) } };
  }
  const model = BY_ID[id];
  const r = model.fit(S.y, ctxFor(S, h, p, part));
  // для невід'ємних рядів (продажі, звернення) прогноз і межі коридору не опускаються нижче нуля
  if (S.y.every(v => v >= 0)) {
    r.fc = r.fc.map(f => ({ ...f, mean: Math.max(0, f.mean), lo80: Number.isFinite(f.lo80) ? Math.max(0, f.lo80) : f.lo80, lo95: Number.isFinite(f.lo95) ? Math.max(0, f.lo95) : f.lo95 }));
    r.fitted = r.fitted.map(v => (Number.isFinite(v) ? Math.max(0, v) : v));
  }
  return r;
}

// Масштаб для MASE: середня похибка наївного (або сезонного наївного) прогнозу на навчальній частині
export function maseScale(y, m) {
  const lag = m > 1 && y.length > m + 2 ? m : 1, e = [];
  for (let t = lag; t < y.length; t++) e.push(Math.abs(y[t] - y[t - lag]));
  return mean(e) || 1;
}

export function metrics(actual, fc, scale) {
  const err = actual.map((a, i) => fc[i].mean - a);
  const mae = mean(err.map(Math.abs)), r = rms(err);
  const pct = actual.map((a, i) => (a !== 0 ? Math.abs(err[i] / a) : NaN)).filter(Number.isFinite);
  const in80 = actual.filter((a, i) => Number.isFinite(fc[i].lo80) && a >= fc[i].lo80 && a <= fc[i].hi80).length;
  const in95 = actual.filter((a, i) => Number.isFinite(fc[i].lo95) && a >= fc[i].lo95 && a <= fc[i].hi95).length;
  const hasBand = fc.some(f => Number.isFinite(f.lo80));
  return {
    mae, rmse: r, mape: pct.length >= actual.length * 0.8 ? mean(pct) : NaN, bias: mean(err), mase: mae / scale,
    cover80: hasBand ? in80 / actual.length : NaN, cover95: hasBand ? in95 / actual.length : NaN,
    totalErr: sum(actual) !== 0 ? (sum(fc.map(f => f.mean)) - sum(actual)) / Math.abs(sum(actual)) : NaN,
  };
}

// Перевірка на відкладених даних: модель навчається на перших cut точках і прогнозує наступні H
// (за замовчуванням cut = n − H, тобто останні H точок)
export function holdout(id, S, p = {}, H = 12, cut = S.y.length - H) {
  const end = Math.min(S.y.length, cut + H);
  const T = {
    ...S, y: S.y.slice(0, cut), dates: S.dates.slice(0, cut), testDates: S.dates.slice(cut, end),
    drivers: S.drivers ? { ...S.drivers, X: S.drivers.X.slice(0, cut), Xtest: S.drivers.X.slice(cut, end) } : null,
  };
  const r = runModel(id, T, p, end - cut, 'train');
  const actual = S.y.slice(cut, end);
  return { r, actual, m: metrics(actual, r.fc, maseScale(T.y, S.m)) };
}

// Ковзне походження (rolling origin): K перевірок, кожна з горизонтом H; точки старту зсуваються назад на step.
// Остання перевірка збігається з відкладеними даними holdout.
export function originsOf(S, H, K = 4, step = Math.ceil(H / 2)) {
  const n = S.y.length, out = [];
  for (let i = K - 1; i >= 0; i--) { const cut = n - H - i * step; if (cut >= Math.max(12, 2 * (S.m || 1) + 2)) out.push(cut); }
  return out;
}
export function rolling(id, S, p, H, cuts) {
  const folds = cuts.map(cut => { const ev = holdout(id, S, p, H, cut); return { cut, m: ev.m, fc: ev.r.fc }; });
  const avg = k => { const v = folds.map(f => f.m[k]).filter(Number.isFinite); return v.length === folds.length ? mean(v) : NaN; };
  return { folds, mase: avg('mase'), mape: avg('mape'), mae: avg('mae'), bias: avg('bias'), cover80: avg('cover80') };
}

// Таблиця всіх застосовних моделей на ряді, впорядкована за MASE на відкладених даних
export function leaderboard(S, H, ids = MODELS.map(x => x.id)) {
  const info = seriesInfo(S), infoTrain = { ...info, n: info.n - H, futureDrivers: info.drivers };
  const rows = [];
  for (const id of ids) {
    const ok = id === 'ensemble' ? true : applies(BY_ID[id], infoTrain);
    if (ok !== true) { rows.push({ id, skip: ok }); continue; }
    try {
      const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
      const ev = holdout(id, S, defaultParams(id, S), H);
      rows.push({ id, ...ev.m, fc: ev.r.fc, ms: (typeof performance !== 'undefined' ? performance : Date).now() - t0 });
    } catch (e) { rows.push({ id, skip: 'error', err: String(e) }); }
  }
  const ok = rows.filter(r => !r.skip && Number.isFinite(r.mase)).sort((a, b) => a.mase - b.mase);
  return { ok, skipped: rows.filter(r => r.skip || !Number.isFinite(r.mase)) };
}
