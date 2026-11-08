// Рушій карти: камера з нахилом і легкою перспективою, малювання регіону, доріг, маршрутів, вантажівок
// і ефектів на canvas. Одна функція draw() для великої карти, мережевого режиму і мінікарт сценаріїв.
// Після кожного кадру лишає екранні координати вузлів, складів і маршрутів для влучання вказівником.
import { NODES, EDGES, REGION, RIVER, LAKE, FOREST_PTS, BOX } from './world.js';

export const COL = {
  depot: ['#3B82F6', '#EC4899', '#0894A8'], ruby: '#D90429', rubyHi: '#F0153B', hud: '#7FDCFF', warn: '#FFB020',
  ink: '#F4F6F8', muted: '#A8B0BC', faint: '#7E8896', bg: '#060A11', idle: '#5B6779',
  seq: ['#2A4F86', '#3A6FB0', '#5C93D6', '#86B6EE', '#ACD5FF'],
};
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const rgba = hexA;

// ——— камера ———
export class Cam {
  constructor() { this.tx = BOX.w / 2; this.ty = BOX.h / 2; this.zoom = 6; this.yaw = 0; this.pitch = 0; this.w = 800; this.h = 500; }
  get F() { return 2.4 * Math.max(this.w, this.h); }
  // світ (км, z угору) → екран; s це перспективний масштаб у точці
  P(x, y, z = 0) {
    const dx = x - this.tx, dy = y - this.ty, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const u = dx * c - dy * s, v = dx * s + dy * c, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const Y = v * cp + z * sp, Zc = (v * sp - z * cp) * this.zoom, k = this.F / (this.F + Zc);
    return [this.w / 2 + u * this.zoom * k, this.h / 2 - Y * this.zoom * k, k];
  }
  // екран → точка на землі
  U(sx, sy) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), F = this.F;
    const a = (this.h / 2 - sy) / this.zoom;
    const v = (a * F) / (F * cp - a * this.zoom * sp);
    const k = F / (F + v * sp * this.zoom), u = (sx - this.w / 2) / (this.zoom * k);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [this.tx + u * c + v * s, this.ty - u * s + v * c];
  }
  copy() { const c = new Cam(); Object.assign(c, this); return c; }
  // вписати набір точок (контур регіону) у вікно з окремими полями з кожного боку
  fitPts(pts, pad = { l: 16, r: 16, t: 16, b: 16 }) {
    const bounds = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { const [sx, sy] = this.P(pts[i][0], pts[i][1]); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      return { x0, x1, y0, y1 };
    };
    this.tx = pts.reduce((a, p) => a + p[0], 0) / pts.length; this.ty = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const aw = Math.max(60, this.w - pad.l - pad.r), ah = Math.max(60, this.h - pad.t - pad.b);
    for (let it = 0; it < 4; it++) {
      let lo = 0.5, hi = 80;
      for (let i = 0; i < 26; i++) { this.zoom = (lo + hi) / 2; const b = bounds(); if (b.x1 - b.x0 <= aw && b.y1 - b.y0 <= ah) lo = this.zoom; else hi = this.zoom; }
      this.zoom = lo;
      const b = bounds(), wa = this.U((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2), wb = this.U(pad.l + aw / 2, pad.t + ah / 2);
      this.tx += wa[0] - wb[0]; this.ty += wa[1] - wb[1];
    }
    return this;
  }
  // вписати прямокутник світу у вікно з полями
  fit(x0 = 0, y0 = 0, x1 = BOX.w, y1 = BOX.h, pad = 24) {
    this.tx = (x0 + x1) / 2; this.ty = (y0 + y1) / 2;
    let lo = 0.5, hi = 60;
    for (let i = 0; i < 30; i++) {
      this.zoom = (lo + hi) / 2;
      let ok = true;
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
        const [sx, sy] = this.P(x, y);
        if (sx < pad || sx > this.w - pad || sy < pad || sy > this.h - pad) { ok = false; break; }
      }
      if (ok) lo = this.zoom; else hi = this.zoom;
    }
    this.zoom = lo;
    return this;
  }
}

// ——— підготовка геометрії ———
// для кожного ребра: точки і параметр 0..1 вздовж довжини (для морфінгу і руху)
export const EDGE_S = EDGES.map(e => {
  const s = [0];
  for (let i = 1; i < e.pts.length; i++) s.push(s[i - 1] + Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]));
  const L = s[s.length - 1] || 1;
  return s.map(v => v / L);
});

// позиція вузла з урахуванням морфінгу «географія → час»
export function nodeXY(S, i) {
  const n = NODES[i];
  if (!S.morph || !S.morphPos) return [n.x, n.y];
  const m = S.morph;
  return [n.x + (S.morphPos[i * 2] - n.x) * m, n.y + (S.morphPos[i * 2 + 1] - n.y) * m];
}
// точка ребра k з урахуванням морфінгу
function edgePt(S, e, k) {
  const p = e.pts[k];
  if (!S.morph || !S.morphPos) return p;
  const s = EDGE_S[e.id][k], m = S.morph, A = NODES[e.a], B = NODES[e.b];
  const dax = (S.morphPos[e.a * 2] - A.x) * m, day = (S.morphPos[e.a * 2 + 1] - A.y) * m;
  const dbx = (S.morphPos[e.b * 2] - B.x) * m, dby = (S.morphPos[e.b * 2 + 1] - B.y) * m;
  return [p[0] + dax * (1 - s) + dbx * s, p[1] + day * (1 - s) + dby * s];
}

// екранна ламана ребра (кеш на кадр)
function edgeScreen(S, id) {
  let v = S._es[id];
  if (v) return v;
  const e = EDGES[id], cam = S.cam, out = new Float32Array(e.pts.length * 2);
  for (let k = 0; k < e.pts.length; k++) { const p = edgePt(S, e, k), q = cam.P(p[0], p[1]); out[k * 2] = q[0]; out[k * 2 + 1] = q[1]; }
  S._es[id] = out;
  return out;
}
// зсув ламаної вбік (смуги, коли кілька маршрутів ідуть одним ребром)
function offsetLine(pts, off, rev) {
  const n = pts.length / 2, out = new Float32Array(pts.length);
  for (let k = 0; k < n; k++) {
    const i = rev ? n - 1 - k : k;
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = pts[b * 2] - pts[a * 2], dy = pts[b * 2 + 1] - pts[a * 2 + 1];
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    const o = rev ? -off : off;
    out[k * 2] = pts[i * 2] - dy * o; out[k * 2 + 1] = pts[i * 2 + 1] + dx * o;
  }
  return out;
}

// маршрут на екрані: суцільна ламана з урахуванням смуг; плюс довжина для «проростання»
export function routeScreen(S, r, ri) {
  const parts = [];
  r.legs.forEach(l => l.edges.forEach(e => {
    const base = edgeScreen(S, e.id), lanes = S.flows ? S.flows.by[e.id] : [ri], n = lanes.length;
    const lane = Math.max(0, lanes.indexOf(ri)), gap = Math.min(3.2, 1 + S.cam.zoom * 0.2);
    const off = n > 1 ? (lane - (n - 1) / 2) * gap * (e.fwd ? 1 : -1) : 0;
    parts.push(off || !e.fwd ? offsetLine(base, off, !e.fwd) : base);
  }));
  const pts = [];
  parts.forEach(p => { for (let k = 0; k < p.length; k += 2) { const x = p[k], y = p[k + 1], L = pts.length; if (L && Math.abs(pts[L - 2] - x) < 0.3 && Math.abs(pts[L - 1] - y) < 0.3) continue; pts.push(x, y); } });
  return pts;
}

// позиція вантажівки маршруту r на годиннику clock (хвилини від півночі)
export function truckAt(S, r, clock) {
  if (clock == null || clock < r.start || clock > r.end) return null;
  for (let li = 0; li < r.legs.length; li++) {
    const l = r.legs[li];
    if (clock < l.dep) {
      // стоїть на зупинці: чекає вікна або розвантажується
      const st = r.stops[li - 1];
      if (!st) return null;
      const [x, y] = nodeXY(S, st.stop.node);
      return { x, y, a: 0, still: true, stop: st };
    }
    if (clock > l.arr) continue;
    const T = l.arr - l.dep;
    let sum = 0;
    for (const e of l.edges) sum += e.min;
    if (!l.edges.length || T <= 0 || sum <= 0) {
      const to = li < r.stops.length ? r.stops[li].stop.node : S.depots[r.d] && S.depots[r.d].node;
      if (to == null) return null;
      const [x, y] = nodeXY(S, to);
      return { x, y, a: 0, still: true };
    }
    let el = clock - l.dep;
    const k = T / sum;
    for (const e of l.edges) {
      const dt = e.min * k;
      if (el <= dt) {
        const E = EDGES[e.id], f = dt ? el / dt : 1, s = e.fwd ? f : 1 - f, sc = EDGE_S[e.id];
        let j = 1;
        while (j < sc.length - 1 && sc[j] < s) j++;
        const t = (s - sc[j - 1]) / (sc[j] - sc[j - 1] || 1), p0 = edgePt(S, E, j - 1), p1 = edgePt(S, E, j);
        return { x: p0[0] + (p1[0] - p0[0]) * t, y: p0[1] + (p1[1] - p0[1]) * t, a: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + (e.fwd ? 0 : Math.PI) };
      }
      el -= dt;
    }
  }
  return null;
}

// ——— спрайти світіння ———
const SPRITES = new Map();
function glow(color, r = 16) {
  const key = color + r;
  if (SPRITES.has(key)) return SPRITES.get(key);
  const c = document.createElement('canvas'), d = r * 2;
  c.width = c.height = d * 2;
  const g = c.getContext('2d'), gr = g.createRadialGradient(d, d, 0, d, d, d);
  gr.addColorStop(0, hexA(color, 0.95)); gr.addColorStop(0.18, hexA(color, 0.6)); gr.addColorStop(0.45, hexA(color, 0.16)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, d * 2, d * 2);
  SPRITES.set(key, c);
  return c;
}

const KIND_RANK = { super: 0, hosp: 1, school: 2, hub: 3, shop: 4 };
function glyph(ctx, kind, x, y, r) {
  ctx.beginPath();
  if (kind === 'super') ctx.rect(x - r, y - r, r * 2, r * 2);
  else if (kind === 'hosp') { const w = r * 0.42; ctx.rect(x - w, y - r, w * 2, r * 2); ctx.rect(x - r, y - w, r * 2, w * 2); }
  else if (kind === 'school') { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); }
  else if (kind === 'hub') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.05, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.05, y); ctx.closePath(); }
  else ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
}
export { glyph as drawGlyph };

function polyPath(ctx, S, pts, closed = true) {
  const cam = S.cam;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = cam.P(p[0], p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
  if (closed) ctx.closePath();
}

// ——— головне малювання ———
export function draw(ctx, S) {
  const { cam, w, h } = S, t = S.time || 0, mini = S.mode === 'mini', net = S.mode === 'network';
  S._es = [];
  const morphA = S.morph ? 1 - S.morph : 1;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // тло
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#05080E'); bg.addColorStop(1, '#091019');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // сітка-підлога
  if (!mini) {
    ctx.lineWidth = 1;
    for (let gx = -20; gx <= BOX.w + 20; gx += 10) {
      const a = cam.P(gx, -20), b = cam.P(gx, BOX.h + 20);
      ctx.strokeStyle = gx % 50 === 0 ? 'rgba(127,220,255,.11)' : 'rgba(127,220,255,.05)';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (let gy = -20; gy <= BOX.h + 20; gy += 10) {
      const a = cam.P(-20, gy), b = cam.P(BOX.w + 20, gy);
      ctx.strokeStyle = gy % 50 === 0 ? 'rgba(127,220,255,.11)' : 'rgba(127,220,255,.05)';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }

  // регіон
  ctx.globalAlpha = morphA;
  polyPath(ctx, S, REGION);
  ctx.fillStyle = 'rgba(16,26,42,.72)'; ctx.fill();
  ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(127,220,255,.26)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);

  // ліси: хмара точок
  if (S.layers.forest) {
    for (let i = 0; i < FOREST_PTS.length; i += 3) {
      const q = cam.P(FOREST_PTS[i], FOREST_PTS[i + 1]), r = mini ? 0.7 : 0.8 + FOREST_PTS[i + 2] * 0.9 * q[2];
      ctx.fillStyle = FOREST_PTS[i + 2] > 0.7 ? 'rgba(74,160,112,.42)' : 'rgba(52,120,88,.32)';
      ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r);
    }
  }
  // водосховище і річка
  polyPath(ctx, S, LAKE);
  ctx.fillStyle = 'rgba(20,58,104,.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(79,163,255,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  polyPath(ctx, S, RIVER, false);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(59,130,246,.16)'; ctx.lineWidth = mini ? 4 : Math.max(5, cam.zoom * 1.1); ctx.stroke();
  ctx.strokeStyle = 'rgba(79,163,255,.8)'; ctx.lineWidth = mini ? 1.3 : Math.max(1.6, cam.zoom * 0.32); ctx.stroke();
  if (!mini && S.motion) { ctx.setLineDash([2, 16]); ctx.lineDashOffset = -t * 0.012; ctx.strokeStyle = 'rgba(200,230,255,.45)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
  ctx.globalAlpha = 1;

  // кільця часу в режимі морфінгу
  if (S.morph > 0.02 && S.morphRings) {
    const [cx, cy] = S.morphRings.center;
    ctx.save();
    S.morphRings.rings.forEach(({ r, label }) => {
      ctx.beginPath();
      for (let k = 0; k <= 72; k++) { const a = (k / 72) * Math.PI * 2, q = cam.P(cx + Math.cos(a) * r, cy + Math.sin(a) * r); if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
      ctx.strokeStyle = `rgba(127,220,255,${0.28 * S.morph})`; ctx.setLineDash([3, 6]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      const q = cam.P(cx, cy + r);
      ctx.fillStyle = `rgba(127,220,255,${0.85 * S.morph})`; ctx.font = '600 10.5px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, q[0], q[1] - 4);
    });
    ctx.restore();
  }

  // дороги
  const closed = S.closed || new Set();
  const roadStyle = e => {
    if (e.ferry) return ['rgba(127,220,255,.7)', 1.4, [4, 4]];
    if (e.cls === 1) return ['rgba(200,212,230,.62)', mini ? 1.4 : 2.4, null];
    if (e.cls === 2) return ['rgba(170,184,206,.46)', mini ? 1 : 1.7, null];
    if (e.cls === 3) return ['rgba(140,154,178,.32)', mini ? 0.7 : 1.15, null];
    return ['rgba(176,148,104,.36)', mini ? 0.7 : 1.05, [3, 3]];
  };
  const blocked = id => closed.has(id) || (S.cond && S.cond.flood && (EDGES[id].ferry || EDGES[id].low));
  if (net && S.metric) {
    // мережевий режим: товщина й колір за метрикою
    const m = S.metric.edge;
    EDGES.forEach(e => {
      if (blocked(e.id)) return;
      const v = m[e.id] || 0, p = edgeScreen(S, e.id);
      ctx.beginPath(); for (let k = 0; k < p.length; k += 2) { if (k) ctx.lineTo(p[k], p[k + 1]); else ctx.moveTo(p[k], p[k + 1]); }
      if (v <= 0.001) { ctx.strokeStyle = 'rgba(140,154,178,.22)'; ctx.lineWidth = 1; ctx.setLineDash(e.ferry ? [4, 4] : []); ctx.stroke(); ctx.setLineDash([]); return; }
      const ci = Math.min(4, Math.floor(v * 4.999));
      ctx.strokeStyle = hexA(COL.seq[ci], 0.25); ctx.lineWidth = 2 + v * 14; ctx.stroke();
      ctx.strokeStyle = COL.seq[ci]; ctx.lineWidth = 1.2 + v * 5.5; ctx.stroke();
    });
  } else {
    EDGES.forEach(e => {
      if (blocked(e.id)) return;
      const [col, lw, dash] = roadStyle(e), p = edgeScreen(S, e.id);
      ctx.beginPath(); for (let k = 0; k < p.length; k += 2) { if (k) ctx.lineTo(p[k], p[k + 1]); else ctx.moveTo(p[k], p[k + 1]); }
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
      if (e.bridge && !mini) {
        const m = p.length / 2 | 0, k = m % 2 ? m - 1 : m, x = p[k], y = p[k + 1];
        ctx.fillStyle = e.maxT < 99 ? COL.warn : 'rgba(220,230,245,.9)';
        ctx.beginPath(); ctx.arc(x, y, e.maxT < 99 ? 3.2 : 2.6, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  // закриті ділянки
  EDGES.forEach(e => {
    if (!blocked(e.id)) return;
    const p = edgeScreen(S, e.id);
    ctx.beginPath(); for (let k = 0; k < p.length; k += 2) { if (k) ctx.lineTo(p[k], p[k + 1]); else ctx.moveTo(p[k], p[k + 1]); }
    const heal = S.healing && S.healing.get(e.id);
    ctx.strokeStyle = hexA(COL.rubyHi, 0.22); ctx.lineWidth = mini ? 3 : 7; ctx.stroke();
    ctx.strokeStyle = hexA(COL.rubyHi, 0.95); ctx.lineWidth = mini ? 1.2 : 1.8; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    if (!mini) {
      const m = (p.length / 4 | 0) * 2, x = p[m], y = p[m + 1], s = 5;
      ctx.fillStyle = '#12060A'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COL.rubyHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
      if (heal) { ctx.globalAlpha = heal; ctx.strokeStyle = COL.hud; ctx.beginPath(); ctx.arc(x, y, 8 + (1 - heal) * 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    }
  });

  // маршрути
  const sol = S.sol, sel = S.selRoute, hov = S.hoverRoute;
  S.hit.routes = [];
  if (sol && S.layers.routes !== false && !(net && S.metric && sel == null)) {
    const grow = S.grow == null ? 1 : S.grow;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    sol.routes.forEach((r, ri) => {
      const pts = routeScreen(S, r, ri);
      S.hit.routes.push(pts);
      if (pts.length < 4) return;
      const col = COL.depot[r.d] || COL.idle, dim = (sel != null && sel !== ri) || (hov != null && hov !== ri && sel == null);
      const a = dim ? 0.22 : 1, focus = sel === ri || hov === ri;
      let n = pts.length / 2;
      if (grow < 1) n = Math.max(2, Math.ceil(n * grow));
      const path = () => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let k = 1; k < n; k++) ctx.lineTo(pts[k * 2], pts[k * 2 + 1]); };
      path();
      if (!mini) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA(col, 0.16 * a); ctx.lineWidth = focus ? 12 : 8; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
      ctx.strokeStyle = hexA(col, (mini ? 0.9 : 0.95) * a); ctx.lineWidth = mini ? 1.3 : focus ? 3.4 : r.t === 0 ? 2.8 : r.t === 1 ? 2.2 : 1.7; ctx.stroke();
      if (!mini && S.motion && !dim) {
        ctx.setLineDash([2.5, 11]); ctx.lineDashOffset = -t * 0.028; ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      }
    });
  }

  // вузли і зупинки
  const ord = S.nodeOrders, hit = (S.hit.nodes = new Float32Array(NODES.length * 3));
  const maxPal = 14;
  NODES.forEach((n, i) => {
    const [x, y] = nodeXY(S, i), q = cam.P(x, y), o = ord && ord.get(i);
    hit[i * 3] = q[0]; hit[i * 3 + 1] = q[1]; hit[i * 3 + 2] = 0;
    if (!o || !o.length) {
      const r = n.kind === 'city' ? 3.4 : n.kind === 'town' ? 2.6 : n.kind === 'small' ? 2 : 1.5;
      ctx.fillStyle = n.kind === 'village' ? 'rgba(168,176,188,.5)' : 'rgba(220,228,240,.75)';
      ctx.beginPath(); ctx.arc(q[0], q[1], mini ? r * 0.6 : r, 0, Math.PI * 2); ctx.fill();
      hit[i * 3 + 2] = r + 4;
      return;
    }
    const pal = o.reduce((a, s) => a + s.q, 0), R = mini ? 2.2 : 4.6 + Math.min(1, pal / maxPal) * 5;
    hit[i * 3 + 2] = R + 6;
    // 3D-стовпчики попиту
    if (S.layers.bars && !mini && cam.pitch > 0.12) {
      const hgt = pal * 0.55, top = cam.P(x, y, hgt), wpx = 3 + q[2] * 2.2;
      const col = o[0].ri != null ? COL.depot[o[0].d] : COL.idle;
      const gr = ctx.createLinearGradient(0, q[1], 0, top[1]);
      gr.addColorStop(0, hexA(col, 0.05)); gr.addColorStop(1, hexA(col, 0.55));
      ctx.fillStyle = gr; ctx.fillRect(q[0] - wpx, top[1], wpx * 2, q[1] - top[1]);
      ctx.fillStyle = hexA(col, 0.9); ctx.fillRect(q[0] - wpx, top[1] - 1.5, wpx * 2, 3);
    }
    const unserved = o.some(s => s.ri == null), late = o.some(s => s.late > 0.5), focus = S.selNode === i || S.hoverNode === i;
    const routeDim = sel != null && !o.some(s => s.ri === sel);
    ctx.globalAlpha = routeDim ? 0.35 : 1;
    // кільце із сегментами за маршрутами
    ctx.fillStyle = '#0A111C'; ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, Math.PI * 2); ctx.fill();
    const seg = (Math.PI * 2) / o.length;
    o.forEach((s, k) => {
      ctx.beginPath(); ctx.arc(q[0], q[1], R, -Math.PI / 2 + k * seg + 0.08, -Math.PI / 2 + (k + 1) * seg - 0.08);
      ctx.strokeStyle = s.ri == null ? COL.rubyHi : COL.depot[s.d]; ctx.lineWidth = mini ? 1.4 : 2.6;
      if (s.ri == null) ctx.setLineDash([2, 2]);
      ctx.stroke(); ctx.setLineDash([]);
    });
    if (!mini) {
      const top = o.slice().sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])[0];
      ctx.fillStyle = unserved ? COL.rubyHi : '#E8EEF7';
      glyph(ctx, top.kind, q[0], q[1], Math.max(2, R * 0.42));
      if (late || unserved) {
        ctx.strokeStyle = COL.rubyHi; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(q[0], q[1], R + 4 + (S.motion ? Math.sin(t * 0.006) * 1.2 : 0), 0, Math.PI * 2); ctx.stroke();
      }
      if (focus) { ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q[0], q[1], R + 7, 0, Math.PI * 2); ctx.stroke(); }
      // доставлено (під час відтворення)
      if (S.clock != null && o.every(s => s.end != null && s.end <= S.clock)) {
        ctx.fillStyle = 'rgba(16,185,129,.95)'; ctx.beginPath(); ctx.arc(q[0] + R * 0.8, q[1] - R * 0.8, 3.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  });

  // вантажівки
  if (sol && S.clock != null && !mini && !net) {
    sol.routes.forEach((r, ri) => {
      const p = truckAt(S, r, S.clock);
      if (!p) return;
      const col = COL.depot[r.d], q = cam.P(p.x, p.y), dim = sel != null && sel !== ri;
      ctx.globalAlpha = dim ? 0.3 : 1;
      if (!p.still) {
        // хвіст
        for (let k = 1; k <= 5; k++) {
          const b = truckAt(S, r, S.clock - k * 1.6);
          if (!b || b.still) break;
          const qb = cam.P(b.x, b.y);
          ctx.fillStyle = hexA(col, 0.5 - k * 0.08); ctx.beginPath(); ctx.arc(qb[0], qb[1], 3.2 - k * 0.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.drawImage(glow(col, 14), q[0] - 28, q[1] - 28, 56, 56);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], r.t === 0 ? 4.6 : r.t === 1 ? 3.9 : 3.2, 0, Math.PI * 2); ctx.fill();
      if (p.still && S.motion) { ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(q[0], q[1], 7 + ((t * 0.01) % 8), 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
  }

  // склади: майданчик, кільця і промінь угору
  S.hit.depots = []; S.hit.depotLabels = [];
  (S.depots || []).forEach((dp, k) => {
    const [x, y] = dp.drag ? [dp.x, dp.y] : nodeXY(S, dp.node), q = cam.P(x, y), col = COL.depot[k];
    S.hit.depots.push([q[0], q[1]]);
    if (mini) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      return;
    }
    if (cam.pitch > 0.08) {
      const top = cam.P(x, y, 9);
      const gr = ctx.createLinearGradient(q[0], q[1], top[0], top[1]);
      gr.addColorStop(0, hexA(col, 0.75)); gr.addColorStop(1, hexA(col, 0));
      ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
      for (let j = 0; j < 3; j++) {
        const z = ((t * 0.0012 + j / 3) % 1) * 9, c = cam.P(x, y, z), rr = (10 - z * 0.6) * c[2];
        ctx.strokeStyle = hexA(col, 0.6 * (1 - z / 9)); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(c[0], c[1], rr, rr * Math.cos(cam.pitch), 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.drawImage(glow(col, 26), q[0] - 52, q[1] - 52, 104, 104);
    // шестикутник
    const R = dp.drag ? 15 : 13;
    ctx.beginPath();
    for (let j = 0; j < 6; j++) { const a = Math.PI / 6 + (j * Math.PI) / 3; ctx[j ? 'lineTo' : 'moveTo'](q[0] + Math.cos(a) * R, q[1] + Math.sin(a) * R * (0.6 + 0.4 * Math.cos(cam.pitch))); }
    ctx.closePath(); ctx.fillStyle = '#0B1220'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(S.motion ? t * 0.0009 : 0);
    ctx.setLineDash([4, 5]); ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.fillStyle = COL.ink; ctx.font = '700 12px Montserrat, Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dp.id, q[0], q[1] + 0.5);
    ctx.textBaseline = 'alphabetic';
    if (S.labels !== false && !dp.drag) {
      const label = S.name(NODES[dp.node]);
      ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'left';
      const tw = ctx.measureText(label).width, lx = q[0] + R + 9, ly = q[1] + 4;
      ctx.fillStyle = 'rgba(6,10,17,.78)'; ctx.fillRect(lx - 5, ly - 13, tw + 10, 18);
      ctx.fillStyle = col; ctx.fillRect(lx - 5, ly - 13, 2, 18);
      ctx.fillStyle = COL.ink; ctx.fillText(label, lx, ly);
      S.hit.depotLabels = (S.hit.depotLabels || []).concat([[lx - 5, ly - 13, lx + tw + 5, ly + 5]]);
    }
  });

  // підписи
  if (!mini && S.labels !== false) {
    const boxes = [];
    const fits = b => !boxes.some(c => !(b[2] < c[0] || b[0] > c[2] || b[3] < c[1] || b[1] > c[3]));
    const order = NODES.map((n, i) => i).sort((a, b) => {
      const ra = { city: 0, town: 1, small: 2, village: 3 }, A = NODES[a], B = NODES[b];
      const fa = S.selNode === a || S.hoverNode === a ? -1 : 0, fb = S.selNode === b || S.hoverNode === b ? -1 : 0;
      return fa - fb || ra[A.kind] - ra[B.kind] || B.pop - A.pop;
    });
    (S.depots || []).forEach((dp, k) => { const [x, y] = S.hit.depots[k]; boxes.push([x - 22, y - 22, x + 22, y + 22]); });
    (S.hit.depotLabels || []).forEach(b => boxes.push(b));
    const depNodes = new Set((S.depots || []).filter(d => !d.drag).map(d => d.node));
    ctx.textAlign = 'left';
    order.forEach(i => {
      const n = NODES[i], focus = S.selNode === i || S.hoverNode === i;
      if (depNodes.has(i)) return;
      const show = focus || n.kind !== 'village' || cam.zoom > 8.5 || (cam.zoom > 6.2 && ord && ord.get(i));
      if (!show) return;
      const x = hit[i * 3], y = hit[i * 3 + 1], r = hit[i * 3 + 2];
      if (x < -40 || x > w + 40 || y < -20 || y > h + 20) return;
      const big = n.kind === 'city' || n.kind === 'town';
      ctx.font = (big ? '600 12px' : '500 10.5px') + ' Inter, sans-serif';
      const label = S.name(n), tw = ctx.measureText(label).width;
      let bx = x + r + 3, by = y + 4;
      let b = [bx - 2, by - 11, bx + tw + 2, by + 3];
      if (!fits(b) || bx + tw > w - 2) { bx = x - r - 3 - tw; b = [bx - 2, by - 11, bx + tw + 2, by + 3]; if ((!fits(b) || bx < 2) && !focus) return; }
      boxes.push(b);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,10,17,.85)'; ctx.strokeText(label, bx, by);
      ctx.fillStyle = focus ? COL.ink : big ? 'rgba(236,241,248,.92)' : 'rgba(176,186,200,.85)';
      ctx.fillText(label, bx, by);
    });
  }

  // ефекти: хвилі, слід ножа, магніт
  if (S.fx && S.fx.length) {
    const now = S.now;
    S.fx.forEach(f => {
      const k = Math.min(1, (now - f.t0) / f.dur);
      if (f.kind === 'ripple') {
        const q = cam.P(f.x, f.y);
        ctx.strokeStyle = hexA(f.color || COL.hud, (1 - k) * 0.9); ctx.lineWidth = 2 * (1 - k) + 0.5;
        ctx.beginPath(); ctx.ellipse(q[0], q[1], 10 + k * f.r, (10 + k * f.r) * (0.55 + 0.45 * Math.cos(cam.pitch)), 0, 0, Math.PI * 2); ctx.stroke();
      } else if (f.kind === 'slash' && f.pts.length > 1) {
        ctx.lineCap = 'round';
        for (let j = 1; j < f.pts.length; j++) {
          const age = Math.min(1, (now - f.pts[j][2]) / 700);
          if (age >= 1) continue;
          ctx.beginPath(); ctx.moveTo(f.pts[j - 1][0], f.pts[j - 1][1]); ctx.lineTo(f.pts[j][0], f.pts[j][1]);
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = hexA(COL.rubyHi, 0.35 * (1 - age)); ctx.lineWidth = 14 * (1 - age) + 2; ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = hexA('#FFE3E8', 0.95 * (1 - age)); ctx.lineWidth = 2.6 * (1 - age) + 0.8; ctx.stroke();
        }
      } else if (f.kind === 'spark') {
        const q = cam.P(f.x, f.y);
        ctx.fillStyle = hexA('#FFFFFF', 0.9 * (1 - k)); ctx.beginPath(); ctx.arc(q[0], q[1], 3 + 8 * k, 0, Math.PI * 2); ctx.fill();
        for (let j = 0; j < 10; j++) {
          const a = (j / 10) * Math.PI * 2 + f.seed, r0 = 5 + k * 16, r1 = r0 + 10 * (1 - k);
          ctx.strokeStyle = hexA(j % 2 ? COL.warn : COL.rubyHi, 1 - k); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(q[0] + Math.cos(a) * r0, q[1] + Math.sin(a) * r0); ctx.lineTo(q[0] + Math.cos(a) * r1, q[1] + Math.sin(a) * r1); ctx.stroke();
        }
      }
    });
  }
  if (S.snap) {
    const { from, to } = S.snap, a = cam.P(from[0], from[1]), b = cam.P(to[0], to[1]);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(127,220,255,.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = COL.hud; ctx.beginPath(); ctx.arc(b[0], b[1], 17 + Math.sin(t * 0.012) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// влучання в ламану на екрані
export function nearLine(pts, x, y) {
  let m = Infinity;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], bx = pts[k], by = pts[k + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let u = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    u = Math.max(0, Math.min(1, u));
    m = Math.min(m, Math.hypot(x - ax - u * dx, y - ay - u * dy));
  }
  return m;
}
// чи перетинає відрізок екрану ламану ребра: повертає точку перетину на екрані
export function slashHit(S, id, a, b) {
  const p = edgeScreen(S, id);
  for (let k = 2; k < p.length; k += 2) {
    const c = [p[k - 2], p[k - 1]], d = [p[k], p[k + 1]];
    const d1 = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
    if (Math.abs(d1) < 1e-9) continue;
    const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / d1;
    const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / d1;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }
  return null;
}
export function edgeNear(S, x, y, maxPx = 7) {
  let best = -1, bd = maxPx;
  EDGES.forEach(e => { const d = nearLine(edgeScreen(S, e.id), x, y); if (d < bd) { bd = d; best = e.id; } });
  return best;
}
export function prepFrame(S) { S._es = []; }
