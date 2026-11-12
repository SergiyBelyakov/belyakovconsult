// Тексти сигналів і карток уваги з чисел моделі (спільні для огляду, якості даних і звіту).
import { IND_BY } from './data.js';

export function sigInfo(s, ctx) {
  const { T, f, code, regionName } = ctx;
  const name = s.ind ? code(IND_BY[s.ind]) + ' ' + T.ind[s.ind].s : null;
  switch (s.id) {
    case 'cost': return { ...T.att.cost(s.partner, f.dec2(s.fin.cpi), f.eur(-s.fin.vac)), subject: T.partner(s.partner), go: ['finance', { partner: s.partner }], fig: [T.fin.eac, f.eur(s.fin.eac) + ' / ' + f.eur(s.fin.bac)] };
    case 'behind': {
      const fc = s.fc;
      return { ...T.att.behind(name, f.pct((s.st.ratio || 0) * 100), T.why[s.ind] || ''), subject: name, ind: s.ind, fig: [T.tbl.actual, f.value(IND_BY[s.ind], s.st.v) + ' / ' + f.value(IND_BY[s.ind], s.st.plan)] };
    }
    case 'over': return { ...T.att.over(name), subject: name, ind: s.ind, fig: [T.tbl.ofPlan, f.pct(s.st.ratio * 100)] };
    case 'coverage': return { ...T.att.coverage(regionName(s.region, true), f.pct(s.rs.coverage * 100, 1), f.pct(s.median * 100, 1), f.dec1(s.median / s.rs.coverage)), subject: regionName(s.region), go: ['regions', { region: s.region }], fig: [T.reg.unique, f.int(s.rs.unique) + ' / ' + f.int(s.rs.pin)] };
    case 'verify': return { ...T.att.verify(s.partner, f.pct(s.dq.verify), f.int(ctx.unconfirmed || 0)), subject: T.partner(s.partner), go: ['quality', {}], fig: [T.dq.std.validity, f.int(s.dq.s.validity)] };
    case 'heaping': return { ...T.att.heaping(s.partner, f.pct(s.dq.dig.zeros * 100)), subject: T.partner(s.partner), go: ['quality', {}], fig: ['χ²', f.int(s.dq.dig.chi)] };
    case 'late': return { ...T.att.late(s.partner, s.dq.lateLast), subject: T.partner(s.partner), go: ['quality', {}], fig: [T.dq.std.timeliness, f.int(s.dq.s.timeliness)] };
    case 'underspend': return { ...T.att.underspend(s.partner, f.eur(s.fin.rateNow), f.eur(s.fin.rate)), subject: T.partner(s.partner), go: ['finance', { partner: s.partner }], fig: [T.fin.spi, f.dec2(s.fin.spi)] };
    case 'double': return { ...T.att.double(f.int(s.reach.ov + s.reach.dupD)), subject: T.sigSubject.program, go: ['quality', {}], fig: [T.dq.unique, f.int(s.reach.unique) + ' / ' + f.int(s.reach.gross)] };
    case 'disagg': return { ...T.att.disagg(s.partner), subject: T.partner(s.partner), go: ['quality', {}], fig: [T.dq.std.precision, f.int(s.dq.s.precision)] };
    default: return { t: s.id, why: '', subject: '' };
  }
}
