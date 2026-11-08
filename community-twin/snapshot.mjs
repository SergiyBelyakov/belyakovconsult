// Зріз даних для цифрового двійника громади: результати модулів доступності (transport-demo) і рельєфу (terrain-demo)
// у компактному JSON, щоб двійник не перераховував важкі моделі в браузері.
//   node community-twin/snapshot.mjs   → community-twin/src/snapshot.json (його викликає build.mjs)
// Сітки (висоти, земний покрив, поріг затоплення, чутність сирен, належність до населеного пункту) закодовано base64.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { solve, stopDistances, signals as tSignals, loads, routeInfo } from '../transport-demo/src/model.js';
import { BOUNDARY, WORLD, CELL } from '../transport-demo/src/data.js';
import { buildTerrain, flood, floodStageOf, coverage, EXISTING_SIRENS, GX, GY, STEP } from '../terrain-demo/src/dem.js';
import { geo, CLIMATE, T0, P0 } from '../terrain-demo/src/geo.js';
import { OKRUGS, OKRUG_OF } from './src/okrugs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const t0 = Date.now();

const T = buildTerrain();
const base = T.base;
const G = geo(T);
const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const r2 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const b64 = u8 => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
const bits = arr => { const out = new Uint8Array(Math.ceil(arr.length / 8)); for (let i = 0; i < arr.length; i++) if (arr[i]) out[i >> 3] |= 1 << (i & 7); return out; };

// Спрощення ламаної (Рамер, Дуглас, Пекер)
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bd = 0;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / l; if (d > bd) { bd = d; best = i; } }
    if (bd > eps) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const P2 = pts => pts.map(p => [r2(p[0]), r2(p[1])]);

// ——— населені пункти: доступність послуг (модуль транспорту), висота, затоплення, сирени, природні умови (модуль рельєфу) ———
const stages = floodStageOf(T);
const sirens = coverage(T, 'siren', EXISTING_SIRENS.map(id => T.byId.get(id).cell));
const sirSet = new Set(sirens.covered.map(p => p.id));
const sol = {};
for (const s of ['primary', 'hospital', 'cnap']) for (const m of ['car', 'pt']) sol[s + m] = solve(base, s, m, 'day', {});
const primPm = solve(base, 'primary', 'pt', 'pm', {});
const sd = stopDistances(base, {}, 'day');
const phys = new Map(G.summary.places.map(x => [x.p.id, x]));
const ids = base.places.map(p => p.id);
const facOf = (s, id) => { const r = s.placeT.get(id); return r.fac >= 0 ? s.facs[r.fac].id : null; };

// матриця часу авто між населеними пунктами: «новий пункт» у кожному з них по черзі
const car = [], fields = [];
for (const to of ids) {
  const s = solve(base, 'primary', 'car', 'day', { newPoint: to }, ['new']);
  car.push(ids.map(from => r1(s.placeT.get(from).t)));
  fields.push(s.field);
}
// car[to][from] → транспонуємо в car[from][to]
const carFT = ids.map((_, i) => ids.map((__, j) => car[j][i]));

// ——— належність клітинок 400 м до населеного пункту (найближчий за часом авто) ———
const { gx, gy } = base;
const assign = new Uint8Array(gx * gy);
for (let c = 0; c < gx * gy; c++) {
  let best = 0, bt = Infinity;
  for (let k = 0; k < ids.length; k++) { const t = fields[k][c]; if (t < bt) { bt = t; best = k; } }
  assign[c] = best;
}

// ——— земний покрив і площа за населеними пунктами й округами (клітинки 250 м усередині меж) ———
const COVER_IDS = ['water', 'built', 'forest', 'arable', 'meadow', 'wetland'];
const placeLand = ids.map(() => ({ area: 0, cover: COVER_IDS.map(() => 0) }));
for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
  const k = j * GX + i; if (!T.INSIDE[k]) continue;
  const x = (i + 0.5) * STEP, y = (j + 0.5) * STEP;
  const ci = Math.min(gx - 1, Math.floor(x / CELL)), cj = Math.min(gy - 1, Math.floor(y / CELL));
  const pl = placeLand[assign[cj * gx + ci]];
  pl.area += STEP * STEP; pl.cover[G.LC[k]] += STEP * STEP;
}

const places = base.places.map((p, i) => {
  const x = phys.get(p.id);
  return {
    id: p.id, name: p.name, kind: p.kind, x: p.x, y: p.y, pop: p.pop, old: p.old, kids: p.kids, ...(p.district ? { district: p.district } : {}),
    okrug: OKRUG_OF[p.id], h: r1(T.byId.get(p.id).h), flood: stages.has(p.id) ? stages.get(p.id) : null, siren: sirSet.has(p.id) ? 1 : 0,
    stop: r2(sd.get(p.id)),
    t: {
      primaryCar: r1(sol.primarycar.placeT.get(p.id).t), primaryPt: r1(sol.primarypt.placeT.get(p.id).t), primaryPm: r1(primPm.placeT.get(p.id).t),
      hospitalCar: r1(sol.hospitalcar.placeT.get(p.id).t), hospitalPt: r1(sol.hospitalpt.placeT.get(p.id).t),
      cnapCar: r1(sol.cnapcar.placeT.get(p.id).t), cnapPt: r1(sol.cnappt.placeT.get(p.id).t),
    },
    fac: { primary: facOf(sol.primarycar, p.id), hospital: facOf(sol.hospitalcar, p.id), cnap: facOf(sol.cnapcar, p.id) },
    gw: r1(x.gw), eros: r1(x.eros), frost: Math.round(x.ffd), temp: r1(x.temp), soil: x.soil,
    area: r1(placeLand[i].area), cover: placeLand[i].cover.map(r1),
  };
});

// ——— затоплення: для кожної стадії 0…10 м із кроком 0,2 м ———
const floodSteps = [];
const thr = new Uint8Array(GX * GY);   // 0: не топить до +10 м, 1…51: перша стадія (k−1)·0,2 м, 255: русло
for (let k = 0; k < thr.length; k++) if (T.D[k] < 0.12) thr[k] = 255;
const idxOf = new Map(ids.map((id, i) => [id, i]));
for (let n = 0; n <= 50; n++) {
  const s = Math.round(n * 2) / 10;
  const f = flood(T, s);
  for (let k = 0; k < thr.length; k++) if (f.W[k] && !thr[k]) thr[k] = n + 1;
  floodSteps.push({ s, places: f.places.map(p => idxOf.get(p.id)), isolated: f.isolated.map(p => idxOf.get(p.id)), roads: [...f.cutRoads], area: r1(f.area) });
}

// ——— висоти (дециметри), земний покрив (два класи в байті), чутність наявних сирен (біти) ———
const H = new Uint16Array(GX * GY);
for (let k = 0; k < H.length; k++) H[k] = Math.round(T.H[k] * 10);
const LC = new Uint8Array(Math.ceil((GX * GY) / 2));
for (let k = 0; k < GX * GY; k++) LC[k >> 1] |= (G.LC[k] & 15) << ((k & 1) * 4);
const SIR = new Uint8Array(GX * GY);
sirens.V.forEach(v => { for (let k = 0; k < v.length; k++) if (v[k]) SIR[k] = 1; });

// ——— мережа: дороги, річка, притоки, маршрути ———
const roads = base.roads.map(r => ({ id: r.id, a: r.a, b: r.b, cls: r.cls, ...(r.bridge ? { bridge: r.bridge } : {}), km: r2(r.len), pts: P2(rdp(r.pts, 0.03)) }));
const river = P2(rdp(base.river, 0.02));
const streams = T.streams.filter(s => s.len > 1.2).map(s => ({ a: Math.round(s.acc), pts: P2(rdp(s.pts.map(p => [p[0], p[1]]), 0.06)) }));
const routes = routeInfo(base, {}, 'day').map(x => ({ id: x.r.id, stops: x.r.stops, trips: x.r.trips, active: x.active, kind: x.r.kind || 'rural', km: r1(x.r.km) }));

// ——— сигнали модуля транспорту і навантаження амбулаторій ———
const S = tSignals(base);
const tsig = {
  hospitalBus: S.hospitalBus.map(x => x.id), elderly: S.elderly.map(x => x.id), eveningCut: S.eveningCut.map(x => x.id),
  noStop: S.noStop.map(x => x.id), bridge: S.bridge.map(x => x.id), border: S.border.map(x => x.id),
  rare: S.rare.map(x => x.id), overload: S.overload.map(x => x.id),
};
const ambLoads = loads(base, sol.primarycar).map(o => ({ id: o.f.id, pop: o.pop, cap: o.f.cap || null, places: o.places }));

const out = {
  v: 1,
  note: 'Згенеровано community-twin/snapshot.mjs з моделей transport-demo і terrain-demo. Не редагувати вручну.',
  world: WORLD, cell: CELL, boundary: BOUNDARY, area: r1(G.summary.area),
  relief: { min: r1(T.min), max: r1(T.max), riverKm: r1(G.summary.water.riverKm), streamKm: r1(G.summary.water.streamKm) },
  climate: { t: r1(T0), p: Math.round(P0), frost: CLIMATE.frostFree, active: CLIMATE.activeSum },
  cover: COVER_IDS.map((id, k) => ({ id, km2: r1(G.summary.cover[k].km2) })),
  soils: G.summary.soil.map(s => r1(s.km2)),
  erosion: { mean: r2(G.summary.erosion.mean), total: Math.round(G.summary.erosion.total) },
  sirens: { sites: EXISTING_SIRENS, share: r2(sirens.share * 100) / 100 },
  places, car: carFT, routes, roads, river, streams, floodSteps, tsig, ambLoads,
  grid: {
    gx: GX, gy: GY, step: STEP, h: b64(H), lc: b64(LC), flood: b64(thr), siren: b64(bits(SIR)), inside: b64(bits(T.INSIDE)),
    agx: gx, agy: gy, acell: CELL, assign: b64(assign),
  },
};
const file = join(HERE, 'src', 'snapshot.json');
writeFileSync(file, JSON.stringify(out));
console.log('snapshot', file.replace(ROOT + '/', ''), (JSON.stringify(out).length / 1024).toFixed(0) + ' KB', (Date.now() - t0) + ' ms');
