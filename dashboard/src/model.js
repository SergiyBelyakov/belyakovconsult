// Усі похідні показники для поточної вибірки, розраховані один раз на рендер.
import { DOMAINS, REGIONS, SLA, byDim, byMonth, exceptions, growth, matrix, monthsOf, pct, signals, statusQuality, totals } from './data.js';

// base: вибірка лише за періодом і пошуком, щоб матриці лишались повними і працювали як навігатор.
export function buildModel(rows, target, base = rows) {
  const t = totals(rows);
  const months = byMonth(rows);
  const domains = byDim(rows, 'domain', DOMAINS);
  const regions = byDim(rows, 'region', REGIONS);
  const first = months[0], last = months[months.length - 1];
  const delta = {
    vol: growth(months),
    quality: first && last ? last.quality - first.quality : 0,
    avail: first && last ? last.avail - first.avail : 0,
    inc: first && last && first.inc ? ((last.inc - first.inc) / first.inc) * 100 : 0,
  };
  const segs = rows.map(r => ({ ...r, quality: pct(r.valid, r.processed) }));
  const below = segs.filter(r => r.quality < target);
  const worstCell = matrix(rows, 'quality').flatMap(r => r.cells.map(c => ({ region: r.region, ...c })))
    .filter(c => c.value != null).sort((a, b) => a.value - b.value)[0];
  // Динаміка за напрямами і регіонами: перший vs останній місяць.
  const monthIds = monthsOf(rows);
  const firstM = monthIds[0], lastM = monthIds[monthIds.length - 1];
  const change = (key, id) => {
    const a = totals(rows.filter(r => r[key] === id && r.month === firstM)).vol;
    const b = totals(rows.filter(r => r[key] === id && r.month === lastM)).vol;
    return { abs: b - a, rel: a ? ((b - a) / a) * 100 : 0 };
  };
  const domainMonths = DOMAINS.map(d => ({
    ...d, months: monthIds.map(m => totals(rows.filter(r => r.domain === d.id && r.month === m))),
  }));
  return {
    rows, t, months, domains, regions, delta, target,
    below, belowShare: segs.length ? (below.length / segs.length) * 100 : 0,
    worstCell,
    status: statusQuality(t.quality, target),
    exceptions: exceptions(rows, target),
    signals: signals(rows, target),
    matrixQuality: matrix(base, 'quality'),
    matrixVol: matrix(base, 'vol'),
    matrixLatency: matrix(base, 'latency'),
    domainChange: DOMAINS.map(d => ({ ...d, ...change('domain', d.id) })),
    regionChange: REGIONS.map(r => ({ ...r, ...change('region', r.id) })),
    domainMonths, monthIds,
    sla: SLA,
  };
}
