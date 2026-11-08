import { useMemo } from 'react';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { SCHOOLS, PUMPS, WATER, BY_ID, POINTS, OBJ_BY } from '../world.js';
import { schoolNet, BASE_NET, blackout, floodScen, returnPeriod, GEN_COST } from '../model.js';
import { HBars, COL } from '../charts.jsx';
import TwinMap from '../TwinMap.jsx';

const ELIGIBLE = ['s7', 's8', 's9', 's10', 's11', 's12', 's13', 's14'];
const PRESETS = { base: {}, small: { s13: 'close', s14: 'close' }, hubs: { s9: 'primary', s10: 'primary', s11: 'primary', s12: 'primary', s13: 'close', s14: 'close' } };
const EDU = new Set(['edu']), SAFE = new Set(['safety', 'services']), ALL = new Set(['edu', 'health', 'safety', 'services']);
const same = (a, b) => JSON.stringify(Object.entries(a).filter(([, v]) => v !== 'keep').sort()) === JSON.stringify(Object.entries(b).sort());

function Compare({ rows, T, heads }) {
  return (
    <div className="cmp">
      <div className="cmp-head"><span /><span>{heads ? heads[0] : T.scen.before}</span><span>{heads ? heads[1] : T.scen.after}</span><span>{T.scen.delta}</span></div>
      {rows.map(r => {
        const d = r.b - r.a, good = r.better ? (r.better === 'up' ? d > 0 : d < 0) : null, flat = Math.abs(d) < (r.eps || 1e-9);
        return (
          <div key={r.k} className="cmp-row">
            <span className="cmp-k">{r.k}</span>
            <span className="num">{r.fmt(r.a)}</span>
            <span className="num strong">{r.fmt(r.b)}</span>
            <span className={'num ' + (flat ? 'muted' : good == null ? '' : good ? 'good' : 'over')}>{flat ? '·' : (d > 0 ? '+' : '−') + (r.fmtD || r.fmt)(Math.abs(d))}</span>
          </div>
        );
      })}
    </div>
  );
}

function SchoolTab({ ctx }) {
  const { T, f, objName, states, setStates } = ctx;
  const net = useMemo(() => schoolNet(states), [states]);
  const b = BASE_NET.tot, a = net.tot;
  const setOne = (id, v) => { const n = { ...states }; if (v === 'keep') delete n[id]; else n[id] = v; setStates(n); };
  const baseTrip = new Map(BASE_NET.trips.map(t => [t.place + '|' + t.band, t.school]));
  const changed = net.trips.filter(t => t.n >= 0.5 && baseTrip.get(t.place + '|' + t.band) !== t.school);
  const moved = changed.reduce((s, t) => s + t.n, 0);
  const lines = [...new Map(changed.map(t => [t.place + '>' + t.school, t])).values()].map(t => { const p = BY_ID.get(t.place), s = OBJ_BY.get(t.school); return { from: [p.x, p.y], to: [s.x, s.y], cls: 'moved' }; });
  const st = new Map(net.list.map(s => [s.id, s]));
  const recv = net.list.filter(s => !s.closed).sort((x, y) => y.occ - x.occ).map(s => ({ id: s.id, label: (s.occ > 1 ? '⚠ ' : '') + objName(SCHOOLS.find(z => z.id === s.id)), v: s.occ * 100, color: s.occ > 1 ? '#FF6B6B' : COL.blue, sub: f.int(s.pupils) + ' / ' + f.int(s.cap) + (states[s.id] === 'primary' ? ' · ' + T.scen.school.onlyPrimary : '') }));
  const rows = [
    { k: T.scen.school.k.open, a: b.open, b: a.open, fmt: f.int },
    { k: T.scen.school.k.occ, a: b.occ, b: a.occ, fmt: v => f.pct(v), fmtD: v => f.pp(v * 100), better: 'up', eps: 0.0005 },
    { k: T.scen.school.k.cost, a: b.cost / 1000, b: a.cost / 1000, fmt: v => f.mln(v), better: 'down', eps: 0.05 },
    { k: T.scen.school.k.busCost, a: b.busCost / 1000, b: a.busCost / 1000, fmt: v => f.mln(v), better: 'down', eps: 0.05 },
    { k: T.scen.school.k.perPupil, a: b.perPupil, b: a.perPupil, fmt: v => f.thou(v), better: 'down', eps: 0.05 },
    { k: T.scen.school.k.buses, a: b.buses, b: a.buses, fmt: f.int, better: 'down', eps: 0.5 },
    { k: T.scen.school.k.avgT, a: b.avgT, b: a.avgT, fmt: v => f.dec1(v) + ' ' + (ctx.lang === 'uk' ? 'хв' : 'min'), better: 'down', eps: 0.05 },
    { k: T.scen.school.k.over30, a: b.over30, b: a.over30, fmt: f.int, better: 'down', eps: 0.5 },
    { k: T.scen.school.k.maxT, a: b.maxT, b: a.maxT, fmt: f.min, better: 'down', eps: 0.5 },
    { k: T.scen.school.k.shelter, a: b.shelter, b: a.shelter, fmt: v => f.pct(v), fmtD: v => f.pp(v * 100), better: 'up', eps: 0.0005 },
    { k: T.scen.school.k.small, a: b.small, b: a.small, fmt: f.int, better: 'down', eps: 0.5 },
  ];
  const netDelta = (a.cost + a.busCost) - (b.cost + b.busCost);
  return (
    <>
      <div className="scen-grid">
        <Panel title={T.scen.school.title} sub={T.scen.school.sub} className="scen-ctl">
          <div className="preset-row">
            <span className="muted small">{T.scen.school.presets}</span>
            {Object.keys(PRESETS).map(k => <button type="button" key={k} className={'chip' + (same(states, PRESETS[k]) ? ' on' : '')} onClick={() => setStates({ ...PRESETS[k] })}>{T.scen.school.preset[k]}</button>)}
          </div>
          <div className="school-list">
            {ELIGIBLE.map(id => {
              const s = SCHOOLS.find(z => z.id === id), v = states[id] || 'keep';
              const opts = (s.type === 'primary' ? ['keep', 'close'] : ['keep', 'primary', 'close']).map(o => ({ value: o, label: T.scen.school.states[o] }));
              return (
                <div key={id} className={'sl-row' + (v !== 'keep' ? ' changed' : '')}>
                  <div><strong>{objName(s)}</strong><small>{f.int(s.pupils)} {T.fin.pupils} · {f.pct(s.occ)} · {f.thou(s.perPupil)}</small></div>
                  <Segmented value={v} onChange={x => setOne(id, x)} label={objName(s)} options={opts} />
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title={T.scen.passport} className="scen-res">
          <Compare rows={rows} T={T} />
          {moved >= 0.5 || Object.keys(states).length
            ? <p className={'net-line ' + (netDelta < 0 ? 'good' : netDelta > 0 ? 'over' : 'muted')}>{T.scen.school.net}: {netDelta < 0 ? T.scen.school.saving(f.mln(-netDelta / 1000)) : netDelta > 0 ? T.scen.school.extra(f.mln(netDelta / 1000)) : '·'} · {T.scen.school.moved}: {f.int(moved)}</p>
            : <p className="muted small net-hint">{T.scen.school.noChange}</p>}
        </Panel>
      </div>
      <div className="grid grid-2">
        <Panel title={T.nav.map} sub={T.scen.school.mapNote}>
          <TwinMap ctx={ctx} layers={EDU} height={460} compact lines={lines} label={T.scen.school.title}
            objFilter={o => o.cat === 'school'} objState={o => (st.get(o.id) && st.get(o.id).closed ? 'hollow' : states[o.id] === 'primary' ? 'hot' : null)}
            tipExtra={(k, id) => { if (k !== 'obj') return null; const s = st.get(id); return s ? <small>{f.int(s.pupils)} {T.fin.pupils} · {f.pct(s.occ)}</small> : null; }} />
        </Panel>
        <Panel title={T.scen.school.recv} sub={T.scen.school.recvSub}>
          <HBars items={recv} fmt={v => f.pctV(v, 0)} max={Math.max(110, ...recv.map(r => r.v))} refLine={100} refLabel="100%" label={T.scen.school.recv} />
        </Panel>
      </div>
    </>
  );
}

function BlackoutTab({ ctx }) {
  const { T, f, objName, placeName, hours, setHours, gens, setGens, fuel, setFuel, repair, setRepair } = ctx;
  const r = useMemo(() => blackout(hours, { pumps: gens, fuel, repair }), [hours, gens, fuel, repair]);
  const base = useMemo(() => blackout(0), []);
  const ptState = new Map(r.pts.map(p => [p.id, p.works]));
  const noGen = PUMPS.filter(w => !w.gen).map(w => ({ w, n: WATER.filter(x => x.pump === w.id).reduce((a, x) => a + BY_ID.get(x.place).pop * x.share, 0) })).sort((a, b) => b.n - a.n);
  const toggle = id => setGens(gens.includes(id) ? gens.filter(x => x !== id) : [...gens, id]);
  const rows = [
    { k: T.scen.blackout.k.working, a: base.working, b: r.working, fmt: v => f.int(v) + ' ' + T.of + ' ' + POINTS.length, fmtD: f.int, better: 'up', eps: 0.5 },
    { k: T.scen.blackout.k.covered, a: base.coveredShare, b: r.coveredShare, fmt: v => f.pct(v), fmtD: v => f.pp(v * 100), better: 'up', eps: 0.0005 },
    { k: T.scen.blackout.k.starlink, a: base.starlink, b: r.starlink, fmt: f.int, better: 'up', eps: 0.5 },
    { k: T.scen.blackout.k.heat, a: base.heat, b: r.heat, fmt: f.int, better: 'up', eps: 0.5 },
    { k: T.scen.blackout.k.dry, a: base.dry, b: r.dry, fmt: f.int, better: 'down', eps: 0.5 },
    { k: T.scen.blackout.k.water, a: base.waterShare, b: r.waterShare, fmt: v => f.pct(v), fmtD: v => f.pp(v * 100), better: 'up', eps: 0.0005 },
  ];
  return (
    <>
      <div className="scen-grid">
        <Panel title={T.scen.blackout.title} sub={T.scen.blackout.sub} className="scen-ctl">
          <div className="ctl-line"><span>{T.scen.blackout.hours}</span><Segmented value={String(hours)} onChange={v => setHours(Number(v))} label={T.scen.blackout.hours} options={[6, 12, 24, 48, 72].map(h => ({ value: String(h), label: T.scen.blackout.h(h) }))} /></div>
          <label className="check"><input type="checkbox" checked={fuel} onChange={e => setFuel(e.target.checked)} />{T.scen.blackout.fuel}</label>
          <label className="check"><input type="checkbox" checked={repair} onChange={e => setRepair(e.target.checked)} />{T.scen.blackout.repair}</label>
          <h4 className="ctl-h">{T.scen.blackout.pumps}</h4>
          <div className="pump-list">
            {noGen.map(({ w, n }) => (
              <label key={w.id} className="check"><input type="checkbox" checked={gens.includes(w.id)} onChange={() => toggle(w.id)} />{objName(w)}<small>{T.scen.blackout.serves(f.int(n))}</small></label>
            ))}
          </div>
          <p className="muted small">{T.scen.blackout.k.cost}: {f.mln(r.cost / 1000)} · {T.scen.blackout.pumpCost(f.thou(GEN_COST))}</p>
        </Panel>
        <Panel title={T.scen.passport} className="scen-res">
          <Compare rows={rows} T={T} heads={[T.scen.blackout.before, T.scen.blackout.after(hours)]} />
          <p className="muted small net-hint">{T.scen.blackout.note}</p>
        </Panel>
      </div>
      <Panel title={T.nav.map}>
        <TwinMap ctx={ctx} layers={SAFE} height={520} compact label={T.scen.blackout.title}
          objFilter={o => o.cat === 'point' || o.cat === 'water'}
          objState={o => (o.cat === 'point' ? (ptState.get(o.id) ? null : 'hollow') : r.pumpOn.get(o.id) || hours <= 2 ? null : 'hollow')}
          placeState={p => (r.placeOk.get(p.id) ? null : 'out')}
          tipExtra={(k, id) => { if (k === 'place') return <small>{r.placeOk.get(id) ? T.scen.blackout.legend.placeOk : T.scen.blackout.legend.placeNo}</small>; const o = OBJ_BY.get(id); if (o && o.cat === 'point') return <small>{ptState.get(id) ? T.scen.blackout.legend.ok : T.scen.blackout.legend.off} · {T.map.hrs(o.hours * (fuel ? 2 : 1))}</small>; return null; }} />
        <div className="sym-legend">
          <span><i className="sw-pt on" />{T.scen.blackout.legend.ok}</span><span><i className="sw-pt" />{T.scen.blackout.legend.off}</span>
          <span><i className="sw-place" />{T.scen.blackout.legend.placeOk}</span><span><i className="sw-place out" />{T.scen.blackout.legend.placeNo}</span>
        </div>
      </Panel>
    </>
  );
}

function FloodTab({ ctx }) {
  const { T, f, objName, placeName, stage, setStage } = ctx;
  const r = useMemo(() => floodScen(stage), [stage]);
  const inWater = new Set(r.objects.map(o => o.id)), fl = new Set(r.places), iso = new Set(r.isolated);
  const yrs = stage > 0 ? Math.round(returnPeriod(stage)) : 1;
  return (
    <>
      <div className="scen-grid">
        <Panel title={T.scen.flood.title} sub={T.scen.flood.sub} className="scen-ctl">
          <div className="stage-ctl big">
            <span>{T.scen.flood.stage}</span>
            <input type="range" min="0" max="8" step="0.2" value={stage} onChange={e => setStage(Number(e.target.value))} aria-label={T.scen.flood.stage} />
            <b>{T.scen.flood.m(f.dec1(stage))}</b>
          </div>
          <p className="muted">{T.scen.flood.years(f.int(yrs))}</p>
          <div className="kpi-mini-row">
            <div><span>{T.scen.flood.k.pop}</span><b>{f.int(r.pop)}</b></div>
            <div><span>{T.scen.flood.k.iso}</span><b className={r.isoPop ? 'over' : ''}>{f.int(r.isoPop)}</b></div>
            <div><span>{T.scen.flood.k.roads}</span><b>{f.km(r.roadKm)}</b></div>
            <div><span>{T.scen.flood.k.objects}</span><b className={r.objects.length ? 'over' : ''}>{f.int(r.objects.length)}</b></div>
            <div><span>{T.scen.flood.k.area}</span><b>{f.int(r.area)} {T.units.km2}</b></div>
          </div>
        </Panel>
        <Panel title={T.scen.flood.objTitle} className="scen-res">
          {r.objects.length ? <ul className="flood-list">{r.objects.map(o => <li key={o.id}><span>{objName(o)}</span><small>{T.catName[o.cat]}</small></li>)}</ul> : <p className="muted">{T.scen.flood.noObj}</p>}
          <h4 className="ctl-h">{T.scen.flood.isoTitle}</h4>
          {r.isolated.length ? <p>{r.isolated.map(id => placeName(BY_ID.get(id))).join(', ')}</p> : <p className="muted">{T.scen.flood.noIso}</p>}
        </Panel>
      </div>
      <Panel title={T.nav.map}>
        <TwinMap ctx={ctx} layers={ALL} floodStage={stage} height={540} compact label={T.scen.flood.title}
          objState={o => (inWater.has(o.id) ? 'hot' : 'faded')} placeState={p => (iso.has(p.id) ? 'iso' : fl.has(p.id) ? 'hot' : null)} />
      </Panel>
    </>
  );
}

export default function Scenarios({ ctx }) {
  const { T, tab, setTab } = ctx;
  return (
    <>
      <div className="toolbar view-switch">
        <Segmented value={tab} onChange={setTab} label={T.nav.scenarios} options={['school', 'blackout', 'flood'].map(k => ({ value: k, label: T.scen.tabs[k] }))} />
      </div>
      {tab === 'school' ? <SchoolTab ctx={ctx} /> : tab === 'blackout' ? <BlackoutTab ctx={ctx} /> : <FloodTab ctx={ctx} />}
    </>
  );
}
