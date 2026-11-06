// Скоринг: правила, логістична регресія і комбінована оцінка; метрики, справедливість, мережі, пояснення.
import { generate, SCHEMES, BAD_OPERATOR, DISTRICTS } from './data.js';

export { SCHEMES, DISTRICTS, BAD_OPERATOR };
export const MODELS = ['rules', 'logit', 'combo'];
export const REVIEW_COST = 650;          // грн за ручну перевірку одного випадку
export const RECOVERY = 0.6;             // частка незаконно виплаченого, яку вдається повернути або зупинити

// Ознаки моделі. f(x) повертає «сире» значення, далі стандартизація за навчальною вибіркою.
export const FEATURES = [
  { id: 'sharedIban', f: x => Math.log1p(x.sharedIban) },
  { id: 'sharedPhone', f: x => Math.log1p(x.sharedPhone) },
  { id: 'sharedAddr', f: x => Math.log1p(x.sharedAddr) },
  { id: 'collective', f: x => (x.collective ? 1 : 0) },
  { id: 'nightOnline', f: x => (x.night && x.channel === 'online' ? 1 : 0) },
  { id: 'fastDocs', f: x => (x.docMin < 8 ? 1 : 0) },
  { id: 'operator', f: x => Math.max(0, x.opZ) },
  { id: 'death', f: x => (x.deathM > 0 ? 1 : 0) },
  { id: 'income', f: x => Math.log(Math.max(1, x.taxRatio)) },
  { id: 'abroad', f: x => x.abroad / 180 },
  { id: 'dup', f: x => (x.dup ? 1 : 0) },
  { id: 'manyKids', f: x => (x.children >= 4 ? 1 : 0) },
  { id: 'amount', f: x => Math.log(x.amount) },
];

// Правила: прозорі «якщо…, то +бали»; оцінка обрізається до 1
export const RULES = [
  { id: 'death', w: 0.9, test: x => x.deathM > 0 },
  { id: 'dup', w: 0.55, test: x => x.dup },
  { id: 'sharedIban', w: 0.4, test: x => x.sharedIban >= 2 },
  { id: 'income', w: 0.4, test: x => x.taxRatio > 2 },
  { id: 'abroad', w: 0.35, test: x => x.abroad > 120 },
  { id: 'sharedAddr', w: 0.25, test: x => x.sharedAddr >= 5 },
  { id: 'sharedPhone', w: 0.2, test: x => x.sharedPhone >= 3 },
  { id: 'nightOnline', w: 0.15, test: x => x.night && x.channel === 'online' },
  { id: 'operator', w: 0.2, test: x => x.operator === BAD_OPERATOR },
];
const ruleScore = x => Math.min(1, RULES.reduce((a, rl) => a + (rl.test(x) ? rl.w : 0), 0));

const sigmoid = z => 1 / (1 + Math.exp(-z));

// Логістична регресія з L2, градієнтний спуск на навчальній вибірці
function train(rows) {
  const tr = rows.filter(x => !x.test);
  const raw = tr.map(x => FEATURES.map(ft => ft.f(x)));
  const mu = FEATURES.map((_, j) => raw.reduce((a, v) => a + v[j], 0) / raw.length);
  const sd = FEATURES.map((_, j) => Math.sqrt(raw.reduce((a, v) => a + (v[j] - mu[j]) ** 2, 0) / raw.length) || 1);
  const X = raw.map(v => v.map((a, j) => (a - mu[j]) / sd[j]));
  const y = tr.map(x => (x.fraud ? 1 : 0));
  const w = new Array(FEATURES.length).fill(0);
  let b = Math.log(y.reduce((a, v) => a + v, 0) / (y.length - y.reduce((a, v) => a + v, 0)));
  const lr = 0.5, lambda = 0.002, n = X.length;
  for (let it = 0; it < 450; it++) {
    const g = new Array(w.length).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      let z = b;
      for (let j = 0; j < w.length; j++) z += w[j] * xi[j];
      const e = sigmoid(z) - y[i];
      gb += e;
      for (let j = 0; j < w.length; j++) g[j] += e * xi[j];
    }
    b -= (lr * gb) / n;
    for (let j = 0; j < w.length; j++) w[j] -= lr * (g[j] / n + lambda * w[j]);
  }
  return { w, b, mu, sd };
}

export function build() {
  const { rows, rings } = generate();
  const M = train(rows);
  rows.forEach(x => {
    x.z = FEATURES.map((ft, j) => (ft.f(x) - M.mu[j]) / M.sd[j]);
    x.contrib = x.z.map((v, j) => v * M.w[j]);
    x.score = { rules: ruleScore(x), logit: sigmoid(M.b + x.contrib.reduce((a, v) => a + v, 0)) };
    x.score.combo = 0.4 * x.score.rules + 0.6 * x.score.logit;
    x.rulesHit = RULES.filter(rl => rl.test(x)).map(rl => rl.id);
  });
  const clusters = findClusters(rows);
  const test = rows.filter(x => x.test);
  return { rows, rings, test, M, clusters, byId: new Map(rows.map(x => [x.id, x])) };
}

// ——— метрики на перевірочній вибірці ———
export function confusion(rows, model, th) {
  let tp = 0, fp = 0, fn = 0, tn = 0, caught = 0, missed = 0;
  for (const x of rows) {
    const flag = x.score[model] >= th;
    if (flag && x.fraud) { tp++; caught += x.paid; } else if (flag) fp++; else if (x.fraud) { fn++; missed += x.paid; } else tn++;
  }
  const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
  const flagged = tp + fp;
  const benefit = caught * RECOVERY - flagged * REVIEW_COST;
  return { tp, fp, fn, tn, precision, recall, f1: (2 * precision * recall) / (precision + recall || 1), flagged, share: flagged / rows.length, caught, missed, benefit, fpr: fp / (fp + tn || 1) };
}

export function roc(rows, model) {
  const s = [...rows].sort((a, b) => b.score[model] - a.score[model]);
  const P = s.filter(x => x.fraud).length, Nn = s.length - P;
  let tp = 0, fp = 0, auc = 0, prevFpr = 0, prevTpr = 0;
  const pts = [{ fpr: 0, tpr: 0, precision: 1 }];
  s.forEach((x, i) => {
    if (x.fraud) tp++; else fp++;
    if (i === s.length - 1 || s[i + 1].score[model] !== x.score[model]) {
      const fpr = fp / Nn, tpr = tp / P;
      auc += (fpr - prevFpr) * (tpr + prevTpr) / 2;
      prevFpr = fpr; prevTpr = tpr;
      pts.push({ fpr, tpr, precision: tp / (tp + fp), th: x.score[model] });
    }
  });
  return { pts, auc };
}

// Скільки шахрайства у верхніх k% за оцінкою
export function lift(rows, model, shares = [0.01, 0.02, 0.05, 0.1, 0.2]) {
  const s = [...rows].sort((a, b) => b.score[model] - a.score[model]);
  const P = s.filter(x => x.fraud).length;
  return shares.map(k => { const top = s.slice(0, Math.round(s.length * k)); return { k, captured: top.filter(x => x.fraud).length / P }; });
}

export function histogram(rows, model, bins = 20) {
  const h = Array.from({ length: bins }, (_, i) => ({ from: i / bins, fraud: 0, ok: 0 }));
  rows.forEach(x => { const b = Math.min(bins - 1, Math.floor(x.score[model] * bins)); h[b][x.fraud ? 'fraud' : 'ok']++; });
  return h;
}

// Поріг, за якого перевіряємо приблизно стільки випадків, скільки витримує команда
export const thresholdFor = (rows, model, share) => { const s = rows.map(x => x.score[model]).sort((a, b) => b - a); return s[Math.max(0, Math.round(s.length * share) - 1)]; };

// ——— справедливість: частка позначених і помилкових позначень за групами ———
export const GROUPS = [
  { id: 'idp', test: x => x.idp }, { id: 'nonIdp', test: x => !x.idp },
  { id: 'collective', test: x => x.collective },
  { id: 'old', test: x => x.age >= 65 }, { id: 'young', test: x => x.age < 35 },
  { id: 'online', test: x => x.channel === 'online' }, { id: 'cnap', test: x => x.channel === 'cnap' },
  { id: 'manyKids', test: x => x.children >= 4 },
];
export function fairness(rows, model, th) {
  return GROUPS.map(g => {
    const xs = rows.filter(g.test), c = confusion(xs, model, th);
    return { id: g.id, n: xs.length, flagged: c.share, fraud: xs.filter(x => x.fraud).length / (xs.length || 1), fpr: c.fpr, precision: c.precision };
  });
}

// ——— мережі: зв'язки через спільний рахунок або телефон ———
function findClusters(rows) {
  const parent = new Map(rows.map(x => [x.id, x.id]));
  const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const key of ['iban', 'phone']) {
    const first = new Map();
    rows.forEach(x => { if (first.has(x[key])) union(x.id, first.get(x[key])); else first.set(x[key], x.id); });
  }
  const groups = new Map();
  rows.forEach(x => { const k = find(x.id); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
  return [...groups.values()].filter(g => g.length >= 3).map((g, i) => {
    const ops = new Map(); g.forEach(x => ops.set(x.operator, (ops.get(x.operator) || 0) + 1));
    const topOp = [...ops].sort((a, b) => b[1] - a[1])[0];
    return {
      id: 'C' + (i + 1), members: g, size: g.length, paid: g.reduce((a, x) => a + x.paid, 0), fraud: g.filter(x => x.fraud).length / g.length,
      ibans: new Set(g.map(x => x.iban)).size, phones: new Set(g.map(x => x.phone)).size, online: g.filter(x => x.channel === 'online').length / g.length,
      night: g.filter(x => x.night).length / g.length, operator: topOp[0], opShare: topOp[1] / g.length, collective: g.some(x => x.collective),
      score: g.reduce((a, x) => a + x.score.combo, 0) / g.length, district: g[0].district,
    };
  }).sort((a, b) => b.score - a.score);
}

// Головні причини оцінки: внески ознак логістичної регресії й спрацьовані правила
export function reasons(x, n = 3) {
  return x.contrib.map((v, j) => ({ id: FEATURES[j].id, v })).filter(c => c.v > 0.15).sort((a, b) => b.v - a.v).slice(0, n);
}

// Підсумок за схемами для огляду: скільки в черзі і скільки грошей
export function schemeSummary(rows, model, th) {
  return SCHEMES.map(s => {
    const xs = rows.filter(x => x.scheme === s);
    const caught = xs.filter(x => x.score[model] >= th);
    return { id: s, n: xs.length, caught: caught.length, paid: xs.reduce((a, x) => a + x.paid, 0), caughtPaid: caught.reduce((a, x) => a + x.paid, 0) };
  });
}
