// Синтетичні дані панелі керівника: дві умовні компанії (виробництво і мережа сервісних центрів),
// 22 закриті місяці (січень 2025 – жовтень 2026), план і факт за підрозділами.
// Гроші в тисячах гривень. Назви вигадані, збіги випадкові. Зерно фіксоване, тож цифри стабільні.

export const MONTHS = Array.from({ length: 22 }, (_, i) => {
  const y = 2025 + Math.floor(i / 12), m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
});
export const LAST = MONTHS.length - 1;          // жовтень 2026: останній закритий місяць
export const idx = key => MONTHS.indexOf(key);
export const cal = i => i % 12;                   // календарний місяць 0..11
export const year = i => 2025 + Math.floor(i / 12);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ramp = (i, from, to, a, b) => (i <= from ? a : i >= to ? b : a + ((b - a) * (i - from)) / (to - from));

// ——— опис галузей ———
// kind: plant | branch | online | office. Сюжети:
//  mfg: на заводі «Південь» з травня 2026 дорожчає сировина, ростуть понаднормові, з червня плинність і брак,
//       з липня завод не виконує план; ключовий клієнт затримує оплати (DSO росте).
//  svc: зі Східної філії у квітні 2026 пішов керівник: плинність, черги, падіння NPS і виручки;
//       онлайн-канал швидко росте; у Центральній з січня 2026 подорожчала оренда.
export const INDUSTRIES = {
  mfg: {
    seed: 20261107,
    units: [
      { id: 'north', kind: 'plant', rev: 26000, hc: 140, salary: 27, other: 2400, cogs: 0.58, turnover: 0.10, overtime: 0.05, cap: 52000, oee: 0.75, defect: 1.2, otd: 0.95 },
      { id: 'south', kind: 'plant', rev: 19000, hc: 110, salary: 26, other: 1900, cogs: 0.60, turnover: 0.13, overtime: 0.06, cap: 40000, oee: 0.71, defect: 1.4, otd: 0.93 },
      { id: 'pack', kind: 'plant', rev: 6500, hc: 38, salary: 24, other: 600, cogs: 0.55, turnover: 0.18, overtime: 0.07, cap: 18000, oee: 0.68, defect: 0.9, otd: 0.96 },
      { id: 'office', kind: 'office', rev: 0, hc: 32, salary: 42, other: 2600, cogs: 0, turnover: 0.08, overtime: 0.02 },
    ],
    season: [0.88, 0.92, 1.0, 1.02, 1.05, 1.06, 1.0, 0.98, 1.04, 1.07, 1.03, 0.97],
    growth: 0.10, planGrowth: 0.10, wageIndex: 0.12, otherIndex: 0.06,
    pricePerUnit: 0.52,                      // тис. грн за одиницю продукції
    dso: [46, 63], dsoFrom: 13,             // DSO росте з лютого 2026
    overdue: [0.09, 0.22],
    cash0: 42000, capex: 900, debt: 60000, debtService: 1500, dividend: 0,
    clients: [['a', 0.24], ['b', 0.12], ['c', 0.10], ['d', 0.07], ['e', 0.06], ['other', 0.41]],
  },
  svc: {
    seed: 20261108,
    units: [
      { id: 'center', kind: 'branch', rev: 8600, hc: 70, salary: 25, other: 1350, cogs: 0.36, turnover: 0.12, overtime: 0.05, nps: 56, wait: 13, util: 0.79, ticket: 1.18 },
      { id: 'left', kind: 'branch', rev: 5900, hc: 52, salary: 24, other: 760, cogs: 0.36, turnover: 0.14, overtime: 0.05, nps: 53, wait: 15, util: 0.77, ticket: 1.1 },
      { id: 'west', kind: 'branch', rev: 5000, hc: 45, salary: 24, other: 700, cogs: 0.37, turnover: 0.13, overtime: 0.04, nps: 55, wait: 14, util: 0.76, ticket: 1.08 },
      { id: 'east', kind: 'branch', rev: 5300, hc: 48, salary: 24, other: 720, cogs: 0.37, turnover: 0.12, overtime: 0.05, nps: 54, wait: 14, util: 0.78, ticket: 1.12 },
      { id: 'online', kind: 'online', rev: 2200, hc: 25, salary: 27, other: 320, cogs: 0.33, turnover: 0.15, overtime: 0.03, nps: 59, wait: 6, util: 0.81, ticket: 0.86 },
      { id: 'office', kind: 'office', rev: 0, hc: 40, salary: 38, other: 1450, cogs: 0, turnover: 0.09, overtime: 0.02 },
    ],
    season: [0.9, 0.92, 1.0, 1.0, 1.02, 0.98, 0.94, 0.95, 1.03, 1.06, 1.05, 1.12],
    growth: 0.08, planGrowth: 0.085, wageIndex: 0.10, otherIndex: 0.05,
    dso: [16, 19], dsoFrom: 12,
    overdue: [0.06, 0.08],
    cash0: 24000, capex: 700, debt: 12000, debtService: 450, dividend: 4200,
    clients: [['corp1', 0.05], ['corp2', 0.04], ['corp3', 0.03], ['other', 0.88]],
  },
};

// Сюжетні множники: що відбувається з підрозділом у місяці i
export function story(ind, u, i) {
  const s = { rev: 1, cogs: 0, turnover: 0, overtime: 0, oee: 0, defect: 0, otd: 0, nps: 0, wait: 0, util: 0, other: 1, growth: null };
  if (ind === 'mfg') {
    if (u.id === 'south') {
      s.cogs = ramp(i, 15, 18, 0, 0.055);                 // сировина з травня 2026
      s.overtime = ramp(i, 15, 20, 0, 0.075);
      s.turnover = ramp(i, 15, 19, 0, 0.34);
      s.oee = -ramp(i, 16, 20, 0, 0.09);
      s.defect = ramp(i, 16, 20, 0, 1.6);
      s.otd = -ramp(i, 16, 20, 0, 0.1);
      s.rev = 1 - ramp(i, 17, 20, 0, 0.12);
    }
    if (u.id === 'north') s.cogs = ramp(i, 15, 18, 0, 0.018);
    if (u.id === 'pack') s.overtime = ramp(i, 10, 21, 0, 0.02);
  } else {
    if (u.id === 'east') {
      s.turnover = ramp(i, 15, 18, 0, 0.26);
      s.nps = -ramp(i, 15, 19, 0, 19);
      s.wait = ramp(i, 15, 19, 0, 13);
      s.util = -ramp(i, 15, 19, 0, 0.08);
      s.rev = 1 - ramp(i, 16, 19, 0, 0.13);
      s.overtime = ramp(i, 15, 18, 0, 0.06);
    }
    if (u.id === 'online') s.growth = 0.42;
    if (u.id === 'center') s.other = i >= 12 ? 1.25 : 1;
    if (u.id === 'left') s.nps = ramp(i, 8, 21, 0, 3);
  }
  return s;
}

const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

export function generate(indId) {
  const I = INDUSTRIES[indId];
  const r = rng(I.seed);
  const noise = (a = 0.025) => 1 + (r() * 2 - 1) * a;
  const units = I.units.map(u => {
    const rows = [];
    let hc = u.hc, hcPlan = u.hc;
    let vacDays = 22 + r() * 10;
    for (let i = 0; i < MONTHS.length; i++) {
      const st = story(indId, u, i);
      const y = year(i), sea = I.season[cal(i)];
      // факт росте з темпом g; план 2026 = 2025 того ж місяця × (1 + плановий приріст)
      const g = st.growth ?? I.growth;
      const pg = st.growth ? st.growth - 0.05 : I.planGrowth;
      const inYear = (1 + g) ** (cal(i) / 12);
      const revPlan = y === 2025 ? u.rev * sea * inYear : u.rev * sea * inYear * (1 + pg);
      const rev = u.rev ? (y === 2025 ? revPlan * noise(0.03) : u.rev * sea * (1 + g) ** (i / 12) * st.rev * noise(0.022)) : 0;
      const cogsRate = u.cogs + st.cogs + (r() - 0.5) * 0.008;
      const cogs = rev * cogsRate;
      const cogsPlan = revPlan * u.cogs;

      // люди
      const turnRate = u.turnover + st.turnover;
      const exits = Math.max(0, Math.round(hc * turnRate / 12 * noise(0.5) + (r() < 0.15 ? 1 : 0)));
      const vol = Math.round(exits * (0.72 + r() * 0.16));
      const target = Math.round(u.hc * (1 + (y === 2026 ? (st.growth ? 0.2 : 0.02) : 0) * ((i % 12) / 12)));
      const gap = target - (hc - exits);
      const hires = Math.max(0, Math.round(gap * (st.turnover > 0.1 ? 0.45 : 0.75) + (r() < 0.2 ? 1 : 0)));
      hc = hc - exits + hires;
      hcPlan = target;
      const vacancies = Math.max(0, target - hc + Math.round(r() * 2));
      vacDays = Math.max(12, vacDays * 0.6 + (24 + (st.turnover > 0.1 ? 40 : 0) + (u.kind === 'plant' && u.id === 'pack' ? 22 : 0) + r() * 12) * 0.4);
      const salary = u.salary * (y === 2026 ? 1 + I.wageIndex : 1);
      const overtime = Math.max(0, u.overtime + st.overtime + (r() - 0.5) * 0.008);
      const payroll = hc * salary * (1 + overtime * 0.5);
      const payrollPlan = target * salary;
      const other = u.other * (y === 2026 ? 1 + I.otherIndex : 1) * st.other * noise(0.04);
      const otherPlan = u.other * (y === 2026 ? 1 + I.otherIndex : 1) * (u.id === 'center' && y === 2026 ? 1.25 : 1);
      const sick = 0.032 + ([0, 1, 10, 11].includes(cal(i)) ? 0.016 : 0) + (r() - 0.5) * 0.006 + st.overtime * 0.08;

      const row = {
        m: MONTHS[i], rev: round(rev), revPlan: round(revPlan), cogs: round(cogs), cogsPlan: round(cogsPlan),
        payroll: round(payroll), payrollPlan: round(payrollPlan), other: round(other), otherPlan: round(otherPlan),
        hc, hcPlan, hires, exits, vol, vacancies, vacDays: round(vacDays), overtime: round(overtime, 4), sick: round(sick, 4),
        training: round(hc * (u.kind === 'office' ? 1.2 : 2.1) * noise(0.3)),
      };
      if (u.kind === 'plant') {
        const util = Math.min(0.97, (rev / I.pricePerUnit) / u.cap);
        row.output = round(rev / I.pricePerUnit);
        row.cap = u.cap;
        row.oee = round(Math.min(0.9, u.oee + st.oee + (r() - 0.5) * 0.02), 3);
        row.defect = round(Math.max(0.3, u.defect + st.defect + (r() - 0.5) * 0.25), 2);
        row.otd = round(Math.min(0.995, u.otd + st.otd + (r() - 0.5) * 0.015), 3);
        row.downtime = round((1 - row.oee) * 160 * noise(0.15));
        row.util = round(util, 3);
      }
      if (u.kind === 'branch' || u.kind === 'online') {
        row.ticket = round(u.ticket * (y === 2026 ? 1.06 : 1) * noise(0.02), 3);
        row.clients = Math.round(rev / row.ticket);
        row.nps = round(u.nps + st.nps + (r() - 0.5) * 3, 1);
        row.wait = round(Math.max(3, u.wait + st.wait + (r() - 0.5) * 2), 1);
        row.util = round(Math.min(0.95, u.util + st.util + (r() - 0.5) * 0.02), 3);
        row.repeat = round(0.46 + (u.kind === 'online' ? 0.06 : 0) + st.nps / 200 + (r() - 0.5) * 0.02, 3);
      }
      rows.push(row);
    }
    return { id: u.id, kind: u.kind, rows };
  });

  // ——— рівень компанії: дебіторка, гроші, борг ———
  const company = [];
  let cash = I.cash0;
  for (let i = 0; i < MONTHS.length; i++) {
    const rev = units.reduce((a, u) => a + u.rows[i].rev, 0);
    const ebitda = units.reduce((a, u) => a + u.rows[i].rev - u.rows[i].cogs - u.rows[i].payroll - u.rows[i].other, 0);
    const dso = ramp(i, I.dsoFrom, LAST, I.dso[0], I.dso[1]) * (1 + (r() - 0.5) * 0.04);
    const rev3 = [0, 1, 2].map(k => units.reduce((a, u) => a + (u.rows[Math.max(0, i - k)].rev), 0)).reduce((a, b) => a + b, 0) / 3;
    const ar = rev3 / 30.4 * dso;
    const prevAr = i ? company[i - 1].ar : ar;
    const overdue = ramp(i, I.dsoFrom, LAST, I.overdue[0], I.overdue[1]) * (1 + (r() - 0.5) * 0.08);
    const aging = [0.62 - overdue * 0.6, 0.38 - overdue * 0.4, overdue * 0.55, overdue * 0.45].map(x => Math.max(0, x));
    const tax = Math.max(0, ebitda * 0.15);
    const dividend = cal(i) % 3 === 2 ? I.dividend : 0;      // квартальні виплати власникам
    cash = cash + ebitda - (ar - prevAr) - I.capex * noise(0.3) - tax - I.debtService - dividend;
    const debt = Math.max(0, I.debt - I.debtService * 0.55 * i);
    const opex = units.reduce((a, u) => a + u.rows[i].cogs + u.rows[i].payroll + u.rows[i].other, 0);
    company.push({ m: MONTHS[i], rev: round(rev), ebitda: round(ebitda), dso: round(dso, 1), ar: round(ar), overdue: round(overdue, 3), aging: aging.map(a => round(a, 3)), cash: round(cash), debt: round(debt), opex: round(opex) });
  }
  return { id: indId, units, company, clients: I.clients };
}

// План виручки підрозділу для будь-якого місяця, зокрема майбутнього (для прогнозу і симулятора).
// Та сама формула, що й у генераторі, без шуму: план 2027 = план 2026 × (1 + плановий приріст).
export function planRevenue(indId, unitId, t) {
  const I = INDUSTRIES[indId], u = I.units.find(x => x.id === unitId);
  if (!u || !u.rev) return 0;
  const st = story(indId, u, Math.min(t, LAST));
  const g = st.growth ?? I.growth, pg = st.growth ? st.growth - 0.05 : I.planGrowth;
  return u.rev * I.season[cal(t)] * (1 + g) ** (cal(t) / 12) * (1 + pg) ** (year(t) - 2025);
}

// Повний план підрозділу на місяць t (виручка, прямі витрати, ФОП, інші): для минулих місяців збігається з даними,
// для майбутніх продовжує ті самі правила (2027: зарплати й інші витрати індексуються так само, як у 2026).
export function planMonth(indId, unitId, t) {
  const I = INDUSTRIES[indId], u = I.units.find(x => x.id === unitId);
  const st = story(indId, u, Math.min(t, LAST));
  const y = year(t), c = cal(t);
  const rev = planRevenue(indId, unitId, t);
  const target = Math.round(u.hc * (1 + (y >= 2026 ? (st.growth ? 0.2 : 0.02) : 0) * (y === 2026 ? c / 12 : 1)));
  const salary = u.salary * (1 + I.wageIndex) ** (y - 2025);
  const other = u.other * (1 + I.otherIndex) ** (y - 2025) * (u.id === 'center' && y >= 2026 ? 1.25 : 1);
  return { rev, cogs: rev * u.cogs, payroll: target * salary, other, hc: target };
}
