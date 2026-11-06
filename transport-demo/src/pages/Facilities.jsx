import { useMemo, useState } from 'react';
import { Panel, Kpi } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { AccessMap, Glyph } from '../map.jsx';
import { solve, loads, routeInfo } from '../model.js';
import { Controls } from './controls.jsx';

export default function Facilities({ ctx }) {
  const { T, f, base, service, mode, period, th, motion, setMotion, placeName, facName, go } = ctx;
  const [facHl, setFacHl] = useState(null);
  const [hov, setHov] = useState(null);
  const sol = solve(base, service, mode, period, {});
  const ls = useMemo(() => loads(base, sol).map((o, i) => {
    const beyond = o.places.filter(id => sol.placeT.get(id).t > th).reduce((a, id) => a + base.byId.get(id).pop, 0);
    return { ...o, i, beyond };
  }), [sol, th]);
  const ri = useMemo(() => (mode === 'pt' ? routeInfo(base, {}, period) : null), [mode, period]);
  const cur = facHl != null ? facHl : hov;
  const pick = ls[cur];
  const maxPop = Math.max(...ls.map(o => Math.max(o.pop, o.f.cap || 0)), 1);
  const outside = ls.filter(o => o.f.outside).reduce((a, o) => a + o.pop, 0);
  const over = ls.filter(o => o.f.cap && o.pop > o.f.cap);
  const chip = `${T.services[service]} · ${T.modes[mode]}${mode === 'pt' ? ' · ' + T.periods[period] : ''}`;
  const statusOf = o => (!o.f.cap ? 'info' : o.pop > o.f.cap ? 'critical' : o.pop > o.f.cap * 0.9 ? 'warning' : 'healthy');

  return (
    <>
      <div className="kpi-grid kpi-compact">
        <Kpi icon="hospital" label={T.kpi.facCount} value={f.int(sol.facs.length)} context={T.kpi.facCountCtx.replace('{s}', T.servicesGen[service])} />
        <Kpi icon="clock" label={T.kpi.facAvg} value={f.min(ls.reduce((a, o) => a + o.avg * o.pop, 0) / base.total.all)} context={T.kpi.medianCtx.replace('{m}', T.modesLong[mode])} />
        <Kpi icon="warning" label={T.kpi.over} value={f.int(over.length)} accent={over.length > 0}
          context={service === 'primary' ? (over.length ? T.kpi.overCtx.replace('{list}', over.map(o => facName(o.f)).join(', ')) : T.kpi.overNone) : T.kpi.overNa} />
        <Kpi icon="route" label={T.kpi.outside} value={f.int(outside)} context={outside ? T.kpi.outsideCtx : T.kpi.outsideNone} />
      </div>

      <Controls ctx={ctx} />

      <div className="grid grid-map">
        <Panel title={T.catchTitle} sub={T.catchSub} className="map-panel">
          <AccessMap base={base} sol={sol} view="catchment" th={th} mode={mode} period={period} routesInfo={ri} T={T} f={f}
            placeName={placeName} facName={facName} label={T.catchTitle} motion={motion} setMotion={setMotion} scen={{}} chip={chip}
            facHl={cur} onFacHl={i => setFacHl(i === facHl ? null : i)} onHover={i => setHov(i)} animKey={'c' + service + mode + period} />
          <div className="map-legend">
            <div className="sym-legend">
              <span><svg width="22" height="10" viewBox="0 0 22 10"><path d="M1 5H21" className="lg-catch" /></svg>{T.lgCatch}</span>
              <span><svg width="18" height="18" viewBox="-9 -9 18 18" className="lg-glyph"><Glyph service={service} size={0.85} /></svg>{T.lgFacility}</span>
              <span><i className="lg-ramp" />{T.lgRamp}</span>
            </div>
          </div>
          <p className="hint">{T.catchHint}</p>
        </Panel>
        <div className="side-stack">
          <Panel title={T.facListTitle} sub={T.facListSub}>
            <div className="fac-list" onMouseLeave={() => setHov(null)}>
              {ls.map(o => (
                <button type="button" key={o.f.id} className={'fac-row' + (cur === o.i ? ' on' : '')} onMouseEnter={() => setHov(o.i)} onClick={() => setFacHl(facHl === o.i ? null : o.i)}>
                  <span className="fac-name"><svg width="20" height="20" viewBox="-10 -10 20 20" className="lg-glyph"><Glyph service={o.f.service} outside={o.f.outside} size={0.9} /></svg>{facName(o.f)}</span>
                  <span className="fac-track">
                    <i style={{ width: (o.pop / maxPop) * 100 + '%' }} className={statusOf(o)} />
                    {o.f.cap && <s style={{ left: (o.f.cap / maxPop) * 100 + '%' }} />}
                  </span>
                  <span className="fac-meta">
                    <b>{f.int(o.pop)}</b>
                    <small>{o.f.cap ? T.capOf.replace('{c}', f.int(o.f.cap)) : T.avgShort.replace('{t}', f.min(o.avg))}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="hint">{T.facListHint}</p>
          </Panel>
          {pick ? (
            <Panel className="profile">
              <div className="profile-head">
                <div>
                  <span className="profile-kicker"><i className="kick-dot" />{T.services[pick.f.service]}</span>
                  <h3>{facName(pick.f)}</h3>
                  <p className="muted">{pick.f.outside ? T.outsideNote : T.facServes.replace('{n}', f.int(pick.places.length))}</p>
                </div>
                {facHl != null && <button type="button" className="icon-btn" onClick={() => setFacHl(null)} aria-label={T.close}><Icon name="x" size={18} /></button>}
              </div>
              <dl className="detail-list compact">
                <div><dt>{T.facPop}</dt><dd>{f.int(pick.pop)}</dd></div>
                <div><dt>{T.facOld}</dt><dd>{f.int(pick.old)}</dd></div>
                <div><dt>{T.facAvgT}</dt><dd>{f.min(pick.avg)}</dd></div>
                <div><dt>{T.facBeyond.replace('{t}', th)}</dt><dd>{f.int(pick.beyond)}</dd></div>
                {pick.f.cap && <div><dt>{T.facCap}</dt><dd>{f.int(pick.f.cap)} · <span className={'status ' + statusOf(pick)}>{f.pct(pick.pop / pick.f.cap)}</span></dd></div>}
              </dl>
              <div className="profile-block">
                <h4>{T.facPlaces}</h4>
                <div className="mini-rows">
                  {pick.places.map(id => base.byId.get(id)).sort((a, b) => sol.placeT.get(b.id).t - sol.placeT.get(a.id).t).map(p => (
                    <button type="button" key={p.id} className="mini-row" onClick={() => go('map', { id: p.id, service, mode, period })}>
                      <span>{placeName(p)}</span><small>{T.peopleN(p.pop, f)}</small><b className={sol.placeT.get(p.id).t > th ? 'over' : ''}>{f.min(sol.placeT.get(p.id).t)}</b>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title={T.catchHowTitle}>
              <ul className="check-list">{T.catchHow.map((t, i) => <li key={i}><Icon name="check" size={16} /><span>{t}</span></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
