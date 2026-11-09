// Герої гри векторно: котик на електросамокаті, капібара на електроскейті (з мандаринкою, як у «Лазерному кошеняті»),
// голова аналітика в окулярах на моноколесі. Локальні координати рами в метрах: x уперед, y угору, центр мас у нулі.

export const RC = {
  ruby: '#D90429', dark: '#06080C', steel: '#AAB2C0', deck: '#283142', tire: '#121821', tireL: '#3A4558', rim: '#C9D0D9',
  cat: '#F0964A', catD: '#C46C28', catL: '#FFC480', pink: '#FF8C96',
  cap: '#A4764E', capD: '#785436', capL: '#C49668', snout: '#8C6440', orange: '#FF961E', leaf: '#58AA54',
  skin: '#F1C29B', skinD: '#D9A07A', hair: '#2B2E37', suit: '#2A2D36', glass: '#1A1D24',
};
const lerp = (a, b, t) => a + (b - a) * t;
function seg(ctx, a, b, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function toLocal(sc, x, y) { const c = Math.cos(sc.a), s = Math.sin(sc.a), dx = x - sc.x, dy = y - sc.y; return [c * dx + s * dy, -s * dx + c * dy]; }

// колесо у світових координатах; mono: велике колесо з мотором у маточині
function wheel(ctx, V, W, r, kind) {
  const x = V.X(W.x), y = V.Y(W.y), R = r * V.s;
  ctx.fillStyle = kind === 'skate' ? '#E8ECF2' : RC.tire; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = kind === 'skate' ? '#9AA6B8' : RC.tireL; ctx.lineWidth = Math.max(2, 0.045 * V.s); ctx.stroke();
  if (kind === 'skate') {
    ctx.fillStyle = RC.ruby; ctx.beginPath(); ctx.arc(x, y, R * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1, 0.015 * V.s);
    const a = -W.phi; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2); ctx.lineTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); ctx.stroke();
    return;
  }
  ctx.strokeStyle = RC.rim; ctx.lineWidth = Math.max(1.2, 0.022 * V.s);
  ctx.beginPath(); ctx.arc(x, y, R * 0.6, 0, Math.PI * 2); ctx.stroke();
  const n = kind === 'mono' ? 5 : 3;
  for (let k = 0; k < n; k++) { const a = -W.phi + (k * 2 * Math.PI) / n; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * (kind === 'mono' ? 0.32 : 0), y + Math.sin(a) * R * (kind === 'mono' ? 0.32 : 0)); ctx.lineTo(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.6); ctx.stroke(); }
  if (kind === 'mono') { ctx.fillStyle = '#3A4558'; ctx.beginPath(); ctx.arc(x, y, R * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = RC.ruby; ctx.lineWidth = Math.max(1.5, 0.02 * V.s); ctx.stroke(); }
  else { ctx.fillStyle = RC.ruby; ctx.beginPath(); ctx.arc(x, y, Math.max(2, R * 0.16), 0, Math.PI * 2); ctx.fill(); }
}

// ——— котик ———
function catPose(L) {
  const a = Math.abs(L);
  return {
    hip: [-0.17 + 0.05 * L, -0.06 - 0.03 * a], sh: [0.09 + 0.12 * L, 0.22 - 0.04 * a],
    head: [0.16 + 0.14 * L, 0.52 - 0.05 * a], grip: [0.43, 0.61], feet: [[-0.3, -0.32], [-0.08, -0.32]],
  };
}
function catTail(ctx, L, sp, t) {
  const P = catPose(L), sw = Math.sin(t * (4 + sp * 8)) * (0.05 + sp * 0.05);
  ctx.strokeStyle = RC.catD; ctx.lineWidth = 0.065; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(P.hip[0] - 0.06, P.hip[1] + 0.04);
  ctx.bezierCurveTo(-0.45, 0.0 + sw, -0.55 - sp * 0.1, 0.12 + sw, -0.6 - sp * 0.15, 0.3 - sp * 0.12 + sw * 2); ctx.stroke();
}
function cat(ctx, L, sp, t, withLegs) {
  const P = catPose(L), [hx, hy] = P.head, blink = t % 3.7 < 0.13;
  const leg = (from, knee, to, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.quadraticCurveTo(knee[0], knee[1], to[0], to[1]); ctx.stroke(); };
  if (withLegs) {
    leg(P.hip, [P.hip[0] + 0.1, P.hip[1] - 0.14], P.feet[0], RC.catD, 0.075);
    leg(P.hip, [P.hip[0] + 0.16, P.hip[1] - 0.1], P.feet[1], RC.cat, 0.08);
  }
  seg(ctx, P.hip, P.sh, 0.25, RC.cat);
  seg(ctx, [P.hip[0] + 0.05, P.hip[1] - 0.02], [P.sh[0] + 0.04, P.sh[1] - 0.06], 0.1, RC.catL);
  ctx.strokeStyle = RC.catD; ctx.lineWidth = 0.025;
  for (const k of [0.3, 0.5]) { const x = lerp(P.hip[0], P.sh[0], k), y = lerp(P.hip[1], P.sh[1], k); ctx.beginPath(); ctx.moveTo(x - 0.07, y + 0.07); ctx.lineTo(x - 0.02, y + 0.11); ctx.stroke(); }
  if (withLegs) leg(P.sh, [(P.sh[0] + P.grip[0]) / 2 + 0.02, (P.sh[1] + P.grip[1]) / 2 - 0.06], P.grip, RC.cat, 0.07);
  else leg(P.sh, [P.sh[0] + 0.2, P.sh[1] + 0.1], [P.sh[0] + 0.3, P.sh[1] + 0.25], RC.cat, 0.07);
  // рубіновий шарф, кінці тріпочуть за швидкістю
  const nk = [lerp(P.sh[0], hx, 0.55), lerp(P.sh[1], hy, 0.5)], fl = Math.sin(t * 14) * 0.03 * sp;
  ctx.strokeStyle = RC.ruby; ctx.lineWidth = 0.075; ctx.beginPath(); ctx.moveTo(nk[0] - 0.08, nk[1] - 0.02); ctx.lineTo(nk[0] + 0.08, nk[1] + 0.02); ctx.stroke();
  ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(nk[0] - 0.07, nk[1]);
  ctx.quadraticCurveTo(nk[0] - 0.2 - sp * 0.1, nk[1] + 0.02 + fl, nk[0] - 0.3 - sp * 0.25, nk[1] - 0.04 + fl * 2); ctx.stroke();
  catHead(ctx, hx, hy, blink);
}
function catHead(ctx, hx, hy, blink) {
  ctx.fillStyle = RC.cat;
  for (const [ex, tip] of [[-0.07, [-0.12, 0.3]], [0.07, [0.08, 0.32]]]) { ctx.beginPath(); ctx.moveTo(hx + ex - 0.08, hy + 0.09); ctx.lineTo(hx + tip[0], hy + tip[1]); ctx.lineTo(hx + ex + 0.07, hy + 0.13); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = RC.pink; ctx.beginPath(); ctx.moveTo(hx + 0.04, hy + 0.13); ctx.lineTo(hx + 0.075, hy + 0.26); ctx.lineTo(hx + 0.115, hy + 0.135); ctx.closePath(); ctx.fill();
  ctx.fillStyle = RC.cat; ctx.beginPath(); ctx.ellipse(hx, hy, 0.19, 0.17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = RC.catD; ctx.lineWidth = 0.024;
  for (const dx of [-0.08, -0.025]) { ctx.beginPath(); ctx.moveTo(hx + dx, hy + 0.165); ctx.lineTo(hx + dx + 0.022, hy + 0.095); ctx.stroke(); }
  ctx.fillStyle = RC.catL; ctx.beginPath(); ctx.ellipse(hx + 0.105, hy - 0.055, 0.088, 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RC.pink; ctx.beginPath(); ctx.arc(hx + 0.183, hy - 0.012, 0.026, 0, Math.PI * 2); ctx.fill();
  if (blink) { ctx.strokeStyle = RC.dark; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.moveTo(hx + 0.045, hy + 0.04); ctx.lineTo(hx + 0.11, hy + 0.04); ctx.stroke(); }
  else {
    ctx.fillStyle = RC.dark; ctx.beginPath(); ctx.ellipse(hx + 0.078, hy + 0.04, 0.032, 0.044, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 0.087, hy + 0.058, 0.011, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.009;
  for (const dy of [-0.035, -0.065]) { ctx.beginPath(); ctx.moveTo(hx + 0.14, hy + dy); ctx.lineTo(hx + 0.3, hy + dy + (dy + 0.045) * 0.6); ctx.stroke(); }
}
function catScooter(ctx, sc, t, withRider) {
  const r = sc.S.r, rw = toLocal(sc, sc.wh[0].x, sc.wh[0].y), fw = toLocal(sc, sc.wh[1].x, sc.wh[1].y);
  const L = sc.lean, sp = Math.min(1, Math.abs(sc.vx) / 12);
  if (withRider) catTail(ctx, L, sp, t);
  seg(ctx, [-0.52, -0.36], rw, 0.045, '#3A4558');
  ctx.strokeStyle = '#3A4558'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.arc(rw[0], rw[1], r + 0.05, Math.PI * 0.25, Math.PI * 0.8); ctx.stroke();
  seg(ctx, [0.42, -0.28], fw, 0.04, RC.steel);
  seg(ctx, [0.38, -0.36], [0.44, 0.6], 0.05, RC.steel);
  seg(ctx, [0.37, 0.61], [0.51, 0.63], 0.05, '#1A2029');
  ctx.fillStyle = RC.deck; roundRect(ctx, -0.66, -0.41, 1.1, 0.09, 0.03); ctx.fill();
  ctx.fillStyle = RC.ruby; ctx.fillRect(-0.6, -0.385, 0.96, 0.025);
  headlight(ctx, 0.47, 0.42, sp);
  if (withRider) cat(ctx, L, sp, t, true);
}
function headlight(ctx, x, y, sp) {
  ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(x, y, 0.032, 0, Math.PI * 2); ctx.fill();
  if (sp > 0.05) { const gl = ctx.createRadialGradient(x + 0.03, y, 0, x + 0.03, y, 0.5); gl.addColorStop(0, `rgba(255,224,138,${0.25 * sp})`); gl.addColorStop(1, 'rgba(255,224,138,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x + 0.03, y, 0.5, 0, Math.PI * 2); ctx.fill(); }
}

// ——— капібара ———
function capy(ctx, L, t, withLegs) {
  const a = Math.abs(L), bx = 0.07 * L, hx = 0.4 + 0.1 * L, hy = 0.3 - 0.04 * a, blink = (t + 1.3) % 4.1 < 0.13;
  if (withLegs) for (const [x, col] of [[-0.3, RC.capD], [0.12, RC.capD], [-0.18, RC.cap], [0.25, RC.cap]]) seg(ctx, [x + bx, 0.02], [x + bx * 0.4, -0.12], 0.075, col);
  ctx.fillStyle = RC.cap; ctx.beginPath(); ctx.ellipse(-0.05 + bx, 0.15, 0.4, 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RC.capL; ctx.beginPath(); ctx.ellipse(-0.02 + bx, 0.06, 0.29, 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = RC.capD; ctx.lineWidth = 0.02;
  for (const x of [-0.3, -0.18, -0.06]) { ctx.beginPath(); ctx.moveTo(x + bx, 0.31); ctx.lineTo(x + bx + 0.04, 0.26); ctx.stroke(); }
  // рубіновий нашийник
  seg(ctx, [hx - 0.2, hy - 0.16], [hx - 0.13, hy + 0.04], 0.05, RC.ruby);
  // голова: прямокутна з тупою мордою
  ctx.fillStyle = RC.cap; roundRect(ctx, hx - 0.19, hy - 0.13, 0.36, 0.27, 0.1); ctx.fill();
  ctx.fillStyle = RC.snout; roundRect(ctx, hx + 0.06, hy - 0.13, 0.15, 0.17, 0.07); ctx.fill();
  ctx.fillStyle = RC.dark; ctx.beginPath(); ctx.ellipse(hx + 0.17, hy - 0.0, 0.016, 0.01, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = RC.capD; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(hx + 0.12, hy - 0.09); ctx.quadraticCurveTo(hx + 0.16, hy - 0.11, hx + 0.19, hy - 0.08); ctx.stroke();
  ctx.fillStyle = RC.capD; ctx.beginPath(); ctx.ellipse(hx - 0.12, hy + 0.14, 0.045, 0.035, -0.3, 0, Math.PI * 2); ctx.fill();
  if (blink) { ctx.strokeStyle = RC.dark; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(hx + 0.04, hy + 0.07); ctx.lineTo(hx + 0.1, hy + 0.07); ctx.stroke(); }
  else { ctx.fillStyle = RC.dark; ctx.beginPath(); ctx.ellipse(hx + 0.07, hy + 0.07, 0.024, 0.03, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 0.077, hy + 0.083, 0.008, 0, Math.PI * 2); ctx.fill(); }
  // мандаринка на голові
  ctx.fillStyle = RC.orange; ctx.beginPath(); ctx.arc(hx - 0.03, hy + 0.2, 0.072, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(hx - 0.05, hy + 0.23, 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RC.leaf; ctx.beginPath(); ctx.ellipse(hx + 0.0, hy + 0.285, 0.04, 0.018, 0.5, 0, Math.PI * 2); ctx.fill();
}
function capySkate(ctx, sc, t, withRider) {
  const rw = toLocal(sc, sc.wh[0].x, sc.wh[0].y), fw = toLocal(sc, sc.wh[1].x, sc.wh[1].y);
  seg(ctx, [-0.4, -0.17], rw, 0.05, '#55607A'); seg(ctx, [0.4, -0.17], fw, 0.05, '#55607A');
  ctx.strokeStyle = RC.deck; ctx.lineWidth = 0.05; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-0.7, -0.06); ctx.lineTo(-0.56, -0.15); ctx.lineTo(0.56, -0.15); ctx.lineTo(0.7, -0.06); ctx.stroke();
  ctx.strokeStyle = RC.ruby; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(-0.55, -0.178); ctx.lineTo(0.55, -0.178); ctx.stroke();
  headlight(ctx, 0.62, -0.1, Math.min(1, Math.abs(sc.vx) / 12) * 0.6);
  if (withRider) capy(ctx, sc.lean, t, true);
}

// ——— голова аналітика ———
function analystHead(ctx, hx, hy, t, glow) {
  const blink = (t + 0.7) % 3.3 < 0.12;
  ctx.fillStyle = RC.skin; ctx.beginPath(); ctx.arc(hx, hy, 0.29, 0, Math.PI * 2); ctx.fill();
  // зачіска: шапочка зверху й ззаду, обличчя відкрите
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 0.29, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = RC.hair;
  ctx.beginPath(); ctx.ellipse(hx - 0.1, hy + 0.25, 0.33, 0.16, -0.32, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - 0.3, hy + 0.04, 0.12, 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.ellipse(hx + 0.08, hy - 0.12, 0.16, 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // вухо
  ctx.fillStyle = RC.skin; ctx.beginPath(); ctx.ellipse(hx - 0.15, hy - 0.01, 0.055, 0.075, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = RC.skinD; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.arc(hx - 0.15, hy - 0.01, 0.03, -1.2, 1.4); ctx.stroke();
  // ніс, усмішка, щоки
  ctx.fillStyle = RC.skinD; ctx.beginPath(); ctx.moveTo(hx + 0.26, hy + 0.0); ctx.quadraticCurveTo(hx + 0.33, hy - 0.06, hx + 0.25, hy - 0.08); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,.25)'; ctx.beginPath(); ctx.arc(hx + 0.06, hy - 0.08, 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8A4A3A'; ctx.lineWidth = 0.017; ctx.beginPath(); ctx.arc(hx + 0.16, hy - 0.1, 0.065, Math.PI * 1.12, Math.PI * 1.88, false); ctx.stroke();
  // очі за окулярами
  const E = [[hx + 0.1, hy + 0.06], [hx + 0.23, hy + 0.045]];
  for (const [ex, ey] of E) {
    if (blink && !glow) { ctx.strokeStyle = RC.dark; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(ex - 0.028, ey); ctx.lineTo(ex + 0.028, ey); ctx.stroke(); }
    else { ctx.fillStyle = glow ? '#FF2A4A' : RC.dark; ctx.beginPath(); ctx.arc(ex, ey, 0.03, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 0.009, ey + 0.011, 0.009, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = RC.glass; ctx.lineWidth = 0.02; ctx.fillStyle = 'rgba(160,200,255,.14)';
  for (const [ex, ey] of E) { ctx.beginPath(); ctx.arc(ex, ey, 0.068, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(E[0][0] + 0.068, E[0][1]); ctx.lineTo(E[1][0] - 0.068, E[1][1]); ctx.moveTo(E[0][0] - 0.068, E[0][1]); ctx.lineTo(hx - 0.11, hy + 0.03); ctx.stroke();
  ctx.strokeStyle = RC.hair; ctx.lineWidth = 0.018;
  for (const [ex, ey] of E) { ctx.beginPath(); ctx.moveTo(ex - 0.045, ey + 0.1); ctx.lineTo(ex + 0.04, ey + 0.112); ctx.stroke(); }
}
function headMono(ctx, sc, t, withRider, glow) {
  const wl = toLocal(sc, sc.wh[0].x, sc.wh[0].y), r = sc.S.r, L = sc.lean;
  const hx = 0 + 0.12 * L, hy = 0.25 - 0.03 * Math.abs(L);
  // ніжки: задня темніша, за колесом
  if (withRider) seg(ctx, [hx - 0.08, hy - 0.26], [wl[0] - 0.05, wl[1] - 0.08], 0.05, '#20232B');
  // корпус над колесом і педаль
  ctx.strokeStyle = RC.deck; ctx.lineWidth = 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(wl[0], wl[1], r + 0.05, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.strokeStyle = RC.ruby; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.arc(wl[0], wl[1], r + 0.09, Math.PI * 0.28, Math.PI * 0.72); ctx.stroke();
  headlight(ctx, wl[0] + r + 0.05, wl[1] + 0.08, Math.min(1, Math.abs(sc.vx) / 12));
  if (!withRider) return;
  // передня ніжка, черевики на педалях
  seg(ctx, [hx + 0.05, hy - 0.26], [wl[0] + 0.06, wl[1] - 0.08], 0.055, '#3A4A6A');
  seg(ctx, [wl[0] - 0.16, wl[1] - 0.12], [wl[0] + 0.18, wl[1] - 0.12], 0.035, '#55607A');
  ctx.fillStyle = RC.dark;
  for (const dx of [-0.04, 0.08]) { ctx.beginPath(); ctx.ellipse(wl[0] + dx, wl[1] - 0.09, 0.055, 0.024, 0, 0, Math.PI * 2); ctx.fill(); }
  // ручки для рівноваги
  const sw = Math.sin(t * 6) * 0.03;
  seg(ctx, [hx - 0.25, hy - 0.1], [hx - 0.38, hy - 0.18 + sw + L * 0.06], 0.04, RC.skin);
  seg(ctx, [hx + 0.22, hy - 0.16], [hx + 0.35, hy - 0.26 - sw - L * 0.06], 0.04, RC.skin);
  analystHead(ctx, hx, hy, t, glow);
  // рубіновий метелик під підборіддям
  ctx.fillStyle = RC.ruby; ctx.beginPath();
  ctx.moveTo(hx + 0.04, hy - 0.28); ctx.lineTo(hx - 0.05, hy - 0.32); ctx.lineTo(hx - 0.05, hy - 0.24); ctx.closePath();
  ctx.moveTo(hx + 0.04, hy - 0.28); ctx.lineTo(hx + 0.13, hy - 0.32); ctx.lineTo(hx + 0.13, hy - 0.24); ctx.closePath(); ctx.fill();
}

// Герой із транспортом у локальних координатах рами; glow: очі світяться під час пострілу
export function drawRider(ctx, V, sc, char, t, withRider = true, glow = false) {
  const wkind = char === 'capy' ? 'skate' : char === 'head' ? 'mono' : 'scooter';
  for (const W of sc.wh) wheel(ctx, V, W, sc.S.r, wkind);
  ctx.save();
  ctx.translate(V.X(sc.x), V.Y(sc.y)); ctx.rotate(-sc.a); ctx.scale(V.s, -V.s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (char === 'capy') capySkate(ctx, sc, t, withRider);
  else if (char === 'head') headMono(ctx, sc, t, withRider, glow);
  else catScooter(ctx, sc, t, withRider);
  ctx.restore();
}

// Герой після падіння летить окремо (x, y: центр голови)
export function drawFallen(ctx, V, c, char, t) {
  ctx.save();
  ctx.translate(V.X(c.x), V.Y(c.y)); ctx.rotate(-c.a); ctx.scale(V.s, -V.s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (char === 'capy') { ctx.translate(-0.4, -0.3); capy(ctx, 0, t, true); }
  else if (char === 'head') analystHead(ctx, 0, 0, t, false);
  else { ctx.translate(-0.16, -0.52); catTail(ctx, 0, 0.6, t); cat(ctx, 0, 0.6, t, false); }
  ctx.restore();
}

// Світіння очей під час пострілу
export function drawEyeGlow(ctx, V, eyes, k) {
  for (const [x, y] of eyes) {
    const X = V.X(x), Y = V.Y(y), R = Math.max(6, 0.13 * V.s);
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, R);
    g.addColorStop(0, `rgba(255,235,240,${0.95 * k})`); g.addColorStop(0.35, `rgba(255,40,80,${0.7 * k})`); g.addColorStop(1, 'rgba(255,40,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
  }
}

// Прев'ю героя для вибору: малює на окремому canvas без траси
export function drawPreview(canvas, char, t = 0) {
  const ctx = canvas.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth || 160, H = canvas.clientHeight || 110;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const s = Math.min(W / 1.9, H / 1.75), ground = H - 10;
  const anchors = { cat: [[-0.5, -0.34], [0.5, -0.34]], capy: [[-0.4, -0.27], [0.4, -0.27]], head: [[0, -0.44]] }[char];
  const r = { cat: 0.2, capy: 0.16, head: 0.25 }[char];
  const cy = (-anchors[0][1] + r) * s;
  const sc = { x: 0, y: 0, a: 0, lean: 0, vx: 0, S: { r }, wh: anchors.map(([x, y]) => ({ x, y, phi: t })) };
  const V = { s, X: x => W / 2 + x * s, Y: y => ground - cy - y * s };
  ctx.strokeStyle = 'rgba(96,165,250,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, ground + 1); ctx.lineTo(W - 8, ground + 1); ctx.stroke();
  drawRider(ctx, V, sc, char, t, true, false);
}
