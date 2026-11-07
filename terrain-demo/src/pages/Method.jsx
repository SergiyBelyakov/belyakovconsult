import { Panel, Button } from '../../../dashboard/src/ui.jsx';

export default function Method({ ctx }) {
  const { T, T3, exportCsv } = ctx;
  const list = rows => <dl className="method-list">{rows.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>;
  return (
    <>
      <div className="grid grid-2">
        <Panel title={T.method.demTitle}>
          {list(T.method.dem(Math.round(T3.min), Math.round(T3.max)))}
          <Button icon="download" onClick={exportCsv}>{T.method.csv}</Button>
        </Panel>
        <Panel title={T.method.algoTitle}>{list(T.method.algo)}</Panel>
      </div>
      <Panel title={T.method.natTitle}>{list(T.method.nat)}</Panel>
      <Panel title={T.method.limitsTitle}>
        <ul className="method-limits">{T.method.limits.map(l => <li key={l}>{l}</li>)}</ul>
      </Panel>
    </>
  );
}
