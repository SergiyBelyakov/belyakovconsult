// Сесія гри: баланс, ставка, оберт, каса автомата і ряд для журналу.
// Малювання й React тут немає: клас працює і в браузері, і в перевірках у node.
import { MACHINES, KIND, START_CREDITS, spin, mulberry } from './engine.js';

export const BETS = [1, 2, 5, 10];
const KEY = 'bc-jackpot-cat-v1';
const BLANK = { v: 1, done: {}, back: false, life: { spins: 0, wagered: 0, paid: 0, audits: 0, burned: 0 } };

// Збережене між візитами: пройдені досліди, відкрита задня кришка і довічна статистика. Баланс не зберігається.
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return { ...BLANK, ...s, life: { ...BLANK.life, ...s.life } }; } catch { /* приватний режим або зіпсовані дані */ }
  return JSON.parse(JSON.stringify(BLANK));
}
export function store(save) { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* сховище недоступне */ } }

export class Slot {
  constructor({ seed, life } = {}) {
    this.rand = mulberry(seed == null ? (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0 : seed);
    this.machine = 'cat'; this.bet = 1; this.credits = START_CREDITS;
    this.v = { spins: 0, wagered: 0, paid: 0, wins: 0, audits: 0, burned: 0, refills: 0, fakes: 0, nears: 0 };   // цей візит
    this.life = life || { spins: 0, wagered: 0, paid: 0, audits: 0, burned: 0 };
    // журнал: накопичений результат звичайної гри (виплати мінус ставки), очікування і дисперсія для коридору
    this.series = { net: [0], exp: [0], vr: [0], audits: [] };
    this.stops = [0, 0, 0];
  }
  get M() { return MACHINES[this.machine]; }
  get take() { return this.v.wagered - this.v.paid + this.v.burned; }   // скільки автомат заробив за візит
  get rtp() { return this.v.wagered ? this.v.paid / this.v.wagered : null; }
  canSpin() { return this.credits >= this.bet; }
  setMachine(id) { if (MACHINES[id]) this.machine = id; }
  setBet(b) { if (BETS.includes(b)) this.bet = b; }
  refill() { this.credits += START_CREDITS; this.v.refills++; }

  // Один оберт. Результат одразу в балансі; інтерфейс показує його після зупинки барабанів.
  spin() {
    if (!this.canSpin()) return null;
    const M = this.M, r = spin(M, this.rand), bet = this.bet, v = this.v, life = this.life, S = this.series;
    this.credits -= bet;
    const win = r.pay * bet;
    let burned = 0;
    if (r.kind === KIND.audit) { burned = this.credits; this.credits = 0; v.audits++; v.burned += burned; life.audits++; life.burned += burned; S.audits.push(v.spins + 1); }
    else this.credits += win;
    v.spins++; v.wagered += bet; v.paid += win; life.spins++; life.wagered += bet; life.paid += win;
    if (win > 0) v.wins++;
    if (r.kind === KIND.fake) v.fakes++;
    if (r.near >= 0) v.nears++;
    const k = S.net.length - 1;
    S.net.push(S.net[k] + win - bet); S.exp.push(S.exp[k] - M.stats.edge * bet); S.vr.push(S.vr[k] + (M.stats.sd * bet) ** 2);
    this.stops = r.stops;
    return { ...r, bet, win, burned, credits: this.credits, machine: this.machine, n: v.spins };
  }
}
