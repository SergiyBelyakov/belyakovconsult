// Увага керівника, раннє попередження і теплова карта ризиків.
// Усе детерміновано: фінансовий вплив рахується за формулами, впевненість залежить від того, скільки місяців
// поспіль тримається відхилення і наскільки воно більше за звичайні коливання.
import { INDUSTRIES, MONTHS } from './data.js';
import { dataFor, agg, ltm, turnover, signals, SIGNALS, levelOf } from './model.js';
import { causeTree, factorGroups, streak } from './causes.js';
import { baseline, wfUnit, wfIndex, LEVELS, probBelow, monthKey } from './outlook.js';
import { fitEts, forecast as ets } from '../../chart-gallery/src/forecast.js';
import { simulate, compare, PRESETS, presetActions } from './sim.js';

const sum = a => a.reduce((s, v) => s + v, 0);
const mean = a => (a.length ? sum(a) / a.length : 0);
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const memo = new Map();
const cached = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };
export const confLevel = n => (n >= 3 ? 'high' : n === 2 ? 'medium' : 'low');

// ——— увага керівника: три проблеми з найбільшим фінансовим впливом ———
// Групи факторів дерева причин → проблеми. Вплив: останні 3 місяці × 4 (річний темп).
const PROBLEMS = {
  materials: ['input', 'purchase'],
  volume: ['volume'],
  price: ['price'],
  people: ['overtime', 'scrap'],
  other: ['other'],
};
const FIX = {
  mfg: { materials: 'procure', volume: 'southTeam', price: 'contract', people: 'southTeam', receivables: 'collectA', other: null },
  svc: { materials: null, volume: 'eastTeam', price: 'price3', people: 'eastTeam', receivables: 'corpTerms', other: 'opex8' },
};

export function attention(ind, i, n = 3) {
  return cached(`att|${ind}|${i}|${n}`, () => {
    const D = dataFor(ind), I = INDUSTRIES[ind];
    const from = Math.max(0, i - 2);
    const groups = factorGroups(causeTree(ind, from, i));
    const base = simulate(ind, i, []);
    const out = [];
    for (const [pid, factors] of Object.entries(PROBLEMS)) {
      const gs = groups.filter(g => factors.includes(g.factor));
      const byUnit = {};
      gs.forEach(g => { byUnit[g.unit] = (byUnit[g.unit] || 0) + g.value; });
      const units = Object.entries(byUnit).map(([unit, value]) => ({ unit, value: value * (12 / (i - from + 1)) })).filter(u => u.value < 0).sort((a, b) => a.value - b.value);
      const impact = sum(units.map(u => u.value));
      if (!units.length || impact > -0.004 * sum(D.units.map(u => ltm([u], i).rev))) continue;
      // впевненість: скільки місяців поспіль головний підрозділ має від'ємний внесок, більший за шум 2025 року
      const main = units[0].unit;
      const st = streak(ind, main, factors, i);
      out.push({ id: pid, kind: 'ebitda', impact, units, main, months: st.months, chronic: st.chronic, conf: confLevel(st.months), factors });
    }
    // дебіторка: гроші, що осіли понад рівень року тому
    const co = D.company[i], ref = D.company[Math.max(0, i - 12)];
    const daily = mean([0, 1, 2].map(k => sum(D.units.map(u => u.rows[Math.max(0, i - k)].rev)))) / 30.4;
    const tied = (co.dso - ref.dso) * daily;
    if (tied > 0.02 * co.ar) {
      // скільки місяців поспіль DSO вищий за середній рівень 2025 року більш ніж на 2 дні
      const base = mean(D.company.slice(0, 12).map(c => c.dso));
      let months = 0;
      for (let k = i; k >= 0 && D.company[k].dso > base + 2; k--) months++;
      out.push({ id: 'receivables', kind: 'cash', impact: -tied, units: [], main: null, months, conf: confLevel(Math.min(months, 3)), dso: co.dso, ref: ref.dso, ar: co.ar });
    }
    out.sort((a, b) => a.impact - b.impact);
    return out.slice(0, n).map(p => {
      const fix = FIX[ind][p.id];
      const actions = fix ? presetActions(ind, [fix]) : p.id === 'other' ? [{ lever: 'opex', value: -8 }] : [{ lever: 'cost', value: -3 }];
      const res = simulate(ind, i, actions);
      return { ...p, fix, actions, effect: compare(res, base), res };
    });
  });
}

// ——— тривалість сигналів: скільки місяців поспіль спрацьовує правило ———
function persistence(ind, i) {
  return cached(`pers|${ind}|${i}`, () => {
    const D = dataFor(ind), m = new Map();
    const now = signals(D, ind, i);
    for (const s of SIGNALS) for (const x of now[s.id]) {
      let n = 1;
      for (let k = i - 1; k >= Math.max(0, i - 11); k--) {
        const prev = signals(D, ind, k)[s.id];
        if (prev.some(y => (y.unit || null) === (x.unit || null))) n++; else break;
      }
      m.set(s.id + '|' + (x.unit || ''), n);
    }
    return m;
  });
}

// ——— раннє попередження: ризики з оцінкою фінансового впливу ———
export function riskList(ind, i) {
  return cached(`risks|${ind}|${i}`, () => {
    const D = dataFor(ind), I = INDUSTRIES[ind], S = signals(D, ind, i), P = persistence(ind, i);
    const co = D.company[i], B = baseline(ind, i);
    const daily = mean([0, 1, 2].map(k => sum(D.units.map(u => u.rows[Math.max(0, i - k)].rev)))) / 30.4;
    const items = [];
    for (const s of SIGNALS) for (const x of S[s.id]) {
      const u = x.unit ? D.units.find(z => z.id === x.unit) : null;
      const c = u ? agg([u], i) : null;
      const def = u ? I.units.find(z => z.id === u.id) : null;
      const salary = c && c.hcPlan ? c.payrollPlan / c.hcPlan : 0;
      let impact = 0, kind = 'ebitda';
      switch (s.id) {
        case 'revPlan': impact = (c.rev - c.revPlan) * (1 - c.cogsPlan / c.revPlan) * 12; break;
        case 'marginDrop': impact = -(x.ref - x.value) * c.rev * 12; break;
        case 'dso': impact = -(x.value - x.ref) * daily; kind = 'cash'; break;
        case 'overdue': impact = -x.amount * 0.3; kind = 'cash'; break;
        case 'turnover': impact = -x.exits * salary * 3; break;
        case 'overtime': impact = -c.hc * salary * Math.max(0, c.overtime - 0.05) / 2 * 12; break;
        case 'vacancies': impact = -x.n * salary * (x.value / 30) * 0.5; break;
        case 'quality': impact = x.metric === 'defect' ? -c.cogs * Math.max(0, c.defect - def.defect) / 100 * 12 : -c.rev * Math.max(0, (x.ref - x.value) / 100) * 0.5 * 12; break;
        case 'concentration': impact = -x.top * sum(D.units.map(z => ltm([z], i).rev)) * 0.1; kind = 'exposure'; break;
        case 'cash': impact = -Math.max(0, B.threshold - Math.min(...B.months.slice(0, 6).map(m => m.cash))); kind = 'cash'; break;
        default: break;
      }
      const months = P.get(s.id + '|' + (x.unit || '')) || 1;
      items.push({ sig: s.id, unit: x.unit || null, level: x.level, x, impact, kind, months, conf: confLevel(months), page: s.page });
    }
    // спершу критичні, далі за модулем впливу (експозицію зважуємо як десяту частку)
    const w = it => Math.abs(it.impact) * (it.kind === 'exposure' ? 0.1 : 1);
    return items.sort((a, b) => (a.level === b.level ? w(b) - w(a) : a.level === 'critical' ? -1 : 1));
  });
}

// ——— незвичні зміни: робастне z (медіана й MAD за попередні 12 місяців) ———
const METRICS = {
  mfg: [['overtime', 0.004, -1], ['sick', 0.003, -1], ['vacDays', 3, -1], ['defect', 0.1, -1], ['oee', 0.01, 1], ['otd', 0.01, 1], ['cogsRate', 0.004, -1], ['vsPlan', 0.015, 1]],
  svc: [['overtime', 0.004, -1], ['sick', 0.003, -1], ['vacDays', 3, -1], ['nps', 1.5, 1], ['wait', 1, -1], ['util', 0.01, 1], ['repeat', 0.01, 1], ['cogsRate', 0.004, -1], ['vsPlan', 0.015, 1]],
};
const val = (r, k) => (k === 'cogsRate' ? (r.rev ? r.cogs / r.rev : null) : k === 'vsPlan' ? (r.revPlan ? r.rev / r.revPlan - 1 : null) : k === 'vacDays' ? (r.vacancies > 0 ? r.vacDays : null) : r[k] ?? null);
export function anomalies(ind, i) {
  return cached(`anom|${ind}|${i}`, () => {
    const D = dataFor(ind), out = [];
    if (i < 12) return out;
    for (const u of D.units) for (const [k, floor, good] of METRICS[ind]) {
      const x = val(u.rows[i], k);
      if (x == null) continue;
      const z = t => {
        const win = u.rows.slice(t - 12, t).map(r => val(r, k)).filter(v => v != null);
        if (win.length < 8) return 0;
        const med = median(win), mad = median(win.map(v => Math.abs(v - med))) * 1.4826;
        return (val(u.rows[t], k) - med) / Math.max(mad, floor);
      };
      const zi = z(i);
      if (Math.abs(zi) < 3) continue;
      const win = u.rows.slice(i - 12, i).map(r => val(r, k)).filter(v => v != null);
      let months = 1;
      for (let t = i - 1; t >= 12 && Math.abs(z(t)) >= 3 && Math.sign(z(t)) === Math.sign(zi); t--) months++;
      out.push({ unit: u.id, metric: k, value: x, median: median(win), z: zi, bad: Math.sign(zi) !== good, months, conf: Math.abs(zi) >= 5 || months >= 2 ? 'high' : Math.abs(zi) >= 3.5 ? 'medium' : 'low' });
    }
    return out.sort((a, b) => (a.bad === b.bad ? Math.abs(b.z) - Math.abs(a.z) : a.bad ? -1 : 1));
  });
}

// ——— прогноз виходу за межу в найближчі 6 місяців ———
export function breaches(ind, i) {
  return cached(`br|${ind}|${i}`, () => {
    const D = dataFor(ind), B = baseline(ind, i), out = [];
    const h = 6;
    const check = (id, unit, now, thr, dir, fc) => {
      const beyond = v => (dir > 0 ? v > thr : v < thr);
      if (beyond(now)) return;
      let first = null, pMax = 0;
      fc.slice(0, h).forEach((f, k) => {
        const p = dir > 0 ? 1 - probBelow(f.mean, f.sd, thr) : probBelow(f.mean, f.sd, thr);
        if (p > pMax) pMax = p;
        if (first == null && p >= 0.5) first = k + 1;
      });
      if (pMax >= 0.2) out.push({ id, unit, now, thr, dir, p: pMax, month: first != null ? monthKey(i + first) : null, mean: fc[Math.min(h, fc.length) - 1].mean });
    };
    check('cash', null, D.company[i].cash, B.threshold, -1, B.months.map(m => ({ mean: m.cash, sd: m.sdCash })));
    check('dso', null, D.company[i].dso, 70, 1, B.dsoF);
    const fit = vals => ets(fitEts(vals, 0), h);
    for (const u of D.units) {
      check('turnover', u.id, turnover([u], i), 0.3, 1, fit(MONTHS.slice(0, i + 1).map((_, t) => turnover([u], t))));
      check('overtime', u.id, u.rows[i].overtime, 0.12, 1, fit(u.rows.slice(0, i + 1).map(r => r.overtime)));
      if (ind === 'mfg' && u.kind === 'plant') check('defect', u.id, u.rows[i].defect, 2.5, 1, fit(u.rows.slice(0, i + 1).map(r => r.defect)));
      if (ind === 'svc' && u.rows[i].nps != null) check('nps', u.id, u.rows[i].nps, 40, -1, fit(u.rows.slice(0, i + 1).map(r => r.nps)));
      if (ind === 'svc' && u.kind === 'branch') check('wait', u.id, u.rows[i].wait, 20, 1, fit(u.rows.slice(0, i + 1).map(r => r.wait)));
      const bu = B.units.find(x => x.id === u.id);
      if (bu.revenue) check('revPlan', u.id, u.rows[i].rev / u.rows[i].revPlan - 1, -0.08, -1, bu.months.map(m => ({ mean: m.rev / m.plan.rev - 1, sd: m.sdRev / m.plan.rev })));
    }
    return out.sort((a, b) => (a.month || 'z').localeCompare(b.month || 'z') || b.p - a.p);
  });
}

// ——— теплова карта: підрозділи × категорії ризику ———
export const HEAT_COLS = ['plan', 'people', 'quality', 'cash'];
export function heatmap(ind, i) {
  return cached(`heat|${ind}|${i}`, () => {
    const D = dataFor(ind), S = signals(D, ind, i);
    const lvl = (ids, unit) => levelOf(ids.flatMap(id => S[id].filter(x => (x.unit || null) === unit)));
    const rows = D.units.map(u => {
      const c = agg([u], i), w = wfUnit(u, i).value;
      const plan = u.kind === 'office' ? null : { level: lvl(['revPlan', 'marginDrop'], u.id), value: c.vsPlan, fmt: 'signedPct' };
      const people = { level: LEVELS.wf(w), value: w, fmt: 'index' };
      let quality = null;
      if (ind === 'mfg' && u.kind === 'plant') quality = { level: lvl(['quality'], u.id) === 'healthy' ? (c.oee < 0.68 ? 'warning' : 'healthy') : lvl(['quality'], u.id), value: c.defect, fmt: 'defect' };
      if (ind === 'svc' && c.nps != null) quality = { level: lvl(['quality'], u.id), value: c.nps, fmt: 'nps' };
      return { unit: u.id, cells: { plan, people, quality, cash: null } };
    });
    const co = D.company[i];
    const cashLvl = levelOf(['dso', 'overdue', 'cash', 'concentration'].flatMap(id => S[id]));
    const vs = agg(D.units, i).vsPlan, wc = wfIndex(D.units, i);
    rows.push({ unit: null, cells: { plan: { level: vs < -0.08 ? 'critical' : vs < -0.03 ? 'warning' : 'healthy', value: vs, fmt: 'signedPct' }, people: { level: LEVELS.wf(wc), value: wc, fmt: 'index' }, quality: null, cash: { level: cashLvl, value: co.dso, fmt: 'days' } } });
    return rows;
  });
}
