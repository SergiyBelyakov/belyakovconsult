// Читання файлу відвідувача в браузері: CSV (роздільник визначається сам) і Excel .xlsx (ZIP розпаковується
// вбудованим DecompressionStream, XML читає DOMParser). Потім профіль колонок і набір даних для рушія.
// Файл нікуди не надсилається.

export const MAX_ROWS = 50000;

// ——— CSV ———
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const head = src.slice(0, 20000).split(/\r?\n/).slice(0, 8);
  const count = (line, d) => { let q = false, k = 0; for (const ch of line) { if (ch === '"') q = !q; else if (ch === d && !q) k++; } return k; };
  const delim = [',', ';', '\t', '|'].map(d => {
    const c = head.filter(Boolean).map(l => count(l, d));
    const min = Math.min(...c), max = Math.max(...c);
    return { d, score: min > 0 ? min * (min === max ? 2 : 1) : 0 };
  }).sort((a, b) => b.score - a.score)[0];
  const D = delim && delim.score > 0 ? delim.d : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === D) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) break;
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(v => v !== '')) rows.push(row); }
  return rows;
}

// ——— XLSX ———
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = {}, dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method, size, off };
    p += 46 + nl + el + cl;
  }
  const read = async name => {
    const f = files[name];
    if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true), data = u8.subarray(start, start + f.size);
    if (f.method === 0) return dec.decode(data);
    if (typeof DecompressionStream === 'undefined') throw new Error('nostream');
    const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return dec.decode(out);
  };
  return { files, read };
}
const colIndex = ref => { let k = 0; for (const ch of ref) { const c = ch.charCodeAt(0); if (c < 65 || c > 90) break; k = k * 26 + (c - 64); } return k - 1; };
const pad = v => String(v).padStart(2, '0');
function excelDate(serial) {
  const ms = Math.round((serial - 25569) * 864e5), d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return serial % 1 ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date;
}
export async function parseXlsx(buf) {
  const z = await unzip(buf), P = new DOMParser(), xml = s => P.parseFromString(s, 'application/xml');
  const wb = xml(await z.read('xl/workbook.xml')), rels = xml(await z.read('xl/_rels/workbook.xml.rels'));
  const sheet = wb.getElementsByTagName('sheet')[0];
  const rid = sheet && (sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
  let target = 'worksheets/sheet1.xml';
  for (const r of rels.getElementsByTagName('Relationship')) if (r.getAttribute('Id') === rid) target = r.getAttribute('Target');
  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  const sst = await z.read('xl/sharedStrings.xml');
  const strings = sst ? [...xml(sst).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  const dates = new Set(), st = await z.read('xl/styles.xml');
  if (st) {
    const sd = xml(st), custom = {};
    for (const nf of sd.getElementsByTagName('numFmt')) custom[nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode') || '';
    const xfs = sd.getElementsByTagName('cellXfs')[0];
    if (xfs) [...xfs.getElementsByTagName('xf')].forEach((xf, k) => {
      const id = Number(xf.getAttribute('numFmtId')), code = (custom[id] || '').replace(/\[[^\]]*\]|"[^"]*"/g, '');
      if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dy]|h+:m/i.test(code)) dates.add(k);
    });
  }
  const sh = xml(await z.read(path)), rows = [];
  for (const row of sh.getElementsByTagName('row')) {
    const r = [];
    for (const c of row.getElementsByTagName('c')) {
      const col = colIndex(c.getAttribute('r') || 'A'), t = c.getAttribute('t'), s = Number(c.getAttribute('s'));
      const v = c.getElementsByTagName('v')[0];
      let val = v ? v.textContent : '';
      if (t === 's') val = strings[Number(val)] ?? '';
      else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
      else if (t === 'b') val = val === '1' ? 'TRUE' : 'FALSE';
      else if ((!t || t === 'n') && val !== '' && dates.has(s)) val = excelDate(Number(val));
      r[col] = val;
    }
    const arr = Array.from(r, x => x ?? '');
    if (arr.some(x => x !== '')) rows.push(arr);
    if (rows.length > MAX_ROWS + 1) break;
  }
  return rows;
}

export async function readFile(file) {
  const name = file.name || 'file';
  if (/\.xlsx$/i.test(name)) return { name, rows: await parseXlsx(await file.arrayBuffer()) };
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) text = new TextDecoder('windows-1251').decode(buf);   // старі CSV з Excel кирилицею
  return { name, rows: parseCsv(text) };
}

// ——— значення ———
export function parseNum(s) {
  if (s == null) return NaN;
  let t = String(s).trim().replace(/[\s  ']/g, '').replace(/(грн|uah|usd|eur|₴|\$|€|%)/gi, '');
  if (!t) return NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}
export function parseDate(s) {
  const t = String(s || '').trim();
  let m, y, mo, d, h = null, mi = 0;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/))) { y = +m[1]; mo = +m[2]; d = +m[3]; if (m[4] != null) { h = +m[4]; mi = +m[5]; } }
  else if ((m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (m[4] != null) { h = +m[4]; mi = +m[5]; } }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  if (!Number.isFinite(ms)) return null;
  return { day: Math.floor(ms / 864e5), hour: h != null ? h + mi / 60 : null };
}

// Профіль колонок: числа, дати, текст; кандидати в групи й ідентифікатори
export function profile(rows) {
  const head = rows[0].map((h, k) => String(h || '').trim() || `col_${k + 1}`);
  const body = rows.slice(1, MAX_ROWS + 1).map(r => head.map((_, k) => (r[k] == null ? '' : String(r[k]).trim())));
  const cols = head.map((name, k) => {
    const vals = body.map(r => r[k]).filter(v => v !== '');
    const sample = vals.length > 4000 ? vals.filter((_, i) => i % Math.ceil(vals.length / 4000) === 0) : vals;
    const nNum = sample.filter(v => Number.isFinite(parseNum(v))).length, nDate = sample.filter(v => parseDate(v)).length;
    const distinct = new Set(vals).size;
    const type = sample.length && nDate / sample.length > 0.9 ? 'date' : sample.length && nNum / sample.length > 0.9 ? 'num' : 'text';
    const idLike = /(^|_|\s)(id|код|номер|code|number|no|№)($|_|\s)/i.test(name) || (distinct === vals.length && vals.length > 20 && type !== 'num');
    const hasTime = type === 'date' && sample.some(v => { const p = parseDate(v); return p && p.hour != null && p.hour !== 0; });
    return { k, name, type, distinct, filled: vals.length, idLike, hasTime };
  });
  const groupCands = cols.filter(c => c.type === 'text' && c.distinct >= 2 && c.distinct <= 40 && c.filled > body.length * 0.6);
  const def = {
    feats: cols.filter(c => c.type === 'num' && !c.idLike && c.distinct > 2).slice(0, 12).map(c => c.k),
    group: groupCands.length ? groupCands.sort((a, b) => Math.abs(a.distinct - 7) - Math.abs(b.distinct - 7))[0].k : -1,
    id: (cols.find(c => c.idLike) || { k: -1 }).k,
    date: (cols.find(c => c.type === 'date') || { k: -1 }).k,
  };
  return { head, body, cols, def };
}

const robustSd = arr => {
  const v = Float64Array.from(arr.filter(Number.isFinite)).sort();
  if (!v.length) return 0;
  const med = v[v.length >> 1], dev = v.map(x => Math.abs(x - med)).sort();
  return 1.4826 * dev[dev.length >> 1];
};

// Набір даних для рушія з вибраних колонок
export function buildOwn(P, map, labels) {
  const { body, cols } = P, n = body.length;
  const features = [], columns = [];
  map.feats.forEach(k => {
    const raw = body.map(r => parseNum(r[k]));
    const ok = raw.filter(Number.isFinite);
    if (ok.length < Math.max(5, n * 0.5)) return;
    const pos = ok.every(v => v > 0), sorted = Float64Array.from(ok).sort(), med = sorted[sorted.length >> 1];
    const log = pos && sorted[Math.floor(sorted.length * 0.99)] / (med || 1) > 20;
    const tv = raw.map(v => (Number.isFinite(v) ? (log ? Math.log10(v) : v) : NaN));
    const sd = robustSd(tv) || robustSd(raw) || Math.abs(med) * 0.05 || 1;
    features.push({ id: 'c' + k, name: cols[k].name, side: 'both', floor: Math.max(1e-9, sd * 0.15), log, col: k });
    columns.push(tv);
  });
  if (map.date >= 0) {
    const pd = body.map(r => parseDate(r[map.date]));
    if (pd.filter(Boolean).length > n * 0.5) {
      if (cols[map.date].hasTime) { features.push({ id: 'offHours', name: labels.offHours, side: 'high', floor: 0.75, derived: 'off' }); columns.push(pd.map(p => (p && p.hour != null ? (p.hour < 8 ? 8 - p.hour : p.hour > 19 ? p.hour - 19 : 0) : NaN))); }
      features.push({ id: 'weekend', name: labels.weekend, side: 'high', floor: 0.25, derived: 'we' });
      columns.push(pd.map(p => (p ? ([0, 6].includes(((p.day % 7) + 11) % 7) ? 1 : 0) : NaN)));
    }
  }
  // групи: найчастіші 11 значень, решта в «Інше»
  let names = [labels.all], gi = new Int16Array(n);
  if (map.group >= 0) {
    const cnt = new Map();
    body.forEach(r => cnt.set(r[map.group] || '∅', (cnt.get(r[map.group] || '∅') || 0) + 1));
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
    const keep = top.slice(0, top.length > 12 ? 11 : 12).map(x => x[0]);
    names = keep.concat(top.length > 12 ? [labels.other] : []);
    const at = new Map(keep.map((v, k) => [v, k]));
    body.forEach((r, i) => { const v = r[map.group] || '∅'; gi[i] = at.has(v) ? at.get(v) : names.length - 1; });
  }
  const d = features.length, X = new Float64Array(n * d), missing = new Uint8Array(n * d);
  // пропуски заповнюємо медіаною групи: запис не стає аномалією через порожню клітинку
  features.forEach((ft, j) => {
    const med = names.map((_, g) => { const v = Float64Array.from(columns[j].filter((x, i) => gi[i] === g && Number.isFinite(x))).sort(); return v.length ? v[v.length >> 1] : 0; });
    for (let i = 0; i < n; i++) { const v = columns[j][i]; if (Number.isFinite(v)) X[i * d + j] = v; else { X[i * d + j] = med[gi[i]]; missing[i * d + j] = 1; } }
  });
  const groups = names.map((name, g) => ({ id: 'g' + g, name, n: 0 }));
  for (let i = 0; i < n; i++) groups[gi[i]].n++;
  return { kind: 'own', n, d, X, missing, features, groups: groups.filter(g => g.n > 0).length === groups.length ? groups : groups, gi, rows: null, P, map };
}
