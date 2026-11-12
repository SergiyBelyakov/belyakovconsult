// Форматування чисел, грошей і кварталів за мовою інтерфейсу.
import { QS } from './data.js';

const ROMAN = ['I', 'II', 'III', 'IV'];
export function makeFmt(T) {
  const loc = T.locale;
  const nf = d => new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const n0 = nf(0), n1 = nf(1), n2 = nf(2);
  const int = v => n0.format(Math.round(v || 0));
  const dec1 = v => n1.format(v || 0);
  const dec2 = v => n2.format(v || 0);
  const num = (v, d = 0) => (d === 2 ? dec2(v) : d === 1 ? dec1(v) : int(v));
  const pct = (v, d = 0) => (v == null ? '·' : num(v, d) + '%');
  const share = (v, d = 0) => pct(v * 100, d);
  const minus = '−';
  const signed = (v, d = 1) => (v > 0.05 ? '+' : v < -0.05 ? minus : '') + num(Math.abs(v), d);
  const pp = (v, d = 1) => signed(v, d) + ' ' + T.units.pp;
  const eur = v => {
    const a = Math.abs(v || 0), s = v < 0 ? minus : '';
    if (a >= 1e6) return s + '€' + n2.format(a / 1e6) + T.units.sep + T.units.m;
    if (a >= 1e3) return s + '€' + n0.format(a / 1e3) + T.units.sep + T.units.k;
    return s + '€' + n0.format(a);
  };
  const eurAxis = v => (Math.abs(v) >= 1e6 ? '€' + new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(v / 1e6) + T.units.mShort : Math.abs(v) >= 1e3 ? '€' + n0.format(v / 1e3) + T.units.kShort : '€' + n0.format(v));
  const compact = v => (Math.abs(v) >= 1e4 ? new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(v / 1e3) + T.units.kShort : int(v));
  const q = k => (T.locale.startsWith('uk') ? `${ROMAN[QS[k].q - 1]} кв. ${QS[k].y}` : `Q${QS[k].q} ${QS[k].y}`);
  const tick = k => (T.locale.startsWith('uk') ? (QS[k].q === 1 ? `I ${QS[k].y}` : ROMAN[QS[k].q - 1]) : QS[k].q === 1 ? `Q1 ${QS[k].y}` : `Q${QS[k].q}`);
  const qShort = k => (T.locale.startsWith('uk') ? ROMAN[QS[k].q - 1] : 'Q' + QS[k].q);
  const value = (d, v, dd) => (v == null ? '·' : d.unit === 'pct' ? pct(v, dd ?? (Math.abs(v) < 20 && v % 1 ? 1 : 0)) : int(v));
  return { int, dec1, dec2, num, pct, share, signed, pp, eur, eurAxis, compact, q, tick, qShort, value, minus };
}
