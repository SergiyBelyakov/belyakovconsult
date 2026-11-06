import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Waterfall } from '../charts.jsx';
import { scenario, DRIVERS, DRIVER_RANGE, PRESETS } from '../model.js';

export default function Scenarios({ ctx }) {
  const { T, f, D, ind, i, drv, setDrv } = ctx;
  const r = scenario(D, i, drv);
  const set = (k, v) => setDrv({ ...drv, [k]: v });
  const active = PRESETS[ind].find(p => DRIVERS.every(k => (p.drv[k] || 0) === (drv[k] || 0)));
  const out = [
    ['rev', f.money(r.base.rev), f.money(r.scen.rev), r.scen.rev - r.base.rev, f.signedMoney],
    ['ebitda', f.money(r.base.ebitda), f.money(r.scen.ebitda), r.scen.ebitda - r.base.ebitda, f.signedMoney],
    ['margin', f.pct(r.base.margin, 1), f.pct(r.scen.margin, 1), r.scen.margin - r.base.margin, v => (v > 0 ? '+' : v < 0 ? '−' : '') + f.pp(v)],
    ['rpe', f.money(r.base.rpe), f.money(r.scen.rpe), r.scen.rpe - r.base.rpe, f.signedMoney],
  ];
  return (
    <>
      <div className="scen-presets">
        <span className="muted small">{T.scen.presets}</span>
        {PRESETS[ind].map(p => (
          <button type="button" key={p.id} className={'chip' + (active && active.id === p.id ? ' active' : '')} aria-pressed={!!active && active.id === p.id} onClick={() => setDrv({ ...p.drv })}>{T.scen.names[p.id]}</button>
        ))}
        <Button icon="reset" onClick={() => setDrv({})}>{T.scen.reset}</Button>
      </div>

      <div className="grid grid-scen">
        <Panel title={T.nav.scenarios} sub={T.scen.note}>
          <div className="drivers">
            {DRIVERS.map(k => {
              const [lo, hi, step] = DRIVER_RANGE[k], v = drv[k] || 0;
              return (
                <label key={k} className="driver">
                  <span className="driver-head"><span>{T.scen.drivers[k]}</span><b className={v ? 'on' : ''}>{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(v)} {T.scen.units[k]}</b></span>
                  <input type="range" min={lo} max={hi} step={step} value={v} onChange={e => set(k, Number(e.target.value))} aria-label={T.scen.drivers[k]} />
                  {T.scen.hint[k] && <small className="muted">{T.scen.hint[k]}</small>}
                </label>
              );
            })}
          </div>
        </Panel>
        <div className="stack">
          <div className="scen-out">
            {out.map(([k, a, b, d, fmt]) => (
              <div key={k} className="scen-card glass">
                <span>{T.scen.out[k]}</span>
                <div className="scen-vals"><small>{a}</small><Icon name="arrowRight" size={14} /><b>{b}</b></div>
                <em className={Math.abs(d) < 0.5e-3 ? 'muted' : d > 0 ? 'good' : 'over'}>{Math.abs(d) < 0.5e-3 ? T.scen.same : fmt(d)}</em>
              </div>
            ))}
            <div className="scen-card glass">
              <span>{T.scen.out.cash}</span>
              <div className="scen-vals"><b>{Math.abs(r.cashDso) < 0.5 ? T.scen.same : f.signedMoney(r.cashDso)}</b></div>
              <em className="muted">{T.scen.hint.dso}</em>
            </div>
          </div>
          {r.scen.margin < 0.05 && <div className="signal-action"><Icon name="warning" size={16} /><span>{T.scen.warnLow}</span></div>}
          <Panel title={T.scen.stepsTitle} sub={T.scen.stepsSub}>
            <Waterfall steps={r.steps} name={id => T.bridgeSteps[id]} fmt={f.money} label={T.scen.stepsTitle} height={300} />
          </Panel>
        </div>
      </div>
    </>
  );
}
