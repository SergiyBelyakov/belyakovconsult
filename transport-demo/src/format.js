// Форматування чисел за мовою інтерфейсу.
export function makeFmt(T) {
  const loc = T.locale;
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const int = n => nf0.format(Math.round(n || 0));
  const dec1 = n => nf1.format(n || 0);
  // частка 0..1 → «12%»
  const pct = (r, d = 0) => (d ? nf1.format((r || 0) * 100) : nf0.format(Math.round((r || 0) * 100))) + '%';
  const min = t => nf0.format(Math.round(t || 0)) + ' ' + T.minUnit;
  const km = v => nf1.format(v || 0) + ' ' + T.km;
  // час із верхньою межею: понад 4 год показуємо словами
  const tmin = t => (Number.isFinite(t) && t < 240 ? min(t) : T.overCap);
  const signed = (n, fmt = int) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
  return { int, dec1, pct, min, km, signed, tmin };
}
