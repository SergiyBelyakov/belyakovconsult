// Будівельні блоки пояснювальних графіків: рамка, лінії, стовпчики, горизонтальні стовпчики, водоспад внесків,
// «льодяники» поодиноких замовлень і складені стовпчики внесків по кроках. Одна вісь, тонкі позначки,
// числа текстовими кольорами; колір несе лише належність до ряду.
import { useRef, useState } from 'react';
import { useWidth, niceTicks, pathOf, areaOf, FC } from './charts.jsx';
import { GRID, BASE } from '../../chart-gallery/src/palette.js';

export const NEUTRAL = '#C9D0DA';
export const UP = '#0894A8', DOWN = '#EC4899';

export function Frame({ title, sub, children, aside, className = '' }) {
  return (
    <div className={'ex-frame ' + className}>
      <div className="ex-head"><div><h5>{title}</h5>{sub && <small>{sub}</small>}</div>{aside}</div>
      {children}
    </div>
  );
}

// Кілька ліній на одній осі. marks: вертикальні позначки [{ x, label }], ticks: підписи осі X [{ i, label }]
export function Lines({ series, height = 120, zero = false, label, fmt, markX, marks = [], ticks = null, dots = null }) {
  const ref = useRef(null), W = useWidth(ref, 400);
  const all = series.flatMap(s => (s.band ? [...s.lo, ...s.hi] : s.values).filter(Number.isFinite));
  if (dots) dots.forEach(d => { if (Number.isFinite(d.y)) all.push(d.y); });
  if (zero) all.push(0);
  const yt = niceTicks(Math.min(...all), Math.max(...all), 3), y0 = yt[0], y1 = yt[yt.length - 1];
  const N = Math.max(...series.map(s => (s.x0 || 0) + (s.values || s.lo).length));
  const M = { l: 44, r: 8, t: marks.some(m => m.label) ? 16 : 6, b: ticks ? 18 : 6 };
  const X = i => M.l + (i / Math.max(1, N - 1)) * (W - M.l - M.r), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  // підписи позначок не налазять один на одного: ближчий за ~64 px підпис пропускається, лінія лишається
  let lastX = -1e9;
  const shown = marks.map(m => { const x = X(m.x), ok = !!m.label && x - lastX > 64; if (ok) lastX = x; return ok; });
  return (
    <div ref={ref} className="ex-lines">
      <svg width={W} height={height} role="img" aria-label={label}>
        {yt.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 && zero ? BASE : GRID} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt ? fmt(v) : v}</text></g>)}
        {markX != null && <line x1={X(markX)} x2={X(markX)} y1={M.t} y2={height - M.b} className="fc-today" />}
        {marks.map((m, k) => <g key={k}><line x1={X(m.x)} x2={X(m.x)} y1={M.t - 4} y2={height - M.b} className="ex-mark" />{shown[k] && <text x={Math.min(W - M.r - 2, Math.max(M.l + 2, X(m.x)))} y={M.t - 6} textAnchor={X(m.x) > W - 60 ? 'end' : X(m.x) < M.l + 40 ? 'start' : 'middle'} className="ex-mark-label">{m.label}</text>}</g>)}
        {series.map((s, k) => s.band
          ? <path key={k} d={areaOf(s.lo.map((_, i) => X((s.x0 || 0) + i)), s.lo.map(Y), s.hi.map(Y))} fill={s.color} opacity="0.18" />
          : <path key={k} d={pathOf(s.values.map((v, i) => [X((s.x0 || 0) + i), Y(v)]))} fill="none" stroke={s.color || NEUTRAL} strokeWidth={s.w || 1.6} strokeDasharray={s.dash || null} opacity={s.op || 1} />)}
        {dots && dots.map((d, k) => <circle key={k} cx={X(d.x)} cy={Y(d.y)} r={d.r || 3} fill={d.color || FC} stroke="#0E131B" strokeWidth="1.5" />)}
        {ticks && ticks.map(t => <text key={t.i} x={X(t.i)} y={height - 4} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
      </svg>
    </div>
  );
}

// Стовпчики з підписами під ними (вертикальні)
export function Bars({ values, labels, height = 120, fmt, color = FC, colors, highlight, label, se }) {
  const ref = useRef(null), W = useWidth(ref, 400);
  const lo = Math.min(0, ...values.map((v, i) => v - (se?.[i] ? 1.96 * se[i] : 0)).filter(Number.isFinite));
  const hi = Math.max(0, ...values.map((v, i) => v + (se?.[i] ? 1.96 * se[i] : 0)).filter(Number.isFinite));
  const ticks = niceTicks(lo, hi, 3), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const M = { l: 44, r: 6, t: 6, b: labels ? 18 : 6 }, n = values.length, gap = n > 30 ? 1 : 2;
  const bw = (W - M.l - M.r) / n - gap, X = i => M.l + i * (bw + gap), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  const every = Math.ceil(n / Math.max(1, Math.floor((W - M.l) / 34)));
  return (
    <div ref={ref} className="ex-bars">
      <svg width={W} height={height} role="img" aria-label={label}>
        {ticks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? BASE : GRID} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt ? fmt(v) : v}</text></g>)}
        {values.map((v, i) => Number.isFinite(v) && (
          <g key={i}>
            <rect x={X(i)} y={Math.min(Y(0), Y(v))} width={Math.max(1, bw)} height={Math.max(0.5, Math.abs(Y(v) - Y(0)))} rx={bw > 6 ? 2 : 0} fill={highlight === i ? '#F4F6F8' : colors ? colors[i] : color} opacity={highlight == null || highlight === i ? 1 : 0.75} />
            {se?.[i] > 0 && <line x1={X(i) + bw / 2} x2={X(i) + bw / 2} y1={Y(v - 1.96 * se[i])} y2={Y(v + 1.96 * se[i])} className="ex-whisk" />}
            {labels && i % every === 0 && <text x={X(i) + bw / 2} y={height - 4} textAnchor="middle" className="fc-xtick">{labels[i]}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// Підпис позиції сезону: місяць, день тижня чи номер тижня
export function seasonLabels(dates, m, freq, fmt, offset = 0) {
  return Array.from({ length: m }, (_, p) => {
    const d = dates[(p + offset) % dates.length] || dates[p];
    if (freq === 'M') return fmt.monShort(d);
    if (freq === 'D' && m === 7) return fmt.dowShort(d);
    return String(p + 1);
  });
}

// Горизонтальні стовпчики від нуля: ефекти подій, важливість ознак
export function HBars({ rows, fmt, label }) {
  const lo = Math.min(0, ...rows.map(r => r.value)), hi = Math.max(0, ...rows.map(r => r.value)), span = hi - lo || 1, z = (-lo / span) * 100;
  return (
    <ul className="ex-hbars" aria-label={label}>
      {rows.map(r => {
        const w = (Math.abs(r.value) / span) * 100, left = r.value >= 0 ? z : z - w;
        return (
          <li key={r.id}>
            <span className="ex-hb-name">{r.name}{r.sub && <small>{r.sub}</small>}</span>
            <span className="ex-hb-track">{lo < 0 && <i className="ex-hb-zero" style={{ left: z + '%' }} />}<i className="ex-hb-bar" style={{ left: left + '%', width: Math.max(0.6, w) + '%', background: r.color || FC }} /></span>
            <b>{fmt(r.value)}</b>
          </li>
        );
      })}
    </ul>
  );
}

// Горизонтальний водоспад: від стартового значення через внески до підсумку. zero: вісь від нуля
export function Waterfall({ steps, fmt, label, zero = false }) {
  let acc = 0;
  const bars = steps.map(s => {
    if (s.kind === 'delta') { const a = acc; acc += s.value; return { ...s, a, b: acc }; }
    acc = s.value; return { ...s, a: null, b: s.value };
  });
  const vals = bars.flatMap(b => (b.a == null ? [b.b] : [b.a, b.b]));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1;
  lo = zero ? Math.min(0, lo) : lo - pad; hi += pad;
  const P = v => ((v - lo) / (hi - lo || 1)) * 100;
  return (
    <ul className="ex-wf" aria-label={label}>
      {bars.map((b, k) => {
        // без нуля на осі старт і підсумок показуються міткою на своєму значенні, а не смугою від краю
        const pin = b.a == null && !zero;
        const x1 = pin ? P(b.b) - 0.7 : b.a == null ? P(lo) : P(Math.min(b.a, b.b)), x2 = pin ? P(b.b) + 0.7 : P(b.a == null ? b.b : Math.max(b.a, b.b));
        const color = b.kind === 'delta' ? (b.value >= 0 ? UP : DOWN) : b.kind === 'end' ? FC : NEUTRAL;
        return (
          <li key={k} className={b.kind}>
            <span className="ex-wf-name">{b.name}{b.sub && <small>{b.sub}</small>}</span>
            <span className="ex-wf-track">
              {b.a != null && <i className="ex-wf-link" style={{ left: P(b.a) + '%' }} />}
              <i className={'ex-wf-bar' + (pin ? ' pin' : '')} style={{ left: x1 + '%', width: Math.max(0.6, x2 - x1) + '%', background: color }} />
            </span>
            <b>{b.kind === 'delta' ? (b.value > 0 ? '+' : b.value < 0 ? '−' : '') + fmt(Math.abs(b.value)) : fmt(b.value)}</b>
          </li>
        );
      })}
    </ul>
  );
}

// «Льодяники»: окремі замовлення як стебла з точкою, нулі лишаються порожніми; rate: лінія середнього попиту
export function Lollipop({ values, height = 130, fmt, label, rate, ticks }) {
  const ref = useRef(null), W = useWidth(ref, 400);
  const yt = niceTicks(0, Math.max(...values, rate || 0, 1), 3), y1 = yt[yt.length - 1];
  const M = { l: 34, r: 8, t: 8, b: ticks ? 18 : 6 }, n = values.length;
  const X = i => M.l + ((i + 0.5) / n) * (W - M.l - M.r), Y = v => M.t + (1 - v / (y1 || 1)) * (height - M.t - M.b);
  return (
    <div ref={ref} className="ex-bars">
      <svg width={W} height={height} role="img" aria-label={label}>
        {yt.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? BASE : GRID} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt(v)}</text></g>)}
        {values.map((v, i) => v > 0 && <g key={i}><line x1={X(i)} x2={X(i)} y1={Y(0)} y2={Y(v)} stroke="#94A3B8" strokeWidth="1.5" /><circle cx={X(i)} cy={Y(v)} r="3" fill="#C9D0DA" stroke="#0E131B" strokeWidth="1" /></g>)}
        {Number.isFinite(rate) && <line x1={M.l} x2={W - M.r} y1={Y(rate)} y2={Y(rate)} stroke={FC} strokeWidth="2" strokeDasharray="5 4" />}
        {ticks && ticks.map(t => <text key={t.i} x={X(t.i)} y={height - 4} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
      </svg>
    </div>
  );
}

// Складені стовпчики внесків по кроках: додатні вгору від нуля, від’ємні вниз; клік обирає крок
export function StackBars({ groups, height = 170, fmt, sel, onSel, label, ticks }) {
  const ref = useRef(null), W = useWidth(ref, 500), n = groups[0].values.length;
  const [hov, setHov] = useState(null);
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) { let p = 0, q = 0; groups.forEach(g => { const v = g.values[i]; if (v > 0) p += v; else q += v; }); hi = Math.max(hi, p); lo = Math.min(lo, q); }
  const yt = niceTicks(lo, hi, 4), y0 = yt[0], y1 = yt[yt.length - 1];
  const M = { l: 44, r: 6, t: 6, b: ticks ? 18 : 6 }, gap = n > 40 ? 1 : 2, bw = (W - M.l - M.r) / n - gap;
  const X = i => M.l + i * (bw + gap), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  return (
    <div ref={ref} className="ex-bars ex-stack" onMouseLeave={() => setHov(null)}>
      <svg width={W} height={height} role="img" aria-label={label}>
        {yt.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? BASE : GRID} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt(v)}</text></g>)}
        {Array.from({ length: n }, (_, i) => {
          let p = 0, q = 0;
          return (
            <g key={i} className={'ex-stack-col' + (sel === i ? ' on' : '')} onClick={onSel ? () => onSel(i) : undefined} onMouseEnter={() => setHov(i)}>
              <rect x={X(i) - gap / 2} y={M.t} width={bw + gap} height={height - M.t - M.b} className="ex-stack-hit" />
              {groups.map(g => {
                const v = g.values[i]; if (!v) return null;
                const a = v > 0 ? p : q, b = a + v;
                if (v > 0) p = b; else q = b;
                return <rect key={g.id} x={X(i)} y={Math.min(Y(a), Y(b))} width={Math.max(1, bw)} height={Math.max(0.5, Math.abs(Y(b) - Y(a)) - 1)} fill={g.color} />;
              })}
            </g>
          );
        })}
        {ticks && ticks.map(t => <text key={t.i} x={X(t.i) + bw / 2} y={height - 4} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
      </svg>
      {hov != null && (
        <div className="fc-tip ex-stack-tip" style={X(hov) > W * 0.55 ? { right: Math.max(4, W - X(hov) + 8) } : { left: Math.max(4, X(hov) + bw + 8) }}>
          {groups.filter(g => Math.abs(g.values[hov]) > 1e-9).map(g => <span key={g.id}><i className="fc-sw" style={{ background: g.color }} />{g.name}<b>{(g.values[hov] > 0 ? '+' : '−') + fmt(Math.abs(g.values[hov]))}</b></span>)}
        </div>
      )}
    </div>
  );
}
