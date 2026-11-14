// Форматування чисел за мовою інтерфейсу.
export function makeFmt(T) {
  const loc = T.locale;
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const int = n => nf0.format(Math.round(n || 0));
  const dec1 = n => nf1.format(n || 0);
  const date = d => d.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
  return { int, dec1, date };
}
