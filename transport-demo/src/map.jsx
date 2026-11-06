// Карта доступності на SVG: ізохрони з поля часу (marching squares), дороги, маршрути, рухомі автобуси,
// хвиля поширення часу від закладів, маршрут до закладу з імпульсом. Масштаб і зсув через d3-zoom.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { contours } from 'd3-contour';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { Icon } from '../../dashboard/src/icons.jsx';
import { WORLD, CELL, BOUNDARY, BRIDGES } from './data.js';
import { BANDS, bandOf, bridgeOpen } from './model.js';

export const ZONE = ['#9CC0F0', '#76A3E6', '#5287D9', '#3A6EC2', '#2A5AA6'];
export const ZONE_OP = [0.5, 0.45, 0.42, 0.4, 0.37];
export const GAIN_T = [5, 10, 20, 30];
export const GAIN = ['#01695F', '#019586', '#3CC4B3', '#7FE0D3'];
export const MODE_COLOR = { car: '#3B82F6', pt: '#019586', walk: '#EC4899' };
export const NO_ZONE = '#4A5260';
const SIM = 3; // модельних хвилин за секунду
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const gen = contours().smooth(true);
// Дрібні острівці (менше кількох клітинок) прибираємо: це шум між дорогами, а не зона
const MIN_CELLS = 7;
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
export function mpPath(mp, minCells = MIN_CELLS) {
  let s = '';
  for (const poly of mp.coordinates) for (const ring of poly) {
    if (minCells && ringArea(ring) < minCells) continue;
    for (let i = 0; i < ring.length; i++) s += (i ? 'L' : 'M') + (ring[i][0] * CELL).toFixed(2) + ',' + (ring[i][1] * CELL).toFixed(2);
    s += 'Z';
  }
  return s;
}
export function negField(field) {
  const v = new Float64Array(field.length);
  for (let i = 0; i < field.length; i++) v[i] = Number.isFinite(field[i]) ? -field[i] : -999;
  return v;
}
export const contourAt = (vals, gx, gy, t) => mpPath(gen.size([gx, gy]).contour(vals, -t));
const line = pts => 'M' + pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L');
const WORLD_RECT = `M-30,-30H${WORLD.w + 30}V${WORLD.h + 30}H-30Z`;

// Позиція на ламаній за пройденою часткою
function along(r, f) {
  const L = r.km * Math.max(0, Math.min(1, f));
  let lo = 0, hi = r.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= L) lo = m; else hi = m; }
  const a = r.pts[lo], b = r.pts[hi], seg = r.cum[hi] - r.cum[lo] || 1, t = (L - r.cum[lo]) / seg;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const FAC_LBL = { h1: [-16, 4, 'end'], a1: [-16, 4, 'end'], c1: [-16, 4, 'end'], a2: [16, 4, 'start'], h2: [-15, 4, 'end'] };

// Розмиття бінарного поля, щоб межі зон обслуговування були плавними
function blur(v, w, h, r, passes = 2) {
  const a = v, b = new Float64Array(v.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (2 * r + 1);
        acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

// ——— статичні шари ———
const Terrain = memo(function Terrain({ base }) {
  const d = useMemo(() => {
    const { w, h, step, vals } = base.terrain;
    const g = contours().size([w, h]).smooth(true);
    return [0.34, 0.42, 0.5, 0.58, 0.66].map(lv => {
      const mp = g.contour(vals, lv);
      let s = '';
      for (const poly of mp.coordinates) for (const ring of poly) { s += 'M' + ring.map(p => (p[0] * step).toFixed(2) + ',' + (p[1] * step).toFixed(2)).join('L') + 'Z'; }
      return s;
    });
  }, [base]);
  return <g className="terrain">{d.map((p, i) => <path key={i} d={p} className={'tl tl-' + i} />)}</g>;
});

const Grid = memo(function Grid() {
  const xs = [], ys = [];
  for (let x = 5; x < WORLD.w; x += 5) xs.push(x);
  for (let y = 5; y < WORLD.h; y += 5) ys.push(y);
  return (
    <g className="km-grid">
      {xs.map(x => <line key={'x' + x} x1={x} x2={x} y1={0} y2={WORLD.h} />)}
      {ys.map(y => <line key={'y' + y} y1={y} y2={y} x1={0} x2={WORLD.w} />)}
    </g>
  );
});

const Roads = memo(function Roads({ base }) {
  const order = { dirt: 0, local: 1, regional: 2, town: 3, national: 4 };
  const roads = [...base.roads].sort((a, b) => order[a.cls] - order[b.cls]);
  return (
    <g className="roads">
      {roads.filter(r => r.cls === 'national').map(r => <path key={'c' + r.id} d={line(r.pts)} className="rd-case" />)}
      {roads.map(r => <path key={r.id} d={line(r.pts)} className={'rd rd-' + r.cls + (r.bridge === 'b3' ? ' rd-ponton' : '')} />)}
    </g>
  );
});

function Pin({ x, y, children, className = '', ...rest }) {
  return (
    <g transform={`translate(${x.toFixed(3)} ${y.toFixed(3)})`} className={className} {...rest}>
      <g className="px">{children}</g>
    </g>
  );
}

export function Glyph({ service, outside, isNew, size = 1 }) {
  const s = size;
  if (service === 'hospital') return (
    <g className={'fg fg-h' + (outside ? ' out' : '')}>
      <rect x={-8.5 * s} y={-8.5 * s} width={17 * s} height={17 * s} rx="3" />
      <path d={`M0 ${-4.6 * s}V${4.6 * s}M${-4.6 * s} 0H${4.6 * s}`} />
    </g>
  );
  if (service === 'primary') return (
    <g className={'fg fg-a' + (isNew ? ' new' : '')}>
      <circle r={8.5 * s} />
      <path d={`M0 ${-4.2 * s}V${4.2 * s}M${-4.2 * s} 0H${4.2 * s}`} />
    </g>
  );
  return (
    <g className="fg fg-c">
      <path d={`M0 ${-9.5 * s}L${9.5 * s} 0L0 ${9.5 * s}L${-9.5 * s} 0Z`} />
      <path d={`M${-3.4 * s} ${-1.4 * s}H${3.4 * s}M${-3.4 * s} ${1.6 * s}H${3.4 * s}`} />
    </g>
  );
}

// ——— головний компонент ———
export function AccessMap({
  base, sol, before, view = 'zones', th, mode, period, routesInfo, selected, onSelect, path, marked, facHl, onFacHl,
  bandHl, labels = 'names', T, f, placeName, facName, label, zoomTarget, animKey, motion, setMotion, scen, chip, clockStart = 0,
  onHover,
}) {
  const wrapRef = useRef(null), svgRef = useRef(null), gRef = useRef(null), zoomRef = useRef(null);
  const bandRefs = useRef([]), frontRef = useRef(null), hatchRef = useRef(null), busRef = useRef(null), clockRef = useRef(null), patRef = useRef(null);
  const tRef = useRef(zoomIdentity);
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [hover, setHover] = useState(null);
  const [zoomK, setZoomK] = useState(1);
  const { gx, gy } = base;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    const upd = () => { const r = el.getBoundingClientRect(); setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) }); };
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s0 = Math.min(size.w / WORLD.w, size.h / WORLD.h);
  const s0Ref = useRef(s0);
  s0Ref.current = s0;
  const setU = k => {
    const svg = svgRef.current; if (!svg) return;
    const u = 1 / (s0Ref.current * k);
    svg.style.setProperty('--u', u.toFixed(5));
    svg.dataset.zoom = k >= 2.3 ? 'near' : k >= 1.45 ? 'mid' : 'far';
    if (patRef.current) { const p = (6 * u).toFixed(4); patRef.current.setAttribute('width', p); patRef.current.setAttribute('height', p); patRef.current.firstChild.setAttribute('d', `M0,0V${p}`); patRef.current.firstChild.setAttribute('stroke-width', (1 * u).toFixed(4)); }
  };
  useEffect(() => { setU(tRef.current.k); }, [s0]);

  // масштаб і зсув
  useEffect(() => {
    const svg = select(svgRef.current);
    const z = d3zoom().scaleExtent([1, 9]).translateExtent([[-6, -6], [WORLD.w + 6, WORLD.h + 6]]).on('zoom', e => {
      if (!gRef.current) return;
      tRef.current = e.transform;
      gRef.current.setAttribute('transform', e.transform.toString());
      setU(e.transform.k);
      setHover(null);
    }).on('end', e => { if (gRef.current) setZoomK(e.transform.k); });
    svg.call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
    return () => { svg.interrupt(); svg.on('.zoom', null); };
  }, []);
  useEffect(() => {
    if (!zoomTarget || !zoomRef.current) return;
    const svg = select(svgRef.current), z = zoomRef.current;
    const run = (fn, ...a) => (reduceMotion() ? svg.call(fn, ...a) : svg.transition().duration(700).call(fn, ...a));
    let t = zoomIdentity;
    const cx = WORLD.w / 2, cy = WORLD.h / 2;
    if (zoomTarget.place) {
      const p = base.byId.get(zoomTarget.place);
      const pts = path && path.geom ? path.geom.flatMap(g => g.pts) : [];
      if (p && pts.length > 1) {
        // показуємо весь шлях до закладу
        let x0 = p.x, x1 = p.x, y0 = p.y, y1 = p.y;
        for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const pad = 2.2, w = Math.max(6, x1 - x0 + pad * 2), h = Math.max(4.5, y1 - y0 + pad * 2);
        const k = Math.max(1, Math.min(3.2, Math.min(WORLD.w / w, WORLD.h / h)));
        t = zoomIdentity.translate(cx - k * (x0 + x1) / 2, cy - k * (y0 + y1) / 2).scale(k);
      } else if (p) { const k = zoomTarget.k || 2.6; t = zoomIdentity.translate(cx - k * p.x, cy - k * p.y).scale(k); }
    } else if (zoomTarget.box) {
      const [x0, y0, x1, y1] = zoomTarget.box;
      const k = Math.min(4, Math.min(WORLD.w / (x1 - x0), WORLD.h / (y1 - y0)) * 0.86);
      t = zoomIdentity.translate(cx - k * (x0 + x1) / 2, cy - k * (y0 + y1) / 2).scale(k);
    }
    run(z.transform, t);
  }, [zoomTarget]);

  // ізохрони: фінальні межі зон і хвиля від закладів
  const vals = useMemo(() => negField(sol.field), [sol]);
  const finals = useMemo(() => BANDS.map(t => contourAt(vals, gx, gy, t)), [vals]);
  const thPath = useMemo(() => contourAt(vals, gx, gy, th), [vals, th]);
  const diff = useMemo(() => {
    if (view !== 'diff' || !before) return null;
    const v = new Float64Array(sol.field.length);
    for (let i = 0; i < v.length; i++) {
      const a = Math.min(before.field[i], 150), b = Math.min(sol.field[i], 150);
      v[i] = a - b;
    }
    const g = contours().size([gx, gy]).smooth(true);
    const ps = GAIN_T.map(t => mpPath(g.contour(v, t)));
    const beforeTh = contourAt(negField(before.field), gx, gy, th);
    return { ps, beforeTh };
  }, [view, before, sol, th]);

  const finalRings = useMemo(() => finals.map((d, i) => d + (i ? finals[i - 1] : '')), [finals]);
  const paint = R => { bandRefs.current.forEach((el, i) => { if (el) el.setAttribute('d', R[i] || ''); }); };
  useEffect(() => {
    if (view === 'diff') return;
    const show = () => {
      paint(finalRings);
      frontRef.current && frontRef.current.setAttribute('d', '');
      hatchRef.current && hatchRef.current.classList.add('on');
    };
    if (!motion || reduceMotion()) { show(); return; }
    hatchRef.current && hatchRef.current.classList.remove('on');
    let raf, start = null;
    const DUR = 1600, TMAX = BANDS[BANDS.length - 1] + 4;
    const frame = now => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / DUR), e = 1 - Math.pow(1 - p, 2.2);
      if (p >= 1) { show(); return; }
      const tau = 0.5 + e * TMAX;
      const front = contourAt(vals, gx, gy, tau);
      paint(BANDS.map((b, i) => {
        const lo = i ? BANDS[i - 1] : 0;
        if (tau <= lo) return '';
        return (b <= tau ? finals[i] : front) + (i ? finals[i - 1] : '');
      }));
      frontRef.current && frontRef.current.setAttribute('d', front);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finalRings, animKey, view, motion]);

  // рухомі автобуси і модельний годинник
  const buses = useMemo(() => {
    if (mode !== 'pt' || !routesInfo) return [];
    const out = [];
    for (const ri of routesInfo) {
      if (!ri.active) continue;
      const r = ri.r, n = Math.ceil(r.oneWay / ri.headway) + 1;
      for (const dir of [0, 1]) for (let k = 0; k < n; k++) out.push({ key: r.id + dir + k, r, dir, k, h: ri.headway, ph: (hash(r.id) % 97) / 97 * ri.headway, drt: r.kind === 'drt' });
    }
    return out;
  }, [mode, routesInfo]);
  useEffect(() => {
    const g = busRef.current;
    if (!g) return;
    const els = [...g.children];
    const win = { am: [7, 120], day: [10, 360], pm: [17, 180] }[period] || [10, 360];
    const place = tau => {
      buses.forEach((b, i) => {
        const el = els[i]; if (!el) return;
        const base0 = tau - b.ph - (b.dir ? b.h / 2 : 0);
        const dep = Math.floor(base0 / b.h) * b.h - b.k * b.h;
        const e = base0 - dep;
        if (e < 0 || e > b.r.oneWay) { el.setAttribute('visibility', 'hidden'); return; }
        const fr = e / b.r.oneWay;
        const [x, y] = along(b.r, b.dir ? 1 - fr : fr);
        el.setAttribute('visibility', 'visible');
        el.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)})`);
      });
      if (clockRef.current) {
        const m = ((tau % win[1]) + win[1]) % win[1];
        const hh = win[0] + Math.floor(m / 60), mm = Math.floor(m % 60);
        clockRef.current.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      }
    };
    if (!motion || reduceMotion()) { place(clockStart + 37); return; }
    let raf;
    const t0 = performance.now();
    const frame = now => { place(clockStart + ((now - t0) / 1000) * SIM); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [buses, motion, period]);

  // підказки
  const cellAt = (cx, cy) => {
    const svg = svgRef.current, pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const u = pt.matrixTransform(svg.getScreenCTM().inverse());
    const t = tRef.current, wx = (u.x - t.x) / t.k, wy = (u.y - t.y) / t.k;
    const i = Math.floor(wx / CELL), j = Math.floor(wy / CELL);
    if (i < 0 || j < 0 || i >= gx || j >= gy) return null;
    return { wx, wy, c: j * gx + i };
  };
  const hoverKey = useRef('');
  const lastFac = useRef(undefined);
  const readRef = useRef(null);
  const onMove = e => {
    const r = wrapRef.current.getBoundingClientRect();
    const id = e.target.dataset && e.target.dataset.id;
    const kind = e.target.dataset && e.target.dataset.kind;
    const hk = id ? kind + ':' + id : '';
    if (hk !== hoverKey.current) {
      hoverKey.current = hk;
      setHover(id ? { id, kind, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width } : null);
    }
    const c = cellAt(e.clientX, e.clientY);
    const el = readRef.current;
    if (c && el) {
      let main, sub;
      if (view === 'diff' && before) {
        const v = Math.max(0, Math.min(before.field[c.c], 150) - Math.min(sol.field[c.c], 150));
        main = v >= 1 ? T.readGain.replace('{t}', f.min(v)) : T.readNoGain;
        sub = f.dec1(c.wx) + ' · ' + f.dec1(c.wy) + ' ' + T.km;
      } else {
        const v = sol.field[c.c];
        main = Number.isFinite(v) && v < 240 ? '≈ ' + f.min(v) : T.noTrip;
        sub = view === 'catchment' && sol.fsrc[c.c] >= 0 ? facName(sol.facs[sol.fsrc[c.c]]) : T.modesLong[mode];
      }
      el.firstChild.textContent = main; el.lastChild.textContent = sub; el.classList.add('on');
      const fac = view === 'catchment' ? sol.fsrc[c.c] : null;
      if (onHover && fac !== lastFac.current) { lastFac.current = fac; onHover(fac); }
    }
  };
  const onLeave = () => {
    hoverKey.current = ''; setHover(null);
    if (readRef.current) { readRef.current.firstChild.textContent = T.readHint; readRef.current.lastChild.textContent = ''; readRef.current.classList.remove('on'); }
    if (onHover && lastFac.current !== null) { lastFac.current = null; onHover(null); }
  };
  const onClick = e => {
    const id = e.target.dataset && e.target.dataset.id, kind = e.target.dataset && e.target.dataset.kind;
    hoverKey.current = ''; setHover(null);
    if (kind === 'fac' && onFacHl) { onFacHl(Number(id)); return; }
    if (kind === 'place') { onSelect && onSelect(id); return; }
    if (view === 'catchment' && onFacHl) { const c = cellAt(e.clientX, e.clientY); onFacHl(c && sol.fsrc[c.c] >= 0 ? sol.fsrc[c.c] : null); return; }
    onSelect && onSelect(null);
  };
  const zoomBy = k => zoomRef.current && select(svgRef.current).transition().duration(260).call(zoomRef.current.scaleBy, k);
  const fit = () => zoomRef.current && select(svgRef.current).transition().duration(480).call(zoomRef.current.transform, zoomIdentity);

  // межі зон обслуговування
  const catchments = useMemo(() => {
    if (view !== 'catchment') return null;
    const g = contours().size([gx, gy]).smooth(true);
    return sol.facs.map((fc, i) => {
      const v = new Float64Array(sol.fsrc.length);
      for (let c = 0; c < v.length; c++) v[c] = sol.fsrc[c] === i ? 1 : 0;
      return mpPath(g.contour(blur(v, gx, gy, 1, 2), 0.5));
    });
  }, [view, sol]);

  const placeT = id => sol.placeT.get(id).t;
  const bridges = base.roads.filter(r => r.bridge && r.cross);
  const scaleKm = (() => {
    const pxPerKm = s0 * zoomK;
    return [1, 2, 5, 10, 20].find(k => k * pxPerKm >= 70) || 20;
  })();
  const townLabel = { x: 22.6, y: 14.3 };

  const tipBody = () => {
    if (!hover) return null;
    if (hover.kind === 'place') {
      const p = base.byId.get(hover.id), t = placeT(hover.id);
      return <>
        <b>{T.kinds[p.kind]}{p.kind !== 'district' ? '' : ''}</b>
        <strong>{placeName(p)}</strong>
        <small>{T.tipPop.replace('{n}', f.int(p.pop)).replace('{o}', f.pct(p.old))}</small>
        <small>{Number.isFinite(t) && t < 240 ? T.tipTime.replace('{t}', f.min(t)).replace('{m}', T.modesLong[mode]) : T.overCap}</small>
      </>;
    }
    if (hover.kind === 'fac') {
      const fc = sol.facs[Number(hover.id)];
      return <><b>{T.services[fc.service]}</b><strong>{facName(fc)}</strong>{fc.outside && <small>{T.outsideNote}</small>}</>;
    }
    if (hover.kind === 'route') return <><b>{T.routeWord}</b><strong>{T.routeName(hover.id)}</strong></>;
    return null;
  };

  const facs = sol.facs;
  const marks = marked || null;

  return (
    <div className="map-wrap" ref={wrapRef}>
      <svg ref={svgRef} className={'amap view-' + view + (mode === 'pt' ? ' is-pt' : '') + (bandHl != null ? ' band-hl' : '')} viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}
        preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} data-zoom="far" data-labels={labels}
        onPointerMove={onMove} onPointerLeave={onLeave} onClick={onClick}>
        <defs>
          <pattern id="tr-hatch" ref={patRef} patternUnits="userSpaceOnUse" width=".3" height=".3" patternTransform="rotate(45)">
            <path d="M0,0V.3" stroke="#FFB020" strokeWidth=".05" />
          </pattern>
          <clipPath id="tr-terr"><path d={'M' + BOUNDARY.map(p => p.join(',')).join('L') + 'Z'} /></clipPath>
          <radialGradient id="tr-glow">
            <stop offset="0" stopColor="#F4F6F8" stopOpacity=".22" />
            <stop offset="1" stopColor="#F4F6F8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g ref={gRef}>
          <rect x="-30" y="-30" width={WORLD.w + 60} height={WORLD.h + 60} className="map-bg" />
          <Grid />
          <Terrain base={base} />
          {view !== 'diff' && (
            <g className={'zones' + (view === 'catchment' ? ' soft' : '')}>
              {BANDS.map((b, i) => (
                <path key={b} ref={el => (bandRefs.current[i] = el)} className={'zone z' + i + (bandHl === i ? ' hl' : '')} fill={ZONE[i]} fillOpacity={ZONE_OP[i]} fillRule="evenodd" />
              ))}
              {BANDS.map((b, i) => <path key={'l' + b} d={finals[i]} className={'iso iso' + i} stroke={ZONE[i]} />)}
              <path ref={frontRef} className="front" />
            </g>
          )}
          {view === 'diff' && diff && (
            <g className="gains">
              {GAIN_T.map((t, i) => <path key={t} d={diff.ps[i] + (i < GAIN_T.length - 1 ? diff.ps[i + 1] : '')} fill={GAIN[i]} fillOpacity=".62" fillRule="evenodd" />)}
              <path d={diff.beforeTh} className="th-before" />
              <path d={thPath} className="th-after" />
            </g>
          )}
          {view === 'zones' && <path ref={hatchRef} className={'hatch' + (bandHl === 'beyond' ? ' hl' : '')} d={WORLD_RECT + thPath} fill="url(#tr-hatch)" fillRule="evenodd" />}
          {view === 'zones' && <path className="th-edge" d={thPath} />}
          {view === 'catchment' && catchments && (
            <g className="catch" clipPath="url(#tr-terr)">
              {catchments.map((d, i) => <path key={i} d={d} className={'cz' + (facHl === i ? ' on' : '') + (facHl != null && facHl !== i ? ' dim' : '')} />)}
            </g>
          )}
          <path className="river" d={line(base.river)} />
          <path className="river-hi" d={line(base.river)} />
          <path className="outside" d={WORLD_RECT + 'M' + BOUNDARY.map(p => p.join(',')).join('L') + 'Z'} fillRule="evenodd" />
          <path className="boundary" d={'M' + BOUNDARY.map(p => p.join(',')).join('L') + 'Z'} />
          <Roads base={base} />
          <g className="routes">
            {(routesInfo || []).filter(x => x.active).map(x => (
              <path key={x.r.id} d={line(x.r.pts)} className={'rt' + (x.r.kind === 'urban' ? ' rt-urban' : x.r.kind === 'drt' ? ' rt-drt' : '')} />
            ))}
            {(routesInfo || []).filter(x => x.active).map(x => (
              <path key={'h' + x.r.id} d={line(x.r.pts)} className="rt-hit" data-id={x.r.id} data-kind="route" />
            ))}
          </g>
          {path && path.geom && (
            <g className="trip">
              {path.geom.map((g, i) => <path key={i} d={line(g.pts)} className={'trip-line ' + g.kind} />)}
              {path.geom.map((g, i) => motion && <path key={'p' + i} d={line(g.pts)} pathLength="100" className="trip-pulse" style={{ animationDelay: (i * -0.6) + 's' }} />)}
            </g>
          )}
          <g className="bridges">
            {bridges.map(r => {
              const open = bridgeOpen(r.bridge, scen || {});
              const deg = (r.cross.a * 180) / Math.PI;
              return (
                <Pin key={r.bridge} x={r.cross.p[0]} y={r.cross.p[1]} className={'br' + (open ? '' : ' closed') + (BRIDGES[r.bridge].kind === 'pontoon' ? ' ponton' : '')}>
                  <g transform={`rotate(${deg.toFixed(1)})`}>
                    {open ? <path d="M-6,-3.2H6M-6,3.2H6" /> : <path d="M-4,-4L4,4M4,-4L-4,4" />}
                  </g>
                  {!open && <text y="-9" textAnchor="middle" className="br-label">{T.pontonClosed}</text>}
                </Pin>
              );
            })}
          </g>
          {mode === 'pt' && (
            <g className="stops">
              {[...new Set((routesInfo || []).filter(x => x.active).flatMap(x => x.r.stops))].map(id => {
                const n = base.idx.get(id);
                return <Pin key={id} x={base.X[n]} y={base.Y[n]}><rect x="-2.6" y="-2.6" width="5.2" height="5.2" className="stop" /></Pin>;
              })}
            </g>
          )}
          <g className="places">
            {base.places.map(p => {
              const t = placeT(p.id), b = bandOf(t);
              const r = 2.6 + Math.sqrt(p.pop) / 22;
              const out = view === 'zones' && t > th;
              const dim = marks && !marks.has(p.id);
              const lbl = labels === 'minutes' ? f.tmin(t) : p.kind === 'district' ? T.district[p.district] : placeName(p);
              return (
                <Pin key={p.id} x={p.x} y={p.y} className={'pl pl-' + p.kind + (dim ? ' dim' : '') + (marks && marks.has(p.id) ? ' marked' : '') + (selected === p.id ? ' sel' : '') + (p.pop >= 500 || p.kind !== 'village' ? ' big' : '')}>
                  {out && <circle r={r + 3} className="pl-out" />}
                  {selected === p.id && <circle r={r + 5.5} className="pl-sel" />}
                  <circle r={r} className="pl-dot" fill={b < BANDS.length ? ZONE[b] : NO_ZONE} />
                  <circle r={r + 7} className="pl-hit" data-id={p.id} data-kind="place" />
                  <text y={-(r + 5)} textAnchor="middle" className="pl-label">{lbl}</text>
                </Pin>
              );
            })}
            <Pin x={townLabel.x} y={townLabel.y} className="town-label"><text textAnchor="middle">{T.townName}</text></Pin>
          </g>
          <g className="facs">
            {facs.map((fc, i) => (
              <Pin key={fc.id} x={base.X[fc.n]} y={base.Y[fc.n]} className={'fac' + (facHl === i ? ' on' : '') + (facHl != null && facHl !== i ? ' dim' : '')}>
                {motion && <circle r="10" className="ping" style={{ animationDelay: (i * -1.3) + 's' }} />}
                <Glyph service={fc.service} outside={fc.outside} isNew={fc.isNew} />
                <circle r="13" className="fac-hit" data-id={i} data-kind="fac" />
                {(view === 'catchment' || fc.outside || fc.isNew) && (() => { const [dx, dy, a] = FAC_LBL[fc.id] || [0, 23, 'middle']; return <text x={dx} y={dy} textAnchor={a} className="fac-label">{facName(fc)}</text>; })()}
              </Pin>
            ))}
          </g>
          <g className="buses" ref={busRef}>
            {buses.map(b => (
              <g key={b.key} visibility="hidden"><g className="px"><circle r="5.5" className="bus-glow" /><circle r="2.7" className={'bus' + (b.drt ? ' drt' : '')} /></g></g>
            ))}
          </g>
        </g>
      </svg>

      <div className="map-chip glass-control">
        <span className="ruby-dot" />{chip}
        {mode === 'pt' && <b ref={clockRef} className="map-clock">10:00</b>}
      </div>
      <div className="map-ctl">
        <button type="button" className="icon-btn" onClick={() => zoomBy(1.6)} aria-label={T.zoomIn} title={T.zoomIn}><Icon name="zoomIn" size={17} /></button>
        <button type="button" className="icon-btn" onClick={() => zoomBy(1 / 1.6)} aria-label={T.zoomOut} title={T.zoomOut}><Icon name="zoomOut" size={17} /></button>
        <button type="button" className="icon-btn" onClick={fit} aria-label={T.zoomFit} title={T.zoomFit}><Icon name="expand" size={17} /></button>
        {setMotion && <button type="button" className="icon-btn" onClick={() => setMotion(!motion)} aria-pressed={!motion} aria-label={motion ? T.motionOff : T.motionOn} title={motion ? T.motionOff : T.motionOn}><Icon name={motion ? 'pause' : 'play'} size={17} /></button>}
      </div>
      <div className="map-readout" aria-hidden="true" ref={readRef}><b>{T.readHint}</b><span /></div>
      <div className="map-scale" aria-hidden="true"><i style={{ width: scaleKm * s0 * zoomK }} /><span>{scaleKm} {T.km}</span></div>
      <div className="map-north" aria-hidden="true"><svg viewBox="0 0 20 28" width="14" height="20"><path d="M10 2 16 20 10 16 4 20Z" /><text x="10" y="27.5" textAnchor="middle">N</text></svg></div>
      {hover && (
        <div className={'chart-tip map-tip' + (hover.x > hover.w * 0.65 ? ' tip-r' : hover.x < hover.w * 0.3 ? ' tip-l' : '')} style={{ left: hover.x, top: hover.y + 18 }} role="status">
          {tipBody()}
        </div>
      )}
    </div>
  );
}

// Легенда карти
export function MapLegend({ T, f, th, view, mode, bandHl, setBandHl, labels, setLabels, counts, Segmented }) {
  return (
    <div className="map-legend">
      {view === 'diff' ? (
        <div className="zone-legend">
          <span className="lg-title">{T.gainLegend}</span>
          {GAIN_T.map((t, i) => <span key={t} className="zl"><i style={{ background: GAIN[i], opacity: .8 }} />{T.gainBands[i]}</span>)}
          <span className="zl"><i className="ln-before" />{T.thBefore.replace('{t}', th)}</span>
          <span className="zl"><i className="ln-after" />{T.thAfter.replace('{t}', th)}</span>
        </div>
      ) : (
        <div className="zone-legend" onMouseLeave={() => setBandHl && setBandHl(null)}>
          <span className="lg-title">{T.zoneLegend}</span>
          {BANDS.map((b, i) => (
            <button type="button" key={b} className={'zl' + (bandHl === i ? ' on' : '')} onMouseEnter={() => setBandHl && setBandHl(i)} onFocus={() => setBandHl && setBandHl(i)} onBlur={() => setBandHl && setBandHl(null)}>
              <i style={{ background: ZONE[i] }} />{T.bands[i]}{counts && <b>{f.int(counts[i])}</b>}
            </button>
          ))}
          {view === 'zones' && <span className="zl"><i className="hatch-sw" />{T.beyondTh.replace('{t}', th)}</span>}
        </div>
      )}
      <div className="sym-legend">
        <span><svg width="14" height="14" viewBox="-7 -7 14 14"><circle r="4.5" fill="#76A3E6" stroke="#05070A" strokeWidth="1.5" /></svg>{T.lgPlace}</span>
        {view === 'zones' && <span><svg width="16" height="16" viewBox="-8 -8 16 16"><circle r="4" fill="#4A5260" /><circle r="6.5" fill="none" stroke="#FFB020" strokeWidth="1.2" strokeDasharray="2 2" /></svg>{T.lgBeyond}</span>}
        <span><svg width="18" height="18" viewBox="-9 -9 18 18" className="lg-glyph"><Glyph service="primary" size={0.85} /></svg>{T.lgFacility}</span>
        {mode === 'pt' && <span><svg width="22" height="10" viewBox="0 0 22 10"><path d="M1 5H21" className="lg-rt" /><rect x="8.5" y="2.5" width="5" height="5" className="lg-stop" /></svg>{T.lgRoute}</span>}
        {mode === 'pt' && <span><svg width="12" height="12" viewBox="-6 -6 12 12"><circle r="5" fill="rgba(244,246,248,.18)" /><circle r="2.6" fill="#F4F6F8" /></svg>{T.lgBus}</span>}
        <span><svg width="22" height="10" viewBox="0 0 22 10"><path d="M1 5H21" stroke="#A8B0BC" strokeOpacity=".5" strokeDasharray="3 3" /></svg>{T.lgDirt}</span>
        <span><svg width="14" height="14" viewBox="-7 -7 14 14"><path d="M-4,-4L4,4M4,-4L-4,4" stroke="#FFB020" strokeWidth="1.6" /></svg>{T.lgClosed}</span>
        {setLabels && Segmented && (
          <span className="lg-labels">
            <Segmented value={labels} onChange={setLabels} label={T.labelsLabel} options={[{ value: 'names', label: T.labelsNames }, { value: 'minutes', label: T.labelsMinutes }]} />
          </span>
        )}
      </div>
    </div>
  );
}
