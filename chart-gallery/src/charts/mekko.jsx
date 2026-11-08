// Мерімекко: ширина стовпчика дорівнює частці категорії в загальній сумі, висота сегмента частці серії всередині
// категорії. Площа прямокутника пропорційна значенню, тому видно і масштаб, і структуру одночасно.
import { useState } from 'react';
import { useWidth, useTip, Txt, HLine, Frame, Legend, wrap, textW } from './kit.jsx';
import { SERIES, OTHER, EMPH, INK, GRID, BASE, inkOn } from '../palette.js';

export function Mekko({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hs, setHs] = useState(null);
  const C = m.cats.length, S = m.series.length;
  const color = s => (m.otherS && s === S - 1 ? OTHER : SERIES[s]);
  const L = mini ? 2 : 44, R = mini ? 2 : 6, Tp = mini ? 2 : 26, gap = mini ? 1.5 : 2;
  const inner = W - L - R - gap * (C - 1);
  const widths = m.tot.map(t => (t / m.total) * inner);
  const labels = m.cats.map((c, a) => (mini ? [] : wrap(c, Math.max(30, widths[a] - 4), 10.5, 3)));
  const B = mini ? 2 : 14 + Math.max(...labels.map(l => l.length)) * 12.5;
  const H = mini ? 118 : 360 + B - 30, ph = H - Tp - B;
  let x = L;
  const cols = m.cats.map((c, a) => { const o = { a, x, w: widths[a] }; x += widths[a] + gap; return o; });
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHs(null); }}
      legend={<Legend items={m.series.map((s, k) => ({ label: s, color: color(k) }))} />}>
      {!mini && [0, 0.25, 0.5, 0.75, 1].map(v => <g key={v}><HLine x1={L} x2={W - R} y={Tp + ph * (1 - v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 6} y={Tp + ph * (1 - v) + 4} anchor="end">{f.pct(v)}</Txt></g>)}
      {cols.map(({ a, x: x0, w }) => {
        let acc = 0;
        return (
          <g key={a}>
            {m.series.map((s, k) => {
              const v = m.v[a][k]; if (!(v > 0)) return null;
              const sh = v / m.tot[a], h = sh * ph, y0 = Tp + ph * (1 - acc - sh); acc += sh;
              const fill = color(k), lab = f.pct(sh);
              const show = () => { setHs(a + ':' + k); setTip({ x: x0 + w / 2, y: y0 - 4, title: m.cats[a] + ' · ' + s, rows: [{ value: f.num(v), label: m.valueName, color: fill }, { value: f.pct(sh, 1), label: T.ui.inCat }, { value: f.pct(v / m.total, 1), label: T.ui.ofTotal }] }); };
              return <g key={k}>
                <rect x={x0} y={y0 + (acc < 0.999 ? 1 : 0)} width={Math.max(0, w)} height={Math.max(0, h - (acc < 0.999 ? 1 : 0))} rx={mini ? 0.5 : 2} fill={fill} fillOpacity={hs == null || hs === a + ':' + k ? 1 : 0.55}
                  stroke={hs === a + ':' + k ? EMPH : 'none'} strokeWidth="2" tabIndex={mini ? undefined : 0} onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => { setTip(null); setHs(null); }} />
                {!mini && w >= textW(lab, 10.5) + 8 && h >= 16 && <Txt x={x0 + w / 2} y={y0 + h / 2 + 4} anchor="middle" size={10.5} weight={600} color={inkOn(fill)} style={{ pointerEvents: 'none' }}>{lab}</Txt>}
              </g>;
            })}
            {!mini && w >= 30 && <Txt x={x0 + w / 2} y={Tp - 8} anchor="middle" size={10.5} color={INK.secondary}>{f.pct(m.tot[a] / m.total)}</Txt>}
            {!mini && labels[a].map((l, j) => <Txt key={j} x={x0 + w / 2} y={Tp + ph + 15 + j * 12.5} anchor="middle" size={10.5} color={INK.secondary}>{l}</Txt>)}
          </g>
        );
      })}
    </Frame>
  );
}
