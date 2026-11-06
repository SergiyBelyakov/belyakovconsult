import { Panel, Kpi, Button } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { kpis, brief, agg, turnover, SIGNALS, levelOf } from '../model.js';

const NONE = '·';
const toneIcon = { bad: 'warning', good: 'check', info: 'info' };

export function fmtKpi(k, f, T) {
  if (k.fmt === 'money') return f.money(k.value);
  if (k.fmt === 'pct1') return f.pct(k.value, 1);
  if (k.fmt === 'days') return f.int(k.value) + ' ' + T.daysUnit;
  if (k.fmt === 'min') return f.int(k.value) + ' ' + T.minUnit;
  return f.int(k.value);
}

export default function Overview({ ctx }) {
  const { T, f, D, ind, unit, i, go, S, unitName, setUnit } = ctx;
  const list = kpis(D, ind, unit, i);
  const items = brief(D, ind, i);
  const sigs = SIGNALS.flatMap(s => S[s.id].map(x => ({ ...x, sig: s.id }))).sort((a, b) => (a.level === 'critical' ? 0 : 1) - (b.level === 'critical' ? 0 : 1));
  const rows = D.units.map(u => {
    const c = agg([u], i);
    const n = SIGNALS.reduce((a, s) => a + S[s.id].filter(x => x.unit === u.id).length, 0);
    const lvl = levelOf(SIGNALS.flatMap(s => S[s.id].filter(x => x.unit === u.id)));
    return { u, c, t: turnover([u], i), n, lvl };
  });
  return (
    <>
      <Panel title={T.briefTitle(f.month(D.company[i].m, true))} sub={T.briefSub} className="brief-panel">
        <ul className="brief">
          {items.map(x => (
            <li key={x.id} className={'brief-item tone-' + x.tone}>
              <span className="brief-icon"><Icon name={toneIcon[x.tone]} size={16} /></span>
              <p>{T.brief[x.id](x, f, unitName)}</p>
              <button type="button" className="link-btn" onClick={() => go(T.briefGo[x.id], x.unit || x.worst ? { unit: x.id === 'cash' ? 'all' : (x.unit || x.worst) } : {})}>
                {T.goWord}<Icon name="chevronRight" size={14} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="kpi-grid five">
        {list.map(k => (
          <Kpi key={k.id} icon={k.icon} label={T.kpi[k.id]} value={fmtKpi(k, f, T)}
            delta={k.neutral ? 0 : k.delta} deltaText={T.delta[k.dText[0]](k.dText[1])} goodWhenUp={k.goodWhenUp !== false}
            context={T.kpiCtx[k.ctx]} spark={k.spark} accent={k.accent} onClick={() => go(k.page)} />
        ))}
      </div>

      <div className="grid grid-main">
        <Panel title={T.unitsTable} sub={T.unitsTableSub}>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead><tr><th>{T.cols.unit}</th><th className="num">{T.cols.rev}</th><th className="num">{T.cols.vsPlan}</th><th className="num">{T.cols.margin}</th><th className="num">{T.cols.hc}</th><th className="num">{T.cols.turnover}</th><th>{T.cols.signals}</th></tr></thead>
              <tbody>
                {rows.map(({ u, c, t, n, lvl }) => (
                  <tr key={u.id} tabIndex="0" onClick={() => { setUnit(u.id); go('finance', { unit: u.id }); }} onKeyDown={e => { if (e.key === 'Enter') go('finance', { unit: u.id }); }}>
                    <td className="strong">{unitName(u.id)}</td>
                    <td className="num">{c.rev ? f.money(c.rev) : NONE}</td>
                    <td className={'num' + (c.rev && c.vsPlan < -0.05 ? ' over' : '')}>{c.rev ? f.signedPct(c.vsPlan) : NONE}</td>
                    <td className="num">{c.rev ? f.pct(c.margin, 1) : NONE}</td>
                    <td className="num">{f.int(c.hc)}</td>
                    <td className={'num' + (t > 0.2 ? ' over' : '')}>{f.pct(t, 1)}</td>
                    <td>{n ? <span className={'status ' + lvl}><StatusIcon level={lvl} />{f.int(n)}</span> : <span className="muted small">{T.noSignals}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={T.topSignals} sub={T.topSignalsSub} aside={<Button icon="arrowRight" onClick={() => go('risks')}>{T.allSignals}</Button>}>
          <div className="mini-signals">
            {sigs.slice(0, 6).map((x, k) => (
              <button type="button" key={k} className="mini-signal" onClick={() => go('risks', { sig: x.sig })}>
                <span className={'signal-icon lvl-' + x.level}><StatusIcon level={x.level} size={14} /></span>
                <span><strong>{T.signals[x.sig].title}</strong><small>{x.unit ? unitName(x.unit) : T.companyWide} · {T.signals[x.sig].why(x, f)}</small></span>
              </button>
            ))}
            {!sigs.length && <p className="empty-line">{T.noSignals}</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
