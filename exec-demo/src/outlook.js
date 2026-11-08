// Прогноз «якщо нічого не змінювати» і шари головних показників: прогноз на кінець року, ризик, фактори.
// Виручка підрозділу = план × відношення факту до плану; відношення прогнозує ETS(A,Ad,N) з аналітичними
// інтервалами (той самий метод, що в галереї графіків). Ставка прямих витрат і постійні витрати: останні 3 місяці,
// з індексацією зарплат та інших витрат з нового року. Гроші: EBITDA мінус податок, інвестиції, борг, дивіденди
// і зміна дебіторки; DSO теж прогнозує ETS (якщо клієнти платять дедалі пізніше, база це продовжує, із загасанням).
import { fitEts, forecast as ets, Z80, Z95 } from '../../chart-gallery/src/forecast.js';
import { INDUSTRIES, planMonth, cal, year } from './data.js';
import { dataFor, agg, pick, series, ytd, turnover, MONTHS } from './model.js';

export { Z80, Z95 };
export const H = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = a => a.reduce((s, v) => s + v, 0);
const mean = a => (a.length ? sum(a) / a.length : 0);
const sdDiff = a => { const d = a.slice(1).map((v, k) => v - a[k]); const m = mean(d); return Math.sqrt(mean(d.map(x => (x - m) ** 2))) / Math.SQRT2; };
export const monthKey = t => `${2025 + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
export const yearEnd = i => (year(i) - 2025) * 12 + 11;
const memo = new Map();
const cached = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };

// ——— кадровий ризик: індекс 0..100 ———
// плинність (40%), понаднормові (30%), тривалі вакансії (20%), лікарняні (10%); 0 = норма, 100 = усі на критичному рівні
export const WF = { turnover: [0.1, 0.3, 0.4], overtime: [0.04, 0.12, 0.3], vacancy: [30, 60, 0.2], sick: [0.035, 0.06, 0.1] };
const part = (x, [good, bad]) => clamp((x - good) / (bad - good), 0, 1);
export function wfUnit(u, t) {
  const r = u.rows[t];
  const c = {
    turnover: part(turnover([u], t), WF.turnover),
    overtime: part(r.overtime, WF.overtime),
    vacancy: r.vacancies > 0 ? part(r.vacDays, WF.vacancy) : 0,
    sick: part(r.sick, WF.sick),
  };
  return { value: 100 * Object.entries(c).reduce((s, [k, v]) => s + v * WF[k][2], 0), parts: c };
}
export function wfIndex(units, t) {
  const W = sum(units.map(u => u.rows[t].hc)) || 1;
  return sum(units.map(u => wfUnit(u, t).value * u.rows[t].hc)) / W;
}

// ——— базовий прогноз станом на місяць i ———
export function baseline(ind, i) {
  return cached('base|' + ind + '|' + i, () => {
    const D = dataFor(ind), I = INDUSTRIES[ind];
    const units = D.units.map(u => {
      const def = I.units.find(x => x.id === u.id);
      const rows = u.rows.slice(0, i + 1), last3 = rows.slice(-3);
      const revenue = def.rev > 0;
      let fc = null, ratioNow = 1;
      if (revenue) {
        const ratio = rows.map(r => r.rev / r.revPlan);
        ratioNow = mean(ratio.slice(-3));
        fc = ets(fitEts(ratio, 0), H).map(x => ({ mean: clamp(x.mean, 0.6, 1.3), sd: x.sd }));
      }
      const cr = revenue ? sum(last3.map(r => r.cogs)) / sum(last3.map(r => r.rev)) : 0;
      const sdCr = revenue ? sdDiff(rows.slice(-13).map(r => r.cogs / r.rev)) : 0;
      const pay0 = mean(last3.map(r => r.payroll)), oth0 = mean(last3.map(r => r.other));
      const months = [];
      for (let k = 1; k <= H; k++) {
        const t = i + k, next = year(t) > year(i);
        const plan = planMonth(ind, u.id, t);
        const rev = revenue ? plan.rev * fc[k - 1].mean : 0;
        months.push({
          t, plan, rev, sdRev: revenue ? plan.rev * fc[k - 1].sd : 0,
          cogs: rev * cr, pay: pay0 * (next ? 1 + I.wageIndex : 1), oth: oth0 * (next ? 1 + I.otherIndex : 1),
        });
      }
      const last = rows[rows.length - 1];
      return { id: u.id, kind: u.kind, def, revenue, cr, sdCr, pay0, oth0, ratioNow, months, hc: last.hc, ot: mean(last3.map(r => r.overtime)), turn: turnover([u], i), vacancies: last.vacancies, vacDays: last.vacDays, sick: last.sick };
    });
    // компанія: гроші
    const co = D.company[i];
    const opex3 = mean(D.company.slice(Math.max(0, i - 2), i + 1).map(c => c.opex));
    const threshold = Math.round(opex3 * 0.5 / 500) * 500;          // мінімальний безпечний залишок: два тижні витрат
    const revAct = t => sum(D.units.map(u => u.rows[t].rev));
    const revAt = k => (k <= 0 ? revAct(i + k) : sum(units.map(u => u.months[k - 1].rev)));
    let cash = co.cash, arPrev = co.ar, v = 0;
    const dsoF = ets(fitEts(D.company.slice(0, i + 1).map(c => c.dso), 0), H).map(x => ({ mean: clamp(x.mean, 5, 120), sd: x.sd }));
    const months = [];
    for (let k = 1; k <= H; k++) {
      const t = i + k;
      const rev = revAt(k);
      const ebitda = sum(units.map(u => { const m = u.months[k - 1]; return m.rev - m.cogs - m.pay - m.oth; }));
      const sdE = Math.sqrt(sum(units.map(u => { const m = u.months[k - 1]; return (m.sdRev * (1 - u.cr)) ** 2 + (m.rev * u.sdCr) ** 2; })));
      const daily = (revAt(k) + revAt(k - 1) + revAt(k - 2)) / 3 / 30.4;
      const dso = dsoF[k - 1].mean, ar = daily * dso;
      const tax = 0.15 * Math.max(0, ebitda), div = cal(t) % 3 === 2 ? I.dividend : 0;
      cash += ebitda - (ar - arPrev) - tax - I.capex - I.debtService - div;
      arPrev = ar;
      v += (sdE * 0.85) ** 2;
      const sdCash = Math.sqrt(v + (daily * dsoF[k - 1].sd) ** 2);
      const plan = sum(D.units.map(u => { const p = planMonth(ind, u.id, t); return p.rev - p.cogs - p.payroll - p.other; }));
      months.push({ t, m: monthKey(t), rev, ebitda, sdE, planEbitda: plan, planRev: sum(D.units.map(u => planMonth(ind, u.id, t).rev)), ar, dso, daily, cash, sdCash, tax, div });
    }
    return { units, months, threshold, cash0: co.cash, ar0: co.ar, dso0: co.dso, opex3, dsoF };
  });
}

// Прогноз виручки та EBITDA для набору підрозділів: помісячно з інтервалами
export function scopeForecast(ind, unit, i) {
  return cached('scope|' + ind + '|' + unit + '|' + i, () => {
    const B = baseline(ind, i);
    const us = unit === 'all' ? B.units : B.units.filter(u => u.id === unit);
    return B.months.map((_, k) => {
      const ms = us.map(u => ({ u, m: u.months[k] }));
      const rev = sum(ms.map(x => x.m.rev)), cogs = sum(ms.map(x => x.m.cogs)), pay = sum(ms.map(x => x.m.pay)), oth = sum(ms.map(x => x.m.oth));
      const sdRev = Math.sqrt(sum(ms.map(x => x.m.sdRev ** 2)));
      const sdE = Math.sqrt(sum(ms.map(x => (x.m.sdRev * (1 - x.u.cr)) ** 2 + (x.m.rev * x.u.sdCr) ** 2)));
      const planRev = sum(ms.map(x => x.m.plan.rev)), planE = sum(ms.map(x => x.m.plan.rev - x.m.plan.cogs - x.m.plan.payroll - x.m.plan.other));
      return { t: i + k + 1, m: monthKey(i + k + 1), rev, sdRev, ebitda: rev - cogs - pay - oth, sdE, planRev, planE };
    });
  });
}

// Підсумок року: факт з початку року + прогноз до грудня. Межі 80%: сума стандартних відхилень (обережна оцінка).
export function fullYear(ind, unit, i, metric) {
  const D = dataFor(ind), units = pick(D, unit), y = ytd(units, i);
  const f = scopeForecast(ind, unit, i).filter(x => x.t <= yearEnd(i));
  const fact = metric === 'rev' ? y.rev : y.ebitda, planYtd = metric === 'rev' ? y.revPlan : y.ebitdaPlan;
  const add = sum(f.map(x => (metric === 'rev' ? x.rev : x.ebitda)));
  const sd = sum(f.map(x => (metric === 'rev' ? x.sdRev : x.sdE)));
  const plan = planYtd + sum(f.map(x => (metric === 'rev' ? x.planRev : x.planE)));
  const value = fact + add;
  return { value, lo: value - Z80 * sd, hi: value + Z80 * sd, plan, vsPlan: plan ? value / plan - 1 : 0, months: f.length };
}

// Ряд показника з прогнозом ETS (для операційної ефективності та кадрового ризику)
function etsSeries(vals, h) {
  if (vals.length < 6) return [];
  return ets(fitEts(vals, 0), h).map(x => ({ mean: x.mean, sd: x.sd }));
}
export const effMetric = ind => (ind === 'mfg' ? 'oee' : 'utilStaff');
export function effSeries(D, ind, unit, i) {
  const units = pick(D, unit).filter(u => (ind === 'mfg' ? u.kind === 'plant' : u.kind === 'branch' || u.kind === 'online'));
  if (!units.length) return null;
  return series(units, 0, i).map(r => r[effMetric(ind)]);
}
export function wfSeries(D, unit, i) {
  const units = pick(D, unit);
  return MONTHS.slice(0, i + 1).map((_, t) => wfIndex(units, t));
}

// ——— п'ять головних показників ———
// Рівні ризику: виручка за прогнозом року до плану; EBITDA так само; запас грошей до порогу; ефективність; кадровий ризик
export const LEVELS = {
  rev: v => (v >= -0.02 ? 'healthy' : v >= -0.05 ? 'warning' : 'critical'),
  ebitda: v => (v >= -0.05 ? 'healthy' : v >= -0.15 ? 'warning' : 'critical'),
  runway: m => (m == null || m > 6 ? 'healthy' : m > 3 ? 'warning' : 'critical'),
  eff: (v, ind) => (ind === 'mfg' ? (v >= 0.72 ? 'healthy' : v >= 0.68 ? 'warning' : 'critical') : (v >= 0.75 ? 'healthy' : v >= 0.7 ? 'warning' : 'critical')),
  wf: v => (v < 30 ? 'healthy' : v < 60 ? 'warning' : 'critical'),
};

// Скільки місяців до порогу грошей: перший місяць, де центральний прогноз нижче порогу (null: не протягом 12 міс.)
export function runway(B) {
  const k = B.months.findIndex(m => m.cash < B.threshold);
  return k < 0 ? null : k + (B.months[k - 1] ? (B.months[k - 1].cash - B.threshold) / Math.max(1, B.months[k - 1].cash - B.months[k].cash) : (B.cash0 - B.threshold) / Math.max(1, B.cash0 - B.months[0].cash));
}
const normCdf = z => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));
export const probBelow = (mean_, sd, thr) => (sd > 0 ? normCdf((thr - mean_) / sd) : mean_ < thr ? 1 : 0);

export function headline(ind, unit, i, tree) {
  return cached('head|' + ind + '|' + unit + '|' + i, () => {
    const D = dataFor(ind), units = pick(D, unit), cur = agg(units, i), y = ytd(units, i);
    const ly = i >= 12 ? agg(units, i - 12) : null;
    const S12 = series(units, Math.max(0, i - 11), i);
    const B = baseline(ind, i);
    const out = [];
    // 1. виручка
    const fyR = fullYear(ind, unit, i, 'rev');
    out.push({ id: 'rev', icon: 'chart', value: cur.rev, fmt: 'money', delta: cur.vsPlan, dKind: 'pct', ctx: 'vsPlan', spark: S12.map(r => r.rev), fy: fyR, level: LEVELS.rev(fyR.vsPlan), page: 'finance', why: 'causes', na: !cur.rev && !cur.revPlan });
    // 2. EBITDA
    const fyE = fullYear(ind, unit, i, 'ebitda');
    out.push({ id: 'ebitda', icon: 'pulse', value: cur.ebitda, fmt: 'money', delta: cur.ebitdaPlan ? cur.ebitda / cur.ebitdaPlan - 1 : 0, dKind: 'pct', ctx: 'vsPlan', margin: cur.margin, spark: S12.map(r => r.ebitda), fy: fyE, level: LEVELS.ebitda(fyE.vsPlan), page: 'finance', why: 'causes', explain: true });
    // 3. запас грошей (компанія)
    const rw = runway(B), lastM = B.months[B.months.length - 1];
    const yeM = B.months.find(m => m.t === yearEnd(i)) || B.months[0];
    out.push({ id: 'runway', icon: 'database', value: rw, fmt: 'months', cash: D.company[i].cash, threshold: B.threshold, company: true, spark: D.company.slice(Math.max(0, i - 11), i + 1).map(c => c.cash), fy: { value: yeM.cash, lo: yeM.cash - Z80 * yeM.sdCash, hi: yeM.cash + Z80 * yeM.sdCash, cash: true }, minCash: Math.min(...B.months.map(m => m.cash)), level: LEVELS.runway(rw), page: 'cash', why: 'cash', end: lastM });
    // 4. операційна ефективність
    const es = effSeries(D, ind, unit, i);
    if (es) {
      const f = etsSeries(es, Math.max(1, yearEnd(i) - i)), last = f[f.length - 1];
      const v = es[es.length - 1], lyv = i >= 12 ? es[i - 12] : null;
      out.push({ id: 'eff', icon: 'settings', value: v, fmt: 'pct1', delta: lyv != null ? v - lyv : 0, dKind: 'pp', ctx: 'vsLY', spark: es.slice(-12), fy: last ? { value: last.mean, lo: last.mean - Z80 * last.sd, hi: last.mean + Z80 * last.sd, pct: true } : null, level: LEVELS.eff(v, ind), page: 'operations', why: 'operations', metric: effMetric(ind) });
    } else out.push({ id: 'eff', icon: 'settings', na: true, page: 'operations' });
    // 5. кадровий ризик
    const ws = wfSeries(D, unit, i);
    const wf = etsSeries(ws, Math.max(1, yearEnd(i) - i)), wl = wf[wf.length - 1];
    const wv = ws[ws.length - 1], wly = i >= 12 ? ws[i - 12] : null;
    out.push({ id: 'wf', icon: 'users', value: wv, fmt: 'index', delta: wly != null ? wv - wly : 0, dKind: 'pts', ctx: 'vsLY', goodWhenUp: false, spark: ws.slice(-12), fy: wl ? { value: clamp(wl.mean, 0, 100), lo: clamp(wl.mean - Z80 * wl.sd, 0, 100), hi: clamp(wl.mean + Z80 * wl.sd, 0, 100), index: true } : null, level: LEVELS.wf(wv), page: 'people', why: 'people' });
    return { list: out, cur, y, ly, B };
  });
}
