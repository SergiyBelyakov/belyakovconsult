// Синтетичні дані демо фрод-аналізу: 12 000 отримувачів соціальних виплат умовної області за 12 місяців
// (листопад 2025 – жовтень 2026). Усе вигадане: люди, рахунки, оператори, схеми. Зерно фіксоване.
//
// Закладені схеми (мітка fraud = результат умовного розслідування):
//  ring      мережі на спільних рахунках і телефонах, часто онлайн уночі, частина через оператора OP-17;
//  deceased  виплати продовжуються після смерті отримувача (збіг із реєстром смертей);
//  income    занижений дохід (розбіжність із податковими даними);
//  duplicate одночасно дві несумісні програми;
//  abroad    тривала відсутність при умові проживання.
// Чесні «схожі» випадки: колективні центри ВПО (багато людей на одній адресі), сезонні працівники за кордоном,
// нічні заяви людей зі змінною роботою, багатодітні родини. На них правила часто помиляються.

export const N = 12000;
export const MONTHS = 12;
export const DISTRICTS = ['ruta', 'yasen', 'ozerne', 'klen', 'luh', 'step'];
export const PROGRAMS = ['housing', 'low', 'idp', 'child'];
export const CHANNELS = ['cnap', 'online', 'agent'];
export const SCHEMES = ['ring', 'deceased', 'income', 'duplicate', 'abroad'];
export const OPERATORS = Array.from({ length: 40 }, (_, i) => 'OP-' + String(i + 1).padStart(2, '0'));
export const BAD_OPERATOR = 'OP-17';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generate(seed = 20261107) {
  const r = rng(seed);
  const pick = (arr, w) => { if (!w) return arr[Math.floor(r() * arr.length)]; let x = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; } return arr[arr.length - 1]; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const rows = [];
  let iban = 0, phone = 0, addr = 0;
  const base = i => {
    const program = pick(PROGRAMS, [0.34, 0.28, 0.2, 0.18]);
    const idp = program === 'idp' || r() < 0.04;
    const age = Math.round(Math.min(90, Math.max(18, program === 'child' ? 22 + r() * 18 : 30 + gauss() * 16 + (program === 'housing' ? 14 : 0))));
    const children = program === 'child' ? 1 + Math.floor(r() * 3) : Math.max(0, Math.round(gauss() * 1.1 + (age < 50 ? 1.2 : 0.2)));
    const hh = Math.max(1, children + (r() < 0.6 ? 2 : 1));
    const amount = Math.round({ housing: 1600, low: 3200, idp: 3000, child: 5400 }[program] * (0.75 + r() * 0.5) + children * 380);
    return {
      id: 'R-' + (100001 + i), district: pick(DISTRICTS, [0.32, 0.16, 0.14, 0.14, 0.12, 0.12]), program, idp, age, children, hh,
      amount, months: Math.max(1, Math.min(MONTHS, Math.round(4 + r() * 9))),
      channel: pick(CHANNELS, [0.55, 0.35, 0.1]), operator: pick(OPERATORS), night: r() < 0.04, docMin: r() < 0.09 ? Math.round(3 + r() * 5) : Math.round(14 + r() * 40),
      iban: 'I' + (++iban), phone: 'P' + (++phone), addr: 'A' + (++addr), collective: false,
      deathM: 0, taxRatio: Math.max(0.6, 1 + gauss() * 0.18), abroad: r() < 0.06 ? Math.round(r() * 90) : 0, dup: false,
      scheme: null, fraud: false, month: Math.floor(r() * MONTHS),
    };
  };
  for (let i = 0; i < N; i++) rows.push(base(i));
  const free = () => { let k; do { k = Math.floor(r() * N); } while (rows[k].scheme || rows[k].collective); return rows[k]; };

  // ——— мережі на спільних рахунках ———
  const rings = [];
  for (let g = 0; g < 14; g++) {
    const size = 5 + Math.floor(r() * 8);
    const ibans = ['RI' + g + 'a', 'RI' + g + 'b', 'RI' + g + 'c'].slice(0, 1 + Math.floor(r() * 3));
    const ph = 'RP' + g, district = pick(DISTRICTS), viaOp = r() < 0.55, m0 = Math.floor(r() * 9);
    const members = [];
    for (let k = 0; k < size; k++) {
      const x = free();
      Object.assign(x, {
        scheme: 'ring', fraud: true, district, iban: ibans[k % ibans.length], phone: r() < 0.75 ? ph : x.phone,
        channel: r() < 0.75 ? 'online' : 'agent', night: r() < 0.5, docMin: Math.round(2 + r() * 14),
        operator: viaOp && r() < 0.85 ? BAD_OPERATOR : x.operator, children: 3 + Math.floor(r() * 3), program: r() < 0.6 ? 'child' : 'low',
        month: Math.min(MONTHS - 1, m0 + Math.floor(r() * 3)), idp: false,
      });
      x.hh = x.children + 2; x.amount = Math.round((x.program === 'child' ? 5400 : 3200) + x.children * 380);
      members.push(x.id);
    }
    rings.push({ id: 'G' + (g + 1), members });
  }
  // ——— інші схеми ———
  for (let k = 0; k < 45; k++) { const x = free(); Object.assign(x, { scheme: 'deceased', fraud: true, deathM: 1 + Math.floor(r() * 8), age: 70 + Math.floor(r() * 18), program: 'housing' }); }
  for (let k = 0; k < 110; k++) { const x = free(); Object.assign(x, { scheme: 'income', fraud: true, taxRatio: 2.1 + r() * 3.5, program: pick(['low', 'housing']) }); }
  for (let k = 0; k < 60; k++) { const x = free(); Object.assign(x, { scheme: 'duplicate', fraud: true, dup: true }); }
  for (let k = 0; k < 70; k++) { const x = free(); Object.assign(x, { scheme: 'abroad', fraud: true, abroad: 150 + Math.round(r() * 30) }); }
  // частина шахраїв ховається краще: сигнали слабші
  for (let k = 0; k < 30; k++) { const x = free(); Object.assign(x, { scheme: 'income', fraud: true, taxRatio: 1.15 + r() * 0.4 }); } // майже без слідів
  rows.filter(x => x.fraud && x.scheme !== 'ring' && r() < 0.22).forEach(x => { if (x.scheme === 'income') x.taxRatio = 1.4 + r() * 0.5; if (x.scheme === 'abroad') x.abroad = 100 + Math.round(r() * 40); x.docMin = Math.round(4 + r() * 10); });

  // ——— чесні випадки, схожі на шахрайство ———
  for (let c = 0; c < 6; c++) {                                // колективні центри ВПО
    const a = 'AC' + c, p = 'PC' + c, d = pick(DISTRICTS), n = 40 + Math.floor(r() * 50);
    for (let k = 0; k < n; k++) { const x = free(); Object.assign(x, { addr: a, phone: r() < 0.5 ? p : x.phone, collective: true, idp: true, program: 'idp', district: d, channel: r() < 0.5 ? 'agent' : 'cnap' }); }
  }
  for (let k = 0; k < 90; k++) { const x = free(); x.abroad = 125 + Math.round(r() * 55); }      // сезонна робота, лікування
  for (let k = 0; k < 280; k++) { const x = free(); x.night = true; x.channel = 'online'; }     // нічні зміни
  for (let k = 0; k < 220; k++) { const x = free(); x.taxRatio = 1.6 + r() * 1.4; }            // нерегулярні доходи
  for (let k = 0; k < 220; k++) { const x = free(); const y = free(); y.iban = x.iban; }          // подружжя з одним рахунком
  for (let k = 0; k < 50; k++) { const x = free(); for (let q = 0; q < 2; q++) { const y = free(); y.iban = x.iban; y.phone = x.phone; } } // батьки й дорослі діти
  for (let k = 0; k < 240; k++) { const x = free(); x.children = 4 + Math.floor(r() * 3); x.hh = x.children + 2; x.program = r() < 0.5 ? 'child' : 'low'; x.amount = Math.round((x.program === 'child' ? 5400 : 3200) + x.children * 380); } // багатодітні родини
  for (let k = 0; k < 55; k++) { const x = free(); x.dup = true; }                               // перехідний місяць між програмами

  // ——— похідні ознаки: скільки людей ділять рахунок, телефон, адресу ———
  const count = key => { const m = new Map(); rows.forEach(x => m.set(x[key], (m.get(x[key]) || 0) + 1)); return m; };
  const ci = count('iban'), cp = count('phone'), ca = count('addr');
  const opApproved = new Map(), opAll = new Map();
  rows.forEach(x => { opAll.set(x.operator, (opAll.get(x.operator) || 0) + 1); if (x.children >= 3) opApproved.set(x.operator, (opApproved.get(x.operator) || 0) + 1); });
  const opRate = new Map([...opAll].map(([k, n]) => [k, (opApproved.get(k) || 0) / n]));
  const mean = [...opRate.values()].reduce((a, b) => a + b, 0) / opRate.size;
  const sd = Math.sqrt([...opRate.values()].reduce((a, b) => a + (b - mean) ** 2, 0) / opRate.size) || 1;
  rows.forEach(x => {
    x.sharedIban = ci.get(x.iban) - 1; x.sharedPhone = cp.get(x.phone) - 1; x.sharedAddr = ca.get(x.addr) - 1;
    x.opZ = (opRate.get(x.operator) - mean) / sd;
    x.paid = x.amount * x.months;
    x.taxRatio = Math.round(x.taxRatio * 100) / 100;
  });
  // поділ на навчальну (70%) і перевірочну (30%) вибірки
  rows.forEach(x => { x.test = r() < 0.3; });
  return { rows, rings };
}
