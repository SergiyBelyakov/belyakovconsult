// Форматування чисел, сум, дат і «1 з N» за мовою інтерфейсу.
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function makeFmt(T) {
  const loc = T.locale, uk = loc.startsWith('uk');
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const int = n => nf0.format(Math.round(n || 0));
  const dec1 = n => nf1.format(n || 0);
  const dec2 = n => nf2.format(n || 0);
  const pct = (r, d = 0) => (d ? nf1.format((r || 0) * 100) : nf0.format(Math.round((r || 0) * 100))) + '%';
  const signedPct = r => (r > 0 ? '+' : r < 0 ? '−' : '') + nf1.format(Math.abs(r * 100)) + '%';
  const uah = v => { const s = Math.abs(v) < 10000 ? nf2.format(v) : nf0.format(Math.round(v)); return uk ? s + ' грн' : 'UAH ' + s; };
  const uahShort = v => {
    const a = Math.abs(v);
    if (uk) return a >= 1e6 ? nf1.format(v / 1e6) + ' млн грн' : a >= 1e4 ? nf0.format(v / 1e3) + ' тис. грн' : uah(v);
    return a >= 1e6 ? 'UAH ' + nf1.format(v / 1e6) + 'm' : a >= 1e4 ? 'UAH ' + nf0.format(v / 1e3) + 'k' : uah(v);
  };
  const sigma = v => (v >= 11.95 ? '≥12σ' : (v < 0 ? '−' : '') + nf1.format(Math.abs(v)) + 'σ');
  const day = d => {
    const dt = new Date(Date.UTC(2026, 0, 1 + d));
    const dd = dt.getUTCDate(), mm = dt.getUTCMonth();
    const yy = dt.getUTCFullYear();
    return uk ? `${String(dd).padStart(2, '0')}.${String(mm + 1).padStart(2, '0')}.${yy}` : `${dd} ${MON_EN[mm]} ${yy}`;
  };
  const time = t => { const h = Math.floor(t), m = Math.min(59, Math.round((t - h) * 60)); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
  // «1 з N»: дві значущі цифри; мільйони скорочено; від мільярда словом
  const oneIn = p => {
    const N = 1 / Math.max(p, 1e-300);
    if (N >= 1e9) return uk ? 'мільярда' : 'a billion';
    if (N >= 1e6) return uk ? nf1.format(N / 1e6) + ' млн' : nf1.format(N / 1e6) + ' million';
    const mag = 10 ** Math.max(0, Math.floor(Math.log10(N)) - 1);
    return nf0.format(Math.max(2, Math.round(N / mag) * mag));
  };
  const times = k => (k >= 10 ? nf0.format(k) : nf1.format(k));
  const num = v => (!Number.isFinite(v) ? '' : Math.abs(v) >= 1000 ? nf0.format(v) : Number.isInteger(v) ? nf0.format(v) : nf2.format(v));
  return { int, dec1, dec2, pct, signedPct, uah, uahShort, sigma, day, time, oneIn, times, num, uk };
}
