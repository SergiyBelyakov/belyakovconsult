// Синтетичні реєстри цифрового двійника умовної громади «Велика Рута».
// Територія, дороги, доступність послуг і природні ризики беруться зі зрізу модулів (snapshot.json),
// решта (джерела населення, заклади, укриття, вода, майно, земля, бюджет) згенерована тут детерміновано.
// Усе вигадане: назви, люди, гроші, об'єкти.
import S from './snapshot.json' with { type: 'json' };
import { OKRUGS, OKRUG_OF } from './okrugs.js';

export { S, OKRUGS, OKRUG_OF };
export const AS_OF = '2026-11-01';          // дата зрізу двійника
export const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
export const TODAY_DAY = Math.floor(Date.UTC(2026, 10, 1) / 864e5);

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// окремий потік випадкових чисел для кожного реєстру: зміна одного не зсуває інші
const stream = seed => { const r = rng(seed); const f = () => r(); f.u = (a, b) => a + (b - a) * r(); return f; };
const RP = stream(20261108), RA = stream(11), RW = stream(12), RR = stream(13), RL = stream(14), RB = stream(15);
let U = RP.u;
const round = (v, k = 1) => Math.round(v / k) * k;

// ——— сітки зі зрізу ———
const dec = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const GR = S.grid;
export const GRID = (() => {
  const n = GR.gx * GR.gy, hb = dec(GR.h), H = new Float32Array(n);
  for (let k = 0; k < n; k++) H[k] = (hb[2 * k] | (hb[2 * k + 1] << 8)) / 10;
  const lcb = dec(GR.lc), LC = new Uint8Array(n);
  for (let k = 0; k < n; k++) LC[k] = (lcb[k >> 1] >> ((k & 1) * 4)) & 15;
  const unbit = s => { const b = dec(s), out = new Uint8Array(n); for (let k = 0; k < n; k++) out[k] = (b[k >> 3] >> (k & 7)) & 1; return out; };
  return { gx: GR.gx, gy: GR.gy, step: GR.step, H, LC, FLOOD: dec(GR.flood), SIREN: unbit(GR.siren), INSIDE: unbit(GR.inside), agx: GR.agx, agy: GR.agy, acell: GR.acell, ASSIGN: dec(GR.assign) };
})();
export const cellOf = (x, y) => { const i = Math.floor(x / GRID.step), j = Math.floor(y / GRID.step); return i < 0 || j < 0 || i >= GRID.gx || j >= GRID.gy ? -1 : j * GRID.gx + i; };
// стадія (м над нормою), з якої вода доходить до клітинки; Infinity, якщо не доходить до +10 м
export const floodAt = (x, y) => { const c = cellOf(x, y); if (c < 0) return Infinity; const v = GRID.FLOOD[c]; return v === 255 ? 0 : v ? (v - 1) / 5 : Infinity; };
export const elevAt = (x, y) => { const c = cellOf(x, y); return c < 0 ? null : GRID.H[c]; };

// ——— населені пункти ———
export const PLACES = S.places.map((p, i) => ({ ...p, i }));
export const BY_ID = new Map(PLACES.map(p => [p.id, p]));
export const IDX = new Map(PLACES.map((p, i) => [p.id, i]));
export const carT = (a, b) => { const v = S.car[IDX.get(a)][IDX.get(b)]; return v == null ? Infinity : v; };

// ——— вікова структура 2026: однорічні групи 0…90+, за статтю ———
const G5 = [38, 46, 52, 47, 40, 48, 62, 72, 74, 70, 66, 70, 72, 68, 55, 34, 26, 18];
const SHAPE = Array.from({ length: 91 }, (_, a) => (a < 85 ? G5[Math.floor(a / 5)] / 5 : G5[17] * [0.28, 0.22, 0.17, 0.13, 0.1, 0.1][a - 85]));
export const maleShare = a => (a < 15 ? 0.513 : a < 30 ? 0.505 : a < 45 ? 0.485 : a < 60 ? 0.47 : a < 70 ? 0.42 : a < 80 ? 0.36 : 0.28);
const segSum = (a, b) => SHAPE.slice(a, b + 1).reduce((s, x) => s + x, 0);
const SK = segSum(0, 17), SA = segSum(18, 64), SO = segSum(65, 90);
function ages(p) {
  const M = new Float64Array(91), F = new Float64Array(91), ad = 1 - p.kids - p.old;
  for (let a = 0; a <= 90; a++) {
    const n = p.pop * SHAPE[a] * (a <= 17 ? p.kids / SK : a <= 64 ? ad / SA : p.old / SO);
    M[a] = n * maleShare(a); F[a] = n - M[a];
  }
  return { M, F };
}
PLACES.forEach(p => { p.age = ages(p); });
export const sumAge = (A, a0, a1) => { let s = 0; for (let a = a0; a <= a1; a++) s += A.M[a] + A.F[a]; return s; };

// ——— демографічний прогноз: когортно-компонентний, однорічний крок ———
const MORT = 1.36;                       // калібрування: ≈ 690 смертей у 2026 році
const qM = a => Math.min(0.42, MORT * (0.0009 + 0.000045 * Math.exp(0.092 * a)));
const qF = a => Math.min(0.38, MORT * (0.0004 + 0.000016 * Math.exp(0.097 * a)));
const ASFR = (() => { const w = []; let s = 0; for (let a = 15; a <= 49; a++) { const v = Math.exp(-(((a - 28) / 5.5) ** 2) / 2); w.push(v); s += v; } return w.map(v => v / s); })();
export const DEMO_SCEN = {
  low: { tfr: [1.05, 0.98, 0.93, 0.9, 0.9], mig: 1.8, ret: 0 },
  base: { tfr: [1.09, 1.08, 1.08, 1.1, 1.12], mig: 1, ret: 0 },
  high: { tfr: [1.12, 1.18, 1.25, 1.32, 1.38], mig: 0.5, ret: 0.004 },
};
// чиста міграція за рік: молодь виїжджає, у селах сильніше
const migRate = (a, kind) => (a >= 17 && a <= 34 ? -0.009 : a < 17 ? -0.002 : a <= 64 ? -0.002 : -0.0005) * (kind === 'village' ? 1.4 : kind === 'town' ? 1.05 : 0.75);
export function project(scen = 'base', years = 9) {
  const sc = DEMO_SCEN[scen];
  const out = PLACES.map(p => [{ M: Float64Array.from(p.age.M), F: Float64Array.from(p.age.F) }]);
  const totals = [];
  for (let y = 0; y < years; y++) {
    const tfr = sc.tfr[Math.min(sc.tfr.length - 1, Math.floor(y / 2))];
    let births = 0, deaths = 0;
    PLACES.forEach((p, i) => {
      const cur = out[i][y], M = new Float64Array(91), F = new Float64Array(91);
      let b = 0;
      for (let a = 15; a <= 49; a++) b += cur.F[a] * ASFR[a - 15] * tfr;
      for (let a = 0; a <= 90; a++) {
        const m = 1 + migRate(a, p.kind) * sc.mig + (a >= 18 && a <= 64 ? sc.ret : a < 18 ? sc.ret * 0.8 : 0);
        const sm = cur.M[a] * (1 - qM(a)) * m, sf = cur.F[a] * (1 - qF(a)) * m;
        deaths += cur.M[a] * qM(a) + cur.F[a] * qF(a);
        const to = Math.min(90, a + 1);
        M[to] += sm; F[to] += sf;
      }
      M[0] = b * 0.513 * (1 - qM(0) / 2); F[0] = b * 0.487 * (1 - qF(0) / 2);
      births += b;
      out[i].push({ M, F });
    });
    totals.push({ births, deaths });
  }
  return { byPlace: out, totals };
}

// ——— населення за джерелами (зріз 01.10.2026) ———
// pop у зрізі транспорту = оцінка двійника. Реєстр більший: частина зареєстрованих не живе в громаді.
// ВПО живуть тут, але зареєстровані деінде. Три незалежні оцінки перевіряють одна одну.
const IDP = { vrc: 930, vrn: 610, vrw: 340, vre: 240, yas: 330, oze: 270, kle: 70, dub: 80, kal: 55, yab: 45, ber: 30, sta: 25, mal: 20 };
export const EST_W = { meters: 0.4, decl: 0.35, reg: 0.25 };
export const HH = { district: 2.45, town: 2.4, village: 2.2 };   // середній розмір домогосподарства в методиці
export const DECL_COVER = 0.9;                                  // частка мешканців із декларацією в методиці
PLACES.forEach(p => {
  const idp = IDP[p.id] || (p.pop > 300 ? 12 : 4);
  const gone = p.kind === 'district' ? U(0.115, 0.14) : p.kind === 'town' ? U(0.15, 0.18) : Math.min(0.4, Math.max(0.14, 0.16 + 0.6 * (p.old - 0.3) + U(-0.03, 0.05)));
  const reg = Math.round((p.pop - idp) / (1 - gone));
  // три оцінки: лічильники × домогосподарство, декларації ÷ охоплення, реєстр − відсутні + ВПО; зважене середнє = pop
  // відхилення трьох методів випадкові, але їхнє зважене середнє нульове
  const d = [U(-0.05, 0.05), U(-0.055, 0.045), U(-0.05, 0.05)], m = EST_W.meters * d[0] + EST_W.decl * d[1] + EST_W.reg * d[2];
  const e1 = p.pop * (1 + d[0] - m), e2 = p.pop * (1 + d[1] - m), e3 = p.pop * (1 + d[2] - m);
  const meters = Math.round(e1 / HH[p.kind]), decl = Math.round(e2 * DECL_COVER);
  const absent = reg + idp - Math.round(e3);
  p.src = { reg, idp, decl, meters, absent, gone };
  p.est = { meters: meters * HH[p.kind], decl: decl / DECL_COVER, reg: reg - absent + idp };
  const vals = Object.values(p.est);
  p.range = [Math.min(...vals), Math.max(...vals)];
});
export const TOTAL = PLACES.reduce((a, p) => ({ pop: a.pop + p.pop, reg: a.reg + p.src.reg, idp: a.idp + p.src.idp, decl: a.decl + p.src.decl, meters: a.meters + p.src.meters, absent: a.absent + p.src.absent }), { pop: 0, reg: 0, idp: 0, decl: 0, meters: 0, absent: 0 });

// ряди 2021…2026 (оцінка двійника і реєстр), народження й смерті
export const POP_SERIES = {
  est: [48900, 46300, 45600, 45200, 44950, TOTAL.pop],
  reg: [50410, 50120, 49860, 49570, 49380, TOTAL.reg],
  idp: [0, 4850, 4100, 3600, 3350, TOTAL.idp],
  births: [392, 331, 287, 271, 262, 254],
  deaths: [831, 742, 716, 705, 698, 690],
};

// ——— розміщення об'єктів біля центру населеного пункту (золотий кут, щоб не накладались) ———
const slots = new Map();
// Точка не повинна потрапляти в русло й заплаву нижче рівня, з якого топить сам населений пункт, і за межі громади.
function spot(placeId, dr = 0) {
  const p = BY_ID.get(placeId), n = slots.get(placeId) || 0;
  slots.set(placeId, n + 1);
  const k = p.kind === 'district' ? 1.7 : p.kind === 'town' ? 1.25 : 0.85;
  const r = (0.32 + 0.24 * Math.sqrt(n) + dr) * k, a0 = n * 2.39996 + (IDX.get(placeId) % 7) * 0.7;
  const need = p.flood != null ? Math.max(1.6, p.flood - 0.8) : 6.6;
  let best = null, bs = -1;
  for (let t = 0; t < 16; t++) {
    const a = a0 + t * 0.41, x = Math.round((p.x + r * Math.cos(a)) * 100) / 100, y = Math.round((p.y + r * Math.sin(a)) * 100) / 100;
    const c = cellOf(x, y), f = floodAt(x, y);
    if (c < 0 || !GRID.INSIDE[c]) continue;
    if (f >= need) return { x, y };
    if (f > bs) { bs = f; best = { x, y }; }
  }
  return best || { x: p.x, y: p.y };
}

// поруч з іншим об'єктом (укриття школи, пункт незламності), якщо там не нижче за рівнем затоплення
function beside(h, dx, dy) {
  const x = Math.round((h.x + dx) * 100) / 100, y = Math.round((h.y + dy) * 100) / 100;
  return floodAt(x, y) >= floodAt(h.x, h.y) - 0.1 ? { x, y } : { x: h.x, y: h.y };
}

// ——— освіта: школи ———
// type: lyceum (1…11), gym (1…9), primary (1…4)
const SCHOOL_DEF = [
  ['s1', 'vrc', 'lyceum', 1100, 1972, 1], ['s2', 'vrn', 'lyceum', 900, 1986, 2], ['s3', 'vrw', 'gym', 640, 1964, 3], ['s4', 'vre', 'gym', 560, 1979, 4],
  ['s5', 'yas', 'lyceum', 820, 1981], ['s6', 'oze', 'lyceum', 720, 1975], ['s7', 'kle', 'gym', 420, 1969], ['s8', 'dub', 'gym', 460, 1971],
  ['s9', 'kal', 'gym', 360, 1966], ['s10', 'ber', 'gym', 300, 1962], ['s11', 'mal', 'gym', 320, 1968], ['s12', 'luh', 'gym', 280, 1974],
  ['s13', 'ver', 'primary', 120, 1958], ['s14', 'yab', 'primary', 160, 1961],
];
export const BANDS = { primary: [6, 9], basic: [10, 14], senior: [15, 16] };
export const ENROL = 0.95;
const serves = (type, band) => (band === 'primary' ? true : band === 'basic' ? type !== 'primary' : type === 'lyceum');
// закріплення: кожен населений пункт іде до найближчої школи, яка навчає цю вікову групу
export function assignSchools(schools, open = s => true) {
  const res = new Map();
  for (const p of PLACES) {
    const m = {};
    for (const band of Object.keys(BANDS)) {
      let best = null, bt = Infinity;
      for (const s of schools) {
        if (!open(s) || !serves(s.type, band)) continue;
        const t = carT(p.id, s.place) - (s.place === p.id ? 0.5 : 0);
        if (t < bt) { bt = t; best = s.id; }
      }
      m[band] = best;
    }
    res.set(p.id, m);
  }
  return res;
}
export const pupilsOf = (A, band) => sumAge(A, BANDS[band][0], BANDS[band][1]) * ENROL;
export const SCHOOLS = SCHOOL_DEF.map(([id, place, type, cap, built, no]) => ({ id, cat: 'school', place, type, cap, built, no, ...spot(place) }));
{
  const asg = assignSchools(SCHOOLS);
  SCHOOLS.forEach(s => { s.pupils = 0; s.bands = { primary: 0, basic: 0, senior: 0 }; s.from = []; });
  const byId = new Map(SCHOOLS.map(s => [s.id, s]));
  for (const p of PLACES) for (const [band, sid] of Object.entries(asg.get(p.id))) {
    const n = pupilsOf(p.age, band), s = byId.get(sid);
    s.bands[band] += n; s.pupils += n;
    if (!s.from.includes(p.id)) s.from.push(p.id);
  }
  SCHOOLS.forEach(s => {
    s.pupils = Math.round(s.pupils);
    s.occ = s.pupils / s.cap;
    // класи: на паралель не більше 28 учнів, щонайменше один клас, якщо є діти
    const grades = s.type === 'lyceum' ? 11 : s.type === 'gym' ? 9 : 4;
    const per = s.pupils / grades;
    s.classes = per > 0 ? grades * Math.max(1, Math.ceil(per / 28)) : 0;
    s.teachers = Math.round(s.classes * 1.55 + 3);
    s.area = Math.round(s.cap * 7.4 + 600);
    // видатки: утримання будівлі + класи (зарплата, навчальні витрати), тис. грн на рік
    s.cost = Math.round(1150 + s.area * 0.42 + s.classes * 840);
    s.perPupil = s.pupils ? s.cost / s.pupils : 0;
    s.bus = { s1: 2, s2: 1, s3: 0, s4: 1, s5: 2, s6: 2, s7: 1, s8: 1, s9: 1, s10: 1, s11: 1, s12: 1, s13: 0, s14: 0 }[s.id];
  });
}
export const SCHOOL_BY = new Map(SCHOOLS.map(s => [s.id, s]));

// ——— освіта: заклади дошкільної освіти ———
const KG_DEF = [['k1', 'vrc', 240, 1978], ['k2', 'vrn', 190, 1984], ['k3', 'vrw', 150, 1969], ['k4', 'vre', 110, 1981], ['k5', 'yas', 150, 1976], ['k6', 'oze', 120, 1973], ['k7', 'kle', 60, 1988], ['k8', 'dub', 60, 1971], ['k9', 'kal', 50, 1985]];
const KG_ATT = { district: 0.74, town: 0.62, village: 0.48 };
export const KGS = KG_DEF.map(([id, place, cap, built], n) => ({ id, cat: 'kg', place, cap, built, no: n + 1, ...spot(place) }));
{
  KGS.forEach(k => { k.kids = 0; k.demand = 0; k.from = []; });
  for (const p of PLACES) {
    let best = null, bt = Infinity;
    for (const k of KGS) { const t = carT(p.id, k.place) - (k.place === p.id ? 0.5 : 0); if (t < bt) { bt = t; best = k; } }
    const want = sumAge(p.age, 1, 5) * (bt <= 14 ? KG_ATT[p.kind] : 0.12);
    best.demand += want; best.from.push(p.id);
  }
  KGS.forEach(k => { k.demand = Math.round(k.demand); k.kids = Math.min(k.cap, k.demand); k.queue = Math.max(0, k.demand - k.cap); k.occ = k.kids / k.cap; k.area = Math.round(k.cap * 9 + 300); k.cost = Math.round(900 + k.area * 0.4 + k.kids * 46); });
}

// ——— охорона здоров'я ———
// амбулаторії a1…a5 і лікарня h1 з модуля транспорту; пункти здоров'я (ФАП) у селах
const DOCTORS = { a1: 9, a2: 3, a3: 4, a4: 3, a5: 3 };
export const HEALTH = [
  { id: 'h1', cat: 'health', kind: 'hospital', place: 'vrc', beds: 160, built: 1977 },
  ...['a1', 'a2', 'a3', 'a4', 'a5'].map(id => {
    const L = S.ambLoads.find(x => x.id === id);
    return { id, cat: 'health', kind: 'amb', place: { a1: 'vrc', a2: 'vre', a3: 'yas', a4: 'oze', a5: 'dub' }[id], cap: L.cap, served: L.pop, places: L.places, doctors: DOCTORS[id] };
  }),
  ...[['f1', 'sta', 1], ['f2', 'lyp', 1], ['f3', 'ter', 0], ['f4', 'kal', 1], ['f5', 'ber', 1], ['f6', 'luh', 0], ['f7', 'yab', 1], ['f8', 'ver', 1], ['f9', 'vys', 0]]
    .map(([id, place, staff], n) => ({ id, cat: 'health', kind: 'fap', place, staff: !!staff, no: n + 1 })),
].map(o => ({ ...o, ...spot(o.place) }));
HEALTH.filter(h => h.kind === 'amb').forEach(h => {
  h.decl = h.places.reduce((a, id) => a + BY_ID.get(id).src.decl, 0);
  h.perDoc = h.decl / h.doctors;
  h.built = { a1: 1977, a2: 1983, a3: 1990, a4: 1987, a5: 2019 }[h.id];
});
HEALTH.filter(h => h.kind === 'fap').forEach(h => { h.built = 1960 + (IDX.get(h.place) * 7) % 30; h.served = BY_ID.get(h.place).pop; });

// ——— адміністративні послуги: ЦНАП, віддалені місця, старостати ———
export const ADMIN = [
  { id: 'c1', cat: 'admin', kind: 'cnap', place: 'vrc', services: 18400, built: 1981 },
  { id: 'c2', cat: 'admin', kind: 'remote', place: 'yas', services: 3900, built: 1979 },
  { id: 'c3', cat: 'admin', kind: 'remote', place: 'oze', services: 2700, built: 1984 },
  ...OKRUGS.filter(o => o.id !== 'city').map(o => ({ id: 'st-' + o.id, cat: 'admin', kind: 'starosta', place: o.center, okrug: o.id, services: ['yas', 'oze'].includes(o.id) ? Math.round(RA.u(90, 130)) : Math.round(o.places.reduce((a, id) => a + BY_ID.get(id).pop, 0) * RA.u(0.08, 0.16)), built: 1965 + Math.round(RA.u(0, 25)) })),
].map(o => ({ ...o, ...spot(o.place) }));

// ——— безпека: укриття ———
// kind: pru (захисна споруда, протирадіаційне укриття), simple (найпростіше укриття), dual (споруда подвійного призначення)
// state: ready (готове), limited (обмежено готове), not (не готове)
const SH_DEF = [
  ['vrc', 'pru', 460, 'ready', 'admin', 1], ['vrc', 'pru', 320, 'ready', 'res', 1], ['vrc', 'simple', 150, 'ready', 'res', 0], ['vrc', 'simple', 120, 'limited', 'res', 0], ['vrc', 'dual', 240, 'ready', 'health', 1],
  ['vrn', 'pru', 380, 'ready', 'res', 1], ['vrn', 'simple', 140, 'ready', 'res', 0], ['vrn', 'simple', 100, 'limited', 'res', 0],
  ['vrw', 'pru', 300, 'limited', 'res', 0], ['vrw', 'simple', 130, 'ready', 'res', 0],
  ['vre', 'simple', 160, 'not', 'res', 0], ['vre', 'simple', 90, 'limited', 'res', 0],
  ['yas', 'pru', 260, 'ready', 'admin', 1], ['yas', 'simple', 110, 'ready', 'club', 0],
  ['oze', 'pru', 220, 'limited', 'admin', 0], ['oze', 'simple', 90, 'ready', 'club', 0],
  ['kle', 'simple', 80, 'ready', 'club', 0], ['dub', 'simple', 70, 'ready', 'club', 0], ['kal', 'simple', 60, 'limited', 'club', 0],
  ['sta', 'simple', 40, 'ready', 'club', 0], ['kov', 'simple', 50, 'not', 'club', 0], ['lyp', 'simple', 45, 'ready', 'club', 0],
  ['yan', 'simple', 40, 'limited', 'admin', 0], ['top', 'simple', 30, 'not', 'club', 0], ['lis2', 'simple', 40, 'ready', 'club', 0],
];
// укриття шкіл: місткість відносно учнів визначає, чи можливе очне навчання
const SCHOOL_SH = { s1: [1050, 'ready'], s2: [800, 'ready'], s3: [480, 'ready'], s4: [360, 'limited'], s5: [580, 'ready'], s6: [430, 'ready'], s7: [190, 'ready'], s8: [150, 'limited'], s9: [150, 'ready'], s10: [60, 'limited'], s11: [150, 'ready'], s12: [0, null], s13: [0, null], s14: [70, 'ready'] };
export const SHELTERS = [
  ...SH_DEF.map(([place, kind, cap, state, host, inclusive], n) => ({ id: 'u' + (n + 1), cat: 'shelter', place, kind, cap, state, host, inclusive: !!inclusive, ...spot(place, 0.15) })),
  ...SCHOOLS.filter(s => SCHOOL_SH[s.id][0] > 0).map(s => ({ id: 'u-' + s.id, cat: 'shelter', place: s.place, kind: s.type === 'lyceum' ? 'pru' : 'simple', cap: SCHOOL_SH[s.id][0], state: SCHOOL_SH[s.id][1], host: 'school', school: s.id, inclusive: ['s1', 's2', 's5'].includes(s.id), ...beside(s, 0.12, -0.12) })),
];
SCHOOLS.forEach(s => { const sh = SHELTERS.find(u => u.school === s.id); s.shelter = sh ? sh.id : null; s.shelterCap = sh ? sh.cap : 0; s.shelterState = sh ? sh.state : null; s.staff = Math.round(s.teachers * 1.35); });

// ——— енергостійкість: пункти незламності ———
const PT_DEF = [
  ['c1', 'vrc', 60, 72, 1, 1], ['s2', 'vrn', 45, 48, 1, 1], ['s3', 'vrw', 30, 36, 1, 1], ['s4', 'vre', 30, 24, 1, 0], ['s5', 'yas', 40, 48, 1, 1], ['s6', 'oze', 35, 48, 1, 1],
  ['st-kle', 'kle', 15, 24, 1, 0], ['s8', 'dub', 20, 36, 1, 1], ['s9', 'kal', 15, 24, 0, 1], ['s10', 'ber', 12, 18, 1, 0], ['s11', 'mal', 12, 24, 0, 0], ['st-yan', 'yan', 10, 12, 1, 0],
  ['st-luh', 'luh', 10, 18, 0, 0], ['f1', 'sta', 8, 12, 0, 0],
];
export const POINTS = PT_DEF.map(([host, place, kw, hours, starlink, heat], n) => {
  const h = [...SCHOOLS, ...ADMIN, ...HEALTH].find(o => o.id === host);
  return { id: 'p' + (n + 1), cat: 'point', place, host, kw, hours, starlink: !!starlink, heat: !!heat, broken: host === 's11', ...beside(h, -0.14, 0.14) };
});

// ——— вода: централізоване водопостачання за населеними пунктами ———
// share: частка домогосподарств, підключених до мережі; wells: свердловини; gen: резервне живлення насосів; nitr: перевищення нітратів у пробах
const WATER_DEF = {
  vrc: [0.95, 4, 1, 0, 1972], vrn: [0.93, 0, 1, 0, 1984], vrw: [0.9, 0, 1, 0, 1968], vre: [0.86, 2, 0, 0, 1979], yas: [0.81, 3, 1, 0, 1977], oze: [0.77, 2, 0, 0, 1974],
  kle: [0.58, 1, 0, 0, 1983], dub: [0.62, 1, 1, 0, 1981], kal: [0.48, 1, 0, 0, 1986], ber: [0.41, 1, 0, 0, 1979], mal: [0.36, 1, 0, 0, 1988], yab: [0.52, 1, 0, 0, 1990],
  sta: [0.3, 1, 0, 1, 1985], kov: [0.28, 1, 0, 1, 1987], luh: [0.33, 1, 0, 0, 1982], ver: [0.22, 1, 0, 1, 1989], lyp: [0.18, 1, 0, 0, 1991],
};
export const WATER = PLACES.map(p => {
  const d = WATER_DEF[p.id];
  return d ? { place: p.id, share: d[0], wells: d[1], gen: !!d[2], nitr: !!d[3], built: d[4], km: round(p.pop * d[0] * (p.kind === 'village' ? 0.0042 : 0.0016) + d[1] * 0.4, 0.1), loss: p.kind === 'district' ? 0.34 : RW.u(0.22, 0.4), test: d[3] ? '2026-08-14' : p.kind === 'village' ? '2026-03-20' : '2026-09-12' } : { place: p.id, share: 0, wells: 0, gen: false, nitr: false, built: null, km: 0, loss: null, test: null };
});
// насосні станції (свердловини) як об'єкти на карті: одна на населений пункт із мережею
export const PUMPS = WATER.filter(w => w.wells > 0).map((w, n) => ({ id: 'w' + (n + 1), cat: 'water', place: w.place, wells: w.wells, gen: w.gen, nitr: w.nitr, ...spot(w.place, 0.3) }));
WATER.forEach(w => { w.pump = (PUMPS.find(x => x.place === w.place) || {}).id || null; });
// селища й районні мережі без власних свердловин живляться від найближчої насосної
WATER.filter(w => w.share > 0 && !w.pump).forEach(w => { w.pump = PUMPS.find(x => x.place === 'vrc').id; });

// ——— культура і спорт ———
const CULT_DEF = [['vrc', 'palace'], ['yas', 'house'], ['oze', 'house'], ['kle', 'club'], ['dub', 'club'], ['kal', 'club'], ['ber', 'club'], ['mal', 'club'], ['luh', 'club'], ['sta', 'club'], ['yan', 'club'], ['kov', 'club'], ['top', 'club'], ['lis2', 'club'],
  ['vrc', 'library'], ['vrn', 'library'], ['yas', 'library'], ['oze', 'library'], ['kle', 'library'], ['dub', 'library'], ['vrc', 'stadium'], ['yas', 'stadium'], ['oze', 'stadium']];
export const CULTURE = CULT_DEF.map(([place, kind], n) => ({ id: 'cu' + (n + 1), cat: 'culture', place, kind, built: 1958 + ((n * 11) % 34), ...spot(place, 0.1) }));

// ——— дороги: стан і власник ———
const COND = { national: [0.72, 0.28, 0], regional: [0.38, 0.47, 0.15], town: [0.48, 0.36, 0.16], local: [0.22, 0.4, 0.38], dirt: [0, 0.3, 0.7] };
export const ROADS = S.roads.map(r => {
  const p = COND[r.cls], u = RR();
  const cond = u < p[0] ? 'good' : u < p[0] + p[1] ? 'fair' : 'poor';
  return { ...r, cond, owner: r.cls === 'national' || r.cls === 'regional' ? 'state' : 'community', repaired: cond === 'good' ? 2019 + Math.floor(RR.u(0, 7)) : cond === 'fair' ? 2009 + Math.floor(RR.u(0, 10)) : 1990 + Math.floor(RR.u(0, 18)) };
});
// вуличне освітлення: частка вулиць з освітленням (інвентаризація 2023 року)
export const LIGHT = Object.fromEntries(PLACES.map(p => [p.id, p.kind === 'district' ? RL.u(0.82, 0.93) : p.kind === 'town' ? RL.u(0.66, 0.76) : Math.max(0.05, Math.min(0.7, 0.18 + p.pop / 2600 + RL.u(-0.08, 0.12)))]));

// ——— комунальні будівлі: реєстр майна ———
// права власності, кадастровий номер ділянки під будівлею, енергоаудит, площа за двома документами
const BLD_SRC = [...SCHOOLS, ...KGS, ...HEALTH, ...ADMIN.filter(a => a.kind !== 'remote'), ...CULTURE.filter(c => c.kind !== 'stadium')];
export const BUILDINGS = BLD_SRC.map(o => {
  const area = o.area || (o.cat === 'health' ? (o.kind === 'hospital' ? 9800 : o.kind === 'amb' ? 1300 : 160) : o.cat === 'admin' ? (o.kind === 'cnap' ? 1900 : 280) : o.kind === 'palace' ? 3200 : o.kind === 'house' ? 1400 : o.kind === 'library' ? 420 : 520);
  const old = (o.built || 1975) < 1975;
  const rights = RB() > (old ? 0.24 : 0.1), cad = RB() > (old ? 0.32 : 0.16);
  const audit = RB() < (o.cat === 'school' || o.cat === 'health' ? 0.72 : 0.38) ? 2016 + Math.floor(RB.u(0, 10)) : null;
  const kwh = Math.round((old ? RB.u(185, 260) : RB.u(130, 195)) * (audit && audit >= 2020 ? 0.86 : 1));
  const areaDoc = RB() < 0.12 ? Math.round(area * RB.u(0.78, 0.92)) : area;
  return { id: o.id, place: o.place, cat: o.cat, kind: o.kind || o.type, area, areaDoc, built: o.built || 1975, rights, cad, audit, kwh, heat: o.cat === 'school' && o.place === 'vrw' ? 'biomass' : ['district', 'town'].includes(BY_ID.get(o.place).kind) ? 'central' : RB() < 0.55 ? 'gas' : 'solid', cost: Math.round(area * kwh * 0.0052) };
});
export const BLD_BY = new Map(BUILDINGS.map(b => [b.id, b]));

// ——— земля за округами ———
// агроугіддя з модуля рельєфу (рілля і луки); частка з кадастровими номерами і використання без документів (оцінка за знімками)
const LAND_REG = { city: 0.95, dub: 0.84, yas: 0.9, kle: 0.87, yab: 0.82, luh: 0.77, ber: 0.8, yan: 0.86, kal: 0.88, oze: 0.91 };
const LAND_USED = { city: 0.2, dub: 0.38, yas: 0.3, kle: 0.33, yab: 0.42, luh: 0.45, ber: 0.4, yan: 0.34, kal: 0.31, oze: 0.26 };
export const LAND_RATE = 1250;   // грн з гектара на рік: середня плата (податок або оренда) для угідь з документами
export const LAND = OKRUGS.map(o => {
  const ps = o.places.map(id => BY_ID.get(id));
  const area = ps.reduce((a, p) => a + p.area, 0), arable = ps.reduce((a, p) => a + p.cover[3], 0), meadow = ps.reduce((a, p) => a + p.cover[4], 0);
  const agri = (arable + meadow) * 100;                         // га
  const reg = LAND_REG[o.id], unreg = agri * (1 - reg), used = unreg * LAND_USED[o.id];
  return { okrug: o.id, area, agri, arable: arable * 100, forest: ps.reduce((a, p) => a + p.cover[2], 0) * 100, reg, unreg, used, gap: used * LAND_RATE / 1000 };
});

// ——— бюджет, млн грн (2026: очікуване виконання) ———
export const BUDGET = {
  rev: [
    ['pdfo', [212, 248, 286, 302, 318, 336]], ['single', [41, 44, 52, 58, 63, 67]], ['land', [38, 39, 41, 43, 44, 46]],
    ['property', [4.1, 3.9, 4.6, 5.0, 5.3, 5.6]], ['excise', [9.2, 9.8, 11.4, 12.1, 12.8, 13.5]], ['other', [12, 11, 13, 14, 15, 16]],
  ],
  transfers: [['eduSub', [158, 164, 171, 176, 180, 182]], ['dotation', [26, 24, 23, 22, 21, 21]], ['otherSub', [22, 31, 26, 20, 19, 18]]],
  exp: [['edu', 352], ['health', 38], ['social', 41], ['housing', 64], ['culture', 22], ['roads', 48], ['admin', 58], ['defense', 31], ['other', 22]],
  capex: [0.09, 0.06, 0.08, 0.1, 0.11, 0.11],
};
export const own = y => BUDGET.rev.reduce((a, [, v]) => a + v[y], 0);
export const transfers = y => BUDGET.transfers.reduce((a, [, v]) => a + v[y], 0);

// ——— економіка ———
export const ECONOMY = {
  fop: [1720, 1610, 1790, 1880, 1940, 1985], firms: [398, 371, 388, 401, 408, 412],
  wage: [11900, 12600, 14700, 16300, 17100, 17900],          // середня зарплата за базою ПДФО, грн на місяць
  unemployed: [520, 760, 610, 470, 430, 410],
  employers: [['agro', 640, 'ber'], ['hospital', 410, 'vrc'], ['elevator', 120, 'vre'], ['bakery', 95, 'vrn'], ['dairy', 160, 'yas'], ['wood', 85, 'oze']],
};

// ——— джерела даних ———
// freq: днів між оновленнями; access: api (автоматично), export (вивантаження), manual (вручну), request (за запитом)
export const SOURCES = [
  { id: 'reg', owner: 'cnap', freq: 30, access: 'export', updated: '2026-10-01', records: TOTAL.reg },
  { id: 'idp', owner: 'social', freq: 30, access: 'export', updated: '2026-10-01', records: TOTAL.idp },
  { id: 'decl', owner: 'health', freq: 30, access: 'export', updated: '2026-10-01', records: TOTAL.decl },
  { id: 'meters', owner: 'energy', freq: 91, access: 'request', updated: '2026-09-30', records: TOTAL.meters },
  { id: 'edu', owner: 'edu', freq: 365, access: 'export', updated: '2026-09-05', records: SCHOOLS.length + KGS.length },
  { id: 'health', owner: 'health', freq: 91, access: 'manual', updated: '2026-07-01', records: HEALTH.length },
  { id: 'shelter', owner: 'safety', freq: 91, access: 'manual', updated: '2026-04-15', records: SHELTERS.length },
  { id: 'points', owner: 'safety', freq: 30, access: 'manual', updated: '2026-10-20', records: PT_DEF.length },
  { id: 'property', owner: 'property', freq: 365, access: 'manual', updated: '2025-12-31', records: BUILDINGS.length },
  { id: 'land', owner: 'land', freq: 91, access: 'export', updated: '2026-07-01', records: 18640 },
  { id: 'budget', owner: 'finance', freq: 30, access: 'api', updated: '2026-10-31', records: 1240 },
  { id: 'economy', owner: 'economy', freq: 91, access: 'request', updated: '2026-10-01', records: ECONOMY.fop[5] + ECONOMY.firms[5] },
  { id: 'roads', owner: 'housing', freq: 365, access: 'manual', updated: '2024-06-30', records: S.roads.length },
  { id: 'water', owner: 'utility', freq: 91, access: 'manual', updated: '2026-06-30', records: PUMPS.length + WATER.filter(w => w.share > 0).length },
  { id: 'light', owner: null, freq: 365, access: 'manual', updated: '2023-03-31', records: PLACES.length },
  { id: 'transport', owner: 'transport', freq: 30, access: 'export', updated: '2026-10-15', records: S.routes.length },
  { id: 'gis', owner: 'gis', freq: 365, access: 'model', updated: '2026-11-01', records: S.roads.length + S.places.length },
];
export const SRC_BY = new Map(SOURCES.map(s => [s.id, s]));
export const dayOf = iso => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
export const ageDays = iso => TODAY_DAY - dayOf(iso);
export const isStale = s => ageDays(s.updated) > s.freq * 1.5;

// усі об'єкти карти
export const OBJECTS = [...SCHOOLS, ...KGS, ...HEALTH, ...ADMIN, ...SHELTERS, ...POINTS, ...PUMPS, ...CULTURE];
export const OBJ_BY = new Map(OBJECTS.map(o => [o.id, o]));
