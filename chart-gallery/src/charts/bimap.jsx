// Біваріантна карта України: справжні межі 27 регіонів (Natural Earth, рівновелика проєкція), два показники
// одночасно через сітку кольорів 3 × 3 (терцилі кожного показника). Масштабування кнопками, Ctrl і коліщатком,
// подвійним клацанням; перетягування при наближенні; клацання регіону наближає до нього.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { useWidth, useTip, Txt, Frame, fit } from './kit.jsx';
import { UA_REGIONS, UA_BORDER, UA_W, UA_H } from '../ukraine-geo.js';
import { regionById } from '../geo.js';
import { BIVAR, INK, SURFACE, GRID, EMPH } from '../palette.js';

const CLS_X = BIVAR[0], CLS_Y = BIVAR.map(r => r[0]);

export function BiMap({ m, f, T, mini, lang, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hv, setHv] = useState(null);
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 });
  const [zid, setZid] = useState(null);
  const drag = useRef(null), zr = useRef(z);
  zr.current = z;
  const view = mini ? 'bi' : opts.view || 'bi';
  const narrow = !mini && W < 600;
  const s0 = mini ? Math.min(W / UA_W, 116 / UA_H) : W / UA_W, mapH = Math.round(UA_H * s0);
  const H = mini ? 118 : mapH + (narrow ? 150 : 0) + 22;
  const ox = mini ? (W - UA_W * s0) / 2 : 0;
  const clampZ = (k, x, y) => { k = Math.max(1, Math.min(8, k)); const minX = W - UA_W * s0 * k - ox * 2, minY = mapH - UA_H * s0 * k; return { k, x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) }; };
  const zoomAt = (fct, px, py) => setZ(o => { const k = Math.max(1, Math.min(8, o.k * fct)), r = k / o.k; return clampZ(k, px - (px - o.x) * r, py - (py - o.y) * r); });
  const zoomTo = id => {
    const rg = UA_REGIONS.find(r => r.id === id), [a, b, c, d] = rg.box, bw = (c - a) * s0, bh = (d - b) * s0;
    const k = Math.max(1, Math.min(6, 0.7 * Math.min(W / bw, mapH / bh)));
    setZ(clampZ(k, W / 2 - ((a + c) / 2) * s0 * k, mapH / 2 - ((b + d) / 2) * s0 * k)); setZid(id);
  };
  const reset = () => { setZ({ k: 1, x: 0, y: 0 }); setZid(null); };
  useEffect(() => {
    const svg = ref.current && ref.current.querySelector('svg');
    if (!svg || mini) return;
    const wheel = e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [mini, W]);
  useEffect(() => { setZ({ k: 1, x: 0, y: 0 }); setZid(null); }, [W, m]);
  const fill = v => {
    if (!v) return null;
    if (view === 'x') return v.cx == null ? null : CLS_X[v.cx];
    if (view === 'y') return v.cy == null ? null : CLS_Y[v.cy];
    return v.cx == null || v.cy == null ? null : BIVAR[v.cy][v.cx];
  };
  const word = c => T.ui.biWord[c];
  const nameOf = id => { const r = regionById[id]; return lang === 'en' ? r[2] : r[1]; };
  const show = (id, e) => {
    if (drag.current && drag.current.moved) return;
    const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(), v = m.vals.get(id);
    setHv(id);
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top - 14, title: nameOf(id), rows: v ? [
      { value: v.x == null ? T.ui.noData : f.num(v.x), label: m.xName + (v.cx == null ? '' : ' · ' + word(v.cx)), color: v.cx == null ? null : CLS_X[v.cx] },
      { value: v.y == null ? T.ui.noData : f.num(v.y), label: m.yName + (v.cy == null ? '' : ' · ' + word(v.cy)), color: v.cy == null ? null : CLS_Y[v.cy] },
    ] : [{ value: T.ui.noData, label: '' }], note: v && v.cx != null && v.cy != null && view === 'bi' ? T.ui.biCell(word(v.cx), word(v.cy)) : null });
  };
  const down = e => { if (mini) return; drag.current = { x: e.clientX, y: e.clientY, z: zr.current, moved: false }; };
  const move = e => {
    const d = drag.current; if (!d || !(e.buttons & 1)) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true; setTip(null);
    setZ(clampZ(d.z.k, d.z.x + dx, d.z.y + dy));
  };
  const up = () => { setTimeout(() => { drag.current = null; }, 0); };
  const sk = s0 * z.k, labels = !mini && sk >= 1.05;
  // легенда: сітка 3 × 3 або три класи одного показника
  const LX = narrow ? 34 : 26, LY = narrow ? mapH + 26 : mapH - 168;
  const fmtBr = b => [`≤ ${f.num(b[0])}`, T.ui.fromTo(f.num(b[0]), f.num(b[1])), `> ${f.num(b[1])}`];
  const legend = mini ? null : view === 'bi' ? (
    <g transform={`translate(${LX},${LY})`}>
      <rect x={-30} y={-12} width={Math.min(W - LX + 18, 240)} height={116} rx={6} fill={SURFACE} fillOpacity={z.k > 1 ? 0.88 : 0} />
      {[0, 1, 2].map(cy => [0, 1, 2].map(cx => <rect key={cx + '-' + cy} x={cx * 19} y={(2 - cy) * 19} width="17" height="17" rx="2" fill={BIVAR[cy][cx]} stroke={hv && m.vals.get(hv) && m.vals.get(hv).cx === cx && m.vals.get(hv).cy === cy ? EMPH : 'none'} strokeWidth="2" />))}
      <path d="M0,62h57" stroke={INK.muted} strokeWidth="1.2" markerEnd="url(#cg-bm-arr)" /><path d="M-6,56V-1" stroke={INK.muted} strokeWidth="1.2" markerEnd="url(#cg-bm-arr)" />
      <Txt x={0} y={78} size={10.5} color={INK.secondary}>{fit(m.xName, 190, 10.5)}</Txt>
      <Txt x={-12} y={56} size={10.5} color={INK.secondary} transform="rotate(-90 -12 56)">{fit(m.yName, 120, 10.5)}</Txt>
      <Txt x={0} y={96} size={10.5} color={INK.muted}>{T.ui.corr(f.fixed(m.r, 2))}</Txt>
      <rect x={70} y={0} width="17" height="17" rx="2" fill={GRID} /><rect x={70} y={0} width="17" height="17" rx="2" fill="url(#cg-bm-hatch)" />
      <Txt x={93} y={13} size={10.5} color={INK.muted}>{T.ui.noData}</Txt>
    </g>
  ) : (
    <g transform={`translate(${LX - 8},${LY + 4})`}>
      <rect x={-10} y={-16} width={Math.min(W - LX + 10, 240)} height={112} rx={6} fill={SURFACE} fillOpacity={z.k > 1 ? 0.88 : 0} />
      <Txt x={0} y={0} size={10.5} color={INK.secondary}>{fit(view === 'x' ? m.xName : m.yName, 220, 10.5)}</Txt>
      {fmtBr(view === 'x' ? m.bx : m.by).map((t, k) => <g key={k} transform={`translate(0,${10 + k * 20})`}><rect width="17" height="15" rx="2" fill={(view === 'x' ? CLS_X : CLS_Y)[k]} /><Txt x={24} y={12} size={10.5}>{t}</Txt></g>)}
      <g transform="translate(0,72)"><rect width="17" height="15" rx="2" fill={GRID} /><rect width="17" height="15" rx="2" fill="url(#cg-bm-hatch)" /><Txt x={24} y={12} size={10.5}>{T.ui.noData}</Txt></g>
    </g>
  );
  return (
    <Frame refEl={ref} w={W} h={H} label={m.xName + ' / ' + m.yName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHv(null); }}
      svgProps={mini ? {} : { onPointerDown: down, onPointerMove: move, onPointerUp: up, onDoubleClick: e => { const r = e.currentTarget.getBoundingClientRect(); zoomAt(1.6, e.clientX - r.left, e.clientY - r.top); }, style: { cursor: z.k > 1 ? 'grab' : 'default', touchAction: z.k > 1 ? 'none' : 'pan-y' } }}
      legend={!mini && <div className="cg-zoom" role="group" aria-label={T.ui.zoom}>
        <button type="button" onClick={() => zoomAt(1.5, W / 2, mapH / 2)} aria-label={T.ui.zoomIn} title={T.ui.zoomIn}><Icon name="plus" size={15} /></button>
        <button type="button" onClick={() => zoomAt(1 / 1.5, W / 2, mapH / 2)} aria-label={T.ui.zoomOutMap} title={T.ui.zoomOutMap}><Icon name="minus" size={15} /></button>
        <button type="button" onClick={reset} aria-label={T.ui.zoomReset} title={T.ui.zoomReset} disabled={z.k === 1}><Icon name="reset" size={14} /></button>
      </div>}>
      <defs>
        <pattern id="cg-bm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#5B6779" strokeWidth="1.4" /></pattern>
        <marker id="cg-bm-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L8,4L0,8z" fill={INK.muted} /></marker>
        <clipPath id="cg-bm-clip"><rect x="0" y="0" width={W} height={mini ? H : mapH} /></clipPath>
      </defs>
      <g clipPath="url(#cg-bm-clip)">
        <g transform={`translate(${ox + z.x},${z.y}) scale(${sk})`}>
          {UA_REGIONS.map(rg => {
            const v = m.vals.get(rg.id), c = fill(v);
            return (
              <g key={rg.id}>
                <path d={rg.d} fill={c || GRID} stroke={SURFACE} strokeWidth={mini ? 0.6 : 1} vectorEffect="non-scaling-stroke" strokeLinejoin="round"
                  onPointerMove={mini ? undefined : e => show(rg.id, e)} onClick={mini ? undefined : () => { if (drag.current && drag.current.moved) return; if (zid === rg.id && z.k > 1) reset(); else zoomTo(rg.id); }} style={{ cursor: mini ? undefined : 'pointer' }} />
                {!c && <path d={rg.d} fill="url(#cg-bm-hatch)" style={{ pointerEvents: 'none' }} />}
              </g>
            );
          })}
          <path d={UA_BORDER} fill="none" stroke={INK.muted} strokeWidth={mini ? 0.6 : 1.1} vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
          {hv && <path d={UA_REGIONS.find(r => r.id === hv).d} fill="none" stroke={INK.primary} strokeWidth="2.2" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />}
          {labels && UA_REGIONS.map(rg => (rg.id !== 'kyc' || sk > 2.2) && <Txt key={rg.id} x={rg.lx} y={rg.ly} anchor="middle" size={10 / sk} color={INK.primary} stroke={SURFACE} strokeWidth={3 / sk} paintOrder="stroke" style={{ pointerEvents: 'none' }}>{(() => { const r = regionById[rg.id]; return lang === 'en' ? r[7] : r[6]; })()}</Txt>)}
        </g>
      </g>
      {legend}
      {!mini && <Txt x={W} y={H - 4} anchor="end" size={10.5} color={INK.faint}>{fit(T.ui.mapHint, W, 10.5)}</Txt>}
    </Frame>
  );
}
