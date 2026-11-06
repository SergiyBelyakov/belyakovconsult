import { useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { reasons, FEATURES } from '../model.js';
import { SignedBars, C } from '../charts.jsx';
import { ModelBar } from './controls.jsx';

const LIMIT = 60;

export default function Queue({ ctx }) {
  const { T, f, B, model, th, caseId, setCaseId, truth, setTruth } = ctx;
  const [district, setDistrict] = useState('all');
  const list = B.rows.filter(x => x.score[model] >= th && (district === 'all' || x.district === district)).sort((a, b) => b.score[model] - a.score[model]);
  const cur = (caseId && B.byId.get(caseId)) || list[0];
  const cluster = cur && B.clusters.find(c => c.members.some(m => m.id === cur.id));
  const linked = cluster ? cluster.size - 1 : 0;
  return (
    <>
      <ModelBar ctx={ctx} />
      <div className="toolbar">
        <div className="chips">
          {['all', ...Object.keys(T.districts)].map(d => (
            <button type="button" key={d} className={'chip' + (district === d ? ' active' : '')} aria-pressed={district === d} onClick={() => setDistrict(d)}>{d === 'all' ? T.filterScheme : T.districts[d]}</button>
          ))}
        </div>
        <label className="truth-toggle"><input type="checkbox" checked={truth} onChange={e => setTruth(e.target.checked)} />{T.showTruth}</label>
      </div>
      <div className="grid grid-queue">
        <Panel title={T.queueTop(Math.min(LIMIT, list.length)) + ` / ${f.int(list.length)}`} sub={truth ? T.truthNote : null}>
          <div className="table-scroll">
            <table className="data-table compact queue-table">
              <thead><tr><th>{T.cols.id}</th><th>{T.cols.district}</th><th className="num">{T.cols.amount}</th><th className="num">{T.cols.score}</th><th>{T.cols.reasons}</th>{truth && <th>{T.cols.truth}</th>}</tr></thead>
              <tbody>
                {list.slice(0, LIMIT).map(x => (
                  <tr key={x.id} tabIndex="0" className={cur && cur.id === x.id ? 'picked' : ''} onClick={() => setCaseId(x.id)} onKeyDown={e => { if (e.key === 'Enter') setCaseId(x.id); }}>
                    <td className="strong mono">{x.id}<small className="cell-sub">{T.programs[x.program]}</small></td>
                    <td>{T.districts[x.district]}</td>
                    <td className="num">{f.int(x.amount)}</td>
                    <td className="num"><span className="score-pill" style={{ '--s': x.score[model] }}>{f.dec2(x.score[model])}</span></td>
                    <td className="reasons">{(model === 'rules' ? x.rulesHit.slice(0, 3).map(id => ({ id })) : reasons(x, 2)).map(r => <span key={r.id} className="reason">{T.features[r.id]}</span>)}</td>
                    {truth && <td>{x.fraud ? <span className="status critical">{T.schemes[x.scheme]}</span> : <span className="status healthy">{T.honest}</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {cur && (
          <Panel title={T.caseTitle(cur.id)} sub={`${T.programs[cur.program]} · ${T.districts[cur.district]} · ${T.cols.score} ${f.dec2(cur.score[model])}`} className="case-panel">
            {truth && <p className="case-truth">{cur.fraud ? <span className="status critical">{T.schemes[cur.scheme]}</span> : <span className="status healthy">{T.honest}</span>}</p>}
            <h4>{T.caseWhy}</h4>
            <SignedBars items={FEATURES.map((ft, j) => ({ id: ft.id, name: T.features[ft.id], value: cur.contrib[j] })).filter(i => Math.abs(i.value) > 0.05).sort((a, b) => b.value - a.value).slice(0, 7)}
              fmt={v => (v > 0 ? '+' : '−') + f.dec2(Math.abs(v))} />
            <h4>{T.caseRules}</h4>
            <div className="reasons">{cur.rulesHit.length ? cur.rulesHit.map(id => <span key={id} className="reason">{T.features[id]}</span>) : <span className="muted small">{T.caseNone}</span>}</div>
            <h4>{T.caseFields}</h4>
            <dl className="case-fields">
              {['amount', 'months', 'age', 'children', 'channel', 'operator', 'docMin', 'taxRatio', 'abroad', 'sharedIban', 'sharedPhone', 'sharedAddr'].map(k => (
                <div key={k}><dt>{T.fields[k]}</dt><dd>{k === 'channel' ? T.channels[cur.channel] : k === 'amount' ? f.int(cur.amount) + ' ' + T.uah : k === 'taxRatio' ? f.dec2(cur.taxRatio) : String(cur[k])}</dd></div>
              ))}
            </dl>
            {linked > 0 && <Button icon="layers" onClick={() => { ctx.setCluster(cluster.id); ctx.go('schemes'); }}>{T.linked(linked)}</Button>}
            <div className="signal-action"><Icon name="arrowRight" size={16} /><span><b>{T.caseAction}:</b> {T.caseActionText}</span></div>
          </Panel>
        )}
      </div>
    </>
  );
}
