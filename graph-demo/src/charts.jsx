// Графіки для індексу і громад. Тонкі позначки, проміжок 2px між сегментами, підказки при наведенні.
import { useState } from 'react';
import { useWidth } from '../../dashboard/src/charts.jsx';

export const COLORS = {
  // складові індексу і групи характеристик (перевірено валідатором палітри на темній поверхні)
  d: '#EC4899', s: '#A855F7', m: '#019586', n: '#3B82F6',
  // рівні потреби: дві нейтральні сходинки і два сигнали, завжди з підписом
  level: { low: '#5B6676', moderate: '#A8B0BC', high: '#FFB020', critical: '#D90429' },
  grid: 'rgba(255,255,255,.08)', axis: '#A8B0BC', ink: '#F4F6F8', surface: '#0E131B', muted: '#3A4250',
};

function Tip({ x, y, w, children }) {
  if (x == null) return null;
  const side = x < w * 0.28 ? ' tip-l' : x > w * 0.72 ? ' tip-r' : '';
  return <div className={'chart-tip' + side} style={{ left: x, top: y }} role="status">{children}</div>;
}

// Гістограма індексу: стовпчики по 5 балів, колір смуги рівня, пунктир на межах рівнів.
export function Histogram({ values, step = 5, max = 80, thresholds, levelOf, fmt, tip, label, height = 230, thresholdLabel }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const bins = Array.from({ length: Math.ceil(max / step) }, (_, i) => ({ x0: i * step, x1: (i + 1) * step, n: 0 }));
  values.forEach(v => { const i = Math.min(bins.length - 1, Math.floor(v / step)); bins[i].n++; });
  const L = 40, R = 12, Tp = 24, B = 30, H = height;
  const raw = Math.max(...bins.map(b => b.n));
  const stepY = raw > 40 ? 20 : raw > 16 ? 10 : 4;
  const yMax = Math.max(4, Math.ceil(raw / stepY) * stepY);
  const x = v => L + ((W - L - R) * v) / max;
  const y = n => Tp + (H - Tp - B) * (1 - n / yMax);
  const bw = Math.max(2, x(step) - x(0) - 2);
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {[0, .5, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(yMax * f)} y2={y(yMax * f)} stroke={COLORS.grid} />
            <text x={L - 8} y={y(yMax * f) + 4} className="axis" textAnchor="end">{fmt(yMax * f)}</text>
          </g>
        ))}
        {bins.map((b, i) => {
          const top = y(b.n), h = H - B - top, r = Math.min(4, h / 2);
          const x0 = x(b.x0) + 1, x1 = x0 + bw;
          const d = h > 0 ? `M${x0},${H - B} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${H - B} Z` : '';
          return (
            <g key={i}>
              {d && <path d={d} fill={COLORS.level[levelOf(b.x0 + step / 2)]} opacity={hi == null || hi === i ? 1 : .5} />}
              <rect x={x(b.x0)} y={Tp} width={x(step) - x(0)} height={H - Tp - B} fill="transparent"
                onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)} />
            </g>
          );
        })}
        {thresholds.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={Tp - 8} y2={H - B} stroke={COLORS.axis} strokeDasharray="3 4" opacity=".7" />
            <text x={x(t) + 4} y={Tp - 10} className="axis axis-faint">{thresholdLabel(t)}</text>
          </g>
        ))}
        {Array.from({ length: max / 10 + 1 }, (_, i) => i * 10).map(v => (
          <text key={v} x={x(v)} y={H - 10} className="axis" textAnchor="middle">{fmt(v)}</text>
        ))}
      </svg>
      {hi != null && <Tip x={x(bins[hi].x0 + step / 2)} y={0} w={W}>{tip(bins[hi])}</Tip>}
    </div>
  );
}

// Розсіювання «потреба × підтримка» з виділеним квадрантом. Найближча точка в радіусі 22px.
export function Scatter({ points, quad, quadLabel, xLabel, yLabel, onPick, tip, label, fmt, height = 340, picked, xMax = 100 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 44, R = 14, Tp = 16, B = 42, H = height;
  const x = v => L + ((W - L - R) * Math.min(v, xMax)) / xMax;
  const y = v => Tp + (H - Tp - B) * (1 - v / 100);
  const xTicks = Array.from({ length: Math.floor(xMax / 10) + 1 }, (_, i) => i * 10);
  const nearest = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 22 * 22;
    for (const p of points) {
      const dx = x(p.x) - mx, dy = y(p.y) - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const cur = hi && points.find(p => p.id === hi);
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}
        onMouseMove={e => { const p = nearest(e); setHi(p ? p.id : null); }} onMouseLeave={() => setHi(null)}
        onClick={e => { const p = nearest(e); if (p) onPick(p.id); }} style={{ cursor: hi ? 'pointer' : 'default' }}>
        <rect x={x(quad.x)} y={y(quad.y)} width={x(xMax) - x(quad.x)} height={y(0) - y(quad.y)} className="quad" />
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COLORS.grid} />
            <text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {xTicks.map(v => <text key={v} x={x(v)} y={H - B + 16} className="axis" textAnchor="middle">{fmt(v)}</text>)}
        <line x1={x(quad.x)} x2={x(quad.x)} y1={Tp} y2={H - B} stroke={COLORS.axis} strokeDasharray="3 4" opacity=".7" />
        <line x1={L} x2={W - R} y1={y(quad.y)} y2={y(quad.y)} stroke={COLORS.axis} strokeDasharray="3 4" opacity=".7" />
        <text x={W - R - 6} y={y(quad.y) + 16} className="quad-label" textAnchor="end">{quadLabel}</text>
        <text x={(L + W - R) / 2} y={H - 6} className="axis" textAnchor="middle">{xLabel}</text>
        <text transform={`translate(12 ${(Tp + H - B) / 2}) rotate(-90)`} className="axis" textAnchor="middle">{yLabel}</text>
        {points.map(p => (
          <circle key={p.id} cx={x(p.x)} cy={y(p.y)} r={p.id === hi || p.id === picked ? 6 : 4.2} fill={p.color}
            stroke={p.id === picked ? COLORS.ink : COLORS.surface} strokeWidth={p.id === picked ? 2 : 1.5} opacity={hi && p.id !== hi ? .55 : 1} />
        ))}
      </svg>
      {cur && <Tip x={x(cur.x)} y={Math.max(0, y(cur.y) - 92)} w={W}>{tip(cur)}</Tip>}
    </div>
  );
}

// Горизонтальні складені смуги: внесок складових у середній індекс громади.
export function StackedBars({ rows, keys, colors, names, fmt, max, label, onPick }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const labelW = Math.min(150, W * .3), valW = 48;
  const track = Math.max(80, W - labelW - valW - 28);
  const m = max || Math.max(...rows.map(r => keys.reduce((a, k) => a + r.parts[k], 0)));
  return (
    <div className="chart stacked" ref={ref} role="img" aria-label={label}>
      {rows.map(r => {
        const total = keys.reduce((a, k) => a + r.parts[k], 0);
        let acc = 0;
        return (
          <button type="button" key={r.id} className="stack-row" onClick={() => onPick && onPick(r.id)} style={{ gridTemplateColumns: `${labelW}px ${track}px ${valW}px` }}>
            <span className="stack-name">{r.name}</span>
            <span className="stack-track">
              {keys.map(k => {
                const w = (r.parts[k] / m) * track;
                const left = acc; acc += w;
                return (
                  <i key={k} style={{ left, width: Math.max(0, w - 2), background: colors[k] }}
                    onMouseEnter={() => setHi({ r: r.id, k })} onMouseLeave={() => setHi(null)}>
                    {w > 30 && <em>{fmt(r.parts[k])}</em>}
                  </i>
                );
              })}
              {hi && hi.r === r.id && <span className="stack-tip chart-tip" style={{ left: Math.min(track - 40, keys.slice(0, keys.indexOf(hi.k) + 1).reduce((a, k) => a + (r.parts[k] / m) * track, 0) - 10) }}>
                <b>{names[hi.k]}</b><strong>{fmt(r.parts[hi.k])}</strong>
              </span>}
            </span>
            <span className="stack-val">{fmt(total)}</span>
          </button>
        );
      })}
    </div>
  );
}

// Тонка сегментована смуга без тексту: для рядків таблиці.
export function SegBar({ parts, keys, colors, max = 100, width = 120 }) {
  let acc = 0;
  return (
    <span className="segbar" style={{ width }} aria-hidden="true">
      {keys.map(k => {
        const w = (parts[k] / max) * width;
        const left = acc; acc += w;
        return <i key={k} style={{ left, width: Math.max(0, w - 2), background: colors[k] }} />;
      })}
    </span>
  );
}

// Шкала 0..100 з позначкою значення (складова індексу в профілі).
export function Meter({ value, color, label, valueText }) {
  return (
    <div className="meter">
      <span className="meter-name"><i style={{ background: color }} />{label}</span>
      <span className="meter-track"><i style={{ width: Math.max(1.5, value) + '%', background: color }} /></span>
      <b>{valueText}</b>
    </div>
  );
}

export function LevelLegend({ T, counts, f }) {
  return (
    <div className="level-legend">
      {['low', 'moderate', 'high', 'critical'].map(l => (
        <span key={l}><i className={'lv lv-' + l} />{T.levels[l]}{counts && <b>{f.int(counts[l])}</b>}</span>
      ))}
    </div>
  );
}

export function LevelPill({ level, T }) {
  return <span className={'level-pill lv-pill-' + level}><i className={'lv lv-' + level} />{T.levels[level]}</span>;
}
