import { Panel } from '../../../dashboard/src/ui.jsx';
import { BarList } from '../../../dashboard/src/charts.jsx';
import { PlanActual, Waterfall, TrendLine, C } from '../charts.jsx';
import { pick, series, ytd, bridge } from '../model.js';
import { UnitPicker, NONE, withTicks, range } from './controls.jsx';

export default function Finance({ ctx }) {
  const { T, f, D, unit, i, unitName, setUnit } = ctx;
  const units = pick(D, unit);
  const rows = withTicks(series(units, 0, i), f);
  const y = ytd(units, i);
  const steps = bridge(y);
  const co = D.company.slice(0, i + 1);
  const ticks = co.map(c => f.tick(c.m));
  const margins = rows.map(r => r.margin);
  const aging = D.company[i].aging;

  return (
    <>
      <div className="toolbar"><UnitPicker ctx={ctx} /></div>
      <div className="grid grid-main">
        <Panel title={T.revPlanTitle + (unit !== 'all' ? ': ' + unitName(unit) : '')} sub={T.revPlanSub}>
          <PlanActual data={rows} actual={r => r.rev} plan={r => r.revPlan} fmtAxis={f.axisMoney} label={T.revPlanTitle} focus={rows.length - 1}
            tip={r => <><b>{f.month(r.m, true)}</b><br />{T.actual}: {f.money(r.rev)}<br />{T.plan}: {f.money(r.revPlan)} ({f.signedPct(r.vsPlan)})</>} />
          <p className="axis-note muted small">{T.moneyUnit}</p>
        </Panel>
        <Panel title={T.marginTitle}>
          <TrendLine values={margins} ticks={ticks} domain={range(margins)} fmt={v => f.pct(v, 1)} name={T.kpi.margin} color={C.series.finance} height={150} />
          <div className="kpi-mini-row">
            <div><span>{T.cols.rev}</span><b>{f.money(y.rev)}</b><small className={y.vsPlan < 0 ? 'over' : 'good'}>{f.signedPct(y.vsPlan)} {T.kpiCtx.vsPlan}</small></div>
            <div><span>{T.cols.ebitda}</span><b>{f.money(y.ebitda)}</b><small>{f.pct(y.margin, 1)}</small></div>
            <div><span>{T.cols.gm}</span><b>{f.pct(y.gm, 1)}</b><small>{T.ytdShort}</small></div>
          </div>
        </Panel>
      </div>

      <Panel title={T.bridgeTitle} sub={T.bridgeSub}>
        <Waterfall steps={steps} name={id => T.bridgeSteps[id]} fmt={f.money} label={T.bridgeTitle} />
      </Panel>

      <div className="grid grid-3">
        <Panel title={T.cashTitle} sub={T.companyOnly}>
          <TrendLine values={co.map(c => c.cash)} ticks={ticks} domain={range(co.map(c => c.cash), 0.15, 0)} fmt={f.money} name={T.kpi.cash} color={C.series.registry} />
        </Panel>
        <Panel title={T.dsoTitle} sub={T.companyOnly}>
          <TrendLine values={co.map(c => c.dso)} ticks={ticks} domain={[0, Math.max(70, ...co.map(c => c.dso))]} refLine={60} fmt={v => f.int(v) + ' ' + T.daysUnit} name="DSO" color={C.series.operations} />
        </Panel>
        <Panel title={T.agingTitle} sub={f.money(D.company[i].ar)}>
          <BarList items={aging.map((a, k) => ({ id: 'a' + k, name: T.aging[k], value: a, color: k >= 2 ? C.status.critical : C.primary }))} max={1} fmt={v => f.pct(v, 0)} />
        </Panel>
      </div>

      <Panel title={T.unitsYtd}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>{T.cols.unit}</th><th className="num">{T.cols.rev}</th><th className="num">{T.cols.plan}</th><th className="num">{T.cols.vsPlan}</th><th className="num">{T.cols.gm}</th><th className="num">{T.cols.ebitda}</th><th className="num">{T.cols.margin}</th></tr></thead>
            <tbody>
              {D.units.map(u => {
                const p = ytd([u], i);
                return (
                  <tr key={u.id} tabIndex="0" className={unit === u.id ? 'picked' : ''} onClick={() => setUnit(unit === u.id ? 'all' : u.id)}>
                    <td className="strong">{unitName(u.id)}</td>
                    <td className="num">{p.rev ? f.money(p.rev) : NONE}</td>
                    <td className="num">{p.revPlan ? f.money(p.revPlan) : NONE}</td>
                    <td className={'num' + (p.rev && p.vsPlan < -0.05 ? ' over' : '')}>{p.rev ? f.signedPct(p.vsPlan) : NONE}</td>
                    <td className="num">{p.rev ? f.pct(p.gm, 1) : NONE}</td>
                    <td className="num">{f.money(p.ebitda)}</td>
                    <td className="num">{p.rev ? f.pct(p.margin, 1) : NONE}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
