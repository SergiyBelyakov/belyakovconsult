// Побудова моделі графіка з таблиці (зразка чи файлу відвідувача) і експорт зображення.
import { access } from './prep.js';
import { SURFACE, INK } from './palette.js';
import { saveBlob } from './xlsx.js';

export const sampleMap = t => Object.fromEntries(t.roles.map((r, i) => [r.id, i]));
export const labelsFor = (T, lang) => ({
  lang, other: T.ui.other, share: T.ui.share, endTotal: T.ui.endTotal, running: T.ui.running, fromPrev: T.ui.fromPrev, fromFirst: T.ui.fromFirst,
  binFrom: lang === 'en' ? 'From' : 'Від', binTo: lang === 'en' ? 'To' : 'До', count: lang === 'en' ? 'Count' : 'Кількість',
  n: lang === 'en' ? 'Records' : 'Записів', median: T.ui.median, mean: T.ui.mean, rank: T.ui.rank, na: T.ui.na, total: T.ui.total, cohort: T.ui.cohort, cohortSize: T.ui.cohortSize, wl: lang === 'en' ? 'Lower whisker' : 'Нижній вус', wh: lang === 'en' ? 'Upper whisker' : 'Верхній вус', outliers: lang === 'en' ? 'Outliers' : 'Викидів',
});
export function build(t, table, map, opts, L) {
  try { return t.prep(access(table, map), opts, L); }
  catch (e) { console.error(e); return { error: ['read'] }; }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = "Inter, 'Segoe UI', Arial, sans-serif";
// SVG для збереження: заголовок, підзаголовок, сам графік, легенда й підпис джерела
export function chartSvg(el, { title, sub, source }) {
  const svg = el && el.querySelector('svg');
  if (!svg) return null;
  const w = +svg.getAttribute('width'), h = +svg.getAttribute('height'), pad = 28, W = w + pad * 2;
  const items = [...el.querySelectorAll('.cg-legend > span')].map(s => ({ color: s.querySelector('i')?.style.background || '#888', text: s.textContent }));
  const rows = [];
  let x = 0, line = [];
  items.forEach(it => { const iw = 22 + it.text.length * 6.4 + 18; if (x + iw > w && line.length) { rows.push(line); line = []; x = 0; } line.push({ ...it, x }); x += iw; });
  if (line.length) rows.push(line);
  const tH = sub ? 62 : 42, lH = rows.length ? rows.length * 22 + 14 : 0, H = pad + tH + h + lH + 36;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${SURFACE}"/>`;
  out += `<text x="${pad}" y="${pad + 16}" font-family="${FONT}" font-size="18" font-weight="600" fill="${INK.primary}">${esc(title)}</text>`;
  if (sub) out += `<text x="${pad}" y="${pad + 40}" font-family="${FONT}" font-size="12.5" fill="${INK.muted}">${esc(sub)}</text>`;
  // innerHTML пише нерозривний пробіл як &nbsp;, а в XML такої сутності немає: замінюємо на числову
  out += `<g transform="translate(${pad},${pad + tH})">${svg.innerHTML.replace(/&nbsp;/g, '&#160;')}</g>`;
  rows.forEach((r, k) => r.forEach(it => {
    const yy = pad + tH + h + 14 + k * 22;
    out += `<rect x="${pad + it.x}" y="${yy}" width="12" height="12" rx="2" fill="${esc(it.color)}"/><text x="${pad + it.x + 18}" y="${yy + 10.5}" font-family="${FONT}" font-size="12" fill="${INK.muted}">${esc(it.text)}</text>`;
  }));
  out += `<text x="${pad}" y="${H - 16}" font-family="${FONT}" font-size="11" fill="${INK.faint}">${esc(source)}</text></svg>`;
  return out;
}
export function saveSvg(str, name) { saveBlob(name, new Blob([str], { type: 'image/svg+xml;charset=utf-8' })); }
export async function savePng(str, name) {
  const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas'), s = 2;
    c.width = img.width * s; c.height = img.height * s;
    const ctx = c.getContext('2d'); ctx.scale(s, s); ctx.drawImage(img, 0, 0);
    await new Promise(res => c.toBlob(b => { saveBlob(name, b); res(); }, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
