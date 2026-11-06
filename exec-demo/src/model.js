// Розрахунки панелі керівника: зведення підрозділів, KPI, міст EBITDA, сигнали, короткий огляд і сценарії.
import { generate, MONTHS, LAST } from './data.js';

export { MONTHS, LAST };
export const IND = ['mfg', 'svc'];
const cache = {};
export const dataFor = ind => (cache[ind] ||= generate(ind));

const SUM = ['rev', 'revPlan', 'cogs', 'cogsPlan', 'payroll', 'payrollPlan', 'other', 'otherPlan', 'hc', 'hcPlan', 'hires', 'exits', 'vol', 'vacancies', 'training', 'output', 'cap', 'downtime', 'clients'];
const div = (a, b) => (b ? a / b : 0);

// Зведений рядок за місяць i для набору підрозділів
export function agg(units, i) {
  const rs = units.map(u => u.rows[i]);
  const o = { m: MONTHS[i], i };
  for (const k of SUM) o[k] = rs.reduce((a, r) => a + (r[k] || 0), 0);
  const w = (k, wk, f = r => true) => { const xs = rs.filter(r => r[k] != null && f(r)); const W = xs.reduce((a, r) => a + (r[wk] || 0), 0); return W ? xs.reduce((a, r) => a + r[k] * r[wk], 0) / W : null; };
  o.overtime = w('overtime', 'hc');
  o.sick = w('sick', 'hc');
  o.vacDays = o.vacancies ? w('vacDays', 'vacancies') : w('vacDays', 'hc');
  o.oee = w('oee', 'cap');
  o.defect = w('defect', 'output');
  o.otd = w('otd', 'output');
  o.utilPlant = w('util', 'cap', r => r.cap != null);
  o.nps = w('nps', 'clients');
  o.wait = w('wait', 'clients', r => r.wait != null && r.ticket > 0.9);
  o.utilStaff = w('util', 'hc', r => r.ticket != null);
  o.repeat = w('repeat', 'clients');
  o.ticket = o.clients ? o.rev / o.clients : null;
  o.gm = div(o.rev - o.cogs, o.rev);
  o.gmPlan = div(o.revPlan - o.cogsPlan, o.revPlan);
  o.ebitda = o.rev - o.cogs - o.payroll - o.other;
  o.ebitdaPlan = o.revPlan - o.cogsPlan - o.payrollPlan - o.otherPlan;
  o.margin = div(o.ebitda, o.rev);
  o.marginPlan = div(o.ebitdaPlan, o.revPlan);
  o.vsPlan = div(o.rev, o.revPlan) - 1;
  return o;
}

export const pick = (D, unit) => (unit === 'all' ? D.units : D.units.filter(u => u.id === unit));
export const series = (units, from = 0, to = LAST) => MONTHS.slice(from, to + 1).map((_, k) => agg(units, from + k));

// Сума за період [a..b]
export function period(units, a, b) {
  const rows = series(units, a, b);
  const o = {};
  for (const k of ['rev', 'revPlan', 'cogs', 'cogsPlan', 'payroll', 'payrollPlan', 'other', 'otherPlan', 'hires', 'exits', 'vol', 'clients', 'output']) o[k] = rows.reduce((s, r) => s + r[k], 0);
  o.hcAvg = rows.reduce((s, r) => s + r.hc, 0) / rows.length;
  o.ebitda = o.rev - o.cogs - o.payroll - o.other;
  o.ebitdaPlan = o.revPlan - o.cogsPlan - o.payrollPlan - o.otherPlan;
  o.margin = div(o.ebitda, o.rev);
  o.gm = div(o.rev - o.cogs, o.rev);
  o.vsPlan = div(o.rev, o.revPlan) - 1;
  return o;
}
export const yearStart = i => i - (i % 12);
export const ytd = (units, i) => period(units, yearStart(i), i);
export const ytdLY = (units, i) => (i >= 12 ? period(units, yearStart(i) - 12, i - 12) : null);
export const ltm = (units, i) => period(units, Math.max(0, i - 11), i);

// Плинність: добровільні звільнення за 12 міс. / середня чисельність
export const turnover = (units, i) => { const p = ltm(units, i); return div(p.vol, p.hcAvg) * (12 / Math.min(12, i + 1)); };
export const revPerHead = (units, i) => { const p = ltm(units, i); return div(p.rev, p.hcAvg) * (12 / Math.min(12, i + 1)); };

// Міст EBITDA від плану до факту за період: обсяг, ставка прямих витрат, ФОП, інші витрати
export function bridge(p) {
  const cr = div(p.cogsPlan, p.revPlan);
  return [
    { id: 'plan', value: p.ebitdaPlan, total: true },
    { id: 'volume', value: (p.rev - p.revPlan) * (1 - cr) },
    { id: 'cost', value: -(p.cogs - p.rev * cr) },
    { id: 'payroll', value: -(p.payroll - p.payrollPlan) },
    { id: 'other', value: -(p.other - p.otherPlan) },
    { id: 'actual', value: p.ebitda, total: true },
  ];
}

// ——— KPI для огляду ———
export function kpis(D, ind, unit, i) {
  const units = pick(D, unit);
  const S = series(units, Math.max(0, i - 11), i);
  const cur = S[S.length - 1], ly = i >= 12 ? agg(units, i - 12) : null;
  const co = D.company[i], coPrev = D.company[Math.max(0, i - 3)];
  const opexAvg = D.company.slice(Math.max(0, i - 2), i + 1).reduce((a, c) => a + c.opex, 0) / 3;
  const list = [
    { id: 'rev', icon: 'chart', value: cur.rev, fmt: 'money', delta: cur.vsPlan * 100, dText: ['pct', cur.vsPlan], ctx: 'vsPlan', spark: S.map(r => r.rev), page: 'finance', accent: true },
    { id: 'margin', icon: 'pulse', value: cur.margin, fmt: 'pct1', delta: ly ? (cur.margin - ly.margin) * 100 : 0, dText: ['pp', ly ? cur.margin - ly.margin : 0], ctx: 'vsLY', spark: S.map(r => r.margin), page: 'finance' },
    { id: 'cash', icon: 'database', value: co.cash, fmt: 'money', delta: (co.cash / coPrev.cash - 1) * 100, dText: ['pct', co.cash / coPrev.cash - 1], ctx: 'vs3m', runway: co.cash / opexAvg, spark: D.company.slice(Math.max(0, i - 11), i + 1).map(c => c.cash), page: 'finance', company: true },
    { id: 'dso', icon: 'clock', value: co.dso, fmt: 'days', delta: co.dso - D.company[Math.max(0, i - 6)].dso, dText: ['days', co.dso - D.company[Math.max(0, i - 6)].dso], ctx: 'vs6m', goodWhenUp: false, spark: D.company.slice(Math.max(0, i - 11), i + 1).map(c => c.dso), page: 'finance', company: true },
    { id: 'hc', icon: 'users', value: cur.hc, fmt: 'int', delta: cur.hc - cur.hcPlan, dText: ['vac', cur.vacancies], ctx: 'vacancies', neutral: true, spark: S.map(r => r.hc), page: 'people' },
    { id: 'turnover', icon: 'user', value: turnover(units, i), fmt: 'pct1', delta: ly ? (turnover(units, i) - turnover(units, i - 12)) * 100 : 0, dText: ['pp', ly ? turnover(units, i) - turnover(units, i - 12) : 0], ctx: 'vsLY', goodWhenUp: false, spark: S.map(r => turnover(units, r.i)), page: 'people' },
    { id: 'overtime', icon: 'clock', value: cur.overtime, fmt: 'pct1', delta: ly ? (cur.overtime - ly.overtime) * 100 : 0, dText: ['pp', ly ? cur.overtime - ly.overtime : 0], ctx: 'vsLY', goodWhenUp: false, spark: S.map(r => r.overtime), page: 'people' },
  ];
  if (ind === 'mfg') {
    list.push(
      { id: 'oee', icon: 'settings', value: cur.oee, fmt: 'pct1', delta: ly ? (cur.oee - ly.oee) * 100 : 0, dText: ['pp', ly ? cur.oee - ly.oee : 0], ctx: 'vsLY', spark: S.map(r => r.oee), page: 'operations' },
      { id: 'defect', icon: 'warning', value: cur.defect / 100, fmt: 'pct1', delta: ly ? cur.defect - ly.defect : 0, dText: ['pp', ly ? (cur.defect - ly.defect) / 100 : 0], ctx: 'vsLY', goodWhenUp: false, spark: S.map(r => r.defect), page: 'operations' },
    );
  } else {
    list.push(
      { id: 'nps', icon: 'pulse', value: cur.nps, fmt: 'int', delta: ly ? cur.nps - ly.nps : 0, dText: ['pts', ly ? cur.nps - ly.nps : 0], ctx: 'vsLY', spark: S.map(r => r.nps), page: 'operations' },
      { id: 'wait', icon: 'clock', value: cur.wait, fmt: 'min', delta: ly ? cur.wait - ly.wait : 0, dText: ['min', ly ? cur.wait - ly.wait : 0], ctx: 'vsLY', goodWhenUp: false, spark: S.map(r => r.wait), page: 'operations' },
    );
  }
  list.push({ id: 'rpe', icon: 'user', value: revPerHead(units, i), fmt: 'money', delta: ly ? (revPerHead(units, i) / revPerHead(units, i - 12) - 1) * 100 : 0, dText: ['pct', ly ? revPerHead(units, i) / revPerHead(units, i - 12) - 1 : 0], ctx: 'vsLY', spark: S.map(r => revPerHead(units, r.i)), page: 'people' });
  return list;
}

// ——— сигнали ———
// level за замовчуванням; конкретний рівень кожного випадку визначає правило
export const SIGNALS = [
  { id: 'revPlan', scope: 'unit', page: 'finance' },
  { id: 'marginDrop', scope: 'unit', page: 'finance' },
  { id: 'dso', scope: 'company', page: 'finance' },
  { id: 'overdue', scope: 'company', page: 'finance' },
  { id: 'turnover', scope: 'unit', page: 'people' },
  { id: 'overtime', scope: 'unit', page: 'people' },
  { id: 'vacancies', scope: 'unit', page: 'people' },
  { id: 'quality', scope: 'unit', page: 'operations' },
  { id: 'concentration', scope: 'company', page: 'risks' },
  { id: 'cash', scope: 'company', page: 'finance' },
];

export function signals(D, ind, i) {
  const out = Object.fromEntries(SIGNALS.map(s => [s.id, []]));
  const add = (id, level, x) => out[id].push({ level, ...x });
  for (const u of D.units) {
    const c = agg([u], i), p = agg([u], Math.max(0, i - 1)), ly = i >= 12 ? agg([u], i - 12) : null;
    if (u.kind !== 'office') {
      if (c.vsPlan < -0.05) add('revPlan', c.vsPlan < -0.08 && p.vsPlan < -0.08 ? 'critical' : 'warning', { unit: u.id, value: c.vsPlan, prev: p.vsPlan, gap: c.rev - c.revPlan });
      if (ly && ly.gm - c.gm > 0.03) add('marginDrop', ly.gm - c.gm > 0.05 ? 'critical' : 'warning', { unit: u.id, value: c.gm, ref: ly.gm });
    }
    const t = turnover([u], i);
    if (t > 0.2) add('turnover', t > 0.3 ? 'critical' : 'warning', { unit: u.id, value: t, exits: ltm([u], i).vol });
    if (c.overtime > 0.1) add('overtime', c.overtime > 0.12 ? 'critical' : 'warning', { unit: u.id, value: c.overtime });
    if (c.vacancies > 0 && c.vacDays > 45) add('vacancies', c.vacDays > 60 ? 'critical' : 'warning', { unit: u.id, value: c.vacDays, n: c.vacancies });
    if (ind === 'mfg' && c.defect != null && c.defect > 2) add('quality', c.defect > 2.5 ? 'critical' : 'warning', { unit: u.id, value: c.defect, ref: ly ? ly.defect : null, metric: 'defect' });
    if (ind === 'svc' && c.nps != null && ly && (c.nps < 40 || ly.nps - c.nps > 10)) add('quality', c.nps < 40 ? 'critical' : 'warning', { unit: u.id, value: c.nps, ref: ly.nps, wait: c.wait, metric: 'nps' });
  }
  const co = D.company[i], co6 = D.company[Math.max(0, i - 6)];
  if (co.dso > 60 || co.dso - co6.dso > 10) add('dso', co.dso > 60 ? 'critical' : 'warning', { value: co.dso, ref: co6.dso });
  const over60 = co.aging[2] + co.aging[3];
  if (over60 > 0.15) add('overdue', over60 > 0.2 ? 'critical' : 'warning', { value: over60, amount: co.ar * over60 });
  const top3 = D.clients.filter(c => c[0] !== 'other').slice(0, 3).reduce((a, c) => a + c[1], 0);
  if (top3 > 0.4) add('concentration', top3 > 0.5 ? 'critical' : 'warning', { value: top3, top: D.clients[0][1] });
  const opex = D.company.slice(Math.max(0, i - 2), i + 1).reduce((a, c) => a + c.opex, 0) / 3;
  const months = co.cash / opex, co3 = D.company[Math.max(0, i - 3)];
  if (months < 1 || co.cash < co3.cash * 0.85) add('cash', months < 0.5 ? 'critical' : 'warning', { value: co.cash, ref: co3.cash, months });
  return out;
}
export const levelOf = list => (list.some(x => x.level === 'critical') ? 'critical' : list.length ? 'warning' : 'healthy');

// ——— короткий огляд місяця: факти для шаблонів тексту ———
export function brief(D, ind, i) {
  const all = D.units, cur = agg(all, i), y = ytd(all, i);
  const prod = D.units.filter(u => u.kind !== 'office').map(u => ({ id: u.id, ...agg([u], i) }));
  const worst = [...prod].sort((a, b) => (a.rev - a.revPlan) - (b.rev - b.revPlan))[0];
  const best = [...prod].sort((a, b) => b.vsPlan - a.vsPlan)[0];
  const items = [];
  items.push({ id: 'rev', tone: cur.vsPlan < -0.03 ? 'bad' : cur.vsPlan > 0.01 ? 'good' : 'info', rev: cur.rev, vs: cur.vsPlan, ytdVs: y.vsPlan, worst: worst.id, worstGap: worst.rev - worst.revPlan, worstVs: worst.vsPlan });
  const ly = i >= 12 ? agg(all, i - 12) : null;
  const gmDrop = prod.map(u => ({ id: u.id, d: (i >= 12 ? agg([D.units.find(x => x.id === u.id)], i - 12).gm : u.gm) - u.gm })).sort((a, b) => b.d - a.d)[0];
  items.push({ id: 'margin', tone: ly && cur.margin < ly.margin - 0.01 ? 'bad' : 'info', margin: cur.margin, ly: ly ? ly.margin : null, driver: gmDrop.d > 0.02 ? gmDrop.id : null, drop: gmDrop.d, ind });
  const hot = D.units.map(u => ({ id: u.id, t: turnover([u], i), ot: agg([u], i).overtime })).sort((a, b) => b.t - a.t)[0];
  items.push({ id: 'people', tone: hot.t > 0.2 ? 'bad' : 'info', unit: hot.id, turnover: hot.t, overtime: hot.ot, total: turnover(all, i) });
  const co = D.company[i], co6 = D.company[Math.max(0, i - 6)];
  items.push({ id: 'cash', tone: co.dso - co6.dso > 5 ? 'bad' : 'info', dso: co.dso, dso6: co6.dso, cash: co.cash, overdue: co.aging[2] + co.aging[3] });
  items.push({ id: 'best', tone: 'good', unit: best.id, vs: best.vsPlan });
  return items;
}

// ——— сценарії «що буде, якщо» на 12 місяців уперед від останніх 12 місяців ———
export const DRIVERS = ['price', 'volume', 'cost', 'wage', 'heads', 'other', 'dso'];
export const DRIVER_RANGE = {
  price: [-10, 15, 1], volume: [-20, 20, 1], cost: [-10, 20, 1], wage: [0, 25, 1], heads: [-30, 30, 1], other: [-15, 30, 1], dso: [-20, 20, 1],
};
export function scenario(D, i, drv) {
  const units = D.units;
  const b = ltm(units, i);
  const hcNow = agg(units, i).hc;
  const avgPay = b.payroll / b.hcAvg;                      // річний ФОП на людину
  const v = (drv.volume || 0) / 100, p = (drv.price || 0) / 100, c = (drv.cost || 0) / 100, w = (drv.wage || 0) / 100, o = (drv.other || 0) / 100;
  const heads = drv.heads || 0;
  const varPay = 0.25;                                      // частка ФОП, що змінюється з обсягом
  const steps = [];
  const rev1 = b.rev * (1 + v), rev2 = rev1 * (1 + p);
  const cogs1 = b.cogs * (1 + v), cogs2 = cogs1 * (1 + c);
  const pay1 = b.payroll * (1 + varPay * v), pay2 = pay1 * (1 + w), pay3 = pay2 + heads * avgPay * (1 + w);
  const oth = b.other * (1 + o);
  steps.push({ id: 'base', value: b.ebitda, total: true });
  steps.push({ id: 'volume', value: (rev1 - b.rev) - (cogs1 - b.cogs) - (pay1 - b.payroll) });
  steps.push({ id: 'price', value: rev2 - rev1 });
  steps.push({ id: 'cost', value: -(cogs2 - cogs1) });
  steps.push({ id: 'wage', value: -(pay2 - pay1) });
  steps.push({ id: 'heads', value: -(pay3 - pay2) });
  steps.push({ id: 'other', value: -(oth - b.other) });
  const ebitda = rev2 - cogs2 - pay3 - oth;
  steps.push({ id: 'scenario', value: ebitda, total: true });
  const cashDso = -(rev2 / 365) * (drv.dso || 0);
  const hc1 = hcNow + heads;
  return {
    base: { rev: b.rev, ebitda: b.ebitda, margin: div(b.ebitda, b.rev), rpe: div(b.rev, hcNow), hc: hcNow },
    scen: { rev: rev2, ebitda, margin: div(ebitda, rev2), rpe: div(rev2, hc1), hc: hc1 },
    steps, cashDso,
    breakEvenPrice: b.rev ? -ebitda / rev2 : 0,
  };
}

export const PRESETS = {
  mfg: [
    { id: 'raw', drv: { cost: 8 } },
    { id: 'wage10', drv: { wage: 10 } },
    { id: 'priceUp', drv: { price: 5, volume: -3 } },
    { id: 'southFix', drv: { volume: 6, cost: -3, dso: -12 } },
  ],
  svc: [
    { id: 'wage10', drv: { wage: 10 } },
    { id: 'rent', drv: { other: 15 } },
    { id: 'eastFix', drv: { volume: 4, heads: 4 } },
    { id: 'onlineShift', drv: { volume: 8, heads: -6, other: -5 } },
  ],
};
