// «Пояснити зміну»: детермінований аналітик. Він не генерує текст і не вигадує причин:
// бере розраховані фактори дерева причин, перевіряє, скільки місяців поспіль кожен тримається,
// називає джерела даних і пропонує два сценарії для перевірки з розрахованим ефектом.
import { causeTree, factorGroups, streak } from './causes.js';
import { yearStart } from './model.js';
import { simulate, compare, scopeUnits, presetActions } from './sim.js';

const sum = a => a.reduce((s, v) => s + v, 0);
// джерела даних за типом фактора
export const SOURCES = {
  price: ['erp', 'crm'], volume: ['erp', 'crm', 'mes'], input: ['erp', 'purchase'], scrap: ['mes', 'erp'], purchase: ['erp', 'purchase'],
  overtime: ['hr', 'timesheet'], heads: ['hr'], other: ['erp'],
};
// сценарії для перевірки за типом головного фактора
// перший сценарій відповідає головному фактору, другий завжди порівнює з підвищенням цін на 3%
function suggestions(ind, scope, top) {
  const revUnits = scopeUnits(ind, scope, 'price');
  const team = ind === 'mfg' ? 'southTeam' : 'eastTeam';
  const teamOk = scope === 'all' || scope === (ind === 'mfg' ? 'south' : 'east');
  let first = null;
  for (const g of top) {
    if (g.factor === 'input' || g.factor === 'purchase' || g.factor === 'scrap') { first = { id: 'procure5', actions: [{ lever: 'cost', value: -5, units: revUnits }] }; break; }
    if ((g.factor === 'volume' || g.factor === 'overtime') && teamOk) { first = { id: team, actions: presetActions(ind, [team]) }; break; }
    if (g.factor === 'other') { first = { id: 'opex8', actions: [{ lever: 'opex', value: -8, units: scopeUnits(ind, scope, 'opex') }] }; break; }
  }
  const price = { id: 'price3', actions: [{ lever: 'price', value: 3, units: revUnits }] };
  return revUnits.length ? (first ? [first, price] : [price]) : first ? [first] : [];
}

export function explain(ind, unit, i, per = 'm') {
  const a = per === 'ytd' ? yearStart(i) : i;
  const tree = causeTree(ind, a, i);
  const node = unit !== 'all' && tree.index.has(unit) ? tree.index.get(unit) : tree.root;
  const groups = factorGroups(tree).filter(g => unit === 'all' || g.unit === unit);
  const neg = groups.filter(g => g.value < 0), pos = groups.filter(g => g.value > 0).sort((x, y) => y.value - x.value);
  const negTotal = sum(neg.map(g => g.value)) || -1;
  const top = neg.slice(0, 4).map(g => ({ ...g, share: g.value / negTotal, ...streak(ind, g.unit, g.factor, i), sources: SOURCES[g.factor] || ['erp'] }));
  const top3 = sum(top.slice(0, 3).map(g => g.value)) / negTotal;
  const base = simulate(ind, i, []);
  const sug = suggestions(ind, unit, top).map(s => ({ ...s, effect: compare(simulate(ind, i, s.actions), base) }));
  return {
    per, from: a, to: i, unit, gap: node.value, plan: node.plan, fact: node.fact, pct: node.plan ? node.value / Math.abs(node.plan) : 0,
    top, offsets: pos.slice(0, 2), top3, sug, nodePath: top[0] ? [top[0].unit] : [],
  };
}
