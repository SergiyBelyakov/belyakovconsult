// Розподіл: гістограма з медіаною й середнім, коробковий графік з викидами й точками.
import { useMemo } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, colPath, Frame, Legend, fit, textW } from './kit.jsx';
import { rng } from '../../../anomaly-demo/src/stats.js';
import { SERIES, OTHER, INK, SURFACE, GRID, BASE, SEQ, DIM } from '../palette.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });

export function Histogram({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const k = m.counts.length, H = mini ? 118 : 330;
  const L = mini ? 4 : 48, R = mini ? 4 : 14, Tp = mini ? 8 : 34, B = mini ? 4 : 40;
  const ys = niceScale(0, Math.max(...m.counts), 5), xs = niceScale(m.lo, m.hi, 6, false);
  const x = scale(m.lo, m.lo + m.step * k, L, W - R), y = scale(0, ys.hi, H - B, Tp);
  const bw = (W - L - R) / k;
  const marks = [[m.median, T.ui.median, INK.primary], [m.mean, T.ui.mean, INK.muted]];
  const close = Math.abs(x(m.median) - x(m.mean)) < 90;
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && ys.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, ys.hi)}</Txt></g>)}
      {!mini && xs.ticks.filter(v => v >= m.lo && v <= m.lo + m.step * k).map(v => <g key={v}><VLine x={x(v)} y1={H - B} y2={H - B + 4} color={BASE} /><Txt x={x(v)} y={H - B + 17} anchor="middle">{f.axis(v, xs.hi)}</Txt></g>)}
      {m.counts.map((c, i) => {
        const x0 = x(m.lo + i * m.step);
        const show = () => setTip(tipAt(x0 + bw / 2, y(c) - 8, T.ui.fromTo(f.num(m.lo + i * m.step), f.num(m.lo + (i + 1) * m.step)), [{ value: f.num(c), label: T.ui.records, color: SERIES[0] }, { value: f.pct(c / m.n, 1), label: T.ui.share }]));
        return <g key={i}>
          <path d={colPath(x0 + 1, Math.max(1, bw - 2), y(0), y(c), mini ? 1.5 : 3)} fill={SERIES[0]} />
          {!mini && <rect x={x0} y={Tp} width={bw} height={H - B - Tp} fill="transparent" onPointerMove={show} />}
        </g>;
      })}
      {!mini && marks.map(([v, lab, col], j) => (
        <g key={j} style={{ pointerEvents: 'none' }}>
          <VLine x={x(v)} y1={Tp - (close && j ? 4 : 18) + 6} y2={H - B} color={col} w={1.5} />
          <Txt x={x(v) + (x(v) > W - 150 ? -6 : 6)} y={close && j ? Tp - 2 : Tp - 16} anchor={x(v) > W - 150 ? 'end' : 'start'} size={11} color={col}>{lab}: {f.num(v)}</Txt>
        </g>
      ))}
    </Frame>
  );
}

export function Box({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const boxes = mini ? m.boxes.slice(0, 6) : m.boxes, n = boxes.length;
  const row = mini ? 18 : 46, bh = mini ? 9 : 20;
  const labW = mini ? 0 : Math.min(W * 0.3, Math.max(...boxes.map(b => textW(b.label, 12))) + 14);
  const Tp = mini ? 4 : 8, B = mini ? 4 : 28, H = Tp + n * row + B, R = mini ? 4 : 16;
  const lo = Math.min(...boxes.map(b => Math.min(b.wl, ...b.out))), hi = Math.max(...boxes.map(b => Math.max(b.wh, ...b.out)));
  const sc = niceScale(lo, hi, 6, lo >= 0 && lo < hi * 0.3);
  const x = scale(sc.lo, sc.hi, labW + 6, W - R);
  const jit = useMemo(() => { const r = rng(7); return boxes.map(b => b.pts.map(() => r() - 0.5)); }, [m]);
  const pts = !mini && opts.points === 'on';
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && sc.ticks.map(v => <g key={v}><VLine x={x(v)} y1={Tp} y2={H - B + 4} color={GRID} /><Txt x={x(v)} y={H - 8} anchor="middle">{f.axis(v, sc.hi)}</Txt></g>)}
      {boxes.map((b, k) => {
        const yc = Tp + k * row + row / 2;
        const show = () => setTip(tipAt(x(b.med), yc - bh / 2 - 6, b.label, [{ value: f.num(b.med), label: T.ui.median, color: SERIES[0] }, { value: T.ui.fromTo(f.num(b.q1), f.num(b.q3)), label: T.ui.iqr }, { value: T.ui.fromTo(f.num(b.wl), f.num(b.wh)), label: T.ui.whiskers }, { value: f.num(b.out.length), label: T.ui.outliers }, { value: f.num(b.n), label: T.ui.records }]));
        return (
          <g key={k}>
            {!mini && <Txt x={labW - 6} y={yc + 4} anchor="end" color={INK.secondary} size={12}>{fit(b.label, labW - 10, 12)}</Txt>}
            {pts && b.pts.map((v, i) => <circle key={i} cx={x(v)} cy={yc + jit[k][i] * bh * 1.6} r="2" fill={SEQ[5]} fillOpacity=".35" />)}
            <line x1={x(b.wl)} x2={x(b.wh)} y1={yc} y2={yc} stroke={INK.muted} strokeWidth="1.5" />
            <line x1={x(b.wl)} x2={x(b.wl)} y1={yc - bh / 4} y2={yc + bh / 4} stroke={INK.muted} strokeWidth="1.5" />
            <line x1={x(b.wh)} x2={x(b.wh)} y1={yc - bh / 4} y2={yc + bh / 4} stroke={INK.muted} strokeWidth="1.5" />
            <rect x={x(b.q1)} y={yc - bh / 2} width={Math.max(2, x(b.q3) - x(b.q1))} height={bh} rx="3" fill={SERIES[0]} fillOpacity={pts ? 0.35 : 0.55} stroke={SERIES[0]} strokeWidth="1.5" />
            <line x1={x(b.med)} x2={x(b.med)} y1={yc - bh / 2} y2={yc + bh / 2} stroke={INK.primary} strokeWidth="2.5" />
            {!pts && b.out.map((v, i) => <circle key={i} cx={x(v)} cy={yc} r={mini ? 1.8 : 3} fill="none" stroke={INK.muted} strokeWidth="1.5" />)}
            {!mini && <rect x={0} y={yc - row / 2} width={W} height={row} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}
