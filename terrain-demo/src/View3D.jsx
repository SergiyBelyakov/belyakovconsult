// 3D-модель рельєфу на three.js: поверхня з кольорами за поточним шаром, річка, дороги, населені пункти, точки (сирени, вежі, ділянки).
// Рендер лише за потреби (зміна камери або даних), щоб не вантажити процесор.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '../../site/data-journey/assets/vendor/OrbitControls.js';
import { GX, GY, STEP, WORLD, cellAt } from './dem.js';

const SCALE = 1;                      // одиниця сцени = 1 км
const toScene = (x, y) => [x * SCALE - WORLD.w / 2, y * SCALE - WORLD.h / 2];

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; }
}

export default function View3D({ T, colors, exag, places, sites = [], water, onReady, height = 560, resetKey, label }) {
  const mount = useRef(null);
  const labelsRef = useRef(null);
  const S = useRef({});

  // ——— ініціалізація сцени один раз ———
  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070a, 70, 140);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 8; controls.maxDistance = 110;
    scene.add(new THREE.HemisphereLight(0xdbe8ff, 0x10141c, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-30, 40, -20); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xd90429, 0.35); rim.position.set(30, 12, 30); scene.add(rim);

    // поверхня: вершина в центрі кожної клітинки
    const n = GX * GY, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const k = j * GX + i, [x, z] = toScene((i + 0.5) * STEP, (j + 0.5) * STEP);
      pos[k * 3] = x; pos[k * 3 + 2] = z;
    }
    const idx = [];
    for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
      const a = j * GX + i, b = a + 1, c = a + GX, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 }));
    scene.add(mesh);
    // основа-бокс під поверхнею, щоб модель виглядала як макет
    const base = new THREE.Mesh(new THREE.BoxGeometry(WORLD.w, 0.6, WORLD.h), new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 1 }));
    scene.add(base);

    const river = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fb4ff }));
    const roads = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe9edf2, transparent: true, opacity: 0.55 }));
    const waterMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x2f6fd6, transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0.1 }));
    scene.add(river, roads, waterMesh);
    const pins = new THREE.Group(); scene.add(pins);
    const siteGroup = new THREE.Group(); scene.add(siteGroup);

    const st = S.current = { renderer, scene, camera, controls, geo, mesh, base, river, roads, waterMesh, pins, siteGroup, dirty: true, labels: [] };
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
      camera.aspect = w / h; camera.updateProjectionMatrix(); st.dirty = true;
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    controls.addEventListener('change', () => { st.dirty = true; });
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (controls.update() || st.dirty) {
        st.dirty = false;
        renderer.render(scene, camera);
        placeLabels(st, el, labelsRef.current);
      }
    };
    loop();
    onReady && onReady(true);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); geo.dispose(); el.removeChild(renderer.domElement); };
  }, []);

  // ——— висоти (перебільшення) ———
  useEffect(() => {
    const st = S.current; if (!st.geo) return;
    let k0 = Infinity; for (let k = 0; k < T.H.length; k++) if (T.H[k] < k0) k0 = T.H[k];
    const yOf = h => ((h - k0) * exag) / 1000 + 0.3;
    const pos = st.geo.attributes.position.array;
    for (let k = 0; k < GX * GY; k++) pos[k * 3 + 1] = yOf(T.H[k]);
    st.geo.attributes.position.needsUpdate = true;
    st.geo.computeVertexNormals();
    st.base.position.y = 0;
    st.yOf = yOf;
    // річка і дороги поверх рельєфу
    const lift = 0.06;
    const ry = (x, y) => { const c = cellAt(x, y); return c < 0 ? 0.3 : yOf(T.H[c]) + lift; };
    const rv = []; T.base.river.forEach(([x, y]) => { const [sx, sz] = toScene(x, y); rv.push(sx, ry(x, y), sz); });
    st.river.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
    const rd = [];
    T.base.roads.forEach(r => { for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i]; const [ax, az] = toScene(a[0], a[1]), [bx, bz] = toScene(b[0], b[1]); rd.push(ax, ry(a[0], a[1]) + 0.04, az, bx, ry(b[0], b[1]) + 0.04, bz); } });
    st.roads.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rd, 3));
    if (!st.placed) { resetCamera(st); st.placed = true; }
    st.dirty = true;
  }, [exag]);

  // ——— кольори шару ———
  useEffect(() => {
    const st = S.current; if (!st.geo || !colors) return;
    st.geo.attributes.color.array.set(colors);
    st.geo.attributes.color.needsUpdate = true;
    st.dirty = true;
  }, [colors]);

  // ——— вода: напівпрозора поверхня над затопленими клітинками ———
  useEffect(() => {
    const st = S.current; if (!st.waterMesh) return;
    st.waterMesh.visible = !!water;
    if (water) {
      const v = [];
      const level = x => st.yOf(water.level(x)) + 0.02;
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
        const k = j * GX + i; if (!water.W[k]) continue;
        const [x0, z0] = toScene(i * STEP, j * STEP), [x1, z1] = toScene((i + 1) * STEP, (j + 1) * STEP), y = level((i + 0.5) * STEP);
        v.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
      }
      st.waterMesh.geometry.dispose();
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
      st.waterMesh.geometry = g;
    }
    st.dirty = true;
  }, [water, exag]);

  // ——— населені пункти й точки ———
  useEffect(() => {
    const st = S.current; if (!st.pins || !st.yOf) return;
    st.pins.clear(); st.siteGroup.clear();
    const pinMat = { normal: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0x222222 }), hot: new THREE.MeshStandardMaterial({ color: 0xff4d63, emissive: 0x6a0010 }), dim: new THREE.MeshStandardMaterial({ color: 0x8a94a6 }) };
    const labels = [];
    places.forEach(p => {
      const c = cellAt(p.x, p.y), y = st.yOf(T.H[c]), [x, z] = toScene(p.x, p.y);
      const r = p.kind === 'village' ? 0.16 : 0.26;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 12), pinMat[p.state || 'normal']);
      m.position.set(x, y + 0.28, z); st.pins.add(m);
      if (p.label) labels.push({ v: new THREE.Vector3(x, y + 0.8, z), text: p.label, cls: p.state || '' });
    });
    sites.forEach(s => {
      const c = cellAt(s.x, s.y), y = st.yOf(T.H[c]), [x, z] = toScene(s.x, s.y);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, s.h || 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xd90429, emissive: 0x5a0010 }));
      mast.position.set(x, y + (s.h || 1.4) / 2, z); st.siteGroup.add(mast);
      if (s.ring) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(s.ring - 0.06, s.ring, 64), new THREE.MeshBasicMaterial({ color: 0xff4d63, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.5, z); st.siteGroup.add(ring);
      }
      labels.push({ v: new THREE.Vector3(x, y + (s.h || 1.4) + 0.4, z), text: s.label, cls: 'site' });
    });
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
  st.camera.position.set(-4, 30, 38);
  st.controls.target.set(0, 0, 1);
  st.controls.update();
}

// Підписи: проєкція 3D-точок на екран, ховаємо ті, що позаду камери
function placeLabels(st, el, box) {
  if (!box) return;
  const w = el.clientWidth, h = el.clientHeight;
  while (box.children.length < st.labels.length) box.appendChild(document.createElement('span'));
  [...box.children].forEach((node, i) => {
    const L = st.labels[i];
    if (!L) { node.style.display = 'none'; return; }
    const v = L.v.clone().project(st.camera);
    if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { node.style.display = 'none'; return; }
    node.style.display = '';
    node.className = 'v3-label ' + L.cls;
    node.textContent = L.text;
    node.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
  });
}
