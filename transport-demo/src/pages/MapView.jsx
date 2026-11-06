import { useMemo, useState } from 'react';
import { Panel, Kpi, Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { AccessMap, MapLegend } from '../map.jsx';
import { BandBar, ModeBars, LegStrip } from '../charts.jsx';
import { solve, stats, pathOf, routeInfo, stopDistances, placesOfSignal, SIGNALS, bandOf, BANDS } from '../model.js';
import { Controls } from './controls.jsx';

export default function MapView({ ctx }) {
  const { T, f, base, S, service, mode, period, th, selected, select, hl, setHl, zoomTarget, setZoomTarget, motion, setMotion, labels, setLabels, placeName, facName, go } = ctx;
  const [bandHl, setBandHl] = useState(null);
  const sol = solve(base, service, mode, period, {});
  const st = useMemo(() => stats(base, sol, th), [sol, th]);
  const ri = useMemo(() => (mode === 'pt' ? routeInfo(base, {}, period) : null), [mode, period]);
  const path = useMemo(() => (selected ? pathOf(base, sol, selected) : null), [selected, sol]);
  const marks = useMemo(() => (hl ? new Set(placesOfSignal(S, hl)) : null), [hl]);
  const p = selected && base.byId.get(selected);
  const sd = stopDistances(base, {}, period);

  const longest = st.list.slice().reverse().slice(0, 6);
  const chip = `${T.services[service]} · ${T.modes[mode]}${mode === 'pt' ? ' · ' + T.periods[period] : ''}`;
  const sigOf = id => SIGNALS.filter(s => s.kind === 'place' && S[s.id].some(x => x.id === id));

  return (
    <>
      <div className="kpi-grid kpi-compact">
        <Kpi icon="users" label={T.kpi.within.replace('{t}', th)} value={f.pct(st.share.all)} accent
          context={T.kpi.withinCtx.replace('{n}', f.int(st.withinPop)).replace('{N}', f.int(base.total.all))} onClick={() => setBandHl(null)} />
        <Kpi icon="clock" label={T.kpi.median} value={f.min(st.median)} context={T.kpi.medianCtx.replace('{m}', T.modesLong[mode])} />
        <Kpi icon="pin" label={T.kpi.beyond.replace('{t}', th)} value={f.int(st.beyondN)}
          context={(mode === 'pt' && st.noConn ? T.kpi.beyondCtxPt.replace('{x}', f.int(st.noConn)) : T.kpi.beyondCtx).replace('{p}', f.int(st.beyondPop))} onClick={() => setBandHl('beyond')} />
        <Kpi icon="user" label={T.kpi.old.replace('{t}', th)} value={f.pct(st.share.old)} context={T.kpi.oldCtx.replace('{p}', f.pct(st.share.all))} />
      </div>

      <Controls ctx={ctx} />
      {hl && (
        <div className="hl-note glass-control" role="status">
          <Icon name="warning" size={16} />
          <span>{T.hlNote.replace('{s}', T.signals[hl].title).replace('{n}', f.int(marks ? marks.size : 0))}</span>
          <Button icon="x" onClick={() => setHl('')}>{T.hlClear}</Button>
        </div>
      )}

      <div className="grid grid-map">
        <Panel title={T.mapTitle} sub={T.mapSub.replace('{t}', th)} className="map-panel"
          aside={<span className="count-pill">{T.placesPill.replace('{n}', f.int(st.beyondN)).replace('{N}', f.int(base.places.length))}</span>}>
          <AccessMap base={base} sol={sol} view="zones" th={th} mode={mode} period={period} routesInfo={ri} selected={selected}
            onSelect={id => select(id)} path={path} marked={marks} bandHl={bandHl} labels={labels} T={T} f={f} placeName={placeName} facName={facName}
            label={T.mapAria} zoomTarget={zoomTarget} animKey={service + mode + period} motion={motion} setMotion={setMotion} scen={{}} chip={chip} />
          <MapLegend T={T} f={f} th={th} view="zones" mode={mode} bandHl={bandHl} setBandHl={setBandHl} labels={labels} setLabels={setLabels} Segmented={Segmented} />
        </Panel>

        <div className="side-stack">
          {p ? (
            <Panel className="profile">
              <div className="profile-head">
                <div>
                  <span className="profile-kicker"><i className="kick-dot" />{T.kinds[p.kind]}</span>
                  <h3>{placeName(p)}</h3>
                  <p className="muted">{T.profPop.replace('{n}', f.int(p.pop)).replace('{o}', f.pct(p.old)).replace('{k}', f.pct(p.kids))}</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => select(null)} aria-label={T.close}><Icon name="x" size={18} /></button>
              </div>
              <div className="profile-score">
                <span className="profile-big">{path ? f.tmin(path.total) : ''}</span>
                <div className="profile-score-meta">
                  <span className={'status ' + (path && path.total <= th ? 'healthy' : 'critical')}>{path && path.total <= th ? T.inTh.replace('{t}', th) : T.outTh.replace('{t}', th)}</span>
                  <small>{T.toFac.replace('{f}', path && path.fac ? facName(path.fac) : T.none)}</small>
                </div>
              </div>
              {path && path.reachable && <LegStrip legs={path.legs} total={path.total} T={T} f={f} nameOf={id => (base.byId.has(id) ? placeName(base.byId.get(id)) : T.junction[id] || id)} />}
              <div className="profile-block">
                <h4>{T.modesCompare}</h4>
                <ModeBars T={T} f={f} th={th} times={{
                  car: solve(base, service, 'car', period, {}).placeT.get(p.id).t,
                  pt: solve(base, service, 'pt', period, {}).placeT.get(p.id).t,
                  walk: solve(base, service, 'walk', period, {}).placeT.get(p.id).t,
                }} />
                <p className="meter-note">{T.stopDist.replace('{d}', !Number.isFinite(sd.get(p.id)) ? T.noStopShort : sd.get(p.id) < 0.05 ? T.stopHere : f.km(sd.get(p.id)))}</p>
              </div>
              {sigOf(p.id).length > 0 && (
                <div className="profile-block">
                  <h4>{T.signalsTitle}</h4>
                  <ul className="sig-mini">
                    {sigOf(p.id).map(s => (
                      <li key={s.id}><span className={'status ' + s.level}>{T.status[s.level]}</span>
                        <button type="button" className="link-btn" onClick={() => go('signals', { sig: s.id })}>{T.signals[s.id].title}</button></li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          ) : (
            <Panel title={T.howTitle} className="how-panel">
              <ol className="how-list">
                {T.how.map((t, i) => <li key={i}><span className="how-n">{i + 1}</span><span>{t}</span></li>)}
              </ol>
            </Panel>
          )}

          <Panel title={T.bandTitle} sub={T.bandSub.replace('{m}', T.modesLong[mode])}>
            <BandBar bands={st.bands} total={base.total.all} T={T} f={f} bandHl={bandHl} setBandHl={setBandHl} label={T.bandTitle} />
          </Panel>

          <Panel title={T.longTitle} sub={T.longSub}>
            <div className="top-list">
              {longest.map(x => (
                <button type="button" key={x.p.id} className={'top-row' + (selected === x.p.id ? ' on' : '')} onClick={() => select(x.p.id, true)}>
                  <span className="top-id"><strong>{placeName(x.p)}</strong><small>{T.kinds[x.p.kind]} · {T.peopleN(x.p.pop, f)}</small></span>
                  <span className={'status ' + (x.t > th ? 'critical' : 'healthy')}>{x.t > th ? T.outShort : T.inShort}</span>
                  <span className="top-val">{f.tmin(x.t)}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
