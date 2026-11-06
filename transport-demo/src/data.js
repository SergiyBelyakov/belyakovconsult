// Умовна громада для демо транспортної доступності. Усе вигадане: територія, назви, дороги, розклад, населення.
// Координати в кілометрах: x праворуч, y донизу. Річка Рута ділить громаду на два береги.

export const WORLD = { w: 52, h: 38 };
export const CELL = 0.4; // крок сітки для ізохрон, км

// Русло (опорні точки, згладжується сплайном)
export const RIVER = [
  [-1.0, 5.2], [4.5, 6.6], [9.0, 8.9], [13.0, 10.0], [17.0, 11.6], [20.8, 13.4], [23.6, 15.6],
  [25.0, 18.6], [26.6, 21.6], [29.6, 23.6], [34.0, 24.4], [38.2, 25.6], [42.0, 28.0], [46.0, 29.8], [53.0, 32.0],
];

// Межа громади
export const BOUNDARY = [
  [2.6, 3.4], [8.5, 1.9], [15.5, 2.4], [22.0, 1.6], [28.5, 1.9], [35.0, 1.2], [41.5, 2.6], [46.6, 4.6],
  [48.6, 9.2], [48.1, 14.6], [47.4, 19.6], [48.3, 24.4], [47.8, 29.4], [46.2, 34.2], [40.5, 36.6],
  [33.5, 36.2], [27.0, 37.0], [20.5, 36.6], [14.0, 36.1], [8.4, 34.6], [3.6, 32.0], [1.6, 26.5],
  [1.4, 20.4], [1.9, 14.2], [1.5, 8.6],
];

// Населені пункти. kind: district (район міста), town (селище), village (село).
// old: частка 65+, kids: частка 0 до 17 років.
const P = (id, uk, lat, kind, x, y, pop, old, kids, extra = {}) => ({ id, name: { uk, lat }, kind, x, y, pop, old, kids, ...extra });
export const PLACES = [
  P('vrc', 'Велика Рута, центр', 'Velyka Ruta', 'district', 22.2, 17.6, 8200, 0.21, 0.18, { district: 'c' }),
  P('vrn', 'Велика Рута, Північ', 'Velyka Ruta', 'district', 20.6, 15.2, 5100, 0.19, 0.20, { district: 'n' }),
  P('vrw', 'Велика Рута, Захід', 'Velyka Ruta', 'district', 19.4, 18.9, 4600, 0.24, 0.16, { district: 'w' }),
  P('vre', 'Велика Рута, Заріччя', 'Velyka Ruta', 'district', 26.4, 17.2, 3500, 0.27, 0.15, { district: 'e' }),
  P('yas', 'Ясенів', 'Yaseniv', 'town', 9.0, 27.6, 4300, 0.25, 0.16),
  P('oze', 'Озерне', 'Ozerne', 'town', 38.6, 10.0, 3100, 0.28, 0.15),
  P('kle', 'Кленове', 'Klenove', 'village', 21.8, 27.2, 1450, 0.31, 0.14),
  P('dub', 'Дубове', 'Dubove', 'village', 12.4, 20.5, 1600, 0.27, 0.16),
  P('ver', 'Вербівка', 'Verbivka', 'village', 5.8, 20.0, 720, 0.33, 0.12),
  P('sos', 'Соснівка', 'Sosnivka', 'village', 9.6, 14.6, 380, 0.41, 0.09),
  P('lis', 'Лісне', 'Lisne', 'village', 6.2, 11.6, 210, 0.46, 0.07),
  P('hly', 'Глибоке', 'Hlyboke', 'village', 3.4, 15.3, 160, 0.48, 0.06),
  P('sta', 'Ставки', 'Stavky', 'village', 15.2, 23.6, 640, 0.30, 0.13),
  P('lyp', 'Липівка', 'Lypivka', 'village', 5.0, 30.2, 520, 0.35, 0.11),
  P('ter', 'Терни', 'Terny', 'village', 11.8, 33.2, 430, 0.38, 0.10),
  P('buz', 'Бузкове', 'Buzkove', 'village', 17.0, 30.5, 380, 0.36, 0.11),
  P('hai', 'Гай', 'Hai', 'village', 22.8, 33.6, 290, 0.40, 0.09),
  P('kov', 'Ковилове', 'Kovylove', 'village', 27.6, 29.6, 560, 0.34, 0.12),
  P('vys', 'Вишневе', 'Vyshneve', 'village', 33.8, 31.2, 470, 0.37, 0.11),
  P('luh', 'Лугове', 'Luhove', 'village', 42.6, 31.4, 610, 0.35, 0.12),
  P('ste', 'Степове', 'Stepove', 'village', 45.4, 34.0, 240, 0.42, 0.08),
  P('zap', 'Заплавне', 'Zaplavne', 'village', 38.4, 28.9, 330, 0.39, 0.10),
  P('yab', 'Яблунівка', 'Yablunivka', 'village', 24.6, 23.2, 820, 0.29, 0.15),
  P('mal', 'Мала Рута', 'Mala Ruta', 'village', 28.6, 25.9, 680, 0.32, 0.13),
  P('ber', 'Березове', 'Berezove', 'village', 30.6, 18.8, 690, 0.30, 0.14),
  P('kal', 'Калинове', 'Kalynove', 'village', 33.0, 7.4, 1250, 0.29, 0.15),
  P('yan', 'Ясне', 'Yasne', 'village', 19.6, 6.4, 540, 0.33, 0.12),
  P('pid', 'Підгір’я', 'Pidhiria', 'village', 12.8, 4.6, 300, 0.40, 0.09),
  P('vrr', 'Верхня Рута', 'Verkhnia Ruta', 'village', 26.2, 3.8, 410, 0.36, 0.11),
  P('top', 'Тополі', 'Topoli', 'village', 31.8, 13.4, 450, 0.31, 0.12),
  P('luk', 'Луки', 'Luky', 'village', 44.2, 13.8, 380, 0.37, 0.10),
  P('lis2', 'Ліщинне', 'Lishchynne', 'village', 42.2, 22.6, 520, 0.33, 0.12),
  P('ost', 'Острів', 'Ostriv', 'village', 36.0, 21.6, 260, 0.41, 0.09),
  P('zal', 'Залісся', 'Zalissia', 'village', 46.0, 7.0, 230, 0.44, 0.07),
  P('mez', 'Межове', 'Mezhove', 'village', 46.6, 26.0, 350, 0.36, 0.10),
];

// Вузли без населення: перехрестя, виїзди з громади, лікарня сусідньої громади.
export const JUNCTIONS = {
  xw: [-0.5, 20.6], xe: [52.5, 20.9], xs: [23.4, 38.6], xne: [52.5, 11.2],
  jn1: [17.0, 12.6], jn2: [14.6, 9.4], je1: [36.2, 17.4], je2: [42.0, 18.6], nb: [50.6, 20.4],
};

// Дороги: [від, до, клас, міст]. Класи: national, regional, local, dirt, town.
export const ROADS = [
  ['xw', 'ver', 'national'], ['ver', 'dub', 'national'], ['dub', 'vrw', 'national'], ['vrw', 'vrc', 'town'],
  ['vrc', 'vre', 'town', 'b1'], ['vre', 'ber', 'national'], ['ber', 'je1', 'national'], ['je1', 'je2', 'national'],
  ['je2', 'nb', 'national'], ['nb', 'xe', 'national'],
  ['vrc', 'vrn', 'town'], ['vrn', 'vrw', 'town'],
  ['vrc', 'kle', 'regional'], ['kle', 'hai', 'regional'], ['hai', 'xs', 'regional'],
  ['vrw', 'sta', 'regional'], ['sta', 'yas', 'regional'], ['yas', 'lyp', 'regional'],
  ['vre', 'top', 'regional'], ['top', 'oze', 'regional'], ['oze', 'luk', 'regional'], ['luk', 'xne', 'regional'],
  ['vrn', 'jn1', 'local'], ['jn1', 'jn2', 'local', 'b2'], ['jn2', 'pid', 'dirt'], ['jn2', 'yan', 'local'],
  ['yan', 'vrr', 'local'], ['vrr', 'kal', 'local'], ['kal', 'oze', 'local'], ['kal', 'top', 'dirt'],
  ['sos', 'dub', 'dirt'], ['sos', 'jn1', 'dirt'], ['lis', 'sos', 'dirt'], ['hly', 'ver', 'dirt'], ['hly', 'lis', 'dirt'],
  ['sta', 'kle', 'local'], ['yas', 'ter', 'local'], ['ter', 'buz', 'local'], ['buz', 'kle', 'local'],
  ['vrc', 'yab', 'local'], ['yab', 'mal', 'local'], ['mal', 'kov', 'local'], ['kle', 'kov', 'local'],
  ['kov', 'vys', 'local'], ['vys', 'zap', 'local'], ['zap', 'luh', 'local'], ['luh', 'ste', 'dirt'],
  ['ber', 'ost', 'dirt'], ['ost', 'lis2', 'dirt'], ['je2', 'lis2', 'local'], ['lis2', 'mez', 'local'], ['mez', 'nb', 'local'],
  ['luh', 'mez', 'local', 'b3'], ['oze', 'zal', 'dirt'], ['top', 'je1', 'local'], ['je2', 'luk', 'local'],
];

// Мости. b3: понтонна переправа, у базовому стані не працює.
export const BRIDGES = {
  b1: { open: true, kind: 'bridge' },
  b2: { open: true, kind: 'bridge' },
  b3: { open: false, kind: 'pontoon' },
};

// Заклади. cap: планова кількість мешканців, яких заклад може обслуговувати (умовна).
export const FACILITIES = [
  { id: 'h1', service: 'hospital', node: 'vrc', name: 'h1' },
  { id: 'h2', service: 'hospital', node: 'nb', name: 'h2', outside: true },
  { id: 'a1', service: 'primary', node: 'vrc', name: 'a1', cap: 16000 },
  { id: 'a2', service: 'primary', node: 'vre', name: 'a2', cap: 6000 },
  { id: 'a3', service: 'primary', node: 'yas', name: 'a3', cap: 7500 },
  { id: 'a4', service: 'primary', node: 'oze', name: 'a4', cap: 6000 },
  { id: 'a5', service: 'primary', node: 'dub', name: 'a5', cap: 5000 },
  { id: 'c1', service: 'cnap', node: 'vrc', name: 'c1' },
  { id: 'c2', service: 'cnap', node: 'yas', name: 'c2' },
  { id: 'c3', service: 'cnap', node: 'oze', name: 'c3' },
];

// Автобусні маршрути. trips: кількість рейсів у кожен бік за період (ранок 7 до 9, день 10 до 16, вечір 17 до 20).
export const ROUTES = [
  { id: 'М', stops: ['vrn', 'vrw', 'vrc', 'vre'], trips: { am: 10, day: 24, pm: 9 }, kind: 'urban' },
  { id: '1', stops: ['ver', 'dub', 'vrw', 'vrc', 'vre', 'ber', 'je2', 'nb'], trips: { am: 3, day: 6, pm: 2 }, kind: 'intercity' },
  { id: '2', stops: ['vrc', 'vrw', 'sta', 'yas', 'lyp'], trips: { am: 3, day: 6, pm: 2 } },
  { id: '3', stops: ['vrc', 'vre', 'top', 'oze', 'luk'], trips: { am: 3, day: 6, pm: 2 } },
  { id: '4', stops: ['vrc', 'kle', 'hai'], trips: { am: 2, day: 4, pm: 1 } },
  { id: '5', stops: ['vrc', 'yab', 'mal', 'kov', 'vys', 'zap', 'luh'], trips: { am: 1, day: 2, pm: 0 } },
  { id: '6', stops: ['yas', 'ter', 'buz', 'kle'], trips: { am: 1, day: 2, pm: 0 } },
  { id: '7', stops: ['luh', 'mez', 'nb'], trips: { am: 0, day: 0, pm: 0 }, needs: 'b3', suspended: true },
  { id: '8', stops: ['vrn', 'jn1', 'jn2', 'yan', 'vrr', 'kal', 'oze'], trips: { am: 1, day: 2, pm: 0 } },
];

// Сценарії: що змінюється в мережі.
export const SCENARIOS = {
  ponton: { bridges: { b3: true }, trips: { '7': { am: 3, day: 6, pm: 2 } } },
  drt: { routes: [{ id: 'В', stops: ['hly', 'lis', 'sos', 'dub', 'vrw'], trips: { am: 2, day: 6, pm: 0 }, kind: 'drt' }] },
  rural: { trips: { '4': { am: 3, day: 8, pm: 2 }, '5': { am: 2, day: 4, pm: 1 }, '6': { am: 2, day: 4, pm: 1 }, '8': { am: 2, day: 4, pm: 1 } } },
  newPoint: {},
};
