// Графіки фрод-демо на SVG: криві (ROC, вигода), гістограма оцінок, матриця помилок, коефіцієнти, граф мережі.
import { useMemo, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { C, useWidth } from '../../dashboard/src/charts.jsx';

export { C };
export const MODEL_COLOR = { rules: '#A855F7', logit: '#3B82F6', combo: '#019586' };

function Tip({ x, y, w, children }) {
  if (x == null) return null;
  const side = x < w * 0.3 ? ' tip-l' : x > w * 0.7 ? ' tip-r' : '';
  return <div className={'chart-tip' + side} style={{ left: x, top: y }} role="status">{children}</div>;
}

// Кілька ліній у координатах 0..1 (ROC) або довільних; marks: точки поточного стану
export function Curves({ series, xDomain = [0, 1], yDomain = [0, 1], xFmt, yFmt, xLabel, yLabel, marks = [], diagonal, height = 300, label, xTicks = 5, yTicks = 5 }) {
  const [ref, W] = useWidth();
  const L = 52, R = 14, T = 12, B = 42, H = height;
  const x = v => L + (W - L - R) * (v - xDomain[0]) / (xDomain[1] - xDomain[0]);
  const y = v => T + (H - T - B) * (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0]));
  const tick = (d, n) => Array.from({ length: n + 1 }, (_, i) => d[0] + (d[1] - d[0]) * i / n);
  const clip = 'clip-' + (label || 'c').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) + series.length;
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        <defs><clipPath id={clip}><rect x={L} y={T - 4} width={W - L - R} height={H - T - B + 8} /></clipPath></defs>
        {tick(yDomain, yTicks).map(v => <g key={'y' + v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{yFmt(v)}</text></g>)}
        {tick(xDomain, xTicks).map(v => <text key={'x' + v} x={x(v)} y={H - B + 16} className="axis" textAnchor="middle">{xFmt(v)}</text>)}
        {xLabel && <text x={(L + W - R) / 2} y={H - 6} className="axis" textAnchor="middle">{xLabel}</text>}
        {yLabel && <text x={12} y={(T + H - B) / 2} className="axis" textAnchor="middle" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>{yLabel}</text>}
        {diagonal && <line x1={x(xDomain[0])} y1={y(yDomain[0])} x2={x(xDomain[1])} y2={y(yDomain[1])} stroke={C.slate} strokeDasharray="4 5" />}
        {series.map(s => (
          <path key={s.id} clipPath={`url(#${clip})`} d={s.pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ')} fill="none" stroke={s.color}
            strokeWidth={s.strong ? 2.6 : 1.6} opacity={s.strong ? 1 : 0.55} strokeLinejoin="round" />
        ))}
        {marks.map((m, i) => (
          <g key={i}>
            <circle cx={x(m.x)} cy={y(m.y)} r="6" fill={C.ruby} stroke={C.surface} strokeWidth="2" />
            {m.label && <text x={x(m.x) + 10} y={y(m.y) + 4} className="value-label">{m.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// Гістограма оцінок: чесні й шахрайство поруч, шкала кількості коренева, щоб рідкісне шахрайство було видно
export function ScoreHist({ bins, th, label, tip, height = 230 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 40, R = 10, T = 10, B = 26, H = height;
  const max = Math.max(...bins.map(b => Math.max(b.ok, b.fraud)));
  const s = v => Math.sqrt(v) / Math.sqrt(max || 1);
  const band = (W - L - R) / bins.length, bw = band * 0.42;
  const x = i => L + band * i;
  const yv = v => T + (H - T - B) * (1 - s(v));
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={C.grid} />
        {bins.map((b, i) => (
          <g key={i} opacity={hi == null || hi === i ? 1 : 0.6} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)}>
            <rect x={x(i) + band * 0.08} y={yv(b.ok)} width={bw} height={H - B - yv(b.ok)} fill={C.neutral} opacity=".55" rx="2" />
            <rect x={x(i) + band * 0.08 + bw} y={yv(b.fraud)} width={bw} height={H - B - yv(b.fraud)} fill={C.status.critical} rx="2" />
            <rect x={x(i)} y={T} width={band} height={H - T - B} fill="transparent" />
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map(v => <text key={v} x={L + (W - L - R) * v} y={H - 8} className="axis" textAnchor="middle">{v.toFixed(2).replace(/0$/, '')}</text>)}
        <line x1={L + (W - L - R) * th} x2={L + (W - L - R) * th} y1={T - 4} y2={H - B} stroke={C.ruby} strokeWidth="2" />
      </svg>
      {hi != null && <Tip x={x(hi) + band / 2} y={0} w={W}>{tip(bins[hi])}</Tip>}
    </div>
  );
}

export function Confusion({ c, T, f }) {
  const cell = (k, cls) => <div className={'conf-cell ' + cls}><b>{f.int(c[k])}</b><span>{T.conf[k]}</span></div>;
  return (
    <div className="conf">
      {cell('tp', 'good-cell')}{cell('fp', 'warn-cell')}{cell('fn', 'bad-cell')}{cell('tn', 'calm-cell')}
    </div>
  );
}

// Коефіцієнти зі знаком: праворуч підвищують ризик, ліворуч знижують
export function SignedBars({ items, fmt }) {
  const max = Math.max(...items.map(i => Math.abs(i.value))) || 1;
  return (
    <div className="signed">
      {items.map(it => (
        <div key={it.id} className={'signed-row' + (it.picked ? ' picked' : '')}>
          <span className="signed-name">{it.name}</span>
          <span className="signed-track">
            <i className={it.value >= 0 ? 'pos' : 'neg'} style={{ width: (Math.abs(it.value) / max) * 50 + '%', [it.value >= 0 ? 'left' : 'right']: '50%' }} />
          </span>
          <span className="signed-value">{fmt(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Граф мережі: отримувачі, спільні рахунки й телефони. Розкладка рахується один раз (d3-force).
export function ClusterGraph({ cluster, onPick, picked, height = 360, label }) {
  const [ref, W] = useWidth();
  const layout = useMemo(() => {
    const nodes = [], links = [], seen = new Map();
    cluster.members.forEach(m => nodes.push({ id: m.id, type: 'person', m }));
    for (const [key, type] of [['iban', 'iban'], ['phone', 'phone']]) {
      const by = new Map();
      cluster.members.forEach(m => { if (!by.has(m[key])) by.set(m[key], []); by.get(m[key]).push(m.id); });
      by.forEach((ids, k) => { if (ids.length < 2) return; const nid = type + ':' + k; if (!seen.has(nid)) { seen.set(nid, 1); nodes.push({ id: nid, type }); } ids.forEach(id => links.push({ source: id, target: nid })); });
    }
    const sim = forceSimulation(nodes).force('link', forceLink(links).id(d => d.id).distance(34).strength(0.9))
      .force('charge', forceManyBody().strength(-90)).force('center', forceCenter(0, 0)).force('collide', forceCollide(12)).stop();
    for (let i = 0; i < 260; i++) sim.tick();
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    return { nodes, links, box: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] };
  }, [cluster.id]);
  const [x0, x1, y0, y1] = layout.box, pad = 24, H = height;
  const k = Math.min((W - pad * 2) / (x1 - x0 || 1), (H - pad * 2) / (y1 - y0 || 1), 3);
  const px = v => W / 2 + (v - (x0 + x1) / 2) * k, py = v => H / 2 + (v - (y0 + y1) / 2) * k;
  const col = s => (s >= 0.6 ? C.status.critical : s >= 0.35 ? C.status.warning : C.neutral);
  return (
    <div className="chart cluster-graph" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {layout.links.map((l, i) => <line key={i} x1={px(l.source.x)} y1={py(l.source.y)} x2={px(l.target.x)} y2={py(l.target.y)} stroke="rgba(168,176,188,.35)" />)}
        {layout.nodes.map(n => n.type === 'person' ? (
          <circle key={n.id} cx={px(n.x)} cy={py(n.y)} r={picked === n.id ? 9 : 7} fill={col(n.m.score.combo)} stroke={picked === n.id ? C.ruby : C.surface} strokeWidth="2"
            style={{ cursor: 'pointer' }} onClick={() => onPick && onPick(n.id)}><title>{n.id}</title></circle>
        ) : n.type === 'iban' ? (
          <rect key={n.id} x={px(n.x) - 6} y={py(n.y) - 6} width="12" height="12" rx="2" fill="#0E131B" stroke="#9CC0F0" strokeWidth="1.6" />
        ) : (
          <path key={n.id} d={`M${px(n.x)},${py(n.y) - 7} L${px(n.x) + 7},${py(n.y)} L${px(n.x)},${py(n.y) + 7} L${px(n.x) - 7},${py(n.y)} Z`} fill="#0E131B" stroke="#F0ABFC" strokeWidth="1.6" />
        ))}
      </svg>
    </div>
  );
}
