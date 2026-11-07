// Зв'язок: розсіювання (з лінією тренду й логарифмічною віссю), бульбашки, теплова карта.
import { useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, Frame, Legend, fit, textW, Marker } from './kit.jsx';
import { GROUP3, SHAPES, OTHER, INK, SURFACE, GRID, BASE, SEQ, EMPH, seq, inkOn } from '../palette.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });
const gColor = (m, g) => { const k = m.groups.indexOf(g); return k < 0 ? GROUP3[0] : g === m.otherLabel ? OTHER : GROUP3[k] || OTHER; };

function logTicks(lo, hi) {
  const out = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) [1, 2, 5].forEach(k => { const v = k * 10 ** e; if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v); });
  return out;
}

function nearestPt(pts, px, py, max) { let best = -1, bd = max * max; pts.forEach((p, k) => { const d = (p.sx - px) ** 2 + (p.sy - py) ** 2; if (d < bd) { bd = d; best = k; } }); return best; }

export function Scatter({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(-1);
  const H = mini ? 118 : 360, L = mini ? 4 : 52, R = mini ? 4 : 16, Tp = mini ? 6 : 26, B = mini ? 4 : 40;
  const xs = m.pts.map(p => p.x), ys = m.pts.map(p => p.y);
  const ysc = niceScale(Math.min(...ys), Math.max(...ys), 5, false);
  let x, xt;
  if (m.log) { const lo = Math.min(...xs), hi = Math.max(...xs); const a = Math.log10(lo) - 0.05, b = Math.log10(hi) + 0.05; const s = scale(a, b, L, W - R); x = v => s(Math.log10(v)); xt = logTicks(10 ** a, 10 ** b); }
  else { const xsc = niceScale(Math.min(...xs), Math.max(...xs), 6, false); x = scale(xsc.lo, xsc.hi, L, W - R); xt = xsc.ticks; }
  const y = scale(ysc.lo, ysc.hi, H - B, Tp);
  const other = { ...m, otherLabel: T.ui.other };
  const pts = m.pts.map(p => ({ ...p, sx: x(p.x), sy: y(p.y) }));
  const xmax = Math.max(...xt.map(Math.abs));
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), k = nearestPt(pts, e.clientX - r.left, e.clientY - r.top, 24);
    setHk(k);
    if (k < 0) return setTip(null);
    const p = pts[k];
    setTip(tipAt(p.sx, p.sy - 10, p.label || (m.groups.length ? p.g : ''), [{ value: f.num(p.y), label: m.names[1], color: m.groups.length ? gColor(other, p.g) : GROUP3[0], dot: true }, { value: f.num(p.x), label: m.names[0] }, ...(m.groups.length && p.label ? [{ value: p.g, label: '' }] : [])]));
  };
  let trend = null;
  if (m.trend && m.fit && !mini) {
    const X0 = m.log ? Math.log10(Math.min(...xs)) : Math.min(...xs), X1 = m.log ? Math.log10(Math.max(...xs)) : Math.max(...xs);
    const sx = v => (m.log ? x(10 ** v) : x(v));
    trend = { x0: sx(X0), y0: y(m.fit.a + m.fit.b * X0), x1: sx(X1), y1: y(m.fit.a + m.fit.b * X1) };
  }
  return (
    <Frame refEl={ref} w={W} h={H} label={m.names.join(' / ')} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(-1); }}
      legend={m.groups.length > 1 && <Legend kind="dot" items={m.groups.map((g, k) => ({ label: g, color: gColor(other, g), shape: SHAPES[k] }))} />}>
      {!mini && ysc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, ysc.hi)}</Txt></g>)}
      {!mini && xt.map(v => <g key={v}><VLine x={x(v)} y1={Tp} y2={H - B} /><Txt x={x(v)} y={H - B + 17} anchor="middle">{f.axis(v, xmax)}</Txt></g>)}
      {!mini && <Txt x={W - R} y={H - 4} anchor="end" size={11} color={INK.secondary}>{m.names[0]}{m.log ? ' (' + T.ui.logScale + ')' : ''}</Txt>}
      {!mini && <Txt x={L} y={12} size={11} color={INK.secondary}>{m.names[1]}</Txt>}
      {pts.map((p, k) => <Marker key={k} shape={m.groups.length ? SHAPES[Math.max(0, m.groups.indexOf(p.g))] : 'circle'} x={p.sx} y={p.sy} r={mini ? 2.6 : hk === k ? 6 : 4.5} fill={hk === k ? EMPH : m.groups.length ? gColor(other, p.g) : GROUP3[0]} opacity={0.9} />)}
      {trend && <g><line x1={trend.x0} y1={trend.y0} x2={trend.x1} y2={trend.y1} stroke={INK.secondary} strokeWidth="1.5" /><Txt x={trend.x1 - 4} y={trend.y1 - 8} anchor="end" size={11} color={INK.secondary}>r = {f.num(Math.round(m.fit.r * 100) / 100)}</Txt></g>}
      {!mini && <rect x={L - 12} y={Tp - 12} width={W - L - R + 24} height={H - B - Tp + 24} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}

export function Bubble({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(-1);
  const H = mini ? 118 : 380, L = mini ? 6 : 56, R = mini ? 6 : 24, Tp = mini ? 8 : 30, B = mini ? 6 : 42;
  const xs = m.pts.map(p => p.x), ys = m.pts.map(p => p.y), smax = Math.max(...m.pts.map(p => p.s));
  const xsc = niceScale(0, Math.max(...xs), 6), ysc = niceScale(Math.min(...ys), Math.max(...ys), 5, false);
  const x = scale(xsc.lo, xsc.hi, L, W - R), y = scale(ysc.lo, ysc.hi, H - B, Tp);
  const rMax = mini ? 11 : Math.max(16, Math.min(30, W / 24)), rr = s => Math.max(2.5, rMax * Math.sqrt(s / smax));
  const other = { ...m, otherLabel: T.ui.other };
  const pts = m.pts.map(p => ({ ...p, sx: x(p.x), sy: y(p.y), r: rr(p.s) })).sort((a, b) => b.r - a.r);
  const top = new Set([...pts].slice(0, 5).map(p => p.label));
  const col = p => (m.groups.length ? gColor(other, p.g) : GROUP3[0]);
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let k = -1; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; if ((p.sx - px) ** 2 + (p.sy - py) ** 2 <= (p.r + 5) ** 2) { k = i; break; } }
    setHk(k);
    if (k < 0) return setTip(null);
    const p = pts[k];
    setTip(tipAt(p.sx, p.sy - p.r - 6, p.label || p.g, [{ value: f.num(p.s), label: m.names[2], color: col(p), dot: true }, { value: f.num(p.x), label: m.names[0] }, { value: f.num(p.y), label: m.names[1] }, ...(m.groups.length && p.label ? [{ value: p.g, label: '' }] : [])]));
  };
  return (
    <Frame refEl={ref} w={W} h={H} label={m.names.join(' / ')} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(-1); }}
      legend={m.groups.length > 1 && <Legend kind="dot" items={m.groups.map(g => ({ label: g, color: gColor(other, g) }))} />}>
      {!mini && ysc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, ysc.hi)}</Txt></g>)}
      {!mini && xsc.ticks.map(v => <g key={v}><VLine x={x(v)} y1={Tp} y2={H - B} color={v === 0 ? BASE : GRID} /><Txt x={x(v)} y={H - B + 17} anchor="middle">{f.axis(v, xsc.hi)}</Txt></g>)}
      {!mini && <Txt x={W - R} y={H - 4} anchor="end" size={11} color={INK.secondary}>{m.names[0]}</Txt>}
      {!mini && <Txt x={L} y={12} size={11} color={INK.secondary}>{m.names[1]} · {T.ui.sizeIs} {m.names[2]}</Txt>}
      {pts.map((p, k) => <circle key={k} cx={p.sx} cy={p.sy} r={p.r} fill={hk === k ? EMPH : col(p)} fillOpacity={hk === k ? 0.9 : 0.72} stroke={SURFACE} strokeWidth="1.5" />)}
      {!mini && m.hasLabel && pts.filter(p => top.has(p.label)).map((p, k) => { const lab = fit(p.label, 150), left = p.sx + p.r + 5 + textW(lab) > W; return <Txt key={k} x={left ? p.sx - p.r - 5 : p.sx + p.r + 5} anchor={left ? 'end' : 'start'} y={p.sy + 4} size={11} color={INK.secondary} stroke={SURFACE} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{lab}</Txt>; })}
      {!mini && <rect x={0} y={0} width={W} height={H - B + 6} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}

export function Heatmap({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const R = m.rows.length, C = m.cols.length;
  const labW = mini ? 0 : Math.min(W * 0.28, Math.max(...m.rows.map(r => textW(r, 12))) + 12);
  const Tp = mini ? 2 : 24, cw = (W - labW - 2) / C, ch = mini ? Math.min(18, 114 / R) : Math.max(18, Math.min(38, cw * 0.8));
  const H = Tp + R * ch + (mini ? 2 : 40);
  const vals = m.v.flat().filter(v => v != null), lo = Math.min(...vals), hi = Math.max(...vals);
  const t = v => (hi > lo ? (v - lo) / (hi - lo) : 0.5);
  const showVals = !mini && cw >= Math.max(...vals.map(v => textW(f.compact(v), 10.5))) + 6 && ch >= 18;
  const colStep = Math.max(1, Math.ceil(Math.max(...m.cols.map(c => textW(c, 10.5))) / Math.max(1, cw - 4)));
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && m.cols.map((c, j) => j % colStep === 0 && <Txt key={j} x={labW + j * cw + cw / 2} y={Tp - 8} anchor="middle" size={10.5}>{c}</Txt>)}
      {m.rows.map((r, i) => (
        <g key={i}>
          {!mini && <Txt x={labW - 8} y={Tp + i * ch + ch / 2 + 4} anchor="end" color={INK.secondary} size={12}>{fit(r, labW - 10, 12)}</Txt>}
          {m.cols.map((c, j) => {
            const v = m.v[i][j], fill = v == null ? GRID : seq(t(v));
            const show = () => setTip(tipAt(labW + j * cw + cw / 2, Tp + i * ch - 4, r + ' · ' + c, [{ value: v == null ? T.ui.noData : f.num(v), label: m.valueName, color: v == null ? null : fill }]));
            return <g key={j}>
              <rect x={labW + j * cw + 1} y={Tp + i * ch + 1} width={Math.max(0, cw - 2)} height={Math.max(0, ch - 2)} rx={mini ? 1 : 2} fill={fill} tabIndex={mini ? undefined : 0} onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => setTip(null)} />
              {showVals && v != null && <Txt x={labW + j * cw + cw / 2} y={Tp + i * ch + ch / 2 + 4} anchor="middle" size={10.5} color={inkOn(fill)} style={{ pointerEvents: 'none' }}>{f.compact(v)}</Txt>}
            </g>;
          })}
        </g>
      ))}
      {!mini && <g transform={`translate(${labW},${Tp + R * ch + 16})`}>
        <defs><linearGradient id="cg-heat-grad">{[0, 0.25, 0.5, 0.75, 1].map(s => <stop key={s} offset={s} stopColor={seq(s)} />)}</linearGradient></defs>
        <rect x={0} y={0} width={160} height={10} rx="2" fill="url(#cg-heat-grad)" />
        <Txt x={0} y={24} size={10.5}>{f.num(lo)}</Txt>
        <Txt x={160} y={24} size={10.5} anchor="end">{f.num(hi)}</Txt>
        <rect x={180} y={0} width={14} height={10} rx="2" fill={GRID} /><Txt x={200} y={9} size={10.5}>{T.ui.noData}</Txt>
      </g>}
    </Frame>
  );
}
