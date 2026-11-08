// Нові графіки панелі керівника: віяло прогнозу, сценарій проти бази, рух грошей (Санкі), дерево причин,
// внесок факторів, теплова карта ризиків, когорти, граф залежностей і матриця «ефект × ризик».
// Правила: одна вісь; рубіновий лише для критичного (поріг, критичний стан); легенда для двох і більше рядів;
// у кожного графіка є підказка при наведенні і текстова або таблична альтернатива поруч.
import { useMemo, useState } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { C, useWidth } from '../../dashboard/src/charts.jsx';
import { Icon, StatusIcon } from '../../dashboard/src/icons.jsx';

export const COL = {
  actual: '#3B82F6', plan: '#94A3B8', fc: '#7DB4FF', band80: 'rgba(59,130,246,.22)', band95: 'rgba(59,130,246,.10)',
  base: '#94A3B8', scen: '#3B82F6', crit: '#F0153B', critFill: 'rgba(217,4,41,.08)', saved: '#EC4899', pick: '#9CC0F0',
  good: C.status.healthy, bad: C.status.critical, warn: C.status.warning, grid: C.grid, surface: C.surface,
};

function Tip({ x, y, w, children }) {
  if (x == null) return null;
  const side = x < w * 0.3 ? ' tip-l' : x > w * 0.7 ? ' tip-r' : '';
  return <div className={'chart-tip' + side} style={{ left: x, top: y }} role="status">{children}</div>;
}
export function Legend({ items }) {
  return (
    <div className="legend" aria-hidden="true">
      {items.map(it => (
        <span key={it.name}><i className={it.kind || 'line'} style={{ '--c': it.color }} />{it.name}</span>
      ))}
    </div>
  );
}
const niceTicks = (lo, hi, n = 5) => {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= n) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
};

// ——— віяло прогнозу: факт, план, центральний прогноз і межі 80% та 95% ———
export function FanChart({ hist, fut, fmtAxis, tip, threshold, label, height = 270, names }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 52, R = 16, T = 18, B = 30, H = height;
  const all = [...hist, ...fut];
  const vals = [...hist.flatMap(d => [d.actual, d.plan]), ...fut.flatMap(d => [d.lo95, d.hi95, d.plan]), ...(threshold ? [threshold.value] : [])].filter(v => v != null && Number.isFinite(v));
  let lo = Math.min(...vals), top = Math.max(...vals);
  const pad = (top - lo) * 0.08 || 1; lo -= pad; top += pad;
  if (lo > 0 && lo < (top - lo) * 0.4) lo = 0;
  const ticks = niceTicks(lo, top);
  const x = k => L + (W - L - R) * (all.length === 1 ? 0.5 : k / (all.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (top - lo || 1));
  const n0 = hist.length - 1;
  const line = (pts) => pts.map((p, k) => (k ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const lastA = hist[n0].actual;
  const band = (a, b) => {
    const up = [[x(n0), y(lastA)], ...fut.map((d, k) => [x(n0 + 1 + k), y(d[b])])];
    const dn = [...fut.map((d, k) => [x(n0 + 1 + k), y(d[a])])].reverse();
    return line([...up, ...dn]) + ' Z';
  };
  const step = (W - L - R) / Math.max(1, all.length - 1);
  const every = step >= 30 ? 1 : step >= 16 ? 2 : 3;
  const cur = hi != null ? all[hi] : null;
  return (
    <div className="chart" ref={ref}>
      <Legend items={[{ name: names.actual, color: COL.actual }, { name: names.plan, color: COL.plan, kind: 'dash' }, { name: names.fc, color: COL.fc, kind: 'dash' }, { name: names.band, color: COL.actual, kind: 'band' }, ...(threshold ? [{ name: threshold.label, color: COL.crit }] : [])]} />
      <svg width={W} height={H} role="img" aria-label={label}>
        {ticks.map(v => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmtAxis(v)}</text></g>
        ))}
        {all.map((d, k) => (k % every === (all.length - 1) % every || k === n0) && <text key={d.m} x={x(k)} y={H - 9} className={'axis' + (k > n0 ? ' axis-faint' : '')} textAnchor="middle">{d.tick}</text>)}
        <rect x={x(n0)} y={T} width={Math.max(0, W - R - x(n0))} height={H - T - B} fill="rgba(255,255,255,.025)" />
        <line x1={x(n0)} x2={x(n0)} y1={T} y2={H - B} stroke="rgba(244,246,248,.25)" strokeDasharray="2 3" />
        <path d={band('lo95', 'hi95')} fill={COL.band95} />
        <path d={band('lo80', 'hi80')} fill={COL.band80} />
        {threshold && <g><line x1={L} x2={W - R} y1={y(threshold.value)} y2={y(threshold.value)} stroke={COL.crit} strokeWidth="1.4" strokeDasharray="6 4" /></g>}
        <path d={line(all.map((d, k) => [x(k), y(d.plan)]).filter((p, k) => all[k].plan != null))} fill="none" stroke={COL.plan} strokeWidth="1.5" strokeDasharray="5 5" />
        <path d={line(hist.map((d, k) => [x(k), y(d.actual)]))} fill="none" stroke={COL.actual} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line([[x(n0), y(lastA)], ...fut.map((d, k) => [x(n0 + 1 + k), y(d.mean)])])} fill="none" stroke={COL.fc} strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
        <circle cx={x(n0)} cy={y(lastA)} r="4.5" fill={COL.actual} stroke={COL.surface} strokeWidth="2" />
        {cur && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="rgba(244,246,248,.35)" />}
        {cur && <circle cx={x(hi)} cy={y(cur.actual ?? cur.mean)} r="4" fill={COL.surface} stroke={hi > n0 ? COL.fc : COL.actual} strokeWidth="2" />}
        {all.map((d, k) => <rect key={'h' + k} x={x(k) - step / 2} y={T} width={step} height={H - T - B} fill="transparent" onMouseEnter={() => setHi(k)} onMouseLeave={() => setHi(null)} onClick={() => setHi(k)} />)}
      </svg>
      {cur && <Tip x={x(hi)} y={6} w={W}>{tip(cur, hi > n0)}</Tip>}
    </div>
  );
}

// ——— база проти сценарію (з межами бази і порогом) ———
export function ScenarioChart({ ticks, base, scen, band, threshold, fmtAxis, tip, label, names, height = 240 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 52, R = 14, T = 16, B = 28, H = height;
  const vals = [...base, ...scen, ...(band ? band.flatMap(b => [b.lo, b.hi]) : []), ...(threshold ? [threshold.value] : [])];
  let lo = Math.min(...vals), top = Math.max(...vals);
  const pad = (top - lo) * 0.1 || 1; lo -= pad; top += pad;
  const tk = niceTicks(lo, top);
  const x = k => L + (W - L - R) * (base.length === 1 ? 0.5 : k / (base.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (top - lo || 1));
  const path = vs => vs.map((v, k) => (k ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const step = (W - L - R) / Math.max(1, base.length - 1);
  const same = base.every((v, k) => Math.abs(v - scen[k]) < 0.5);
  return (
    <div className="chart" ref={ref}>
      <Legend items={[{ name: names.base, color: COL.base, kind: 'dash' }, ...(same ? [] : [{ name: names.scen, color: COL.scen }]), ...(band ? [{ name: names.band, color: COL.base, kind: 'band' }] : []), ...(threshold ? [{ name: threshold.label, color: COL.crit }] : [])]} />
      <svg width={W} height={H} role="img" aria-label={label}>
        {tk.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmtAxis(v)}</text></g>)}
        {ticks.map((t, k) => (step >= 34 || k % 2 === 0) && <text key={k} x={x(k)} y={H - 8} className="axis" textAnchor="middle">{t}</text>)}
        {band && <path d={path(band.map(b => b.hi)) + ' ' + band.map((b, k) => 'L' + x(band.length - 1 - k).toFixed(1) + ',' + y(band[band.length - 1 - k].lo).toFixed(1)).join(' ') + ' Z'} fill="rgba(148,163,184,.14)" />}
        {threshold && <line x1={L} x2={W - R} y1={y(threshold.value)} y2={y(threshold.value)} stroke={COL.crit} strokeWidth="1.4" strokeDasharray="6 4" />}
        {lo < 0 && top > 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="rgba(244,246,248,.3)" />}
        <path d={path(base)} fill="none" stroke={COL.base} strokeWidth="1.8" strokeDasharray="5 4" />
        {!same && <path d={path(scen)} fill="none" stroke={COL.scen} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
        {threshold && scen.map((v, k) => v < threshold.value && <circle key={k} cx={x(k)} cy={y(v)} r="3.5" fill={COL.crit} stroke={COL.surface} strokeWidth="1.5" />)}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="rgba(244,246,248,.35)" />}
        {base.map((_, k) => <rect key={k} x={x(k) - step / 2} y={T} width={step} height={H - T - B} fill="transparent" onMouseEnter={() => setHi(k)} onMouseLeave={() => setHi(null)} onClick={() => setHi(k)} />)}
      </svg>
      {hi != null && <Tip x={x(hi)} y={6} w={W}>{tip(hi)}</Tip>}
    </div>
  );
}

// ——— рух грошей: Санкі ———
const LINK_COL = { in: 'rgba(59,130,246,.38)', stuck: 'rgba(240,21,59,.55)', drawdown: 'rgba(255,176,32,.45)', out: 'rgba(148,163,184,.30)' };
const NODE_COL = { client: COL.actual, in: COL.actual, stuck: COL.crit, drawdown: COL.warn, pool: '#E2E8F0', out: '#94A3B8', saved: COL.good };
export function SankeyChart({ data, name, fmt, label, height = 430 }) {
  const [ref, W0] = useWidth();
  const [hi, setHi] = useState(null);
  const W = Math.max(W0, 640);
  const L = W < 760 ? 112 : 132, R = W < 760 ? 142 : 168, T = 10, B = 10, H = height;
  const g = useMemo(() => {
    const gen = sankey().nodeId(d => d.index).nodeAlign(n => n.col).nodeWidth(12).nodePadding(26).nodeSort(null).extent([[L, T], [W - R, H - B]]);
    return gen({ nodes: data.nodes.map(d => ({ ...d })), links: data.links.map(d => ({ ...d })) });
  }, [data, W, H]);
  const path = sankeyLinkHorizontal();
  const isOn = l => hi == null || hi === 'l' + l.index || hi === 'n' + l.source.index || hi === 'n' + l.target.index;
  const tipL = hi && hi[0] === 'l' ? g.links[+hi.slice(1)] : null;
  const tipN = hi && hi[0] === 'n' ? g.nodes[+hi.slice(1)] : null;
  return (
    <div className="chart sankey-wrap" ref={ref}>
      <div className="sankey-scroll">
        <svg width={W} height={H} role="img" aria-label={label}>
          {g.links.map(l => (
            <path key={l.index} d={path(l)} fill="none" stroke={LINK_COL[l.kind]} strokeWidth={Math.max(1.5, l.width)} opacity={isOn(l) ? 1 : 0.25}
              onMouseEnter={() => setHi('l' + l.index)} onMouseLeave={() => setHi(null)} onClick={() => setHi('l' + l.index)} />
          ))}
          {g.nodes.map(n => {
            const left = n.col === 0, right = n.col === 3;
            const tx = left ? n.x0 - 8 : n.x1 + 8, cy = (n.y0 + n.y1) / 2, small = n.y1 - n.y0 < 24;
            return (
              <g key={n.index} onMouseEnter={() => setHi('n' + n.index)} onMouseLeave={() => setHi(null)} onClick={() => setHi('n' + n.index)}>
                <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(2, n.y1 - n.y0)} rx="2" fill={NODE_COL[n.kind]} />
                {small ? (
                  <text x={tx} y={cy + 4} className="sankey-name" textAnchor={left ? 'end' : 'start'}>{name(n.id)} <tspan className="sankey-val">{fmt(n.value)}</tspan></text>
                ) : (
                  <>
                    <text x={tx} y={cy - 2} className="sankey-name" textAnchor={left ? 'end' : 'start'}>{name(n.id)}</text>
                    <text x={tx} y={cy + 13} className="sankey-val" textAnchor={left ? 'end' : 'start'}>{fmt(n.value)}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {tipL && <div className="chart-tip sankey-tip" style={{ left: '50%', top: 6 }}><b>{name(tipL.source.id)} → {name(tipL.target.id)}</b><strong>{fmt(tipL.value)}</strong></div>}
      {tipN && <div className="chart-tip sankey-tip" style={{ left: '50%', top: 6 }}><b>{name(tipN.id)}</b><strong>{fmt(tipN.value)}</strong></div>}
    </div>
  );
}

// ——— дерево причин: колонки рівнів, у кожній гілки, відсортовані від найгіршої ———
// path: вибрані вузли рівнів 1..n (підрозділ, продукт, стаття, фактор)
export function DecompTree({ root, index, path, onPick, name, fmt, levels, pctOf }) {
  const cols = [{ nodes: [root], sel: root.id, parent: null }];
  let parent = root;
  for (let c = 0; c < path.length && parent.children.length; c++) {
    cols.push({ nodes: parent.children, sel: path[c], parent: parent.id });
    parent = index.get(path[c]);
    if (!parent) break;
  }
  if (parent && parent.children.length && cols.length <= path.length + 1 && !path.includes(parent.children[0].id)) cols.push({ nodes: parent.children, sel: null, parent: parent.id });
  return (
    <div className="dtree" role="tree" aria-label={levels[0]}>
      {cols.map((col, c) => {
        const max = Math.max(1, ...col.nodes.map(n => Math.abs(n.value)));
        return (
          <div className="dtree-col" key={c + ':' + (col.parent || 'root')} role="group" aria-label={levels[c]}>
            <div className="dtree-head">{levels[c]}</div>
            {col.nodes.map(n => {
              const on = n.id === col.sel;
              return (
                <button type="button" key={n.id} role="treeitem" aria-selected={on} aria-level={c + 1}
                  className={'dnode' + (on ? ' on' : '') + (n.value < 0 ? ' neg' : ' pos') + (n.children.length ? '' : ' leaf') + (c === 0 ? ' root' : '')}
                  onClick={() => c > 0 && onPick(c, n)}>
                  <span className="dnode-name">{name(n)}</span>
                  <span className="dnode-val">{fmt(n.value)}{pctOf && c > 0 && <small>{pctOf(n, c)}</small>}</span>
                  <span className="dnode-bar"><i style={{ width: Math.max(2, (Math.abs(n.value) / max) * 100) + '%' }} /></span>
                  {n.children.length > 0 && c > 0 && <Icon name="chevronRight" size={14} className="dnode-go" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ——— внесок факторів (Парето): від'ємні від найбільшого, накопичена частка ———
export function Pareto({ items, fmt, name, sub, onPick, note }) {
  const negTotal = items.filter(x => x.value < 0).reduce((s, x) => s + x.value, 0) || -1;
  const max = Math.max(1, ...items.map(x => Math.abs(x.value)));
  let acc = 0;
  return (
    <div className="pareto">
      {items.map(x => {
        if (x.value < 0) acc += x.value;
        return (
          <button type="button" key={x.id} className={'pareto-row' + (x.value < 0 ? ' neg' : ' pos')} onClick={() => onPick && onPick(x)}>
            <span className="pareto-name">{name(x)}{sub && sub(x) && <small>{sub(x)}</small>}</span>
            <span className="pareto-bar"><i style={{ width: (Math.abs(x.value) / max) * 100 + '%' }} /></span>
            <span className="pareto-val">{fmt(x.value)}</span>
            <span className="pareto-cum">{x.value < 0 ? Math.round((acc / negTotal) * 100) + '%' : ''}</span>
          </button>
        );
      })}
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}

// ——— теплова карта ризиків: рядки підрозділів, стовпці категорій; стан іконкою, словом і кольором ———
export function RiskHeat({ rows, cols, colName, rowName, cellText, onCell, T }) {
  return (
    <div className="table-scroll">
      <table className="heat-table">
        <thead><tr><th />{cols.map(c => <th key={c}>{colName(c)}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.unit || 'co'}>
              <th scope="row">{rowName(r.unit)}</th>
              {cols.map(c => {
                const cell = r.cells[c];
                if (!cell) return <td key={c} className="heat-na">·</td>;
                return (
                  <td key={c}>
                    <button type="button" className={'heat-cell ' + cell.level} onClick={() => onCell(r.unit, c)} title={T.status[cell.level]}>
                      <StatusIcon level={cell.level} size={12} /><span>{cellText(cell)}</span>
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

// ——— когорти: частка, що лишилась; послідовна синя шкала, значення підписані ———
const SEQ = ['#20385F', '#2A4F86', '#3F6DAE', '#5B8FD0', '#82B1EA', '#ACD5FF'];
export function CohortGrid({ rows, cols, colName, rowName, sizeName, lo = 0.5, hi = 1 }) {
  const bg = v => SEQ[Math.max(0, Math.min(SEQ.length - 1, Math.floor(((v - lo) / (hi - lo)) * SEQ.length)))];
  return (
    <div className="table-scroll">
      <table className="cohort-table">
        <thead><tr><th>{rowName}</th><th className="num">{sizeName}</th>{cols.map(c => <th key={c} className="num">{colName(c)}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td className="num muted">{r.size}</td>
              {r.cells.map((v, k) => (
                <td key={k} className="num">
                  {v == null ? <span className="muted">·</span> : <span className="cohort-cell" style={{ background: bg(v), color: v > lo + (hi - lo) * 0.62 ? '#0B1422' : '#F4F6F8' }}>{Math.round(v * 100)}%</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ——— граф залежностей: колонки «люди → процеси → клієнти → фінанси» ———
const LV = { healthy: COL.good, warning: COL.warn, critical: COL.crit, info: '#64748B' };
export function DepGraph({ nodes, edges, cols, colName, name, value, sel, onSel, label }) {
  const [ref, W0] = useWidth();
  const W = Math.max(W0, 780);
  const nw = W < 900 ? 138 : 158, nh = 46, padX = 16, padR = 46, top = 40;
  const byCol = cols.map(c => nodes.filter(n => n.col === c));
  const rowsMax = Math.max(...byCol.map(c => c.length));
  const H = top + rowsMax * (nh + 22) + 8;
  const pos = {};
  byCol.forEach((ns, ci) => {
    const x = padX + ci * ((W - padX - padR - nw) / (cols.length - 1));
    const off = ((rowsMax - ns.length) * (nh + 22)) / 2;
    ns.forEach((n, k) => { pos[n.id] = { x, y: top + off + k * (nh + 22) }; });
  });
  const near = id => !sel || sel === id || edges.some(e => (e.id === sel && (e.from === id || e.to === id)) || ((e.from === sel || e.to === sel) && (e.from === id || e.to === id)));
  const edgeOn = e => !sel || e.id === sel || e.from === sel || e.to === sel;
  const ePath = e => {
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b) return '';
    if (Math.abs(a.x - b.x) < 2) {
      const x0 = a.x + nw, y0 = a.y + nh / 2, y1 = b.y + nh / 2;
      return `M${x0},${y0} C${x0 + 34},${y0} ${x0 + 34},${y1} ${x0 + 2},${y1}`;
    }
    const fwd = b.x > a.x;
    const x0 = fwd ? a.x + nw : a.x, y0 = a.y + nh / 2, x1 = fwd ? b.x - 4 : b.x + nw + 4, y1 = b.y + nh / 2, mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  };
  return (
    <div className="chart dep-wrap" ref={ref}>
      <div className="dep-scroll">
        <svg width={W} height={H} role="img" aria-label={label}>
          <defs>
            <marker id="dep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#CBD5E1" /></marker>
            <marker id="dep-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={COL.actual} /></marker>
          </defs>
          {cols.map((c, ci) => <text key={c} x={(pos[byCol[ci][0]?.id]?.x ?? 0) + nw / 2} y={16} textAnchor="middle" className="dep-col">{colName(c)}</text>)}
          {edges.map(e => {
            const on = edgeOn(e), picked = sel === e.id;
            const corr = e.type === 'corr';
            return (
              <g key={e.id} className="dep-edge" onClick={() => onSel(picked ? null : e.id)}>
                <path d={ePath(e)} fill="none" stroke="transparent" strokeWidth="14" />
                <path d={ePath(e)} fill="none" stroke={picked || (on && sel) ? COL.actual : corr ? '#FFB020' : 'rgba(203,213,225,.55)'} strokeWidth={1.2 + 3 * Math.abs(e.r)} strokeDasharray={corr ? '6 5' : undefined}
                  opacity={on ? 1 : 0.15} markerEnd={corr ? undefined : picked || (on && sel) ? 'url(#dep-arrow-on)' : 'url(#dep-arrow)'} />
              </g>
            );
          })}
          {nodes.map(n => {
            const p = pos[n.id], on = near(n.id), picked = sel === n.id;
            return (
              <g key={n.id} className={'dep-node' + (picked ? ' picked' : '')} transform={`translate(${p.x},${p.y})`} opacity={on ? 1 : 0.3} onClick={() => onSel(picked ? null : n.id)} tabIndex="0" role="button" aria-pressed={picked}
                onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSel(picked ? null : n.id); } }}>
                <rect width={nw} height={nh} rx="5" fill="rgba(14,19,27,.92)" stroke={picked ? COL.actual : 'rgba(255,255,255,.16)'} strokeWidth={picked ? 2 : 1} />
                <rect width="4" height={nh} rx="2" fill={LV[n.level]} />
                <text x="12" y="19" className="dep-name">{name(n.id)}</text>
                <text x="12" y="36" className="dep-val">{value(n)}</text>
                {n.company && <text x={nw - 8} y="15" textAnchor="end" className="dep-co">◆</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// Два ряди в стандартизованих одиницях (σ від середнього) на одній осі: так порівнюють форму, а не масштаб
export function ZPair({ a, b, ticks, names, lag, label, height = 170 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const z = s => { const m = s.reduce((x, y) => x + y, 0) / s.length, sd = Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / s.length) || 1; return s.map(v => (v - m) / sd); };
  const za = z(a), zb = z(b);
  const L = 30, R = 10, T = 12, B = 24, H = height;
  const lo = Math.min(-2, ...za, ...zb), top = Math.max(2, ...za, ...zb);
  const x = k => L + (W - L - R) * (k / Math.max(1, a.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (top - lo));
  const p = s => s.map((v, k) => (k ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const step = (W - L - R) / Math.max(1, a.length - 1);
  return (
    <div className="chart" ref={ref}>
      <Legend items={[{ name: names[0], color: COL.actual }, { name: names[1], color: COL.saved }]} />
      <svg width={W} height={H} role="img" aria-label={label}>
        {[-2, 0, 2].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0'}σ</text></g>)}
        <text x={L} y={H - 6} className="axis">{ticks[0]}</text>
        <text x={W - R} y={H - 6} className="axis" textAnchor="end">{ticks[ticks.length - 1]}</text>
        <path d={p(za)} fill="none" stroke={COL.actual} strokeWidth="2" />
        <path d={p(zb)} fill="none" stroke={COL.saved} strokeWidth="2" />
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="rgba(244,246,248,.35)" />}
        {a.map((_, k) => <rect key={k} x={x(k) - step / 2} y={T} width={step} height={H - T - B} fill="transparent" onMouseEnter={() => setHi(k)} onMouseLeave={() => setHi(null)} onClick={() => setHi(k)} />)}
      </svg>
      {hi != null && <Tip x={x(hi)} y={4} w={W}><b>{ticks[hi]}</b><small>{names[0]}: {za[hi].toFixed(1)}σ</small><small>{names[1]}: {zb[hi].toFixed(1)}σ</small></Tip>}
    </div>
  );
}

// ——— матриця рішень: ефект на EBITDA × ризик виконання ———
export function ImpactScatter({ points, fmtY, label, names, quad, height = 300, onPick }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 56, R = 16, T = 16, B = 34, H = height;
  const ys = points.map(p => p.y);
  let lo = Math.min(0, ...ys), top = Math.max(0, ...ys);
  const pad = (top - lo) * 0.14 || 1000; lo -= pad; top += pad;
  const x = v => L + (W - L - R) * (v / 100);
  const y = v => T + (H - T - B) * (1 - (v - lo) / (top - lo));
  const tk = niceTicks(lo, top, 4);
  // підписи: уникаємо накладання зсувом по вертикалі
  const placed = [];
  const lab = points.map(p => {
    let ly = y(p.y) - 10;
    const lx = x(p.x);
    for (let tries = 0; tries < 6 && placed.some(q => Math.abs(q.x - lx) < 120 && Math.abs(q.y - ly) < 14); tries++) ly += 14;
    placed.push({ x: lx, y: ly });
    return ly;
  });
  return (
    <div className="chart" ref={ref}>
      <Legend items={[{ name: names.preset, color: COL.actual, kind: 'dot' }, { name: names.saved, color: COL.saved, kind: 'dot' }, { name: names.current, color: '#F4F6F8', kind: 'ring' }]} />
      <svg width={W} height={H} role="img" aria-label={label}>
        <rect x={x(40)} y={T} width={x(100) - x(40)} height={y(0) - T} fill="rgba(255,176,32,.04)" />
        <rect x={x(40)} y={y(0)} width={x(100) - x(40)} height={H - B - y(0)} fill={COL.critFill} />
        {tk.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={COL.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmtY(v)}</text></g>)}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="rgba(244,246,248,.35)" />
        <line x1={x(40)} x2={x(40)} y1={T} y2={H - B} stroke="rgba(244,246,248,.25)" strokeDasharray="3 4" />
        {[0, 20, 40, 60, 80, 100].map(v => <text key={v} x={x(v)} y={H - 14} className="axis" textAnchor="middle">{v}</text>)}
        <text x={W - R} y={H - 1} className="axis axis-faint" textAnchor="end">{names.xAxis}</text>
        <text x={L + 6} y={T + 12} className="quad">{quad.win}</text>
        <text x={W - R - 6} y={T + 12} className="quad" textAnchor="end">{quad.bet}</text>
        <text x={L + 6} y={H - B - 8} className="quad">{quad.small}</text>
        <text x={W - R - 6} y={H - B - 8} className="quad" textAnchor="end">{quad.trap}</text>
        {points.map((p, k) => (
          <g key={p.id} className="imp-pt" onMouseEnter={() => setHi(k)} onMouseLeave={() => setHi(null)} onClick={() => onPick && onPick(p)}>
            <circle cx={x(p.x)} cy={y(p.y)} r="13" fill="transparent" />
            {p.current && <circle cx={x(p.x)} cy={y(p.y)} r="10" fill="none" stroke="#F4F6F8" strokeWidth="2" />}
            <circle cx={x(p.x)} cy={y(p.y)} r="6" fill={p.saved ? COL.saved : COL.actual} stroke={COL.surface} strokeWidth="2" />
            <text x={x(p.x) + (x(p.x) > W * 0.7 ? -12 : 12)} y={lab[k] + 14} className="imp-label" textAnchor={x(p.x) > W * 0.7 ? 'end' : 'start'}>{p.name}</text>
          </g>
        ))}
      </svg>
      {hi != null && <Tip x={x(points[hi].x)} y={Math.max(0, y(points[hi].y) - 70)} w={W}>{points[hi].tip}</Tip>}
    </div>
  );
}

// Смуги за підрозділами: як BarList, але вибраний рядок підсвічується світлим, а не рубіновим
export function Bars({ items, max, fmt, picked, onPick, refLine, refLabel, color = C.primary }) {
  const m = max || Math.max(1, refLine || 0, ...items.map(i => i.value));
  return (
    <div className="barlist">
      {items.map(it => (
        <button type="button" key={it.id} className={'bar-row' + (picked === it.id ? ' picked' : '')} onClick={() => onPick && onPick(it.id)} aria-pressed={picked === it.id}>
          <span className="bar-name">{it.name}</span>
          <span className="bar-track">
            <i style={{ width: (Math.max(0, it.value) / m) * 100 + '%', background: it.color || color, outline: picked === it.id ? '1px solid ' + COL.pick : 'none' }} />
            {refLine != null && <s style={{ left: (refLine / m) * 100 + '%' }} title={refLabel} />}
          </span>
          <span className="bar-value">{fmt(it.value, it)}</span>
        </button>
      ))}
    </div>
  );
}
