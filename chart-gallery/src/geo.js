// Плиткова карта України: 27 регіонів у сітці 8 × 6 (рівні плитки замість меж: площа не спотворює значення).
// Пошук регіону за назвою українською чи англійською, з «область» / «обл.» / «oblast» або кодом ISO 3166-2.
// [id, назва, name, ISO, колонка, рядок, коротка назва, short]
export const REGIONS = [
  ['vol', 'Волинська', 'Volyn', 'UA-07', 1, 0, 'Волинська', 'Volyn'],
  ['riv', 'Рівненська', 'Rivne', 'UA-56', 2, 0, 'Рівненська', 'Rivne'],
  ['zhy', 'Житомирська', 'Zhytomyr', 'UA-18', 3, 0, 'Житомирська', 'Zhytomyr'],
  ['kyo', 'Київська', 'Kyiv Oblast', 'UA-32', 4, 0, 'Київська', 'Kyiv Obl.'],
  ['chn', 'Чернігівська', 'Chernihiv', 'UA-74', 5, 0, 'Чернігівська', 'Chernihiv'],
  ['sum', 'Сумська', 'Sumy', 'UA-59', 6, 0, 'Сумська', 'Sumy'],
  ['lvi', 'Львівська', 'Lviv', 'UA-46', 1, 1, 'Львівська', 'Lviv'],
  ['ter', 'Тернопільська', 'Ternopil', 'UA-61', 2, 1, 'Тернопільська', 'Ternopil'],
  ['khm', 'Хмельницька', 'Khmelnytskyi', 'UA-68', 3, 1, 'Хмельницька', 'Khmelnytskyi'],
  ['kyc', 'м. Київ', 'Kyiv City', 'UA-30', 4, 1, 'м. Київ', 'Kyiv City'],
  ['pol', 'Полтавська', 'Poltava', 'UA-53', 5, 1, 'Полтавська', 'Poltava'],
  ['kha', 'Харківська', 'Kharkiv', 'UA-63', 6, 1, 'Харківська', 'Kharkiv'],
  ['luh', 'Луганська', 'Luhansk', 'UA-09', 7, 1, 'Луганська', 'Luhansk'],
  ['zak', 'Закарпатська', 'Zakarpattia', 'UA-21', 0, 2, 'Закарпатська', 'Zakarpattia'],
  ['ivf', 'Івано-Франківська', 'Ivano-Frankivsk', 'UA-26', 1, 2, 'Ів.-Франківська', 'Ivano-Frank.'],
  ['chv', 'Чернівецька', 'Chernivtsi', 'UA-77', 2, 2, 'Чернівецька', 'Chernivtsi'],
  ['vin', 'Вінницька', 'Vinnytsia', 'UA-05', 3, 2, 'Вінницька', 'Vinnytsia'],
  ['che', 'Черкаська', 'Cherkasy', 'UA-71', 4, 2, 'Черкаська', 'Cherkasy'],
  ['dni', 'Дніпропетровська', 'Dnipropetrovsk', 'UA-12', 5, 2, 'Дніпропетр.', 'Dnipropetr.'],
  ['don', 'Донецька', 'Donetsk', 'UA-14', 6, 2, 'Донецька', 'Donetsk'],
  ['ode', 'Одеська', 'Odesa', 'UA-51', 3, 3, 'Одеська', 'Odesa'],
  ['kir', 'Кіровоградська', 'Kirovohrad', 'UA-35', 4, 3, 'Кіровоградська', 'Kirovohrad'],
  ['zap', 'Запорізька', 'Zaporizhzhia', 'UA-23', 5, 3, 'Запорізька', 'Zaporizhzhia'],
  ['myk', 'Миколаївська', 'Mykolaiv', 'UA-48', 4, 4, 'Миколаївська', 'Mykolaiv'],
  ['khe', 'Херсонська', 'Kherson', 'UA-65', 5, 4, 'Херсонська', 'Kherson'],
  ['sev', 'м. Севастополь', 'Sevastopol', 'UA-40', 4, 5, 'Севастополь', 'Sevastopol'],
  ['cri', 'Автономна Республіка Крим', 'Crimea', 'UA-43', 5, 5, 'АР Крим', 'Crimea'],
];
const STEMS = {
  vol: ['волин', 'volyn', 'volhyn'], riv: ['рівн', 'rivne', 'rovno', 'rivnen'], zhy: ['житомир', 'zhytomyr', 'zhitomir'],
  kyo: ['київськ', 'київщин', 'kyivsk', 'kyiv obl', 'kyiv reg', 'kiev obl', 'kyiv oblast'], chn: ['черніг', 'chernih', 'chernig'], sum: ['сумськ', 'суми', 'sumy', 'sumsk'],
  lvi: ['львів', 'lviv', 'lvov'], ter: ['терноп', 'ternop'], khm: ['хмельн', 'khmeln', 'khmel'], kyc: ['київ', 'kyiv', 'kiev', 'kyiv city'],
  pol: ['полтав', 'poltav'], kha: ['харк', 'kharkiv', 'kharkov'], luh: ['луган', 'luhansk', 'lugansk'], zak: ['закарпат', 'zakarpat', 'transcarpath'],
  ivf: ['івано', 'ів -франк', 'ів франк', 'ivano'], chv: ['чернівец', 'чернівц', 'chernivts', 'chernovts'], vin: ['вінниц', 'vinnyts', 'vinnits'],
  che: ['черкас', 'cherkas'], dni: ['дніпр', 'dnipro', 'dnepr'], don: ['донец', 'donets'], ode: ['одес', 'odes'],
  kir: ['кіровоград', 'кропивн', 'kirovohrad', 'kropyvn'], zap: ['запоріз', 'запоріж', 'zaporiz', 'zaporoz'], myk: ['миколаїв', 'mykolai', 'nikolae'],
  khe: ['херсон', 'kherson'], sev: ['севастоп', 'sevastop'], cri: ['крим', 'арк', 'автономна', 'crimea', 'krym'],
};
const ORDER = ['kyo', 'chv', 'chn', 'che', 'kyc', 'vol', 'riv', 'zhy', 'sum', 'lvi', 'ter', 'khm', 'pol', 'kha', 'luh', 'zak', 'ivf', 'vin', 'dni', 'don', 'ode', 'kir', 'zap', 'myk', 'khe', 'sev', 'cri'];
// \b у JavaScript не бачить меж кириличних слів, тому службові слова відкидаємо за списком
const STOP = new Set(['область', 'обл', 'oblast', 'region', 'м', 'місто', 'city', 'the']);
const norm = s => String(s || '').toLowerCase().replace(/[’'`ʼ"«»().,]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join(' ');
export function matchRegion(name) {
  const raw = String(name || '').trim();
  const iso = raw.toUpperCase().match(/^UA-?(\d{2})$/);
  if (iso) { const r = REGIONS.find(x => x[3] === 'UA-' + iso[1]); return r ? r[0] : null; }
  const n = norm(raw), low = raw.toLowerCase();
  if (!n) return null;
  // «Київська», «Kyiv Oblast» раніше за місто «Київ»
  if (/(київськ|київщин|kyivsk|kyiv\s*(obl|reg)|kiev\s*obl)/.test(low)) return 'kyo';
  const words = n.split(' ');
  for (const id of ORDER) if (id !== 'kyo' && STEMS[id].some(s => n.startsWith(s) || words.some(w => w.startsWith(s)))) return id;
  return null;
}
export const regionById = Object.fromEntries(REGIONS.map(r => [r[0], r]));

export function prepMap(get, o, L) {
  const names = get.text('region'), vals = get.num('value'), warn = [];
  const m = new Map(), unknown = new Set(), dupSeen = new Set();
  let dup = 0;
  names.forEach((nm, i) => {
    if (!nm) return;
    const id = matchRegion(nm);
    if (!id) { unknown.add(nm); return; }
    if (!Number.isFinite(vals[i])) return;
    if (dupSeen.has(id)) dup++; dupSeen.add(id);
    m.set(id, (m.get(id) || 0) + vals[i]);
  });
  if (unknown.size) warn.push(['unknownRegions', unknown.size, [...unknown].slice(0, 4).join(', ')]);
  if (dup) warn.push(['mapDup', dup]);
  if (!m.size) return { error: ['noRegions'] };
  const vs = [...m.values()];
  return { values: m, min: Math.min(...vs), max: Math.max(...vs), warn, valueName: get.name('value'), table: { head: [get.name('region'), get.name('value')], rows: REGIONS.map(r => [L.lang === 'en' ? r[2] : r[1], m.has(r[0]) ? m.get(r[0]) : null]) } };
}
