// Кольори галереї. Порядок категорійних кольорів перевірено валідатором dataviz на темному тлі #0E131B:
// суміжні пари проходять перевірку для дальтонізму (найгірша ΔE 8,5), тож порядок не змінюємо й не повторюємо по колу.
// П'ятий колір вохра: бірюзовий бренду поруч із ціановим для звичайного зору майже не відрізнявся (ΔE 5,4).
// Шостий і далі елементи згортаються в «Інші» (сірий). Рубіновий лише для виділеного елемента.
export const SERIES = ['#3B82F6', '#EC4899', '#0894A8', '#A855F7', '#B47308'];
export const OTHER = '#64748B';
// Для точок (розсіювання, бульбашки, радар) до трьох груп: трійка проходить перевірку для всіх пар (ΔE 13,6),
// форма маркера лишається додатковою ознакою
export const GROUP3 = ['#3B82F6', '#EC4899', '#B47308'];
export const SHAPES = ['circle', 'square', 'diamond'];
// Послідовна шкала одного відтінку: від темного (мало) до світлого (багато); перевірено як порядкова
export const SEQ = ['#2A4F86', '#2963AF', '#2E78D2', '#3F8FEB', '#5CA7FB', '#82BFFF', '#ACD5FF'];
// Розбіжна: два протилежні полюси й сірий нейтральний центр
export const DIV = { neg2: '#F467B2', neg1: '#B84A85', mid: '#4B5563', pos1: '#3C79D1', pos2: '#6AAEFF' };
export const UP = '#3B82F6', DOWN = '#EC4899', TOTAL = '#94A3B8';
export const EMPH = '#D90429', EMPH_HI = '#F0153B', DIM = '#475569';
export const INK = { primary: '#F4F6F8', secondary: '#C9D0DA', muted: '#A8B0BC', faint: '#7E8896' };
export const SURFACE = '#0E131B', GRID = '#1E2632', BASE = '#3A4454', TRACK = '#1C2A42';
export const STATUS = { good: '#10B981', warn: '#FFB020', bad: '#FF6B6B' };
// Біваріантна шкала 3 × 3 для темного тла: X до синього, Y до вохри, обидва високі до світлого кремового.
// Кути в OKLCH, середина білінійно в OKLab. Валідатор dataviz для кожного рядка і стовпця (сусідні класи):
// найгірша ΔE для дальтонізму 14,4, для звичайного зору 17,9. Індекс [клас Y][клас X], 0 низький.
export const BIVAR = [['#262F38', '#286086', '#0095DD'], ['#734F32', '#888987', '#95C6E0'], ['#C66C00', '#E2AF7E', '#F8F2DC']];
// Зони часу доїзду (як у демо транспортної доступності): світліше означає ближче; поза межею штрихування вохрою
export const ISO = ['#9CC0F0', '#6E9FE0', '#4A7EC8', '#2A5AA6'];

export const seriesColor = k => (k < SERIES.length ? SERIES[k] : OTHER);

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
// Безперервна послідовна шкала: t від 0 до 1
export function seq(t) {
  if (!Number.isFinite(t)) return GRID;
  const x = Math.max(0, Math.min(1, t)) * (SEQ.length - 1), i = Math.min(SEQ.length - 2, Math.floor(x)), f = x - i;
  const a = hex(SEQ[i]), b = hex(SEQ[i + 1]);
  return toHex(a.map((v, k) => v + (b[k] - v) * f));
}
// Текст поверх заливки: білий або майже чорний за яскравістю тла
export function inkOn(fill) {
  const [r, g, b] = hex(fill).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? '#0B0F16' : '#FFFFFF';
}
