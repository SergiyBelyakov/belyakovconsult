// Графіки панелі керівника на SVG без бібліотек: план і факт, міст (водоспад), прийняті й звільнені.
// Палітра та підказки як у спільних графіках дашборду (dashboard/src/charts.jsx).
import { useState } from 'react';
import { C, useWidth } from '../../dashboard/src/charts.jsx';
import { niceMax } from '../../dashboard/src/format.js';

export { C };

function Tip({ x, y, w, children }) {
  if (x == null) return null;
  const side = x < w * 0.3 ? ' tip-l' : x > w * 0.7 ? ' tip-r' : '';
  return <div className={'chart-tip' + side} style={{ left: x, top: y }} role="status">{children}</div>;
}
const showTick = (i, n, band) => band >= 34 || i % 2 === (n - 1) % 2;

// Факт (суцільна лінія) і план (пунктир); між ними заливка: тепла там, де факт нижче плану.
export function PlanActual({ data, actual, plan, fmtAxis, tip, label, height = 260, focus }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 50, R = 14, T = 16, B = 30, H = height;
  const max = niceMax(Math.max(1, ...data.map(d => Math.max(actual(d), plan(d)))) * 1.06);
  // шкала не від нуля: розрив між планом і фактом має бути видно
  const minV = Math.min(...data.map(d => Math.min(actual(d), plan(d))));
  const lo = Math.max(0, Math.floor((minV * 0.85) / (max / 8)) * (max / 8));
  const x = i => L + (W - L - R) * (data.length === 1 ? 0.5 : i / (data.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (max - lo || 1));
  const path = f => data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(f(d)).toFixed(1)).join(' ');
  const step = data.length > 1 ? (W - L - R) / (data.length - 1) : W;
  // заливка відрізками між сусідніми точками
  const gaps = data.slice(1).map((d, k) => {
    const a = data[k], i = k + 1;
    const below = actual(d) + actual(a) < plan(d) + plan(a);
    return <path key={i} d={`M${x(k)},${y(actual(a))} L${x(i)},${y(actual(d))} L${x(i)},${y(plan(d))} L${x(k)},${y(plan(a))} Z`} fill={below ? C.status.critical : C.status.healthy} opacity={below ? 0.2 : 0.14} />;
  });
  const cur = hi ?? focus;
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => lo + (max - lo) * f).map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} />
            <text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmtAxis(v)}</text>
          </g>
        ))}
        {data.map((d, i) => showTick(i, data.length, step) && <text key={d.m} x={x(i)} y={H - 9} className="axis" textAnchor="middle">{d.tick}</text>)}
        {gaps}
        <path d={path(plan)} fill="none" stroke={C.neutral} strokeWidth="1.6" strokeDasharray="5 5" />
        <path d={path(actual)} fill="none" stroke={C.primary} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {cur != null && data[cur] && (
          <g>
            {hi != null && <line x1={x(cur)} x2={x(cur)} y1={T} y2={H - B} stroke="rgba(244,246,248,.35)" />}
            <circle cx={x(cur)} cy={y(plan(data[cur]))} r="3.5" fill={C.surface} stroke={C.neutral} strokeWidth="1.6" />
            <circle cx={x(cur)} cy={y(actual(data[cur]))} r="5" fill={C.primary} stroke={C.surface} strokeWidth="2" />
          </g>
        )}
        {data.map((d, i) => (
          <rect key={'h' + d.m} x={x(i) - step / 2} y={T} width={step} height={H - T - B + 8} fill="transparent"
            onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)} />
        ))}
      </svg>
      {hi != null && data[hi] && <Tip x={x(hi)} y={4} w={W}>{tip(data[hi])}</Tip>}
    </div>
  );
}

// Міст (водоспад): підсумкові стовпці сірі, приріст зелений, зменшення червоне; підписи значень.
export function Waterfall({ steps, name, fmt, fmtShort, label, height = 280, onPick, picked }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 10, R = 10, T = 26, B = 46, H = height;
  let run = 0;
  const bars = steps.map(s => {
    if (s.total) { run = s.value; return { ...s, from: 0, to: s.value }; }
    const from = run; run += s.value;
    return { ...s, from, to: run };
  });
  const lo = Math.min(0, ...bars.map(b => Math.min(b.from, b.to)));
  const hiV = Math.max(...bars.map(b => Math.max(b.from, b.to)));
  const span = (hiV - lo) * 1.08 || 1;
  const y = v => T + (H - T - B) * (1 - (v - lo) / span);
  const band = (W - L - R) / bars.length;
  const bw = Math.min(64, band * 0.62);
  const x = i => L + band * i + band / 2;
  // на вузькому екрані: короткі підписи і лише помітні кроки, щоб числа не налазили одне на одне
  const narrow = band < 78;
  const lab = v => (narrow && fmtShort ? fmtShort(v) : fmt(v));
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke={C.grid} />
        {bars.map((b, i) => {
          const top = y(Math.max(b.from, b.to)), h = Math.max(1.5, Math.abs(y(b.from) - y(b.to)));
          const color = b.total ? C.slate : b.value >= 0 ? C.status.healthy : C.status.critical;
          return (
            <g key={b.id} className={onPick && !b.total ? 'wf-pick' : ''} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => (onPick && !b.total ? onPick(b) : setHi(i))}>
              <rect x={x(i) - bw / 2} y={top} width={bw} height={h} rx="3" fill={color} opacity={hi === i || picked === b.id ? 1 : b.total ? 0.9 : 0.78} stroke={hi === i || picked === b.id ? '#F4F6F8' : 'none'} strokeWidth="1.5" />
              {i < bars.length - 1 && <line x1={x(i) + bw / 2} x2={x(i + 1) - bw / 2} y1={y(b.to)} y2={y(b.to)} stroke={C.neutral} strokeDasharray="2 3" />}
              {(b.total || (Math.abs(b.value) >= 0.5 && (!narrow || Math.abs(b.value) >= 0.06 * span))) && <text x={x(i)} y={top - 7} className="value-label" textAnchor="middle">{b.total ? lab(b.value) : (b.value >= 0 ? '+' : '−') + lab(Math.abs(b.value))}</text>}
              <foreignObject x={x(i) - band / 2} y={H - B + 6} width={band} height={B - 6}>
                <div className="wf-label">{name(b.id)}</div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Прийняті вгору, звільнені вниз (добровільні темніше)
export function Diverging({ data, label, tip, height = 220 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 34, R = 10, T = 12, B = 26, H = height;
  const max = Math.max(4, ...data.map(d => Math.max(d.up, d.down)));
  const mid = T + (H - T - B) / 2;
  const sc = v => ((H - T - B) / 2) * (v / max);
  const band = (W - L - R) / data.length;
  const bw = Math.min(18, band * 0.6);
  const x = i => L + band * i + band / 2;
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        <line x1={L} x2={W - R} y1={mid} y2={mid} stroke={C.grid} />
        <text x={L - 6} y={T + 8} className="axis" textAnchor="end">{max}</text>
        <text x={L - 6} y={H - B} className="axis" textAnchor="end">{max}</text>
        {data.map((d, i) => (
          <g key={d.m} opacity={hi == null || hi === i ? 1 : 0.55}>
            <rect x={x(i) - bw / 2} y={mid - sc(d.up)} width={bw} height={sc(d.up)} rx="2" fill={C.series.finance} />
            <rect x={x(i) - bw / 2} y={mid} width={bw} height={sc(d.down)} rx="2" fill="#F59BAA" opacity=".55" />
            <rect x={x(i) - bw / 2} y={mid} width={bw} height={sc(d.vol)} rx="2" fill={C.status.critical} />
            {showTick(i, data.length, band) && <text x={x(i)} y={H - 8} className="axis" textAnchor="middle">{d.tick}</text>}
            <rect x={x(i) - band / 2} y={T} width={band} height={H - T - B} fill="transparent" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)} />
          </g>
        ))}
      </svg>
      {hi != null && <Tip x={x(hi)} y={0} w={W}>{tip(data[hi])}</Tip>}
    </div>
  );
}

// Одна лінія з власною шкалою (для «зв'язку» показників): пунктир порогу, крапка поточного місяця
export function TrendLine({ values, ticks, domain, refLine, color = C.primary, fmt, name, height = 132, focus }) {
  const [ref, W] = useWidth(240);
  const [h, setH] = useState(null);
  const [lo, hi] = domain;
  const L = 6, R = 6, T = 40, B = 20, H = height;
  const x = i => L + (W - L - R) * (values.length === 1 ? 0.5 : i / (values.length - 1));
  const y = v => T + (H - T - B) * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1));
  const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const step = (W - L - R) / Math.max(1, values.length - 1);
  const cur = h ?? focus ?? values.length - 1;
  return (
    <div className="mini chart" ref={ref}>
      <div className="mini-head"><i style={{ background: color }} /><span>{name}</span><b>{fmt(values[cur])}</b></div>
      <svg width={W} height={H} role="img" aria-label={name}>
        {refLine != null && <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} stroke={C.neutral} strokeDasharray="3 4" />}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={C.grid} />
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(cur)} cy={y(values[cur])} r="4.5" fill={color} stroke={C.surface} strokeWidth="2" />
        <text x={L} y={H - 5} className="axis">{ticks[0]}</text>
        <text x={W - R} y={H - 5} className="axis" textAnchor="end">{ticks[ticks.length - 1]}</text>
        {values.map((v, i) => <rect key={i} x={x(i) - step / 2} y={T - 6} width={step} height={H - T - B + 6} fill="transparent" onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} onClick={() => setH(i)} />)}
      </svg>
      {h != null && <Tip x={x(h)} y={16} w={W}>{ticks[h]}: <b>{fmt(values[h])}</b></Tip>}
    </div>
  );
}
