// Фінанси: план, факт і прогноз виручки до кінця року з межами, маржа, міст EBITDA і підрозділи.
// Фільтр підрозділу спільний для всієї панелі (у верхній панелі).
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { FanChart } from '../charts2.jsx';
import { Waterfall, TrendLine, C } from '../charts.jsx';
import { pick, series, ytd, bridge } from '../model.js';
import { scopeForecast, fullYear, Z80, Z95 } from '../outlook.js';
import { NONE, range } from './controls.jsx';

export default function Finance({ ctx }) {
  const { T, f, D, unit, i, unitName, setUnit, openCause } = ctx;
  const units = pick(D, unit);
  const S = series(units, Math.max(0, i - 15), i);
  const y = ytd(units, i);
  const steps = bridge(y);
  const fyR = fullYear(ctx.ind, unit, i, 'rev'), fyE = fullYear(ctx.ind, unit, i, 'ebitda');
  const hist = S.map(r => ({ m: r.m, tick: f.tick(r.m), actual: r.rev, plan: r.revPlan }));
  const fut = scopeForecast(ctx.ind, unit, i).map(x => ({ m: x.m, tick: f.tick(x.m), mean: x.rev, lo80: x.rev - Z80 * x.sdRev, hi80: x.rev + Z80 * x.sdRev, lo95: x.rev - Z95 * x.sdRev, hi95: x.rev + Z95 * x.sdRev, plan: x.planRev }));
  const margins = series(units, 0, i).map(r => r.margin);
  const ticks = series(units, 0, i).map(r => f.tick(r.m));
  const scopeName = unit !== 'all' ? ': ' + unitName(unit) : '';

  return (
    <>
      <div className="kpi-mini-row wide glass">
        <div><span>{T.fin.ytdRev}</span><b>{f.money(y.rev)}</b><small className={y.vsPlan < 0 ? 'over' : 'good'}>{f.signedPct(y.vsPlan)} {T.kpiCtx.vsPlan}</small></div>
        <div><span>{T.fin.ytdEbitda}</span><b>{f.money(y.ebitda)}</b><small className={y.ebitda < y.ebitdaPlan ? 'over' : 'good'}>{f.signedPct(y.ebitdaPlan ? y.ebitda / y.ebitdaPlan - 1 : 0)} {T.kpiCtx.vsPlan}</small></div>
        <div><span>{T.cols.margin}</span><b>{f.pct(y.margin, 1)}</b><small>{T.ytdShort}</small></div>
        <div><span>{T.fin.fyRev}</span><b>{f.money(fyR.value)}</b><small className={fyR.vsPlan < -0.02 ? 'over' : ''}>{f.signedPct(fyR.vsPlan)} {T.kpiCtx.vsPlan}</small></div>
        <div><span>{T.fin.fyEbitda}</span><b>{f.money(fyE.value)}</b><small className={fyE.vsPlan < -0.05 ? 'over' : ''}>{f.signedPct(fyE.vsPlan)} {T.kpiCtx.vsPlan}</small></div>
        <div><span>{T.cols.gm}</span><b>{f.pct(y.gm, 1)}</b><small>{T.ytdShort}</small></div>
      </div>

      <div className="grid grid-main">
        <Panel title={T.fin.fanTitle + scopeName} sub={T.fin.fanSub}>
          <FanChart hist={hist} fut={fut} fmtAxis={f.axisMoney} label={T.fin.fanTitle} names={{ actual: T.actual, plan: T.plan, fc: T.fan.fc, band: T.fan.band }}
            tip={(d, isF) => <><b>{f.month(d.m, true)}{isF ? ' · ' + T.fan.fc : ''}</b><strong>{f.money(isF ? d.mean : d.actual)}</strong>{isF && <small>{T.fan.range80(f.money(d.lo80), f.money(d.hi80))}</small>}{d.plan != null && <small>{T.plan}: {f.money(d.plan)}{!isF ? ' (' + f.signedPct(d.actual / d.plan - 1) + ')' : ''}</small>}</>} />
          <p className="axis-note muted small">{T.moneyUnit} · {T.fan.note}</p>
        </Panel>
        <Panel title={T.marginTitle + scopeName}>
          <TrendLine values={margins} ticks={ticks} domain={range(margins)} fmt={v => f.pct(v, 1)} name={T.kpi.margin} color={C.series.finance} height={170} />
          <p className="muted small fin-note">{T.fin.marginNote}</p>
        </Panel>
      </div>

      <Panel title={T.bridgeTitle + scopeName} sub={T.bridgeSub} aside={<Button icon="tree" onClick={() => openCause(null, 'ytd')}>{T.fin.toCauses}</Button>}>
        <Waterfall steps={steps} name={id => T.bridgeSteps[id]} fmt={f.money} fmtShort={v => f.dec1(v / 1000)} label={T.bridgeTitle} />
      </Panel>

      <Panel title={T.unitsYtd} sub={T.fin.unitsSub}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>{T.cols.unit}</th><th className="num">{T.cols.rev}</th><th className="num">{T.cols.plan}</th><th className="num">{T.cols.vsPlan}</th><th className="num">{T.cols.gm}</th><th className="num">{T.cols.ebitda}</th><th className="num">{T.cols.margin}</th><th className="num">{T.fin.fyCol}</th></tr></thead>
            <tbody>
              {D.units.map(u => {
                const p = ytd([u], i), fy = fullYear(ctx.ind, u.id, i, 'rev');
                return (
                  <tr key={u.id} tabIndex="0" className={unit === u.id ? 'picked' : ''} onClick={() => setUnit(unit === u.id ? 'all' : u.id, true)} onKeyDown={e => { if (e.key === 'Enter') setUnit(unit === u.id ? 'all' : u.id, true); }}>
                    <td className="strong">{unitName(u.id)}</td>
                    <td className="num">{p.rev ? f.money(p.rev) : NONE}</td>
                    <td className="num">{p.revPlan ? f.money(p.revPlan) : NONE}</td>
                    <td className={'num' + (p.rev && p.vsPlan < -0.05 ? ' over' : '')}>{p.rev ? f.signedPct(p.vsPlan) : NONE}</td>
                    <td className="num">{p.rev ? f.pct(p.gm, 1) : NONE}</td>
                    <td className="num">{f.money(p.ebitda)}</td>
                    <td className="num">{p.rev ? f.pct(p.margin, 1) : NONE}</td>
                    <td className={'num' + (p.rev && fy.vsPlan < -0.05 ? ' over' : '')}>{p.rev ? f.signedPct(fy.vsPlan) : NONE}</td>
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
