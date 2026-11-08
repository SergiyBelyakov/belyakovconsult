// Когортна матриця: рядок на когорту (місяць чи тиждень першої події), стовпчик на період після неї.
// Колір за часткою тих, хто повернувся (послідовна шкала без нульового періоду, де завжди 100%).
// Нижній рядок: середнє, зважене на розмір когорт, у яких цей період уже настав.
import { useWidth, useTip, Txt, Frame, fit } from './kit.jsx';
import { INK, GRID, BASE, seq, inkOn } from '../palette.js';

export function Cohort({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const C = m.cohorts.length, count = opts.metric === 'count';
  const share = (c, k) => (m.size[c] ? m.mat[c][k] / m.size[c] : null);
  const vals = []; for (let c = 0; c < C; c++) for (let k = 1; k < C - c; k++) { const v = share(c, k); if (v != null) vals.push(v); }
  const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  const col = v => (v == null ? GRID : seq(hi > lo ? (v - lo) / (hi - lo) : 0.5));
  const labW = mini ? 0 : Math.min(130, Math.max(76, W * 0.17)), sizeW = mini ? 0 : 52;
  const cw = (W - labW - sizeW) / C, ch = mini ? Math.min(9, 104 / (C + 1)) : Math.max(20, Math.min(30, cw * 0.62));
  const narrow = W < 520, Tp = mini ? 2 : 44, gapAvg = mini ? 3 : 8, H = Tp + (C + 1) * ch + gapAvg + (mini ? 2 : narrow ? 44 : 28);
  const showTxt = !mini && cw >= 36;
  const lab = c => (m.per === 'week' ? f.date(m.cohorts[c]) : f.month(m.cohorts[c]));
  const cell = (c, k, v, n, y, avg) => {
    const fill = k === 0 ? '#2C3A50' : col(v), x0 = labW + sizeW + k * cw;
    const show = () => setTip({ x: x0 + cw / 2, y: y - 4, title: (avg ? T.ui.cohortAvg : lab(c)) + ' · ' + T.ui.periodAfter(k, m.per), rows: [
      { value: v == null ? T.ui.noData : f.pct(v, 1), label: T.ui.retained, color: v == null ? null : fill },
      ...(!avg && v != null ? [{ value: f.num(n) + ' ' + T.ui.of + ' ' + f.num(m.size[c]), label: m.idName }] : []),
    ] });
    return (
      <g key={k}>
        <rect x={x0 + 1} y={y + 1} width={Math.max(0, cw - 2)} height={Math.max(0, ch - 2)} rx={mini ? 1 : 2.5} fill={fill} tabIndex={mini ? undefined : 0}
          onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => setTip(null)} />
        {showTxt && v != null && <Txt x={x0 + cw / 2} y={y + ch / 2 + 4} anchor="middle" size={10.5} color={k === 0 ? INK.secondary : inkOn(fill)} style={{ pointerEvents: 'none' }}>{count && !avg ? f.num(n) : f.pct(v)}</Txt>}
      </g>
    );
  };
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.retained} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && <Txt x={labW + sizeW} y={14} size={11} color={INK.secondary}>{T.ui.periodsAfter(m.per)}</Txt>}
      {!mini && Array.from({ length: C }, (_, k) => <Txt key={k} x={labW + sizeW + k * cw + cw / 2} y={Tp - 8} anchor="middle" size={10.5}>{k}</Txt>)}
      {!mini && <Txt x={labW - 8} y={Tp - 8} anchor="end" size={10.5}>{T.ui.cohort}</Txt>}
      {!mini && <Txt x={labW + sizeW - 8} y={Tp - 8} anchor="end" size={10.5}>{T.ui.cohortSize}</Txt>}
      {m.cohorts.map((_, c) => {
        const y = Tp + c * ch;
        return (
          <g key={c}>
            {!mini && <Txt x={labW - 8} y={y + ch / 2 + 4} anchor="end" size={11.5} color={INK.secondary}>{fit(lab(c), labW - 10, 11.5)}</Txt>}
            {!mini && <Txt x={labW + sizeW - 8} y={y + ch / 2 + 4} anchor="end" size={11} color={INK.muted}>{f.num(m.size[c])}</Txt>}
            {Array.from({ length: C - c }, (_, k) => cell(c, k, share(c, k), m.mat[c][k], y, false))}
          </g>
        );
      })}
      {!mini && <line x1={4} x2={W} y1={Tp + C * ch + gapAvg / 2} y2={Tp + C * ch + gapAvg / 2} stroke={BASE} />}
      {!mini && <Txt x={labW - 8} y={Tp + C * ch + gapAvg + ch / 2 + 4} anchor="end" size={11.5} weight={600} color={INK.primary}>{T.ui.cohortAvg}</Txt>}
      {m.avg.map((v, k) => cell(0, k, v, null, Tp + C * ch + gapAvg, true))}
      {!mini && <g transform={`translate(${narrow ? 4 : labW + sizeW},${H - (narrow ? 30 : 14)})`}>
        <Txt x={0} y={9} size={10.5}>{f.pct(lo)}</Txt>
        <defs><linearGradient id="cg-coh-grad">{[0, 0.5, 1].map(s => <stop key={s} offset={s} stopColor={seq(s)} />)}</linearGradient></defs>
        <rect x={34} y={0} width={120} height={10} rx="2" fill="url(#cg-coh-grad)" />
        <Txt x={160} y={9} size={10.5}>{f.pct(hi)}{narrow ? '' : ' · ' + T.ui.retainedNote}</Txt>
        {narrow && <Txt x={0} y={26} size={10.5}>{T.ui.retainedNote}</Txt>}
      </g>}
    </Frame>
  );
}
