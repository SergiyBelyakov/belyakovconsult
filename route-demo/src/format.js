// Форматування чисел за мовою інтерфейсу.
export function makeFmt(T) {
  const loc = T.locale, uk = loc.startsWith('uk');
  const nf = d => new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const n0 = nf(0), n1 = nf(1);
  const ok = v => v != null && Number.isFinite(v);
  const int = v => (ok(v) ? n0.format(Math.round(v)).replace(/^-/, '−') : '…');
  const dec1 = v => (ok(v) ? n1.format(v).replace(/^-/, '−') : '…');
  const pct = (r, d) => (ok(r) ? (d != null ? nf(d) : Math.abs(r) < 0.1 ? n1 : n0).format(r * 100).replace(/^-/, '−') + '%' : '…');
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  const km = v => (ok(v) ? (v < 100 ? n1 : n0).format(v) + (uk ? ' км' : ' km') : '…');
  const km0 = v => n0.format(v) + (uk ? ' км' : ' km');
  const uah = v => (ok(v) ? (uk ? n0.format(Math.round(v)) + ' грн' : 'UAH ' + n0.format(Math.round(v))) : '…');
  const uahK = v => (ok(v) ? (uk ? n1.format(v / 1000) + ' тис. грн' : 'UAH ' + n1.format(v / 1000) + 'k') : '…');
  const kU = v => (ok(v) ? (uk ? n1.format(v / 1000) + ' тис.' : n1.format(v / 1000) + 'k') : '…');
  const min = v => (ok(v) ? n0.format(Math.round(v)) + (uk ? ' хв' : ' min') : '…');
  const hours = v => (ok(v) ? n1.format(v) + (uk ? ' год' : ' h') : '…');
  const dur = m => { if (!ok(m)) return '…'; const h = Math.floor(m / 60), r = Math.round(m % 60); return uk ? (h ? h + ' год ' : '') + r + ' хв' : (h ? h + ' h ' : '') + r + ' min'; };
  const kg = v => (ok(v) ? n0.format(Math.round(v)) + (uk ? ' кг' : ' kg') : '…');
  const t = v => (ok(v) ? n1.format(v) + (uk ? ' т' : ' t') : '…');
  const signedInt = v => sign(Math.round(v)) + n0.format(Math.abs(Math.round(v)));
  const signedPct = (r, d = 1) => sign(r) + nf(d).format(Math.abs(r) * 100) + '%';
  const signedUah = v => sign(Math.round(v)) + uah(Math.abs(v));
  const signedKm = v => sign(v) + km(Math.abs(v));
  return { int, dec1, pct, km, km0, uah, uahK, kU, min, hours, dur, kg, t, signedInt, signedPct, signedUah, signedKm, sign };
}
