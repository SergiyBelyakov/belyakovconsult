// Графіки двійника на SVG без бібліотек. Кольори перевірено валідатором dataviz (темна тема, поверхня #0E131B):
// одна серія синя; пари «оцінка / реєстр» (синя / охра) і «чоловіки / жінки» (синя / пурпурова);
// послідовна шкала одного відтінку для карт; статуси завжди з іконкою й підписом.
import { useState } from 'react';
import { useWidth } from '../../dashboard/src/charts.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';

export const COL = {
  blue: '#3B82F6', ochre: '#B47308', pink: '#EC4899', gray: '#8A94A6', grid: 'rgba(255,255,255,.08)', ink: '#F4F6F8', muted: '#A8B0BC',
  seq: ['#2A4F86', '#2963AF', '#2E78D2', '#3F8FEB', '#5CA7FB', '#82BFFF', '#ACD5FF'],
  status: { ok: '#10B981', stale: '#FFB020', conflict: '#FF6B6B', missing: '#7E8896' },
};
// категорії об'єктів на карті: 4 відтінки, розрізненні всіма парами (CVD ΔE ≥ 10, звичайний зір ≥ 19,8)
export const CAT_COLOR = { edu: '#4A66E6', health: '#B8329A', safety: '#B87C38', services: '#0AA6BA' };
export const STATUS_ICON = { ok: 'check', stale: 'clock', conflict: 'warning', missing: 'info' };

function Tip({ x, y, w, children }) {
  if (x == null) return null;
  const side = x < w * 0.3 ? ' tip-l' : x > w * 0.7 ? ' tip-r' : '';
  return <div className={'chart-tip' + side} style={{ left: x, top: y }} role="status">{children}</div>;
}
// «Гарні» поділки осі: крок 1, 2, 2,5 або 5 × 10ⁿ; cover: остання поділка не менша за hi
export function ticks(lo, hi, n = 4, cover = false) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
  const st = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
  const out = [];
  for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-9; v += st) out.push(Math.round(v / st) * st || 0);
  if (cover && out[out.length - 1] < hi - st * 1e-9) out.push(out[out.length - 1] + st);
  return out;
}

// ——— мініатюрний ряд (пропуски допустимі) ———
export function Spark({ values, w = 112, h = 30 }) {
  const pts = (values || []).map((v, i) => [i, v]).filter(p => p[1] != null && Number.isFinite(p[1]));
  if (pts.length < 2) return null;
  const vs = pts.map(p => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), n = values.length - 1;
  const X = i => 3 + (i / n) * (w - 6), Yv = v => (hi === lo ? h / 2 : h - 4 - ((v - lo) / (hi - lo)) * (h - 8));
  const d = pts.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Yv(p[1]).toFixed(1)).join('');
  const last = pts[pts.length - 1];
  return (
    <svg className="tw-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={COL.blue} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(last[0])} cy={Yv(last[1])} r="2.6" fill={COL.ink} />
    </svg>
  );
}

// ——— позиція серед схожих громад: розмах, міжквартильний діапазон, медіана, наше значення ———
export function BenchStrip({ x, f, T, compact }) {
  if (!x.bench || x.v == null) return null;
  const [mn, q1, md, q3, mx] = x.bench, lo = Math.min(mn, x.v), hi = Math.max(mx, x.v), span = hi - lo || 1;
  const P = v => ((v - lo) / span) * 100;
  const better = x.better === 'up' ? x.v >= md : x.better === 'down' ? x.v <= md : null;
  return (
    <div className={'bench' + (compact ? ' compact' : '')} role="img" aria-label={T.benchAria(f.indVal(x, md), f.ind(x))}>
      <div className="bench-track">
        <i className="bench-range" style={{ left: P(mn) + '%', width: P(mx) - P(mn) + '%' }} />
        <i className="bench-iqr" style={{ left: P(q1) + '%', width: P(q3) - P(q1) + '%' }} />
        <i className="bench-med" style={{ left: P(md) + '%' }} />
        <i className="bench-dot" style={{ left: P(x.v) + '%' }} />
      </div>
      {!compact && <small>{T.benchMed}: <b>{f.indVal(x, md)}</b>{better != null && <em className={better ? 'good' : 'over'}>{better ? T.benchBetter : T.benchWorse}</em>}</small>}
    </div>
  );
}

// ——— статуси даних паспорта: смуга з іконками і підписами ———
export function StatusBar({ counts, T, onPick, picked }) {
  const total = counts.reduce((a, [, n]) => a + n, 0);
  return (
    <div className="status-bar">
      <div className="sb-track" role="img" aria-label={counts.map(([s, n]) => T.status[s] + ': ' + n).join(', ')}>
        {counts.filter(([, n]) => n).map(([s, n]) => <i key={s} className={'sb-' + s} style={{ width: (n / total) * 100 + '%', background: COL.status[s] }} />)}
      </div>
      <div className="sb-legend">
        {counts.map(([s, n]) => (
          <button type="button" key={s} className={'sb-item' + (picked === s ? ' on' : '')} onClick={() => onPick && onPick(picked === s ? null : s)} aria-pressed={picked === s}>
            <span className={'st-ic st-' + s}><Icon name={STATUS_ICON[s]} size={12} /></span>{T.status[s]}<b>{n}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

// ——— лінійний графік за роками, одна вісь, перехрестя й підказка ———
export function Trend({ years, series, fmt, height = 210, label, yFrom }) {
  const [ref, w] = useWidth(520);
  const [hi, setHi] = useState(null);
  const H = height, pad = { l: 52, r: 14, t: 12, b: 26 }, iw = w - pad.l - pad.r, ih = H - pad.t - pad.b;
  const all = series.flatMap(s => s.values).filter(v => v != null && Number.isFinite(v));
  let lo = yFrom != null ? yFrom : Math.min(...all), top = Math.max(...all);
  if (yFrom == null) { const m = (top - lo) * 0.15 || Math.abs(top) * 0.1 || 1; lo -= m; top += m; }
  const tk = ticks(lo, top, 4), y0 = Math.min(lo, tk[0]), y1 = Math.max(top, tk[tk.length - 1]);
  const X = i => pad.l + (years.length === 1 ? iw / 2 : (i / (years.length - 1)) * iw), Yv = v => pad.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const path = vals => vals.map((v, i) => [i, v]).filter(p => p[1] != null).map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Yv(p[1]).toFixed(1)).join('');
  const onMove = e => { const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left; const i = Math.max(0, Math.min(years.length - 1, Math.round(((x - pad.l) / iw) * (years.length - 1)))); setHi(i); };
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={w} height={H} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        {tk.map(v => <g key={v}><line x1={pad.l} x2={w - pad.r} y1={Yv(v)} y2={Yv(v)} stroke={COL.grid} /><text x={pad.l - 8} y={Yv(v) + 4} textAnchor="end" className="axis">{fmt(v)}</text></g>)}
        {years.map((y, i) => <text key={y} x={X(i)} y={H - 6} textAnchor="middle" className="axis">{y}</text>)}
        {series.map(s => <path key={s.key} d={path(s.values)} fill="none" stroke={s.color || COL.blue} strokeWidth="2" strokeDasharray={s.dash ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
        {series.map(s => s.values.map((v, i) => v != null && <circle key={s.key + i} cx={X(i)} cy={Yv(v)} r={hi === i ? 4.5 : 3} fill={s.color || COL.blue} stroke="#0E131B" strokeWidth="2" />))}
        {hi != null && <line x1={X(hi)} x2={X(hi)} y1={pad.t} y2={pad.t + ih} stroke="rgba(244,246,248,.35)" strokeDasharray="3 3" />}
      </svg>
      {hi != null && (
        <Tip x={X(hi)} y={8} w={w}>
          <b>{years[hi]}</b>
          {series.map(s => s.values[hi] != null && <strong key={s.key} className="tip-line"><i style={{ background: s.color || COL.blue }} />{series.length > 1 && <span>{s.name}</span>}{fmt(s.values[hi])}</strong>)}
        </Tip>
      )}
    </div>
  );
}

// ——— горизонтальні смуги одного кольору ———
export function HBars({ items, fmt, max, color = COL.blue, onPick, picked, refLine, refLabel, label }) {
  const m = max || Math.max(...items.map(x => Math.abs(x.v)), refLine || 0) || 1;
  return (
    <div className="hbars" role="list" aria-label={label}>
      {items.map(x => {
        const Tag = onPick ? 'button' : 'div';
        return (
          <Tag type={onPick ? 'button' : undefined} key={x.id} role="listitem" className={'hb' + (picked === x.id ? ' picked' : '') + (x.hl ? ' hl' : '') + (onPick ? ' click' : '')} onClick={onPick ? () => onPick(x.id) : undefined}>
            <span className="hb-label">{x.label}{x.sub && <small>{x.sub}</small>}</span>
            <span className="hb-track">
              <i style={{ width: Math.max(0.5, (Math.abs(x.v) / m) * 100) + '%', background: x.color || color }} />
              {refLine != null && <em className="hb-ref" style={{ left: (refLine / m) * 100 + '%' }} title={refLabel} />}
            </span>
            <span className="hb-val">{fmt(x.v)}</span>
          </Tag>
        );
      })}
    </div>
  );
}

// ——— стовпчики за роками ———
export function Columns({ years, values, fmt, fmtAxis, height = 200, label, color = COL.blue, last }) {
  const [ref, w] = useWidth(480);
  const [hi, setHi] = useState(null);
  const H = height, pad = { l: 46, r: 8, t: 14, b: 26 }, iw = w - pad.l - pad.r, ih = H - pad.t - pad.b;
  const top = Math.max(...values) * 1.04, tk = ticks(0, top, 4, true), y1 = tk[tk.length - 1];
  const band = iw / values.length, bw = Math.min(46, band * 0.62);
  const Yv = v => pad.t + ih - (v / y1) * ih;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={w} height={H} role="img" aria-label={label} onPointerLeave={() => setHi(null)}>
        {tk.map(v => <g key={v}><line x1={pad.l} x2={w - pad.r} y1={Yv(v)} y2={Yv(v)} stroke={COL.grid} /><text x={pad.l - 8} y={Yv(v) + 4} textAnchor="end" className="axis">{(fmtAxis || fmt)(v)}</text></g>)}
        {values.map((v, i) => {
          const x = pad.l + band * i + (band - bw) / 2, y = Yv(v), hgt = pad.t + ih - y;
          return (
            <g key={i} onPointerEnter={() => setHi(i)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              <path d={`M${x},${y + hgt}V${y + 4}Q${x},${y} ${x + 4},${y}H${x + bw - 4}Q${x + bw},${y} ${x + bw},${y + 4}V${y + hgt}Z`} fill={color} opacity={last && i === values.length - 1 ? 1 : hi === i ? 0.95 : 0.72} />
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis">{years[i]}</text>
            </g>
          );
        })}
      </svg>
      {hi != null && <Tip x={pad.l + band * hi + band / 2} y={Yv(values[hi]) - 6} w={w}><b>{years[hi]}</b><strong>{fmt(values[hi])}</strong></Tip>}
    </div>
  );
}

// ——— вікова піраміда: п'ятирічні групи, чоловіки ліворуч, жінки праворуч; контур другого року ———
export function Pyramid({ M, F, M2, F2, T, f, label, height = 330 }) {
  const [ref, w] = useWidth(460);
  const [hi, setHi] = useState(null);
  const g = (A, k) => { let s = 0; for (let a = k * 5; a <= (k === 17 ? 90 : k * 5 + 4); a++) s += A[a]; return s; };
  const G = 18, rows = Array.from({ length: G }, (_, k) => ({ k, m: g(M, k), f: g(F, k), m2: M2 ? g(M2, k) : null, f2: F2 ? g(F2, k) : null }));
  const mx = Math.max(...rows.flatMap(r => [r.m, r.f, r.m2 || 0, r.f2 || 0])) * 1.05;
  const pad = { t: 8, b: 24, mid: 44 }, H = height, rh = (H - pad.t - pad.b) / G, half = (w - pad.mid) / 2;
  const L = v => (v / mx) * (half - 8);
  const cx = w / 2;
  const outline = (key, side) => rows.map((r, i) => { const v = r[key]; const x = side < 0 ? cx - pad.mid / 2 - L(v) : cx + pad.mid / 2 + L(v); const y = pad.t + (G - 1 - i) * rh; return `${i ? 'L' : 'M'}${x.toFixed(1)},${(y + rh).toFixed(1)}L${x.toFixed(1)},${y.toFixed(1)}`; }).join('');
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={w} height={H} role="img" aria-label={label} onPointerLeave={() => setHi(null)}>
        {rows.map((r, i) => {
          const y = pad.t + (G - 1 - i) * rh;
          return (
            <g key={i} onPointerEnter={() => setHi(i)}>
              <rect x={0} y={y} width={w} height={rh} fill={hi === i ? 'rgba(255,255,255,.04)' : 'transparent'} />
              <rect x={cx - pad.mid / 2 - L(r.m)} y={y + 1} width={L(r.m)} height={rh - 2} rx="2" fill={COL.blue} opacity=".82" />
              <rect x={cx + pad.mid / 2} y={y + 1} width={L(r.f)} height={rh - 2} rx="2" fill={COL.pink} opacity=".82" />
              {i % 2 === 0 && <text x={cx} y={y + rh / 2 + 4} textAnchor="middle" className="axis">{i === 17 ? '85+' : i * 5 + '…' + (i * 5 + 4)}</text>}
            </g>
          );
        })}
        {M2 && <path d={outline('m2', -1)} fill="none" stroke={COL.ink} strokeWidth="1.4" strokeDasharray="3 2" />}
        {F2 && <path d={outline('f2', 1)} fill="none" stroke={COL.ink} strokeWidth="1.4" strokeDasharray="3 2" />}
        <text x={cx - pad.mid / 2 - 4} y={H - 6} textAnchor="end" className="axis">{T.men}</text>
        <text x={cx + pad.mid / 2 + 4} y={H - 6} className="axis">{T.women}</text>
      </svg>
      {hi != null && (
        <Tip x={cx} y={pad.t + (G - 1 - hi) * rh - 4} w={w}>
          <b>{hi === 17 ? '85+' : hi * 5 + '…' + (hi * 5 + 4)} {T.years}</b>
          <strong className="tip-line"><i style={{ background: COL.blue }} /><span>{T.men}</span>{f.int(rows[hi].m)}</strong>
          <strong className="tip-line"><i style={{ background: COL.pink }} /><span>{T.women}</span>{f.int(rows[hi].f)}</strong>
          {M2 && <small>{T.pyr2035}: {f.int(rows[hi].m2 + rows[hi].f2)}</small>}
        </Tip>
      )}
    </div>
  );
}

// ——— дві точки на рядок: реєстр і оцінка двійника ———
export function Dumbbell({ rows, fmt, names, onPick, picked, label }) {
  const [ref, w] = useWidth(520);
  const [hi, setHi] = useState(null);
  const lw = Math.min(150, w * 0.32), pad = { l: lw, r: 70, t: 6 }, rh = 26, H = pad.t + rows.length * rh + 22;
  const mx = Math.max(...rows.flatMap(r => [r.a, r.b])) * 1.04, iw = w - pad.l - pad.r;
  const X = v => pad.l + (v / mx) * iw;
  const tk = ticks(0, mx, Math.max(2, Math.min(5, Math.floor((w - lw - 70) / 70)))).filter(v => v <= mx);
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={w} height={H} role="img" aria-label={label} onPointerLeave={() => setHi(null)}>
        {tk.map(v => <g key={v}><line x1={X(v)} x2={X(v)} y1={pad.t} y2={H - 20} stroke={COL.grid} /><text x={X(v)} y={H - 6} textAnchor="middle" className="axis">{fmt(v)}</text></g>)}
        {rows.map((r, i) => {
          const y = pad.t + i * rh + rh / 2;
          return (
            <g key={r.id} className={'db-row' + (picked === r.id ? ' picked' : '') + (onPick ? ' click' : '')} onPointerEnter={() => setHi(i)} onClick={onPick ? () => onPick(r.id) : undefined}>
              <rect x={0} y={y - rh / 2} width={w} height={rh} fill={hi === i || picked === r.id ? 'rgba(255,255,255,.045)' : 'transparent'} />
              <text x={pad.l - 10} y={y + 4} textAnchor="end" className="db-label">{r.label}</text>
              <line x1={X(Math.min(r.a, r.b))} x2={X(Math.max(r.a, r.b))} y1={y} y2={y} stroke="rgba(244,246,248,.4)" strokeWidth="2" />
              <circle cx={X(r.b)} cy={y} r="5.5" fill={COL.blue} stroke="#0E131B" strokeWidth="2" />
              <rect x={X(r.a) - 5} y={y - 5} width="10" height="10" rx="2" fill={COL.ochre} stroke="#0E131B" strokeWidth="2" />
              <text x={w - 6} y={y + 4} textAnchor="end" className="db-gap">{r.gapLabel}</text>
            </g>
          );
        })}
      </svg>
      {hi != null && (
        <Tip x={X(rows[hi].a)} y={pad.t + hi * rh + rh + 2} w={w}>
          <b>{rows[hi].label}</b>
          <strong className="tip-line"><i className="sq" style={{ background: COL.ochre }} /><span>{names[0]}</span>{fmt(rows[hi].a)}</strong>
          <strong className="tip-line"><i style={{ background: COL.blue }} /><span>{names[1]}</span>{fmt(rows[hi].b)}</strong>
        </Tip>
      )}
    </div>
  );
}

// ——— місток: від реєстру до оцінки двійника ———
export function Waterfall({ steps, fmt, label, height = 230 }) {
  const [ref, w] = useWidth(520);
  const [hi, setHi] = useState(null);
  const H = height, pad = { l: 8, r: 8, t: 26, b: 44 }, ih = H - pad.t - pad.b, band = (w - pad.l - pad.r) / steps.length, bw = Math.min(84, band * 0.56);
  let run = 0;
  const bars = steps.map(s => { let a, b; if (s.kind === 'start' || s.kind === 'end') { a = 0; b = s.v; run = s.v; } else { a = run; b = run + s.v; run = b; } return { ...s, a, b }; });
  const mx = Math.max(...bars.map(x => Math.max(x.a, x.b))) * 1.06, lo = 0;   // стовпці завжди від нуля
  const Yv = v => pad.t + ih - ((v - lo) / (mx - lo)) * ih;
  const color = k => (k === 'start' ? COL.ochre : k === 'end' ? COL.blue : COL.gray);
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={w} height={H} role="img" aria-label={label} onPointerLeave={() => setHi(null)}>
        <line x1={pad.l} x2={w - pad.r} y1={Yv(lo)} y2={Yv(lo)} stroke={COL.grid} />
        {bars.map((s, i) => {
          const x = pad.l + band * i + (band - bw) / 2, y = Yv(Math.max(s.a, s.b)), hgt = Math.abs(Yv(s.a) - Yv(s.b));
          return (
            <g key={i} onPointerEnter={() => setHi(i)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              <rect x={x} y={y} width={bw} height={Math.max(2, hgt)} rx="3" fill={color(s.kind)} opacity={s.kind === 'minus' || s.kind === 'plus' ? 0.7 : 0.9} />
              {s.kind === 'minus' && <rect x={x} y={y} width={bw} height={Math.max(2, hgt)} rx="3" fill="url(#tw-hatch)" />}
              {i < bars.length - 1 && <line x1={x + bw} x2={x + band} y1={Yv(s.b)} y2={Yv(s.b)} stroke="rgba(244,246,248,.35)" strokeDasharray="3 3" />}
              <text x={x + bw / 2} y={y - 7} textAnchor="middle" className="wf-val">{(s.kind === 'minus' ? '−' : s.kind === 'plus' ? '+' : '') + fmt(Math.abs(s.v))}</text>
              <foreignObject x={pad.l + band * i} y={H - pad.b + 6} width={band} height={pad.b - 6}><div className="wf-label">{s.label}</div></foreignObject>
            </g>
          );
        })}
        <defs><pattern id="tw-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0V6" stroke="rgba(5,7,10,.55)" strokeWidth="2.4" /></pattern></defs>
      </svg>
      {hi != null && <Tip x={pad.l + band * hi + band / 2} y={Yv(Math.max(bars[hi].a, bars[hi].b)) - 30} w={w}><b>{bars[hi].label}</b><strong>{fmt(Math.abs(bars[hi].v))}</strong>{bars[hi].note && <small>{bars[hi].note}</small>}</Tip>}
    </div>
  );
}

// ——— прогноз: базова лінія і діапазон сценаріїв, індекс до першого року ———
export function ForecastMini({ title, years, base, low, high, fmt, T, f }) {
  const [ref, w] = useWidth(240);
  const [hi, setHi] = useState(null);
  const H = 132, pad = { l: 34, r: 10, t: 10, b: 20 }, iw = w - pad.l - pad.r, ih = H - pad.t - pad.b;
  const idx = arr => arr.map(v => (v / base[0]) * 100);
  const B = idx(base), Lo = idx(low), Hi = idx(high);
  const all = [...B, ...Lo, ...Hi], lo = Math.min(...all, 100) - 3, top = Math.max(...all, 100) + 3;
  const X = i => pad.l + (i / (years.length - 1)) * iw, Yv = v => pad.t + ih - ((v - lo) / (top - lo)) * ih;
  const line = a => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Yv(v).toFixed(1)).join('');
  const band = line(Hi) + Lo.map((v, i) => 'L' + X(Lo.length - 1 - i).toFixed(1) + ',' + Yv(Lo[Lo.length - 1 - i]).toFixed(1)).join('') + 'Z';
  const tk = ticks(lo, top, 3);
  const lastIdx = years.length - 1, chg = B[lastIdx] - 100;
  return (
    <div className="fc-mini">
      <div className="fc-head"><span>{title}</span><b className={chg < 0 ? 'neg' : 'pos'}>{(chg > 0 ? '+' : chg < 0 ? '−' : '') + f.dec1(Math.abs(chg)) + '%'}</b></div>
      <div className="chart-wrap" ref={ref}>
        <svg width={w} height={H} role="img" aria-label={title} onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHi(Math.max(0, Math.min(lastIdx, Math.round(((e.clientX - r.left - pad.l) / iw) * lastIdx)))); }} onPointerLeave={() => setHi(null)}>
          {tk.map(v => <g key={v}><line x1={pad.l} x2={w - pad.r} y1={Yv(v)} y2={Yv(v)} stroke={COL.grid} /><text x={pad.l - 6} y={Yv(v) + 4} textAnchor="end" className="axis">{f.int(v)}</text></g>)}
          <line x1={pad.l} x2={w - pad.r} y1={Yv(100)} y2={Yv(100)} stroke="rgba(244,246,248,.3)" strokeDasharray="2 3" />
          <path d={band} fill={COL.blue} opacity=".16" />
          <path d={line(B)} fill="none" stroke={COL.blue} strokeWidth="2" />
          {[0, lastIdx].map(i => <text key={i} x={X(i)} y={H - 5} textAnchor={i ? 'end' : 'start'} className="axis">{years[i]}</text>)}
          {hi != null && <><line x1={X(hi)} x2={X(hi)} y1={pad.t} y2={pad.t + ih} stroke="rgba(244,246,248,.35)" strokeDasharray="3 3" /><circle cx={X(hi)} cy={Yv(B[hi])} r="3.5" fill={COL.blue} stroke="#0E131B" strokeWidth="2" /></>}
        </svg>
        {hi != null && <Tip x={X(hi)} y={4} w={w}><b>{years[hi]}</b><strong>{fmt(base[hi])}</strong><small>{T.fcRange}: {fmt(low[hi])}…{fmt(high[hi])}</small></Tip>}
      </div>
    </div>
  );
}

// ——— розсіювання: учні й вартість одного учня ———
export function Scatter({ points, fmtX, fmtY, xLabel, yLabel, label, height = 280, onPick, picked }) {
  const [ref, w] = useWidth(520);
  const [hi, setHi] = useState(null);
  const H = height, pad = { l: 52, r: 16, t: 14, b: 40 }, iw = w - pad.l - pad.r, ih = H - pad.t - pad.b;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const xt = ticks(0, Math.max(...xs) * 1.03, Math.max(3, Math.min(6, Math.floor(iw / 90))), true), yt = ticks(0, Math.max(...ys) * 1.04, 4, true);
  const x1 = xt[xt.length - 1], y1 = yt[yt.length - 1];
  const X = v => pad.l + (v / x1) * iw, Yv = v => pad.t + ih - (v / y1) * ih;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={w} height={H} role="img" aria-label={label} onPointerLeave={() => setHi(null)}>
        {yt.map(v => <g key={'y' + v}><line x1={pad.l} x2={w - pad.r} y1={Yv(v)} y2={Yv(v)} stroke={COL.grid} /><text x={pad.l - 8} y={Yv(v) + 4} textAnchor="end" className="axis">{fmtY(v)}</text></g>)}
        {xt.map(v => <text key={'x' + v} x={X(v)} y={pad.t + ih + 16} textAnchor="middle" className="axis">{fmtX(v)}</text>)}
        <text x={pad.l + iw} y={H - 4} textAnchor="end" className="axis-faint">{xLabel}</text>
        <text x={pad.l} y={pad.t - 2} className="axis-faint">{yLabel}</text>
        {points.map((p, i) => (
          <g key={p.id} className={onPick ? 'click' : ''} onPointerEnter={() => setHi(i)} onClick={onPick ? () => onPick(p.id) : undefined}>
            <circle cx={X(p.x)} cy={Yv(p.y)} r="14" fill="transparent" />
            <circle cx={X(p.x)} cy={Yv(p.y)} r={picked === p.id ? 7 : 5.5} fill={COL.blue} stroke={picked === p.id ? '#F4F6F8' : '#0E131B'} strokeWidth="2" opacity={p.dim ? 0.45 : 1} />
          </g>
        ))}
        {(() => {
          // підписи без накладання: якщо сусідній підпис близько, зсуваємо вниз
          const placed = [];
          return points.filter(p => p.tag).sort((a, b) => Yv(a.y) - Yv(b.y)).map(p => {
            let y = Yv(p.y) + 4;
            const x = X(p.x) + 10;
            while (placed.some(q => Math.abs(q[0] - x) < 90 && Math.abs(q[1] - y) < 13)) y += 13;
            placed.push([x, y]);
            return <text key={'t' + p.id} x={x} y={y} className="sc-label">{p.tag}</text>;
          });
        })()}
      </svg>
      {hi != null && <Tip x={X(points[hi].x)} y={Yv(points[hi].y) + 12} w={w}><b>{points[hi].label}</b><strong>{fmtY(points[hi].y)}</strong><small>{fmtX(points[hi].x)}</small></Tip>}
    </div>
  );
}
