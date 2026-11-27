// Синтетична модель продажів умовного дистриб’ютора продуктів і напоїв: 41 товар у 6 категоріях, понад 300 клієнтів
// у 5 каналах і 37 містах, 12 менеджерів, щомісяця з січня 2025 до жовтня 2026 року. Кожен рядок: товар × клієнт × місяць
// (кількість, прайс, знижки рахунку, промо, ретробонус, чиста виручка, собівартість). Генератор детермінований.
// Історія, закладена в дані: собівартість кави й какао росте швидше за прайс, знижки менеджерів з цільовими планами
// з виручки глибшають, зростання дають мережі, субдистриб’ютори й маркетплейси з низькою маржею, а частина маржинальних
// магазинів закривається. Виручка за січень-жовтень +15%, валовий прибуток майже не змінюється.
import { CITIES, CITY, HUBS, dist } from './geo.js';

export const MONTHS = Array.from({ length: 22 }, (_, t) => `${2025 + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
export const NM = MONTHS.length;
export const Y1 = 12;   // перший місяць поточного року (січень 2026)
export const LAST = NM - 1;

export const CATS = [
  { id: 'coffee', uk: 'Кава', en: 'Coffee' },
  { id: 'tea', uk: 'Чай', en: 'Tea' },
  { id: 'conf', uk: 'Кондитерка', en: 'Confectionery' },
  { id: 'snacks', uk: 'Снеки', en: 'Snacks' },
  { id: 'drinks', uk: 'Напої', en: 'Drinks' },
  { id: 'grocery', uk: 'Бакалія', en: 'Grocery' },
];
const CAT_I = Object.fromEntries(CATS.map((c, i) => [c.id, i]));
// Сезонність попиту за місяцями року
const SEASON = {
  coffee: [1.12, 1.07, 1.03, 0.98, 0.94, 0.89, 0.86, 0.9, 0.98, 1.04, 1.08, 1.12],
  tea: [1.2, 1.12, 1.02, 0.94, 0.88, 0.82, 0.8, 0.84, 0.96, 1.06, 1.16, 1.22],
  conf: [0.95, 1, 1.18, 1.08, 0.92, 0.84, 0.82, 0.86, 0.98, 1.02, 1.1, 1.42],
  snacks: [0.9, 0.92, 0.96, 1, 1.06, 1.12, 1.16, 1.14, 1.02, 0.96, 0.92, 1.04],
  drinks: [0.78, 0.8, 0.88, 0.98, 1.12, 1.3, 1.42, 1.36, 1.06, 0.9, 0.8, 0.86],
  grocery: [1, 0.97, 1, 1.02, 0.98, 0.96, 0.96, 1, 1.04, 1.04, 1.02, 1.08],
};
// Індекс собівартості закупівлі (сировина й курс): точки на місяцях 0, 5, 11, 17, 21
const COST = {
  coffee: [1, 1.08, 1.17, 1.27, 1.31], tea: [1, 1.02, 1.05, 1.08, 1.1], conf: [1, 1.05, 1.11, 1.18, 1.21],
  snacks: [1, 1.02, 1.04, 1.07, 1.08], drinks: [1, 1.01, 1.03, 1.06, 1.07], grocery: [1, 1.02, 1.04, 1.08, 1.1],
};
const COST_T = [0, 5, 11, 17, 21];
// Підвищення прайсу: [місяць, множник]
const LIST = {
  coffee: [[6, 1.05], [13, 1.1]], tea: [[13, 1.06]], conf: [[6, 1.04], [14, 1.08]],
  snacks: [[6, 1.03], [13, 1.05]], drinks: [[15, 1.05]], grocery: [[12, 1.04]],
};
// Промо в мережах: місяці року 2025 і додаткові 2026
const PROMO = { coffee: [[2, 8], [5]], tea: [[0, 9], []], conf: [[2, 11], [3]], snacks: [[4, 7], [9]], drinks: [[5, 6], [7]], grocery: [[1, 8], [4]] };

// [id, категорія, назва, name, прайс за одиницю, частка собівартості в прайсі, популярність, спорідненість каналам {канал: множник}, з місяця, до місяця]
const SKU = [
  ['cf-beans', 'coffee', 'Кава зернова арабіка, 1 кг', 'Arabica coffee beans, 1 kg', 820, 0.58, 1, { horeca: 2, trad: 0.6, ecom: 1.4, whole: 0.8 }],
  ['cf-ground', 'coffee', 'Кава мелена, 250 г', 'Ground coffee, 250 g', 185, 0.6, 1.6],
  ['cf-ground5', 'coffee', 'Кава мелена, 500 г', 'Ground coffee, 500 g', 345, 0.6, 0.7, {}, 0, 12],
  ['cf-inst', 'coffee', 'Кава розчинна, 100 г', 'Instant coffee, 100 g', 265, 0.62, 1.3, { trad: 1.4 }],
  ['cf-caps', 'coffee', 'Кава в капсулах, 10 шт', 'Coffee capsules, 10 pcs', 220, 0.55, 0.8, { ecom: 2.2, trad: 0.4 }],
  ['cf-horeca', 'coffee', 'Кава для кав’ярень, 1 кг', 'Espresso blend for cafés, 1 kg', 690, 0.6, 1.2, { horeca: 4, chain: 0, trad: 0, ecom: 0.15, whole: 0.25 }],
  ['cf-drip', 'coffee', 'Дрип-кава, 10 шт', 'Drip coffee bags, 10 pcs', 160, 0.57, 0.6, { ecom: 1.8 }],
  ['cf-pl', 'coffee', 'Кава мелена, власна марка мережі, 250 г', 'Ground coffee, retailer’s own brand, 250 g', 150, 0.86, 1.4, { pl: 1 }, 14],
  ['tea-black', 'tea', 'Чай чорний, 100 пакетиків', 'Black tea, 100 bags', 195, 0.58, 1.2],
  ['tea-green', 'tea', 'Чай зелений, 50 пакетиків', 'Green tea, 50 bags', 120, 0.57, 0.8],
  ['tea-herbal', 'tea', 'Чай трав’яний, 20 пакетиків', 'Herbal tea, 20 bags', 75, 0.55, 0.7],
  ['tea-loose', 'tea', 'Чай листовий, 250 г', 'Loose leaf tea, 250 g', 230, 0.56, 0.6, { horeca: 1.6 }],
  ['tea-horeca', 'tea', 'Чай для HoReCa, 100 пірамідок', 'Tea pyramids for cafés, 100 pcs', 410, 0.6, 0.8, { horeca: 3, chain: 0, trad: 0, ecom: 0.1, whole: 0.2 }],
  ['cn-dark', 'conf', 'Шоколад чорний, 90 г', 'Dark chocolate, 90 g', 62, 0.63, 1.1],
  ['cn-milk', 'conf', 'Шоколад молочний, 90 г', 'Milk chocolate, 90 g', 55, 0.64, 1.3],
  ['cn-box', 'conf', 'Цукерки в коробці, 200 г', 'Boxed chocolates, 200 g', 185, 0.6, 0.9],
  ['cn-oat', 'conf', 'Печиво вівсяне, 400 г', 'Oat cookies, 400 g', 78, 0.66, 1, { trad: 1.3 }],
  ['cn-wafer', 'conf', 'Вафлі, 300 г', 'Wafers, 300 g', 64, 0.67, 0.9, { trad: 1.4 }],
  ['cn-bar', 'conf', 'Протеїновий батончик, 40 г', 'Protein bar, 40 g', 48, 0.55, 0.6, { ecom: 1.8, horeca: 0.6 }],
  ['cn-pl', 'conf', 'Печиво, власна марка мережі, 400 г', 'Cookies, retailer’s own brand, 400 g', 52, 0.85, 1.2, { pl: 1 }, 15],
  ['sn-chips', 'snacks', 'Чипси картопляні, 130 г', 'Potato chips, 130 g', 58, 0.6, 1.3],
  ['sn-nuts', 'snacks', 'Горіхи асорті, 150 г', 'Mixed nuts, 150 g', 135, 0.66, 0.8, { horeca: 0.8 }],
  ['sn-crack', 'snacks', 'Крекери, 180 г', 'Crackers, 180 g', 42, 0.62, 0.9],
  ['sn-dried', 'snacks', 'Сухофрукти, 200 г', 'Dried fruit, 200 g', 98, 0.64, 0.6],
  ['sn-pop', 'snacks', 'Попкорн, 90 г', 'Popcorn, 90 g', 39, 0.58, 0.5],
  ['sn-seeds', 'snacks', 'Насіння соняшнику, 200 г', 'Sunflower seeds, 200 g', 44, 0.65, 0.8, { trad: 1.6 }],
  ['sn-sticks', 'snacks', 'Кукурудзяні палички, 100 г', 'Corn sticks, 100 g', 26, 0.6, 0.5, {}, 0, 7],
  ['dr-water', 'drinks', 'Вода мінеральна, 1,5 л', 'Mineral water, 1.5 l', 24, 0.62, 1.3],
  ['dr-juice', 'drinks', 'Сік яблучний, 1 л', 'Apple juice, 1 l', 58, 0.62, 1],
  ['dr-lemon', 'drinks', 'Лимонад, 0,5 л', 'Lemonade, 0.5 l', 32, 0.56, 0.9],
  ['dr-icetea', 'drinks', 'Холодний чай, 0,5 л', 'Iced tea, 0.5 l', 36, 0.58, 0.7],
  ['dr-energy', 'drinks', 'Енергетичний напій, 0,25 л', 'Energy drink, 0.25 l', 42, 0.55, 0.8, { trad: 1.3 }],
  ['dr-syrup', 'drinks', 'Сироп для кави, 0,7 л', 'Coffee syrup, 0.7 l', 245, 0.55, 0.5, { horeca: 3.5, trad: 0.2 }],
  ['dr-pl', 'drinks', 'Вода, власна марка мережі, 1,5 л', 'Water, retailer’s own brand, 1.5 l', 18, 0.87, 1.3, { pl: 1 }, 16],
  ['gr-pasta', 'grocery', 'Макарони, 800 г', 'Pasta, 800 g', 62, 0.68, 1.1],
  ['gr-rice', 'grocery', 'Рис, 1 кг', 'Rice, 1 kg', 78, 0.7, 1],
  ['gr-oil', 'grocery', 'Олія оливкова, 0,5 л', 'Olive oil, 0.5 l', 310, 0.66, 0.7],
  ['gr-buck', 'grocery', 'Гречка, 1 кг', 'Buckwheat, 1 kg', 72, 0.71, 1],
  ['gr-sugar', 'grocery', 'Цукор, 1 кг', 'Sugar, 1 kg', 38, 0.74, 0.9],
  ['gr-flour', 'grocery', 'Борошно, 2 кг', 'Flour, 2 kg', 54, 0.72, 0.8],
  ['gr-sauce', 'grocery', 'Соус томатний, 450 г', 'Tomato sauce, 450 g', 52, 0.62, 0.7],
];
// Власний тренд попиту товару (річний): дешевші й базові позиції ростуть швидше за преміальні
const PGROW = {
  'cf-beans': -0.06, 'cf-ground': 0.04, 'cf-inst': 0.02, 'cf-caps': 0.16, 'cf-horeca': 0.02, 'cf-drip': 0.1,
  'tea-black': -0.03, 'tea-green': 0.02, 'tea-herbal': 0.06, 'tea-loose': -0.04, 'tea-horeca': 0.02,
  'cn-dark': 0.02, 'cn-milk': 0.04, 'cn-box': -0.08, 'cn-oat': 0.06, 'cn-wafer': 0.08, 'cn-bar': 0.2,
  'sn-chips': 0.06, 'sn-nuts': -0.04, 'sn-crack': 0.06, 'sn-dried': 0.02, 'sn-pop': 0.04, 'sn-seeds': 0.08,
  'dr-water': 0.1, 'dr-lemon': 0.05, 'dr-icetea': 0.06, 'dr-energy': 0.18, 'dr-syrup': 0.04,
  'gr-pasta': 0.12, 'gr-rice': 0.1, 'gr-oil': -0.05, 'gr-buck': 0.12, 'gr-sugar': 0.16, 'gr-flour': 0.12, 'gr-sauce': 0.06,
};
export const PRODUCTS = SKU.map(([id, cat, uk, en, list, cr, pop, aff = {}, from = 0, to = NM], i) => ({ i, id, cat, ci: CAT_I[cat], uk, en, list, cr, pop, aff, from, to, pl: !!aff.pl, g: (PGROW[id] || 0) - 0.045 }));

export const CHANNELS = [
  { id: 'chain', uk: 'Мережі', en: 'Retail chains' },
  { id: 'trad', uk: 'Традиційна роздріб', en: 'Independent stores' },
  { id: 'horeca', uk: 'HoReCa', en: 'HoReCa' },
  { id: 'ecom', uk: 'Онлайн', en: 'Online' },
  { id: 'whole', uk: 'Субдистриб’ютори', en: 'Sub-distributors' },
];
const CH_I = Object.fromEntries(CHANNELS.map((c, i) => [c.id, i]));
// Витрати на обслуговування клієнта (нижче валового прибутку): логістика (частка виручки, росте з відстанню від складу),
// мерчандайзинг, комісія майданчика, вартість відстрочки (дні × 18% річних) і фіксована сума на місяць
export const CTS = {
  chain: { log: 0.014, km: 600, merch: 0.025, fee: 0, days: 60, fixed: 40000 },
  trad: { log: 0.045, km: 400, merch: 0, fee: 0, days: 14, fixed: 4000 },
  horeca: { log: 0.035, km: 450, merch: 0.01, fee: 0, days: 21, fixed: 4500 },
  ecom: { log: 0.04, km: 1500, merch: 0, fee: 0.12, days: 12, fixed: 25000 },
  whole: { log: 0.009, km: 700, merch: 0, fee: 0, days: 45, fixed: 12000 },
};
export const RATE = 0.18;

const TEAMS = {
  kyiv: ['kyc', 'kyo'], west: ['lvi', 'zak', 'ivf', 'chv'], northwest: ['vol', 'riv', 'ter', 'zhy'], podillia: ['vin', 'khm'],
  center: ['che', 'kir', 'pol'], north: ['chn', 'sum'], east: ['kha'], dnipro: ['dni', 'zap'], south: ['ode', 'myk'],
};
const TEAM_OF = Object.fromEntries(Object.entries(TEAMS).flatMap(([t, rs]) => rs.map(r => [r, t])));
// [id, ім’я, name, команда, додаткова знижка 2026 року (частка прайсу)]
const MGR = [
  ['olena', 'Олена К.', 'Olena K.', 'kam1', 0.01], ['andrii', 'Андрій М.', 'Andrii M.', 'kam2', 0.032],
  ['yuliia', 'Юлія Б.', 'Yuliia B.', 'ecom', 0.012], ['viktor', 'Віктор Ш.', 'Viktor Sh.', 'northwest', 0.012],
  ['iryna', 'Ірина П.', 'Iryna P.', 'kyiv', 0.008], ['nataliia', 'Наталія С.', 'Nataliia S.', 'west', -0.004],
  ['serhii', 'Сергій Т.', 'Serhii T.', 'podillia', 0.006], ['maksym', 'Максим Д.', 'Maksym D.', 'center', 0.014],
  ['oleh', 'Олег В.', 'Oleh V.', 'north', 0.005], ['dmytro', 'Дмитро Л.', 'Dmytro L.', 'east', 0.05],
  ['maryna', 'Марина Р.', 'Maryna R.', 'dnipro', 0.03], ['tetiana', 'Тетяна Г.', 'Tetiana H.', 'south', 0.04],
];
export const MANAGERS = MGR.map(([id, uk, en, team, drift], i) => ({ i, id, uk, en, team, drift }));
const MGR_OF_TEAM = Object.fromEntries(MANAGERS.map(m => [m.team, m.i]));

// Мережі: [літера, масштаб (прайс на місяць у найбільшому регіоні), регіони або кількість найбільших, з місяця]
const CHAINS = [
  ['A', 2.4e6, 20, 0], ['B', 1.7e6, 16, 0], ['C', 1.2e6, 12, 0],
  ['D', 0.7e6, ['lvi', 'ivf', 'ter', 'zak', 'chv', 'vol', 'riv'], 0], ['E', 0.65e6, ['kha', 'dni', 'zap', 'pol', 'sum'], 0],
  ['F', 0.55e6, ['ode', 'myk', 'kir'], 0], ['G', 0.5e6, ['kyc', 'kyo', 'che', 'zhy', 'vin'], 0],
  ['H', 0.4e6, ['kyc', 'kyo', 'kha', 'dni', 'ode', 'lvi', 'zap', 'vin', 'pol', 'che'], 15],
];

export const DEFAULT_KNOBS = { costK: 0.8, listK: 1.145, driftK: 1, grow: -0.0401, scale: 1, gChain: 0.08, gTrad: -0.1, gEcom: 0.12, gWhole: 0.05, gHoreca: 0.03, dEl: 2 };

function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const norm = () => { let u = 0; while (!u) u = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next()); };
  const pick = (arr, w) => { const s = w.reduce((x, y) => x + y, 0); let r = next() * s; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
  return { next, norm, pick, int: (a0, b0) => a0 + Math.floor(next() * (b0 - a0 + 1)) };
}

const interp = (pts, t) => { for (let k = 1; k < COST_T.length; k++) if (t <= COST_T[k]) { const a = COST_T[k - 1], b = COST_T[k]; return pts[k - 1] + (pts[k] - pts[k - 1]) * (t - a) / (b - a); } return pts[pts.length - 1]; };

export function buildData(K0 = {}) {
  const K = { ...DEFAULT_KNOBS, ...K0 };
  const R = rng(20261127);
  // Індекси прайсу й собівартості за категоріями і місяцями
  const listIdx = CATS.map(c => MONTHS.map((_, t) => LIST[c.id].reduce((v, [m, f]) => (t >= m ? v * (1 + (f - 1) * K.listK) : v), 1)));
  const costIdx = CATS.map(c => MONTHS.map((_, t) => 1 + (interp(COST[c.id], t) - 1) * K.costK));
  const regionW = {};
  for (const c of CITIES) regionW[c.region] = (regionW[c.region] || 0) + c.w;
  const regionsByW = Object.keys(regionW).sort((a, b) => regionW[b] - regionW[a]);
  const mainCity = Object.fromEntries(regionsByW.map(r => [r, CITIES.filter(c => c.region === r).sort((a, b) => b.w - a.w)[0]]));
  const maxW = regionW[regionsByW[0]];
  const REG_GROW = { kha: 0.05, dni: 0.04, zap: 0.02, ode: 0.03, myk: 0.03, sum: 0.01, lvi: 0.08, ivf: 0.08, ter: 0.08, chv: 0.08, zak: 0.08, vol: 0.08, riv: 0.08 };

  const customers = [];
  const add = o => { o.i = customers.length; o.mgr = o.mgr ?? MGR_OF_TEAM[TEAM_OF[o.region]]; customers.push(o); return o; };
  const cityPick = (bias = 1) => R.pick(CITIES, CITIES.map(c => c.w ** bias));
  // мережі: один рахунок на регіон присутності, місто рахунку: найбільше місто регіону
  for (const [L, scale, regs, from] of CHAINS) {
    const list = Array.isArray(regs) ? regs : regionsByW.slice(0, regs);
    list.forEach((r, k) => {
      const city = mainCity[r];
      const late = L === 'B' && k >= 14 ? 13 : from;
      add({ ch: 'chain', kind: 'chain', parent: 'chain-' + L, uk: `Мережа ${L} · ${city.uk}`, en: `Chain ${L} · ${city.en}`, city: city.id, region: r,
        size: scale * (regionW[r] / maxW) ** 0.75 * Math.exp(R.norm() * 0.15), start: late, end: NM, mgr: 'ADF'.includes(L) ? 0 : 1,
        disc: 0.115 + R.next() * 0.03 + (L === 'H' ? 0.02 : 0), retro: L === 'H' ? 0.06 : 0.04, pl: L === 'A' || L === 'H',
        g: K.gChain + R.norm() * 0.04 + (REG_GROW[r] || 0) });
    });
  }
  // традиційна роздріб: магазини, частіше в менших містах; частина закривається, кілька нових
  for (let k = 0; k < 172; k++) {
    const city = cityPick(0.75), lost = R.next() < 0.11 * (TEAM_OF[city.region] === 'west' ? 0.55 : 1), isNew = !lost && R.next() < 0.05;
    add({ ch: 'trad', kind: 'store', uk: `Магазин ${String(k + 1).padStart(3, '0')} · ${city.uk}`, en: `Store ${String(k + 1).padStart(3, '0')} · ${city.en}`, city: city.id, region: city.region,
      size: 75000 * Math.exp(R.norm() * 0.55), start: isNew ? R.int(12, 19) : 0, end: lost ? R.int(5, 19) : NM, disc: 0.02 + R.next() * 0.025, retro: 0,
      g: K.gTrad + R.norm() * 0.06 + (REG_GROW[city.region] || 0) * 0.5 });
  }
  // HoReCa: кав’ярні, ресторани, готелі
  const HK = [['cafe', 'Кав’ярня', 'Café', 64000, 0.6], ['rest', 'Ресторан', 'Restaurant', 100000, 0.25], ['hotel', 'Готель', 'Hotel', 160000, 0.15]];
  for (let k = 0; k < 72; k++) {
    const [kind, ku, ke, sz] = R.pick(HK, HK.map(h => h[4])), city = cityPick(1.1), lost = R.next() < 0.08, isNew = !lost && R.next() < 0.08;
    add({ ch: 'horeca', kind, uk: `${ku} ${String(k + 1).padStart(2, '0')} · ${city.uk}`, en: `${ke} ${String(k + 1).padStart(2, '0')} · ${city.en}`, city: city.id, region: city.region,
      size: sz * Math.exp(R.norm() * 0.45), start: isNew ? R.int(12, 18) : 0, end: lost ? R.int(6, 18) : NM, disc: 0.06 + R.next() * 0.03, retro: 0,
      g: K.gHoreca + R.norm() * 0.06 + (REG_GROW[city.region] || 0) * 0.5 });
  }
  // онлайн: замовлення маркетплейсів і власного магазину за регіоном доставки
  regionsByW.slice(0, 12).forEach(r => {
    const city = mainCity[r], s = (regionW[r] / maxW) ** 0.7;
    add({ ch: 'ecom', kind: 'mpA', uk: `Маркетплейс A · ${city.uk}`, en: `Marketplace A · ${city.en}`, city: city.id, region: r, size: 0.8e6 * s, start: 0, end: NM, disc: 0.06, retro: 0, fee: 0.12, mgr: 2, g: K.gEcom + R.norm() * 0.05 });
    add({ ch: 'ecom', kind: 'mpB', uk: `Маркетплейс B · ${city.uk}`, en: `Marketplace B · ${city.en}`, city: city.id, region: r, size: 0.18e6 * s, start: 8, end: NM, disc: 0.065, retro: 0, fee: 0.12, mgr: 2, g: K.gEcom + 0.08 + R.norm() * 0.06 });
    add({ ch: 'ecom', kind: 'shop', uk: `Інтернет-магазин · ${city.uk}`, en: `Online store · ${city.en}`, city: city.id, region: r, size: 0.3e6 * s, start: 0, end: NM, disc: 0.03, retro: 0, fee: 0.025, mgr: 2, g: K.gEcom - 0.07 + R.norm() * 0.05 });
  });
  // субдистриб’ютори: основне зростання на сході й півдні, шість нових у 2026 році
  const SUB = ['kharkiv', 'dnipro', 'zaporizhzhia', 'odesa', 'mykolaiv', 'poltava', 'vinnytsia', 'lviv', 'chernihiv', 'kropyvnytskyi', 'sumy', 'cherkasy', 'kryvyirih', 'khmelnytskyi',
    'kharkiv', 'zaporizhzhia', 'mykolaiv', 'odesa', 'poltava', 'sumy'];
  SUB.forEach((cid, k) => {
    const city = CITY[cid], isNew = k >= 17, lost = k === 8;
    add({ ch: 'whole', kind: 'sub', uk: `Субдистриб’ютор ${String(k + 1).padStart(2, '0')} · ${city.uk}`, en: `Sub-distributor ${String(k + 1).padStart(2, '0')} · ${city.en}`, city: city.id, region: city.region,
      size: 1.0e6 * Math.exp(R.norm() * 0.3) * (isNew ? 0.55 : 1), start: isNew ? R.int(12, 16) : 0, end: lost ? R.int(10, 14) : NM, disc: 0.17 + R.next() * 0.03, retro: 0.02,
      g: K.gWhole + R.norm() * 0.05 + (REG_GROW[city.region] || 0) });
  });
  for (const c of customers) {
    if (typeof c.mgr === 'string') c.mgr = MGR_OF_TEAM[c.mgr];
    c.ci = CH_I[c.ch];
    c.cityI = CITY[c.city].i;
  }

  // Асортимент: пари товар × клієнт з частками обсягу
  const NAFF = { chain: [26, 32], trad: [9, 15], horeca: [6, 10], ecom: [24, 31], whole: [19, 27] };
  const P = [], C = [], W = [], PS = [], PE = [];
  for (const c of customers) {
    const cand = PRODUCTS.filter(p => (p.pl ? c.pl : true) && (p.aff[c.ch] ?? 1) > 0 && !(c.ch === 'horeca' && ['grocery', 'snacks'].includes(p.cat) && p.id !== 'sn-nuts'));
    const [lo, hi] = NAFF[c.ch], n = Math.min(cand.length, R.int(lo, hi));
    const pool = cand.slice(), ws = pool.map(p => p.pop * (p.aff[c.ch] ?? 1) * (p.pl ? 1.5 : 1));
    const chosen = [];
    for (let k = 0; k < n && pool.length; k++) {
      const s = ws.reduce((a, b) => a + b, 0); let r = R.next() * s, j = 0;
      for (; j < pool.length - 1; j++) { r -= ws[j]; if (r <= 0) break; }
      chosen.push(pool[j]); pool.splice(j, 1); ws.splice(j, 1);
    }
    if (c.pl) for (const p of PRODUCTS) if (p.pl && !chosen.includes(p)) chosen.push(p);
    const wsum = chosen.reduce((a, p) => a + p.pop * (p.aff[c.ch] ?? 1) * Math.exp(R.norm() * 0.35), 0);
    for (const p of chosen) {
      const w = p.pop * (p.aff[c.ch] ?? 1) * Math.exp(R.norm() * 0.35) / wsum;
      // зміни асортименту в чинних клієнтів: частину позицій додано у 2026 році, частину виведено
      const u = R.next();
      const ps = Math.max(c.start, p.from, u < 0.02 && c.start === 0 ? R.int(12, 18) : 0);
      const pe = Math.min(c.end, p.to, u > 0.98 ? R.int(6, 16) : NM);
      if (pe <= ps) continue;
      P.push(p.i); C.push(c.i); W.push(w); PS.push(ps); PE.push(pe);
    }
  }
  const n = P.length;
  const q = new Float64Array(n * NM), r = new Float64Array(n * NM), c0 = new Float64Array(n * NM), L = new Float64Array(n * NM);
  const dI = new Float64Array(n * NM), dP = new Float64Array(n * NM), dR = new Float64Array(n * NM), dD = new Float64Array(n * NM);
  const chSeason = { horeca: [0.92, 0.92, 0.96, 1, 1.04, 1.1, 1.14, 1.12, 1.02, 0.98, 0.96, 1.08], chain: [0.96, 0.94, 1, 1, 1, 0.98, 0.98, 1, 1, 1.02, 1.04, 1.12], ecom: [1, 0.96, 1, 0.98, 0.96, 0.94, 0.94, 0.96, 1, 1.04, 1.16, 1.18] };
  const custNoise = customers.map(() => MONTHS.map(() => Math.exp(R.norm() * 0.05)));
  for (let i = 0; i < n; i++) {
    const p = PRODUCTS[P[i]], cu = customers[C[i]], m = MANAGERS[cu.mgr];
    const listU = p.list, costU = p.list * p.cr * (cu.ch === 'horeca' && p.aff.horeca > 2 ? 1.02 : 1);
    const baseQ = cu.size * W[i] / listU * K.scale;
    const g = cu.g + K.grow + p.g;
    for (let t = PS[i]; t < PE[i]; t++) {
      const mo = t % 12, y = t >= Y1 ? 1 : 0;
      const ramp = y ? Math.min(1, (t - Y1 + 1) / 3) : 0;
      const drift = p.pl ? 0 : m.drift * K.driftK * ramp;
      const promoOn = p.pl ? false : cu.ch === 'chain' ? (PROMO[p.cat][0].includes(mo) || (y && PROMO[p.cat][1].includes(mo))) : cu.ch === 'ecom' ? (mo === 2 || mo === 10 || (y && mo === 5)) : false;
      const promo = promoOn ? (cu.ch === 'chain' ? (y ? 0.12 : 0.1) : 0.07) : 0;
      // власна марка мережі: контрактна ціна без знижок рахунку, промо й ретробонусу
      const retro = p.pl ? 0 : cu.retro ? cu.retro + (y && cu.ch === 'chain' ? 0.005 : 0) : 0;
      const inv = p.pl ? 0.04 : Math.max(0, cu.disc + drift);
      let qq = baseQ * SEASON[p.cat][mo] * (chSeason[cu.ch] ? chSeason[cu.ch][mo] : 1) * (1 + g) ** ((t - 6) / 12) * custNoise[cu.i][t] * Math.exp(R.norm() * 0.1);
      qq *= (1 + 3.2 * promo) * (1 + K.dEl * Math.max(0, drift));
      if (t - PS[i] < 2 && PS[i] > 0) qq *= 0.55 + 0.25 * (t - PS[i]);   // нова позиція виходить на рівень за кілька місяців
      qq = Math.round(qq);
      if (qq <= 0) continue;
      const lp = listU * listIdx[p.ci][t], k = i * NM + t;
      const net = lp * (1 - inv - promo - retro);
      q[k] = qq; L[k] = qq * lp; dI[k] = qq * lp * inv; dP[k] = qq * lp * promo; dR[k] = qq * lp * retro; dD[k] = qq * lp * Math.max(0, Math.min(inv, drift));
      r[k] = qq * net; c0[k] = qq * costU * costIdx[p.ci][t];
    }
  }
  // відстань до найближчого відкритого складу для кожного міста і місяця (Дніпро відкрито у вересні 2025 року)
  const hubKm = CITIES.map(ct => MONTHS.map((_, t) => Math.min(...HUBS.filter(h => t >= h.from).map(h => dist(ct, CITY[h.city])))));
  return { pairs: { p: Int16Array.from(P), c: Int16Array.from(C), n }, q, r, c: c0, L, dI, dP, dR, dD, customers, hubKm, listIdx, costIdx };
}

// Витрати на обслуговування клієнта за місяць (гривні) для виручки rev
export function ctsOf(cu, rev, t, hubKm) {
  if (!(rev > 0)) return 0;
  const s = CTS[cu.ch], km = hubKm[cu.cityI][t];
  return rev * (s.log * (1 + km / s.km) + s.merch + (cu.fee ?? s.fee) + (s.days / 365) * RATE) + s.fixed;
}
