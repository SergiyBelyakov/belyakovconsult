import { useEffect, useRef } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { BarList } from '../../../dashboard/src/charts.jsx';
import { C } from '../charts.jsx';
import { SIGNALS, levelOf } from '../model.js';

export default function Risks({ ctx }) {
  const { T, f, D, S, sig, setSig, go, unitName } = ctx;
  const cur = SIGNALS.find(s => s.id === sig) || SIGNALS.find(s => S[s.id].length) || SIGNALS[0];
  const items = [...S[cur.id]].sort((a, b) => (a.level === 'critical' ? 0 : 1) - (b.level === 'critical' ? 0 : 1));
  const ref = useRef(null);
  useEffect(() => { if (sig && ref.current && window.innerWidth < 980) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [sig]);

  return (
    <>
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
                  <tr key={k} tabIndex="0" onClick={() => go(cur.page === 'risks' ? 'finance' : cur.page, { unit: x.unit || 'all' })} onKeyDown={e => { if (e.key === 'Enter') go(cur.page, { unit: x.unit || 'all' }); }}>
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

      <div className="grid grid-2">
        <Panel title={T.clientsTitle} sub={T.clientsSub}>
          <BarList items={D.clients.map(([id, v], k) => ({ id, name: T.clients[id], value: v, color: id === 'other' ? C.slate : k < 3 ? C.series.operations : C.primary }))} max={Math.max(...D.clients.map(c => c[1]))} fmt={v => f.pct(v, 0)} />
        </Panel>
        <Panel title={T.agingTitle} sub={f.money(D.company[ctx.i].ar)}>
          <BarList items={D.company[ctx.i].aging.map((a, k) => ({ id: 'a' + k, name: T.aging[k], value: a, color: k >= 2 ? C.status.critical : C.primary }))} max={1} fmt={v => f.pct(v, 0)} />
        </Panel>
      </div>
    </>
  );
}
