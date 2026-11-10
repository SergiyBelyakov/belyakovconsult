// Шість дослідів: що гравець прогнозує, що робить на автоматі і які числа йдуть у розбір.
// Усі числа розбору рахуються з рушія (точно з таблиць або симуляцією із зерном), у текстах немає чисел «з голови».
import { MACHINES, simulate, streakStudy, summary, share, histogram } from './engine.js';

export const LESSON_IDS = ['ev', 'sample', 'memory', 'near', 'risk', 'boss'];
export const PLAYERS = 1000;
// machine: на якому автоматі йде дослід; spins: скільки обертів треба; options: скільки варіантів прогнозу
export const LESSONS = {
  ev: { machine: 'cat', spins: 30, options: 4 },
  sample: { machine: 'cat', spins: 20, options: 4 },
  memory: { machine: 'cat', streak: 5, options: 3 },
  near: { machine: 'cat', spins: 25, options: 3 },
  risk: { machine: 'capy', each: 10, options: 3 },
  boss: { machine: 'cat', options: 4 },
};

const memo = {};
const once = (key, fn) => (memo[key] || (memo[key] = fn()));
const nearest = (list, v) => list.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(list[b] - v) ? i : b), 0);

// ——— дослідження за автоматом (не залежать від гравця) ———
export const SAMPLE_NS = [20, 2000, 20000], RTP_AXIS = { min: 0, max: 250, bins: 25 };
function sampleStudy() {
  return once('sample', () => SAMPLE_NS.map((n, k) => {
    const { net } = simulate(MACHINES.cat, { players: PLAYERS, spins: n, seed: 2026 + k }), rtp = Array.from(net, v => 100 * (1 + v / n)), s = summary(rtp);
    return { n, plus: Math.round(share(net, v => v > 0) * PLAYERS), p10: s.p10, p90: s.p90, bins: histogram(rtp, RTP_AXIS), rtp };
  }));
}
export const RISK_SPINS = 100, RISK_LOSS = 30, NET_AXIS = { min: -80, max: 120, bins: 20 };
function riskStudy() {
  return once('risk', () => Object.fromEntries(['capy', 'cat'].map((id, k) => {
    const { net } = simulate(MACHINES[id], { players: PLAYERS, spins: RISK_SPINS, seed: 511 + k }), s = summary(net);
    return [id, { mean: s.mean, p10: s.p10, p90: s.p90, lose: Math.round(share(net, v => v < -RISK_LOSS) * 100), plus: Math.round(share(net, v => v > 0) * 100), bins: histogram(net, NET_AXIS), hit: MACHINES[id].stats.hit * 100 }];
  })));
}
function memoryStudy() {
  return once('memory', () => {
    const M = MACHINES.cat, q = 1 - M.stats.hit, k = LESSONS.memory.streak, st = streakStudy(M, { spins: 1e6, k, seed: 3 });
    // середнє очікування серії з k програшів поспіль
    return { all: st.all * 100, after: st.after * 100, wait: (1 - q ** k) / ((1 - q) * q ** k), spins: st.spins };
  });
}
export const BOSS_N = 1000;
export function bossMath(p = MACHINES.cat.stats.pAudit) {
  const by = n => (1 - (1 - p) ** n) * 100;
  return { p, odds: Math.round(1 / p), by, by1000: by(BOSS_N), by3000: by(3000), none1000: 100 - by(BOSS_N), median: Math.ceil(Math.log(0.5) / Math.log(1 - p)) };
}

// ——— правильна відповідь на прогноз (індекс варіанта) ———
export function correct(id) {
  const S = MACHINES.cat.stats;
  if (id === 'ev') return nearest([15, 30 * S.rtp, 30, 36], 30 * S.rtp);
  if (id === 'sample') return nearest([50, 250, 500, 750], sampleStudy()[0].plus);
  if (id === 'memory') return 1;
  if (id === 'near') return nearest([S.pLine3 * 100, 10, 50], S.pScreen3 * 100);
  if (id === 'risk') { const r = riskStudy(); return r.cat.lose > r.capy.lose * 1.5 ? 1 : r.capy.lose > r.cat.lose * 1.5 ? 0 : 2; }
  return nearest([100, 370, 630, 1000], bossMath().by1000 * 10);
}
// Числа, які потрібні тексту запитання ще до досліду
export function facts() {
  const S = MACHINES.cat.stats;
  return { rtp: S.rtp * 100, edge: S.edge * 100, evBack: Math.round(30 * S.rtp), hitEvery: Math.round(1 / S.hit), line3: S.pLine3 * 100, auditOdds: Math.round(1 / S.pAudit), jackOdds: Math.round(1 / S.pCatLine),
    nearRatio: Math.round(S.pScreen3 / S.pLine3), by1000: Math.round(bossMath().by1000) };
}

// ——— облік досліду: що сталося на автоматі в гравця ———
export function newRun(id) {
  return { id, n: 0, wagered: 0, paid: 0, wins: 0, nears: 0, lined: 0, streak: 0, armed: false, sixth: null, by: { cat: { n: 0, wins: 0, net: 0 }, capy: { n: 0, wins: 0, net: 0 } }, audit: null, refills: 0, done: false };
}
// res: результат оберту з гри (Slot.spin). Повертає true, коли дослід виконано.
export function feed(run, res) {
  const L = LESSONS[run.id], win = res.win > 0;
  run.n++; run.wagered += res.bet; run.paid += res.win; if (win) run.wins++;
  if (res.near >= 0) run.nears++;
  if (res.kind === 1 && res.key.length === 3) run.lined++;
  const m = run.by[res.machine]; m.n++; m.net += res.win - res.bet; if (win) m.wins++;
  if (run.id === 'memory') {
    if (run.armed) { run.sixth = win; run.done = true; }
    else { run.streak = win ? 0 : run.streak + 1; if (run.streak >= L.streak) run.armed = true; }
  } else if (run.id === 'risk') run.done = run.by.cat.n >= L.each && run.by.capy.n >= L.each;
  else if (run.id === 'boss') { if (res.kind === 3) { run.audit = { at: run.n, burned: res.burned }; run.done = true; } }
  else run.done = run.n >= L.spins;
  return run.done;
}
// Поступ для смужки: [зроблено, усього, додатковий стан]
export function progress(run) {
  const L = LESSONS[run.id], live = { wagered: run.wagered, paid: run.paid, wins: run.wins, nears: run.nears };
  if (run.id === 'memory') return run.armed ? { now: L.streak, of: L.streak, armed: true, live } : { now: run.streak, of: L.streak, armed: false, live };
  if (run.id === 'risk') return { now: Math.min(L.each, run.by.capy.n) + Math.min(L.each, run.by.cat.n), of: L.each * 2, capy: Math.min(L.each, run.by.capy.n), cat: Math.min(L.each, run.by.cat.n), each: L.each, live };
  if (run.id === 'boss') return { now: run.n, of: 0, live };
  return { now: Math.min(run.n, L.spins), of: L.spins, live };
}

// ——— числа для розбору ———
export function debrief(run) {
  const S = MACHINES.cat.stats, id = run.id;
  if (id === 'ev') {
    const jack = S.rows.find(r => r.key === 'CCC');
    return { n: run.n, wagered: run.wagered, paid: run.paid, wins: run.wins, pct: (100 * run.paid) / run.wagered, rtp: S.rtp * 100, edge: S.edge * 100, per: S.edge, jack: jack.contrib * 100, noJack: (S.rtp - jack.contrib) * 100, jackOdds: Math.round(1 / jack.p), hit: S.hit * 100, hitEvery: Math.round(1 / S.hit), rows: S.rows };
  }
  if (id === 'sample') return { n: run.n, pct: (100 * run.paid) / run.wagered, rtp: S.rtp * 100, sets: sampleStudy() };
  if (id === 'memory') return { sixth: run.sixth, took: run.n, k: LESSONS.memory.streak, ...memoryStudy() };
  if (id === 'near') return { n: run.n, seen: run.nears, lined: run.lined, line: S.pLine3 * 100, screen: S.pScreen3 * 100, ratio: Math.round(S.pScreen3 / S.pLine3), catRatio: Math.round(S.pCatScreen / S.pCatLine) };
  if (id === 'risk') return { run: run.by, sim: riskStudy(), rtp: S.rtp * 100, spins: RISK_SPINS, loss: RISK_LOSS, mean: -S.edge * RISK_SPINS };
  const b = bossMath();
  return { at: run.audit.at, burned: run.audit.burned, refills: run.refills, lost: run.wagered - run.paid, ...b };
}
