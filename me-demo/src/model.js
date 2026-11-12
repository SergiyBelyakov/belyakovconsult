// Розрахунки демо M&E: план і факт на обраний звітний квартал, статуси, прогноз до кінця програми,
// охоплення без подвійного обліку, області й громади, освоєний обсяг (EVM), якість даних (DQA),
// сигнали, оцінка ефекту (різниця різниць) і критерії OECD DAC. Усе рахується в браузері з data.js.
import {
  NQ, NOW, QS, CURVES, REGIONS, REG, REGION_IDS, HROMADAS, PARTNERS, PARTNER_IDS, BUDGET_IDS, BUDGET, BUDGET_TOTAL,
  IND, IND_BY, DQ, FEEDBACK, FB_CATS, SURVEY, SURVEY_AT, RECIPIENT_IDS, DIS, OUTCOME_IDS,
} from './data.js';

export const sum = a => a.reduce((s, v) => s + v, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const REACH_TARGET = 52000;

// ——— нормальний розподіл ———
function erf(x) {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
export const phi = z => 0.5 * (1 + erf(z / Math.SQRT2));

// ——— значення показника на квартал k ———
export function lastAt(arr, k) {
  if (!arr) return { v: null, at: null };
  for (let j = Math.min(k, arr.length - 1); j >= 0; j--) if (arr[j] != null) return { v: arr[j], at: j };
  return { v: null, at: null };
}

// опитування: частка в групі програми на базовому і проміжному вимірюванні
const surveyMean = (variable, grp, t, filter = () => true) => {
  const rows = SURVEY.filter(x => x.grp === grp && filter(x));
  return rows.length ? (sum(rows.map(x => x[variable][t])) / rows.length) * 100 : null;
};
const SURVEY_VALS = {};
for (const x of IND.filter(d => d.kind === 'survey')) {
  const b = surveyMean(x.svar, 'P', 0), m = surveyMean(x.svar, 'P', 1);
  SURVEY_VALS[x.id] = Array.from({ length: NQ }, (_, k) => (k === SURVEY_AT.base ? b : k === SURVEY_AT.mid ? m : null));
  x.actual = SURVEY_VALS[x.id];
  x.base = Math.round(b);
  x.plan = Array.from({ length: NQ }, (_, k) => x.base + ((x.target - x.base) * k) / (NQ - 1));
  x.reg = Object.fromEntries(REGION_IDS.map(r => [r, Array.from({ length: NQ }, (_, k) => (k === SURVEY_AT.base ? surveyMean(x.svar, 'P', 0, y => y.r === r) : k === SURVEY_AT.mid ? surveyMean(x.svar, 'P', 1, y => y.r === r) : null))]));
}

export function valAt(d, k) {
  if (d.kind === 'cum' || d.kind === 'level') return { v: d.actual[k], at: k };
  return lastAt(d.actual, k);
}
export const planAt = (d, k) => d.plan[k];

// статус: накопичувальні й рівні порівнюються з планом на дату, частки з планом у відсотках
export function statusOf(d, k) {
  const { v, at } = valAt(d, k);
  if (v == null) return { level: 'info', v, at, plan: null, ratio: null };
  const plan = planAt(d, at);
  if (!plan) return { level: v > 0 ? 'healthy' : 'info', v, at, plan, ratio: null };
  const ratio = v / plan;
  const pctKind = d.unit === 'pct';
  const lv = pctKind ? (ratio >= 0.95 ? 'healthy' : ratio >= 0.85 ? 'warning' : 'critical') : (ratio >= 0.9 ? 'healthy' : ratio >= 0.75 ? 'warning' : 'critical');
  return { level: lv, v, at, plan, ratio, ofTarget: v / d.target };
}

// ——— прогноз до кінця програми ———
// накопичувальні: темп останніх двох кварталів відносно плану переноситься на решту плану;
// невизначеність: розкид квартальних темпів (незалежна частина) і спільний зсув (системна частина)
export function forecast(d, k) {
  const out = [];
  if (d.kind === 'survey') return { path: out, pReach: null, end: null };
  if (d.kind === 'cum') {
    const inc = j => d.actual[j] - (j ? d.actual[j - 1] : 0), pinc = j => d.plan[j] - (j ? d.plan[j - 1] : 0);
    const rs = [];
    for (let j = Math.max(0, k - 3); j <= k; j++) if (pinc(j) > 0) rs.push(inc(j) / pinc(j));
    const recent = rs.slice(-2);
    const perf = clamp(recent.length ? sum(recent) / recent.length : 1, 0.25, 1.8);
    const sd = Math.max(0.12, rs.length > 1 ? Math.sqrt(sum(rs.map(r => (r - sum(rs) / rs.length) ** 2)) / (rs.length - 1)) : 0.15);
    const v0 = d.actual[k];
    let mean = v0, varI = 0, cumP = 0;
    for (let j = k + 1; j < NQ; j++) {
      const p = pinc(j);
      mean += perf * p; cumP += p; varI += (sd * p) ** 2;
      const s = Math.sqrt(varI + (0.8 * sd * cumP) ** 2);
      out.push({ k: j, mean, lo80: mean - 1.2816 * s, hi80: mean + 1.2816 * s, lo95: Math.max(v0, mean - 1.96 * s), hi95: mean + 1.96 * s });
    }
    out.forEach(o => { o.lo80 = Math.max(v0, o.lo80); });
    const last = out[out.length - 1];
    const s = last ? (last.hi95 - last.mean) / 1.96 : 1;
    return { path: out, end: last ? last.mean : v0, pReach: last ? 1 - phi((d.target - last.mean) / Math.max(1e-6, s)) : v0 >= d.target ? 1 : 0, perf, need: k < NQ - 1 ? (d.target - v0) / (d.target - d.plan[k] || 1) : null };
  }
  // рівні й частки: згладжений тренд останніх точок
  const pts = [];
  for (let j = 0; j <= k; j++) if (d.actual[j] != null) pts.push([j, d.actual[j]]);
  if (!pts.length) return { path: out, end: null, pReach: null };
  const last = pts.slice(-3), n = last.length;
  const mx = sum(last.map(p => p[0])) / n, my = sum(last.map(p => p[1])) / n;
  const sxx = sum(last.map(p => (p[0] - mx) ** 2)) || 1;
  const slope = n > 1 ? (sum(last.map(p => (p[0] - mx) * (p[1] - my))) / sxx) * 0.7 : 0;
  const v0 = pts[pts.length - 1][1], j0 = pts[pts.length - 1][0];
  const cap = d.unit === 'pct' ? 100 : d.kind === 'level' ? d.target : d.target * 1.05;
  const resid = Math.max(d.unit === 'pct' ? 1.5 : 0.5, Math.sqrt(sum(last.map(p => (p[1] - (my + slope * 2 * (p[0] - mx))) ** 2)) / Math.max(1, n - 1)));
  for (let j = k + 1; j < NQ; j++) {
    const h = j - j0, mean = clamp(v0 + slope * h * (1 - h / 24), 0, cap), s = resid * Math.sqrt(h) * 0.9;
    out.push({ k: j, mean, lo80: clamp(mean - 1.2816 * s, 0, cap), hi80: clamp(mean + 1.2816 * s, 0, cap), lo95: clamp(mean - 1.96 * s, 0, cap), hi95: clamp(mean + 1.96 * s, 0, cap) });
  }
  const e = out[out.length - 1];
  const s = e ? Math.max(0.1, (e.hi95 - e.mean) / 1.96) : 1;
  const tgt = d.target;
  return { path: out, end: e ? e.mean : v0, pReach: e ? 1 - phi((tgt - 0.5 - e.mean) / s) : null };
}

// ——— охоплення: сума звітів, перетини між партнерами, дублікати, перевірені дані ———
const verifyCum = (p, k) => { const v = DQ.verify[p].slice(0, k + 1); return sum(v) / v.length / 100; };
export function reach(k) {
  const by = Object.fromEntries(RECIPIENT_IDS.map(id => [id, IND_BY[id].actual[k]]));
  const gross = sum(Object.values(by));
  const now = id => IND_BY[id].actual[NOW];
  const partnerInd = { A: 'p14', C: 'p22', D: 'p11' };
  const overlaps = DQ.overlap.map(([a, b, n, regs]) => {
    const f = Math.min(by[partnerInd[a]] / now(partnerInd[a]), by[partnerInd[b]] / now(partnerInd[b]));
    return { a, b, n: Math.round(n * f), regs };
  });
  const ov = sum(overlaps.map(o => o.n));
  const dupD = Math.round(DQ.dup.D * (by.p11 / now('p11')));
  const unique = gross - ov - dupD;
  const unconfirmed = Math.round((by.p11 - dupD) * (1 - verifyCum('D', k)));
  const plan = CURVES.std[k] * REACH_TARGET;
  return { gross, by, overlaps, ov, dupD, unique, verified: unique - unconfirmed, unconfirmed, plan, target: REACH_TARGET, ratio: unique / plan, ratioV: (unique - unconfirmed) / plan };
}

// ——— області й громади ———
export function regionStats(k) {
  const R = reach(k);
  const out = REGIONS.map(r => {
    const by = {};
    for (const id of RECIPIENT_IDS) { const d = IND_BY[id]; by[id] = d.reg[r.id] ? d.reg[r.id][k] : 0; }
    const gross = sum(Object.values(by));
    const ov = sum(R.overlaps.map(o => (o.regs.includes(r.id) ? o.n / o.regs.length : 0)));
    const dup = IND_BY.p11.reg[r.id] && IND_BY.p11.actual[k] ? (R.dupD * IND_BY.p11.reg[r.id][k]) / IND_BY.p11.actual[k] : 0;
    const unique = Math.round(gross - ov - dup);
    const inds = IND.filter(d => d.kind !== 'survey' && d.reg && d.reg[r.id]);
    const ratios = inds.map(d => {
      if (d.kind === 'cum' || d.kind === 'level') { const p = d.regPlan[r.id][k]; return p ? d.reg[r.id][k] / p : null; }
      const v = lastAt(d.reg[r.id], k).v, p = d.plan[k];
      return v != null && p ? v / p : null;
    }).filter(v => v != null);
    const progress = ratios.length ? sum(ratios.map(v => Math.min(1.2, v))) / ratios.length : null;
    const crit = inds.filter(d => {
      if (d.kind === 'cum' || d.kind === 'level') { const p = d.regPlan[r.id][k]; return p > 0 && d.reg[r.id][k] / p < 0.75; }
      const v = lastAt(d.reg[r.id], k).v; return v != null && v / d.plan[k] < 0.85;
    }).map(d => d.id);
    // гроші: частка партнера в області за його показниками
    const spend = sum(PARTNER_IDS.map(p => {
      if (!PARTNERS[p].regions.includes(r.id)) return 0;
      const share = partnerRegionShare(p, r.id, k);
      return BUDGET[p].actual[k] * share;
    }));
    return { id: r.id, r, by, gross, unique, pin: r.pin, pop: r.pop, coverage: unique / r.pin, progress, crit, spend, perPerson: unique ? spend / unique : null, partners: r.partners };
  });
  const covs = out.map(x => x.coverage).sort((a, b) => a - b);
  const median = (covs[2] + covs[3]) / 2;
  out.forEach(x => { x.relCov = x.coverage / median; });
  return { list: out, median, by: Object.fromEntries(out.map(x => [x.id, x])) };
}
const PARTNER_MAIN = { A: 'p14', B: 'p31', C: 'p22', D: 'p11', E: 'p41' };
// витрати партнерів на дату за областями (за часткою області в основному показнику партнера)
export function spendByRegion(k) {
  return Object.fromEntries(PARTNER_IDS.map(p => [p, Object.fromEntries(PARTNERS[p].regions.map(r => [r, BUDGET[p].actual[k] * partnerRegionShare(p, r, k)]))]));
}
function partnerRegionShare(p, r, k) {
  const d = IND_BY[PARTNER_MAIN[p]];
  const tot = sum(Object.keys(d.reg).map(x => d.reg[x][Math.max(k, 2)] || 0)) || 1;
  return d.reg[r] ? (d.reg[r][Math.max(k, 2)] || 0) / tot : 0;
}
export function hromadaStats(k, regionId) {
  const reg = REG[regionId];
  const rs = regionStats(k).by[regionId];
  return reg.hromadas.map(h => {
    let people = 0;
    for (const id of RECIPIENT_IDS) {
      const d = IND_BY[id], p = d.partners[0];
      if (!d.reg[regionId] || !h.partners.includes(p)) continue;
      const pool = reg.hromadas.filter(x => x.partners.includes(p));
      people += (d.reg[regionId][k] * h.pin) / sum(pool.map(x => x.pin));
    }
    const unique = rs.gross ? Math.round((people * rs.unique) / rs.gross) : 0;
    return { ...h, unique, coverage: unique / h.pin };
  });
}

// ——— бюджет: освоєний обсяг (Earned Value) ———
export function progressOf(p, k, verified = false) {
  const f = (id, w) => w * Math.min(1, IND_BY[id].actual[k] / IND_BY[id].target);
  switch (p) {
    case 'A': return f('p14', 0.6) + 0.25 * Math.min(1, IND_BY.p12.actual[k] / 18) + f('p13', 0.15);
    case 'B': { const d = IND_BY.p31; return 0.8 * Math.min(1, (d.actual[k] + 0.5 * d.wip[k]) / d.target) + f('p32', 0.2); }
    case 'C': return f('p21', 0.75) + f('p22', 0.25);
    case 'D': { const R = reach(k); return Math.min(1, (verified ? IND_BY.p11.actual[k] - R.dupD - R.unconfirmed : IND_BY.p11.actual[k]) / IND_BY.p11.target); }
    case 'E': return f('p41', 0.6) + f('p42', 0.4);
    default: return (k + 1) / NQ;
  }
}
export function finance(k, verified = false) {
  const rows = BUDGET_IDS.map(p => {
    const bac = PARTNERS[p].bac, pv = BUDGET[p].plan[k], ac = BUDGET[p].actual[k];
    const prog = progressOf(p, k, verified), ev = bac * prog;
    const cpi = ac ? ev / ac : 1, spi = pv ? ev / pv : 1;
    const eac = ac + (bac - ev) / Math.max(0.3, cpi);
    const left = NQ - 1 - k, rate = left ? (bac - ac) / left : 0, rateNow = k ? (BUDGET[p].actual[k] - BUDGET[p].actual[Math.max(0, k - 2)]) / Math.min(2, k) : ac;
    return { p, bac, pv, ac, ev, prog, cpi, spi, eac, vac: bac - eac, spent: ac / bac, planShare: pv / bac, burnGap: ac / pv, rate, rateNow };
  });
  const T = k2 => sum(rows.map(r => r[k2]));
  const tot = { bac: BUDGET_TOTAL, pv: T('pv'), ac: T('ac'), ev: T('ev'), eac: T('eac') };
  tot.cpi = tot.ev / tot.ac; tot.spi = tot.ev / tot.pv; tot.vac = tot.bac - tot.eac; tot.spent = tot.ac / tot.bac; tot.time = (k + 1) / NQ;
  const series = p => QS.map(q => ({ k: q.i, plan: (p ? BUDGET[p].plan : sumArr(BUDGET_IDS.map(x => BUDGET[x].plan)))[q.i], actual: q.i <= k ? (p ? BUDGET[p].actual : sumArr(BUDGET_IDS.map(x => BUDGET[x].actual)))[q.i] : null }));
  return { rows, by: Object.fromEntries(rows.map(r => [r.p, r])), tot, series };
}
const sumArr = arrs => arrs[0].map((_, i) => sum(arrs.map(a => a[i] ?? 0)));

// вартість результату: план (бюджет напряму / ціль) проти факту на дату
export function unitCosts(k, verified = false) {
  const F = finance(k, verified).by, R = reach(k);
  const pss = IND_BY.p11.actual[k] - (verified ? R.dupD + R.unconfirmed : 0);
  const fac = IND_BY.p31.actual[k] + 0.5 * IND_BY.p31.wip[k];
  const mk = (id, part, share, planUnits, units) => ({ id, plan: (PARTNERS[part].bac * share) / planUnits, actual: units > 0 ? (F[part].ac * share) / units : null });
  return [
    mk('person', 'A', 0.8, 30000, IND_BY.p14.actual[k]),
    mk('pss', 'D', 1, 24000, pss),
    mk('grant', 'C', 0.75, 1200, IND_BY.p21.actual[k]),
    mk('facility', 'B', 0.8, 64, fac),
    mk('official', 'E', 0.4, 480, IND_BY.p42.actual[k]),
  ];
}

// ——— якість даних: п'ять стандартів DQA за партнерами ———
export const DQA_STD = ['validity', 'integrity', 'precision', 'reliability', 'timeliness'];
export function digitStats(p) {
  const d = DQ.digits[p]; if (!d) return null;
  const n = sum(d), exp = n / 10;
  const chi = sum(d.map(v => (v - exp) ** 2 / exp));
  return { d, n, zeros: d[0] / n, fives: d[5] / n, chi, flag: chi > 27.88 };   // 27,88: критичне значення χ² для 9 ступенів свободи, p = 0,001
}
export function dqa(k) {
  const rows = PARTNER_IDS.map(p => {
    const lateArr = DQ.late[p].slice(0, k + 1), last = lateArr.slice(-4);
    const late = sum(last) / last.length, trend = last.length > 1 ? last[last.length - 1] - last[0] : 0;
    const verify = verifyCum(p, k) * 100;
    const dig = digitStats(p);
    const dupRate = p === 'D' ? reach(k).dupD / Math.max(1, IND_BY.p11.actual[k]) : 0;
    const edits = Math.round(DQ.edits[p] * (k + 1) / (NOW + 1));
    const s = {
      validity: clamp(100 - (100 - verify) * 2.2, 0, 100),
      integrity: clamp(100 - dupRate * 500 - edits * 2, 0, 100),
      precision: p === 'B' ? 99 : DQ.complete[p],
      reliability: clamp(100 - (dig && dig.flag ? (dig.zeros - 0.1) * 160 : 0), 0, 100),
      timeliness: clamp(100 - late * 2 - Math.max(0, trend) * 0.6, 0, 100),
    };
    const score = sum(DQA_STD.map(x => s[x])) / DQA_STD.length;
    return { p, s, score, late, lateLast: lateArr[lateArr.length - 1], trend, verify, dig, dupRate, edits };
  });
  const index = sum(rows.map(r => r.score)) / rows.length;
  const worst = rows.slice().sort((a, b) => a.score - b.score)[0];
  return { rows, by: Object.fromEntries(rows.map(r => [r.p, r])), index, worst };
}
export const dqLevel = v => (v >= 90 ? 'healthy' : v >= 75 ? 'warning' : 'critical');

// ——— сигнали: правило, рівень, на що дивитися ———
export function signals(k) {
  const out = [];
  const add = (id, level, sev, data) => out.push({ id, level, sev, ...data });
  for (const d of IND) {
    const st = statusOf(d, k);
    const wgt = d.lvl === 'cross' ? 0.9 : 1;
    if (st.level === 'critical') add('behind', 'critical', (60 + (1 - (st.ratio || 0)) * 40) * wgt, { ind: d.id, st });
    else if (st.level === 'warning') add('behind', 'warning', (30 + (1 - (st.ratio || 0)) * 30) * wgt, { ind: d.id, st });
    if (d.kind === 'cum' && st.ratio > 1.12 && k >= 2) {
      const doubt = d.partners.some(p => verifyCum(p, k) < 0.92);
      add('over', doubt ? 'warning' : 'info', doubt ? 36 : 12, { ind: d.id, st, doubt });
    }
  }
  const F = finance(k);
  for (const r of F.rows.filter(r => r.p !== 'M')) {
    if (r.cpi < 0.85 && r.ac > 0) add('cost', 'critical', 70 + (0.85 - r.cpi) * 80, { partner: r.p, fin: r });
    if (r.burnGap < 0.8 && k >= 3) add('underspend', 'warning', 40 + (0.8 - r.burnGap) * 60, { partner: r.p, fin: r });
  }
  const Q = dqa(k);
  for (const r of Q.rows) {
    if (r.verify < 90) add('verify', 'critical', 65 + (90 - r.verify), { partner: r.p, dq: r });
    if (r.dig && r.dig.flag) add('heaping', 'warning', 45, { partner: r.p, dq: r });
    if (r.late > 10 || r.lateLast > 14) add('late', r.lateLast > 20 ? 'critical' : 'warning', 35 + r.late, { partner: r.p, dq: r });
    if ((r.p === 'B' ? 99 : DQ.complete[r.p]) < 85) add('disagg', 'warning', 38, { partner: r.p, dq: r });
  }
  const R = reach(k);
  if (R.ov + R.dupD > 0 && k >= 2) add('double', 'warning', 42, { reach: R });
  const RS = regionStats(k);
  for (const x of RS.list) if (x.relCov < 0.6 && k >= 2) add('coverage', 'critical', 55 + (0.6 - x.relCov) * 50, { region: x.id, rs: x, median: RS.median });
  return out.sort((a, b) => b.sev - a.sev);
}

// ——— «Увага менеджера програми»: найважливіші проблеми ———
// різні типи проблем: не більше однієї про відставання показника, по одній на партнера чи область
export function attention(k) {
  const S = signals(k).filter(s => s.level !== 'info'), picked = [], seen = new Set(), kinds = new Set();
  const key = s => s.partner || s.region || (s.ind && (IND_BY[s.ind].partners[0] || s.ind));
  for (const s of S) {
    if (seen.has(key(s)) || kinds.has(s.id)) continue;
    seen.add(key(s)); kinds.add(s.id); picked.push(s);
    if (picked.length === 4) break;
  }
  return picked;
}

// ——— пояснення відхилення: які області дають розрив ———
export function explain(d, k) {
  const st = statusOf(d, k);
  if (!d.reg || st.v == null) return { st, parts: [] };
  const parts = Object.keys(d.reg).map(r => {
    if (d.kind === 'cum' || d.kind === 'level') {
      const a = d.reg[r][k], p = d.regPlan[r][k];
      return { r, a, p, gap: p - a, ratio: p ? a / p : null };
    }
    const a = lastAt(d.reg[r], k).v, p = d.plan[k];
    return { r, a, p, gap: a == null ? 0 : p - a, ratio: a == null ? null : a / p };
  });
  const tot = sum(parts.filter(x => x.gap > 0).map(x => x.gap)) || 1;
  parts.forEach(x => { x.share = x.gap > 0 ? x.gap / tot : 0; });
  return { st, parts: parts.sort((a, b) => b.gap - a.gap) };
}

// дезагрегація отримувачів за показником (на дату), з порівнянням із населенням
export function disagg(d, k) {
  if (!d.dis || !d.reg) return null;
  const D = DIS[d.dis];
  const n = d.actual[k];
  return { n, ...D };
}

// ——— оцінка ефекту ———
export const SUBGROUPS = [
  ['all', () => true], ['female', x => x.fem === 1], ['male', x => x.fem === 0], ['older', x => x.old === 1], ['younger', x => x.old === 0],
  ['disability', x => x.dis === 1], ['nodisability', x => x.dis === 0], ['idp', x => x.idp === 1], ['local', x => x.idp === 0], ['rural', x => x.rural === 1], ['urban', x => x.rural === 0],
  ...REGION_IDS.map(r => [r, x => x.r === r]),
];
const SUBF = Object.fromEntries(SUBGROUPS);
export function effect(variable, sub = 'all') {
  const f = SUBF[sub] || SUBF.all;
  const P = SURVEY.filter(x => x.grp === 'P' && f(x)), C = SURVEY.filter(x => x.grp === 'C' && f(x));
  const m = (rows, t) => sum(rows.map(x => x[variable][t])) / rows.length;
  const dlt = rows => rows.map(x => x[variable][1] - x[variable][0]);
  const vr = a => { const mu = sum(a) / a.length; return sum(a.map(v => (v - mu) ** 2)) / (a.length - 1); };
  const P0 = m(P, 0), P1 = m(P, 1), C0 = m(C, 0), C1 = m(C, 1);
  const dP = dlt(P), dC = dlt(C);
  const did = P1 - P0 - (C1 - C0);
  const seDid = Math.sqrt(vr(dP) / P.length + vr(dC) / C.length);
  const pre = P1 - P0, sePre = Math.sqrt(vr(dP) / P.length);
  const post = P1 - C1, sePost = Math.sqrt((P1 * (1 - P1)) / P.length + (C1 * (1 - C1)) / C.length);
  const pct = v => v * 100;
  return {
    nP: P.length, nC: C.length, P0: pct(P0), P1: pct(P1), C0: pct(C0), C1: pct(C1),
    did: { est: pct(did), lo: pct(did - 1.96 * seDid), hi: pct(did + 1.96 * seDid), se: pct(seDid) },
    pre: { est: pct(pre), lo: pct(pre - 1.96 * sePre), hi: pct(pre + 1.96 * sePre), se: pct(sePre) },
    post: { est: pct(post), lo: pct(post - 1.96 * sePost), hi: pct(post + 1.96 * sePost), se: pct(sePost) },
  };
}

// зворотний зв'язок за квартал k і накопичено
export function feedbackAt(k) {
  const f = FEEDBACK[k];
  const tot = FEEDBACK.slice(0, k + 1);
  const n = sum(tot.map(x => x.n));
  const by = Object.fromEntries(FB_CATS.map(c => [c, sum(tot.map(x => x.by[c]))]));
  return { q: f, n, by, closedShare: IND_BY.p43.actual[k] };
}

// ——— критерії OECD DAC: рейтинг із доказами з даних ———
export const DAC = ['relevance', 'coherence', 'effectiveness', 'efficiency', 'impact', 'sustainability'];
export function dac(k) {
  const R = reach(k), F = finance(k), RS = regionStats(k), Q = dqa(k);
  const st = IND.map(d => statusOf(d, k)).filter(s => s.level !== 'info');
  const onTrack = st.filter(s => s.level === 'healthy').length;
  const x1 = statusOf(IND_BY.x1, k), x2 = statusOf(IND_BY.x2, k);
  const low = RS.list.filter(x => x.relCov < 0.6);
  const surv = statusOf(IND_BY.r22, k);
  const eff = k >= SURVEY_AT.mid ? effect('inc') : null;
  const rate = v => (v >= 3.5 ? 4 : v >= 2.75 ? 3 : v >= 1.75 ? 2 : 1);
  const out = {
    relevance: { score: rate(4 - (x1.level === 'critical' ? 0.5 : 0) - (low.length ? 0.4 : 0)), ev: { x1, x2, low } },
    coherence: { score: rate(3.2 - (R.ov > 1500 ? 0.4 : 0)), ev: { ov: R.ov, overlaps: R.overlaps } },
    effectiveness: { score: rate(1 + (3 * onTrack) / st.length), ev: { onTrack, n: st.length } },
    efficiency: { score: rate(4 - (F.tot.cpi < 0.95 ? 0.5 : 0) - (F.rows.some(r => r.cpi < 0.8) ? 1 : F.rows.some(r => r.cpi < 0.9) ? 0.5 : 0) - (F.rows.some(r => r.burnGap < 0.8 && r.p !== 'M') ? 0.5 : 0)), ev: { cpi: F.tot.cpi, worst: F.rows.filter(r => r.p !== 'M').sort((a, b) => a.cpi - b.cpi)[0], slow: F.rows.filter(r => r.p !== 'M').sort((a, b) => a.burnGap - b.burnGap)[0] } },
    impact: { score: eff ? rate(eff.did.lo > 0 ? 3.2 : 2) : null, ev: { eff } },
    sustainability: { score: surv.v != null ? rate(2.2 + (surv.v >= 75 ? 0.6 : 0)) : null, ev: { surv, r41: statusOf(IND_BY.r41, k) } },
  };
  out.conf = { impact: eff ? 'medium' : 'low', dq: Q.index };
  return out;
}

// підсумок для огляду
export function summary(k) {
  const st = IND.map(d => ({ d, s: statusOf(d, k) }));
  const counts = { healthy: 0, warning: 0, critical: 0, info: 0 };
  st.forEach(x => { counts[x.s.level]++; });
  const byOutcome = Object.fromEntries(OUTCOME_IDS.map(o => {
    const xs = st.filter(x => x.d.out === o && x.s.ratio != null);
    const prog = xs.length ? sum(xs.map(x => Math.min(1.2, x.s.ratio))) / xs.length : null;
    const worst = xs.reduce((w, x) => (rank(x.s.level) > rank(w) ? x.s.level : w), 'healthy');
    return [o, { prog, worst, n: xs.length, crit: xs.filter(x => x.s.level === 'critical').length }];
  }));
  return { st, counts, byOutcome };
}
const rank = l => ({ info: 0, healthy: 1, warning: 2, critical: 3 })[l];
export { rank };
