// Малювання гри на canvas: коридори-зв’язки з пилом, вузли графа з підписами, кошеня на пилососі, баги,
// капібара з капсулою, сканер, ефекти, верхній і нижній рядки стану та рядок запису під пилососом.
import { C, BUG_COLS, bug, boom, ufo, capsule, rider, battery, star, glyph } from './sprites.js';

const FONT = "Inter, 'Segoe UI', Arial, sans-serif", MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
const LINE = { p: '#9CC0F0', h: '#AAB2C0', c: '#C7D0DE', i: '#2BB3A3', src: C.RUBY_L, dock: '#5C6678' };
const ease = u => (u < 0 ? 0 : u > 1 ? 1 : 1 - (1 - u) ** 3);

function fit(ctx, s, w) { if (ctx.measureText(s).width <= w) return s; let t = s; while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
function label(ctx, s, x, y, c, size = 11, bold = false, align = 'center') {
  ctx.font = `${bold ? 700 : 500} ${size}px ${MONO}`; ctx.textAlign = align;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,8,12,.85)'; ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}
const fonts = g => ({ n: g.compact ? 9.5 : 11.5, a: g.compact ? 8.5 : 10 });
const nameOf = n => (n.role === 'gold' ? '★ ' : '') + n.rec.n;

// --- розміщення підписів: обираємо бік вузла, де підпис не лізе на коридори, інші підписи й вузли ---
export function placeLabels(g, ctx) {
  const F = fonts(g), rN = 6 * g.P + 2, S = {};
  for (const id in g.N) S[id] = g.ns(id);
  const segs = Object.values(g.E).map(e => [S[e.a], S[e.b]]);
  const maxW = g.compact ? Math.max(70, g.cx * 0.96) : Math.min(170, g.cx * 0.94);
  const nodes = Object.values(g.N).filter(n => n.rec && (n.live || n.k === 'src') && n.k !== 'dock').sort((a, b) => b.adj.length - a.adj.length);
  const junctions = Object.values(g.N).filter(n => n.rec || n.slot).map(n => n.id);
  const top = 30, bot = g.H - (g.compact ? 64 : 56);
  const box = new Map();
  for (const n of nodes) {
    ctx.font = `600 ${F.n}px ${FONT}`; const wN = Math.min(maxW, ctx.measureText(nameOf(n)).width);
    ctx.font = `500 ${F.a}px ${MONO}`; const wA = Math.min(maxW, ctx.measureText(n.rec.a || '').width);
    box.set(n.id, { w: Math.ceil(Math.max(wN, wA)) + 8, h: Math.ceil(F.n + (n.rec.a ? F.a + 4 : 0) + 6) });
  }
  const cands = (w, h) => {
    const out = [];
    for (const gap of [0, 7]) out.push([-w / 2, rN + 3 + gap], [rN + 4 + gap, -h / 2], [-rN - 4 - gap - w, -h / 2], [-w / 2, -rN - 3 - gap - h],
      [rN - 2 + gap, rN - 2 + gap], [-rN + 2 - gap - w, rN - 2 + gap], [rN - 2 + gap, -rN + 2 - gap - h], [-rN + 2 - gap - w, -rN + 2 - gap - h]);
    return out;
  };
  const score = (n, dx, dy, w, h, k, others) => {
    const p = S[n.id], x0 = p.x + dx, y0 = p.y + dy, x1 = x0 + w, y1 = y0 + h;
    let s = (k % 8) * 5 + (k >= 8 ? 30 : 0);
    if (x0 < 2 || x1 > g.W - 2 || y0 < top || y1 > bot) s += 60000;
    for (const b of others) { const ox = Math.min(x1, b[2]) - Math.max(x0, b[0]), oy = Math.min(y1, b[3]) - Math.max(y0, b[1]); if (ox > -2 && oy > -2) s += Math.max(1, ox) * Math.max(1, oy) * 4 + 700; }
    for (const id of junctions) { if (id === n.id) continue; const q = S[id]; if (q.x > x0 - rN && q.x < x1 + rN && q.y > y0 - rN && q.y < y1 + rN) s += 900; }
    for (const [a, b] of segs) for (let k2 = 1; k2 < 14; k2++) { const u = k2 / 14, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u; if (x > x0 - 3 && x < x1 + 3 && y > y0 - 3 && y < y1 + 3) { s += 240; break; } }
    return s;
  };
  const rect = n => { const p = S[n.id], L = n.lab; return [p.x + L.dx, p.y + L.dy, p.x + L.dx + L.w, p.y + L.dy + L.h]; };
  const place = (n, others) => {
    const { w, h } = box.get(n.id);
    let best = null;
    cands(w, h).forEach(([dx, dy], k) => { const s = score(n, dx, dy, w, h, k, others); if (!best || s < best.s) best = { s, dx, dy, w, h }; });
    n.lab = best;
  };
  // два проходи: жадібно, потім кожен підпис ще раз з урахуванням усіх інших
  const placed = [];
  for (const n of nodes) { place(n, placed); placed.push(rect(n)); }
  for (let pass = 0; pass < 2; pass++) for (const n of nodes) place(n, nodes.filter(o => o !== n).map(rect));
  g.labelsDirty = false;
}

// --- головне малювання ---
export function drawGame(g, ctx) {
  const { W, H } = g;
  const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, C.BG); grad.addColorStop(1, C.BG2);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  for (const s of g.stars) { const a = g.reduced ? 0.4 : 0.25 + 0.25 * Math.sin(g.t * 1.3 + s.ph); ctx.fillStyle = s.s > 1 ? `rgba(240,242,246,${a + 0.15})` : `rgba(170,178,192,${a})`; ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s); }
  if (g.phase === 'idle' || !g.N) return drawAttract(g, ctx);
  if (g.labelsDirty) placeLabels(g, ctx);
  ctx.save();
  if (g.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 8 * g.shake), Math.round((Math.random() - 0.5) * 8 * g.shake));
  const S = {};
  for (const id in g.N) S[id] = g.ns(id);
  const hov = hoverPick(g, S);
  g.hovInfo = hov;
  drawCorridors(g, ctx, S, hov);
  g.hotLabel = null;
  drawNodes(g, ctx, S, hov);
  drawTurn(g, ctx, S);
  drawItems(g, ctx, S);
  if (g.hotLabel) drawLabel(g, ctx, g.N[g.hotLabel], S[g.hotLabel], true);
  drawChips(g, ctx, S, hov);
  drawFx(g, ctx, S);
  ctx.restore();
  drawHud(g, ctx);
  drawInspector(g, ctx, hov);
  if (g.banner) {
    const b = g.banner, a = Math.min(1, b.t * 3, (2.4 - b.t) * 2.5);
    ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(Math.min(34, W / 16))}px ${MONO}`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,8,12,.9)'; ctx.strokeText(b.text, W / 2, H * 0.47); ctx.fillStyle = C.RUBY_L; ctx.fillText(b.text, W / 2, H * 0.47);
    ctx.font = `700 ${Math.round(Math.min(18, W / 28))}px ${MONO}`; ctx.strokeText(b.sub.toUpperCase(), W / 2, H * 0.47 + 30); ctx.fillStyle = b.bad ? C.AMBER : C.WHITE; ctx.fillText(b.sub.toUpperCase(), W / 2, H * 0.47 + 30);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}

function hoverPick(g, S) {
  if (!g.hover) return null;
  const { x, y } = g.hover;
  let best = null, bd = 18;
  for (const id in S) { const n = g.N[id]; if (n.slot && !n.live && !n.used) continue; const d = Math.hypot(S[id].x - x, S[id].y - y); if (d < bd) { bd = d; best = { node: id }; } }
  if (best) return best;
  bd = 8;
  for (const e of Object.values(g.E)) {
    if (!e.active) continue;
    const a = S[e.a], b = S[e.b], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)), d = Math.hypot(a.x + u * dx - x, a.y + u * dy - y);
    if (d < bd && u > 0.08 && u < 0.92) { bd = d; best = { edge: e.id }; }
  }
  return best;
}

function drawCorridors(g, ctx, S, hov) {
  const band = g.compact ? 7 : 10, r = g.rb, act = Object.values(g.E).filter(e => e.active);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111824'; ctx.lineWidth = band;
  ctx.beginPath(); for (const e of act) { ctx.moveTo(S[e.a].x, S[e.a].y); ctx.lineTo(S[e.b].x, S[e.b].y); } ctx.stroke();
  ctx.lineCap = 'butt';
  for (const e of act) {
    const a = S[e.a], b = S[e.b], on = r.e === e.id || (hov && hov.edge === e.id);
    if (e.kind === 'data') {
      if (e.fake && e.revealed) {
        ctx.strokeStyle = 'rgba(255,176,32,.16)'; ctx.lineWidth = 6; ctx.setLineDash([]); line(ctx, a, b);
        ctx.strokeStyle = C.AMBER; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -g.t * 12; line(ctx, a, b);
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = on ? 'rgba(184,204,232,.28)' : 'rgba(124,156,200,.15)'; ctx.lineWidth = 6; line(ctx, a, b);
        ctx.strokeStyle = on ? '#C9D8EE' : '#6F8FBE'; ctx.lineWidth = on ? 2.2 : 1.6; line(ctx, a, b);
      }
    } else {
      ctx.setLineDash([2, 6]); ctx.lineDashOffset = 0;
      ctx.strokeStyle = e.lost ? '#7A3442' : e.merged ? '#5B4880' : e.wasFake ? '#6B5524' : on ? '#56627A' : '#353E4D';
      ctx.lineWidth = 1.4; line(ctx, a, b);
    }
  }
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  // пил на зв’язках
  const ds = g.P >= 1.5 ? 3 : 2;
  ctx.fillStyle = '#9CC0F0';
  for (const e of act) {
    if (!e.dust.length) continue;
    const a = S[e.a], b = S[e.b];
    for (const d of e.dust) if (!d.got) ctx.fillRect(Math.round(a.x + (b.x - a.x) * d.u - ds / 2), Math.round(a.y + (b.y - a.y) * d.u - ds / 2), ds, ds);
  }
  // логічні зв’язки після злиття: тонкі фіолетові дуги, щоб було видно, куди перейшли дані
  if (g.logic.length) {
    ctx.save(); ctx.setLineDash([1, 4]); ctx.lineWidth = 1;
    for (const l of g.logic) {
      if (!g.N[l.a].live || !g.N[l.b].live) continue;
      const a = S[l.a], b = S[l.b], mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
      ctx.strokeStyle = l.wrong ? 'rgba(255,96,118,.55)' : 'rgba(192,132,252,.45)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }
}
function line(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }

function drawNodes(g, ctx, S, hov) {
  const P = g.P, F = fonts(g), near = g.nearNode(), scan = g.scanT > 0;
  for (const id in g.N) {
    const n = g.N[id], p = S[id];
    if (n.slot && !n.live) { if (n.used || n.adj.some(i => g.E[i].active)) { ctx.fillStyle = '#2A3240'; ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 4, 4); } continue; }
    if (!n.live && n.k !== 'src' && n.k !== 'dock') {
      ctx.strokeStyle = '#2A3240'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(p.x - 3.5) + 0.5, Math.round(p.y - 3.5) + 0.5, 6, 6);
      continue;
    }
    // кільця: міст під сканером, вузол поруч із пилососом, наведення, спалах злиття, поява
    if (scan && g.aps.has(id) && n.core && n.role !== 'dup') {
      const big = g.bigAps.has(id), pr = 11 * P + (big ? Math.sin(g.t * 8) * 2 : 0);
      ctx.strokeStyle = big ? C.RUBY_L : 'rgba(255,96,118,.55)'; ctx.lineWidth = big ? 2 : 1; ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, Math.PI * 2); ctx.stroke();
      if (big) { ctx.strokeStyle = 'rgba(255,96,118,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, pr + 3, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (id === near || (hov && hov.node === id)) { ctx.strokeStyle = id === near ? 'rgba(244,246,248,.85)' : 'rgba(244,246,248,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 9 * P, 0, Math.PI * 2); ctx.stroke(); }
    if (n.flash > 0) { ctx.strokeStyle = n.flashC; ctx.globalAlpha = n.flash; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 8 * P + (1 - n.flash) * 18, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    let lineC = LINE[n.k] || LINE.p;
    if (n.k === 'src') lineC = g.sealed ? C.FIX : (Math.floor(g.t * 3) % 2 ? C.RUBY_L : C.RUBY);
    glyph(ctx, n.k, Math.round(p.x), Math.round(p.y), P, lineC, '#0F141C', { sealed: g.sealed });
    if (n.role === 'gold' && n.live) star(ctx, Math.round(p.x + 6 * P), Math.round(p.y - 6 * P), Math.max(1, P * 0.8), n.rec.lost ? C.GREY : C.AMBER);
    if (n.rec && n.rec.mixed) { ctx.fillStyle = C.RUBY_L; ctx.font = `800 ${F.n}px ${MONO}`; ctx.fillText('!', p.x + 5 * P, p.y + 9 * P); }
    if (g.t - n.born < 3) { const u = (g.t - n.born) / 3; ctx.strokeStyle = `rgba(255,176,32,${1 - u})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 8 * P + u * 22, 0, Math.PI * 2); ctx.stroke(); }
    // підпис (підпис вузла під пилососом малюємо пізніше, поверх спрайта)
    if (!n.rec || n.k === 'dock' || !n.lab) continue;
    const hot = id === near || (hov && hov.node === id);
    if (id === near) { g.hotLabel = id; continue; }
    drawLabel(g, ctx, n, p, hot);
  }
}
function drawLabel(g, ctx, n, p, hot) {
  const F = fonts(g), P = g.P, scan = g.scanT > 0, id = n.id;
  {
    const L = n.lab, x0 = Math.round(p.x + L.dx), y0 = Math.round(p.y + L.dy);
    ctx.fillStyle = hot ? 'rgba(14,20,30,.92)' : 'rgba(8,11,16,.72)'; ctx.fillRect(x0, y0, L.w, L.h);
    if (hot) { ctx.strokeStyle = 'rgba(244,246,248,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, L.w - 1, L.h - 1); }
    ctx.font = `600 ${F.n}px ${FONT}`; ctx.fillStyle = n.k === 'src' ? (g.sealed ? '#8FF5E5' : C.RUBY_L) : hot ? C.WHITE : '#DCE2EA';
    const nm = fit(ctx, nameOf(n), L.w - 8);
    if (n.role === 'gold' && nm.startsWith('★')) { ctx.fillStyle = n.rec.lost ? C.GREY : C.AMBER; ctx.fillText('★', x0 + 4, y0 + F.n + 2); ctx.fillStyle = hot ? C.WHITE : '#DCE2EA'; ctx.fillText(nm.slice(1), x0 + 4 + ctx.measureText('★').width, y0 + F.n + 2); }
    else ctx.fillText(nm, x0 + 4, y0 + F.n + 2);
    if (n.rec.a) { ctx.font = `500 ${F.a}px ${MONO}`; ctx.fillStyle = hot ? '#C9D0D9' : '#8E9AAB'; ctx.fillText(fit(ctx, n.rec.a, L.w - 8), x0 + 4, y0 + F.n + F.a + 5); }
    if (g.t - n.born < 3 && n.slot) { ctx.font = `700 9px ${MONO}`; const tg = g.T.hud.newTag, tw = ctx.measureText(tg).width + 8; ctx.fillStyle = C.AMBER; ctx.fillRect(x0 + L.w - tw, y0 - 11, tw, 11); ctx.fillStyle = C.DARK; ctx.fillText(tg, x0 + L.w - tw + 4, y0 - 2); }
    if (scan && g.bigAps.has(id) && n.core && n.role !== 'dup') { ctx.font = `700 9px ${MONO}`; const tg = g.T.hud.bridge, tw = ctx.measureText(tg).width + 8; ctx.fillStyle = C.RUBY; ctx.fillRect(Math.round(p.x - tw / 2), Math.round(p.y - 13 * P - 11), tw, 12); ctx.fillStyle = C.WHITE; ctx.fillText(tg, Math.round(p.x - tw / 2 + 4), Math.round(p.y - 13 * P - 2)); }
  }
}

// стрілка: куди пилосос поверне на найближчому вузлі
function drawTurn(g, ctx, S) {
  const r = g.rb;
  const at = r.e ? r.to : r.at;
  if (!at || (!r.e && !r.want && !r.path)) return;
  const e = g.pick(at, r, true);
  if (!e) return;
  const o = g.other(e, at), a = S[at], b = S[o], d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
  const k = Math.min(26, d * 0.3), cx = a.x + ux * k, cy = a.y + uy * k, s = g.compact ? 4 : 5;
  ctx.fillStyle = r.path ? 'rgba(45,212,191,.55)' : 'rgba(45,212,191,.9)';
  ctx.beginPath(); ctx.moveTo(cx + ux * s, cy + uy * s); ctx.lineTo(cx - ux * s - uy * s, cy - uy * s + ux * s); ctx.lineTo(cx - ux * s + uy * s, cy - uy * s - ux * s); ctx.closePath(); ctx.fill();
}

function drawItems(g, ctx, S) {
  const P = g.P, t = g.t;
  // капсула
  if (g.cap) {
    const p = S[g.cap.node], y = g.cap.y0 + (p.y - 12 * P - g.cap.y0) * ease(g.cap.fall), blink = g.cap.t > 13 && Math.floor(t * 8) % 2;
    if (!blink) { capsule(ctx, Math.round(p.x), Math.round(y + (g.cap.fall >= 1 ? Math.sin(t * 4) * 2 : 0)), P * 0.9, t); if (g.cap.fall >= 1 && !g.compact) label(ctx, g.T.hud.power, p.x, y - 9 * P, C.AMBER, 9, true); }
  }
  if (g.ufo) ufo(ctx, Math.round(-60 + (g.W + 120) * g.ufo.f), 40, g.P, t, 1);
  // баги
  for (const b of g.bugs) {
    if (b.state === 'out') continue;
    const p = b.e ? (() => { const a = S[b.from], c = S[b.to]; return { x: a.x + (c.x - a.x) * b.u, y: a.y + (c.y - a.y) * b.u }; })() : S[b.at];
    const scared = g.power > 0 && b.state === 'move';
    if (b.state === 'wait') ctx.globalAlpha = 0.45;
    bug(ctx, Math.round(p.x), Math.round(p.y - 2 * g.PB), g.PB, t, scared ? (g.power < 2 && Math.floor(t * 8) % 2 ? C.WHITE : '#3E6E8E') : b.col, { eyes: scared ? C.AMBER : undefined, dim: b.state === 'wait' });
    ctx.globalAlpha = 1;
  }
  // пилосос
  const r = g.rb, rp = g.robotPos(), x = g.sx(rp.x, rp.y), y = g.sy(rp.x, rp.y);
  if (!(r.inv > 0 && Math.floor(t * 12) % 2)) rider(ctx, Math.round(x), Math.round(y + 4 * P), P, t, { dir: r.dir, eye: r.eye > 0 ? r.eyeC : g.power > 0 ? C.AMBER : null, blink: t % 4 < 0.12, power: g.power > 0, suck: r.eye > 0 && (r.eyeC === '#C084FC' || r.eyeC === '#2DD4BF') });
}

function chip(ctx, text, x, y, fg, bg, border) {
  ctx.font = `600 10px ${MONO}`;
  const w = Math.ceil(ctx.measureText(text).width) + 10, h = 16, x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  ctx.fillStyle = bg; ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
  ctx.fillStyle = fg; ctx.fillText(text, x0 + 5, y0 + 11.5);
}
function drawChips(g, ctx, S, hov) {
  const show = new Set();
  if (g.rb.e && g.E[g.rb.e].kind === 'data') show.add(g.rb.e);
  if (hov && hov.edge && g.E[hov.edge].kind === 'data') show.add(hov.edge);
  if (g.scanT > 0) for (const e of Object.values(g.E)) if (e.active && e.fake && e.kind === 'data') show.add(e.id);
  for (const id of show) {
    const e = g.E[id], a = S[e.a], b = S[e.b], s = g.basis(e);
    const amber = e.fake && e.revealed;
    chip(ctx, s, (a.x + b.x) / 2, (a.y + b.y) / 2 - (Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? 12 : 0), amber ? C.DARK : '#DCE2EA', amber ? C.AMBER : 'rgba(10,14,20,.94)', amber ? C.AMBER : 'rgba(156,192,240,.55)');
  }
}

function drawFx(g, ctx, S) {
  const P = g.P, rp = g.robotPos(), R = { x: g.sx(rp.x, rp.y), y: g.sy(rp.x, rp.y) };
  const scr = (x, y) => ({ x: g.sx(x, y), y: g.sy(x, y) });
  for (const f of g.fx) {
    const u = f.t / f.dur;
    if (f.kind === 'suck') {
      const p = scr(f.x, f.y), n = g.reduced ? 4 : 10;
      for (let k = 0; k < n; k++) {
        const v = Math.min(1, u * 1.3 + k * 0.03), a = k * 2.4 + u * 9, rad = (1 - v) * 18;
        const x = p.x + (R.x - p.x) * ease(v) + Math.cos(a) * rad, y = p.y + (R.y - p.y) * ease(v) + Math.sin(a) * rad;
        ctx.fillStyle = k % 2 ? C.MERGE : C.FIX; ctx.fillRect(Math.round(x), Math.round(y), P + 1, P + 1);
      }
      if (u < 0.5) { const s = (1 - u * 2) * 7 * P; ctx.strokeStyle = 'rgba(244,246,248,.7)'; ctx.lineWidth = 1; ctx.strokeRect(p.x - s, p.y - s, s * 2, s * 2); }
    } else if (f.kind === 'fly') {
      const o = scr(f.ox, f.oy), a = scr(f.ax, f.ay), b = scr(f.bx, f.by), v = ease(Math.min(1, u * 1.4));
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; ctx.strokeStyle = f.c; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(a.x + (b.x - a.x) * v, a.y + (b.y - a.y) * v); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    } else if (f.kind === 'snip') {
      const p = scr(f.x, f.y), s = 6 + u * 10;
      ctx.globalAlpha = 1 - u; ctx.strokeStyle = C.WHITE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s); ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s); ctx.stroke();
      ctx.fillStyle = C.RUBY_L; for (let k = 0; k < (g.reduced ? 3 : 8); k++) { const a = k * 0.785, r = 4 + u * 22; ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r), 2, 2); }
      ctx.globalAlpha = 1;
    } else if (f.kind === 'boom') { const p = scr(f.x, f.y); boom(ctx, p.x, p.y, P, u, f.big); }
    else if (f.kind === 'spawn') { const p = scr(f.x, f.y); ctx.strokeStyle = `rgba(255,176,32,${1 - u})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + u * 30, 0, Math.PI * 2); ctx.stroke(); }
    else if (f.kind === 'seal') { const p = scr(f.x, f.y); for (let k = 0; k < 3; k++) { const v = (u + k * 0.2) % 1; ctx.strokeStyle = `rgba(45,212,191,${1 - v})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + v * 46, 0, Math.PI * 2); ctx.stroke(); } }
    else if (f.kind === 'pipe') {
      const a = scr(f.ax, f.ay), b = scr(f.bx, f.by), v = ease(Math.min(1, u * 1.6));
      ctx.globalAlpha = 1 - u * 0.8; ctx.strokeStyle = 'rgba(255,96,118,.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); line(ctx, a, b); ctx.setLineDash([]);
      ctx.fillStyle = C.RUBY_L; ctx.fillRect(Math.round(a.x + (b.x - a.x) * v - 3), Math.round(a.y + (b.y - a.y) * v - 3), 6, 6); ctx.globalAlpha = 1;
    }
  }
  // сканер: смуга проходить полем зліва направо
  if (g.scanT > 4.8) {
    const u = (5.5 - g.scanT) / 0.7, x = g.bx - 30 + (g.bw + 60) * u;
    const gr = ctx.createLinearGradient(x - 60, 0, x, 0); gr.addColorStop(0, 'rgba(255,176,32,0)'); gr.addColorStop(1, 'rgba(255,176,32,.28)');
    ctx.fillStyle = gr; ctx.fillRect(x - 60, 28, 60, g.H - 90); ctx.fillStyle = C.AMBER; ctx.fillRect(Math.round(x), 28, 2, g.H - 90);
  }
  for (const x of g.texts) { const p = scr(x.x, x.y); ctx.globalAlpha = Math.max(0, 1 - x.t / 1.3); label(ctx, x.text, p.x, p.y - 16 - x.t * 26, x.color, 12, true); ctx.globalAlpha = 1; }
}

// --- рядки стану ---
function drawHud(g, ctx) {
  const { W, H } = g, T = g.T, c = g.compact;
  ctx.fillStyle = 'rgba(8,11,16,.86)'; ctx.fillRect(0, 0, W, 26);
  ctx.font = `700 ${c ? 10.5 : 12}px ${MONO}`; ctx.fillStyle = C.RUBY_L;
  const lvT = `${c ? 'L' : T.hud.level + ' '}${g.lv}`; ctx.fillText(lvT, 10, 18);
  ctx.fillStyle = C.SILVER; ctx.fillText(fit(ctx, T.levels[g.lv - 1].title.toUpperCase(), W * (c ? 0.3 : 0.32)), 10 + ctx.measureText(lvT + '  ').width, 18);
  // час
  const timed = g.mode === 'normal', left = Math.max(0, g.cfg.time - g.elapsed), sec = timed ? Math.ceil(left) : Math.floor(g.elapsed);
  const tt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  ctx.textAlign = 'center'; ctx.fillStyle = timed && left < 20 && Math.floor(g.t * 2) % 2 ? C.RUBY_L : C.WHITE; ctx.fillText((c ? '' : T.hud.time + ' ') + tt, W * (c ? 0.6 : 0.5), 18);
  // рахунок праворуч, серія й капсула ліворуч від нього, щоб не закривати поле
  ctx.textAlign = 'right'; ctx.fillStyle = C.WHITE;
  const sc = `${c ? '' : T.hud.score + ' '}${String(g.score).padStart(5, '0')}`;
  ctx.fillText(sc, W - 10, 18);
  let rx = W - 10 - ctx.measureText(sc).width - 14;
  if (g.combo >= 3) { const cs = `×${g.combo >= 10 ? 4 : g.combo >= 6 ? 3 : 2}${c ? '' : ' ' + T.hud.combo + ' ' + g.combo}`; ctx.fillStyle = C.FIX; ctx.fillText(cs, rx, 18); rx -= ctx.measureText(cs).width + 12; }
  if (g.power > 0 && rx > W * 0.66) { ctx.fillStyle = C.AMBER; ctx.fillText(`${c ? '' : T.hud.power + ' '}${Math.ceil(g.power)}`, rx, 18); }
  ctx.textAlign = 'left';
  // нижній рядок
  const y0 = H - 26;
  ctx.fillStyle = '#080B10'; ctx.fillRect(0, y0, W, 26); ctx.fillStyle = 'rgba(217,4,41,.55)'; ctx.fillRect(0, y0, W, 1);
  for (let k = 0; k < 3; k++) battery(ctx, 16 + k * 18, y0 + 13, c ? 1 : 1.5, k < g.lives);
  ctx.font = `700 ${c ? 9.5 : 11}px ${MONO}`;
  let x = 16 + 3 * 18 + 6;
  const put = (s, col) => { ctx.fillStyle = col; ctx.fillText(s, x, y0 + 17); x += ctx.measureText(s).width + (c ? 10 : 18); };
  put(`${T.hud.junk} ${g.junkLeft()}`, g.junkLeft() ? C.AMBER : '#8FF5E5');
  put(c ? T.hud.compsShort(g.comps) : T.hud.comps(g.comps), g.comps > g.comps0 ? C.RUBY_L : '#8FF5E5');
  const meter = (v, lab, col, ready) => {
    const mw = c ? 24 : 64;
    if (x + mw + (c ? 16 : 70) > W - (c ? 40 : 120)) return;
    ctx.fillStyle = '#1C2A42'; ctx.fillRect(x, y0 + 10, mw, 6); ctx.fillStyle = ready && Math.floor(g.t * 6) % 2 ? C.WHITE : col; ctx.fillRect(x, y0 + 10, mw * v, 6);
    x += mw + 6; put(lab, ready ? C.WHITE : C.SILVER);
  };
  if (g.cfg.scanner) meter(g.scanT > 0 ? g.scanT / 5.5 : g.scan, c ? 'C' : g.scanT > 0 ? T.hud.scanning : g.scan >= 1 ? T.hud.scanReady : T.hud.scan, C.AMBER, g.scan >= 1 && g.scanT <= 0);
  if (g.cfg.source && !g.sealed) meter(g.rule, c ? 'V' : g.ruleReady ? T.hud.ruleReady : T.hud.rule, C.RUBY_L, g.ruleReady);
  const dec = [...g.items.values()].filter(i => i.you), q = dec.length ? dec.reduce((s, i) => s + i.credit, 0) / dec.length : null;
  ctx.textAlign = 'right'; ctx.fillStyle = q == null ? C.SILVER : q >= 0.85 ? '#8FF5E5' : q >= 0.7 ? C.AMBER : C.RUBY_L;
  ctx.fillText(`${c ? '' : T.hud.quality + ' '}${q == null ? '…' : Math.round(q * 100) + '%'}`, W - 10, y0 + 17); ctx.textAlign = 'left';
}

export function inspectorText(g, hov) {
  const T = g.T, F = T.f, I = T.insp, r = g.rb;
  let id = hov && hov.node, eid = hov && hov.edge;
  let ahead = false;
  if (!id && !eid) {
    id = g.nearNode();
    // у коридорі показуємо запис вузла, до якого їдемо: його можна прочитати заздалегідь, підставу зв’язку видно на полі
    if (!id && r.e) { const e = g.E[r.e], n = g.N[r.to]; if (n && n.live && n.rec && n.k !== 'dock' && r.u > 0.35) { id = r.to; ahead = true; } else eid = r.e; }
  }
  if (eid) { const e = g.E[eid]; return e.kind === 'data' ? { tag: T.kinds.link || '', text: I.link(g.N[e.a].rec ? g.N[e.a].rec.n : '·', g.N[e.b].rec ? g.N[e.b].rec.n : '·', g.basis(e)), amber: e.fake && e.revealed } : { text: I.duct, dim: true }; }
  if (!id) return { text: I.hint, dim: true };
  const n = g.N[id];
  if (n.k === 'dock') return { text: I.dock, dim: true };
  if (!n.live && n.k !== 'src') return { text: n.slot && !n.used ? I.slot : I.empty, dim: true };
  const rec = n.rec, parts = [`${rec.n}`];
  if (rec.a) parts.push(g.attrText(rec));
  if (rec.created) parts.push(`${F.created} ${rec.created}`);
  if (rec.x) parts.push(rec.x);
  if (n.k !== 'src') { const k = g.linksOf(id); parts.push(k ? F.links(k) : F.none); }
  if (n.role === 'gold') parts.push(rec.lost ? `★ ${F.lost}` : `★ ${F.gold}`);
  if (rec.mixed) parts.push(F.mixed);
  if (n.merged) parts.push(F.merged(n.merged));
  return { tag: (ahead ? '→ ' : '') + T.kinds[n.k], text: parts.join(' · ') };
}
function drawInspector(g, ctx, hov) {
  const { W, H } = g, c = g.compact, h = c ? 34 : 26, y0 = H - 26 - h;
  ctx.fillStyle = 'rgba(10,14,20,.9)'; ctx.fillRect(0, y0, W, h); ctx.fillStyle = '#1C2A42'; ctx.fillRect(0, y0, W, 1);
  const info = inspectorText(g, hov);
  let x = 12;
  if (info.tag) {
    ctx.font = `700 ${c ? 8.5 : 9.5}px ${MONO}`; const tg = info.tag.toUpperCase(), tw = ctx.measureText(tg).width + 10;
    ctx.fillStyle = info.amber ? C.AMBER : '#1C2A42'; ctx.fillRect(x, y0 + (c ? 5 : 6), tw, 14);
    ctx.fillStyle = info.amber ? C.DARK : C.SILVER; ctx.fillText(tg, x + 5, y0 + (c ? 15.5 : 16.5)); x += tw + 8;
  }
  ctx.font = `500 ${c ? 10 : 12}px ${FONT}`; ctx.fillStyle = info.dim ? '#7F8B9C' : info.amber ? C.AMBER : '#E6EAF0';
  if (!c) { ctx.fillText(fit(ctx, info.text, W - x - 12), x, y0 + 17); return; }
  // на вузькому екрані до двох рядків
  const words = info.text.split(' '), lines = [''];
  for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (ctx.measureText(t).width > W - x - 10 && lines[lines.length - 1]) { if (lines.length === 2) { lines[1] = fit(ctx, lines[1] + ' ' + w, W - x - 10); break; } lines.push(w); } else lines[lines.length - 1] = t; }
  lines.forEach((l, k) => ctx.fillText(l, x, y0 + 14 + k * 13));
}

// --- заставка до старту: міні-граф, баги й пилосос, що їздить коридором ---
function drawAttract(g, ctx) {
  const { W, H, t } = g, P = g.P;
  const pts = [[0.12, 0.72], [0.3, 0.58], [0.48, 0.74], [0.66, 0.6], [0.86, 0.72], [0.22, 0.88], [0.58, 0.9], [0.4, 0.42], [0.76, 0.4]].map(([x, y]) => ({ x: x * W, y: y * H }));
  const ed = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 2], [2, 6], [6, 4], [1, 7], [7, 3], [3, 8]];
  ctx.globalAlpha = 0.55;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#111824'; ctx.lineWidth = 10;
  ctx.beginPath(); for (const [a, b] of ed) { ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); } ctx.stroke(); ctx.lineCap = 'butt';
  ed.forEach(([a, b], k) => { ctx.strokeStyle = k % 4 === 3 ? C.AMBER : '#6F8FBE'; ctx.lineWidth = 1.6; ctx.setLineDash(k % 4 === 3 ? [6, 5] : []); line(ctx, pts[a], pts[b]); });
  ctx.setLineDash([]);
  pts.forEach((p, k) => glyph(ctx, ['p', 'h', 'c', 'i', 'p', 'p', 'c', 'p', 'h'][k], Math.round(p.x), Math.round(p.y), P, LINE[['p', 'h', 'c', 'i', 'p', 'p', 'c', 'p', 'h'][k]]));
  const route = [0, 1, 2, 3, 4], seg = (Math.abs(t) * 0.45) % (route.length - 1), k = Math.min(route.length - 2, Math.floor(seg)), u = seg - k;
  const a = pts[route[k]], b = pts[route[k + 1]];
  for (let j = 0; j < 2; j++) { const s2 = (Math.abs(t) * 0.3 + j * 0.5) % 1, q = j ? [7, 3] : [5, 2], A = pts[q[0]], B = pts[q[1]]; bug(ctx, Math.round(A.x + (B.x - A.x) * s2), Math.round(A.y + (B.y - A.y) * s2), g.PB, t, BUG_COLS[j]); }
  rider(ctx, Math.round(a.x + (b.x - a.x) * u), Math.round(a.y + (b.y - a.y) * u + 3 * P), P, t, { dir: b.x >= a.x ? 1 : -1, blink: t % 4 < 0.12 });
  ctx.globalAlpha = 1;
}
