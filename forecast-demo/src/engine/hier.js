// Узгоджений прогноз за рівнями (область → громади → послуги). Базові прогнози кожного вузла будуються окремо
// і не сходяться: сума громад не дорівнює прогнозу області. Узгодження знаходить найближчий набір прогнозів,
// у якому суми нижчих рівнів збігаються з вищими: ỹ = S G ŷ, де S сумуюча матриця, а G залежить від методу:
//   bu    знизу вгору: беремо лише прогнози нижнього рівня і складаємо;
//   ols   найменші квадрати: G = (S'S)⁻¹S';
//   wls   зважені за структурою: вага вузла обернена до кількості рядів під ним;
//   mint  MinT зі стисненням коваріації помилок на історії (Wickramasuriya, Athanasopoulos, Hyndman, 2019).
import { runModel, maseScale } from './evaluate.js';
import { mean } from './util.js';

export const METHODS = ['base', 'bu', 'ols', 'wls', 'mint'];
const BASE_MODEL = 'hw', BASE_PARAMS = { season: 'mult', damped: true };

function inv(A) {
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(r => r.slice(n));
}
const mul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const tr = A => A[0].map((_, j) => A.map(r => r[j]));

// Сумуюча матриця: рядок на кожен вузол, стовпчик на кожен ряд нижнього рівня
export function summing(nodes) {
  const bottom = nodes.filter(x => x.level === 2);
  const under = x => (x.level === 2 ? [x.id] : x.level === 1 ? bottom.filter(b => b.parent === x.id).map(b => b.id) : bottom.map(b => b.id));
  return nodes.map(x => { const u = new Set(under(x)); return bottom.map(b => (u.has(b.id) ? 1 : 0)); });
}

// Стиснена коваріація помилок (Шефер і Штріммер), як у MinT: λ·діагональ + (1 − λ)·вибіркова
function shrinkCov(E) {
  const T = E.length, N = E[0].length;
  const cov = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => E.reduce((s, r) => s + r[i] * r[j], 0) / T));
  const sdv = cov.map((r, i) => Math.sqrt(r[i]) || 1);
  const xs = E.map(r => r.map((v, i) => v / sdv[i]));
  let num = 0, den = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i === j) continue;
    let s1 = 0, s2 = 0;
    for (let t = 0; t < T; t++) { const w = xs[t][i] * xs[t][j]; s1 += w * w; s2 += w; }
    num += (s1 - (s2 * s2) / T) / (T * (T - 1));
    den += (cov[i][j] / (sdv[i] * sdv[j])) ** 2;
  }
  const lam = den > 0 ? Math.max(0, Math.min(1, num / den)) : 1;
  return { W: cov.map((r, i) => r.map((v, j) => (i === j ? v : (1 - lam) * v))), lam };
}

export function reconcileMatrix(method, S, resid) {
  const N = S.length, nb = S[0].length;
  if (method === 'bu') return Array.from({ length: nb }, (_, j) => Array.from({ length: N }, (_, i) => (i === N - nb + j ? 1 : 0)));
  let Winv;
  if (method === 'ols') Winv = S.map((_, i) => S.map((__, j) => (i === j ? 1 : 0)));
  else if (method === 'wls') Winv = S.map((r, i) => S.map((__, j) => (i === j ? 1 / r.reduce((a, b) => a + b, 0) : 0)));
  else Winv = inv(shrinkCov(resid).W);
  const St = tr(S), StW = mul(St, Winv);
  return mul(inv(mul(StW, S)), StW);
}

function nodeSeries(H, x, cut) {
  return { id: x.id, y: x.y.slice(0, cut), dates: H.dates.slice(0, cut), freq: H.freq, m: H.m, flow: true, seed: 11, dec: 0 };
}

// Базові прогнози всіх вузлів і узгодження всіма методами; cut: де закінчується навчання (для перевірки)
export function hierRun(H, h, cut = H.dates.length) {
  const S = summing(H.nodes), N = H.nodes.length;
  const runs = H.nodes.map(x => runModel(BASE_MODEL, nodeSeries(H, x, cut), BASE_PARAMS, h));
  const base = runs.map(r => r.fc.map(f => f.mean));
  // помилки на крок уперед на історії (після першого сезону) для MinT
  const from = H.m, resid = [];
  for (let t = from; t < cut; t++) resid.push(H.nodes.map((x, i) => x.y[t] - runs[i].fitted[t]));
  const out = { base };
  let lam = null;
  for (const m of METHODS.slice(1)) {
    const G = reconcileMatrix(m, S, resid), SG = mul(S, G);
    out[m] = Array.from({ length: N }, (_, i) => Array.from({ length: h }, (_, k) => SG[i].reduce((s, v, j) => s + v * base[j][k], 0)));
    if (m === 'mint') lam = shrinkCov(resid).lam;
  }
  return { fc: out, S, lam, band: runs.map(r => r.fc) };
}

// Точність за рівнями на відкладених даних: середній MASE вузлів кожного рівня для кожного методу
export function hierAccuracy(H) {
  const n = H.dates.length, cut = n - H.H, run = hierRun(H, H.H, cut);
  const scale = H.nodes.map(x => maseScale(x.y.slice(0, cut), H.m));
  const acc = {};
  METHODS.forEach(m => {
    acc[m] = [0, 1, 2].map(lv => mean(H.nodes.map((x, i) => (x.level === lv ? mean(run.fc[m][i].map((v, k) => Math.abs(v - x.y[cut + k]))) / scale[i] : NaN)).filter(Number.isFinite)));
  });
  return { acc, run, cut };
}

// Розбіжність: наскільки сума дітей відрізняється від батьківського прогнозу (за весь горизонт)
export function incoherence(H, fc) {
  const tot = fc.map(v => v.reduce((a, b) => a + b, 0)), idx = Object.fromEntries(H.nodes.map((x, i) => [x.id, i]));
  return H.nodes.filter(x => x.level < 2).map(x => {
    const kids = H.nodes.filter(c => c.parent === x.id), s = kids.reduce((a, c) => a + tot[idx[c.id]], 0);
    return { id: x.id, parent: tot[idx[x.id]], kids: s, gap: s - tot[idx[x.id]] };
  });
}
