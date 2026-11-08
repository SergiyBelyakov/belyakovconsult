// Дерево декомпозиції: загальний показник розкладається на складові за вимірами в порядку, який обирає читач.
// На кожному рівні одна гілка розгорнута (рубінова позначка), її можна змінити кліком; вимір рівня змінюється
// у списку над колонкою. Підказка «найбільше пояснює» обирає вимір, де найбільша частка в одному значенні.
// Це інструмент, а не статичний графік, тому він зроблений у HTML; мініатюра в галереї малюється SVG.
import { useMemo, useState } from 'react';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { useWidth, Frame } from './kit.jsx';
import { SERIES, OTHER, EMPH, GRID } from '../palette.js';
import { splitBy } from '../prep3.js';

// вимір, що найбільше пояснює підмножину: найбільша частка одного значення
function bestDim(rows, used, nd) {
  let best = -1, bs = -1;
  for (let j = 0; j < nd; j++) {
    if (used.includes(j)) continue;
    const m = new Map(); rows.forEach(r => m.set(r.k[j], (m.get(r.k[j]) || 0) + r.v));
    if (m.size < 2) continue;
    const tot = [...m.values()].reduce((a, b) => a + b, 0), top = Math.max(...m.values());
    if (tot > 0 && top / tot > bs) { bs = top / tot; best = j; }
  }
  return best;
}
// початковий шлях: два рівні за підказкою, щоразу розгорнуто найбільше значення
function autoPath(m, depth, L) {
  const path = []; let rows = m.rows;
  for (let i = 0; i < depth; i++) {
    const j = bestDim(rows, path.map(p => p.dim), m.dims.length); if (j < 0) break;
    const top = splitBy(rows, j, L).find(it => !it.other);
    path.push({ dim: j, sel: top ? top.key : null });
    if (!top) break;
    rows = rows.filter(r => r.k[j] === top.key);
  }
  return path;
}
function levelsOf(m, path, L) {
  let rows = m.rows; const out = [];
  path.forEach((p, i) => {
    const items = splitBy(rows, p.dim, L), total = items.reduce((s, x) => s + x.v, 0);
    out.push({ ...p, items, total, max: Math.max(...items.map(x => x.v)), rows });
    if (p.sel == null) return;
    rows = rows.filter(r => r.k[p.dim] === p.sel);
  });
  return { levels: out, rest: rows };
}

export function Decomp(props) { return props.mini ? <DecompMini {...props} /> : <DecompTool {...props} />; }

function DecompTool({ m, f, T }) {
  const L = { other: T.ui.other };
  const [path, setPath] = useState(() => autoPath(m, 2, L));
  const { levels, rest } = useMemo(() => levelsOf(m, path, L), [m, path]);
  const used = path.map(p => p.dim);
  const last = path[path.length - 1];
  const canAdd = (!last || last.sel != null) && used.length < m.dims.length && rest.length > 0;
  const best = canAdd ? bestDim(rest, used, m.dims.length) : -1;
  const select = (i, key) => {
    // інша гілка на рівні i: глибші рівні зберігають свої виміри, а розгортають найбільше значення нової гілки
    const next = path.slice(0, i + 1).map((p, k) => (k === i ? { ...p, sel: key } : p));
    let rows = levelsOf(m, next, L).rest;
    for (let k = i + 1; k < path.length; k++) {
      const top = splitBy(rows, path[k].dim, L).find(it => !it.other);
      next.push({ dim: path[k].dim, sel: top ? top.key : null });
      if (!top) break;
      rows = rows.filter(r => r.k[path[k].dim] === top.key);
    }
    setPath(next);
  };
  const changeDim = (i, j) => {
    const rows = levels[i].rows, top = splitBy(rows, j, L).find(it => !it.other);
    setPath([...path.slice(0, i), { dim: j, sel: top ? top.key : null }]);
  };
  const add = j => { const top = splitBy(rest, j, L).find(it => !it.other); setPath([...path, { dim: j, sel: top ? top.key : null }]); };
  const parentName = i => (i === 0 ? T.ui.total : levels[i - 1].sel);
  return (
    <div className="chart cg-chart dt-wrap">
      <div className="dt" role="group" aria-label={T.ui.decomp}>
        <div className="dt-col">
          <div className="dt-head"><span>{m.valueName}</span></div>
          <div className="dt-sub">{T.ui.dtRoot}</div>
          <div className="dt-node sel root"><span className="dt-name">{T.ui.total}</span><span className="dt-val">{f.num(m.total)}</span><span className="dt-bar"><i style={{ width: '100%' }} /></span><span className="dt-pct">100%</span></div>
        </div>
        {levels.map((lv, i) => (
          <div className="dt-col" key={i}>
            <div className="dt-head">
              <select value={lv.dim} aria-label={T.ui.dtLevel(i + 1)} onChange={e => changeDim(i, Number(e.target.value))}>
                {m.dims.map((d, j) => (j === lv.dim || !used.slice(0, i).includes(j)) && <option key={j} value={j}>{d}</option>)}
              </select>
              <button type="button" className="dt-x" aria-label={T.ui.dtRemove} title={T.ui.dtRemove} onClick={() => setPath(path.slice(0, i))}><Icon name="x" size={13} /></button>
            </div>
            <div className="dt-sub">{T.ui.dtIn(parentName(i))}</div>
            {lv.items.map(it => {
              const sel = !it.other && it.key === lv.sel;
              return (
                <button type="button" key={it.key ?? 'other'} className={'dt-node' + (sel ? ' sel' : '') + (it.other ? ' other' : '')} disabled={it.other} aria-pressed={sel} onClick={() => select(i, it.key)}>
                  <span className="dt-name">{it.other ? T.ui.dtOther(it.n) : it.key}</span>
                  <span className="dt-val">{f.num(it.v)}</span>
                  <span className="dt-bar"><i style={{ width: Math.max(1, (it.v / lv.max) * 100) + '%', background: it.other ? OTHER : SERIES[0] }} /></span>
                  <span className="dt-pct">{f.pct(lv.total ? it.v / lv.total : 0)}</span>
                </button>
              );
            })}
          </div>
        ))}
        {canAdd && (
          <div className="dt-col dt-add">
            <div className="dt-head"><span>{T.ui.dtSplit}</span></div>
            <div className="dt-sub">{T.ui.dtIn(last ? last.sel : T.ui.total)}</div>
            {m.dims.map((d, j) => !used.includes(j) && (
              <button type="button" key={j} className={'dt-dim' + (j === best ? ' best' : '')} onClick={() => add(j)}>
                <Icon name="plus" size={13} /><span>{d}</span>{j === best && <em>{T.ui.dtBest}</em>}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="dt-note muted small">{T.ui.dtHint}</p>
    </div>
  );
}

// мініатюра: три колонки смуг, з'єднаних кривими від розгорнутої гілки
function DecompMini({ m, T }) {
  const [ref, W] = useWidth(240);
  const L = { other: T.ui.other };
  const { levels } = levelsOf(m, autoPath(m, 2, L), L);
  const H = 118, cols = [{ items: [{ v: m.total, sel: true }], max: m.total }, ...levels.map(lv => ({ items: lv.items.slice(0, 6).map(it => ({ v: it.v, sel: !it.other && it.key === lv.sel, other: it.other })), max: lv.max }))];
  const cw = W / cols.length, bw = cw * 0.62, row = 15;
  const pos = cols.map((c, i) => c.items.map((it, k) => ({ x: i * cw + 4, y: (H - c.items.length * row) / 2 + k * row + 3, w: Math.max(3, (it.v / c.max) * bw), ...it })));
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.decomp} mini>
      {pos.slice(1).map((c, i) => { const p = pos[i].find(n => n.sel); return p && c.map((n, k) => <path key={i + '-' + k} d={`M${p.x + p.w},${p.y + 4}C${p.x + p.w + 14},${p.y + 4} ${n.x - 14},${n.y + 4} ${n.x},${n.y + 4}`} fill="none" stroke={GRID} strokeWidth="1" />); })}
      {pos.flat().map((n, k) => <rect key={k} x={n.x} y={n.y} width={n.w} height={8} rx="2" fill={n.sel ? EMPH : n.other ? OTHER : SERIES[0]} />)}
    </Frame>
  );
}
