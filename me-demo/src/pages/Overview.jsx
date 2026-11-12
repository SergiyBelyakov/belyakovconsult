import { useMemo } from 'react';
import { NOW, QS, IND, IND_BY, OUTCOME_IDS, MILESTONES, REGION_IDS, SURVEY_AT } from '../data.js';
import { summary, reach, finance, dqa, attention, regionStats, effect, statusOf, rank } from '../model.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Kpi, Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Status, Meter } from '../parts.jsx';
import { UAMap, SEQ } from '../charts.jsx';
import { sigInfo } from '../texts.js';

export const covColor = c => SEQ[c >= 0.18 ? 4 : c >= 0.14 ? 3 : c >= 0.1 ? 2 : c >= 0.06 ? 1 : 0];

export default function Overview({ ctx }) {
  const { T, f, k, go, openInd, code, regionName, openReport } = ctx;
  const d = useMemo(() => {
    const S = summary(k), R = reach(k), F = finance(k), Q = dqa(k), A = attention(k), RS = regionStats(k);
    const E = k >= SURVEY_AT.mid ? effect('inc') : null;
    const hist = fn => QS.slice(0, k + 1).map(q => fn(q.i));
    return {
      S, R, F, Q, A, RS, E,
      sp: { reach: hist(i => reach(i).unique), on: hist(i => summary(i).counts.healthy), spent: hist(i => finance(i).tot.spent), cpi: hist(i => finance(i).tot.cpi), dq: hist(i => dqa(i).index) },
    };
  }, [k]);
  const { S, R, F, Q, A, RS, E, sp } = d;
  const n = S.st.filter(x => x.s.level !== 'info').length;
  const sctx = { ...ctx, unconfirmed: R.unconfirmed };
  const act = info => (info.ind ? () => openInd(info.ind) : info.go ? () => go(info.go[0], info.go[1]) : null);

  return (
    <>
      <div className="kpi-grid me-kpis">
        <Kpi icon="users" label={T.kpi.reach} value={f.int(R.unique)} delta={R.ratio - 1} deltaText={T.kpi.reachOf(f.pct(R.ratio * 100))} context={T.kpi.reachSub(f.int(R.gross), f.int(R.verified))} spark={sp.reach} onClick={() => go('quality')} />
        <Kpi icon="target" label={T.kpi.onTrack} value={T.kpi.onTrackVal(S.counts.healthy, n)} delta={0} deltaText={null} context={T.kpi.onTrackCtx(S.counts.critical, S.counts.warning)} spark={sp.on} onClick={() => go('indicators')} />
        <Kpi icon="coins" label={T.kpi.spent} value={f.pct(F.tot.spent * 100)} delta={0} deltaText={T.kpi.spentCtx(f.pct(F.tot.time * 100))} context={T.kpi.spentSub(f.eur(F.tot.ac), f.eur(F.tot.bac))} spark={sp.spent} onClick={() => go('finance')} />
        <Kpi icon="scale" label={T.kpi.cpi} value={f.dec2(F.tot.cpi)} delta={F.tot.cpi - 1} deltaText={T.kpi.cpiCtx(f.dec2(F.tot.cpi))} context={T.kpi.cpiSub(f.eur(F.tot.eac))} spark={sp.cpi} onClick={() => go('finance', { partner: 'all' })} />
        <Kpi icon="shield" label={T.kpi.dq} value={f.int(Q.index)} unit=" / 100" delta={(Q.worst.score - 85) / 20} deltaText={T.kpi.dqCtx(Q.worst.p, f.int(Q.worst.score))} context={T.dq.index} spark={sp.dq} onClick={() => go('quality')} />
        <Kpi icon="pulse" label={T.kpi.effect} value={E ? f.pp(E.did.est) : '·'} delta={E ? E.did.est / 10 : 0} deltaText={E ? T.kpi.effectCtx(f.signed(E.did.lo), f.signed(E.did.hi)) : T.kpi.effectWait} context={T.ev.methods.did.n} onClick={() => go('evaluation')} />
      </div>

      <section className="attention">
        <div className="section-head">
          <h2>{T.attTitle}</h2>
          <p>{T.attSub}</p>
        </div>
        <div className="att-grid me-att">
          {A.map((s, i) => {
            const info = sigInfo(s, sctx), on = act(info);
            return (
              <article key={s.id + i} className={'att glass lvl-' + s.level}>
                <div className="att-top"><span className="att-rank">{i + 1}</span><Status level={s.level === 'critical' ? 'critical' : 'warning'} T={T} text={T.sig[s.id].t} /></div>
                <h3>{info.t}</h3>
                <p className="att-why">{info.why}</p>
                {info.fig && <div className="att-impact"><span>{info.fig[0]}</span><b>{info.fig[1]}</b></div>}
                <div className="att-actions">
                  {on && <button type="button" className="link-btn" onClick={on}>{T.attOpen}: {info.ind ? T.fw.open : T.nav[info.go[0]]} <Icon name="arrowRight" size={14} /></button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid grid-2 me-ov">
        <Panel title={T.outcomesTitle} sub={T.outcomesSub}>
          <div className="oc-list">
            {OUTCOME_IDS.map((o, i) => {
              const b = S.byOutcome[o], inds = IND.filter(x => x.out === o);
              return (
                <button type="button" key={o} className="oc-row" onClick={() => go('framework')}>
                  <span className="oc-num">{i + 1}</span>
                  <span className="oc-main">
                    <b>{T.outcome[o]}</b>
                    <span className="oc-chips">
                      {inds.map(x => { const s = statusOf(x, k); return <i key={x.id} className={'chip-dot ' + s.level} title={code(x) + ' ' + T.ind[x.id].s + ': ' + T.status[s.level]} />; })}
                      <small>{T.inds(inds.length)}</small>
                    </span>
                  </span>
                  <span className="oc-meter"><Meter value={b.prog} /><small>{b.prog == null ? '·' : f.pct(b.prog * 100) + ' ' + T.ofPlan}</small></span>
                  <Status level={b.worst} T={T} text={b.worst === 'critical' ? T.critN(b.crit) : undefined} />
                </button>
              );
            })}
            {(() => {
              const xs = IND.filter(x => x.lvl === 'cross' || x.lvl === 'impact');
              return (
                <div className="oc-extra">
                  {xs.map(x => { const s = statusOf(x, k); return <button type="button" key={x.id} className="oc-mini" onClick={() => openInd(x.id)}><span>{code(x)}</span><b>{T.ind[x.id].s}</b><em>{f.value(x, s.v)}</em><Status level={s.level} T={T} /></button>; })}
                </div>
              );
            })()}
          </div>
        </Panel>
        <Panel title={T.mapTitle} sub={T.mapSub}>
          <UAMap
            values={Object.fromEntries(RS.list.map(x => [x.id, { color: covColor(x.coverage), label: f.pct(x.coverage * 100, 1) }]))}
            marks={Object.fromEntries(RS.list.filter(x => x.relCov < 0.6).map(x => [x.id, 1]))}
            name={regionName} onPick={id => go('regions', { region: id })} label={T.mapTitle}
            tipRows={id => { const x = RS.by[id]; return <><strong>{f.pct(x.coverage * 100, 1)}</strong><small>{T.reg.unique}: {f.int(x.unique)} / {f.int(x.pin)}</small></>; }}
            legend={<div className="map-legend"><span>{T.reg.coverage}</span><small>{'<6%'}</small>{SEQ.map((c, i) => <i key={c} style={{ background: c }} title={['<6%', '6-10%', '10-14%', '14-18%', '≥18%'][i]} />)}<small>{'≥18%'}</small><span className="ml-mark"><b />{T.reg.white}</span></div>}
          />
        </Panel>
      </div>

      <Panel title={T.timelineTitle} className="me-time">
        <ol className="ms-line">
          {MILESTONES.map(m => (
            <li key={m.id} className={(m.k <= k ? 'done' : '') + (m.k > NOW ? ' fut' : '')}>
              <span className="ms-q">{f.q(m.k)}</span>
              <span className="ms-dot" />
              <span className="ms-name">{T.milestone[m.id]}</span>
            </li>
          ))}
        </ol>
        <div className="ms-actions">
          <Button icon="report" onClick={openReport}>{T.report}</Button>
          <Button icon="download" onClick={ctx.exportIptt}>{T.rep.xlsx}</Button>
        </div>
      </Panel>
    </>
  );
}
