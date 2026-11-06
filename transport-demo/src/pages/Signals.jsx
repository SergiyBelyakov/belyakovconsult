import { useEffect, useRef } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { SIGNALS } from '../model.js';

export default function Signals({ ctx }) {
  const { T, f, base, S, sig, setSig, go, placeName, facName } = ctx;
  const cur = SIGNALS.find(s => s.id === sig) || SIGNALS[0];
  const key = x => (x.t2 != null && Number.isFinite(x.t2) ? x.t2 - x.t : x.km != null ? (Number.isFinite(x.km) ? x.km : 99) : x.pop != null ? x.pop / (x.cap || 1) : x.t != null ? x.t : 0);
  const items = [...S[cur.id]].sort((a, b) => key(b) - key(a));
  const ref = useRef(null);
  useEffect(() => { if (sig && ref.current && window.innerWidth < 980) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [sig]);
  const pop = list => list.reduce((a, x) => a + (base.byId.get(x.id)?.pop || 0), 0);
  const unit = (s, n) => T.signalUnit(s.kind, n);

  const row = x => {
    if (cur.kind === 'route') {
      return (
        <tr key={x.id}>
          <td className="strong">{T.routeName(x.id)}</td>
          <td className="why">{T.signals.rare.why(x, f)}</td>
          <td />
        </tr>
      );
    }
    if (cur.kind === 'facility') {
      const fc = { id: x.id };
      return (
        <tr key={x.id}>
          <td className="strong">{facName(fc)}</td>
          <td className="why">{T.signals.overload.why(x, f)}</td>
          <td><Button icon="hospital" onClick={() => go('facilities', { service: 'primary', mode: 'car' })}>{T.toFacilities}</Button></td>
        </tr>
      );
    }
    const p = base.byId.get(x.id);
    return (
      <tr key={x.id} tabIndex="0" onClick={() => go('map', signalView(cur.id, x.id))} onKeyDown={e => { if (e.key === 'Enter') go('map', signalView(cur.id, x.id)); }}>
        <td className="strong">{placeName(p)}<small className="cell-sub">{T.kinds[p.kind]} · {T.peopleN(p.pop, f)}</small></td>
        <td className="why">{T.signals[cur.id].why(x, f, p)}</td>
        <td><span className="link-btn">{T.showOnMap}<Icon name="chevronRight" size={14} /></span></td>
      </tr>
    );
  };

  return (
    <>
      <div className="signal-grid">
        {SIGNALS.map(s => {
          const n = S[s.id].length;
          return (
            <button type="button" key={s.id} className={'signal' + (cur.id === s.id ? ' picked' : '') + (n ? '' : ' zero')} onClick={() => setSig(s.id)} aria-pressed={cur.id === s.id}>
              <span className={'signal-icon lvl-' + s.level}><StatusIcon level={s.level} size={15} /></span>
              <span className="signal-body"><strong>{T.signals[s.id].title}</strong></span>
              <span className="signal-count">{f.int(n)}<small>{unit(s, n)}</small></span>
              <span className={'status ' + s.level}>{T.status[s.level]}</span>
            </button>
          );
        })}
      </div>

      <div ref={ref} className="signal-anchor" />
      <Panel title={T.signals[cur.id].title} sub={T.signals[cur.id].desc} className="flat-panel"
        aside={cur.kind === 'place' && items.length > 0 && <Button icon="map" onClick={() => go('map', { hl: cur.id, ...signalView(cur.id) })}>{T.showAllOnMap}</Button>}>
        <div className="signal-boxes">
          <div className="signal-action"><Icon name="info" size={16} /><span><b>{T.ruleWord}</b> {T.signals[cur.id].rule}</span></div>
          <div className="signal-action act"><Icon name="arrowRight" size={16} /><span><b>{T.actionWord}</b> {T.signals[cur.id].action}</span></div>
        </div>
        {cur.kind === 'place' && items.length > 0 && <p className="signal-note muted small">{T.sigPop.replace('{n}', f.int(pop(items))).replace('{p}', f.pct(pop(items) / base.total.all))}</p>}
        {items.length ? (
          <div className="table-scroll">
            <table className="data-table sig-table">
              <thead><tr><th>{cur.kind === 'route' ? T.cols.route : cur.kind === 'facility' ? T.cols.facility : T.cols.place}</th><th>{T.cols.why}</th><th /></tr></thead>
              <tbody>{items.map(row)}</tbody>
            </table>
          </div>
        ) : <p className="empty-line">{T.sigEmpty}</p>}
      </Panel>
    </>
  );
}

// На якій карті показувати сигнал
export function signalView(id, place) {
  const v = {
    hospitalBus: { service: 'hospital', mode: 'pt', period: 'day' },
    elderly: { service: 'primary', mode: 'pt', period: 'day' },
    eveningCut: { service: 'primary', mode: 'pt', period: 'pm' },
    noStop: { service: 'primary', mode: 'pt', period: 'day' },
    bridge: { service: 'hospital', mode: 'car', period: 'day' },
    border: { service: 'hospital', mode: 'car', period: 'day' },
  }[id] || {};
  return place ? { ...v, id: place } : v;
}
