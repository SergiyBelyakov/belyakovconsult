// Рушій автомата «Котячий джекпот»: стрічки барабанів, таблиця виплат, точна математика й симуляції.
// Чистий JavaScript без DOM: той самий код працює в браузері й у перевірках у node.
// Автомат чесний: кожен барабан зупиняється на випадковій позиції своєї стрічки, без підкручувань.

export const SYMS = ['cat', 'capy', 'tang', 'dup', 'null', 'test', 'boss'];
export const CODE = 'CPTDNXB';   // котик, капібара, мандаринка, баги (дубль, NULL, тест), Data Boss
const strip = s => Array.from(s, ch => CODE.indexOf(ch));

// Два автомати з однаковим поверненням 92,0% і однаковим шансом аудиту (1 з 1000), але різним розкидом:
// «Котик» платить рідко й багато, «Капібара» часто й потроху. Стрічки по 20 позицій.
const DEFS = {
  cat: {
    strips: ['CNPTXBDPTNCXPTDBNPTX', 'PXTCNPDTBXPNTCDPXBTN', 'TDPXTBNCPTXDTPBNTCXP'],
    pay: { CCC: 100, PPP: 25, TTT: 10, CC: 4, PP: 2, TT: 2, T: 0 },
  },
  capy: {
    strips: ['PXTDNPBXTDCNPXTBDNPX', 'TNPXDBPTXNDPCXTNBDPX', 'PDTNPXBPDTXNPCDTBXPN'],
    pay: { CCC: 25, PPP: 12, TTT: 4, CC: 5, PP: 3, TT: 2, T: 1 },
  },
};
export const MACHINE_IDS = ['cat', 'capy'];
export const ROWS = ['CCC', 'PPP', 'TTT', 'CC', 'PP', 'TT', 'T'];
export const KIND = { none: 0, win: 1, fake: 2, audit: 3 };
export const START_CREDITS = 100;

// Результат лінії з трьох символів. Три Data Boss: аудит. Три однакові баги: «фальшивий виграш» (платить 0).
export function evaluate(a, b, c, pay) {
  if (a === b && b === c) {
    if (a === 6) return { kind: KIND.audit, key: 'BBB', pay: 0 };
    const key = CODE[a].repeat(3);
    return a <= 2 ? { kind: KIND.win, key, pay: pay[key] } : { kind: KIND.fake, key, pay: 0 };
  }
  for (let s = 0; s < 3; s++) {
    if ((a === s) + (b === s) + (c === s) === 2) { const key = CODE[s] + CODE[s]; return pay[key] ? { kind: KIND.win, key, pay: pay[key] } : { kind: KIND.none, key: null, pay: 0 }; }
  }
  if (pay.T && (a === 2) + (b === 2) + (c === 2) === 1) return { kind: KIND.win, key: 'T', pay: pay.T };
  return { kind: KIND.none, key: null, pay: 0 };
}

const mod = (n, m) => ((n % m) + m) % m;
// Вікно барабана: над лінією наступний символ стрічки, під лінією попередній (барабан крутиться вниз)
export const windowOf = (st, i) => [st[mod(i + 1, st.length)], st[i], st[mod(i - 1, st.length)]];

function compile(id) {
  const def = DEFS[id], strips = def.strips.map(strip), pay = def.pay, L = strips.map(s => s.length);
  const size = L[0] * L[1] * L[2], pays = new Int16Array(size), kinds = new Uint8Array(size);
  const rows = Object.fromEntries(ROWS.map(k => [k, { key: k, pay: pay[k], n: 0 }]));
  let ev = 0, ev2 = 0, hit = 0, audit = 0, fake = 0, boss2 = 0, screen3 = 0, line3 = 0, catScreen = 0;
  // чи видно символ s у вікні барабана r на зупинці i
  const sees = strips.map(st => st.map((_, i) => { const w = windowOf(st, i), f = new Uint8Array(7); w.forEach(s => { f[s] = 1; }); return f; }));
  for (let i = 0; i < L[0]; i++) for (let j = 0; j < L[1]; j++) for (let k = 0; k < L[2]; k++) {
    const a = strips[0][i], b = strips[1][j], c = strips[2][k], r = evaluate(a, b, c, pay), ix = (i * L[1] + j) * L[2] + k;
    pays[ix] = r.pay; kinds[ix] = r.kind;
    ev += r.pay; ev2 += r.pay * r.pay;
    if (r.kind === KIND.win) { hit++; rows[r.key].n++; if (r.key.length === 3) line3++; }
    else if (r.kind === KIND.audit) audit++;
    else if (r.kind === KIND.fake) fake++;
    if ((a === 6) + (b === 6) + (c === 6) === 2) boss2++;
    const A = sees[0][i], B = sees[1][j], C = sees[2][k];
    if ((A[0] && B[0] && C[0]) || (A[1] && B[1] && C[1]) || (A[2] && B[2] && C[2])) screen3++;
    if (A[0] && B[0] && C[0]) catScreen++;
  }
  const rtp = ev / size, list = ROWS.map(k => ({ ...rows[k], p: rows[k].n / size, contrib: (rows[k].n / size) * rows[k].pay })).filter(r => r.pay > 0);
  const counts = strips.map(st => { const c = new Array(7).fill(0); st.forEach(s => c[s]++); return c; });
  return {
    id, strips, pay, L, size, pays, kinds, counts,
    stats: {
      rtp, edge: 1 - rtp, sd: Math.sqrt(ev2 / size - rtp * rtp), hit: hit / size, pAudit: audit / size, pFake: fake / size, pBoss2: boss2 / size,
      pNone: 1 - hit / size, rows: list, pScreen3: screen3 / size, pLine3: line3 / size, pCatScreen: catScreen / size, pCatLine: rows.CCC.n / size,
    },
  };
}
export const MACHINES = Object.fromEntries(MACHINE_IDS.map(id => [id, compile(id)]));

// Генератор випадкових чисел із зерном (mulberry32): симуляції для розборів відтворювані
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Один оберт: три незалежні зупинки. flags: що було видно на екрані, крім лінії.
export function spinAt(M, i, j, k) {
  const { strips, L } = M, ix = (i * L[1] + j) * L[2] + k;
  const win = [windowOf(strips[0], i), windowOf(strips[1], j), windowOf(strips[2], k)], line = [win[0][1], win[1][1], win[2][1]];
  const r = evaluate(line[0], line[1], line[2], M.pay);
  // «майже»: три однакові виграшні символи на екрані (по одному на барабан), але не трійка на лінії
  let near = -1;
  if (!(r.kind === KIND.win && r.key.length === 3)) for (let s = 0; s < 3 && near < 0; s++) if (win.every(w => w.includes(s))) near = s;
  const bosses = (line[0] === 6) + (line[1] === 6) + (line[2] === 6);
  return { stops: [i, j, k], window: win, line, kind: M.kinds[ix], key: r.key, pay: M.pays[ix], near, bosses };
}
export function spin(M, rand) {
  return spinAt(M, Math.floor(rand() * M.L[0]), Math.floor(rand() * M.L[1]), Math.floor(rand() * M.L[2]));
}

// «Тисяча гравців»: кожен робить spins обертів по 1 кредиту. Повертає чистий результат (виплати мінус ставки)
// і номер оберту першого аудиту (0, якщо аудиту не було). Аудит у чистий результат не входить: він забирає баланс окремо.
export function simulate(M, { players, spins, seed = 1 }) {
  // одна випадкова клітинка з усіх L×L×L комбінацій зупинок: те саме, що три незалежні барабани, але втричі швидше
  const rand = mulberry(seed), { size, pays, kinds } = M, net = new Float32Array(players), first = new Int32Array(players);
  for (let p = 0; p < players; p++) {
    let sum = 0, f = 0;
    for (let n = 1; n <= spins; n++) {
      const ix = Math.floor(rand() * size);
      sum += pays[ix] - 1;
      if (!f && kinds[ix] === KIND.audit) f = n;
    }
    net[p] = sum; first[p] = f;
  }
  return { net, first };
}

// Чи пам'ятає автомат: частка виграшних обертів загалом і одразу після k програшів поспіль
export function streakStudy(M, { spins, k = 5, seed = 1 }) {
  const rand = mulberry(seed), { size, pays } = M;
  let wins = 0, after = 0, afterWins = 0, streak = 0;
  for (let n = 0; n < spins; n++) {
    const w = pays[Math.floor(rand() * size)] > 0;
    if (streak >= k) { after++; if (w) afterWins++; }
    if (w) { wins++; streak = 0; } else streak++;
  }
  return { all: wins / spins, after: afterWins / after, nAfter: after, spins };
}

export function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
export function summary(values) {
  const s = Float32Array.from(values).sort(), n = s.length;
  let sum = 0; for (let i = 0; i < n; i++) sum += s[i];
  return { n, mean: sum / n, p10: quantile(s, 0.1), p50: quantile(s, 0.5), p90: quantile(s, 0.9), min: s[0], max: s[n - 1], sorted: s };
}
export const share = (values, test) => { let c = 0; for (let i = 0; i < values.length; i++) if (test(values[i])) c++; return c / values.length; };
export function histogram(values, { min, max, bins }) {
  const out = new Array(bins).fill(0), w = (max - min) / bins;
  for (let i = 0; i < values.length; i++) { const b = Math.floor((values[i] - min) / w); out[Math.max(0, Math.min(bins - 1, b))]++; }
  return out;
}
