// Гроші: дебіторка за клієнтами, рух грошей (діаграма Санкі) і прогноз залишку з умовами оплати.
// Дебіторка клієнтів узгоджена з даними компанії: Σ частка × DSO клієнта = DSO компанії в кожному місяці.
import { INDUSTRIES } from './data.js';
import { dataFor } from './model.js';
import { simulate } from './sim.js';
import { baseline } from './outlook.js';

const sum = a => a.reduce((s, v) => s + v, 0);
// базовий DSO клієнтів і хто «забирає» приріст DSO компанії (сюжет: ключовий клієнт платить дедалі пізніше)
const CL = {
  mfg: { base: { a: 46, b: 40, c: 48, d: 44, e: 52, other: 46 }, lead: ['a'], leadPart: 0.72, overduePart: 0.7, groups: [['a', ['a']], ['b', ['b']], ['c', ['c']], ['rest', ['d', 'e', 'other']]] },
  svc: { base: { corp1: 60, corp2: 55, corp3: 50, other: 10.6 }, lead: ['corp1', 'corp2', 'corp3'], leadPart: 0.8, overduePart: 0.7, groups: [['corp', ['corp1', 'corp2', 'corp3']], ['retail', ['other']]] },
};
export const clientGroups = ind => CL[ind].groups;
export const leadShare = ind => sum(dataFor(ind).clients.filter(c => CL[ind].lead.includes(c[0])).map(c => c[1]));

// DSO і дебіторка кожного клієнта в місяці t
export function clientAR(ind, t) {
  const D = dataFor(ind), cfg = CL[ind], co = D.company[t];
  const shares = Object.fromEntries(D.clients);
  const base = sum(D.clients.map(([id, s]) => s * cfg.base[id]));
  const excess = co.dso - base;
  const leadS = sum(cfg.lead.map(id => shares[id]));
  const daily = co.ar / co.dso;                                     // середньоденна виручка, з якої рахується DSO
  const over = co.ar * (co.aging[2] + co.aging[3]);
  const rows = D.clients.map(([id, s]) => {
    const lead = cfg.lead.includes(id);
    const dso = Math.max(5, cfg.base[id] + excess * (lead ? cfg.leadPart / leadS : (1 - cfg.leadPart) / (1 - leadS)));
    return { id, share: s, dso, ar: daily * s * dso };
  });
  // підгонка до точної суми (через нижню межу DSO)
  const k = co.ar / sum(rows.map(r => r.ar));
  rows.forEach(r => { r.ar *= k; r.dso *= k; });
  const leadAr = sum(rows.filter(r => cfg.lead.includes(r.id)).map(r => r.ar)), restAr = co.ar - leadAr;
  rows.forEach(r => { r.overdue = cfg.lead.includes(r.id) ? (over * cfg.overduePart * r.ar) / (leadAr || 1) : (over * (1 - cfg.overduePart) * r.ar) / (restAr || 1); });
  return rows;
}

// Санкі за період [a..b]: клієнти → отримано / осіло в дебіторці → гроші компанії → на що пішли
export function cashFlows(ind, a, b) {
  const D = dataFor(ind), I = INDUSTRIES[ind], cfg = CL[ind];
  const rows = [];
  for (let t = a; t <= b; t++) {
    const rev = sum(D.units.map(u => u.rows[t].rev)), cogs = sum(D.units.map(u => u.rows[t].cogs));
    const pay = sum(D.units.map(u => u.rows[t].payroll)), oth = sum(D.units.map(u => u.rows[t].other));
    rows.push({ rev, cogs, pay, oth, ebitda: rev - cogs - pay - oth, div: t % 12 % 3 === 2 ? I.dividend : 0 });
  }
  const S = k => sum(rows.map(r => r[k]));
  const rev = S('rev'), cogs = S('cogs'), pay = S('pay'), oth = S('oth');
  const tax = sum(rows.map(r => 0.15 * Math.max(0, r.ebitda))), debt = I.debtService * rows.length, div = S('div');
  const cashPrev = a ? D.company[a - 1].cash : I.cash0, cashEnd = D.company[b].cash;
  const arStart = a ? clientAR(ind, a - 1) : clientAR(ind, 0), arEnd = clientAR(ind, b);
  const dAr = D.company[b].ar - (a ? D.company[a - 1].ar : D.company[0].ar);
  // інвестиції: залишок тотожності руху грошей (у даних вони з невеликим шумом)
  const capex = rev - dAr - cogs - pay - oth - tax - debt - div - (cashEnd - cashPrev);
  const groups = cfg.groups.map(([gid, ids]) => {
    const share = sum(D.clients.filter(c => ids.includes(c[0])).map(c => c[1]));
    const d = sum(arEnd.filter(r => ids.includes(r.id)).map(r => r.ar)) - sum(arStart.filter(r => ids.includes(r.id)).map(r => r.ar));
    return { id: gid, rev: rev * share, dAr: d };
  });
  const stuck = sum(groups.map(g => Math.max(0, g.dAr)));
  const released = sum(groups.map(g => Math.max(0, -g.dAr)));
  const collected = rev - stuck + released;
  const nodes = [], links = [];
  const add = (id, col, kind) => { nodes.push({ id, col, kind }); return nodes.length - 1; };
  const nCollected = add('collected', 1, 'in');
  const nStuck = stuck > 0 ? add('stuck', 1, 'stuck') : null;
  const nPool = add('pool', 2, 'pool');
  groups.forEach(g => {
    const n = add('client:' + g.id, 0, 'client');
    const st = Math.max(0, g.dAr), rel = Math.max(0, -g.dAr);
    links.push({ source: n, target: nCollected, value: g.rev - st + rel, kind: 'in' });
    if (st > 0) links.push({ source: n, target: nStuck, value: st, kind: 'stuck' });
  });
  links.push({ source: nCollected, target: nPool, value: collected, kind: 'in' });
  const dCash = cashEnd - cashPrev;
  if (dCash < 0) { const n = add('drawdown', 1, 'drawdown'); links.push({ source: n, target: nPool, value: -dCash, kind: 'drawdown' }); }
  const uses = [['materials', cogs], ['payroll', pay], ['other', oth], ['tax', tax], ['capex', capex], ['debt', debt], ['dividend', div]];
  if (dCash > 0) uses.push(['saved', dCash]);
  uses.filter(([, v]) => v > 0.5).forEach(([id, v]) => { const n = add('use:' + id, 3, id === 'saved' ? 'saved' : 'out'); links.push({ source: nPool, target: n, value: v, kind: 'out' }); });
  return { nodes, links, rev, collected, stuck, released, dCash, cashPrev, cashEnd, capex, uses: Object.fromEntries(uses), groups };
}

// Прогноз грошей: база і сценарій з умовами оплати (днями): ключовий клієнт, інші клієнти, постачальники
export function cashOutlook(ind, i, terms = {}) {
  const sL = leadShare(ind);
  const actions = [];
  if (terms.lead) actions.push({ lever: 'dso', value: terms.lead, share: sL });
  if (terms.rest) actions.push({ lever: 'dso', value: terms.rest, share: 1 - sL });
  if (terms.dpo) actions.push({ lever: 'dpo', value: terms.dpo });
  const B = baseline(ind, i);
  const base = simulate(ind, i, []), scen = simulate(ind, i, actions);
  return { B, base, scen, actions, changed: actions.length > 0 };
}
