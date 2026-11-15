// Форматування чисел і дат за мовою інтерфейсу і точністю ряду
const ISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)); };

export function makeFmt(T, dec = 1) {
  const loc = T.locale;
  const nf = (min, max) => new Intl.NumberFormat(loc, { minimumFractionDigits: min, maximumFractionDigits: max });
  const n0 = nf(0, 0), n1 = nf(1, 1), n2 = nf(2, 2), nd = nf(0, dec), nds = nf(dec, dec);
  const compact = new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 });
  const mon = new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' });
  const monY = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dayF = new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const dow = new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' });
  const dmF = new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const clean = s => s.replace(/\.$/, '');
  const val = v => (Number.isFinite(v) ? (Math.abs(v) >= 1000 ? n0.format(v) : nd.format(v)) : '·');
  return {
    val,
    exact: v => (Number.isFinite(v) ? nds.format(v) : ''),
    axis: v => (Math.abs(v) >= 10000 ? compact.format(v) : Math.abs(v) >= 100 || Number.isInteger(v) ? n0.format(v) : Math.abs(v) >= 1 ? n1.format(v) : n2.format(v)),
    int: v => n0.format(v), dec1: v => n1.format(v), dec2: v => n2.format(v),
    pct0: v => (Number.isFinite(v) ? n0.format(v * 100) + '%' : '·'),
    pct1: v => (Number.isFinite(v) ? n1.format(v * 100) + '%' : '·'),
    pctSigned: v => (v > 0 ? '+' : v < 0 ? '−' : '') + n0.format(Math.abs(v) * 100) + '%',
    signed: v => (v > 0 ? '+' : v < 0 ? '−' : '') + (Math.abs(v) >= 100 ? n0.format(Math.abs(v)) : n1.format(Math.abs(v))),
    monShort: s => clean(mon.format(ISO(s))),
    dowShort: s => clean(dow.format(ISO(s))),
    dateShort: s => (s ? dayF.format(ISO(s)) : ''),
    dm: s => (s ? dmF.format(ISO(s)) : ''),
    dateLong: (s, freq) => (!s ? '' : freq === 'M' ? monY.format(ISO(s)) : freq === 'Y' ? String(ISO(s).getUTCFullYear()) : freq === 'Q' ? `${ISO(s).getUTCFullYear()} Q${Math.floor(ISO(s).getUTCMonth() / 3) + 1}` : dayF.format(ISO(s))),
  };
}

// Майбутні дати після останньої за частотою ряду
export function futureDates(last, h, freq) {
  const d = ISO(last), out = [];
  const pad = v => String(v).padStart(2, '0');
  for (let k = 1; k <= h; k++) {
    let x;
    if (freq === 'M') x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1));
    else if (freq === 'Q') x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3 * k, 1));
    else if (freq === 'Y') x = new Date(Date.UTC(d.getUTCFullYear() + k, 0, 1));
    else x = new Date(d.getTime() + k * (freq === 'W' ? 7 : 1) * 864e5);
    out.push(`${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`);
  }
  return out;
}
