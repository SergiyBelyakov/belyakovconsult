// Зразки даних для кожного типу: умовні, але правдоподібні (громади, бюджети, ЦНАП, опитування).
// Заголовки колонок мовою сторінки й у порядку ролей типу; дати рядком 2026-03-05, у Excel стають датами.
import { rng, gauss } from '../../anomaly-demo/src/stats.js';
import { dayOf, isoDay, weekday } from './format.js';
import { REGIONS } from './geo.js';

const H = (uk, en) => ({ uk, en });
const pick = (lang, uk, en) => (lang === 'en' ? en : uk);
const r1 = v => Math.round(v * 10) / 10;

export const HEAD = {
  column: H(['Вікова група', 'Отримувачів допомоги'], ['Age group', 'Aid recipients']),
  bar: H(['Програма', 'Видатки, тис. грн'], ['Programme', 'Spending, UAH k']),
  grouped: H(['Квартал', 'Громада', 'Відвідувачів ЦНАП'], ['Quarter', 'Community', 'Service centre visitors']),
  stacked: H(['Рік', 'Стаття видатків', 'Сума, млн грн'], ['Year', 'Spending item', 'Amount, UAH m']),
  dumbbell: H(['Послуга', 'До, днів', 'Після, днів'], ['Service', 'Before, days', 'After, days']),
  bullet: H(['Джерело', 'Факт, млн грн', 'План, млн грн'], ['Source', 'Actual, UAH m', 'Plan, UAH m']),
  line: H(['Місяць', 'Канал', 'Звернень'], ['Month', 'Channel', 'Requests']),
  area: H(['Місяць', 'Споживання, МВт·год'], ['Month', 'Consumption, MWh']),
  kpi: H(['Тиждень', 'Час відповіді, год'], ['Week', 'Response time, h']),
  calendar: H(['Дата', 'Дзвінків'], ['Date', 'Calls']),
  gantt: H(['Завдання', 'Початок', 'Кінець', 'Етап'], ['Task', 'Start', 'End', 'Phase']),
  donut: H(['Джерело доходу', 'Сума, млн грн'], ['Revenue source', 'Amount, UAH m']),
  treemap: H(['Галузь', 'Програма', 'Видатки, тис. грн'], ['Sector', 'Programme', 'Spending, UAH k']),
  waterfall: H(['Стаття', 'Сума, млн грн'], ['Item', 'Amount, UAH m']),
  funnel: H(['Етап', 'Учасників'], ['Stage', 'Participants']),
  likert: H(['Твердження', 'Відповідь', 'Кількість'], ['Statement', 'Answer', 'Count']),
  histogram: H(['Сума допомоги, грн'], ['Aid amount, UAH']),
  box: H(['Тип звернення', 'Днів до відповіді'], ['Request type', 'Days to reply']),
  scatter: H(['Населення, тис.', 'Звернень на 1000 жителів', 'Тип громади', 'Громада'], ['Population, k', 'Requests per 1,000 residents', 'Community type', 'Community']),
  bubble: H(['Вартість, тис. грн', 'Оцінка впливу', 'Отримувачів', 'Проєкт', 'Напрям'], ['Cost, UAH k', 'Impact score', 'Beneficiaries', 'Project', 'Area']),
  heatmap: H(['День', 'Година', 'Відвідувачів'], ['Day', 'Hour', 'Visitors']),
  sankey: H(['Звідки', 'Куди', 'Звернень'], ['From', 'To', 'Requests']),
  network: H(['Учасник 1', 'Учасник 2', 'Спільних проєктів'], ['Partner 1', 'Partner 2', 'Joint projects']),
  map: H(['Регіон', 'Громад з відкритими даними, %'], ['Region', 'Communities with open data, %']),
  radar: H(['Вимір', 'Організація', 'Бал'], ['Dimension', 'Organisation', 'Score']),
  meter: H(['Ціль', 'Факт', 'План'], ['Goal', 'Actual', 'Target']),
  table: H(['Громада', 'Населення, тис.', 'Бюджет на мешканця, грн', 'Цифрових послуг, %', 'Час відповіді, год', 'Задоволеність, бал'], ['Community', 'Population, k', 'Budget per resident, UAH', 'Digital services, %', 'Response time, h', 'Satisfaction score']),
  small: H(['Громада', 'Місяць', 'Звернень'], ['Community', 'Month', 'Requests']),
  bump: H(['Рік', 'Громада', 'Індекс цифрових послуг'], ['Year', 'Community', 'Digital services index']),
  violin: H(['Послуга', 'Тривалість прийому, хв'], ['Service', 'Appointment length, min']),
  ridge: H(['Місяць', 'Час доїзду швидкої, хв'], ['Month', 'Ambulance response time, min']),
  parallel: H(['Громада', 'Тип громади', 'Населення, тис.', 'Бюджет на мешканця, тис. грн', 'Послуги онлайн, %', 'Час відповіді, год', 'Задоволеність, бал', 'Відкриті набори даних'], ['Community', 'Community type', 'Population, k', 'Budget per resident, UAH k', 'Online services, %', 'Response time, h', 'Satisfaction score', 'Open datasets']),
  chord: H(['Хто надсилає запит', 'До якого реєстру', 'Запитів за добу, тис.'], ['Requesting system', 'Register queried', 'Requests per day, k']),
};
// Умовні громади для рейтингів і мультиплів
const TOWNS = {
  uk: ['Вишнева', 'Озерна', 'Соснівська', 'Липова', 'Березанська', 'Калинова', 'Дубова', 'Зоряна', 'Ясенівська', 'Кленова', 'Тополина', 'Яблунівська'],
  en: ['Vyshneva', 'Ozerna', 'Sosnivska', 'Lypova', 'Berezanska', 'Kalynova', 'Dubova', 'Zoriana', 'Yasenivska', 'Klenova', 'Topolyna', 'Yablunivska'],
};
const MONTHS = {
  uk: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const COMM = { uk: ['Північна громада', 'Центральна громада', 'Південна громада'], en: ['North community', 'Central community', 'South community'] };

function make(id, lang) {
  const R = rng(1009 + id.length * 97 + id.charCodeAt(0) * 13);
  const g = () => gauss(R);
  const L = (uk, en) => pick(lang, uk, en);
  switch (id) {
    case 'column':
      return ['0-17', '18-29', '30-44', '45-59', '60-74', '75+'].map((a, k) => [a, [1240, 860, 1510, 1730, 2380, 1460][k]]);
    case 'bar': {
      const n = L(['Освіта', 'Охорона здоров’я', 'Соціальний захист', 'Житлово-комунальне господарство', 'Дороги та транспорт', 'Культура і туризм', 'Фізична культура і спорт', 'Безпека громади', 'Органи управління', 'Цифрова трансформація'],
        ['Education', 'Healthcare', 'Social protection', 'Housing and utilities', 'Roads and transport', 'Culture and tourism', 'Sports', 'Community safety', 'Administration', 'Digital transformation']);
      return n.map((x, k) => [x, [148200, 61400, 52800, 44900, 38700, 17300, 9800, 12600, 41200, 6900][k]]);
    }
    case 'grouped': {
      const q = L(['I квартал', 'II квартал', 'III квартал', 'IV квартал'], ['Q1', 'Q2', 'Q3', 'Q4']), base = [4200, 6100, 2700], season = [1, 1.08, 0.86, 1.14];
      return q.flatMap((x, a) => COMM[lang].map((c, b) => [x, c, Math.round(base[b] * season[a] * (1 + 0.04 * g()))]));
    }
    case 'stacked': {
      const it = L(['Оплата праці', 'Комунальні послуги', 'Матеріали', 'Капітальні видатки'], ['Salaries', 'Utilities', 'Supplies', 'Capital spending']);
      const base = [[212, 58, 31, 44], [226, 71, 29, 22], [241, 76, 34, 38], [258, 69, 37, 61], [274, 64, 39, 83]];
      return [2022, 2023, 2024, 2025, 2026].flatMap((y, a) => it.map((x, b) => [y, x, base[a][b]]));
    }
    case 'dumbbell': {
      const s = L(['Довідка про склад сім’ї', 'Реєстрація місця проживання', 'Дозвіл на розміщення реклами', 'Призначення субсидії', 'Будівельний паспорт', 'Довідка про доходи', 'Акт обстеження житла', 'Дозвіл на видалення дерев'],
        ['Household composition certificate', 'Residence registration', 'Advertising permit', 'Housing subsidy', 'Building passport', 'Income certificate', 'Housing inspection report', 'Tree removal permit']);
      return s.map((x, k) => [x, [10, 7, 30, 15, 21, 5, 14, 20][k], [1, 1, 12, 6, 10, 1, 9, 9][k]]);
    }
    case 'bullet': {
      const s = L(['Податок на доходи фізичних осіб', 'Єдиний податок', 'Плата за землю', 'Акцизний податок', 'Податок на нерухомість', 'Інші надходження'], ['Personal income tax', 'Single tax', 'Land fee', 'Excise tax', 'Property tax', 'Other revenue']);
      return s.map((x, k) => [x, [412.5, 96.3, 58.1, 31.4, 18.9, 22.7][k], [430, 90, 64, 30, 24, 20][k]]);
    }
    case 'line': {
      const ch = L(['Дія', 'Сайт громади', 'Телефон'], ['Diia', 'Community website', 'Phone']), out = [];
      for (let k = 0; k < 24; k++) {
        const y = 2024 + Math.floor((10 + k) / 12), m = ((10 + k) % 12) + 1, s = 1 + 0.08 * Math.cos((2 * Math.PI * (m - 1)) / 12);
        out.push([isoDay(dayOf(y, m, 1)), ch[0], Math.round((380 + 48 * k + 25 * g()) * s)]);
        out.push([isoDay(dayOf(y, m, 1)), ch[1], Math.round((640 + 6 * k + 30 * g()) * s)]);
        out.push([isoDay(dayOf(y, m, 1)), ch[2], Math.round((930 - 19 * k + 30 * g()) * s)]);
      }
      return out;
    }
    case 'area': {
      const out = [];
      for (let k = 0; k < 36; k++) {
        const y = 2023 + Math.floor((10 + k) / 12), m = ((10 + k) % 12) + 1;
        const v = (430 + 175 * Math.cos((2 * Math.PI * (m - 1)) / 12) + 40 * Math.cos((4 * Math.PI * (m - 1)) / 12)) * (1 - 0.0045 * k) + 12 * g();
        out.push([isoDay(dayOf(y, m, 1)), Math.round(v)]);
      }
      return out;
    }
    case 'kpi': {
      const out = [], start = dayOf(2026, 5, 4);
      for (let k = 0; k < 26; k++) out.push([isoDay(start + 7 * k), r1(Math.max(8, 52 * Math.exp(-k / 13) + 12 + 2.2 * g()))]);
      out[24][1] = 19.4; out[25][1] = 17.6;
      return out;
    }
    case 'calendar': {
      const out = [], start = dayOf(2025, 11, 1), end = dayOf(2026, 10, 31);
      for (let d = start; d <= end; d++) {
        const w = weekday(d), base = [310, 270, 255, 250, 235, 90, 60][w];
        const winter = 1 + 0.35 * Math.max(0, Math.cos((2 * Math.PI * (d - dayOf(2026, 1, 15))) / 365));
        let v = base * winter * (1 + 0.1 * g());
        if (d >= dayOf(2026, 10, 12) && d <= dayOf(2026, 10, 20)) v *= 1.9;   // старт опалювального сезону
        if (d >= dayOf(2026, 4, 27) && d <= dayOf(2026, 4, 30)) v *= 1.6;      // строк подачі на субсидію
        out.push([isoDay(d), Math.max(0, Math.round(v))]);
      }
      return out;
    }
    case 'gantt': {
      const t = L(['Аудит джерел даних', 'Модель даних', 'Інтеграція реєстрів', 'Правила якості даних', 'Сховище даних', 'Дашборди для керівників', 'Регламент управління даними', 'Навчання команди', 'Пілот у двох відділах', 'Запуск для всіх відділів'],
        ['Data source audit', 'Data model', 'Register integration', 'Data quality rules', 'Data warehouse', 'Management dashboards', 'Data governance policy', 'Team training', 'Pilot in two departments', 'Rollout to all departments']);
      const ph = L(['Підготовка', 'Розробка', 'Впровадження'], ['Preparation', 'Build', 'Rollout']);
      const d = [['2026-06-01', '2026-06-30', 0], ['2026-06-22', '2026-07-31', 0], ['2026-07-20', '2026-10-09', 1], ['2026-08-03', '2026-09-25', 1], ['2026-08-17', '2026-11-13', 1], ['2026-10-05', '2026-12-18', 1], ['2026-09-14', '2026-11-27', 2], ['2026-11-16', '2027-01-29', 2], ['2026-12-01', '2027-02-26', 2], ['2027-03-01', '2027-03-31', 2]];
      return t.map((x, k) => [x, d[k][0], d[k][1], ph[d[k][2]]]);
    }
    case 'donut': {
      const s = L(['Податок на доходи фізичних осіб', 'Трансферти з державного бюджету', 'Єдиний податок', 'Плата за землю', 'Інші надходження'], ['Personal income tax', 'State budget transfers', 'Single tax', 'Land fee', 'Other revenue']);
      return s.map((x, k) => [x, [412.5, 143.0, 96.3, 58.1, 52.4][k]]);
    }
    case 'treemap': {
      const G = L(['Освіта', 'Охорона здоров’я', 'Соціальний захист', 'Благоустрій і ЖКГ', 'Культура і спорт'], ['Education', 'Healthcare', 'Social protection', 'Utilities and public spaces', 'Culture and sports']);
      const P = L([['Загальна середня освіта', 'Дошкільна освіта', 'Позашкільна освіта', 'Інклюзивна освіта'], ['Лікарня', 'Первинна допомога'], ['Підтримка внутрішньо переміщених осіб', 'Субсидії й пільги', 'Територіальний центр'], ['Благоустрій', 'Водопостачання', 'Вуличне освітлення', 'Вивезення відходів'], ['Спортивні секції', 'Будинки культури', 'Бібліотеки']],
        [['Secondary schools', 'Pre-school education', 'Out-of-school education', 'Inclusive education'], ['Hospital', 'Primary care'], ['Support for internally displaced people', 'Subsidies and benefits', 'Social services centre'], ['Public spaces', 'Water supply', 'Street lighting', 'Waste collection'], ['Sports clubs', 'Community centres', 'Libraries']]);
      const V = [[86400, 48200, 7300, 6300], [33300, 28100], [16800, 21800, 14200], [19700, 12600, 6900, 5700], [9800, 7900, 4800]];
      return G.flatMap((gname, a) => P[a].map((p, b) => [gname, p, V[a][b]]));
    }
    case 'waterfall': {
      const s = L(['Залишок на 1 січня', 'Податкові надходження', 'Трансферти', 'Освіта', 'Охорона здоров’я', 'Соціальний захист', 'Капітальні видатки', 'Інші видатки'], ['Balance on 1 January', 'Tax revenue', 'Transfers', 'Education', 'Healthcare', 'Social protection', 'Capital spending', 'Other spending']);
      return s.map((x, k) => [x, [86.4, 612.3, 143.0, -318.7, -94.2, -66.8, -152.6, -121.9][k]]);
    }
    case 'funnel': {
      const s = L(['Відкрили сторінку конкурсу', 'Почали заявку', 'Подали заявку', 'Пройшли формальну перевірку', 'Отримали грант'], ['Opened the call page', 'Started an application', 'Submitted', 'Passed eligibility check', 'Received a grant']);
      return s.map((x, k) => [x, [12400, 3150, 1240, 655, 182][k]]);
    }
    case 'likert': {
      const q = L(['Послуги ЦНАП зручні', 'Інформація на сайті зрозуміла', 'Звернення розглядають вчасно', 'Відповідають по суті', 'Я довіряю даним громади'], ['Service centre is convenient', 'Website information is clear', 'Requests are handled on time', 'Replies address the question', 'I trust community data']);
      const a = L(['Зовсім не згоден', 'Скоріше не згоден', 'Важко сказати', 'Скоріше згоден', 'Повністю згоден'], ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']);
      const v = [[18, 41, 66, 214, 261], [35, 92, 118, 230, 125], [62, 128, 149, 171, 90], [44, 97, 131, 205, 123], [71, 116, 172, 160, 81]];
      return q.flatMap((x, i) => a.map((y, j) => [x, y, v[i][j]]));
    }
    case 'histogram': {
      const out = [];
      for (let k = 0; k < 900; k++) out.push([k % 9 === 0 ? Math.round(6000 + 600 * g()) : Math.round(Math.exp(Math.log(2600) + 0.42 * g()) / 10) * 10]);
      return out;
    }
    case 'box': {
      const t = L(['Довідки', 'Дозволи', 'Скарги', 'Земельні питання', 'Соціальна допомога'], ['Certificates', 'Permits', 'Complaints', 'Land issues', 'Social assistance']);
      const med = [2, 9, 12, 21, 6], sp = [0.45, 0.4, 0.55, 0.45, 0.35], out = [];
      t.forEach((x, k) => { for (let i = 0; i < 120; i++) out.push([x, Math.max(1, Math.round(Math.exp(Math.log(med[k]) + sp[k] * g())))]); });
      for (let i = 0; i < 4; i++) out.push([t[2], 45 + 9 * i]);
      return out;
    }
    case 'scatter': {
      const ty = L(['Міська', 'Селищна', 'Сільська'], ['Urban', 'Settlement', 'Rural']), out = [];
      for (let k = 0; k < 60; k++) {
        const t = k < 14 ? 0 : k < 32 ? 1 : 2;
        const pop = t === 0 ? Math.exp(Math.log(20) + R() * Math.log(14)) : t === 1 ? 8 + R() * 22 : 2.5 + R() * 11;
        const req = 38 + 21 * Math.log(pop) + (t === 0 ? 14 : t === 1 ? 4 : -6) + 9 * g();
        out.push([r1(pop), r1(req), ty[t], L('Громада ', 'Community ') + String(k + 1).padStart(2, '0')]);
      }
      return out;
    }
    case 'bubble': {
      const p = L(['Енергоефективні школи', 'Цифровий ЦНАП', 'Шкільні автобуси', 'Відкриті дані громади', 'Сонячні панелі на лікарні', 'Укриття в садочках', 'Молодіжний центр', 'Ремонт доріг', 'Мобільна медична бригада', 'Програма для переселенців', 'Освітлення вулиць', 'Парк біля річки', 'Бібліотечний хаб', 'Сортування відходів', 'Новий водогін'],
        ['Energy-efficient schools', 'Digital service centre', 'School buses', 'Community open data', 'Solar panels at the hospital', 'Kindergarten shelters', 'Youth centre', 'Road repairs', 'Mobile medical team', 'Programme for displaced people', 'Street lighting', 'Riverside park', 'Library hub', 'Waste sorting', 'New water main']);
      const dir = L(['Інфраструктура', 'Соціальні послуги', 'Цифрові рішення'], ['Infrastructure', 'Social services', 'Digital']);
      const d = [[9800, 7.6, 2400, 0], [1400, 8.1, 18500, 2], [5200, 6.4, 1100, 0], [380, 5.9, 26000, 2], [6400, 7.1, 9000, 0], [7600, 8.8, 1900, 0], [2100, 5.2, 3200, 1], [14800, 6.8, 21000, 0], [1900, 8.4, 6200, 1], [1200, 7.9, 4300, 1], [3100, 5.6, 15000, 0], [4400, 4.3, 12000, 0], [950, 6.1, 5200, 1], [2600, 6.6, 24000, 0], [11200, 8.2, 14000, 0]];
      return p.map((x, k) => [d[k][0], d[k][1], d[k][2], x, dir[d[k][3]]]);
    }
    case 'heatmap': {
      const days = L(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']), out = [];
      const dayK = [1.25, 1.05, 1, 0.98, 0.9, 0.55], hourK = [0.55, 0.95, 1.2, 1.25, 0.6, 0.85, 1.1, 1.05, 0.9, 0.7, 0.45];
      days.forEach((d, a) => hourK.forEach((h, b) => { const hour = 8 + b; out.push([d, String(hour).padStart(2, '0') + ':00', a === 5 && hour >= 14 ? 0 : Math.round(38 * dayK[a] * h * (1 + 0.08 * g()))]); }));
      return out;
    }
    case 'sankey': {
      const c = L(['Дія', 'Сайт громади', 'Телефон', 'Особисто в ЦНАП'], ['Diia', 'Community website', 'Phone', 'In person']);
      const t = L(['Довідки', 'Дозволи', 'Скарги'], ['Certificates', 'Permits', 'Complaints']);
      const r = L(['Вирішено', 'В роботі', 'Відмовлено'], ['Resolved', 'In progress', 'Rejected']);
      const ct = [[820, 260, 90], [310, 180, 150], [140, 0, 380], [260, 340, 120]];
      const rate = [[0.92, 0.08, 0], [0.7, 0.22, 0.08], [0.55, 0.3, 0.15]];
      const out = [];
      ct.forEach((row, a) => row.forEach((v, b) => { if (v) out.push([c[a], t[b], v]); }));
      t.forEach((x, b) => {
        const tot = ct.reduce((s2, row) => s2 + row[b], 0), ks = [0, 1, 2].filter(k => rate[b][k] > 0);
        let left = tot;
        ks.forEach((k, j) => { const v = j === ks.length - 1 ? left : Math.round(tot * rate[b][k]); left -= v; out.push([x, r[k], v]); });
      });
      return out;
    }
    case 'network': {
      const n = L(['Міська рада', 'ЦНАП', 'Відділ освіти', 'Відділ соцзахисту', 'Лікарня', 'Центр первинної допомоги', 'Школа №1', 'Школа №2', 'Ліцей', 'ГО «Відкрите місто»', 'ГО «Молодь громади»', 'Бібліотека', 'Поліція громади', 'Рятувальна служба', 'Водоканал', 'Енергокомпанія', 'Університет', 'ІТ-компанія', 'Фонд А', 'Фонд Б', 'Агенція розвитку', 'Сусідня громада'],
        ['City council', 'Service centre', 'Education department', 'Social department', 'Hospital', 'Primary care centre', 'School 1', 'School 2', 'Lyceum', 'Open City NGO', 'Youth NGO', 'Library', 'Community police', 'Rescue service', 'Water utility', 'Energy company', 'University', 'IT company', 'Foundation A', 'Foundation B', 'Development agency', 'Neighbour community']);
      const e = [[0, 1, 6], [0, 2, 5], [0, 3, 5], [0, 4, 3], [0, 14, 3], [0, 15, 2], [0, 20, 4], [0, 21, 2], [0, 12, 2], [1, 3, 4], [1, 17, 3], [1, 11, 1], [2, 6, 4], [2, 7, 4], [2, 8, 3], [2, 16, 2], [3, 5, 3], [3, 4, 2], [3, 9, 2], [4, 5, 4], [4, 13, 2], [6, 7, 2], [8, 16, 3], [8, 10, 2], [9, 10, 3], [9, 18, 3], [9, 11, 2], [10, 11, 2], [10, 19, 2], [12, 13, 3], [14, 15, 2], [17, 16, 2], [18, 20, 3], [19, 20, 2], [20, 21, 3], [17, 20, 2]];
      return e.map(([a, b, w]) => [n[a], n[b], w]);
    }
    case 'map': {
      const v = { vol: 54, riv: 47, zhy: 51, kyo: 63, chn: 44, sum: 39, lvi: 78, ter: 58, khm: 55, kyc: 86, pol: 61, kha: 49, luh: 12, zak: 42, ivf: 60, chv: 46, vin: 67, che: 52, dni: 71, don: 18, ode: 57, kir: 41, zap: 33, myk: 48, khe: 21 };
      return REGIONS.map(r => [lang === 'en' ? r[2] : r[1], v[r[0]] ?? '']);
    }
    case 'radar': {
      const d = L(['Стратегія', 'Якість даних', 'Управління даними', 'Інфраструктура', 'Аналітика', 'Культура даних'], ['Strategy', 'Data quality', 'Data governance', 'Infrastructure', 'Analytics', 'Data culture']);
      const o = L(['Організація А', 'Організація Б'], ['Organisation A', 'Organisation B']), v = [[3.5, 2.5, 2, 4, 3, 2.5], [2, 3.5, 3, 2.5, 4, 3.5]];
      return o.flatMap((x, b) => d.map((y, a) => [y, x, v[b][a]]));
    }
    case 'meter': {
      const s = L(['Послуг доступно онлайн', 'Закладів з доступом до інтернету', 'Відкритих наборів даних', 'Працівників пройшли навчання'], ['Services available online', 'Facilities with internet access', 'Open datasets published', 'Staff trained']);
      return s.map((x, k) => [x, [38, 47, 26, 112][k], [50, 52, 40, 120][k]]);
    }
    case 'table': {
      const out = [];
      for (let k = 0; k < 12; k++) {
        const pop = r1(Math.exp(Math.log(6) + R() * Math.log(25)));
        out.push([L('Громада ', 'Community ') + (lang === 'en' ? 'ABCDEFGHIJKL' : 'АБВГДЕЖЗКЛМН')[k], pop, Math.round(9000 + 6000 * R() + 400 * g()), Math.round(35 + 40 * R()), r1(10 + 40 * R()), r1(3 + 1.6 * R())]);
      }
      return out;
    }
    case 'small': {
      const out = [], tw = TOWNS[lang];
      for (let k = 0; k < 24; k++) {
        const y = 2024 + Math.floor((10 + k) / 12), m = ((10 + k) % 12) + 1, day = isoDay(dayOf(y, m, 1));
        const win = Math.cos((2 * Math.PI * (m - 1)) / 12), sum = -win;
        const v = [
          1200 + 21 * k, 2100 - 25 * k, 900 * (1 + 0.32 * win), k < 10 ? 500 : 1080, 1600, k === 17 ? 1820 : 700, 400 + 8 * k, 800 * (1 + 0.38 * sum),
          900 + 400 * ((k - 12) / 12) ** 2, 300 + 26 * k, 350, 1000 * (1 + 0.28 * Math.sin(k * 1.7)),
        ];
        v.forEach((x, i) => out.push([tw[i], day, Math.max(0, Math.round(x * (1 + 0.035 * g())))]));
      }
      return out;
    }
    case 'bump': {
      const base = [62, 71, 58, 44, 66, 52, 69, 48, 55, 60], slope = [2, -0.9, 3.1, 7.6, 1, 2.6, 0.2, 4, 1.5, -0.5], out = [];
      for (let k = 0; k < 6; k++) TOWNS[lang].slice(0, 10).forEach((t, i) => out.push([2021 + k, t, r1(base[i] + slope[i] * k + 1.2 * g())]));
      return out;
    }
    case 'violin': {
      const sv = L(['Довідка', 'Реєстрація місця проживання', 'Призначення субсидії', 'Дозвіл на будівництво'], ['Certificate', 'Residence registration', 'Housing subsidy', 'Building permit']), out = [];
      for (let i = 0; i < 90; i++) out.push([sv[0], Math.max(2, r1(Math.exp(Math.log(6) + 0.33 * g())))]);
      for (let i = 0; i < 90; i++) out.push([sv[1], Math.max(3, r1(i % 5 < 3 ? Math.exp(Math.log(8) + 0.22 * g()) : Math.exp(Math.log(24) + 0.17 * g())))]);
      for (let i = 0; i < 90; i++) out.push([sv[2], Math.max(5, r1(18 + 4.5 * g()))]);
      for (let i = 0; i < 90; i++) out.push([sv[3], Math.max(6, r1(Math.exp(Math.log(24) + 0.42 * g())))]);
      return out;
    }
    case 'ridge': {
      const out = [], mo = MONTHS[lang];
      mo.forEach((nm, k) => {
        const winter = Math.max(0, Math.cos((2 * Math.PI * k) / 12)), snow = k === 0 || k === 1 || k === 11 ? 1 : 0;
        const cityM = 11 + 4 * winter + 1.5 * snow, ruralM = 24 + 7 * winter + 3 * snow;
        for (let i = 0; i < 110; i++) {
          const rural = i % 10 < 3;
          out.push([nm, Math.max(4, Math.round(rural ? ruralM + (5 + 2 * winter) * g() : cityM + (2.6 + winter) * g()))]);
        }
      });
      return out;
    }
    case 'parallel': {
      const ty = L(['Міська', 'Селищна', 'Сільська'], ['Urban', 'Settlement', 'Rural']), out = [];
      for (let k = 0; k < 48; k++) {
        const t = k < 12 ? 0 : k < 26 ? 1 : 2;
        const pop = t === 0 ? Math.exp(Math.log(45) + 0.5 * g()) : t === 1 ? Math.exp(Math.log(12) + 0.35 * g()) : Math.exp(Math.log(5) + 0.35 * g());
        const online = Math.max(8, Math.min(96, [70, 52, 38][t] + [9, 11, 13][t] * g()));
        const budget = Math.max(5, [14, 11, 9.5][t] + 0.04 * (online - 50) + 2.2 * g());
        const resp = Math.max(4, 48 - 0.42 * online + 5.5 * g());
        const sat = Math.max(1.5, Math.min(5, 2.55 + 0.02 * online + 0.32 * g()));
        const open = Math.max(0, Math.round([24, 9, 4][t] * (1 + 0.4 * g())));
        out.push([L('Громада ', 'Community ') + String(k + 1).padStart(2, '0'), ty[t], r1(pop), r1(budget), Math.round(online), r1(resp), Math.round(sat * 100) / 100, open]);
      }
      return out;
    }
    case 'chord': {
      const n = L(['Реєстр населення', 'Соціальний реєстр', 'Податковий реєстр', 'Реєстр нерухомості', 'Система ЦНАП'], ['Population register', 'Social register', 'Tax register', 'Property register', 'Service centre system']);
      const mtx = [[0, 6.2, 3.1, 1.4, 2], [48.5, 0, 22.4, 9.8, 3.1], [31.2, 4.4, 0, 18.6, 1.2], [12.7, 1.1, 6.9, 0, 0.8], [64.3, 27.9, 11.6, 15.2, 0]], out = [];
      mtx.forEach((row, i) => row.forEach((v, j) => { if (i !== j) out.push([n[i], n[j], v]); }));
      return out;
    }
    default: return [];
  }
}

export function sample(id, lang) { return { head: HEAD[id][lang], rows: make(id, lang) }; }
