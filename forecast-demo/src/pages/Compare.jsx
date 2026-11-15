import { useEffect, useMemo, useState } from 'react';
import { Panel, Button, Select } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { leaderboard } from '../engine/evaluate.js';
import { DATASET_IDS } from '../data.js';
import { makeFmt } from '../format.js';
import { ForecastChart, ChartLegend } from '../charts.jsx';
import { SERIES } from '../../../chart-gallery/src/palette.js';
import { seriesFor } from '../common.jsx';

export function Leaderboard({ lb, T, fmt, sel, toggle, onOpen, active, onPick }) {
  const max = Math.max(1.6, ...lb.ok.map(r => Math.min(r.mase, 4)));
  return (
    <div className="table-scroll">
      <table className="data-table plain fc-lb">
        <thead><tr><th>{T.cmpCols.model}</th><th className="fc-lb-bar">{T.cmpCols.mase}</th><th className="num">{T.cmpCols.mape}</th><th className="num">{T.cmpCols.mae}</th><th className="num">{T.cmpCols.bias}</th><th className="num">{T.cmpCols.cover}</th>{toggle && <th className="num">{T.cmpShow}</th>}</tr></thead>
        <tbody>
          {lb.ok.map((r, k) => {
            const on = sel ? sel.indexOf(r.id) : -1;
            return (
              <tr key={r.id} className={(active === r.id ? 'fc-row-on ' : '') + (onPick ? 'fc-row-pick' : '')} onClick={onPick ? () => onPick(r.id) : undefined}>
                <td className="strong">
                  <span className="fc-lb-rank">{k + 1}</span>
                  {onOpen ? <button type="button" className="link-btn" onClick={e => { e.stopPropagation(); onOpen(r.id); }}>{T.models[r.id].name}</button> : T.models[r.id].name}
                  {k === 0 && <span className="fc-best">{T.bestTag}</span>}
                </td>
                <td className="fc-lb-bar">
                  <span className="fc-lb-cell">
                    <span className="fc-bar"><i style={{ width: (Math.min(r.mase, 4) / max) * 100 + '%' }} className={r.mase < 1 ? 'good' : ''} /><em style={{ left: (1 / max) * 100 + '%' }} /></span>
                    <b>{fmt.dec2(r.mase)}</b>
                  </span>
                </td>
                <td className="num">{Number.isFinite(r.mape) ? fmt.pct1(r.mape) : '·'}</td>
                <td className="num">{fmt.val(r.mae)}</td>
                <td className="num">{fmt.signed(r.bias)}</td>
                <td className="num">{Number.isFinite(r.cover80) ? fmt.pct0(r.cover80) : '·'}</td>
                {toggle && <td className="num"><label className="fc-dotcheck" onClick={e => e.stopPropagation()}><input type="checkbox" checked={on >= 0} onChange={() => toggle(r.id)} /><i style={on >= 0 ? { background: SERIES[on % SERIES.length], borderColor: SERIES[on % SERIES.length] } : null} /></label></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Compare({ ctx }) {
  const { T, cmpDs, setCmpDs, openModel, track } = ctx;
  const S = useMemo(() => seriesFor(cmpDs), [cmpDs]);
  const fmt = useMemo(() => makeFmt(T, S.dec), [T, S.dec]);
  const lb = useMemo(() => leaderboard(S, S.H), [S]);
  const naiveId = S.m > 1 ? 'snaive' : 'naive';
  const defSel = () => { const top = lb.ok.slice(0, 3).map(r => r.id); if (!top.includes(naiveId) && lb.ok.some(r => r.id === naiveId)) top.push(naiveId); return top; };
  const [sel, setSel] = useState(defSel);
  useEffect(() => { setSel(defSel()); }, [lb]);
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.length >= 5 ? s : [...s, id]));
  const n = S.y.length, from = Math.max(0, n - S.H - Math.max(S.H * 3, S.m > 1 ? 2 * S.m : 24));
  const overlays = sel.map((id, k) => { const r = lb.ok.find(x => x.id === id); return r ? { id, label: T.models[id].name, color: SERIES[k % SERIES.length], from: n - S.H, values: r.fc.map(f => f.mean) } : null; }).filter(Boolean);
  const best = lb.ok[0], naive = lb.ok.find(r => r.id === naiveId);
  const D = T.datasets[S.id];

  return (
    <>
      <Panel title={D.name} sub={D.desc} className="fc-cmp-head"
        aside={<Select label={T.dataLabel} value={cmpDs} onChange={v => { setCmpDs(v); track('compare', { d: v }); }} options={DATASET_IDS.map(id => ({ value: id, label: T.datasets[id].name }))} />}>
        {best && <p className="fc-insight"><Icon name="spark" size={16} /><span>{T.cmpBest(`${T.models[best.id].name} (MASE ${fmt.dec2(best.mase)})`, naive ? `${T.models[naive.id].name}, MASE ${fmt.dec2(naive.mase)}, ${lb.ok.indexOf(naive) + 1} / ${lb.ok.length}` : '·')}</span></p>}
      </Panel>

      <Panel title={T.cmpChart} sub={T.maxShown}>
        <ForecastChart dates={S.dates} y={S.y} fitted={null} fc={null} hideFuture test={{ from: n - S.H, fc: [] }} overlays={overlays}
          show={{ fitted: false, test: true }} freq={S.freq} fmt={fmt} T={T} from={from} label={T.cmpChart} />
        <ChartLegend T={T} show={{ fitted: false, test: true }} hasBand={false} hasTest overlays={overlays} />
      </Panel>

      <Panel title={T.cmpTable} sub={T.cmpSub(S.H, T, S.freq)} className="flat-panel">
        <Leaderboard lb={lb} T={T} fmt={fmt} sel={sel} toggle={toggle} onOpen={id => openModel(id, cmpDs)} />
        {lb.skipped.length > 0 && <p className="note"><Icon name="info" size={15} /><span><b>{T.cmpSkipped}:</b> {lb.skipped.map(r => T.models[r.id].name).join(', ')}</span></p>}
      </Panel>

      <div className="grid fc-two">
        <Panel title={T.cmpWhyTitle}>
          <ul className="check-list">{T.cmpWhy.map((t, i) => <li key={i}><Icon name="bulb" size={16} /><span>{t}</span></li>)}</ul>
        </Panel>
        <Panel title={T.metricsTitle}>
          <dl className="glossary">{['mase', 'mape', 'mae', 'bias', 'cover'].map(k => <div key={k}><dt>{T.metric[k][0]}</dt><dd>{T.metric[k][1]}</dd></div>)}</dl>
        </Panel>
      </div>
    </>
  );
}
