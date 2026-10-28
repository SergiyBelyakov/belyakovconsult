// Графіки на SVG без бібліотек. Палітра з дизайн-системи Belyakov Consult:
// серії Cobalt → Teal → Violet → Magenta → Cyan (Amber зарезервовано під статус «Увага»),
// Ruby лише для виділеного елемента, статуси Emerald / Amber / Coral завжди зі словом або іконкою.
import { useLayoutEffect, useRef, useState } from 'react';
import { niceMax } from './format.js';

export const C = {
  series: { registry: '#3B82F6', finance: '#019586', health: '#A855F7', operations: '#EC4899', geo: '#07A4BA' },
  primary: '#3B82F6',
  ruby: '#D90429',
  neutral: '#94A3B8',
  slate: '#64748B',
  grid: 'rgba(255,255,255,.08)',
  axis: '#A8B0BC',
  ink: '#F4F6F8',
  surface: '#0E131B',
  status: { healthy: '#10B981', warning: '#FFB020', critical: '#FF6B6B', info: '#94A3B8' },
};

export function useWidth(initial = 600) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Tip({ x, y, w, children }) {
  if (x == null) return null;
  const side = x < w * 0.3 ? ' tip-l' : x > w * 0.7 ? ' tip-r' : '';
  return <div className={'chart-tip' + side} style={{ left: x, top: y }} role="status">{children}</div>;
}

// Підписи місяців на осі: на вузькому графіку кожен другий, останній завжди.
const showTick = (i, n, band) => band >= 34 || i % 2 === (n - 1) % 2;

// Площинний графік однієї серії з перехрестям і підказкою.
export function AreaTrend({ data, value, fmtAxis, label, tip, height = 240, color = C.primary, highlight, valueLabel }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 54, R = 16, T = 16, B = 30, H = height;
  const max = niceMax(Math.max(1, ...data.map(value)) * 1.08);
  const x = i => L + (W - L - R) * (data.length === 1 ? 0.5 : i / (data.length - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  const line = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(value(d)).toFixed(1)).join(' ');
  const area = data.length ? line + ` L${x(data.length - 1)},${H - B} L${x(0)},${H - B} Z` : '';
  const step = data.length > 1 ? (W - L - R) / (data.length - 1) : W;
  const cur = hi ?? highlight;
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        <defs>
          <linearGradient id="area-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke={C.grid} />
            <text x={L - 10} y={y(max * f) + 4} className="axis" textAnchor="end">{fmtAxis(max * f)}</text>
          </g>
        ))}
        {data.map((d, i) => showTick(i, data.length, step) && (
          <text key={d.key} x={x(i)} y={H - 9} className="axis" textAnchor="middle">{d.tick}</text>
        ))}
        <path d={area} fill="url(#area-wash)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {cur != null && data[cur] && (
          <g>
            {hi != null && <line x1={x(cur)} x2={x(cur)} y1={T} y2={H - B} stroke="rgba(244,246,248,.35)" />}
            <circle cx={x(cur)} cy={y(value(data[cur]))} r="5" fill={C.ruby} stroke={C.surface} strokeWidth="2" />
            {hi == null && valueLabel && <text x={x(cur) - 8} y={y(value(data[cur])) - 10} className="value-label" textAnchor="end">{valueLabel(data[cur])}</text>}
          </g>
        )}
        {data.map((d, i) => (
          <rect key={'h' + d.key} x={x(i) - step / 2} y={T} width={step} height={H - T - B + 8} fill="transparent"
            onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)} />
        ))}
      </svg>
      {hi != null && data[hi] && <Tip x={x(hi)} y={4} w={W}>{tip(data[hi])}</Tip>}
    </div>
  );
}

// Стовпчики однієї серії (обсяг або інциденти за місяцями).
export function Columns({ data, value, fmtAxis, label, tip, height = 240, color = C.primary, refLine, refLabel, labelLast }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 54, R = 16, T = 22, B = 30, H = height;
  const max = niceMax(Math.max(1, refLine || 0, ...data.map(value)) * 1.05);
  const band = (W - L - R) / Math.max(1, data.length);
  const bw = Math.min(24, band * 0.6);
  const x = i => L + band * i + band / 2;
  const y = v => T + (H - T - B) * (1 - v / max);
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke={C.grid} />
            <text x={L - 10} y={y(max * f) + 4} className="axis" textAnchor="end">{fmtAxis(max * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = value(d), top = y(v), h = Math.max(0, H - B - top), r = Math.min(4, h / 2);
          const path = `M${x(i) - bw / 2},${H - B} V${top + r} Q${x(i) - bw / 2},${top} ${x(i) - bw / 2 + r},${top} H${x(i) + bw / 2 - r} Q${x(i) + bw / 2},${top} ${x(i) + bw / 2},${top + r} V${H - B} Z`;
          return (
            <g key={d.key}>
              <path d={path} fill={hi === i ? C.ruby : color} opacity={hi == null || hi === i ? 1 : 0.55} />
              {showTick(i, data.length, band) && <text x={x(i)} y={H - 9} className="axis" textAnchor="middle">{d.tick}</text>}
              {labelLast && i === data.length - 1 && <text x={x(i)} y={top - 6} className="value-label" textAnchor="middle">{labelLast(d)}</text>}
            </g>
          );
        })}
        {refLine != null && (
          <g>
            <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} stroke={C.neutral} strokeDasharray="4 4" />
            <text x={W - R} y={y(refLine) - 6} className="axis" textAnchor="end">{refLabel}</text>
          </g>
        )}
        {data.map((d, i) => (
          <rect key={'h' + d.key} x={x(i) - band / 2} y={T - 10} width={band} height={H - T - B + 18} fill="transparent"
            onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)} />
        ))}
      </svg>
      {hi != null && <Tip x={x(hi)} y={0} w={W}>{tip(data[hi], hi)}</Tip>}
    </div>
  );
}

function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

// Кільцева діаграма з проміжками 2px між сегментами.
export function Donut({ items, size = 184, center, onPick, picked, label }) {
  const [hi, setHi] = useState(null);
  const total = items.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2, r1 = size / 2 - 2, r0 = r1 * 0.66;
  const gap = 2 / r1;
  let a = 0;
  const segs = items.map(d => {
    const a0 = a, a1 = a + (d.value / total) * Math.PI * 2;
    a = a1;
    return { ...d, a0: a0 + gap / 2, a1: Math.max(a0 + gap / 2, a1 - gap / 2) };
  });
  const active = hi ?? picked;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label}>
        {segs.map(s => (
          <path key={s.id} d={arc(cx, cx, active === s.id ? r0 - 3 : r0, active === s.id ? r1 : r1 - 3, s.a0, s.a1)} fill={s.color}
            opacity={active == null || active === s.id ? 1 : 0.4} style={{ cursor: 'pointer', transition: 'opacity .2s' }}
            onMouseEnter={() => setHi(s.id)} onMouseLeave={() => setHi(null)} onClick={() => onPick && onPick(s.id)} />
        ))}
      </svg>
      <div className="donut-center">{center(active ? items.find(i => i.id === active) : null)}</div>
    </div>
  );
}

// Мініатюрна лінія для KPI: приглушена лінія, остання точка рубінова.
export function Spark({ values, w = 96, h = 32 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const x = i => 2 + (i * (w - 6)) / (values.length - 1);
  const y = v => h - 4 - ((v - min) / (max - min || 1)) * (h - 10);
  const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  return (
    <svg className="spark" width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke={C.neutral} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity=".8" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3.5" fill={C.ruby} stroke={C.surface} strokeWidth="2" />
    </svg>
  );
}

// Малі множини: одна лінія на панель, спільна шкала, пунктирна ціль.
export function SmallMultiples({ series, months, tick, domain: [lo, hi], refLine, fmt, fmtScale, tip, height = 142 }) {
  return (
    <div className="multiples">
      {series.map(s => <Mini key={s.id} s={s} months={months} tick={tick} lo={lo} hi={hi} refLine={refLine} fmt={fmt} fmtScale={fmtScale} tip={tip} height={height} />)}
    </div>
  );
}

function Mini({ s, months, tick, lo, hi, refLine, fmt, fmtScale, tip, height }) {
  const [ref, W] = useWidth(220);
  const [h, setH] = useState(null);
  const L = 6, R = 6, T = 46, B = 20, H = height;
  const x = i => L + (W - L - R) * (months.length === 1 ? 0.5 : i / (months.length - 1));
  const y = v => T + (H - T - B) * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo));
  const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)]));
  const d = pts.filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const last = s.values[s.values.length - 1];
  const step = (W - L - R) / Math.max(1, months.length - 1);
  return (
    <div className="mini chart" ref={ref}>
      <div className="mini-head"><i style={{ background: s.color }} /><span>{s.name}</span><b>{last != null ? fmt(last) : '—'}</b></div>
      <svg width={W} height={H} role="img" aria-label={s.name}>
        {refLine != null && <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} stroke={C.neutral} strokeDasharray="3 4" />}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={C.grid} />
        <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts[pts.length - 1] && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={s.color} stroke={C.surface} strokeWidth="2" />}
        {h != null && pts[h] && <circle cx={pts[h][0]} cy={pts[h][1]} r="5" fill={C.ruby} stroke={C.surface} strokeWidth="2" />}
        <text x={L} y={T - 6} className="axis axis-faint">{(fmtScale || fmt)(hi)}</text>
        <text x={L} y={H - B - 4} className="axis axis-faint">{(fmtScale || fmt)(lo)}</text>
        <text x={L} y={H - 5} className="axis">{tick(months[0])}</text>
        <text x={W - R} y={H - 5} className="axis" textAnchor="end">{tick(months[months.length - 1])}</text>
        {months.map((m, i) => (
          <rect key={m} x={x(i) - step / 2} y={T - 6} width={step} height={H - T - B + 6} fill="transparent"
            onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} onClick={() => setH(i)} />
        ))}
      </svg>
      {h != null && s.values[h] != null && <Tip x={x(h)} y={18} w={W}>{tip(s, months[h], s.values[h])}</Tip>}
    </div>
  );
}

// Горизонтальні смуги: одна міра, однаковий колір, виділений елемент рубіновий.
export function BarList({ items, max, fmt, picked, onPick, refLine, refLabel, color = C.primary }) {
  const m = max || Math.max(1, refLine || 0, ...items.map(i => i.value));
  return (
    <div className="barlist">
      {items.map(it => (
        <button type="button" key={it.id} className={'bar-row' + (picked === it.id ? ' picked' : '')} onClick={() => onPick && onPick(it.id)}>
          <span className="bar-name">{it.name}</span>
          <span className="bar-track">
            <i style={{ width: (Math.max(0, it.value) / m) * 100 + '%', background: picked === it.id ? C.ruby : (it.color || color) }} />
            {refLine != null && <s style={{ left: (refLine / m) * 100 + '%' }} title={refLabel} />}
          </span>
          <span className="bar-value">{fmt(it.value, it)}</span>
        </button>
      ))}
    </div>
  );
}

// Теплова матриця. cell(row, col) повертає {text, bg, title, level}.
export function Heatmap({ rows, cols, cell, onCell, corner, picked }) {
  const sel = picked && (picked.region !== 'all' || picked.domain !== 'all');
  const isPicked = (r, c) => (picked.region === 'all' || picked.region === r.id) && (picked.domain === 'all' || picked.domain === c.id);
  return (
    <div className="heat-scroll">
      <table className="heat">
        <thead>
          <tr><th>{corner}</th>{cols.map(c => <th key={c.id} title={c.name}>{c.short}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              {cols.map(c => {
                const v = cell(r, c);
                return (
                  <td key={c.id}>
                    <button type="button" style={{ background: v.bg }} title={v.title} onClick={() => onCell && onCell(r, c)}
                      className={(v.level ? 'lvl-' + v.level : '') + (sel ? (isPicked(r, c) ? ' picked' : ' dim') : '')} aria-pressed={sel && isPicked(r, c)}>
                      {v.text}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
