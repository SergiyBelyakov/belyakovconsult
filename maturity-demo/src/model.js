// Модель оцінки зрілості даних. Вісім вимірів по чотири питання, відповіді від 1 до 5 або «не знаю» (0).
// Рівень виміру: середнє відомих відповідей. Загальний рівень: середнє восьми вимірів, пороги 1,8 / 2,6 / 3,4 / 4,2.
// Ціль залежить від типу організації й обраної амбіції. Усе рахується в браузері, нічого не надсилається.

export const DIMS = ['strategy', 'governance', 'quality', 'architecture', 'master', 'analytics', 'culture', 'security'];
export const NQ = 4;
export const NALL = DIMS.length * NQ;
export const FOUNDATION = ['governance', 'quality', 'master', 'architecture'];
export const ORGS = ['community', 'public', 'business', 'ngo', 'other'];
export const SIZES = ['s', 'm', 'l'];
export const AMBITIONS = ['base', 'rec', 'high'];
export const THRESH = [1.8, 2.6, 3.4, 4.2];
export const HORIZONS = [30, 90, 180];

// Рекомендований цільовий профіль за типом організації (на 12 або 18 місяців).
export const TARGETS = {
  community: { strategy: 3, governance: 3, quality: 3, architecture: 3, master: 4, analytics: 3, culture: 3, security: 4 },
  public: { strategy: 3, governance: 4, quality: 4, architecture: 3, master: 4, analytics: 3, culture: 3, security: 4 },
  business: { strategy: 4, governance: 3, quality: 4, architecture: 4, master: 3, analytics: 4, culture: 4, security: 3 },
  ngo: { strategy: 3, governance: 3, quality: 4, architecture: 3, master: 3, analytics: 3, culture: 3, security: 4 },
  other: { strategy: 3, governance: 3, quality: 3, architecture: 3, master: 3, analytics: 3, culture: 3, security: 3 },
};
const SHIFT = { base: -1, rec: 0, high: 1 };

// Що з сайту допоможе з кожним виміром: сторінка послуги і демо Лабораторії даних.
export const RELATED = {
  strategy: { service: 'data-strategy', demo: 'executive-dashboard' },
  governance: { service: 'data-governance', demo: 'data-quality-dashboard' },
  quality: { service: 'data-quality', demo: 'data-quality-dashboard' },
  architecture: { service: 'data-architecture', demo: 'data-journey' },
  master: { service: 'data-governance', demo: 'graph-analytics', game: 'vacuum-graph' },
  analytics: { service: 'business-intelligence', demo: 'executive-dashboard' },
  culture: { service: 'data-strategy', demo: 'chart-gallery' },
  security: { service: 'data-governance' },
};

// Приклади на умовних відповідях: щоб побачити результат, не відповідаючи на всі питання.
export const SAMPLES = {
  community: { org: 'community', size: 'm', amb: 'rec', a: '22122212221222211211222322332102' },
  business: { org: 'business', size: 'l', amb: 'rec', a: '33242223222333332212434333323333' },
  ngo: { org: 'ngo', size: 'm', amb: 'rec', a: '32233323323322202212222323332122' },
};

export const qIndex = (d, k) => DIMS.indexOf(d) * NQ + k;
export const emptyAnswers = () => Array(NALL).fill(null);
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const levelOf = v => (v == null ? null : 1 + THRESH.filter(t => v >= t - 1e-9).length);
export const indexOf = v => (v == null ? null : Math.round(((v - 1) / 4) * 100));

export function targetOf(org, amb) {
  const t = TARGETS[org] || TARGETS.other;
  const s = SHIFT[amb] ?? 0;
  return Object.fromEntries(DIMS.map(d => [d, clamp(t[d] + s, 2, 5)]));
}

export const answeredCount = a => a.filter(v => v != null).length;
export const isComplete = a => a.length === NALL && a.every(v => v != null);
export const firstOpen = a => a.findIndex(v => v == null);

// Оцінка: виміри, загальний рівень, індекс. Працює і з неповними відповідями (тоді частина вимірів без значення).
export function score(a, org, amb) {
  const target = targetOf(org, amb);
  const dims = {};
  DIMS.forEach((d, i) => {
    const vals = a.slice(i * NQ, i * NQ + NQ);
    const known = vals.filter(v => v >= 1);
    const unknown = vals.filter(v => v === 0).length;
    const answered = vals.filter(v => v != null).length;
    const allUnknown = answered === NQ && !known.length;
    // Якщо про вимір нічого не відомо, вважаємо його рівнем 1: зазвичай у теми просто немає власника.
    const avg = known.length ? mean(known) : allUnknown ? 1 : null;
    dims[d] = { id: d, vals, avg, known: known.length, unknown, answered, allUnknown, level: levelOf(avg), target: target[d], gap: avg == null ? null : Math.max(0, target[d] - avg) };
  });
  const scored = DIMS.filter(d => dims[d].avg != null);
  const avg = scored.length ? mean(scored.map(d => dims[d].avg)) : null;
  const tAvg = mean(DIMS.map(d => target[d]));
  return {
    dims, target, avg, level: levelOf(avg), index: indexOf(avg), tAvg, tLevel: levelOf(tAvg),
    unknown: a.filter(v => v === 0).length, answered: answeredCount(a), complete: isComplete(a),
    foundation: mean(FOUNDATION.map(d => dims[d].avg ?? 1)),
  };
}

// Пріоритети: розрив до цілі; основа (управління, якість, довідники, архітектура) важить більше,
// бо без неї аналітика не тримається. Плюс бонуси за «аналітика випереджає основу» і ризик безпеки.
export function priorities(S) {
  const bottleneck = S.dims.analytics.avg - S.foundation >= 1;
  const list = DIMS.map(d => {
    const x = S.dims[d];
    const found = FOUNDATION.includes(d);
    const why = [];
    let p = x.gap * (found ? 1.25 : 1);
    if (x.gap > 0) why.push('gap');
    if (found && x.gap > 0) why.push('foundation');
    if (bottleneck && found && x.gap > 0) { p += 0.5; why.push('bottleneck'); }
    if (d === 'security' && x.avg < 2) { p += 0.75; why.push('risk'); }
    if (x.allUnknown) { p += 0.5; why.push('unknown'); }
    return { id: d, p, why, from: x.level, to: Math.min(5, x.level + 1), gap: x.gap };
  }).filter(x => x.p > 0.05 && x.from < 5)
    .sort((a, b) => b.p - a.p || S.dims[a.id].avg - S.dims[b.id].avg);
  const top = list.slice(0, 3);
  // Ціль уже досягнута: пропонуємо рости там, де рівень найнижчий.
  if (top.length < 3) {
    DIMS.filter(d => !top.some(t => t.id === d) && S.dims[d].level < 5)
      .sort((a, b) => S.dims[a].avg - S.dims[b].avg)
      .slice(0, 3 - top.length)
      .forEach(d => top.push({ id: d, p: 0, why: ['grow'], from: S.dims[d].level, to: S.dims[d].level + 1, gap: 0 }));
  }
  return top;
}

// Дорожня карта: кожен пріоритет дає по кроку в кожен горизонт (30, 90, 180 днів).
export const roadmap = pr => HORIZONS.map((h, i) => ({ h, items: pr.map(x => ({ dim: x.id, from: x.from, i })) }));

// «Чого не робити зараз»: правила з глибиною (наскільки сильно спрацювали). Показуємо до трьох найглибших.
const RULES = [
  ['biBeforeBasics', D => (D.governance < 2.6 || D.quality < 2.6 ? Math.max(2.6 - D.governance, 2.6 - D.quality) + (D.analytics >= D.governance ? 0.3 : 0) : 0)],
  ['automateDirty', D => (D.quality < 2.6 && D.architecture >= 2 ? 2.6 - D.quality : 0)],
  ['aiBeforeData', D => (D.quality < 3 || D.master < 2.6 ? Math.max(3 - D.quality, 2.6 - D.master) - 0.2 : 0)],
  ['itOwner', D => (D.governance < 2.2 ? 2.2 - D.governance + 0.2 : 0)],
  ['warehouseFirst', D => (D.architecture < 2.6 && D.master < 2.6 ? Math.min(2.6 - D.architecture, 2.6 - D.master) + 0.1 : 0)],
  ['reportsUnused', D => (D.culture < 2.6 && D.analytics >= D.culture ? 2.6 - D.culture : 0)],
  ['accessBeforeRoles', D => (D.security < 2.6 ? 2.6 - D.security + 0.2 : 0)],
  ['projectNoGoal', D => (D.strategy < 2.6 ? 2.6 - D.strategy : 0)],
];
export function antiPatterns(S) {
  const D = Object.fromEntries(DIMS.map(d => [d, S.dims[d].avg ?? 1]));
  return RULES.map(([id, fn]) => ({ id, depth: fn(D) })).filter(x => x.depth > 0).sort((a, b) => b.depth - a.depth).slice(0, 3).map(x => x.id);
}

// Застереження до результату.
export function warnings(S, a) {
  const out = [];
  if (S.dims.analytics.avg - S.foundation >= 1) out.push('analyticsAhead');
  const roles = a[qIndex('culture', 0)];
  if (roles >= 1 && roles <= 2 && S.dims.analytics.avg >= 2.5) out.push('people');
  if (S.dims.security.avg < 2) out.push('security');
  if (S.unknown >= 6 || DIMS.some(d => S.dims[d].allUnknown)) out.push('unknown');
  return out;
}

// Сильні сторони: два виміри з найвищим рівнем відносно цілі.
export function strengths(S) {
  return DIMS.slice().sort((x, y) => (S.dims[y].avg - S.dims[y].target) - (S.dims[x].avg - S.dims[x].target) || S.dims[y].avg - S.dims[x].avg).slice(0, 2);
}

// Розрив для показу: від округленого до десятих бала, щоб підписи сходилися з ціллю.
export const gapShown = x => Math.max(0, x.target - Math.round(x.avg * 10) / 10);

// Посилання з відповідями: 32 символи (0..5, «-» без відповіді).
export const encode = a => a.map(v => (v == null ? '-' : String(v))).join('');
export function decode(s) {
  if (!s || s.length !== NALL) return null;
  const a = [...s].map(c => (c === '-' ? null : /^[0-5]$/.test(c) ? Number(c) : undefined));
  return a.includes(undefined) ? null : a;
}
