import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { buildBase, solve, stats, signals, SIGNALS, DEFAULT_TH, MODES, PERIODS, SERVICES, stopDistances, routeInfo, MAXT } from './model.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import MapView from './pages/MapView.jsx';
import Coverage from './pages/Coverage.jsx';
import Facilities from './pages/Facilities.jsx';
import Scenarios from './pages/Scenarios.jsx';
import Signals from './pages/Signals.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [
  ['map', 'iso', MapView], ['coverage', 'curve', Coverage], ['facilities', 'hospital', Facilities],
  ['scenarios', 'flask', Scenarios], ['signals', 'warning', Signals], ['method', 'book', Method],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const SCEN_KEYS = ['ponton', 'drt', 'rural'];

function parseHash(base) {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const scen = {};
  (q.s || '').split(',').forEach(k => { if (SCEN_KEYS.includes(k)) scen[k] = true; });
  if (q.np && base.byId.has(q.np)) scen.newPoint = q.np;
  // приклад за замовчуванням: частіші сільські рейси і пункт здоров’я в Кленовому (s=0 означає «без змін»)
  if (q.s == null && q.np == null) { scen.rural = true; scen.newPoint = 'kle'; }
  const th = Number(q.th);
  return {
    view: PAGES[view] ? view : 'map',
    service: SERVICES.includes(q.svc) ? q.svc : 'primary',
    mode: MODES.includes(q.mode) ? q.mode : 'pt',
    period: PERIODS.includes(q.per) ? q.per : 'day',
    th: th >= 10 && th <= 90 && th % 5 === 0 ? th : null,
    id: q.id && base.byId.has(q.id) ? q.id : null,
    hl: q.hl && SIGNALS.some(s => s.id === q.hl) ? q.hl : '',
    sig: q.sig && SIGNALS.some(s => s.id === q.sig) ? q.sig : null,
    scen,
  };
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const csv = rows => rows.map(r => r.map(v => (v == null ? '' : /[",;\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\n');

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const base = useMemo(buildBase, []);
  const initial = useMemo(() => parseHash(base), []);

  const [view, setView] = useState(initial.view);
  const [service, setServiceState] = useState(initial.service);
  const [mode, setMode] = useState(initial.mode);
  const [period, setPeriod] = useState(initial.period);
  const [thBy, setThBy] = useState(() => ({ ...DEFAULT_TH, ...(initial.th ? { [initial.service]: initial.th } : {}) }));
  const [selected, setSelected] = useState(initial.id);
  const [hl, setHlState] = useState(initial.hl);
  const [sig, setSig] = useState(initial.sig);
  const [scen, setScen] = useState(initial.scen);
  const [zoomTarget, setZoomTarget] = useState(initial.id ? { place: initial.id, n: 1 } : null);
  const [motion, setMotion] = useState(() => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [labels, setLabels] = useState('names');
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState('');
  const toastTimer = useRef(null);
  const th = thBy[service];
  const S = useMemo(() => signals(base), [base]);

  useEffect(() => {
    const parts = [view];
    if (['map', 'coverage', 'facilities', 'scenarios'].includes(view)) {
      if (service !== 'primary') parts.push('svc=' + service);
      if (view !== 'coverage' && mode !== 'pt') parts.push('mode=' + mode);
      if (period !== 'day') parts.push('per=' + period);
      if (th !== DEFAULT_TH[service]) parts.push('th=' + th);
    }
    if (view === 'map' && selected) parts.push('id=' + selected);
    if (view === 'map' && hl) parts.push('hl=' + hl);
    if (view === 'signals' && sig) parts.push('sig=' + sig);
    if (view === 'scenarios') {
      const on = SCEN_KEYS.filter(k => scen[k]);
      parts.push('s=' + (on.length ? on.join(',') : '0'));
      if (scen.newPoint) parts.push('np=' + scen.newPoint);
    }
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, service, mode, period, th, selected, hl, sig, scen]);
  useEffect(() => {
    const on = () => {
      const h = parseHash(base);
      setView(h.view); setServiceState(h.service); setMode(h.mode); setPeriod(h.period);
      if (h.th) setThBy(x => ({ ...x, [h.service]: h.th }));
      setSelected(h.id); setHlState(h.hl); if (h.sig) setSig(h.sig); setScen(h.scen);
      setZoomTarget(h.id ? { place: h.id, n: Date.now() } : { fit: true, n: Date.now() });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`; }, [view]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const setService = s => setServiceState(s);
  const setTh = v => setThBy(x => ({ ...x, [service]: v }));
  const select = (id, zoom) => {
    setSelected(id);
    if (id && zoom) setZoomTarget({ place: id, n: Date.now() });
  };
  const setHl = v => { setHlState(v); setSelected(null); setZoomTarget({ fit: true, n: Date.now() }); };
  const navigate = id => {
    setView(id); setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const go = (id, patch = {}) => {
    if (patch.service) setServiceState(patch.service);
    if (patch.mode) setMode(patch.mode);
    if (patch.period) setPeriod(patch.period);
    if (patch.hl != null) { setHlState(patch.hl); setSelected(null); setZoomTarget({ fit: true, n: Date.now() }); }
    if (patch.id) { setSelected(patch.id); setHlState(''); setZoomTarget({ place: patch.id, n: Date.now() }); }
    if (patch.sig) setSig(patch.sig);
    navigate(id);
  };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  const norm = s => s.toLowerCase().replace(/[’'ʼ`]/g, '').replace(/\s+/g, ' ').trim();
  const search = e => {
    e.preventDefault();
    const t = norm(q);
    if (!t) return;
    const hit = base.places.find(p => norm(p.name.uk).startsWith(t) || norm(p.name.lat).startsWith(t)) || base.places.find(p => norm(p.name.uk).includes(t) || norm(p.name.lat).includes(t));
    if (hit) { go('map', { id: hit.id }); setQ(''); } else notify(T.notFound.replace('{q}', q.trim()), 'info');
  };

  const placeName = p => (p.kind === 'district' ? (lang === 'uk' ? p.name.uk : T.townName + ', ' + T.district[p.district]) : lang === 'uk' ? p.name.uk : p.name.lat);
  const facName = fc => (fc.isNew ? T.fac.new.replace('{p}', placeName(base.byId.get(fc.node))) : T.fac[fc.id]);
  const routeLabel = id => T.routeName(id);

  const exportPlaces = () => {
    const head = ['id', 'name_uk', 'name_lat', 'kind', 'x_km', 'y_km', 'population', 'share_65plus', 'share_0_17', 'walk_to_stop_km'];
    const combos = [];
    for (const s of SERVICES) for (const m of ['car', 'pt', 'walk']) for (const p of m === 'pt' ? PERIODS : ['day']) combos.push([s, m, p]);
    combos.forEach(([s, m, p]) => head.push(`${s}_${m}${m === 'pt' ? '_' + p : ''}_min`));
    const sols = combos.map(([s, m, p]) => solve(base, s, m, p, {}));
    const sd = stopDistances(base, {}, 'day');
    const rows = base.places.map(p => [p.id, p.name.uk, p.name.lat, p.kind, p.x, p.y, p.pop, p.old, p.kids, Number.isFinite(sd.get(p.id)) ? sd.get(p.id).toFixed(2) : '',
      ...sols.map(sl => { const t = sl.placeT.get(p.id).t; return Number.isFinite(t) && t < 999 ? t.toFixed(1) : ''; })]);
    download('BC_transport_access_places.csv', csv([head, ...rows]));
    notify(T.csvDone);
  };
  const exportRoutes = () => {
    const head = ['route', 'kind', 'stops', 'km', 'one_way_min', 'trips_am', 'trips_day', 'trips_pm'];
    const rows = base.routes.filter(r => r.kind !== 'drt').map(r => [r.id, r.kind || 'rural', r.stops.join(' > '), r.km.toFixed(1), r.oneWay.toFixed(1), r.trips.am, r.trips.day, r.trips.pm]);
    download('BC_transport_routes.csv', csv([head, ...rows]));
    notify(T.csvDone);
  };

  const ctx = {
    T, f, lang, base, S, service, setService, mode, setMode, period, setPeriod, th, setTh, thBy, selected, select, hl, setHl, sig, setSig,
    scen, setScen, zoomTarget, setZoomTarget, motion, setMotion, labels, setLabels, go, navigate, notify, openLead: where => setLead(where),
    placeName, facName, routeLabel, exportPlaces, exportRoutes, langPrefix: LANGS.find(l => l.id === lang).prefix,
  };
  const Page = PAGES[view];
  const home = onSite ? (ctx.langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const critical = SIGNALS.filter(s => s.level === 'critical').reduce((a, s) => a + S[s.id].length, 0);

  return (
    <div className={'app' + (motion ? ' motion' : '')}>
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
              {id === 'signals' && <em className="nav-count">{f.int(critical)}</em>}
            </a>
          ))}
        </nav>
        <div className="side-cta">
          <span className="signal-line" />
          <strong>{T.ctaSide}</strong>
          <p>{T.ctaSideText}</p>
          <Button kind="primary" onClick={() => setLead('sidebar')}>{T.ctaSideButton}</Button>
        </div>
        <a className="side-back" href={onSite ? (ctx.langPrefix || '') + '/cases/' : 'https://www.belyakovconsult.com/cases/'}>
          <Icon name="back" size={14} />belyakovconsult.com
        </a>
      </aside>
      {menu && <button type="button" className="scrim" aria-label={T.close} onClick={() => setMenu(false)} />}

      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label={T.menu} aria-expanded={menu}><Icon name="menu" size={20} /></button>
          <form className="search glass-control" onSubmit={search} role="search">
            <Icon name="search" size={17} />
            <input type="search" value={q} placeholder={T.search} aria-label={T.search} onChange={e => setQ(e.target.value)} list="tr-places" />
            <datalist id="tr-places">{base.places.map(p => <option key={p.id} value={placeName(p)} />)}</datalist>
          </form>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button icon="download" className="hide-sm" onClick={exportPlaces}>{T.csvShort}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => setLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view].replace('{pop}', f.int(base.total.all)).replace('{n}', f.int(32))}</p>
          </div>
          <div className="hero-art iso-art" aria-hidden="true">
            <svg viewBox="0 0 260 170">
              <path className="ia ia3" d="M130 18c58 2 108 26 110 66 2 42-48 70-108 70S16 126 20 84c4-40 52-68 110-66Z" />
              <path className="ia ia2" d="M132 42c38 1 72 17 72 44 0 28-32 46-72 46s-76-16-74-44c2-27 36-47 74-46Z" />
              <path className="ia ia1" d="M131 64c20 0 38 9 38 22s-17 24-38 24-37-10-37-23 17-23 37-23Z" />
              <path className="ia-road" d="M0 120C60 112 90 92 131 87s92 2 129-30" />
              <circle className="ia-pulse" cx="131" cy="87" r="6" />
              <circle className="ia-dot" cx="131" cy="87" r="4.5" />
              <circle className="ia-bus" r="3"><animateMotion dur="9s" repeatCount="indefinite" path="M0 120C60 112 90 92 131 87s92 2 129-30" /></circle>
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
          <p>{T.dataNote.replace('{pop}', f.int(base.total.all)).replace('{r}', f.int(base.routes.filter(r => r.kind !== 'drt' && !r.suspended).length))}</p>
          <div className="foot-actions">
            <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => setLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="transport-demo" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
