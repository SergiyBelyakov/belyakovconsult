import { Panel, Kpi, Button } from '../../../dashboard/src/ui.jsx';
import { BarList } from '../../../dashboard/src/charts.jsx';
import { confusion, roc, schemeSummary, thresholdFor, MODELS } from '../model.js';
import { C, MODEL_COLOR } from '../charts.jsx';
import { ModelBar } from './controls.jsx';

export default function Overview({ ctx }) {
  const { T, f, B, model, th, cap, go, setCluster } = ctx;
  const all = B.rows;
  const flagged = all.filter(x => x.score[model] >= th);
  const c = confusion(B.test, model, th);
  const paid = all.reduce((a, x) => a + x.paid, 0);
  const sum = schemeSummary(all, model, th);
  const kpis = [
    ['recipients', 'users', f.int(all.length)],
    ['paid', 'chart', f.money(paid)],
    ['flagged', 'search', f.int(flagged.length), f.pct(flagged.length / all.length, 1)],
    ['risk', 'warning', f.money(flagged.reduce((a, x) => a + x.paid, 0))],
    ['precision', 'target', f.pct(c.precision, 0)],
    ['recall', 'check', f.pct(c.recall, 0)],
    ['benefit', 'coins', f.money(c.benefit / 0.3)],
  ];
  return (
    <>
      <ModelBar ctx={ctx} />
      <div className="kpi-grid seven">
        {kpis.map(([id, icon, v, d]) => (
          <Kpi key={id} icon={icon} label={T.kpi[id]} value={v} deltaText={d} delta={0} context={T.kpiCtx[id]} accent={id === 'risk'}
            onClick={() => go(id === 'precision' || id === 'recall' || id === 'benefit' ? 'scoring' : 'queue')} />
        ))}
      </div>
      <div className="grid grid-main">
        <Panel title={T.schemesTitle} sub={T.schemesSub}>
          <div className="table-scroll">
            <table className="data-table compact plain">
              <thead><tr><th>{T.cols.scheme}</th><th className="num">{T.cols.cases}</th><th className="num">{T.cols.caught}</th><th>{T.cols.share}</th><th className="num">{T.cols.money}</th></tr></thead>
              <tbody>
                {sum.map(s => (
                  <tr key={s.id}>
                    <td className="strong">{T.schemes[s.id]}</td>
                    <td className="num">{f.int(s.n)}</td>
                    <td className="num">{f.int(s.caught)}</td>
                    <td className="bar-cell"><span className="mini-track"><i style={{ width: (s.caught / s.n) * 100 + '%', background: s.caught / s.n < 0.5 ? C.status.warning : C.status.healthy }} /></span>{f.pct(s.caught / s.n, 0)}</td>
                    <td className="num">{f.money(s.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={T.compareTitle} sub={T.compareSub}>
          <div className="model-compare">
            {MODELS.map(m => {
              const t = thresholdFor(B.test, m, cap), cm = confusion(B.test, m, t), r = roc(B.test, m);
              return (
                <button type="button" key={m} className={'model-row' + (m === model ? ' picked' : '')} onClick={() => ctx.setModel(m)}>
                  <span className="model-name"><i style={{ background: MODEL_COLOR[m] }} />{T.models[m]}</span>
                  <span><small>{T.cols.precision}</small><b>{f.pct(cm.precision, 0)}</b></span>
                  <span><small>{T.cols.recall}</small><b>{f.pct(cm.recall, 0)}</b></span>
                  <span><small>{T.cols.auc}</small><b>{f.dec2(r.auc)}</b></span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
      <Panel title={T.topClusters} aside={<Button icon="arrowRight" onClick={() => go('schemes')}>{T.toSchemes}</Button>}>
        <BarList items={B.clusters.slice(0, 6).map(cl => ({ id: cl.id, name: `${cl.id} · ${T.clusterCard(cl, f)}`, value: cl.score, color: cl.score >= 0.6 ? C.status.critical : C.status.warning }))}
          max={1} fmt={v => f.dec2(v)} onPick={id => { setCluster(id); go('schemes'); }} />
      </Panel>
    </>
  );
}
