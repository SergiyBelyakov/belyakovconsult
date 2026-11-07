// Пелюсткова діаграма (з перемиканням на згруповані стовпчики) і таблиця з міні-смугами в клітинках.
import { useMemo, useState } from 'react';
import { useWidth, useTip, niceScale, Txt, Frame, Legend, fit, textW, Marker } from './kit.jsx';
import { Grouped } from './compare.jsx';
import { SERIES, GROUP3, SHAPES, INK, SURFACE, GRID, BASE, SEQ, OTHER, seriesColor } from '../palette.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });
const rc = (m, k) => GROUP3[k] || OTHER;

export function Radar({ m, f, T, mini, opts = {} }) {
  if (!mini && opts.view === 'bars') return <Grouped m={m} f={f} T={T} />;
  return <RadarView m={m} f={f} T={T} mini={mini} />;
}
function RadarView({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [ha, setHa] = useState(null);
  const A = m.cats.length, S = m.series.length;
  const H = mini ? 118 : Math.min(420, Math.max(320, W * 0.62));
  const lab = mini ? 0 : Math.max(...m.cats.map(c => textW(c, 11.5))) * 0.55 + 22;
  const R = Math.max(30, Math.min(W / 2 - lab - 8, H / 2 - (mini ? 6 : 30))), cx = W / 2, cy = H / 2;
  const sc = niceScale(0, Math.max(...m.v.flat()), 4);
  const ang = k => (Math.PI * 2 * k) / A - Math.PI / 2, pt = (k, v) => [cx + Math.cos(ang(k)) * R * (v / sc.hi), cy + Math.sin(ang(k)) * R * (v / sc.hi)];
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHa(null); }}
      legend={S > 1 && <Legend kind="dot" items={m.series.map((s, b) => ({ label: s, color: rc(m, b), shape: SHAPES[b] }))} />}>
      {sc.ticks.slice(1).map(v => <polygon key={v} points={m.cats.map((_, k) => pt(k, v).join(',')).join(' ')} fill="none" stroke={GRID} strokeWidth="1" />)}
      {m.cats.map((c, k) => { const [x, y] = pt(k, sc.hi); return <line key={k} x1={cx} y1={cy} x2={x} y2={y} stroke={ha === k ? INK.muted : GRID} strokeWidth="1" />; })}
      {!mini && sc.ticks.slice(1).map(v => <Txt key={v} x={cx + 4} y={cy - R * (v / sc.hi) + 12} size={10} color={INK.faint}>{f.num(v)}</Txt>)}
      {m.series.map((s, b) => <polygon key={b} points={m.cats.map((_, k) => pt(k, m.v[k][b]).join(',')).join(' ')} fill={rc(m, b)} fillOpacity=".12" stroke={rc(m, b)} strokeWidth={mini ? 1.5 : 2} strokeLinejoin="round" />)}
      {!mini && m.series.map((s, b) => m.cats.map((_, k) => { const [x, y] = pt(k, m.v[k][b]); return <Marker key={b + '-' + k} shape={SHAPES[b]} x={x} y={y} r={3.5} fill={rc(m, b)} />; }))}
      {!mini && m.cats.map((c, k) => {
        const [x, y] = pt(k, sc.hi * 1.08), cos = Math.cos(ang(k));
        const show = () => { setHa(k); setTip(tipAt(x, y - 10, c, m.series.map((s, b) => ({ value: f.num(m.v[k][b]), label: s, color: rc(m, b) })))); };
        return <g key={k}>
          <Txt x={x} y={y + 4} anchor={Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'} size={11.5} color={INK.secondary}>{fit(c, lab * 2)}</Txt>
          <circle cx={x} cy={y} r="22" fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => { setTip(null); setHa(null); }} />
        </g>;
      })}
    </Frame>
  );
}

export function Table({ m, f, T, mini }) {
  const [sort, setSort] = useState({ k: -1, dir: -1 });
  const maxes = useMemo(() => m.cols.map((_, j) => Math.max(...m.rows.map(r => Math.abs(r.v[j])).filter(Number.isFinite), 0)), [m]);
  const dec = useMemo(() => m.cols.map((_, j) => Math.min(2, Math.max(0, ...m.rows.map(r => { const v = r.v[j]; if (!Number.isFinite(v)) return 0; for (let d = 0; d < 3; d++) if (Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) < 1e-6) return d; return 2; })))), [m]);
  if (mini) {
    return (
      <svg width="100%" height="118" viewBox="0 0 240 118" role="img" aria-label="table">
        {[0, 1, 2, 3, 4].map(i => <g key={i}>
          <rect x="4" y={10 + i * 21} width="50" height="6" rx="3" fill={INK.faint} opacity=".5" />
          {[0, 1, 2].map(j => { const v = m.rows[i] ? m.rows[i].v[j] / (maxes[j] || 1) : 0.4; return <rect key={j} x={70 + j * 56} y={9 + i * 21} width={Math.max(3, 48 * (Number.isFinite(v) ? Math.abs(v) : 0))} height="8" rx="2" fill={SERIES[0]} opacity={0.9} />; })}
        </g>)}
      </svg>
    );
  }
  const rows = sort.k < 0 ? m.rows : [...m.rows].sort((a, b) => (sort.k === 0 ? a.label.localeCompare(b.label) : (a.v[sort.k - 1] ?? -Infinity) - (b.v[sort.k - 1] ?? -Infinity)) * sort.dir);
  const head = [m.labelName, ...m.cols];
  const click = k => setSort(s => ({ k, dir: s.k === k ? -s.dir : k === 0 ? 1 : -1 }));
  return (
    <div className="table-scroll cg-table-wrap">
      <table className="data-table cg-table">
        <thead><tr>{head.map((h, k) => <th key={k} className={k ? 'num' : ''}><button type="button" className="cg-sort" onClick={() => click(k)} aria-sort={sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>{h}{sort.k === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.i}>
              <td className="strong">{r.label}</td>
              {r.v.map((v, j) => <td key={j} className="num"><span className="cg-cell"><span className="cg-cell-bar"><i style={{ width: Number.isFinite(v) && maxes[j] ? `${(Math.abs(v) / maxes[j]) * 100}%` : 0 }} /></span><b>{Number.isFinite(v) ? f.fixed(v, dec[j]) : T.ui.na}</b></span></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
