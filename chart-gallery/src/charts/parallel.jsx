// Паралельні координати: кожен об'єкт це лінія через осі показників. Протягування вздовж осі відбирає діапазон
// (кілька осей поєднуються через «і»), клацання назви осі перевертає її, наведення виділяє об'єкт рубіновим.
import { useMemo, useRef, useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, Frame, Legend, wrap, textW } from './kit.jsx';
import { SERIES, GROUP3, OTHER, EMPH, INK, SURFACE, BASE } from '../palette.js';

const FADE = '#2A3343';
const gCol = (m, g, other) => { if (!m.groups.length) return SERIES[0]; const k = m.groups.indexOf(g); return g === other && k === m.groups.length - 1 && m.groups.length > 3 ? OTHER : GROUP3[k] || OTHER; };

export function Parallel({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [flip, setFlip] = useState({});
  const [br, setBr] = useState({});
  const [hr, setHr] = useState(-1);
  const drag = useRef(null);
  const K = m.axes.length, L = mini ? 6 : 30, R = mini ? 6 : 30;
  const gap = (W - L - R) / (K - 1), titleW = Math.max(46, Math.min(130, gap - 10));
  // вузький екран: над осями номери, назви осей ключем під графіком
  const compact = !mini && gap < 84;
  const titles = m.axes.map((a, j) => (mini ? [] : compact ? [String(j + 1)] : wrap(a.name, titleW, 11, 3)));
  const Tp = mini ? 6 : 22 + Math.max(...titles.map(t => t.length)) * 13;
  const Pb = mini ? 112 : Tp + (compact ? 280 : 282);
  const hint = mini ? [] : wrap(T.ui.pcHint, W - L, 11, 2);
  const key = [];
  if (compact) { let x = 0, row = 0; m.axes.forEach((a, j) => { const t = (j + 1) + ' ' + a.name, w = Math.min(W, textW(t, 11) + 18); if (x + w > W && x > 0) { x = 0; row++; } key.push({ t, x, row }); x += w; }); }
  const keyTop = Pb + 22 + hint.length * 14 + 6, keyRows = key.length ? key[key.length - 1].row + 1 : 0;
  const H = mini ? 118 : compact ? keyTop + keyRows * 16 : Pb + 12 + hint.length * 14 + 10, B = H - Pb;
  const xs = m.axes.map((_, j) => L + j * gap);
  const scs = m.axes.map(a => niceScale(a.min, a.max, 4, false));
  const ys = scs.map((s, j) => (flip[j] ? scale(s.lo, s.hi, Tp, H - B) : scale(s.lo, s.hi, H - B, Tp)));
  const paths = useMemo(() => m.rows.map(r => {
    let d = '', pen = false;
    r.v.forEach((v, j) => { if (!Number.isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + xs[j].toFixed(1) + ',' + ys[j](v).toFixed(1); pen = true; });
    return d;
  }), [m, W, flip, H]);
  const brushed = Object.keys(br).map(Number);
  const sel = m.rows.map(r => brushed.every(j => { const v = r.v[j], [a, b] = br[j]; return Number.isFinite(v) && v >= Math.min(a, b) && v <= Math.max(a, b); }));
  const nSel = sel.filter(Boolean).length;
  const inv = (j, py) => { const s = scs[j], t = (py - Tp) / (H - B - Tp); return flip[j] ? s.lo + t * (s.hi - s.lo) : s.hi - t * (s.hi - s.lo); };
  const svgY = e => e.clientY - e.currentTarget.ownerSVGElement.getBoundingClientRect().top;
  const down = (j, e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const y0 = Math.max(Tp, Math.min(H - B, svgY(e))); drag.current = { j, y0 }; setTip(null); setHr(-1); };
  const move = (j, e) => {
    const d = drag.current; if (!d || d.j !== j) return;
    const y1 = Math.max(Tp, Math.min(H - B, svgY(e)));
    if (Math.abs(y1 - d.y0) >= 3) setBr(b => ({ ...b, [j]: [inv(j, d.y0), inv(j, y1)] }));
  };
  const up = (j, e) => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (Math.abs(Math.max(Tp, Math.min(H - B, svgY(e))) - d.y0) < 3) setBr(b => { const c = { ...b }; delete c[j]; return c; });
  };
  const hover = e => {
    if (drag.current) return;
    const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const j = Math.max(0, Math.min(K - 2, Math.floor((px - L) / gap))), t = (px - xs[j]) / gap;
    let best = -1, bd = 9;
    m.rows.forEach((row, i) => {
      const a = row.v[j], b = row.v[j + 1]; if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      const yy = ys[j](a) + (ys[j + 1](b) - ys[j](a)) * t, dd = Math.abs(yy - py);
      if (dd < bd && (brushed.length === 0 || sel[i])) { bd = dd; best = i; }
    });
    setHr(best);
    if (best < 0) return setTip(null);
    const row = m.rows[best];
    setTip({ x: px, y: py - 14, title: row.label + (row.g ? ' · ' + row.g : ''), rows: m.axes.map((a, k) => ({ value: Number.isFinite(row.v[k]) ? f.num(row.v[k]) : T.ui.na, label: a.name, color: k === 0 ? EMPH : null, dot: true })) });
  };
  const col = i => gCol(m, m.rows[i].g, T.ui.other);
  const order = m.rows.map((_, i) => i).sort((a, b) => (sel[a] === sel[b] ? 0 : sel[a] ? 1 : -1));
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.parallel} tip={tip} mini={mini} onLeave={() => { if (!drag.current) { setTip(null); setHr(-1); } }}
      legend={!mini && m.groups.length > 1 && <Legend kind="line" items={m.groups.map(g => ({ label: g, color: gCol(m, g, T.ui.other) }))} />}>
      {!mini && <rect x={L} y={Tp} width={W - L - R} height={H - B - Tp} fill="transparent" onPointerMove={hover} />}
      <g style={{ pointerEvents: 'none' }}>
        {order.map(i => <path key={i} d={paths[i]} fill="none" stroke={sel[i] ? col(i) : FADE} strokeOpacity={sel[i] ? (brushed.length ? 0.85 : mini ? 0.55 : 0.5) : 0.55} strokeWidth={mini ? 0.9 : sel[i] && brushed.length ? 1.6 : 1.2} />)}
        {hr >= 0 && <path d={paths[hr]} fill="none" stroke={EMPH} strokeWidth="2.6" />}
      </g>
      {m.axes.map((a, j) => (
        <g key={j}>
          <line x1={xs[j]} x2={xs[j]} y1={Tp} y2={Pb} stroke={BASE} strokeWidth="1.5" />
          {!mini && scs[j].ticks.map(v => <g key={v} style={{ pointerEvents: 'none' }}><line x1={xs[j] - 3} x2={xs[j] + 3} y1={ys[j](v)} y2={ys[j](v)} stroke={BASE} /><Txt x={xs[j] + (j === K - 1 ? -6 : 6)} y={ys[j](v) + 3.5} anchor={j === K - 1 ? 'end' : 'start'} size={10} stroke={SURFACE} strokeWidth="3" paintOrder="stroke">{f.axis(v, Math.max(Math.abs(scs[j].lo), Math.abs(scs[j].hi)))}</Txt></g>)}
          {!mini && br[j] && <rect x={xs[j] - 9} y={Math.min(ys[j](br[j][0]), ys[j](br[j][1]))} width="18" height={Math.max(2, Math.abs(ys[j](br[j][0]) - ys[j](br[j][1])))} rx="3" fill="rgba(255,255,255,.14)" stroke={INK.primary} strokeWidth="1.2" style={{ pointerEvents: 'none' }} />}
          {!mini && <rect x={xs[j] - 13} y={Tp - 4} width="26" height={H - B - Tp + 8} fill="transparent" style={{ cursor: 'ns-resize', touchAction: 'none' }}
            onPointerDown={e => down(j, e)} onPointerMove={e => move(j, e)} onPointerUp={e => up(j, e)} />}
          {!mini && <g role="button" tabIndex="0" aria-label={a.name} aria-pressed={!!flip[j]} style={{ cursor: 'pointer' }}
            onClick={() => setFlip(fl => ({ ...fl, [j]: !fl[j] }))} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlip(fl => ({ ...fl, [j]: !fl[j] })); } }}>
            <rect x={xs[j] - titleW / 2} y={2} width={titleW} height={Tp - 8} fill="transparent" />
            {titles[j].map((l, k) => <Txt key={k} x={j === 0 ? xs[j] - 4 : j === K - 1 ? xs[j] + 4 : xs[j]} y={14 + k * 13} anchor={j === 0 ? 'start' : j === K - 1 ? 'end' : 'middle'} size={11} color={INK.secondary} weight={600}>{l}</Txt>)}
            {flip[j] && <Txt x={j === 0 ? xs[j] - 4 : j === K - 1 ? xs[j] + 4 : xs[j]} y={14 + titles[j].length * 13} anchor={j === 0 ? 'start' : j === K - 1 ? 'end' : 'middle'} size={10} color={EMPH}>{'↕ ' + T.ui.flipped}</Txt>}
          </g>}
        </g>
      ))}
      {!mini && <g>
        {brushed.length ? <g>
          <Txt x={L - 4} y={Pb + 24} size={11} color={INK.primary}>{T.ui.picked(nSel, m.rows.length)}</Txt>
          <Txt x={L - 4 + textW(T.ui.picked(nSel, m.rows.length), 11) + 14} y={Pb + 24} size={11} color={SERIES[0]} weight={600} role="button" tabIndex="0" style={{ cursor: 'pointer' }}
            onClick={() => setBr({})} onKeyDown={e => { if (e.key === 'Enter') setBr({}); }}>{T.ui.reset}</Txt>
        </g> : hint.map((l, k) => <Txt key={k} x={L - 4} y={Pb + 24 + k * 14} size={11} color={INK.faint}>{l}</Txt>)}
        {key.map((it, k) => <Txt key={'k' + k} x={it.x} y={keyTop + it.row * 16 + 11} size={11} color={INK.secondary}><tspan fontWeight="600" fill={INK.primary}>{it.t.split(' ')[0]}</tspan>{' ' + it.t.split(' ').slice(1).join(' ')}</Txt>)}
      </g>}
    </Frame>
  );
}
