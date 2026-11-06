import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { FEATURES, RULES } from '../model.js';

export default function Method({ ctx }) {
  const { T, f, B, exportCsv } = ctx;
  return (
    <>
      <div className="grid grid-2">
        <Panel title={T.method.dataTitle}>
          <dl className="method-list">{T.method.data.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
          <Button icon="download" onClick={exportCsv}>{T.method.csv}</Button>
        </Panel>
        <Panel title={T.method.metricsTitle}>
          <dl className="method-list">{T.method.metrics.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
      </div>
      <div className="grid grid-2">
        <Panel title={T.method.modelTitle} sub={T.method.model}>
          <table className="data-table plain compact">
            <thead><tr><th>{T.cols.reasons}</th><th className="num">{T.cols.coef}</th></tr></thead>
            <tbody>{FEATURES.map((ft, j) => <tr key={ft.id}><td>{T.features[ft.id]}</td><td className="num">{(B.M.w[j] >= 0 ? '+' : '−') + f.dec2(Math.abs(B.M.w[j]))}</td></tr>)}</tbody>
          </table>
        </Panel>
        <Panel title={T.method.rulesTitle}>
          <table className="data-table plain compact">
            <thead><tr><th>{T.cols.reasons}</th><th className="num">{T.cols.weight}</th></tr></thead>
            <tbody>{RULES.map(r => <tr key={r.id}><td>{T.features[r.id]}</td><td className="num">+{f.dec2(r.w)}</td></tr>)}</tbody>
          </table>
        </Panel>
      </div>
      <Panel title={T.method.limitsTitle}>
        <ul className="method-limits">{T.method.limits.map(l => <li key={l}>{l}</li>)}</ul>
      </Panel>
    </>
  );
}
