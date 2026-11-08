// Дерево причин відхилення EBITDA від плану: компанія → підрозділ → продукт → стаття → фактор.
// Кожен вузол рахується з даних; сума дочірніх вузлів дорівнює батьківському (залишок не губиться).
// Продуктовий розріз синтетичний, але узгоджений із підрозділом: частки, ставки матеріалів, трудомісткість.
import { INDUSTRIES, MONTHS, story, year } from './data.js';
import { dataFor } from './model.js';

const ramp = (i, from, to, a, b) => (i <= from ? a : i >= to ? b : a + ((b - a) * (i - from)) / (to - from));

// share: частка виручки за планом; mat: ставка матеріалів відносно підрозділу; lab: трудомісткість;
// price: ціна факту до плану у 2026 (ключовому клієнту дали контрактну знижку 1%, ціну не переглядали);
// raw: наскільки продукт чутливий до подорожчання сировини; drift: зсув частки факту в сюжеті
export const PRODUCTS = {
  mfg: {
    north: [
      { id: 'core', share: 0.52, mat: 1.0, lab: 1.0, price: 1, raw: 1.1 },
      { id: 'premium', share: 0.28, mat: 0.88, lab: 1.3, price: 1.005, raw: 0.5 },
      { id: 'contract', share: 0.2, mat: 1.06, lab: 0.8, price: 0.99, raw: 1.3 },
    ],
    south: [
      { id: 'core', share: 0.46, mat: 1.0, lab: 1.0, price: 1, raw: 1.1 },
      { id: 'premium', share: 0.18, mat: 0.88, lab: 1.3, price: 1.005, raw: 0.5, drift: 0.06 },
      { id: 'contract', share: 0.36, mat: 1.06, lab: 0.8, price: 0.99, raw: 1.3, drift: -0.12 },
    ],
    pack: [
      { id: 'std', share: 0.62, mat: 1.0, lab: 1.0, price: 1, raw: 1 },
      { id: 'custom', share: 0.38, mat: 1.0, lab: 1.2, price: 1.005, raw: 1 },
    ],
    office: [{ id: 'overhead', share: 1, mat: 1, lab: 1, price: 1, raw: 1 }],
  },
  svc: Object.fromEntries([
    ...['center', 'left', 'west', 'east'].map(id => [id, [
      { id: 'repair', share: 0.38, mat: 1.15, lab: 1.2, price: 1, raw: 1, drift: id === 'east' ? -0.1 : 0 },
      { id: 'maint', share: 0.3, mat: 0.8, lab: 1.0, price: 1, raw: 1 },
      { id: 'corp', share: 0.17, mat: 0.95, lab: 0.9, price: 1, raw: 1, drift: id === 'east' ? 0.06 : 0 },
      { id: 'goods', share: 0.15, mat: 1.25, lab: 0.3, price: 1, raw: 1 },
    ]]),
    ['online', [
      { id: 'maint', share: 0.55, mat: 0.8, lab: 1.0, price: 1, raw: 1 },
      { id: 'goods', share: 0.45, mat: 1.2, lab: 0.4, price: 1, raw: 1, drift: 0.05 },
    ]],
    ['office', [{ id: 'overhead', share: 1, mat: 1, lab: 1, price: 1, raw: 1 }]],
  ]),
};

// у сюжеті частки зсуваються поступово (ті самі місяці, що й проблема підрозділу)
const driftAt = (ind, unit, i) => (ind === 'mfg' && unit === 'south' ? ramp(i, 17, 20, 0, 1) : ind === 'svc' && unit === 'east' ? ramp(i, 16, 19, 0, 1) : ind === 'svc' && unit === 'online' ? ramp(i, 12, 21, 0, 1) : 0);
const norm = ws => { const s = ws.reduce((a, b) => a + b, 0) || 1; return ws.map(w => w / s); };

// Лінії й фактори одного продукту за один місяць. Значення: внесок у відхилення EBITDA (мінус: гірше плану).
function monthLeaves(ind, I, uDef, row, i) {
  const P = PRODUCTS[ind][uDef.id];
  const d = driftAt(ind, uDef.id, i);
  const shA = norm(P.map(p => p.share * (1 + (p.drift || 0) * d)));
  const shP = P.map(p => p.share);
  const st = story(ind, uDef, i);
  const rawRel = uDef.cogs ? st.cogs / uDef.cogs : 0;
  const cA = norm(P.map((p, k) => shA[k] * p.mat * (1 + rawRel * (p.raw - 1))));
  const cP = norm(P.map((p, k) => shP[k] * p.mat));
  // ФОП та інші витрати розподіляються за фактичною структурою роботи (план і факт однаково),
  // тож продуктовий розріз не вигадує «економію» там, де змінилась лише структура продажів
  const wA = norm(P.map((p, k) => shA[k] * p.lab));
  const salary = row.hcPlan ? row.payrollPlan / row.hcPlan : 0;
  const headsU = -(row.hc - row.hcPlan) * salary;
  const payU = -(row.payroll - row.payrollPlan);
  // ціна факту до плану: виробництво з довідника продуктів, сервіс із середнього чека
  const ticketRatio = row.ticket && uDef.ticket ? row.ticket / (uDef.ticket * (year(i) === 2026 ? 1.06 : 1)) : 1;
  const norm2 = uDef.defect != null ? uDef.defect : null;
  return P.map((p, k) => {
    const rev = row.rev * shA[k], revPlan = row.revPlan * shP[k];
    const cogs = row.cogs * cA[k], cogsPlan = row.cogsPlan * cP[k];
    const pay = row.payroll * wA[k], payPlan = row.payrollPlan * wA[k];
    const oth = row.other * shA[k], othPlan = row.otherPlan * shA[k];
    const r = ind === 'mfg' ? (year(i) === 2026 ? p.price : 1) : ticketRatio;
    const crPlan = revPlan ? cogsPlan / revPlan : 0;
    const vol = rev / r;                                  // виручка у планових цінах
    const out = { product: p.id, plan: revPlan - cogsPlan - payPlan - othPlan, fact: rev - cogs - pay - oth, lines: {} };
    if (rev || revPlan) {
      const price = rev - vol, volume = (vol - revPlan) * (1 - crPlan);
      out.lines.sales = { price, volume };
      const mat = -(cogs - vol * crPlan);
      if (norm2 != null && row.defect != null) {
        const scrap = -cogs * Math.max(0, row.defect - norm2) / 100;
        out.lines.materials = { input: mat - scrap, scrap };
      } else out.lines.materials = { purchase: mat };
    }
    out.lines.payroll = { heads: headsU * wA[k], overtime: (payU - headsU) * wA[k] };
    out.lines.other = { other: -(oth - othPlan) };
    return out;
  });
}

const cache = new Map();
// Листки за кожен місяць: [i][unit][product] → {lines}
function leavesFor(ind) {
  if (cache.has(ind)) return cache.get(ind);
  const D = dataFor(ind), I = INDUSTRIES[ind];
  const out = MONTHS.map((_, i) => D.units.map(u => ({ unit: u.id, products: monthLeaves(ind, I, I.units.find(x => x.id === u.id), u.rows[i], i) })));
  cache.set(ind, out);
  return out;
}

const sumObj = (a, b) => { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; };
const total = o => Object.values(o).reduce((s, v) => s + v, 0);

// Дерево за період [a..b]. Вузли: {id, level, key, value, plan, fact, children}
export function causeTree(ind, a, b) {
  const key = ind + '|' + a + '|' + b;
  if (cache.has(key)) return cache.get(key);
  const L = leavesFor(ind);
  const agg = {};                                         // unit → product → line → factor → value
  const pf = {};                                          // unit → product → {plan, fact}
  for (let i = a; i <= b; i++) {
    for (const u of L[i]) {
      agg[u.unit] ||= {}; pf[u.unit] ||= {};
      for (const p of u.products) {
        agg[u.unit][p.product] ||= {}; pf[u.unit][p.product] ||= { plan: 0, fact: 0 };
        pf[u.unit][p.product].plan += p.plan; pf[u.unit][p.product].fact += p.fact;
        for (const [ln, fs] of Object.entries(p.lines)) agg[u.unit][p.product][ln] = sumObj(agg[u.unit][p.product][ln] || {}, fs);
      }
    }
  }
  const node = (id, level, k, value, kids = [], extra = {}) => ({ id, level, key: k, value, children: kids.sort((x, y) => x.value - y.value), ...extra });
  const units = Object.entries(agg).map(([uid, prods]) => {
    const pk = Object.entries(prods).map(([pid, lines]) => {
      const lk = Object.entries(lines).map(([ln, fs]) => {
        const fk = Object.entries(fs);
        const kids = fk.length > 1 ? fk.map(([f, v]) => node(`${uid}/${pid}/${ln}/${f}`, 4, f, v, [], { line: ln, unit: uid, product: pid })) : [];
        return node(`${uid}/${pid}/${ln}`, 3, ln, total(fs), kids, { unit: uid, product: pid, factor: fk.length === 1 ? fk[0][0] : null });
      }).filter(n => Math.abs(n.value) >= 0.5 || n.children.length);
      return node(`${uid}/${pid}`, 2, pid, lk.reduce((s, n) => s + n.value, 0), lk, { unit: uid, ...pf[uid][pid] });
    });
    const plan = pk.reduce((s, n) => s + n.plan, 0), fact = pk.reduce((s, n) => s + n.fact, 0);
    return node(uid, 1, uid, pk.reduce((s, n) => s + n.value, 0), pk, { unit: uid, plan, fact });
  });
  const root = node('all', 0, 'all', units.reduce((s, n) => s + n.value, 0), units, { plan: units.reduce((s, n) => s + n.plan, 0), fact: units.reduce((s, n) => s + n.fact, 0) });
  const index = new Map();
  const walk = (n, parent) => { n.parent = parent ? parent.id : null; index.set(n.id, n); n.children.forEach(c => walk(c, n)); };
  walk(root, null);
  const res = { root, index };
  cache.set(key, res);
  return res;
}

// Листки дерева (найглибші вузли) для аналізу внеску; factor: ключ фактора (для статті без факторів: її єдиний фактор)
export function leaves(tree) {
  const out = [];
  const walk = n => { if (!n.children.length) out.push({ ...n, factor: n.level === 4 ? n.key : n.factor || n.key, line: n.line || n.key }); else n.children.forEach(walk); };
  walk(tree.root);
  return out.filter(n => n.level >= 3);
}

// Внесок, згрупований за «підрозділ × фактор» (без продуктового розрізу): так його читає керівник
export function factorGroups(tree) {
  const m = new Map();
  for (const l of leaves(tree)) {
    const k = l.unit + '|' + l.factor;
    const g = m.get(k) || { unit: l.unit, factor: l.factor, line: l.line, value: 0, products: [] };
    g.value += l.value;
    g.products.push({ product: l.product, value: l.value });
    m.set(k, g);
  }
  return [...m.values()].map(g => ({ ...g, products: g.products.sort((x, y) => x.value - y.value) })).sort((x, y) => x.value - y.value);
}

// Шлях, що найбільше пояснює розрив: на кожному рівні гілка з найбільшим за модулем негативним внеском
export function autoPath(tree, startUnit) {
  const path = [];
  let n = tree.root;
  if (startUnit && startUnit !== 'all' && tree.index.has(startUnit)) { n = tree.index.get(startUnit); path.push(n.id); }
  while (n.children.length) {
    const neg = n.children.filter(c => c.value < 0);
    const next = (neg.length ? neg : n.children).reduce((x, y) => (Math.abs(y.value) > Math.abs(x.value) ? y : x));
    path.push(next.id);
    n = next;
  }
  return path;
}

// Помісячний ряд внеску групи «підрозділ × фактор» (для впевненості: скільки місяців поспіль він від'ємний)
export function factorSeries(ind, unit, factor, to) {
  const L = leavesFor(ind);
  return L.slice(0, to + 1).map(m => {
    const u = m.find(x => x.unit === unit);
    if (!u) return 0;
    return u.products.reduce((s, p) => s + Object.values(p.lines).reduce((a, fs) => a + (fs[factor] || 0), 0), 0);
  });
}

// Скільки місяців поспіль (до місяця i включно) внесок групи від'ємний і більший за звичайні коливання 2025 року
export function streak(ind, unit, factors, i) {
  const fs = Array.isArray(factors) ? factors : [factors];
  const ser = fs.map(f => factorSeries(ind, unit, f, i)).reduce((a, s) => a.map((v, k) => v + s[k]));
  const base = ser.slice(0, 12), m = base.reduce((a, b) => a + b, 0) / base.length;
  const noise = Math.max(2 * Math.sqrt(base.reduce((a, v) => a + (v - m) ** 2, 0) / base.length), 15);
  let n = 0;
  for (let k = i; k >= 0 && ser[k] < -noise; k--) n++;
  return { months: n, chronic: n >= 12, last: ser[i] };
}

// Шлях до вузла (предки без кореня) і далі вниз найбільш від'ємними гілками
export function pathFrom(tree, id) {
  const chain = [];
  let n = tree.index.get(id);
  while (n && n.parent) { chain.unshift(n.id); n = tree.index.get(n.parent); }
  let cur = tree.index.get(id);
  while (cur && cur.children.length) {
    const neg = cur.children.filter(c => c.value < 0);
    cur = (neg.length ? neg : cur.children).reduce((x, y) => (Math.abs(y.value) > Math.abs(x.value) ? y : x));
    chain.push(cur.id);
  }
  return chain;
}
// Найбільший за модулем листок для підрозділу і набору факторів
export function leafFor(tree, unit, factors) {
  let best = null;
  const walk = n => {
    if (!n.children.length) {
      const fk = n.level === 4 ? n.key : n.factor;
      if ((!unit || n.unit === unit) && factors.includes(fk) && (!best || n.value < best.value)) best = n;
    } else n.children.forEach(walk);
  };
  walk(tree.root);
  return best;
}
