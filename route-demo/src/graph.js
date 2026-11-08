// Граф доріг: час проїзду для кожного типу машини за умовами дня, матриці часу й відстані між точками,
// відновлення шляхів, центральність посередництва (Брандес), мости графа (Тар'ян) і критичність ділянок.
import { NODES, EDGES, ADJ, other, TYPES } from './world.js';

const N = NODES.length;
export const FERRY_MIN = 35; // переправа поромом: 15 хв ходу і в середньому 20 хв очікування

// умови: закриті ребра, повінь (пором і низинні ділянки), ожеледь (повільніше), ремонт міського мосту
export function edgeOpen(e, t, cond) {
  if (cond.closed && cond.closed.has(e.id)) return false;
  if (TYPES[t].mass > e.maxT) return false;
  if (cond.flood && (e.ferry || e.low)) return false;
  return true;
}
export function edgeMin(e, t, cond) {
  if (e.ferry) return FERRY_MIN;
  let v = e.kmh * TYPES[t].speed;
  if (cond.winter) v *= e.cls === 4 ? 0.6 : 0.75;
  return (e.len / v) * 60;
}

// мінімальна купа для Дейкстри
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (!n) return top;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= n) break;
      if (c + 1 < n && k[c + 1] < k[c]) c++;
      if (k[c] >= lk) break;
      k[i] = k[c]; v[i] = v[c]; i = c;
    }
    k[i] = lk; v[i] = lv;
    return top;
  }
}

// Дейкстра за часом від вузла src: час, кілометри і попереднє ребро для кожного вузла
export function dijkstra(src, t, cond, w = null) {
  const T = new Float64Array(N).fill(Infinity), K = new Float64Array(N).fill(Infinity), via = new Int32Array(N).fill(-1);
  const h = new Heap();
  T[src] = 0; K[src] = 0; h.push(0, src);
  const done = new Uint8Array(N);
  while (h.size) {
    const u = h.pop();
    if (done[u]) continue;
    done[u] = 1;
    for (const id of ADJ[u]) {
      const e = EDGES[id];
      if (!edgeOpen(e, t, cond)) continue;
      const v = other(e, u), c = T[u] + (w ? w[id] : edgeMin(e, t, cond));
      if (c < T[v] - 1e-9) { T[v] = c; K[v] = K[u] + e.len; via[v] = id; h.push(c, v); }
    }
  }
  return { T, K, via };
}

// Матриці між точками (склади й замовлення): для кожного типу машини окремо, бо вагові обмеження
// і швидкість різні. Точки з одним вузлом ділять один прохід Дейкстри.
export function matrices(pointNodes, cond) {
  const P = pointNodes.length, uniq = [...new Set(pointNodes)];
  const tt = [], dd = [], trees = [];
  for (let t = 0; t < TYPES.length; t++) {
    const tm = new Float64Array(P * P), dm = new Float64Array(P * P), tr = new Map();
    uniq.forEach(n => tr.set(n, dijkstra(n, t, cond)));
    for (let i = 0; i < P; i++) {
      const r = tr.get(pointNodes[i]);
      for (let j = 0; j < P; j++) { tm[i * P + j] = r.T[pointNodes[j]]; dm[i * P + j] = r.K[pointNodes[j]]; }
    }
    tt.push(tm); dd.push(dm); trees.push(tr);
  }
  return { P, nodes: pointNodes, tt, dd, trees, cond };
}

// шлях між вузлами як список ребер у напрямку руху: [id, прямий напрям?]
export function pathEdges(M, t, fromNode, toNode) {
  const tr = M.trees[t].get(fromNode);
  if (!tr || !Number.isFinite(tr.T[toNode])) return null;
  const out = [];
  for (let v = toNode; v !== fromNode;) {
    const id = tr.via[v];
    if (id < 0) return null;
    const e = EDGES[id], u = other(e, v);
    out.push([id, e.a === u]);
    v = u;
  }
  return out.reverse();
}

// ——— аналітика мережі ———
// Центральність посередництва за часом проїзду фургона (Брандес): для вузлів і для ребер, з вагою
// пар за населенням, щоб дорога між великими пунктами важила більше, ніж між двома хуторами.
export function betweenness(cond) {
  const CB = new Float64Array(N), EB = new Float64Array(EDGES.length);
  const w = EDGES.map(e => edgeMin(e, 2, cond));
  const pop = NODES.map(n => Math.sqrt(n.pop));
  for (let s = 0; s < N; s++) {
    const S = [], Pred = Array.from({ length: N }, () => []), sigma = new Float64Array(N), d = new Float64Array(N).fill(Infinity);
    sigma[s] = 1; d[s] = 0;
    const h = new Heap(); h.push(0, s);
    const done = new Uint8Array(N);
    while (h.size) {
      const u = h.pop();
      if (done[u]) continue;
      done[u] = 1; S.push(u);
      for (const id of ADJ[u]) {
        const e = EDGES[id];
        if (!edgeOpen(e, 2, cond)) continue;
        const v = other(e, u), c = d[u] + w[id];
        if (c < d[v] - 1e-9) { d[v] = c; sigma[v] = sigma[u]; Pred[v] = [[u, id]]; h.push(c, v); }
        else if (Math.abs(c - d[v]) < 1e-9) { sigma[v] += sigma[u]; Pred[v].push([u, id]); }
      }
    }
    const delta = new Float64Array(N);
    while (S.length) {
      const v = S.pop(), wv = v === s ? 0 : pop[s] * pop[v];
      for (const [u, id] of Pred[v]) {
        const c = (sigma[u] / sigma[v]) * (wv + delta[v]);
        EB[id] += c; delta[u] += c;
      }
      if (v !== s) CB[v] += delta[v];
    }
  }
  const mx = Math.max(...CB) || 1, me = Math.max(...EB) || 1;
  return { node: Array.from(CB, v => v / mx), edge: Array.from(EB, v => v / me) };
}

// Мости графа (ребра, без яких частина мережі відрізана) і точки зчленування для фургона.
// Для кожного мосту рахуємо, скільки пунктів і людей опиняються по той бік.
export function cutEdges(cond) {
  const disc = new Int32Array(N).fill(-1), low = new Int32Array(N), bridges = [], art = new Set();
  let time = 0;
  const dfs = (u, pe) => {
    disc[u] = low[u] = time++;
    let kids = 0;
    for (const id of ADJ[u]) {
      const e = EDGES[id];
      if (!edgeOpen(e, 2, cond) || id === pe) continue;
      const v = other(e, u);
      if (disc[v] < 0) {
        kids++;
        dfs(v, id);
        low[u] = Math.min(low[u], low[v]);
        if (low[v] > disc[u]) bridges.push(id);
        if (pe >= 0 && low[v] >= disc[u]) art.add(u);
      } else low[u] = Math.min(low[u], disc[v]);
    }
    if (pe < 0 && kids > 1) art.add(u);
  };
  for (let i = 0; i < N; i++) if (disc[i] < 0) dfs(i, -1);
  // хто відрізаний: компонента меншого боку
  const side = id => {
    const e = EDGES[id], seen = new Uint8Array(N), st = [e.b];
    seen[e.b] = 1;
    while (st.length) {
      const u = st.pop();
      for (const k of ADJ[u]) { if (k === id || !edgeOpen(EDGES[k], 2, cond)) continue; const v = other(EDGES[k], u); if (!seen[v]) { seen[v] = 1; st.push(v); } }
    }
    const B = [], A = [];
    for (let i = 0; i < N; i++) (seen[i] ? B : A).push(i);
    return B.length <= A.length ? B : A;
  };
  return { bridges: bridges.map(id => ({ id, cut: side(id) })), art: [...art] };
}

// Скільки ребер на компоненти: граф цілий чи ні (для фургона)
export function components(cond) {
  const comp = new Int32Array(N).fill(-1);
  let c = 0;
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0) continue;
    const st = [s]; comp[s] = c;
    while (st.length) {
      const u = st.pop();
      for (const id of ADJ[u]) { const e = EDGES[id]; if (!edgeOpen(e, 2, cond)) continue; const v = other(e, u); if (comp[v] < 0) { comp[v] = c; st.push(v); } }
    }
    c++;
  }
  return { comp, n: c };
}
