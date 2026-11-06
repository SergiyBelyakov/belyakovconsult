import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { fairness, confusion, MODELS, thresholdFor } from '../model.js';
import { C, MODEL_COLOR } from '../charts.jsx';
import { ModelBar } from './controls.jsx';

export default function Fairness({ ctx }) {
  const { T, f, B, model, th, cap } = ctx;
  const rows = fairness(B.test, model, th);
  const base = confusion(B.test, model, th).fpr || 0.0001;
  const max = Math.max(...rows.map(r => Math.max(r.flagged, r.fraud)), 0.05);
  // колективні центри: усі три моделі поруч
  const coll = MODELS.map(m => ({ m, r: fairness(B.test, m, thresholdFor(B.test, m, cap)).find(g => g.id === 'collective') }));
  return (
    <>
      <ModelBar ctx={ctx} />
      <Panel title={T.fairTitle} sub={T.fairSub}>
        <div className="table-scroll">
          <table className="data-table plain fair-table">
            <thead><tr><th>{T.cols.group}</th><th className="num">{T.cols.n}</th><th>{T.cols.flagged} / {T.cols.fraudRate}</th><th className="num">{T.cols.fpr}</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const k = r.fpr / base;
                return (
                  <tr key={r.id}>
                    <td className="strong">{T.groups[r.id]}</td>
                    <td className="num">{f.int(r.n)}</td>
                    <td className="pair-cell">
                      <span className="pair"><i className="p-flag" style={{ width: (r.flagged / max) * 100 + '%' }} /><em>{f.pct(r.flagged, 1)}</em></span>
                      <span className="pair"><i className="p-fraud" style={{ width: (r.fraud / max) * 100 + '%' }} /><em>{f.pct(r.fraud, 1)}</em></span>
                    </td>
                    <td className={'num' + (k > 2 && r.fpr > 0.01 ? ' over' : '')}>{f.pct(r.fpr, 1)}{k > 2 && r.fpr > 0.01 && <small className="cell-sub">{T.ratio(f.dec1(k))}</small>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="legend-row"><span><i style={{ background: C.primary }} />{T.cols.flagged}</span><span><i style={{ background: C.status.critical }} />{T.cols.fraudRate}</span></div>
      </Panel>
      <div className="grid grid-2">
        <Panel title={T.groups.collective} sub={T.cols.flagged}>
          <div className="model-compare">
            {coll.map(({ m, r }) => (
              <div key={m} className="model-row static">
                <span className="model-name"><i style={{ background: MODEL_COLOR[m] }} />{T.models[m]}</span>
                <span><small>{T.cols.flagged}</small><b className={r.flagged > 0.1 ? 'over' : ''}>{f.pct(r.flagged, 1)}</b></span>
                <span><small>{T.cols.fraudRate}</small><b>{f.pct(r.fraud, 1)}</b></span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={T.nav.fairness}>
          <ul className="fair-notes">{T.fairNotes.map(n => <li key={n}><Icon name="info" size={15} /><span>{n}</span></li>)}</ul>
        </Panel>
      </div>
    </>
  );
}
