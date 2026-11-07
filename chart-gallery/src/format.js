// Числа й дати мовою сторінки. Великі значення на осях скорочуються (12 тис., 1,2 млн), у підказках повні.
const MON = {
  uk: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
export function makeFmt(lang) {
  const uk = lang === 'uk', loc = uk ? 'uk-UA' : 'en-GB';
  const nf = (a, b) => new Intl.NumberFormat(loc, { minimumFractionDigits: a, maximumFractionDigits: b });
  const n0 = nf(0, 0), n1 = nf(0, 1), n2 = nf(0, 2), p1 = nf(1, 1);
  const num = v => (!Number.isFinite(v) ? '' : Math.abs(v) >= 1000 ? n0.format(v) : Math.abs(v) >= 10 ? n1.format(v) : n2.format(v));
  const fixed = (v, d) => (!Number.isFinite(v) ? '' : nf(d, d).format(v));
  const compact = v => {
    const a = Math.abs(v);
    if (a >= 1e9) return n1.format(v / 1e9) + (uk ? ' млрд' : 'bn');
    if (a >= 1e6) return n1.format(v / 1e6) + (uk ? ' млн' : 'm');
    if (a >= 1e4) return n0.format(v / 1e3) + (uk ? ' тис.' : 'k');
    return num(v);
  };
  const axis = (v, max) => (Math.abs(max) >= 1e4 ? compact(v) : num(v));
  const pct = (r, d = 0) => (!Number.isFinite(r) ? '' : (d ? p1.format(r * 100) : n0.format(r * 100)) + '%');
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v));
  const signedPct = r => (r > 0 ? '+' : r < 0 ? '−' : '') + p1.format(Math.abs(r) * 100) + '%';
  const d = day => new Date(day * 864e5);
  const date = day => { if (!Number.isFinite(day)) return ''; const t = d(day); return uk ? `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}.${t.getUTCFullYear()}` : `${t.getUTCDate()} ${MON.en[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
  const month = day => { const t = d(day); return `${MON[uk ? 'uk' : 'en'][t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
  const mon = day => MON[uk ? 'uk' : 'en'][d(day).getUTCMonth()];
  const monthIdx = m => MON[uk ? 'uk' : 'en'][m];
  return { uk, num, fixed, compact, axis, pct, signed, signedPct, date, month, mon, monthIdx };
}
// День від 1970-01-01 (UTC) і назад
export const dayOf = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 864e5);
export const isoDay = day => new Date(day * 864e5).toISOString().slice(0, 10);
export const ymd = day => { const t = new Date(day * 864e5); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
export const weekday = day => (((day + 3) % 7) + 7) % 7; // 0 = понеділок
