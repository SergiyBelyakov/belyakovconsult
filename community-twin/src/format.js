// Форматування чисел, дат і показників за мовою інтерфейсу.
export function makeFmt(T) {
  const loc = T.locale, uk = loc.startsWith('uk');
  const nf = d => new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const n0 = nf(0), n1 = nf(1), n2 = nf(2);
  const int = v => (v == null || !Number.isFinite(v) ? '…' : n0.format(Math.round(v)));
  const dec1 = v => (v == null || !Number.isFinite(v) ? '…' : n1.format(v));
  const dec2 = v => (v == null || !Number.isFinite(v) ? '…' : n2.format(v));
  const minus = s => s.replace(/^-/, '−');
  // значення вже у відсотках (59,7 → «60%»), частка (0,597 → «60%»)
  const pctV = (v, d) => (v == null || !Number.isFinite(v) ? '…' : (d != null ? nf(d) : Math.abs(v) < 10 ? n1 : n0).format(v) + '%');
  const pct = (r, d) => pctV(r == null ? null : r * 100, d);
  const signedPct = (r, d = 1) => (r > 0 ? '+' : r < 0 ? '−' : '') + pctV(Math.abs(r) * 100, d);
  const signed = (v, f = int) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));
  const pp = r => n1.format(Math.abs(r)) + (uk ? ' в. п.' : ' pp');
  const mln = v => (uk ? n1.format(v) + ' млн грн' : 'UAH ' + n1.format(v) + 'm');
  const thou = v => (uk ? n0.format(v) + ' тис. грн' : 'UAH ' + n0.format(v) + 'k');
  const uah = v => (uk ? n0.format(Math.round(v)) + ' грн' : 'UAH ' + n0.format(Math.round(v)));
  const km = v => n1.format(v) + (uk ? ' км' : ' km');
  const min = v => (v == null || !Number.isFinite(v) ? '…' : n0.format(Math.round(v)) + (uk ? ' хв' : ' min'));
  const ha = v => n0.format(Math.round(v)) + (uk ? ' га' : ' ha');
  const date = iso => { if (!iso) return '…'; const [y, m, d] = iso.split('-'); return uk ? `${d}.${m}.${y}` : `${+d} ${T.monthsShort[+m - 1]} ${y}`; };
  const monthYear = iso => { if (!iso) return '…'; const [y, m] = iso.split('-'); return T.monthsShort[+m - 1] + ' ' + y; };
  // значення показника паспорта за його форматом
  const ind = x => {
    if (x.v == null) return '…';
    if (x.fmt === 'pct') return pctV(x.v);
    if (x.fmt === 'dec1') return minus(dec1(x.v));
    return minus(int(x.v));
  };
  const indVal = (x, v) => ind({ ...x, v });
  return { int, dec1, dec2, pct, pctV, signedPct, signed, pp, mln, thou, uah, km, min, ha, date, monthYear, ind, indVal, minus };
}
