// Записи для гри: реальні типи помилок, форматів, заглушок і дублікатів. Для кожного відомо, що з ним правильно робити:
// ok пропустити до сховища, fix виправити формат, err видалити в карантин, dup об'єднати з двійником.
import { rng } from '../../anomaly-demo/src/stats.js';

const SUR = [['Іваненко', 'Ivanenko'], ['Коваленко', 'Kovalenko'], ['Шевченко', 'Shevchenko'], ['Бондаренко', 'Bondarenko'], ['Ткаченко', 'Tkachenko'], ['Кравченко', 'Kravchenko'], ['Олійник', 'Oliinyk'], ['Мельник', 'Melnyk'], ['Савченко', 'Savchenko'], ['Петренко', 'Petrenko'], ['Литвиненко', 'Lytvynenko'], ['Романенко', 'Romanenko'], ['Клименко', 'Klymenko'], ['Марченко', 'Marchenko'], ['Гончаренко', 'Honcharenko'], ['Руденко', 'Rudenko'], ['Поліщук', 'Polishchuk'], ['Лисенко', 'Lysenko'], ['Захарченко', 'Zakharchenko'], ['Кузьменко', 'Kuzmenko']];
const FIR = [['Олена', 'Olena'], ['Іван', 'Ivan'], ['Марія', 'Mariia'], ['Андрій', 'Andrii'], ['Оксана', 'Oksana'], ['Дмитро', 'Dmytro'], ['Наталія', 'Nataliia'], ['Сергій', 'Serhii'], ['Юлія', 'Yuliia'], ['Петро', 'Petro'], ['Ірина', 'Iryna'], ['Тарас', 'Taras'], ['Софія', 'Sofiia'], ['Богдан', 'Bohdan'], ['Галина', 'Halyna'], ['Максим', 'Maksym']];
const OPS = ['50', '63', '66', '67', '68', '73', '93', '95', '96', '97', '98'];
const DOM = ['gmail.com', 'ukr.net', 'i.ua', 'meta.ua'];
const NOLEAP = [1990, 1991, 1993, 1997, 2001, 1983, 1979];
const p2 = n => String(n).padStart(2, '0');

function person(R, L, used) {
  let s, f, k = 0;
  do { s = SUR[Math.floor(R() * SUR.length)]; f = FIR[Math.floor(R() * FIR.length)]; k++; } while (used.has(s[0] + f[0]) && k < 50);
  used.add(s[0] + f[0]);
  const op = OPS[Math.floor(R() * OPS.length)], num = String(Math.floor(1000000 + R() * 8999999));
  const y = 1955 + Math.floor(R() * 48), m = 1 + Math.floor(R() * 12), d = 1 + Math.floor(R() * 28);
  return {
    s: s[L], f: f[L], name: s[L] + ' ' + f[L], op, num, y, m, d,
    phone: `+380 ${op} ${num.slice(0, 3)} ${num.slice(3, 5)} ${num.slice(5)}`,
    dob: `${p2(d)}.${p2(m)}.${y}`,
    email: `${f[1].toLowerCase()}.${s[1].toLowerCase()}@${DOM[Math.floor(R() * DOM.length)]}`,
    tax: String(Math.floor(1000000000 + R() * 8999999999)),
  };
}
const FIELDS = ['phone', 'dob', 'email'];
const rec = (p, kind, issue, field, value, extra = {}) => ({ kind, issue, name: p.name, field, value, ...extra });

// Конструктори записів за типом проблеми
const MAKE = {
  ok: (p, R) => { const f = FIELDS[Math.floor(R() * 3)]; return rec(p, 'ok', 'ok', f, p[f]); },
  phoneFormat: (p, R) => {
    const v = [`0${p.op}-${p.num.slice(0, 3)}-${p.num.slice(3, 5)}-${p.num.slice(5)}`, `(0${p.op}) ${p.num.slice(0, 3)} ${p.num.slice(3, 5)} ${p.num.slice(5)}`, `80${p.op}${p.num}`, `+38(0${p.op})${p.num}`][Math.floor(R() * 4)];
    return rec(p, 'fix', 'phoneFormat', 'phone', v, { fixValue: p.phone });
  },
  dateFormat: (p, R) => {
    const d = 1 + (p.d % 9), m = 1 + (p.m % 9);   // однозначні день і місяць, щоб «5.3.1987» відрізнявся від канонічного
    const v = R() < 0.5 ? `${p.y}-${p2(m)}-${p2(d)}` : `${d}.${m}.${p.y}`;
    return rec(p, 'fix', 'dateFormat', 'dob', v, { fixValue: `${p2(d)}.${p2(m)}.${p.y}` });
  },
  nameCase: (p, R) => { const f = FIELDS[Math.floor(R() * 3)]; return rec(p, 'fix', 'nameCase', f, p[f], { name: R() < 0.5 ? p.name.toUpperCase() : p.name.toLowerCase(), fixName: p.name }); },
  emailCase: p => rec(p, 'fix', 'emailCase', 'email', p.email.replace(/^(\w)(\w*)\.(\w)/, (_, a, b, c) => a.toUpperCase() + b + '.' + c.toUpperCase()).replace(/@(\w)/, (_, a) => '@' + a.toUpperCase()), { fixValue: p.email }),
  dateImpossible: (p, R) => rec(p, 'err', 'dateImpossible', 'dob', [`31.02.${p.y}`, `30.02.${p.y}`, `31.04.${p.y}`, `31.06.${p.y}`, `31.09.${p.y}`, `31.11.${p.y}`][Math.floor(R() * 6)]),
  monthInvalid: (p, R) => rec(p, 'err', 'monthInvalid', 'dob', `${p2(p.d)}.${13 + Math.floor(R() * 3)}.${p.y}`),
  notLeap: (p, R) => rec(p, 'err', 'notLeap', 'dob', `29.02.${NOLEAP[Math.floor(R() * NOLEAP.length)]}`),
  futureDob: p => rec(p, 'err', 'futureDob', 'dob', `${p2(p.d)}.${p2(p.m)}.${2031 + (p.y % 5)}`),
  oldDob: p => rec(p, 'err', 'oldDob', 'dob', `${p2(p.d)}.${p2(p.m)}.${1880 + (p.y % 12)}`),
  emailNoAt: p => rec(p, 'err', 'emailNoAt', 'email', p.email.replace('@', '.')),
  emailNoDomain: p => rec(p, 'err', 'emailNoDomain', 'email', p.email.replace(/\.(com|net|ua)$/, '')),
  emailDoubleAt: p => rec(p, 'err', 'emailDoubleAt', 'email', p.email.replace('@', '@@')),
  phoneShort: p => rec(p, 'err', 'phoneShort', 'phone', p.phone.slice(0, -3)),
  placeholderName: (p, R, L) => { const n = L ? ['Test Testovych', 'TEST TEST', 'Xxx Xxx', 'Unknown Unknown'] : ['Тест Тестович', 'TEST TEST', 'Xxx Xxx', 'Невідомо Невідомо']; return { ...rec(p, 'err', 'placeholderName', 'phone', p.phone), name: n[Math.floor(R() * n.length)] }; },
  placeholderDate: p => rec(p, 'err', 'placeholderDate', 'dob', '01.01.1900'),
  placeholderEmail: (p, R) => rec(p, 'err', 'placeholderEmail', 'email', ['test@test.com', 'noemail@noemail.com', 'a@a.a', 'no@mail.com'][Math.floor(R() * 4)]),
  placeholderPhone: (p, R) => rec(p, 'err', 'placeholderPhone', 'phone', ['+380 00 000 00 00', '000-00-00', '+380 11 111 11 11'][Math.floor(R() * 3)]),
  placeholderId: (p, R) => rec(p, 'err', 'placeholderId', 'tax', ['0000000000', '1234567890', '1111111111', '9999999999'][Math.floor(R() * 4)]),
  placeholderNA: (p, R) => (R() < 0.5 ? rec(p, 'err', 'placeholderNA', 'email', ['N/A', 'n/a', '-', 'немає'][Math.floor(R() * 4)]) : rec(p, 'err', 'placeholderNA', 'phone', ['N/A', '-', '0'][Math.floor(R() * 3)])),
};
// Пара дублікатів: перший запис канонічний, другий варіант тієї самої людини
const DUP = {
  dupFormat: p => [rec(p, 'dup', 'dupFormat', 'phone', p.phone), rec(p, 'dup', 'dupFormat', 'phone', `0${p.op} ${p.num.slice(0, 3)} ${p.num.slice(3, 5)} ${p.num.slice(5)}`)],
  dupCase: p => [rec(p, 'dup', 'dupCase', 'email', p.email), { ...rec(p, 'dup', 'dupCase', 'email', p.email), name: p.name.toUpperCase() }],
  dupInitial: p => [rec(p, 'dup', 'dupInitial', 'phone', p.phone), { ...rec(p, 'dup', 'dupInitial', 'phone', p.phone), name: `${p.s} ${p.f[0]}.` }],
  dupOrder: p => [rec(p, 'dup', 'dupOrder', 'email', p.email), { ...rec(p, 'dup', 'dupOrder', 'email', p.email), name: `${p.f} ${p.s}` }],
  dupTypo: p => { const i = Math.max(2, Math.floor(p.s.length / 2)); return [rec(p, 'dup', 'dupTypo', 'phone', p.phone), { ...rec(p, 'dup', 'dupTypo', 'phone', p.phone), name: `${p.s.slice(0, i)}${p.s.slice(i + 1)} ${p.f}` }]; },
};

// Склад рівнів: скільки записів кожного типу
export const LEVELS = [
  { id: 1, skill: 'fix', ok: 6, fix: ['phoneFormat', 'phoneFormat', 'phoneFormat', 'dateFormat', 'dateFormat', 'nameCase', 'nameCase', 'emailCase'] },
  { id: 2, skill: 'err', ok: 6, fix: ['phoneFormat', 'dateFormat', 'nameCase'], err: ['dateImpossible', 'dateImpossible', 'monthInvalid', 'notLeap', 'futureDob', 'emailNoAt', 'emailNoDomain', 'phoneShort'] },
  { id: 3, skill: 'dup', ok: 4, namesake: 1, dup: ['dupFormat', 'dupCase', 'dupInitial', 'dupOrder', 'dupTypo'], fix: ['emailCase', 'phoneFormat'], err: ['oldDob', 'emailDoubleAt'] },
  { id: 4, skill: 'ph', ok: 6, dup: ['dupFormat'], fix: ['dateFormat', 'nameCase', 'phoneFormat'], err: ['placeholderName', 'placeholderName', 'placeholderDate', 'placeholderDate', 'placeholderEmail', 'placeholderPhone', 'placeholderId', 'placeholderNA'] },
  { id: 5, skill: 'src', ok: 6, dup: ['dupInitial', 'dupOrder'], fix: ['phoneFormat', 'dateFormat', 'nameCase', 'emailCase'], err: ['dateImpossible', 'placeholderDate', 'emailNoAt', 'placeholderId', 'notLeap'] },
];
// На п'ятому рівні джерело знову й знову надсилає ті самі проблеми, доки не з'явиться перевірка на вході
export const SOURCE_ISSUES = ['phoneFormat', 'placeholderDate', 'dateImpossible', 'phoneFormat', 'placeholderPhone'];

let uid = 0;
// Одиниці черги: одиночний запис або пара (дублікати й тезки летять разом)
export function makeLevel(n, lang, seed = 0) {
  const R = rng(9001 + n * 131 + seed * 7), L = lang === 'en' ? 1 : 0, used = new Set(), cfg = LEVELS[n - 1], units = [];
  const one = issue => { const r = MAKE[issue](person(R, L, used), R, L); r.id = ++uid; return [r]; };
  for (let k = 0; k < cfg.ok; k++) units.push(one('ok'));
  (cfg.fix || []).forEach(i => units.push(one(i)));
  (cfg.err || []).forEach(i => units.push(one(i)));
  (cfg.dup || []).forEach(i => { const [a, b] = DUP[i](person(R, L, used)); a.id = ++uid; b.id = ++uid; a.pair = b.id; b.pair = a.id; a.canon = true; units.push(R() < 0.5 ? [a, b] : [b, a]); });
  for (let k = 0; k < (cfg.namesake || 0); k++) {
    const p = person(R, L, used), q = { ...person(R, L, used), s: p.s, f: p.f, name: p.name };
    const a = rec(p, 'ok', 'namesake', 'dob', p.dob), b = rec(q, 'ok', 'namesake', 'dob', q.dob);
    a.id = ++uid; b.id = ++uid; a.twin = b.id; b.twin = a.id;
    units.push([a, b]);
  }
  for (let i = units.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [units[i], units[j]] = [units[j], units[i]]; }
  return units;
}
export function sourceRecord(k, lang) {
  const R = rng(777 + k * 17), L = lang === 'en' ? 1 : 0;
  const r = MAKE[SOURCE_ISSUES[k % SOURCE_ISSUES.length]](person(R, L, new Set()), R, L);
  r.id = ++uid; r.source = true;
  return r;
}
// Правильна дія для запису
export const correct = r => (r.kind === 'ok' ? 'keep' : r.kind === 'fix' ? 'fix' : r.kind === 'err' ? 'del' : 'merge');
