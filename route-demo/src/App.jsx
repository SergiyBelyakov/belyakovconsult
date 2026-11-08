import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { NODES, NODE, EDGES, CUSTOMERS, CUST, TYPES, FLEET0, FLEET_MAX, PARAMS0, DEPOTS0, dayOrders, serviceMin } from './world.js';
import { DEF, ordersOf, compute } from './state.js';
import { createClock, hm } from './clock.js';
import { sfx } from './sound.js';
import { xlsxBlob, saveBlob, csvBlob } from '../../chart-gallery/src/xlsx.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import Dispatch from './pages/Dispatch.jsx';
import Network from './pages/Network.jsx';
import Scenarios from './pages/Scenarios.jsx';
import Orders from './pages/Orders.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [['dispatch', 'dispatch', Dispatch], ['network', 'graph', Network], ['scenarios', 'flask', Scenarios], ['orders', 'list', Orders], ['method', 'book', Method]];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const s = { ...DEF, fleet: { ...DEF.fleet } };
  if (q.d) { const ds = q.d.split('.').map(id => NODE.get(id)).filter(Boolean).map(n => n.i); if (ds.length >= 1 && ds.length <= 3 && new Set(ds).size === ds.length) s.depots = ds; }
  if (q.f) { const v = q.f.split('.').map(Number); TYPES.forEach((t, k) => { if (Number.isInteger(v[k]) && v[k] >= 0 && v[k] <= FLEET_MAX[t.id]) s.fleet[t.id] = v[k]; }); }
  if (+q.fu >= 40 && +q.fu <= 80) s.fuel = +q.fu;
  if (+q.sh >= 8 && +q.sh <= 12) s.shift = +q.sh;
  if (q.c) s.closed = [...new Set(q.c.split('.').map(Number).filter(i => Number.isInteger(i) && EDGES[i]))];
  if (+q.day >= 1 && +q.day <= 99) s.day = +q.day;
  if (q.o) q.o.split(',').forEach(p => { const [id, v] = p.split(':'); if (CUST.has(id) && +v >= 0 && +v <= 14) s.edits[id] = +v; });
  s.winter = q.w === '1'; s.flood = q.fl === '1'; s.peak = q.pk === '1';
  return { view: PAGES[view] ? view : 'dispatch', s, plan: q.plan === 'man' ? 'man' : 'opt' };
}
function hashOf(view, s, plan) {
  const parts = [view];
  const d = s.depots.map(i => NODES[i].id).join('.');
  if (d !== DEF.depots.map(i => NODES[i].id).join('.')) parts.push('d=' + d);
  const fl = TYPES.map(t => s.fleet[t.id]).join('.');
  if (fl !== TYPES.map(t => DEF.fleet[t.id]).join('.')) parts.push('f=' + fl);
  if (s.fuel !== DEF.fuel) parts.push('fu=' + s.fuel);
  if (s.shift !== DEF.shift) parts.push('sh=' + s.shift);
  if (s.closed.length) parts.push('c=' + s.closed.join('.'));
  if (s.day !== 1) parts.push('day=' + s.day);
  const ed = Object.entries(s.edits);
  if (ed.length && ed.length <= 12) parts.push('o=' + ed.map(([k, v]) => k + ':' + v).join(','));
  if (s.winter) parts.push('w=1');
  if (s.flood) parts.push('fl=1');
  if (s.peak) parts.push('pk=1');
  if (plan === 'man') parts.push('plan=man');
  return '#' + parts.join('&');
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const init = useMemo(parseHash, []);
  const [view, setView] = useState(init.view);
  const [state, setState] = useState(init.s);
  const [plan, setPlan] = useState(init.plan);
  const Mref = useRef(null);
  const [res, setRes] = useState(() => { const r = compute(init.s, null, 'full', null); Mref.current = r.pb.M; return r; });
  const [preview, setPreview] = useState(null);
  const [solving, setSolving] = useState(false);
  const [selRoute, setSelRoute] = useState(null);
  const [selNode, setSelNode] = useState(null);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const [log, setLog] = useState([]);
  const [delta, setDelta] = useState(null);
  const hist = useRef([]);
  const toastTimer = useRef(null);
  const clock = useMemo(() => createClock(480), []);
  const baseRes = useMemo(() => (JSON.stringify(init.s) === JSON.stringify(DEF) ? res : compute(DEF, null, 'full', null)), []);
  const pending = useRef(null), first = useRef(true), lastLabel = useRef(null);

  // перерахунок після кожної підтвердженої зміни
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setSolving(true);
    const prev = (preview && preview.sol) || res.sol, prevTot = res.sol.totals;
    const id = setTimeout(() => {
      const r = compute(state, prev, 'full', Mref.current);
      Mref.current = r.pb.M;
      r.sol.grow = true;
      setPreview(null);
      setRes(r);
      setSolving(false);
      sfx.done();
      const t = r.sol.totals, dc = t.cost - prevTot.cost;
      const label = lastLabel.current;
      lastLabel.current = null;
      if (label) {
        const d = { cost: dc, km: t.km - prevTot.km, unserved: t.unserved - prevTot.unserved, late: t.lateStops - prevTot.lateStops, rel: prevTot.cost ? dc / prevTot.cost : 0, id: Date.now() };
        setDelta(d);
        setLog(l => [{ label, ...d }, ...l].slice(0, 14));
      }
    }, 16);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    const h = hashOf(view, state, plan);
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, state, plan]);
  useEffect(() => {
    const on = () => { const h = parseHash(); setView(h.view); setPlan(h.plan); if (JSON.stringify(h.s) !== JSON.stringify(state)) setState(h.s); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [state]);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`; }, [view]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  // зміна стану з історією для «Скасувати» і підписом для журналу
  const change = (patch, label) => {
    hist.current.push(state);
    if (hist.current.length > 40) hist.current.shift();
    lastLabel.current = label;
    setState(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  };
  const undo = () => {
    const prev = hist.current.pop();
    if (!prev) return;
    lastLabel.current = T.log.undo;
    sfx.pop();
    setState(prev);
  };
  const reset = () => { change({ ...DEF, fleet: { ...DEF.fleet } }, T.log.reset); clock.set(480); };

  // перетягування складу: швидкий перерахунок на кожен «магніт», повний після відпускання
  const previewDepot = (k, node) => {
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      const s = { ...state, depots: state.depots.map((n, i) => (i === k ? node : n)) };
      const r = compute(s, (preview && preview.sol) || res.sol, 'fast', null);
      setPreview(r);
    }, 10);
  };
  const commitDepot = (k, node) => {
    clearTimeout(pending.current);
    const id = ['A', 'B', 'C'][k];
    change(s => ({ depots: s.depots.map((n, i) => (i === k ? node : n)) }), T.log.depot(id, placeName(NODES[node])));
  };
  const cancelDepot = () => { clearTimeout(pending.current); setPreview(null); };
  const cut = ids => {
    const add = ids.filter(id => !state.closed.includes(id));
    if (!add.length) return;
    change(s => ({ closed: [...s.closed, ...add] }), T.log.cut(add.map(edgeLabel).join(', ')));
  };
  const heal = id => change(s => ({ closed: s.closed.filter(x => x !== id) }), T.log.heal(edgeLabel(id)));
  const setDemand = (cid, v) => {
    const c = CUST.get(cid), base = dayOrders(state.day)[cid] || 0;
    change(s => { const e = { ...s.edits }; if (v === base) delete e[cid]; else e[cid] = v; return { edits: e }; }, T.log.demand(placeName(NODES[c.node]), T.kind[c.kind], v));
  };
  const setFleet = (type, v) => change(s => ({ fleet: { ...s.fleet, [type]: v } }), T.log.fleet(T.vehiclePl[type], v));
  const setParam = (k, v) => change({ [k]: v }, k === 'fuel' ? T.log.fuel(f.uah(v)) : T.log.shift(v));
  const newDay = () => { const d = state.day >= 30 ? 1 : state.day + 1; change({ day: d, edits: {} }, T.log.day(d)); sfx.pop(); };
  const applyScenario = (patch, label) => { change(s => ({ ...DEF, fleet: { ...DEF.fleet }, ...patch(s) }), label); };

  const placeName = n => (lang === 'uk' ? n.name.uk : n.name.lat);
  const edgeLabel = id => { const e = EDGES[id]; return T.edgeName(placeName(NODES[e.a]), placeName(NODES[e.b])); };
  const stopName = st => placeName(NODES[st.node]) + ' · ' + T.kind[st.c.kind];

  const shown = preview || res;
  const sol = plan === 'man' && !preview ? res.man : shown.sol;
  // замовлення за вузлами для маркерів на карті
  const nodeOrders = useMemo(() => {
    const m = new Map();
    const put = (st, extra) => { const a = m.get(st.node) || []; a.push({ id: st.id, kind: st.c.kind, q: st.q, ...extra }); m.set(st.node, a); };
    sol.routes.forEach((r, ri) => r.stops.forEach(x => put(x.stop, { ri, d: r.d, late: x.late, start: x.start, end: x.end })));
    sol.unserved.forEach(u => put(u.stop, { ri: null, d: null, late: 0 }));
    return m;
  }, [sol]);

  // ——— вивантаження ———
  const L = lang === 'uk';
  const planRows = s => s.routes.flatMap(r => r.stops.map((x, k) => [r.id, T.vehicle[TYPES[r.t].id], ['A', 'B', 'C'][r.d], k + 1, x.stop.id, placeName(NODES[x.stop.node]), T.kind[x.stop.c.kind], x.stop.q, hm(x.stop.a) + '-' + hm(x.stop.b), hm(x.arr), hm(x.start), Math.round(x.wait), Math.round(x.late), hm(x.end)]));
  const exportPlan = () => {
    const s = res.sol;
    saveBlob('BC_route_plan.xlsx', xlsxBlob([
      { name: L ? 'Розклад' : 'Schedule', head: L ? ['Маршрут', 'Машина', 'Склад', '№', 'id', 'Пункт', 'Клієнт', 'Палет', 'Вікно', 'Прибуття', 'Початок', 'Очікування, хв', 'Запізнення, хв', 'Виїзд'] : ['Route', 'Vehicle', 'Depot', 'No', 'id', 'Place', 'Customer', 'Pallets', 'Window', 'Arrival', 'Start', 'Wait, min', 'Late, min', 'Departure'], rows: planRows(s), widths: [9, 14, 7, 5, 22, 18, 18, 8, 13, 10, 10, 13, 14, 10] },
      { name: L ? 'Маршрути' : 'Routes', head: L ? ['Маршрут', 'Машина', 'Склад', 'Зупинок', 'Палет', 'Місткість', 'Км', 'Виїзд', 'Повернення', 'Год', 'CO2, кг', 'Вартість, грн', 'Пальне', 'Знос', 'Водій', 'Постійні', 'Штрафи', 'WKT (км)'] : ['Route', 'Vehicle', 'Depot', 'Stops', 'Pallets', 'Capacity', 'Km', 'Out', 'Back', 'Hours', 'CO2, kg', 'Cost, UAH', 'Fuel', 'Wear', 'Driver', 'Fixed', 'Penalties', 'WKT (km)'],
        rows: s.routes.map(r => [r.id, T.vehicle[TYPES[r.t].id], ['A', 'B', 'C'][r.d], r.stops.length, r.load, r.cap, Math.round(r.km * 10) / 10, hm(r.start), hm(r.end), Math.round((r.dur / 60) * 10) / 10, Math.round(r.co2), Math.round(r.cost), Math.round(r.parts.fuel), Math.round(r.parts.wear), Math.round(r.parts.driver), r.parts.fixed, Math.round(r.parts.pen), wkt(r)]) },
      { name: L ? 'Не доставлено' : 'Unserved', head: ['id', L ? 'Пункт' : 'Place', L ? 'Клієнт' : 'Customer', L ? 'Палет' : 'Pallets', L ? 'Причина' : 'Reason'], rows: s.unserved.map(u => [u.stop.id, placeName(NODES[u.stop.node]), T.kind[u.stop.c.kind], u.stop.q, u.cut ? T.reason.cut : T.reason.fleet]) },
      { name: L ? 'Дороги' : 'Roads', head: ['id', L ? 'Від' : 'From', L ? 'До' : 'To', L ? 'Клас' : 'Class', L ? 'Км' : 'Km', L ? 'Км/год' : 'Km/h', L ? 'Обмеження, т' : 'Limit, t', L ? 'Закрито' : 'Closed', L ? 'Проїздів' : 'Runs', L ? 'Палет' : 'Pallets'], rows: EDGES.map(e => [e.id, placeName(NODES[e.a]), placeName(NODES[e.b]), e.ferry ? T.road.ferry : T.road.cls[e.cls], e.len, e.ferry ? '' : e.kmh, e.maxT < 99 ? e.maxT : '', state.closed.includes(e.id) ? 1 : 0, s.flows.runs[e.id], s.flows.pal[e.id]]) },
      { name: L ? 'Автопарк' : 'Fleet', head: L ? ['Тип', 'Доступно', 'У рейсі', 'Палет', 'Маса, т', 'Л/100 км', 'Знос, грн/км', 'Водій, грн/год', 'Постійні, грн/день'] : ['Type', 'Available', 'In use', 'Pallets', 'Mass, t', 'L/100 km', 'Wear, UAH/km', 'Driver, UAH/h', 'Fixed, UAH/day'], rows: TYPES.map((t, k) => [T.vehicle[t.id], state.fleet[t.id], s.totals.byType[k], t.cap, t.mass, t.fuel, t.wear, t.driver, t.fixed]) },
    ]));
    notify(T.saved);
  };
  const wkt = r => 'LINESTRING(' + r.legs.flatMap(l => l.edges.flatMap(e => { const p = EDGES[e.id].pts; return (e.fwd ? p : p.slice().reverse()).map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)); })).join(', ') + ')';
  const exportOrders = () => {
    const head = ['id', 'node', 'place', 'kind', 'pallets', 'window_from', 'window_to', 'service_min', 'x_km', 'y_km'];
    const o = ordersOf(state);
    const rows = Object.entries(o).map(([id, q]) => { const c = CUST.get(id), n = NODES[c.node]; return [id, n.id, placeName(n), c.kind, q, hm(c.a), hm(c.b), serviceMin(c, q), n.x, n.y]; });
    saveBlob('BC_route_orders.csv', csvBlob(head, rows));
    notify(T.saved);
  };

  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };

  const signals = useMemo(() => {
    const s = res.sol, out = { late: [], unserved: s.unserved, full: [], wait: [], over: [], single: [] };
    s.routes.forEach((r, ri) => {
      r.stops.forEach(x => { if (x.late > 0.5) out.late.push({ r, ri, x }); if (x.wait > 40) out.wait.push({ r, ri, x }); });
      if (r.load / r.cap > 0.97) out.full.push({ r, ri });
      if (r.over > 0.5) out.over.push({ r, ri });
    });
    return out;
  }, [res]);
  const critical = signals.late.length + signals.unserved.length + signals.over.length;

  const ctx = {
    T, f, lang, view, navigate, notify, assetBase, onSite, state, change, setState, undo, canUndo: hist.current.length > 0, reset, plan, setPlan,
    res, shown, sol, baseRes, preview, solving, clock, selRoute, setSelRoute, selNode, setSelNode, nodeOrders, log, delta,
    previewDepot, commitDepot, cancelDepot, cut, heal, setDemand, setFleet, setParam, newDay, applyScenario, placeName, edgeLabel, stopName,
    exportPlan, exportOrders, signals, openLead: w => setLead(w), Mref,
  };
  const Page = PAGES[view];
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';

  return (
    <div className="app motion">
      <div className="bg" aria-hidden="true">
        <div className="bg-wave" />
        <div className="bg-grid" />
        <div className="bg-glow g1" />
        <div className="bg-glow g2" />
      </div>

      <aside className={'sidebar glass' + (menu ? ' open' : '')} aria-label={T.navCaption}>
        <a className="side-brand" href={home} aria-label="Belyakov Consult">
          <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="102" height="52" />
          <span className="brand-name">Belyakov Consult</span>
          <span className="brand-caption">BI • Data Architecture • Data Governance</span>
        </a>
        <p className="nav-caption">{T.navCaption}</p>
        <nav>
          {VIEWS.map(([id, icon]) => (
            <a key={id} href={'#' + id} className={'nav-item' + (view === id ? ' active' : '')} aria-current={view === id ? 'page' : undefined}
              onClick={e => { e.preventDefault(); navigate(id); }}>
              <Icon name={icon} size={18} /><span>{T.nav[id]}</span>
              {id === 'orders' && critical > 0 && <span className="nav-count">{critical}</span>}
            </a>
          ))}
        </nav>
        <div className="side-cta">
          <span className="signal-line" />
          <strong>{T.ctaSide}</strong>
          <p>{T.ctaSideText}</p>
          <Button kind="primary" onClick={() => setLead('sidebar')}>{T.ctaSideButton}</Button>
        </div>
        <a className="side-back" href={onSite ? (langPrefix || '') + '/cases/' : 'https://www.belyakovconsult.com/cases/'}>
          <Icon name="back" size={14} />belyakovconsult.com
        </a>
      </aside>
      {menu && <button type="button" className="scrim" aria-label={T.close} onClick={() => setMenu(false)} />}

      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label={T.menu} aria-expanded={menu}><Icon name="menu" size={20} /></button>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button icon="download" className="hide-sm" onClick={exportPlan}>{T.xlsxShort}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => setLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero rp-hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view](res.pb.stops.length, res.sol.totals.fleet)}</p>
          </div>
          <div className="hero-art route-art" aria-hidden="true">
            <svg viewBox="0 0 260 150">
              <path className="ra-grid" d="M10 120 L130 150 L250 120 L130 90 Z M70 105 L190 135 M40 112.5 L160 142.5 M100 97.5 L220 127.5 M70 135 L190 105 M40 127.5 L160 97.5 M100 142.5 L220 112.5" />
              <path className="ra-road" d="M28 118 C70 96 92 128 132 108 S200 82 236 104" />
              <path className="ra-r1" d="M132 108 C120 80 92 70 64 74" />
              <path className="ra-r2" d="M132 108 C156 92 186 64 214 58" />
              <circle className="ra-pulse" cx="132" cy="108" r="7" />
              <path className="ra-depot" d="M132 99 l8 4.5 v9 l-8 4.5 l-8 -4.5 v-9 Z" />
              <line className="ra-beam" x1="132" y1="99" x2="132" y2="28" />
              <circle className="ra-truck t1" r="3.2"><animateMotion dur="5.5s" repeatCount="indefinite" path="M132 108 C120 80 92 70 64 74" /></circle>
              <circle className="ra-truck t2" r="3.2"><animateMotion dur="6.5s" repeatCount="indefinite" path="M132 108 C156 92 186 64 214 58" /></circle>
              <circle className="ra-stop" cx="64" cy="74" r="4" /><circle className="ra-stop s2" cx="214" cy="58" r="4" /><circle className="ra-stop" cx="236" cy="104" r="3" /><circle className="ra-stop" cx="28" cy="118" r="3" />
            </svg>
          </div>
        </section>

        <div className="page" key={view}>
          <Page ctx={ctx} />
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote(NODES.length, EDGES.length, CUSTOMERS.length)}</p>
          <div className="foot-actions">
            <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => setLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="route-demo" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
