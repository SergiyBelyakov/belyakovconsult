import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { signals, SIGNALS } from '../dem.js';
import { geoSignals } from '../geo.js';

const levelOf = list => (list.some(x => x.level === 'critical') ? 'critical' : list.length ? 'warning' : 'healthy');

export default function Signals({ ctx }) {
  const { T, f, T3, sig, setSig, go, placeName } = ctx;
  const S = { ...signals(T3), ...geoSignals(T3) };
  const cur = SIGNALS.includes(sig) ? sig : SIGNALS[0];
  const target = (id, x) => {
    if (id === 'floodLow' || id === 'floodMid') return () => go('flood', { stage: x.stage });
    if (id === 'facility') return () => go('flood', { stage: x.stage });
    if (id === 'isolated') return () => go('flood', { stage: 4 });
    if (id === 'sirens') return () => go('cover', { kind: 'siren', smode: 'existing' });
    if (id === 'waterlog') return () => go('nature', { layer: 'gw' });
    if (id === 'erosion') return () => go('nature', { layer: 'erosion' });
    return () => go('relief');
  };
  const name = (id, x) => (id === 'facility' ? T.fac[x.fc.id] : id === 'steep' ? T.roadName(ctx.nodeName(x.road.a), ctx.nodeName(x.road.b)) : placeName(x.p));
  return (
    <>
      <div className="signal-grid">
        {SIGNALS.map(id => {
          const n = S[id].length, lvl = levelOf(S[id]);
          return (
            <button type="button" key={id} className={'signal' + (cur === id ? ' picked' : '') + (n ? '' : ' zero')} onClick={() => setSig(id)} aria-pressed={cur === id}>
              <span className={'signal-icon lvl-' + lvl}><StatusIcon level={lvl} size={15} /></span>
              <span className="signal-body"><strong>{T.signals[id].title}</strong></span>
              <span className="signal-count">{f.int(n)}<small>{T.signalUnit(n)}</small></span>
              <span className={'status ' + lvl}>{T.status[lvl]}</span>
            </button>
          );
        })}
      </div>
      <Panel title={T.signals[cur].title} className="flat-panel">
        <div className="signal-boxes">
          <div className="signal-action"><Icon name="info" size={16} /><span><b>{T.ruleWord}</b> {T.signals[cur].rule}</span></div>
          <div className="signal-action act"><Icon name="arrowRight" size={16} /><span><b>{T.actionWord}</b> {T.signals[cur].action}</span></div>
        </div>
        {S[cur].length ? (
          <div className="table-scroll">
            <table className="data-table sig-table">
              <tbody>
                {S[cur].map((x, i) => (
                  <tr key={i} tabIndex="0" onClick={target(cur, x)} onKeyDown={e => { if (e.key === 'Enter') target(cur, x)(); }}>
                    <td className="strong">{name(cur, x)}</td>
                    <td className="why">{T.signals[cur].why(x, f)}</td>
                    <td><span className={'status ' + x.level}><StatusIcon level={x.level} />{T.status[x.level]}</span></td>
                    <td><span className="link-btn">{T.show3d}<Icon name="chevronRight" size={14} /></span></td>
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
