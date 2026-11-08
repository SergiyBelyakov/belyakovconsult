// Гроші (Cash Flow Intelligence): звідки приходять і де застрягають, прогноз залишку проти порогу
// з умовами оплати клієнтів і постачальників, дебіторка за клієнтами і концентрація.
import { useState } from 'react';
import { Panel, Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { SankeyChart, ScenarioChart, Bars, COL } from '../charts2.jsx';
import { clientAR, cashFlows, cashOutlook, clientGroups } from '../cash.js';
import { runway, Z80, monthKey } from '../outlook.js';
import { yearStart } from '../model.js';
import { Status } from '../parts.jsx';

const TERMS = { lead: [-60, 30, 5], rest: [-20, 20, 1], dpo: [0, 45, 5] };

export default function Cash({ ctx }) {
  const { T, f, D, ind, i, cashTerms, setCashTerms } = ctx;
  const [per, setPer] = useState('ytd');
  const [asTable, setAsTable] = useState(false);
  const a = per === 'm' ? i : per === 'ytd' ? yearStart(i) : Math.max(0, i - 11);
  const F = cashFlows(ind, a, i);
  const O = cashOutlook(ind, i, cashTerms);
  const B = O.B;
  const co = D.company[i], ref = D.company[Math.max(0, i - 12)];
  const daily = co.ar / co.dso;
  const tied = (co.dso - ref.dso) * daily;
  const rw = runway(B);
  const rwLevel = rw == null || rw > 6 ? 'healthy' : rw > 3 ? 'warning' : 'critical';
  const AR = clientAR(ind, i), AR6 = clientAR(ind, Math.max(0, i - 6));
  const nodeName = id => {
    if (id.startsWith('client:')) return T.cash.groups[ind][id.slice(7)];
    if (id.startsWith('use:')) return T.cash.uses[id.slice(4)];
    return T.cash.nodes[id];
  };
  const months = O.base.months.map(m => f.tick(monthKey(m.t)));
  const set = (k, v) => setCashTerms({ ...cashTerms, [k]: v });
  const firstBelow = r => (r.firstBelow != null ? f.month(monthKey(r.firstBelow), true) : T.cash.never);
  const leadName = T.cash.leadName[ind];

  return (
    <>
      <div className="kpi-mini-row wide glass">
        <div><span>{T.cash.now}</span><b>{f.money(co.cash)}</b><small>{f.month(co.m, true)}</small></div>
        <div><span>{T.cash.threshold}</span><b>{f.money(B.threshold)}</b><small>{T.cash.thresholdNote}</small></div>
        <div><span>{T.head.labels.runway}</span><b className={rwLevel === 'critical' ? 'over' : ''}>{rw == null ? T.head.runwayLong : f.dec1(rw) + ' ' + T.head.monthsUnit}</b><Status level={rwLevel} T={T} /></div>
        <div><span>DSO</span><b className={co.dso > 60 ? 'over' : ''}>{f.int(co.dso)} {T.daysUnit}</b><small>{T.cash.yearAgo(f.int(ref.dso))}</small></div>
        <div><span>{T.cash.ar}</span><b>{f.money(co.ar)}</b><small>{T.cash.overdue(f.pct(co.aging[2] + co.aging[3], 0))}</small></div>
        <div><span>{T.cash.tied}</span><b className={tied > 0 ? 'over' : 'good'}>{f.money(Math.max(0, tied))}</b><small>{T.cash.tiedNote}</small></div>
      </div>

      <Panel title={T.cash.flowTitle} sub={T.cash.flowSub(f.money(F.rev), f.money(F.stuck), F.dCash < 0 ? f.money(-F.dCash) : null)}
        aside={<div className="panel-ctl"><Segmented value={per} onChange={setPer} label={T.cash.period} options={[{ value: 'm', label: T.causes.month }, { value: 'ytd', label: T.causes.ytd }, { value: 'ltm', label: T.cash.ltm }]} /><Button icon={asTable ? 'chart' : 'grid'} onClick={() => setAsTable(!asTable)}>{asTable ? T.cash.asChart : T.cash.asTable}</Button></div>}>
        {asTable ? (
          <div className="table-scroll">
            <table className="data-table plain compact">
              <thead><tr><th>{T.cash.from}</th><th>{T.cash.to}</th><th className="num">{T.cols.amount}</th></tr></thead>
              <tbody>{F.links.map((l, k) => <tr key={k}><td>{nodeName(F.nodes[l.source].id)}</td><td>{nodeName(F.nodes[l.target].id)}</td><td className="num">{f.money(l.value)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : (
          <SankeyChart data={F} name={nodeName} fmt={f.money} label={T.cash.flowTitle} />
        )}
        <div className="legend legend-static">
          <span><i className="band" style={{ '--c': COL.actual }} />{T.cash.lg.in}</span>
          <span><i className="band" style={{ '--c': COL.crit }} />{T.cash.lg.stuck}</span>
          {F.dCash < 0 && <span><i className="band" style={{ '--c': COL.warn }} />{T.cash.lg.draw}</span>}
          <span><i className="band" style={{ '--c': '#94A3B8' }} />{T.cash.lg.out}</span>
        </div>
      </Panel>

      <div className="grid grid-scen">
        <Panel title={T.cash.termsTitle} sub={T.cash.termsSub}>
          <div className="drivers">
            {Object.entries(TERMS).map(([k, [lo, hi, st]]) => {
              const v = cashTerms[k] || 0;
              return (
                <label key={k} className="driver">
                  <span className="driver-head"><span>{T.cash.terms[k](leadName)}</span><b className={v ? 'on' : ''}>{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(v)} {T.daysUnit}</b></span>
                  <input type="range" min={lo} max={hi} step={st} value={v} onChange={e => set(k, Number(e.target.value))} aria-label={T.cash.terms[k](leadName)} />
                  <small className="muted">{T.cash.termsHint[k]}</small>
                </label>
              );
            })}
            {O.changed && <Button icon="reset" onClick={() => setCashTerms({})}>{T.scen.reset}</Button>}
          </div>
        </Panel>
        <div className="stack">
          <div className="scen-out three">
            <div className="scen-card glass"><span>{T.cash.minCash}</span><div className="scen-vals"><small>{f.money(O.base.minCash)}</small><Icon name="arrowRight" size={14} /><b className={O.scen.minCash < B.threshold ? 'over' : ''}>{f.money(O.scen.minCash)}</b></div><em className={O.scen.minCash - O.base.minCash >= 0 ? 'good' : 'over'}>{O.changed ? f.signedMoney(O.scen.minCash - O.base.minCash) : T.scen.same}</em></div>
            <div className="scen-card glass"><span>{T.cash.firstBelow}</span><div className="scen-vals"><small>{firstBelow(O.base)}</small><Icon name="arrowRight" size={14} /><b>{firstBelow(O.scen)}</b></div><em className="muted">{T.cash.monthsBelow(O.scen.monthsBelow)}</em></div>
            <div className="scen-card glass"><span>{T.cash.ebitdaEffect}</span><div className="scen-vals"><b>{O.changed ? f.signedMoney(O.scen.ebitda12 - O.base.ebitda12) : T.scen.same}</b></div><em className="muted">{T.cash.ebitdaNote}</em></div>
          </div>
          <Panel title={T.cash.fcTitle} sub={T.cash.fcSub}>
            <ScenarioChart ticks={months} base={O.base.months.map(m => m.cash)} scen={O.scen.months.map(m => m.cash)}
              band={B.months.map(m => ({ lo: m.cash - Z80 * m.sdCash, hi: m.cash + Z80 * m.sdCash }))} threshold={{ value: B.threshold, label: T.fan.threshold(f.money(B.threshold)) }}
              fmtAxis={f.axisMoney} label={T.cash.fcTitle} names={{ base: T.cash.base, scen: T.cash.scen, band: T.fan.band }}
              tip={k => <><b>{months[k]}</b><small>{T.cash.base}: {f.money(O.base.months[k].cash)}</small>{O.changed && <small>{T.cash.scen}: {f.money(O.scen.months[k].cash)}</small>}<small>DSO: {f.int(O.scen.months[k].dso)} {T.daysUnit}</small></>} />
            <p className="axis-note muted small">{T.moneyUnit} · {T.cash.fcNote}</p>
          </Panel>
        </div>
      </div>

      <div className="grid grid-main">
        <Panel title={T.cash.clientsTitle} sub={T.cash.clientsSub}>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead><tr><th>{T.cash.client}</th><th className="num">{T.cols.share}</th><th className="num">DSO</th><th className="num">{T.cash.dso6}</th><th className="num">{T.cash.ar}</th><th className="num">{T.cash.over60}</th></tr></thead>
              <tbody>
                {AR.map((c, k) => (
                  <tr key={c.id} className="plain-row">
                    <td className="strong">{T.clients[c.id]}</td>
                    <td className="num">{f.pct(c.share, 0)}</td>
                    <td className={'num' + (c.dso > 75 ? ' over' : '')}>{f.int(c.dso)}</td>
                    <td className={'num' + (c.dso - AR6[k].dso > 10 ? ' over' : '')}>{f.sign(c.dso - AR6[k].dso)}{f.int(Math.abs(c.dso - AR6[k].dso))}</td>
                    <td className="num">{f.money(c.ar)}</td>
                    <td className={'num' + (c.overdue > 0.25 * c.ar ? ' over' : '')}>{f.money(c.overdue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="stack">
          <Panel title={T.agingTitle} sub={f.money(co.ar)}>
            <Bars items={co.aging.map((x, k) => ({ id: 'a' + k, name: T.aging[k], value: x, color: k >= 2 ? COL.crit : COL.actual }))} max={1} fmt={v => f.pct(v, 0)} />
          </Panel>
          <Panel title={T.clientsTitle} sub={T.clientsSub}>
            <Bars items={D.clients.map(([id, v]) => ({ id, name: T.clients[id], value: v, color: id === 'other' ? '#64748B' : COL.actual }))} max={Math.max(...D.clients.map(c => c[1]))} fmt={v => f.pct(v, 0)} />
          </Panel>
        </div>
      </div>
    </>
  );
}
