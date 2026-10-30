// Графова модель: складові індексу, мережеві метрики, характеристики, сигнали.
// Статична частина рахується один раз, динамічна (ваги індексу) при кожній зміні ваг.
import { EDGE_TYPES, INFORMAL, TERRITORY_ORDER, generate } from './data.js';

export const COMPONENTS = ['d', 's', 'm', 'n'];
export const PRESETS = {
  base: { d: 20, s: 25, m: 30, n: 25 },
  medical: { d: 15, s: 15, m: 50, n: 20 },
  social: { d: 15, s: 50, m: 15, n: 20 },
  network: { d: 15, s: 20, m: 20, n: 45 },
  equal: { d: 25, s: 25, m: 25, n: 25 },
};
export const LEVELS = ['low', 'moderate', 'high', 'critical'];
export const THRESHOLDS = [20, 35, 50];
export const CASELOAD_NORM = 12;
export const MIN_GROUP = 5;
export const KEY_IMPACT = 4; // скільки людей втрачають зв'язок, якщо вузол зникне
export const NEED_FULL = 40; // потреба, з якої брак підтримки враховується повністю

// Бали факторів. Кожна складова обрізається до 100.
export const FACTORS = {
  d: [['age80', 55], ['age65', 30], ['child', 15], ['alone', 30], ['singleParent', 20], ['dependents', 15]],
  s: [['lowIncome', 30], ['idp', 25], ['unemployed', 20], ['disability1', 35], ['disability2', 25], ['disability3', 15]],
  m: [['chronic3', 40], ['chronic2', 25], ['chronic1', 10], ['mobility', 25], ['rehabNeed', 15], ['noDecl', 10], ['noVisit', 10]],
  // мережа підтримки: бали за кожен зв'язок, у дужках межа
  n: [['hhAdults', 25, 2], ['family', 15, 2], ['care', 25, 1], ['support', 10, 2], ['sw', 15, 1]],
};
const PTS = Object.fromEntries(Object.values(FACTORS).flat().map(([k, v]) => [k, v]));

export const TRAITS = [
  { id: 'age80', domain: 'd', test: p => p.age >= 80 },
  { id: 'age65', domain: 'd', test: p => p.age >= 65 && p.age < 80 },
  { id: 'child', domain: 'd', test: p => p.age < 18 },
  { id: 'alone', domain: 'd', test: p => p.hhSize === 1 },
  { id: 'singleParent', domain: 'd', test: p => p.singleParentHH },
  { id: 'idp', domain: 's', test: p => p.idp },
  { id: 'lowIncome', domain: 's', test: p => p.lowIncome },
  { id: 'unemployed', domain: 's', test: p => p.unemployed },
  { id: 'disability', domain: 's', test: p => p.disability > 0 },
  { id: 'benefits', domain: 's', test: p => p.benefits },
  { id: 'socialService', domain: 's', test: p => !!p.sw },
  { id: 'isolated', domain: 's', test: p => p.informalDegree === 0 },
  { id: 'caregiver', domain: 's', test: p => p.caring > 0 },
  { id: 'chronic2', domain: 'm', test: p => p.chronic >= 2 },
  { id: 'mobility', domain: 'm', test: p => p.mobility },
  { id: 'rehabNeed', domain: 'm', test: p => p.rehabNeed },
  { id: 'noDecl', domain: 'm', test: p => !p.declaration },
  { id: 'noVisit', domain: 'm', test: p => p.chronic >= 1 && (p.lastVisit == null || p.lastVisit > 12) },
  { id: 'careNeed', domain: 'm', test: p => p.careNeed },
];

export const SIGNALS = [
  { id: 'careGap', severity: 'critical', icon: 'user', target: 'people' },
  { id: 'isolatedHigh', severity: 'critical', icon: 'unlink', target: 'people' },
  { id: 'caregiverLoad', severity: 'warning', icon: 'heart', target: 'people' },
  { id: 'caseload', severity: 'warning', icon: 'briefcase', target: 'services' },
  { id: 'householdMulti', severity: 'warning', icon: 'home', target: 'people' },
  { id: 'medAccess', severity: 'warning', icon: 'pulse', target: 'people' },
  { id: 'duplicates', severity: 'warning', icon: 'copy', target: 'people' },
  { id: 'keyPeople', severity: 'info', icon: 'nodes', target: 'people' },
  { id: 'rehabGap', severity: 'info', icon: 'route', target: 'people' },
  { id: 'benefitGap', severity: 'info', icon: 'wallet', target: 'people' },
];

const capable = p => p.age >= 16 && p.age <= 84 && !p.careNeed && !p.mobility;

// ——— статична частина ———
export function buildBase() {
  const { people, households, services, edges } = generate();
  const nodes = [...people, ...services];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const hhById = new Map(households.map(h => [h.id, h]));
  edges.forEach((e, i) => { e.i = i; });

  const adj = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    adj.get(e.s).push({ id: e.t, type: e.type, e, out: true });
    adj.get(e.t).push({ id: e.s, type: e.type, e, out: false });
  }
  const informal = new Map(people.map(p => [p.id, adj.get(p.id).filter(x => INFORMAL.has(x.type)).map(x => x.id)]));

  for (const p of people) {
    const links = adj.get(p.id);
    const cnt = t => links.filter(x => x.type === t).length;
    const hh = hhById.get(p.hh);
    const others = hh.members.filter(id => id !== p.id).map(id => byId.get(id));
    p.informalDegree = new Set(informal.get(p.id)).size;
    p.degree = links.length;
    p.familyTies = cnt('family');
    p.supportTies = cnt('support');
    p.dependents = p.role === 'adult' ? others.filter(q => q.age < 18 || q.careNeed).length : 0;
    // складові потреби
    const f = {};
    const on = k => { f[k] = true; return PTS[k]; };
    let d = 0, s = 0, m = 0;
    if (p.age >= 80) d += on('age80'); else if (p.age >= 65) d += on('age65'); else if (p.age < 18) d += on('child');
    if (p.hhSize === 1) d += on('alone');
    if (p.singleParentHH) d += on('singleParent');
    if (p.dependents >= 3) d += on('dependents');
    if (p.lowIncome) s += on('lowIncome');
    if (p.idp) s += on('idp');
    if (p.unemployed) s += on('unemployed');
    if (p.disability) s += on('disability' + p.disability);
    if (p.chronic >= 3) m += on('chronic3'); else if (p.chronic === 2) m += on('chronic2'); else if (p.chronic === 1) m += on('chronic1');
    if (p.mobility) m += on('mobility');
    if (p.rehabNeed) m += on('rehabNeed');
    if (!p.declaration) m += on('noDecl');
    if (p.chronic >= 1 && (p.lastVisit == null || p.lastVisit > 12)) m += on('noVisit');
    // мережа підтримки
    const sup = {
      hhAdults: Math.min(2, others.filter(capable).length),
      family: Math.min(2, p.familyTies),
      care: p.caredBy ? 1 : 0,
      support: Math.min(2, p.supportTies),
      sw: p.sw ? 1 : 0,
    };
    const support = Math.min(100, Object.entries(sup).reduce((a, [k, v]) => a + v * PTS[k], 0));
    p.factors = f;
    p.supportParts = sup;
    p.support = support;
    d = Math.min(100, d); s = Math.min(100, s); m = Math.min(100, m);
    // мережева складова: брак підтримки, зважений на потребу (ізоляція важить більше, коли потреба вища)
    p.needRaw = (d + s + m) / 3;
    p.gap = 100 - support;
    p.needFactor = Math.min(1, p.needRaw / NEED_FULL);
    p.sub = { d, s, m, n: Math.round(p.gap * p.needFactor) };
  }

  // компоненти неформальної мережі («коло підтримки»)
  let cid = 0;
  const comp = new Map();
  for (const p of people) {
    if (comp.has(p.id)) continue;
    const stack = [p.id];
    comp.set(p.id, cid);
    const members = [];
    while (stack.length) {
      const v = stack.pop();
      members.push(v);
      for (const w of informal.get(v)) if (!comp.has(w)) { comp.set(w, cid); stack.push(w); }
    }
    members.forEach(id => { byId.get(id).circle = members.length; byId.get(id).comp = cid; });
    cid++;
  }

  // посередництво (Brandes) у неформальній мережі
  const ids = people.map(p => p.id);
  const bc = new Map(ids.map(id => [id, 0]));
  for (const s of ids) {
    const stack = [], pred = new Map(), sigma = new Map(), dist = new Map();
    for (const v of ids) { pred.set(v, []); sigma.set(v, 0); dist.set(v, -1); }
    sigma.set(s, 1); dist.set(s, 0);
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
      const v = q[qi];
      stack.push(v);
      for (const w of new Set(informal.get(v))) {
        if (dist.get(w) < 0) { dist.set(w, dist.get(v) + 1); q.push(w); }
        if (dist.get(w) === dist.get(v) + 1) { sigma.set(w, sigma.get(w) + sigma.get(v)); pred.get(w).push(v); }
      }
    }
    const delta = new Map(ids.map(v => [v, 0]));
    while (stack.length) {
      const w = stack.pop();
      for (const v of pred.get(w)) delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
      if (w !== s) bc.set(w, bc.get(w) + delta.get(w));
    }
  }
  const maxBc = Math.max(1, ...bc.values());
  people.forEach(p => { p.betweenness = bc.get(p.id) / 2; p.bcNorm = bc.get(p.id) / maxBc; });

  // точки зчленування: людина, без якої коло підтримки розпадається
  const disc = new Map(), low = new Map(), cut = new Set();
  let time = 0;
  const dfs = (v, parent) => {
    disc.set(v, ++time); low.set(v, time);
    let children = 0;
    for (const w of new Set(informal.get(v))) {
      if (!disc.has(w)) {
        children++;
        dfs(w, v);
        low.set(v, Math.min(low.get(v), low.get(w)));
        if (parent != null && low.get(w) >= disc.get(v)) cut.add(v);
      } else if (w !== parent) low.set(v, Math.min(low.get(v), disc.get(w)));
    }
    if (parent == null && children > 1) cut.add(v);
  };
  for (const id of ids) if (!disc.has(id)) dfs(id, null);
  for (const id of cut) {
    const p = byId.get(id);
    const seen = new Set([id]);
    const parts = [];
    for (const start of new Set(informal.get(id))) {
      if (seen.has(start)) continue;
      let size = 0;
      const st = [start]; seen.add(start);
      while (st.length) {
        const v = st.pop(); size++;
        for (const w of informal.get(v)) if (!seen.has(w)) { seen.add(w); st.push(w); }
      }
      parts.push(size);
    }
    parts.sort((a, b) => b - a);
    p.cutImpact = parts.slice(1).reduce((a, b) => a + b, 0);
    p.cutHouseholds = new Set(informal.get(id).map(x => byId.get(x).hh)).size;
  }

  // фахівці і заклади
  for (const s of services) {
    const links = adj.get(s.id);
    s.cases = links.map(x => x.id);
    s.load = s.cases.length;
  }

  // характеристики людей і співпадіння
  const traitIdx = Object.fromEntries(TRAITS.map((t, i) => [t.id, i]));
  for (const p of people) p.traits = TRAITS.map(t => !!t.test(p));
  const N = people.length;
  const prevalence = TRAITS.map((t, i) => people.filter(p => p.traits[i]).length);
  const pairs = [];
  for (let i = 0; i < TRAITS.length; i++) {
    for (let j = i + 1; j < TRAITS.length; j++) {
      const both = people.filter(p => p.traits[i] && p.traits[j]).length;
      if (!prevalence[i] || !prevalence[j]) continue;
      const lift = (both * N) / (prevalence[i] * prevalence[j]);
      pairs.push({ a: TRAITS[i].id, b: TRAITS[j].id, ai: i, bi: j, n: both, lift });
    }
  }

  return {
    people, households, services, edges, nodes, byId, hhById, adj, informal, N,
    traitIdx, prevalence, pairs,
    dupPairs: edges.filter(e => e.type === 'duplicate'),
    edgeCount: Object.fromEntries(EDGE_TYPES.map(t => [t, edges.filter(e => e.type === t).length])),
  };
}

export const normalize = w => {
  const sum = COMPONENTS.reduce((a, k) => a + Math.max(0, w[k]), 0) || 1;
  return Object.fromEntries(COMPONENTS.map(k => [k, Math.max(0, w[k]) / sum]));
};
export const levelOf = v => (v >= THRESHOLDS[2] ? 'critical' : v >= THRESHOLDS[1] ? 'high' : v >= THRESHOLDS[0] ? 'moderate' : 'low');
export const levelRank = l => LEVELS.indexOf(l);
const isHigh = l => l === 'high' || l === 'critical';

function score(p, w) {
  const contrib = Object.fromEntries(COMPONENTS.map(k => [k, p.sub[k] * w[k]]));
  const index = COMPONENTS.reduce((a, k) => a + contrib[k], 0);
  const needW = w.d + w.s + w.m || 1;
  const need = (p.sub.d * w.d + p.sub.s * w.s + p.sub.m * w.m) / needW;
  return { index, contrib, need, level: levelOf(index) };
}

// ——— динамічна частина: ваги ———
export function buildModel(base, weights) {
  const w = normalize(weights);
  const w0 = normalize(PRESETS.base);
  const { people, services, households, byId, hhById } = base;
  const S = new Map();
  let changed = 0, up = 0, down = 0;
  for (const p of people) {
    const sc = score(p, w);
    const b = score(p, w0);
    sc.baseLevel = b.level;
    if (sc.level !== b.level) { changed++; levelRank(sc.level) > levelRank(b.level) ? up++ : down++; }
    S.set(p.id, sc);
  }
  const sc = id => S.get(id);
  const ranked = [...people].sort((a, b) => sc(b.id).index - sc(a.id).index || (a.id < b.id ? -1 : 1));
  ranked.forEach((p, i) => { S.get(p.id).rank = i + 1; });
  const levelCounts = Object.fromEntries(LEVELS.map(l => [l, people.filter(p => sc(p.id).level === l).length]));
  const avg = people.reduce((a, p) => a + sc(p.id).index, 0) / people.length;

  // сигнали
  const sig = {};
  sig.careGap = people.filter(p => p.careNeed && !p.caredBy).map(p => p.id);
  sig.isolatedHigh = people.filter(p => p.informalDegree === 0 && isHigh(sc(p.id).level)).map(p => p.id);
  sig.caregiverLoad = people.filter(p => p.caring >= 2 || (p.caring >= 1 && isHigh(sc(p.id).level))).map(p => p.id);
  sig.caseload = services.filter(s => s.kind === 'sw' && s.load > CASELOAD_NORM).map(s => s.id);
  const hhMulti = households.filter(h => h.members.filter(id => isHigh(sc(id).level)).length >= 2);
  sig.householdMulti = hhMulti.flatMap(h => h.members);
  sig.medAccess = people.filter(p => p.chronic >= 2 && (!p.declaration || p.lastVisit == null || p.lastVisit > 12)).map(p => p.id);
  sig.duplicates = base.dupPairs.flatMap(e => [e.s, e.t]);
  sig.keyPeople = people.filter(p => p.cutImpact >= KEY_IMPACT).sort((a, b) => b.cutImpact - a.cutImpact).map(p => p.id);
  sig.rehabGap = people.filter(p => p.rehabNeed && !p.rehab).map(p => p.id);
  sig.benefitGap = people.filter(p => p.lowIncome && !p.benefits && p.age >= 18).map(p => p.id);
  const signalsOf = new Map(people.map(p => [p.id, []]));
  for (const s of SIGNALS) {
    if (s.target !== 'people') continue;
    for (const id of sig[s.id]) signalsOf.get(id)?.push(s.id);
  }
  for (const id of sig.caseload) for (const c of byId.get(id).cases) signalsOf.get(c)?.includes('caseload') || signalsOf.get(c)?.push('caseload');

  // громади
  const territories = TERRITORY_ORDER.map(tid => {
    const ps = people.filter(p => p.territory === tid);
    const hs = households.filter(h => h.territory === tid && h.members.length);
    const high = ps.filter(p => isHigh(sc(p.id).level));
    const careNeed = ps.filter(p => p.careNeed);
    const chronic = ps.filter(p => p.chronic >= 2);
    const sws = services.filter(s => s.kind === 'sw' && s.territory === tid);
    const contrib = Object.fromEntries(['d', 's', 'm', 'n'].map(k => [k, ps.reduce((a, p) => a + sc(p.id).contrib[k], 0) / ps.length]));
    return {
      id: tid, people: ps.length, households: hs.length,
      avg: ps.reduce((a, p) => a + sc(p.id).index, 0) / ps.length,
      contrib,
      high: high.length, highShare: high.length / ps.length,
      critical: ps.filter(p => sc(p.id).level === 'critical').length,
      isolatedHigh: high.filter(p => p.informalDegree === 0).length,
      careNeed: careNeed.length,
      careCovered: careNeed.length ? careNeed.filter(p => p.caredBy || p.sw).length / careNeed.length : 1,
      chronic: chronic.length,
      chronicCovered: chronic.length ? chronic.filter(p => p.declaration && p.lastVisit != null && p.lastVisit <= 12).length / chronic.length : 1,
      sw: sws.map(s => s.id), caseload: sws.reduce((a, s) => a + s.load, 0) / Math.max(1, sws.length),
      avgTies: ps.reduce((a, p) => a + p.informalDegree, 0) / ps.length,
      support: ps.reduce((a, p) => a + p.support, 0) / ps.length,
      signals: ps.reduce((a, p) => a + signalsOf.get(p.id).length, 0),
    };
  });

  // середній індекс носіїв характеристики (з порогом мінімальної групи)
  const traitIndex = base.prevalence.map((n, i) => {
    const carriers = people.filter(p => p.traits[i]);
    return carriers.length ? carriers.reduce((a, p) => a + sc(p.id).index, 0) / carriers.length : 0;
  });
  const traitHigh = base.prevalence.map((n, i) => {
    const carriers = people.filter(p => p.traits[i]);
    return carriers.length ? carriers.filter(p => isHigh(sc(p.id).level)).length / carriers.length : 0;
  });

  return { w, weights, S, sc, ranked, levelCounts, avg, changed, up, down, sig, signalsOf, territories, traitIndex, traitHigh, hhMulti };
}
