// Streamgraph і складена площа з тих самих даних. Потік: шари навколо змінної осі (зсув «wiggle» Байрона й
// Ваттенберга, порядок «зсередини назовні»), щоб хвилі були плавними. Складена площа: звичайна вісь від нуля
// для точного порівняння. Наведення виділяє шар рубіновим контуром і приглушує решту.
import { useMemo, useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, Frame, Legend, fit, textW, monthTicks } from './kit.jsx';
import { SERIES, OTHER, EMPH, INK, SURFACE, GRID, BASE } from '../palette.js';
import { ymd, dayOf } from '../format.js';

// гладка крива через точки (Катмулл-Ром у кубічні Безьє)
function smooth(pts, move = true) {
  let d = (move ? 'M' : 'L') + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function stack(m, stream) {
  const n = m.names.length, K = m.days.length, sums = m.val.map(r => r.reduce((a, b) => a + b, 0));
  let order;
  if (stream) {
    // зсередини назовні: за моментом піку, по черзі вгору й униз, щоб суми зверху і знизу були близькі
    const peak = m.val.map(r => r.indexOf(Math.max(...r)));
    const byPeak = m.names.map((_, i) => i).sort((a, b) => peak[a] - peak[b]);
    let top = 0, bot = 0; const tops = [], bots = [];
    byPeak.forEach(i => { if (top < bot) { top += sums[i]; tops.push(i); } else { bot += sums[i]; bots.push(i); } });
    order = bots.reverse().concat(tops);
  } else order = m.names.map((_, i) => i).sort((a, b) => (m.otherLast && a === n - 1 ? 1 : m.otherLast && b === n - 1 ? -1 : sums[b] - sums[a]));
  const base = new Array(K).fill(0);
  if (stream) {
    let y = 0;
    for (let j = 1; j < K; j++) {
      let s1 = 0, s2 = 0;
      order.forEach((si, i) => {
        const a = m.val[si][j], b = m.val[si][j - 1];
        let s3 = (a - b) / 2;
        for (let k = 0; k < i; k++) s3 += m.val[order[k]][j] - m.val[order[k]][j - 1];
        s1 += a; s2 += s3 * a;
      });
      if (s1) y -= s2 / s1;
      base[j] = y;
    }
    const tot = Array.from({ length: K }, (_, j) => order.reduce((s, si) => s + m.val[si][j], 0));
    const mid = base.reduce((s, b, j) => s + b + tot[j] / 2, 0) / K;
    for (let j = 0; j < K; j++) base[j] -= mid;
  }
  const lo = m.names.map(() => new Array(K)), hi = m.names.map(() => new Array(K));
  for (let j = 0; j < K; j++) { let acc = base[j]; order.forEach(si => { lo[si][j] = acc; acc += m.val[si][j]; hi[si][j] = acc; }); }
  return { order, lo, hi };
}

export function Stream({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hs, setHs] = useState(null);
  const [hk, setHk] = useState(null);
  const stream = mini || (opts.view || 'stream') === 'stream';
  const st = useMemo(() => stack(m, stream), [m, stream]);
  const K = m.days.length, color = i => (m.otherLast && i === m.names.length - 1 ? OTHER : SERIES[i]);
  const H = mini ? 118 : 360, Tp = mini ? 4 : 20, B = mini ? 4 : 34, L = mini ? 2 : stream ? 12 : 52, R = mini ? 2 : 12;
  const ylo = Math.min(...st.lo.flat()), yhi = Math.max(...st.hi.flat()), ypad = stream ? (yhi - ylo) * 0.05 : 0;
  const ymin = ylo - ypad, ymax = yhi + ypad;
  const sc = niceScale(stream ? ymin : 0, ymax, 5);
  const x = scale(m.days[0], m.days[K - 1], L, W - R), y = stream ? scale(ymin, ymax, H - B, Tp) : scale(sc.lo, sc.hi, H - B, Tp);
  const paths = m.names.map((_, i) => {
    const up = m.days.map((d, j) => [x(d), y(st.hi[i][j])]), dn = m.days.map((d, j) => [x(d), y(st.lo[i][j])]).reverse();
    return smooth(up) + smooth(dn, false) + 'Z';
  });
  const tot = j => m.val.reduce((s, r) => s + r[j], 0);
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let j = 0, bd = Infinity; m.days.forEach((d, k) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; j = k; } });
    let s = null; st.order.forEach(i => { if (py <= y(st.lo[i][j]) && py >= y(st.hi[i][j])) s = i; });
    setHk(j); setHs(s);
    const rows = s == null ? st.order.slice().reverse().map(i => ({ value: f.num(m.val[i][j]), label: m.names[i], color: color(i) }))
      : [{ value: f.num(m.val[s][j]), label: m.names[s], color: color(s) }, { value: f.pct(m.val[s][j] / (tot(j) || 1), 1), label: T.ui.shareOfDate }, { value: f.num(tot(j)), label: T.ui.total }];
    setTip({ x: x(m.days[j]), y: s == null ? Tp : y(st.hi[s][j]) - 10, title: f.date(m.days[j]), rows });
  };
  // підписи всередині шарів у місці найбільшої товщини
  const labels = mini ? [] : m.names.map((nm, i) => {
    let bj = 0, bt = 0; m.days.forEach((d, j) => { const t = y(st.lo[i][j]) - y(st.hi[i][j]); if (t > bt) { bt = t; bj = j; } });
    const w = textW(nm, 11.5), xx = Math.max(L + w / 2 + 4, Math.min(W - R - w / 2 - 4, x(m.days[bj])));
    return bt >= 18 ? { i, x: xx, y: (y(st.lo[i][bj]) + y(st.hi[i][bj])) / 2 + 4, t: fit(nm, 160, 11.5) } : null;
  }).filter(Boolean);
  const ticks = monthTicks(m.days[0], m.days[K - 1], W - L - R, ymd, dayOf);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHs(null); setHk(null); }}
      legend={<Legend items={m.names.map((nm, i) => ({ label: nm, color: color(i) }))} />}>
      {!mini && !stream && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, sc.hi)}</Txt></g>)}
      {!mini && ticks.map((t, k) => <g key={t.day}><VLine x={x(t.day)} y1={stream ? Tp : H - B} y2={H - B + 4} color={stream ? GRID : BASE} /><Txt x={x(t.day)} y={H - B + 17} anchor="middle">{f.monthIdx(t.m - 1)}{t.m === 1 || k === 0 ? ' ' + t.y : ''}</Txt></g>)}
      {st.order.map(i => <path key={i} d={paths[i]} fill={color(i)} fillOpacity={hs == null ? 0.9 : hs === i ? 1 : 0.28} stroke={hs === i ? EMPH : SURFACE} strokeWidth={hs === i ? 2 : mini ? 0.5 : 1} />)}
      {hs != null && <path d={paths[hs]} fill="none" stroke={EMPH} strokeWidth="2" style={{ pointerEvents: 'none' }} />}
      {labels.map(l => <Txt key={l.i} x={l.x} y={l.y} anchor="middle" size={11.5} weight={600} color={INK.primary} stroke={SURFACE} strokeWidth="3" paintOrder="stroke" opacity={hs == null || hs === l.i ? 1 : 0.35} style={{ pointerEvents: 'none' }}>{l.t}</Txt>)}
      {hk != null && <VLine x={x(m.days[hk])} y1={Tp} y2={H - B} color="rgba(255,255,255,.45)" />}
      {!mini && stream && <Txt x={W - R} y={H - 2} anchor="end" size={10.5} color={INK.faint}>{T.ui.streamNote}</Txt>}
      {!mini && <rect x={L} y={Tp} width={Math.max(0, W - L - R)} height={H - B - Tp} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}
