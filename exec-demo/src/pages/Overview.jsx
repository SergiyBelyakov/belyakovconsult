// Рівень 1: «Що відбувається?» П'ять головних показників із прогнозом, ризиком і причинами,
// три проблеми з найбільшим фінансовим впливом і віяло прогнозу.
import { useState } from 'react';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { HeadKpi, Conf } from '../parts.jsx';
import { FanChart } from '../charts2.jsx';
import { headline, scopeForecast, baseline, wfUnit, Z80, Z95 } from '../outlook.js';
import { attention } from '../risk.js';
import { causeTree, factorGroups, leafFor, pathFrom } from '../causes.js';
import { dataFor, agg, pick, series, ytd, ytdLY, turnover, yearStart, SIGNALS, levelOf } from '../model.js';
import { clientAR } from '../cash.js';

const NONE = '·';

function Delta({ v, kind, good = true, f, T, ctxText }) {
  const dir = Math.abs(v) < (kind === 'pts' ? 0.5 : 0.0005) ? 'flat' : v > 0 ? 'up' : 'down';
  const cls = dir === 'flat' ? 'neutral' : (dir === 'up') === good ? 'good' : 'bad';
  const text = kind === 'pct' ? f.signedPct(v) : kind === 'pp' ? f.sign(v) + f.pp(v) : f.sign(v) + f.int(Math.abs(v)) + ' ' + T.head.pts;
  return <><span className={'kpi-delta ' + cls}>{dir !== 'flat' && <Icon name={dir === 'up' ? 'arrowUp' : 'arrowDown'} size={12} />}{text}</span><span className="kpi-context">{ctxText}</span></>;
}

export function situation(D, ind, unit, i) {
  const units = pick(D, unit), y = ytd(units, i), ly = ytdLY(units, i);
  const cash = D.company.slice(Math.max(0, i - 11), i + 1).map(c => c.cash);
  const peak = Math.max(...cash), pk = cash.indexOf(peak);
  return { rev: ly ? y.rev / ly.rev - 1 : null, ebitda: ly ? y.ebitda / ly.ebitda - 1 : null, cash: D.company[i].cash / peak - 1, months: cash.length - 1 - pk, vsPlan: y.vsPlan };
}

export default function Overview({ ctx }) {
  const { T, f, D, ind, unit, i, go, unitName, openExplain, setUnit, openCause, applyPresets, startTour } = ctx;
  const H = headline(ind, unit, i);
  const att = attention(ind, i);
  const tree = causeTree(ind, yearStart(i), i);
  const sit = situation(D, ind, unit, i);
  const [fan, setFan] = useState('ebitda');
  const units = pick(D, unit);

  // фактори для кожного показника
  const groups = factorGroups(tree).filter(g => unit === 'all' || g.unit === unit);
  const short = id => T.unitsShort[ind][id] || unitName(id);
  const facts = {
    rev: unit === 'all'
      ? D.units.filter(u => u.kind !== 'office').map(u => ({ u, p: ytd([u], i) })).map(x => ({ id: x.u.id, v: x.p.rev - x.p.revPlan })).sort((a, b) => a.v - b.v).slice(0, 2).map(x => short(x.id) + ' ' + f.signedMoney(x.v))
      : [T.head.ytdVsPlan + ' ' + f.signedPct(H.y.vsPlan)],
    ebitda: groups.slice(0, 2).map(g => T.factorShort[ind][g.factor] + (unit === 'all' ? ' · ' + short(g.unit) : '') + ' ' + f.signedMoney(g.value)),
    runway: [T.head.dsoNow(f.int(D.company[i].dso), f.int(D.company[Math.max(0, i - 12)].dso))],
    eff: D.units.filter(u => (ind === 'mfg' ? u.kind === 'plant' : u.kind === 'branch' || u.kind === 'online') && (unit === 'all' || u.id === unit))
      .map(u => { const k = ind === 'mfg' ? 'oee' : 'util'; return { id: u.id, d: i >= 12 ? u.rows[i][k] - u.rows[i - 12][k] : 0 }; })
      .sort((a, b) => a.d - b.d).slice(0, 2).map(x => short(x.id) + ' ' + f.sign(x.d) + f.pp(x.d)),
    wf: unit === 'all'
      ? D.units.map(u => ({ id: u.id, v: wfUnit(u, i).value })).sort((a, b) => b.v - a.v).slice(0, 2).map(x => short(x.id) + ' ' + f.int(x.v))
      : (() => { const u = D.units.find(x => x.id === unit), r = u.rows[i]; return [T.head.turn + ' ' + f.pct(turnover([u], i), 1), T.head.ot + ' ' + f.pct(r.overtime, 1)]; })(),
  };

  const fmtV = k => {
    if (k.id === 'rev' || k.id === 'ebitda') return f.money(k.value);
    if (k.id === 'runway') return k.value == null ? T.head.runwayLong : f.dec1(k.value) + ' ' + T.head.monthsUnit;
    if (k.id === 'eff') return f.pct(k.value, 1);
    return f.int(k.value) + ' / 100';
  };
  const fmtFy = k => {
    if (!k.fy) return NONE;
    const r = k.fy;
    if (k.id === 'rev' || k.id === 'ebitda') return <>{f.money(r.value)} <small className={r.vsPlan < -0.02 ? 'over' : ''}>{f.signedPct(r.vsPlan)} {T.kpiCtx.vsPlan}</small><small>{T.head.range(f.money(r.lo), f.money(r.hi))}</small></>;
    if (k.id === 'runway') return <>{f.money(r.value)} <small>{T.head.range(f.money(r.lo), f.money(r.hi))}</small></>;
    if (k.id === 'eff') return <>{f.pct(r.value, 1)} <small>{T.head.range(f.pct(r.lo, 1), f.pct(r.hi, 1))}</small></>;
    return <>{f.int(r.value)} <small>{T.head.range(f.int(r.lo), f.int(r.hi))}</small></>;
  };
  const deltaOf = k => {
    if (k.id === 'rev') return <Delta v={k.delta} kind="pct" f={f} T={T} ctxText={T.kpiCtx.vsPlan} />;
    if (k.id === 'ebitda') return <Delta v={k.delta} kind="pct" f={f} T={T} ctxText={T.kpiCtx.vsPlan + ' · ' + T.head.margin + ' ' + f.pct(k.margin, 1)} />;
    if (k.id === 'runway') return <span className="kpi-context">{T.head.runwayCtx(f.money(k.cash), f.money(k.threshold))}</span>;
    if (k.id === 'eff') return <Delta v={k.delta} kind="pp" f={f} T={T} ctxText={T.head.effName[ind] + ' · ' + T.kpiCtx.vsLY} />;
    return <Delta v={k.delta} kind="pts" good={false} f={f} T={T} ctxText={T.kpiCtx.vsLY} />;
  };

  // віяло прогнозу
  const fanData = (() => {
    const B = baseline(ind, i);
    if (fan === 'cash') {
      const hist = D.company.slice(Math.max(0, i - 11), i + 1).map(c => ({ m: c.m, tick: f.tick(c.m), actual: c.cash, plan: null }));
      const fut = B.months.map(m => ({ m: m.m, tick: f.tick(m.m), mean: m.cash, lo80: m.cash - Z80 * m.sdCash, hi80: m.cash + Z80 * m.sdCash, lo95: m.cash - Z95 * m.sdCash, hi95: m.cash + Z95 * m.sdCash, plan: null }));
      return { hist, fut, threshold: { value: B.threshold, label: T.fan.threshold(f.money(B.threshold)) } };
    }
    const S = series(units, Math.max(0, i - 11), i);
    const hist = S.map(r => ({ m: r.m, tick: f.tick(r.m), actual: r.ebitda, plan: r.ebitdaPlan }));
    const fut = scopeForecast(ind, unit, i).map(x => ({ m: x.m, tick: f.tick(x.m), mean: x.ebitda, lo80: x.ebitda - Z80 * x.sdE, hi80: x.ebitda + Z80 * x.sdE, lo95: x.ebitda - Z95 * x.sdE, hi95: x.ebitda + Z95 * x.sdE, plan: x.planE }));
    return { hist, fut };
  })();
  const fy = H.list.find(k => k.id === 'ebitda').fy;

  // проблеми: заголовок, ланцюжок, ефект рішення
  const chain = a => {
    if (a.id === 'receivables') {
      const A = clientAR(ind, i).find(c => ['a', 'corp1'].includes(c.id)), cash = D.company.slice(Math.max(0, i - 11), i + 1).map(c => c.cash);
      return T.att.chainRecv(f, { dsoLy: D.company[Math.max(0, i - 12)].dso, dso: D.company[i].dso, lead: A ? A.dso : null, cash: D.company[i].cash / Math.max(...cash) - 1 }, ind);
    }
    const u = a.main && D.units.find(x => x.id === a.main);
    if (!u) return null;
    const r = u.rows[i];
    if (a.id === 'volume' || a.id === 'people') return ind === 'mfg'
      ? [T.head.turn + ' ' + f.pct(turnover([u], i), 1), 'OEE ' + f.pct(r.oee ?? 0, 1), T.att.defect + ' ' + f.dec1(r.defect ?? 0) + '%', T.att.vsPlan + ' ' + f.signedPct(r.rev / r.revPlan - 1)]
      : [T.head.turn + ' ' + f.pct(turnover([u], i), 1), T.att.wait + ' ' + f.int(r.wait ?? 0) + ' ' + T.minUnit, 'NPS ' + f.int(r.nps ?? 0), T.att.vsPlan + ' ' + f.signedPct(r.rev / r.revPlan - 1)];
    if (a.id === 'materials') return [T.att.matRate + ' ' + f.pct(r.cogs / r.rev, 1), T.att.planRate + ' ' + f.pct(r.cogsPlan / r.revPlan, 1)];
    return null;
  };
  const whyAt = a => {
    if (a.id === 'receivables') { go('cash'); return; }
    const leaf = leafFor(tree, a.main, a.factors);
    openCause(leaf ? pathFrom(tree, leaf.id) : null, 'ytd');
  };

  return (
    <>
      <section className="situation glass" aria-label={T.sit.label}>
        <div className="sit-text">
          <span className="sit-kicker">{T.sit.kicker(f.month(D.company[i].m, true), unit === 'all' ? T.companyShort[ind] : unitName(unit))}</span>
          <p>{T.sit.text(sit, f)}</p>
        </div>
        <div className="sit-actions">
          <button type="button" className="btn btn-ghost" onClick={() => openExplain({ per: 'm' })}><Icon name="bulb" size={16} /><span>{T.explain.button}</span></button>
          <button type="button" className="btn btn-ghost" onClick={() => go('ceo')}><Icon name="target" size={16} /><span>{T.ceo.start}</span></button>
          <button type="button" className="btn btn-ghost" onClick={startTour}><Icon name="play" size={16} /><span>{T.tour.start}</span></button>
        </div>
      </section>

      <div className="hk-grid" data-tour="kpis">
        {H.list.map(k => (
          <HeadKpi key={k.id} k={k} T={T} f={f} value={k.na ? NONE : fmtV(k)} delta={k.na ? null : deltaOf(k)} fy={fmtFy(k)} factors={facts[k.id]}
            onOpen={() => go(k.page)} onWhy={() => (k.why === 'causes' ? openCause(null, 'ytd') : go(k.why))} onExplain={k.explain ? () => openExplain({ per: 'm' }) : null} />
        ))}
      </div>

      <section className="attention" data-tour="attention" aria-label={T.att.title}>
        <div className="section-head">
          <h2>{T.att.title}</h2>
          <p>{T.att.sub}</p>
        </div>
        <div className="att-grid">
          {att.map((a, k) => {
            const ch = chain(a);
            return (
              <article key={a.id} className={'att glass' + (k === 0 ? ' first' : '')}>
                <div className="att-top">
                  <span className="att-rank">{k + 1}</span>
                  <div>
                    <h3>{T.att.titles[a.id](ind, a.main ? unitName(a.main) : '')}</h3>
                    <p className="att-impact"><b>{f.signedMoney(a.impact)}</b> {a.kind === 'cash' ? T.att.perCash : T.att.perYear}</p>
                  </div>
                </div>
                <p className="att-why">{T.att.why[a.id](a, f, unitName, ind)}</p>
                {ch && <div className="att-chain">{ch.map((c, n) => <span key={n}>{n > 0 && <Icon name="arrowRight" size={12} />}<em>{c}</em></span>)}</div>}
                <div className="att-conf"><Conf level={a.conf} T={T} /><small>{a.chronic ? T.att.chronic : T.att.months(a.months)}</small></div>
                {a.chronic && <div className="att-fix"><span>{T.att.fixLabel}</span><b>{T.att.chronicFix}</b><small>{T.att.chronicNote}</small></div>}
                {a.fix && !a.chronic && (
                  <div className="att-fix">
                    <span>{T.att.fixLabel}</span>
                    <b>{T.presets[ind][a.fix]}</b>
                    <small>{a.kind === 'cash' ? T.att.effectCash(f.signedMoney(a.effect.minCash)) : T.att.effectEbitda(f.signedMoney(a.effect.ebitda), a.effect.vol, a.effect.wf, f)}</small>
                  </div>
                )}
                <div className="att-actions">
                  <button type="button" className="link-btn" onClick={() => whyAt(a)}><Icon name="why" size={14} />{T.head.why}</button>
                  {a.fix && !a.chronic && <button type="button" className="link-btn" onClick={() => applyPresets([a.fix])}><Icon name="flask" size={14} />{T.att.simulate}</button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid grid-main">
        <Panel title={T.fan.title[fan]} sub={fan === 'cash' ? T.fan.subCash : T.fan.sub(f.money(fy.value), f.signedPct(fy.vsPlan))}
          aside={<Segmented value={fan} onChange={setFan} label={T.fan.label} options={[{ value: 'ebitda', label: 'EBITDA' }, { value: 'cash', label: T.fan.cash }]} />}>
          <FanChart hist={fanData.hist} fut={fanData.fut} threshold={fanData.threshold} fmtAxis={f.axisMoney} label={T.fan.title[fan]}
            names={{ actual: T.actual, plan: T.plan, fc: T.fan.fc, band: T.fan.band }}
            tip={(d, isF) => <><b>{f.month(d.m, true)}{isF ? ' · ' + T.fan.fc : ''}</b><strong>{f.money(isF ? d.mean : d.actual)}</strong>{isF && <small>{T.fan.range80(f.money(d.lo80), f.money(d.hi80))}</small>}{d.plan != null && <small>{T.plan}: {f.money(d.plan)}</small>}</>} />
          <p className="axis-note muted small">{T.moneyUnit} · {T.fan.note}</p>
        </Panel>
        <Panel title={T.unitsTable} sub={T.unitsTableSub2}>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead><tr><th>{T.cols.unit}</th><th className="num">{T.cols.vsPlan}</th><th className="num">{T.cols.wfShort}</th><th>{T.cols.signals}</th></tr></thead>
              <tbody>
                {D.units.map(u => {
                  const c = agg([u], i), w = wfUnit(u, i).value;
                  const lst = SIGNALS.flatMap(s => ctx.S[s.id].filter(x => x.unit === u.id));
                  const lvl = levelOf(lst);
                  return (
                    <tr key={u.id} tabIndex="0" className={unit === u.id ? 'picked' : ''} onClick={() => setUnit(unit === u.id ? 'all' : u.id, true)} onKeyDown={e => { if (e.key === 'Enter') setUnit(unit === u.id ? 'all' : u.id, true); }}>
                      <td className="strong">{unitName(u.id)}</td>
                      <td className={'num' + (c.rev && c.vsPlan < -0.05 ? ' over' : '')}>{c.rev ? f.signedPct(c.vsPlan) : NONE}</td>
                      <td className={'num' + (w >= 60 ? ' over' : '')}>{f.int(w)}</td>
                      <td>{lst.length ? <span className={'status ' + lvl}><StatusIcon level={lvl} />{f.int(lst.length)}</span> : <span className="muted small">{T.noSignals}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
