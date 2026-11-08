// Карта двійника на SVG: відтінений рельєф і земний покрив (растр зі зрізу), річка й притоки, дороги,
// населені пункти, об'єкти реєстрів, межі округів, хороплет, зона паводку, чутність сирен, лінії сценаріїв.
// Масштаб і зсув через d3-zoom; значки мають сталий розмір у пікселях (CSS-змінна --u).
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { contours } from 'd3-contour';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { Icon } from '../../dashboard/src/icons.jsx';
import { S, GRID, PLACES, BY_ID, OKRUGS, OKRUG_OF, OBJECTS, ROADS } from './world.js';
import { CAT_COLOR } from './charts.jsx';

const W = S.world.w, H = S.world.h;
const line = pts => 'M' + pts.map(p => p[0] + ',' + p[1]).join('L');
const BOUND = 'M' + S.boundary.map(p => p.join(',')).join('L') + 'Z';
const WORLD_RECT = `M-30,-30H${W + 30}V${H + 30}H-30Z`;
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const DOM_OF = { school: 'edu', kg: 'edu', health: 'health', shelter: 'safety', point: 'safety', admin: 'services', water: 'services', culture: 'services' };
export const objColor = o => CAT_COLOR[DOM_OF[o.cat]];

// ——— растр основи: відтінення (світло з північного заходу) × земний покрив ———
let RASTER = null;
const LC_RGB = [[22, 52, 92], [74, 78, 88], [24, 50, 40], [60, 55, 41], [43, 55, 37], [28, 58, 66]];
export function baseRaster() {
  if (RASTER) return RASTER;
  const { gx, gy, H: HH, LC, INSIDE } = GRID;
  const c = document.createElement('canvas'); c.width = gx; c.height = gy;
  const cx = c.getContext('2d'), img = cx.createImageData(gx, gy);
  const at = (i, j) => HH[Math.max(0, Math.min(gy - 1, j)) * gx + Math.max(0, Math.min(gx - 1, i))];
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const k = j * gx + i;
    const dx = (at(i + 1, j) - at(i - 1, j)) * 8 / 500, dy = (at(i, j + 1) - at(i, j - 1)) * 8 / 500;
    const l = Math.hypot(dx, dy, 1), hs = Math.max(0, (dx * 0.6 + dy * 0.6 + 0.55) / l);
    const e = (HH[k] - S.relief.min) / (S.relief.max - S.relief.min);
    const base = LC_RGB[LC[k]] || LC_RGB[3], sh = 0.5 + 0.75 * hs + e * 0.12, dim = INSIDE[k] ? 1 : 0.55;
    img.data[k * 4] = Math.min(255, base[0] * sh * dim); img.data[k * 4 + 1] = Math.min(255, base[1] * sh * dim); img.data[k * 4 + 2] = Math.min(255, base[2] * sh * dim); img.data[k * 4 + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  const c2 = document.createElement('canvas'); c2.width = gx * 4; c2.height = gy * 4;
  const x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = 'high';
  x2.drawImage(c, 0, 0, c2.width, c2.height);
  RASTER = c2.toDataURL('image/png');
  return RASTER;
}

// ——— контури з сіток ———
function blur3(v, w, h) {
  const o = new Float32Array(v.length);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let s = 0, n = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= w || y >= h) continue; s += v[y * w + x]; n++; }
    o[j * w + i] = s / n;
  }
  return o;
}
const mpPath = (mp, sc, minArea = 0) => {
  let s = '';
  for (const poly of mp.coordinates) {
    for (const ring of poly) {
      if (minArea) { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); if (Math.abs(a / 2) < minArea) continue; }
      s += 'M' + ring.map(p => (p[0] * sc).toFixed(2) + ',' + (p[1] * sc).toFixed(2)).join('L') + 'Z';
    }
  }
  return s;
};
const CACHE = new Map();
const cached = (k, fn) => { if (!CACHE.has(k)) CACHE.set(k, fn()); return CACHE.get(k); };
// межі зон населених пунктів і округів (кожна клітинка 400 м належить найближчому за часом авто пункту)
export function areaPath(level, id) {
  return cached('a|' + level + '|' + id, () => {
    const { agx, agy, acell, ASSIGN } = GRID;
    const ids = level === 'okrug' ? new Set(OKRUGS.find(o => o.id === id).places.map(pid => BY_ID.get(pid).i)) : new Set([BY_ID.get(id).i]);
    const v = new Float32Array(agx * agy);
    for (let c = 0; c < v.length; c++) v[c] = ids.has(ASSIGN[c]) ? 1 : 0;
    return mpPath(contours().size([agx, agy]).smooth(true).contour(blur3(v, agx, agy), 0.5), acell, 1.2);
  });
}
export function floodPath(stage) {
  const key = Math.round(stage * 5);
  return cached('f|' + key, () => {
    const { gx, gy, step, FLOOD } = GRID;
    const v = new Float32Array(gx * gy);
    for (let c = 0; c < v.length; c++) { const t = FLOOD[c]; v[c] = t === 255 || (t > 0 && t - 1 <= key) ? 1 : 0; }
    return mpPath(contours().size([gx, gy]).smooth(true).contour(blur3(v, gx, gy), 0.5), step, 0.6);
  });
}
export function sirenPath() {
  return cached('siren', () => {
    const { gx, gy, step, SIREN } = GRID;
    return mpPath(contours().size([gx, gy]).smooth(true).contour(blur3(Float32Array.from(SIREN), gx, gy), 0.5), step, 0.5);
  });
}

// ——— значки об'єктів (у пікселях) ———
export function Glyph({ o, state }) {
  const c = objColor(o), hollow = state === 'hollow';
  const fill = hollow ? '#0B0F15' : c, st = hollow ? c : '#05070A';
  switch (o.cat) {
    case 'school': return <rect x="-5.5" y="-5.5" width="11" height="11" rx="2" fill={fill} stroke={st} strokeWidth="1.6" />;
    case 'kg': return <><rect x="-4.2" y="-4.2" width="8.4" height="8.4" rx="4.2" fill={fill} stroke={st} strokeWidth="1.5" /><circle r="1.5" fill="#05070A" /></>;
    case 'health': { const s = o.kind === 'hospital' ? 7 : o.kind === 'amb' ? 6 : 4.8, t = s * 0.42; return <path d={`M${-t},${-s}H${t}V${-t}H${s}V${t}H${t}V${s}H${-t}V${t}H${-s}V${-t}H${-t}Z`} fill={o.kind === 'fap' && !o.staff ? '#0B0F15' : fill} stroke={o.kind === 'fap' && !o.staff ? c : st} strokeWidth="1.5" />; }
    case 'admin': { const s = o.kind === 'cnap' ? 7 : o.kind === 'remote' ? 5.8 : 4.8; return <path d={`M0,${-s}L${s},0L0,${s}L${-s},0Z`} fill={fill} stroke={st} strokeWidth="1.5" />; }
    case 'shelter': return <path d="M0,-6.2L5.6,-3.2V1.6C5.6,4.4 2.8,6.2 0,7C-2.8,6.2 -5.6,4.4 -5.6,1.6V-3.2Z" fill={o.state === 'not' || hollow ? '#0B0F15' : fill} stroke={o.state === 'not' || hollow ? c : st} strokeWidth="1.5" strokeDasharray={o.state === 'limited' ? '2.4 1.6' : undefined} />;
    case 'point': return <><circle r="6.2" fill={o.broken || hollow ? '#0B0F15' : fill} stroke={o.broken || hollow ? c : st} strokeWidth="1.5" /><path d="M0.8,-4L-2.6,0.8H0.2L-0.8,4L2.6,-0.8H-0.2Z" fill={o.broken || hollow ? c : '#05070A'} /></>;
    case 'water': return <path d="M0,-6.5C2.2,-3.4 4.8,-0.6 4.8,2.2A4.8,4.8 0 0 1 -4.8,2.2C-4.8,-0.6 -2.2,-3.4 0,-6.5Z" fill={fill} stroke={st} strokeWidth="1.5" />;
    default: return <circle r="3.6" fill={fill} stroke={st} strokeWidth="1.4" />;
  }
}

function Pin({ x, y, children, className = '', ...rest }) {
  return <g transform={`translate(${x} ${y})`} className={className} {...rest}><g className="px">{children}</g></g>;
}

const Base = memo(function Base({ roadsMode }) {
  return (
    <>
      <image href={baseRaster()} x="0" y="0" width={W} height={H} preserveAspectRatio="none" className="base-img" />
      <g className="streams">{S.streams.map((s, i) => <path key={i} d={line(s.pts)} className={'stream' + (s.a > 400 ? ' big' : '')} />)}</g>
      <path className="river" d={line(S.river)} />
      <path className="river-hi" d={line(S.river)} />
      <g className="roads">
        {ROADS.filter(r => r.cls === 'national').map(r => <path key={'c' + r.id} d={line(r.pts)} className="rd-case" />)}
        {[...ROADS].sort((a, b) => ['dirt', 'local', 'regional', 'town', 'national'].indexOf(a.cls) - ['dirt', 'local', 'regional', 'town', 'national'].indexOf(b.cls)).map(r => (
          <path key={r.id} d={line(r.pts)} className={roadsMode ? 'rd rdc-' + r.cond + (r.owner === 'state' ? ' state' : '') : 'rd rd-' + r.cls + (r.bridge === 'b3' ? ' rd-ponton' : '')} />
        ))}
      </g>
    </>
  );
});

export default function TwinMap({
  ctx, layers, selected, onSelect, height = 600, label, floodStage = null, choropleth = null, objFilter, objState, placeState, lines, tipExtra, zoomTo, chip, compact,
}) {
  const { T, f, placeName, objName } = ctx;
  const wrapRef = useRef(null), svgRef = useRef(null), gRef = useRef(null), zoomRef = useRef(null), tRef = useRef(zoomIdentity);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [hover, setHover] = useState(null);
  const [zk, setZk] = useState(1);
  const L = layers || new Set();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    const upd = () => { const r = el.getBoundingClientRect(); setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) }); };
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s0 = Math.min(size.w / W, size.h / H);
  const s0Ref = useRef(s0); s0Ref.current = s0;
  const setU = k => { const svg = svgRef.current; if (!svg) return; svg.style.setProperty('--u', (1 / (s0Ref.current * k)).toFixed(5)); svg.dataset.zoom = k >= 2.6 ? 'near' : k >= 1.5 ? 'mid' : 'far'; };
  useEffect(() => { setU(tRef.current.k); }, [s0]);
  useEffect(() => {
    const svg = select(svgRef.current);
    const z = d3zoom().scaleExtent([1, 10]).translateExtent([[-4, -4], [W + 4, H + 4]]).on('zoom', e => {
      if (!gRef.current) return;
      tRef.current = e.transform; gRef.current.setAttribute('transform', e.transform.toString()); setU(e.transform.k); setHover(null);
    }).on('end', e => setZk(e.transform.k));
    svg.call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
    return () => { svg.interrupt(); svg.on('.zoom', null); };
  }, []);
  // наблизити до населеного пункту чи об'єкта
  useEffect(() => {
    if (!zoomTo || !zoomRef.current) return;
    const svg = select(svgRef.current), z = zoomRef.current;
    const k = zoomTo.k || 2.4, t = zoomIdentity.translate(W / 2 - k * zoomTo.x, H / 2 - k * zoomTo.y).scale(k);
    if (reduceMotion()) svg.call(z.transform, t); else svg.transition().duration(650).call(z.transform, t);
  }, [zoomTo]);
  const zoomBy = k => zoomRef.current && select(svgRef.current).transition().duration(260).call(zoomRef.current.scaleBy, k);
  const fit = () => zoomRef.current && select(svgRef.current).transition().duration(480).call(zoomRef.current.transform, zoomIdentity);

  const objs = useMemo(() => OBJECTS.filter(o => L.has(DOM_OF[o.cat]) && (!objFilter || objFilter(o))), [layers, objFilter]);
  const choroPaths = useMemo(() => {
    if (!choropleth) return [];
    const list = choropleth.level === 'okrug' ? OKRUGS.map(o => o.id) : PLACES.map(p => p.id);
    return list.map(id => ({ id, d: areaPath(choropleth.level, id), v: choropleth.value(id) }));
  }, [choropleth]);
  const okrugPaths = useMemo(() => (L.has('okrugs') ? OKRUGS.map(o => ({ id: o.id, d: areaPath('okrug', o.id) })) : []), [layers]);
  const fl = floodStage != null ? floodPath(floodStage) : L.has('flood') ? floodPath(6) : null;

  const onMove = e => {
    const d = e.target.dataset || {};
    const r = wrapRef.current.getBoundingClientRect();
    const kind = d.kind || (d.area ? 'area' : null), id = d.id || d.area;
    if (kind) setHover(h => (h && h.kind === kind && h.id === id ? h : { kind, id, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }));
    else if (hover) setHover(null);
  };
  const onClick = e => {
    const d = e.target.dataset || {};
    setHover(null);
    if (d.kind) onSelect && onSelect({ kind: d.kind, id: d.id });
    else if (d.area) onSelect && onSelect({ kind: choropleth && choropleth.level === 'okrug' ? 'okrug' : 'place', id: d.area });
    else onSelect && onSelect(null);
  };
  const tipBody = () => {
    if (!hover) return null;
    if (hover.kind === 'area') {
      const okr = choropleth && choropleth.level === 'okrug';
      return <><b>{okr ? T.okrugsWord : T.kindsPlace[BY_ID.get(hover.id).kind]}</b><strong>{okr ? T.okrugName(hover.id) : placeName(BY_ID.get(hover.id))}</strong>{tipExtra && tipExtra('area', hover.id)}</>;
    }
    if (hover.kind === 'place') {
      const p = BY_ID.get(hover.id);
      return <><b>{T.kindsPlace[p.kind]} · {T.okrugName(OKRUG_OF[p.id])}</b><strong>{placeName(p)}</strong><small>{T.tipPop(f.int(p.pop))}</small>{tipExtra && tipExtra('place', p.id)}</>;
    }
    const o = OBJECTS.find(x => x.id === hover.id);
    if (!o) return null;
    return <><b>{T.catName[o.cat]}</b><strong>{objName(o)}</strong>{tipExtra && tipExtra('obj', o.id)}</>;
  };
  const scaleKm = [1, 2, 5, 10, 20].find(k => k * s0 * zk >= 64) || 20;
  const sel = selected || {};

  return (
    <div className={'map-wrap tw-map' + (compact ? ' compact' : '')} ref={wrapRef} style={{ height }}>
      <svg ref={svgRef} className="tmap" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} data-zoom="far"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={onClick}>
        <defs>
          <clipPath id="tw-clip"><path d={BOUND} /></clipPath>
          <pattern id="tw-siren" patternUnits="userSpaceOnUse" width=".55" height=".55" patternTransform="rotate(45)"><path d="M0,0V.55" stroke="rgba(244,246,248,.55)" strokeWidth=".07" /></pattern>
        </defs>
        <g ref={gRef}>
          <rect x="-30" y="-30" width={W + 60} height={H + 60} className="map-bg" />
          <Base roadsMode={L.has('roads')} />
          {choropleth && (
            <g className="choro" clipPath="url(#tw-clip)">
              <path d={BOUND} className="choro-under" />
              {choroPaths.map(c => <path key={c.id} d={c.d} data-area={c.id} className={'cz' + (sel.id === c.id ? ' on' : '')} fill={c.v == null ? 'transparent' : choropleth.color(c.v)} fillOpacity={c.v == null ? 0 : 0.62} />)}
            </g>
          )}
          {fl && <path className="flood" d={fl} clipPath="url(#tw-clip)" />}
          {L.has('sirens') && <path className="siren-area" d={sirenPath()} fill="url(#tw-siren)" />}
          {L.has('sirens') && <path className="siren-edge" d={sirenPath()} />}
          <path className="outside" d={WORLD_RECT + BOUND} fillRule="evenodd" />
          <path className="boundary" d={BOUND} />
          {okrugPaths.length > 0 && <g className="okrugs" clipPath="url(#tw-clip)">{okrugPaths.map(o => <path key={o.id} d={o.d} className={'ok-line' + (sel.kind === 'okrug' && sel.id === o.id ? ' on' : '')} />)}</g>}
          {lines && lines.length > 0 && (
            <g className="links">{lines.map((l, i) => <path key={i} d={`M${l.from[0]},${l.from[1]}L${l.to[0]},${l.to[1]}`} className={'link ' + (l.cls || '')} />)}</g>
          )}
          <g className="places">
            {PLACES.map(p => {
              const st = placeState ? placeState(p) : null;
              const r = L.has('pop') ? 3 + Math.sqrt(p.pop) / 7 : p.kind === 'village' ? 2.6 : 3.6;
              const big = p.kind !== 'village' || p.pop >= 800;
              const isSel = sel.kind === 'place' && sel.id === p.id;
              return (
                <Pin key={p.id} x={p.x} y={p.y} className={'pl pl-' + p.kind + (st ? ' ' + st : '') + (isSel ? ' sel' : '') + (big ? ' big' : '') + (L.has('pop') ? ' bub' : '')}>
                  {isSel && <circle r={r + 5} className="pl-sel" />}
                  <circle r={r} className="pl-dot" />
                  <circle r={Math.max(r + 4, 9)} className="pl-hit" data-id={p.id} data-kind="place" />
                  <text y={-(r + 5)} textAnchor="middle" className="pl-label">{p.kind === 'district' ? T.district[p.district] : placeName(p)}</text>
                </Pin>
              );
            })}
            <Pin x={22.4} y={13.9} className="town-label"><text textAnchor="middle">{T.townName}</text></Pin>
          </g>
          <g className="objs">
            {objs.map(o => {
              const st = objState ? objState(o) : null;
              if (st === 'off') return null;
              const isSel = sel.kind === 'obj' && sel.id === o.id;
              return (
                <Pin key={o.id} x={o.x} y={o.y} className={'ob' + (st ? ' ' + st : '') + (isSel ? ' sel' : '')}>
                  {isSel && <circle r="11" className="ob-sel" />}
                  {st === 'hot' && <circle r="10" className="ob-hot" />}
                  <Glyph o={o} state={st === 'hollow' ? 'hollow' : null} />
                  <circle r="9" className="ob-hit" data-id={o.id} data-kind="obj" />
                </Pin>
              );
            })}
          </g>
        </g>
      </svg>
      {chip && <div className="map-chip glass-control"><span className="ruby-dot" />{chip}</div>}
      <div className="map-ctl">
        <button type="button" className="icon-btn" onClick={() => zoomBy(1.6)} aria-label={T.zoomIn} title={T.zoomIn}><Icon name="zoomIn" size={17} /></button>
        <button type="button" className="icon-btn" onClick={() => zoomBy(1 / 1.6)} aria-label={T.zoomOut} title={T.zoomOut}><Icon name="zoomOut" size={17} /></button>
        <button type="button" className="icon-btn" onClick={fit} aria-label={T.zoomFit} title={T.zoomFit}><Icon name="expand" size={17} /></button>
      </div>
      <div className="map-scale" aria-hidden="true"><i style={{ width: scaleKm * s0 * zk }} /><span>{scaleKm} {T.km}</span></div>
      {hover && (
        <div className={'chart-tip map-tip' + (hover.x > hover.w * 0.65 ? ' tip-r' : hover.x < hover.w * 0.3 ? ' tip-l' : '')} style={{ left: hover.x, top: hover.y + 18 }} role="status">{tipBody()}</div>
      )}
    </div>
  );
}

// Легенда значків за доменами
export function GlyphLegend({ T, cats }) {
  const sample = { school: { cat: 'school' }, kg: { cat: 'kg' }, hospital: { cat: 'health', kind: 'hospital' }, amb: { cat: 'health', kind: 'amb' }, fap: { cat: 'health', kind: 'fap', staff: true }, cnap: { cat: 'admin', kind: 'cnap' }, starosta: { cat: 'admin', kind: 'starosta' }, shelter: { cat: 'shelter', state: 'ready' }, point: { cat: 'point' }, water: { cat: 'water' }, culture: { cat: 'culture' } };
  return (
    <div className="glyph-legend">
      {cats.map(k => (
        <span key={k}><svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true"><Glyph o={sample[k]} /></svg>{T.glyph[k]}</span>
      ))}
    </div>
  );
}
