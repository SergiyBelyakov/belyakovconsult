// Велика карта-сцена: canvas з нахилом і обертанням, живі маршрути й вантажівки, жести.
// Склад перетягується з магнітом до населених пунктів, ніж розрізає дороги, довге натискання на пункт
// відкриває кругову ручку замовлення, шкала внизу прокручує день. Усе дублюється кнопками і клавішами.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NODES, EDGES, CUSTOMERS, DAY, TYPES, REGION } from './world.js';
import { Cam, COL, draw, nearLine, slashHit, edgeNear, truckAt, rgba } from './engine.js';
import { hm } from './clock.js';
import { sfx } from './sound.js';
import { Icon } from '../../dashboard/src/icons.jsx';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PITCH_3D = 0.62, YAW_3D = -0.08, MAXP = 1.05;
const pads = w => (w < 760 ? { l: 10, r: 10, t: 92, b: 62 } : { l: 18, r: 18, t: 96, b: 100 });
const DIAL_MAX = 14;
let coachSeen = false;
try { coachSeen = localStorage.getItem('bc-route-coach') === '1'; } catch { coachSeen = false; }

export default function MapStage({ ctx, sol, depots, closed, cond, nodeOrders, mode = 'dispatch', metric, morph = 0, morphPos, morphRings, clock,
  selRoute, setSelRoute, selNode, setSelNode, onDepotPreview, onDepotCommit, onDepotCancel, onCut, onHeal, onDemand, solving, height = 600, kpi, onUndo, canUndo, extraHud }) {
  const { T, f, lang } = ctx;
  const wrapRef = useRef(null), cvRef = useRef(null), tipRef = useRef(null), scrubRef = useRef(null), headRef = useRef(null), clockRef = useRef(null), doneRef = useRef(null), coordRef = useRef(null), scaleRef = useRef(null);
  const camRef = useRef(null), S = useRef(null), st = useRef({ ptrs: new Map(), drag: null, vel: null, pending: null, dial: null, slash: null, last: 0, active: 0 });
  const [tool, setTool] = useState('pan');
  const [threeD, setThreeD] = useState(true);
  const [layers, setLayers] = useState({ forest: true, bars: false, routes: true });
  const [tip, setTip] = useState(null);
  const [dial, setDial] = useState(null);
  const [hint, setHint] = useState(null);
  const [coach, setCoach] = useState(!coachSeen && mode === 'dispatch');
  const [full, setFull] = useState(false);
  const [sound, setSound] = useState(sfx.on);
  const [playing, setPlaying] = useState(clock.playing);
  const [speed, setSpeed] = useState(clock.speed);
  const [layerMenu, setLayerMenu] = useState(false);
  const motion = !reduced();
  const name = n => (lang === 'uk' ? n.name.uk : n.name.lat);

  if (!camRef.current) { const c = new Cam(); c.pitch = motion ? 0.05 : PITCH_3D; c.yaw = motion ? -0.42 : YAW_3D; camRef.current = c; }
  if (!S.current) S.current = { cam: camRef.current, hit: {}, fx: [], layers, motion, mode, name, time: 0, now: 0, grow: motion ? 0 : 1, growT0: 0 };
  // сцена бере свіжі дані щорендеру; анімаційний цикл читає їх із ref
  const sc = S.current;
  if (typeof window !== 'undefined' && window.__RP_TEST) window.__RP_TEST.sc = sc;
  Object.assign(sc, { sol, flows: sol ? sol.flows : null, closed: sc.closedPreview ? new Set([...closed, ...sc.closedPreview]) : closed, cond, nodeOrders, mode, metric, morph, morphPos, morphRings, layers, motion, name, selRoute, selNode });
  if (!sc.dragDepot) sc.depots = depots.map((n, k) => ({ node: n, id: ['A', 'B', 'C'][k] }));

  // «проростання» маршрутів після підтвердженої зміни
  const solId = sol ? sol.id : null, prevSol = useRef(null);
  useEffect(() => {
    if (!sol) return;
    sc.hoverRoute = null;
    if (prevSol.current && sol.grow && motion) { sc.grow = 0; sc.growT0 = performance.now(); }
    prevSol.current = sol;
  }, [solId]);

  // розмір полотна
  useLayoutEffect(() => {
    const cv = cvRef.current, wrap = wrapRef.current;
    const fit = () => {
      const r = wrap.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(280, Math.round(r.width)), h = Math.max(260, Math.round(r.height));
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const first = !sc.w;
      Object.assign(sc, { w, h, dpr });
      const cam = camRef.current; cam.w = w; cam.h = h;
      if (first) {
        const p = cam.pitch, y = cam.yaw;
        cam.pitch = threeD ? PITCH_3D : 0; cam.yaw = threeD ? YAW_3D : 0; cam.fitPts(REGION, pads(w));
        sc.homeCam = cam.copy();
        if (motion) { sc.boot = { t0: performance.now(), from: { pitch: p, yaw: y, zoom: cam.zoom * 0.72 }, to: { pitch: cam.pitch, yaw: cam.yaw, zoom: cam.zoom } }; cam.pitch = p; cam.yaw = y; cam.zoom *= 0.72; }
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // анімаційний цикл
  useEffect(() => {
    const cv = cvRef.current, g = cv.getContext('2d');
    let raf = 0, last = performance.now(), visible = true;
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
    io.observe(cv);
    const ease = k => 1 - (1 - k) ** 3;
    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(64, now - last);
      if (!visible || (document.hidden)) { last = now; return; }
      const s = st.current, cam = camRef.current;
      // без руху й без взаємодії малюємо рідше
      if (!clock.playing && now - s.active > 1500 && !sc.boot && sc.grow >= 1 && !sc.fx.length && !s.anim && now - last < (motion ? 33 : 250)) return;
      last = now;
      clock.tick(dt);
      // заставка: камера сідає на місце
      if (sc.boot) {
        const k = Math.min(1, (now - sc.boot.t0) / 1700), e = ease(k), { from, to } = sc.boot;
        cam.pitch = from.pitch + (to.pitch - from.pitch) * e; cam.yaw = from.yaw + (to.yaw - from.yaw) * e; cam.zoom = from.zoom + (to.zoom - from.zoom) * e;
        if (k >= 1) { sc.boot = null; sc.grow = 0; sc.growT0 = now; }
      }
      // плавні переходи камери (кнопки)
      if (s.anim) {
        const k = Math.min(1, (now - s.anim.t0) / s.anim.dur), e = ease(k), a = s.anim;
        ['tx', 'ty', 'zoom', 'yaw', 'pitch'].forEach(p => { if (a.to[p] != null) cam[p] = a.from[p] + (a.to[p] - a.from[p]) * e; });
        if (k >= 1) s.anim = null;
      }
      // інерція панорамування
      if (s.vel && !s.drag) {
        cam.tx += s.vel[0] * dt; cam.ty += s.vel[1] * dt;
        s.vel[0] *= Math.pow(0.9, dt / 16); s.vel[1] *= Math.pow(0.9, dt / 16);
        if (Math.hypot(s.vel[0], s.vel[1]) < 0.0004) s.vel = null;
      }
      if (sc.grow < 1) sc.grow = Math.min(1, (now - sc.growT0) / 1100);
      sc.fx = sc.fx.filter(fx => now - fx.t0 < fx.dur);
      if (sc.healing) { sc.healing.forEach((v, k) => { const nv = v - dt / 500; if (nv <= 0) sc.healing.delete(k); else sc.healing.set(k, nv); }); }
      sc.time = now; sc.now = now; sc.clock = clock.get() > DAY[0] + 0.5 || clock.playing ? clock.get() : null;
      g.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
      draw(g, sc);
      // масштабна лінійка
      if (scaleRef.current) {
        const kmPx = cam.zoom, nice = [1, 2, 5, 10, 20, 50].find(v => v * kmPx >= 60) || 50;
        scaleRef.current.style.width = Math.round(nice * kmPx) + 'px';
        scaleRef.current.dataset.label = f.km0(nice);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  // годинник: шкала, підпис часу, доставлено
  useEffect(() => { const h = (v, pl) => {
    const k = (v - DAY[0]) / (DAY[1] - DAY[0]);
    if (headRef.current) headRef.current.style.left = (k * 100).toFixed(3) + '%';
    if (clockRef.current) clockRef.current.textContent = hm(v);
    if (doneRef.current && sol) {
      let n = 0, all = 0;
      sol.routes.forEach(r => r.stops.forEach(s => { all++; if (s.end <= v) n++; }));
      doneRef.current.textContent = T.map.delivered(n, all + sol.unserved.length);
    }
    setPlaying(pl);
    st.current.active = performance.now();
  }; h(clock.get(), clock.playing); return clock.sub(h); }, [sol]);
  useEffect(() => { clock.set(clock.get()); }, [sol]);

  const wake = () => { st.current.active = performance.now(); };
  const animTo = (to, dur = 650) => { setCoach(false); const cam = camRef.current; st.current.anim = { t0: performance.now(), dur, from: { tx: cam.tx, ty: cam.ty, zoom: cam.zoom, yaw: cam.yaw, pitch: cam.pitch }, to }; st.current.vel = null; wake(); };
  const toggle3D = () => { const v = !threeD; setThreeD(v); animTo({ pitch: v ? PITCH_3D : 0 }); };
  const home = () => { const c = camRef.current.copy(); c.pitch = threeD ? PITCH_3D : 0; c.yaw = threeD ? YAW_3D : 0; c.fitPts(REGION, pads(sc.w)); animTo({ tx: c.tx, ty: c.ty, zoom: c.zoom, yaw: c.yaw, pitch: c.pitch }); };
  const zoomBy = k => { const cam = camRef.current; animTo({ zoom: Math.max(1.5, Math.min(40, cam.zoom * k)) }, 300); };
  const rotate = d => animTo({ yaw: camRef.current.yaw + d }, 420);

  // ——— влучання ———
  const pick = (x, y) => {
    const h = sc.hit;
    if (mode === 'dispatch' || mode === 'network') {
      const dI = (h.depots || []).findIndex(([dx, dy]) => Math.hypot(dx - x, dy - y) < 20);
      if (dI >= 0 && mode === 'dispatch') return { kind: 'depot', k: dI };
    }
    let bn = -1, bd = Infinity;
    if (h.nodes) for (let i = 0; i < NODES.length; i++) { const d = Math.hypot(h.nodes[i * 3] - x, h.nodes[i * 3 + 1] - y); if (d < Math.max(10, h.nodes[i * 3 + 2]) && d < bd) { bd = d; bn = i; } }
    if (bn >= 0) return { kind: 'node', i: bn };
    const ce = closedNear(x, y);
    if (ce >= 0) return { kind: 'closed', id: ce };
    if (h.routes) { let br = -1, rd = 7; h.routes.forEach((pts, ri) => { const d = nearLine(pts, x, y); if (d < rd) { rd = d; br = ri; } }); if (br >= 0) return { kind: 'route', ri: br }; }
    const e = edgeNear(sc, x, y, 5);
    if (e >= 0) return { kind: 'edge', id: e };
    return null;
  };
  const closedNear = (x, y) => {
    let best = -1, bd = 14;
    (sc.closed || new Set()).forEach(id => {
      const ed = EDGES[id], pts = ed.pts, m = pts[Math.floor(pts.length / 2)];
      const q = camRef.current.P(m[0], m[1]);
      const d = Math.hypot(q[0] - x, q[1] - y);
      if (d < bd) { bd = d; best = id; }
      const e2 = edgeNear(sc, x, y, 6);
      if (e2 === id && bd > 6) { bd = 6; best = id; }
    });
    return best;
  };
  const local = e => { const r = cvRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // підказка при наведенні
  const tipFor = (p, x, y) => {
    if (!p) return null;
    if (p.kind === 'depot') {
      const dn = depots[p.k], rs = sol ? sol.routes.filter(r => r.d === p.k) : [];
      return { x, y, title: T.depotName(['A', 'B', 'C'][p.k], name(NODES[dn])), rows: [[T.map.routes, f.int(rs.length)], [T.map.pallets, f.int(rs.reduce((a, r) => a + r.load, 0))]], note: mode === 'dispatch' ? T.map.dragDepot : null, color: COL.depot[p.k] };
    }
    if (p.kind === 'node') {
      const n = NODES[p.i], o = nodeOrders && nodeOrders.get(p.i);
      const rows = (o || []).map(s => [T.kind[s.kind] + ' · ' + f.int(s.q) + ' ' + T.units.pal, s.ri == null ? T.map.unserved : sol.routes[s.ri].id + ' · ' + hm(s.start) + (s.late > 0.5 ? ' · +' + f.int(s.late) + ' ' + T.units.min : ''), s.ri == null || s.late > 0.5]);
      return { x, y, title: name(n), sub: T.nodeKind[n.kind] + ' · ' + f.int(n.pop) + ' ' + T.units.people, rows: rows.length ? rows : [[T.map.noOrders, '']], note: mode === 'dispatch' ? T.map.holdHint : null };
    }
    if (p.kind === 'route' && sol) {
      const r = sol.routes[p.ri];
      return { x, y, title: r.id + ' · ' + T.vehicle[TYPES[r.t].id], rows: [[T.map.stops, f.int(r.stops.length)], [T.map.load, f.int(r.load) + ' / ' + f.int(r.cap) + ' ' + T.units.pal], [T.map.time, hm(r.start) + ' → ' + hm(r.end)], [T.map.km, f.km(r.km)], [T.map.cost, f.uah(r.cost)]], color: COL.depot[r.d] };
    }
    if (p.kind === 'closed') {
      const e = EDGES[p.id];
      return { x, y, title: T.edgeName(name(NODES[e.a]), name(NODES[e.b])), rows: [[T.map.closedRoad, '']], note: T.map.healHint, bad: true };
    }
    if (p.kind === 'edge') {
      const e = EDGES[p.id], fl = sol && sol.flows;
      return { x, y, title: T.edgeName(name(NODES[e.a]), name(NODES[e.b])), sub: e.ferry ? T.road.ferry : e.bridge ? T.road.bridge[e.bridge] : T.road.cls[e.cls], rows: [[T.map.length, f.km(e.len)], [T.map.speedRoad, e.ferry ? T.map.ferryTime : f.int(e.kmh) + ' ' + T.units.kmh], ...(e.maxT < 99 ? [[T.map.limit, f.int(e.maxT) + ' ' + T.units.t]] : []), ...(fl ? [[T.map.runs, f.int(fl.runs[e.id])], [T.map.palFlow, f.int(fl.pal[e.id])]] : [])], note: mode === 'dispatch' && tool === 'cut' ? null : T.map.cutHint };
    }
    return null;
  };

  // ——— вказівник ———
  const onDown = e => {
    const s = st.current, [x, y] = local(e);
    wake();
    setTip(null); sc.hoverRoute = null; sc.hoverNode = null;
    if (coach) { setCoach(false); try { localStorage.setItem('bc-route-coach', '1'); } catch { /* немає сховища */ } }
    s.ptrs.set(e.pointerId, { x, y, x0: x, y0: y });
    cvRef.current.setPointerCapture(e.pointerId);
    if (s.ptrs.size === 2) { // два пальці: масштаб і поворот
      clearTimeout(s.pending && s.pending.timer); s.pending = null; s.slash = null;
      const [a, b] = [...s.ptrs.values()];
      s.drag = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), zoom: camRef.current.zoom, yaw: camRef.current.yaw, mid: camRef.current.U((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    const p = pick(x, y);
    if (e.button === 2 || e.shiftKey || e.altKey) { s.drag = { kind: 'orbit', x, y, yaw: camRef.current.yaw, pitch: camRef.current.pitch }; return; }
    if (tool === 'cut' && mode !== 'mini') {
      s.slash = { pts: [[x, y, performance.now()]], hits: [], t0: performance.now(), x, y };
      sc.fx.push({ kind: 'slash', pts: s.slash.pts, t0: performance.now(), dur: 60000 });
      s.slash.fx = sc.fx[sc.fx.length - 1];
      return;
    }
    if (p && p.kind === 'depot') {
      s.drag = { kind: 'depot', k: p.k, node0: depots[p.k], cur: depots[p.k] };
      const n = NODES[depots[p.k]];
      sc.dragDepot = true; sc.depots = depots.map((nd, k) => ({ node: nd, id: ['A', 'B', 'C'][k], drag: k === p.k, x: n.x, y: n.y }));
      setTip(null);
      sfx.pop();
      return;
    }
    if (p && p.kind === 'node' && mode === 'dispatch' && onDemand) {
      s.pending = { i: p.i, x, y, timer: setTimeout(() => openDial(p.i, x, y), 380) };
      return;
    }
    s.drag = { kind: 'pan', x, y, last: camRef.current.U(x, y), t: performance.now(), click: p };
    s.vel = null;
  };
  const openDial = (i, x, y) => {
    const s = st.current;
    s.pending = null;
    const cs = CUSTOMERS.filter(c => c.node === i);
    if (!cs.length) return;
    const o = nodeOrders && nodeOrders.get(i), withOrder = o && o.length ? o.slice().sort((a, b) => b.q - a.q)[0] : null;
    const c = withOrder ? cs.find(cc => cc.id === withOrder.id) : cs[0];
    const v = withOrder ? withOrder.q : 0;
    s.dial = { i, c, v, v0: v, x, y };
    setDial({ ...s.dial });
    setTip(null);
    sfx.pop();
  };
  const onMove = e => {
    const s = st.current, [x, y] = local(e), cam = camRef.current;
    if (coordRef.current) { const [wx, wy] = cam.U(x, y); coordRef.current.textContent = 'X ' + f.dec1(wx) + ' · Y ' + f.dec1(wy) + ' ' + T.units.km; }
    const pt = s.ptrs.get(e.pointerId);
    if (pt) { pt.x = x; pt.y = y; }
    wake();
    if (s.dial) {
      const dx = x - s.dial.x, dy = y - s.dial.y;
      if (Math.hypot(dx, dy) < 14) return;
      const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2), v = Math.round((a / (Math.PI * 2)) * (DIAL_MAX + 1)) % (DIAL_MAX + 1);
      if (v !== s.dial.v) { s.dial.v = v; sfx.tick(); setDial({ ...s.dial }); }
      return;
    }
    if (s.pending) {
      if (Math.hypot(x - s.pending.x, y - s.pending.y) > 8) { clearTimeout(s.pending.timer); const p0 = s.pending; s.pending = null; s.drag = { kind: 'pan', x: p0.x, y: p0.y, last: cam.U(p0.x, p0.y), t: performance.now() }; }
      else return;
    }
    if (s.slash) {
      const now = performance.now(), prev = s.slash.pts[s.slash.pts.length - 1];
      s.slash.pts.push([x, y, now]);
      EDGES.forEach(ed => {
        if (sc.closed.has(ed.id) || s.slash.hits.includes(ed.id)) return;
        const q = slashHit(sc, ed.id, prev, [x, y]);
        if (!q) return;
        s.slash.hits.push(ed.id);
        sc.closedPreview = new Set(s.slash.hits);
        const [wx, wy] = cam.U(q[0], q[1]);
        sc.fx.push({ kind: 'spark', x: wx, y: wy, t0: now, dur: 520, seed: Math.random() * 6 });
        sfx.cut();
      });
      return;
    }
    const d = s.drag;
    if (!d) {
      if (e.pointerType === 'mouse') {
        let p = pick(x, y);
        if (tool === 'cut' && p && p.kind !== 'closed') p = null;
        sc.hoverNode = p && p.kind === 'node' ? p.i : null;
        sc.hoverRoute = p && p.kind === 'route' ? p.ri : null;
        cvRef.current.style.cursor = tool === 'cut' ? 'crosshair' : p && p.kind === 'depot' ? 'grab' : p && (p.kind === 'node' || p.kind === 'route' || p.kind === 'closed') ? 'pointer' : 'default';
        setTip(tipFor(p, x, y));
      }
      return;
    }
    if (d.kind === 'pinch' && s.ptrs.size === 2) {
      const [a, b] = [...s.ptrs.values()], dd = Math.hypot(a.x - b.x, a.y - b.y), an = Math.atan2(b.y - a.y, b.x - a.x);
      cam.zoom = Math.max(1.5, Math.min(40, d.zoom * (dd / (d.d0 || 1))));
      cam.yaw = d.yaw - (an - d.a0);
      const m = cam.U((a.x + b.x) / 2, (a.y + b.y) / 2);
      cam.tx += d.mid[0] - m[0]; cam.ty += d.mid[1] - m[1];
      return;
    }
    if (d.kind === 'orbit') {
      cam.yaw = d.yaw + (x - d.x) * 0.006;
      cam.pitch = Math.max(0, Math.min(MAXP, d.pitch + (y - d.y) * 0.004));
      return;
    }
    if (d.kind === 'pan') {
      const now = performance.now(), w = cam.U(x, y);
      const dx = d.last[0] - w[0], dy = d.last[1] - w[1];
      cam.tx += dx; cam.ty += dy;
      const dt = Math.max(1, now - d.t);
      s.vel = [dx / dt, dy / dt];
      d.t = now; d.last = cam.U(x, y);
      if (Math.hypot(x - d.x, y - d.y) > 4) d.moved = true;
      return;
    }
    if (d.kind === 'depot') {
      const [wx, wy] = cam.U(x, y);
      // магніт: найближчий населений пункт, не зайнятий іншим складом
      let best = -1, bd = Infinity;
      NODES.forEach((n, i) => {
        if (depots.some((dn, k) => k !== d.k && dn === i)) return;
        const q = sc.hit.nodes, dpx = Math.hypot(q[i * 3] - x, q[i * 3 + 1] - y);
        if (dpx < 64 && dpx < bd) { bd = dpx; best = i; }
      });
      const dp = sc.depots[d.k];
      if (best >= 0) {
        const n = NODES[best], pull = Math.max(0, 1 - bd / 64);
        dp.x = wx + (n.x - wx) * (0.35 + pull * 0.65); dp.y = wy + (n.y - wy) * (0.35 + pull * 0.65);
        sc.snap = { from: [wx, wy], to: [n.x, n.y] };
        if (best !== d.cur) { d.cur = best; sfx.snap(); sc.fx.push({ kind: 'ripple', x: n.x, y: n.y, t0: performance.now(), dur: 520, r: 26, color: COL.depot[d.k] }); onDepotPreview && onDepotPreview(d.k, best); }
      } else { dp.x = wx; dp.y = wy; sc.snap = null; }
    }
  };
  const onUp = e => {
    const s = st.current, [x, y] = local(e);
    s.ptrs.delete(e.pointerId);
    wake();
    if (s.dial) {
      const { c, v, v0, i } = s.dial;
      s.dial = null; setDial(null);
      if (v !== v0) { onDemand(c.id, v); sfx.drop(); const n = NODES[i]; sc.fx.push({ kind: 'ripple', x: n.x, y: n.y, t0: performance.now(), dur: 700, r: 46 }); }
      return;
    }
    if (s.pending) {
      clearTimeout(s.pending.timer);
      const i = s.pending.i; s.pending = null;
      setSelNode && setSelNode(selNode === i ? null : i);
      return;
    }
    if (s.slash) {
      const sl = s.slash; s.slash = null;
      sl.fx.dur = performance.now() - sl.fx.t0 + 460;
      sc.closedPreview = null;
      if (sl.hits.length) { onCut && onCut(sl.hits); }
      else {
        const id = closedNear(x, y);
        if (id >= 0) heal(id);
      }
      return;
    }
    const d = s.drag;
    s.drag = null;
    if (!d) return;
    if (d.kind === 'depot') {
      sc.snap = null; sc.dragDepot = false;
      if (d.cur !== d.node0) {
        const n = NODES[d.cur];
        sc.fx.push({ kind: 'ripple', x: n.x, y: n.y, t0: performance.now(), dur: 900, r: 90, color: COL.depot[d.k] }, { kind: 'ripple', x: n.x, y: n.y, t0: performance.now() + 120, dur: 900, r: 60, color: COL.depot[d.k] });
        sfx.drop();
        onDepotCommit && onDepotCommit(d.k, d.cur);
      } else onDepotCancel && onDepotCancel();
      sc.depots = depots.map((nd, k) => ({ node: k === d.k ? d.cur : nd, id: ['A', 'B', 'C'][k] }));
      return;
    }
    if (d.kind === 'pan' && !d.moved) {
      s.vel = null;
      const p = pick(x, y);
      if (p && p.kind === 'route') setSelRoute && setSelRoute(selRoute === p.ri ? null : p.ri);
      else if (p && p.kind === 'closed') heal(p.id);
      else if (p && p.kind === 'node') setSelNode && setSelNode(selNode === p.i ? null : p.i);
      else { setSelRoute && setSelRoute(null); setSelNode && setSelNode(null); }
    }
  };
  const heal = id => {
    if (!onHeal) return;
    sfx.heal();
    const e = EDGES[id], m = e.pts[Math.floor(e.pts.length / 2)];
    sc.fx.push({ kind: 'ripple', x: m[0], y: m[1], t0: performance.now(), dur: 650, r: 36, color: COL.hud });
    onHeal(id);
  };
  const onLeave = () => { sc.hoverNode = null; sc.hoverRoute = null; setTip(null); if (coordRef.current) coordRef.current.textContent = ''; };
  const onWheel = e => {
    if (!(e.ctrlKey || e.metaKey)) { setHint(T.map.wheelHint); clearTimeout(st.current.hintT); st.current.hintT = setTimeout(() => setHint(null), 1600); return; }
    e.preventDefault();
    const cam = camRef.current, [x, y] = local(e), w0 = cam.U(x, y);
    cam.zoom = Math.max(1.5, Math.min(40, cam.zoom * Math.exp(-e.deltaY * 0.0022)));
    const w1 = cam.U(x, y);
    cam.tx += w0[0] - w1[0]; cam.ty += w0[1] - w1[1];
    wake();
  };
  // колесо й дотики: потрібні непасивні слухачі
  useEffect(() => {
    const cv = cvRef.current;
    const wh = e => onWheelRef.current(e);
    const ts = e => {
      const r = cv.getBoundingClientRect(), t0 = e.touches[0];
      if (e.touches.length > 1 || toolRef.current === 'cut') { e.preventDefault(); return; }
      const p = pickRef.current(t0.clientX - r.left, t0.clientY - r.top);
      if (p && (p.kind === 'depot' || p.kind === 'node' || p.kind === 'closed')) e.preventDefault();
    };
    cv.addEventListener('wheel', wh, { passive: false });
    cv.addEventListener('touchstart', ts, { passive: false });
    return () => { cv.removeEventListener('wheel', wh); cv.removeEventListener('touchstart', ts); };
  }, []);
  const onWheelRef = useRef(onWheel), toolRef = useRef(tool), pickRef = useRef(pick);
  onWheelRef.current = onWheel; toolRef.current = tool; pickRef.current = pick;

  // клавіатура на карті
  const onKey = e => {
    const cam = camRef.current, step = 40 / cam.zoom;
    const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
    const move = (u, v) => animTo({ tx: cam.tx + u * c + v * s, ty: cam.ty - u * s + v * c }, 220);
    const k = e.key;
    if (k === 'ArrowLeft') move(-step, 0); else if (k === 'ArrowRight') move(step, 0); else if (k === 'ArrowUp') move(0, step); else if (k === 'ArrowDown') move(0, -step);
    else if (k === '+' || k === '=') zoomBy(1.3); else if (k === '-') zoomBy(1 / 1.3);
    else if (k === '[') rotate(-0.26); else if (k === ']') rotate(0.26);
    else if (k === 'PageUp') animTo({ pitch: Math.min(MAXP, cam.pitch + 0.15) }, 260); else if (k === 'PageDown') animTo({ pitch: Math.max(0, cam.pitch - 0.15) }, 260);
    else if (k === 'c' || k === 'C') setTool(t => (t === 'cut' ? 'pan' : 'cut'));
    else return;
    e.preventDefault();
  };

  // шкала часу
  const scrub = useRef(null);
  const scrubTo = e => {
    const r = scrubRef.current.getBoundingClientRect(), k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = DAY[0] + k * (DAY[1] - DAY[0]), prev = clock.get();
    if (Math.floor(v / 60) !== Math.floor(prev / 60)) sfx.tick();
    clock.set(v);
  };
  const scrubDown = e => { e.preventDefault(); scrubRef.current.setPointerCapture(e.pointerId); scrub.current = true; clock.play(false); scrubTo(e); };
  const scrubKey = e => {
    const m = { ArrowLeft: -10, ArrowRight: 10, PageDown: -60, PageUp: 60 }[e.key];
    if (m) { e.preventDefault(); clock.play(false); clock.set(clock.get() + m); }
    else if (e.key === 'Home') { e.preventDefault(); clock.set(DAY[0]); } else if (e.key === 'End') { e.preventDefault(); clock.set(DAY[1]); }
    else if (e.key === ' ') { e.preventDefault(); clock.play(); }
  };
  const hours = [];
  for (let hh = DAY[0] / 60; hh <= DAY[1] / 60; hh++) hours.push(hh);

  const fullscreen = () => {
    const el = wrapRef.current.parentElement;
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };
  useEffect(() => { const on = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', on); return () => document.removeEventListener('fullscreenchange', on); }, []);

  const dialC = dial && dial.c;
  return (
    <div className={'stage glass' + (full ? ' full' : '') + (tool === 'cut' ? ' cutting' : '')} style={{ '--stage-h': height + 'px' }}>
      <div className="stage-canvas" ref={wrapRef}>
        <canvas ref={cvRef} tabIndex="0" role="application" aria-label={T.map.aria} aria-describedby="rp-map-help"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onLeave} onContextMenu={e => e.preventDefault()} onKeyDown={onKey} />
        <p id="rp-map-help" className="sr-only">{T.map.help}</p>
      </div>

      {/* верхній HUD */}
      <div className="hud hud-tl">
        <div className="tool-switch" role="group" aria-label={T.map.tools}>
          <button type="button" className={tool === 'pan' ? 'on' : ''} aria-pressed={tool === 'pan'} onClick={() => setTool('pan')} title={T.map.toolPan}><Icon name="hand" size={17} /><span>{T.map.toolPan}</span></button>
          <button type="button" className={tool === 'cut' ? 'on cut' : ''} aria-pressed={tool === 'cut'} onClick={() => { setTool(tool === 'cut' ? 'pan' : 'cut'); sfx.pop(); }} title={T.map.toolCut}><Icon name="scissors" size={17} /><span>{T.map.toolCut}</span></button>
        </div>
        {onUndo && <button type="button" className="hud-btn" disabled={!canUndo} onClick={onUndo} title={T.map.undo} aria-label={T.map.undo}><Icon name="undo" size={17} /></button>}
        {extraHud}
      </div>
      <div className="hud hud-tr">
        <button type="button" className={'hud-btn txt' + (threeD ? ' on' : '')} onClick={toggle3D} aria-pressed={threeD} title={T.map.view3d}><Icon name="cube" size={16} /><span>{threeD ? '3D' : '2D'}</span></button>
        <button type="button" className="hud-btn" onClick={() => rotate(-0.35)} title={T.map.rotL} aria-label={T.map.rotL}><Icon name="rotL" size={17} /></button>
        <button type="button" className="hud-btn" onClick={() => rotate(0.35)} title={T.map.rotR} aria-label={T.map.rotR}><Icon name="rotR" size={17} /></button>
        <button type="button" className="hud-btn" onClick={() => zoomBy(1.35)} title={T.map.zoomIn} aria-label={T.map.zoomIn}><Icon name="plus" size={17} /></button>
        <button type="button" className="hud-btn" onClick={() => zoomBy(1 / 1.35)} title={T.map.zoomOut} aria-label={T.map.zoomOut}><Icon name="minus" size={17} /></button>
        <button type="button" className="hud-btn" onClick={home} title={T.map.home} aria-label={T.map.home}><Icon name="target" size={17} /></button>
        <div className="layer-wrap">
          <button type="button" className={'hud-btn' + (layerMenu ? ' on' : '')} onClick={() => setLayerMenu(!layerMenu)} aria-expanded={layerMenu} title={T.map.layers} aria-label={T.map.layers}><Icon name="layers" size={17} /></button>
          {layerMenu && <div className="layer-menu glass" role="group" aria-label={T.map.layers}>
            {['routes', 'bars', 'forest'].map(k => (
              <label key={k}><input type="checkbox" checked={!!layers[k]} onChange={() => { setLayers({ ...layers, [k]: !layers[k] }); sfx.pop(); if (k === 'bars' && !layers.bars && !threeD) toggle3D(); }} /><span>{T.map.layer[k]}</span></label>
            ))}
          </div>}
        </div>
        <button type="button" className={'hud-btn' + (sound ? ' on' : '')} onClick={() => { sfx.set(!sound); setSound(!sound); }} aria-pressed={sound} title={sound ? T.map.soundOff : T.map.soundOn} aria-label={sound ? T.map.soundOff : T.map.soundOn}><Icon name={sound ? 'volume' : 'mute'} size={17} /></button>
        <button type="button" className="hud-btn hide-touch" onClick={fullscreen} title={full ? T.map.fullOff : T.map.fullOn} aria-label={full ? T.map.fullOff : T.map.fullOn}><Icon name={full ? 'compress' : 'expand'} size={17} /></button>
      </div>
      {kpi && <div className="hud hud-kpi">{kpi}</div>}
      <div className={'hud-status' + (solving ? ' busy' : '')} aria-live="polite">
        <span className="pulse-dot" />{solving ? T.map.solving : sol ? T.map.solved(f.int(Math.max(1, sol.ms)), sol.routes.length, sol.pb.stops.length) : ''}
      </div>
      {tool === 'cut' && <div className="hud-cut-hint"><Icon name="scissors" size={14} />{T.map.cutMode}</div>}
      {hint && <div className="hud-hint">{hint}</div>}

      {/* підказка під курсором */}
      {tip && !dial && (
        <div className={'map-tip' + (tip.bad ? ' bad' : '')} ref={tipRef} style={{ left: Math.min(tip.x + 14, (sc.w || 600) - 250), top: Math.max(8, tip.y - 12) }} role="status">
          <strong>{tip.color && <i style={{ background: tip.color }} />}{tip.title}</strong>
          {tip.sub && <span className="tip-sub">{tip.sub}</span>}
          {tip.rows && tip.rows.map((r, k) => <span key={k} className={'tip-row' + (r[2] ? ' bad' : '')}><em>{r[0]}</em><b>{r[1]}</b></span>)}
          {tip.note && <span className="tip-note">{tip.note}</span>}
        </div>
      )}

      {/* кругова ручка замовлення */}
      {dial && (
        <div className="order-dial" style={{ left: dial.x, top: dial.y }} aria-live="polite">
          <svg viewBox="-80 -80 160 160" width="160" height="160" aria-hidden="true">
            <circle r="62" className="od-ring" />
            {Array.from({ length: DIAL_MAX + 1 }, (_, k) => { const a = (k / (DIAL_MAX + 1)) * Math.PI * 2, on = k <= dial.v && dial.v > 0; return <line key={k} x1={Math.sin(a) * 54} y1={-Math.cos(a) * 54} x2={Math.sin(a) * (k % 5 ? 61 : 66)} y2={-Math.cos(a) * (k % 5 ? 61 : 66)} className={on ? 'on' : ''} />; })}
            {dial.v > 0 && <path d={(() => { const a = (dial.v / (DIAL_MAX + 1)) * Math.PI * 2; return `M0,-70A70,70 0 ${a > Math.PI ? 1 : 0} 1 ${(Math.sin(a) * 70).toFixed(2)},${(-Math.cos(a) * 70).toFixed(2)}`; })()} className="od-arc" />}
            <circle r="40" className="od-core" />
          </svg>
          <div className="od-text"><b>{dial.v}</b><span>{T.units.pal}</span></div>
          <div className="od-label">{name(NODES[dial.i])} · {T.kind[dialC.kind]}{dial.v === 0 ? ' · ' + T.map.noOrder : ''}</div>
        </div>
      )}

      {coach && mode === 'dispatch' && sc.hit.depots && sc.hit.depots[0] && (
        <div className="coach" style={{ left: sc.hit.depots[0][0], top: sc.hit.depots[0][1] }} aria-hidden="true">
          <span className="coach-ring" /><span className="coach-text"><Icon name="hand" size={14} />{T.map.coach}</span>
        </div>
      )}

      {/* нижній HUD: шкала дня */}
      <div className="hud hud-bottom">
        <button type="button" className={'play-btn' + (playing ? ' on' : '')} onClick={() => { clock.play(); sfx.pop(); }} aria-label={playing ? T.map.pause : T.map.play}><Icon name={playing ? 'pause' : 'play'} size={18} /></button>
        <div className="scrub" ref={scrubRef} role="slider" tabIndex="0" aria-label={T.map.timeline} aria-valuemin={DAY[0]} aria-valuemax={DAY[1]} aria-valuenow={Math.round(clock.get())} aria-valuetext={hm(clock.get())}
          onPointerDown={scrubDown} onPointerMove={e => scrub.current && scrubTo(e)} onPointerUp={() => { scrub.current = false; }} onPointerCancel={() => { scrub.current = false; }} onKeyDown={scrubKey}>
          <div className="scrub-track">
            {sol && sol.routes.map((r, ri) => <i key={ri} className="scrub-run" style={{ left: ((r.start - DAY[0]) / (DAY[1] - DAY[0])) * 100 + '%', width: ((r.end - r.start) / (DAY[1] - DAY[0])) * 100 + '%', top: 3 + (ri % 6) * 2.4, background: COL.depot[r.d] }} />)}
          </div>
          {hours.map(hh => <span key={hh} className={'scrub-tick' + (hh % 3 ? '' : ' major')} style={{ left: ((hh * 60 - DAY[0]) / (DAY[1] - DAY[0])) * 100 + '%' }}>{hh % 3 ? '' : String(hh).padStart(2, '0')}</span>)}
          <span className="scrub-head" ref={headRef} style={{ left: ((clock.get() - DAY[0]) / (DAY[1] - DAY[0])) * 100 + '%' }}><b ref={clockRef}>{hm(clock.get())}</b></span>
        </div>
        <button type="button" className="speed-btn" onClick={() => { const v = speed === 1 ? 3 : speed === 3 ? 8 : 1; clock.setSpeed(v); setSpeed(v); sfx.tick(); }} aria-label={T.map.speed}>×{speed}</button>
        <span className="done-count" ref={doneRef} />
      </div>
      <div className="hud hud-bl" aria-hidden="true"><span className="scale-bar" ref={scaleRef} /><span className="coord" ref={coordRef} /></div>
    </div>
  );
}

export { rgba };
