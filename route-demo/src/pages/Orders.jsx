// Замовлення і сигнали: що піде не так у плані, повна таблиця замовлень дня з кроковими кнопками,
// доставки за годинами.
import { useMemo, useState } from 'react';
import { NODES, CUSTOMERS, KINDS } from '../world.js';
import { COL } from '../engine.js';
import { ordersOf } from '../state.js';
import { HourBars } from '../charts.jsx';
import { hm } from '../clock.js';
import { sfx } from '../sound.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Button, Segmented } from '../../../dashboard/src/ui.jsx';

const SIGS = [['unserved', 'critical'], ['late', 'critical'], ['over', 'critical'], ['full', 'warning'], ['wait', 'warning']];

export default function Orders({ ctx }) {
  const { T, f, state, res, signals, setDemand, navigate, setSelNode, setSelRoute, placeName, exportOrders } = ctx;
  const [filter, setFilter] = useState('all');
  const [kind, setKind] = useState('all');
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState('window');
  const orders = ordersOf(state);
  const where = useMemo(() => {
    const m = new Map();
    res.sol.routes.forEach((r, ri) => r.stops.forEach(s => m.set(s.stop.id, { r, ri, s })));
    return m;
  }, [res]);
  const rows = CUSTOMERS.filter(c => all || orders[c.id] > 0).map(c => {
    const q = orders[c.id] || 0, w = where.get(c.id), un = q > 0 && !w;
    return { c, q, w, un, late: w && w.s.late > 0.5, slack: w ? c.b - w.s.start : null };
  }).filter(r => (filter === 'all' ? true : filter === 'late' ? r.late : filter === 'unserved' ? r.un : r.q > 0 && !r.late && !r.un)).filter(r => kind === 'all' || r.c.kind === kind)
    .sort((a, b) => (sort === 'window' ? a.c.a - b.c.a || a.c.b - b.c.b : sort === 'eta' ? (a.w ? a.w.s.start : 1e9) - (b.w ? b.w.s.start : 1e9) : sort === 'slack' ? (a.slack == null ? 1e9 : a.slack) - (b.slack == null ? 1e9 : b.slack) : b.q - a.q) || a.c.i - b.c.i);
  const go = (node, ri) => { setSelNode(node); if (ri != null) setSelRoute(ri); navigate('dispatch'); };
  const sigList = id => {
    const s = signals[id];
    if (id === 'unserved') return s.map(u => ({ key: u.stop.id, text: placeName(NODES[u.stop.node]) + ' · ' + T.kind[u.stop.c.kind], meta: f.int(u.stop.q) + ' ' + T.units.pal + ' · ' + (u.cut ? T.reason.cut : T.reason.fleet), node: u.stop.node }));
    if (id === 'late' || id === 'wait') return s.map(x => ({ key: x.x.stop.id, text: placeName(NODES[x.x.stop.node]) + ' · ' + T.kind[x.x.stop.c.kind], meta: x.r.id + ' · ' + (id === 'late' ? '+' + f.min(x.x.late) : T.gantt.wait + ' ' + f.min(x.x.wait)), node: x.x.stop.node, ri: x.ri }));
    return s.map(x => ({ key: x.r.id, text: x.r.id + ' · ' + T.vehicle[['truck', 'lorry', 'van'][x.r.t]], meta: id === 'full' ? f.int(x.r.load) + '/' + f.int(x.r.cap) + ' ' + T.units.pal : '+' + f.min(x.r.over), node: x.r.stops[0] && x.r.stops[0].stop.node, ri: x.ri }));
  };
  return (
    <>
      <div className="sig-grid">
        {SIGS.map(([id, lvl]) => {
          const list = sigList(id), n = list.length;
          return (
            <article key={id} className={'sig-card glass ' + (n ? lvl : 'ok')}>
              <div className="sg-head"><span className={'sg-ic ' + (n ? lvl : 'ok')}><Icon name={n ? 'warning' : 'check'} size={16} /></span><h3>{T.sig[id].t}</h3><b>{n}</b></div>
              <p className="sg-rule">{T.sig[id].rule}</p>
              {n > 0 && <ul>{list.slice(0, 4).map(x => <li key={x.key}><button type="button" onClick={() => go(x.node, x.ri)}><span>{x.text}</span><em>{x.meta}</em></button></li>)}{n > 4 && <li className="muted small">{T.sig.more(n - 4)}</li>}</ul>}
              <p className="sg-step"><Icon name="arrowRight" size={13} />{n ? T.sig[id].step : T.sig.okStep}</p>
            </article>
          );
        })}
      </div>

      <div className="grid grid-2 orders-grid">
        <Panel title={T.orders.title} sub={T.orders.sub(Object.keys(orders).length, Object.values(orders).reduce((a, b) => a + b, 0))} className="orders-panel"
          aside={<Button icon="download" onClick={exportOrders}>{T.orders.csv}</Button>}>
          <div className="toolbar tight wrap">
            <Segmented value={filter} onChange={setFilter} label={T.orders.filter} options={['all', 'ok', 'late', 'unserved'].map(v => ({ value: v, label: T.orders.f[v] }))} />
            <label className="select glass-control"><span className="sr-only">{T.orders.kind}</span>
              <select value={kind} onChange={e => setKind(e.target.value)} aria-label={T.orders.kind}>
                <option value="all">{T.orders.allKinds}</option>
                {KINDS.map(k => <option key={k} value={k}>{T.kind[k]}</option>)}
              </select><Icon name="chevron" size={14} />
            </label>
            <label className="select glass-control"><span className="sr-only">{T.orders.sort}</span>
              <select value={sort} onChange={e => setSort(e.target.value)} aria-label={T.orders.sort}>
                {['window', 'eta', 'slack', 'q'].map(k => <option key={k} value={k}>{T.orders.sortBy[k]}</option>)}
              </select><Icon name="chevron" size={14} />
            </label>
            <label className="check-inline"><input type="checkbox" checked={all} onChange={() => setAll(!all)} />{T.orders.showAll}</label>
          </div>
          <div className="table-scroll orders-scroll">
            <table className="data-table ord-table">
              <thead><tr><th>{T.orders.place}</th><th>{T.orders.customer}</th><th>{T.orders.pallets}</th><th>{T.orders.window}</th><th>{T.orders.route}</th><th>{T.orders.eta}</th><th className="num">{T.orders.slack}</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.c.id} className={r.un ? 'bad' : r.late ? 'warn' : r.q ? '' : 'off'}>
                    <td><button type="button" className="link-btn" onClick={() => go(r.c.node, r.w && r.w.ri)}>{placeName(NODES[r.c.node])}</button></td>
                    <td>{T.kind[r.c.kind]}</td>
                    <td><div className="stepper sm">
                      <button type="button" onClick={() => { sfx.tick(); setDemand(r.c.id, Math.max(0, r.q - 1)); }} disabled={r.q <= 0} aria-label={T.less}><Icon name="minus" size={12} /></button>
                      <b>{r.q}</b>
                      <button type="button" onClick={() => { sfx.tick(); setDemand(r.c.id, Math.min(14, r.q + 1)); }} disabled={r.q >= 14} aria-label={T.more}><Icon name="plus" size={12} /></button>
                    </div></td>
                    <td className="mono">{hm(r.c.a)}-{hm(r.c.b)}</td>
                    <td>{r.w ? <span className="rt-id"><i style={{ background: COL.depot[r.w.r.d] }} />{r.w.r.id}</span> : r.q ? <span className="bad">{T.map.unserved}</span> : <span className="muted">{T.orders.noOrder}</span>}</td>
                    <td className="mono">{r.w ? hm(r.w.s.start) : ''}</td>
                    <td className={'num ' + (r.late ? 'bad' : '')}>{r.w ? (r.late ? '+' + f.int(r.w.s.late) : f.int(r.slack)) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="muted small center">{T.orders.empty}</p>}
          </div>
          <p className="note small">{T.orders.note}</p>
        </Panel>
        <Panel title={T.orders.hoursTitle} sub={T.orders.hoursSub}>
          <HourBars ctx={ctx} sol={res.sol} />
          <div className="kind-mix">
            {KINDS.map(k => {
              const list = Object.entries(orders).filter(([id]) => id.split('-')[1].replace(/\d+$/, '') === k);
              return <div key={k}><span>{T.kind[k]}</span><b>{f.int(list.length)}</b><em>{f.int(list.reduce((a, [, q]) => a + q, 0))} {T.units.pal}</em><small>{T.orders.windowOf[k]}</small></div>;
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
