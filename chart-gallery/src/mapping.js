// Профіль колонок файлу і автоматичний вибір колонок під ролі графіка:
// спершу точний збіг із заголовками зразка, далі ключові слова, далі тип даних.
import { toNum, toDay } from './prep.js';
import { HEAD } from './samples.js';

export function profileTable(head, rows) {
  return head.map((name, k) => {
    const vals = rows.map(r => r[k]).filter(v => v !== '' && v != null);
    const step = Math.max(1, Math.ceil(vals.length / 3000)), sample = vals.filter((_, i) => i % step === 0);
    const nNum = sample.filter(v => Number.isFinite(toNum(v))).length, nDate = sample.filter(v => Number.isFinite(toDay(v))).length;
    const type = sample.length && nDate / sample.length > 0.9 ? 'date' : sample.length && nNum / sample.length > 0.9 ? 'num' : 'text';
    const distinct = new Set(vals.map(String)).size;
    // числа, схожі на роки (2022, 2023…), можуть бути категоріями
    const yearLike = type === 'num' && sample.every(v => { const n = toNum(v); return Number.isInteger(n) && n >= 1900 && n <= 2100; });
    return { k, name: String(name), type, distinct, filled: vals.length, yearLike, idLike: /(^|[\s_])(id|код|code|№|no)([\s_]|$)/i.test(String(name)) };
  });
}

const KW = {
  cat: /категор|назв|category|name|програм|program|стат|item|тип|type|груп|group|послуг|service|джерел|source|показник|metric|вік|age|ціль|goal|рік|year|квартал|quarter/i,
  value: /знач|value|сум|amount|кільк|count|number|total|обсяг|volume|видат|spend|дохід|income|revenue|звернен|request|відвід|visit|бал|score|%|відсот|percent|частк|share|учасник|participant/i,
  series: /сері|series|канал|channel|громад|community|організац|organi[sz]ation|стат|item|груп|group/i,
  date: /дат|date|день|day|місяц|month|тиждень|week|період|period/i,
  before: /(^|\s)до(\s|,|$)|before|було|baseline/i, after: /після|after|стало|зараз|now/i,
  actual: /факт|actual|виконан|done/i, target: /план|target|goal|plan/i,
  task: /завдан|task|робот|activity|захід/i, start: /почат|start|begin/i, end: /кінец|кінц|end|finish|due|дедлайн/i,
  group: /груп|group|етап|phase|stage|тип|type|напрям|area|категор|category|галуз|sector/i,
  step: /стат|item|step|крок|показник/i, stage: /етап|stage|step|крок/i,
  question: /питан|question|тверджен|statement/i, answer: /відповід|answer|response|оцінк|rating/i, count: /кільк|count|number|^n$/i,
  size: /розмір|size|отримувач|beneficiar|населен|population|охоплен|reach/i, label: /назв|name|громад|community|проєкт|project|label|підпис/i,
  row: /рядок|row|день|day/i, col: /стовп|column|годин|hour/i,
  from: /звідки|джерел|source|from|учасник 1|partner 1|^від/i, to: /куди|ціль|target|^to$|учасник 2|partner 2|^до$/i,
  weight: /ваг|weight|кільк|count|спільн|joint|сум|value/i, region: /регіон|област|region|oblast/i, axis: /вимір|axis|dimension|критер|criteri/i,
  period: /рік|year|період|period|квартал|quarter|місяц|month|тиждень|week|дат|date/i,
  item: /громад|community|учасник|participant|назв|name|об.?єкт|object|item|програм|program|регіон|region|організац|organi[sz]ation|заклад|school|школ/i,
  facet: /громад|community|панел|panel|facet|регіон|region|округ|district|канал|channel|груп|group|категор|category|сері|series/i,
};
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const fits = (role, c) => (role.kind === 'num' ? c.type === 'num' : role.kind === 'date' ? c.type === 'date' : true);

export function autoMap(type, cols) {
  const used = new Set(), map = {};
  const heads = [HEAD[type.id]?.uk || [], HEAD[type.id]?.en || []];
  const take = (role, c) => { map[role.id] = c.k; used.add(c.k); };
  type.roles.forEach((role, i) => { const c = cols.find(c => !used.has(c.k) && fits(role, c) && heads.some(h => h[i] && norm(h[i]) === norm(c.name))); if (c) take(role, c); });
  type.roles.forEach(role => { if (map[role.id] != null || !KW[role.id]) return; const c = cols.find(c => !used.has(c.k) && fits(role, c) && KW[role.id].test(c.name) && (role.kind !== 'text' || c.type !== 'num' || c.yearLike)); if (c) take(role, c); });
  const order = [...type.roles].sort((a, b) => (a.kind === 'text') - (b.kind === 'text'));
  order.forEach(role => {
    if (map[role.id] != null || role.opt) return;
    const cands = cols.filter(c => !used.has(c.k) && fits(role, c));
    let c;
    // текстові ролі без підказки в назві беруть лише текст або роки: числа як назви вузлів чи рядків не мають сенсу
    if (role.kind === 'text') c = cands.find(c => c.type === 'text' && c.distinct >= 2) || cands.find(c => c.type === 'text') || cands.find(c => c.yearLike);
    else if (role.kind === 'num') c = cands.find(c => !c.idLike && c.distinct > 1) || cands[0];
    else c = cands[0];
    if (c) take(role, c);
  });
  type.roles.forEach(role => {
    if (map[role.id] != null || !role.opt) return;
    if ((role.id === 'series' || role.id === 'group') && role.kind === 'text') { const c = cols.find(c => !used.has(c.k) && c.type === 'text' && c.distinct >= 2 && c.distinct <= 12); if (c) take(role, c); }
    if (role.id === 'label') { const c = cols.find(c => !used.has(c.k) && c.type === 'text' && c.distinct > 12); if (c) take(role, c); }
  });
  type.roles.forEach(role => { if (map[role.id] == null) map[role.id] = -1; });
  return map;
}
export const complete = (type, map) => type.roles.every(r => r.opt || map[r.id] >= 0);
export const missing = (type, map) => type.roles.filter(r => !r.opt && !(map[r.id] >= 0));
