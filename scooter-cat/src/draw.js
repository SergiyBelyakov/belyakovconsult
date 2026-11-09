// Малювання гри: траса як графік (сітка, осі, площа під лінією, точки даних, пунктири, коридор прогнозу,
// підписи), самокат із котиком векторно, частинки й панель часу. Координати світу в метрах, y угору.

import { drawRider, drawFallen, drawEyeGlow } from './riders.js';
import { bug, boom, BUG_COLS } from '../../laser-kitty/src/sprites.js';
import { LAYER_COLORS, WF_COLORS } from './levels.js';

const FONT = "Inter, 'Segoe UI', Arial, sans-serif", MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
export const COL = {
  bg: '#0B0F16', ink: '#F4F6F8', muted: '#A8B0BC', faint: '#7E8896', grid: 'rgba(255,255,255,.065)', ghost: '#94A3B8',
  ruby: '#D90429', rubyL: '#FF6076', coral: '#FF6B6B', amber: '#FFB020', ok: '#10B981', teal: '#2DD4BF',
  cat: '#F0964A', catD: '#C46C28', catL: '#FFC480', pink: '#FF8C96', dark: '#06080C',
  steel: '#AAB2C0', deck: '#283142', tire: '#121821', tireL: '#3A4558',
};
// плашки легенди для шарів і стовпчиків водоспаду
const SWATCH = { L0: LAYER_COLORS[0], L1: LAYER_COLORS[1], L2: LAYER_COLORS[2], WT: WF_COLORS.total, WD: WF_COLORS.down };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function drawGame(ctx, G) {
  const { W, H, L, sc, T } = G;
  const cam = G.cam || { x: sc.x, y: sc.y, s: G.baseScale || 50 };
  const s = cam.s, ox = W * 0.34, oy = H * 0.6;
  const V = {
    s, X: x => ox + (x - cam.x) * s, Y: y => oy - (y - cam.y) * s,
    xL: cam.x - ox / s - 1, xR: cam.x + (W - ox) / s + 1, yT: cam.y + oy / s, yB: cam.y - (H - oy) / s,
  };
  ctx.save();
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.7, H * 0.1, 0, W * 0.7, H * 0.1, W * 0.8);
  glow.addColorStop(0, rgba(L.color, 0.07)); glow.addColorStop(1, rgba(L.color, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  const labels = grid(ctx, G, V);
  if (L.band) band(ctx, G, V);
  decor(ctx, G, V);
  gridLabels(ctx, labels, ['hist', 'pareto', 'stacked', 'waterfall'].includes(L.kind));
  ghosts(ctx, G, V);
  terrain(ctx, G, V);
  markers(ctx, G, V);
  posts(ctx, G, V);
  notes(ctx, G, V);
  bugs(ctx, G, V);
  particles(ctx, G, V);
  if (G.rider) { drawRider(ctx, V, sc, G.char, G.t, false); drawFallen(ctx, V, G.rider, G.char, G.t); }
  else drawRider(ctx, V, sc, G.char, G.t, true, G.eyeT > 0);
  beams(ctx, G, V);
  hud(ctx, G, V);
  ctx.restore();
}

// ——— шкала: значення → висота з урахуванням воріт (для рівнів із двома шкалами) ———
function scaleFor(L, region) {
  const g = L.gates[0];
  if (L.id === 'axis') return region === 'B' ? v => lerp(L.yOf(v), L.yZ(v), g.morph.t) : L.yOf;
  if (L.id === 'log') return region === 'B' ? v => lerp(L.yOf(v), L.yG(v), g.morph.t) : L.yOf;
  return L.yOf;
}
function fmtVal(G, v) {
  const L = G.L;
  if (L.unit === 'users') return G.T.fmt.users(v);
  if (L.unit === 'pct') return G.T.fmt.pct0(v / 100);
  return G.T.fmt.num(v);
}

// Сітка: лінії одразу, підписи осей пізніше (gridLabels), щоб стовпчики й шари їх не перекривали
function grid(ctx, G, V) {
  const L = G.L, two = (L.id === 'axis' || L.id === 'log') && L.gates[0].morph.t > 0;
  const split = two ? clamp(V.X(L.gates[0].at), 0, G.W) : G.W;
  const out = [];
  const lines = (ticks, f, x0, x1, alpha, labelX) => {
    for (const v of ticks) {
      const y = V.Y(f(v));
      if (y < 30 || y > G.H - 22) continue;
      if (x1 - x0 >= 2) {
        ctx.strokeStyle = `rgba(255,255,255,${0.065 * alpha})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, Math.round(y) + 0.5); ctx.lineTo(x1, Math.round(y) + 0.5); ctx.stroke();
      }
      if (labelX != null) out.push({ t: fmtVal(G, v), x: labelX, y: y - 3, a: alpha });
    }
  };
  if (L.panels) {
    // малі мультиплікатори: сітка лише в межах панелей, шкала одна на всіх
    for (const p of L.panels) lines(L.ticks, L.yOf, clamp(V.X(p.x0 - 1.2), 0, G.W), clamp(V.X(p.x1 + 1.2), 0, G.W), 1, null);
    lines(L.ticks, L.yOf, 0, 0, 1, 8);
  } else if (L.ticks) lines(L.ticks, L.yOf, 0, G.W, 1, 8);
  else {
    lines(L.ticksA, scaleFor(L, 'A'), 0, split, 1, split > 60 ? 8 : null);
    if (two) lines(L.ticksB, scaleFor(L, 'B'), split, G.W, L.gates[0].morph.t, split + 8);
  }
  // підписи осі x унизу: час за точками або свої позначки (кошики, товарні групи, статті)
  const ticks = L.xTicks || L.samples.filter(s => !(s.i % L.xEvery)).map(s => ({ x: s.x, o: L.xLabel(s.i) }));
  for (const t of ticks) {
    if (t.x < V.xL || t.x > V.xR) continue;
    const x = V.X(t.x);
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 30); ctx.lineTo(Math.round(x) + 0.5, G.H - 18); ctx.stroke();
    out.push({ t: G.T.xlabel(t.o), x, y: G.H - 6, a: 1, c: true });
  }
  return out;
}
function gridLabels(ctx, list, pill) {
  ctx.font = `500 11px ${FONT}`;
  for (const l of list) {
    ctx.textAlign = l.c ? 'center' : 'left'; ctx.textBaseline = l.c ? 'alphabetic' : 'bottom';
    if (pill) {   // над стовпчиками й шарами підпис на темній плашці, щоб читався
      const w = ctx.measureText(l.t).width + 8, x = l.c ? l.x - w / 2 : l.x - 4, y = l.c ? l.y - 11 : l.y - 13;
      ctx.fillStyle = `rgba(11,15,22,${0.72 * l.a})`; ctx.fillRect(x, y, w, 15);
    }
    ctx.fillStyle = rgba(pill ? COL.muted : COL.faint, l.a); ctx.fillText(l.t, l.x, l.y);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ——— фон, що залежить від виду графіка: стовпчики гістограми й Парето, шари, водоспад, контрольні межі, панелі ———
function decor(ctx, G, V) {
  const k = G.L.kind;
  if (k === 'hist') histBars(ctx, G, V);
  else if (k === 'pareto') paretoBars(ctx, G, V);
  else if (k === 'stacked') layers(ctx, G, V);
  else if (k === 'waterfall') waterBars(ctx, G, V);
  else if (k === 'control') limits(ctx, G, V);
  else if (k === 'multiples') panels(ctx, G, V);
}

function tag(ctx, text, x, y, { align = 'center', color = COL.ink, border = 'rgba(255,255,255,.22)', bg = 'rgba(11,15,22,.88)', font = `600 11.5px ${FONT}` } = {}) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 12, h = 19, bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = bg; ctx.fillRect(bx, y - h, w, h);
  ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, y - h + 0.5, w - 1, h - 1);
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, bx + 6, y - 5.5);
}

function histBars(ctx, G, V) {
  const L = G.L, w = L.barW, base = V.Y(0);
  for (const smp of L.samples) {
    if (smp.x + w / 2 < V.xL || smp.x - w / 2 > V.xR) continue;
    const top = V.Y(L.yOf(smp.v)), x0 = V.X(smp.x - w / 2) + 1, x1 = V.X(smp.x + w / 2) - 1;
    ctx.fillStyle = rgba(L.color, 0.17); ctx.fillRect(x0, top, x1 - x0, base - top);
    ctx.fillStyle = rgba(L.color, 0.55); ctx.fillRect(x0, top, x1 - x0, 2);
  }
  // медіана і середнє: вертикальні пунктири з підписами
  for (const m of L.marks) {
    if (m.x < V.xL || m.x > V.xR) continue;
    const x = Math.round(V.X(m.x)) + 0.5, top = V.Y(L.terrain.height(m.x) + 2.3);
    ctx.strokeStyle = m.key === 'mean' ? rgba(COL.coral, 0.85) : 'rgba(244,246,248,.8)'; ctx.lineWidth = 1.6;
    ctx.setLineDash(m.key === 'mean' ? [7, 5] : [2, 4]);
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top); ctx.stroke(); ctx.setLineDash([]);
    tag(ctx, G.T.marks[m.key](m.v), x, top, { border: m.key === 'mean' ? rgba(COL.coral, 0.7) : 'rgba(255,255,255,.35)' });
  }
}

function paretoBars(ctx, G, V) {
  const L = G.L, w = L.barW, base = V.Y(0), alpha = { A: 0.5, B: 0.3, C: 0.16 };
  ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'center';
  for (const smp of L.samples) {
    const xc = smp.x - w / 2;
    if (xc + w / 2 < V.xL || xc - w / 2 > V.xR) continue;
    const top = V.Y(L.yOf(smp.share)), x0 = V.X(xc - w / 2) + 3, x1 = V.X(xc + w / 2) - 3;
    ctx.fillStyle = rgba(L.color, alpha[smp.abc]); ctx.fillRect(x0, top, x1 - x0, base - top);
    ctx.fillStyle = rgba(L.color, 0.85); ctx.fillRect(x0, top, x1 - x0, 2);
    ctx.fillStyle = COL.muted; ctx.fillText(G.T.fmt.dec(smp.share) + '%', V.X(xc), top - 6);
  }
  ctx.textAlign = 'left';
  // межа 80%: горизонтальний пунктир і підписи груп A, B, C над стовпчиками
  const y80 = V.Y(L.yOf(80));
  ctx.strokeStyle = 'rgba(244,246,248,.4)'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, Math.round(y80) + 0.5); ctx.lineTo(G.W, Math.round(y80) + 0.5); ctx.stroke(); ctx.setLineDash([]);
  const zones = [['A', 0, L.k80], ['B', L.k80 + 1, L.k95], ['C', L.k95 + 1, L.samples.length - 1]];
  for (const [z, a, b] of zones) {
    const xa = a * w, xb = (b + 1) * w;
    if (xb < V.xL || xa > V.xR) continue;
    const xm = clamp((Math.max(xa, V.xL + 1) + Math.min(xb, V.xR - 1)) / 2, xa + 2, xb - 2);
    tag(ctx, G.T.abc[z], V.X(xm), Math.min(G.H - 26, V.Y(0) + 30), { border: rgba(L.color, 0.6) });
  }
}

function layers(ctx, G, V) {
  const L = G.L, S = L.samples;
  let i0 = 0, i1 = S.length - 1;
  while (i0 < S.length - 1 && S[i0 + 1].x < V.xL) i0++;
  while (i1 > 0 && S[i1 - 1].x > V.xR) i1--;
  if (i1 <= i0) return;
  let lower = S.map(() => 0);
  L.layers.forEach((arr, k) => {
    const upper = lower.map((y, m) => y + arr[m]);
    ctx.beginPath();
    for (let m = i0; m <= i1; m++) ctx[m === i0 ? 'moveTo' : 'lineTo'](V.X(S[m].x), V.Y(L.yOf(upper[m])));
    for (let m = i1; m >= i0; m--) ctx.lineTo(V.X(S[m].x), V.Y(L.yOf(lower[m])));
    ctx.closePath(); ctx.fillStyle = rgba(LAYER_COLORS[k], 0.62); ctx.fill();
    // проміжок кольору тла між шарами
    ctx.strokeStyle = COL.bg; ctx.lineWidth = 2; ctx.beginPath();
    for (let m = i0; m <= i1; m++) ctx[m === i0 ? 'moveTo' : 'lineTo'](V.X(S[m].x), V.Y(L.yOf(upper[m])));
    ctx.stroke();
    // підпис шару в найтовщому видимому місці (низ екрана теж межа)
    let best = null;
    for (let m = i0; m <= i1; m++) {
      const x = V.X(S[m].x);
      if (x < 70 || x > G.W - 70) continue;
      const yt = V.Y(L.yOf(upper[m])), yb = Math.min(V.Y(L.yOf(lower[m])), G.H - 26), th = yb - yt;
      if (!best || th > best.th) best = { x, y: (yt + yb) / 2 + 4, th };
    }
    if (best && best.th > 22) {
      ctx.font = `600 12px ${FONT}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
      ctx.fillText(G.T.layers[k], best.x, best.y);
      ctx.textAlign = 'left';
    }
    lower = upper;
  });
}

function waterBars(ctx, G, V) {
  const L = G.L, w = L.barW;
  for (const b of L.bars) {
    if (b.x + w / 2 < V.xL || b.x - w / 2 > V.xR) continue;
    const x0 = V.X(b.x - w / 2), x1 = V.X(b.x + w / 2), yt = V.Y(L.yOf(b.hi)), yb = V.Y(L.yOf(b.lo));
    const col = b.total ? WF_COLORS.total : WF_COLORS.down;
    const grad = ctx.createLinearGradient(0, yt, 0, Math.max(yt + 30, yb));
    grad.addColorStop(0, rgba(col, 0.55)); grad.addColorStop(1, rgba(col, 0.22));
    ctx.fillStyle = grad; ctx.fillRect(x0, yt, x1 - x0, Math.max(2, yb - yt));
    // значення: усередині стовпчика під верхом, а якщо він тонкий, то під ним
    const f = v => (Math.abs(v - Math.round(v)) < 0.05 ? G.T.fmt.num(v) : G.T.fmt.dec(v));
    const text = b.total ? f(b.hi) : '−' + f(-b.d);
    ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = COL.ink;
    ctx.fillText(text, (x0 + x1) / 2, yb - yt > 34 ? yt + 21 : yb + 17);
    ctx.textAlign = 'left';
  }
  // базова лінія нуля
  const y0 = Math.round(V.Y(0)) + 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(G.W, y0); ctx.stroke();
}

function limits(ctx, G, V) {
  const L = G.L, lim = L.limits, S = L.samples;
  const xa = Math.max(0, V.X(L.x0 - 2)), xb = Math.min(G.W, V.X(L.x1 + 2));
  if (xb <= xa) return;
  const yU = V.Y(L.yOf(lim.ucl)), yL = V.Y(L.yOf(lim.lcl)), yM = V.Y(L.yOf(lim.mean));
  ctx.fillStyle = rgba(L.color, 0.06); ctx.fillRect(xa, yU, xb - xa, yL - yU);
  // серія вище середнього: підсвічена смуга під днями зсуву
  const r0 = S[lim.run[0]].x - 1.3, r1 = S[lim.run[1]].x + 1.3;
  if (r1 > V.xL && r0 < V.xR) { ctx.fillStyle = 'rgba(255,176,32,.08)'; ctx.fillRect(V.X(r0), yU, V.X(r1) - V.X(r0), yM - yU); }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(COL.coral, 0.8); ctx.setLineDash([7, 5]);
  for (const y of [yU, yL]) { ctx.beginPath(); ctx.moveTo(xa, Math.round(y) + 0.5); ctx.lineTo(xb, Math.round(y) + 0.5); ctx.stroke(); }
  ctx.strokeStyle = rgba(COL.ghost, 0.85); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(xa, Math.round(yM) + 0.5); ctx.lineTo(xb, Math.round(yM) + 0.5); ctx.stroke();
  // підписи меж: на широкому екрані ліворуч після підписів осі, на вузькому праворуч, щоб не накривати героя
  const narrow = G.W < 560;
  ctx.font = `600 11px ${FONT}`;
  // текст підписів чорнилом, колір лінії лише в короткій позначці перед ним
  [[yU, G.T.limits.ucl(lim.ucl), COL.coral], [yM, G.T.limits.mean(lim.mean), COL.ghost], [yL, G.T.limits.lcl(lim.lcl), COL.coral]].forEach(([y, t, c]) => {
    if (y < 34 || y > G.H - 24) return;
    const tw = ctx.measureText(t).width + 14, lx = narrow ? Math.min(xb, G.W) - tw - 10 : Math.max(xa + 8, 52);
    if (lx < 4) return;
    ctx.fillStyle = 'rgba(11,15,22,.82)'; ctx.fillRect(lx - 4, y - 17, tw + 8, 15);
    ctx.fillStyle = c; ctx.fillRect(lx, y - 10.5, 9, 2);
    ctx.fillStyle = COL.ink; ctx.fillText(t, lx + 14, y - 5);
  });
}

function panels(ctx, G, V) {
  const L = G.L, top = V.Y(L.panelTop), base = V.Y(0);
  for (const p of L.panels) {
    const xa = p.x0 - 1.2, xb = p.x1 + 1.2;
    if (xb < V.xL || xa > V.xR) continue;
    const x0 = V.X(xa), x1 = V.X(xb);
    ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(x0, top, x1 - x0, base - top);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x0) + 0.5, Math.round(top) + 0.5, Math.round(x1 - x0) - 1, Math.round(base - top));
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(x0, Math.round(base) + 0.5); ctx.lineTo(x1, Math.round(base) + 0.5); ctx.stroke();
    // назва регіону над власною лінією панелі; поки панель на екрані, назва тримається біля лівого краю
    ctx.font = `700 13px ${FONT}`;
    const name = G.T.regions[p.key], tw = ctx.measureText(name).width;
    const tx = clamp(x0 + 10, 12, x1 - tw - 10), ty = Math.max(top + 19, V.Y(Math.max(...p.v) * L.sY + 1.5));
    ctx.fillStyle = 'rgba(11,15,22,.75)'; ctx.fillRect(tx - 5, ty - 15, tw + 10, 20);
    ctx.fillStyle = COL.ink; ctx.fillText(name, tx, ty);
  }
}

function band(ctx, G, V) {
  const L = G.L, rows = L.band.rows, f = L.yOf;
  const poly = (lo, hi, fill) => {
    ctx.beginPath();
    rows.forEach((r, k) => (k ? ctx.lineTo(V.X(r.x), V.Y(f(r[hi]))) : ctx.moveTo(V.X(r.x), V.Y(f(r[hi])))));
    for (let k = rows.length - 1; k >= 0; k--) ctx.lineTo(V.X(rows[k].x), V.Y(f(rows[k][lo])));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  };
  poly('lo95', 'hi95', rgba(L.color, 0.07));
  poly('lo', 'hi', rgba(L.color, 0.13));
  ctx.setLineDash([7, 6]); ctx.strokeStyle = rgba(L.color, 0.9); ctx.lineWidth = 1.8;
  ctx.beginPath(); rows.forEach((r, k) => (k ? ctx.lineTo(V.X(r.x), V.Y(f(r.mid))) : ctx.moveTo(V.X(r.x), V.Y(f(r.mid))))); ctx.stroke();
  ctx.setLineDash([]);
  // «Сьогодні»
  const x = V.X(L.reveal.x0);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(x + 0.5, 34); ctx.lineTo(x + 0.5, G.H - 20); ctx.stroke(); ctx.setLineDash([]);
}

function polyline(ctx, V, pts) {
  ctx.beginPath();
  let started = false;
  for (const [x, y] of pts) {
    if (x < V.xL - 8 || x > V.xR + 8) { started = false; continue; }
    if (started) ctx.lineTo(V.X(x), V.Y(y)); else { ctx.moveTo(V.X(x), V.Y(y)); started = true; }
  }
  ctx.stroke();
}

function ghosts(ctx, G, V) {
  const L = G.L;
  ctx.lineWidth = 1.7; ctx.lineJoin = 'round';
  for (const gh of L.ghosts) { ctx.setLineDash([6, 5]); ctx.strokeStyle = rgba(COL.ghost, 0.85); polyline(ctx, V, gh.pts); }
  for (const g of L.gates) {
    if (!g.morph.t || !g.ghost.length) continue;
    ctx.setLineDash([5, 5]); ctx.strokeStyle = rgba(COL.coral, 0.75 * g.morph.t);
    polyline(ctx, V, g.ghost);
    // позначка виправленої помилки (викиди): «520 → 52»
    if (g.i != null && G.T.gates[g.key].mark) {
      const x = V.X(L.samples[g.i].x), y = V.Y(L.terrain.height(L.samples[g.i].x));
      if (x > -60 && x < G.W + 60) {
        ctx.setLineDash([]); ctx.font = `600 11.5px ${FONT}`;
        const text = G.T.gates[g.key].mark(g.args), w = ctx.measureText(text).width + 14;
        ctx.globalAlpha = g.morph.t; ctx.fillStyle = 'rgba(11,15,22,.9)'; ctx.fillRect(x - w / 2, y - 52, w, 20);
        ctx.strokeStyle = rgba(COL.coral, 0.8); ctx.strokeRect(x - w / 2 + 0.5, y - 51.5, w - 1, 19);
        ctx.fillStyle = '#FFB4B4'; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 38); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
        ctx.setLineDash([5, 5]);
      }
    }
  }
  ctx.setLineDash([]);
}

// Вершини траси на ділянці [a, b] у видимій частині, без дна провалля; дорога прогнозу обривається на межі відомого
function trackPts(L, V, a, b, hide) {
  const T = L.terrain, X = T.X, Y = T.Y, pts = [];
  const lo = Math.max(a, V.xL - 2), hi = Math.min(b, V.xR + 2, hide);
  if (hi <= lo) return pts;
  for (let i = T.seg(lo); i < T.n; i++) {
    if (X[i] < a - 1e-6 || (L.floor != null && Y[i] <= L.floor + 1e-6)) continue;
    if (X[i] > hi) {
      if (hi === hide) pts.push([hide, T.height(hide)]);
      else if (hi < b) pts.push([X[i], Y[i]]);   // за краєм екрана: лінія виходить за край
      break;
    }
    pts.push([X[i], Y[i]]);
  }
  return pts;
}

function terrain(ctx, G, V) {
  const L = G.L, T = L.terrain;
  const hideFrom = L.reveal ? G.revealX : Infinity;
  if (L.kind === 'bars') return bars(ctx, G, V);
  // площа під лінією там, де немає власної заливки (стовпчики, шари, водоспад); провалля ділить трасу на шматки
  const area = !['hist', 'pareto', 'stacked', 'waterfall'].includes(L.kind), base = L.panels ? V.Y(0) : G.H + 2;
  const cuts = [-Infinity];
  for (const p of L.pits) cuts.push(p.x0, p.x1);
  cuts.push(Infinity);
  for (let k = 0; k < cuts.length; k += 2) {
    const pts = trackPts(L, V, cuts[k], cuts[k + 1], hideFrom);
    if (pts.length < 2) continue;
    if (area) {
      let top = Infinity;
      ctx.beginPath();
      pts.forEach(([x, y], j) => { const py = V.Y(y); top = Math.min(top, py); ctx[j ? 'lineTo' : 'moveTo'](V.X(x), py); });
      if (!Number.isFinite(top)) top = 0;
      ctx.lineTo(V.X(pts[pts.length - 1][0]), base); ctx.lineTo(V.X(pts[0][0]), base); ctx.closePath();
      const grad = ctx.createLinearGradient(0, Math.max(0, top), 0, Math.max(top + 1, Math.min(G.H, base)));
      grad.addColorStop(0, rgba(L.color, 0.2)); grad.addColorStop(1, rgba(L.color, 0.03));
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.beginPath();
    pts.forEach(([x, y], j) => ctx[j ? 'lineTo' : 'moveTo'](V.X(x), V.Y(y)));
    ctx.strokeStyle = L.color; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  }
  // край відомого: дорога розчиняється в тумані прогнозу
  if (hideFrom < V.xR + 2) {
    const x = V.X(hideFrom), y = V.Y(T.height(hideFrom));
    const fog = ctx.createRadialGradient(x, y, 0, x, y, 26);
    fog.addColorStop(0, rgba(L.color, 0.5)); fog.addColorStop(1, rgba(L.color, 0));
    ctx.fillStyle = fog; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
  }
}

function bars(ctx, G, V) {
  const L = G.L, w = L.barW, T = L.terrain, g = L.gates[0];
  const baseA = V.Y(0), baseB = V.Y(lerp(0, L.yZ(0), g.morph.t));
  for (const smp of L.samples) {
    const xa = smp.x - w / 2, xb = smp.x + w / 2;
    if (xb < V.xL || xa > V.xR) continue;
    const top = V.Y(T.height(smp.x)), base = smp.i > L.anchor ? baseB : baseA;
    if (!Number.isFinite(top)) continue;
    const x0 = V.X(xa) + 1.5, x1 = V.X(xb) - 1.5, h = Math.max(0, Math.min(G.H + 4, base) - top);
    const grad = ctx.createLinearGradient(0, top, 0, top + Math.max(40, h));
    grad.addColorStop(0, rgba(L.color, 0.34)); grad.addColorStop(1, rgba(L.color, 0.08));
    ctx.fillStyle = grad; ctx.fillRect(x0, top, x1 - x0, h);
    ctx.fillStyle = L.color; ctx.fillRect(x0, top - 1.3, x1 - x0, 2.6);
  }
  // нульова лінія осі (базова лінія стовпчиків)
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
  const at = V.X(g.at);
  if (at > 0) { ctx.beginPath(); ctx.moveTo(0, Math.round(baseA) + 0.5); ctx.lineTo(Math.min(G.W, at), Math.round(baseA) + 0.5); ctx.stroke(); }
  if (g.morph.t > 0 && at < G.W) { ctx.beginPath(); ctx.moveTo(Math.max(0, at), Math.round(baseB) + 0.5); ctx.lineTo(G.W, Math.round(baseB) + 0.5); ctx.stroke(); }
}

function markers(ctx, G, V) {
  const L = G.L, T = L.terrain;
  for (const smp of L.samples) {
    if (smp.x < V.xL || smp.x > V.xR) continue;
    if (L.reveal && smp.x > G.revealX) continue;
    const x = V.X(smp.x), y = V.Y(T.height(smp.x)), got = G.got.has(smp.i);
    if (smp.sig) {   // контрольна карта: сигнал за межею (коло і знак оклику) або серія з одного боку від середнього
      const out = smp.sig === 'out';
      ctx.strokeStyle = out ? COL.coral : COL.amber; ctx.lineWidth = out ? 2 : 1.5;
      ctx.beginPath(); ctx.arc(x, y, out ? 10 : 7.5, 0, Math.PI * 2); ctx.stroke();
      if (out) { ctx.font = `800 13px ${FONT}`; ctx.fillStyle = COL.coral; ctx.textAlign = 'center'; ctx.fillText('!', x, y - 15); ctx.textAlign = 'left'; }
    }
    ctx.beginPath(); ctx.arc(x, y, got ? 3.6 : 4.2, 0, Math.PI * 2);
    if (got) { ctx.fillStyle = L.color; ctx.fill(); }
    else { ctx.fillStyle = COL.bg; ctx.fill(); ctx.strokeStyle = L.color; ctx.lineWidth = 1.8; ctx.stroke(); }
  }
  for (const p of G.pops) {
    const u = p.t / 0.7, x = V.X(p.x), y = V.Y(p.y);
    if (p.k) { ctx.fillStyle = p.k === 'zap' ? `rgba(255,140,160,${1 - u})` : `rgba(255,176,32,${1 - u})`; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(p.k === 'zap' ? G.T.hud.zap : G.T.hud.bite, x, y - 18 - u * 18); ctx.textAlign = 'left'; continue; }
    ctx.strokeStyle = rgba(L.color, 1 - u); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 5 + u * 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = rgba(COL.ink, 1 - u); ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('+1', x, y - 12 - u * 16); ctx.textAlign = 'left';
  }
}

// контрольні точки, ворота, фініш
function posts(ctx, G, V) {
  const L = G.L, T = L.terrain;
  ctx.font = `600 11px ${FONT}`;
  L.checkpoints.forEach((c, k) => {
    if (c.x < V.xL || c.x > V.xR) return;
    const x = V.X(c.x), y = V.Y(T.height(c.x)), top = y - 2.2 * V.s;
    ctx.strokeStyle = c.hit ? rgba(COL.ok, 0.8) : 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, top); ctx.stroke(); ctx.setLineDash([]);
    const label = (c.hit ? '✓ ' : '') + G.T.hud.cp(k + 1), w = ctx.measureText(label).width + 12;
    ctx.fillStyle = c.hit ? rgba(COL.ok, 0.22) : 'rgba(255,255,255,.08)'; ctx.fillRect(x, top, w, 18);
    ctx.strokeStyle = c.hit ? rgba(COL.ok, 0.7) : 'rgba(255,255,255,.3)'; ctx.strokeRect(x + 0.5, top + 0.5, w - 1, 17);
    ctx.fillStyle = c.hit ? '#8FF5C9' : COL.ink; ctx.fillText(label, x + 6, top + 13);
  });
  for (const g of L.gates) {
    if (g.x < V.xL - 4 || g.x > V.xR + 4) continue;
    const x = V.X(g.x), y = V.Y(T.height(g.x)), hgt = 3.4 * V.s, on = g.started;
    const grad = ctx.createLinearGradient(0, y - hgt, 0, y);
    grad.addColorStop(0, rgba(COL.teal, 0)); grad.addColorStop(1, rgba(COL.teal, on ? 0.12 : 0.28));
    ctx.fillStyle = grad; ctx.fillRect(x - 0.35 * V.s, y - hgt, 0.7 * V.s, hgt);
    ctx.strokeStyle = rgba(COL.teal, on ? 0.45 : 0.95); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 0.35 * V.s, y); ctx.lineTo(x - 0.35 * V.s, y - hgt); ctx.moveTo(x + 0.35 * V.s, y); ctx.lineTo(x + 0.35 * V.s, y - hgt); ctx.stroke();
    const label = G.T.gates[g.key].short;
    ctx.font = `700 11.5px ${FONT}`;
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = on ? 'rgba(45,212,191,.16)' : 'rgba(45,212,191,.9)'; ctx.fillRect(x - w / 2, y - hgt - 22, w, 20);
    ctx.fillStyle = on ? '#8FF5E5' : '#05211D'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - hgt - 8); ctx.textAlign = 'left';
  }
  const fx = L.finishX;
  if (fx > V.xL - 2 && fx < V.xR + 2) {
    const x = V.X(fx), y = V.Y(T.height(fx)), sz = Math.max(6, 0.22 * V.s), n = Math.round((3 * V.s) / sz);
    for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (k + j) % 2 ? COL.ink : '#1A2230'; ctx.fillRect(x + j * sz, y - (k + 1) * sz, sz, sz); }
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = COL.ink; ctx.fillText(G.T.hud.finish, x + 2 * sz + 6, y - n * sz + 10);
  }
}

// підписи-виноски біля точок графіка
function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
function notes(ctx, G, V) {
  const L = G.L, T = L.terrain;
  ctx.font = `500 12px ${FONT}`;
  for (const n of L.notes) {
    const smp = L.samples[n.i];
    if (!smp || smp.x < V.xL - 6 || smp.x > V.xR + 6) continue;
    const text = G.T.notes[n.key](n.args || {}, G.T);
    const x = V.X(smp.x), y = V.Y(T.height(smp.x));
    const near = Math.abs(G.sc.x - smp.x) < 3.2 ? 0.28 : 1;
    ctx.globalAlpha = near;
    const maxW = Math.min(230, G.W * 0.42), lines = wrap(ctx, text, maxW), lh = 16;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, h = lines.length * lh + 10;
    const down = n.down;
    let bx = clamp(x - w / 2, 6, G.W - w - 6), by = down ? y + 46 : y - 46 - h;
    const topMin = G.W < 560 ? 112 : 100;   // нижче за огляд графіка й панель часу
    if (!down && by < topMin) by = y + 40;
    if (down && by + h > G.H - 26) by = y - 46 - h;
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + (by > y ? 7 : -7)); ctx.lineTo(clamp(x, bx + 8, bx + w - 8), by > y ? by : by + h); ctx.stroke();
    ctx.fillStyle = 'rgba(11,15,22,.88)'; ctx.fillRect(bx, by, w, h);
    ctx.strokeStyle = n.warn ? rgba(COL.coral, 0.6) : 'rgba(255,255,255,.16)'; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    ctx.fillStyle = COL.ink;
    lines.forEach((l, k) => ctx.fillText(l, bx + 8, by + 5 + lh * (k + 0.78)));
    ctx.globalAlpha = 1;
  }
}

function particles(ctx, G, V) {
  for (const p of G.fx) {
    const u = p.t / p.life, x = V.X(p.x), y = V.Y(p.y);
    if (p.k === 'dust') { ctx.fillStyle = `rgba(200,210,225,${0.35 * (1 - u)})`; ctx.beginPath(); ctx.arc(x, y, 2 + u * 6, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = `rgba(255,190,90,${1 - u})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 4, y + p.vy * 4); ctx.stroke(); }
  }
}

// баги даних (з «Лазерного кошеняти»): сидять на лінії або літають над нею
function bugs(ctx, G, V) {
  const P = Math.max(1.5, Math.round(V.s * 0.04 * 2) / 2);
  G.L.bugs.forEach((b, k) => {
    if (b.x < V.xL - 2 || b.x > V.xR + 2) return;
    if (G.L.reveal && b.x > G.revealX) return;
    const [x, y] = G.bugPos(b), X = V.X(x), Y = V.Y(y);
    if (b.alive) bug(ctx, Math.round(X), Math.round(Y), P, G.t + k, BUG_COLS[k % 3], {});
    else if (b.dead != null && b.dead < 0.5) boom(ctx, X, Y, P, b.dead / 0.5, true);
  });
}

// лазери з очей: рубінове світіння і світле ядро
function beams(ctx, G, V) {
  const eyes = G.rider ? null : G.sc.eyesWorld();
  for (const b of G.beams) {
    const [ex, ey] = eyes && eyes[b.k] ? eyes[b.k] : [b.x0, b.y0];   // промінь іде з очей там, де вони зараз
    const k = 1 - b.t / 0.16, x0 = V.X(ex), y0 = V.Y(ey), x1 = V.X(b.x1), y1 = V.Y(b.y1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,30,70,${0.35 * k})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = `rgba(255,96,118,${0.9 * k})`; ctx.lineWidth = 3.2; ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,240,${k})`; ctx.lineWidth = 1.3; ctx.stroke();
    if (b.hit) { ctx.fillStyle = `rgba(255,236,240,${k})`; ctx.beginPath(); ctx.arc(x1, y1, 4 + 6 * (1 - k), 0, Math.PI * 2); ctx.fill(); }
  }
  if (G.eyeT > 0 && !G.rider) drawEyeGlow(ctx, V, G.sc.eyesWorld(), G.eyeT / 0.18);
}

// огляд усього графіка: маленька лінія траси і позиція котика
function overview(ctx, G, box) {
  const L = G.L, sc = G.sc, T = L.terrain, S = L.samples, { x: x0, y: y0, w: mw, h: mh } = box;
  const xa = S[0].x, xb = S[S.length - 1].x;
  const known = s => !L.reveal || s.x <= G.revealX || !s.future;
  const val = s => (known(s) ? T.height(s.x) : null);
  const ys = S.map(val).filter(v => v != null);
  if (L.band) for (const r of L.band.rows) { ys.push(L.yOf(r.lo), L.yOf(r.hi)); }
  const lo = Math.min(...ys), hi = Math.max(...ys), span = Math.max(0.5, hi - lo);
  const px = x => x0 + 6 + ((x - xa) / (xb - xa)) * (mw - 12), py = y => y0 + mh - 5 - ((y - lo) / span) * (mh - 10);
  ctx.fillStyle = 'rgba(11,15,22,.78)'; ctx.fillRect(x0, y0, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, mw - 1, mh - 1);
  if (L.band) {
    const rows = L.band.rows;
    ctx.fillStyle = rgba(L.color, 0.18); ctx.beginPath();
    rows.forEach((r, k) => (k ? ctx.lineTo(px(r.x), py(L.yOf(r.hi))) : ctx.moveTo(px(r.x), py(L.yOf(r.hi)))));
    for (let k = rows.length - 1; k >= 0; k--) ctx.lineTo(px(rows[k].x), py(L.yOf(rows[k].lo)));
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = L.color; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.beginPath();
  let on = false, pr = null;
  for (const s of S) {
    const y = val(s);
    if (y == null || (s.r != null && s.r !== pr)) on = false;   // панелі малих мультиплікаторів не з'єднуються
    pr = s.r;
    if (y == null) continue;
    if (on) ctx.lineTo(px(s.x), py(y)); else { ctx.moveTo(px(s.x), py(y)); on = true; }
  }
  ctx.stroke();
  for (const g of L.gates) { const x = px(Math.max(xa, Math.min(xb, g.x))); ctx.fillStyle = g.started ? rgba(COL.teal, 0.5) : COL.teal; ctx.fillRect(x - 1, y0 + 3, 2, mh - 6); }
  const cx = px(Math.max(xa, Math.min(xb, sc.x))), cy = py(Math.max(lo, Math.min(hi, sc.y - 0.55)));
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(Math.round(cx) + 0.5, y0 + 2); ctx.lineTo(Math.round(cx) + 0.5, y0 + mh - 2); ctx.stroke();
  ctx.fillStyle = COL.rubyL; ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2); ctx.fill();
}

function hud(ctx, G, V) {
  const L = G.L, T = G.T, W = G.W;
  // прогрес трасою
  const prog = clamp((G.sc.x - L.spawnX) / (L.finishX - L.spawnX), 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 0, W, 3);
  ctx.fillStyle = L.color; ctx.fillRect(0, 0, W * prog, 3);
  const narrow = W < 560;
  const mm = Math.floor(G.time / 60), ss = G.time - mm * 60;
  const time = `${mm}:${ss < 10 ? '0' : ''}${ss.toFixed(1)}`;
  const stats = `${T.hud.par} ${Math.floor(G.par / 60)}:${String(G.par % 60).padStart(2, '0')} · ${T.hud.points} ${G.got.size}/${L.samples.length} · ${T.hud.bugs} ${G.zapped}/${L.bugs.length} · ${T.hud.crashes} ${G.crashes}`;
  ctx.textBaseline = 'alphabetic';
  // назва графіка, час
  ctx.font = `600 ${narrow ? 12 : 13}px ${FONT}`; ctx.fillStyle = COL.ink;
  ctx.fillText(T.chart[L.id], 12, 24, W - (narrow ? 96 : 140));
  ctx.textAlign = 'right'; ctx.font = `700 ${narrow ? 16 : 18}px ${MONO}`;
  ctx.fillStyle = G.time > G.par && G.started ? COL.amber : COL.ink; ctx.fillText(time, W - 12, 25);
  ctx.font = `500 11.5px ${FONT}`; ctx.fillStyle = COL.muted;
  if (!narrow) ctx.fillText(stats, W - 12, 44);
  ctx.textAlign = 'left';
  if (narrow) ctx.fillText(stats, 12, 42);
  // легенда
  const items = T.legend[L.id] || [];
  let x = 12; const ly = narrow ? 98 : 44;
  ctx.font = `500 11.5px ${FONT}`;
  for (const [style, label] of items) {
    const w = 21 + ctx.measureText(label).width + 14;
    if (x + w > (narrow ? W - 8 : W * 0.66)) break;
    ctx.strokeStyle = style === 'ghost' ? COL.ghost : style === 'err' ? COL.coral : style === 'mean' ? COL.coral : L.color;
    ctx.lineWidth = style === 'line' ? 2.6 : 1.7; ctx.setLineDash(style === 'line' ? [] : style === 'median' ? [2, 3] : [5, 4]);
    if (style === 'median') ctx.strokeStyle = COL.ink;
    if (style === 'band') { ctx.fillStyle = rgba(L.color, 0.25); ctx.fillRect(x, ly - 8, 16, 8); }
    else if (style === 'bar') { ctx.fillStyle = rgba(L.color, 0.4); ctx.fillRect(x, ly - 9, 16, 9); }
    else if (SWATCH[style]) { ctx.fillStyle = rgba(SWATCH[style], 0.75); ctx.fillRect(x, ly - 9, 16, 9); }
    else { ctx.beginPath(); ctx.moveTo(x, ly - 3.5); ctx.lineTo(x + 16, ly - 3.5); ctx.stroke(); }
    ctx.setLineDash([]); ctx.fillStyle = COL.muted; ctx.fillText(label, x + 21, ly);
    x += w;
  }
  overview(ctx, G, narrow ? { x: 12, y: 52, w: W - 24, h: 30 } : { x: W - 12 - Math.min(250, W * 0.27), y: 54, w: Math.min(250, W * 0.27), h: 40 });
  // підказки на старті й після падіння
  if (G.state === 'play' && !G.started) {
    ctx.font = `600 14px ${FONT}`; ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
    ctx.fillText(T.hud.go, V.X(G.sc.x), V.Y(G.sc.y) - 1.4 * V.s); ctx.textAlign = 'left';
  }
  if (G.state === 'crash') {
    ctx.textAlign = 'center'; ctx.font = `800 26px ${FONT}`; ctx.fillStyle = COL.rubyL;
    ctx.fillText(T.hud.meow, W / 2, G.H * 0.3);
    ctx.font = `500 13px ${FONT}`; ctx.fillStyle = COL.muted; ctx.fillText(T.hud.back(G.cp.n), W / 2, G.H * 0.3 + 24);
    ctx.textAlign = 'left';
  }
}
