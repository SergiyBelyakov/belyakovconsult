// Форматування чисел і дат за мовою інтерфейсу.
import { STRINGS } from './i18n.js';

export function makeFmt(lang) {
  const T = STRINGS[lang];
  const loc = T.locale;
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Intl для uk/pt ставить нерозривний пробіл; у PDF-шрифтах він є, тож лишаємо.
  const int = n => nf0.format(Math.round(n || 0));
  const dec1 = n => nf1.format(n || 0);
  const dec2 = n => nf2.format(n || 0);
  const compact = n => {
    const a = Math.abs(n || 0);
    if (a >= 1e6) return nf2.format(n / 1e6) + T.units.m;
    if (a >= 1e4) return nf1.format(n / 1e3) + T.units.k;
    return int(n);
  };
  const axis = n => {
    const a = Math.abs(n || 0);
    if (a >= 1e6) return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(n / 1e6) + T.units.m;
    if (a >= 1e3) return new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(n / 1e3) + T.units.k;
    return int(n);
  };
  const pct = (n, d = 2) => (d === 1 ? dec1(n) : d === 0 ? int(n) : dec2(n)) + '%';
  const signed = (n, d = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + (d === 1 ? dec1(Math.abs(n)) : dec2(Math.abs(n)));
  const month = m => T.months[Number(m.slice(5)) - 1];
  const monthYear = m => T.months[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4);
  const monthLong = m => T.monthsFull[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4);
  const ms = n => int(n) + ' ' + T.ms;
  return { int, dec1, dec2, compact, axis, pct, signed, month, monthYear, monthLong, ms };
}

export function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 1.2 ? 1.2 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
  return step * p;
}
