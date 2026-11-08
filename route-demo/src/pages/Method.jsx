// Методика і дані: як карта стає графом, як рахуються матриці часу й оптимізація, модель витрат,
// припущення, що потрібно від компанії, вивантаження.
import { NODES, EDGES, CUSTOMERS, TYPES, PEN } from '../world.js';
import { FERRY_MIN } from '../graph.js';
import { WAREHOUSE_DAY } from './Scenarios.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';

export default function Method({ ctx }) {
  const { T, f, state, exportPlan, exportOrders, lang, onSite } = ctx;
  const M = T.method;
  const pre = lang === 'en' ? '/en' : '';
  const link = p => (onSite ? pre + p : 'https://www.belyakovconsult.com' + pre + p);
  return (
    <>
      <div className="steps-row">
        {M.steps.map((s, k) => (
          <article key={k} className="step-card glass">
            <span className="step-n">{String(k + 1).padStart(2, '0')}</span>
            <Icon name={['graph', 'clock', 'dispatch', 'pulse'][k]} size={20} />
            <h3>{s.t}</h3>
            <p>{s.d(NODES.length, EDGES.length, CUSTOMERS.length)}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-2">
        <Panel title={M.costTitle} sub={M.costSub(f.uah(state.fuel))}>
          <div className="table-scroll">
            <table className="data-table cost-table">
              <thead><tr><th>{M.cols.type}</th><th className="num">{M.cols.cap}</th><th className="num">{M.cols.mass}</th><th className="num">{M.cols.fuel}</th><th className="num">{M.cols.wear}</th><th className="num">{M.cols.driver}</th><th className="num">{M.cols.fixed}</th><th className="num">{M.cols.perKm}</th></tr></thead>
              <tbody>
                {TYPES.map(t => (
                  <tr key={t.id}>
                    <td>{T.vehicle[t.id]}</td><td className="num">{t.cap}</td><td className="num">{f.dec1(t.mass)}</td><td className="num">{t.fuel}</td><td className="num">{f.dec1(t.wear)}</td><td className="num">{t.driver}</td><td className="num">{f.int(t.fixed)}</td>
                    <td className="num">{f.dec1((t.fuel / 100) * state.fuel + t.wear)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="method-list">
            {M.costRules(f, PEN, FERRY_MIN, WAREHOUSE_DAY).map((x, k) => <li key={k}>{x}</li>)}
          </ul>
        </Panel>
        <Panel title={M.modelTitle} sub={M.modelSub}>
          <div className="schema">
            {M.tables.map(tb => (
              <div key={tb.n} className="schema-t">
                <strong><Icon name="table" size={14} />{tb.n}</strong>
                <span>{tb.f}</span>
              </div>
            ))}
          </div>
          <p className="note small">{M.modelNote}</p>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={M.algoTitle} sub={M.algoSub}>
          <ol className="method-list num">
            {M.algo.map((x, k) => <li key={k}>{x}</li>)}
          </ol>
        </Panel>
        <Panel title={M.limTitle}>
          <ul className="method-list">
            {M.lim.map((x, k) => <li key={k}>{x}</li>)}
          </ul>
          <h4 className="m-h4">{M.needTitle}</h4>
          <ul className="method-list">
            {M.need.map((x, k) => <li key={k}>{x}</li>)}
          </ul>
        </Panel>
      </div>

      <Panel title={M.dlTitle} sub={M.dlSub}>
        <div className="dl-row">
          <Button icon="download" kind="primary" onClick={exportPlan}>{M.dlPlan}</Button>
          <Button icon="download" onClick={exportOrders}>{M.dlOrders}</Button>
        </div>
        <div className="related">
          <a href={link('/cases/transport-accessibility/')}><Icon name="iso" size={16} />{M.rel1}</a>
          <a href={link('/cases/graph-analytics/')}><Icon name="graph" size={16} />{M.rel2}</a>
          <a href={link('/cases/community-twin/')}><Icon name="layers" size={16} />{M.rel3}</a>
        </div>
      </Panel>
    </>
  );
}
