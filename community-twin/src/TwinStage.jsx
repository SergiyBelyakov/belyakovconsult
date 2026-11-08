// Інтерактивна 3D-модель двійника: шість шарів у CSS 3D, які обертаються мишею, пальцем і стрілками,
// повільно крутяться самі й складаються в одну карту. Виноски до шарів рахуються тією самою
// проєкцією, що й у CSS (поворот, нахил, перспектива), тож лінії влучають у шари за будь-якого кута.
// Промені стоять над населеними пунктами, де перетин шарів дає 5 і більше сигналів.
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { S, PLACES, BY_ID, OBJECTS, SOURCES, AS_OF } from './world.js';
import { placeSignals } from './model.js';
import { STACK, Plane } from './LayerStack.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button } from '../../dashboard/src/ui.jsx';

const N = STACK.length, ASPECT = S.world.h / S.world.w, RAD = Math.PI / 180;
const HOME = { yaw: -32, pitch: 58 }, BOOT = { yaw: -88, pitch: 16 };
const P_MIN = 34, P_MAX = 76, GAP_K = 0.13, LIFT_K = 0.4, AUTO = 0.0055;
const clampP = p => Math.max(P_MIN, Math.min(P_MAX, p));
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const two = n => String(n).padStart(2, '0');
const BEAM_MIN = 5;
const BEAMS = PLACES.map(p => ({ p, sigs: placeSignals(p.id) })).filter(b => b.sigs.length >= BEAM_MIN).sort((a, b) => b.sigs.length - a.sigs.length);
const ORDER = [...STACK.keys()].reverse();   // у списках шари йдуть згори донизу, як у моделі

// межі проєкції моделі за будь-якого повороту (у частках ширини шару; перспектива пропорційна ширині,
// тож форма проєкції від розміру не залежить): нижній шар, верхній шар із підйомом під наведенням
const PERSP_K = 3.2;
const NORM = (() => {
  const p = HOME.pitch * RAD, sp = Math.sin(p), cp = Math.cos(p), topZ = (N - 1) * GAP_K, oy = (-topZ * sp) / 2;
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, oy };
  for (let a = 0; a < 360; a += 5) {
    const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
    for (const z of [0, topZ + GAP_K * LIFT_K]) {
      for (const [u, v] of [[-0.5, -ASPECT / 2], [0.5, -ASPECT / 2], [0.5, ASPECT / 2], [-0.5, ASPECT / 2]]) {
        const u1 = u * c - v * s, v1 = u * s + v * c, v2 = v1 * cp - z * sp, w2 = v1 * sp + z * cp, m = PERSP_K / (PERSP_K - w2);
        const X = u1 * m, Y = oy + (v2 - oy) * m;
        b.x0 = Math.min(b.x0, X); b.x1 = Math.max(b.x1, X); b.y0 = Math.min(b.y0, Y); b.y1 = Math.max(b.y1, Y);
      }
    }
  }
  return b;
})();

// розміри сцени під контейнер: площина шару, крок між шарами, центр, перспектива, колонка виносок
function fit(w, h) {
  const size = w >= 1000 ? 'wide' : w >= 700 ? 'mid' : 'narrow';
  const labelW = size === 'wide' ? 214 : size === 'mid' ? 204 : 0;
  const pad = size === 'narrow' ? 8 : 20;
  const left = pad + (size === 'wide' ? 200 : 0);
  const right = w - pad - (labelW ? labelW + 34 : 0);
  const top = size === 'narrow' ? 40 : 40, bottom = size === 'narrow' ? 46 : 46, mark = 22;
  const aw = Math.max(140, right - left), ah = Math.max(160, h - top - bottom - mark);
  const pw = Math.max(140, Math.min(aw / (NORM.x1 - NORM.x0), ah / ((NORM.y1 - NORM.y0) * 0.94), 640));
  const cx = left + aw / 2 - ((NORM.x0 + NORM.x1) / 2) * pw;
  const cy = top + mark + ah / 2 - ((NORM.y0 + NORM.y1) / 2) * pw;
  return { w, h, size, labelW, top, bottom, pw, ph: pw * ASPECT, gap: pw * GAP_K, cx, cy, persp: pw * PERSP_K, ox: cx, oy: cy + NORM.oy * pw, lx: w - pad - labelW };
}

// підлога: кругова шкала з градусами й позначкою півночі, сітка й світіння під моделлю
const Floor = memo(function Floor({ north }) {
  const ticks = [], labels = [], grid = [];
  for (let a = 0; a < 360; a += 5) {
    const t = (a - 90) * RAD, r1 = a % 30 ? 91 : 94.5;
    ticks.push(<line key={a} x1={(88 * Math.cos(t)).toFixed(2)} y1={(88 * Math.sin(t)).toFixed(2)} x2={(r1 * Math.cos(t)).toFixed(2)} y2={(r1 * Math.sin(t)).toFixed(2)} className={a % 30 ? undefined : 'mj'} />);
    if (a && !(a % 30)) { const x = (99 * Math.cos(t)).toFixed(2), y = (99 * Math.sin(t)).toFixed(2); labels.push(<text key={a} x={x} y={y} transform={`rotate(${a} ${x} ${y})`}>{a}</text>); }
  }
  for (let v = -80; v <= 80; v += 16) grid.push(<line key={'h' + v} x1="-100" y1={v} x2="100" y2={v} />, <line key={'v' + v} x1={v} y1="-100" x2={v} y2="100" />);
  return (
    <svg viewBox="-106 -106 212 212" aria-hidden="true">
      <defs>
        <radialGradient id="ts-fl-glow"><stop offset="0" stopColor="#3FA9FF" stopOpacity=".24" /><stop offset=".55" stopColor="#3FA9FF" stopOpacity=".07" /><stop offset="1" stopColor="#3FA9FF" stopOpacity="0" /></radialGradient>
        <clipPath id="ts-fl-clip"><circle r="86" /></clipPath>
      </defs>
      <circle r="104" fill="url(#ts-fl-glow)" />
      <g className="fl-grid" clipPath="url(#ts-fl-clip)">{grid}</g>
      <circle r="88" className="fl-ring" />
      <circle r="62" className="fl-ring dash" />
      <circle r="34" className="fl-ring faint" />
      <g className="fl-ticks">{ticks}</g>
      <g className="fl-labels">{labels}</g>
      <path d="M0,-85.5L3.4,-79L-3.4,-79Z" className="fl-north" />
      <text x="0" y="-99" className="fl-n">{north}</text>
    </svg>
  );
});

export default function TwinStage({ ctx, onOpen, onMap }) {
  const { T, f, placeName, go } = ctx;
  const stageRef = useRef(null), worldRef = useRef(null);
  const planeEls = useRef([]), labelEls = useRef([]), leadEls = useRef([]), dotEls = useRef([]), fxRef = useRef(null);
  const azEl = useRef(null), tiltEl = useRef(null), needleEl = useRef(null);
  const engine = useRef(null);
  const [hl, setHl] = useState(null);
  const [hp, setHp] = useState(null);
  const [auto, setAuto] = useState(() => !reduced());
  const [spread, setSpread] = useState(true);
  const [size, setSize] = useState('wide');
  const [short, setShort] = useState(false);
  const [touched, setTouched] = useState(false);
  const st = useRef(null);
  if (!st.current) {
    const rm = reduced();
    st.current = {
      yaw: rm ? HOME.yaw : BOOT.yaw, pitch: rm ? HOME.pitch : BOOT.pitch, k: rm ? 1 : 0, kT: 1,
      lifts: new Array(N).fill(0), liftT: new Array(N).fill(0), vel: 0, auto: !rm, hover: false, visible: true,
      boot: !rm, t0: 0, last: 0, lastInput: -1e9, raf: 0, wake: 0, drag: null, tw: null, L: null, ptype: 'mouse', justDragged: false,
      az: null, tilt: null, flat: null, tight: null, tighter: null,
    };
  }

  // ——— рушій: один цикл requestAnimationFrame, стан у ref, у DOM пишуться лише CSS-змінні й позиції виносок ———
  useLayoutEffect(() => {
    const s = st.current, stage = stageRef.current, world = worldRef.current;
    const apply = () => {
      const L = s.L;
      if (!L) return;
      const gap = L.gap * s.k;
      // перетворення пишуться прямо в шари; CSS-змінні лише в малий контейнер променів,
      // щоб зміна змінних щокадру не перераховувала стилі тисяч елементів SVG усередині шарів
      world.style.transform = `rotateX(${s.pitch.toFixed(2)}deg) rotateZ(${s.yaw.toFixed(2)}deg)`;
      for (let i = 0; i < N; i++) { const el = planeEls.current[i]; if (el) el.style.transform = `translateZ(${(i * gap + s.lifts[i]).toFixed(2)}px)`; }
      const fx = fxRef.current;
      if (fx) {
        fx.style.setProperty('--yaw', s.yaw.toFixed(2) + 'deg');
        fx.style.setProperty('--pitch', s.pitch.toFixed(2) + 'deg');
        fx.style.setProperty('--gap', gap.toFixed(2) + 'px');
        for (let i = 0; i < N; i++) fx.style.setProperty('--lift-' + i, s.lifts[i].toFixed(2) + 'px');
      }
      const az = ((Math.round(s.yaw) % 360) + 360) % 360, tl = Math.round(s.pitch);
      if (az !== s.az && azEl.current) { s.az = az; azEl.current.textContent = String(az).padStart(3, '0') + '°'; }
      if (tl !== s.tilt && tiltEl.current) { s.tilt = tl; tiltEl.current.textContent = tl + '°'; }
      if (needleEl.current) needleEl.current.style.transform = 'rotate(' + s.yaw.toFixed(1) + 'deg)';
      const flat = s.k < 0.45;
      if (flat !== s.flat) { s.flat = flat; stage.classList.toggle('flat', flat); }
      if (!L.labelW) return;
      const yr = s.yaw * RAD, pr = s.pitch * RAD, cyw = Math.cos(yr), syw = Math.sin(yr), cp = Math.cos(pr), sp = Math.sin(pr);
      const proj = (u, v, w) => {
        const u1 = u * cyw - v * syw, v1 = u * syw + v * cyw, v2 = v1 * cp - w * sp, w2 = v1 * sp + w * cp, m = L.persp / (L.persp - w2);
        return [L.ox + (L.cx + u1 - L.ox) * m, L.oy + (L.cy + v2 - L.oy) * m];
      };
      const sep = gap * sp, tight = sep < 42, tighter = sep < 33;
      if (tight !== s.tight) { s.tight = tight; stage.classList.toggle('tight', tight); }
      if (tighter !== s.tighter) { s.tighter = tighter; stage.classList.toggle('tighter', tighter); }
      const hw = L.pw / 2, hh = L.ph / 2;
      for (let i = 0; i < N; i++) {
        const lab = labelEls.current[i], ln = leadEls.current[i], dot = dotEls.current[i];
        if (!lab) continue;
        const z = i * gap, zl = z + s.lifts[i], y = proj(0, 0, z)[1];
        const q = [proj(-hw, -hh, zl), proj(hw, -hh, zl), proj(hw, hh, zl), proj(-hw, hh, zl)];
        let ax = -Infinity;
        for (let e = 0; e < 4; e++) {
          const a = q[e], b = q[(e + 1) % 4];
          if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const x = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]); if (x > ax) ax = x; }
        }
        if (!Number.isFinite(ax)) ax = proj(0, 0, zl)[0];
        const ly = Math.max(L.top + 22, Math.min(L.h - L.bottom - 22, y)), x2 = L.lx - 8;
        lab.style.transform = `translate(${L.lx.toFixed(1)}px, ${ly.toFixed(1)}px) translateY(-50%)`;
        if (ln) { ln.setAttribute('x1', (ax + 5).toFixed(1)); ln.setAttribute('y1', y.toFixed(1)); ln.setAttribute('x2', x2.toFixed(1)); ln.setAttribute('y2', ly.toFixed(1)); ln.style.opacity = x2 - ax > 16 ? '' : '0'; }
        if (dot) { dot.setAttribute('cx', ax.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); }
      }
    };
    const frame = now => {
      s.raf = 0;
      if (!s.L) return;
      const dt = Math.min(50, Math.max(0, now - (s.last || now)));
      s.last = now;
      let busy = false;
      if (s.boot) {
        if (!s.t0) s.t0 = now;
        const t = Math.max(0, Math.min(1, (now - s.t0 - 250) / 2100)), e = 1 - Math.pow(1 - t, 3);
        s.yaw = BOOT.yaw + (HOME.yaw - BOOT.yaw) * e; s.pitch = BOOT.pitch + (HOME.pitch - BOOT.pitch) * e; s.k = e * s.kT;
        if (t >= 1) { s.boot = false; s.lastInput = now - 2400; }
        busy = true;
      } else {
        if (s.tw) {
          const t = Math.min(1, (now - s.tw.t0) / s.tw.dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          s.yaw = s.tw.y0 + (s.tw.y1 - s.tw.y0) * e; s.pitch = s.tw.p0 + (s.tw.p1 - s.tw.p0) * e;
          if (t >= 1) { s.tw = null; s.lastInput = now; }
          busy = true;
        }
        if (!s.drag && Math.abs(s.vel) > 0.003) { s.yaw += s.vel * dt; s.vel *= Math.pow(0.92, dt / 16.7); busy = true; } else if (!s.drag) s.vel = 0;
        const dk = s.kT - s.k;
        if (Math.abs(dk) > 0.002) { s.k += dk * (1 - Math.pow(0.86, dt / 16.7)); busy = true; } else s.k = s.kT;
        if (s.auto && !s.drag && !s.hover && !busy && s.visible && !document.hidden) {
          const idle = now - s.lastInput;
          if (idle > 3500) { s.yaw += AUTO * dt; busy = true; } else { clearTimeout(s.wake); s.wake = setTimeout(kick, 3600 - idle); }
        }
      }
      for (let i = 0; i < N; i++) {
        const d = s.liftT[i] - s.lifts[i];
        if (Math.abs(d) > 0.05) { s.lifts[i] += d * (1 - Math.pow(0.8, dt / 16.7)); busy = true; } else s.lifts[i] = s.liftT[i];
      }
      if (Math.abs(s.yaw) > 7200) s.yaw %= 360;
      apply();
      if (busy && s.visible && !document.hidden) s.raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!s.raf && s.L) { s.last = performance.now(); s.raf = requestAnimationFrame(frame); } };
    const layout = () => {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const L = fit(r.width, r.height);
      s.L = L;
      stage.style.perspective = L.persp.toFixed(0) + 'px';
      stage.style.perspectiveOrigin = `${L.ox.toFixed(1)}px ${L.oy.toFixed(1)}px`;
      stage.style.setProperty('--lw', L.labelW + 'px');
      world.style.width = L.pw.toFixed(1) + 'px'; world.style.height = L.ph.toFixed(1) + 'px';
      world.style.left = (L.cx - L.pw / 2).toFixed(1) + 'px'; world.style.top = (L.cy - L.ph / 2).toFixed(1) + 'px';
      s.liftT = s.liftT.map(v => (v ? L.gap * LIFT_K : 0));
      setSize(L.size);
      setShort(L.h < 520);
      apply();
      kick();
    };
    engine.current = { kick, apply, layout };
    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    const io = new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; if (s.visible) kick(); }, { threshold: 0.02 });
    io.observe(stage);
    const vis = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', vis);
    layout();
    return () => {
      cancelAnimationFrame(s.raf); s.raf = 0; clearTimeout(s.wake);
      ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  // наведення піднімає шар і зупиняє обертання; виноски з'являються після зміни розміру
  useEffect(() => {
    const s = st.current;
    s.hover = !!(hl || hp);
    s.liftT = STACK.map(id => (id === hl && s.L ? s.L.gap * LIFT_K : 0));
    if (engine.current) engine.current.kick();
  }, [hl, hp]);
  useEffect(() => { st.current.auto = auto; if (auto) st.current.lastInput = performance.now() - 3000; if (engine.current) engine.current.kick(); }, [auto]);
  useEffect(() => { st.current.kT = spread ? 1 : 0; if (engine.current) engine.current.kick(); }, [spread]);
  useEffect(() => { if (engine.current) engine.current.apply(); }, [size]);

  const input = () => { const s = st.current; s.lastInput = performance.now(); if (!touched) setTouched(true); engine.current.kick(); };
  const onPointerDown = e => {
    const s = st.current;
    s.ptype = e.pointerType;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, a')) return;
    s.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, on: false, hist: [] };
  };
  const onPointerMove = e => {
    const s = st.current, d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
      d.on = true; d.x = e.clientX; d.y = e.clientY; s.tw = null; s.vel = 0; s.boot = false;
      try { stageRef.current.setPointerCapture(e.pointerId); } catch { /* вказівник уже відпущено */ }
      stageRef.current.classList.add('dragging');
      return;
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y, now = performance.now();
    s.yaw += dx * 0.42;
    if (e.pointerType !== 'touch') s.pitch = clampP(s.pitch - dy * 0.3);
    d.x = e.clientX; d.y = e.clientY;
    d.hist.push([now, dx]);
    while (d.hist.length && now - d.hist[0][0] > 90) d.hist.shift();
    input();
  };
  const endDrag = (e, fling) => {
    const s = st.current, d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    s.drag = null;
    if (d.on) {
      const now = performance.now(), h = d.hist.filter(x => now - x[0] < 90);
      const span = h.length ? Math.max(16, now - h[0][0]) : 16;
      s.vel = fling && h.length ? Math.max(-0.9, Math.min(0.9, (h.reduce((a, x) => a + x[1], 0) * 0.42) / span)) : 0;
      s.justDragged = true; setTimeout(() => { s.justDragged = false; }, 80);
      try { stageRef.current.releasePointerCapture(e.pointerId); } catch { /* немає захоплення */ }
      stageRef.current.classList.remove('dragging');
      input();
    } else if (e.pointerType === 'touch' && !e.target.closest('.ts-plane, button')) setHl(null);
  };
  const onKeyDown = e => {
    const s = st.current;
    const k = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key];
    if (!k || e.target !== stageRef.current) return;
    e.preventDefault();
    s.tw = null; s.vel = 0; s.yaw += k[0]; s.pitch = clampP(s.pitch + k[1]);
    input();
  };
  const reset = () => {
    const s = st.current, now = performance.now();
    s.boot = false; s.vel = 0;
    s.tw = { t0: now, dur: 900, y0: s.yaw, y1: s.yaw + ((((HOME.yaw - s.yaw) % 360) + 540) % 360) - 180, p0: s.pitch, p1: HOME.pitch };
    setSpread(true); setHl(null); setHp(null);
    engine.current.kick();
  };
  // наведення: шар або промінь; зняття з невеликою затримкою, щоб встигнути перейти на картку й натиснути кнопку
  const clearT = useRef(0);
  useEffect(() => () => clearTimeout(clearT.current), []);
  const hoverOn = (kind, id) => e => {
    if (e.pointerType === 'touch' || st.current.drag) return;
    clearTimeout(clearT.current);
    if (kind === 'l') { setHl(id); setHp(null); } else { setHp(id); setHl(null); }
  };
  const hoverOff = e => {
    if (e.pointerType === 'touch') return;
    clearTimeout(clearT.current);
    clearT.current = setTimeout(() => { setHl(null); setHp(null); }, 320);
  };
  const holdInfo = { onPointerEnter: () => clearTimeout(clearT.current), onPointerLeave: hoverOff };
  const planeClick = id => {
    const s = st.current;
    if (s.justDragged) return;
    if (s.ptype === 'touch' && hl !== id) { setHl(id); setHp(null); return; }
    onOpen(id);
  };

  const lay = id => T.map.lay[id];
  const hpPlace = hp ? BY_ID.get(hp) : null, hpSigs = hp ? placeSignals(hp) : [];
  const hlI = hl ? STACK.indexOf(hl) : -1;
  const info = (
    <div className="ts-info" aria-live="polite" {...holdInfo}>
      {hpPlace ? (
        <>
          <span className="ts-k">{T.kindsPlace[hpPlace.kind]} · {T.stage.sigs(hpSigs.length)}</span>
          <strong>{placeName(hpPlace)}</strong>
          <ul>{hpSigs.slice(0, 4).map(id => <li key={id}>{T.sig[id].t}</li>)}</ul>
          <Button icon="home" onClick={() => go('places', { place: hp })}>{T.map.placePass}</Button>
        </>
      ) : hl ? (
        <>
          <span className="ts-k">{T.stage.layerNo(two(hlI + 1))} · {lay(hl)[2]}</span>
          <strong>{lay(hl)[0]}</strong>
          <p>{lay(hl)[1]}</p>
          <Button kind="primary" icon="map" onClick={() => onOpen(hl)}>{T.map.openLayer}</Button>
        </>
      ) : !spread ? (
        <>
          <span className="ts-k">{T.stage.title} · UA-VR-0001</span>
          <strong>{T.stage.collapsed}</strong>
          <p>{T.stage.collapsedText}</p>
          <Button kind="primary" icon="map" onClick={onMap}>{T.stage.openMap}</Button>
        </>
      ) : (
        <>
          <span className="ts-k">{T.stage.title} · UA-VR-0001</span>
          <strong>{T.stage.intro}</strong>
          <p className="ts-intro">{T.stage.introText}</p>
          <div className="ts-stats">{T.stage.stats(N, OBJECTS.length, PLACES.length, SOURCES.length).map(([v, l]) => <span key={l}><b>{v}</b>{l}</span>)}</div>
          <p className="ts-legend"><i />{T.stage.beams(BEAM_MIN)}</p>
          {size === 'narrow' && <p className="ts-legend tap">{T.stage.tapHint}</p>}
          <Button kind="primary" icon="map" onClick={onMap}>{T.stage.openMap}</Button>
        </>
      )}
    </div>
  );

  return (
    <div className={'ts ' + size + (short ? ' short' : '')}>
      <div className="ts-stage" ref={stageRef} tabIndex={0} role="group" aria-label={T.stage.aria}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={e => endDrag(e, true)} onPointerCancel={e => endDrag(e, false)}
        onKeyDown={onKeyDown} onPointerLeave={e => { if (!st.current.drag) hoverOff(e); }}>
        <div className={'ts-world' + (hl ? ' has-hl' : '')} ref={worldRef}>
          <div className="ts-floor"><Floor north={T.stage.north} /></div>
          {STACK.map((id, i) => (
            <div key={id} ref={el => { planeEls.current[i] = el; }} className={'ts-plane p-' + id + (hl === id ? ' hl' : '')}
              onPointerEnter={hoverOn('l', id)} onPointerLeave={hoverOff} onClick={() => planeClick(id)}>
              <Plane id={id} />
              <i className="ts-corners" />
              <span className="ts-tag"><b>{two(i + 1)}</b><em>{lay(id)[0]}</em></span>
            </div>
          ))}
          <div className="ts-fx" ref={fxRef}>
          {BEAMS.map(({ p, sigs }, j) => (
            <div key={p.id} className="ts-site" style={{ left: ((p.x / S.world.w) * 100).toFixed(3) + '%', top: ((p.y / S.world.h) * 100).toFixed(3) + '%', '--d': ((j * 0.43) % 2.6).toFixed(2) + 's' }}>
              <i className="ts-ring" />
              {STACK.map((id, i) => <i key={id} className="ts-node" style={{ '--i': i, '--lift': `var(--lift-${i}, 0px)` }} />)}
              <i className="ts-beam"><b /></i>
              <span className="ts-mark">
                <button type="button" className={hp === p.id ? 'on' : ''} aria-label={placeName(p) + ': ' + T.stage.sigs(sigs.length)}
                  onPointerEnter={hoverOn('p', p.id)} onPointerLeave={hoverOff} onFocus={() => { setHp(p.id); setHl(null); }} onBlur={() => setHp(h => (h === p.id ? null : h))}
                  onClick={() => { if (st.current.ptype === 'touch' && hp !== p.id) { setHp(p.id); setHl(null); } else go('places', { place: p.id }); }}>
                  <b /><em>{sigs.length}</em>
                </button>
              </span>
            </div>
          ))}
          <div className="ts-scan" />
          </div>
        </div>

        {size !== 'narrow' && (
          <>
            <svg className="ts-leads" aria-hidden="true">
              {STACK.map((id, i) => <g key={id} className={hl === id ? 'hl' : undefined}><line ref={el => { leadEls.current[i] = el; }} /><circle r="2.6" ref={el => { dotEls.current[i] = el; }} /></g>)}
            </svg>
            {ORDER.map(i => {
              const id = STACK[i];
              return (
                <button key={id} type="button" ref={el => { labelEls.current[i] = el; }} className={'ts-label' + (hl === id ? ' hl' : '')}
                  onPointerEnter={hoverOn('l', id)} onPointerLeave={hoverOff} onFocus={() => { setHl(id); setHp(null); }} onBlur={() => setHl(h => (h === id ? null : h))} onClick={() => onOpen(id)}>
                  <em>{two(i + 1)}</em><strong>{lay(id)[0]}</strong><small>{lay(id)[2]}</small>
                </button>
              );
            })}
          </>
        )}

        <div className="ts-hud" aria-hidden="true">
          <span className="ts-live"><i />{T.stage.title}<b>UA-VR-0001</b><span>{T.stage.asOf(f.date(AS_OF))}</span></span>
          <span className="ts-read">
            <span className="ts-rd">{T.stage.az} <b ref={azEl}>000°</b></span>
            <span className="ts-rd">{T.stage.tilt} <b ref={tiltEl}>{HOME.pitch}°</b></span>
            <span className="ts-compass"><i ref={needleEl} /></span>
          </span>
        </div>
        <i className="ts-frame" aria-hidden="true" />
        <span className={'ts-hint' + (touched ? ' gone' : '')} aria-hidden="true"><Icon name="orbit" size={14} />{coarse() ? T.stage.hintTouch : T.stage.hint}</span>
        <div className="ts-ctl">
          <button type="button" className={auto ? 'on' : undefined} aria-pressed={auto} aria-label={auto ? T.stage.pauseLong : T.stage.playLong} title={auto ? T.stage.pauseLong : T.stage.playLong} onClick={() => setAuto(a => !a)}>
            <Icon name={auto ? 'pause' : 'play'} size={14} /><span>{auto ? T.stage.pause : T.stage.play}</span>
          </button>
          <button type="button" aria-pressed={!spread} aria-label={spread ? T.stage.collapseLong : T.stage.expandLong} title={spread ? T.stage.collapseLong : T.stage.expandLong} onClick={() => { setSpread(v => !v); setHl(null); }}>
            <Icon name="layers" size={14} /><span>{spread ? T.stage.collapse : T.stage.expand}</span>
          </button>
          <button type="button" aria-label={T.stage.resetLong} title={T.stage.resetLong} onClick={reset}>
            <Icon name="reset" size={14} /><span>{T.stage.reset}</span>
          </button>
        </div>
        {size === 'wide' && info}
      </div>
      {size === 'narrow' && (
        <div className="ts-list" role="group" aria-label={T.map.stack}>
          {ORDER.map(i => { const id = STACK[i]; return <button key={id} type="button" className={hl === id ? 'on' : undefined} aria-pressed={hl === id} onClick={() => { setHp(null); setHl(h => (h === id ? null : id)); }}><em>{two(i + 1)}</em>{lay(id)[0]}</button>; })}
        </div>
      )}
      {size !== 'wide' && info}
    </div>
  );
}
