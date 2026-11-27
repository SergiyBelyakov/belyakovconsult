// Міста продажів на карті України: координати в просторі карти chart-gallery/src/ukraine-geo.js (та сама рівновелика
// проєкція Альберса, ширина 1000). Лише підконтрольні Україні міста; вага: умовна частка ринку для синтетичних клієнтів.
// [id, назва, name, регіон, x, y, вага]
export const CITY_ROWS = [
  ['kyiv', 'Київ', 'Kyiv', 'kyc', 471.2, 162.7, 30],
  ['brovary', 'Бровари', 'Brovary', 'kyo', 485.6, 157.7, 1.1],
  ['bilatserkva', 'Біла Церква', 'Bila Tserkva', 'kyo', 449.1, 217.6, 2],
  ['boryspil', 'Бориспіль', 'Boryspil', 'kyo', 494.3, 171.1, 0.6],
  ['fastiv', 'Фастів', 'Fastiv', 'kyo', 437.9, 193.7, 0.5],
  ['lviv', 'Львів', 'Lviv', 'lvi', 117.4, 194.9, 7.5],
  ['drohobych', 'Дрогобич', 'Drohobych', 'lvi', 84.7, 233.2, 0.75],
  ['odesa', 'Одеса', 'Odesa', 'ode', 478.5, 498.3, 9.5],
  ['izmail', 'Ізмаїл', 'Izmail', 'ode', 365.5, 591.4, 0.7],
  ['dnipro', 'Дніпро', 'Dnipro', 'dni', 722.1, 326.3, 9.5],
  ['kryvyirih', 'Кривий Ріг', 'Kryvyi Rih', 'dni', 630.7, 376.4, 5.5],
  ['kamianske', 'Кам’янське', 'Kamianske', 'dni', 697.1, 323.4, 2.2],
  ['pavlohrad', 'Павлоград', 'Pavlohrad', 'dni', 767.9, 318.1, 1],
  ['kharkiv', 'Харків', 'Kharkiv', 'kha', 780.4, 193.7, 12],
  ['zaporizhzhia', 'Запоріжжя', 'Zaporizhzhia', 'zap', 729.9, 378.9, 6.5],
  ['vinnytsia', 'Вінниця', 'Vinnytsia', 'vin', 356.6, 262.6, 3.7],
  ['poltava', 'Полтава', 'Poltava', 'pol', 690.7, 232.5, 2.8],
  ['kremenchuk', 'Кременчук', 'Kremenchuk', 'pol', 629.9, 278.6, 2.1],
  ['chernihiv', 'Чернігів', 'Chernihiv', 'chn', 512.6, 74.5, 2.8],
  ['sumy', 'Суми', 'Sumy', 'sum', 699.4, 120.6, 2.5],
  ['zhytomyr', 'Житомир', 'Zhytomyr', 'zhy', 370.2, 176.7, 2.6],
  ['berdychiv', 'Бердичів', 'Berdychiv', 'zhy', 366.1, 206.6, 0.7],
  ['rivne', 'Рівне', 'Rivne', 'riv', 242.5, 139.1, 2.4],
  ['lutsk', 'Луцьк', 'Lutsk', 'vol', 193.8, 124.7, 2.1],
  ['kovel', 'Ковель', 'Kovel', 'vol', 164.5, 82.6, 0.65],
  ['ternopil', 'Тернопіль', 'Ternopil', 'ter', 200.5, 226.4, 2.2],
  ['ivanofrankivsk', 'Івано-Франківськ', 'Ivano-Frankivsk', 'ivf', 147.5, 275.6, 2.4],
  ['uzhhorod', 'Ужгород', 'Uzhhorod', 'zak', 10.8, 287.0, 1.1],
  ['mukachevo', 'Мукачево', 'Mukachevo', 'zak', 32.9, 305.1, 0.85],
  ['chernivtsi', 'Чернівці', 'Chernivtsi', 'chv', 211.4, 334.2, 2.6],
  ['khmelnytskyi', 'Хмельницький', 'Khmelnytskyi', 'khm', 275.9, 242.6, 2.7],
  ['kamianets', 'Кам’янець-Подільський', 'Kamianets-Podilskyi', 'khm', 250.0, 303.6, 1],
  ['cherkasy', 'Черкаси', 'Cherkasy', 'che', 554.4, 247.9, 2.7],
  ['uman', 'Умань', 'Uman', 'che', 452.5, 306.3, 0.8],
  ['kropyvnytskyi', 'Кропивницький', 'Kropyvnytskyi', 'kir', 566.3, 327.0, 2.2],
  ['oleksandriia', 'Олександрія', 'Oleksandriia', 'kir', 613.8, 312.6, 0.75],
  ['mykolaiv', 'Миколаїв', 'Mykolaiv', 'myk', 552.2, 456.8, 4.4],
];
export const CITIES = CITY_ROWS.map(([id, uk, en, region, x, y, w], i) => ({ i, id, uk, en, region, x, y, w }));
export const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));
// Склади: головний у Броварах, регіональні у Львові й Дніпрі (Дніпро відкрито у вересні 2025 року)
export const HUBS = [
  { id: 'brovary', city: 'brovary', from: 0 },
  { id: 'lviv', city: 'lviv', from: 0 },
  { id: 'dnipro', city: 'dnipro', from: 8 },
];
// Регіони без продажів у даних (тимчасово окуповані або прифронтові території)
export const NO_SALES = new Set(['luh', 'don', 'cri', 'sev', 'khe']);
// Відстань у кілометрах: 1 одиниця карти ≈ 1,3 км (ширина країни ≈ 1 300 км)
export const KM = 1.3;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * KM;
