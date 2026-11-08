// Симулятор рішень: 12 місяців уперед від базового прогнозу (outlook.js) з урахуванням часових лагів,
// еластичності попиту, обмеження потужностей і взаємозалежності факторів (скорочення людей → понаднормові →
// плинність → обсяг). Модель ілюстративна: коефіцієнти задані явно й описані на сторінці методики.
import { INDUSTRIES, cal, year } from './data.js';
import { dataFor } from './model.js';
import { baseline, H, WF } from './outlook.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = a => a.reduce((s, v) => s + v, 0);

// важелі, доступні повзунками: % або дні
export const LEVERS = ['price', 'cost', 'opex', 'heads', 'wage', 'prod', 'dso', 'dpo'];
export const LEVER_RANGE = { price: [-10, 15, 1], cost: [-15, 10, 1], opex: [-20, 20, 1], heads: [-20, 20, 1], wage: [0, 20, 1], prod: [0, 20, 1], dso: [-30, 45, 1], dpo: [0, 45, 1] };
// [лаг, наростання] у місяцях: коли рішення починає діяти і за скільки виходить на повну силу
export const TIMING = { price: [1, 1], volume: [1, 2], cost: [2, 1], opex: [1, 2], heads: [1, 1], wage: [0, 1], prod: [2, 4], dso: [0, 2], dpo: [0, 2] };
// для підписів: місяць першого ефекту і місяць повного ефекту (з урахуванням того, як люди впливають на обсяг)
export const FIRST = { price: 2, volume: 2, cost: 3, opex: 2, heads: 2, wage: 1, prod: 3, dso: 1, dpo: 1 };
export const FULL = { price: 2, volume: 3, cost: 3, opex: 3, heads: 6, wage: 5, prod: 6, dso: 2, dpo: 2 };
export const K = {
  elast: { mfg: -0.8, svc: -0.6 },  // еластичність попиту за ціною
  varPay: 0.25,                     // частка ФОП, що змінюється з обсягом
  costDiminish: 6,                  // економія на закупівлі понад 6% дається вдвічі важче
  cutOvertime: 0.5,                 // скорочення на 10% додає 5 в. п. понаднормових тим, хто лишився
  overtimeTurnover: 1.2,            // +1 в. п. понаднормових → +1,2 в. п. плинності (з лагом 2 міс.)
  overtimeRelief: 0.6,              // −1 в. п. понаднормових → −0,6 в. п. плинності (знімати втому повільніше, ніж накопичувати)
  wageTurnover: 0.6,                // +10% зарплати → −6 в. п. плинності (лаг 2, наростання 3 міс.)
  attrition: 0.25,                  // +10 в. п. плинності → −2,5% обсягу (лаг 3 міс.)
  peopleGap: 0.7,                   // частка відставання від плану, яку пояснюють люди (де плинність вища за норму)
  severance: 2, hireCost: 1,        // вихідна допомога і витрати на найм, у місячних зарплатах
  prodCost: 2.5,                    // програма продуктивності: 2,5 × q × місячний ФОП
  dsoVolume: [0.0008, 0.0004],      // виробництво: +10 днів відстрочки → +0,8% обсягу; −10 днів → −0,4%
  dpoFee: 0.0003,                   // постачальники беруть ~0,03% ціни за кожен день відстрочки
  capacity: 1.08,                   // потужність заводу чи філії: найкращий місяць за рік (без сезонності) + 8%
};
const phi = (k, lever) => { const [lag, ramp] = TIMING[lever]; return clamp((k - lag) / ramp, 0, 1); };
const shareOf = (a, uid) => (a.share == null ? 1 : typeof a.share === 'number' ? a.share : a.share[uid] || 0);
const inWindow = (a, k) => !a.months || (k >= a.months[0] && k <= a.months[1]);

// Підрозділи, на які діє важіль у межах сфери (уся компанія або один підрозділ)
export function scopeUnits(ind, scope, lever) {
  const D = dataFor(ind);
  const us = D.units.filter(u => scope === 'all' || u.id === scope);
  if (['price', 'cost', 'volume', 'prod'].includes(lever)) return us.filter(u => u.kind !== 'office').map(u => u.id);
  return us.map(u => u.id);
}
// Повзунки → дії
export function sliderActions(ind, scope, drv) {
  return LEVERS.filter(k => drv[k]).map(k => ({ lever: k, value: drv[k], units: ['dso', 'dpo'].includes(k) ? undefined : scopeUnits(ind, scope, k), slider: true }));
}

function capRev(D, I, u, i, t) {
  const rows = u.rows.slice(Math.max(0, i - 11), i + 1);
  const best = Math.max(...rows.map((r, k) => r.rev / I.season[cal(Math.max(0, i - 11) + k)]));
  return best * K.capacity * I.season[cal(t)];
}

// Головний розрахунок
export function simulate(ind, i, actions = []) {
  const D = dataFor(ind), I = INDUSTRIES[ind], B = baseline(ind, i);
  const acts = actions.filter(a => a && a.value);
  const has = l => acts.some(a => a.lever === l);
  const units = B.units.map(bu => {
    const u = D.units.find(x => x.id === bu.id);
    const mine = acts.filter(a => !a.units || a.units.includes(bu.id));
    const def = bu.def;
    const excess = Math.max(0, bu.turn - def.turnover);
    const perHead = bu.hc ? bu.pay0 / bu.hc / (1 + bu.ot / 2) : 0;          // місячна зарплата без понаднормових
    const vacRate = bu.hc ? bu.vacancies / bu.hc : 0;
    const out = [];
    let oneOffTotal = 0;
    for (let k = 1; k <= H; k++) {
      const bm = bu.months[k - 1], t = bm.t;
      let priceM = 1, volM = 1, costM = 1, opexM = 1, hcM = 1, wageM = 1, dOt = 0, wageUp = 0, oneOff = 0, hireShare = 0, prodShare = 0, dpoDays = 0, churn = 0;
      for (const a of mine) {
        const s = shareOf(a, bu.id), v = a.value / 100;
        if (a.lever === 'price' && bu.revenue) {
          const f = phi(k, 'price') * s;
          priceM *= 1 + v * f;
          volM *= 1 + (a.elast ?? K.elast[ind]) * v * f;
        }
        if (a.lever === 'volume' && bu.revenue && inWindow(a, k)) volM *= 1 + v * s * phi(k, 'volume');
        if (a.lever === 'cost' && bu.revenue) {
          const eff = a.value < -K.costDiminish ? -K.costDiminish + (a.value + K.costDiminish) * 0.5 : a.value;
          costM *= 1 + (eff / 100) * s * phi(k, 'cost');
        }
        if (a.lever === 'opex') opexM *= 1 + v * phi(k, 'opex');
        if (a.lever === 'heads') {
          const f = phi(k, 'heads');
          hcM *= 1 + v * f;
          if (v < 0) dOt += -v * K.cutOvertime * f;
          else { dOt -= Math.min(Math.max(0, bu.ot - 0.02), v * 0.5) * f; hireShare = Math.max(hireShare, clamp(v / Math.max(0.03, vacRate), 0, 1) * f); }
          if (k === 1) oneOff += Math.abs(v) * bu.hc * perHead * (v < 0 ? K.severance : (a.hireCost ?? K.hireCost));
          if (a.churn && k >= 2) churn += a.churn;
        }
        if (a.lever === 'wage') { wageM *= 1 + v * phi(k, 'wage'); wageUp += v; }
        if (a.lever === 'prod' && bu.kind !== 'office') {
          const f = phi(k, 'prod');
          dOt -= Math.min(Math.max(0, bu.ot - 0.02), v * 0.4) * f;
          prodShare = Math.max(prodShare, clamp(v / 0.1, 0, 1) * f);
          if (k <= 3) oneOff += (v * K.prodCost * bu.pay0) / 3;
        }
      }
      // гроші й обсяг від умов оплати діють на всю компанію (частку клієнтів)
      for (const a of acts) {
        if (a.lever === 'dso' && ind === 'mfg' && bu.revenue) volM *= 1 + K.dsoVolume[a.value > 0 ? 0 : 1] * a.value * (a.share ?? 1) * phi(k, 'dso');
        if (a.lever === 'dpo') dpoDays += a.value * phi(k, 'dpo');
      }
      // люди: понаднормові, плинність і їхній вплив на обсяг
      const ot = clamp(bu.ot + dOt, Math.min(bu.ot, 0.02), 0.3);
      const otLag = k > 2 ? out[k - 3].dOt : 0;
      const turnUp = K.overtimeTurnover * Math.max(0, otLag) + churn;
      const turnDown = K.wageTurnover * wageUp * clamp((k - 2) / 3, 0, 1) + K.overtimeRelief * Math.max(0, -otLag);
      const turn = Math.max(0.04, bu.turn + turnUp - turnDown);
      let peopleVol = 0;
      if (bu.revenue && bu.kind !== 'office') {
        const gap = Math.max(0, 1 - bm.rev / bm.plan.rev);
        if (excess > 0.03 && gap > 0) {
          const r1 = clamp(Math.max(0, bu.turn - turn) / excess, 0, 1);
          const rec = clamp(0.6 * r1 + 0.4 * hireShare + 0.4 * prodShare, 0, 1) * clamp((k - 2) / 4, 0, 1);
          peopleVol += (K.peopleGap * gap * rec * bm.plan.rev) / bm.rev;
        }
        const turnUpLag = k > 3 ? out[k - 4].turn - bu.turn : 0;
        peopleVol -= K.attrition * Math.max(0, turnUpLag);
      }
      volM *= 1 + peopleVol;
      // обмеження потужності: обсяг у планових цінах не більший за найкращий місяць + 8%
      if (bu.revenue && volM > 1 && bu.kind !== 'online') volM = Math.min(volM, Math.max(1, capRev(D, I, u, i, t) / bm.rev));
      const rev = bm.rev * priceM * volM;
      const cogs = bm.rev * volM * bu.cr * costM * (1 + K.dpoFee * dpoDays);
      const pay = bm.pay * hcM * wageM * ((1 + ot / 2) / (1 + bu.ot / 2)) * (1 + K.varPay * (volM - 1));
      const oth = bm.oth * opexM;
      oneOffTotal += oneOff;
      out.push({ k, t, rev, revPlanPrice: bm.rev * volM, cogs, pay, oth, oneOff, ebitda: rev - cogs - pay - oth - oneOff, hc: bu.hc * hcM, ot, dOt, turn, vacDays: bu.vacDays * (1 - hireShare), vacancies: Math.round(bu.vacancies * (1 - hireShare)), sick: bu.sick, dpoDays });
    }
    return { id: bu.id, kind: bu.kind, def, months: out, oneOff: oneOffTotal };
  });

  // компанія: дебіторка, кредиторка, гроші
  const co = D.company[i];
  const revAct = t => sum(D.units.map(u => u.rows[t].rev));
  const revAt = k => (k <= 0 ? revAct(i + k) : sum(units.map(u => u.months[k - 1].rev)));
  let cash = co.cash, arPrev = co.ar, apPrev = 0;
  const months = [];
  for (let k = 1; k <= H; k++) {
    const t = i + k;
    let dDso = 0;
    for (const a of acts) if (a.lever === 'dso') dDso += a.value * (a.share ?? 1) * phi(k, 'dso');
    const rev = revAt(k);
    const cogs = sum(units.map(u => u.months[k - 1].cogs));
    const ebitda = sum(units.map(u => u.months[k - 1].ebitda));
    const daily = (revAt(k) + revAt(k - 1) + revAt(k - 2)) / 3 / 30.4;
    const ar = daily * Math.max(0, B.months[k - 1].dso + dDso);
    const ap = (cogs / 30.4) * units[0].months[k - 1].dpoDays;
    const tax = 0.15 * Math.max(0, ebitda), div = cal(t) % 3 === 2 ? I.dividend : 0;
    cash += ebitda - (ar - arPrev) + (ap - apPrev) - tax - I.capex - I.debtService - div;
    arPrev = ar; apPrev = ap;
    const hc = sum(units.map(u => u.months[k - 1].hc));
    const wf = sum(units.map(u => wfOf(u.months[k - 1]) * u.months[k - 1].hc)) / (hc || 1);
    const ot = sum(units.map(u => u.months[k - 1].ot * u.months[k - 1].hc)) / (hc || 1);
    const turn = sum(units.map(u => u.months[k - 1].turn * u.months[k - 1].hc)) / (hc || 1);
    months.push({ k, t, rev, ebitda, ar, ap, cash, hc, wf, ot, turn, dso: B.months[k - 1].dso + dDso, oneOff: sum(units.map(u => u.months[k - 1].oneOff)) });
  }
  const below = months.filter(m => m.cash < B.threshold);
  const minM = months.reduce((a, b) => (b.cash < a.cash ? b : a));
  const active = [...new Set(acts.map(a => a.lever))];
  const rev12 = sum(months.map(m => m.rev)), ebitda12 = sum(months.map(m => m.ebitda));
  return {
    units, months, threshold: B.threshold,
    rev12, ebitda12, margin12: rev12 ? ebitda12 / rev12 : 0,
    vol12: sum(units.flatMap(u => u.months.map(m => m.revPlanPrice))),
    minCash: minM.cash, minCashT: minM.t, firstBelow: below.length ? below[0].t : null, monthsBelow: below.length, endCash: months[H - 1].cash,
    wfEnd: months[H - 1].wf, wf6: months[5].wf, hcEnd: months[H - 1].hc, oneOff: sum(months.map(m => m.oneOff)),
    full: active.length ? Math.max(...active.map(l => FULL[l])) : 0,
    first: active.length ? Math.min(...active.map(l => FIRST[l])) : 0,
    active, has,
  };
}
function wfOf(m) {
  const p = (x, [g, b]) => clamp((x - g) / (b - g), 0, 1);
  return 100 * (p(m.turn, WF.turnover) * WF.turnover[2] + p(m.ot, WF.overtime) * WF.overtime[2] + (m.vacancies > 0 ? p(m.vacDays, WF.vacancy) : 0) * WF.vacancy[2] + p(m.sick, WF.sick) * WF.sick[2]);
}

// Внесок кожного важеля в EBITDA за 12 міс.: послідовно, у фіксованому порядку (сума кроків = різниця сценаріїв)
export const ORDER = ['price', 'volume', 'cost', 'opex', 'heads', 'wage', 'prod', 'dso', 'dpo'];
export function attribute(ind, i, actions) {
  const base = simulate(ind, i, []);
  const steps = [{ id: 'base', value: base.ebitda12, total: true }];
  let prev = base;
  for (const l of ORDER) {
    if (!actions.some(a => a.lever === l && a.value)) continue;
    const cum = simulate(ind, i, actions.filter(a => ORDER.indexOf(a.lever) <= ORDER.indexOf(l)));
    steps.push({ id: l, value: cum.ebitda12 - prev.ebitda12 });
    prev = cum;
  }
  steps.push({ id: 'scenario', value: prev.ebitda12, total: true });
  return { steps, base, scen: prev };
}

// Ризик виконання 0..100: невизначеність і складність рішень плюс зростання кадрового ризику
const RISK = { price: [2.5, 1], cost: [2, 3], opex: [1.5, 1.5], heads: [1, 3], wage: [0.8, 0], prod: [2.5, 0], dso: [0.3, 1], dpo: [0.8, 0], volume: [1.5, 1] };
export function execRisk(actions, res, base) {
  let r = 0;
  for (const a of actions) {
    if (!a.value) continue;
    const [up, down] = RISK[a.lever] || [1, 1];
    const s = a.share == null ? 1 : typeof a.share === 'number' ? a.share : Math.max(...Object.values(a.share));
    r += a.risk != null ? a.risk : Math.abs(a.value) * (a.value > 0 ? up : down) * Math.max(0.35, s);
  }
  r += Math.max(0, res.wfEnd - base.wfEnd);
  return clamp(r, 0, 100);
}
export const riskLevel = r => (r < 30 ? 'healthy' : r < 60 ? 'warning' : 'critical');

// ——— готові рішення ———
const contractShare = { north: 0.2, south: 0.32 };
export const PRESETS = {
  mfg: [
    { id: 'procure', actions: [{ lever: 'cost', value: -5, units: ['north', 'south', 'pack'] }] },
    { id: 'contract', actions: [{ lever: 'price', value: 6, units: ['north', 'south'], share: contractShare, elast: -0.3, risk: 18 }] },
    { id: 'price3', actions: [{ lever: 'price', value: 3, units: ['north', 'south', 'pack'] }] },
    { id: 'southTeam', actions: [{ lever: 'wage', value: 8, units: ['south'] }, { lever: 'heads', value: 6, units: ['south'] }] },
    { id: 'collectA', actions: [{ lever: 'dso', value: -40, share: 0.24, risk: 15 }] },
    { id: 'cut10', actions: [{ lever: 'heads', value: -10, units: ['north', 'south', 'pack', 'office'] }] },
  ],
  svc: [
    { id: 'eastTeam', actions: [{ lever: 'wage', value: 8, units: ['east'] }, { lever: 'heads', value: 6, units: ['east'] }] },
    { id: 'price3', actions: [{ lever: 'price', value: 3, units: ['center', 'left', 'west', 'east', 'online'] }] },
    { id: 'opex8', actions: [{ lever: 'opex', value: -8 }] },
    { id: 'online', actions: [{ lever: 'volume', value: 15, units: ['online'], risk: 14 }, { lever: 'opex', value: 6, units: ['online'] }] },
    { id: 'corpTerms', actions: [{ lever: 'dso', value: -20, share: 0.12, risk: 8 }] },
    { id: 'cut10', actions: [{ lever: 'heads', value: -10, units: ['center', 'left', 'west', 'east', 'online', 'office'] }] },
  ],
};
export const presetActions = (ind, ids) => ids.flatMap(id => (PRESETS[ind].find(p => p.id === id) || { actions: [] }).actions);

// ——— «Спробуйте себе в ролі CEO»: три проблеми виробничої компанії ———
const PLANTS = ['north', 'south', 'pack'];
export const CEO = [
  {
    id: 'margin', options: [
      { id: 'priceAll', actions: [{ lever: 'price', value: 5, units: PLANTS, share: { north: 0.8, south: 0.68, pack: 1 }, elast: -1.1, risk: 22 }] },
      { id: 'contract', actions: [{ lever: 'price', value: 6, units: ['north', 'south'], share: contractShare, elast: -0.3, risk: 18 }, { lever: 'cost', value: -4, units: ['north', 'south'] }] },
      { id: 'cut', actions: [{ lever: 'heads', value: -10, units: PLANTS }] },
      { id: 'wait', actions: [] },
    ],
  },
  {
    id: 'receivables', options: [
      { id: 'stop', actions: [{ lever: 'dso', value: -45, share: 0.24, risk: 20 }, { lever: 'volume', value: -30, units: ['north', 'south'], share: contractShare, months: [1, 3], risk: 0 }, { lever: 'volume', value: -10, units: ['north', 'south'], share: contractShare, months: [4, 12], risk: 0 }] },
      { id: 'discount', actions: [{ lever: 'dso', value: -20, risk: 6 }, { lever: 'price', value: -1.2, units: PLANTS, elast: 0, risk: 0 }] },
      { id: 'factoring', actions: [{ lever: 'dso', value: -60, share: 0.24, risk: 5 }, { lever: 'price', value: -2.5, units: ['north', 'south'], share: contractShare, elast: 0, risk: 0 }] },
      { id: 'wait', actions: [] },
    ],
  },
  {
    id: 'turnover', options: [
      { id: 'wageAll', actions: [{ lever: 'wage', value: 10 }] },
      { id: 'targeted', actions: [{ lever: 'wage', value: 8, units: ['south'] }, { lever: 'heads', value: 6, units: ['south'] }] },
      { id: 'agency', actions: [{ lever: 'heads', value: 14, units: ['south'], hireCost: 2, churn: 0.04 }] },
      { id: 'wait', actions: [] },
    ],
  },
];
export const ceoActions = choices => CEO.flatMap((p, k) => (p.options.find(o => o.id === choices[k]) || { actions: [] }).actions);

// Підсумок рішення проти бази: різниці, які показує інтерфейс
export function compare(res, base) {
  return {
    ebitda: res.ebitda12 - base.ebitda12, rev: res.rev12 - base.rev12, vol: res.vol12 / base.vol12 - 1,
    minCash: res.minCash - base.minCash, endCash: res.endCash - base.endCash, wf: res.wfEnd - base.wfEnd,
    monthsBelow: res.monthsBelow - base.monthsBelow, margin: res.margin12 - base.margin12,
  };
}
// Збалансована оцінка рішення: чотири виміри від −1 до 1 з вагами (EBITDA, гроші, люди, клієнти).
// Масштаб: зміна, яку керівник вважає суттєвою за рік (для виробничої компанії з кейсу).
export const SCORE = { ebitda: [35, 20000], cash: [25, 30000], people: [25, 15], clients: [15, 0.03] };
export function scorecard(c) {
  const d = { ebitda: c.ebitda / SCORE.ebitda[1], cash: c.minCash / SCORE.cash[1], people: -c.wf / SCORE.people[1], clients: c.vol / SCORE.clients[1] };
  const parts = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, clamp(v, -1, 1)]));
  return { parts, total: Object.entries(parts).reduce((s, [k, v]) => s + v * SCORE[k][0], 0) };
}
export function ceoBest(i) {
  const base = simulate('mfg', i, []);
  let best = null;
  const [A, Bp, Cp] = CEO.map(p => p.options.map(o => o.id));
  for (const a of A) for (const b of Bp) for (const c of Cp) {
    const r = simulate('mfg', i, ceoActions([a, b, c]));
    const sc = scorecard(compare(r, base));
    if (!best || sc.total > best.score) best = { choices: [a, b, c], score: sc.total, sc, res: r };
  }
  return best;
}
