// Умовна програма відновлення послуг у громадах: синтетичні дані для демо моніторингу й оцінки (M&E).
// Усе згенеровано детерміновано (зерно), тож числа в текстах і статтях стабільні.
// Області справжні, громади позначено кодами (CHN-01 …), партнери позначені літерами; усі числа вигадані.

export const NQ = 12;   // програма: 2025 I кв. … 2027 IV кв.
export const NOW = 6;   // 2026 III кв.: останній закритий звітний квартал
export const QS = Array.from({ length: NQ }, (_, i) => ({ i, y: 2025 + Math.floor(i / 4), q: (i % 4) + 1 }));
export const SURVEY_AT = { base: 0, mid: 5, end: 11 };   // базове, проміжне й підсумкове опитування

export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sum = a => a.reduce((s, v) => s + v, 0);
const cumsum = a => { let s = 0; return a.map(v => (s += v)); };
// розподіл цілого числа за вагами без втрати одиниць (найбільші залишки)
export function split(total, weights) {
  const keys = Object.keys(weights), W = sum(keys.map(k => weights[k])) || 1;
  const raw = keys.map(k => (total * weights[k]) / W), out = {};
  const fl = raw.map(Math.floor);
  let rest = total - sum(fl);
  const order = raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0; j < order.length && rest > 0; j++, rest--) fl[order[j][1]]++;
  keys.forEach((k, i) => { out[k] = fl[i]; });
  return out;
}

// ——— криві плану (накопичена частка цілі на кінець кварталу) ———
export const CURVES = {
  std: [0.03, 0.1, 0.19, 0.29, 0.4, 0.51, 0.61, 0.7, 0.79, 0.87, 0.94, 1],
  late: [0, 0.02, 0.07, 0.14, 0.23, 0.33, 0.44, 0.55, 0.66, 0.77, 0.89, 1],
  jobs: [0, 0, 0.02, 0.06, 0.12, 0.2, 0.29, 0.4, 0.52, 0.66, 0.82, 1],
  spend: [0.03, 0.09, 0.17, 0.26, 0.36, 0.46, 0.56, 0.65, 0.74, 0.83, 0.92, 1],
};

// ——— області й громади програми ———
export const REGION_IDS = ['chn', 'sum', 'pol', 'kir', 'vin', 'ode'];
const REG_DEF = {
  chn: { code: 'CHN', n: 7, pop: [6, 46], pin: 0.31, idp: 0.07 },
  sum: { code: 'SUM', n: 6, pop: [5, 40], pin: 0.38, idp: 0.06 },
  pol: { code: 'POL', n: 6, pop: [8, 58], pin: 0.18, idp: 0.14 },
  kir: { code: 'KIR', n: 5, pop: [9, 52], pin: 0.3, idp: 0.18 },
  vin: { code: 'VIN', n: 6, pop: [7, 40], pin: 0.15, idp: 0.12 },
  ode: { code: 'ODE', n: 6, pop: [9, 60], pin: 0.22, idp: 0.09 },
};
export const DISABILITY_POP = 12;   // умовна частка людей з інвалідністю серед мешканців громад, %

// ——— партнери-виконавці (літери замість назв) ———
export const PARTNER_IDS = ['A', 'B', 'C', 'D', 'E'];
export const PARTNERS = {
  A: { sector: 'social', out: 'o1', regions: ['chn', 'sum', 'pol', 'kir'], bac: 2100000, spend: 0.532, color: '#3B82F6' },
  B: { sector: 'repair', out: 'o3', regions: ['chn', 'sum', 'ode'], bac: 3900000, spend: 0.74, color: '#019586' },
  C: { sector: 'income', out: 'o2', regions: ['pol', 'kir', 'vin', 'ode'], bac: 3300000, spend: 0.38, color: '#A855F7' },
  D: { sector: 'pss', out: 'o1', regions: ['sum', 'chn', 'ode', 'vin'], bac: 1200000, spend: 0.6, color: '#EC4899' },
  E: { sector: 'gov', out: 'o4', regions: REGION_IDS, bac: 900000, spend: 0.5, color: '#07A4BA' },
  M: { sector: 'pmu', out: null, regions: [], bac: 600000, spend: 0.57, color: '#94A3B8' },
};
export const BUDGET_IDS = [...PARTNER_IDS, 'M'];
export const BUDGET_TOTAL = sum(BUDGET_IDS.map(p => PARTNERS[p].bac));

const R = rng(20260930);
export const REGIONS = REGION_IDS.map(id => {
  const d = REG_DEF[id];
  const hromadas = Array.from({ length: d.n }, (_, j) => {
    const pop = Math.round((d.pop[0] + (d.pop[1] - d.pop[0]) * R() ** 1.4) * 10) * 100;
    const pinShare = d.pin * (0.78 + 0.44 * R());
    const idpShare = d.idp * (0.7 + 0.6 * R());
    const parts = PARTNER_IDS.filter(p => PARTNERS[p].regions.includes(id) && (p === 'E' || R() < 0.82 || j < 2));
    return { id: d.code + '-' + String(j + 1).padStart(2, '0'), region: id, pop, pin: Math.round(pop * pinShare / 10) * 10, idp: Math.round(pop * idpShare / 10) * 10, partners: parts, w: 0 };
  });
  const pop = sum(hromadas.map(h => h.pop)), pin = sum(hromadas.map(h => h.pin));
  hromadas.forEach(h => { h.w = h.pin / pin; });
  return { id, code: d.code, hromadas, pop, pin, idp: sum(hromadas.map(h => h.idp)), partners: PARTNER_IDS.filter(p => PARTNERS[p].regions.includes(id)) };
});
export const REG = Object.fromEntries(REGIONS.map(r => [r.id, r]));
export const HROMADAS = REGIONS.flatMap(r => r.hromadas);

// ——— напрями (кінцеві результати) ———
export const OUTCOME_IDS = ['o1', 'o2', 'o3', 'o4'];

// ——— показники ———
// kind: cum (накопичувальний), level (рівень на кінець кварталу), rate (частка за період), survey (опитування)
// level: impact | outcome | output | cross; unit: people | count | pct | teams
// region weights w: частка цілі в області; g: «характер» області (вище за 1 швидше, нижче повільніше)
const DEFS = [
  { id: 'i1', num: '1', lvl: 'impact', kind: 'survey', unit: 'pct', base: 37, target: 50, partners: [], src: 'survey', freq: 'survey', svar: 'inc' },
  { id: 'i2', num: '2', lvl: 'impact', kind: 'survey', unit: 'pct', base: 45, target: 58, partners: [], src: 'survey', freq: 'survey', svar: 'svc' },

  { id: 'r11', num: '1.1', lvl: 'outcome', out: 'o1', kind: 'rate', unit: 'pct', target: 60, partners: ['D'], src: 'who5', freq: 'q', values: [null, 52, 55, 58, 61, 62, 63], spread: 5 },
  { id: 'p11', num: '1.1', lvl: 'output', out: 'o1', kind: 'cum', unit: 'people', target: 24000, partners: ['D'], src: 'beneficiary', freq: 'q', curve: 'std', now: 16900, perf: [1.05, 1.08, 1.12, 1.1, 1.22, 1.14, 1.09], w: { sum: 0.34, chn: 0.3, ode: 0.2, vin: 0.16 }, g: { sum: 1.2, chn: 1.08, ode: 0.95, vin: 0.92 }, dis: 'pss' },
  { id: 'p12', num: '1.2', lvl: 'output', out: 'o1', kind: 'level', unit: 'teams', target: 18, partners: ['A'], src: 'admin', freq: 'q', plan: [4, 8, 12, 15, 18, 18, 18, 18, 18, 18, 18, 18], values: [0, 6, 10, 14, 16, 17, 18], wn: { chn: 5, sum: 6, pol: 5, kir: 2 } },
  { id: 'p13', num: '1.3', lvl: 'output', out: 'o1', kind: 'cum', unit: 'people', target: 600, partners: ['A'], src: 'training', freq: 'q', curve: 'std', now: 380, perf: [0.6, 1.1, 1.05, 1.0, 1.05, 1.0, 1.02], w: { chn: 0.28, sum: 0.28, pol: 0.26, kir: 0.18 }, g: { chn: 1, sum: 1, pol: 1.05, kir: 0.9 }, dis: 'staff' },
  { id: 'p14', num: '1.4', lvl: 'output', out: 'o1', kind: 'cum', unit: 'people', target: 30000, partners: ['A'], src: 'beneficiary', freq: 'q', curve: 'std', now: 17100, perf: [0.7, 0.92, 0.98, 0.95, 0.94, 0.93, 0.96], w: { chn: 0.3, sum: 0.33, pol: 0.25, kir: 0.12 }, g: { chn: 1, sum: 1.04, pol: 1.02, kir: 0.62 }, dis: 'social' },

  { id: 'r21', num: '2.1', lvl: 'outcome', out: 'o2', kind: 'cum', unit: 'count', target: 2400, partners: ['C'], src: 'followup', freq: 'q', curve: 'jobs', now: 500, perf: [1, 1, 0.9, 0.85, 0.78, 0.6, 0.7], w: { pol: 0.32, kir: 0.22, vin: 0.26, ode: 0.2 }, g: { pol: 0.82, kir: 0.6, vin: 1.08, ode: 0.95 } },
  { id: 'r22', num: '2.2', lvl: 'outcome', out: 'o2', kind: 'rate', unit: 'pct', target: 75, partners: ['C'], src: 'followup', freq: 'q', values: [null, null, null, 84, 82, 80, 81], spread: 6 },
  { id: 'p21', num: '2.1', lvl: 'output', out: 'o2', kind: 'cum', unit: 'count', target: 1200, partners: ['C'], src: 'grants', freq: 'q', curve: 'late', inc: [0, 10, 40, 70, 90, 40, 72], w: { pol: 0.32, kir: 0.22, vin: 0.26, ode: 0.2 }, g: { pol: 0.78, kir: 0.55, vin: 1.12, ode: 0.92 } },
  { id: 'p22', num: '2.2', lvl: 'output', out: 'o2', kind: 'cum', unit: 'people', target: 3000, partners: ['C'], src: 'training', freq: 'q', curve: 'std', now: 1760, perf: [0.8, 0.95, 1, 0.98, 0.97, 0.94, 0.96], w: { pol: 0.3, kir: 0.22, vin: 0.26, ode: 0.22 }, g: { pol: 1, kir: 0.85, vin: 1.05, ode: 1 }, dis: 'voc' },
  { id: 'p23', num: '2.3', lvl: 'output', out: 'o2', kind: 'rate', unit: 'pct', target: 50, partners: ['C'], src: 'grants', freq: 'q', values: [null, 60, 59, 58, 57, 58, 58], spread: 7 },

  { id: 'r31', num: '3.1', lvl: 'outcome', out: 'o3', kind: 'cum', unit: 'people', target: 140000, partners: ['B'], src: 'catchment', freq: 'q', curve: 'late', inc: [0, 0, 4100, 8600, 11900, 13200, 14500], w: { chn: 0.4, sum: 0.32, ode: 0.28 }, g: { chn: 1, sum: 0.95, ode: 1.05 } },
  { id: 'p31', num: '3.1', lvl: 'output', out: 'o3', kind: 'cum', unit: 'count', target: 64, partners: ['B'], src: 'acts', freq: 'q', curve: 'late', inc: [0, 0, 2, 4, 6, 7, 7], w: { chn: 26, sum: 20, ode: 18 }, g: { chn: 1, sum: 0.9, ode: 1.1 }, wip: [0, 4, 8, 12, 16, 18, 18] },
  { id: 'p32', num: '3.2', lvl: 'output', out: 'o3', kind: 'cum', unit: 'count', target: 40, partners: ['B'], src: 'acts', freq: 'q', curve: 'late', inc: [0, 0, 2, 3, 5, 5, 6], w: { chn: 15, sum: 15, ode: 10 }, g: { chn: 1, sum: 1.1, ode: 0.9 } },
  { id: 'p33', num: '3.3', lvl: 'output', out: 'o3', kind: 'rate', unit: 'pct', target: 100, partners: ['B'], src: 'audit', freq: 'q', acc: [0, 0, 2, 5, 10, 15, 21], spread: 6 },

  { id: 'r41', num: '4.1', lvl: 'outcome', out: 'o4', kind: 'rate', unit: 'pct', target: 70, partners: ['E'], src: 'budget', freq: 'q', counts: [0, 0, 2, 4, 8, 12, 14], of: 36, ramp: 1, spread: 9 },
  { id: 'p41', num: '4.1', lvl: 'output', out: 'o4', kind: 'cum', unit: 'count', target: 36, partners: ['E'], src: 'passport', freq: 'q', curve: 'std', inc: [0, 2, 4, 4, 5, 4, 5], w: { chn: 7, sum: 6, pol: 6, kir: 5, vin: 6, ode: 6 }, g: { chn: 1, sum: 1, pol: 1.1, kir: 0.9, vin: 1.1, ode: 0.9 } },
  { id: 'p42', num: '4.2', lvl: 'output', out: 'o4', kind: 'cum', unit: 'people', target: 480, partners: ['E'], src: 'training', freq: 'q', curve: 'std', now: 298, perf: [0.9, 1, 1.05, 1, 1, 1.02, 1], w: { chn: 7, sum: 6, pol: 6, kir: 5, vin: 6, ode: 6 }, g: { chn: 1, sum: 0.95, pol: 1.05, kir: 1, vin: 1.05, ode: 0.95 }, dis: 'staff' },
  { id: 'p43', num: '4.3', lvl: 'output', out: 'o4', kind: 'rate', unit: 'pct', target: 80, partners: ['E', 'M'], src: 'feedback', freq: 'q', spread: 7 },

  { id: 'x1', num: '1', lvl: 'cross', kind: 'rate', unit: 'pct', target: DISABILITY_POP, partners: ['A', 'C', 'D'], src: 'beneficiary', freq: 'q', share: 'dis', spread: 1.4 },
  { id: 'x2', num: '2', lvl: 'cross', kind: 'rate', unit: 'pct', target: 30, partners: ['A', 'C', 'D'], src: 'beneficiary', freq: 'q', share: 'idp', spread: 6 },
];

// ——— дезагрегація отримувачів (частки, %): жінки, діти 0–17, 60+, інвалідність, ВПО; повнота поля інвалідності ———
export const DIS = {
  pss: { female: 64, child: 22, older: 21, dis: 4.5, idp: 40, disKnown: 71 },
  social: { female: 61, child: 18, older: 34, dis: 6.2, idp: 38, disKnown: 96 },
  voc: { female: 62, child: 0, older: 4, dis: 3.1, idp: 50, disKnown: 94 },
  staff: { female: 79, child: 0, older: 9, dis: 1.2, idp: 8, disKnown: 90 },
};
// частка ВПО серед отримувачів відрізняється за областями (множник)
const IDP_MULT = { chn: 0.6, sum: 0.55, pol: 1.35, kir: 1.5, vin: 1.25, ode: 0.85 };
export const RECIPIENT_IDS = ['p11', 'p14', 'p22'];   // послуги людям: з них рахується охоплення

const RG = rng(4242);
const noise = a => 1 + (RG() - 0.5) * 2 * a;

function genCum(d) {
  const curve = CURVES[d.curve];
  let inc;
  if (d.inc) inc = d.inc.slice();
  else {
    const raw = d.perf.map((p, k) => (curve[k] - (k ? curve[k - 1] : 0)) * d.target * p * noise(0.04));
    const s = sum(raw);
    inc = raw.map(v => Math.round((v * d.now) / s));
    inc[inc.length - 1] += d.now - sum(inc);
  }
  const regions = Object.keys(d.w);
  const reg = Object.fromEntries(regions.map(r => [r, []]));
  inc.forEach(v => {
    const ws = Object.fromEntries(regions.map(r => [r, d.w[r] * (d.g ? d.g[r] : 1) * noise(0.18)]));
    const s = split(v, ws);
    regions.forEach(r => reg[r].push(s[r]));
  });
  const regCum = Object.fromEntries(regions.map(r => [r, cumsum(reg[r])]));
  const regPlan = Object.fromEntries(regions.map(r => [r, curve.map(c => (c * d.target * d.w[r]) / sum(regions.map(x => d.w[x])))]));
  return { actual: cumsum(inc), plan: curve.map(c => c * d.target), reg: regCum, regPlan };
}

// частки для показників-ставок з розкидом між областями
function rateRegions(vals, regions, spread) {
  const off = Object.fromEntries(regions.map(r => [r, (RG() - 0.5) * 2 * spread]));
  return Object.fromEntries(regions.map(r => [r, vals.map(v => (v == null ? null : Math.max(0, Math.min(100, Math.round((v + off[r] + (RG() - 0.5) * spread * 0.4) * 10) / 10))))]));
}

export const IND = DEFS.map(d => ({ ...d }));
export const IND_BY = Object.fromEntries(IND.map(x => [x.id, x]));
const regionsOf = d => (d.w ? Object.keys(d.w) : d.wn ? Object.keys(d.wn) : [...new Set(d.partners.flatMap(p => PARTNERS[p].regions))]);

for (const d of IND) {
  d.regions = d.kind === 'survey' ? REGION_IDS : regionsOf(d);
  if (d.kind === 'cum') Object.assign(d, genCum(d));
  if (d.kind === 'level') {
    d.actual = d.values.slice();
    d.reg = Object.fromEntries(Object.keys(d.wn).map(r => [r, d.values.map(v => Math.round((v * d.wn[r]) / d.target))]));
    Object.keys(d.wn).forEach(r => { d.reg[r][NOW] = d.wn[r]; });
    d.regPlan = Object.fromEntries(Object.keys(d.wn).map(r => [r, d.plan.map(v => (v * d.wn[r]) / d.target)]));
  }
}

// накопичене охоплення отримувачів за кварталами (для частки інвалідності й ВПО)
const recip = RECIPIENT_IDS.map(id => IND_BY[id]);
function shareSeries(key) {
  return Array.from({ length: NOW + 1 }, (_, k) => {
    let n = 0, s = 0;
    for (const x of recip) {
      for (const r of Object.keys(x.reg)) {
        const v = x.reg[r][k], base = DIS[x.dis][key];
        const sh = key === 'idp' ? base * IDP_MULT[r] : base * (0.82 + 0.06 * k);   // інвалідність: частка повільно росте
        n += v; s += (v * sh) / 100;
      }
    }
    return n ? Math.round((s / n) * 1000) / 10 : null;
  });
}

for (const d of IND) {
  if (d.kind !== 'rate') continue;
  let vals;
  if (d.values) vals = d.values.slice();
  else if (d.acc) {
    const comp = IND_BY.p31.actual;
    vals = d.acc.map((a, k) => (comp[k] ? Math.round((a / comp[k]) * 1000) / 10 : null));
    d.accCount = d.acc;
  } else if (d.counts) vals = d.counts.map(c => Math.round((c / d.of) * 1000) / 10);
  else if (d.share) vals = shareSeries(d.share);
  else vals = null; // p43 рахується зі зворотного зв'язку нижче
  d.actual = vals;
  d.plan = Array.from({ length: NQ }, (_, k) => (d.ramp ? Math.max(0, (d.target * (k - 1)) / 10) : d.target));
}

// ——— бюджет і витрати партнерів (EUR) ———
export const BUDGET = Object.fromEntries(BUDGET_IDS.map(p => {
  const P = PARTNERS[p];
  const curve = p === 'M' ? QS.map(q => (q.i + 1) / NQ) : CURVES.spend;
  const plan = curve.map(c => Math.round(P.bac * c / 1000) * 1000);
  const r = P.spend / curve[NOW];
  const actual = Array.from({ length: NOW + 1 }, (_, k) => Math.round((P.bac * curve[k] * (1 + (r - 1) * ((k + 1) / (NOW + 1)) ** 1.25)) / 1000) * 1000);
  return [p, { plan, actual }];
}));

// ——— якість даних ———
export const DQ = {
  // днів запізнення квартального звіту (термін: 20-й день після кварталу)
  late: { A: [0, 0, 2, 0, 1, 0, 3], B: [3, 5, 0, 4, 2, 6, 4], C: [0, 1, 0, 0, 9, 12, 7], D: [0, 0, 0, 1, 0, 0, 2], E: [4, 8, 12, 15, 18, 25, 31] },
  // вибіркова звірка з первинними документами: частка підтверджених записів за квартал
  verify: { A: [98, 97, 98, 96, 97, 97, 98], B: [100, 100, 97, 98, 96, 97, 96], C: [99, 98, 98, 97, 98, 98, 97], D: [96, 93, 89, 85, 79, 78, 81], E: [95, 94, 93, 92, 93, 92, 93] },
  sample: 60,
  // повнота дезагрегації (стать, вік, інвалідність), %
  complete: { A: 96, B: 99, C: 94, D: 71, E: 90 },
  // перетини отримувачів між партнерами (одна людина в базах двох партнерів) і дублікати всередині партнера
  overlap: [['A', 'D', 1840, ['sum', 'chn']], ['A', 'C', 310, ['pol', 'kir']], ['C', 'D', 120, ['vin', 'ode']]],
  dup: { D: 620 },
  dupFrom: 4,   // з II кв. 2026 записи звіряються за знеособленим ідентифікатором
  edits: { A: 1, B: 3, C: 2, D: 9, E: 4 },   // виправлень після подання звіту за програму
};

// остання цифра в місячних звітах майданчиків: перевірка округлення
function digitsOf(seed, sites, months, round10, round5) {
  const g = rng(seed), d = Array(10).fill(0);
  for (let s = 0; s < sites; s++) {
    const level = 25 + g() * 110;
    for (let m = 0; m < months; m++) {
      let v = Math.max(3, Math.round(level * (0.75 + g() * 0.5)));
      const u = g();
      if (u < round10) v = Math.round(v / 10) * 10; else if (u < round10 + round5) v = Math.round(v / 5) * 5;
      d[v % 10]++;
    }
  }
  return d;
}
DQ.digits = { A: digitsOf(11, 24, 21, 0.03, 0.02), C: digitsOf(12, 18, 15, 0.02, 0.02), D: digitsOf(13, 30, 18, 0.3, 0.12) };

// ——— зворотний зв'язок від отримувачів (за кварталами) ———
export const FB_CATS = ['info', 'delay', 'eligibility', 'quality', 'thanks', 'conduct'];
export const FB_CHANNELS = ['hotline', 'messenger', 'box', 'person'];
export const FEEDBACK = (() => {
  const g = rng(777), out = [];
  const base = [120, 260, 380, 470, 560, 640, 690];
  const mix = { info: 0.34, delay: 0.2, eligibility: 0.17, quality: 0.1, thanks: 0.16, conduct: 0.03 };
  const ok14 = { info: 0.88, delay: 0.52, eligibility: 0.62, quality: 0.7, thanks: 1, conduct: 0.74 };
  for (let k = 0; k <= NOW; k++) {
    const n = Math.round(base[k] * (0.95 + g() * 0.1));
    const shift = k >= 4 ? { delay: 0.05, info: -0.03, eligibility: -0.02 } : {};
    const by = split(n, Object.fromEntries(FB_CATS.map(c => [c, mix[c] + (shift[c] || 0) + (k >= 4 && c === 'delay' ? 0.02 : 0)])));
    const closed = Object.fromEntries(FB_CATS.map(c => [c, Math.round(by[c] * Math.min(1, ok14[c] * (0.96 + 0.06 * Math.min(k, 3) / 3) * (k >= 4 && c === 'delay' ? 0.9 : 1)))]));
    const ch = split(n, { hotline: 0.38 - k * 0.02, messenger: 0.27 + k * 0.03, box: 0.12, person: 0.23 - k * 0.01 });
    const days = Math.round((9 + (k >= 4 ? 3 : 0) + g() * 2) * 10) / 10;
    out.push({ k, n, by, closed, ch, days });
  }
  return out;
})();
IND_BY.p43.actual = FEEDBACK.map(f => {
  const n = sum(FB_CATS.filter(c => c !== 'thanks').map(c => f.by[c])), c = sum(FB_CATS.filter(c => c !== 'thanks').map(c => f.closed[c]));
  return Math.round((c / n) * 1000) / 10;
});

// частки за областями для показників-ставок
for (const d of IND) {
  if (d.kind === 'rate') d.reg = rateRegions(d.actual, d.regions, d.spread || 4);
}

// ——— оцінка: панель домогосподарств (громади програми й порівняльні громади) ———
// базове опитування: I кв. 2025, проміжне: II кв. 2026; підсумкове заплановане на IV кв. 2027
export const SURVEY = (() => {
  const g = rng(3), rows = [];
  const regEff = { chn: 0.01, sum: -0.01, pol: 0.02, kir: -0.04, vin: 0.015, ode: 0 };
  const bern = p => (g() < Math.max(0.01, Math.min(0.99, p)) ? 1 : 0);
  const next = (y0, m0, m1, rho) => { const p1 = (m1 - rho * m0) / (1 - rho); return bern(y0 ? p1 + rho * (1 - p1) : p1 * (1 - rho)); };
  for (const grp of ['P', 'C']) {
    for (const r of REGION_IDS) {
      const n = grp === 'P' ? 300 : 200;
      for (let i = 0; i < n; i++) {
        const fem = g() < 0.58 ? 1 : 0, old = g() < 0.27 ? 1 : 0, dis = g() < 0.14 ? 1 : 0;
        const idp = g() < (grp === 'P' ? 0.2 : 0.12) * (IDP_MULT[r] || 1) ? 1 : 0, rural = g() < 0.55 ? 1 : 0;
        // дохід: стабільне джерело доходу домогосподарства
        const m0 = (grp === 'P' ? 0.47 : 0.52) - 0.04 * fem - 0.08 * old - 0.08 * dis - 0.1 * idp - 0.02 * rural + regEff[r] * 0.5;
        const eff = grp === 'P' ? 0.076 + 0.012 * fem - 0.07 * old - 0.06 * dis + 0.03 * idp - 0.02 * rural + regEff[r] : 0;
        const m1 = m0 + 0.06 + eff;
        const y0 = bern(m0), y1 = next(y0, m0, m1, 0.55);
        // послуги: задоволеність доступом до базових послуг
        const s0m = (grp === 'P' ? 0.52 : 0.5) - 0.05 * old - 0.06 * dis - 0.05 * idp - 0.06 * rural + regEff[r];
        const seff = grp === 'P' ? 0.06 - 0.03 * old - 0.03 * dis + 0.02 * rural + regEff[r] : 0;
        const s0 = bern(s0m), s1 = next(s0, s0m, s0m + 0.03 + seff, 0.5);
        rows.push({ grp, r, fem, old, dis, idp, rural, inc: [y0, y1], svc: [s0, s1] });
      }
    }
  }
  return rows;
})();

// до програми: зареєстровані безробітні на 1000 мешканців (перевірка паралельних трендів)
export const PRE_TREND = {
  ticks: ['2023 I', 'II', 'III', 'IV', '2024 I', 'II', 'III', 'IV'],
  P: [42.1, 44.0, 46.8, 48.9, 50.6, 49.8, 51.9, 53.0],
  C: [37.0, 38.6, 41.2, 43.5, 45.1, 44.0, 46.3, 47.2],
};

// ——— віхи програми ———
export const MILESTONES = [
  { k: 0, id: 'baseline' }, { k: 1, id: 'inception' }, { k: 5, id: 'midline' }, { k: 7, id: 'mtr' },
  { k: 7, id: 'dqa' }, { k: 9, id: 'exit' }, { k: 11, id: 'endline' },
];
