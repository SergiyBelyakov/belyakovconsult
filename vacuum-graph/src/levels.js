// Рівні гри «Пилосос і граф». Лабіринт це граф: вузли стоять на сітці 7×4 (колонка, рядок) з невеликим зсувом,
// коридори це справжні зв’язки з підставою, хибні зв’язки через заглушки і службові проходи без даних.
// Слоти: місця, куди баги або джерело підкидають нове сміття (тестовий запис чи дублікат).
// Усі люди, компанії, адреси й номери вигадані.
import { hash } from './graph.js';

// Положення вузла на сітці з невеликим стабільним зсувом, щоб граф виглядав живим, а не як плата
export function place(lv, n) {
  if (n.j) return [n.at[0] + n.j[0], n.at[1] + n.j[1]];
  const h = hash(lv.id + ':' + n.id);
  return [n.at[0] + ((h & 255) / 255 - 0.5) * 0.26, n.at[1] + (((h >>> 8) & 255) / 255 - 0.5) * 0.22];
}

const P = (id, c, r, uk, en, dob, o = {}) => ({ id, k: 'p', at: [c, r], n: [uk, en], a: [dob, dob], ...o });
const H = (id, c, r, code, ua, ea, o = {}) => ({ id, k: 'h', at: [c, r], n: [`Домогосп. ${code}`, `Household ${code}`], a: [ua, ea], code, ...o });
const CO = (id, c, r, uk, en, code, o = {}) => ({ id, k: 'c', at: [c, r], n: [uk, en], a: [code, code], ...o });
const I = (id, c, r, uk, en, pu, pe, o = {}) => ({ id, k: 'i', at: [c, r], n: [uk, en], a: [pu, pe], ...o });
const J = (id, c, r, uk, en, dob, created) => ({ id, k: 'p', at: [c, r], n: [uk, en], a: [dob, dob], role: 'junk', created });
const SW = (id, c, r, o = {}) => ({ id, k: 'p', at: [c, r], n: ['Ковальчук Надія', 'Kovalchuk Nadiia'], a: ['соцпрацівниця', 'social worker'], x: ['працює в центрі соцслужб', 'works at the social services centre'], ...o });
const MID = (id, c, r, o = {}) => ({ id, k: 'p', at: [c, r], n: ['Гнатюк С.', 'Hnatiuk S.'], a: ['1 телефон', '1 phone'], x: ['посередник: лише телефон +380 93 118 40 27, контакт благодійного фонду', 'intermediary: only a phone, +380 93 118 40 27, charity fund contact'], bridge: true, thin: true, ...o });

// зв’язок: [a, b, тип підстави, значення, прапорці]
const L = (a, b, t, v, o = {}) => ({ a, b, t, v, ...o });
const F = (a, b, t) => ({ a, b, t, fake: true });

export const PLACEHOLDERS = ['ph0', 'addr0', 'mail0', 'tax0'];

export const LEVELS = [
  // 1. Сироти: тестові записи без зв’язків і один новий запис, який ще не встигли пов’язати
  {
    id: 1, time: 120, par: 75, start: 'i1', scanner: false,
    bugs: [{ home: 'j3', ai: 'patrol', delay: 3 }],
    speed: [0.5, 0.38],
    spawn: { kind: 'orphan', max: [2, 1], every: [13, 20] },
    patrol: ['j1', 'j3', 'j5', 'p4'],
    nodes: [
      J('j1', 0, 0, 'ТЕСТ ТЕСТ', 'TEST TEST', '01.01.1900', '03.02.2021'),
      P('p6', 1, 0, 'Шевчук Оксана', 'Shevchuk Oksana', '18.04.1979', { x: ['донька Мельника П., інша громада', 'daughter of Melnyk P., another community'] }),
      J('j2', 3, 0, 'xxx', 'xxx', '11.11.1911', '17.06.2022'),
      P('p9', 4, 0, 'Савчук Марія', 'Savchuk Mariia', '23.10.1996'),
      J('j3', 6, 0, 'Клієнт 1', 'Client 1', '01.01.1900', '09.09.2019'),
      SW('sw', 0, 1),
      P('p5', 1, 1, 'Мельник Петро', 'Melnyk Petro', '21.09.1941', { x: ['отримує догляд вдома', 'gets home care'] }),
      H('h3', 2, 1, 'H-527', 'вул. Миру 2', '2 Myru St'),
      P('p10', 3, 1, 'Мельник Ганна', 'Melnyk Hanna', '11.12.1944'),
      I('i2', 4, 1, 'Амбулаторія №2', 'Clinic No. 2', 'с. Липівка', 'Lypivka'),
      P('p1', 5, 1, 'Петренко Олена', 'Petrenko Olena', '12.03.1958'),
      I('i1', 0, 2, 'Центр соцслужб', 'Social services', 'Липівка', 'Lypivka'),
      P('p8', 1, 2, 'Гончар Андрій', 'Honchar Andrii', '09.06.1972'),
      CO('c1', 2, 2, 'ТОВ «Липівська пекарня»', 'Lypivka Bakery LLC', '40231175', { x: ['с. Липівка, 6 працівників', 'Lypivka, 6 employees'] }),
      P('p7', 3, 2, 'Ткаченко Ігор', 'Tkachenko Ihor', '02.01.1990'),
      P('p2', 4, 2, 'Петренко Василь', 'Petrenko Vasyl', '30.07.1955'),
      H('h1', 5, 2, 'H-412', 'вул. Шкільна 4', '4 Shkilna St'),
      P('n1', 6, 2, 'Кравчук Ганна', 'Kravchuk Hanna', '04.06.1989', { role: 'new', created: '12.11.2026', x: ['сім’ю ще не внесли', 'family not entered yet'] }),
      P('p4', 0, 3, 'Бондар Максим', 'Bondar Maksym', '14.02.2012'),
      H('h2', 1, 3, 'H-318', 'вул. Садова 11', '11 Sadova St'),
      P('p3', 2, 3, 'Бондар Ірина', 'Bondar Iryna', '05.11.1987'),
      J('j4', 3, 3, '(без імені)', '(no name)', '01.01.1900', '22.04.2020'),
      J('j5', 5, 3, 'Тест Тестович', 'Test Testovych', '12.12.2012', '01.03.2023'),
    ],
    links: [
      L('p6', 'p5', 'fam', 'daughter'), L('sw', 'p5', 'care'), L('p5', 'h3', 'hh', 'H-527'), L('p5', 'p8', 'support'),
      L('sw', 'i1', 'work'), L('i1', 'h2', 'case'), L('h2', 'p4', 'hh', 'H-318'), L('h2', 'p3', 'hh', 'H-318'),
      L('p8', 'c1', 'emp'), L('c1', 'p3', 'emp'), L('c1', 'p7', 'emp'), L('h3', 'p10', 'hh', 'H-527'),
      L('p10', 'i2', 'clinic'), L('i2', 'p9', 'clinic'), L('i2', 'p1', 'clinic'), L('i2', 'p2', 'clinic'),
      L('p1', 'h1', 'hh', 'H-412'), L('p2', 'h1', 'hh', 'H-412'),
    ],
    ducts: [['j1', 'sw'], ['j1', 'p6'], ['j2', 'p10'], ['j2', 'p9'], ['p9', 'j3'], ['j3', 'p1'], ['j3', 'n1'], ['n1', 'h1'],
      ['j4', 'p3'], ['j4', 'p7'], ['j5', 'h1'], ['j5', 'p2'], ['p8', 'h2'], ['h3', 'c1'], ['p7', 'p2'], ['i1', 'p8'], ['i1', 'p4'], ['p10', 'p7']],
    slots: [{ id: 's1', at: [2, 0], to: ['p6', 'h3', 'j2'] }, { id: 's2', at: [4, 3], to: ['j4', 'j5', 'p2'] }],
  },

  // 2. Дублікати й тезки: зливати в еталон ★, тезок з іншим ключем не чіпати
  {
    id: 2, time: 150, par: 95, start: 'i1', scanner: false,
    bugs: [{ home: 'C1', ai: 'chase', delay: 4 }, { home: 'j1', ai: 'patrol', delay: 8 }],
    speed: [0.58, 0.42],
    spawn: { kind: 'dup', max: [2, 1], every: [14, 21] },
    patrol: ['j1', 'BN', 'C1', 'p5'],
    nodes: [
      J('j1', 0, 0, 'Клієнт 2', 'Client 2', '01.01.1900', '15.05.2020'),
      CO('A2', 2, 0, 'SONYACHNYI LAN LLC', 'SONYACHNYI LAN', '34127745', { role: 'dup', of: 'A0', x: ['з англомовного договору, без адреси', 'from an English contract, no address'] }),
      I('i2', 3, 0, 'Школа №3', 'School No. 3', 'м. Умань', 'Uman'),
      P('BN', 4, 0, 'Петренко Олена', 'Petrenko Olena', '27.08.1990', { role: 'twin', twin: 'B0', x: ['вчителька школи №3', 'teacher at school No. 3'] }),
      P('p1', 2, 1, 'Ткачук Роман', 'Tkachuk Roman', '15.08.1983', { x: ['бухгалтер ТОВ «Сонячний Лан»', 'accountant of Soniachnyi Lan LLC'] }),
      I('i0', 3, 1, 'Райадміністрація', 'District admin', 'м. Умань', 'Uman'),
      CO('AN', 4, 1, 'ТОВ «Сонячний Лан»', 'Soniachnyi Lan LLC', '38554120', { role: 'twin', twin: 'A0', x: ['м. Чернігів, інша юрособа', 'Chernihiv, another legal entity'] }),
      P('p2', 5, 1, 'Лисенко Ірина', 'Lysenko Iryna', '02.02.1975', { x: ['директорка ТОВ з Чернігова', 'director of the Chernihiv company'] }),
      H('h1', 0, 2, 'H-207', 'вул. Садова 5', '5 Sadova St'),
      P('B0', 1, 2, 'Петренко Олена', 'Petrenko Olena', '12.03.1958', { x: ['тел. +380 67 412 33 08, директорка', 'tel. +380 67 412 33 08, director'] }),
      CO('A0', 2, 2, 'ТОВ «Сонячний Лан»', 'Soniachnyi Lan LLC', '34127745', { x: ['м. Умань, вул. Садова 5, тел. +380 47 442 18 30', 'Uman, 5 Sadova St, tel. +380 47 442 18 30'] }),
      I('i1', 3, 2, 'Лікарня №1', 'Hospital No. 1', 'м. Умань', 'Uman'),
      CO('D0', 4, 2, 'ТОВ «Агросвіт»', 'Ahrosvit LLC', '41893302', { x: ['с. Родниківка, постачає продукти', 'Rodnykivka, food supplier'] }),
      P('C0', 5, 2, 'Коваленко Іван', 'Kovalenko Ivan', '03.05.1971', { x: ['тел. +380 50 316 72 90, засновник', 'tel. +380 50 316 72 90, founder'] }),
      P('p4', 6, 2, 'Коваленко Тетяна', 'Kovalenko Tetiana', '19.01.1974'),
      P('p5', 0, 3, 'Петренко Василь', 'Petrenko Vasyl', '30.07.1955'),
      P('B1', 1, 3, 'Олена Петренко', 'Olena Petrenko', '12.03.1958', { role: 'dup', of: 'B0', x: ['без телефону', 'no phone'] }),
      CO('A1', 2, 3, 'Сонячний Лан ТОВ', 'LLC Soniachnyi Lan', '34127745', { role: 'dup', of: 'A0', x: ['адреса не вказана', 'no address'] }),
      P('p3', 4, 3, 'Гнатюк Степан', 'Hnatiuk Stepan', '19.11.1966', { x: ['фермер, постачальник', 'farmer, supplier'] }),
      CO('D1', 5, 3, 'ТОВ АГРОСВІТ', 'AHROSVIT LLC', '41893302', { role: 'dup', of: 'D0', x: ['без адреси', 'no address'] }),
      P('C1', 6, 3, 'Коваленко І.', 'Kovalenko I.', '03.05.1971', { role: 'dup', of: 'C0', x: ['без телефону', 'no phone'] }),
    ],
    links: [
      L('A2', 'i2', 'contract', '44/2023'), L('BN', 'i2', 'teacher'), L('i2', 'i0', 'sub'), L('i2', 'AN', 'contract', '51/2025'),
      L('AN', 'p2', 'dir'), L('i0', 'i1', 'sub'), L('A0', 'i1', 'contract', '12/2025'), L('B0', 'A0', 'dir'),
      L('p1', 'A0', 'acc'), L('h1', 'B0', 'hh', 'H-207'), L('h1', 'p5', 'hh', 'H-207'), L('A1', 'i1', 'contract', '17/2024'),
      L('B1', 'A1', 'dir'), L('D0', 'i1', 'contract', '08/2025'), L('C0', 'D0', 'founder'), L('p3', 'D0', 'supplier'),
      L('p3', 'D1', 'supplier'), L('D1', 'C1', 'founder'), L('p4', 'C0', 'fam', 'wife'),
    ],
    ducts: [['j1', 'h1'], ['j1', 'A2'], ['A2', 'p1'], ['p1', 'i0'], ['B0', 'B1'], ['A0', 'A1'], ['p5', 'B1'], ['A1', 'p3'],
      ['BN', 'p2'], ['p2', 'C0'], ['AN', 'D0'], ['p4', 'C1']],
    slots: [{ id: 's1', at: [1, 1], to: ['B0', 'p1', 'A0'] }, { id: 's2', at: [6, 1], to: ['p2', 'C0', 'p4'] }],
  },

  // 3. Хибні зв’язки: заглушки (нулі, «невідомо», test@) поєднують непов’язаних людей
  {
    id: 3, time: 150, par: 95, start: 'sw', scanner: true,
    bugs: [{ home: 'j1', ai: 'chase', delay: 4 }, { home: 'pA1', ai: 'ambush', delay: 9 }],
    speed: [0.62, 0.45],
    spawn: { kind: 'fake', max: [2, 1], every: [15, 22] },
    patrol: ['pA1', 'pB2', 'j1', 'pC3'],
    nodes: [
      P('pA1', 0, 0, 'Олійник Тарас', 'Oliinyk Taras', '14.05.1979', { x: ['тел. +380 67 412 33 08', 'tel. +380 67 412 33 08'] }),
      H('hA', 1, 0, 'H-101', 'вул. Лісова 3', '3 Lisova St'),
      P('pA2', 2, 0, 'Олійник Софія', 'Oliinyk Sofiia', '02.09.2008'),
      I('i1', 3, 0, 'Центр соцслужб', 'Social services', 'с. Зелений Гай', 'Zelenyi Hai'),
      P('pB1', 4, 0, 'Романенко Ігор', 'Romanenko Ihor', '06.03.1970'),
      H('hB', 5, 0, 'H-233', 'вул. Польова 12', '12 Polova St'),
      P('pB2', 6, 0, 'Романенко Ліна', 'Romanenko Lina', '28.08.1972'),
      P('pA3', 0, 1, 'Олійник Віра', 'Oliinyk Vira', '21.01.1981', { x: ['тел. +380 67 412 33 08, зареєстрована в матері', 'tel. +380 67 412 33 08, registered at her mother’s'] }),
      P('pX', 2, 1, 'Лук’яненко Ольга', 'Lukianenko Olha', '10.10.1964', { x: ['тел. 000 000 00 00 у картці', 'tel. 000 000 00 00 on file'] }),
      SW('sw', 3, 1),
      P('pY', 4, 1, 'Демченко Сергій', 'Demchenko Serhii', '17.03.1983', { x: ['адреса: невідомо', 'address: unknown'] }),
      P('pB3', 6, 1, 'Романенко Артем', 'Romanenko Artem', '04.11.1996', { x: ['живе в родині дружини', 'lives with his wife’s family'] }),
      P('pC1', 0, 2, 'Гуменюк Ольга', 'Humeniuk Olha', '05.05.1956'),
      H('hC', 1, 2, 'H-310', 'вул. Миру 21', '21 Myru St'),
      P('pC2', 2, 2, 'Гуменюк Петро', 'Humeniuk Petro', '13.08.1953'),
      I('i2', 3, 2, 'Амбулаторія №2', 'Clinic No. 2', 'с. Зелений Гай', 'Zelenyi Hai'),
      P('pD1', 4, 2, 'Кравець Ігор', 'Kravets Ihor', '09.09.1978'),
      H('hD', 5, 2, 'H-478', 'вул. Садова 9', '9 Sadova St'),
      P('pD2', 6, 2, 'Кравець Анна', 'Kravets Anna', '30.06.1997'),
      P('pC3', 1, 3, 'Гуменюк Оксана', 'Humeniuk Oksana', '22.02.1990'),
      P('pZ', 3, 3, 'Остапчук Іван', 'Ostapchuk Ivan', '01.12.1950', { x: ['email test@test.ua, ІПН 1111111111', 'email test@test.ua, tax ID 1111111111'] }),
      P('pD3', 5, 3, 'Кравець Ліза', 'Kravets Liza', '18.07.2019'),
      J('j1', 6, 3, 'xxx', 'xxx', '11.11.1911', '30.01.2022'),
    ],
    links: [
      L('hA', 'pA1', 'hh', 'H-101'), L('hA', 'pA2', 'hh', 'H-101'), L('pA1', 'pA3', 'phone', '+380 67 412 33 08', { decoy: true }),
      L('hB', 'pB1', 'hh', 'H-233'), L('hB', 'pB2', 'hh', 'H-233'), L('hB', 'pB3', 'hh', 'H-233'),
      L('hC', 'pC1', 'hh', 'H-310'), L('hC', 'pC2', 'hh', 'H-310'), L('hC', 'pC3', 'hh', 'H-310'),
      L('hD', 'pD1', 'hh', 'H-478'), L('hD', 'pD2', 'hh', 'H-478'), L('hD', 'pD3', 'hh', 'H-478'),
      L('pA3', 'pC1', 'addr', ['вул. Миру 21', '21 Myru St'], { decoy: true }), L('pB3', 'pD2', 'fam', 'wife', { decoy: true }),
      L('i1', 'pA2', 'case'), L('i1', 'pB1', 'case'), L('i1', 'sw', 'work'), L('sw', 'i2', 'ref'),
      L('i2', 'pC2', 'clinic'), L('i2', 'pD1', 'clinic'), L('i2', 'pZ', 'clinic'), L('pX', 'sw', 'care'), L('pY', 'sw', 'care'),
      F('pX', 'pA2', 'ph0'), F('pX', 'pC2', 'ph0'), F('pY', 'pB1', 'addr0'), F('pY', 'pD1', 'addr0'), F('pZ', 'pC3', 'mail0'), F('pZ', 'pD3', 'tax0'),
    ],
    ducts: [['hA', 'hC'], ['hB', 'hD'], ['pC1', 'pC3'], ['pD3', 'j1'], ['j1', 'pD2'], ['pB2', 'pB3'], ['pX', 'hA'], ['pY', 'hB'], ['pX', 'hC'], ['pY', 'hD']],
    slots: [],
  },

  // 4. Мости: вузли, через які лише й з’єднані частини графа. Сканер підсвічує їх і заглушки
  {
    id: 4, time: 170, par: 105, start: 'CO', scanner: true, scanFull: true,
    bugs: [{ home: 'j2', ai: 'chase', delay: 4 }, { home: 'w1', ai: 'ambush', delay: 8 }, { home: 'e2', ai: 'patrol', delay: 12 }],
    speed: [0.62, 0.45],
    spawn: { kind: 'fake', max: [1, 1], every: [18, 26] },
    patrol: ['e2', 'j2', 'w5', 'w1'],
    nodes: [
      P('w1', 0, 0, 'Іваненко Марія', 'Ivanenko Mariia', '08.03.1951', { x: ['тел. +380 98 205 61 14', 'tel. +380 98 205 61 14'] }),
      H('wh', 1, 0, 'H-061', 'вул. Центральна 5', '5 Tsentralna St'),
      P('w2', 2, 0, 'Іваненко Петро', 'Ivanenko Petro', '17.06.1949'),
      P('e1', 4, 0, 'Литвин Галина', 'Lytvyn Halyna', '22.02.1963'),
      H('eh', 5, 0, 'H-344', 'вул. Річкова 2', '2 Richkova St'),
      P('e2', 6, 0, 'Литвин Олег', 'Lytvyn Oleh', '03.10.1960'),
      P('w3', 0, 1, 'Руденко Тарас', 'Rudenko Taras', '30.01.1985'),
      I('wi', 1, 1, 'Амбулаторія №4', 'Clinic No. 4', 'с. Захарівка', 'Zakharivka'),
      P('wD', 2, 1, 'Іваненко М.', 'Ivanenko M.', '08.03.1951', { role: 'dup', of: 'w1', x: ['друга картка в амбулаторії', 'a second card at the clinic'] }),
      SW('SW', 3, 1, { bridge: true, x: ['обслуговує обидві громади', 'serves both communities'] }),
      J('j1', 4, 1, 'ТЕСТ ТЕСТ', 'TEST TEST', '01.01.1900', '12.08.2021'),
      I('ei', 5, 1, 'ФАП Зелений Гай', 'Zelenyi Hai health post', 'с. Зелений Гай', 'Zelenyi Hai'),
      P('e3', 6, 1, 'Литвин Софія', 'Lytvyn Sofiia', '15.07.1990'),
      P('w4', 0, 2, 'Руденко Ольга', 'Rudenko Olha', '12.12.1987'),
      P('n1', 1, 2, 'Сидоренко Яна', 'Sydorenko Yana', '19.04.1995', { role: 'new', created: '10.11.2026', x: ['переїхала, зв’язки ще не внесли', 'just moved in, links not entered yet'] }),
      MID('M', 3, 2),
      P('eD', 5, 2, 'КРАВЕЦЬ ІГОР', 'KRAVETS IHOR', '09.09.1978', { role: 'dup', of: 'e4', x: ['друга картка у ФАП', 'a second card at the health post'] }),
      P('e4', 6, 2, 'Кравець Ігор', 'Kravets Ihor', '09.09.1978', { x: ['тел. +380 66 731 02 58', 'tel. +380 66 731 02 58'] }),
      P('w5', 1, 3, 'Руденко Кирило', 'Rudenko Kyrylo', '05.05.2010'),
      P('c2', 2, 3, 'Мельничук Віра', 'Melnychuk Vira', '23.09.1979', { x: ['бухгалтерка «Зерно-Трейд»', 'accountant at Zerno-Treid'] }),
      CO('CO', 3, 3, 'ТОВ «Зерно-Трейд»', 'Zerno-Treid LLC', '37450912', { x: ['м. Умань, фонд допомоги селам', 'Uman, runs a village aid fund'] }),
      P('c3', 4, 3, 'Ткач Андрій', 'Tkach Andrii', '14.04.1968', { x: ['директор «Зерно-Трейд»', 'director of Zerno-Treid'] }),
      CO('COd', 5, 3, 'Зерно-Трейд ТОВ', 'LLC Zerno-Treid', '37450912', { role: 'dup', of: 'CO', x: ['без адреси', 'no address'] }),
      J('j2', 6, 3, 'Клієнт 7', 'Client 7', '01.01.1900', '28.02.2019'),
    ],
    links: [
      L('wh', 'w1', 'hh', 'H-061'), L('wh', 'w2', 'hh', 'H-061'), L('wi', 'w1', 'clinic'), L('wi', 'w3', 'clinic'), L('wi', 'w4', 'clinic'),
      L('w3', 'w4', 'fam', 'spouse'), L('w4', 'w5', 'fam', 'son'), L('wD', 'wi', 'clinic'),
      L('SW', 'w2', 'care'), L('SW', 'e1', 'care'), L('SW', 'M', 'coord'), L('M', 'CO', 'contact'),
      L('CO', 'c2', 'acc'), L('CO', 'c3', 'dir'), L('COd', 'c3', 'dir'),
      L('eh', 'e1', 'hh', 'H-344'), L('eh', 'e2', 'hh', 'H-344'), L('e2', 'e3', 'fam', 'daughter'),
      L('ei', 'e1', 'clinic'), L('ei', 'e3', 'clinic'), L('ei', 'e4', 'clinic'), L('eD', 'ei', 'clinic'),
      F('w2', 'e1', 'addr0'), F('w5', 'c2', 'ph0'),
    ],
    ducts: [['w2', 'wD'], ['wD', 'SW'], ['wD', 'c2'], ['n1', 'wi'], ['n1', 'w5'], ['j1', 'SW'], ['j1', 'ei'], ['j1', 'e1'], ['j1', 'c3'],
      ['eD', 'e4'], ['eD', 'COd'], ['e3', 'e4'], ['j2', 'COd'], ['j2', 'e4'], ['M', 'j1']],
    slots: [],
  },

  // 5. Джерело бруду: імпорт без перевірки знову й знову підкидає сміття, доки його не закрито правилом на вході
  {
    id: 5, time: 200, par: 135, start: 'dock', scanner: true, source: 'SRC',
    bugs: [{ home: 'a1', ai: 'chase', delay: 5 }, { home: 'b2', ai: 'ambush', delay: 9 }, { home: 'COd', ai: 'patrol', delay: 13 }],
    speed: [0.62, 0.45],
    spawn: { kind: 'none', max: [0, 0], every: [99, 99] },
    pump: [8, 11],
    patrol: ['a1', 'b2', 'dock', 'COd'],
    nodes: [
      P('a1', 0, 0, 'Бойко Лідія', 'Boiko Lidiia', '14.02.1948', { x: ['тел. +380 97 640 12 85, вул. Шкільна 4', 'tel. +380 97 640 12 85, 4 Shkilna St'] }),
      H('ah', 1, 0, 'H-015', 'вул. Шкільна 4', '4 Shkilna St'),
      P('a2', 2, 0, 'Бойко Микола', 'Boiko Mykola', '30.11.1946'),
      P('b1', 4, 0, 'Савченко Ірина', 'Savchenko Iryna', '11.04.1983', { x: ['мати Дениса, тел. +380 63 902 47 11', 'Denys’s mother, tel. +380 63 902 47 11'] }),
      H('bh', 5, 0, 'H-622', 'вул. Садова 9', '9 Sadova St'),
      P('b2', 6, 0, 'Савченко Денис', 'Savchenko Denys', '25.12.2009'),
      P('a3', 0, 1, 'Бойко Юрій', 'Boiko Yurii', '07.07.1975'),
      I('ai', 1, 1, 'Амбулаторія №1', 'Clinic No. 1', 'с. Липівка', 'Lypivka'),
      P('aD', 2, 1, 'БОЙКО ЛІДІЯ', 'BOIKO LIDIIA', '14.02.1948', { role: 'dup', of: 'a1', x: ['з імпорту, без телефону', 'from the import, no phone'] }),
      { id: 'SRC', k: 'src', at: [3, 1], n: ['Імпорт без перевірки', 'Unchecked import'], a: ['CSV щодня', 'daily CSV'], role: 'src' },
      P('bD', 4, 1, 'Савченко І.', 'Savchenko I.', '11.04.1983', { role: 'dup', of: 'b1', x: ['з імпорту, без адреси', 'from the import, no address'] }),
      I('bi', 5, 1, 'Центр соцслужб', 'Social services', 'с. Липівка', 'Lypivka'),
      P('b3', 6, 1, 'Савченко Ірина', 'Savchenko Iryna', '03.06.1999', { role: 'twin', twin: 'b1', x: ['фахівчиня центру соцслужб', 'specialist at the social services centre'] }),
      P('c2', 0, 2, 'Ничипорук Віра', 'Nychyporuk Vira', '26.03.1985', { x: ['бухгалтерка «Добробут»', 'accountant at Dobrobut'] }),
      MID('G', 1, 2),
      P('m1', 2, 2, 'Мельник Петро', 'Melnyk Petro', '21.09.1941'),
      SW('SW', 3, 2, { bridge: true, x: ['обслуговує обидві частини села', 'serves both parts of the village'] }),
      P('m2', 4, 2, 'Литвин Галина', 'Lytvyn Halyna', '22.02.1963'),
      J('j1', 6, 2, 'Тест Тестович', 'Test Testovych', '01.01.1900', '07.11.2026'),
      CO('COd', 0, 3, 'Добробут ТОВ', 'LLC Dobrobut', '39012284', { role: 'dup', of: 'CO', x: ['з імпорту, без адреси', 'from the import, no address'] }),
      CO('CO', 1, 3, 'ТОВ «Добробут»', 'Dobrobut LLC', '39012284', { x: ['м. Умань, благодійний фонд', 'Uman, charity fund'] }),
      P('n1', 2, 3, 'Олійник Дарина', 'Oliinyk Daryna', '16.08.2001', { role: 'new', created: '13.11.2026', x: ['анкету подала вчора', 'filed the form yesterday'] }),
      J('j2', 4, 3, 'Клієнт 1', 'Client 1', '01.01.1900', '02.11.2026'),
      { id: 'dock', k: 'dock', at: [5, 3], n: ['Док', 'Dock'], a: ['', ''] },
    ],
    links: [
      L('ah', 'a1', 'hh', 'H-015'), L('ah', 'a2', 'hh', 'H-015'), L('a1', 'a3', 'fam', 'son'), L('ai', 'a1', 'clinic'), L('ai', 'a2', 'clinic'),
      L('aD', 'ai', 'clinic'), L('ai', 'm1', 'clinic'), L('m1', 'SW', 'care'), L('SW', 'm2', 'care'), L('m2', 'bi', 'case'),
      L('bi', 'bh', 'case'), L('bh', 'b1', 'hh', 'H-622'), L('bh', 'b2', 'hh', 'H-622'), L('bi', 'b3', 'work'), L('bD', 'bi', 'case'),
      L('b2', 'b3', 'addr', ['вул. Садова 9', '9 Sadova St'], { decoy: true }), L('G', 'm1', 'coord'), L('G', 'CO', 'contact'),
      L('CO', 'c2', 'acc'), L('COd', 'c2', 'acc'),
      F('c2', 'a3', 'ph0'), F('G', 'ai', 'addr0'),
    ],
    ducts: [['SRC', 'aD'], ['SRC', 'bD'], ['SRC', 'SW'], ['m1', 'n1'], ['CO', 'n1'], ['COd', 'CO'], ['j2', 'm2'], ['j1', 'b3'], ['dock', 'j2'], ['dock', 'j1']],
    slots: [{ id: 'S1', at: [3, 0], to: ['a2', 'b1', 'SRC'] }, { id: 'S2', at: [5, 2], to: ['m2', 'j1', 'bi'] }, { id: 'S3', at: [3, 3], to: ['n1', 'j2', 'SW'] }],
  },
];

// Пули для нового сміття: тестові записи без зв’язків
export const TEST_NAMES = [['Тест 2', 'Test 2', '01.01.1900'], ['asdf', 'asdf', '00.00.0000'], ['ТЕСТ1', 'TEST1', '01.01.1900'], ['Клієнт 9', 'Client 9', '01.01.1900'], ['(без імені)', '(no name)', '01.01.1900'], ['qwerty', 'qwerty', '11.11.1111'], ['Іван Тест', 'Ivan Test', '01.01.1900']];

// Варіант написання для дубліката: великі літери, переставлені слова, ініціал (для людей), форма власності в кінці (для компаній)
export function variantName(name, kind, k) {
  if (kind === 'c') {
    const m = name.match(/^ТОВ «(.+)»$/), e = name.match(/^(.+) LLC$/);
    if (m) return [`${m[1]} ТОВ`, `ТОВ ${m[1].toUpperCase()}`][k % 2];
    if (e) return [`LLC ${e[1]}`, `${e[1].toUpperCase()} LLC`][k % 2];
    return name.toUpperCase();
  }
  const w = name.split(' ');
  if (w.length < 2) return name.toUpperCase();
  return [name.toUpperCase(), `${w[1]} ${w[0]}`, `${w[0]} ${w[1][0]}.`][k % 3];
}
