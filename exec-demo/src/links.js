// Граф залежностей бізнесу: люди → процеси → клієнти і продажі → фінанси.
// Причинний зв'язок (cause) позначено там, де є механізм і часовий порядок; кореляція (corr): лише спільний рух.
// Сила зв'язку: коефіцієнт Пірсона на рівнях рядів за всі місяці з найкращим зсувом 0..3 міс.
import { MONTHS } from './data.js';
import { dataFor, turnover } from './model.js';
import { baseline } from './outlook.js';

const COLS = ['people', 'process', 'market', 'finance'];
export const GRAPH = {
  mfg: {
    nodes: [
      ['vacDays', 'people'], ['overtime', 'people'], ['turnover', 'people'], ['sick', 'people'],
      ['oee', 'process'], ['defect', 'process'], ['otd', 'process'],
      ['vsPlan', 'market'], ['dso', 'market'],
      ['cogsRate', 'finance'], ['payRatio', 'finance'], ['margin', 'finance'], ['cash', 'finance'],
    ],
    edges: [
      ['vacDays', 'overtime', 'cause'], ['overtime', 'turnover', 'cause'], ['turnover', 'oee', 'cause'], ['turnover', 'defect', 'cause'],
      ['oee', 'vsPlan', 'cause'], ['otd', 'vsPlan', 'cause'], ['defect', 'cogsRate', 'cause'], ['overtime', 'payRatio', 'cause'],
      ['vsPlan', 'margin', 'cause'], ['cogsRate', 'margin', 'cause'], ['payRatio', 'margin', 'cause'], ['margin', 'cash', 'cause'], ['dso', 'cash', 'cause'],
      ['sick', 'overtime', 'corr'], ['dso', 'vsPlan', 'corr'], ['turnover', 'cogsRate', 'corr'],
    ],
    focus: 'south',
  },
  svc: {
    nodes: [
      ['vacDays', 'people'], ['overtime', 'people'], ['turnover', 'people'], ['sick', 'people'],
      ['util', 'process'], ['wait', 'process'],
      ['nps', 'market'], ['repeat', 'market'], ['vsPlan', 'market'], ['online', 'market'],
      ['payRatio', 'finance'], ['margin', 'finance'], ['cash', 'finance'],
    ],
    edges: [
      ['vacDays', 'overtime', 'cause'], ['overtime', 'turnover', 'cause'], ['turnover', 'wait', 'cause'], ['turnover', 'util', 'cause'],
      ['wait', 'nps', 'cause'], ['nps', 'repeat', 'cause'], ['repeat', 'vsPlan', 'cause'], ['overtime', 'payRatio', 'cause'],
      ['vsPlan', 'margin', 'cause'], ['payRatio', 'margin', 'cause'], ['margin', 'cash', 'cause'],
      ['sick', 'overtime', 'corr'], ['online', 'vsPlan', 'corr'],
    ],
    focus: 'east',
  },
};
export const linkCols = COLS;
export const COMPANY_NODES = ['dso', 'cash', 'online'];

// пороги для стану вузла: [увага, критично, напрям: 1 = гірше, коли більше]
const THR = {
  overtime: [0.1, 0.12, 1], turnover: [0.2, 0.3, 1], vacDays: [45, 60, 1], oee: [0.72, 0.68, -1], defect: [2, 2.5, 1], otd: [0.93, 0.9, -1],
  vsPlan: [-0.05, -0.08, -1], dso: [55, 60, 1], util: [0.75, 0.7, -1], wait: [15, 20, 1], nps: [45, 40, -1], repeat: [0.42, 0.38, -1],
};
export function nodeLevel(id, v, extra) {
  if (id === 'cash') return v < extra.threshold ? 'critical' : v < extra.threshold * 1.4 ? 'warning' : 'healthy';
  if (id === 'cogsRate' || id === 'margin') { const d = v - extra.ref; const bad = id === 'cogsRate' ? d : -d; return bad > 0.04 ? 'critical' : bad > 0.02 ? 'warning' : 'healthy'; }
  const t = THR[id];
  if (!t || v == null) return 'info';
  const [w, c, dir] = t;
  return dir > 0 ? (v > c ? 'critical' : v > w ? 'warning' : 'healthy') : (v < c ? 'critical' : v < w ? 'warning' : 'healthy');
}

// Ряд вузла для підрозділу (або компанії для грошових вузлів) за місяці 0..i
export function nodeSeries(ind, id, unit, i) {
  const D = dataFor(ind), u = D.units.find(x => x.id === unit) || D.units[0];
  const R = u.rows.slice(0, i + 1);
  switch (id) {
    case 'turnover': return MONTHS.slice(0, i + 1).map((_, t) => turnover([u], t));
    case 'vacDays': return R.map(r => r.vacDays);
    case 'vsPlan': return R.map(r => (r.revPlan ? r.rev / r.revPlan - 1 : 0));
    case 'cogsRate': return R.map(r => (r.rev ? r.cogs / r.rev : 0));
    case 'payRatio': return R.map(r => (r.rev ? r.payroll / r.rev : 0));
    case 'margin': return R.map(r => (r.rev ? (r.rev - r.cogs - r.payroll - r.other) / r.rev : 0));
    case 'dso': return D.company.slice(0, i + 1).map(c => c.dso);
    case 'cash': return D.company.slice(0, i + 1).map(c => c.cash);
    case 'online': { const o = D.units.find(x => x.id === 'online'); return o.rows.slice(0, i + 1).map(r => r.clients); }
    default: return R.map(r => r[id] ?? 0);
  }
}
const corr = (x, y) => {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { const a = x[k] - mx, b = y[k] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
};
// найкращий зсув: x випереджає y на lag місяців
export function bestLag(x, y, maxLag = 3) {
  let best = { r: 0, lag: 0 };
  for (let L = 0; L <= maxLag; L++) {
    const r = corr(x.slice(0, x.length - L), y.slice(L));
    if (Math.abs(r) > Math.abs(best.r) + 0.02 || (L === 0 && !best.set)) best = { r, lag: L, set: true };
  }
  return best;
}

export function graphFor(ind, unit, i) {
  const G = GRAPH[ind];
  const D = dataFor(ind);
  const scope = unit !== 'all' && D.units.some(u => u.id === unit && u.kind !== 'office') ? unit : G.focus;
  const B = baseline(ind, i);
  const series = Object.fromEntries(G.nodes.map(([id]) => [id, nodeSeries(ind, id, scope, i)]));
  const ref = s => s.slice(0, 12).reduce((a, b) => a + b, 0) / Math.min(12, s.length);
  const nodes = G.nodes.map(([id, col]) => {
    const s = series[id], v = s[s.length - 1];
    return { id, col, value: v, level: nodeLevel(id, v, { threshold: B.threshold, ref: ref(s) }), company: COMPANY_NODES.includes(id) };
  });
  const edges = G.edges.map(([a, b, type]) => ({ id: a + '>' + b, from: a, to: b, type, ...bestLag(series[a], series[b]) }));
  return { scope, nodes, edges, series };
}
