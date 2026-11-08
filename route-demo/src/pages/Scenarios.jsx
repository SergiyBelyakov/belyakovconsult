// Сценарії: що буде з планом, якщо закриють міст, прийде повінь, ожеледь, пік попиту, подорожчає пальне
// або дві машини стануть на ремонт. Кожен сценарій рахується повністю і показується мінікартою.
// Окремо: де відкрити третій склад, перебір кандидатів наживо.
import { useEffect, useRef, useState } from 'react';
import { NODES, BRIDGE_EDGE, TYPES, REGION } from '../world.js';
import { Cam, draw, COL } from '../engine.js';
import { DEF, compute } from '../state.js';
import { HBars } from '../charts.jsx';
import { useWidth } from '../../../dashboard/src/charts.jsx';
import { sfx } from '../sound.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';

export const WAREHOUSE_DAY = 3900; // доба малого крос-доку: оренда, двоє людей, техніка
const SCEN = [
  { id: 'base', icon: 'check', patch: () => ({}) },
  { id: 'bridge', icon: 'bridge', patch: () => ({ closed: [BRIDGE_EDGE.city] }) },
  { id: 'flood', icon: 'waves', patch: () => ({ flood: true }) },
  { id: 'winter', icon: 'thermo', patch: () => ({ winter: true }) },
  { id: 'peak', icon: 'box', patch: () => ({ peak: true }) },
  { id: 'fuel', icon: 'fuel', patch: () => ({ fuel: 70 }) },
  { id: 'repair', icon: 'settings', patch: () => ({ fleet: { ...DEF.fleet, lorry: DEF.fleet.lorry - 1, van: DEF.fleet.van - 1 } }) },
];
const CACHE = new Map();
const stateOf = sc => ({ ...DEF, fleet: { ...DEF.fleet }, ...sc.patch() });

function Mini({ sol, state, h = 180 }) {
  const ref = useRef(null), [box, w] = useWidth(320);
  useEffect(() => {
    const cv = ref.current, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = new Cam(); cam.w = w; cam.h = h; cam.fitPts(REGION, { l: 8, r: 8, t: 8, b: 8 });
    const om = new Map();
    sol.routes.forEach((r, ri) => r.stops.forEach(x => { const a = om.get(x.stop.node) || []; a.push({ kind: x.stop.c.kind, q: x.stop.q, ri, d: r.d, late: x.late }); om.set(x.stop.node, a); }));
    sol.unserved.forEach(u => { const a = om.get(u.stop.node) || []; a.push({ kind: u.stop.c.kind, q: u.stop.q, ri: null }); om.set(u.stop.node, a); });
    draw(g, { cam, w, h, mode: 'mini', hit: {}, fx: [], layers: { forest: true, routes: true }, sol, flows: sol.flows, closed: new Set(state.closed), cond: { flood: state.flood }, nodeOrders: om, depots: sol.pb.depots.map((n, k) => ({ node: n, id: 'ABC'[k] })), name: n => n.name.uk, motion: false, time: 0 });
  }, [sol, w]);
  return <div ref={box} className="sc-mini"><canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" /></div>;
}

export default function Scenarios({ ctx }) {
  const { T, f, applyScenario, navigate, placeName } = ctx;
  const [done, setDone] = useState(() => SCEN.filter(s => CACHE.has(s.id)).length);
  const [cand, setCand] = useState(() => CACHE.get('depotC') || null);
  const [running, setRunning] = useState(false);
  const [pick, setPick] = useState(null);
  // сценарії рахуються по одному, щоб сторінка не замерзала
  useEffect(() => {
    let alive = true;
    const next = () => {
      const sc = SCEN.find(s => !CACHE.has(s.id));
      if (!sc || !alive) return;
      CACHE.set(sc.id, compute(stateOf(sc), null, 'full', null));
      setDone(n => n + 1);
      setTimeout(next, 20);
    };
    setTimeout(next, 60);
    return () => { alive = false; };
  }, []);
  const base = CACHE.get('base');

  // третій склад: перебір кандидатів наживо
  const runDepot = () => {
    if (running) return;
    setRunning(true); sfx.pop();
    const list = NODES.filter(n => n.kind !== 'village' || n.pop >= 1100).filter(n => !DEF.depots.includes(n.i)).map(n => n.i);
    const ref0 = compute(DEF, null, 'lite', null).sol.totals;
    const out = { ref: ref0, items: [], total: list.length };
    setCand({ ...out });
    let k = 0;
    const step = () => {
      if (k >= list.length) { setRunning(false); CACHE.set('depotC', out); sfx.done(); return; }
      const i = list[k++], r = compute({ ...DEF, depots: [...DEF.depots, i] }, null, 'lite', null).sol.totals;
      out.items.push({ i, cost: r.cost, km: r.km, save: ref0.cost - r.cost + (ref0.lost - r.lost), unserved: r.unserved });
      out.items.sort((a, b) => b.save - a.save);
      setCand({ ...out, items: out.items.slice() });
      sfx.tick();
      setTimeout(step, 16);
    };
    setTimeout(step, 30);
  };
  const best = cand && cand.items[0];

  return (
    <>
      <div className="scen-grid">
        {SCEN.map(sc => {
          const r = CACHE.get(sc.id), st = stateOf(sc);
          const t = r && r.sol.totals, b = base && base.sol.totals;
          const dc = t && b ? (t.cost - b.cost) / b.cost : 0;
          return (
            <article key={sc.id} className={'scen-card glass' + (r ? '' : ' wait')}>
              <div className="sc-map">{r ? <Mini sol={r.sol} state={st} /> : <span className="spin" />}</div>
              <div className="sc-body">
                <h3><Icon name={sc.icon} size={17} />{T.scen[sc.id].t}</h3>
                <p>{T.scen[sc.id].d}</p>
                {t && (
                  <dl className="sc-kpi">
                    <div><dt>{T.kpi.costShort}</dt><dd>{f.kU(t.cost)}{sc.id !== 'base' && <em className={dc <= 0.0005 ? 'good' : 'bad'}>{f.signedPct(dc, 1)}</em>}</dd></div>
                    <div><dt>{T.kpi.kmShort}</dt><dd>{f.int(t.km)}{sc.id !== 'base' && <em className={t.km <= b.km ? 'good' : 'bad'}>{f.signedInt(t.km - b.km)}</em>}</dd></div>
                    <div><dt>{T.kpi.ontime}</dt><dd>{f.pct(t.onTime, 0)}</dd></div>
                    <div><dt>{T.kpi.lostShort}</dt><dd className={t.unserved ? 'bad' : ''}>{f.int(t.unserved)}</dd></div>
                  </dl>
                )}
                {t && <p className="sc-take">{T.scen[sc.id].take(t, b, f)}</p>}
                <Button icon="arrowRight" onClick={() => { applyScenario(sc.patch, T.log.scen(T.scen[sc.id].t)); navigate('dispatch'); }}>{T.scen.open}</Button>
              </div>
            </article>
          );
        })}
      </div>
      {done < SCEN.length && <p className="muted small center"><span className="spin" />{T.scen.computing(done, SCEN.length)}</p>}

      <Panel title={T.depotC.title} sub={T.depotC.sub(f.uah(WAREHOUSE_DAY))} className="depot-panel">
        {!cand ? (
          <div className="dc-start">
            <p>{T.depotC.intro}</p>
            <Button kind="primary" icon="warehouse" onClick={runDepot}>{T.depotC.run}</Button>
          </div>
        ) : (
          <div className="dc-grid">
            <div>
              <div className="dc-progress"><span style={{ width: (cand.items.length / cand.total) * 100 + '%' }} /><b>{T.depotC.progress(cand.items.length, cand.total)}</b></div>
              <HBars items={cand.items.slice(0, 12).map(x => ({ key: x.i, label: placeName(NODES[x.i]), v: x.save - WAREHOUSE_DAY, x }))} max={Math.max(1, ...cand.items.map(x => Math.abs(x.save - WAREHOUSE_DAY)))}
                fmt={v => f.signedUah(v)} colorOf={i => (i.v > 0 ? COL.hud : 'rgba(168,176,188,.45)')} onPick={i => setPick(i.key)} selected={pick == null && best ? best.i : pick} />
              <p className="note small">{T.depotC.note}</p>
            </div>
            {best && !running && (() => {
              const x = cand.items.find(y => y.i === (pick == null ? best.i : pick)) || best, net = x.save - WAREHOUSE_DAY;
              return (
                <div className="dc-best glass">
                  <span className="kicker"><span className="ruby-dot" />{x === best ? T.depotC.best : T.depotC.chosen}</span>
                  <strong>{placeName(NODES[x.i])}</strong>
                  <dl>
                    <div><dt>{T.depotC.saveLabel}</dt><dd>{f.uah(x.save)}</dd></div>
                    <div><dt>{T.depotC.costLabel}</dt><dd>−{f.uah(WAREHOUSE_DAY)}</dd></div>
                    <div className="tot"><dt>{T.depotC.netLabel}</dt><dd className={net > 0 ? 'good' : 'bad'}>{f.signedUah(net)}</dd></div>
                    <div><dt>{T.depotC.yearLabel}</dt><dd>{f.uahK(net * 250)}</dd></div>
                  </dl>
                  <p className="small muted">{net > 0 ? T.depotC.verdictYes : T.depotC.verdictNo}</p>
                  <Button kind="primary" icon="warehouse" onClick={() => { applyScenario(() => ({ depots: [...DEF.depots, x.i] }), T.log.depotC(placeName(NODES[x.i]))); navigate('dispatch'); }}>{T.depotC.apply}</Button>
                </div>
              );
            })()}
          </div>
        )}
      </Panel>
    </>
  );
}
export { TYPES };
