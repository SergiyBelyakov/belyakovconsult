// Люди: чисельність, прийняті й звільнені, плинність і понаднормові, індекс кадрового ризику,
// когорти утримання працівників і клієнтів, зв'язок навантаження з результатом.
import { useState } from 'react';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { Diverging, TrendLine, C } from '../charts.jsx';
import { Bars, CohortGrid, COL } from '../charts2.jsx';
import { pick, series, agg, turnover, ytd, brief } from '../model.js';
import { wfUnit, wfIndex, LEVELS } from '../outlook.js';
import { staffCohorts, clientCohorts, STAFF_COLS, CLIENT_COLS } from '../cohorts.js';
import { Status } from '../parts.jsx';
import { withTicks, range } from './controls.jsx';

export default function People({ ctx }) {
  const { T, f, D, ind, unit, i, unitName, setUnit } = ctx;
  const [coh, setCoh] = useState('staff');
  const units = pick(D, unit);
  const cur = agg(units, i);
  const y = ytd(units, i);
  const rows = withTicks(series(units, Math.max(0, i - 17), i), f);
  const byUnit = D.units.map(u => ({ id: u.id, name: unitName(u.id), t: turnover([u], i), c: agg([u], i), w: wfUnit(u, i) }));
  const hot = unit !== 'all' && D.units.find(u => u.id === unit && u.kind !== 'office') ? unit : brief(D, ind, i).find(b => b.id === 'people').unit;
  const hu = D.units.find(u => u.id === hot);
  const hs = series([hu], 0, i);
  const ticks = hs.map(r => f.tick(r.m));
  const quality = ind === 'mfg' ? { key: 'defect', vals: hs.map(r => r.defect ?? 0), fmt: v => f.dec1(v) + '%', ref: 2 } : { key: 'nps', vals: hs.map(r => r.nps ?? 0), fmt: v => f.int(v), ref: 40 };
  const turnSeries = hs.map(r => turnover([hu], r.i));
  const wfAll = wfIndex(units, i);
  const qLabel = key => { const [yy, q] = key.split('-Q'); return T.people.quarter(q, yy); };
  const sc = staffCohorts(ind, unit, i);
  const cc = clientCohorts(ind, unit, i);
  const parts = ['turnover', 'overtime', 'vacancy', 'sick'];

  return (
    <>
      <div className="kpi-mini-row wide glass">
        <div><span>{T.kpi.hc}</span><b>{f.int(cur.hc)}</b><small>{T.plan}: {f.int(cur.hcPlan)}</small></div>
        <div><span>{T.vacanciesTitle}</span><b>{f.int(cur.vacancies)}</b><small>{f.int(cur.vacDays || 0)} {T.daysUnit}</small></div>
        <div><span>{T.kpi.turnover}</span><b className={turnover(units, i) > 0.2 ? 'over' : ''}>{f.pct(turnover(units, i), 1)}</b><small>{T.voluntary}</small></div>
        <div><span>{T.kpi.overtime}</span><b className={cur.overtime > 0.1 ? 'over' : ''}>{f.pct(cur.overtime, 1)}</b><small>{f.month(cur.m)}</small></div>
        <div><span>{T.head.labels.wf}</span><b className={wfAll >= 60 ? 'over' : ''}>{f.int(wfAll)} / 100</b><Status level={LEVELS.wf(wfAll)} T={T} /></div>
        <div><span>{T.payrollTitle}</span><b>{f.money(y.payroll)}</b><small className={y.payroll > y.payrollPlan ? 'over' : 'good'}>{f.signedPct(y.payroll / y.payrollPlan - 1)} {T.payrollVsPlan}</small></div>
      </div>

      <Panel title={T.people.wfTitle} sub={T.people.wfSub}>
        <div className="table-scroll">
          <table className="data-table compact wf-table">
            <thead><tr><th>{T.cols.unit}</th>{parts.map(p => <th key={p} className="num">{T.people.parts[p]}</th>)}<th className="num">{T.people.index}</th><th>{T.cols.level}</th></tr></thead>
            <tbody>
              {byUnit.map(b => (
                <tr key={b.id} tabIndex="0" className={unit === b.id ? 'picked' : ''} onClick={() => setUnit(unit === b.id ? 'all' : b.id, true)} onKeyDown={e => { if (e.key === 'Enter') setUnit(unit === b.id ? 'all' : b.id, true); }}>
                  <td className="strong">{b.name}</td>
                  <td className={'num' + (b.t > 0.2 ? ' over' : '')}>{f.pct(b.t, 1)}</td>
                  <td className={'num' + (b.c.overtime > 0.1 ? ' over' : '')}>{f.pct(b.c.overtime, 1)}</td>
                  <td className={'num' + (b.c.vacancies && b.c.vacDays > 45 ? ' over' : '')}>{b.c.vacancies ? f.int(b.c.vacDays) + ' ' + T.daysUnit : '·'}</td>
                  <td className="num">{f.pct(b.c.sick, 1)}</td>
                  <td className="num"><span className="wf-num"><i style={{ width: b.w.value + '%' }} className={'lvl-' + LEVELS.wf(b.w.value)} />{f.int(b.w.value)}</span></td>
                  <td><Status level={LEVELS.wf(b.w.value)} T={T} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">{T.people.wfNote}</p>
      </Panel>

      <div className="grid grid-main">
        <Panel title={T.hiresExits} sub={T.hiresExitsSub}>
          <Diverging height={340} data={rows.map(r => ({ m: r.m, tick: r.tick, up: r.hires, down: r.exits, vol: r.vol }))} label={T.hiresExits}
            tip={d => <><b>{f.month(d.m, true)}</b><br />{T.hires}: {d.up}<br />{T.exits}: {d.down}, {T.voluntary} {d.vol}</>} />
        </Panel>
        <div className="stack">
          <Panel title={T.turnoverByUnit}>
            <Bars items={byUnit.map(b => ({ id: b.id, name: b.name, value: b.t, color: b.t > 0.2 ? COL.crit : C.primary }))} refLine={0.2} refLabel={T.turnoverRef}
              picked={unit} onPick={id => setUnit(unit === id ? 'all' : id, true)} fmt={v => f.pct(v, 1)} />
          </Panel>
          <Panel title={T.overtimeByUnit}>
            <Bars items={byUnit.map(b => ({ id: b.id, name: b.name, value: b.c.overtime, color: b.c.overtime > 0.1 ? COL.crit : C.series.finance }))} refLine={0.1} refLabel={T.overtimeRef}
              picked={unit} onPick={id => setUnit(unit === id ? 'all' : id, true)} fmt={v => f.pct(v, 1)} />
          </Panel>
        </div>
      </div>

      <Panel title={coh === 'staff' ? T.people.cohStaff : T.people.cohClients} sub={coh === 'staff' ? T.people.cohStaffSub(unit === 'all' ? T.allUnits : unitName(unit)) : T.people.cohClientsSub[ind](cc.unit === 'all' ? T.allUnits : unitName(cc.unit))}
        aside={<Segmented value={coh} onChange={setCoh} label={T.people.cohLabel} options={[{ value: 'staff', label: T.people.staff }, { value: 'clients', label: T.people.clients }]} />}>
        {coh === 'staff'
          ? <CohortGrid rows={sc.map(r => ({ key: r.key, label: qLabel(r.key), size: f.int(r.hires), cells: r.cells }))} cols={STAFF_COLS} colName={c => T.people.afterMonths(c)} rowName={T.people.cohort} sizeName={T.people.hired} lo={0.6} hi={1} />
          : <CohortGrid rows={cc.rows.map(r => ({ key: r.key, label: qLabel(r.key), size: ind === 'mfg' ? f.int(r.n) : f.int(r.n), cells: r.cells }))} cols={CLIENT_COLS} colName={c => T.people.afterQuarters(c)} rowName={T.people.cohort} sizeName={T.people.newClients[ind]} lo={ind === 'mfg' ? 0.6 : 0.05} hi={1} />}
        <p className="muted small">{coh === 'staff' ? T.people.cohStaffNote : T.people.cohClientsNote[ind]}</p>
      </Panel>

      <Panel title={T.linkTitle(unitName(hot))} sub={T.linkSub} className="link-panel">
        <div className="multiples four">
          <TrendLine values={hs.map(r => r.overtime)} ticks={ticks} domain={range(hs.map(r => r.overtime), 0.2, 0)} refLine={0.1} fmt={v => f.pct(v, 1)} name={T.linkSeries.overtime} color={C.series.operations} />
          <TrendLine values={turnSeries} ticks={ticks} domain={range(turnSeries, 0.2, 0)} refLine={0.2} fmt={v => f.pct(v, 1)} name={T.linkSeries.turnover} color={C.series.health} />
          <TrendLine values={quality.vals} ticks={ticks} domain={range(quality.vals, 0.2, 0)} refLine={quality.ref} fmt={quality.fmt} name={T.linkSeries[quality.key]} color={C.series.geo} />
          <TrendLine values={hs.map(r => r.vsPlan)} ticks={ticks} domain={range(hs.map(r => r.vsPlan), 0.2)} refLine={0} fmt={v => f.signedPct(v)} name={T.linkSeries.vsPlan} color={C.primary} />
        </div>
        <button type="button" className="link-btn" onClick={() => ctx.go('links')}>{T.people.toLinks}</button>
      </Panel>
    </>
  );
}
