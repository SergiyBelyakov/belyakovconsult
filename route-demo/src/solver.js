// Оптимізатор маршрутів з вікнами доставки і різнотипним автопарком (кілька складів, CVRPTW).
// 1) кожне замовлення до найближчого за часом складу; 2) Кларк-Райт (savings) окремо для кожного складу,
// кілька разів із різною формою коефіцієнта; 3) машини за місткістю з наявного автопарку; 4) вставка
// того, що не влізло; 5) локальний пошук: перенесення відрізків, 2-opt, обмін хвостами між маршрутами,
// обмін зупинками, злиття маршрутів, зміна складу і типу машини. Вікна м'які (штраф за хвилину
// запізнення), місткість жорстка. Можна стартувати з попереднього плану, щоб зміни були плавними.
// Без випадковості: той самий вхід дає той самий план.
import { NODES, EDGES, CUST, TYPES, OPEN, PEN, CO2_L, serviceMin } from './world.js';
import { matrices, pathEdges, edgeMin, edgeOpen, dijkstra } from './graph.js';
import { dist } from './geo.js';

export const condKey = c => [c.flood ? 'f' : '', c.winter ? 'w' : '', c.closed ? [...c.closed].sort((a, b) => a - b).join('.') : ''].join('|');
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Задача: точки 0..D-1 це склади, далі замовлення
export function makeProblem({ depots, orders, cond, fleet, params, M = null }) {
  const stops = Object.entries(orders).filter(([id, q]) => q > 0 && CUST.has(id)).map(([id, q]) => {
    const c = CUST.get(id);
    return { id, c, q, node: c.node, a: c.a, b: c.b, svc: serviceMin(c, q) };
  }).sort((x, y) => x.c.i - y.c.i);
  const D = depots.length, nodes = [...depots, ...stops.map(s => s.node)];
  const key = condKey(cond);
  const mx = M && M.key === key && M.nodes.length === nodes.length && M.nodes.every((n, i) => n === nodes[i]) ? M : Object.assign(matrices(nodes, cond), { key });
  const n = nodes.length, a = new Float64Array(n), b = new Float64Array(n).fill(1e9), svc = new Float64Array(n), q = new Float64Array(n);
  stops.forEach((s, k) => { a[D + k] = s.a; b[D + k] = s.b; svc[D + k] = s.svc; q[D + k] = s.q; });
  const perKm = TYPES.map(t => (t.fuel / 100) * params.fuel + t.wear);
  return { D, depots, stops, M: mx, fleet: { ...fleet }, params, cond, a, b, svc, q, perKm, shift: params.shift * 60, n, byId: new Map(stops.map((s, k) => [s.id, D + k])) };
}

// ——— оцінка маршруту ———
// Відправлення якомога пізніше без нових запізнень: зсув поглинає очікування на точках.
function sim(pb, d, t, seq, legs = null) {
  const { tt, dd, P } = pb.M, T = tt[t], K = dd[t];
  let load = 0;
  for (const p of seq) load += pb.q[p];
  const first = seq[0], t01 = legs ? legs[0][0] : T[d * P + first];
  if (!(t01 < Infinity)) return null;
  const t0 = Math.max(OPEN, pb.a[first] - t01);
  let tm = t0, km = 0, late = 0, W = 0, slack = Infinity, prev = d;
  for (let k = 0; k < seq.length; k++) {
    const p = seq[k], x = legs ? legs[k][0] : T[prev * P + p];
    if (!(x < Infinity)) return null;
    tm += x; km += legs ? legs[k][1] : K[prev * P + p];
    if (tm < pb.a[p]) { W += pb.a[p] - tm; tm = pb.a[p]; }
    if (tm > pb.b[p]) late += tm - pb.b[p];
    slack = Math.min(slack, W + Math.max(0, pb.b[p] - tm));
    tm += pb.svc[p]; prev = p;
  }
  const back = legs ? legs[seq.length][0] : T[prev * P + d];
  if (!(back < Infinity)) return null;
  tm += back; km += legs ? legs[seq.length][1] : K[prev * P + d];
  const shiftBy = Math.max(0, Math.min(W, slack));
  const dur = tm - t0 - shiftBy;
  return { load, t0: t0 + shiftBy, dur, km, late, wait: W - shiftBy, over: Math.max(0, dur - pb.shift) };
}
function costOf(pb, t, s) {
  const ty = TYPES[t];
  return ty.fixed + s.km * pb.perKm[t] + (s.dur / 60) * ty.driver + s.late * PEN.late + s.over * PEN.over;
}
export function routeCost(pb, d, t, seq) {
  if (!seq.length) return 0;
  let load = 0;
  for (const p of seq) load += pb.q[p];
  if (load > TYPES[t].cap) return Infinity;
  const s = sim(pb, d, t, seq);
  return s ? costOf(pb, t, s) : Infinity;
}
const lost = (pb, p) => PEN.unserved + PEN.pallet * pb.q[p];
const loadOf = (pb, seq) => { let s = 0; for (const p of seq) s += pb.q[p]; return s; };
const objective = (routes, pool, pb) => routes.reduce((a, r) => a + r.c, 0) + pool.reduce((a, p) => a + lost(pb, p), 0);

// ——— побудова ———
function fitType(avail, load) {
  let best = -1;
  for (let t = 0; t < TYPES.length; t++) if (avail[t] > 0 && TYPES[t].cap >= load && (best < 0 || TYPES[t].cap < TYPES[best].cap)) best = t;
  return best;
}

function savingsDepot(pb, d, members, avail, lam) {
  const { tt, P } = pb.M, T = tt[1];
  const routes = members.map(p => ({ seq: [p] }));
  const of = new Map(members.map((p, k) => [p, routes[k]]));
  const info = seq => { const t = fitType(avail, loadOf(pb, seq)); if (t < 0) return null; const s = sim(pb, d, t, seq); return s ? { t, s, c: costOf(pb, t, s) } : null; };
  routes.forEach(r => { r.inf = info(r.seq); });
  const S = [];
  for (let x = 0; x < members.length; x++) for (let y = x + 1; y < members.length; y++) {
    const i = members[x], j = members[y], v = T[d * P + i] + T[d * P + j] - lam * Math.min(T[i * P + j], T[j * P + i]);
    if (v > 0 && Number.isFinite(v)) S.push([v, i, j]);
  }
  S.sort((u, v) => v[0] - u[0] || u[1] - v[1] || u[2] - v[2]);
  for (const [, i, j] of S) {
    const ri = of.get(i), rj = of.get(j);
    if (ri === rj || !ri.inf || !rj.inf) continue;
    const A = ri.seq, B = rj.seq, iEnd = A[A.length - 1] === i, iSt = A[0] === i, jEnd = B[B.length - 1] === j, jSt = B[0] === j;
    if (!(iEnd || iSt) || !(jEnd || jSt)) continue;
    const rev = s => s.slice().reverse(), cands = [];
    if (iEnd && jSt) cands.push([...A, ...B]);
    if (iSt && jEnd) cands.push([...B, ...A]);
    if (iEnd && jEnd) cands.push([...A, ...rev(B)]);
    if (iSt && jSt) cands.push([...rev(A), ...B]);
    let best = null;
    const lateLim = ri.inf.s.late + rj.inf.s.late + 0.5, overLim = ri.inf.s.over + rj.inf.s.over + 0.5, base = ri.inf.c + rj.inf.c;
    for (const seq of cands) {
      const f = info(seq);
      if (!f || f.s.late > lateLim || f.s.over > overLim || f.c >= base - 1) continue;
      if (!best || f.c < best.f.c) best = { seq, f };
    }
    if (!best) continue;
    ri.seq = best.seq; ri.inf = best.f; rj.seq = []; rj.inf = null;
    best.seq.forEach(p => of.set(p, ri));
  }
  return routes.filter(r => r.seq.length).map(r => ({ d, seq: r.seq }));
}

function assign(pb, raw, avail, pool) {
  const out = [];
  raw.map(r => ({ ...r, load: loadOf(pb, r.seq) })).sort((x, y) => y.load - x.load || x.seq[0] - y.seq[0]).forEach(r => {
    let best = -1, bc = Infinity;
    for (let t = 0; t < TYPES.length; t++) {
      if (avail[t] <= 0 || TYPES[t].cap < r.load) continue;
      const c = routeCost(pb, r.d, t, r.seq);
      if (c < bc) { bc = c; best = t; }
    }
    if (best < 0) {
      let big = -1;
      for (let t = 0; t < TYPES.length; t++) if (avail[t] > 0 && (big < 0 || TYPES[t].cap > TYPES[big].cap)) big = t;
      if (big < 0) { pool.push(...r.seq); return; }
      const seq = r.seq.slice();
      while (loadOf(pb, seq) > TYPES[big].cap) {
        let k = 0, kc = Infinity;
        for (let x = 0; x < seq.length; x++) { const c = routeCost(pb, r.d, big, [...seq.slice(0, x), ...seq.slice(x + 1)]); if (c < kc) { kc = c; k = x; } }
        pool.push(seq.splice(k, 1)[0]);
      }
      best = big; r.seq = seq;
    }
    const c = routeCost(pb, r.d, best, r.seq);
    if (!Number.isFinite(c)) { pool.push(...r.seq); return; }
    avail[best]--;
    out.push({ d: r.d, t: best, seq: r.seq, c });
  });
  return out;
}

function bestInsert(pb, routes, p) {
  let best = null;
  for (const r of routes) {
    if (loadOf(pb, r.seq) + pb.q[p] > TYPES[r.t].cap) continue;
    for (let k = 0; k <= r.seq.length; k++) {
      const seq = [...r.seq.slice(0, k), p, ...r.seq.slice(k)], c = routeCost(pb, r.d, r.t, seq);
      if (c - r.c < (best ? best.delta : Infinity)) best = { r, seq, c, delta: c - r.c };
    }
  }
  return best;
}
function bestOpen(pb, avail, p) {
  let best = null;
  for (let d = 0; d < pb.D; d++) for (let t = 0; t < TYPES.length; t++) {
    if (avail[t] <= 0 || TYPES[t].cap < pb.q[p]) continue;
    const c = routeCost(pb, d, t, [p]);
    if (c < (best ? best.c : Infinity)) best = { d, t, c };
  }
  return best;
}
function placePool(pb, routes, avail, pool) {
  const left = [];
  pool.sort((x, y) => pb.q[y] - pb.q[x] || x - y).forEach(p => {
    const ins = bestInsert(pb, routes, p), open = bestOpen(pb, avail, p), L = lost(pb, p);
    if (ins && ins.delta < L && (!open || ins.delta <= open.c)) { ins.r.seq = ins.seq; ins.r.c = ins.c; return; }
    if (open && open.c < L) { avail[open.t]--; routes.push({ d: open.d, t: open.t, seq: [p], c: open.c }); return; }
    left.push(p);
  });
  return left;
}

// ——— локальний пошук ———
function improve(pb, routes, avail, pool, maxIter) {
  const EPS = 0.5;
  const cap = r => TYPES[r.t].cap;
  const remove = r => { const k = routes.indexOf(r); if (k >= 0) { routes.splice(k, 1); avail[r.t]++; } };
  for (let it = 0; it < maxIter; it++) {
    let moved = false;
    // перенесення відрізка з 1–3 зупинок (у той самий маршрут або в інший)
    for (let ri = 0; ri < routes.length; ri++) {
      const A = routes[ri];
      let restart = true;
      while (restart && A.seq.length) {
        restart = false;
        for (let L = 1; L <= 3 && !restart; L++) for (let i = 0; i + L <= A.seq.length && !restart; i++) {
          const seg = A.seq.slice(i, i + L), rest = [...A.seq.slice(0, i), ...A.seq.slice(i + L)], q = loadOf(pb, seg);
          const cA = rest.length ? routeCost(pb, A.d, A.t, rest) : 0;
          let best = null;
          if (L === 1 && cA + lost(pb, seg[0]) < A.c - EPS) best = { gain: A.c - cA - lost(pb, seg[0]), to: null };
          for (const B of routes) {
            if (B !== A && loadOf(pb, B.seq) + q > cap(B)) continue;
            const base = B === A ? rest : B.seq;
            for (let k = 0; k <= base.length; k++) {
              if (B === A && k === i) continue;
              for (const s of L > 1 ? [seg, seg.slice().reverse()] : [seg]) {
                const seq = [...base.slice(0, k), ...s, ...base.slice(k)], c = routeCost(pb, B.d, B.t, seq);
                const gain = B === A ? A.c - c : A.c + B.c - cA - c;
                if (gain > EPS && (!best || gain > best.gain)) best = { gain, to: B, seq, c };
              }
            }
          }
          if (!best) continue;
          if (!best.to) { pool.push(seg[0]); A.seq = rest; A.c = cA; }
          else if (best.to === A) { A.seq = best.seq; A.c = best.c; }
          else { A.seq = rest; A.c = cA; best.to.seq = best.seq; best.to.c = best.c; }
          moved = restart = true;
        }
      }
      if (!A.seq.length) { remove(A); ri--; }
    }
    // 2-opt усередині маршруту
    for (const r of routes) {
      let imp = true;
      while (imp) {
        imp = false;
        for (let i = 0; i < r.seq.length - 1 && !imp; i++) for (let j = i + 1; j < r.seq.length; j++) {
          const seq = [...r.seq.slice(0, i), ...r.seq.slice(i, j + 1).reverse(), ...r.seq.slice(j + 1)], c = routeCost(pb, r.d, r.t, seq);
          if (c < r.c - EPS) { r.seq = seq; r.c = c; imp = moved = true; break; }
        }
      }
    }
    // обмін хвостами між двома маршрутами (2-opt*)
    for (let x = 0; x < routes.length; x++) for (let y = x + 1; y < routes.length; y++) {
      const A = routes[x], B = routes[y];
      let done = false;
      for (let i = 0; i <= A.seq.length && !done; i++) for (let j = 0; j <= B.seq.length; j++) {
        if ((i === 0 && j === 0) || (i === A.seq.length && j === B.seq.length)) continue;
        const sa = [...A.seq.slice(0, i), ...B.seq.slice(j)], sb = [...B.seq.slice(0, j), ...A.seq.slice(i)];
        if (!sa.length || !sb.length) continue;
        if (loadOf(pb, sa) > cap(A) || loadOf(pb, sb) > cap(B)) continue;
        const ca = routeCost(pb, A.d, A.t, sa); if (!(ca < Infinity)) continue;
        const cb = routeCost(pb, B.d, B.t, sb);
        if (ca + cb < A.c + B.c - EPS) { A.seq = sa; A.c = ca; B.seq = sb; B.c = cb; moved = done = true; break; }
      }
    }
    // обмін зупинками між маршрутами
    for (let x = 0; x < routes.length; x++) for (let y = x + 1; y < routes.length; y++) {
      const A = routes[x], B = routes[y];
      let done = false;
      for (let i = 0; i < A.seq.length && !done; i++) for (let j = 0; j < B.seq.length; j++) {
        const sa = A.seq.slice(), sb = B.seq.slice(), u = sa[i], v = sb[j];
        sa[i] = v; sb[j] = u;
        const ca = routeCost(pb, A.d, A.t, sa); if (!(ca < Infinity)) continue;
        const cb = routeCost(pb, B.d, B.t, sb);
        if (ca + cb < A.c + B.c - EPS) { A.seq = sa; A.c = ca; B.seq = sb; B.c = cb; moved = done = true; break; }
      }
    }
    // злиття двох маршрутів в один (звільняє машину)
    for (let x = 0; x < routes.length; x++) for (let y = 0; y < routes.length; y++) {
      if (x === y || !routes[x] || !routes[y]) continue;
      const A = routes[x], B = routes[y], seq = [...A.seq, ...B.seq], load = loadOf(pb, seq);
      const fake = avail.slice(); fake[A.t]++; fake[B.t]++;
      let best = null;
      for (let t = 0; t < TYPES.length; t++) {
        if (fake[t] <= 0 || TYPES[t].cap < load) continue;
        for (const d of A.d === B.d ? [A.d] : [A.d, B.d]) { const c = routeCost(pb, d, t, seq); if (c < (best ? best.c : Infinity)) best = { t, d, c }; }
      }
      if (best && best.c < A.c + B.c - EPS) {
        avail[A.t]++; avail[B.t]++; avail[best.t]--;
        A.seq = seq; A.c = best.c; A.t = best.t; A.d = best.d;
        routes.splice(y, 1); moved = true;
        if (y < x) x--;
        y--;
      }
    }
    // склад і тип машини для кожного маршруту; обмін типами між двома маршрутами
    for (const r of routes) {
      for (let d = 0; d < pb.D; d++) { if (d === r.d) continue; const c = routeCost(pb, d, r.t, r.seq); if (c < r.c - EPS) { r.d = d; r.c = c; moved = true; } }
      for (let t = 0; t < TYPES.length; t++) {
        if (t === r.t || avail[t] <= 0) continue;
        const c = routeCost(pb, r.d, t, r.seq);
        if (c < r.c - EPS) { avail[r.t]++; avail[t]--; r.t = t; r.c = c; moved = true; }
      }
    }
    for (let x = 0; x < routes.length; x++) for (let y = x + 1; y < routes.length; y++) {
      const A = routes[x], B = routes[y];
      if (A.t === B.t) continue;
      const ca = routeCost(pb, A.d, B.t, A.seq), cb = routeCost(pb, B.d, A.t, B.seq);
      if (ca + cb < A.c + B.c - EPS) { const t = A.t; A.t = B.t; B.t = t; A.c = ca; B.c = cb; moved = true; }
    }
    // повторна спроба для незабезпечених
    if (pool.length) {
      const before = pool.length;
      pool.push(...placePool(pb, routes, avail, pool.splice(0)));
      if (pool.length < before) moved = true;
    }
    if (!moved) break;
  }
}

// ——— розв'язок ———
// starts: форма коефіцієнта savings для кількох стартів; warm: попередній план [{d, t, ids}] як ще один старт
export function solve(pb, { iter = 30, starts = [1, 0.7, 1.3], warm = null } = {}) {
  const t0 = now();
  const { tt, P } = pb.M;
  const unreachable = [], groups = Array.from({ length: pb.D }, () => []);
  pb.stops.forEach((s, k) => {
    const p = pb.D + k;
    let bd = -1, bt = Infinity;
    for (let d = 0; d < pb.D; d++) { const v = Math.min(...tt.map(T => T[d * P + p] + T[p * P + d])); if (v < bt) { bt = v; bd = d; } }
    if (bd < 0) unreachable.push(p); else groups[bd].push(p);
  });
  const fleet = TYPES.map(t => pb.fleet[t.id] || 0);
  let best = null;
  const consider = (routes, pool) => { const o = objective(routes, pool, pb); if (!best || o < best.o - 0.01) best = { o, routes, pool }; };
  const any = fleet.some(v => v > 0);
  for (const lam of any ? starts : [1]) {
    const avail = fleet.slice(), pool = [], raw = [];
    if (any) groups.forEach((g, d) => { if (g.length) raw.push(...savingsDepot(pb, d, g, avail, lam)); });
    else groups.forEach(g => pool.push(...g));
    const routes = assign(pb, raw, avail, pool);
    pool.push(...placePool(pb, routes, avail, pool.splice(0)));
    improve(pb, routes, avail, pool, iter);
    consider(routes, pool);
  }
  if (warm && any) {
    const avail = fleet.slice(), pool = [], routes = [], seen = new Set();
    warm.forEach(w => {
      if (w.d >= pb.D) return;
      const seq = w.ids.map(id => pb.byId.get(id)).filter(p => p != null && !unreachable.includes(p) && !seen.has(p));
      if (!seq.length) return;
      let t = avail[w.t] > 0 && TYPES[w.t].cap >= loadOf(pb, seq) ? w.t : fitType(avail, loadOf(pb, seq));
      if (t < 0) { pool.push(...seq); seq.forEach(p => seen.add(p)); return; }
      seq.forEach(p => seen.add(p));
      avail[t]--;
      routes.push({ d: w.d, t, seq, c: routeCost(pb, w.d, t, seq) });
    });
    routes.forEach(r => { if (!Number.isFinite(r.c)) { pool.push(...r.seq); avail[r.t]++; r.seq = []; } });
    const live = routes.filter(r => r.seq.length);
    groups.flat().forEach(p => { if (!seen.has(p)) pool.push(p); });
    pool.push(...placePool(pb, live, avail, pool.splice(0)));
    improve(pb, live, avail, pool, iter);
    consider(live, pool);
  }
  return finish(pb, best.routes, [...best.pool, ...unreachable], now() - t0, unreachable);
}
export const warmOf = sol => sol.routes.map(r => ({ d: r.d, t: r.t, ids: r.stops.map(s => s.stop.id) }));

// Ручний план «як є»: кожен склад возить на своєму березі річки; диспетчер іде по колу від складу
// (sweep) і набирає зупинки в машину, поки вистачає місця й зміни; порядок об'їзду: спершу ранкові
// вікна, далі найближчий сусід. Машину беруть найменшу, що вміщує. Без доопрацювання й обміну.
export function manualPlan(pb) {
  const { tt, P } = pb.M;
  const dep = pb.depots.map(n => NODES[n]);
  const groups = Array.from({ length: pb.D }, () => []);
  pb.stops.forEach((s, k) => {
    const n = NODES[s.node], same = dep.map((d, i) => (d.bank === n.bank ? i : -1)).filter(i => i >= 0);
    const cand = same.length ? same : dep.map((_, i) => i);
    let bd = cand[0];
    cand.forEach(i => { if (dist([dep[i].x, dep[i].y], [n.x, n.y]) < dist([dep[bd].x, dep[bd].y], [n.x, n.y])) bd = i; });
    groups[bd].push(pb.D + k);
  });
  const avail = TYPES.map(t => pb.fleet[t.id] || 0), caps = TYPES.filter((t, i) => avail[i] > 0).map(t => t.cap);
  const LIMIT = caps.length ? Math.min(TYPES[1].cap, Math.max(...caps)) : 0;
  const raw = [], pool = [];
  groups.forEach((g, d) => {
    if (!g.length) return;
    if (!LIMIT) { pool.push(...g); return; }
    const o = dep[d], ang = p => { const n = NODES[pb.M.nodes[p]]; return (Math.atan2(n.x - o.x, n.y - o.y) + Math.PI * 2) % (Math.PI * 2); };
    const order = seq => {
      const out = [], left = seq.slice();
      let at = d;
      for (const early of [true, false]) {
        for (;;) {
          const cand = left.filter(p => (pb.b[p] <= 660) === early);
          if (!cand.length) break;
          let bp = cand[0];
          cand.forEach(p => { if (tt[1][at * P + p] < tt[1][at * P + bp]) bp = p; });
          left.splice(left.indexOf(bp), 1); out.push(bp); at = bp;
        }
      }
      return out;
    };
    let cur = [];
    g.slice().sort((x, y) => ang(x) - ang(y) || x - y).forEach(p => {
      const next = [...cur, p], s = cur.length ? sim(pb, d, 1, order(next)) : null;
      if (cur.length && (loadOf(pb, next) > LIMIT || !s || s.dur > pb.shift * 0.9)) { raw.push({ d, seq: order(cur) }); cur = []; }
      cur.push(p);
    });
    if (cur.length) raw.push({ d, seq: order(cur) });
  });
  const routes = assign(pb, raw, avail, pool);
  pool.push(...placePool(pb, routes, avail, pool.splice(0)));
  return finish(pb, routes, pool, 0, []);
}

// Повний опис плану: розклад кожної машини, шляхи по ребрах, завантаження, витрати і підсумки
export function finish(pb, routes, unserved, ms, unreachable = []) {
  const { tt, dd, P, nodes } = pb.M;
  const bad = routes.filter(r => !r.seq.length || !sim(pb, r.d, r.t, r.seq));
  bad.forEach(r => unserved.push(...r.seq));
  const out = routes.filter(r => !bad.includes(r)).map(r => {
    const s = sim(pb, r.d, r.t, r.seq), ty = TYPES[r.t];
    const parts = { fixed: ty.fixed, fuel: s.km * (ty.fuel / 100) * pb.params.fuel, wear: s.km * ty.wear, driver: (s.dur / 60) * ty.driver, pen: s.late * PEN.late + s.over * PEN.over };
    const stops = [], legs = [], pts = [r.d, ...r.seq, r.d];
    let tm = s.t0, onboard = s.load;
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k], from = pts[k - 1];
      const path = pathEdges(pb.M, r.t, nodes[from], nodes[p]) || [];
      const travel = tt[r.t][from * P + p];
      legs.push({ from, to: p, dep: tm, arr: tm + travel, km: dd[r.t][from * P + p], edges: path.map(([id, fwd]) => ({ id, fwd, min: edgeMin(EDGES[id], r.t, pb.cond) })), onboard });
      tm += travel;
      if (k < pts.length - 1) {
        const arr = tm, start = Math.max(arr, pb.a[p]), late = Math.max(0, start - pb.b[p]);
        tm = start + pb.svc[p];
        stops.push({ p, stop: pb.stops[p - pb.D], arr, start, wait: start - arr, late, end: tm, onboard });
        onboard -= pb.q[p];
      }
    }
    return { d: r.d, t: r.t, seq: r.seq, load: s.load, cap: ty.cap, km: s.km, dur: s.dur, start: s.t0, end: s.t0 + s.dur, late: s.late, wait: s.wait, over: s.over, cost: costOf(pb, r.t, s), parts, co2: s.km * (ty.fuel / 100) * CO2_L, stops, legs };
  });
  const ids = ['A', 'B', 'C'];
  out.sort((x, y) => x.d - y.d || x.start - y.start || y.load - x.load);
  const cnt = {};
  out.forEach(r => { cnt[r.d] = (cnt[r.d] || 0) + 1; r.id = ids[r.d] + cnt[r.d]; });
  const served = out.reduce((a, r) => a + r.stops.length, 0);
  const lateStops = out.reduce((a, r) => a + r.stops.filter(x => x.late > 0.5).length, 0);
  const sum = f => out.reduce((a, r) => a + f(r), 0);
  const capUsed = sum(r => r.cap);
  const totals = {
    cost: sum(r => r.cost), km: sum(r => r.km), hours: sum(r => r.dur) / 60, co2: sum(r => r.co2), late: sum(r => r.late), over: sum(r => r.over), wait: sum(r => r.wait),
    lateStops, served, orders: pb.stops.length, onTime: pb.stops.length ? (served - lateStops) / pb.stops.length : 1,
    pallets: sum(r => r.load), lostPallets: unserved.reduce((a, p) => a + pb.q[p], 0), util: capUsed ? sum(r => r.load) / capUsed : 0, vehicles: out.length,
    fleet: TYPES.reduce((a, t) => a + (pb.fleet[t.id] || 0), 0), unserved: unserved.length, lost: unserved.reduce((a, p) => a + lost(pb, p), 0),
    parts: ['fixed', 'fuel', 'wear', 'driver', 'pen'].reduce((o, k) => ({ ...o, [k]: sum(r => r.parts[k]) }), {}),
    byType: TYPES.map((_, t) => out.filter(r => r.t === t).length),
  };
  totals.perPallet = totals.pallets ? totals.cost / totals.pallets : 0;
  return { routes: out, unserved: unserved.map(p => ({ p, stop: pb.stops[p - pb.D], cut: unreachable.includes(p) })), totals, ms, pb };
}

// Навантаження доріг: скільки разів проїжджають і скільки палет везуть по кожному ребру
export function flows(sol) {
  const n = EDGES.length, runs = new Float64Array(n), pal = new Float64Array(n), by = Array.from({ length: n }, () => []);
  sol.routes.forEach((r, ri) => r.legs.forEach(l => l.edges.forEach(e => { runs[e.id]++; pal[e.id] += l.onboard; if (!by[e.id].includes(ri)) by[e.id].push(ri); })));
  return { runs, pal, by };
}

// Критичність ділянок для поточного плану: послідовності зупинок лишаються, змінюються лише шляхи
// тих переїздів, що йдуть через закрите ребро. Скільки коштуватиме закриття без переплану.
export function criticality(pb, sol) {
  const { nodes } = pb.M, used = new Set();
  sol.routes.forEach(r => r.legs.forEach(l => l.edges.forEach(e => used.add(e.id))));
  const out = [];
  for (const id of used) {
    const cond = { ...pb.cond, closed: new Set([...(pb.cond.closed || []), id]) };
    let delta = 0, extraMin = 0, extraKm = 0, routes = 0;
    const cut = new Set(), cache = new Map();
    const tree = (t, n) => { const k = t + ':' + n; if (!cache.has(k)) cache.set(k, dijkstra(n, t, cond)); return cache.get(k); };
    sol.routes.forEach(r => {
      if (!r.legs.some(l => l.edges.some(e => e.id === id))) return;
      routes++;
      const legs = r.legs.map(l => {
        if (!l.edges.some(e => e.id === id)) return [l.arr - l.dep, l.km];
        const tr = tree(r.t, nodes[l.from]), n = nodes[l.to];
        return [tr.T[n], tr.K[n]];
      });
      const s = sim(pb, r.d, r.t, r.seq, legs);
      if (!s) { const tr = tree(2, nodes[r.d]); r.stops.forEach(x => { if (!Number.isFinite(tr.T[x.stop.node])) cut.add(x.stop.id); }); return; }
      delta += costOf(pb, r.t, s) - r.cost; extraMin += s.dur - r.dur; extraKm += s.km - r.km;
    });
    out.push({ id, delta, extraMin, extraKm, cut: cut.size, routes, e: EDGES[id] });
  }
  return out.sort((x, y) => y.cut - x.cut || y.delta - x.delta);
}

export { edgeOpen };
