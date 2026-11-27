// Форматування гривень, відсотків і відсоткових пунктів за мовою інтерфейсу. Від’ємні значення зі знаком мінус (−).
import { MONTHS } from './model/data.js';

export function makeFmt(T) {
  const loc = T.locale, uk = loc.startsWith('uk');
  const nf = (a, b = a) => new Intl.NumberFormat(loc, { minimumFractionDigits: a, maximumFractionDigits: b });
  const n0 = nf(0), n1 = nf(1), n2 = nf(2);
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  const abbr = v => {
    const a = Math.abs(v);
    if (a >= 1e9) return [n2.format(a / 1e9), uk ? 'млрд' : 'bn'];
    if (a >= 1e6) return [(a >= 1e8 ? n0 : n1).format(a / 1e6), uk ? 'млн' : 'm'];
    if (a >= 1e3) return [n1.format(a / 1e3), uk ? 'тис.' : 'k'];
    return [n0.format(a), ''];
  };
  const money = (v, signed = false) => {
    if (!Number.isFinite(v)) return '·';
    const [x, u] = abbr(v), s = signed ? sign(Math.round(v)) : v < 0 ? '−' : '';
    return uk ? `${s}${x}${u ? ' ' + u : ''} грн` : `${s}UAH ${x}${u}`;
  };
  const mln = (v, signed = false) => (Number.isFinite(v) ? (signed ? sign(Math.round(v / 1e5)) : v < 0 ? '−' : '') + n1.format(Math.abs(v) / 1e6) : '·');
  return {
    locale: loc, uk,
    money, moneyS: v => money(v, true),
    mln, mlnS: v => mln(v, true),
    unitM: uk ? 'млн грн' : 'UAH m',
    int: v => n0.format(Math.round(v)),
    dec1: v => n1.format(v), dec2: v => n2.format(v),
    uah: v => (uk ? `${n2.format(v)} грн` : `UAH ${n2.format(v)}`),
    pct: (v, d = 1) => (Number.isFinite(v) ? (v < 0 ? '−' : '') + nf(d).format(Math.abs(v) * 100) + '%' : '·'),
    pctS: (v, d = 1) => (Number.isFinite(v) ? sign(Math.round(v * 10 ** (d + 2))) + nf(d).format(Math.abs(v) * 100) + '%' : '·'),
    pp: (v, d = 1) => (Number.isFinite(v) ? sign(Math.round(v * 10 ** (d + 2))) + nf(d).format(Math.abs(v) * 100) + (uk ? ' п.п.' : ' pp') : '·'),
    mon: t => { const [y, m] = MONTHS[t].split('-').map(Number); return new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))).replace(/\.$/, ''); },
    monY: t => { const [y, m] = MONTHS[t].split('-').map(Number); return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))); },
    monL: t => { const [y, m] = MONTHS[t].split('-').map(Number); return new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))); },
  };
}
