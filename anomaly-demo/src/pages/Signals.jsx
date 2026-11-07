// Список сигналів від найнезвичнішого: причини, рівень, перевірка; праворуч картка запису.
import { useMemo, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { ModelBar, GroupChips, RecordCard, reasonLine } from './controls.jsx';
import { tally } from '../engine.js';
import { download, csvCell } from '../util.js';

const LIMIT = 150;

export default function Signals({ ctx }) {
  const { T, f, ds, E, res, D, th, groups, sel, setSel, order, go, lang, notify, method, cx } = ctx;
  const [truth, setTruth] = useState(false);
  const list = useMemo(() => Array.from(order).filter(i => D[i] >= th && (!groups.size || groups.has(ds.gi[i]))), [order, th, groups]);
  const tAll = useMemo(() => tally(ds, D, th), [D, th]);
  const cur = sel != null && D[sel] >= th ? sel : list[0] != null ? list[0] : null;
  const top2 = i => E.reasons(res, i).filter(r => r.lp < Math.log(0.05)).slice(0, 2);
  const exportList = () => {
    const rows = [['rank', 'id', 'date', 'time', 'group', 'counterparty', 'amount_uah', 'level_sigma', 'reasons', 'method', 'baseline', 'truth', 'cause'],
      ...list.map((i, k) => { const x = ds.rows[i]; return [k + 1, x.id, f.day(x.day), f.time(x.t), T.groups[ds.groups[x.g].id], ds.cps[x.cp].name[lang], x.amount.toFixed(2), D[i].toFixed(2), top2(i).map(r => reasonLine(ctx, i, r)).filter(Boolean).join('; '), T.methods[method], T.contexts[cx], T.truth[x.truth], x.cause || '']; })];
    download('BC_anomaly_signals.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'));
    notify(T.signalsPage.csvDone);
  };
  return (
    <>
      <ModelBar ctx={ctx} compact />
      <GroupChips ctx={ctx} counts={tAll.byG} />
      <div className="toolbar an-toolbar">
        <label className="truth-toggle"><input type="checkbox" checked={truth} onChange={e => setTruth(e.target.checked)} />{T.signalsPage.showTruth}</label>
        <Button icon="download" onClick={exportList} disabled={!list.length}>{T.signalsPage.csv}</Button>
      </div>
      <div className="grid grid-queue an-queue">
        <Panel title={T.signalsPage.list(f.int(list.length), f.int(ds.n))} sub={list.length > LIMIT ? T.signalsPage.top(LIMIT) : null}>
          {list.length ? (
            <div className="table-scroll">
              <table className="data-table compact queue-table an-table">
                <thead><tr><th>{T.signalsPage.cols.id}</th><th>{T.signalsPage.cols.group}</th><th className="num">{T.signalsPage.cols.amount}</th><th className="num">{T.signalsPage.cols.level}</th><th>{T.signalsPage.cols.why}{truth ? ' · ' + T.signalsPage.cols.truth : ''}</th></tr></thead>
                <tbody>
                  {list.slice(0, LIMIT).map(i => {
                    const x = ds.rows[i];
                    return (
                      <tr key={i} tabIndex="0" className={cur === i ? 'picked' : ''} onClick={() => setSel(i)} onKeyDown={e => { if (e.key === 'Enter') setSel(i); }}>
                        <td className="strong mono">{x.id}<small className="cell-sub">{f.day(x.day)}, {f.time(x.t)}</small></td>
                        <td>{T.groupsShort[ds.groups[x.g].id]}<small className="cell-sub">{ds.cps[x.cp].name[lang]}</small></td>
                        <td className="num">{f.uah(x.amount)}</td>
                        <td className="num"><span className="score-pill an-pill">{f.sigma(D[i])}</span></td>
                        <td className="reasons">{top2(i).map(r => <span key={r.id} className="reason">{T.features[r.id]}</span>)}{truth && <span className={'an-truth-tag t-' + x.truth}>{T.truth[x.truth]}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">{T.signalsPage.none}</p>}
        </Panel>
        <Panel className="case-panel an-card-panel">
          <RecordCard key={cur == null ? 'none' : cur} ctx={ctx} i={cur} actions={cur != null ? <Button icon="cloud" kind="primary" onClick={() => go('cloud', { sel: cur })}>{T.card.show3d}</Button> : null} />
        </Panel>
      </div>
    </>
  );
}
