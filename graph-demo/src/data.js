// Синтетична мережа для демо графової аналітики.
// П'ять умовних громад, домогосподарства, люди, фахівці із соціальної роботи і заклади.
// Генерація детермінована (фіксоване зерно): кожен відвідувач бачить ту саму мережу.
// Реальних людей, адрес і медичних записів тут немає.

export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = arr => arr[Math.floor(next() * arr.length)];
  next.chance = p => next() < p;
  next.weighted = pairs => {
    const sum = pairs.reduce((s, p) => s + p[1], 0);
    let x = next() * sum;
    for (const [v, w] of pairs) { x -= w; if (x < 0) return v; }
    return pairs[pairs.length - 1][0];
  };
  return next;
}

function poisson(mean, r) {
  const L = Math.exp(-mean);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

// Громади: умовні, з різним профілем, щоб мережі відрізнялися.
export const TERRITORIES = [
  { id: 'a', size: 58, kind: 'urban', angle: -90, idp: .36, lowIncome: .20, decl: .93, visitLag: 0, family: .72, svc: .7, volunteer: .55, rehab: .64, p80: .36, disability: 1,
    mix: [['elderSingle', 12], ['elderCouple', 9], ['family', 26], ['singleParent', 10], ['multigen', 7], ['adultSingle', 20], ['adultCouple', 16]] },
  { id: 'e', size: 50, kind: 'suburban', angle: -18, idp: .24, lowIncome: .26, decl: .91, visitLag: 0, family: .70, svc: .5, volunteer: .55, rehab: .60, p80: .36, disability: 1,
    mix: [['elderSingle', 10], ['elderCouple', 10], ['family', 30], ['singleParent', 16], ['multigen', 10], ['adultSingle', 12], ['adultCouple', 12]] },
  { id: 'c', size: 44, kind: 'mixed', angle: 54, idp: .12, lowIncome: .30, decl: .90, visitLag: 1, family: .64, svc: .56, volunteer: .5, rehab: .56, p80: .40, disability: 1.6,
    mix: [['elderSingle', 18], ['elderCouple', 14], ['family', 22], ['singleParent', 8], ['multigen', 12], ['adultSingle', 14], ['adultCouple', 12]] },
  { id: 'd', size: 32, kind: 'remote', angle: 126, idp: .05, lowIncome: .44, decl: .74, visitLag: 4, family: .46, svc: .94, volunteer: .3, rehab: .28, p80: .52, disability: 1.1,
    mix: [['elderSingle', 38], ['elderCouple', 24], ['family', 8], ['singleParent', 4], ['multigen', 10], ['adultSingle', 10], ['adultCouple', 6]] },
  { id: 'b', size: 46, kind: 'rural', angle: 198, idp: .08, lowIncome: .36, decl: .87, visitLag: 2, family: .56, svc: .6, volunteer: .4, rehab: .34, p80: .44, disability: 1.1,
    mix: [['elderSingle', 30], ['elderCouple', 22], ['family', 13], ['singleParent', 5], ['multigen', 13], ['adultSingle', 10], ['adultCouple', 7]] },
];
export const TERRITORY_ORDER = ['a', 'b', 'c', 'd', 'e'];

// Фахівці і заклади. Амбулаторія Б обслуговує і громаду Г, де власного закладу немає.
export const SERVICES = [
  { id: 'sw1', kind: 'sw', territory: 'a', n: 1 },
  { id: 'sw2', kind: 'sw', territory: 'a', n: 2 },
  { id: 'sw3', kind: 'sw', territory: 'b', n: 3 },
  { id: 'sw4', kind: 'sw', territory: 'c', n: 4 },
  { id: 'sw5', kind: 'sw', territory: 'd', n: 5 },
  { id: 'sw6', kind: 'sw', territory: 'e', n: 6 },
  { id: 'clinic-a', kind: 'clinic', territory: 'a', serves: ['a'] },
  { id: 'clinic-b', kind: 'clinic', territory: 'b', serves: ['b', 'd'] },
  { id: 'clinic-c', kind: 'clinic', territory: 'c', serves: ['c'] },
  { id: 'clinic-e', kind: 'clinic', territory: 'e', serves: ['e'] },
  { id: 'rehab', kind: 'rehab', territory: null },
];

export const EDGE_TYPES = ['household', 'family', 'care', 'support', 'social', 'clinic', 'rehab', 'duplicate'];
export const INFORMAL = new Set(['household', 'family', 'care', 'support']);

const SEED = 20261030;

export function generate() {
  const r = rng(SEED);
  const people = [];
  const households = [];
  const edges = [];
  const usedIds = new Set();
  const newId = (prefix, lo, hi) => {
    let n;
    do { n = r.int(lo, hi); } while (usedIds.has(prefix + n));
    usedIds.add(prefix + n);
    return prefix + n;
  };

  const elderAge = T => (r.chance(T.p80) ? r.int(80, 94) : r.int(65, 79));
  const elderSex = age => (r.chance(age >= 80 ? .68 : .58) ? 'f' : 'm');

  // 1. Домогосподарства і люди
  for (const T of TERRITORIES) {
    let count = 0;
    while (count < T.size) {
      const type = r.weighted(T.mix);
      const hh = { id: newId('H-', 100, 999), territory: T.id, type, members: [] };
      hh.idp = type !== 'multigen' && r.chance(T.idp * (type.startsWith('elder') ? .5 : 1));
      const add = (age, sex, role) => {
        const p = { id: newId('P-', 1001, 9899), kind: 'person', territory: T.id, hh: hh.id, age, sex, role };
        people.push(p); hh.members.push(p.id);
        return p;
      };
      const kids = (n, parentAge) => {
        for (let i = 0; i < n; i++) add(r.int(0, Math.min(17, parentAge - 19)), r.chance(.5) ? 'f' : 'm', 'child');
      };
      if (type === 'elderSingle') { const a = elderAge(T); add(a, elderSex(a), 'elder'); }
      else if (type === 'elderCouple') {
        const a = elderAge(T); add(a, 'f', 'elder');
        add(Math.min(96, Math.max(65, a + r.int(-4, 6))), 'm', 'elder');
      } else if (type === 'family') {
        const a = r.int(25, 47);
        add(a, 'f', 'adult'); add(a + r.int(-2, 6), 'm', 'adult');
        kids(r.weighted([[1, 52], [2, 38], [3, 10]]), a);
      } else if (type === 'singleParent') {
        const a = r.int(22, 49);
        add(a, r.chance(.86) ? 'f' : 'm', 'adult');
        kids(r.weighted([[1, 66], [2, 29], [3, 5]]), a);
      } else if (type === 'multigen') {
        const g = r.int(72, 92);
        add(g, elderSex(g), 'elder');
        const m = r.int(40, 62);
        add(m, r.chance(.6) ? 'f' : 'm', 'adult');
        if (r.chance(.5)) add(m + r.int(-3, 5), r.chance(.5) ? 'f' : 'm', 'adult');
        if (m < 52) kids(r.weighted([[0, 30], [1, 45], [2, 25]]), m);
      } else if (type === 'adultSingle') {
        add(r.int(19, 64), r.chance(.5) ? 'f' : 'm', 'adult');
      } else {
        const a = r.int(24, 63);
        add(a, 'f', 'adult'); add(Math.min(64, a + r.int(-3, 6)), 'm', 'adult');
      }
      hh.lowIncome = r.chance(T.lowIncome + (hh.idp ? .16 : 0) + (type === 'singleParent' ? .18 : 0) + (type === 'elderSingle' ? .12 : 0));
      hh.benefits = hh.lowIncome ? r.chance(.7) : r.chance(.05);
      households.push(hh);
      count += hh.members.length;
    }
  }

  const byId = new Map(people.map(p => [p.id, p]));
  const hhById = new Map(households.map(h => [h.id, h]));
  const terr = new Map(TERRITORIES.map(t => [t.id, t]));

  // 2. Характеристики людей
  for (const p of people) {
    const hh = hhById.get(p.hh), T = terr.get(p.territory), a = p.age;
    const band = a < 18 ? 'child' : a < 40 ? 'young' : a < 65 ? 'mid' : a < 80 ? 'old' : 'oldest';
    p.idp = hh.idp;
    p.lowIncome = hh.lowIncome;
    p.hhSize = hh.members.length;
    p.singleParentHH = hh.type === 'singleParent';
    const disP = { child: .04, young: .05, mid: .10, old: .16, oldest: .24 }[band] * T.disability;
    p.disability = r.chance(disP) ? r.weighted([[1, 16], [2, 44], [3, 40]]) : 0;
    if (band === 'child' && p.disability === 3) p.disability = 2;
    p.chronic = Math.min(5, poisson({ child: .08, young: .3, mid: .95, old: 1.9, oldest: 2.6 }[band] + (p.disability ? .8 : 0), r));
    let mob = { child: .02, young: .02, mid: .04, old: .13, oldest: .46 }[band];
    if (p.disability === 1) mob = Math.max(mob, .9);
    else if (p.disability === 2) mob = Math.max(mob, .42);
    p.mobility = r.chance(mob);
    let reh = .02;
    if (p.disability && band === 'child') reh = .6;
    else if (p.disability >= 2 && a < 80 && p.chronic >= 1) reh = .44;
    else if (p.mobility && a < 86) reh = .38;
    p.rehabNeed = r.chance(reh);
    p.unemployed = a >= 18 && a < 65 && r.chance(hh.idp ? .42 : (T.id === 'b' || T.id === 'd') ? .2 : .12);
    let decl = T.decl - (hh.idp ? .3 : 0);
    if (band === 'child') decl = Math.min(.97, decl + .05);
    p.declaration = r.chance(decl);
    if (p.declaration) {
      const base = p.chronic >= 2 ? 3 : p.chronic === 1 ? 6 : 10;
      p.lastVisit = Math.max(0, Math.round(base * (0.4 + r() * 1.4) + T.visitLag * r() * 3.2));
    } else {
      p.lastVisit = r.chance(.45) ? null : r.int(5, 30);
    }
    p.benefits = hh.benefits || (p.disability > 0 && r.chance(.4));
    p.careNeed = (p.mobility && a >= 70) || p.disability === 1 || (a >= 85 && p.chronic >= 3);
    p.caring = 0;
    p.parentLinks = 0;
  }

  const link = (s, t, type, extra) => edges.push({ s, t, type, ...extra });

  // 3. Домогосподарство: усі члени пов'язані між собою
  for (const hh of households) {
    const m = hh.members;
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) link(m[i], m[j], 'household');
  }

  // 4. Родина поза домогосподарством: діти літніх людей живуть окремо, часто в іншій громаді
  const capable = p => p.age >= 16 && p.age <= 84 && !p.careNeed && !p.mobility;
  const adultsIn = tid => people.filter(p => p.territory === tid && p.role === 'adult' && p.age >= 30 && p.age <= 62);
  const famOf = new Map(people.map(p => [p.id, []]));
  for (const hh of households) {
    if (!hh.type.startsWith('elder')) continue;
    const T = terr.get(hh.territory);
    if (!r.chance(T.family)) continue;
    const target = r.chance(.68) ? hh.territory : r.weighted(TERRITORIES.filter(t => t.id !== hh.territory).map(t => [t.id, { a: 45, e: 30, c: 15, b: 6, d: 4 }[t.id]]));
    const pool = adultsIn(target).filter(p => p.parentLinks < 2 && p.hh !== hh.id);
    if (!pool.length) continue;
    const child = r.pick(pool);
    child.parentLinks++;
    for (const id of hh.members) { link(id, child.id, 'family'); famOf.get(id).push(child.id); famOf.get(child.id).push(id); }
  }
  // родичі серед дорослих однієї громади
  for (const p of people) {
    if (p.role !== 'adult' || p.hhSize > 2 || !r.chance(.14)) continue;
    const pool = people.filter(q => q.territory === p.territory && q.role === 'adult' && q.hh !== p.hh && !famOf.get(p.id).includes(q.id));
    if (!pool.length) continue;
    const q = r.pick(pool);
    link(p.id, q.id, 'family'); famOf.get(p.id).push(q.id); famOf.get(q.id).push(p.id);
  }

  // 5. Сусідська підтримка. У кожній громаді є активна сусідка чи волонтер, до якого сходяться зв'язки.
  const hub = new Map(TERRITORIES.map(T => {
    const pool = people.filter(q => q.territory === T.id && q.role === 'adult' && q.age >= 45 && q.age <= 68 && q.hhSize <= 2 && capable(q));
    return [T.id, pool.length ? r.pick(pool) : null];
  }));
  for (const v of hub.values()) if (v) v.volunteer = true;
  for (const p of people) {
    const T = p.territory;
    if (p.hhSize === 1 && p.age >= 65 && r.chance(.36)) {
      const h = hub.get(T);
      const pool = people.filter(q => q.territory === T && q.age >= 60 && q.hh !== p.hh && capable(q));
      if (h && h.hh !== p.hh && r.chance(.5)) link(p.id, h.id, 'support');
      else if (pool.length) link(p.id, r.pick(pool).id, 'support');
    } else if (p.singleParentHH && p.role === 'adult' && r.chance(.3)) {
      const pool = people.filter(q => q.territory === T && q.role === 'adult' && q.hh !== p.hh);
      if (pool.length) link(p.id, r.pick(pool).id, 'support');
    }
  }

  // 6. Догляд: спершу хтось удома, далі родина, далі сусід або волонтер
  const needCare = people.filter(p => p.careNeed).sort((x, y) => y.age - x.age || (x.id < y.id ? -1 : 1));
  for (const p of needCare) {
    const hh = hhById.get(p.hh);
    let giver = hh.members.map(id => byId.get(id)).filter(q => q.id !== p.id && capable(q) && q.caring < 3).sort((x, y) => x.age - y.age)[0];
    if (!giver && r.chance(.55)) giver = famOf.get(p.id).map(id => byId.get(id)).filter(q => capable(q) && q.caring < 3 && q.age < 75)[0];
    if (!giver && r.chance(terr.get(p.territory).volunteer)) {
      const h = hub.get(p.territory);
      if (h && h.hh !== p.hh && h.caring < 4 && r.chance(.75)) giver = h;
      else {
        const pool = people.filter(q => q.territory === p.territory && q.hh !== p.hh && q.age >= 40 && q.age <= 72 && capable(q) && q.caring < 4);
        if (pool.length) giver = r.weighted(pool.map(q => [q, 1 + q.caring * 4]));
      }
    }
    if (giver) { giver.caring++; p.caredBy = giver.id; link(giver.id, p.id, 'care'); }
  }

  // 7. Соціальна служба: фахівець громади. У Г один фахівець на всіх, тому він перевантажений.
  const swOf = tid => SERVICES.filter(s => s.kind === 'sw' && s.territory === tid);
  const caseload = new Map(SERVICES.map(s => [s.id, 0]));
  for (const p of people) {
    const hh = hhById.get(p.hh), T = terr.get(p.territory);
    const eligible = p.careNeed || (p.age >= 70 && p.hhSize === 1) || (p.disability > 0 && hh.lowIncome && p.age >= 18) || (p.age >= 65 && hh.lowIncome) ||
      (p.role === 'adult' && hh.lowIncome && (p.singleParentHH || hh.idp || hh.members.length >= 5)) || (p.age >= 80 && p.chronic >= 2);
    const assign = eligible ? r.chance(T.svc) : (p.age >= 65 && r.chance(.08));
    if (!assign) continue;
    const sw = swOf(p.territory).sort((x, y) => caseload.get(x.id) - caseload.get(y.id))[0];
    caseload.set(sw.id, caseload.get(sw.id) + 1);
    p.sw = sw.id;
    link(p.id, sw.id, 'social');
  }

  // 8. Медицина: декларація з лікарем амбулаторії, реабілітаційний центр один на всіх
  for (const p of people) {
    const T = terr.get(p.territory);
    if (p.declaration) {
      const clinic = SERVICES.find(s => s.kind === 'clinic' && s.serves.includes(p.territory));
      p.clinic = clinic.id;
      link(p.id, clinic.id, 'clinic');
    }
    if (p.rehabNeed && r.chance(T.rehab)) { p.rehab = true; link(p.id, 'rehab', 'rehab'); }
  }

  // 9. Можливі дублікати: та сама людина записана двічі з іншого джерела.
  // Дубль не має медичних даних і зв'язків родини, тому в мережі виглядає ізольованим.
  const dupSources = ['a', 'b', 'c', 'e'].map(tid => {
    const pool = people.filter(p => p.territory === tid && p.age >= 58 && !p.dupOf && p.role !== 'child' && (p.sw || p.careNeed || p.lowIncome));
    return r.pick(pool);
  }).filter(Boolean);
  for (const src of dupSources) {
    const hh = { id: newId('H-', 100, 999), territory: src.territory, type: 'unknown', members: [], idp: src.idp, lowIncome: src.lowIncome, benefits: src.benefits };
    households.push(hh);
    const d = {
      ...src, id: newId('P-', 1001, 9899), hh: hh.id, hhSize: 1, role: src.role, dupOf: src.id,
      chronic: 0, declaration: false, lastVisit: null, mobility: src.mobility && r.chance(.5), rehabNeed: false,
      caring: 0, parentLinks: 0, caredBy: undefined, sw: undefined, clinic: undefined, rehab: false, singleParentHH: false,
    };
    d.careNeed = (d.mobility && d.age >= 70) || d.disability === 1;
    hh.members.push(d.id);
    people.push(d);
    byId.set(d.id, d);
    const sim = Math.round((0.86 + r() * 0.11) * 100) / 100;
    link(src.id, d.id, 'duplicate', { sim });
    // дубль часто прив'язаний до фахівця окремо від оригіналу
    if (r.chance(.6)) {
      const sw = swOf(d.territory).sort((x, y) => caseload.get(x.id) - caseload.get(y.id))[0];
      caseload.set(sw.id, caseload.get(sw.id) + 1);
      d.sw = sw.id;
      link(d.id, sw.id, 'social');
    }
  }

  return { people, households, services: SERVICES.map(s => ({ ...s })), edges };
}
