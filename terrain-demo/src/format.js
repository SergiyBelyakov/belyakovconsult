// Форматування чисел за мовою інтерфейсу.
export function makeFmt(T) {
  const loc = T.locale;
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const int = n => nf0.format(Math.round(n || 0));
  const dec1 = n => nf1.format(n || 0);
  const nf2 = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dec2 = n => nf2.format(n || 0);
  const pct = (r, d = 0) => (d ? nf1.format((r || 0) * 100) : nf0.format(Math.round((r || 0) * 100))) + '%';
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  const signedPct = (r, d = 1) => sign(r) + pct(Math.abs(r), d);
  const pp = r => nf1.format(Math.abs(r * 100)) + (loc.startsWith('uk') ? ' в. п.' : ' pp');
  // тисячі гривень → «61,3 млн грн» або «UAH 61.3m»; менше мільйона: тисячі
  const moneyK = k => {
    const a = Math.abs(k);
    if (loc.startsWith('uk')) return a >= 1000 ? nf1.format(k / 1000) + ' млн грн' : nf0.format(k) + ' тис. грн';
    return a >= 1000 ? 'UAH ' + nf1.format(k / 1000) + 'm' : 'UAH ' + nf0.format(k) + 'k';
  };
  const money = v => moneyK(v / 1000);
  const signedMoney = v => sign(v) + money(Math.abs(v));
  const axisMoney = v => (Math.abs(v) >= 1e6 ? nf0.format(v / 1e6) : nf1.format(v / 1e6));
  const month = (T2, key, long) => { const [y, m] = key.split('-').map(Number); return (long ? T2.monthsLong : T2.monthsShort)[m - 1] + ' ' + y; };
  const tick = key => { const [y, m] = key.split('-').map(Number); return T.monthsShort[m - 1] + (m === 1 ? ' ' + String(y).slice(2) : ''); };
  return { int, dec1, dec2, pct, signedPct, pp, money, signedMoney, axisMoney, month: (key, long) => month(T, key, long), tick, sign };
}
