// Піксель-арт гри: персонажі з «Лазерного кошеняти» (кошеня, жуки-баги, капібара на тарілці, капсула)
// плюс свій робот-пилосос, на якому їде кошеня, батарейка життя, зірка еталона і значки вузлів графа.
import { C, pen, kitty } from '../../laser-kitty/src/sprites.js';
export { C, BUG_COLS, pen, kitty, kittyHead, bug, boom, ufo, capsule } from '../../laser-kitty/src/sprites.js';

// Робот-пилосос у три чверті: сріблястий верх із темним центром, графітова стінка з рубіновою смугою,
// колеса, світлодіод і бокова щітка, що крутиться. dir: куди дивиться передок (−1 ліворуч, 1 праворуч)
export function vacuum(ctx, x, y, P, t, dir = 1, opts = {}) {
  const { R, E } = pen(ctx, x, y, P), hurt = opts.hurt;
  E(-15, 2, 15, 6, 'rgba(0,0,0,.45)');
  E(-14, -8, 14, 3, '#2E3440');
  R(-13, 0, 13, 0, hurt ? C.WHITE : C.RUBY);
  R(-12, 2, 12, 2, '#151920');
  R(-9, 3, -7, 4, '#0B0E13'); R(7, 3, 9, 4, '#0B0E13');
  E(-14, -12, 14, -4, hurt ? C.WHITE : C.SILVER);
  E(-12, -11, 12, -5, '#D4DAE3');
  E(-9, -10, 9, -6, '#5C6678');
  R(dir * 13 - (dir > 0 ? 1 : 0), -6, dir * 13 + (dir > 0 ? 0 : 1), -2, '#1B1F27');
  R(dir * 10, -9, dir * 10 + dir, -9, opts.power ? C.AMBER : Math.floor(t * 3) % 2 ? C.FIX : '#1E7F73');
  const s = Math.floor(t * 18) % 4, bx = dir * 13, by = 3;
  R(bx + [-2, 0, 2, 0][s], by + [0, -1, 0, 1][s], bx + [-2, 0, 2, 0][s], by + [0, -1, 0, 1][s], C.WHITE);
  R(bx, by, bx, by, '#8C95A6');
  if (opts.suck) for (let k = 0; k < 3; k++) R(dir * (16 + k * 2), -4 + k, dir * (16 + k * 2), -4 + k, k % 2 ? C.MERGE : C.FIX);
}

// Кошеня верхи на пилососі: кошеня сидить у темному центрі, пилосос малюємо поверх його рубінової платформи
export function rider(ctx, x, y, P, t, opts = {}) {
  kitty(ctx, x, y - 8 * P, P, t, opts.eye || null, opts.blink);
  vacuum(ctx, x, y, P, t, opts.dir || 1, opts);
}

// Батарейка для лічильника життів
export function battery(ctx, x, y, P, full = true) {
  const { R } = pen(ctx, x, y, P);
  R(-5, -3, 4, 3, full ? C.SILVER : C.GREY_D); R(5, -1, 5, 1, full ? C.SILVER : C.GREY_D);
  R(-4, -2, 3, 2, '#0C0F15');
  if (full) { R(-3, -1, -2, 1, C.FIX); R(-1, -1, 0, 1, C.FIX); R(1, -1, 2, 1, C.FIX); }
}

// Зірка еталонного запису
export function star(ctx, x, y, P, c = C.AMBER) {
  const { R } = pen(ctx, x, y, P);
  R(0, -3, 0, -3, c); R(-1, -2, 1, -2, c); R(-3, -1, 3, -1, c); R(-2, 0, 2, 0, c); R(-2, 1, -1, 1, c); R(1, 1, 2, 1, c); R(-3, 2, -3, 2, c); R(3, 2, 3, 2, c);
}

// Значки вузлів: людина коло, домогосподарство будиночок, компанія квадрат з вікнами, заклад ромб,
// джерело труба, док пилососа, порожнє місце після прибирання
export function glyph(ctx, kind, x, y, P, line, fill = '#0F141C', opts = {}) {
  const { R, E } = pen(ctx, x, y, P);
  if (kind === 'p') { E(-4, -4, 4, 4, line); E(-3, -3, 3, 3, fill); R(-1, -2, 1, 0, line); R(-2, 1, 2, 2, line); return; }
  if (kind === 'h') { R(-4, -1, 4, 4, line); R(-3, 0, 3, 3, fill); R(-1, 2, 1, 4, line); for (let k = 0; k <= 4; k++) R(-k, -5 + k, k, -5 + k, line); R(-2, -2, 2, -2, fill); return; }
  if (kind === 'c') { R(-4, -4, 4, 4, line); R(-3, -3, 3, 3, fill); R(-2, -2, -1, -1, line); R(1, -2, 2, -1, line); R(-2, 1, -1, 2, line); R(1, 1, 2, 2, line); return; }
  if (kind === 'i') { for (let k = 0; k <= 5; k++) { R(-k, -5 + k, k, -5 + k, line); R(-k, 5 - k, k, 5 - k, line); } for (let k = 0; k <= 3; k++) { R(-k, -3 + k, k, -3 + k, fill); R(-k, 3 - k, k, 3 - k, fill); } R(-1, -1, 1, 1, line); return; }
  if (kind === 'src') {
    R(-7, -5, 7, 5, line); R(-6, -4, 6, 4, fill); R(-9, -2, -7, 2, line); R(7, -2, 9, 2, line);
    const c = opts.sealed ? C.FIX : C.RUBY_L;
    R(-4, -1, 2, 1, c); R(1, -2, 1, 2, c); R(2, -1, 3, 1, c); R(3, 0, 4, 0, c);
    return;
  }
  if (kind === 'dock') { R(-6, 1, 6, 3, line); R(-5, 2, 5, 2, fill); R(-1, -4, 1, 0, C.FIX); R(-2, -2, 2, -2, C.FIX); return; }
  R(-1, -1, 1, 1, line);
}
