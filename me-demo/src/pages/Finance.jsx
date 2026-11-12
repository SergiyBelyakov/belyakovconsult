import { useMemo, useState } from 'react';
import { NQ, QS, PARTNER_IDS, PARTNERS, BUDGET_IDS } from '../data.js';
import { finance, unitCosts } from '../model.js';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { Status } from '../parts.jsx';
import { TimeChart, PartnerScatter } from '../charts.jsx';

export default function Finance({ ctx }) {
  const { T, f, k, partner, setPartner, partnerName } = ctx;
  const [verified, setVerified] = useState(false);
  const F = useMemo(() => finance(k, verified), [k, verified]);
  const U = useMemo(() => unitCosts(k, verified), [k, verified]);
  const sel = partner === 'all' || !BUDGET_IDS.includes(partner) ? null : partner;
  const row = sel ? F.by[sel] : { ...F.tot, p: 'all' };

  // прогноз витрат: решта плану, масштабована до прогнозу вартості на завершення
  const points = useMemo(() => {
    const s = F.series(sel);
    const last = s[k].actual, eac = row.eac;
    const restPlan = s[NQ - 1].plan - s[k].plan || 1;
    return s.map(p => {
      if (p.k <= k) return p;
      const frac = (p.plan - s[k].plan) / restPlan, mean = last + (eac - last) * frac;
      const w = (eac - last) * frac * (0.08 + 0.02 * (p.k - k));
      return { ...p, mean, lo80: mean - w, hi80: mean + w, lo95: mean - w * 1.53, hi95: mean + w * 1.53 };
    });
  }, [F, sel, k]);
  const tip = (p, fut) => (
    <>
      <b>{f.q(p.k)}</b>
      {!fut && p.actual != null && <strong>{f.eur(p.actual)}</strong>}
      {fut && <strong>{f.eur(p.mean)}</strong>}
      <small>{T.fin.names.plan}: {f.eur(p.plan)}</small>
    </>
  );
  const cpiLevel = v => (v >= 0.95 ? 'healthy' : v >= 0.85 ? 'warning' : 'critical');
  const spiLevel = v => (v >= 0.9 ? 'healthy' : v >= 0.75 ? 'warning' : 'critical');
  const maxU = u => Math.max(u.plan, u.actual || 0);

  return (
    <>
      <div className="kpi-mini-row wide me-fin-figs glass">
        <div><span>{T.fin.bac}</span><b>{f.eur(row.bac)}</b></div>
        <div><span>{T.fin.pv}</span><b>{f.eur(row.pv)}</b></div>
        <div><span>{T.fin.ac}</span><b>{f.eur(row.ac)}</b><small>{f.pct((row.ac / row.bac) * 100)}</small></div>
        <div><span>{T.fin.ev}</span><b>{f.eur(row.ev)}</b></div>
        <div><span>{T.fin.cpi}</span><b>{f.dec2(row.cpi)}</b><Status level={cpiLevel(row.cpi)} T={T} text={T.status[cpiLevel(row.cpi)]} /></div>
        <div><span>{T.fin.spi}</span><b>{f.dec2(row.spi)}</b><Status level={spiLevel(row.spi)} T={T} text={T.status[spiLevel(row.spi)]} /></div>
        <div><span>{T.fin.eac}</span><b>{f.eur(row.eac)}</b><small className={row.vac < 0 ? 'over' : ''}>{(row.vac < 0 ? T.fin.over : T.fin.under) + ' ' + f.eur(Math.abs(row.vac))}</small></div>
      </div>

      <Panel title={T.fin.sTitle} sub={T.fin.sSub}>
        <div className="panel-ctl"><Segmented value={sel || 'all'} onChange={setPartner} label={T.fin.sTitle} options={[{ value: 'all', label: T.fin.all }, ...BUDGET_IDS.map(p => ({ value: p, label: p === 'M' ? T.partner('M') : p }))]} /></div>
        <TimeChart points={points} asOf={k} tick={f.tick} fmtAxis={f.eurAxis} tip={tip} names={T.fin.names} label={T.fin.sTitle} target={row.bac} targetLabel={T.fin.bac} />
        <p className="note">{T.fin.eacText(f.eur(row.eac), (row.vac < 0 ? T.fin.over : T.fin.under) + ' ' + f.eur(Math.abs(row.vac)))}</p>
      </Panel>

      <div className="grid grid-2">
        <Panel title={T.fin.scatter} sub={T.fin.scatterSub}>
          <PartnerScatter rows={F.rows.filter(r => r.p !== 'M')} fmtPct={v => f.pct(v * 100)} label={T.fin.scatter} picked={sel} onPick={setPartner}
            names={{ over: T.fin.quad.over, ok: T.fin.quad.ok, x: T.fin.xAxis, y: T.fin.yAxis, tip: r => <><b>{partnerName(r.p)}</b><strong>CPI {f.dec2(r.cpi)}</strong><small>{T.fin.xAxis}: {f.pct(r.spent * 100)}</small><small>{T.fin.yAxis}: {f.pct(r.prog * 100)}</small></> }} />
          <label className="toggle small"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /><span>{T.fin.verifiedToggle}</span></label>
        </Panel>
        <Panel title={T.fin.unit} sub={T.fin.unitSub}>
          <div className="unit-list">
            {U.map(u => {
              const m = maxU(u), worse = u.actual != null && u.actual > u.plan * 1.1;
              return (
                <div key={u.id} className={'unit-row' + (worse ? ' worse' : '')}>
                  <span className="unit-name">{T.fin.units[u.id]}</span>
                  <span className="unit-bars">
                    <i className="u-plan" style={{ width: (u.plan / m) * 100 + '%' }}><em>{T.fin.unitPlan}</em></i>
                    <i className="u-act" style={{ width: ((u.actual || 0) / m) * 100 + '%' }}><em>{T.fin.unitActual}</em></i>
                  </span>
                  <span className="unit-vals"><small>{f.eur(u.plan)}</small><b>{u.actual == null ? '·' : f.eur(u.actual)}</b>{u.actual != null && <em className={worse ? 'bad' : 'ok'}>{f.signed((u.actual / u.plan - 1) * 100, 0)}%</em>}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title={T.fin.table} sub={T.fin.note}>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr><th>{T.fin.partner}</th><th className="num" title={T.fin.bac}>BAC</th><th className="num" title={T.fin.pv}>PV</th><th className="num" title={T.fin.ac}>AC</th><th className="num">{T.fin.progress}</th><th className="num" title={T.fin.ev}>EV</th><th className="num" title={T.fin.cpi}>CPI</th><th className="num" title={T.fin.spi}>SPI</th><th className="num" title={T.fin.eac}>EAC</th><th className="num" title={T.fin.vac}>VAC</th><th className="num">{T.fin.rateNeed}</th><th className="num">{T.fin.rateNow}</th></tr>
            </thead>
            <tbody>
              {F.rows.map(r => (
                <tr key={r.p} className={'row-btn' + (sel === r.p ? ' picked' : '')} onClick={() => setPartner(r.p)}>
                  <td><i className="p-dot" style={{ '--c': PARTNERS[r.p].color }}>{r.p === 'M' ? 'M' : r.p}</i> {partnerName(r.p)}</td>
                  <td className="num">{f.eur(r.bac)}</td>
                  <td className="num muted">{f.eur(r.pv)}</td>
                  <td className="num">{f.eur(r.ac)}</td>
                  <td className="num">{f.pct(r.prog * 100)}</td>
                  <td className="num">{f.eur(r.ev)}</td>
                  <td className="num"><span className={'cpi ' + cpiLevel(r.cpi)}>{f.dec2(r.cpi)}</span></td>
                  <td className="num"><span className={'cpi ' + spiLevel(r.spi)}>{f.dec2(r.spi)}</span></td>
                  <td className="num">{f.eur(r.eac)}</td>
                  <td className={'num ' + (r.vac < -50000 ? 'over' : '')}>{f.eur(r.vac)}</td>
                  <td className="num">{f.eur(r.rate)}</td>
                  <td className={'num ' + (r.rateNow < r.rate * 0.7 ? 'over' : '')}>{f.eur(r.rateNow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
