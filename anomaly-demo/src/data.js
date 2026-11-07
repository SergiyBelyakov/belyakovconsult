// Синтетичні платежі умовної організації (мережа з 18 філій) за 2026 рік: шість груп витрат, контрагенти з історією,
// звичайна поведінка, рідкісна норма (похолодання, закупівлі під кінець року, річне страхування, ліцензії,
// аварійні ремонти, нічні автоплатежі) і вкладені проблеми з розміткою: помилки даних і ризики.
// Для кожного платежу рахуються ознаки, з якими працюють методи пошуку аномалій (engine.js).
import { rng, gauss, clamp } from './stats.js';

export const SEED = 20261108;
export const GROUPS = ['utilities', 'supplies', 'services', 'travel', 'rent', 'it'];
export const BRANCHES = 18;
export const LIMIT = 50000;                 // поріг погодження: платежі понад нього погоджує керівник
export const MS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];   // перший день кожного місяця 2026
export const dow = d => (((4 + d) % 7) + 7) % 7;                                  // 1 січня 2026 четвер; 0 неділя
export const isWeekend = d => { const w = dow(d); return w === 0 || w === 6; };
export const monthOf = d => { let m = 0; while (m < 11 && d >= MS[m + 1]) m++; return m; };

// Ознаки платежу. Усі безперервні: у межах 1–99% розподілу бази рідкісність рахується за частками записів,
// далі хвіст продовжується нормальним розподілом (floor: найменший масштаб, щоб «майже завжди нуль» не давав
// нескінченних відхилень). side: який бік незвичний.
export const FEATURES = [
  { id: 'amount', side: 'both', floor: 0.08 },     // lg суми
  { id: 'vsCp', side: 'both', floor: 0.6 },        // відхилення від звичної суми контрагента в його власних «сигмах»
  { id: 'offHours', side: 'high', floor: 0.75 },   // годин поза часом з 08:00 до 19:00
  { id: 'weekend', side: 'high', floor: 0.25 },    // вихідний день
  { id: 'lag', side: 'both', floor: 0.12 },        // lg(1 + днів від рахунку до оплати)
  { id: 'novelty', side: 'low', floor: 0.15 },     // lg(1 + днів співпраці з контрагентом)
  { id: 'freq', side: 'high', floor: 0.3 },        // ln(1 + платежів контрагенту за 30 днів до цього)
  { id: 'sameDay', side: 'high', floor: 0.5 },     // інших платежів тому самому контрагенту того ж дня
  { id: 'repeat', side: 'low', floor: 0.15 },      // lg(1 + днів від такого самого платежу тому самому контрагенту)
  { id: 'cpGroup', side: 'low', floor: 0.1 },      // частка платежів контрагента в цій групі
  { id: 'round', side: 'high', floor: 0.25, off: true },
];

const PREFIX = [['Альфа', 'Alfa'], ['Вектор', 'Vector'], ['Граніт', 'Granit'], ['Обрій', 'Obrii'], ['Світанок', 'Svitanok'], ['Злагода', 'Zlahoda'],
  ['Оріон', 'Orion'], ['Атлант', 'Atlant'], ['Меридіан', 'Meridian'], ['Профі', 'Profi'], ['Стандарт', 'Standart'], ['Технополіс', 'Technopolis'],
  ['Інтеграл', 'Integral'], ['Каскад', 'Kaskad'], ['Арсенал', 'Arsenal'], ['Імпульс', 'Impuls'], ['Горизонт', 'Horyzont'], ['Скіф', 'Skif'],
  ['Вертикаль', 'Vertykal'], ['Моноліт', 'Monolit'], ['Добробут', 'Dobrobut'], ['Берег', 'Bereh'], ['Ясен', 'Yasen'], ['Явір', 'Yavir'],
  ['Квант', 'Kvant'], ['Сигма', 'Sigma'], ['Дельта', 'Delta'], ['Омега', 'Omega'], ['Терра', 'Terra'], ['Полярис', 'Polaris']];
const SUFFIX = [['Сервіс', 'Service'], ['Постач', 'Supply'], ['Трейд', 'Trade'], ['Буд', 'Bud'], ['Груп', 'Group'], ['Плюс', 'Plus'],
  ['Логістик', 'Logistics'], ['Систем', 'Systems'], ['Тех', 'Tech'], ['Маркет', 'Market'], ['Офіс', 'Office'], ['Ремонт', 'Repair'], ['Пром', 'Prom'], ['Інвест', 'Invest']];
const UTIL = { heat: ['Теплопостачання', 'Heating'], water: ['Водопостачання', 'Water supply'], power: ['Електроенергія', 'Electricity'], internet: ['Інтернет', 'Internet'] };

export function makeDataset(seed = SEED) {
  const r = rng(seed);
  const U = (a, b) => a + (b - a) * r();
  const I = (a, b) => Math.floor(U(a, b + 1));
  const LN = (med, s) => med * Math.exp(s * gauss(r));
  const pois = lam => { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
  const gam3 = mean => (-Math.log(r() || 1e-9) - Math.log(r() || 1e-9) - Math.log(r() || 1e-9)) * mean / 3;
  const cents = v => Math.round(v * 100) / 100;
  const workTime = () => clamp(r() < 0.55 ? 11.2 + 1.25 * gauss(r) : 15.1 + 1.15 * gauss(r), 8.25, 18.75);
  const nextWork = d => { let x = Math.min(364, d); while (isWeekend(x) && x < 364) x++; while (isWeekend(x)) x--; return x; };
  const payDay = (inv, lag) => nextWork(Math.max(0, inv + lag));
  const toWeekend = d => { let x = d; while (!isWeekend(x)) x = x < 360 ? x + 1 : x - 1; return x; };
  const randWorkday = (m, minDay = -1e9, lo = MS[m], hi = MS[m + 1] - 1) => {
    const a = Math.max(lo, minDay);
    if (a > hi) return -1;
    for (let k = 0; k < 20; k++) { const d = I(a, hi); if (!isWeekend(d)) return d; }
    return nextWork(a) <= hi ? nextWork(a) : -1;
  };
  const take = (arr, k) => { const a = arr.slice(), out = []; while (out.length < k && a.length) out.push(a.splice(I(0, a.length - 1), 1)[0]); return out; };

  const used = new Set();
  const company = () => {
    for (let k = 0; k < 400; k++) {
      const p = PREFIX[I(0, PREFIX.length - 1)], s = SUFFIX[I(0, SUFFIX.length - 1)], pe = r() < 0.2;
      const key = p[0] + s[0];
      if (used.has(key)) continue;
      used.add(key);
      return { uk: `${pe ? 'ПП' : 'ТОВ'} «${p[0]} ${s[0]}»`, en: `${p[1]} ${s[1]} ${pe ? 'PE' : 'LLC'}` };
    }
    return { uk: 'ТОВ «Постачальник»', en: 'Supplier LLC' };
  };

  const cps = [], rows = [];
  const addCp = o => { cps.push({ branch: -1, isNew: false, ...o }); return cps.length - 1; };
  const add = o => { rows.push({ truth: 'normal', cause: null, ...o }); return rows.length - 1; };

  // ——— 0. Комунальні послуги: тепло (опалювальний сезон), вода, електроенергія для кожної філії ———
  const HEAT_S = [1.12, 1.04, 0.86, 0.66, 0, 0, 0, 0, 0, 0.62, 0.88, 1.08];
  const cold = new Set(take([...Array(BRANCHES).keys()], 12));
  const utilRecs = [];
  for (let b = 0; b < BRANCHES; b++) {
    const batch = b === 3 || b === 11;     // у двох філій електроенергію банк списує автоплатежем уночі
    for (const [kind, base] of [['heat', LN(36000, 0.22)], ['water', LN(5200, 0.3)], ['power', LN(17000, 0.3)]]) {
      const cp = addCp({ kind, g: 0, branch: b, since: -I(900, 5000), name: { uk: `${UTIL[kind][0]} · філія ${b + 1}`, en: `${UTIL[kind][1]} · branch ${b + 1}` } });
      for (let m = 0; m < 12; m++) {
        let amt;
        if (kind === 'heat') { if (!HEAT_S[m]) continue; amt = base * HEAT_S[m] * LN(1, 0.05); }
        else if (kind === 'water') amt = base * LN(1, 0.08);
        else amt = base * (1 + 0.16 * Math.cos(2 * Math.PI * m / 12)) * LN(1, 0.06);
        const inv = MS[m] + I(2, 8);
        const o = { g: 0, cp, inv, purpose: kind };
        if (kind === 'power' && batch) Object.assign(o, { day: Math.min(364, inv + 10), t: U(2.05, 3.6), truth: 'benign', cause: 'batch' });
        else Object.assign(o, { day: payDay(inv, clamp(Math.round(gam3(9)), 2, 30)), t: workTime() });
        if (kind === 'heat' && m === 0 && cold.has(b)) { amt *= U(2.5, 3.0); o.truth = 'benign'; o.cause = 'coldSnap'; }
        const i = add({ ...o, amount: cents(amt) });
        if (kind !== 'heat' && !(kind === 'power' && batch)) utilRecs.push(i);
      }
    }
  }

  // ——— 1. Товари й матеріали: 90 постачальників із різним розміром і частотою; у грудні закупівель більше ———
  const vendors = [];
  for (let v = 0; v < 90; v++) {
    const isNew = v < 4, since = isNew ? I(60, 250) : -I(200, 4500);
    vendors.push({ cp: addCp({ kind: 'vendor', g: 1, since, isNew, name: company() }), since, g: 1, med: Math.exp(U(Math.log(2500), Math.log(45000))), sig: U(0.25, 0.45), rate: U(0.6, 2.8) });
  }
  for (const V of vendors) for (let m = 0; m < 12; m++) {
    const k = pois(V.rate * (m === 11 ? 1.6 : 1));
    for (let q = 0; q < k; q++) {
      const day = randWorkday(m, V.since);
      if (day < 0) continue;
      add({ day, t: workTime(), g: 1, cp: V.cp, amount: cents(V.med * LN(1, V.sig)), inv: day - clamp(Math.round(gam3(12)), 1, 45), purpose: 'goods' });
    }
  }
  for (let q = 0; q < 30; q++) {           // рідкісна норма: великі закупівлі під закриття року
    const V = vendors[I(4, vendors.length - 1)], day = randWorkday(11, -1e9, MS[11] + 9, MS[11] + 28);
    add({ day, t: workTime(), g: 1, cp: V.cp, amount: cents(V.med * U(3, 6)), inv: day - clamp(Math.round(gam3(8)), 1, 30), purpose: 'goods', truth: 'benign', cause: 'yearEnd' });
  }

  // ——— 2. Послуги й ремонт: щомісячні договори (прибирання, охорона, обслуговування) і ремонти за потреби ———
  const SUB = ['cleaning', 'security', 'maintenance'];
  const fixed = [], fixedRecs = [];
  for (let c = 0; c < 22; c++) fixed.push({ cp: addCp({ kind: 'contract', g: 2, since: -I(300, 3000), name: company() }), amt: Math.round(LN(38000, 0.45) / 100) * 100, sub: SUB[c % 3] });
  for (const F of fixed) for (let m = 0; m < 12; m++) {
    const inv = MS[m] + I(1, 6);
    fixedRecs.push(add({ day: payDay(inv, clamp(Math.round(gam3(15)), 3, 40)), t: workTime(), g: 2, cp: F.cp, amount: r() < 0.85 ? F.amt : cents(F.amt * U(0.97, 1.03)), inv, purpose: F.sub }));
  }
  const repairs = [];
  for (let c = 0; c < 14; c++) repairs.push({ cp: addCp({ kind: 'repair', g: 2, since: -I(200, 3000), name: company() }), g: 2, med: U(20000, 90000), rate: U(0.8, 2.4) });
  for (const A of repairs) for (let m = 0; m < 12; m++) {
    const k = pois(A.rate);
    for (let q = 0; q < k; q++) {
      const day = randWorkday(m);
      add({ day, t: workTime(), g: 2, cp: A.cp, amount: cents(A.med * LN(1, 0.5)), inv: day - clamp(Math.round(gam3(18)), 2, 50), purpose: 'repair' });
    }
  }
  for (let q = 0; q < 6; q++) {            // рідкісна норма: аварійні ремонти, оплачені в день виклику
    const A = repairs[I(0, repairs.length - 1)];
    let day = I(5, 360), t;
    if (q < 2) { day = toWeekend(day); t = U(10, 17); } else if (q < 5) { day = nextWork(day); t = U(19.3, 22.5); } else { day = nextWork(day); t = workTime(); }
    add({ day, t, g: 2, cp: A.cp, amount: cents(A.med * U(3.2, 4.5)), inv: day, purpose: 'emergency', truth: 'benign', cause: 'emergency' });
  }

  // ——— 3. Відрядження й дрібні витрати: авансові звіти 210 працівників; вечори й вихідні тут звичні ———
  for (let e = 0; e < 210; e++) {
    const isNew = e < 12, since = isNew ? I(15, 300) : -I(100, 6000);
    const cp = addCp({ kind: 'employee', g: 3, since, isNew, name: { uk: `Працівник ${String(e + 101).padStart(4, '0')}`, en: `Employee ${String(e + 101).padStart(4, '0')}` } });
    const rate = U(0.15, 1.6), med = LN(1500, 0.35);
    for (let m = 0; m < 12; m++) {
      const k = pois(rate);
      for (let q = 0; q < k; q++) {
        let day = randWorkday(m, since), t = workTime();
        if (day < 0) continue;
        const u = r();
        if (u < 0.14) t = U(18.6, 22.4);
        else if (u < 0.22) { day = toWeekend(day); t = U(9.5, 20); }
        const lag = r() < 0.4 ? 0 : I(1, 4);
        add({ day, t, g: 3, cp, amount: cents(clamp(med * LN(1, 0.55), 120, 14000)), inv: day - lag, purpose: 'travel' });
      }
    }
  }

  // ——— 4. Оренда, охорона й страхування: фіксовані суми; страхові поліси всіх філій оплачуються в лютому ———
  for (let l = 0; l < 8; l++) {
    const cp = addCp({ kind: 'landlord', g: 4, branch: l, since: -I(400, 3000), name: { uk: `Орендодавець · філія ${l + 1}`, en: `Landlord · branch ${l + 1}` } });
    const amt = Math.round(LN(55000, 0.4) / 1000) * 1000;
    for (let m = 0; m < 12; m++) { const inv = MS[m] + I(0, 3); add({ day: payDay(inv, I(2, 6)), t: workTime(), g: 4, cp, amount: amt, inv, purpose: 'rent' }); }
  }
  const sec = addCp({ kind: 'alarm', g: 4, since: -I(500, 2500), name: company() });
  for (let m = 0; m < 12; m++) { const inv = MS[m] + I(3, 8); add({ day: payDay(inv, I(3, 10)), t: workTime(), g: 4, cp: sec, amount: 14500, inv, purpose: 'alarm' }); }
  const ins = addCp({ kind: 'insurer', g: 4, since: -I(700, 3000), name: company() });
  for (let b = 0; b < BRANCHES; b++) {
    const day = nextWork(MS[1] + 1 + Math.floor(b * 1.4));
    add({ day, t: workTime(), g: 4, cp: ins, amount: Math.round(LN(24000, 0.25) / 100) * 100, inv: day - I(3, 10), purpose: 'insurance', truth: 'benign', cause: 'annual' });
  }

  // ——— 5. ІТ і зв'язок: інтернет філій, мобільний зв'язок, хмара, аутсорс, річні ліцензії, техніка ———
  const netRecs = [];
  for (let b = 0; b < BRANCHES; b++) {
    const cp = addCp({ kind: 'internet', g: 5, branch: b, since: -I(300, 3000), name: { uk: `${UTIL.internet[0]} · філія ${b + 1}`, en: `${UTIL.internet[1]} · branch ${b + 1}` } });
    const amt = Math.round(U(2400, 4200) / 10) * 10;
    for (let m = 0; m < 12; m++) { const inv = MS[m] + I(1, 5); netRecs.push(add({ day: payDay(inv, I(3, 12)), t: workTime(), g: 5, cp, amount: amt, inv, purpose: 'internet' })); }
  }
  for (const [purpose, f] of [['mobile', () => cents(LN(18000, 0.08))], ['cloud', () => cents(LN(28000, 0.15))], ['outsource', () => 62000]]) {
    const cp = addCp({ kind: purpose, g: 5, since: -I(300, 2500), name: company() });
    for (let m = 0; m < 12; m++) { const inv = MS[m] + I(1, 6); add({ day: payDay(inv, I(4, 14)), t: workTime(), g: 5, cp, amount: f(), inv, purpose }); }
  }
  for (const [d, amt] of [[MS[0] + 19, 186000], [MS[2] + 15, 248400], [MS[8] + 6, 412800]]) {
    const cp = addCp({ kind: 'licence', g: 5, since: -I(700, 2500), name: company() });
    const day = nextWork(d);
    add({ day, t: workTime(), g: 5, cp, amount: amt, inv: day - I(5, 15), purpose: 'licence', truth: 'benign', cause: 'annual' });
  }
  const equipment = [];
  for (let v = 0; v < 6; v++) equipment.push({ cp: addCp({ kind: 'equipment', g: 5, since: -I(300, 3000), name: company() }), g: 5 });
  for (let q = 0; q < 45; q++) {
    const V = equipment[I(0, equipment.length - 1)], day = randWorkday(I(0, 11));
    add({ day, t: workTime(), g: 5, cp: V.cp, amount: cents(LN(38000, 0.35)), inv: day - clamp(Math.round(gam3(10)), 1, 30), purpose: 'equipment' });
  }

  // ——— Вкладені проблеми з розміткою ———
  const normalIdx = g => rows.map((x, i) => i).filter(i => rows[i].g === g && rows[i].truth === 'normal');
  // помилки даних
  for (const [g, k] of [[1, 6], [2, 3], [0, 3], [5, 2]]) for (const i of take(normalIdx(g), k)) Object.assign(rows[i], { orig: rows[i].amount, amount: cents(rows[i].amount * (r() < 0.15 ? 100 : 10)), truth: 'error', cause: 'extraZero' });
  for (const [g, k] of [[1, 2], [2, 1], [0, 1]]) for (const i of take(normalIdx(g), k)) Object.assign(rows[i], { orig: rows[i].amount, amount: cents(rows[i].amount / 10), truth: 'error', cause: 'lostZero' });
  for (const [g, k] of [[1, 5], [2, 3], [5, 2], [0, 2]]) for (const i of take(normalIdx(g), k)) {
    const x = rows[i], day = nextWork(Math.min(364, x.day + I(0, 3)));
    add({ ...x, day, t: day === x.day ? Math.min(18.9, x.t + U(0.2, 2)) : workTime(), truth: 'error', cause: 'duplicate', dupOf: i });
  }
  for (let q = 0; q < 8; q++) {             // покупка техніки, проведена як відрядження
    const V = equipment[I(0, equipment.length - 1)], day = randWorkday(I(0, 11));
    add({ day, t: workTime(), g: 3, cp: V.cp, amount: cents(LN(38000, 0.3)), inv: day - clamp(Math.round(gam3(10)), 1, 30), purpose: 'equipment', truth: 'error', cause: 'miscoded' });
  }
  for (const [g, k] of [[1, 3], [2, 2], [5, 1]]) for (const i of take(normalIdx(g), k)) Object.assign(rows[i], { invOrig: rows[i].inv, inv: rows[i].day - 365 - I(0, 20), truth: 'error', cause: 'dateTypo' });
  // ризики
  for (const [g, k, purpose, kind] of [[1, 5, 'goods', 'vendor'], [2, 3, 'repair', 'repair'], [5, 2, 'equipment', 'equipment']]) for (let q = 0; q < k; q++) {
    const day = randWorkday(I(0, 11));
    const cp = addCp({ kind, g, since: day - I(0, 12), isNew: true, name: company() });
    add({ day, t: U(15.5, 19.6), g, cp, amount: Math.round(LN(160000, 0.35) / 10000) * 10000, inv: day - I(0, 1), purpose, truth: 'risk', cause: 'newVendor' });
  }
  const small = vendors.filter(v => v.since < 0 && v.med < 12000 && v.rate < 1.5);
  for (let q = 0; q < 6; q++) {             // дроблення: чотири платежі за день трохи нижче порогу погодження
    const day = randWorkday(I(0, 11));
    const cp = q < 3 ? addCp({ kind: 'vendor', g: 1, since: day - I(3, 20), isNew: true, name: company() }) : small[I(0, small.length - 1)].cp;
    const t0 = U(10, 15);
    for (let s2 = 0; s2 < 4; s2++) add({ day, t: t0 + s2 * U(0.05, 0.4), g: 1, cp, amount: cents(U(48600, 49950)), inv: day - I(0, 1), purpose: 'goods', truth: 'risk', cause: 'split' });
  }
  for (let q = 0; q < 8; q++) {             // ручні платежі вночі або у вихідний
    const V = q < 5 ? vendors[I(4, vendors.length - 1)] : repairs[I(0, repairs.length - 1)];
    let day = randWorkday(I(0, 11)), t;
    if (q % 2 === 0) t = q % 4 === 0 ? U(21.6, 23.8) : U(0.2, 1.5); else { day = toWeekend(day); t = U(10, 18); }
    add({ day, t, g: V.g, cp: V.cp, amount: cents(V.med * U(1.8, 3)), inv: day - I(0, 3), purpose: V.g === 1 ? 'goods' : 'repair', truth: 'risk', cause: 'offHours' });
  }
  for (const [pool, k] of [[utilRecs, 4], [fixedRecs, 3], [netRecs, 1]]) for (const i of take(pool.filter(i => rows[i].truth === 'normal'), k)) Object.assign(rows[i], { orig: rows[i].amount, amount: cents(rows[i].amount * U(2.6, 3.8)), truth: 'risk', cause: 'overcharge' });

  // ——— Хронологічний порядок і номери ———
  rows.forEach((x, k) => { x.key = k; });
  rows.sort((a, b) => a.day - b.day || a.t - b.t);
  const pos = new Int32Array(rows.length);
  rows.forEach((x, i) => { pos[x.key] = i; x.id = 'P-' + String(i + 1).padStart(5, '0'); });
  rows.forEach(x => { if (x.dupOf != null) x.dupOf = pos[x.dupOf]; delete x.key; });
  return finish(rows, cps, r);
}

// Ознаки за історією контрагента і план для «звичайного дашборда»
function finish(rows, cps, r) {
  const n = rows.length, d = FEATURES.length;
  const X = new Float64Array(n * d);
  const byCp = new Map();
  rows.forEach((x, i) => { if (!byCp.has(x.cp)) byCp.set(x.cp, []); byCp.get(x.cp).push(i); });
  const info = rows.map(() => ({}));
  for (const [cp, list] of byCp) {
    const amts = list.map(i => rows[i].amount);
    const groupShare = new Map();
    list.forEach(i => groupShare.set(rows[i].g, (groupShare.get(rows[i].g) || 0) + 1));
    list.forEach((i, k) => {
      const x = rows[i], o = info[i];
      const others = amts.filter((_, q) => q !== k).sort((a, b) => a - b);
      o.cpN = others.length;
      o.cpMed = null; o.cpScale = null;
      if (others.length >= 3) {
        const lg = others.map(a => Math.log10(a)), mid = (lg.length - 1) / 2;
        const med = (lg[Math.floor(mid)] + lg[Math.ceil(mid)]) / 2;
        const dev = lg.map(v => Math.abs(v - med)).sort((a, b) => a - b), mad = (dev[Math.floor(mid)] + dev[Math.ceil(mid)]) / 2;
        o.cpMed = 10 ** med;
        o.cpScale = Math.max(1.4826 * mad, others.length < 6 ? 0.15 : 0.04);   // мала історія: обережніше
      }
      o.freq = 0; o.sameDay = 0; o.repeatOf = null; o.repeatDays = null;
      for (let q = 0; q < list.length; q++) {
        if (q === k) continue;
        const y = rows[list[q]];
        if (y.day === x.day) o.sameDay++;
        else if (y.day < x.day && y.day >= x.day - 30) o.freq++;
        if (q < k && Math.abs(y.amount - x.amount) < 0.005) { o.repeatOf = list[q]; o.repeatDays = x.day - y.day; }
      }
      o.cpGroup = groupShare.get(x.g) / list.length;
    });
  }
  rows.forEach((x, i) => {
    const o = info[i], c = cps[x.cp];
    o.lag = Math.max(0, x.day - x.inv);
    o.nov = Math.max(0, x.day - c.since);
    o.off = x.t < 8 ? 8 - x.t : x.t > 19 ? x.t - 19 : 0;
    o.we = isWeekend(x.day) ? 1 : 0;
    const ct = Math.round(x.amount * 100);
    o.round = ct % 100000 === 0 ? 1 : ct % 10000 === 0 ? 0.5 : 0;
    const v = [Math.log10(x.amount), o.cpMed ? Math.log10(x.amount / o.cpMed) / o.cpScale : 0, o.off, o.we, Math.log10(1 + o.lag), Math.log10(1 + o.nov),
      Math.log1p(o.freq), o.sameDay, Math.log10(1 + (o.repeatDays == null ? 365 : Math.min(365, o.repeatDays))), o.cpGroup, o.round];
    for (let j = 0; j < d; j++) X[i * d + j] = v[j];
    Object.assign(x, o);
    if (x.truth === 'normal' && c.isNew && o.nov < 45) { x.truth = 'benign'; x.cause = 'newCp'; }
  });
  // помісячні суми і план (план умовний: близький до факту, як у звичайному звіті «план і факт»)
  const months = Array.from({ length: 12 }, (_, m) => ({ m, n: 0, sum: 0 }));
  rows.forEach(x => { const m = months[monthOf(x.day)]; m.n++; m.sum += x.amount; });
  months.forEach(m => { m.plan = Math.round(m.sum * (1 - (r() * 0.05 - 0.022)) / 1000) * 1000; });
  const groups = GROUPS.map((id, g) => ({ id, n: rows.filter(x => x.g === g).length }));
  return { kind: 'demo', n, d, X, rows, cps, features: FEATURES, groups, gi: Int16Array.from(rows, x => x.g), months };
}
