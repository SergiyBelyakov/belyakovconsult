// Мережа: дорожній граф під навантаженням плану, центральність, критичні ділянки, тупики й мости,
// вагові обмеження і морфінг карти з географії в час доїзду від складу.
import { useMemo, useState } from 'react';
import { NODES, EDGES, ADJ, TYPES } from '../world.js';
import { betweenness, cutEdges, components, dijkstra } from '../graph.js';
import { criticality } from '../solver.js';
import { COL } from '../engine.js';
import { condOf } from '../state.js';
import MapStage from '../MapStage.jsx';
import { HBars } from '../charts.jsx';
import { sfx } from '../sound.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Button, Segmented } from '../../../dashboard/src/ui.jsx';

const METRICS = ['flow', 'between', 'crit', 'cut'];

export default function Network({ ctx }) {
  const { T, f, state, res, clock, selRoute, setSelRoute, selNode, setSelNode, nodeOrders, solving, placeName, edgeLabel } = ctx;
  const [metric, setMetric] = useState('flow');
  const [morph, setMorph] = useState(0);
  const [from, setFrom] = useState(0);
  const [pickEdge, setPickEdge] = useState(null);
  const cond = useMemo(() => condOf(state), [state]);
  const bt = useMemo(() => betweenness(cond), [state.closed.join('.'), state.flood, state.winter]);
  const ce = useMemo(() => cutEdges(cond), [state.closed.join('.'), state.flood]);
  const comp = useMemo(() => components(cond), [state.closed.join('.'), state.flood]);
  const crit = useMemo(() => criticality(res.pb, res.sol), [res]);
  // діаметр мережі: найдовший найкоротший час між двома пунктами (фургон)
  const stats = useMemo(() => {
    let diam = 0, pair = null;
    for (let s = 0; s < NODES.length; s++) {
      const r = dijkstra(s, 2, cond);
      for (let t = s + 1; t < NODES.length; t++) if (Number.isFinite(r.T[t]) && r.T[t] > diam) { diam = r.T[t]; pair = [s, t]; }
    }
    const open = EDGES.filter(e => !cond.closed.has(e.id) && !(cond.flood && (e.ferry || e.low)));
    const km = open.reduce((a, e) => a + e.len, 0);
    return { diam, pair, edges: open.length, km, deg: (2 * open.length) / NODES.length };
  }, [state.closed.join('.'), state.flood, state.winter]);
  // обмеження для фур: від кожного складу окремо, обхід через вагу понад звичайну повільність фури
  const heavy = useMemo(() => {
    const out = [];
    res.pb.depots.forEach((d, k) => {
      const tv = dijkstra(d, 2, cond), tt = dijkstra(d, 0, cond);
      NODES.forEach((n, i) => {
        if (!Number.isFinite(tv.T[i])) return;
        const extra = Number.isFinite(tt.T[i]) ? tt.T[i] - tv.T[i] / TYPES[0].speed : Infinity;
        if (extra > 6) out.push({ i, k, extra });
      });
    });
    const best = new Map();
    out.forEach(x => { const b = best.get(x.i); if (!b || x.extra < b.extra) best.set(x.i, x); });
    return [...best.values()].sort((a, b) => b.extra - a.extra).slice(0, 8);
  }, [res, state.closed.join('.'), state.flood, state.winter]);

  // метрика для товщини ребер
  const mvals = useMemo(() => {
    const e = new Float64Array(EDGES.length);
    if (metric === 'flow') { const p = res.sol.flows.pal, mx = Math.max(1, ...p); p.forEach((v, k) => { e[k] = v / mx; }); }
    else if (metric === 'between') bt.edge.forEach((v, k) => { e[k] = Math.sqrt(v); });
    else if (metric === 'crit') { const mx = Math.max(1, ...crit.map(c => (c.cut ? 0 : c.delta))); crit.forEach(c => { e[c.id] = c.cut ? 1 : Math.max(0, c.delta) / mx; }); }
    else ce.bridges.forEach(b => { e[b.id] = 1; });
    return { edge: e };
  }, [metric, res, bt, crit, ce]);

  // морфінг: полярні координати від складу, радіус пропорційний часу доїзду
  const morphData = useMemo(() => {
    const d = res.pb.depots[from] != null ? res.pb.depots[from] : res.pb.depots[0], o = NODES[d], tr = dijkstra(d, 2, cond);
    let gs = 0, ts = 0, n = 0, tmax = 0;
    NODES.forEach((nd, i) => { if (i === d || !Number.isFinite(tr.T[i])) return; gs += Math.hypot(nd.x - o.x, nd.y - o.y); ts += tr.T[i]; n++; tmax = Math.max(tmax, tr.T[i]); });
    const K = n ? gs / ts : 0.6, pos = new Float64Array(NODES.length * 2);
    NODES.forEach((nd, i) => {
      const a = Math.atan2(nd.y - o.y, nd.x - o.x), t = Number.isFinite(tr.T[i]) ? tr.T[i] : tmax * 1.15;
      pos[i * 2] = o.x + Math.cos(a) * t * K; pos[i * 2 + 1] = o.y + Math.sin(a) * t * K;
    });
    pos[d * 2] = o.x; pos[d * 2 + 1] = o.y;
    const rings = [30, 60, 90, 120].filter(m => m < tmax * 1.1).map(m => ({ r: m * K, label: f.min(m) }));
    return { pos, rings: { center: [o.x, o.y], rings } };
  }, [res, from, state.closed.join('.'), state.flood, state.winter]);

  const top = crit.slice(0, 10);
  const closeEdge = id => { sfx.cut(); ctx.cut([id]); ctx.notify(T.net.closedToast(edgeLabel(id))); };
  const legend = {
    flow: T.net.legFlow, between: T.net.legBetween, crit: T.net.legCrit, cut: T.net.legCut,
  }[metric];
  const isolated = NODES.filter((n, i) => comp.n > 1 && comp.comp[i] !== comp.comp[res.pb.depots[0]] && !res.pb.depots.some(d => comp.comp[d] === comp.comp[i]));

  return (
    <>
      <div className="net-stats">
        {[
          ['graph', T.net.nodes, f.int(NODES.length)], ['route', T.net.edges, f.int(stats.edges)], ['map', T.net.length, f.int(stats.km) + ' ' + T.units.km],
          ['nodes', T.net.degree, f.dec1(stats.deg)], ['clock', T.net.diameter, f.min(stats.diam)], ['unlink', T.net.deadEnds, f.int(ce.bridges.length)],
        ].map(([ic, l, v]) => <div key={l} className="ns glass"><Icon name={ic} size={16} /><span>{l}</span><b>{v}</b></div>)}
      </div>
      <div className="rp-network">
        <div className="map-col">
          <div className="net-bar glass">
            <Segmented value={metric} onChange={v => { setMetric(v); sfx.pop(); }} label={T.net.metric} options={METRICS.map(m => ({ value: m, label: T.net.m[m] }))} />
            <div className="morph-ctl">
              <span><Icon name="map" size={15} />{T.net.geo}</span>
              <input type="range" min="0" max="1" step="0.01" value={morph} aria-label={T.net.morph} onChange={e => { const v = +e.target.value; if (Math.round(v * 10) !== Math.round(morph * 10)) sfx.tick(); setMorph(v); }} style={{ '--k': morph }} />
              <span><Icon name="clock" size={15} />{T.net.time}</span>
              {res.pb.depots.length > 1 && <Segmented value={String(from)} onChange={v => setFrom(+v)} label={T.net.from} options={res.pb.depots.map((d, k) => ({ value: String(k), label: ['A', 'B', 'C'][k] }))} />}
            </div>
          </div>
          <MapStage ctx={ctx} mode="network" sol={res.sol} depots={res.pb.depots} closed={new Set(state.closed)} cond={{ flood: state.flood, winter: state.winter }} nodeOrders={nodeOrders} clock={clock}
            selRoute={selRoute} setSelRoute={setSelRoute} selNode={selNode} setSelNode={setSelNode} onCut={ctx.cut} onHeal={ctx.heal} solving={solving}
            metric={mvals} morph={morph} morphPos={morphData.pos} morphRings={morphData.rings} onUndo={ctx.undo} canUndo={ctx.canUndo} height={600} />
          <p className="net-legend"><span className="nl-ramp">{COL.seq.map(c => <i key={c} style={{ background: c }} />)}</span>{legend}</p>
        </div>
        <Panel title={T.net.critTitle} sub={T.net.critSub} className="crit-panel">
          <HBars items={top.map(c => ({ key: c.id, label: edgeLabel(c.id), v: c.cut ? 0 : Math.max(0, c.delta), c }))}
            max={Math.max(1, ...top.map(c => (c.cut ? 0 : c.delta)))} selected={pickEdge}
            fmt={(v, i) => (i.c.cut ? T.net.isolates(i.c.cut) : '+' + f.uahK(v))} colorOf={i => (i.c.cut ? COL.rubyHi : COL.hud)} onPick={i => setPickEdge(i.key)} />
          {pickEdge != null && (() => {
            const c = crit.find(x => x.id === pickEdge), e = EDGES[pickEdge];
            if (!c) return null;
            return (
              <div className="crit-card">
                <strong>{edgeLabel(pickEdge)}</strong>
                <span>{e.ferry ? T.road.ferry : e.bridge ? T.road.bridge[e.bridge] : T.road.cls[e.cls]} · {f.km(e.len)} · {T.net.usedBy(c.routes)}</span>
                {c.cut ? <span className="bad">{T.net.cutNote(c.cut)}</span> : <span>{T.net.detour(f.min(c.extraMin), f.signedKm(c.extraKm), f.uah(c.delta))}</span>}
                <Button icon="scissors" onClick={() => closeEdge(pickEdge)} disabled={state.closed.includes(pickEdge)}>{T.net.closeIt}</Button>
              </div>
            );
          })()}
          <p className="note small">{T.net.critNote}</p>
        </Panel>
      </div>

      <div className="grid grid-3">
        <Panel title={T.net.hubsTitle} sub={T.net.hubsSub}>
          <HBars items={bt.node.map((v, i) => ({ key: i, label: placeName(NODES[i]), v })).sort((a, b) => b.v - a.v).slice(0, 8)} fmt={v => f.int(v * 100)} colorOf={() => '#5C93D6'} onPick={i => setSelNode(i.key)} selected={selNode} />
          <p className="note small">{T.net.hubsNote}</p>
        </Panel>
        <Panel title={T.net.deadTitle} sub={T.net.deadSub}>
          <ul className="plain-list">
            {ce.bridges.map(b => <li key={b.id}><Icon name="unlink" size={14} /><span>{edgeLabel(b.id)}</span><em>{T.net.cutsOff(b.cut.map(i => placeName(NODES[i])).join(', '))}</em></li>)}
            {!ce.bridges.length && <li className="muted">{T.net.noDead}</li>}
          </ul>
          {isolated.length > 0 && <p className="bad small">{T.net.isolatedNow(isolated.map(placeName).join(', '))}</p>}
          <p className="note small">{T.net.deadNote(ce.art.length)}</p>
        </Panel>
        <Panel title={T.net.heavyTitle} sub={T.net.heavySub}>
          <ul className="plain-list">
            {heavy.map(h => <li key={h.i}><Icon name="truck" size={14} /><span>{placeName(NODES[h.i])}</span><em>{Number.isFinite(h.extra) ? T.net.heavyExtra(f.min(h.extra), ['A', 'B', 'C'][h.k]) : T.net.heavyNo}</em></li>)}
            {!heavy.length && <li className="muted">{T.net.heavyNone}</li>}
          </ul>
          <p className="note small">{T.net.heavyNote}</p>
        </Panel>
      </div>
    </>
  );
}
