// Форматування чисел за мовою інтерфейсу.
export function makeFmt(T) {
  const loc = T.locale;
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const int = n => nf0.format(Math.round(n || 0));
  const dec1 = n => nf1.format(n || 0);
  // частка 0..1 → «12%»
  const pct = (r, d = 0) => (d ? nf1.format((r || 0) * 100) : nf0.format(Math.round((r || 0) * 100))) + '%';
  return { int, dec1, pct };
}
