// Піксель-арт спрайти в стилі ролика «Laser Kitty vs the Data Bugs»: рудий котик на рубіновій платформі,
// сірі жуки-баги, капібара-аналітик на тарілці, труба джерела. Малюємо прямокутниками на сітці «пікселів арту».
export const C = {
  BG: '#0C0F15', BG2: '#11151D', RUBY: '#D90429', RUBY_D: '#8C001A', RUBY_L: '#FF6076', WHITE: '#F0F2F6', SILVER: '#AAB2C0', STEEL: '#5C6678', DARK: '#06080C',
  GREY: '#6E7480', GREY_D: '#464B56', WING: '#CDD7E6', CAT: '#F0964A', CAT_D: '#C46C28', CAT_L: '#FFC480', PINK: '#FF8C96',
  CAP: '#A4764E', CAP_D: '#785436', CAP_L: '#C49668', ORANGE: '#FF961E', LEAF: '#58AA54',
  FIX: '#2DD4BF', MERGE: '#C084FC', AMBER: '#FFB020',
};
export const BUG_COLS = ['#969CAA', '#78808E', '#B0B6C2'];

// Пензель: (x0, y0, x1, y1) включно, у пікселях арту відносно точки (ox, oy)
export function pen(ctx, ox, oy, P) {
  const R = (x0, y0, x1, y1, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(ox + Math.min(x0, x1) * P), Math.round(oy + Math.min(y0, y1) * P), (Math.abs(x1 - x0) + 1) * P, (Math.abs(y1 - y0) + 1) * P); };
  const E = (x0, y0, x1, y1, c) => {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 0.5, ry = (y1 - y0) / 2 + 0.5;
    for (let y = y0; y <= y1; y++) { const t = (y + 0.5 - cy - 0.5) / ry, w = rx * Math.sqrt(Math.max(0, 1 - t * t)); const a = Math.round(cx - w + 0.5), b = Math.round(cx + w - 0.5); if (b >= a) R(a, y, b, y, c); }
  };
  return { R, E };
}

export function kitty(ctx, x, y, P, t, eye = null, blink = false) {
  const { R } = pen(ctx, x, y, P);
  const fl = 2 + (Math.floor(t * 24) % 3);
  for (const fx of [-7, 6]) { R(fx, 0, fx + 1, fl, C.RUBY_L); R(fx, fl + 1, fx, fl + 1, C.WHITE); }
  R(-11, -4, 11, -1, C.RUBY); R(-10, -4, 10, -4, C.RUBY_L); R(-11, -1, 11, -1, C.RUBY_D);
  // тільце й лапки
  R(-6, -10, 6, -4, C.CAT); R(-5, -11, 5, -11, C.CAT); R(-4, -12, 4, -12, C.CAT);
  R(-5, -5, -3, -4, C.CAT_L); R(3, -5, 5, -4, C.CAT_L);
  // хвіст, що махає
  const tw = Math.round(Math.sin(t * 7) * 2);
  R(6, -8, 8, -7, C.CAT_D); R(9, -10 + tw, 10, -8, C.CAT_D); R(9, -14 + tw, 10, -10 + tw, C.CAT_D);
  // голова
  R(-8, -20, 8, -14, C.CAT); R(-7, -22, 7, -12, C.CAT); R(-6, -23, 6, -11, C.CAT);
  for (const s of [-1, 1]) {   // вуха
    R(s * 8, -24, s * 4, -21, C.CAT); R(s * 8, -26, s * 6, -24, C.CAT); R(s * 7, -27, s * 7, -27, C.CAT);
    R(s * 6, -23, s * 6, -23, C.PINK);
  }
  R(-3, -21, 3, -20, C.CAT_D);
  for (const ex of [-4, 3]) {
    if (eye) { R(ex - 1, -18, ex + 2, -15, eye); R(ex, -17, ex + 1, -16, C.WHITE); }
    else if (blink) R(ex, -17, ex + 1, -17, C.DARK);
    else { R(ex, -18, ex + 1, -16, C.DARK); R(ex, -18, ex, -18, C.WHITE); }
  }
  R(0, -14, 0, -14, C.PINK); R(-2, -13, -1, -13, C.CAT_D); R(1, -13, 2, -13, C.CAT_D); R(0, -12, 0, -12, C.CAT_D);
  for (const s of [-1, 1]) { R(s * 5, -14, s * 11, -14, C.CAT_L); R(s * 5, -12, s * 11, -12, C.CAT_L); }
}
export const kittyEyes = (x, y, P) => [[x - 3.5 * P, y - 17 * P], [x + 4 * P, y - 17 * P]];

// Маленька голова кошеняти для лічильника життів
export function kittyHead(ctx, x, y, P) {
  const { R } = pen(ctx, x, y, P);
  R(-4, -4, 4, 2, C.CAT); R(-3, -5, 3, 3, C.CAT);
  R(-4, -7, -2, -5, C.CAT); R(2, -7, 4, -5, C.CAT);
  R(-2, -2, -2, -1, C.DARK); R(2, -2, 2, -1, C.DARK); R(0, 0, 0, 0, C.PINK);
}

export function bug(ctx, x, y, P, t, col, opts = {}) {
  const { R, E } = pen(ctx, x, y, P);
  const wing = Math.floor(t * 14 + x) % 2, body = opts.flash ? C.WHITE : col;
  for (const s of [-1, 1]) { const wy = -3 - wing; E(s * 3 - 3, wy - 2, s * 3 + 3, wy + 2, opts.dim ? '#5C6470' : C.WING); }
  for (const j of [-1, 0, 1]) for (const s of [-1, 1]) { const ly = j * 2 + ((Math.floor(t * 8) + j) % 2 ? 1 : -1); R(s * 4, j * 2, s * 5, j * 2, C.GREY_D); R(s * 6, ly, s * 6, ly, C.GREY_D); }
  E(-4, -4, 4, 5, body);
  R(0, -3, 0, 4, C.GREY_D); R(-2, -2, -2, -2, C.WHITE);
  E(-3, -7, 3, -3, opts.boss ? C.RUBY_D : C.GREY_D);
  R(-2, -6, -1, -5, opts.eyes || C.RUBY_L); R(1, -6, 2, -5, opts.eyes || C.RUBY_L);
  R(-2, -8, -2, -8, C.GREY); R(-3, -9, -3, -9, C.GREY); R(2, -8, 2, -8, C.GREY); R(3, -9, 3, -9, C.GREY);
}

export function boom(ctx, x, y, P, u, big = false) {
  if (u < 0.18) { const r = 2 + Math.floor(u * 30); ctx.fillStyle = u < 0.08 ? C.WHITE : C.RUBY_L; ctx.fillRect(x - r * P * 0.5, y - r * P * 0.5, r * P, r * P); }
  const n = big ? 10 : 7;
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n + 0.3, rr = (3 + u * (big ? 26 : 16)) * P * 0.6;
    if (u < 0.9) { ctx.fillStyle = [C.WHITE, C.RUBY_L, '#FFBE5A'][k % 3]; ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), P, P); }
  }
}

function capybara(ctx, x, y, P, t, face = 1) {
  const { R, E } = pen(ctx, x, y, P), f = face;
  for (const lx of [-9, -4, 5, 10]) R(lx - 1, -4, lx + 1, 0, C.CAP_D);
  R(-14, -15, 14, -4, C.CAP); R(-13, -17, 13, -16, C.CAP); R(-12, -16, 10, -15, C.CAP_L);
  const hx = 13 * f;
  R(hx, -22, hx + 11 * f, -11, C.CAP);
  R(hx + 8 * f, -18, hx + 12 * f, -12, C.CAP_D);
  R(hx + 11 * f, -17, hx + 11 * f, -17, C.DARK);
  R(hx + 4 * f - 1, -20, hx + 4 * f, -19, C.DARK);
  R(hx + f - 1, -24, hx + f, -22, C.CAP_D);
  E(hx + 2 * f - 3, -29, hx + 2 * f + 3, -23, C.ORANGE);
  R(hx + 2 * f, -30, hx + 2 * f, -30, C.LEAF);
}
export function ufo(ctx, x, y, P, t, face = 1) {
  capybara(ctx, x, y - 4 * P, P * 0.6, t, face);
  const { R, E } = pen(ctx, x, y, P * 0.6);
  E(-24, -6, 24, 4, C.STEEL); E(-20, -6, 20, -1, C.SILVER);
  for (let k = 0; k < 5; k++) R(-16 + k * 8, 0, -15 + k * 8, 1, (Math.floor(t * 8) + k) % 2 ? C.RUBY_L : C.WHITE);
}
export function capsule(ctx, x, y, P, t) {
  const { R } = pen(ctx, x, y, P);
  R(-5, -4, 5, 4, C.RUBY); R(-4, -5, 4, 5, C.RUBY); R(-3, -3, 3, 3, (Math.floor(t * 6) % 2) ? C.WHITE : C.RUBY_L); R(-1, -1, 1, 1, C.RUBY);
}
export function pipe(ctx, x, y, P, label, sealed, sealLabel) {
  const { R } = pen(ctx, x, y, P);
  R(-22, -30, 22, 4, C.STEEL); R(-26, 0, 26, 8, C.SILVER); R(-18, 8, 18, 10, C.DARK);
  ctx.fillStyle = C.WHITE; ctx.font = `700 ${Math.round(4.2 * P)}px ui-monospace, Menlo, Consolas, monospace`; ctx.textAlign = 'center';
  label.forEach((l, k) => ctx.fillText(l, x, y + (-19 + k * 9) * P));
  if (sealed > 0) {
    const w = Math.round(54 * Math.min(1, sealed * 1.6));
    R(-w / 2 - 2, -2, w / 2 + 2, 18, C.RUBY); R(-w / 2 - 2, -2, w / 2 + 2, -2, C.WHITE); R(-w / 2 - 2, 18, w / 2 + 2, 18, C.WHITE);
    if (sealed > 0.4) { ctx.fillStyle = C.WHITE; ctx.font = `700 ${Math.round(3.6 * P)}px ui-monospace, Menlo, Consolas, monospace`; sealLabel.forEach((l, k) => ctx.fillText(l, x, y + (6 + k * 8) * P)); }
  }
  ctx.textAlign = 'left';
}
