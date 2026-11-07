// Математика демо: генератор випадкових чисел, хвости нормального розподілу (у логарифмах, щоб не втрачати
// точність на дуже рідкісних значеннях), медіана й MAD, комбінація ймовірностей Фішера і радіус точки в хмарі.

// Детермінований генератор (mulberry32): ті самі дані при кожному відкритті
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gauss = r => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// erfc з відносною похибкою до 1,2e-7 (Numerical Recipes)
export function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

// ln P(Z > x) для стандартного нормального розподілу
export function logQ(x) {
  if (x < 6) return Math.log(Math.max(1e-300, 0.5 * erfc(x / Math.SQRT2)));
  const x2 = x * x;
  return -x2 / 2 - Math.log(x * Math.sqrt(2 * Math.PI)) + Math.log(1 - 1 / x2 + 3 / (x2 * x2));
}

// Обернена функція: рівень відхилення D (у сигмах) за ln імовірності хвоста. Алгоритм Акляма.
const A = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
const B = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
const Cc = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
const Dd = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
const tail = q => (((((Cc[0] * q + Cc[1]) * q + Cc[2]) * q + Cc[3]) * q + Cc[4]) * q + Cc[5]) / ((((Dd[0] * q + Dd[1]) * q + Dd[2]) * q + Dd[3]) * q + 1);
export function invPhi(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 0.97575) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5, r = q * q;
  return (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}
export function zFromLogP(logp) {
  if (!(logp < 0)) return -4;
  if (logp < Math.log(0.02425)) return -tail(Math.sqrt(-2 * logp));
  return Math.max(-4, -invPhi(Math.exp(logp)));
}

// ln імовірності хвоста в Фішеровій комбінації: X = −2 Σ ln p, k ознак, хі-квадрат з 2k ступенями свободи
export function logFisher(sumLog, k) {
  const h = -sumLog;            // X/2
  if (h <= 0 || k <= 0) return 0;
  const lh = Math.log(h);
  let mx = -Infinity;
  const terms = [];
  for (let i = 0, lf = 0; i < k; i++) { if (i > 0) lf += Math.log(i); const t = i * lh - lf; terms.push(t); if (t > mx) mx = t; }
  let s = 0;
  for (const t of terms) s += Math.exp(t - mx);
  return Math.min(0, -h + mx + Math.log(s));
}

// ln P(W ≤ w) для методу усіченого добутку (Zaykin et al., 2002): W = добуток p_j ≤ τ серед L ознак.
// Сильніший за Фішера, коли незвичні лише кілька ознак з багатьох (новий контрагент + велика сума + термінова оплата).
export function logTPM(logs, tau = 0.05) {
  const L = logs.length, lt = Math.log(tau);
  let lw = 0, any = false;
  for (const l of logs) if (l <= lt) { lw += l; any = true; }
  if (!any) return 0;
  if (lw < -600) return lw;                       // далі домінує найменше p (рахує logUnion)
  const w = Math.exp(lw);
  let total = 0, lc = 0;                          // lc = ln C(L, k)
  for (let k = 1; k <= L; k++) {
    lc += Math.log(L - k + 1) - Math.log(k);
    const pre = Math.exp(lc + (L - k) * Math.log1p(-tau));
    if (lw <= k * lt) {
      const a = k * lt - lw;
      let s = 0, term = 1;
      for (let q = 0; q < k; q++) { if (q > 0) term *= a / q; s += term; }
      total += pre * w * s;
    } else total += pre * Math.exp(k * lt);
  }
  return Math.min(0, Math.log(Math.max(1e-300, total)));
}

// ln (1 − (1 − p_min)^k): імовірність, що серед k ознак хоч одна буде такою ж рідкісною, як найрідкісніша (Шидак)
export function logUnion(logs) {
  let mn = 0;
  for (const l of logs) if (l < mn) mn = l;
  const k = logs.length;
  if (mn < -30) return Math.log(k) + mn;
  return Math.log(Math.max(1e-300, -Math.expm1(k * Math.log1p(-Math.min(0.999999999, Math.exp(mn))))));
}
// ln (1 − (1 − p)^2): дві оцінки (одна ознака чи всі разом) без стрибка біля 1
export function logEither(l) {
  if (l < -30) return Math.log(2) + l;
  return Math.log(Math.max(1e-300, -Math.expm1(2 * Math.log1p(-Math.min(0.999999999, Math.exp(l))))));
}
export function upperBound(v, x) {
  let lo = 0, hi = v.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (v[mid] <= x) lo = mid + 1; else hi = mid; }
  return lo;
}

// Медіана й MAD відсортованого масиву
export function quantileSorted(v, q) {
  const n = v.length; if (!n) return 0;
  const pos = (n - 1) * q, i = Math.floor(pos), f = pos - i;
  return i + 1 < n ? v[i] * (1 - f) + v[i + 1] * f : v[i];
}
export function medMad(arr) {
  const v = Float64Array.from(arr).sort();
  const m = quantileSorted(v, 0.5);
  const dv = v.map(x => Math.abs(x - m)).sort();
  return [m, quantileSorted(dv, 0.5), v];
}
export function lowerBound(v, x) {
  let lo = 0, hi = v.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (v[mid] < x) lo = mid + 1; else hi = mid; }
  return lo;
}

// Радіус точки в хмарі: рівень відхилення D переводимо в радіус тривимірного нормального розподілу з тією самою
// імовірністю хвоста (хі з 3 ступенями свободи). Звичайні записи утворюють щільне ядро, як природна хмара,
// а межа «норми» (поріг) стає сферою. Дуже далекі значення стискаємо логарифмом, щоб лишалися в кадрі.
const SQ2PI = Math.sqrt(2 / Math.PI);
function logQ3(r) {
  if (r < 7) return Math.log(Math.max(1e-300, erfc(r / Math.SQRT2) + SQ2PI * r * Math.exp(-r * r / 2)));
  return 0.5 * Math.log(2 / Math.PI) - r * r / 2 + Math.log(r + 1 / r);
}
const LUT_MIN = -5, LUT_MAX = 40, LUT_STEP = 0.02;
const LUT = (() => {
  const n = Math.round((LUT_MAX - LUT_MIN) / LUT_STEP) + 1, out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const target = logQ(LUT_MIN + k * LUT_STEP);
    let lo = 0, hi = 60;
    for (let it = 0; it < 44; it++) { const mid = (lo + hi) / 2; if (logQ3(mid) > target) lo = mid; else hi = mid; }
    out[k] = (lo + hi) / 2;
  }
  return out;
})();
export const R_SOFT = 5.6;
export function radial(D) {
  const x = (clamp(D, LUT_MIN, LUT_MAX) - LUT_MIN) / LUT_STEP, i = Math.min(LUT.length - 2, Math.floor(x)), f = x - i;
  const r = LUT[i] * (1 - f) + LUT[i + 1] * f;
  return r <= R_SOFT ? r : R_SOFT + 2.2 * Math.log1p((r - R_SOFT) / 2.2);
}
