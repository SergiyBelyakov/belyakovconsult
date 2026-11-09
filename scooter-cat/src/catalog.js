// Перелік рівнів, героїв і груп рейтингу: спільний для гри в браузері й для функції рейтингу на Cloudflare
// (тут лише дані й прості перевірки, без фізики й малювання, щоб функція не тягнула за собою всю гру).

// Рівні йдуть від легких до складних: чотири легкі траси, чотири середні, чотири складні,
// а після них чотири траси «Адіще» з правилами ігор 90-х (без контрольних точок і поблажок)
export const MAIN_IDS = ['trend', 'hist', 'season', 'pareto', 'outliers', 'axis', 'stacked', 'waterfall', 'log', 'control', 'multiples', 'forecast'];
export const HELL_IDS = ['candles', 'gantt', 'tunnel', 'saw'];
export const LEVEL_IDS = [...MAIN_IDS, ...HELL_IDS];
export const DIFF = { trend: 1, hist: 1, season: 1, pareto: 1, outliers: 2, axis: 2, stacked: 2, waterfall: 2, log: 3, control: 3, multiples: 3, forecast: 3, candles: 4, gantt: 4, tunnel: 4, saw: 4 };
export const CHAR_IDS = ['cat', 'capy', 'head'];

// Групи рейтингу: кожна група складності окремо, «Адіще» окремо і всі 12 основних рівнів разом
export const SCOPE_IDS = ['d1', 'd2', 'd3', 'd4', 'all'];
export const SCOPES = {
  d1: LEVEL_IDS.filter(id => DIFF[id] === 1),
  d2: LEVEL_IDS.filter(id => DIFF[id] === 2),
  d3: LEVEL_IDS.filter(id => DIFF[id] === 3),
  d4: HELL_IDS,
  all: MAIN_IDS,
};
export const scopesOf = id => SCOPE_IDS.filter(sc => SCOPES[sc].includes(id));

// Найкоротший правдоподібний час рівня, с: 75% часу автопілота на граничній швидкості (котик, 13,5 м/с),
// а в Адіщі близько 65% найшвидшого проходу без падіння (на граничній швидкості там розбиваються).
// Швидший результат у рейтинг не приймається: так виглядає підправлений у консолі час, а не заїзд.
export const FLOOR = { trend: 18, hist: 11, season: 16, pareto: 10, outliers: 16, axis: 12, stacked: 13, waterfall: 9, log: 20, control: 12, multiples: 14, forecast: 19, candles: 12, gantt: 9, tunnel: 11, saw: 14 };
export const CEIL = 3600;

// Адіще: ліміт часу траси, с (не встиг, і траса спочатку)
export const LIMIT = { candles: 33, gantt: 25, tunnel: 25, saw: 31 };

// Нік: від 2 до 20 символів, літери будь-якої абетки, цифри, пробіл і _ - . ' ; без посилань і лайки
// (корені підібрано так, щоб не чіпати звичайні слова: «команда», «Себастьян», «педикюр», «сукупність»)
const ROOTS = ['хуй', 'хує', 'хуе', 'хуї', 'хуя', 'пизд', 'пізд', 'ебан', 'ебат', 'ебал', 'ебло', 'еблан', 'ёбан', 'їбан', 'їбат', 'їбал', 'єбан', 'єбат', 'єбал',
  'бля', 'сука', 'суки', 'мудак', 'мудил', 'підор', 'пидор', 'підар', 'пидар', 'залуп', 'шлюх', 'гандон', 'дроч',
  'fuck', 'shit', 'cunt', 'pussy', 'nigg', 'fagg', 'whore', 'bitch', 'porn', 'hitler'];
const LOOK = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', i: 'і', '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а' };
export function cleanNick(raw) {
  const s = String(raw == null ? '' : raw).normalize('NFC').replace(/\s+/g, ' ').trim();
  if ([...s].length < 2 || [...s].length > 20) return { ok: false, why: 'length' };
  if (!/^[\p{L}\p{N} _.'’-]+$/u.test(s)) return { ok: false, why: 'chars' };
  const low = s.toLowerCase();
  if (/(https?|www|\.(com|net|org|ua|ru|io|me|xyz|top|site|shop)\b|t\.me|@)/.test(low)) return { ok: false, why: 'link' };
  const flat = low.replace(/[\s_.'’-]+/g, '');
  const cyr = [...flat].map(ch => LOOK[ch] || ch).join('');
  const lat = flat.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a');
  if (ROOTS.some(r => flat.includes(r) || cyr.includes(r) || lat.includes(r))) return { ok: false, why: 'word' };
  return { ok: true, nick: s };
}
