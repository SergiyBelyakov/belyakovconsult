// Методика: дані, групи, ознаки, методи, сигми, як побудована хмара, обмеження, CSV.
import { useMemo } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { FEATURES } from '../data.js';

export default function Method({ ctx }) {
  const { T, f, ds, exportCsv } = ctx;
  const sum = useMemo(() => ds.rows.reduce((s, x) => s + x.amount, 0), [ds]);
  const groups = useMemo(() => ds.groups.map((g, k) => {
    const a = ds.rows.filter(x => x.g === k).map(x => x.amount).sort((p, q) => p - q);
    return { id: g.id, n: a.length, sum: a.reduce((s, v) => s + v, 0), med: a[a.length >> 1] };
  }), [ds]);
  const truth = useMemo(() => { const o = { error: 0, risk: 0, benign: 0, normal: 0 }; ds.rows.forEach(x => { o[x.truth]++; }); return o; }, [ds]);
  return (
    <>
      <div className="grid grid-2">
        <Panel title={T.method.dataTitle}>
          <dl className="method-list">{T.method.data(f.int(ds.n), f.uahShort(sum)).map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
          <Button icon="download" onClick={exportCsv}>{T.method.csv}</Button>
        </Panel>
        <Panel title={T.groupLabel}>
          <table className="data-table plain compact">
            <thead><tr><th>{T.method.groupCols.group}</th><th className="num">{T.method.groupCols.n}</th><th className="num">{T.method.groupCols.sum}</th><th className="num">{T.method.groupCols.med}</th></tr></thead>
            <tbody>{groups.map(g => <tr key={g.id}><td>{T.groups[g.id]}</td><td className="num">{f.int(g.n)}</td><td className="num">{f.uahShort(g.sum)}</td><td className="num">{f.uah(g.med)}</td></tr>)}</tbody>
          </table>
          <h4 className="an-subhead">{T.method.truthTitle}</h4>
          <table className="data-table plain compact">
            <thead><tr><th>{T.method.truthCols.type}</th><th className="num">{T.method.truthCols.n}</th><th className="num">{T.method.truthCols.share}</th></tr></thead>
            <tbody>{['error', 'risk', 'benign', 'normal'].map(t => <tr key={t}><td><span className={'an-truth-tag t-' + t}>{T.truth[t]}</span></td><td className="num">{f.int(truth[t])}</td><td className="num">{f.pct(truth[t] / ds.n, 1)}</td></tr>)}</tbody>
          </table>
        </Panel>
      </div>
      <Panel title={T.method.featuresTitle}>
        <dl className="method-list an-feat-list">{FEATURES.map(ft => <div key={ft.id}><dt>{T.features[ft.id]}</dt><dd>{T.featHint[ft.id]}</dd></div>)}</dl>
      </Panel>
      <div className="grid grid-2">
        <Panel title={T.method.methodsTitle}>
          <dl className="method-list">{T.method.methods.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
        <div className="an-stack">
          <Panel title={T.method.calibTitle}><p className="an-p">{T.method.calib}</p></Panel>
          <Panel title={T.method.cloudTitle}><p className="an-p">{T.method.cloud}</p></Panel>
        </div>
      </div>
      <Panel title={T.method.limitsTitle}>
        <ul className="method-limits">{T.method.limits.map(l => <li key={l}>{l}</li>)}</ul>
      </Panel>
    </>
  );
}
