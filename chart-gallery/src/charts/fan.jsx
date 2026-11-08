// Прогноз з коридором: факт суцільною лінією, прогноз пунктиром, коридори 80% і 95% з дисперсії помилок моделі.
// Під графіком назва моделі й перевірка на останніх періодах (наскільки модель помилялася б, якби прогнозувала їх).
import { useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, Frame, Legend, wrap, monthTicks, Marker } from './kit.jsx';
import { SERIES, SEQ, INK, GRID, BASE, EMPH } from '../palette.js';
import { ymd, dayOf } from '../format.js';

const P = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');

export function Fan({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(null);
  // у мініатюрі коротша історія, щоб коридор прогнозу було видно
  const s0 = mini ? Math.max(0, m.days.length - 30) : 0, days = m.days.slice(s0), vals = m.vals.slice(s0);
  const n = days.length, lastD = days[n - 1], lastV = vals[n - 1];
  const all = [...days, ...m.fc.map(r => r.day)];
  const notes = mini ? [] : [T.ui.fanModel(m.season, f.fixed(m.phi, 2)), ...(m.check ? [T.ui.fanCheck(m.check.k, m.check.mape != null ? f.pct(m.check.mape, 1) : f.num(m.check.mae), m.check.inside, m.check.mape != null)] : [])].flatMap(s => wrap(s, W - 8, 11.5, 3));
  const H = mini ? 118 : 340 + notes.length * 16, Tp = mini ? 6 : 26, L = mini ? 4 : 54, R = mini ? 4 : 16, B = mini ? 4 : 40 + notes.length * 16;
  const lo = Math.min(...vals, ...m.fc.map(r => r.lo95)), hi = Math.max(...vals, ...m.fc.map(r => r.hi95));
  const zero = lo >= 0 && lo < hi * 0.25, sc = niceScale(zero ? 0 : lo, hi, 5, zero);
  const x = scale(all[0], all[all.length - 1], L, W - R), y = scale(sc.lo, sc.hi, H - B, Tp);
  const fx = m.fc.map(r => x(r.day));
  const band = (a, b) => P([[x(lastD), y(lastV)], ...m.fc.map((r, k) => [fx[k], y(r[a])])]) + 'L' + [...m.fc].reverse().map((r, k) => fx[m.fc.length - 1 - k].toFixed(1) + ',' + y(r[b]).toFixed(1)).join('L') + `L${x(lastD).toFixed(1)},${y(lastV).toFixed(1)}Z`;
  const ticks = monthTicks(all[0], all[all.length - 1], W - L - R, ymd, dayOf);
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), px = e.clientX - r.left;
    let k = 0, bd = Infinity; all.forEach((d, i) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; k = i; } });
    setHk(k);
    if (k < n) return setTip({ x: x(days[k]), y: y(vals[k]) - 12, title: f.date(days[k]), rows: [{ value: f.num(vals[k]), label: T.ui.actual, color: SERIES[0] }] });
    const r2 = m.fc[k - n];
    setTip({ x: x(r2.day), y: y(r2.hi80) - 12, title: f.date(r2.day), rows: [
      { value: f.num(r2.mean), label: T.ui.forecast, color: SEQ[5] },
      { value: T.ui.fromTo(f.num(r2.lo80), f.num(r2.hi80)), label: T.ui.band(80) },
      { value: T.ui.fromTo(f.num(r2.lo95), f.num(r2.hi95)), label: T.ui.band(95) },
    ] });
  };
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(null); }}
      legend={<Legend items={[{ label: T.ui.actual, color: SERIES[0], kind: 'line' }, { label: T.ui.forecast, color: SEQ[5], kind: 'line' }, { label: T.ui.band(80), color: 'rgba(59,130,246,.55)' }, { label: T.ui.band(95), color: 'rgba(59,130,246,.28)' }]} />}>
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, sc.hi)}</Txt></g>)}
      {!mini && ticks.map((t, k) => <g key={t.day}><VLine x={x(t.day)} y1={H - B} y2={H - B + 4} color={BASE} /><Txt x={x(t.day)} y={H - B + 17} anchor="middle">{f.monthIdx(t.m - 1)}{t.m === 1 || k === 0 ? ' ' + t.y : ''}</Txt></g>)}
      <path d={band('lo95', 'hi95')} fill={SERIES[0]} fillOpacity=".16" />
      <path d={band('lo80', 'hi80')} fill={SERIES[0]} fillOpacity=".3" />
      <path d={P(days.map((d, k) => [x(d), y(vals[k])]))} fill="none" stroke={SERIES[0]} strokeWidth={mini ? 1.6 : 2} strokeLinejoin="round" />
      <path d={P([[x(lastD), y(lastV)], ...m.fc.map((r, k) => [fx[k], y(r.mean)])])} fill="none" stroke={SEQ[5]} strokeWidth={mini ? 1.6 : 2} strokeDasharray="5 4" />
      {!mini && <g><VLine x={x(lastD)} y1={Tp - 8} y2={H - B} color="rgba(255,255,255,.28)" /><Txt x={x(lastD) + 6} y={Tp - 10} size={11} color={INK.secondary}>{T.ui.forecast} →</Txt></g>}
      {hk != null && <g>
        <VLine x={x(all[hk])} y1={Tp} y2={H - B} color="rgba(255,255,255,.4)" />
        <Marker x={x(all[hk])} y={y(hk < n ? vals[hk] : m.fc[hk - n].mean)} r={4} fill={hk < n ? SERIES[0] : EMPH} />
      </g>}
      {notes.map((l, k) => <Txt key={k} x={4} y={H - B + 40 + k * 16} size={11.5} color={k ? INK.muted : INK.secondary}>{l}</Txt>)}
      {!mini && <rect x={L} y={Tp} width={Math.max(0, W - L - R)} height={H - B - Tp} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}
