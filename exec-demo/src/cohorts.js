// Когорти: утримання працівників за кварталом найму і клієнтів за кварталом першої покупки.
// Працівники: щомісячний ризик звільнення = згладжена частка добровільних звільнень підрозділу × множник стажу
// (перші 3 місяці ×2,2, до пів року ×1,5, до року ×1, далі ×0,8). Клієнти: синтетичні когорти, узгоджені з сюжетом
// (виробництво: зрив відвантажень з липня 2026; сервіс: падіння NPS і повторних візитів у Східній філії).
import { MONTHS } from './data.js';
import { dataFor, pick } from './model.js';

export const STAFF_COLS = [3, 6, 9, 12, 18];
export const CLIENT_COLS = [1, 2, 3, 4, 5];
const tenureMult = j => (j <= 3 ? 2.2 : j <= 6 ? 1.5 : j <= 12 ? 1 : 0.8);
const qKey = q => `${2025 + Math.floor(q / 4)}-Q${(q % 4) + 1}`;

export function staffCohorts(ind, unit, i) {
  const D = dataFor(ind), units = pick(D, unit);
  const rate = units.map(u => u.rows.map((_, t) => {
    const w = u.rows.slice(Math.max(0, t - 2), t + 1);
    return w.reduce((a, r) => a + r.vol / Math.max(1, r.hc), 0) / w.length;
  }));
  const nQ = Math.floor(i / 3) + 1;
  const rows = [];
  for (let q = 0; q < nQ; q++) {
    const months = [3 * q, 3 * q + 1, 3 * q + 2].filter(s => s <= i);
    let hires = 0;
    const acc = STAFF_COLS.map(() => ({ w: 0, s: 0 }));
    units.forEach((u, ui) => months.forEach(s => {
      const n = u.rows[s].hires;
      if (!n) return;
      hires += n;
      let surv = 1;
      for (let j = 1; j <= 18 && s + j <= i; j++) {
        surv *= 1 - Math.min(0.5, rate[ui][s + j] * tenureMult(j));
        const c = STAFF_COLS.indexOf(j);
        if (c >= 0) { acc[c].w += n; acc[c].s += n * surv; }
      }
    }));
    rows.push({ key: qKey(q), hires, cells: acc.map(a => (a.w ? a.s / a.w : null)) });
  }
  return rows.filter(r => r.hires > 0 && r.cells.some(c => c != null));
}

export function clientCohorts(ind, unit, i) {
  const D = dataFor(ind);
  const nQ = Math.floor(i / 3) + 1;
  const rows = [];
  if (ind === 'mfg') {
    // нові замовники за квартал і ймовірність лишитися наступного кварталу (з 3 кв. 2026 зриви відвантажень)
    const NEW = [9, 7, 8, 10, 8, 9, 7, 8];
    const keep = q => (q >= 6 ? 0.86 : 0.94);
    for (let q = 0; q < nQ; q++) {
      const cells = CLIENT_COLS.map(k => {
        if (3 * (q + k) + 2 > i) return null;
        let r = 1; for (let j = 1; j <= k; j++) r *= keep(q + j);
        return r;
      });
      if (cells.some(c => c != null)) rows.push({ key: qKey(q), n: NEW[q] || 8, cells });
    }
    return { rows, unit: 'all' };
  }
  const units = pick(D, unit).filter(u => u.kind === 'branch' || u.kind === 'online');
  const us = units.length ? units : D.units.filter(u => u.kind === 'branch' || u.kind === 'online');
  for (let q = 0; q < nQ; q++) {
    const months = [3 * q, 3 * q + 1, 3 * q + 2].filter(s => s <= i);
    let n = 0;
    const acc = CLIENT_COLS.map(() => ({ w: 0, s: 0 }));
    us.forEach(u => {
      const nNew = months.reduce((a, s) => a + u.rows[s].clients * (1 - u.rows[s].repeat), 0);
      n += nNew;
      CLIENT_COLS.forEach((k, c) => {
        if (3 * (q + k) + 2 > i) return;
        let r = 1;
        for (let j = 1; j <= k; j++) r *= Math.min(0.92, Math.max(0.3, u.rows[Math.min(i, 3 * (q + j) + 1)].repeat * 1.35));
        acc[c].w += nNew; acc[c].s += nNew * r;
      });
    });
    const cells = acc.map(a => (a.w ? a.s / a.w : null));
    if (cells.some(c => c != null)) rows.push({ key: qKey(q), n, cells });
  }
  return { rows, unit: units.length === 1 ? units[0].id : 'all' };
}
export const monthOfQuarter = key => MONTHS.indexOf(key.replace(/-Q(\d)/, (m, d) => '-' + String((d - 1) * 3 + 1).padStart(2, '0')));
