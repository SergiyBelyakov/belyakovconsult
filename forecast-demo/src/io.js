// Завантаження: дані прикладів (CSV, Excel), прогноз (CSV, Excel) і книги Excel із формулами моделей.
import { xlsxBlob, csvBlob, saveBlob } from '../../chart-gallery/src/xlsx.js';
import { futureDates } from './format.js';

const round = (v, d = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : '');
// У файлі .xlsx формули завжди записуються англійською з комою, навіть для української версії Excel
const cm = s => s.replace(/;/g, ',');

function dataRows(S, T) {
  const dn = S.drivers ? S.drivers.names : [];
  const head = [T.xl.head.date, T.xl.head.value, ...dn.map(k => T.drivers[k] || k)];
  const rows = S.y.map((v, t) => [S.dates[t], v, ...(S.drivers ? S.drivers.X[t] : [])]);
  if (S.drivers && S.drivers.Xf) S.drivers.Xf.forEach((x, k) => rows.push([S.drivers.fdates[k], '', ...x]));
  return { head, rows };
}

export function downloadSample(S, T, kind) {
  const { head, rows } = dataRows(S, T), D = T.datasets[S.id];
  const base = `forecast_${S.id}`;
  if (kind === 'csv') return saveBlob(base + '.csv', csvBlob(head, rows));
  const about = [[T.xl.rows[0], D.name], [T.xl.rows[1], D.unit], [T.xl.rows[2], `${S.dates[0]} … ${S.dates[S.dates.length - 1]}`], [T.xl.rows[3], D.desc], [T.xl.rows[4], D.look], ['', T.xl.note]];
  saveBlob(base + '.xlsx', xlsxBlob([{ name: T.xl.data, head, rows }, { name: T.xl.about, head: ['', ''], rows: about, widths: [22, 90], wrap: true }]));
}

export function forecastTable(S, r, T, fdates) {
  const head = [T.fcCols.date, T.fcCols.mean, T.fcCols.lo80, T.fcCols.hi80, T.fcCols.lo95, T.fcCols.hi95];
  const rows = r.fc.map((f, k) => [fdates[k], round(f.mean), round(f.lo80), round(f.hi80), round(f.lo95), round(f.hi95)]);
  return { head, rows };
}
export function downloadForecastCsv(name, S, r, T, fdates) {
  const { head, rows } = forecastTable(S, r, T, fdates);
  saveBlob(name + '.csv', csvBlob(head, rows));
}
export function downloadForecastXlsx(name, sheets) { saveBlob(name + '.xlsx', xlsxBlob(sheets)); }

// Моделі, які можна порахувати формулами Excel
export const FORMULA_MODELS = ['naive', 'snaive', 'drift', 'ma', 'ses', 'holt', 'linear', 'hw'];

export function downloadFormulas(id, S, r, T, h) {
  const n = S.y.length, last = n + 1, fd = futureDates(S.dates[n - 1], h, S.freq), H = T.xl.head;
  const R = (k) => k + 2;   // рядок Excel для індексу t
  const P = r.used || {};
  const rows = [], head = [H.date, H.value, H.fit, H.err];
  let extra = [], params = [];
  const errF = rr => ({ f: `IF(OR(B${rr}="",C${rr}=""),"",B${rr}-C${rr})`, s: 'num' });
  const fit = {}, fut = {};

  if (id === 'naive') {
    for (let t = 1; t < n; t++) fit[t] = `B${R(t - 1)}`;
    for (let k = 0; k < h; k++) fut[k] = `$B$${last}`;
  } else if (id === 'snaive') {
    const m = S.m;
    for (let t = m; t < n; t++) fit[t] = `B${R(t - m)}`;
    for (let k = 0; k < h; k++) { const rr = R(n + k); fut[k] = cm(`IF(B${rr - m}="";C${rr - m};B${rr - m})`); }
  } else if (id === 'drift') {
    params = [[T.ex.slope, { f: `(B${last}-B2)/(${n}-1)`, s: 'num' }]];
    for (let t = 1; t < n; t++) fit[t] = `B${R(t - 1)}+$H$2`;
    for (let k = 0; k < h; k++) fut[k] = `$B$${last}+$H$2*(ROW()-${last})`;
  } else if (id === 'ma') {
    const w = P.w || 4;
    params = [[T.params.w[0], { v: w, s: 'parami' }]];
    for (let t = w; t < n; t++) fit[t] = cm(`AVERAGE(OFFSET(B${R(t - 1)};1-$H$2;0;$H$2;1))`);
    for (let k = 0; k < h; k++) fut[k] = cm(`AVERAGE(OFFSET($B$${last};1-$H$2;0;$H$2;1))`);
  } else if (id === 'ses') {
    params = [[T.params.alpha[0], { v: round(P.alpha, 3), s: 'param' }]];
    head.push(H.level);
    extra = Array.from({ length: n }, (_, t) => ({ f: t === 0 ? 'B2' : `$H$2*B${R(t)}+(1-$H$2)*E${R(t - 1)}`, s: 'num' }));
    for (let t = 1; t < n; t++) fit[t] = `E${R(t - 1)}`;
    for (let k = 0; k < h; k++) fut[k] = `$E$${last}`;
  } else if (id === 'holt') {
    params = [[T.params.alpha[0], { v: round(P.alpha, 3), s: 'param' }], [T.params.beta[0], { v: round(P.beta, 3), s: 'param' }], [T.params.phi[0], { v: round(P.phi ?? 1, 3), s: 'param' }]];
    head.push(H.level, H.trend);
    extra = Array.from({ length: n }, (_, t) => (t === 0
      ? [{ f: 'B2', s: 'num' }, { f: `(B${R(Math.min(4, n - 1))}-B2)/${Math.min(4, n - 1)}`, s: 'num' }]
      : [{ f: `$H$2*B${R(t)}+(1-$H$2)*(E${R(t - 1)}+$H$4*F${R(t - 1)})`, s: 'num' }, { f: `$H$3*(E${R(t)}-E${R(t - 1)})+(1-$H$3)*$H$4*F${R(t - 1)}`, s: 'num' }]));
    for (let t = 1; t < n; t++) fit[t] = `E${R(t - 1)}+$H$4*F${R(t - 1)}`;
    for (let k = 0; k < h; k++) fut[k] = cm(`$E$${last}+IF($H$4=1;ROW()-${last};$H$4*(1-$H$4^(ROW()-${last}))/(1-$H$4))*$F$${last}`);
  } else if (id === 'linear') {
    head.push('t');
    extra = Array.from({ length: n + h }, (_, t) => ({ v: t }));
    params = [[T.ex.slope, { f: cm(`SLOPE($B$2:$B$${last};$E$2:$E$${last})`), s: 'num' }], ['a', { f: cm(`INTERCEPT($B$2:$B$${last};$E$2:$E$${last})`), s: 'num' }]];
    for (let t = 0; t < n; t++) fit[t] = `$H$3+$H$2*E${R(t)}`;
    for (let k = 0; k < h; k++) fut[k] = `$H$3+$H$2*E${R(n + k)}`;
  } else if (id === 'hw') {
    // FORECAST.ETS у Excel 2016 і новіших: адитивна модель ETS (рівень, тренд, сезон); шкала часу 1, 2, 3…
    head.push('t', '± 95%');
    params = [[T.xl.seasonLen, { v: S.m, s: 'parami' }]];
    for (let k = 0; k < h; k++) fut[k] = cm(`_xlfn.FORECAST.ETS(E${R(n + k)};$B$2:$B$${last};$E$2:$E$${last};$H$2)`);
  }

  for (let t = 0; t < n + h; t++) {
    const rr = R(t), hist = t < n;
    const row = [hist ? S.dates[t] : fd[t - n], hist ? S.y[t] : ''];
    const f = hist ? fit[t] : fut[t - n];
    row.push(f ? { f, s: 'num' } : '');
    row.push(hist && f ? errF(rr) : '');
    if (id === 'ses') row.push(hist ? extra[t] : '');
    if (id === 'holt') row.push(...(hist ? extra[t] : ['', '']));
    if (id === 'linear') row.push(extra[t]);
    if (id === 'hw') row.push({ v: t + 1 }, hist ? '' : { f: cm(`_xlfn.FORECAST.ETS.CONFINT(E${rr};$B$2:$B$${last};$E$2:$E$${last};0.95;$H$2)`), s: 'num' });
    rows.push(row);
  }
  // параметри й похибка праворуч: G підпис, H значення
  // у Холта-Вінтерса через FORECAST.ETS немає моделі на історії, тож і середньої похибки по ній
  const side = [...params, ...(id === 'hw' ? [] : [[T.xl.mae, { f: cm(`SUMPRODUCT(ABS(IFERROR(D2:D${last}*1;0)))/MAX(1;COUNT(D2:D${last}))`), s: 'num' }]])];
  side.forEach(([lab, val], i) => {
    const row = rows[i];
    while (row.length < 6) row.push('');
    row[6] = lab; row[7] = val;
  });
  head.length = Math.max(head.length, 6);
  for (let i = 0; i < head.length; i++) if (head[i] == null) head[i] = '';
  head[6] = T.xl.param; head[7] = '';
  const model = T.models[id];
  const about = [[model.name, model.short], ['', T.xl.formulaNote], ...model.how.map((s, i) => [String(i + 1), s[0] + (s[1] ? '  ' + s[1].replace(/_\{([^}]*)\}/g, '$1').replace(/\^\{([^}]*)\}/g, '^$1') : '')]), ['', T.xl.note]];
  saveBlob(`forecast_${id}_${S.id}.xlsx`, xlsxBlob([
    { name: T.xl.model, head, rows, widths: [12, 12, 12, 12, 12, 12, 26, 14] },
    { name: T.xl.about, head: ['', ''], rows: about, widths: [26, 100], wrap: true },
  ]));
}
