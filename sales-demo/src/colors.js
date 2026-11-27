// Кольори бренд-буку за ролями. Перевірено на розрізнення при дальтонізмі (OKLab, Machado 2009) для темного тла:
// впливи в мосту різняться із сусідами (мінімум 14,5), канали різняться всі між собою (мінімум 13,8),
// полярність Cyan/Coral як у демо прогнозування. Рубіновий: прибуток поточного року і обране.
import { BRAND } from '../../forecast-demo/src/charts.jsx';

export { BRAND };
export const EFF_COL = { vol: BRAND.cobalt, mix: BRAND.magenta, price: BRAND.cyan, cost: BRAND.amber, nw: BRAND.teal, lost: BRAND.violet };
export const TOT0 = BRAND.silver, TOT1 = BRAND.ruby;
export const CH_COL = [BRAND.cobalt, BRAND.amber, BRAND.magenta, BRAND.cyan, BRAND.white];   // мережі, роздріб, HoReCa, онлайн, субдистриб’ютори
export const POS = BRAND.cyan, NEG = BRAND.coral, MID = '#2A3342';
export const REV = BRAND.cobalt, GP = BRAND.ruby;

// Розбіжна шкала: від Coral через нейтральний до Cyan, t від −1 до 1
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixc = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export const diverge = t => (!Number.isFinite(t) ? MID : t >= 0 ? mixc(MID, POS, Math.min(1, t) ** 0.8) : mixc(MID, NEG, Math.min(1, -t) ** 0.8));
// Послідовна шкала одного відтінку (Cobalt) для величини: t від 0 до 1
export const seq = (t, c = BRAND.cobalt) => (!Number.isFinite(t) ? MID : mixc('#141B27', c, 0.12 + 0.88 * Math.max(0, Math.min(1, t)) ** 0.85));
export { mixc };
