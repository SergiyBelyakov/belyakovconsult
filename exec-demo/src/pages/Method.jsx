import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { SIGNALS } from '../model.js';

export default function Method({ ctx }) {
  const { T, ind, exportCsv } = ctx;
  return (
    <>
      <div className="grid grid-2">
        <Panel title={T.method.modelTitle} sub={T.companyAbout[ind]}>
          <dl className="method-list">{T.method.model.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
          <Button icon="download" onClick={exportCsv}>{T.method.csv}</Button>
        </Panel>
        <Panel title={T.method.formulasTitle}>
          <dl className="method-list">{T.method.formulas.map(([a, b]) => <div key={a}><dt>{a}</dt><dd className="mono">{b}</dd></div>)}</dl>
        </Panel>
      </div>
      <Panel title={T.method.rulesTitle}>
        <div className="table-scroll">
          <table className="data-table plain">
            <tbody>
              {SIGNALS.map(s => (
                <tr key={s.id}><td className="strong">{T.signals[s.id].title}</td><td className="why">{T.signals[s.id].rule}</td><td className="why">{T.signals[s.id].action}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={T.method.limitsTitle}>
        <ul className="method-limits">{T.method.limits.map(l => <li key={l}>{l}</li>)}</ul>
      </Panel>
    </>
  );
}
