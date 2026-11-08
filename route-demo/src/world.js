// Синтетичний регіон для демо планування маршрутів (близько 150 на 100 км).
// Річка Ясна ділить його на два береги: три мости (один старий, до 10 т) і сезонний пором.
// Населені пункти: 12 опорних і близько 46 сіл, розкиданих із мінімальною відстанню між ними.
// Дороги: граф відносного сусідства (RNG) окремо на кожному березі, кілька додаткових ребер для кілець,
// переправи і класи доріг за коридорами між містами. Клієнти й замовлення дня генеруються з зерном.
import { mulberry32, dist, smooth, bendy, crossesLine, inside, distLine, polyLen, ellipse } from './geo.js';

export const BOX = { w: 150, h: 100 };
const rnd = mulberry32(20261108);

// ——— межі регіону: плавний неправильний контур ———
const REG_CTRL = [[7, 50], [9, 63], [6, 76], [11, 88], [21, 95], [33, 97], [45, 95], [57, 99], [70, 96], [83, 98], [96, 95], [109, 97], [122, 95], [134, 96], [143, 89], [145, 77], [141, 65], [146, 53], [144, 41], [147, 30], [142, 18], [135, 8], [122, 4], [108, 6], [95, 2], [82, 5], [68, 3], [55, 6], [42, 3], [29, 6], [17, 4], [8, 12], [5, 25], [9, 37]];
export const REGION = (() => {
  const c = [...REG_CTRL.slice(-2), ...REG_CTRL, ...REG_CTRL.slice(0, 3)];
  const s = smooth(c, 5);
  return s.slice(10, s.length - 14);
})();

// ——— річка Ясна: з півночі на південний схід, через обласний центр ———
const RIVER_CTRL = [[56, 106], [58, 96], [63, 88], [61, 80], [64.5, 71], [70, 62], [71.5, 56], [73, 50], [76.5, 43], [79.5, 36], [82, 30], [85.5, 23], [89.5, 16], [93, 8], [98, -6]];
export const RIVER = smooth(RIVER_CTRL, 10);
export function riverX(y) {
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i], b = RIVER[i + 1];
    if ((a[1] >= y && b[1] <= y) || (a[1] <= y && b[1] >= y)) { const t = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * t; }
  }
  return y > 50 ? RIVER[0][0] : RIVER[RIVER.length - 1][0];
}
export const bankOf = p => (p[0] < riverX(p[1]) ? 'w' : 'e');

// ——— водосховище біля Озерного і лісові масиви ———
export const LAKE = ellipse(28.5, 15.5, 7.6, 4.1, 0.38, 44, 0.16, rnd);
const FOREST_BLOBS = [[121, 85, 13], [136, 70, 8], [104, 90, 7], [15, 48, 8], [19, 31, 6], [131, 15, 8], [99, 56, 6], [46, 80, 5], [58, 18, 5]];
export const forestAt = p => FOREST_BLOBS.reduce((m, [x, y, r]) => Math.max(m, Math.exp(-((p[0] - x) ** 2 + (p[1] - y) ** 2) / (2 * (r * 0.62) ** 2))), 0);
// хмара точок для лісів: густіше в центрі масиву
export const FOREST_PTS = (() => {
  const out = [];
  FOREST_BLOBS.forEach(([x, y, r]) => {
    const n = Math.round(r * r * 2.4);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = r * Math.sqrt(-2 * Math.log(1 - rnd() * 0.93)) * 0.48;
      const p = [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.86];
      if (!inside(p, REGION) || distLine(p, RIVER) < 1.2 || inside(p, LAKE)) continue;
      out.push(p[0], p[1], rnd());
    }
  });
  return new Float32Array(out);
})();

// ——— населені пункти ———
const TOWNS = [
  ['yas', 'Ясногород', 'Yasnohorod', 66.5, 57.5, 126400, 'city'],
  ['zar', 'Заріччя', 'Zarichchia', 77, 56, 7800, 'town'],
  ['kle', 'Кленів', 'Kleniv', 116, 31, 27400, 'town'],
  ['sos', 'Сосновиця', 'Sosnovytsia', 25, 67, 22300, 'town'],
  ['oze', 'Озерне', 'Ozerne', 40, 23.5, 16900, 'town'],
  ['vys', 'Вишнегір’я', 'Vyshnehiria', 112.5, 76.5, 11200, 'town'],
  ['mos', 'Мостище', 'Mostyshche', 55, 87, 4100, 'small'],
  ['vso', 'Високе', 'Vysoke', 70, 90, 1800, 'small'],
  ['kbr', 'Кам’яний Брід', 'Kamianyi Brid', 76, 34.5, 2900, 'small'],
  ['sta', 'Ставки', 'Stavky', 89, 37, 2300, 'small'],
  ['por', 'Поромне', 'Poromne', 82.5, 15, 1500, 'small'],
  ['per', 'Перевіз', 'Pereviz', 97.5, 17.5, 900, 'small'],
];
const VILLAGE_NAMES = [
  ['Березівка', 'Berezivka'], ['Вишневе', 'Vyshneve'], ['Калинівка', 'Kalynivka'], ['Дубове', 'Dubove'], ['Кленове', 'Klenove'],
  ['Липове', 'Lypove'], ['Яблунівка', 'Yablunivka'], ['Грушівка', 'Hrushivka'], ['Світле', 'Svitle'], ['Зоряне', 'Zoriane'],
  ['Привільне', 'Pryvilne'], ['Степове', 'Stepove'], ['Луки', 'Luky'], ['Підгір’я', 'Pidhiria'], ['Новоселиця', 'Novoselytsia'],
  ['Мирне', 'Myrne'], ['Тополі', 'Topoli'], ['Вербове', 'Verbove'], ['Горіхове', 'Horikhove'], ['Ромашки', 'Romashky'],
  ['Сонячне', 'Soniachne'], ['Затишне', 'Zatyshne'], ['Квітневе', 'Kvitneve'], ['Медове', 'Medove'], ['Гайове', 'Haiove'],
  ['Лісне', 'Lisne'], ['Дібрівка', 'Dibrivka'], ['Криниці', 'Krynytsi'], ['Джерельне', 'Dzherelne'], ['Кам’янка', 'Kamianka'],
  ['Піщане', 'Pishchane'], ['Білогір’я', 'Bilohiria'], ['Широке', 'Shyroke'], ['Долинське', 'Dolynske'], ['Озерці', 'Ozertsi'],
  ['Млинівка', 'Mlynivka'], ['Пасічне', 'Pasichne'], ['Вільхове', 'Vilkhove'], ['Осикове', 'Osykove'], ['Ясне', 'Yasne'],
  ['Чайки', 'Chaiky'], ['Лелеки', 'Leleky'], ['Журавлі', 'Zhuravli'], ['Соколівка', 'Sokolivka'], ['Глибоке', 'Hlyboke'],
  ['Рокитне', 'Rokytne'], ['Бузкове', 'Buzkove'], ['Злагода', 'Zlahoda'], ['Ковила', 'Kovyla'], ['Нивки', 'Nyvky'],
  ['Залісся', 'Zalissia'], ['Колосівка', 'Kolosivka'], ['Хмелівка', 'Khmelivka'], ['Травневе', 'Travneve'], ['Весняне', 'Vesniane'], ['Посад', 'Posad'],
];

export const NODES = (() => {
  const nodes = TOWNS.map(([id, uk, lat, x, y, pop, kind]) => ({ id, name: { uk, lat }, x, y, pop, kind }));
  // два села на коридорі між Сосновицею і Ясногородом, щоб траса йшла прямо
  const vil = [[39, 63.6], [52.6, 60.4]];
  for (let k = 0; k < 12000 && vil.length < 52; k++) {
    const p = [6 + rnd() * 140, 5 + rnd() * 92];
    if (!inside(p, REGION) || distLine(p, REGION, true) < 3.2) continue;
    if (distLine(p, RIVER) < 2.6) continue;
    if (inside(p, LAKE) || distLine(p, LAKE, true) < 2.2) continue;
    if (nodes.some(n => dist(p, [n.x, n.y]) < (n.kind === 'city' ? 9.5 : 7.2))) continue;
    if (vil.some(v => dist(p, v) < 7.9)) continue;
    if (rnd() < forestAt(p) * 0.8) continue;
    vil.push(p);
  }
  // назви за положенням із півночі на південь, щоб список був стабільним
  vil.sort((a, b) => b[1] - a[1] || a[0] - b[0]).forEach((p, i) => {
    const [uk, lat] = VILLAGE_NAMES[i % VILLAGE_NAMES.length], u = rnd();
    nodes.push({ id: 'v' + String(i + 1).padStart(2, '0'), name: { uk, lat }, x: +p[0].toFixed(2), y: +p[1].toFixed(2), pop: Math.round((260 + 2600 * u * u * u + 380 * rnd()) / 10) * 10, kind: 'village' });
  });
  nodes.forEach((n, i) => { n.i = i; n.bank = bankOf([n.x, n.y]); });
  return nodes;
})();
export const NODE = new Map(NODES.map(n => [n.id, n]));
export const P = n => [n.x, n.y];

// ——— дороги ———
export const SPEED = { 1: 85, 2: 65, 3: 48, 4: 30 };
const BEND = { 1: 0.012, 2: 0.024, 3: 0.042, 4: 0.065 };
const validSeg = (A, B) => !crossesLine(A, B, RIVER) && !crossesLine(A, B, LAKE, true) && !crossesLine(A, B, REGION, true);

function bankEdges(ids) {
  const pts = ids.map(i => P(NODES[i]));
  const out = [], n = ids.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const d = dist(pts[a], pts[b]);
    if (d > 30) continue;
    let rng = true, gab = true;
    const mid = [(pts[a][0] + pts[b][0]) / 2, (pts[a][1] + pts[b][1]) / 2];
    for (let c = 0; c < n && (rng || gab); c++) {
      if (c === a || c === b) continue;
      if (Math.max(dist(pts[a], pts[c]), dist(pts[b], pts[c])) < d) rng = false;
      if (dist(mid, pts[c]) < d / 2) gab = false;
    }
    if (!validSeg(pts[a], pts[b])) continue;
    if (rng || (gab && d < 19 && rnd() < 0.72)) out.push([ids[a], ids[b]]);
  }
  return out;
}

export const EDGES = (() => {
  const W = NODES.filter(n => n.bank === 'w').map(n => n.i), E = NODES.filter(n => n.bank === 'e').map(n => n.i);
  const pairs = [...bankEdges(W), ...bankEdges(E)];
  const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
  const seen = new Set(pairs.map(([a, b]) => key(a, b)));
  // зв'язність кожного берега: якщо відкинуті ребра розірвали граф, з'єднуємо найкоротшим допустимим
  const connect = ids => {
    for (;;) {
      const comp = new Map(ids.map(i => [i, i]));
      const find = x => (comp.get(x) === x ? x : (comp.set(x, find(comp.get(x))), comp.get(x)));
      pairs.forEach(([a, b]) => { if (comp.has(a) && comp.has(b)) comp.set(find(a), find(b)); });
      const roots = new Set(ids.map(find));
      if (roots.size <= 1) return;
      let best = null;
      for (const a of ids) for (const b of ids) {
        if (find(a) === find(b) || a >= b) continue;
        const d = dist(P(NODES[a]), P(NODES[b]));
        if ((!best || d < best[2]) && validSeg(P(NODES[a]), P(NODES[b]))) best = [a, b, d];
      }
      if (!best) return;
      pairs.push([best[0], best[1]]); seen.add(key(best[0], best[1]));
    }
  };
  connect(W); connect(E);
  const edges = pairs.map(([a, b]) => ({ a, b, cls: 3 }));
  // переправи через Ясну
  const id = s => NODE.get(s).i;
  edges.push({ a: id('mos'), b: id('vso'), cls: 2, bridge: 'north' });
  edges.push({ a: id('yas'), b: id('zar'), cls: 1, bridge: 'city', speed: 42 });
  edges.push({ a: id('kbr'), b: id('sta'), cls: 3, bridge: 'old', maxT: 10 });
  edges.push({ a: id('por'), b: id('per'), cls: 3, ferry: true, maxT: 20 });

  // класи доріг за коридорами між містами (найкоротші шляхи за довжиною)
  const adj = NODES.map(() => []);
  edges.forEach((e, k) => { const d = dist(P(NODES[e.a]), P(NODES[e.b])); adj[e.a].push([e.b, k, d]); adj[e.b].push([e.a, k, d]); });
  const short = (s, t) => {
    const D = new Float64Array(NODES.length).fill(Infinity), via = new Int32Array(NODES.length).fill(-1), done = new Uint8Array(NODES.length);
    D[s] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < NODES.length; i++) if (!done[i] && D[i] < Infinity && (u < 0 || D[i] < D[u])) u = i;
      if (u < 0 || u === t) break;
      done[u] = 1;
      for (const [v, k, d] of adj[u]) { const w = d * (edges[k].ferry ? 9 : 1); if (D[u] + w < D[v]) { D[v] = D[u] + w; via[v] = k; } }
    }
    const out = [];
    for (let v = t; v !== s && via[v] >= 0;) { const e = edges[via[v]]; out.push(via[v]); v = e.a === v ? e.b : e.a; }
    return out;
  };
  const corr = (list, cls) => list.forEach(([s, t]) => short(id(s), id(t)).forEach(k => { if (!edges[k].ferry) edges[k].cls = Math.min(edges[k].cls, cls); }));
  corr([['sos', 'yas'], ['zar', 'kle']], 1);
  corr([['yas', 'oze'], ['yas', 'mos'], ['vso', 'vys'], ['zar', 'vys'], ['kle', 'vys'], ['oze', 'por'], ['kle', 'per'], ['yas', 'kbr'], ['sta', 'kle'], ['sos', 'oze'], ['sos', 'mos']], 2);
  // ґрунтові: у лісі або короткі між малими селами
  edges.forEach(e => {
    if (e.cls !== 3 || e.bridge || e.ferry) return;
    const A = NODES[e.a], B = NODES[e.b], mid = [(A.x + B.x) / 2, (A.y + B.y) / 2];
    if (forestAt(mid) > 0.42 || (A.kind === 'village' && B.kind === 'village' && A.pop < 900 && B.pop < 900 && rnd() < 0.35)) e.cls = 4;
  });
  edges.forEach((e, k) => {
    e.id = k;
    const A = P(NODES[e.a]), B = P(NODES[e.b]);
    e.pts = e.bridge || e.ferry ? [A, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], B] : bendy(A, B, BEND[e.cls], rnd);
    e.len = +(polyLen(e.pts) * (e.cls === 4 ? 1.08 : e.ferry ? 1 : 1.03)).toFixed(2);
    e.maxT = e.maxT || Infinity;
    // низинні ділянки біля річки: у повінь закриваються
    e.low = !e.bridge && !e.ferry && e.cls >= 3 && Math.min(...e.pts.map(p => distLine(p, RIVER))) < 3.4;
    e.kmh = e.speed || SPEED[e.cls];
  });
  return edges;
})();

export const ADJ = (() => {
  const adj = NODES.map(() => []);
  EDGES.forEach(e => { adj[e.a].push(e.id); adj[e.b].push(e.id); });
  return adj;
})();
export const other = (e, n) => (e.a === n ? e.b : e.a);
export const BRIDGE_EDGE = Object.fromEntries(EDGES.filter(e => e.bridge).map(e => [e.bridge, e.id]));
export const FERRY_EDGE = EDGES.find(e => e.ferry).id;

// час доступу всередині населеного пункту до адреси клієнта, хв
export const ACCESS = { city: 12, town: 6, small: 3, village: 2 };

// ——— автопарк і тарифи ———
export const TYPES = [
  { id: 'truck', cap: 33, mass: 40, speed: 0.88, fixed: 2200, driver: 300, fuel: 31, wear: 7 },
  { id: 'lorry', cap: 16, mass: 18, speed: 0.95, fixed: 1300, driver: 260, fuel: 21, wear: 4.5 },
  { id: 'van', cap: 6, mass: 3.5, speed: 1, fixed: 700, driver: 230, fuel: 12, wear: 2.5 },
];
export const FLEET0 = { truck: 3, lorry: 5, van: 4 };
export const FLEET_MAX = { truck: 6, lorry: 9, van: 9 };
export const DEPOTS0 = ['yas', 'kle'];
export const DEPOT_IDS = ['A', 'B', 'C'];
export const PARAMS0 = { fuel: 58, shift: 10 };
export const OPEN = 300; // склад відкривається о 05:00
export const DAY = [300, 1140]; // шкала розкладу 05:00–19:00
export const PEN = { late: 45, over: 25, unserved: 6000, pallet: 250 };
export const CO2_L = 2.68; // кг CO₂ на літр дизелю

// ——— клієнти і замовлення дня ———
export const KINDS = ['super', 'hosp', 'school', 'shop', 'hub'];
const SVC = { super: 25, hosp: 20, school: 15, shop: 10, hub: 15 };
const q15 = v => Math.round(v / 15) * 15;
export const CUSTOMERS = (() => {
  const r = mulberry32(77);
  const out = [];
  const add = (n, kind) => {
    const k = out.filter(c => c.node === n.i && c.kind === kind).length;
    const win = {
      super: () => { const a = q15(330 + r() * 45); return [a, a + q15(180 + r() * 30)]; },
      hosp: () => { const a = q15(390 + r() * 30); return [a, a + 210]; },
      school: () => { const a = q15(420 + r() * 30); return [a, a + q15(150 + r() * 30)]; },
      shop: () => { const a = q15(420 + r() * 120); return [a, a + q15(300 + r() * 60)]; },
      hub: () => { const a = q15(540 + r() * 60); return [a, a + q15(420 + r() * 60)]; },
    }[kind]();
    out.push({ id: n.id + '-' + kind + (k ? k + 1 : ''), node: n.i, kind, a: win[0], b: win[1] });
  };
  NODES.forEach(n => {
    if (n.kind === 'city') { add(n, 'super'); add(n, 'super'); add(n, 'hosp'); add(n, 'school'); }
    else if (n.kind === 'town' && n.pop > 10000) { add(n, 'super'); add(n, 'hosp'); add(n, 'school'); add(n, 'shop'); }
    else if (n.kind === 'town') { add(n, 'shop'); add(n, 'school'); }
    else if (n.kind === 'small') { add(n, 'shop'); if (r() < 0.6) add(n, 'school'); if (r() < 0.45) add(n, 'hub'); }
    else { if (r() < 0.72) add(n, 'shop'); if (n.pop > 900 && r() < 0.35) add(n, 'school'); if (r() < 0.14) add(n, 'hub'); }
  });
  out.forEach((c, i) => { c.i = i; });
  return out;
})();
export const CUST = new Map(CUSTOMERS.map(c => [c.id, c]));

const PROB = { super: 1, hosp: 0.95, school: 0.85, shop: 0.8, hub: 0.6 };
const PAL = { super: [6, 11], hosp: [2, 4], school: [1, 2], shop: [1, 3], hub: [1, 3] };
// замовлення дня: хто замовив і скільки палет (день 1 базовий; інші дні для кнопки «Інший день»)
export function dayOrders(day = 1) {
  const r = mulberry32(1000 + day * 7919);
  const out = {};
  CUSTOMERS.forEach(c => {
    const p = r(), q = r();
    if (p > PROB[c.kind]) return;
    const [lo, hi] = PAL[c.kind], vil = NODES[c.node].kind === 'village';
    out[c.id] = Math.max(1, Math.round(lo + (vil && c.kind === 'shop' ? 0.6 : 1) * (hi - lo) * q));
  });
  return out;
}
export const serviceMin = (c, pallets) => SVC[c.kind] + 3 * pallets + ACCESS[NODES[c.node].kind];
