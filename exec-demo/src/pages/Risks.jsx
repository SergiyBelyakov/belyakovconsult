// Раннє попередження: ризики за фінансовим впливом з причиною спрацювання і впевненістю,
// теплова карта підрозділів, незвичні зміни, прогноз виходу за межі і правила сигналів.
import { useEffect, useRef, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { RiskHeat } from '../charts2.jsx';
import { SIGNALS, levelOf } from '../model.js';
import { riskList, anomalies, breaches, heatmap, HEAT_COLS } from '../risk.js';
import { Conf, Status } from '../parts.jsx';

export default function Risks({ ctx }) {
  const { T, f, D, ind, i, S, sig, setSig, go, unitName, setUnit } = ctx;
  const [all, setAll] = useState(false);
  const R = riskList(ind, i), A = anomalies(ind, i), Br = breaches(ind, i), HM = heatmap(ind, i);
  const crit = R.filter(x => x.level === 'critical').length, warn = R.length - crit;
  const atRiskE = R.filter(x => x.kind === 'ebitda').reduce((s, x) => s + x.impact, 0);
  const atRiskC = R.filter(x => x.kind === 'cash').reduce((s, x) => s + x.impact, 0);
  const cur = SIGNALS.find(s => s.id === sig) || SIGNALS.find(s => S[s.id].length) || SIGNALS[0];
  const items = [...S[cur.id]].sort((a, b) => (a.level === 'critical' ? 0 : 1) - (b.level === 'critical' ? 0 : 1));
  const ref = useRef(null);
  useEffect(() => { if (sig && ref.current && window.innerWidth < 980) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [sig]);
  const openAt = (page, u) => { if (u) setUnit(u, true); go(page); };
  const pageOf = id => (['dso', 'overdue', 'cash', 'concentration'].includes(id) ? 'cash' : SIGNALS.find(x => x.id === id).page);
  const metricVal = (m, v) => (['overtime', 'sick', 'oee', 'otd', 'cogsRate', 'util', 'repeat'].includes(m) ? f.pct(v, 1) : m === 'vsPlan' ? f.signedPct(v) : m === 'defect' ? f.dec1(v) + '%' : m === 'wait' ? f.int(v) + ' ' + T.minUnit : m === 'vacDays' ? f.int(v) + ' ' + T.daysUnit : f.int(v));
  const brVal = (b, v) => (b.id === 'cash' ? f.money(v) : b.id === 'dso' ? f.int(v) + ' ' + T.daysUnit : b.id === 'revPlan' ? f.signedPct(v) : b.id === 'nps' ? f.int(v) : b.id === 'wait' ? f.int(v) + ' ' + T.minUnit : b.id === 'defect' ? f.dec1(v) + '%' : f.pct(v, 1));

  return (
    <>
      <div className="kpi-mini-row wide glass">
        <div><span>{T.status.critical}</span><b className={crit ? 'over' : ''}>{f.int(crit)}</b><small>{T.risk.cases(crit)}</small></div>
        <div><span>{T.status.warning}</span><b>{f.int(warn)}</b><small>{T.risk.cases(warn)}</small></div>
        <div><span>{T.risk.atRiskE}</span><b className={atRiskE < 0 ? 'over' : ''}>{f.money(-atRiskE)}</b><small>{T.risk.perYear}</small></div>
        <div><span>{T.risk.atRiskC}</span><b className={atRiskC < 0 ? 'over' : ''}>{f.money(-atRiskC)}</b><small>{T.risk.cashNote}</small></div>
        <div><span>{T.risk.anoms}</span><b>{f.int(A.filter(a => a.bad).length)}</b><small>{T.risk.anomsNote}</small></div>
        <div><span>{T.risk.breaches}</span><b>{f.int(Br.length)}</b><small>{T.risk.breachNote}</small></div>
      </div>

      <Panel title={T.risk.listTitle} sub={T.risk.listSub}>
        <ol className="risk-list">
          {(all ? R : R.slice(0, 6)).map((x, k) => (
            <li key={x.sig + (x.unit || '')} className={'risk-item lvl-' + x.level}>
              <span className="risk-rank">{k + 1}</span>
              <div className="risk-main">
                <div className="risk-top">
                  <strong>{T.signals[x.sig].title}</strong>
                  <span className="muted">{x.unit ? unitName(x.unit) : T.companyWide}</span>
                  <Status level={x.level} T={T} />
                </div>
                <p className="risk-why"><b>{T.risk.trigger}</b> {T.signals[x.sig].why(x.x, f)} <span className="muted">{T.ruleWord} {T.signals[x.sig].rule}</span></p>
                <p className="risk-act"><b>{T.actionWord}</b> {T.signals[x.sig].action}</p>
              </div>
              <div className="risk-side">
                <b className="risk-impact">{f.money(Math.abs(x.impact))}</b>
                <small>{T.risk.kind[x.kind]}</small>
                <Conf level={x.conf} T={T} note={T.risk.confNote(x.months)} />
                <small className="muted">{T.risk.confNote(x.months)}</small>
                <button type="button" className="link-btn" onClick={() => openAt(pageOf(x.sig), x.unit)}>{T.goWord}<Icon name="chevronRight" size={14} /></button>
              </div>
            </li>
          ))}
        </ol>
        {R.length > 6 && <Button icon={all ? 'chevron' : 'chevronRight'} onClick={() => setAll(!all)}>{all ? T.risk.less : T.risk.more(R.length)}</Button>}
        <p className="muted small">{T.risk.impactNote}</p>
      </Panel>

      <div className="grid grid-2">
        <Panel title={T.risk.heatTitle} sub={T.risk.heatSub}>
          <RiskHeat rows={HM} cols={HEAT_COLS} colName={c => T.risk.heatCols[c]} rowName={u => (u ? unitName(u) : T.companyWide)} T={T}
            cellText={c => (c.value == null ? T.status[c.level] : c.fmt === 'signedPct' ? f.signedPct(c.value) : c.fmt === 'index' ? f.int(c.value) : c.fmt === 'defect' ? f.dec1(c.value) + '%' : c.fmt === 'days' ? f.int(c.value) + ' ' + T.daysUnit : f.int(c.value))}
            onCell={(u, c) => openAt({ plan: 'finance', people: 'people', quality: 'operations', cash: 'cash' }[c], u)} />
        </Panel>
        <Panel title={T.risk.anomTitle} sub={T.risk.anomSub}>
          {A.length ? (
            <ul className="anom-list">
              {A.slice(0, 7).map(a => (
                <li key={a.unit + a.metric} className={a.bad ? 'bad' : 'good'}>
                  <span className={'signal-icon lvl-' + (a.bad ? (Math.abs(a.z) >= 5 ? 'critical' : 'warning') : 'healthy')}><StatusIcon level={a.bad ? (Math.abs(a.z) >= 5 ? 'critical' : 'warning') : 'healthy'} size={13} /></span>
                  <div>
                    <strong>{T.risk.metric[ind][a.metric]} · {unitName(a.unit)}</strong>
                    <small>{T.risk.anomText(metricVal(a.metric, a.value), metricVal(a.metric, a.median), f.dec1(Math.abs(a.z)), a.months)}</small>
                  </div>
                  <Conf level={a.conf} T={T} />
                </li>
              ))}
            </ul>
          ) : <p className="empty-line">{T.risk.noAnom}</p>}
        </Panel>
      </div>

      <Panel title={T.risk.brTitle} sub={T.risk.brSub}>
        {Br.length ? (
          <div className="table-scroll">
            <table className="data-table plain compact">
              <thead><tr><th>{T.risk.brCols.metric}</th><th>{T.cols.unit}</th><th className="num">{T.risk.brCols.now}</th><th className="num">{T.risk.brCols.thr}</th><th className="num">{T.risk.brCols.in6}</th><th>{T.risk.brCols.when}</th><th className="num">{T.risk.brCols.p}</th></tr></thead>
              <tbody>
                {Br.map(b => (
                  <tr key={b.id + (b.unit || '')}>
                    <td className="strong">{T.risk.brName[b.id]}</td>
                    <td>{b.unit ? unitName(b.unit) : T.companyWide}</td>
                    <td className="num">{brVal(b, b.now)}</td>
                    <td className="num">{brVal(b, b.thr)}</td>
                    <td className="num">{brVal(b, b.mean)}</td>
                    <td>{b.month ? f.month(b.month, true) : T.risk.brLater}</td>
                    <td className="num"><span className={'status ' + (b.p >= 0.7 ? 'critical' : b.p >= 0.4 ? 'warning' : 'info')}>{f.pct(b.p, 0)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-line">{T.risk.noBreach}</p>}
        <p className="muted small">{T.risk.brNote}</p>
      </Panel>

      <div className="section-head"><h2>{T.risk.rulesTitle}</h2><p>{T.risk.rulesSub}</p></div>
      <div className="signal-grid five">
        {SIGNALS.map(s => {
          const n = S[s.id].length, lvl = levelOf(S[s.id]);
          return (
            <button type="button" key={s.id} className={'signal' + (cur.id === s.id ? ' picked' : '') + (n ? '' : ' zero')} onClick={() => setSig(s.id)} aria-pressed={cur.id === s.id}>
              <span className={'signal-icon lvl-' + lvl}><StatusIcon level={lvl} size={15} /></span>
              <span className="signal-body"><strong>{T.signals[s.id].title}</strong></span>
              <span className="signal-count">{f.int(n)}<small>{T.signalUnit(n)}</small></span>
              <span className={'status ' + lvl}>{T.status[lvl]}</span>
            </button>
          );
        })}
      </div>
      <div ref={ref} className="signal-anchor" />
      <Panel title={T.signals[cur.id].title} sub={T.signals[cur.id].desc} className="flat-panel">
        <div className="signal-boxes">
          <div className="signal-action"><Icon name="info" size={16} /><span><b>{T.ruleWord}</b> {T.signals[cur.id].rule}</span></div>
          <div className="signal-action act"><Icon name="arrowRight" size={16} /><span><b>{T.actionWord}</b> {T.signals[cur.id].action}</span></div>
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table className="data-table sig-table">
              <thead><tr><th>{T.cols.unit}</th><th>{T.cols.why}</th><th>{T.cols.level}</th><th /></tr></thead>
              <tbody>
                {items.map((x, k) => (
                  <tr key={k} tabIndex="0" onClick={() => openAt(pageOf(cur.id), x.unit)} onKeyDown={e => { if (e.key === 'Enter') openAt(pageOf(cur.id), x.unit); }}>
                    <td className="strong">{x.unit ? unitName(x.unit) : T.companyWide}</td>
                    <td className="why">{T.signals[cur.id].why(x, f)}</td>
                    <td><span className={'status ' + x.level}><StatusIcon level={x.level} />{T.status[x.level]}</span></td>
                    <td><span className="link-btn">{T.goWord}<Icon name="chevronRight" size={14} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-line">{T.noSignals}</p>}
      </Panel>
    </>
  );
}
