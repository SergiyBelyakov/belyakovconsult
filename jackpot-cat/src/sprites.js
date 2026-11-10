// Піксель-арт символи барабанів у стилі «Лазерного кошеняти»: котик, капібара з мандаринкою, мандаринка,
// три баги даних (дубль, NULL, тест) і Data Boss. Малюємо прямокутниками на сітці «пікселів арту»;
// точка (x, y) це центр клітинки барабана, P це розмір пікселя арту.
import { pen, C } from '../../laser-kitty/src/sprites.js';

export { C };
export const PAPER = '#ECEFF4', PAPER_D = '#D3D9E2', INK = '#1A1F29';
const SKIN = '#E8BA96', SKIN_D = '#C4926F', HAIR = '#5C3E28', HAIR_L = '#805A3C', JACKET = '#1A1C22', JACKET_L = '#343842', LENS = '#CDDEEC', FRAME = '#1E1E24';
const SNOUT = '#8C6440', AMBER = '#FFB020';

// Котик: руда голова анфас і рубіновий шарф. hot: лазерні очі (виграш).
function cat(ctx, x, y, P, t, o) {
  const { R } = pen(ctx, x, y + 10 * P, P);
  // плечі й шарф
  R(-7, -3, 7, 0, C.CAT); R(-6, -4, 6, -4, C.CAT); R(-3, -1, 3, 0, C.CAT_L);
  R(-6, -6, 6, -5, C.RUBY); R(-6, -6, 6, -6, C.RUBY_L); R(4, -4, 5, -1, C.RUBY); R(4, -1, 5, -1, C.RUBY_D);
  // голова
  R(-8, -16, 8, -9, C.CAT); R(-7, -18, 7, -7, C.CAT); R(-6, -19, 6, -7, C.CAT);
  for (const s of [-1, 1]) {
    R(s * 8, -20, s * 4, -17, C.CAT); R(s * 8, -22, s * 6, -20, C.CAT); R(s * 7, -23, s * 7, -23, C.CAT);
    R(s * 6, -20, s * 6, -19, C.PINK);
    R(s * 5, -10, s * 11, -10, C.CAT_D); R(s * 5, -8, s * 10, -8, C.CAT_D);   // вуса
  }
  R(-3, -18, 3, -17, C.CAT_D); R(-1, -16, 1, -16, C.CAT_D);
  const blink = !o.hot && (t + x * 0.01) % 4.3 < 0.12;
  for (const ex of [-4, 3]) {
    if (o.hot) { R(ex - 1, -15, ex + 2, -12, C.RUBY_L); R(ex, -14, ex + 1, -13, C.WHITE); }
    else if (blink) R(ex - 1, -13, ex + 2, -13, INK);
    else { R(ex, -15, ex + 1, -12, INK); R(ex, -15, ex, -15, C.WHITE); }
  }
  R(0, -10, 0, -10, C.PINK); R(-2, -9, -1, -9, C.CAT_D); R(1, -9, 2, -9, C.CAT_D); R(0, -8, 0, -8, C.CAT_D);
  R(-5, -11, -3, -10, C.CAT_L); R(3, -11, 5, -10, C.CAT_L);
}

// Капібара: спокійна прямокутна морда анфас, на голові мандаринка
function capy(ctx, x, y, P, t, o) {
  const { R, E } = pen(ctx, x, y + 11 * P, P);
  R(-8, -3, 8, 0, C.CAP); R(-7, -5, 7, -4, C.RUBY); R(-7, -5, 7, -5, C.RUBY_L);   // плечі й нашийник
  R(-9, -9, -8, -7, C.CAP_D); R(8, -9, 9, -7, C.CAP_D);
  R(-8, -18, 8, -6, C.CAP); R(-7, -19, 7, -6, C.CAP); R(-6, -17, 4, -16, C.CAP_L);
  for (const s of [-1, 1]) { R(s * 8, -20, s * 6, -19, C.CAP_D); R(s * 7, -21, s * 7, -21, C.CAP_D); }   // вушка
  R(-6, -13, 6, -6, SNOUT); R(-5, -14, 5, -6, SNOUT); R(-4, -12, 4, -12, C.CAP);
  R(-3, -11, -2, -10, INK); R(2, -11, 3, -10, INK); R(-1, -8, 1, -8, C.CAP_D); R(0, -9, 0, -8, C.CAP_D);
  // напівзаплющені очі; hot: очі відкриті й сяють
  for (const ex of [-6, 5]) {
    if (o.hot) { R(ex, -16, ex + 1, -15, C.RUBY_L); R(ex, -16, ex, -16, C.WHITE); }
    else { R(ex, -15, ex + 1, -15, INK); R(ex - 1, -16, ex + 2, -16, C.CAP_D); }
  }
  const bob = o.hot ? Math.round(Math.sin(t * 9)) : 0;
  E(-3, -25 + bob, 3, -20 + bob, C.ORANGE); R(-2, -24 + bob, -1, -23 + bob, '#FFC06A'); R(0, -26 + bob, 1, -26 + bob, C.LEAF);
}

// Мандаринка капібари: дрібний частий виграш
function tang(ctx, x, y, P, t, o) {
  const { R, E } = pen(ctx, x, y + 8 * P, P);
  E(-8, -15, 8, 0, '#E07A0C'); E(-8, -16, 8, -2, C.ORANGE);
  R(-5, -13, -3, -11, '#FFC06A'); R(-6, -11, -5, -9, '#FFC06A');
  R(-1, -5, 0, -5, '#E07A0C'); R(3, -8, 3, -7, '#E07A0C'); R(-4, -3, -4, -3, '#E07A0C');
  R(-1, -18, 0, -16, '#6B4A2A'); R(1, -19, 5, -18, C.LEAF); R(2, -20, 4, -20, C.LEAF); R(3, -17, 5, -17, '#3F8A3C');
  if (o.hot) { R(-9, -19, -9, -18, C.WHITE); R(9, -12, 10, -12, C.WHITE); R(8, -20, 8, -20, C.WHITE); }
}

// Тільце жука з «Лазерного кошеняти», але параметричне: колір, порожнє (hollow), шахове (checker)
function bugBody(ctx, x, y, P, t, body, o = {}) {
  const { R, E } = pen(ctx, x, y, P);
  const wing = o.still ? 0 : Math.floor(t * 10 + x) % 2, edge = o.edge || C.GREY_D;
  for (const s of [-1, 1]) E(s * 4 - 3, -4 - wing - 2, s * 4 + 3, -4 - wing + 2, o.wing || '#B9C4D6');
  for (const j of [-1, 0, 1]) for (const s of [-1, 1]) { R(s * 5, j * 2 + 1, s * 6, j * 2 + 1, edge); R(s * 7, j * 2 + (j < 0 ? 0 : 2), s * 7, j * 2 + (j < 0 ? 0 : 2), edge); }
  E(-5, -4, 5, 7, edge); E(-4, -3, 4, 6, body);
  if (o.hollow) { E(-3, -2, 3, 5, PAPER); }
  else if (o.checker) {
    for (let yy = -3; yy <= 6; yy++) { const tt = (yy - 1.5) / 5, w = 4.5 * Math.sqrt(Math.max(0, 1 - tt * tt)); for (let xx = -4; xx <= 4; xx++) if (Math.abs(xx) <= w - 0.4 && (Math.floor((xx + 4) / 2) + Math.floor((yy + 3) / 2)) % 2) R(xx, yy, xx, yy, INK); }
  }
  else { R(0, -2, 0, 5, edge); R(-2, -1, -2, -1, C.WHITE); }
  E(-3, -8, 3, -4, edge);
  if (o.hollow) R(-1, -7, 1, -6, PAPER);
  else { R(-2, -7, -1, -6, o.eyes || C.RUBY_L); R(1, -7, 2, -6, o.eyes || C.RUBY_L); }
  R(-2, -9, -2, -9, edge); R(-3, -10, -3, -10, edge); R(2, -9, 2, -9, edge); R(3, -10, 3, -10, edge);
}
// Табличка з назвою бага під жуком (як картка запису в «Лазерному кошеняті»)
function tag(ctx, x, y, P, text, col) {
  const w = Math.round(21 * P), h = Math.round(6.4 * P);
  ctx.fillStyle = INK; ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, h);
  ctx.fillStyle = col; ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, Math.max(1, Math.round(P * 0.7)));
  ctx.fillStyle = '#F4F6F8'; ctx.font = `700 ${Math.round(4.6 * P)}px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + h / 2 + P * 0.5); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
// ДУБЛЬ: той самий жук двічі. NULL: порожній контур. ТЕСТ: жук у шахову клітинку, як тестова таблиця.
function dup(ctx, x, y, P, t, o) {
  bugBody(ctx, x + 4 * P, y - 7 * P, P, t, '#B6BCC8', { still: o.still, edge: '#8A909C', wing: '#D3DAE6', eyes: '#F0A0AA' });
  bugBody(ctx, x - 3 * P, y - 3 * P, P, t, '#8E96A4', { still: o.still });
  tag(ctx, x, y + 6 * P, P, o.labels.dup, '#8E96A4');
}
function nul(ctx, x, y, P, t, o) {
  bugBody(ctx, x, y - 4 * P, P, t, PAPER, { still: o.still, hollow: true, edge: '#7C8494', wing: '#DCE2EC' });
  tag(ctx, x, y + 6 * P, P, o.labels.null, '#7C8494');
}
function test(ctx, x, y, P, t, o) {
  bugBody(ctx, x, y - 4 * P, P, t, AMBER, { still: o.still, checker: true, edge: '#3A3F4A', eyes: C.WHITE });
  tag(ctx, x, y + 6 * P, P, o.labels.test, AMBER);
}

// Data Boss: аналітик в окулярах і чорній водолазці (персонаж із ролика «Data Boss»). hot: лазерні окуляри.
function boss(ctx, x, y, P, t, o) {
  const { R } = pen(ctx, x, y + 12 * P, P);
  R(-10, -5, 10, 0, JACKET); R(-9, -6, 9, -6, JACKET); R(-6, -5, -5, 0, JACKET_L); R(5, -5, 6, 0, JACKET_L);
  R(-3, -8, 3, -5, '#0E0E12'); R(-2, -4, 2, -4, '#0E0E12');
  R(-6, -21, 6, -8, SKIN); R(-5, -22, 5, -7, SKIN); R(-7, -15, -7, -12, SKIN_D); R(7, -15, 7, -12, SKIN_D);
  R(-6, -9, -6, -8, SKIN_D); R(6, -9, 6, -8, SKIN_D);
  R(-6, -24, 6, -21, HAIR); R(-7, -22, -6, -19, HAIR); R(6, -22, 7, -19, HAIR);
  for (let k = -5; k <= 5; k += 2) R(k, -25 - (Math.abs(k) % 4 === 1 ? 1 : 0), k, -24, HAIR);
  R(-4, -23, 2, -23, HAIR_L);
  // брови: одна вище, інша нижче («підозріло»)
  R(-6, -19, -2, -19, HAIR); R(2, -18, 6, -18, HAIR); R(-6, -20, -5, -20, HAIR);
  for (const ex of [-6, 1]) {
    R(ex, -17, ex + 5, -13, FRAME);
    if (o.hot) { R(ex + 1, -16, ex + 4, -14, C.RUBY_L); R(ex + 2, -15, ex + 3, -15, C.WHITE); }
    else { R(ex + 1, -16, ex + 4, -14, LENS); R(ex + 2, -16, ex + 3, -14, '#28303A'); R(ex + 1, -16, ex + 1, -16, C.WHITE); }
  }
  R(0, -16, 0, -16, FRAME); R(-7, -16, -7, -16, FRAME); R(7, -16, 7, -16, FRAME);
  R(0, -12, 0, -11, SKIN_D);
  if (o.hot && Math.floor(t * 8) % 2) { R(-2, -9, 2, -8, '#782830'); R(-1, -9, 1, -9, C.WHITE); } else R(-2, -9, 2, -9, '#8A5A48');
}
// Точки очей Data Boss (для лазерів під час аудиту), у пікселях полотна
export const bossEyes = (x, y, P) => [[x - 3.5 * P, y - 3 * P], [x + 3.5 * P, y - 3 * P]];

const DRAW = [cat, capy, tang, dup, nul, test, boss];
// sym: індекс символу (як у рушії); opt: { hot, still, labels: { dup, null, test } }
export function drawSymbol(ctx, sym, x, y, P, t, opt) { DRAW[sym](ctx, Math.round(x), Math.round(y), P, t, opt); }

// Картинка символу для таблиці виплат (DOM): окреме маленьке полотно → data URL
export function symbolImage(sym, labels, P = 2) {
  const c = document.createElement('canvas'), size = 30 * P;
  c.width = size; c.height = size;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  drawSymbol(ctx, sym, size / 2, size / 2, P, 0.5, { still: true, labels });
  return c.toDataURL('image/png');
}
