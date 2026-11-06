import { useMemo, useState } from 'react';
import { Panel, Kpi, Segmented, Select, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { AccessMap, MapLegend } from '../map.jsx';
import { solve, stats, bestSites, routeInfo, MAXT } from '../model.js';
import { Controls } from './controls.jsx';

const CARDS = [
  { id: 'ponton', icon: 'bridge' },
  { id: 'drt', icon: 'bus' },
  { id: 'rural', icon: 'clock' },
  { id: 'newPoint', icon: 'hospital' },
];

const meanT = (base, sol) => base.places.reduce((a, p) => a + Math.min(sol.placeT.get(p.id).t, MAXT) * p.pop, 0) / base.total.all;

export default function Scenarios({ ctx }) {
  const { T, f, base, service, mode, period, th, scen, setScen, motion, setMotion, placeName, facName, go, setService } = ctx;
  const [mapView, setMapView] = useState('diff');
  const before = solve(base, service, mode, period, {});
  const after = solve(base, service, mode, period, scen);
  const sb = useMemo(() => stats(base, before, th), [before, th]);
  const sa = useMemo(() => stats(base, after, th), [after, th]);
  const mb = meanT(base, before), ma = meanT(base, after);
  const deltas = useMemo(() => base.places.map(p => ({ p, a: before.placeT.get(p.id).t, b: after.placeT.get(p.id).t }))
    .map(x => ({ ...x, d: Math.min(x.a, MAXT) - Math.min(x.b, MAXT) })).filter(x => x.d >= 0.5).sort((x, y) => y.d - x.d), [before, after]);
  const faster10 = deltas.filter(x => x.d >= 10).reduce((a, x) => a + x.p.pop, 0);
  const best = useMemo(() => bestSites(base, mode, period, { ...scen, newPoint: null }, th).slice(0, 6), [mode, period, scen.ponton, scen.drt, scen.rural, th]);
  const ri = useMemo(() => (mode === 'pt' ? routeInfo(base, scen, period) : null), [mode, period, scen]);
  const any = scen.ponton || scen.drt || scen.rural || scen.newPoint;
  const toggle = id => setScen(s => ({ ...s, [id]: !s[id] }));
  const setPoint = id => setScen(s => ({ ...s, newPoint: id || null }));
  const chip = `${T.services[service]} · ${T.modes[mode]}${mode === 'pt' ? ' · ' + T.periods[period] : ''}`;
  const effect = id => {
    const sc = id === 'newPoint' ? { newPoint: scen.newPoint || best[0]?.id } : { [id]: true };
    const s1 = stats(base, solve(base, service, mode, period, sc), th);
    return { gain: s1.withinPop - sb.withinPop, mean: meanT(base, solve(base, service, mode, period, sc)) - mb };
  };

  return (
    <>
      <div className="scen-grid">
        {CARDS.map(c => {
          const on = c.id === 'newPoint' ? !!scen.newPoint : !!scen[c.id];
          const e = effect(c.id);
          const na = (c.id === 'newPoint' && service !== 'primary') || ((c.id === 'drt' || c.id === 'rural') && mode !== 'pt');
          return (
            <div key={c.id} className={'scen-card glass' + (on ? ' on' : '')}>
              <div className="scen-head">
                <span className="kpi-icon"><Icon name={c.icon} size={18} /></span>
                <strong>{T.scen[c.id].title}</strong>
                <button type="button" role="switch" aria-checked={on} className={'switch' + (on ? ' on' : '')} aria-label={T.scen[c.id].title}
                  onClick={() => (c.id === 'newPoint' ? setPoint(on ? null : best[0]?.id) : toggle(c.id))}><i /></button>
              </div>
              <p>{T.scen[c.id].text}</p>
              {c.id === 'newPoint' && (
                <Select value={scen.newPoint || ''} onChange={setPoint} label={T.scen.newPoint.pick}
                  options={[{ value: '', label: T.scen.newPoint.none }, ...best.map(b => ({ value: b.id, label: placeName(base.byId.get(b.id)) }))]} />
              )}
              <div className="scen-effect">
                {na ? <span className="muted">{c.id === 'newPoint' ? T.scen.naService : T.scen.naMode}</span> : (
                  <>
                    <span><b className={e.gain > 0 ? 'good' : ''}>{f.signed(e.gain)}</b> {T.scen.peopleIn.replace('{t}', th)}</span>
                    <span><b className={e.mean < -0.05 ? 'good' : ''}>{f.signed(Math.round(e.mean * 10) / 10, f.dec1)}</b> {T.scen.meanMin}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="kpi-grid kpi-compact">
        <Kpi icon="users" label={T.kpi.within.replace('{t}', th)} value={f.pct(sa.share.all)} accent
          deltaText={any ? f.signed(sa.withinPop - sb.withinPop) + ' ' + T.peopleShort : null} delta={sa.withinPop - sb.withinPop}
          context={T.kpi.wasCtx.replace('{v}', f.pct(sb.share.all))} />
        <Kpi icon="clock" label={T.kpi.mean} value={f.min(ma)} deltaText={any ? f.signed(Math.round((ma - mb) * 10) / 10, f.dec1) + ' ' + T.minUnit : null} delta={ma - mb} goodWhenUp={false}
          context={T.kpi.wasCtx.replace('{v}', f.min(mb))} />
        <Kpi icon="spark" label={T.kpi.faster} value={f.int(faster10)} context={T.kpi.fasterCtx.replace('{n}', f.int(deltas.filter(x => x.d >= 10).length))} />
        <Kpi icon="pin" label={T.kpi.beyond.replace('{t}', th)} value={f.int(sa.beyondN)} deltaText={any ? f.signed(sa.beyondN - sb.beyondN) : null} delta={sa.beyondN - sb.beyondN} goodWhenUp={false}
          context={T.kpi.wasCtx.replace('{v}', f.int(sb.beyondN))} />
      </div>

      <Controls ctx={ctx} extra={
        <Segmented value={mapView} onChange={setMapView} label={T.scenViewLabel} options={[{ value: 'diff', label: T.scenViews.diff }, { value: 'after', label: T.scenViews.after }, { value: 'before', label: T.scenViews.before }]} />
      } />

      <div className="grid grid-map">
        <Panel title={T.scenMapTitle[mapView]} sub={T.scenMapSub[mapView].replace('{t}', th)} className="map-panel"
          aside={!any && <span className="count-pill">{T.scenNone}</span>}>
          <AccessMap base={base} sol={mapView === 'before' ? before : after} before={before} view={mapView === 'diff' ? 'diff' : 'zones'} th={th} mode={mode} period={period}
            routesInfo={mapView === 'before' ? (mode === 'pt' ? routeInfo(base, {}, period) : null) : ri} T={T} f={f} placeName={placeName} facName={facName}
            label={T.scenMapTitle[mapView]} motion={motion} setMotion={setMotion} scen={mapView === 'before' ? {} : scen} chip={chip}
            animKey={'s' + mapView + service + mode + period + JSON.stringify(scen)} onSelect={id => id && go('map', { id })} />
          <MapLegend T={T} f={f} th={th} view={mapView === 'diff' ? 'diff' : 'zones'} mode={mode} />
        </Panel>
        <div className="side-stack">
          <Panel title={T.bestTitle} sub={service === 'primary' ? T.bestSub.replace('{t}', th).replace('{m}', T.modesLong[mode]) : T.bestNa}>
            {service === 'primary' ? (
              <div className="top-list">
                {best.map((b, i) => (
                  <button type="button" key={b.id} className={'top-row best-row' + (scen.newPoint === b.id ? ' on' : '')} onClick={() => setPoint(scen.newPoint === b.id ? null : b.id)}>
                    <span className="best-n">{i + 1}</span>
                    <span className="top-id"><strong>{placeName(base.byId.get(b.id))}</strong><small>{T.bestMeta.replace('{s}', f.dec1(b.saved))}</small></span>
                    <span className="top-val">{f.signed(b.gain)}</span>
                  </button>
                ))}
              </div>
            ) : <Button icon="hospital" onClick={() => setService('primary')}>{T.bestSwitch}</Button>}
            <p className="hint">{T.bestHint}</p>
          </Panel>
          <Panel title={T.winTitle} sub={any ? T.winSub : T.winNone}>
            <div className="mini-rows">
              {deltas.slice(0, 8).map(x => (
                <button type="button" key={x.p.id} className="mini-row" onClick={() => go('map', { id: x.p.id })}>
                  <span>{placeName(x.p)}</span>
                  <small>{f.min(x.a)} → {f.min(x.b)}</small>
                  <b className="good">{'−' + f.min(x.d)}</b>
                </button>
              ))}
              {any && !deltas.length && <p className="muted small">{T.winZero}</p>}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
