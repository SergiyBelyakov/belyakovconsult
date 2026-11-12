// Графіки демо M&E на SVG без бібліотек (крім d3-sankey для потоку грошей).
// Правила: одна вісь; рубіновий лише для критичного; легенда для двох і більше рядів; підказка при наведенні.
import { useMemo, useState } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { C, useWidth } from '../../dashboard/src/charts.jsx';
import { UA_REGIONS, UA_W, UA_H } from '../../chart-gallery/src/ukraine-geo.js';
import { PARTNERS } from './data.js';

export const COL = {
  actual: '#3B82F6', plan: '#94A3B8', fc: '#7DB4FF', band80: 'rgba(59,130,246,.22)', band95: 'rgba(59,130,246,.10)',
  comp: '#94A3B8', cf: '#9CC0F0', crit: '#F0153B', grid: C.grid, surface: C.surface, ok: C.status.healthy, warn: C.status.warning, bad: C.status.critical,
};
export const SEQ = ['#16304F', '#1C4A86', '#2C68C6', '#4D8EEE', '#93BFFF'];
export const STATUS_COL = { healthy: C.status.healthy, warning: C.status.warning, critical: C.status.critical, info: C.status.info };

export function Tip({ x, y, w, children }) {
  if (x == null) return null;
  const side = x < w * 0.3 ? ' tip-l' : x > w * 0.7 ? ' tip-r' : '';
  return <div className={'chart-tip' + side} style={{ left: x, top: y }} role="status">{children}</div>;
}
export function Legend({ items }) {
  return (
    <div className="legend" aria-hidden="true">
      {items.map(it => <span key={it.name}><i className={it.kind || 'line'} style={{ '--c': it.color }} />{it.name}</span>)}
    </div>
  );
}
export const niceTicks = (lo, hi, n = 5) => {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= n) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
};
const pathOf = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

// ——— план, факт і прогноз на шкалі всієї програми (12 кварталів) ———
// points: [{ k, plan, actual, mean, lo80, hi80, lo95, hi95 }]; asOf: останній квартал з фактом
export function TimeChart({ points, asOf, tick, fmtAxis, tip, names, label, height = 250, target, targetLabel, zero = true, pct }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 54, R = 18, T = 16, B = 30, H = height;
  const vals = points.flatMap(p => [p.plan, p.actual, p.hi95, p.lo95, p.mean]).filter(v => v != null && Number.isFinite(v));
  if (target != null) vals.push(target);
  let lo = Math.min(...vals), top = Math.max(...vals);
  if (zero || lo < (top - lo) * 0.6) lo = 0;
  top = pct ? Math.min(100, top + (top - lo) * 0.08) : top + (top - lo) * 0.06;
  const ticks = niceTicks(lo, top, 4);
  top = Math.max(top, ticks[ticks.length - 1]);
  const n = points.length;
  const x = k => L + ((W - L - R) * k) / (n - 1);
  const y = v => T + (H - T - B) * (1 - (v - lo) / (top - lo || 1));
  const plan = points.filter(p => p.plan != null).map(p => [x(p.k), y(p.plan)]);
  const act = points.filter(p => p.k <= asOf && p.actual != null).map(p => [x(p.k), y(p.actual)]);
  const fut = points.filter(p => p.k > asOf && p.mean != null);
  const lastA = act.length ? act[act.length - 1] : null;
  const band = (a, b) => (lastA && fut.length ? pathOf([lastA, ...fut.map(p => [x(p.k), y(p[b])])]) + ' L' + fut.slice().reverse().map(p => `${x(p.k).toFixed(1)},${y(p[a]).toFixed(1)}`).join(' L') + ` L${lastA[0].toFixed(1)},${lastA[1].toFixed(1)} Z` : '');
  const step = (W - L - R) / (n - 1);
  const cur = hi != null ? points[hi] : null;
  return (
    <div className="chart" ref={ref}>
      <Legend items={[{ name: names.actual, color: COL.actual }, { name: names.plan, color: COL.plan, kind: 'dash' }, ...(fut.length ? [{ name: names.fc, color: COL.fc, kind: 'dash' }, { name: names.band, color: COL.actual, kind: 'band' }] : [])]} />
      <svg width={W} height={H} role="img" aria-label={label}>
        {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmtAxis(v)}</text></g>)}
        {points.map(p => (step >= 34 || p.k % 2 === 0 || p.k === asOf) && <text key={p.k} x={x(p.k)} y={H - 9} className={'axis' + (p.k > asOf ? ' axis-faint' : '')} textAnchor="middle">{tick(p.k)}</text>)}
        <rect x={x(asOf)} y={T} width={Math.max(0, W - R - x(asOf))} height={H - T - B} fill="rgba(255,255,255,.025)" />
        <line x1={x(asOf)} x2={x(asOf)} y1={T} y2={H - B} stroke="rgba(244,246,248,.25)" strokeDasharray="2 3" />
        {fut.length > 0 && lastA && <><path d={band('lo95', 'hi95')} fill={COL.band95} /><path d={band('lo80', 'hi80')} fill={COL.band80} /></>}
        {target != null && <g><line x1={x(n - 1) - 18} x2={x(n - 1) + 6} y1={y(target)} y2={y(target)} stroke="#F4F6F8" strokeWidth="1.6" /><text x={x(n - 1) - 22} y={y(target) - 6} className="axis axis-ink" textAnchor="end">{targetLabel}</text></g>}
        <path d={pathOf(plan)} fill="none" stroke={COL.plan} strokeWidth="1.5" strokeDasharray="5 5" />
        {act.length > 1 && <path d={pathOf(act)} fill="none" stroke={COL.actual} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
        {act.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === act.length - 1 ? 4.5 : act.length < 4 ? 3.5 : 0} fill={COL.actual} stroke={COL.surface} strokeWidth="2" />)}
        {fut.length > 0 && lastA && <path d={pathOf([lastA, ...fut.map(p => [x(p.k), y(p.mean)])])} fill="none" stroke={COL.fc} strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />}
        {cur && <line x1={x(cur.k)} x2={x(cur.k)} y1={T} y2={H - B} stroke="rgba(244,246,248,.35)" />}
        {points.map(p => <rect key={'h' + p.k} x={x(p.k) - step / 2} y={T} width={step} height={H - T - B} fill="transparent" onMouseEnter={() => setHi(p.k)} onMouseLeave={() => setHi(null)} onClick={() => setHi(p.k)} />)}
      </svg>
      {cur && <Tip x={x(cur.k)} y={6} w={W}>{tip(cur, cur.k > asOf)}</Tip>}
    </div>
  );
}

// ——— мініатюрна лінія в рядку таблиці ———
export function MiniSpark({ values, w = 84, h = 26, color = COL.actual }) {
  const v = values.filter(x => x != null && Number.isFinite(x));
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((x, i) => [2 + ((w - 4) * i) / (v.length - 1), h - 3 - ((h - 6) * (x - lo)) / span]);
  return (
    <svg width={w} height={h} className="mini-spark" aria-hidden="true">
      <path d={pathOf(pts)} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  );
}

// ——— карта України: області програми за показником, решта приглушено ———
export function UAMap({ values, pick, onPick, name, tipRows, label, legend, marks = {} }) {
  const [ref, W] = useWidth(520);
  const [hv, setHv] = useState(null);
  const s = W / UA_W, H = Math.round(UA_H * s);
  const hover = hv ? UA_REGIONS.find(r => r.id === hv) : null;
  return (
    <div className="chart ua-map" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${UA_W} ${UA_H}`} role="img" aria-label={label}>
        {UA_REGIONS.map(r => {
          const v = values[r.id], on = !!v;
          return (
            <path key={r.id} d={r.d} className={'ua-reg' + (on ? ' on' : '') + (pick === r.id ? ' picked' : '') + (hv === r.id ? ' hover' : '')}
              fill={on ? v.color : 'rgba(255,255,255,.035)'} onMouseEnter={() => setHv(r.id)} onMouseLeave={() => setHv(null)}
              onClick={() => on && onPick && onPick(r.id)} tabIndex={on ? 0 : -1} role={on ? 'button' : undefined} aria-label={on ? name(r.id) : undefined}
              onKeyDown={e => { if (on && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick && onPick(r.id); } }} />
          );
        })}
        {UA_REGIONS.filter(r => values[r.id]).map(r => (
          <g key={'l' + r.id} className="ua-label" pointerEvents="none">
            <text x={r.lx} y={r.ly - 4} textAnchor="middle" className="ua-name">{name(r.id, true)}</text>
            <text x={r.lx} y={r.ly + 18} textAnchor="middle" className="ua-val">{values[r.id].label}</text>
            {marks[r.id] && <circle cx={r.lx} cy={r.ly + 34} r="7" className="ua-mark" />}
          </g>
        ))}
      </svg>
      {hover && values[hover.id] && <Tip x={hover.lx * s} y={Math.max(0, hover.ly * s - 70)} w={W}><b>{name(hover.id)}</b>{tipRows(hover.id)}</Tip>}
      {legend}
    </div>
  );
}

// ——— потік грошей: партнери → напрями ———
export function MoneySankey({ nodes, links, name, fmt, side, label, height = 360, onPick }) {
  const [ref, W0] = useWidth();
  const [hi, setHi] = useState(null);
  const W = Math.max(W0, 560);
  const L = W < 700 ? 118 : 150, R = W < 700 ? 150 : 210, T = 8, B = 8, H = height;
  const g = useMemo(() => {
    const gen = sankey().nodeId(d => d.id).nodeWidth(12).nodePadding(18).nodeSort(null).extent([[L, T], [W - R, H - B]]);
    return gen({ nodes: nodes.map(d => ({ ...d })), links: links.map(d => ({ ...d })) });
  }, [nodes, links, W, H]);
  const path = sankeyLinkHorizontal();
  const isOn = l => hi == null || hi === l.source.id || hi === l.target.id;
  return (
    <div className="chart sankey-wrap" ref={ref}>
      <div className="sankey-scroll">
        <svg width={W} height={H} role="img" aria-label={label}>
          {g.links.map((l, i) => (
            <path key={i} d={path(l)} fill="none" stroke={(l.source.depth === 0 ? l.target.color : l.source.color) || COL.actual} strokeOpacity={isOn(l) ? 0.42 : 0.1} strokeWidth={Math.max(1.5, l.width)}>
              <title>{name(l.source.id) + ' → ' + name(l.target.id) + ': ' + fmt(l.value)}</title>
            </path>
          ))}
          {g.nodes.map(n => {
            const left = n.depth === 0, cy = (n.y0 + n.y1) / 2;
            return (
              <g key={n.id} className="sk-node" onMouseEnter={() => setHi(n.id)} onMouseLeave={() => setHi(null)} onClick={() => onPick && onPick(n.id)}>
                <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(2, n.y1 - n.y0)} rx="2" fill={n.color || '#CBD5E1'} />
                <text x={left ? n.x0 - 8 : n.x1 + 8} y={cy - 2} className="sankey-name" textAnchor={left ? 'end' : 'start'}>{name(n.id)}</text>
                <text x={left ? n.x0 - 8 : n.x1 + 8} y={cy + 13} className="sankey-val" textAnchor={left ? 'end' : 'start'}>{fmt(n.value)}{side && side(n.id) ? '  ·  ' + side(n.id) : ''}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ——— партнери: витрачено (x) проти зробленого (y) ———
export function PartnerScatter({ rows, fmtPct, label, names, onPick, picked, height = 300 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 50, R = 20, T = 14, B = 38, H = height;
  const max = Math.min(1, Math.max(0.8, ...rows.flatMap(r => [r.spent, r.prog])) + 0.05);
  const x = v => L + ((W - L - R) * v) / max, y = v => T + (H - T - B) * (1 - v / max);
  const ticks = niceTicks(0, max, 4);
  const rmax = Math.sqrt(Math.max(...rows.map(r => r.bac)));
  const cur = hi ? rows.find(r => r.p === hi) : null;
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmtPct(v)}</text><text x={x(v)} y={H - 20} className="axis" textAnchor="middle">{fmtPct(v)}</text></g>)}
        <path d={`M${x(0)},${y(0)} L${x(max)},${y(max)} L${x(max)},${y(0)} Z`} fill="rgba(255,107,107,.05)" />
        <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} stroke="rgba(244,246,248,.35)" strokeDasharray="4 4" />
        <text x={x(max) - 6} y={y(0) - 8} className="axis" textAnchor="end">{names.over}</text>
        <text x={x(0) + 6} y={y(max) + 14} className="axis">{names.ok}</text>
        <text x={(L + W - R) / 2} y={H - 4} className="axis axis-ink" textAnchor="middle">{names.x}</text>
        <text x={12} y={T + 4} className="axis axis-ink" transform={`rotate(-90 12 ${T + 4})`} textAnchor="end">{names.y}</text>
        {rows.map(r => {
          const rad = 7 + 18 * (Math.sqrt(r.bac) / rmax), c = PARTNERS[r.p].color;
          return (
            <g key={r.p} className="sc-pt" onMouseEnter={() => setHi(r.p)} onMouseLeave={() => setHi(null)} onClick={() => onPick && onPick(r.p)}>
              <circle cx={x(r.spent)} cy={y(r.prog)} r={rad} fill={c} fillOpacity=".28" stroke={picked === r.p ? '#F4F6F8' : c} strokeWidth={picked === r.p ? 2.4 : 1.6} />
              <text x={x(r.spent)} y={y(r.prog) + 4} textAnchor="middle" className="sc-lbl">{r.p}</text>
            </g>
          );
        })}
      </svg>
      {cur && <Tip x={x(cur.spent)} y={Math.max(0, y(cur.prog) - 92)} w={W}>{names.tip(cur)}</Tip>}
    </div>
  );
}

// ——— лісова діаграма ефектів за групами ———
export function Forest({ rows, fmt, label, lo: lo0, hi: hi0, notProven }) {
  const [ref, W] = useWidth();
  const L = W < 520 ? 142 : Math.min(210, Math.max(150, W * 0.3)), R = W < 520 ? 96 : 128, rowH = 30, T = 8, B = 26;
  const lo = Math.min(lo0 ?? 0, ...rows.map(r => r.lo)), hi = Math.max(hi0 ?? 0, ...rows.map(r => r.hi));
  const ticks = niceTicks(Math.floor(lo), Math.ceil(hi), 5);
  const a = Math.min(ticks[0], lo), b = Math.max(ticks[ticks.length - 1], hi);
  const x = v => L + ((W - L - R) * (v - a)) / (b - a || 1);
  const H = T + rows.length * rowH + B;
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {ticks.map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1={T} y2={H - B} stroke={v === 0 ? 'rgba(244,246,248,.45)' : COL.grid} /><text x={x(v)} y={H - 8} className="axis" textAnchor="middle">{fmt(v, true)}</text></g>)}
        {rows.map((r, i) => {
          const cy = T + i * rowH + rowH / 2, sig = r.lo > 0 || r.hi < 0;
          const c = r.head ? '#F4F6F8' : sig ? COL.actual : C.neutral;
          return (
            <g key={r.id} className={'fr-row' + (r.head ? ' head' : '') + (r.gap ? ' gap' : '')}>
              {r.gap && <line x1={8} x2={W - 8} y1={cy - rowH / 2} y2={cy - rowH / 2} stroke="var(--line)" />}
              <text x={L - 12} y={cy + 4} textAnchor="end" className={'fr-name' + (r.head ? ' head' : '')}>{r.name}</text>
              <line x1={x(r.lo)} x2={x(r.hi)} y1={cy} y2={cy} stroke={c} strokeWidth="2" strokeLinecap="round" />
              <rect x={x(r.est) - 5} y={cy - 5} width="10" height="10" rx="2" fill={sig ? c : COL.surface} stroke={c} strokeWidth="2" />
              <text x={W - R + 10} y={cy + 4} className="fr-val">{fmt(r.est)}{!sig && <tspan className="fr-np"> {notProven}</tspan>}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ——— різниця різниць: дві групи, контрфакт, дужка ефекту ———
export function DidChart({ e, method, names, times, timesShort, fmt, label, height = 280 }) {
  const [ref, W] = useWidth();
  const L = 50, R = W < 520 ? 92 : 170, T = 22, B = 34, H = height;
  const cf1 = e.P0 + (e.C1 - e.C0);
  const vals = [e.P0, e.P1, e.C0, e.C1, cf1];
  const lo = Math.floor((Math.min(...vals) - 6) / 5) * 5, hi = Math.ceil((Math.max(...vals) + 6) / 5) * 5;
  const xs = [L + 20, L + (W - L - R) * 0.55, W - R - 10];
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = niceTicks(lo, hi, 4);
  const br = method === 'pre' ? [e.P0, e.P1, xs[1] + 22] : method === 'post' ? [e.C1, e.P1, xs[1] + 22] : [cf1, e.P1, xs[1] + 22];
  const est = method === 'pre' ? e.pre.est : method === 'post' ? e.post.est : e.did.est;
  return (
    <div className="chart" ref={ref}>
      <Legend items={[{ name: names.P, color: COL.actual }, { name: names.C, color: COL.comp }, ...(method === 'did' ? [{ name: names.cf, color: COL.cf, kind: 'dash' }] : [])]} />
      <svg width={W} height={H} role="img" aria-label={label}>
        {ticks.map(v => <g key={v}><line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{v}%</text></g>)}
        {(W < 560 && timesShort ? timesShort : times).map((t, i) => <text key={i} x={xs[i]} y={H - 10} className={'axis' + (i === 2 ? ' axis-faint' : '')} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{t}</text>)}
        <line x1={xs[2]} x2={xs[2]} y1={T} y2={H - B} stroke="rgba(244,246,248,.18)" strokeDasharray="2 4" />
        <path d={`M${xs[0]},${y(e.C0)} L${xs[1]},${y(e.C1)}`} stroke={COL.comp} strokeWidth="2.2" fill="none" opacity={method === 'pre' ? 0.35 : 1} />
        <path d={`M${xs[0]},${y(e.P0)} L${xs[1]},${y(e.P1)}`} stroke={COL.actual} strokeWidth="2.6" fill="none" />
        {method === 'did' && <path d={`M${xs[0]},${y(e.P0)} L${xs[1]},${y(cf1)}`} stroke={COL.cf} strokeWidth="1.8" strokeDasharray="6 5" fill="none" />}
        {[[e.C0, 0, COL.comp], [e.C1, 1, COL.comp], [e.P0, 0, COL.actual], [e.P1, 1, COL.actual]].map(([v, i, c], j) => <circle key={j} cx={xs[i]} cy={y(v)} r="5" fill={c} stroke={COL.surface} strokeWidth="2" opacity={method === 'pre' && c === COL.comp ? 0.35 : 1} />)}
        {method === 'did' && <circle cx={xs[1]} cy={y(cf1)} r="4.5" fill={COL.surface} stroke={COL.cf} strokeWidth="2" />}
        {method === 'pre' && <circle cx={xs[0] + 0} cy={y(e.P0)} r="9" fill="none" stroke="rgba(244,246,248,.4)" />}
        <g className="did-br">
          <path d={`M${br[2]},${y(br[0])} h6 V${y(br[1])} h-6`} fill="none" stroke="#F4F6F8" strokeWidth="1.6" />
          <text x={br[2] + 12} y={(y(br[0]) + y(br[1])) / 2 + 5} className="did-est">{fmt(est)}</text>
        </g>
        {[[e.P0, e.C0, 0], [e.P1, e.C1, 1]].map(([p, c, i]) => {
          const up = p >= c, x0 = i ? xs[1] - 12 : xs[0] + 12, anchor = i ? 'end' : 'start';
          return (
            <g key={i}>
              <text x={x0} y={y(p) + (up ? -10 : 18)} className="did-lbl" fill={COL.actual} textAnchor={anchor}>{fmt(p, 'v')}</text>
              {(method !== 'pre' || i === 0) && <text x={x0} y={y(c) + (up ? 18 : -10)} className="did-lbl" fill={COL.comp} textAnchor={anchor} opacity={method === 'pre' ? 0.5 : 1}>{fmt(c, 'v')}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ——— дві лінії до програми (паралельні тренди) ———
export function TrendPair({ ticks, a, b, names, label, height = 170 }) {
  const [ref, W] = useWidth();
  const L = 40, R = 14, T = 10, B = 26, H = height;
  const vals = [...a, ...b], lo = Math.floor(Math.min(...vals) / 5) * 5 - 5, hi = Math.ceil(Math.max(...vals) / 5) * 5 + 5;
  const x = i => L + ((W - L - R) * i) / (a.length - 1), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const tk = niceTicks(lo, hi, 3);
  return (
    <div className="chart" ref={ref}>
      <Legend items={[{ name: names.P, color: COL.actual }, { name: names.C, color: COL.comp }]} />
      <svg width={W} height={H} role="img" aria-label={label}>
        {tk.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}</text></g>)}
        {ticks.map((t, i) => (W > 420 || i % 2 === 0) && <text key={i} x={x(i)} y={H - 8} className="axis" textAnchor="middle">{t}</text>)}
        <path d={pathOf(b.map((v, i) => [x(i), y(v)]))} stroke={COL.comp} strokeWidth="2" fill="none" />
        <path d={pathOf(a.map((v, i) => [x(i), y(v)]))} stroke={COL.actual} strokeWidth="2.2" fill="none" />
      </svg>
    </div>
  );
}

// ——— остання цифра: частки з лінією 10% ———
export function DigitBars({ d, label, expected, height = 170 }) {
  const [ref, W] = useWidth();
  const L = 36, R = 10, T = 12, B = 24, H = height;
  const n = d.reduce((s, v) => s + v, 0), sh = d.map(v => v / n);
  const max = Math.max(0.2, ...sh) * 1.1;
  const bw = (W - L - R) / 10;
  const y = v => T + (H - T - B) * (1 - v / max);
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {niceTicks(0, max, 3).map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{Math.round(v * 100)}%</text></g>)}
        {sh.map((v, i) => {
          const high = v > 0.16;
          return (
            <g key={i}>
              <rect x={L + i * bw + 3} y={y(v)} width={bw - 6} height={y(0) - y(v)} rx="2" fill={high ? COL.warn : COL.actual} opacity={high ? 0.95 : 0.7}><title>{i}: {Math.round(v * 1000) / 10}%</title></rect>
              <text x={L + i * bw + bw / 2} y={H - 8} className="axis" textAnchor="middle">{i}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(0.1)} y2={y(0.1)} stroke="#F4F6F8" strokeDasharray="4 4" />
        <text x={W - R} y={y(0.1) - 5} className="axis axis-ink" textAnchor="end">{expected}</text>
      </svg>
    </div>
  );
}

// ——— потреба й охоплення за областями ———
export function NeedReach({ rows, fmt, pctFmt, label, picked, onPick, median, medianLabel }) {
  const max = Math.max(...rows.map(r => r.pin));
  return (
    <div className="need-list" role="list" aria-label={label}>
      {rows.map(r => (
        <button type="button" key={r.id} role="listitem" className={'need-row' + (picked === r.id ? ' picked' : '')} onClick={() => onPick && onPick(r.id)}>
          <span className="need-name">{r.name}{r.flag && <em className="need-flag">{r.flag}</em>}</span>
          <span className="need-track" style={{ '--w': (r.pin / max) * 100 + '%' }}>
            <i className="need-pin" />
            <i className="need-reach" style={{ width: (r.unique / max) * 100 + '%' }} />
            {median != null && <s style={{ left: ((median * r.pin) / max) * 100 + '%' }} title={medianLabel} />}
          </span>
          <span className="need-val"><b>{pctFmt(r.coverage)}</b><small>{fmt(r.unique)} / {fmt(r.pin)}</small></span>
        </button>
      ))}
    </div>
  );
}

// ——— горизонтальний «водоспад» охоплення ———
export function ReachSteps({ steps, fmt, label }) {
  const max = Math.max(...steps.map(s => s.base + (s.v > 0 ? s.v : 0)), ...steps.map(s => s.total || 0));
  return (
    <div className="steps" role="list" aria-label={label}>
      {steps.map(s => (
        <div key={s.id} className={'step-row ' + s.kind} role="listitem">
          <span className="step-name">{s.name}</span>
          <span className="step-track">
            <i style={{ left: ((s.total != null ? 0 : s.base) / max) * 100 + '%', width: (Math.abs(s.total != null ? s.total : s.v) / max) * 100 + '%' }} />
          </span>
          <span className="step-val">{s.total != null ? fmt(s.total) : '−' + fmt(Math.abs(s.v))}</span>
        </div>
      ))}
    </div>
  );
}
