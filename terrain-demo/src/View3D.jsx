// 3D-макет рельєфу на three.js у стилі цифрового двійника:
// поверхня з кольорами шару, горизонталі й скануючий промінь (шейдер), стінки-зрізи з багатокутних шарів ґрунту й порід,
// постамент із підсвіченими гранями, сітка підлоги з радаром, річка й притоки з рухомими частинками течії,
// межа громади як світлова огорожа, колони населених пунктів, щогли з хвилями оповіщення, курсор точки.
// На слабких пристроях і за налаштування «зменшити рух» анімації вимикаються, рендер лише за потреби.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '../../site/data-journey/assets/vendor/OrbitControls.js';
import { BOUNDARY } from '../../transport-demo/src/data.js';
import { GX, GY, STEP, WORLD, cellAt } from './dem.js';

const HW = WORLD.w / 2, HD = WORLD.h / 2;
const toScene = (x, y) => [x - HW, y - HD];
const X0 = -HW + STEP / 2, X1 = HW - STEP / 2, Z0 = -HD + STEP / 2, Z1 = HD - STEP / 2;   // межі сітки вершин
const WALL_BOTTOM = -2.2, PLINTH = 0.55, MARGIN = 0.75, FLOOR_Y = WALL_BOTTOM - PLINTH;
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const ease = t => 1 - (1 - t) ** 3;

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; }
}

export default function View3D({ T, colors, exag, places, sites = [], water, height = 580, resetKey, label, spin = true, onHover, axis }) {
  const mount = useRef(null);
  const labelsRef = useRef(null);
  const S = useRef({});
  const hoverCb = useRef(onHover);
  hoverCb.current = onHover;

  // ——— сцена створюється один раз ———
  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    // програмний рендер (без відеокарти) впізнаємо за назвою; Firefox віддає її без розширення
    const glc = renderer.getContext(), dbg = /firefox/i.test(navigator.userAgent) ? null : glc.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(glc.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : glc.RENDERER) || '');
    const lowPower = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = /[?&]motion=1/.test(location.search) || (!lowPower && !reduced);   // ?motion=1: увімкнути анімації примусово (для перевірки)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x06090e, 80, 175);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.46; controls.minDistance = 10; controls.maxDistance = 130;
    controls.autoRotateSpeed = 0.45;

    scene.add(new THREE.HemisphereLight(0xd6e6ff, 0x0c1018, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(-30, 42, -22); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xff1f4b, 0.55); rim.position.set(34, 8, 30); scene.add(rim);
    const fill = new THREE.DirectionalLight(0x3d9bff, 0.45); fill.position.set(-34, 6, 30); scene.add(fill);

    const uni = { uTime: { value: 0 }, uScan: { value: motion ? 1 : 0 }, uHover: { value: new THREE.Vector3(0, 0, 0) } };

    // піднімальна група: все, що стоїть на постаменті, росте знизу вгору під час появи
    const rise = new THREE.Group(); rise.position.y = WALL_BOTTOM; scene.add(rise);
    const inner = new THREE.Group(); inner.position.y = -WALL_BOTTOM; rise.add(inner);

    // ——— поверхня: вершина в центрі кожної клітинки ———
    const n = GX * GY, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), elev = new Float32Array(n);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const k = j * GX + i, [x, z] = toScene((i + 0.5) * STEP, (j + 0.5) * STEP);
      pos[k * 3] = x; pos[k * 3 + 2] = z; elev[k] = T.H[k];
    }
    const idx = new Uint32Array((GX - 1) * (GY - 1) * 6);
    let q = 0;
    for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
      const a = j * GX + i, b = a + 1, c = a + GX, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aElev', new THREE.BufferAttribute(elev, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.04 });
    terrainMat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'attribute float aElev;\nvarying float vElev;\nvarying vec3 vW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvElev = aElev;\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uTime;\nuniform float uScan;\nuniform vec3 uHover;\nvarying float vElev;\nvarying vec3 vW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fe = max(fwidth(vElev), 1e-4);
        float minor = (1.0 - smoothstep(fe * 0.5, fe * 1.6, abs(fract(vElev / 10.0 + 0.5) - 0.5) * 10.0)) * (1.0 - smoothstep(1.2, 2.6, fe));
        float major = 1.0 - smoothstep(fe * 0.6, fe * 1.9, abs(fract(vElev / 50.0 + 0.5) - 0.5) * 50.0);
        vec2 fg = max(fwidth(vW.xz), vec2(1e-4));
        vec2 g5 = abs(fract(vW.xz / 5.0 + 0.5) - 0.5) * 5.0 / fg;
        float grid = 1.0 - min(min(g5.x, g5.y), 1.0);
        float sx = mod(uTime * 6.5, 96.0) - 48.0;
        float band = exp(-pow((vW.x - sx) / 0.4, 2.0)) * uScan;
        float trail = smoothstep(sx - 9.0, sx, vW.x) * step(vW.x, sx) * uScan;
        float hd = length(vW.xz - uHover.xy);
        float ring = uHover.z * (exp(-pow((hd - 0.42) / 0.06, 2.0)) + 0.35 * exp(-pow((hd - 0.9 - 0.25 * sin(uTime * 3.0)) / 0.05, 2.0)));
        totalEmissiveRadiance += vec3(0.78, 0.88, 1.0) * (minor * 0.022 + major * 0.075);
        totalEmissiveRadiance += vec3(0.30, 0.70, 1.0) * grid * 0.06;
        totalEmissiveRadiance += vec3(0.25, 0.80, 1.0) * (band * 0.3 + trail * (minor * 0.5 + grid * 0.5) * 0.45);
        totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * ring * 0.9;`);
    };
    const mesh = new THREE.Mesh(geo, terrainMat);
    inner.add(mesh);

    // ——— стінки-зрізи: багатокутні шари ґрунту й порід + каркас граней ———
    const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
    // стінки світяться власним кольором граней; горизонтальні мітки глибини через 0,5 і промінь, що біжить донизу
    wallMat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uTime: uni.uTime, uScan: uni.uScan });
      sh.vertexShader = 'varying vec3 vWw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uTime;\nuniform float uScan;\nvarying vec3 vWw;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fy = max(fwidth(vWw.y), 1e-4);
        float ly = 1.0 - min(abs(fract(vWw.y + 0.5) - 0.5) / fy, 1.0);
        float sy = 5.5 - mod(uTime * 0.9, 9.0);
        float sweep = exp(-pow((vWw.y - sy) / 0.1, 2.0)) * uScan;
        totalEmissiveRadiance += vColor.rgb * 0.42 + vec3(0.35, 0.8, 1.0) * (ly * 0.05 + sweep * 0.55);`);
    };
    const walls = new THREE.Mesh(new THREE.BufferGeometry(), wallMat);
    const wireMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'varying float vY; void main(){ float a = 0.1 + 0.32 * clamp((vY + 2.2) / 3.5, 0.0, 1.0); gl_FragColor = vec4(0.45, 0.85, 1.0, a); }',
    });
    const wire = new THREE.LineSegments(new THREE.BufferGeometry(), wireMat);
    const rimTop = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.85 }));
    inner.add(walls, wire, rimTop);

    // ——— постамент, кутові скоби, лінійка, підлога ———
    const pw = X1 - X0 + MARGIN * 2, pd = Z1 - Z0 + MARGIN * 2;
    const plinthGeo = new THREE.BoxGeometry(pw, PLINTH, pd);
    const plinth = new THREE.Mesh(plinthGeo, new THREE.MeshStandardMaterial({ color: 0x0a0f17, metalness: 0.75, roughness: 0.3, emissive: 0x020409 }));
    plinth.position.y = WALL_BOTTOM - PLINTH / 2;
    const plinthEdges = new THREE.LineSegments(new THREE.EdgesGeometry(plinthGeo), new THREE.LineBasicMaterial({ color: 0xd90429, transparent: true, opacity: 0.9 }));
    plinthEdges.position.copy(plinth.position);
    scene.add(plinth, plinthEdges);
    const deco = [];
    const px0 = X0 - MARGIN, px1 = X1 + MARGIN, pz0 = Z0 - MARGIN, pz1 = Z1 + MARGIN, yT = WALL_BOTTOM + 0.004, c = 2.2;
    for (const [x, z, sx, sz] of [[px0, pz0, 1, 1], [px1, pz0, -1, 1], [px0, pz1, 1, -1], [px1, pz1, -1, -1]]) deco.push(x, yT, z, x + c * sx, yT, z, x, yT, z, x, yT, z + c * sz);
    for (let km = 0; km <= WORLD.w; km += 1) { const x = X0 + km - STEP / 2, l = km % 10 === 0 ? 0.5 : km % 5 === 0 ? 0.32 : 0.16; if (x < X0 - 0.01 || x > X1 + 0.2) continue; deco.push(x, yT, Z1 + 0.08, x, yT, Z1 + 0.08 + l, x, yT, Z0 - 0.08, x, yT, Z0 - 0.08 - l); }
    for (let km = 0; km <= WORLD.h; km += 1) { const z = Z0 + km - STEP / 2, l = km % 10 === 0 ? 0.5 : km % 5 === 0 ? 0.32 : 0.16; if (z < Z0 - 0.01 || z > Z1 + 0.2) continue; deco.push(X0 - 0.08, yT, z, X0 - 0.08 - l, yT, z, X1 + 0.08, yT, z, X1 + 0.08 + l, yT, z); }
    const decoGeo = new THREE.BufferGeometry(); decoGeo.setAttribute('position', new THREE.Float32BufferAttribute(deco, 3));
    scene.add(new THREE.LineSegments(decoGeo, new THREE.LineBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.55 })));
    const floorMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: uni.uTime, uAnim: { value: motion ? 1 : 0 }, uHalf: { value: new THREE.Vector2(pw / 2, pd / 2) } },
      vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; uniform float uAnim; uniform vec2 uHalf; varying vec2 vP;
        void main(){
          vec2 p = vP; float r = length(p);
          float fade = 1.0 - smoothstep(34.0, 100.0, r);
          vec2 fw = max(fwidth(p), vec2(1e-4));
          vec2 g1 = abs(fract(p + 0.5) - 0.5) / fw; float l1 = 1.0 - min(min(g1.x, g1.y), 1.0);
          vec2 g5 = abs(fract(p / 5.0 + 0.5) - 0.5) * 5.0 / fw; float l5 = 1.0 - min(min(g5.x, g5.y), 1.0);
          vec2 qd = abs(p) - uHalf; float dr = max(length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0), 0.0);
          float glow = exp(-dr / 2.2);
          float ang = atan(p.y, p.x);
          float sw = pow(1.0 - fract(ang / 6.2831853 - uTime * 0.045), 14.0) * uAnim * (1.0 - smoothstep(20.0, 85.0, r));
          float rr = mod(uTime * 5.5, 64.0) + 30.0;
          float ring = exp(-pow((r - rr) / 0.7, 2.0)) * (1.0 - smoothstep(45.0, 94.0, r)) * uAnim;
          vec3 col = vec3(0.25, 0.62, 1.0) * (l1 * 0.12 + l5 * 0.26 + sw * 0.14 + ring * 0.3) + vec3(0.85, 0.02, 0.16) * glow * 0.55;
          float a = clamp((l1 * 0.12 + l5 * 0.26 + sw * 0.12 + ring * 0.24 + glow * 0.32) * fade, 0.0, 1.0);
          gl_FragColor = vec4(col, a);
        }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y - 0.01;
    scene.add(floor);

    // ——— річка, притоки, дороги, межа громади, вода, частинки течії ———
    const riverMat = new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const glowMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x2f8cff) }, uOp: { value: 0.32 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOp; varying vec2 vUv; void main(){ float a = 1.0 - abs(vUv.y * 2.0 - 1.0); gl_FragColor = vec4(uColor * a * a * uOp, 1.0); }',
    });
    const streamMat = new THREE.MeshBasicMaterial({ color: 0x3f93ef, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const river = new THREE.Mesh(new THREE.BufferGeometry(), riverMat);
    const riverGlow = new THREE.Mesh(new THREE.BufferGeometry(), glowMat);
    const streams = new THREE.Mesh(new THREE.BufferGeometry(), streamMat);
    const roads = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe9edf2, transparent: true, opacity: 0.4 }));
    const fenceMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: uni.uTime, uAnim: { value: motion ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uAnim; varying vec2 vUv;
        void main(){
          float v = vUv.y; float base = pow(1.0 - v, 2.2) * 0.55;
          float pulse = exp(-pow((fract(vUv.x / 24.0 - uTime * 0.05) - 0.5) * 18.0, 2.0)) * uAnim;
          float lines = smoothstep(0.86, 1.0, abs(sin(v * 12.0))) * 0.12 * (1.0 - v);
          vec3 c = vec3(1.0, 0.1, 0.28) * (base + lines) + vec3(1.0, 0.55, 0.65) * pulse * (1.0 - v) * 0.9;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const fence = new THREE.Mesh(new THREE.BufferGeometry(), fenceMat);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f6fd6, transparent: true, opacity: 0.62, roughness: 0.18, metalness: 0.35, emissive: 0x0b3a8a, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const waterMesh = new THREE.Mesh(new THREE.BufferGeometry(), waterMat);
    const dot = document.createElement('canvas'); dot.width = dot.height = 64;
    const dg = dot.getContext('2d'), gr = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(190,235,255,.8)'); gr.addColorStop(1, 'rgba(120,200,255,0)');
    dg.fillStyle = gr; dg.fillRect(0, 0, 64, 64);
    const dotTex = new THREE.CanvasTexture(dot);
    const flowMat = new THREE.PointsMaterial({ size: 0.42, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true });
    const flow = new THREE.Points(new THREE.BufferGeometry(), flowMat);
    inner.add(river, riverGlow, streams, roads, fence, waterMesh, flow);
    const pins = new THREE.Group(), siteGroup = new THREE.Group(), cursor = new THREE.Group();
    inner.add(pins, siteGroup, cursor);
    const cursorLine = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    const cursorDot = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cursor.add(cursorLine, cursorDot); cursor.visible = false;

    const st = S.current = {
      renderer, scene, camera, controls, geo, mesh, walls, wire, rimTop, river, riverGlow, streams, roads, fence, waterMesh, waterMat, flow, pins, siteGroup, cursor, cursorLine, cursorDot,
      rise, uni, motion, lowPower, dirty: true, labels: [], pulses: [], waves: [], particles: null, visible: true, riseT: motion ? performance.now() : 0, spinWanted: spin, el,
    };
    controls.autoRotate = motion && spin;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
      camera.aspect = w / h; camera.updateProjectionMatrix(); st.dirty = true;
      if (!st.placed) { resetCamera(st); st.placed = true; }
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let resume = null;
    controls.addEventListener('change', () => { st.dirty = true; });
    controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(resume); });
    controls.addEventListener('end', () => { clearTimeout(resume); resume = setTimeout(() => { controls.autoRotate = st.motion && st.spinWanted; }, 9000); });
    const io = new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; st.dirty = true; }, { threshold: 0.02 });
    io.observe(el);

    // ——— курсор: промінь із камери марширує по висотах, без перебору трикутників ———
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let lastMove = 0, downAt = null;
    const pick = (cx, cy) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const o = ray.ray.origin, d = ray.ray.direction, sy = st.rise.scale.y;
      const surf = (x, z) => { const c = cellAt(x + HW, z + HD); return c < 0 ? null : WALL_BOTTOM + (st.yOf(T.H[c]) - WALL_BOTTOM) * sy; };
      let prev = null;
      for (let t = 1; t < 260; t += 0.12) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, h = surf(x, z);
        if (h != null && y <= h) {
          if (prev) { let a = prev, b = t; for (let it = 0; it < 6; it++) { const m = (a + b) / 2, hm = surf(o.x + d.x * m, o.z + d.z * m); if (hm != null && o.y + d.y * m <= hm) b = m; else a = m; } t = b; }
          const px = o.x + d.x * t, pz = o.z + d.z * t;
          return cellAt(px + HW, pz + HD);
        }
        prev = t;
        if (y < FLOOR_Y - 1) break;
      }
      return -1;
    };
    const setHover = cell => {
      if (cell === st.hoverCell) return;
      st.hoverCell = cell;
      if (cell >= 0) {
        const i = cell % GX, j = (cell / GX) | 0, [x, z] = toScene((i + 0.5) * STEP, (j + 0.5) * STEP), y = st.yOf(T.H[cell]);
        st.uni.uHover.value.set(x, z, 1);
        st.cursor.visible = true; st.cursor.position.set(x, y, z);
        st.cursorLine.scale.y = 1.1; st.cursorLine.position.y = 0.55; st.cursorDot.position.y = 1.2;
      } else { st.uni.uHover.value.z = 0; st.cursor.visible = false; }
      st.dirty = true;
      hoverCb.current && hoverCb.current(cell >= 0 ? cell : null);
    };
    const onMove = e => {
      if (e.pointerType === 'touch') return;
      if (e.buttons) return;
      const now = performance.now(); if (now - lastMove < 40) return; lastMove = now;
      setHover(pick(e.clientX, e.clientY));
    };
    const onDown = e => { downAt = [e.clientX, e.clientY]; };
    const onUp = e => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) setHover(pick(e.clientX, e.clientY)); downAt = null; };
    // поки курсор над моделлю, обертання стоїть, щоб точка під ним не втікала
    const onEnter = e => { if (e.pointerType !== 'touch') { controls.autoRotate = false; clearTimeout(resume); } };
    const onLeave = e => {
      if (e.pointerType === 'touch') return;
      setHover(-1);
      clearTimeout(resume); resume = setTimeout(() => { controls.autoRotate = st.motion && st.spinWanted; }, 2500);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('pointerenter', onEnter);

    let raf;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!st.visible || document.hidden) return;
      const now = performance.now(), t = (now - t0) / 1000;
      let need = st.dirty;
      if (st.motion) {
        uni.uTime.value = t;
        const r = st.riseT ? Math.min(1, (now - st.riseT) / 1500) : 1;
        st.rise.scale.y = 0.03 + 0.97 * ease(r);
        if (labelsRef.current) labelsRef.current.style.opacity = r < 1 ? 0 : 1;
        animateFlow(st, 1 / 60);
        st.pulses.forEach(p => { const f = (t * 0.7 + p.phase) % 1; p.mesh.scale.setScalar(0.4 + f * 2.4); p.mesh.material.opacity = 0.7 * (1 - f); });
        st.waves.forEach(w => { const f = (t * 0.45 + w.phase) % 1; w.mesh.scale.setScalar(Math.max(0.01, f)); w.mesh.material.opacity = 0.55 * (1 - f) ** 1.5; });
        st.waterMat.emissiveIntensity = 0.55 + 0.2 * Math.sin(t * 1.7);
        need = true;
      }
      if (controls.update()) need = true;
      if (need) {
        st.dirty = false;
        renderer.render(scene, camera);
        placeLabels(st, el, labelsRef.current);
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); clearTimeout(resume); controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('pointerenter', onEnter);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
      dotTex.dispose(); renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => { const st = S.current; st.spinWanted = spin; if (st.controls) st.controls.autoRotate = st.motion && spin; }, [spin]);

  // ——— висоти (перебільшення): поверхня, стінки, річки, дороги, межа, частинки ———
  useEffect(() => {
    const st = S.current; if (!st.geo) return;
    let k0 = Infinity; for (let k = 0; k < T.H.length; k++) if (T.H[k] < k0) k0 = T.H[k];
    const yOf = st.yOf = h => ((h - k0) * exag) / 1000 + 0.3;
    const pos = st.geo.attributes.position.array;
    for (let k = 0; k < GX * GY; k++) pos[k * 3 + 1] = yOf(T.H[k]);
    st.geo.attributes.position.needsUpdate = true;
    st.geo.computeVertexNormals();
    st.geo.computeBoundingSphere();
    // висота поверхні в довільній точці (км), білінійно між вершинами
    const hAt = (x, y) => {
      const fx = Math.max(0, Math.min(GX - 1.001, x / STEP - 0.5)), fy = Math.max(0, Math.min(GY - 1.001, y / STEP - 0.5));
      const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * GX + i;
      return yOf((T.H[k] * (1 - u) + T.H[k + 1] * u) * (1 - v) + (T.H[k + GX] * (1 - u) + T.H[k + GX + 1] * u) * v);
    };
    st.hAt = hAt;
    buildWalls(st, T, yOf);
    setGeo(st.river, ribbon(T.base.river, () => 0.26, hAt, 0.035));
    setGeo(st.riverGlow, ribbon(T.base.river, () => 1.3, hAt, 0.06));
    const sg = T.streams.map(s => ribbon(s.pts.map(p => [p[0], p[1]]), i => 0.05 + 0.03 * Math.log10(Math.max(1, s.pts[i][2] / 100)) * 3, hAt, 0.03));
    setGeo(st.streams, mergeGeos(sg));
    const rd = [];
    T.base.roads.forEach(r => { for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
      for (let s = 0; s < m; s++) {
        const p0 = [a[0] + (b[0] - a[0]) * s / m, a[1] + (b[1] - a[1]) * s / m], p1 = [a[0] + (b[0] - a[0]) * (s + 1) / m, a[1] + (b[1] - a[1]) * (s + 1) / m];
        const [x0, z0] = toScene(p0[0], p0[1]), [x1, z1] = toScene(p1[0], p1[1]);
        rd.push(x0, hAt(p0[0], p0[1]) + 0.05, z0, x1, hAt(p1[0], p1[1]) + 0.05, z1);
      }
    } });
    st.roads.geometry.dispose();
    st.roads.geometry = new THREE.BufferGeometry(); st.roads.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rd, 3));
    setGeo(st.fence, fenceGeo(hAt));
    buildFlow(st, T, hAt);
    if (st.cursor.visible && st.hoverCell >= 0) st.cursor.position.y = yOf(T.H[st.hoverCell]);
    st.dirty = true;
  }, [exag]);

  // ——— кольори шару ———
  useEffect(() => {
    const st = S.current; if (!st.geo || !colors) return;
    st.geo.attributes.color.array.set(colors);
    st.geo.attributes.color.needsUpdate = true;
    st.dirty = true;
  }, [colors]);

  // ——— вода паводку: напівпрозора поверхня над затопленими клітинками + завіса на краю макета ———
  useEffect(() => {
    const st = S.current; if (!st.waterMesh) return;
    st.waterMesh.visible = !!water;
    if (water) {
      const v = [];
      const level = x => st.yOf(water.level(x)) + 0.02;
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
        const k = j * GX + i; if (!water.W[k]) continue;
        const ax = Math.max(0, i - 0.5) , bx = Math.min(GX - 1, i + 0.5), az = Math.max(0, j - 0.5), bz = Math.min(GY - 1, j + 0.5);
        const [x0, z0] = toScene((ax + 0.5) * STEP, (az + 0.5) * STEP), [x1, z1] = toScene((bx + 0.5) * STEP, (bz + 0.5) * STEP), y = level((i + 0.5) * STEP);
        v.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
        const g = st.yOf(T.H[k]);
        if (y <= g) continue;
        if (i === 0) v.push(x0, y, z0, x0, g, z0, x0, y, z1, x0, y, z1, x0, g, z0, x0, g, z1);
        if (i === GX - 1) v.push(x1, y, z0, x1, g, z0, x1, y, z1, x1, y, z1, x1, g, z0, x1, g, z1);
        if (j === 0) v.push(x0, y, z0, x0, g, z0, x1, y, z0, x1, y, z0, x0, g, z0, x1, g, z0);
        if (j === GY - 1) v.push(x0, y, z1, x0, g, z1, x1, y, z1, x1, y, z1, x0, g, z1, x1, g, z1);
      }
      st.waterMesh.geometry.dispose();
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
      st.waterMesh.geometry = g;
    }
    st.dirty = true;
  }, [water, exag]);

  // ——— населені пункти (колони світла) і точки (щогли з хвилями) ———
  useEffect(() => {
    const st = S.current; if (!st.pins || !st.yOf) return;
    [st.pins, st.siteGroup].forEach(g => { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); g.clear(); });
    st.pulses = []; st.waves = [];
    const tone = { normal: [0xf4f6f8, 0x9fdcff], hot: [0xff4d63, 0xff2a4f], dim: [0x8a94a6, 0x58606e] };
    const labels = [];
    places.forEach((p, n) => {
      const c = cellAt(p.x, p.y), y = st.yOf(T.H[c]), [x, z] = toScene(p.x, p.y), state = p.state || 'normal';
      const big = p.kind !== 'village', r = big ? 0.24 : 0.15, hb = state === 'hot' ? 2.1 : big ? 1.35 : 0.85;
      const [cTop, cBeam] = tone[state];
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, 0.1, 6), new THREE.MeshStandardMaterial({ color: cTop, emissive: cTop, emissiveIntensity: state === 'dim' ? 0.05 : 0.35, metalness: 0.4, roughness: 0.4 }));
      disc.position.set(x, y + 0.05, z);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, hb, 6, 1, true), new THREE.MeshBasicMaterial({ color: cBeam, transparent: true, opacity: state === 'dim' ? 0.25 : 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.set(x, y + hb / 2, z);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(big ? 0.12 : 0.085), new THREE.MeshBasicMaterial({ color: cTop }));
      tip.position.set(x, y + hb + 0.05, z);
      st.pins.add(disc, beam, tip);
      if (state === 'hot') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 40), new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.08, z); st.pins.add(ring);
        st.pulses.push({ mesh: ring, phase: (n * 0.37) % 1 });
      }
      if (p.label) labels.push({ v: new THREE.Vector3(x, y + hb + 0.32, z), text: p.label, cls: state === 'normal' ? '' : state });
    });
    sites.forEach((s, n) => {
      const c = cellAt(s.x, s.y), y = st.yOf(T.H[c]), [x, z] = toScene(s.x, s.y), h = s.h || 1.4;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, h, 8), new THREE.MeshStandardMaterial({ color: 0xd90429, emissive: 0x7a0018, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.35 }));
      mast.position.set(x, y + h / 2, z);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff5a74 }));
      tip.position.set(x, y + h + 0.06, z);
      st.siteGroup.add(mast, tip);
      if (s.ring) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(s.ring - 0.05, s.ring, 96), new THREE.MeshBasicMaterial({ color: 0xff4d63, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.45, z); st.siteGroup.add(ring);
        const wave = new THREE.Mesh(new THREE.RingGeometry(s.ring * 0.96, s.ring, 96), new THREE.MeshBasicMaterial({ color: 0xff7a8e, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        wave.rotation.x = -Math.PI / 2; wave.position.set(x, y + 0.5, z); st.siteGroup.add(wave);
        st.waves.push({ mesh: wave, phase: (n * 0.29) % 1 });
      }
      labels.push({ v: new THREE.Vector3(x, y + h + 0.5, z), text: s.label, cls: 'site' });
    });
    if (axis) {
      labels.push({ v: new THREE.Vector3(0, 6.5, Z0 - MARGIN), text: axis.north, cls: 'axis north' });
      for (let km = 0; km <= 50; km += 10) labels.push({ v: new THREE.Vector3(X0 + km - STEP / 2, WALL_BOTTOM - 0.05, Z1 + MARGIN + 0.15), text: km === 50 ? `${km} ${axis.km}` : String(km), cls: 'axis tick' });
    }
    st.labels = labels;
    st.dirty = true;
  }, [places, sites, exag]);

  useEffect(() => { const st = S.current; if (st.camera && resetKey) { resetCamera(st); st.dirty = true; } }, [resetKey]);

  return (
    <div className="view3d" style={{ height }} aria-label={label} role="img">
      <div className="view3d-canvas" ref={mount} />
      <div className="view3d-labels" ref={labelsRef} aria-hidden="true" />
    </div>
  );
}

function resetCamera(st) {
  const aspect = st.camera.aspect || 1.6;
  // на вузькому екрані дивимося вздовж довгої сторони макета, щоб він займав усю ширину
  const narrow = aspect < 1.05;
  const dist = narrow ? 70 * (0.95 / aspect) ** 0.9 : 71 * Math.max(1, 1.6 / aspect) ** 0.9;
  const az = narrow ? -1.25 : -0.5, pol = narrow ? 0.95 : 1.0, tz = narrow ? 1 : 0.5, ty = narrow ? -0.8 : -6.5;
  st.camera.position.set(Math.sin(az) * Math.sin(pol) * dist, ty + Math.cos(pol) * dist, tz + Math.cos(az) * Math.sin(pol) * dist);
  st.controls.target.set(0, ty, tz);
  st.controls.update();
}

function setGeo(mesh, g) { mesh.geometry.dispose(); mesh.geometry = g; }

// Стрічка вздовж полілінії (км), «накинута» на рельєф. uv.x: відстань уздовж, uv.y: 0…1 поперек
function ribbon(pts, widthAt, hAt, lift) {
  const n = pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const w = widthAt(i) / 2;
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1, x = p[0] - ty * w * sg, y = p[1] + tx * w * sg, [sx, sz] = toScene(x, y);
      pos.set([sx, Math.max(hAt(x, y), hAt(p[0], p[1])) + lift, sz], (i * 2 + s) * 3);
      uv.set([acc, s], (i * 2 + s) * 2);
    }
    if (i < n - 1) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function mergeGeos(list) {
  let nv = 0, ni = 0;
  list.forEach(g => { nv += g.attributes.position.count; ni += g.index.count; });
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  list.forEach(g => {
    pos.set(g.attributes.position.array, ov * 3); uv.set(g.attributes.uv.array, ov * 2);
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + ov;
    ov += g.attributes.position.count; oi += ix.length; g.dispose();
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// Світлова огорожа по межі громади: вертикальна стрічка висотою 0,5 над рельєфом
function fenceGeo(hAt) {
  const pts = [];
  const ring = [...BOUNDARY, BOUNDARY[0]];
  for (let s = 1; s < ring.length; s++) {
    const [ax, ay] = ring[s - 1], [bx, by] = ring[s], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.25));
    for (let i = 0; i < m; i++) pts.push([ax + (bx - ax) * i / m, ay + (by - ay) * i / m]);
  }
  pts.push(pts[0]);
  const pos = [], uv = [], idx = [];
  let acc = 0;
  pts.forEach((p, i) => {
    if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const [x, z] = toScene(p[0], p[1]), y = hAt(p[0], p[1]) + 0.02;
    pos.push(x, y, z, x, y + 0.55, z); uv.push(acc, 0, acc, 1);
    if (i < pts.length - 1) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

// Стінки макета: верхній ряд точно по краю рельєфу, нижче шари ґрунту, лесу, пісків і кристалічних порід.
// Глибші шари рідші, з випадковим зсувом: виходять великі грані «low-poly».
function buildWalls(st, T, yOf) {
  const sides = [[GX, s => [s, 0]], [GX, s => [s, GY - 1]], [GY, s => [0, s]], [GY, s => [GX - 1, s]]];
  const STRATA = ['#3b2a1e', '#7a5c3a', '#3e4c5e', '#1f2536'].map(h => new THREE.Color(h));
  const pos = [], col = [], wire = [], rim = [], seen = new Set();
  const tri = (a, b, c, color, wired) => {
    const l = 0.72 + 0.6 * hash(a.x + b.x + c.x, a.y + b.y + c.z);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) col.push(color.r * l, color.g * l, color.b * l);
    if (!wired) return;
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const key = [p.x, p.y, p.z, q.x, q.y, q.z].map(v => v.toFixed(3)).join(','), rev = [q.x, q.y, q.z, p.x, p.y, p.z].map(v => v.toFixed(3)).join(',');
      if (seen.has(key) || seen.has(rev)) continue; seen.add(key);
      wire.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  };
  const zipper = (A, B, color, wired) => {
    let i = 0, j = 0;
    while (i < A.length - 1 || j < B.length - 1) {
      if (i < A.length - 1 && (j >= B.length - 1 || A[i + 1].t <= B[j + 1].t)) { tri(A[i], A[i + 1], B[j], color, wired); i++; }
      else { tri(A[i], B[j + 1], B[j], color, wired); j++; }
    }
  };
  for (const [n, at] of sides) {
    const top = [];
    for (let s = 0; s < n; s++) { const [i, j] = at(s), [x, z] = toScene((i + 0.5) * STEP, (j + 0.5) * STEP); top.push({ t: s, x, z, y: yOf(T.H[j * GX + i]) }); }
    const sm = top.map((p, s) => { let a = 0; for (let d = -16; d <= 16; d++) a += top[Math.max(0, Math.min(n - 1, s + d))].y; return a / 33; });
    const minOn = (row, s, r) => { let m = Infinity; for (const p of row) if (Math.abs(p.t - s) <= r) m = Math.min(m, p.y); return m; };
    const row = (step, fy) => { const ss = []; for (let s = 0; s < n; s += step) ss.push(s); if (ss[ss.length - 1] !== n - 1) ss.push(n - 1); return ss.map(s => ({ t: s, x: top[s].x, z: top[s].z, y: fy(s) })); };
    const r1 = row(1, s => top[s].y - 0.13);
    const r2 = row(6, s => Math.min(minOn(r1, s, 6) - 0.12, sm[s] - 0.55 - 0.45 * hash(top[s].x, top[s].z)));
    const r3 = row(12, s => Math.min(minOn(r2, s, 12) - 0.15, -0.55 - 0.6 * hash(top[s].z + 3.1, top[s].x)));
    const r4 = row(12, () => WALL_BOTTOM);
    zipper(top, r1, STRATA[0], false);
    zipper(r1, r2, STRATA[1], true);
    zipper(r2, r3, STRATA[2], true);
    zipper(r3, r4, STRATA[3], true);
    for (let s = 1; s < n; s++) rim.push(top[s - 1].x, top[s - 1].y + 0.004, top[s - 1].z, top[s].x, top[s].y + 0.004, top[s].z);
  }
  setGeo(st.walls, (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; })());
  setGeo(st.wire, (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); return g; })());
  setGeo(st.rimTop, (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3)); return g; })());
}

// Частинки течії: рівномірні вибірки вздовж русел, кожна частинка біжить своєю лінією
function buildFlow(st, T, hAt) {
  const paths = [{ pts: T.base.river, speed: 1.4, bright: 1 }, ...T.streams.map(s => ({ pts: s.pts, speed: 0.75, bright: 0.65 }))];
  const samples = [];
  paths.forEach(p => {
    const out = [];
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i], m = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
      for (let s = 0; s < m; s++) { const x = a[0] + (b[0] - a[0]) * s / m, y = a[1] + (b[1] - a[1]) * s / m, [sx, sz] = toScene(x, y); out.push(sx, hAt(x, y) + 0.09, sz); }
    }
    if (out.length > 6) samples.push({ s: Float32Array.from(out), n: out.length / 3, speed: p.speed, bright: p.bright });
  });
  const parts = [];
  samples.forEach((p, pi) => { const count = Math.max(1, Math.round(p.n * (pi === 0 ? 0.12 : 0.05))); for (let c = 0; c < count; c++) parts.push({ p: pi, u: (c + hash(pi, c)) / count * p.n }); });
  const pos = new Float32Array(parts.length * 3), colr = new Float32Array(parts.length * 3);
  parts.forEach((q, i) => { const b = samples[q.p].bright; colr.set([0.55 * b, 0.85 * b, 1.0 * b], i * 3); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  setGeo(st.flow, g);
  st.particles = { samples, parts };
  animateFlow(st, 0);
}
function animateFlow(st, dt) {
  const P = st.particles; if (!P) return;
  const arr = st.flow.geometry.attributes.position.array;
  P.parts.forEach((q, i) => {
    const sm = P.samples[q.p];
    q.u = (q.u + dt * sm.speed * 10) % (sm.n - 1);
    const a = Math.floor(q.u), f = q.u - a, s = sm.s;
    arr[i * 3] = s[a * 3] + (s[a * 3 + 3] - s[a * 3]) * f;
    arr[i * 3 + 1] = s[a * 3 + 1] + (s[a * 3 + 4] - s[a * 3 + 1]) * f;
    arr[i * 3 + 2] = s[a * 3 + 2] + (s[a * 3 + 5] - s[a * 3 + 2]) * f;
  });
  st.flow.geometry.attributes.position.needsUpdate = true;
}

// Підписи: проєкція 3D-точок на екран; ховаємо ті, що позаду камери. DOM оновлюємо лише за змін
function placeLabels(st, el, box) {
  if (!box) return;
  const w = el.clientWidth, h = el.clientHeight, sy = st.rise.scale.y;
  while (box.children.length < st.labels.length) box.appendChild(document.createElement('span'));
  const v = new THREE.Vector3();
  [...box.children].forEach((node, i) => {
    const L = st.labels[i];
    if (!L) { if (node.style.display !== 'none') node.style.display = 'none'; return; }
    v.copy(L.v); v.y = WALL_BOTTOM + (v.y - WALL_BOTTOM) * sy;
    v.project(st.camera);
    if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { if (node.style.display !== 'none') node.style.display = 'none'; return; }
    if (node.style.display === 'none') node.style.display = '';
    const cls = 'v3-label ' + L.cls;
    if (node.className !== cls) node.className = cls;
    if (node.textContent !== L.text) node.textContent = L.text;
    node.style.transform = `translate(${(((v.x + 1) / 2) * w).toFixed(1)}px, ${(((1 - v.y) / 2) * h).toFixed(1)}px) translate(-50%, -100%)`;
  });
}
