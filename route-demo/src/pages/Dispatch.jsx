// Диспетчерська: жива карта маршрутів, пульт із ручками автопарку, показники, розклад машин і витрати.
import { useEffect, useMemo, useState } from 'react';
import { NODES, CUSTOMERS, TYPES, FLEET_MAX, dayOrders } from '../world.js';
import { COL } from '../engine.js';
import { compute, ordersOf } from '../state.js';
import MapStage from '../MapStage.jsx';
import { Knob, Odo, DeltaChip } from '../controls.jsx';
import { Gantt, CostStack, vIcon } from '../charts.jsx';
import { hm } from '../clock.js';
import { sfx } from '../sound.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Button, Segmented } from '../../../dashboard/src/ui.jsx';

export function KpiStrip({ ctx, sol, other, delta }) {
  const { T, f, plan } = ctx, t = sol.totals, o = other && other.totals;
  const cmp = (a, b, lowGood = true) => {
    if (!o || !b) return null;
    const r = (a - b) / b;
    if (Math.abs(r) < 0.0005) return null;
    return <em className={(r < 0) === lowGood ? 'good' : 'bad'}>{f.signedPct(r, 0)}</em>;
  };
  const vs = plan === 'man' ? T.kpi.vsOpt : T.kpi.vsMan;
  const tiles = [
    { k: 'cost', icon: 'coins', v: f.int(t.cost), u: T.units.uah, sub: T.kpi.perPallet(f.uah(t.perPallet)), c: cmp(t.cost, o && o.cost), d: delta && { v: delta.cost, text: f.signedPct(delta.rel, 1), good: delta.cost <= 0 } },
    { k: 'km', icon: 'route', v: f.int(t.km), u: T.units.km, sub: T.kpi.co2(f.kg(t.co2)), c: cmp(t.km, o && o.km), d: delta && Math.abs(delta.km) > 0.5 && { v: delta.km, text: f.signedInt(delta.km) + ' ' + T.units.km, good: delta.km <= 0 } },
    { k: 'ontime', icon: 'clock', v: f.pct(t.onTime, 0).replace('%', ''), u: '%', sub: T.kpi.late(t.lateStops), c: o && Math.abs(t.onTime - o.onTime) > 0.004 ? <em className={t.onTime >= o.onTime ? 'good' : 'bad'}>{(t.onTime >= o.onTime ? '+' : '−') + f.int(Math.abs(t.onTime - o.onTime) * 100) + ' ' + T.units.pp}</em> : null },
    { k: 'veh', icon: 'truck', v: f.int(t.vehicles), u: '/ ' + f.int(t.fleet), sub: T.kpi.hours(f.hours(t.hours)), c: cmp(t.vehicles, o && o.vehicles) },
    { k: 'util', icon: 'box', v: f.pct(t.util, 0).replace('%', ''), u: '%', sub: T.kpi.pallets(f.int(t.pallets)), c: null },
    { k: 'lost', icon: 'warning', v: f.int(t.unserved), u: T.kpi.ordersU(t.unserved), sub: t.unserved ? T.kpi.lostPal(f.int(t.lostPallets)) : T.kpi.allServed, c: null, bad: t.unserved > 0, d: delta && delta.unserved && { v: delta.unserved, text: f.signedInt(delta.unserved), good: delta.unserved < 0 } },
  ];
  return (
    <div className="kpi-strip">
      {tiles.map(x => (
        <div key={x.k} className={'kt glass' + (x.bad ? ' bad' : '')}>
          <span className="kt-top"><Icon name={x.icon} size={15} />{T.kpi[x.k]}</span>
          <span className="kt-val"><Odo text={x.v} /><small>{x.u}</small>{x.d && <DeltaChip value={x.d.v} text={x.d.text} good={x.d.good} id={delta.id} />}</span>
          <span className="kt-sub">{x.sub}</span>
          {o && <span className="kt-cmp">{x.c}{x.c && <span>{vs}</span>}</span>}
        </div>
      ))}
    </div>
  );
}

// картка населеного пункту: замовлення з кроковими кнопками і перенесення складу сюди
function NodeCard({ ctx, i, onClose }) {
  const { T, f, state, setDemand, commitDepot, sol, placeName } = ctx;
  const n = NODES[i], cs = CUSTOMERS.filter(c => c.node === i), orders = ordersOf(state);
  const where = id => { for (const r of sol.routes) { const s = r.stops.find(x => x.stop.id === id); if (s) return { r, s }; } return null; };
  const isDepot = state.depots.indexOf(i);
  return (
    <div className="node-card glass" role="dialog" aria-label={placeName(n)}>
      <div className="nc-head">
        <div><strong>{placeName(n)}</strong><span>{T.nodeKind[n.kind]} · {f.int(n.pop)} {T.units.people}</span></div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={T.close}><Icon name="x" size={16} /></button>
      </div>
      {cs.length ? cs.map(c => {
        const q = orders[c.id] || 0, w = q ? where(c.id) : null;
        return (
          <div key={c.id} className="nc-row">
            <div className="nc-name"><span>{T.kind[c.kind]}</span><em>{T.window} {hm(c.a)}-{hm(c.b)}</em>
              {q > 0 && (w ? <em className={w.s.late > 0.5 ? 'bad' : ''}><i style={{ background: COL.depot[w.r.d] }} />{w.r.id} · {hm(w.s.start)}{w.s.late > 0.5 ? ' · +' + f.min(w.s.late) : ''}</em> : <em className="bad">{T.map.unserved}</em>)}
            </div>
            <div className="stepper">
              <button type="button" onClick={() => { sfx.tick(); setDemand(c.id, Math.max(0, q - 1)); }} disabled={q <= 0} aria-label={T.less}><Icon name="minus" size={14} /></button>
              <b>{q}</b>
              <button type="button" onClick={() => { sfx.tick(); setDemand(c.id, Math.min(14, q + 1)); }} disabled={q >= 14} aria-label={T.more}><Icon name="plus" size={14} /></button>
            </div>
          </div>
        );
      }) : <p className="muted small">{T.nodeCard.noCust}</p>}
      <div className="nc-depots">
        {isDepot >= 0 ? <span className="muted small"><Icon name="warehouse" size={14} />{T.nodeCard.isDepot(['A', 'B', 'C'][isDepot])}</span>
          : state.depots.map((d, k) => <Button key={k} icon="warehouse" onClick={() => commitDepot(k, i)}>{T.nodeCard.moveDepot(['A', 'B', 'C'][k])}</Button>)}
      </div>
    </div>
  );
}

export default function Dispatch({ ctx }) {
  const { T, f, state, res, shown, sol, plan, setPlan, clock, selRoute, setSelRoute, selNode, setSelNode, nodeOrders, solving, delta, log, setFleet, setParam, newDay, reset, undo, canUndo, Mref, change, placeName } = ctx;
  const [rec, setRec] = useState(null);
  const other = plan === 'man' ? res.sol : res.man;
  // підбір автопарку під цей день: розрахунок з усіма машинами, які можна взяти
  useEffect(() => {
    setRec(null);
    const id = setTimeout(() => {
      const r = compute({ ...state, fleet: { ...FLEET_MAX } }, res.sol, 'fast', Mref.current);
      const by = r.sol.totals.byType;
      setRec({ fleet: { truck: by[0], lorry: by[1], van: by[2] }, cost: r.sol.totals.cost, unserved: r.sol.totals.unserved, now: res.sol.totals.cost });
    }, 650);
    return () => clearTimeout(id);
  }, [res]);
  const recSame = rec && TYPES.every(t => rec.fleet[t.id] === state.fleet[t.id]);
  const applyRec = () => { sfx.snap(); change({ fleet: { ...rec.fleet } }, T.log.recApplied); };
  const used = sol.totals.byType;
  const dayPal = Object.values(dayOrders(state.day)).reduce((a, b) => a + b, 0);
  const capAll = TYPES.reduce((a, t) => a + t.cap * state.fleet[t.id], 0);
  const knobs = [
    ...TYPES.map((t, k) => ({ key: t.id, label: T.vehiclePl[t.id], icon: vIcon(k), value: state.fleet[t.id], min: 0, max: FLEET_MAX[t.id], def: ctx.baseRes.pb.fleet[t.id], onChange: v => setFleet(t.id, v), format: v => v, sub: T.console.inUse(used[k]) })),
    { key: 'fuel', label: T.console.fuel, icon: 'fuel', value: state.fuel, min: 40, max: 80, def: 58, onChange: v => setParam('fuel', v), format: v => v, sub: T.console.fuelSub },
    { key: 'shift', label: T.console.shift, icon: 'clock', value: state.shift, min: 8, max: 12, step: 0.5, def: 10, onChange: v => setParam('shift', v), format: v => f.dec1(v).replace(/[,.]0$/, ''), sub: T.console.shiftSub },
  ];
  const routesSorted = sol.routes;
  const costRows = [
    { key: 'opt', label: T.plan.opt, total: res.sol.totals.cost, parts: res.sol.totals.parts },
    { key: 'man', label: T.plan.man, total: res.man.totals.cost, parts: res.man.totals.parts },
  ];
  const kpiHud = (
    <div className="mini-kpi">
      <span><Icon name="coins" size={13} /><Odo text={f.int(sol.totals.cost)} /> {T.units.uah}</span>
      <span><Icon name="route" size={13} /><Odo text={f.int(sol.totals.km)} /> {T.units.km}</span>
      <span className={sol.totals.unserved ? 'bad' : ''}><Icon name={sol.totals.unserved ? 'warning' : 'check'} size={13} />{sol.totals.unserved ? T.kpi.lostN(sol.totals.unserved) : T.kpi.allServed}</span>
    </div>
  );
  const totalDelta = log.length ? res.sol.totals.cost - ctx.baseRes.sol.totals.cost : null;

  return (
    <>
      <div className="rp-dispatch">
        <div className="map-col">
          <MapStage ctx={ctx} sol={sol} depots={(shown.pb || res.pb).depots} closed={new Set(state.closed)} cond={{ flood: state.flood, winter: state.winter }} nodeOrders={nodeOrders} clock={clock}
            selRoute={selRoute} setSelRoute={setSelRoute} selNode={selNode} setSelNode={setSelNode}
            onDepotPreview={ctx.previewDepot} onDepotCommit={ctx.commitDepot} onDepotCancel={ctx.cancelDepot} onCut={ctx.cut} onHeal={ctx.heal} onDemand={ctx.setDemand}
            solving={solving} onUndo={undo} canUndo={canUndo} kpi={kpiHud} height={640} />
          {selNode != null && <NodeCard ctx={ctx} i={selNode} onClose={() => setSelNode(null)} />}
        </div>
        <aside className="console glass" aria-label={T.console.title}>
          <div className="con-head">
            <h3><Icon name="sliders" size={17} />{T.console.title}</h3>
            <Segmented value={plan} onChange={v => { setPlan(v); sfx.pop(); }} label={T.plan.label} options={[{ value: 'opt', label: T.plan.optShort }, { value: 'man', label: T.plan.manShort }]} />
          </div>
          <div className="knob-grid">
            {knobs.map(k => <Knob key={k.key} {...k} accent={k.key === 'fuel' || k.key === 'shift' ? '#ACD5FF' : '#7FDCFF'} />)}
          </div>
          <div className={'cap-meter' + (capAll < dayPal ? ' short' : '')}>
            <span>{T.console.capacity}</span>
            <div className="cm-bar"><i style={{ width: Math.min(100, (dayPal / Math.max(1, capAll)) * 100) + '%' }} /></div>
            <b>{f.int(dayPal)} / {f.int(capAll)} {T.units.pal}</b>
          </div>
          <div className="rec-box">
            {!rec ? <span className="muted small"><span className="spin" />{T.console.recWait}</span>
              : recSame ? <span className="small"><Icon name="check" size={14} />{T.console.recOk}</span>
                : <>
                  <span className="small">{T.console.rec}</span>
                  <span className="rec-fleet">{TYPES.map((t, k) => <b key={t.id}><Icon name={vIcon(k)} size={14} />{rec.fleet[t.id]}</b>)}</span>
                  <span className="small muted">{rec.cost < rec.now ? T.console.recSave(f.uah(rec.now - rec.cost), f.pct((rec.now - rec.cost) / rec.now, 1)) : T.console.recMore}</span>
                  <Button icon="magnet" onClick={applyRec}>{T.console.recApply}</Button>
                </>}
          </div>
          <div className="con-actions">
            <Button icon="dice" onClick={newDay}>{T.console.newDay(state.day + 1 > 30 ? 1 : state.day + 1)}</Button>
            <Button icon="undo" onClick={undo} disabled={!canUndo}>{T.console.undo}</Button>
            <Button icon="reset" onClick={reset}>{T.console.reset}</Button>
          </div>
          <div className="con-log">
            <h4>{T.console.log}</h4>
            {!log.length ? <p className="muted small">{T.console.logEmpty}</p> : (
              <ol>
                {log.map((l, k) => (
                  <li key={l.id + '-' + k}>
                    <span>{l.label}</span>
                    <b className={Math.abs(l.cost) < 1 ? '' : l.cost < 0 ? 'good' : 'bad'}>{Math.abs(l.cost) < 1 ? '0' : f.signedPct(l.rel, 1)}</b>
                  </li>
                ))}
              </ol>
            )}
            {totalDelta != null && <p className="con-total">{T.console.total}<b className={totalDelta <= 0 ? 'good' : 'bad'}>{f.signedUah(totalDelta)}</b></p>}
          </div>
        </aside>
      </div>

      <KpiStrip ctx={ctx} sol={sol} other={other} delta={plan === 'opt' ? delta : null} />

      <Panel title={T.gantt.title} sub={T.gantt.sub} className="gantt-panel" aside={<span className="legend-inline"><span><i className="li-drive" />{T.gantt.drive}</span><span><i className="li-stop" />{T.gantt.stop}</span><span><i className="li-wait" />{T.gantt.waitL}</span><span><i className="li-late" />{T.gantt.lateL}</span></span>}>
        <Gantt ctx={ctx} sol={sol} clock={clock} selRoute={selRoute} setSelRoute={setSelRoute} onStop={(node, ri) => { setSelNode(node); setSelRoute(ri); }} />
      </Panel>

      <div className="grid grid-2">
        <Panel title={T.routes.title} sub={T.routes.sub(sol.routes.length, sol.totals.fleet)}>
          <div className="table-scroll">
            <table className="data-table rt-table">
              <thead><tr><th>{T.routes.id}</th><th>{T.routes.vehicle}</th><th className="num">{T.routes.stops}</th><th>{T.routes.load}</th><th className="num">{T.routes.km}</th><th>{T.routes.time}</th><th className="num">{T.routes.cost}</th></tr></thead>
              <tbody>
                {routesSorted.map((r, ri) => (
                  <tr key={r.id} className={selRoute === ri ? 'on' : ''} onClick={() => setSelRoute(selRoute === ri ? null : ri)} tabIndex="0" onKeyDown={e => { if (e.key === 'Enter') setSelRoute(selRoute === ri ? null : ri); }}>
                    <td><span className="rt-id"><i style={{ background: COL.depot[r.d] }} />{r.id}</span></td>
                    <td><span className="rt-v" title={T.vehicle[TYPES[r.t].id]}><Icon name={vIcon(r.t)} size={16} /><span className="rt-vn">{T.vehicle[TYPES[r.t].id]}</span></span></td>
                    <td className="num">{r.stops.length}{r.stops.some(s => s.late > 0.5) && <Icon name="warning" size={12} className="bad-ic" />}</td>
                    <td><span className="rt-load"><span><i style={{ width: (r.load / r.cap) * 100 + '%', background: COL.depot[r.d] }} /></span>{f.int(r.load)}/{f.int(r.cap)}</span></td>
                    <td className="num">{f.int(r.km)}</td>
                    <td className="mono">{hm(r.start)}-{hm(r.end)}</td>
                    <td className="num">{f.int(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selRoute != null && sol.routes[selRoute] && (
            <ol className="rt-stops">
              {sol.routes[selRoute].stops.map((s, k) => (
                <li key={k} className={s.late > 0.5 ? 'bad' : ''}><b>{hm(s.start)}</b>{placeName(NODES[s.stop.node])} · {T.kind[s.stop.c.kind]} · {f.int(s.stop.q)} {T.units.pal}{s.wait > 0.5 && <em>{T.gantt.wait} {f.min(s.wait)}</em>}{s.late > 0.5 && <em className="bad">+{f.min(s.late)}</em>}</li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title={T.costs.title} sub={T.costs.sub}>
          <CostStack ctx={ctx} rows={costRows} />
          <div className="vs-grid">
            {[['km', 'km', v => f.int(v) + ' ' + T.units.km], ['hours', 'hours', v => f.hours(v)], ['co2', 'co2kg', v => f.kg(v)], ['onTime', 'ontime', v => f.pct(v, 0)]].map(([k, lab, fm]) => {
              const a = res.sol.totals[k], b = res.man.totals[k], better = k === 'onTime' ? a >= b : a <= b;
              return <div key={k}><span>{T.costs[lab]}</span><b>{fm(a)}</b><em className={better ? 'good' : 'bad'}>{T.plan.manShort}: {fm(b)}</em></div>;
            })}
          </div>
          <p className="note small">{T.costs.note}</p>
        </Panel>
      </div>
    </>
  );
}
