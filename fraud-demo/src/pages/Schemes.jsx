import { Panel } from '../../../dashboard/src/ui.jsx';
import { ClusterGraph, C } from '../charts.jsx';
import { BAD_OPERATOR } from '../model.js';

export default function Schemes({ ctx }) {
  const { T, f, B, model, th, cluster, setCluster, truth, setTruth, setCaseId, go } = ctx;
  const list = B.clusters;
  const cur = list.find(c => c.id === cluster) || list[0];
  // оператори: відхилення частки «3+ дітей» і позначки моделі
  const ops = new Map();
  B.rows.forEach(x => { const o = ops.get(x.operator) || { id: x.operator, n: 0, z: x.opZ, flagged: 0 }; o.n++; if (x.score[model] >= th) o.flagged++; ops.set(x.operator, o); });
  const opList = [...ops.values()].sort((a, b) => b.z - a.z).slice(0, 8);
  return (
    <>
      <div className="toolbar"><label className="truth-toggle"><input type="checkbox" checked={truth} onChange={e => setTruth(e.target.checked)} />{T.showTruth}</label></div>
      <div className="grid grid-schemes">
        <Panel title={T.nav.schemes} sub={`${f.int(list.length)} · ${T.cols.size} ≥ 3`} className="cluster-list-panel">
          <div className="cluster-list">
            {list.map(c => (
              <button type="button" key={c.id} className={'cluster-item' + (c.id === cur.id ? ' picked' : '')} onClick={() => setCluster(c.id)}>
                <span className="cluster-score" style={{ background: c.score >= 0.6 ? C.status.critical : c.score >= 0.35 ? C.status.warning : C.slate }}>{f.dec2(c.score)}</span>
                <span className="cluster-text"><strong>{c.id} · {T.districts[c.district]}</strong><small>{T.clusterCard(c, f)}{c.collective ? ' · ' + T.clusterCollective : ''}</small></span>
                {truth && <span className={'status ' + (c.fraud > 0.5 ? 'critical' : 'healthy')}>{f.pct(c.fraud, 0)}</span>}
              </button>
            ))}
          </div>
        </Panel>
        <div className="stack">
          <Panel title={`${T.clusterGraph}: ${cur.id}`} sub={T.clusterGraphSub}>
            <ClusterGraph cluster={cur} label={T.clusterGraph} onPick={id => { setCaseId(id); go('queue'); }} />
            <div className="metric-row">
              <span><small>{T.cols.size}</small><b>{f.int(cur.size)}</b></span>
              <span><small>{T.cols.money}</small><b>{f.money(cur.paid)}</b></span>
              <span><small>{T.cols.online}</small><b>{f.pct(cur.online, 0)}</b></span>
              <span><small>{T.cols.night}</small><b>{f.pct(cur.night, 0)}</b></span>
              <span><small>{T.cols.operator}</small><b className={cur.operator === BAD_OPERATOR && cur.opShare > 0.4 ? 'over' : ''}>{cur.operator} · {f.pct(cur.opShare, 0)}</b></span>
            </div>
          </Panel>
          <Panel title={T.operatorsTitle} sub={T.operatorsSub}>
            <div className="table-scroll">
              <table className="data-table compact plain">
                <thead><tr>{T.opsCols.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
                <tbody>
                  {opList.map(o => (
                    <tr key={o.id} className={o.id === BAD_OPERATOR ? 'picked' : ''}>
                      <td className="strong mono">{o.id}</td>
                      <td className="num">{f.int(o.n)}</td>
                      <td className={'num' + (o.z > 2 ? ' over' : '')}>{(o.z > 0 ? '+' : '−') + f.dec1(Math.abs(o.z))} σ</td>
                      <td className="num">{f.int(o.flagged)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
