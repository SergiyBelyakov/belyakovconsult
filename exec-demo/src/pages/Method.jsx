// Методика і дані: модель, формули, припущення симулятора, прогноз і ризик, правила сигналів, межі методу.
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { SIGNALS } from '../model.js';
import { LEVERS, FIRST, FULL } from '../sim.js';

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
      <div className="grid grid-2">
        <Panel title={T.method.forecastTitle}>
          <dl className="method-list">{T.method.forecast.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
        <Panel title={T.method.causesTitle}>
          <dl className="method-list">{T.method.causes.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
      </div>
      <Panel title={T.method.simTitle} sub={T.method.simSub}>
        <div className="table-scroll">
          <table className="data-table plain">
            <thead><tr><th>{T.method.simCols[0]}</th><th className="num">{T.method.simCols[1]}</th><th className="num">{T.method.simCols[2]}</th><th>{T.method.simCols[3]}</th></tr></thead>
            <tbody>
              {LEVERS.map(k => (
                <tr key={k}><td className="strong">{T.levers.names[k]}</td><td className="num">{FIRST[k]}</td><td className="num">{FULL[k]}</td><td className="why">{T.method.simRules[k]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="method-limits">{T.method.simLinks.map(l => <li key={l}>{l}</li>)}</ul>
      </Panel>
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
