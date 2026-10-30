// Графи на SVG: мережа людей і служб (масштаб, зсув, вибір вузла), карта характеристик, мініатюри громад.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { Icon } from '../../dashboard/src/icons.jsx';
import { CENTERS, boundsOf } from './layout.js';
import { useWidth } from '../../dashboard/src/charts.jsx';

export const EDGE_GROUPS = [
  ['household', ['household']], ['family', ['family']], ['care', ['care']], ['support', ['support']],
  ['social', ['social']], ['medical', ['clinic', 'rehab']], ['duplicate', ['duplicate']],
];
export const GROUP_OF = Object.fromEntries(EDGE_GROUPS.flatMap(([g, types]) => types.map(t => [t, g])));
const ORDER = { clinic: 0, rehab: 1, social: 2, household: 3, family: 4, support: 5, care: 6, duplicate: 7 };

const diamond = (x, y, r) => `M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y} Z`;

const Edges = memo(function Edges({ edges, pos, edgeOn, selected, focus }) {
  return (
    <g className="edges">
      {edges.map(e => {
        if (!edgeOn.has(GROUP_OF[e.type])) return null;
        const a = pos.get(e.s), b = pos.get(e.t);
        const inc = selected && (e.s === selected || e.t === selected);
        const dim = selected ? !inc : focus ? !(focus.has(e.s) || focus.has(e.t)) : false;
        return <line key={e.i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={'e e-' + e.type + (inc ? ' on' : '') + (dim ? ' dim' : '')} />;
      })}
    </g>
  );
});

const Nodes = memo(function Nodes({ nodes, pos, styles, selected, focus, svcLabel, personLabel }) {
  return (
    <g className="nodes">
      {nodes.map(n => {
        const p = pos.get(n.id), s = styles.get(n.id);
        const dim = focus && !focus.has(n.id) && n.id !== selected;
        const cls = 'n n-' + n.kind + (dim ? ' dim' : '') + (s.cls ? ' ' + s.cls : '');
        if (n.kind === 'person') {
          return (
            <g key={n.id} className={cls}>
              {s.halo && <circle className="halo" cx={p.x} cy={p.y} r={s.r + 3.2} />}
              <circle className="dot" cx={p.x} cy={p.y} r={s.r} fill={s.fill} />
              <circle className="hit" data-id={n.id} cx={p.x} cy={p.y} r={s.r + 5} />
              <text className="p-label" data-id={n.id} x={p.x} y={p.y - s.r} dy="-0.5em" textAnchor="middle">{personLabel(n)}</text>
            </g>
          );
        }
        const r = s.r;
        return (
          <g key={n.id} className={cls}>
            {n.kind === 'sw'
              ? <rect data-id={n.id} x={p.x - r * .8} y={p.y - r * .8} width={r * 1.6} height={r * 1.6} rx="2" />
              : <path data-id={n.id} d={diamond(p.x, p.y, r)} />}
            <text className="svc-label" data-id={n.id} x={p.x} y={p.y + r} dy="1.25em" textAnchor="middle">{svcLabel(n)}</text>
          </g>
        );
      })}
    </g>
  );
});

export function NetworkGraph({ base, layout, styles, edgeOn, selected, focus, onSelect, svcLabel, personLabel, terrName, tip, zoomTarget, T, label }) {
  const wrapRef = useRef(null), svgRef = useRef(null), gRef = useRef(null), zoomRef = useRef(null);
  const [hover, setHover] = useState(null);
  const { pos } = layout;
  const edges = useMemo(() => [...base.edges].sort((a, b) => ORDER[a.type] - ORDER[b.type]), [base]);

  const terrLabels = useMemo(() => Object.entries(CENTERS).map(([id, c]) => {
    const pts = base.people.filter(p => p.territory === id).map(p => pos.get(p.id));
    const ux = Math.cos(c.angle), uy = Math.sin(c.angle);
    const reach = Math.max(...pts.map(p => p.x * ux + p.y * uy));
    const d = reach + 24;
    return { id, x: ux * d, y: uy * d + (uy > .5 ? 10 : uy < -.5 ? -4 : 4), anchor: ux > .35 ? 'start' : ux < -.35 ? 'end' : 'middle' };
  }), [base, pos]);

  // вікно перегляду з урахуванням підписів громад
  const bounds = useMemo(() => {
    const b = layout.bounds;
    let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    for (const t of terrLabels) {
      const w = 118;
      const lx0 = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2;
      x0 = Math.min(x0, lx0 - 6); x1 = Math.max(x1, lx0 + w + 6);
      y0 = Math.min(y0, t.y - 18); y1 = Math.max(y1, t.y + 8);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [layout, terrLabels]);

  useEffect(() => {
    const svg = select(svgRef.current);
    const z = d3zoom().scaleExtent([0.8, 8]).on('zoom', e => {
      gRef.current.setAttribute('transform', e.transform.toString());
      svgRef.current.dataset.zoom = e.transform.k >= 2.1 ? 'near' : 'far';
      svgRef.current.style.setProperty('--k', e.transform.k.toFixed(3));
      setHover(null);
    });
    svg.call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
    return () => { svg.on('.zoom', null); };
  }, []);

  useEffect(() => {
    if (!zoomTarget || !zoomRef.current) return;
    const svg = select(svgRef.current), z = zoomRef.current;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const run = (fn, ...args) => (reduce ? svg.call(fn, ...args) : svg.transition().duration(zoomTarget.fast ? 250 : 650).call(fn, ...args));
    if (zoomTarget.by) { run(z.scaleBy, zoomTarget.by); return; }
    let t = zoomIdentity;
    if (zoomTarget.id && pos.get(zoomTarget.id)) {
      const p = pos.get(zoomTarget.id), k = zoomTarget.k || 2.3;
      const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
      t = zoomIdentity.translate(cx - k * p.x, cy - k * p.y).scale(k);
    } else if (zoomTarget.territory) {
      const pts = base.nodes.filter(n => n.territory === zoomTarget.territory).map(n => pos.get(n.id));
      const b = boundsOf(pts, 30);
      const k = Math.min(3, Math.min(bounds.w / b.w, bounds.h / b.h) * .92);
      const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
      t = zoomIdentity.translate(cx - k * (b.x + b.w / 2), cy - k * (b.y + b.h / 2)).scale(k);
    }
    run(z.transform, t);
  }, [zoomTarget]);

  const onOver = e => {
    const id = e.target.dataset && e.target.dataset.id;
    if (!id) return;
    const r = wrapRef.current.getBoundingClientRect();
    setHover({ id, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
  };
  const onOut = e => { if (e.target.dataset && e.target.dataset.id) setHover(null); };
  const onClick = e => {
    const id = e.target.dataset && e.target.dataset.id;
    setHover(null);
    onSelect(id || null);
  };
  const zoomBy = by => zoomRef.current && select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, by);
  const fit = () => zoomRef.current && select(svgRef.current).transition().duration(450).call(zoomRef.current.transform, zoomIdentity);

  return (
    <div className="graph-wrap" ref={wrapRef}>
      <svg ref={svgRef} className="graph" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} preserveAspectRatio="xMidYMid meet"
        role="img" aria-label={label} data-zoom="far" onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <g ref={gRef}>
          <rect x={bounds.x - bounds.w} y={bounds.y - bounds.h} width={bounds.w * 3} height={bounds.h * 3} fill="transparent" />
          <g className="terr-labels">
            {terrLabels.map(t => <text key={t.id} x={t.x} y={t.y} textAnchor={t.anchor}>{terrName(t.id)}</text>)}
          </g>
          <Edges edges={edges} pos={pos} edgeOn={edgeOn} selected={selected} focus={focus} />
          <Nodes nodes={base.nodes} pos={pos} styles={styles} selected={selected} focus={focus} svcLabel={svcLabel} personLabel={personLabel} />
          {selected && pos.get(selected) && styles.get(selected) && (
            <circle className="sel-ring" cx={pos.get(selected).x} cy={pos.get(selected).y} r={(styles.get(selected)?.r || 8) + 5} />
          )}
        </g>
      </svg>
      <div className="graph-zoom">
        <button type="button" className="icon-btn" onClick={() => zoomBy(1.5)} aria-label={T.zoomIn} title={T.zoomIn}><Icon name="zoomIn" size={17} /></button>
        <button type="button" className="icon-btn" onClick={() => zoomBy(1 / 1.5)} aria-label={T.zoomOut} title={T.zoomOut}><Icon name="zoomOut" size={17} /></button>
        <button type="button" className="icon-btn" onClick={fit} aria-label={T.zoomFit} title={T.zoomFit}><Icon name="expand" size={17} /></button>
      </div>
      {hover && (
        <div className={'chart-tip graph-tip' + (hover.x > hover.w * .65 ? ' tip-r' : hover.x < hover.w * .3 ? ' tip-l' : '')} style={{ left: hover.x, top: hover.y + 16 }} role="status">
          {tip(hover.id)}
        </div>
      )}
    </div>
  );
}

// Підпис у два рядки, якщо довгий
export function wrap(text, max = 16) {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  let best = [text], bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const diff = Math.max(a.length, b.length);
    if (diff < bestDiff) { bestDiff = diff; best = [a, b]; }
  }
  return best;
}

export function TraitGraph({ traits, layout, prevalence, links, selected, onSelect, color, name, tip, label, height = 560 }) {
  const [wrapRef, W] = useWidth(700);
  const [hover, setHover] = useState(null);
  const H = W < 520 ? Math.min(height, 440) : height;
  // координати розкладки → пікселі контейнера, щоб підписи лишались 12px за будь-якої ширини
  const pos = useMemo(() => {
    // у вузькому вертикальному вікні повертаємо розкладку на 90°, щоб краще використати висоту
    const rot = H > W * 1.1;
    const pts = [...layout.pos.entries()].map(([id, p]) => [id, rot ? { x: p.y, y: p.x } : p]);
    const xs = pts.map(([, p]) => p.x), ys = pts.map(([, p]) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const padX = W < 520 ? 46 : 70, padT = W < 520 ? 22 : 30, padB = W < 520 ? 40 : 54;
    const s = Math.min((W - padX * 2) / Math.max(1, x1 - x0), (H - padT - padB) / Math.max(1, y1 - y0));
    const ox = (W - (x1 - x0) * s) / 2 - x0 * s, oy = padT + (H - padT - padB - (y1 - y0) * s) / 2 - y0 * s;
    return new Map(pts.map(([id, p]) => [id, { x: p.x * s + ox, y: p.y * s + oy }]));
  }, [layout, W, H]);
  const maxLift = Math.max(2, ...links.map(l => l.lift));
  const neighbors = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    links.forEach(l => { if (l.a === selected) s.add(l.b); if (l.b === selected) s.add(l.a); });
    return s;
  }, [selected, links]);
  const over = (id, e) => {
    const r = wrapRef.current.getBoundingClientRect();
    setHover({ id, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
  };
  return (
    <div className="graph-wrap trait-wrap" ref={wrapRef} style={{ height: H }}>
      <svg className="graph" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
        onClick={e => { if (e.target === e.currentTarget) onSelect(null); }}>
        <g className="t-edges">
          {links.map(l => {
            const a = pos.get(l.a), b = pos.get(l.b);
            const on = selected && (l.a === selected || l.b === selected);
            const dim = selected && !on;
            return <line key={l.a + l.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={'te' + (on ? ' on' : '') + (dim ? ' dim' : '')}
              strokeWidth={1 + ((Math.min(l.lift, maxLift) - 1) / (maxLift - 1)) * 5} />;
          })}
        </g>
        <g className="t-nodes">
          {traits.map((t, i) => {
            const p = pos.get(t.id), r = (W < 520 ? 4.5 : 6.5) + Math.sqrt(prevalence[i]) * (W < 520 ? .9 : 1.35);
            const dim = neighbors && !neighbors.has(t.id);
            const lines = wrap(name(t.id));
            return (
              <g key={t.id} className={'tn' + (dim ? ' dim' : '') + (selected === t.id ? ' sel' : '')} onClick={() => onSelect(selected === t.id ? null : t.id)}
                onPointerEnter={e => over(t.id, e)} onPointerLeave={() => setHover(null)} role="button" tabIndex="0" aria-label={name(t.id)} aria-pressed={selected === t.id}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(selected === t.id ? null : t.id); } }}>
                <circle cx={p.x} cy={p.y} r={r + 10} className="hit" />
                {selected === t.id && <circle cx={p.x} cy={p.y} r={r + 5} className="sel-ring" />}
                <circle cx={p.x} cy={p.y} r={r} fill={color(t.domain)} className="dotm" />
                <text x={p.x} y={p.y + r + 15} textAnchor="middle">
                  {lines.map((s, k) => <tspan key={k} x={p.x} dy={k ? 14 : 0}>{s}</tspan>)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {hover && (
        <div className={'chart-tip graph-tip' + (hover.x > hover.w * .65 ? ' tip-r' : hover.x < hover.w * .3 ? ' tip-l' : '')} style={{ left: hover.x, top: hover.y + 16 }} role="status">
          {tip(hover.id)}
        </div>
      )}
    </div>
  );
}

// Мініатюра мережі громади: ті самі координати, власне вікно перегляду.
export function MiniGraph({ base, pos, territory, styles, label }) {
  const { nodes, edges, b } = useMemo(() => {
    const ids = new Set(base.nodes.filter(n => n.territory === territory).map(n => n.id));
    const es = base.edges.filter(e => ids.has(e.s) && ids.has(e.t) && e.type !== 'clinic');
    return { nodes: base.nodes.filter(n => ids.has(n.id)), edges: es, b: boundsOf([...ids].map(id => pos.get(id)), 16) };
  }, [base, pos, territory]);
  return (
    <svg className="mini-graph" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      {edges.map(e => {
        const a = pos.get(e.s), c = pos.get(e.t);
        return <line key={e.i} x1={a.x} y1={a.y} x2={c.x} y2={c.y} className={'e e-' + e.type} />;
      })}
      {nodes.map(n => {
        const p = pos.get(n.id), s = styles.get(n.id);
        if (n.kind === 'person') return <circle key={n.id} cx={p.x} cy={p.y} r={Math.max(3.5, s.r * .85)} fill={s.fill} className="mini-n" />;
        return n.kind === 'sw'
          ? <rect key={n.id} x={p.x - 7} y={p.y - 7} width="14" height="14" rx="2" className="mini-svc" />
          : <path key={n.id} d={diamond(p.x, p.y, 9)} className="mini-svc clinic" />;
      })}
    </svg>
  );
}
