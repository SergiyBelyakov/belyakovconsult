// Графові алгоритми гри: вузли-мости (точки зчленування за Тар’яном), компоненти зв’язності,
// найкоротший шлях коридорами (Дейкстра) і детермінований зсув вузлів сітки.
export { rng } from '../../anomaly-demo/src/stats.js';

// Точки зчленування неорієнтованого графа: вузли, без яких кількість компонент зростає
export function articulation(ids, adj) {
  const disc = new Map(), low = new Map(), out = new Set();
  let time = 0;
  for (const root of ids) {
    if (disc.has(root)) continue;
    disc.set(root, time); low.set(root, time); time++;
    let rootKids = 0;
    const stack = [{ v: root, parent: null, i: 0 }];
    while (stack.length) {
      const fr = stack[stack.length - 1], nb = adj.get(fr.v) || [];
      if (fr.i < nb.length) {
        const w = nb[fr.i++];
        if (w === fr.parent) continue;
        if (disc.has(w)) { low.set(fr.v, Math.min(low.get(fr.v), disc.get(w))); continue; }
        disc.set(w, time); low.set(w, time); time++;
        if (fr.v === root) rootKids++;
        stack.push({ v: w, parent: fr.v, i: 0 });
      } else {
        stack.pop();
        const up = stack[stack.length - 1];
        if (up) {
          low.set(up.v, Math.min(low.get(up.v), low.get(fr.v)));
          if (up.v !== root && low.get(fr.v) >= disc.get(up.v)) out.add(up.v);
        }
      }
    }
    if (rootKids > 1) out.add(root);
  }
  return out;
}

// Компоненти зв’язності (кожна як масив id), найбільша перша
export function components(ids, adj) {
  const seen = new Set(), res = [];
  for (const s of ids) {
    if (seen.has(s)) continue;
    const comp = [s]; seen.add(s);
    for (let k = 0; k < comp.length; k++) for (const w of adj.get(comp[k]) || []) if (!seen.has(w)) { seen.add(w); comp.push(w); }
    res.push(comp);
  }
  return res.sort((a, b) => b.length - a.length);
}

// Дейкстра: next(id) → [{ to, w }]; повертає список вузлів від start до goal включно або null
export function shortest(start, goal, next) {
  if (start === goal) return [start];
  const dist = new Map([[start, 0]]), prev = new Map(), done = new Set(), open = [start];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (dist.get(open[k]) < dist.get(open[bi])) bi = k;
    const v = open.splice(bi, 1)[0];
    if (v === goal) break;
    if (done.has(v)) continue;
    done.add(v);
    for (const { to, w } of next(v)) {
      const d = dist.get(v) + w;
      if (d < (dist.has(to) ? dist.get(to) : Infinity)) { dist.set(to, d); prev.set(to, v); open.push(to); }
    }
  }
  if (!prev.has(goal)) return null;
  const path = [goal];
  while (path[0] !== start) path.unshift(prev.get(path[0]));
  return path;
}

// Стабільний хеш рядка для зсуву вузлів: однакова форма графа в кожного гравця
export function hash(s) {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Перетин відрізків (для перевірки рівнів: коридори не мають перетинатися)
export function cross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
