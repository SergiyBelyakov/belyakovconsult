// Пошук аномалій у браузері. Однаково працює на синтетичних платежах і на файлі відвідувача.
//
// 1. Норма: кожен запис порівнюється з базою: своєю групою або всіма записами (контекст).
// 2. Рідкісність ознаки: у межах 10–90% розподілу бази рахуємо частку записів, які не менш незвичні;
//    за межами для безперервних ознак продовжуємо хвіст нормальним розподілом від 10-го чи 90-го перцентиля.
//    Так різнорідні групи (інтернет за 3 тис. і ліцензія за 400 тис. в одній групі) не дають хибних тривог.
// 3. Методи:
//    dev      відхилення ознак: комбінація рідкісностей (імовірність, що хоч одна ознака така ж рідкісна,
//             або що всі разом такі ж незвичні, метод Фішера), переведена в сигми;
//    iforest  ліс ізоляції: 100 випадкових дерев на 256 записах; що швидше запис відокремлюється, то незвичніший;
//    knn      найближчі сусіди: середня відстань до 10 найсхожіших записів бази.
//    Оцінки лісу й сусідів переводяться в сигми робастно (медіана й MAD у межах бази).
// 4. Розміщення в 3D: група є «галактикою»; відстань від ядра відповідає рівню відхилення, напрямок
//    показує, якими ознаками запис відрізняється (кожна ознака має свій промінь).
import { rng, logQ, zFromLogP, logTPM, logUnion, logEither, quantileSorted, lowerBound, upperBound, radial, clamp } from './stats.js';

export const METHODS = ['dev', 'iforest', 'knn'];
export const CONTEXTS = ['group', 'all'];
export const D_CAP = 40;   // для порядку записів; показуємо не більше «≥12σ»
const LOG2 = Math.log(2);

const cN = s => (s > 2 ? 2 * (Math.log(s - 1) + 0.5772156649) - 2 * (s - 1) / s : s === 2 ? 1 : 0);

// Промені ознак: рівномірно на сфері (спіраль Фібоначчі)
export function spokes(d) {
  const out = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (let j = 0; j < d; j++) {
    const y = 1 - (j + 0.5) / d * 2, rr = Math.sqrt(1 - y * y), a = j * ga + 0.6;
    out.push([Math.cos(a) * rr, y * 0.82, Math.sin(a) * rr]);
  }
  return out;
}

export function makeEngine(ds) {
  const { n, d, X, features: F, gi } = ds;
  const G = ds.groups.length;
  const ctxCache = {}, runCache = new Map();
  const SP = spokes(d);
  // випадковий напрямок для кожного запису (стабільний): ядро хмари без структури
  const rdir = new Float32Array(n * 3);
  { const r = rng(91); for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); rdir[i * 3] = Math.cos(a) * s; rdir[i * 3 + 1] = u; rdir[i * 3 + 2] = Math.sin(a) * s; } }

  function context(ctx) {
    if (ctxCache[ctx]) return ctxCache[ctx];
    const lists = ctx === 'all' ? [Array.from({ length: n }, (_, i) => i)] : Array.from({ length: G }, () => []);
    if (ctx !== 'all') for (let i = 0; i < n; i++) lists[gi[i]].push(i);
    const bases = lists.map(l => ({ idx: Int32Array.from(l) }));
    const of = new Int16Array(n);
    const logp = new Float32Array(n * d), zs = new Float32Array(n * d);
    bases.forEach((b, bi) => {
      const m = b.idx.length;
      b.med = new Float64Array(d); b.q10 = new Float64Array(d); b.q90 = new Float64Array(d);
      const K = clamp(Math.round(0.01 * m), 3, 20);
      for (let k = 0; k < m; k++) of[b.idx[k]] = bi;
      F.forEach((f, j) => {
        const v = new Float64Array(m);
        for (let k = 0; k < m; k++) v[k] = X[b.idx[k] * d + j];
        v.sort();
        const q50 = quantileSorted(v, 0.5), q10 = quantileSorted(v, 0.1), q90 = quantileSorted(v, 0.9), fl = f.floor || 1e-6;
        b.med[j] = q50; b.q10[j] = q10; b.q90[j] = q90;
        const sHi = Math.max((q90 - q50) / 1.2816, fl), sLo = Math.max((q50 - q10) / 1.2816, fl);
        for (let k = 0; k < m; k++) {
          const i = b.idx[k], x = X[i * d + j];
          // середня імовірність (mid-p): незвичніші плюс половина рівних; для моди ознаки ≈ 0,5.
          // Якщо настільки ж незвичних записів у базі менше K (≈0,5%), хвіст продовжується нормальним
          // розподілом від 10-го чи 90-го перцентиля з масштабом «тіла» бази: значення за межами
          // побаченого стають дедалі рідкіснішими, а часті «майже нулі» (вечірні платежі у відрядженнях) лишаються нормою
          const lt = lowerBound(v, x - 1e-12), gt = m - upperBound(v, x + 1e-12), eq = m - lt - gt;
          const nUp = gt + 0.5 * eq, nLo = lt + 0.5 * eq;
          let lUp = Math.log(Math.max(0.5, nUp) / m), lLo = Math.log(Math.max(0.5, nLo) / m);
          if (nUp < K && x > q90) lUp = Math.min(lUp, Math.log(0.2) + logQ((x - q90) / sHi));
          if (nLo < K && x < q10) lLo = Math.min(lLo, Math.log(0.2) + logQ((q10 - x) / sLo));
          let lp, z;
          if (f.side === 'both') { lp = Math.min(0, LOG2 + Math.min(lUp, lLo)); z = x >= q50 ? Math.max(0, zFromLogP(lUp)) : -Math.max(0, zFromLogP(lLo)); }
          else if (f.side === 'high') { lp = Math.min(0, lUp); z = Math.max(0, zFromLogP(lUp)); }
          else { lp = Math.min(0, lLo); z = Math.max(0, zFromLogP(lLo)); }
          logp[i * d + j] = lp; zs[i * d + j] = clamp(z, -12, 12);
        }
      });
    });
    // центри «галактик»: групи по колу з невеликими перепадами висоти; усі записи разом в одній великій хмарі
    const R = Math.max(17, bases.length * 2.6);
    bases.forEach((b, k) => {
      if (ctx === 'all' || bases.length === 1) { b.c = [0, 0, 0]; b.s = ctx === 'all' ? 2.7 : 2.2; return; }
      const a = (k / bases.length) * Math.PI * 2 + 0.35;
      b.c = [Math.cos(a) * R, (k % 2 ? 1 : -1) * 2.2, Math.sin(a) * R];
      b.s = 0.62 + 0.24 * Math.cbrt(Math.max(1, b.idx.length) / 200);
    });
    return (ctxCache[ctx] = { ctx, bases, of, logp, zs });
  }

  function compact(zs, J, idx) {
    const m = idx.length, q = J.length, M = new Float32Array(m * q);
    for (let k = 0; k < m; k++) for (let a = 0; a < q; a++) M[k * q + a] = zs[idx[k] * d + J[a]];
    return M;
  }

  function isoForest(M, m, q, r, T = 100, psi = 256) {
    const ps = Math.min(psi, m), maxD = Math.ceil(Math.log2(Math.max(2, ps))), pool = new Int32Array(m);
    const rlo = new Float64Array(q), rhi = new Float64Array(q);
    const trees = [];
    for (let t = 0; t < T; t++) {
      for (let k = 0; k < m; k++) pool[k] = k;
      for (let s = 0; s < ps; s++) { const j = s + Math.floor(r() * (m - s)), tmp = pool[s]; pool[s] = pool[j]; pool[j] = tmp; }
      const feat = [], val = [], left = [], right = [], size = [];
      const build = (ids, depth) => {
        const node = feat.length;
        feat.push(-1); val.push(0); left.push(-1); right.push(-1); size.push(ids.length);
        if (depth >= maxD || ids.length <= 1) return node;
        // ознаку вибираємо з імовірністю, пропорційною її розмаху у вузлі: незвичні значення відокремлюються раніше,
        // а ознаки, що майже завжди дорівнюють нулю, не марнують розбиття
        let tot = 0;
        for (let a = 0; a < q; a++) {
          let lo = Infinity, hi = -Infinity;
          for (const k of ids) { const v = M[k * q + a]; if (v < lo) lo = v; if (v > hi) hi = v; }
          rlo[a] = lo; rhi[a] = hi; tot += hi - lo;
        }
        if (tot < 1e-9) return node;
        let u = r() * tot, a = 0;
        while (a < q - 1 && u > rhi[a] - rlo[a]) { u -= rhi[a] - rlo[a]; a++; }
        const sp = rlo[a] + r() * (rhi[a] - rlo[a]), L = [], Rr = [];
        for (const k of ids) (M[k * q + a] < sp ? L : Rr).push(k);
        if (!L.length || !Rr.length) return node;
        feat[node] = a; val[node] = sp;
        left[node] = build(L, depth + 1);
        right[node] = build(Rr, depth + 1);
        return node;
      };
      build(Array.from(pool.subarray(0, ps)), 0);
      trees.push({ feat: Int16Array.from(feat), val: Float32Array.from(val), left: Int32Array.from(left), right: Int32Array.from(right), size: Int32Array.from(size) });
    }
    const c = cN(ps), score = new Float64Array(m), path = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      let h = 0;
      for (const tr of trees) {
        let node = 0, depth = 0;
        while (tr.feat[node] >= 0) { node = M[k * q + tr.feat[node]] < tr.val[node] ? tr.left[node] : tr.right[node]; depth++; }
        h += depth + cN(tr.size[node]);
      }
      path[k] = h / T;
      score[k] = Math.pow(2, -path[k] / (c || 1));
    }
    return { score, path };
  }

  function knn(M, m, q, r, k = 10, maxRef = 2400) {
    let ref;
    if (m <= maxRef) ref = Int32Array.from({ length: m }, (_, i) => i);
    else { const p = Int32Array.from({ length: m }, (_, i) => i); for (let s = 0; s < maxRef; s++) { const j = s + Math.floor(r() * (m - s)), t = p[s]; p[s] = p[j]; p[j] = t; } ref = p.slice(0, maxRef); }
    const kk = Math.min(k, ref.length - 1), best = new Float64Array(Math.max(1, kk)), dist = new Float64Array(m);
    for (let a = 0; a < m; a++) {
      best.fill(Infinity);
      const oa = a * q;
      for (let t = 0; t < ref.length; t++) {
        const b = ref[t];
        if (b === a) continue;
        const ob = b * q, lim = best[kk - 1];
        let s = 0;
        for (let c = 0; c < q; c++) { const x = M[oa + c] - M[ob + c]; s += x * x; if (s >= lim) break; }
        if (s < lim) { let p = kk - 1; while (p > 0 && best[p - 1] > s) { best[p] = best[p - 1]; p--; } best[p] = s; }
      }
      let mean = 0;
      for (let t = 0; t < kk; t++) mean += Math.sqrt(best[t]);
      dist[a] = kk ? mean / kk : 0;
    }
    return dist;
  }

  // Медіана й масштаб верхньої половини (90-й перцентиль): оцінки лісу й сусідів мають довгий правий хвіст
  // навіть на звичайних даних, тому сигма за MAD давала б забагато сигналів
  const robust = (arr, floor) => {
    const v = Float64Array.from(arr).sort(), med = quantileSorted(v, 0.5);
    return [med, Math.max((quantileSorted(v, 0.9) - med) / 1.2816, floor)];
  };

  // Розрахунок для контексту й набору ознак. Відхилення ознак рахується одразу (мілісекунди),
  // ліс ізоляції й сусіди за потреби (ensure), бо разом це ≈0,3 с. Усе кешується.
  function run(ctx, featIds) {
    const J = F.map((f, j) => (featIds.includes(f.id) ? j : -1)).filter(j => j >= 0);
    const key = ctx + '|' + J.join(',');
    if (runCache.has(key)) return runCache.get(key);
    const C = context(ctx);
    const D = { dev: new Float32Array(n) };
    const ls = new Array(J.length);
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < J.length; a++) ls[a] = C.logp[i * d + J[a]];
      D.dev[i] = Math.min(D_CAP, zFromLogP(logEither(Math.min(logUnion(ls), logTPM(ls)))));
    }
    const res = { key, ctx, J, feats: J.map(j => F[j].id), C, D, extra: {}, shift: {}, pos: {} };
    shifts(res, 'dev');
    runCache.set(key, res);
    return res;
  }

  function ensure(res, method) {
    if (res.D[method]) return res;
    const { C, J } = res;
    const D = { iforest: new Float32Array(n), knn: new Float32Array(n) };
    const extra = { ifPath: new Float32Array(n), ifTypical: [], knnDist: new Float32Array(n), knnTypical: [] };
    const r = rng(7 + J.length * 31 + (res.ctx === 'all' ? 1000 : 0));
    C.bases.forEach((b, bi) => {
      const m = b.idx.length, q = J.length;
      if (m < 3 || !q) return;
      const M = compact(C.zs, J, b.idx);
      const { score, path } = isoForest(M, m, q, r);
      const [mi, si] = robust(score, 0.012);
      const dist = knn(M, m, q, r);
      const ld = dist.map(x => Math.log(x + 0.3));
      const [mk, sk] = robust(ld, 0.06);
      extra.ifTypical[bi] = quantileSorted(Float64Array.from(path).sort(), 0.5);
      extra.knnTypical[bi] = quantileSorted(Float64Array.from(dist).sort(), 0.5);
      for (let k = 0; k < m; k++) {
        const i = b.idx[k];
        D.iforest[i] = clamp((score[k] - mi) / si, -4, D_CAP);
        D.knn[i] = clamp((ld[k] - mk) / sk, -4, D_CAP);
        extra.ifPath[i] = path[k]; extra.knnDist[i] = dist[k];
      }
    });
    Object.assign(res.D, D);
    Object.assign(res.extra, extra);
    shifts(res, 'iforest'); shifts(res, 'knn');
    return res;
  }

  // Зсув рівня для розміщення: медіана бази стає центром нормальної «хмари», щоб ядро мало об'єм
  function shifts(res, method) {
    const D = res.D[method];
    res.shift[method] = res.C.bases.map(b => {
      const v = Float64Array.from(b.idx, i => D[i]).sort();
      return clamp(-quantileSorted(v, 0.5), -2, 2.5);
    });
  }
  // Радіус сфери «межа норми» для бази в одиницях сцени
  const shellRadius = (res, method, bi, th) => res.C.bases[bi].s * radial(th + res.shift[method][bi]);

  // Координати точок для методу: центр бази + масштаб × радіус(рівень) × напрямок
  function positions(res, method) {
    ensure(res, method);
    if (res.pos[method]) return res.pos[method];
    const { C, J } = res, D = res.D[method], sh = res.shift[method], out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const bi = C.of[i], b = C.bases[bi], rr = radial(D[i] + sh[bi]);
      let wx = 0, wy = 0, wz = 0;
      for (const j of J) { const a = Math.max(0, Math.abs(C.zs[i * d + j]) - 0.6); if (a > 0) { const w = a ** 1.5; wx += w * SP[j][0]; wy += w * SP[j][1]; wz += w * SP[j][2]; } }
      const wl = Math.hypot(wx, wy, wz), t = clamp((rr - 1.2) / 2.2, 0, 1) * (wl > 1e-6 ? 0.85 : 0);
      let ux = rdir[i * 3] * (1 - t) + (wl ? wx / wl : 0) * t;
      let uy = rdir[i * 3 + 1] * (1 - t) + (wl ? wy / wl : 0) * t;
      let uz = rdir[i * 3 + 2] * (1 - t) + (wl ? wz / wl : 0) * t;
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      out[i * 3] = b.c[0] + b.s * rr * ux;
      out[i * 3 + 1] = b.c[1] + b.s * rr * uy;
      out[i * 3 + 2] = b.c[2] + b.s * rr * uz;
    }
    return (res.pos[method] = out);
  }

  // Найближчі записи тієї ж бази в просторі рідкісностей (для пояснення і «сузір'я» в 3D)
  function neighbors(res, i, k = 6) {
    const { C, J } = res, b = C.bases[C.of[i]], best = [];
    for (const o of b.idx) {
      if (o === i) continue;
      let s = 0;
      for (const j of J) { const x = C.zs[i * d + j] - C.zs[o * d + j]; s += x * x; }
      if (best.length < k || s < best[best.length - 1][1]) { best.push([o, s]); best.sort((a, c) => a[1] - c[1]); if (best.length > k) best.pop(); }
    }
    return best.map(x => x[0]);
  }

  // Ознаки запису від найрідкіснішої: ln імовірності, рідкісність у сигмах, медіана бази
  function reasons(res, i) {
    const { C, J } = res, b = C.bases[C.of[i]];
    return J.map(j => ({ j, id: F[j].id, lp: C.logp[i * d + j], z: C.zs[i * d + j], x: X[i * d + j], med: b.med[j] })).sort((a, c) => a.lp - c.lp);
  }

  return { ds, run, ensure, positions, shellRadius, neighbors, reasons, spokes: SP, context };
}

// Позиції «звичайного дашборда»: 12 стовпців-місяців, складених із тих самих точок
export function dashLayout(ds, monthOfRow) {
  const n = ds.n, out = new Float32Array(n * 3), per = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < n; i++) per[monthOfRow(i)].push(i);
  const S = 0.44;
  per.forEach((list, m) => {
    list.sort((a, b) => ds.rows[a].amount - ds.rows[b].amount);
    list.forEach((i, k) => {
      // невелике тремтіння, щоб правильна ґратка точок не давала муару
      const layer = Math.floor(k / 25), cell = k % 25, cx = cell % 5, cz = Math.floor(cell / 5);
      const h1 = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12543.21, h3 = Math.sin(i * 39.425) * 24634.63;
      out[i * 3] = (m - 5.5) * 3.1 + (cx - 2) * S + (h1 - Math.floor(h1) - 0.5) * 0.34;
      out[i * 3 + 1] = -6 + layer * S + (h2 - Math.floor(h2) - 0.5) * 0.3;
      out[i * 3 + 2] = (cz - 2) * S + (h3 - Math.floor(h3) - 0.5) * 0.34;
    });
  });
  return out;
}

// Скільки записів перевищують поріг: загалом, за групами й за розміткою (для демо)
export function tally(ds, D, th, groupFilter) {
  const byG = new Int32Array(ds.groups.length), byT = { error: 0, risk: 0, benign: 0, normal: 0 };
  let total = 0;
  for (let i = 0; i < ds.n; i++) {
    if (D[i] < th) continue;
    if (groupFilter && groupFilter.size && !groupFilter.has(ds.gi[i])) continue;
    total++; byG[ds.gi[i]]++;
    if (ds.rows && ds.rows[i].truth) byT[ds.rows[i].truth]++;
  }
  return { total, byG, byT };
}
