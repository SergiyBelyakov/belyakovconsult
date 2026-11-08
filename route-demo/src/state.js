// Стан демо і повний розрахунок: оптимізований план, ручний план і навантаження доріг.
import { NODE, FLEET0, PARAMS0, DEPOTS0, dayOrders } from './world.js';
import { makeProblem, solve, manualPlan, flows, warmOf } from './solver.js';

export const DEF = { depots: DEPOTS0.map(id => NODE.get(id).i), fleet: { ...FLEET0 }, fuel: PARAMS0.fuel, shift: PARAMS0.shift, closed: [], day: 1, edits: {}, winter: false, flood: false, peak: false };

export function ordersOf(s) {
  const o = { ...dayOrders(s.day) };
  Object.entries(s.edits || {}).forEach(([k, v]) => { if (v > 0) o[k] = v; else delete o[k]; });
  if (s.peak) Object.keys(o).forEach(k => { o[k] = Math.ceil(o[k] * 1.3); });
  return o;
}
export const condOf = s => ({ closed: new Set(s.closed), flood: !!s.flood, winter: !!s.winter });

// повний розрахунок стану: оптимізований план, ручний план і навантаження доріг
let SEQ = 0;
export function compute(s, prev = null, mode = 'full', M = null) {
  const pb = makeProblem({ depots: s.depots, orders: ordersOf(s), cond: condOf(s), fleet: s.fleet, params: { fuel: s.fuel, shift: s.shift }, M });
  const sol = solve(pb, mode === 'fast' ? { starts: [1], warm: prev ? warmOf(prev) : null, iter: 14 } : mode === 'lite' ? { starts: [1], iter: 16 } : { warm: prev ? warmOf(prev) : null });
  sol.flows = flows(sol); sol.id = ++SEQ;
  const man = mode === 'full' ? manualPlan(pb) : null;
  if (man) { man.flows = flows(man); man.id = ++SEQ; }
  return { pb, sol, man };
}

