// Хмара записів на three.js. Кожна точка є записом: звичайні світяться нейтрально, сигнали рубіновим і пульсують.
// Навколо кожної групи прозора сфера «межа норми» (радіус = поріг відхилення): усе, що за нею, є сигналом.
// Сцена вміє перетворюватися зі «звичайного дашборда» (12 стовпців-місяців із тих самих точок) на хмару.
// Керування власне: обертання з інерцією, наближення колесом або щипком, яке проводить камеру крізь хмару,
// зсув двома пальцями чи правою кнопкою, клавіатура, автоматичний проліт. Клік по точці відкриває пояснення.
// На слабких пристроях і за налаштування «зменшити рух» мерехтіння, пульсація й автообертання вимкнені.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; }
}

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const MIN_DIST = 2.2, MAX_DIST = 170;

const POINT_VS = `
attribute float aD;
attribute float aSeed;
attribute float aGroup;
uniform float uTh, uTime, uDash, uSize, uPx, uMotion;
uniform float uDim[24];
varying vec3 vCol;
varying float vA;
varying float vNear;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(0.05, -mv.z);
  float live = 1.0 - uDash;
  float hot = step(uTh, aD) * live;
  float warm = smoothstep(uTh - 1.4, uTh, aD) * (1.0 - hot) * live;
  float dim = uDim[int(aGroup + 0.5)];
  float tw = 0.8 + 0.2 * sin(uTime * (0.5 + aSeed * 1.4) + aSeed * 40.0) * uMotion;
  float pulse = 1.0 + 0.3 * sin(uTime * 2.4 + aSeed * 17.0) * uMotion;
  float size = uSize * (0.8 + aSeed * 0.55) * (1.0 + hot * 1.7 * pulse + warm * 0.45) * (1.0 + uDash * 0.9);
  gl_PointSize = clamp(size * uPx / dist, 1.2, 110.0);
  vec3 neutral = mix(vec3(0.50, 0.62, 0.82), vec3(0.86, 0.91, 1.0), aSeed * 0.7);
  vCol = mix(mix(neutral, vec3(1.0, 0.56, 0.64), warm * 0.85), vec3(1.0, 0.10, 0.22), hot);
  float a = mix(0.40 * tw, 1.0, hot);
  a *= dim;
  vNear = smoothstep(8.0, 1.0, dist);
  a *= mix(1.0, 0.3, vNear);
  a *= smoothstep(260.0, 90.0, dist);
  vA = a;
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FS = `
varying vec3 vCol;
varying float vA;
varying float vNear;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  float core = exp(-r * 8.0);
  float halo = exp(-r * 2.4) * 0.32;
  float disc = (1.0 - smoothstep(0.55, 1.0, r)) * 0.45 + exp(-r * 3.0) * 0.25;
  float shape = mix(core + halo, disc, vNear);
  gl_FragColor = vec4(vCol * shape * vA, 1.0);
}`;
const SHELL_VS = `
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position;
  gl_Position = projectionMatrix * mv;
}`;
const SHELL_FS = `
uniform vec3 uColor;
uniform float uOpacity, uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  float f = pow(1.0 - abs(dot(vN, vV)), 2.4);
  float lat = 1.0 - smoothstep(0.0, 0.03, abs(fract(vP.y * 3.0 + uTime * 0.06) - 0.5) * 0.5);
  float sweep = exp(-pow((vP.y - (fract(uTime * 0.08) * 2.4 - 1.2)) / 0.05, 2.0));
  float a = (f * 0.5 + lat * 0.05 + sweep * 0.12 * f) * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const SEL_VS = `
uniform float uPx, uTime, uMotion;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(0.95 * uPx / max(0.05, -mv.z), 14.0, 140.0) * (1.0 + 0.12 * sin(uTime * 4.0) * uMotion);
  gl_Position = projectionMatrix * mv;
}`;
const SEL_FS = `
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  vec3 c = vec3(1.0) * exp(-r * 18.0) + vec3(1.0, 0.15, 0.28) * exp(-r * 3.0) * 0.8;
  gl_FragColor = vec4(c, 1.0);
}`;

export default function Cloud3D(props) {
  const host = useRef(null), labelsRef = useRef(null), tipRef = useRef(null), retRef = useRef(null);
  const S = useRef(null);
  const P = useRef(props);
  P.current = props;
  const { n } = props;

  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const glc = renderer.getContext(), dbg = /firefox/i.test(navigator.userAgent) ? null : glc.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(glc.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : glc.RENDERER) || '');
    const lowPower = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = /[?&]motion=1/.test(location.search) || (!lowPower && !reduced);
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', P.current.label || '');
    el.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 700);

    // ——— точки-записи ———
    const cur = new Float32Array(n * 3), from = new Float32Array(n * 3), to = new Float32Array(n * 3);
    const aD = new Float32Array(n), aSeed = new Float32Array(n), aGroup = new Float32Array(n), delay = new Float32Array(n);
    for (let i = 0; i < n; i++) { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; aSeed[i] = s - Math.floor(s); }
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(cur, 3); posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    const dAttr = new THREE.BufferAttribute(aD, 1), gAttr = new THREE.BufferAttribute(aGroup, 1);
    geo.setAttribute('aD', dAttr); geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1)); geo.setAttribute('aGroup', gAttr);
    const uni = {
      uTh: { value: 3.5 }, uTime: { value: 0 }, uDash: { value: 1 }, uSize: { value: 0.17 }, uPx: { value: 800 }, uMotion: { value: motion ? 1 : 0 },
      uDim: { value: new Array(24).fill(1) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // ——— пил на тлі: глибина під час обертання ———
    {
      const m = 1800, dp = new Float32Array(m * 3), r = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
      for (let k = 0; k < m; k++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, rad = 90 + r() * 160, s = Math.sqrt(1 - u * u); dp[k * 3] = Math.cos(a) * s * rad; dp[k * 3 + 1] = u * rad * 0.6; dp[k * 3 + 2] = Math.sin(a) * s * rad; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      const dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x6f86a8, size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.35, depthWrite: false }));
      dust.frustumCulled = false;
      scene.add(dust);
    }
    // ——— полярна сітка підлоги ———
    const floor = new THREE.Group();
    {
      const pts = [];
      for (let rr = 8; rr <= 64; rr += 8) for (let k = 0; k < 96; k++) { const a0 = (k / 96) * Math.PI * 2, a1 = ((k + 1) / 96) * Math.PI * 2; pts.push(Math.cos(a0) * rr, 0, Math.sin(a0) * rr, Math.cos(a1) * rr, 0, Math.sin(a1) * rr); }
      for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; pts.push(Math.cos(a) * 8, 0, Math.sin(a) * 8, Math.cos(a) * 64, 0, Math.sin(a) * 64); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      floor.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x5f86c4, transparent: true, opacity: 0.07, depthWrite: false })));
      floor.position.y = -15;
      scene.add(floor);
    }

    // ——— сфери «межа норми», підписи груп ———
    const shellGeo = new THREE.SphereGeometry(1, 48, 32);
    const ringGeo = (() => { const pts = []; for (let k = 0; k <= 96; k++) { const a = (k / 96) * Math.PI * 2; pts.push(Math.cos(a), 0, Math.sin(a)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g; })();
    const shellGroup = new THREE.Group();
    scene.add(shellGroup);
    let shells = [];          // { g, mesh, mat, ringMat, r, rTarget, c, label el }
    let ofBase = new Int16Array(n), baseC = [];

    // ——— виділена точка, сусіди ———
    const selGeo = new THREE.BufferGeometry(); selGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const selPts = new THREE.Points(selGeo, new THREE.ShaderMaterial({ uniforms: { uPx: uni.uPx, uTime: uni.uTime, uMotion: uni.uMotion }, vertexShader: SEL_VS, fragmentShader: SEL_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    selPts.frustumCulled = false; selPts.visible = false; selPts.renderOrder = 5;
    scene.add(selPts);
    const nbGeo = new THREE.BufferGeometry(); nbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 6), 3));
    const nbLines = new THREE.LineSegments(nbGeo, new THREE.LineBasicMaterial({ color: 0xff5470, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    nbLines.frustumCulled = false; nbLines.visible = false;
    scene.add(nbLines);
    let sel = null, neigh = [];

    // ——— камера: власне керування ———
    const rig = { target: new THREE.Vector3(), yaw: 0, pitch: 0.12, dist: 40, vy: 0, vp: 0, vd: 0, idle: 0, fly: null };
    const applyCam = () => {
      const cp = Math.cos(rig.pitch);
      camera.position.set(rig.target.x + rig.dist * cp * Math.sin(rig.yaw), rig.target.y + rig.dist * Math.sin(rig.pitch), rig.target.z + rig.dist * cp * Math.cos(rig.yaw));
      camera.lookAt(rig.target);
    };
    const fwd = new THREE.Vector3();
    const dolly = f => {
      const nd = rig.dist * f;
      if (f < 1 && nd < MIN_DIST) {
        // крізь хмару: камера рухається далі вперед, точка обертання йде разом із нею
        camera.getWorldDirection(fwd);
        rig.target.addScaledVector(fwd, MIN_DIST - nd);
        rig.dist = MIN_DIST;
      } else rig.dist = clamp(nd, MIN_DIST, MAX_DIST);
    };
    const panBy = (dx, dy) => {
      const k = rig.dist * 0.0016;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      rig.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    };
    const flyTo = (target, dist, yaw, pitch, dur = 1.4) => {
      rig.fly = { t: 0, dur, t0: rig.target.clone(), t1: new THREE.Vector3(...target), d0: rig.dist, d1: dist, y0: rig.yaw, y1: yaw == null ? rig.yaw : rig.yaw + (((yaw - rig.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI, p0: rig.pitch, p1: pitch == null ? rig.pitch : pitch };
      rig.vy = rig.vp = rig.vd = 0;
    };

    // ——— проліт крізь дані ———
    let tour = null;
    const stopTour = notify => { if (!tour) return; tour = null; camera.getWorldDirection(fwd); rig.dist = 12; rig.target.copy(camera.position).addScaledVector(fwd, 12); rig.pitch = Math.asin(clamp(-fwd.y, -0.99, 0.99)); rig.yaw = Math.atan2(-fwd.x, -fwd.z); if (notify && P.current.onTourEnd) P.current.onTourEnd(); };
    const startTour = () => {
      if (!shells.length) return;
      const pts = [], spreadC = 0.7 + 0.3 * (P.current.spread || 1);
      const cs = shells.map(sh => new THREE.Vector3(...sh.c).multiplyScalar(spreadC));
      const out = cs.length > 1 ? 1.9 : 1.2;
      pts.push(new THREE.Vector3(0, 30, cs.length > 1 ? 70 : 46));
      cs.forEach((c, k) => {
        const r = shells[k].r * (P.current.spread || 1), dir = c.clone().setY(0).normalize();
        if (cs.length === 1) dir.set(0, 0, 1);
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        pts.push(c.clone().addScaledVector(dir, r * out).addScaledVector(side, r * 0.5).setY(c.y + r * 0.35));
        pts.push(c.clone().addScaledVector(side, r * 0.15).setY(c.y + 0.4));
        pts.push(c.clone().addScaledVector(dir, -r * 0.9).addScaledVector(side, -r * 0.6).setY(c.y - r * 0.2));
      });
      pts.push(new THREE.Vector3(0, 26, cs.length > 1 ? 66 : 44));
      tour = { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5), t: 0, dur: 9 + cs.length * 6 };
    };

    // ——— вказівник: обертання, щипок, зсув, клік ———
    const ptrs = new Map();
    let downAt = null, moved = 0, pinch = null;
    const interact = () => { rig.idle = 0; rig.fly = null; if (tour) stopTour(true); };
    const onDown = e => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey });
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
      interact();
    };
    const onMove = e => {
      const p = ptrs.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse') hover(e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size >= 2 && pinch) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (d > 0 && pinch.d > 0) dolly(pinch.d / d);
        panBy(mx - pinch.mx, my - pinch.my);
        pinch = { d, mx, my };
      } else if (p.b === 2 || p.b === 1 || p.shift) panBy(dx, dy);
      else {
        rig.yaw -= dx * 0.0052; rig.pitch = clamp(rig.pitch + dy * 0.0046, -1.4, 1.4);
        rig.vy = -dx * 0.0052 * 60; rig.vp = dy * 0.0046 * 60;
      }
      rig.idle = 0;
      hideTip();
    };
    const onUp = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (downAt && moved < 6 && performance.now() - downAt.t < 600 && ptrs.size === 0) {
        const i = pick(e.clientX, e.clientY, e.pointerType === 'mouse' ? 14 : 24);
        if (i != null && P.current.onPick) P.current.onPick(i);
      }
      downAt = null;
    };
    const onWheel = e => {
      e.preventDefault();
      interact();
      const k = e.ctrlKey ? 0.012 : 0.0016, dm = e.deltaMode === 1 ? 32 : 1;
      rig.vd += clamp(e.deltaY * dm * k, -0.6, 0.6) * 2.6;
    };
    const onKey = e => {
      const k = e.key;
      if (k === 'ArrowLeft') rig.yaw += 0.09; else if (k === 'ArrowRight') rig.yaw -= 0.09;
      else if (k === 'ArrowUp') rig.pitch = clamp(rig.pitch + 0.07, -1.4, 1.4); else if (k === 'ArrowDown') rig.pitch = clamp(rig.pitch - 0.07, -1.4, 1.4);
      else if (k === '+' || k === '=') dolly(0.82); else if (k === '-' || k === '_') dolly(1.22);
      else return;
      e.preventDefault(); interact();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideTip(); });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // ——— вибір точки на екрані ———
    const mvp = new THREE.Matrix4();
    let W = 1, H = 1;
    const project = (x, y, z) => {
      const m = mvp.elements, w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0.05) return null;
      return [((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * W, (1 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5 + 0.5)) * H, w];
    };
    const pick = (cx, cy, rad) => {
      const rc = canvas.getBoundingClientRect(), x0 = cx - rc.left, y0 = cy - rc.top;
      mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const dim = uni.uDim.value, th = uni.uTh.value, dash = uni.uDash.value > 0.5;
      let best = null, bd = Infinity;
      for (let i = 0; i < n; i++) {
        if (dim[aGroup[i]] < 0.5) continue;
        const s = project(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
        if (!s) continue;
        let d2 = (s[0] - x0) ** 2 + (s[1] - y0) ** 2;
        if (!dash && aD[i] >= th) d2 *= 0.45;          // сигнали легше влучити
        d2 += s[2] * 0.02;                                // ближчі мають перевагу
        if (d2 < bd) { bd = d2; best = i; }
      }
      return bd < rad * rad ? best : null;
    };
    let hoverPending = null, hovered = null;
    const hover = e => {
      hoverPending = e;
    };
    const hideTip = () => { hovered = null; if (tipRef.current) tipRef.current.style.opacity = '0'; canvas.style.cursor = ''; };
    const doHover = () => {
      const e = hoverPending; hoverPending = null;
      if (!e || ptrs.size) return;
      const i = pick(e.clientX, e.clientY, 12);
      const tip = tipRef.current;
      if (i == null) { hideTip(); return; }
      canvas.style.cursor = 'pointer';
      if (i !== hovered && tip && P.current.tip) { tip.innerHTML = P.current.tip(i); hovered = i; }
      if (tip) { const rc = canvas.getBoundingClientRect(); tip.style.opacity = '1'; tip.style.transform = `translate(${Math.min(e.clientX - rc.left + 14, rc.width - 230)}px, ${Math.max(6, e.clientY - rc.top - 46)}px)`; }
    };

    // ——— перетворення між розміщеннями ———
    let morph = null, mode = null, spreadNow = 1, dashTarget = 1;
    const fill = (src, spread) => {
      for (let i = 0; i < n; i++) {
        const c = baseC[ofBase[i]] || [0, 0, 0], sc = 0.7 + 0.3 * spread;
        for (let k = 0; k < 3; k++) to[i * 3 + k] = c[k] * sc + (src[i * 3 + k] - c[k]) * spread;
      }
    };
    const setTarget = (p, first) => {
      const { pos, dash, mode: m, spread = 1 } = p;
      const modeChanged = m !== mode;
      if (m === 'dash') to.set(dash); else fill(pos, spread);
      spreadNow = spread;
      if (first || (!motion && lowPower)) { cur.set(to); posAttr.needsUpdate = true; morph = null; uni.uDash.value = m === 'dash' ? 1 : 0; dashTarget = uni.uDash.value; }
      else if (modeChanged || !p.instant) {
        from.set(cur);
        const big = modeChanged;
        for (let i = 0; i < n; i++) delay[i] = aSeed[i] * (big ? 0.9 : 0.35) + (big && m === 'cloud' && aD[i] >= uni.uTh.value ? 0.45 : 0);
        morph = { t: 0, dur: big ? 2.2 : 1.1, lift: big ? 1 : 0.25, toCloud: m === 'cloud' && big };
        if (m === 'dash') dashTarget = 1;
      } else { cur.set(to); posAttr.needsUpdate = true; }
      mode = m;
    };
    const stepMorph = dt => {
      if (!morph) return;
      morph.t += dt;
      const T = morph.t, dur = morph.dur;
      let done = true;
      for (let i = 0; i < n; i++) {
        const k = clamp((T - delay[i]) / dur, 0, 1);
        if (k < 1) done = false;
        const e = ease(k), lift = Math.sin(Math.PI * e) * (1.2 + aSeed[i] * 2.4) * morph.lift;
        cur[i * 3] = from[i * 3] + (to[i * 3] - from[i * 3]) * e;
        cur[i * 3 + 1] = from[i * 3 + 1] + (to[i * 3 + 1] - from[i * 3 + 1]) * e + lift;
        cur[i * 3 + 2] = from[i * 3 + 2] + (to[i * 3 + 2] - from[i * 3 + 2]) * e;
      }
      posAttr.needsUpdate = true;
      if (morph.toCloud && T > dur * 0.55) dashTarget = 0;
      if (done) { if (morph.toCloud) dashTarget = 0; morph = null; }
    };

    // ——— групи, сфери, підписи ———
    const setBases = (bases, of) => {
      ofBase = of; baseC = bases.map(b => b.c);
      shells.forEach(sh => { shellGroup.remove(sh.g); sh.mat.dispose(); sh.ringMat.dispose(); });
      const lab = labelsRef.current;
      lab.querySelectorAll('.cl-label').forEach(x => x.remove());
      shells = bases.map((b, k) => {
        const g = new THREE.Group();
        const sm = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0x86aef0) }, uOpacity: { value: 0 }, uTime: uni.uTime }, vertexShader: SHELL_VS, fragmentShader: SHELL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(shellGeo, sm);
        const rm = new THREE.LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        const r1 = new THREE.Line(ringGeo, rm), r2 = new THREE.Line(ringGeo, rm);
        r2.rotation.set(1.1, 0.4, 0.2);
        g.add(mesh, r1, r2);
        shellGroup.add(g);
        const div = document.createElement('div');
        div.className = 'cl-label';
        div.innerHTML = '<b></b><span></span>';
        lab.appendChild(div);
        return { g, mesh, mat: sm, ringMat: rm, r: b.r || 1, rTarget: b.r || 1, c: b.c, el: div, op: 0, rings: [r1, r2], k };
      });
      updateLabels(bases);
    };
    const updateLabels = bases => {
      bases.forEach((b, k) => {
        const sh = shells[k]; if (!sh) return;
        sh.rTarget = b.r; sh.dim = b.dim;
        sh.el.firstChild.textContent = b.label || '';
        sh.el.lastChild.textContent = b.sub || '';
        sh.el.classList.toggle('dim', !!b.dim);
        sh.el.classList.toggle('hot', !!b.hot);
      });
    };

    // ——— розмір ———
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      W = w; H = h;
      renderer.setSize(w, h, false);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      camera.aspect = w / h; camera.updateProjectionMatrix();
      uni.uPx.value = (h * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ——— кадр ———
    const v3 = new THREE.Vector3();
    let raf = 0, last = performance.now(), t = 0, visible = true;
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; });
    io.observe(el);
    const loop = now => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      t += dt;
      uni.uTime.value = motion ? t : 0;
      stepMorph(dt);
      if (hoverPending) doHover();
      // плавний поріг і сфери
      const pp = P.current;
      uni.uTh.value += (pp.th - uni.uTh.value) * Math.min(1, dt * 7);
      uni.uDash.value += (dashTarget - uni.uDash.value) * Math.min(1, dt * 3.2);
      const spread = spreadNow;
      shells.forEach(sh => {
        sh.r += (sh.rTarget - sh.r) * Math.min(1, dt * 7);
        const op = (1 - uni.uDash.value) * (sh.dim ? 0.18 : 1);
        sh.op += (op - sh.op) * Math.min(1, dt * 5);
        const sc = 0.7 + 0.3 * spread;
        sh.g.position.set(sh.c[0] * sc, sh.c[1] * sc, sh.c[2] * sc);
        sh.g.scale.setScalar(Math.max(0.01, sh.r * spread));
        sh.mat.uniforms.uOpacity.value = sh.op * 0.9;
        sh.ringMat.opacity = sh.op * 0.16;
        sh.g.visible = sh.op > 0.01;
        if (motion) { sh.rings[0].rotation.y += dt * 0.12; sh.rings[1].rotation.z += dt * 0.08; }
      });
      // камера
      if (tour) {
        tour.t += dt / tour.dur;
        if (tour.t >= 1) stopTour(true);
        else {
          const a = ease(Math.min(1, tour.t)), p = tour.curve.getPointAt(a), q = tour.curve.getPointAt(Math.min(1, a + 0.02));
          camera.position.copy(p); camera.lookAt(q);
        }
      }
      if (!tour) {
        if (rig.fly) {
          const f = rig.fly; f.t += dt / f.dur;
          const e = ease(Math.min(1, f.t));
          rig.target.lerpVectors(f.t0, f.t1, e); rig.dist = f.d0 + (f.d1 - f.d0) * e; rig.yaw = f.y0 + (f.y1 - f.y0) * e; rig.pitch = f.p0 + (f.p1 - f.p0) * e;
          if (f.t >= 1) rig.fly = null;
        } else {
          rig.yaw += rig.vy * dt; rig.pitch = clamp(rig.pitch + rig.vp * dt, -1.4, 1.4);
          const damp = Math.exp(-dt * 4.2);
          rig.vy *= damp; rig.vp *= damp;
          if (Math.abs(rig.vd) > 1e-4) { dolly(Math.exp(rig.vd * dt)); rig.vd *= Math.exp(-dt * 6); }
          rig.idle += dt;
          if (pp.spin && motion && rig.idle > 3 && !ptrs.size && mode === 'cloud') rig.yaw += dt * 0.045 * Math.min(1, (rig.idle - 3) / 2);
        }
        applyCam();
      }
      camera.updateMatrixWorld();
      mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      // виділення і сусіди
      if (sel != null) {
        const sp = selGeo.attributes.position;
        sp.array[0] = cur[sel * 3]; sp.array[1] = cur[sel * 3 + 1]; sp.array[2] = cur[sel * 3 + 2]; sp.needsUpdate = true;
        const nb = nbGeo.attributes.position;
        neigh.forEach((o, k) => { nb.array.set([cur[sel * 3], cur[sel * 3 + 1], cur[sel * 3 + 2], cur[o * 3], cur[o * 3 + 1], cur[o * 3 + 2]], k * 6); });
        nbGeo.setDrawRange(0, neigh.length * 2); nb.needsUpdate = true;
        const s = project(cur[sel * 3], cur[sel * 3 + 1], cur[sel * 3 + 2]), ret = retRef.current;
        if (ret) { if (s && s[0] > -40 && s[0] < W + 40 && s[1] > -40 && s[1] < H + 40) { ret.style.opacity = '1'; ret.style.transform = `translate(${s[0]}px, ${s[1]}px)`; } else ret.style.opacity = '0'; }
      }
      // підписи груп і місяців
      const sc = 0.7 + 0.3 * spread;
      shells.forEach(sh => {
        const s = project(sh.c[0] * sc, sh.c[1] * sc + sh.r * spread + 0.6, sh.c[2] * sc);
        if (!s || sh.op < 0.05) { sh.el.style.opacity = '0'; return; }
        sh.el.style.opacity = String(Math.min(1, sh.op) * (sh.dim ? 0.45 : 1));
        sh.el.style.transform = `translate(${s[0]}px, ${s[1]}px)`;
      });
      const months = labelsRef.current.querySelectorAll('.cl-month');
      const mo = uni.uDash.value;
      months.forEach((m, k) => {
        const s = project((k - 5.5) * 3.1, -7.2, 1.6);
        if (!s || mo < 0.05) { m.style.opacity = '0'; return; }
        m.style.opacity = String(mo); m.style.transform = `translate(${s[0]}px, ${s[1]}px)`;
      });
      floor.position.y = -15 + 8.4 * uni.uDash.value;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    S.current = {
      setTarget, setBases, updateLabels,
      setLevels: D => { aD.set(D); dAttr.needsUpdate = true; },
      setGroups: g => { aGroup.set(g); gAttr.needsUpdate = true; },
      setDim: dim => { const a = uni.uDim.value; for (let k = 0; k < 24; k++) a[k] = dim && dim[k] != null ? dim[k] : 1; },
      setSel: (i, nb) => { sel = i; neigh = (nb || []).slice(0, 16); selPts.visible = i != null; nbLines.visible = i != null && neigh.length > 0; if (i == null && retRef.current) retRef.current.style.opacity = '0'; },
      flyTo: f => {
        if (tour) stopTour(false);
        const tg = f.point != null ? [to[f.point * 3], to[f.point * 3 + 1], to[f.point * 3 + 2]] : f.target;   // кінцеве місце точки, навіть якщо хмара ще перебудовується
        let dist = f.dist;
        if (f.fit) {   // відстань, з якої об'єкт заданої ширини й висоти вміщується в кадр за поточних пропорцій
          const vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
          dist = Math.max(f.fit[0] / 2 / Math.tan(hf / 2), f.fit[1] / 2 / Math.tan(vf / 2)) * 1.04 + (f.fit[2] || 0) / 2;
        }
        flyTo(tg, dist, f.yaw, f.pitch, f.dur || 1.5);
      },
      setTour: on => { if (on) startTour(); else if (tour) stopTour(false); },
      zoom: f => { interact(); rig.vd += Math.log(f) * 3.2; },
      home: () => {},
      lowPower, motion,
    };
    // місяці для дашборда
    const lab = labelsRef.current;
    (P.current.months || []).forEach(txt => { const m = document.createElement('div'); m.className = 'cl-month'; m.textContent = txt; lab.appendChild(m); });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      geo.dispose(); mat.dispose(); shellGeo.dispose(); ringGeo.dispose(); selGeo.dispose(); nbGeo.dispose();
      shells.forEach(sh => { sh.mat.dispose(); sh.ringMat.dispose(); });
      renderer.dispose();
      canvas.remove();
      S.current = null;
    };
  }, [n]);

  // ——— оновлення з React ———
  const { pos, dash, mode, spread, D, th, groups, dim, bases, of, sel, neigh, fly, tour, instant } = props;
  const first = useRef(true);
  useEffect(() => { if (S.current && groups) S.current.setGroups(groups); }, [groups]);
  useEffect(() => { if (S.current && bases) S.current.setBases(bases, of); }, [of, bases && bases.length]);
  useEffect(() => { if (S.current && bases) S.current.updateLabels(bases); }, [bases]);
  useEffect(() => { if (S.current && D) S.current.setLevels(D); }, [D]);
  const prev = useRef({});
  useEffect(() => {
    if (!S.current || !pos) return;
    const p0 = prev.current, onlySpread = p0.pos === pos && p0.mode === mode && p0.dash === dash;
    S.current.setTarget({ pos, dash, mode, spread, instant: onlySpread || instant }, first.current);
    first.current = false;
    prev.current = { pos, mode, dash };
  }, [pos, dash, mode, spread]);
  useEffect(() => { if (S.current) S.current.setDim(dim); }, [dim]);
  useEffect(() => { if (S.current) S.current.setSel(sel, neigh); }, [sel, neigh]);
  useEffect(() => { if (S.current && fly) S.current.flyTo(fly); }, [fly && fly.key]);
  useEffect(() => { if (S.current) S.current.setTour(!!tour); }, [tour]);
  useEffect(() => { if (props.api) props.api.current = S.current; });

  return (
    <div className="cloud3d" style={{ height: props.height }}>
      <div className="cloud-canvas" ref={host} />
      <div className="cloud-labels" ref={labelsRef} aria-hidden="true" />
      <div className="cloud-reticle" ref={retRef} aria-hidden="true"><i /><i /></div>
      <div className="cloud-tip" ref={tipRef} aria-hidden="true" />
    </div>
  );
}
