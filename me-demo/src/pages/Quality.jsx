import { useMemo, useState } from 'react';
import { DQ, PARTNER_IDS, PARTNERS, QS } from '../data.js';
import { dqa, DQA_STD, dqLevel, reach, signals, digitStats } from '../model.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { Status } from '../parts.jsx';
import { DigitBars, ReachSteps } from '../charts.jsx';
import { sigInfo } from '../texts.js';

export default function Quality({ ctx }) {
  const { T, f, k, partnerName, go, openInd } = ctx;
  const Q = useMemo(() => dqa(k), [k]);
  const R = useMemo(() => reach(k), [k]);
  const S = useMemo(() => signals(k).filter(s => s.level !== 'info'), [k]);
  const DATA_SIG = ['verify', 'heaping', 'late', 'disagg', 'double', 'over'];
  const SD = S.filter(s => DATA_SIG.includes(s.id)), SP = S.filter(s => !DATA_SIG.includes(s.id));
  const [cell, setCell] = useState({ p: 'D', s: 'validity' });
  const [dp, setDp] = useState('D');
  const dig = digitStats(dp);
  const c = Q.by[cell.p];
  const why = {
    validity: T.dq.why.validity(f.pct(c.verify, 1)),
    integrity: T.dq.why.integrity(cell.p === 'D' ? f.int(R.dupD) : null, f.int(c.edits)),
    precision: T.dq.why.precision(f.pct(cell.p === 'B' ? 99 : DQ.complete[cell.p])),
    reliability: c.dig ? T.dq.chi(f.dec1(c.dig.chi), c.dig.flag) : T.dq.why.noDigits,
    timeliness: T.dq.why.timeliness(f.dec1(c.late)),
  };
  let run = R.gross;
  const steps = [{ id: 'g', name: T.dq.gross, kind: 'total', total: R.gross, base: 0 }];
  for (const o of R.overlaps) { run -= o.n; steps.push({ id: o.a + o.b, name: T.dq.overlap + ' ' + o.a + ' + ' + o.b, kind: 'minus', v: -o.n, base: run }); }
  run -= R.dupD; steps.push({ id: 'dup', name: T.dq.dupInside, kind: 'minus', v: -R.dupD, base: run });
  steps.push({ id: 'u', name: T.dq.unique, kind: 'total', total: R.unique, base: 0 });
  run -= R.unconfirmed; steps.push({ id: 'unc', name: T.dq.unconfirmed, kind: 'minus', v: -R.unconfirmed, base: run });
  steps.push({ id: 'v', name: T.dq.verified, kind: 'total ok', total: R.verified, base: 0 });
  const sctx = { ...ctx, unconfirmed: R.unconfirmed };

  return (
    <>
      <Panel title={T.dq.matrix} sub={T.dq.matrixSub} aside={<div className="dq-index"><span>{T.dq.index}</span><b>{f.int(Q.index)}</b><Status level={dqLevel(Q.index)} T={T} text={T.dqStatus[dqLevel(Q.index)]} /></div>}>
        <div className="table-scroll">
          <table className="dq-table">
            <thead>
              <tr><th />{DQA_STD.map(s => <th key={s} title={T.dq.stdD[s]}>{T.dq.std[s]}</th>)}<th>{T.dq.score}</th></tr>
            </thead>
            <tbody>
              {Q.rows.map(r => (
                <tr key={r.p}>
                  <th><i className="p-dot" style={{ '--c': PARTNERS[r.p].color }}>{r.p}</i>{T.sector[PARTNERS[r.p].sector]}</th>
                  {DQA_STD.map(s => {
                    const v = r.s[s], lv = dqLevel(v);
                    return (
                      <td key={s}>
                        <button type="button" className={'heat-cell ' + lv + (cell.p === r.p && cell.s === s ? ' picked' : '')} onClick={() => setCell({ p: r.p, s })} aria-label={T.partner(r.p) + ', ' + T.dq.std[s] + ': ' + Math.round(v)}>
                          <b>{f.int(v)}</b><small>{T.dqStatus[lv]}</small>
                        </button>
                      </td>
                    );
                  })}
                  <td className="dq-score"><b>{f.int(r.score)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dq-why glass">
          <Icon name="info" size={16} />
          <div><b>{T.partner(cell.p)} · {T.dq.std[cell.s]}: {f.int(c.s[cell.s])}</b><p>{T.dq.stdD[cell.s]} {why[cell.s]}</p></div>
        </div>
      </Panel>

      <div className="grid grid-2">
        <Panel title={T.dq.verify} sub={T.dq.verifySub(DQ.sample)}>
          <div className="ver-list">
            {Q.rows.map(r => (
              <div key={r.p} className={'ver-row' + (r.verify < 90 ? ' low' : '')}>
                <span className="ver-name"><i className="p-dot" style={{ '--c': PARTNERS[r.p].color }}>{r.p}</i></span>
                <span className="ver-bar"><i style={{ width: Math.max(0, (r.verify - 60) / 40) * 100 + '%' }} /><s style={{ left: '75%' }} title={T.dq.threshold} /></span>
                <b>{f.pct(r.verify, 1)}</b>
                <span className="ver-spark">{DQ.verify[r.p].slice(0, k + 1).map((v, i) => <i key={i} style={{ height: Math.max(2, (v - 70) * 0.9) + 'px' }} className={v < 90 ? 'low' : ''} title={f.q(i) + ': ' + v + '%'} />)}</span>
              </div>
            ))}
            <p className="axis-note">60% … 100% · {T.dq.threshold}</p>
          </div>
        </Panel>
        <Panel title={T.dq.dedup} sub={T.dq.dedupSub}>
          <ReachSteps steps={steps} fmt={f.int} label={T.dq.dedup} />
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={T.dq.digits} sub={T.dq.digitsSub}>
          <div className="panel-ctl"><Segmented value={dp} onChange={setDp} label={T.dq.digits} options={['A', 'C', 'D'].map(p => ({ value: p, label: T.partner(p) }))} /></div>
          <DigitBars d={dig.d} label={T.dq.digits} expected={T.dq.expected} />
          <p className={'note' + (dig.flag ? ' warn' : '')}><Icon name={dig.flag ? 'warning' : 'check'} size={14} />{T.dq.chi(f.dec1(dig.chi), dig.flag)}</p>
        </Panel>
        <Panel title={T.dq.late} sub={T.dq.lateSub}>
          <div className="table-scroll">
            <table className="late-table">
              <thead><tr><th />{QS.slice(0, k + 1).map(q => <th key={q.i}>{f.tick(q.i)}</th>)}</tr></thead>
              <tbody>
                {PARTNER_IDS.map(p => (
                  <tr key={p}>
                    <th><i className="p-dot" style={{ '--c': PARTNERS[p].color }}>{p}</i></th>
                    {DQ.late[p].slice(0, k + 1).map((v, i) => <td key={i}><span className={'late-cell ' + (v > 14 ? 'critical' : v > 5 ? 'warning' : 'healthy')} title={f.q(i)}>{v}</span></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title={T.dq.signals} sub={T.dq.signalsSub}>
        <div className="sig-list">
          {SD.map((s, i) => {
            const info = sigInfo(s, sctx), sg = T.sig[s.id];
            const open = info.ind ? () => openInd(info.ind) : null;
            return (
              <article key={s.id + i} className={'sig-card lvl-' + s.level}>
                <div className="sig-top"><Status level={s.level} T={T} text={T.sigLevel[s.level]} /><span className="sig-subj">{info.subject}</span></div>
                <h4>{sg.t}</h4>
                <p className="sig-why">{info.why || info.t}</p>
                <dl>
                  <dt>{T.dq.rule}</dt><dd>{sg.rule}</dd>
                  <dt>{T.dq.may}</dt><dd>{sg.may}</dd>
                  <dt>{T.dq.step}</dt><dd>{sg.step}</dd>
                </dl>
                {open && <button type="button" className="link-btn" onClick={open}>{T.attOpen} <Icon name="arrowRight" size={13} /></button>}
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title={T.dq.signalsPerf} sub={T.dq.signalsPerfSub}>
        <div className="table-scroll">
          <table className="data-table compact perf-sig">
            <thead><tr><th>{T.dq.level}</th><th>{T.dq.signal}</th><th>{T.dq.subject}</th><th>{T.dq.what}</th><th /></tr></thead>
            <tbody>
              {SP.map((s, i) => {
                const info = sigInfo(s, sctx);
                const open = info.ind ? () => openInd(info.ind) : info.go ? () => go(info.go[0], info.go[1]) : null;
                return (
                  <tr key={s.id + i}>
                    <td><Status level={s.level} T={T} text={T.sigLevel[s.level]} /></td>
                    <td>{T.sig[s.id].t}</td>
                    <td>{info.subject}</td>
                    <td className="why-cell">{info.why || info.t}</td>
                    <td>{open && <button type="button" className="link-btn" onClick={open}>{T.attOpen}</button>}</td>
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
