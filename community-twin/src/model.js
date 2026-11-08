// Розрахунки цифрового двійника: показники паспорта зі статусом даних, сигнали, сценарії «що буде, якщо».
import {
  S, PLACES, BY_ID, IDX, TOTAL, OKRUGS, SCHOOLS, KGS, HEALTH, ADMIN, SHELTERS, POINTS, PUMPS, WATER, ROADS, LIGHT, BUILDINGS, LAND, BUDGET, ECONOMY,
  SOURCES, SRC_BY, POP_SERIES, OBJECTS, assignSchools, pupilsOf, sumAge, carT, floodAt, isStale, own, transfers, project, BANDS,
} from './world.js';

export const DOMAINS = ['territory', 'people', 'economy', 'edu', 'health', 'services', 'safety', 'data'];
const Y = 5;   // індекс 2026 року в рядах
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + f(x), 0);
const popOf = ids => sum(ids, id => BY_ID.get(id).pop);
const shareT = (key, th) => sum(PLACES, p => (p.t[key] != null && p.t[key] <= th ? p.pop : 0)) / TOTAL.pop;

// ——— паводки: розподіл Гумбеля з модуля рельєфу ———
export const GUMBEL = { mu: 1.0, beta: 1.1 };
export const annualChance = s => 1 - Math.exp(-Math.exp(-(s - GUMBEL.mu) / GUMBEL.beta));
export const returnPeriod = s => 1 / annualChance(s);
export const STAGE100 = GUMBEL.mu - GUMBEL.beta * Math.log(-Math.log(1 - 1 / 100));   // ≈ 6,1 м

// ——— пожежна безпека: державна частина в місті, місцеві команди в селищах ———
export const FIRE = [{ id: 'fire1', place: 'vrc', kind: 'state' }, { id: 'fire2', place: 'yas', kind: 'local' }, { id: 'fire3', place: 'oze', kind: 'local' }];
export const fireT = id => Math.min(...FIRE.map(f => carT(id, f.place))) + 2;

// ——— школи: розрахунок мережі (база і сценарії) ———
export const BUS_COST = 1100;          // тис. грн на рік за один шкільний автобус (водій, пальне, обслуговування)
export const BUS_SEATS = 90;           // три рейси по 30 місць
const busTime = (from, to) => (from === to ? 0 : carT(from, to) / 0.8 + 4);
export function schoolNet(states = {}) {
  const list = SCHOOLS.map(s => ({ ...s, type: states[s.id] === 'primary' ? 'primary' : s.type, closed: states[s.id] === 'close' }));
  const asg = assignSchools(list, s => !s.closed);
  const by = new Map(list.map(s => [s.id, s]));
  list.forEach(s => { s.pupils = 0; s.bands = { primary: 0, basic: 0, senior: 0 }; s.from = new Map(); s.moved = 0; });
  const trips = [];
  let tw = 0, maxT = 0, over30 = 0, over45 = 0, transported = 0, all = 0;
  for (const p of PLACES) for (const band of Object.keys(BANDS)) {
    const sid = asg.get(p.id)[band], s = by.get(sid), n = pupilsOf(p.age, band), t = busTime(p.id, s.place);
    s.pupils += n; s.bands[band] += n; s.from.set(p.id, (s.from.get(p.id) || 0) + n);
    all += n; tw += t * n;
    if (t > 0) { transported += n; s.moved += n; maxT = Math.max(maxT, t); }
    if (t > 30) over30 += n;
    if (t > 45) over45 += n;
    trips.push({ place: p.id, band, school: sid, t, n });
  }
  let cost = 0, shelter = 0, buses = 0, cap = 0;
  list.forEach(s => {
    s.pupils = Math.round(s.pupils);
    const grades = s.type === 'lyceum' ? 11 : s.type === 'gym' ? 9 : 4;
    s.classes = s.closed ? 0 : grades * Math.max(1, Math.ceil(s.pupils / grades / 28));
    s.cost = s.closed ? Math.round((1150 + s.area * 0.42) * 0.2) : Math.round(1150 + s.area * 0.42 + s.classes * 840);
    s.occ = s.closed ? 0 : s.pupils / s.cap;
    s.perPupil = s.pupils ? s.cost / s.pupils : 0;
    s.busNeed = s.closed ? 0 : Math.ceil(s.moved / BUS_SEATS);
    const staff = s.closed ? 0 : Math.round((s.classes * 1.55 + 3) * 1.35);
    s.shelterOk = s.closed ? 0 : Math.min(s.pupils, Math.max(0, s.shelterCap - staff));
    cost += s.cost; shelter += s.shelterOk; buses += s.busNeed;
    if (!s.closed) cap += s.cap;
  });
  const open = list.filter(s => !s.closed);
  return {
    list, trips, asg,
    tot: {
      pupils: Math.round(all), cost, buses, busCost: buses * BUS_COST, avgT: tw / all, maxT, over30, over45, transported,
      occ: all / cap, small: open.filter(s => s.occ < 0.4).length, over: open.filter(s => s.occ > 1).length, perPupil: cost / all, shelter: shelter / all, open: open.length,
    },
  };
}
export const BASE_NET = schoolNet({});

// ——— енергостійкість: блекаут заданої тривалості ———
export const GEN_COST = 420;           // тис. грн за генератор для насосної з підключенням
export function blackout(hours, { pumps = [], fuel = false, repair = false } = {}) {
  const pts = POINTS.map(p => ({ ...p, works: (!p.broken || repair) && hours <= p.hours * (fuel ? 2 : 1) }));
  const working = pts.filter(p => p.works);
  const placeOk = new Map(PLACES.map(pl => [pl.id, working.some(p => carT(pl.id, p.place) <= 10)]));
  const covered = sum(PLACES, pl => (placeOk.get(pl.id) ? pl.pop : 0));
  const pumpOn = new Map(PUMPS.map(w => [w.id, w.gen || pumps.includes(w.id)]));
  let conn = 0, wet = 0;
  WATER.forEach(w => {
    if (!w.share) return;
    const n = BY_ID.get(w.place).pop * w.share;
    conn += n;
    if (hours <= 2 || pumpOn.get(w.pump)) wet += n;
  });
  return {
    pts, working: working.length, starlink: working.filter(p => p.starlink).length, heat: working.filter(p => p.heat).length,
    covered, coveredShare: covered / TOTAL.pop, placeOk, pumpOn, conn, wet, dry: conn - wet, waterShare: conn ? wet / conn : 0,
    cost: pumps.length * GEN_COST,
  };
}

// ——— паводок заданої висоти ———
export function floodScen(stage) {
  const st = S.floodSteps[Math.max(0, Math.min(50, Math.round(stage * 5)))];
  const places = st.places.map(i => PLACES[i].id), isolated = st.isolated.map(i => PLACES[i].id);
  const objects = OBJECTS.filter(o => floodAt(o.x, o.y) <= stage && floodAt(o.x, o.y) > 0);
  const roads = new Set(st.roads);
  return {
    stage, places, isolated, objects, roads, area: st.area, pop: popOf(places), isoPop: popOf(isolated),
    roadKm: sum(ROADS.filter(r => roads.has(r.id)), r => r.km), years: stage > 0 ? returnPeriod(stage) : 1,
  };
}

// ——— базові величини для паспорта ———
const kidsN = sum(PLACES, p => sumAge(p.age, 0, 17)), oldN = sum(PLACES, p => sumAge(p.age, 65, 90));
const agriKm2 = S.cover[3].km2 + S.cover[4].km2;
const landAgri = sum(LAND, l => l.agri), landReg = sum(LAND, l => l.agri * l.reg);
const water = (() => { let conn = 0, gen = 0; WATER.forEach(w => { const n = BY_ID.get(w.place).pop * w.share; conn += n; if (w.gen || (PUMPS.find(x => x.id === w.pump) || {}).gen) gen += n; }); return { share: conn / TOTAL.pop, backup: gen / conn }; })();
const comRoads = ROADS.filter(r => r.owner === 'community');
const shelterCap = sum(SHELTERS.filter(u => u.state !== 'not'), u => u.cap);
const BASE_BLACK = blackout(0);
const fireShare = sum(PLACES, p => (fireT(p.id) <= 20 ? p.pop : 0)) / TOTAL.pop;
const flood100 = popOf(PLACES.filter(p => p.flood != null && p.flood <= STAGE100).map(p => p.id));
const amb = HEALTH.filter(h => h.kind === 'amb');
const schoolCap = sum(SCHOOLS, s => s.cap);
const estY = POP_SERIES.est;

// Схожі громади: 14 умовних громад із населенням 35…55 тис. і змішаною міською та сільською структурою.
// [мінімум, перший квартиль, медіана, третій квартиль, максимум]
const BENCH = {
  density: [14, 21, 33, 46, 71], agri: [58, 66, 72, 79, 86], forest: [4, 9, 14, 21, 33], cadastre: [74, 83, 88, 92, 97],
  old65: [19, 22, 24, 26, 29], kids: [13, 14.8, 16.4, 17.9, 20.1], natural: [-14.2, -11.3, -9.6, -8.1, -5.9],
  revPc: [6100, 8200, 9400, 10900, 14800], transfersShare: [22, 29, 34, 39, 47], capex: [4, 8, 12, 15, 22],
  fop: [28, 36, 41, 47, 58], wage: [14100, 16200, 17200, 18400, 21300],
  schoolOcc: [48, 57, 64, 71, 83], perPupil: [36, 43, 48, 55, 71], shelterPupils: [41, 68, 82, 93, 100],
  amb30car: [81, 90, 94, 97, 99], declCover: [78, 83, 86, 89, 93],
  water: [31, 48, 59, 70, 86], roadsPoor: [18, 29, 36, 44, 58], light: [38, 52, 63, 74, 88],
  shelterPer100: [12, 19, 27, 36, 52], sirens: [38, 61, 74, 86, 97], fire20: [63, 76, 84, 91, 98],
};

// ——— каталог показників паспорта ———
// unit: ключ одиниці в i18n; fmt: int | dec1 | pct | money (млн грн) | uah; better: up | down | null
// src: джерела (перше визначає власника); conflict: друге значення з іншого джерела; brk: розбивка для картки показника
function catalog() {
  const L = [];
  const add = o => L.push({ series: null, bench: BENCH[o.id] || null, better: null, ...o });
  const byOkrug = f => OKRUGS.map(o => ({ id: o.id, kind: 'okrug', v: f(o) }));
  const okPop = o => popOf(o.places);
  // територія
  add({ id: 'area', dom: 'territory', unit: 'km2', fmt: 'int', v: S.area, src: ['gis'], brk: byOkrug(o => sum(o.places, id => BY_ID.get(id).area)) });
  add({ id: 'density', dom: 'territory', unit: 'perKm2', fmt: 'dec1', v: TOTAL.pop / S.area, src: ['gis', 'reg'], brk: byOkrug(o => okPop(o) / sum(o.places, id => BY_ID.get(id).area)) });
  add({ id: 'agri', dom: 'territory', unit: 'pct', fmt: 'pct', v: agriKm2 / S.area * 100, src: ['gis'] });
  add({ id: 'forest', dom: 'territory', unit: 'pct', fmt: 'pct', v: S.cover[2].km2 / S.area * 100, src: ['gis'] });
  add({ id: 'cadastre', dom: 'territory', unit: 'pct', fmt: 'pct', v: landReg / landAgri * 100, better: 'up', src: ['land'], brk: LAND.map(l => ({ id: l.okrug, kind: 'okrug', v: l.reg * 100 })), page: 'finance' });
  // населення
  add({ id: 'popEst', dom: 'people', unit: 'people', fmt: 'int', v: TOTAL.pop, series: estY, src: ['meters', 'decl', 'reg', 'idp'], brk: byOkrug(okPop), page: 'people' });
  add({ id: 'popReg', dom: 'people', unit: 'people', fmt: 'int', v: TOTAL.reg, series: POP_SERIES.reg, src: ['reg'], conflict: { v: TOTAL.pop, src: 'twin' }, brk: byOkrug(o => sum(o.places, id => BY_ID.get(id).src.reg)), page: 'people' });
  add({ id: 'idp', dom: 'people', unit: 'people', fmt: 'int', v: TOTAL.idp, series: POP_SERIES.idp, src: ['idp'], brk: byOkrug(o => sum(o.places, id => BY_ID.get(id).src.idp)), page: 'people' });
  add({ id: 'old65', dom: 'people', unit: 'pct', fmt: 'pct', v: oldN / TOTAL.pop * 100, src: ['reg', 'decl'], brk: byOkrug(o => sum(o.places, id => sumAge(BY_ID.get(id).age, 65, 90)) / okPop(o) * 100), page: 'people' });
  add({ id: 'kids', dom: 'people', unit: 'pct', fmt: 'pct', v: kidsN / TOTAL.pop * 100, src: ['reg', 'edu'], brk: byOkrug(o => sum(o.places, id => sumAge(BY_ID.get(id).age, 0, 17)) / okPop(o) * 100), page: 'people' });
  add({ id: 'births', dom: 'people', unit: 'births', fmt: 'int', v: POP_SERIES.births[Y], series: POP_SERIES.births, better: 'up', src: ['reg'], page: 'people' });
  add({ id: 'natural', dom: 'people', unit: 'per1000', fmt: 'dec1', v: (POP_SERIES.births[Y] - POP_SERIES.deaths[Y]) / estY[Y] * 1000, series: estY.map((e, i) => (POP_SERIES.births[i] - POP_SERIES.deaths[i]) / e * 1000), better: 'up', src: ['reg'], page: 'people' });
  // економіка і бюджет
  const ownS = [0, 1, 2, 3, 4, 5].map(own), trS = [0, 1, 2, 3, 4, 5].map(transfers);
  add({ id: 'revOwn', dom: 'economy', unit: 'uahM', fmt: 'dec1', v: ownS[Y], series: ownS, better: 'up', src: ['budget'], page: 'finance' });
  add({ id: 'revPc', dom: 'economy', unit: 'uah', fmt: 'int', v: ownS[Y] * 1e6 / estY[Y], series: ownS.map((v, i) => v * 1e6 / estY[i]), better: 'up', src: ['budget', 'meters'], alt: { v: ownS[Y] * 1e6 / TOTAL.reg, src: 'reg' }, page: 'finance' });
  add({ id: 'transfersShare', dom: 'economy', unit: 'pct', fmt: 'pct', v: trS[Y] / (ownS[Y] + trS[Y]) * 100, series: trS.map((t, i) => t / (t + ownS[i]) * 100), better: 'down', src: ['budget'], page: 'finance' });
  add({ id: 'capex', dom: 'economy', unit: 'pct', fmt: 'pct', v: BUDGET.capex[Y] * 100, series: BUDGET.capex.map(v => v * 100), better: 'up', src: ['budget'], page: 'finance' });
  add({ id: 'landPay', dom: 'economy', unit: 'uahM', fmt: 'dec1', v: BUDGET.rev[2][1][Y], series: BUDGET.rev[2][1], better: 'up', src: ['budget'], page: 'finance' });
  add({ id: 'landGap', dom: 'economy', unit: 'uahM', fmt: 'dec1', v: sum(LAND, l => l.gap) / 1000, better: 'down', src: ['land', 'gis'], brk: LAND.map(l => ({ id: l.okrug, kind: 'okrug', v: l.gap / 1000 })), page: 'finance' });
  add({ id: 'fop', dom: 'economy', unit: 'per1000', fmt: 'dec1', v: ECONOMY.fop[Y] / estY[Y] * 1000, series: ECONOMY.fop.map((v, i) => v / estY[i] * 1000), better: 'up', src: ['economy'] });
  add({ id: 'wage', dom: 'economy', unit: 'uah', fmt: 'int', v: ECONOMY.wage[Y], series: ECONOMY.wage, better: 'up', src: ['economy'] });
  // освіта
  const pupS = [5020, 4690, 4560, 4470, 4380, BASE_NET.tot.pupils];
  add({ id: 'pupils', dom: 'edu', unit: 'pupils', fmt: 'int', v: BASE_NET.tot.pupils, series: pupS, src: ['edu'], brk: SCHOOLS.map(s => ({ id: s.id, kind: 'obj', v: s.pupils })), page: 'scenarios' });
  add({ id: 'schoolOcc', dom: 'edu', unit: 'pct', fmt: 'pct', v: BASE_NET.tot.occ * 100, series: pupS.map(v => v / schoolCap * 100), better: 'up', src: ['edu'], brk: SCHOOLS.map(s => ({ id: s.id, kind: 'obj', v: s.occ * 100 })), page: 'scenarios' });
  add({ id: 'smallSchools', dom: 'edu', unit: 'schools', fmt: 'int', v: BASE_NET.tot.small, series: [3, 4, 5, 5, 6, BASE_NET.tot.small], better: 'down', src: ['edu'], page: 'scenarios' });
  add({ id: 'perPupil', dom: 'edu', unit: 'uahK', fmt: 'dec1', v: BASE_NET.tot.perPupil, series: [37.9, 41.6, 45.2, 48.4, 50.9, BASE_NET.tot.perPupil], better: 'down', src: ['budget', 'edu'], brk: SCHOOLS.map(s => ({ id: s.id, kind: 'obj', v: s.perPupil })), page: 'scenarios' });
  add({ id: 'shelterPupils', dom: 'edu', unit: 'pct', fmt: 'pct', v: BASE_NET.tot.shelter * 100, series: [null, 22, 51, 63, 69, BASE_NET.tot.shelter * 100], better: 'up', src: ['edu', 'shelter'], brk: SCHOOLS.map(s => ({ id: s.id, kind: 'obj', v: s.pupils ? Math.min(s.pupils, Math.max(0, s.shelterCap - s.staff)) / s.pupils * 100 : 0 })), page: 'scenarios' });
  add({ id: 'kgQueue', dom: 'edu', unit: 'kids', fmt: 'int', v: sum(KGS, k => k.queue), series: [96, 41, 52, 49, 47, sum(KGS, k => k.queue)], better: 'down', src: ['edu'], brk: KGS.map(k => ({ id: k.id, kind: 'obj', v: k.queue })) });
  // здоров'я
  add({ id: 'amb30car', dom: 'health', unit: 'pct', fmt: 'pct', v: shareT('primaryCar', 30) * 100, better: 'up', src: ['gis', 'transport'], model: 'transport' });
  add({ id: 'amb30bus', dom: 'health', unit: 'pct', fmt: 'pct', v: shareT('primaryPt', 30) * 100, better: 'up', src: ['transport', 'gis'], model: 'transport' });
  add({ id: 'hosp60bus', dom: 'health', unit: 'pct', fmt: 'pct', v: shareT('hospitalPt', 60) * 100, better: 'up', src: ['transport', 'gis'], model: 'transport' });
  add({ id: 'declCover', dom: 'health', unit: 'pct', fmt: 'pct', v: TOTAL.decl / TOTAL.pop * 100, series: [86, 85, 87, 88, 89, TOTAL.decl / TOTAL.pop * 100], better: 'up', src: ['decl'], brk: amb.map(h => ({ id: h.id, kind: 'obj', v: h.decl / popOf(h.places) * 100 })) });
  add({ id: 'perDoctor', dom: 'health', unit: 'decl', fmt: 'int', v: TOTAL.decl / sum(amb, h => h.doctors), better: 'down', src: ['decl', 'health'], brk: amb.map(h => ({ id: h.id, kind: 'obj', v: h.perDoc })) });
  add({ id: 'fapVacant', dom: 'health', unit: 'points', fmt: 'int', v: HEALTH.filter(h => h.kind === 'fap' && !h.staff).length, better: 'down', src: ['health'] });
  // послуги й інфраструктура
  add({ id: 'cnap45bus', dom: 'services', unit: 'pct', fmt: 'pct', v: shareT('cnapPt', 45) * 100, better: 'up', src: ['transport', 'gis'], model: 'transport' });
  add({ id: 'noStop', dom: 'services', unit: 'places', fmt: 'int', v: S.tsig.noStop.length, better: 'down', src: ['transport', 'gis'], model: 'transport' });
  add({ id: 'water', dom: 'services', unit: 'pct', fmt: 'pct', v: water.share * 100, better: 'up', src: ['water'], brk: byOkrug(o => sum(o.places, id => BY_ID.get(id).pop * (WATER[IDX.get(id)].share)) / okPop(o) * 100) });
  add({ id: 'roadsPoor', dom: 'services', unit: 'pct', fmt: 'pct', v: sum(comRoads.filter(r => r.cond === 'poor'), r => r.km) / sum(comRoads, r => r.km) * 100, better: 'down', src: ['roads'] });
  add({ id: 'light', dom: 'services', unit: 'pct', fmt: 'pct', v: sum(PLACES, p => LIGHT[p.id] * p.pop) / TOTAL.pop * 100, better: 'up', src: ['light'] });
  add({ id: 'internet', dom: 'services', unit: 'places', fmt: 'int', v: null, better: 'up', src: [] });
  // безпека і стійкість
  add({ id: 'shelterPer100', dom: 'safety', unit: 'per100', fmt: 'int', v: shelterCap / TOTAL.pop * 100, series: [null, 21, 34, 41, 45, shelterCap / TOTAL.pop * 100], better: 'up', src: ['shelter'], brk: byOkrug(o => sum(SHELTERS.filter(u => o.places.includes(u.place) && u.state !== 'not'), u => u.cap) / okPop(o) * 100), page: 'map' });
  add({ id: 'shelterReady', dom: 'safety', unit: 'pct', fmt: 'pct', v: SHELTERS.filter(u => u.state === 'ready').length / SHELTERS.length * 100, better: 'up', src: ['shelter'], page: 'map' });
  add({ id: 'sirens', dom: 'safety', unit: 'pct', fmt: 'pct', v: S.sirens.share * 100, better: 'up', src: ['gis'], model: 'terrain', brk: byOkrug(o => popOf(o.places.filter(id => BY_ID.get(id).siren)) / okPop(o) * 100) });
  add({ id: 'flood100', dom: 'safety', unit: 'people', fmt: 'int', v: flood100, better: 'down', src: ['gis'], model: 'terrain', page: 'scenarios' });
  add({ id: 'points', dom: 'safety', unit: 'pct', fmt: 'pct', v: BASE_BLACK.coveredShare * 100, better: 'up', src: ['points'], page: 'scenarios' });
  add({ id: 'waterBackup', dom: 'safety', unit: 'pct', fmt: 'pct', v: water.backup * 100, better: 'up', src: ['water'], page: 'scenarios' });
  add({ id: 'fire20', dom: 'safety', unit: 'pct', fmt: 'pct', v: fireShare * 100, better: 'up', src: ['gis'], model: 'transport' });
  // якість даних (рахується після статусів)
  const bOk = BUILDINGS.filter(b => b.rights).length / BUILDINGS.length * 100;
  add({ id: 'objRights', dom: 'data', unit: 'pct', fmt: 'pct', v: bOk, better: 'up', src: ['property'], page: 'finance' });
  add({ id: 'objAudit', dom: 'data', unit: 'pct', fmt: 'pct', v: BUILDINGS.filter(b => b.audit).length / BUILDINGS.length * 100, better: 'up', src: ['property'], page: 'finance' });
  add({ id: 'sourcesAuto', dom: 'data', unit: 'pct', fmt: 'pct', v: SOURCES.filter(s => ['api', 'export', 'model'].includes(s.access)).length / SOURCES.length * 100, better: 'up', src: ['gis'], page: 'method' });
  // статус кожного показника
  L.forEach(x => {
    const srcs = x.src.map(id => SRC_BY.get(id)).filter(Boolean);
    x.owner = srcs.length ? srcs[0].owner : null;
    x.updated = srcs.length ? srcs.map(s => s.updated).sort()[0] : null;
    x.status = x.v == null ? 'missing' : x.conflict ? 'conflict' : srcs.some(isStale) ? 'stale' : 'ok';
  });
  const core = L.filter(x => x.dom !== 'data');
  add({ id: 'fresh', dom: 'data', unit: 'pct', fmt: 'pct', v: core.filter(x => x.status === 'ok').length / core.length * 100, better: 'up', src: ['gis'], page: 'method' });
  add({ id: 'owners', dom: 'data', unit: 'pct', fmt: 'pct', v: core.filter(x => x.owner).length / core.length * 100, better: 'up', src: ['gis'], page: 'method' });
  L.slice(-2).forEach(x => { x.owner = 'gis'; x.updated = '2026-11-01'; x.status = 'ok'; });
  return L;
}
export const INDICATORS = catalog();
export const IND_BY = new Map(INDICATORS.map(x => [x.id, x]));
export const STATUS_COUNTS = ['ok', 'stale', 'conflict', 'missing'].map(s => [s, INDICATORS.filter(x => x.status === s).length]);
export const benchPos = x => { if (!x.bench || x.v == null) return null; const b = x.bench; let below = 0; const vals = [b[0], b[1], b[2], b[3], b[4]]; vals.forEach(v => { if (v < x.v) below++; }); return below; };

// ——— сигнали ———
// level: critical | warning | info; kind: place | object | okrug | source | building
export const SIGNALS = [
  { id: 'regGap', level: 'warning', dom: 'data', kind: 'place', page: 'people' },
  { id: 'noSchoolShelter', level: 'critical', dom: 'edu', kind: 'object', page: 'scenarios' },
  { id: 'schoolOver', level: 'warning', dom: 'edu', kind: 'object', page: 'scenarios' },
  { id: 'schoolUnder', level: 'info', dom: 'edu', kind: 'object', page: 'scenarios' },
  { id: 'elderlyFar', level: 'critical', dom: 'health', kind: 'place', page: 'places' },
  { id: 'fapVacant', level: 'warning', dom: 'health', kind: 'object', page: 'map' },
  { id: 'floodObjects', level: 'critical', dom: 'safety', kind: 'object', page: 'scenarios' },
  { id: 'shelterNot', level: 'warning', dom: 'safety', kind: 'object', page: 'map' },
  { id: 'pumpNoGen', level: 'warning', dom: 'safety', kind: 'object', page: 'scenarios' },
  { id: 'sirenGap', level: 'warning', dom: 'safety', kind: 'place', page: 'map' },
  { id: 'pointGap', level: 'warning', dom: 'safety', kind: 'place', page: 'scenarios' },
  { id: 'landGap', level: 'warning', dom: 'economy', kind: 'okrug', page: 'finance' },
  { id: 'staleData', level: 'warning', dom: 'data', kind: 'source', page: 'method' },
  { id: 'noRights', level: 'info', dom: 'data', kind: 'building', page: 'finance' },
];
function signals() {
  const out = {};
  out.regGap = PLACES.filter(p => p.src.reg / p.pop - 1 >= 0.25).map(p => ({ id: p.id, v: p.src.reg / p.pop - 1, a: p.src.reg, b: p.pop })).sort((a, b) => b.v - a.v);
  out.noSchoolShelter = SCHOOLS.filter(s => s.shelterCap - s.staff < s.pupils).map(s => ({ id: s.id, v: Math.max(0, s.shelterCap - s.staff), a: s.pupils, none: !s.shelterCap })).sort((a, b) => (b.none - a.none) || (b.a - b.v) - (a.a - a.v));
  out.schoolOver = SCHOOLS.filter(s => s.occ > 1).map(s => ({ id: s.id, v: s.occ, a: s.pupils, b: s.cap }));
  out.schoolUnder = SCHOOLS.filter(s => s.occ < 0.35).map(s => ({ id: s.id, v: s.occ, a: s.pupils, b: s.perPupil })).sort((a, b) => a.v - b.v);
  const fapOk = new Set(HEALTH.filter(h => h.kind === 'fap' && h.staff).map(h => h.place));
  out.elderlyFar = PLACES.filter(p => p.old >= 0.35 && (p.t.primaryPt == null || p.t.primaryPt > 45) && !fapOk.has(p.id)).map(p => ({ id: p.id, v: p.old, a: p.t.primaryPt, b: Math.round(p.pop * p.old) })).sort((a, b) => b.b - a.b);
  out.fapVacant = HEALTH.filter(h => h.kind === 'fap' && !h.staff).map(h => ({ id: h.id, v: BY_ID.get(h.place).pop, a: BY_ID.get(h.place).old }));
  out.floodObjects = OBJECTS.filter(o => ['school', 'kg', 'health', 'shelter', 'point', 'water', 'admin'].includes(o.cat)).map(o => ({ o, s: floodAt(o.x, o.y) })).filter(x => x.s > 0 && x.s <= STAGE100).map(x => ({ id: x.o.id, v: x.s, a: returnPeriod(x.s) })).sort((a, b) => a.v - b.v);
  out.shelterNot = SHELTERS.filter(u => u.state === 'not').map(u => ({ id: u.id, v: u.cap, a: BY_ID.get(u.place).pop }));
  out.pumpNoGen = PUMPS.filter(w => !w.gen).map(w => ({ id: w.id, v: Math.round(sum(WATER.filter(x => x.pump === w.id), x => BY_ID.get(x.place).pop * x.share)) })).filter(x => x.v >= 250).sort((a, b) => b.v - a.v);
  out.sirenGap = PLACES.filter(p => !p.siren && p.pop >= 300).map(p => ({ id: p.id, v: p.pop })).sort((a, b) => b.v - a.v);
  out.pointGap = PLACES.filter(p => p.pop >= 200 && !BASE_BLACK.placeOk.get(p.id)).map(p => ({ id: p.id, v: Math.min(...POINTS.filter(x => !x.broken).map(x => carT(p.id, x.place))), a: p.pop })).sort((a, b) => b.a - a.a);
  out.landGap = LAND.filter(l => l.used >= 800).map(l => ({ id: l.okrug, v: l.used, a: l.gap })).sort((a, b) => b.v - a.v);
  out.staleData = SOURCES.filter(isStale).map(s => ({ id: s.id, v: s.updated, a: INDICATORS.filter(x => x.src.includes(s.id)).length }));
  out.noRights = BUILDINGS.filter(b => !b.rights || !b.cad).map(b => ({ id: b.id, v: !b.rights, a: !b.cad }));
  return out;
}
export const SIG = signals();
export const sigPlaces = id => {
  const s = SIGNALS.find(x => x.id === id);
  if (s.kind === 'place') return SIG[id].map(x => x.id);
  if (s.kind === 'object' || s.kind === 'building') return [...new Set(SIG[id].map(x => (OBJECTS.find(o => o.id === x.id) || {}).place).filter(Boolean))];
  if (s.kind === 'okrug') return OKRUGS.filter(o => SIG[id].some(x => x.id === o.id)).flatMap(o => o.places);
  return [];
};
// сигнали, що стосуються населеного пункту
export function placeSignals(pid) {
  return SIGNALS.filter(s => s.kind !== 'source' && sigPlaces(s.id).includes(pid)).map(s => s.id);
}

// ——— прогноз населення: три сценарії, підсумки за роками ———
const PROJ = {};
export function projection(scen) {
  if (PROJ[scen]) return PROJ[scen];
  const P = project(scen, 9);
  const years = [];
  for (let y = 0; y <= 9; y++) {
    const r = { year: 2026 + y, pop: 0, pre: 0, school: 0, work: 0, old: 0, first: 0 };
    P.byPlace.forEach(a => { const A = a[y]; r.pop += sumAge(A, 0, 90); r.pre += sumAge(A, 1, 5); r.school += sumAge(A, 6, 16); r.work += sumAge(A, 18, 64); r.old += sumAge(A, 65, 90); r.first += sumAge(A, 6, 6); });
    years.push(r);
  }
  PROJ[scen] = { P, years, totals: P.totals };
  return PROJ[scen];
}

// ——— населений пункт: послуги поруч ———
export function placeServices(pid) {
  const p = BY_ID.get(pid);
  const objs = OBJECTS.filter(o => o.place === pid);
  const near = (list, f = () => true) => { let best = null, bt = Infinity; list.filter(f).forEach(o => { const t = carT(pid, o.place); if (t < bt) { bt = t; best = o; } }); return best ? { o: best, t: bt } : null; };
  const asg = BASE_NET.asg.get(pid);
  return {
    objs,
    school: { primary: SCHOOLS.find(s => s.id === asg.primary), basic: SCHOOLS.find(s => s.id === asg.basic), senior: SCHOOLS.find(s => s.id === asg.senior) },
    kg: near(KGS), fap: near(HEALTH.filter(h => h.kind === 'fap' && h.staff).concat(HEALTH.filter(h => h.kind === 'amb'))), point: near(POINTS.filter(x => !x.broken)),
    fire: fireT(pid), water: WATER[IDX.get(pid)], light: LIGHT[pid], shelter: sum(SHELTERS.filter(u => u.place === pid && u.state !== 'not'), u => u.cap),
    p,
  };
}
