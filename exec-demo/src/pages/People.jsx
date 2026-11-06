import { Panel } from '../../../dashboard/src/ui.jsx';
import { BarList } from '../../../dashboard/src/charts.jsx';
import { Diverging, TrendLine, C } from '../charts.jsx';
import { pick, series, agg, turnover, ytd, brief } from '../model.js';
import { UnitPicker, withTicks, range } from './controls.jsx';

export default function People({ ctx }) {
  const { T, f, D, ind, unit, i, unitName, setUnit } = ctx;
  const units = pick(D, unit);
  const cur = agg(units, i);
  const y = ytd(units, i);
  const rows = withTicks(series(units, Math.max(0, i - 17), i), f);
  const byUnit = D.units.map(u => ({ id: u.id, name: unitName(u.id), t: turnover([u], i), c: agg([u], i) }));
  // підрозділ для панелі зв'язку: обраний або той, де плинність найвища
  const hot = unit !== 'all' && D.units.find(u => u.id === unit && u.kind !== 'office') ? unit : brief(D, ind, i).find(b => b.id === 'people').unit;
  const hu = D.units.find(u => u.id === hot);
  const hs = series([hu], 0, i);
  const ticks = hs.map(r => f.tick(r.m));
  const quality = ind === 'mfg' ? { key: 'defect', vals: hs.map(r => r.defect ?? 0), fmt: v => f.dec1(v) + '%', ref: 2 } : { key: 'nps', vals: hs.map(r => r.nps ?? 0), fmt: v => f.int(v), ref: 40 };
  const turnSeries = hs.map(r => turnover([hu], r.i));

  return (
    <>
      <div className="toolbar"><UnitPicker ctx={ctx} /></div>
      <div className="kpi-mini-row wide glass">
        <div><span>{T.kpi.hc}</span><b>{f.int(cur.hc)}</b><small>{T.plan}: {f.int(cur.hcPlan)}</small></div>
        <div><span>{T.vacanciesTitle}</span><b>{f.int(cur.vacancies)}</b><small>{f.int(cur.vacDays || 0)} {T.daysUnit}</small></div>
        <div><span>{T.kpi.turnover}</span><b className={turnover(units, i) > 0.2 ? 'over' : ''}>{f.pct(turnover(units, i), 1)}</b><small>{T.voluntary}</small></div>
        <div><span>{T.kpi.overtime}</span><b className={cur.overtime > 0.1 ? 'over' : ''}>{f.pct(cur.overtime, 1)}</b><small>{f.month(cur.m)}</small></div>
        <div><span>{T.sickTitle}</span><b>{f.pct(cur.sick, 1)}</b><small>{f.month(cur.m)}</small></div>
        <div><span>{T.payrollTitle}</span><b>{f.money(y.payroll)}</b><small className={y.payroll > y.payrollPlan ? 'over' : 'good'}>{f.signedPct(y.payroll / y.payrollPlan - 1)} {T.payrollVsPlan}</small></div>
      </div>

      <div className="grid grid-main">
        <Panel title={T.hiresExits} sub={T.hiresExitsSub}>
          <Diverging height={360} data={rows.map(r => ({ m: r.m, tick: r.tick, up: r.hires, down: r.exits, vol: r.vol }))} label={T.hiresExits}
            tip={d => <><b>{f.month(d.m, true)}</b><br />{T.hires}: {d.up}<br />{T.exits}: {d.down}, {T.voluntary} {d.vol}</>} />
        </Panel>
        <div className="stack">
          <Panel title={T.turnoverByUnit}>
            <BarList items={byUnit.map(b => ({ id: b.id, name: b.name, value: b.t, color: b.t > 0.2 ? C.status.critical : C.primary }))} refLine={0.2} refLabel={T.turnoverRef}
              picked={unit} onPick={id => setUnit(unit === id ? 'all' : id)} fmt={v => f.pct(v, 1)} />
          </Panel>
          <Panel title={T.overtimeByUnit}>
            <BarList items={byUnit.map(b => ({ id: b.id, name: b.name, value: b.c.overtime, color: b.c.overtime > 0.1 ? C.status.critical : C.series.finance }))} refLine={0.1} refLabel={T.overtimeRef}
              picked={unit} onPick={id => setUnit(unit === id ? 'all' : id)} fmt={v => f.pct(v, 1)} />
          </Panel>
        </div>
      </div>

      <Panel title={T.linkTitle(unitName(hot))} sub={T.linkSub} className="link-panel">
        <div className="multiples four">
          <TrendLine values={hs.map(r => r.overtime)} ticks={ticks} domain={range(hs.map(r => r.overtime), 0.2, 0)} refLine={0.1} fmt={v => f.pct(v, 1)} name={T.linkSeries.overtime} color={C.series.operations} />
          <TrendLine values={turnSeries} ticks={ticks} domain={range(turnSeries, 0.2, 0)} refLine={0.2} fmt={v => f.pct(v, 1)} name={T.linkSeries.turnover} color={C.series.health} />
          <TrendLine values={quality.vals} ticks={ticks} domain={range(quality.vals, 0.2, 0)} refLine={quality.ref} fmt={quality.fmt} name={T.linkSeries[quality.key]} color={C.series.geo} />
          <TrendLine values={hs.map(r => r.vsPlan)} ticks={ticks} domain={range(hs.map(r => r.vsPlan), 0.2)} refLine={0} fmt={v => f.signedPct(v)} name={T.linkSeries.vsPlan} color={C.primary} />
        </div>
      </Panel>

      <Panel title={T.vacanciesTitle}>
        <div className="table-scroll">
          <table className="data-table plain">
            <thead><tr><th>{T.cols.unit}</th><th className="num">{T.cols.hc}</th><th className="num">{T.cols.vacancies}</th><th className="num">{T.cols.vacDays}</th><th className="num">{T.cols.turnover}</th><th className="num">{T.kpi.overtime}</th></tr></thead>
            <tbody>
              {byUnit.map(b => (
                <tr key={b.id} className={unit === b.id ? 'picked' : ''}>
                  <td className="strong">{b.name}</td>
                  <td className="num">{f.int(b.c.hc)}</td>
                  <td className="num">{f.int(b.c.vacancies)}</td>
                  <td className={'num' + (b.c.vacancies && b.c.vacDays > 45 ? ' over' : '')}>{b.c.vacancies ? f.int(b.c.vacDays) : '·'}</td>
                  <td className={'num' + (b.t > 0.2 ? ' over' : '')}>{f.pct(b.t, 1)}</td>
                  <td className={'num' + (b.c.overtime > 0.1 ? ' over' : '')}>{f.pct(b.c.overtime, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
