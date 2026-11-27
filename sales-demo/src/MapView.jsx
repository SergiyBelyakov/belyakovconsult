// Карта України: справжні межі регіонів (Natural Earth, рівновелика проєкція), міста-бульбашки, склади й потоки логістики.
// Перетягування з інерцією, наближення кнопками, Ctrl і коліщатком, подвійним клацанням; клацання регіону наближає до нього.
import { useEffect, useRef, useState } from 'react';
import { UA_REGIONS, UA_W, UA_H } from '../../chart-gallery/src/ukraine-geo.js';
import { CITY, HUBS, NO_SALES } from './model/geo.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Tip, useWidth, useSpring, Glow, useUid } from './charts.jsx';
import { BRAND } from './colors.js';

export function MapView({ regionFill, regionTip, cities = [], flows = [], showFlows = false, showCities = true, selected, onSelect, mini = false, T, legend, height }) {
  const ref = useRef(null), W = useWidth(ref, mini ? 360 : 900), id = useUid('map');
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 }), [anim, setAnim] = useState(true);
  const [hv, setHv] = useState(null), [tip, setTip] = useState(null);
  const drag = useRef(null), inert = useRef(0), zr = useRef(z);
  zr.current = z;
  const [k, x, y] = useSpring([z.k, z.x, z.y], { stiff: 150, damp: 22, immediate: !anim });
  const H = height || Math.round(W * UA_H / UA_W);
  const clamp = (kk, xx, yy) => { kk = Math.max(1, Math.min(8, kk)); return { k: kk, x: Math.min(0, Math.max(UA_W - UA_W * kk, xx)), y: Math.min(0, Math.max(UA_H - UA_H * kk, yy)) }; };
  const toMap = e => { const r = ref.current.querySelector('svg').getBoundingClientRect(); return [(e.clientX - r.left) / r.width * UA_W, (e.clientY - r.top) / r.height * UA_H, r]; };
  const zoomAt = (f, mx, my) => { setAnim(true); setZ(o => { const kk = Math.max(1, Math.min(8, o.k * f)), q = kk / o.k; return clamp(kk, mx - (mx - o.x) * q, my - (my - o.y) * q); }); };
  const zoomTo = rid => {
    const rg = UA_REGIONS.find(r => r.id === rid); if (!rg) return;
    const [x0, y0, x1, y1] = rg.box, kk = Math.max(1.4, Math.min(5, 0.62 * Math.min(UA_W / (x1 - x0), UA_H / (y1 - y0))));
    setAnim(true); setZ(clamp(kk, UA_W / 2 - ((x0 + x1) / 2) * kk, UA_H / 2 - ((y0 + y1) / 2) * kk));
  };
  const reset = () => { setAnim(true); setZ({ k: 1, x: 0, y: 0 }); };
  useEffect(() => { if (!mini && selected) zoomTo(selected); if (!selected) reset(); }, [selected]);
  useEffect(() => {
    const svg = ref.current && ref.current.querySelector('svg');
    if (!svg || mini) return undefined;
    const wheel = e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const [mx, my] = toMap(e); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, mx, my); };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [mini, W]);
  const down = e => {
    if (mini || e.button !== 0) return;
    cancelAnimationFrame(inert.current);
    drag.current = { cx: e.clientX, cy: e.clientY, z: zr.current, moved: false, t: performance.now(), vx: 0, vy: 0, lx: e.clientX, ly: e.clientY };
  };
  const move = e => {
    const d = drag.current;
    if (d && e.buttons & 1) {
      const r = ref.current.querySelector('svg').getBoundingClientRect(), s = UA_W / r.width;
      const dx = e.clientX - d.cx, dy = e.clientY - d.cy;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      if (!d.moved) { d.moved = true; setTip(null); }
      const now = performance.now(), dt = Math.max(1, now - d.t);
      d.vx = ((e.clientX - d.lx) * s) / dt; d.vy = ((e.clientY - d.ly) * s) / dt; d.lx = e.clientX; d.ly = e.clientY; d.t = now;
      setAnim(false); setZ(clamp(d.z.k, d.z.x + dx * s, d.z.y + dy * s));
    }
  };
  const up = () => {
    const d = drag.current;
    if (d && d.moved) {
      // інерція: карта ще трохи «їде» після відпускання
      let vx = d.vx * 16, vy = d.vy * 16;
      const step = () => { vx *= 0.9; vy *= 0.9; setZ(o => clamp(o.k, o.x + vx, o.y + vy)); if (Math.hypot(vx, vy) > 0.3) inert.current = requestAnimationFrame(step); };
      if (Math.hypot(vx, vy) > 1) inert.current = requestAnimationFrame(step);
    }
    setTimeout(() => { drag.current = null; }, 0);
  };
  const showTip = (e, rows) => { const r = ref.current.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: Math.max(6, e.clientY - r.top - 70), ...rows }); };
  const sk = 1 / Math.sqrt(k);
  const labels = !mini && k > 1.7;
  return (
    <div className={'sm-map' + (mini ? ' mini' : '')} ref={ref} onPointerLeave={() => { setHv(null); setTip(null); }}>
      <svg viewBox={`0 0 ${UA_W} ${UA_H}`} width={W} height={H} role="img" aria-label={T.nav.map}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={e => { if (mini) return; const [mx, my] = toMap(e); zoomAt(1.6, mx, my); }}
        style={{ cursor: mini ? 'pointer' : drag.current && drag.current.moved ? 'grabbing' : 'grab', touchAction: mini ? 'auto' : 'none' }}>
        <defs>
          <pattern id={id + 'h'} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#3A4556" strokeWidth="1.6" /></pattern>
          <Glow id={id + 'g'} W={UA_W} H={UA_H} s1={1.6} s2={6} k={1.2} />
          <radialGradient id={id + 'c'}><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".45" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        <g transform={`translate(${x} ${y}) scale(${k})`}>
          {UA_REGIONS.map(rg => {
            const none = NO_SALES.has(rg.id), fill = none ? null : regionFill(rg.id), on = selected === rg.id, h = hv === rg.id;
            return (
              <g key={rg.id} className={'sm-reg' + (on ? ' on' : '') + (h ? ' hv' : '') + (selected && !on ? ' dim' : '')}>
                <path d={rg.d} fill={none ? `url(#${id}h)` : fill} className="sm-reg-p" vectorEffect="non-scaling-stroke"
                  onPointerMove={e => { if (drag.current && drag.current.moved) return; setHv(rg.id); showTip(e, none ? { title: regionTip(rg.id).title, note: T.map.noSales } : regionTip(rg.id)); }}
                  onClick={() => { if (drag.current && drag.current.moved) return; if (!none && onSelect) onSelect(selected === rg.id ? null : rg.id); }} />
              </g>
            );
          })}
          {selected && <path d={UA_REGIONS.find(r => r.id === selected).d} className="sm-reg-sel" vectorEffect="non-scaling-stroke" filter={`url(#${id}g)`} />}
          {hv && hv !== selected && <path d={UA_REGIONS.find(r => r.id === hv).d} className="sm-reg-hv" vectorEffect="non-scaling-stroke" />}
          {showFlows && flows.map((f, i) => {
            const a = CITY[f.from], b = CITY[f.to], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
            const cx = mx - (dy / L) * L * 0.18, cy = my + (dx / L) * L * 0.18;
            return <path key={i} d={`M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`} className="sm-flow" style={{ '--fw': f.w, '--fd': (2 + (i % 7) * 0.35) + 's' }} vectorEffect="non-scaling-stroke" stroke={f.color || BRAND.cyan} />;
          })}
          {showCities && cities.map(c => {
            const ct = CITY[c.id], r = c.r * sk;
            return (
              <g key={c.id} className={'sm-city' + (c.on ? ' on' : '')} transform={`translate(${ct.x} ${ct.y})`}
                onPointerMove={e => { if (drag.current && drag.current.moved) return; e.stopPropagation(); setHv(ct.region); showTip(e, c.tip); }}
                onClick={e => { e.stopPropagation(); if (drag.current && drag.current.moved) return; c.onClick && c.onClick(); }}>
                <circle r={r * 2.2} fill={`url(#${id}c)`} opacity=".22" className="sm-city-halo" />
                <circle r={r} fill={c.color} className="sm-city-c" vectorEffect="non-scaling-stroke" />
                {(labels || c.label) && <text y={-r - 4 * sk} textAnchor="middle" className="sm-city-t" style={{ fontSize: 11 * sk * (mini ? 1.6 : 1) }}>{c.name}</text>}
              </g>
            );
          })}
          {showFlows && HUBS.map(h => { const ct = CITY[h.city], s = 9 * sk; return <g key={h.id} transform={`translate(${ct.x} ${ct.y})`} className="sm-hub"><path d={`M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z`} vectorEffect="non-scaling-stroke" filter={`url(#${id}g)`} /></g>; })}
        </g>
      </svg>
      {!mini && (
        <div className="sm-zoom" role="group" aria-label={T.map.zoomIn}>
          <button type="button" onClick={() => zoomAt(1.5, UA_W / 2, UA_H / 2)} aria-label={T.map.zoomIn} title={T.map.zoomIn}><Icon name="plus" size={15} /></button>
          <button type="button" onClick={() => zoomAt(1 / 1.5, UA_W / 2, UA_H / 2)} aria-label={T.map.zoomOut} title={T.map.zoomOut}><Icon name="minus" size={15} /></button>
          <button type="button" onClick={() => { reset(); onSelect && onSelect(null); }} aria-label={T.map.reset} title={T.map.reset} disabled={z.k === 1 && !selected}><Icon name="reset" size={14} /></button>
        </div>
      )}
      {legend}
      <Tip tip={tip} W={W} />
    </div>
  );
}
