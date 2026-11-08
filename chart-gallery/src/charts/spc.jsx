// Контрольна карта процесу (XmR): центральна лінія і межі ±3σ з базового періоду, зони 1σ і 2σ,
// сигнали за правилами Western Electric рубіновими ромбами з номером правила. Під картою ковзний розмах (за бажання).
import { useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, Frame, Legend, wrap, monthTicks, Marker } from './kit.jsx';
import { SERIES, INK, GRID, BASE, EMPH, SURFACE } from '../palette.js';
import { ymd, dayOf } from '../format.js';

const P = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');

export function Control({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(null);
  const n = m.x.length, showMr = !mini && opts.mr === 'on';
  const notes = mini ? [] : m.rules.length ? m.rules.flatMap(r => wrap(T.ui.spcRule[r.r] + ': ' + T.ui.spcPoints(r.n), W - 30, 11.5, 2).map((l, k) => ({ l, r: k ? null : r.r }))) : [{ l: T.ui.spcStable, r: null }];
  // дужки серій над графіком: кожна в окремому ярусі, якщо перетинаються
  const tiers = [];
  const runs = mini ? [] : m.runs.map(r => { let t = 0; while ((tiers[t] || []).some(q => !(r.b < q.a - 1 || r.a > q.b + 1))) t++; (tiers[t] = tiers[t] || []).push(r); return { ...r, t }; });
  const xH = mini ? 118 : 300 + tiers.length * 14, mrH = showMr ? 120 : 0, noteH = notes.length * 17 + (mini ? 0 : 14);
  const H = xH + mrH + noteH, Tp = mini ? 6 : 18 + tiers.length * 14, L = mini ? 4 : 54, R = mini ? 4 : 74, B = mini ? 4 : 34;
  const lo = Math.min(...m.x, m.lcl), hi = Math.max(...m.x, m.ucl);
  const sc = niceScale(lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.05, 5, false);
  const x = scale(m.days[0], m.days[n - 1], L, W - R), y = scale(sc.lo, sc.hi, xH - B, Tp);
  const ticks = monthTicks(m.days[0], m.days[n - 1], W - L - R, ymd, dayOf);
  const lines = [[m.ucl, 'UCL', true], [m.cl, 'CL', false], [m.lcl, 'LCL', true]];
  const zones = [1, 2].flatMap(k => [m.cl + k * m.sd, m.cl - k * m.sd]).filter(v => v > sc.lo && v < sc.hi && v > m.lcl - 1e-9);
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), px = e.clientX - r.left;
    let k = 0, bd = Infinity; m.days.forEach((d, i) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; k = i; } });
    setHk(k);
    setTip({ x: x(m.days[k]), y: y(m.x[k]) - 12, title: f.date(m.days[k]), rows: [
      { value: f.num(m.x[k]), label: m.valueName, color: m.sig[k].length ? EMPH : SERIES[0], dot: true },
      ...(k ? [{ value: f.num(m.mr[k - 1]), label: T.ui.mrShort }] : []),
    ], note: m.sig[k].length ? m.sig[k].map(r => T.ui.spcRule[r]).join('. ') + '.' : null });
  };
  // ковзний розмах
  let mrPart = null;
  if (showMr) {
    const top = xH + 18, bot = xH + mrH - 22, ms = niceScale(0, Math.max(m.mrUcl, ...m.mr), 3);
    const yy = scale(0, ms.hi, bot, top);
    mrPart = <g>
      <Txt x={L} y={xH + 8} size={11} color={INK.secondary}>{T.ui.mr}</Txt>
      {ms.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={yy(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={yy(v) + 4} anchor="end">{f.axis(v, ms.hi)}</Txt></g>)}
      <line x1={L} x2={W - R} y1={yy(m.mrBar)} y2={yy(m.mrBar)} stroke={INK.muted} strokeWidth="1.2" />
      <line x1={L} x2={W - R} y1={yy(m.mrUcl)} y2={yy(m.mrUcl)} stroke={INK.secondary} strokeWidth="1.2" strokeDasharray="5 4" />
      <Txt x={W - R + 6} y={yy(m.mrBar) + 4} size={10.5}>mR̄ {f.num(m.mrBar)}</Txt>
      <Txt x={W - R + 6} y={yy(m.mrUcl) + 4} size={10.5}>UCL {f.num(m.mrUcl)}</Txt>
      <path d={P(m.mr.map((v, i) => [x(m.days[i + 1]), yy(v)]))} fill="none" stroke={SERIES[0]} strokeWidth="1.5" strokeLinejoin="round" />
      {m.mr.map((v, i) => v > m.mrUcl && <Marker key={i} shape="diamond" x={x(m.days[i + 1])} y={yy(v)} r={4} fill={EMPH} />)}
    </g>;
  }
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(null); }}
      legend={!mini && <Legend items={[{ label: m.valueName, color: SERIES[0], kind: 'line' }, { label: T.ui.signal, color: EMPH, kind: 'dot', shape: 'diamond' }, { label: T.ui.limits, color: INK.secondary, kind: 'line' }]} />}>
      {!mini && <rect x={L} y={Tp} width={Math.max(0, x(m.days[m.nb - 1]) - L)} height={xH - B - Tp} fill="rgba(255,255,255,.03)" />}
      {!mini && <Txt x={L + 4} y={Tp + 12} size={10.5} color={INK.faint}>{T.ui.baseline(m.nb)}</Txt>}
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, Math.max(Math.abs(sc.lo), Math.abs(sc.hi)))}</Txt></g>)}
      {!mini && ticks.map((t, k) => <g key={t.day}><VLine x={x(t.day)} y1={xH - B} y2={xH - B + 4} color={BASE} /><Txt x={x(t.day)} y={xH - B + 17} anchor="middle">{f.monthIdx(t.m - 1)}{t.m === 1 || k === 0 ? ' ' + t.y : ''}</Txt></g>)}
      {zones.map((v, k) => <line key={k} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#2B3546" strokeWidth="1" strokeDasharray="2 4" />)}
      {lines.map(([v, lab, dash]) => <g key={lab}>
        <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={dash ? INK.secondary : INK.muted} strokeWidth={mini ? 1 : 1.3} strokeDasharray={dash ? '6 4' : undefined} />
        {!mini && <Txt x={W - R + 6} y={y(v) + 4} size={10.5} color={INK.secondary}>{lab} {f.num(v)}</Txt>}
      </g>)}
      <path d={P(m.days.map((d, i) => [x(d), y(m.x[i])]))} fill="none" stroke={SERIES[0]} strokeWidth={mini ? 1.2 : 1.5} strokeLinejoin="round" opacity=".85" />
      {m.days.map((d, i) => m.sig[i].length
        ? <g key={i}><Marker shape="diamond" x={x(d)} y={y(m.x[i])} r={mini ? 3 : hk === i ? 6 : 5} fill={EMPH} />{!mini && m.sig[i].includes(1) && <Txt x={x(d)} y={y(m.x[i]) - 10} anchor="middle" size={10} weight={600} color={INK.primary} stroke={SURFACE} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>1</Txt>}</g>
        : !mini && <circle key={i} cx={x(d)} cy={y(m.x[i])} r={hk === i ? 5 : 3} fill={SERIES[0]} stroke={SURFACE} strokeWidth="1.5" />)}
      {runs.map((r, k) => { const yy = 12 + r.t * 14, xa = x(m.days[r.a]), xb = x(m.days[r.b]), xm = (xa + xb) / 2; return <g key={'run' + k} style={{ pointerEvents: 'none' }}>
        <path d={`M${xa},${yy + 4}V${yy}H${xb}V${yy + 4}`} fill="none" stroke={EMPH} strokeWidth="1.5" />
        <path d={`M${xm - 6},${yy}l6,-6l6,6l-6,6z`} fill={EMPH} stroke={SURFACE} strokeWidth="1.5" /><Txt x={xm} y={yy + 3} anchor="middle" size={8.5} weight={700} color="#fff">{r.r}</Txt>
      </g>; })}
      {hk != null && <VLine x={x(m.days[hk])} y1={Tp} y2={xH - B} color="rgba(255,255,255,.3)" />}
      {mrPart}
      {notes.map((it, k) => <g key={k}>
        {it.r && <g><path d={`M${4},${xH + mrH + 14 + k * 17 - 4}l5,-5l5,5l-5,5z`} fill={EMPH} /><Txt x={9} y={xH + mrH + 14 + k * 17 - 1} anchor="middle" size={8} weight={700} color="#fff">{it.r}</Txt></g>}
        <Txt x={22} y={xH + mrH + 14 + k * 17} size={11.5} color={it.r ? INK.secondary : INK.muted}>{it.l}</Txt>
      </g>)}
      {!mini && <rect x={L} y={Tp} width={Math.max(0, W - L - R)} height={xH - B - Tp} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}
