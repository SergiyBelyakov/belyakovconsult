// Розкладання зміни валового прибутку на вплив обсягу, структури (мікс), ціни, собівартості, нових і втрачених позицій.
// Позиція: товар, товар × канал або товар × клієнт (рівень аналізу). Для позицій, що продавалися в обох періодах:
//   V = Σq₁p₀ / Σq₀p₀ (індекс обсягу в цінах бази), ḡ = Σ(q₀m₀) / Σ(q₀p₀) (середня маржинальність бази)
//   Обсяг_i = (q₁ − q₀)·p₀·ḡ          Структура_i = (q₁ − q₀)·(m₀ − p₀·ḡ)
//   Ціна_i  = q₁·(p₁ − p₀)            Собівартість_i = −q₁·(u₁ − u₀)
//   Нові: прибуток позицій без продажів у базі; Втрачені: мінус прибуток бази позицій, яких немає в поточному періоді.
// Сума всіх впливів точно дорівнює зміні валового прибутку. Структура позиції від’ємна, коли швидше за середнє росте
// позиція з нижчою за середню маржинальністю (або падає позиція з вищою).
import { NM, PRODUCTS, CHANNELS, MANAGERS, CATS, ctsOf } from './data.js';
import { CITIES } from './geo.js';

const MEAS = ['q', 'r', 'c', 'L', 'dI', 'dP', 'dR', 'dD'];
export const EFFECTS = ['vol', 'mix', 'price', 'cost', 'nw', 'lost'];
export const REGIONS = [...new Set(CITIES.map(c => c.region))];
const REG_I = Object.fromEntries(REGIONS.map((r, i) => [r, i]));

// Суми за парами товар × клієнт: поточний рік, місяці a..b (індекси 12..21), і ті самі місяці попереднього року
export function periodSums(D, a, b) {
  const n = D.pairs.n, out = { n, a, b };
  for (const m of MEAS) {
    const src = D[m], o0 = new Float64Array(n), o1 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const base = i * NM; let s0 = 0, s1 = 0;
      for (let t = a; t <= b; t++) { s1 += src[base + t]; s0 += src[base + t - 12]; }
      o0[i] = s0; o1[i] = s1;
    }
    out[m + '0'] = o0; out[m + '1'] = o1;
  }
  return out;
}

// Позиції аналізу на обраному рівні: 'p' товар, 'pc' товар × канал, 'pk' товар × клієнт
export function toUnits(D, S, level) {
  const { p, c } = D.pairs, cu = D.customers, n = S.n;
  if (level === 'pk') {
    return { level, n, prod: p, cust: c, ch: Int8Array.from(c, k => cu[k].ci), q0: S.q0, r0: S.r0, c0: S.c0, q1: S.q1, r1: S.r1, c1: S.c1 };
  }
  const NC = CHANNELS.length, nk = level === 'p' ? PRODUCTS.length : PRODUCTS.length * NC;
  const U = { level, n: nk, prod: new Int16Array(nk), ch: new Int8Array(nk).fill(-1), cust: null };
  for (const m of ['q0', 'r0', 'c0', 'q1', 'r1', 'c1']) U[m] = new Float64Array(nk);
  for (let k = 0; k < nk; k++) { U.prod[k] = level === 'p' ? k : Math.floor(k / NC); if (level === 'pc') U.ch[k] = k % NC; }
  for (let i = 0; i < n; i++) {
    const k = level === 'p' ? p[i] : p[i] * NC + cu[c[i]].ci;
    U.q0[k] += S.q0[i]; U.r0[k] += S.r0[i]; U.c0[k] += S.c0[i]; U.q1[k] += S.q1[i]; U.r1[k] += S.r1[i]; U.c1[k] += S.c1[i];
  }
  return U;
}

export function pvm(U) {
  const n = U.n, E = { cls: new Int8Array(n) };
  for (const e of [...EFFECTS, 'volR', 'priceR', 'nwR', 'lostR']) E[e] = new Float64Array(n);
  let R0C = 0, GP0C = 0, V1 = 0, R0 = 0, R1 = 0, GP0 = 0, GP1 = 0;
  for (let i = 0; i < n; i++) {
    R0 += U.r0[i]; R1 += U.r1[i]; GP0 += U.r0[i] - U.c0[i]; GP1 += U.r1[i] - U.c1[i];
    if (U.q0[i] > 0 && U.q1[i] > 0) { R0C += U.r0[i]; GP0C += U.r0[i] - U.c0[i]; V1 += U.q1[i] * U.r0[i] / U.q0[i]; }
  }
  const V = R0C ? V1 / R0C : 1, g = R0C ? GP0C / R0C : 0;
  const tot = { R0, R1, GP0, GP1, V, g, R0C, GP0C, nC: 0, nN: 0, nL: 0 };
  for (const e of [...EFFECTS, 'volR', 'priceR', 'nwR', 'lostR']) tot[e] = 0;
  for (let i = 0; i < n; i++) {
    const q0 = U.q0[i], q1 = U.q1[i];
    if (q0 > 0 && q1 > 0) {
      const p0 = U.r0[i] / q0, p1 = U.r1[i] / q1, u0 = U.c0[i] / q0, u1 = U.c1[i] / q1, dq = q1 - q0;
      const volR = dq * p0, vol = volR * g;
      E.cls[i] = 1; E.volR[i] = volR; E.vol[i] = vol; E.mix[i] = dq * (p0 - u0) - vol;
      E.price[i] = E.priceR[i] = q1 * (p1 - p0); E.cost[i] = -q1 * (u1 - u0); tot.nC++;
    } else if (q1 > 0) { E.cls[i] = 2; E.nw[i] = U.r1[i] - U.c1[i]; E.nwR[i] = U.r1[i]; tot.nN++; }
    else if (q0 > 0) { E.cls[i] = 3; E.lost[i] = -(U.r0[i] - U.c0[i]); E.lostR[i] = -U.r0[i]; tot.nL++; }
    else continue;
    for (const e of [...EFFECTS, 'volR', 'priceR', 'nwR', 'lostR']) tot[e] += E[e][i];
  }
  tot.dGP = GP1 - GP0; tot.dR = R1 - R0;
  tot.gm0 = R0 ? GP0 / R0 : 0; tot.gm1 = R1 ? GP1 / R1 : 0;
  tot.check = tot.dGP - EFFECTS.reduce((s, e) => s + tot[e], 0);
  E.tot = tot;
  return E;
}

// Розрізи: які виміри доступні на рівні аналізу
export const DIMS = {
  cat: { levels: ['p', 'pc', 'pk'], n: CATS.length, key: (U, i) => PRODUCTS[U.prod[i]].ci },
  prod: { levels: ['p', 'pc', 'pk'], n: PRODUCTS.length, key: (U, i) => U.prod[i] },
  ch: { levels: ['pc', 'pk'], n: CHANNELS.length, key: (U, i) => U.ch[i] },
  mgr: { levels: ['pk'], n: MANAGERS.length, key: (U, i, D) => D.customers[U.cust[i]].mgr },
  region: { levels: ['pk'], n: REGIONS.length, key: (U, i, D) => REG_I[D.customers[U.cust[i]].region] },
  city: { levels: ['pk'], n: CITIES.length, key: (U, i, D) => D.customers[U.cust[i]].cityI },
  cust: { levels: ['pk'], n: null, key: (U, i) => U.cust[i] },
};

// Суми за групами виміру: виручка, прибуток і впливи
export function rollup(D, U, E, dim) {
  const def = DIMS[dim], nk = def.n ?? D.customers.length;
  const F = ['r0', 'r1', 'gp0', 'gp1', 'q0', 'q1', ...EFFECTS, 'volR', 'priceR', 'nwR', 'lostR'];
  const G = Array.from({ length: nk }, (_, k) => { const o = { k }; for (const f of F) o[f] = 0; return o; });
  for (let i = 0; i < U.n; i++) {
    if (!E.cls[i]) continue;
    const g = G[def.key(U, i, D)];
    g.r0 += U.r0[i]; g.r1 += U.r1[i]; g.gp0 += U.r0[i] - U.c0[i]; g.gp1 += U.r1[i] - U.c1[i]; g.q0 += U.q0[i]; g.q1 += U.q1[i];
    for (const e of EFFECTS) g[e] += E[e][i];
    g.volR += E.volR[i]; g.priceR += E.priceR[i]; g.nwR += E.nwR[i]; g.lostR += E.lostR[i];
  }
  for (const g of G) { g.dgp = g.gp1 - g.gp0; g.dr = g.r1 - g.r0; g.gm0 = g.r0 ? g.gp0 / g.r0 : null; g.gm1 = g.r1 ? g.gp1 / g.r1 : null; g.dgm = g.gm0 != null && g.gm1 != null ? g.gm1 - g.gm0 : null; g.gr = g.r0 ? g.r1 / g.r0 - 1 : null; g.ggp = g.gp0 > 0 ? g.gp1 / g.gp0 - 1 : null; }
  return G;
}

// Помісячні ряди (усі 22 місяці): виручка, собівартість, прайс і знижки; filter(i) відбирає пари
export function monthly(D, filter = null) {
  const n = D.pairs.n, out = {};
  for (const m of ['q', 'r', 'c', 'L', 'dI', 'dP', 'dR']) out[m] = new Float64Array(NM);
  for (let i = 0; i < n; i++) {
    if (filter && !filter(i)) continue;
    const b = i * NM;
    for (let t = 0; t < NM; t++) { if (!D.q[b + t]) continue; for (const m of ['q', 'r', 'c', 'L', 'dI', 'dP', 'dR']) out[m][t] += D[m][b + t]; }
  }
  out.gp = out.r.map((v, t) => v - out.c[t]);
  return out;
}

// Клієнти за період: виручка, прибуток, витрати на обслуговування (логістика, мерчандайзинг, комісії, відстрочка) і внесок
export function customerView(D, a, b) {
  const nc = D.customers.length, rev = Array.from({ length: nc }, () => new Float64Array(NM)), cost = Array.from({ length: nc }, () => new Float64Array(NM));
  const { c } = D.pairs;
  for (let i = 0; i < D.pairs.n; i++) {
    const k = c[i], base = i * NM;
    for (let t = a - 12; t <= b; t++) { rev[k][t] += D.r[base + t]; cost[k][t] += D.c[base + t]; }
  }
  return D.customers.map((cu, k) => {
    const o = { k, r0: 0, r1: 0, gp0: 0, gp1: 0, cts0: 0, cts1: 0 };
    for (let t = a; t <= b; t++) {
      const t0 = t - 12;
      o.r0 += rev[k][t0]; o.gp0 += rev[k][t0] - cost[k][t0]; o.cts0 += ctsOf(cu, rev[k][t0], t0, D.hubKm);
      o.r1 += rev[k][t]; o.gp1 += rev[k][t] - cost[k][t]; o.cts1 += ctsOf(cu, rev[k][t], t, D.hubKm);
    }
    o.cm0 = o.gp0 - o.cts0; o.cm1 = o.gp1 - o.cts1;
    o.status = o.r0 > 0 && o.r1 > 0 ? 'cont' : o.r1 > 0 ? 'new' : o.r0 > 0 ? 'lost' : 'none';
    return o;
  });
}

// Сценарій для поточного періоду (суми за парами): додаткова зміна цін, відкат додаткових знижок менеджерів,
// скорочення промо, економія на закупівлі, еластичність попиту і відмова від угод з маржею нижче порогу.
// Повертає змінені суми і міст від фактичного прибутку до сценарного.
export function scenario(D, S, lv) {
  const n = S.n, q1 = new Float64Array(n), r1 = new Float64Array(n), c1 = new Float64Array(n);
  const br = { price: 0, disc: 0, promo: 0, proc: 0, volume: 0, drop: 0 };
  let dropR = 0, nDrop = 0;
  const px = lv.priceCat || null;
  for (let i = 0; i < n; i++) {
    const q = S.q1[i];
    if (!(q > 0)) continue;
    const p = S.r1[i] / q, u = S.c1[i] / q, cat = PRODUCTS[D.pairs.p[i]].ci;
    const x = (lv.price || 0) + (px ? px[cat] || 0 : 0);
    const dPrice = S.r1[i] * x, dDisc = S.dD1[i] * (lv.disc || 0), dPromo = S.dP1[i] * (lv.promo || 0);
    const p2 = p + (dPrice + dDisc + dPromo) / q, u2 = u * (1 - (lv.proc || 0));
    const q2 = q * Math.max(0, p2 / p) ** -(lv.elast ?? 0);
    br.price += dPrice; br.disc += dDisc; br.promo += dPromo; br.proc += q * u * (lv.proc || 0);
    br.volume += (q2 - q) * (p2 - u2);
    if (lv.floor != null && lv.floor > -1 && (p2 - u2) / p2 < lv.floor) { br.drop -= q2 * (p2 - u2); dropR += q2 * p2; nDrop++; continue; }
    q1[i] = q2; r1[i] = q2 * p2; c1[i] = q2 * u2;
  }
  return { S2: { ...S, q1, r1, c1 }, br, dropR, nDrop };
}

// Швидкі підсумки поточного періоду
export const sum = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
