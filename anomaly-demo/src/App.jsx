import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { makeDataset, FEATURES, monthOf, dow } from './data.js';
import { makeEngine, dashLayout, METHODS, CONTEXTS } from './engine.js';
import { webglOk } from './Cloud3D.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import Cloud from './pages/Cloud.jsx';
import Signals from './pages/Signals.jsx';
import Tuning from './pages/Tuning.jsx';
import Own from './pages/Own.jsx';
import Method from './pages/Method.jsx';
import { download, csvCell } from './util.js';

const VIEWS = [['cloud', 'cloud', Cloud], ['signals', 'warning', Signals], ['tuning', 'tune', Tuning], ['own', 'upload', Own], ['method', 'book', Method]];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const DEF_FEATS = FEATURES.filter(f => !f.off).map(f => f.id);
const DEF_TH = 3.5;

function parseHash(ds) {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const t = Number(q.t);
  const f = q.f ? q.f.split(',').filter(id => FEATURES.some(x => x.id === id)) : [];
  const g = q.g ? q.g.split(',').map(Number).filter(k => k >= 0 && k < ds.groups.length) : [];
  const p = q.p ? ds.rows.findIndex(x => x.id === q.p) : -1;
  return {
    view: PAGES[view] ? view : 'cloud',
    m: METHODS.includes(q.m) ? q.m : 'dev',
    c: CONTEXTS.includes(q.c) ? q.c : 'group',
    t: t >= 2 && t <= 7 ? Math.round(t * 10) / 10 : DEF_TH,
    f: new Set(f.length ? f : DEF_FEATS),
    g: new Set(g),
    p: p >= 0 ? p : null,
  };
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const ds = useMemo(() => makeDataset(), []);
  const E = useMemo(() => makeEngine(ds), [ds]);
  const initial = useMemo(() => parseHash(ds), []);
  const gl = useMemo(webglOk, []);

  const [view, setView] = useState(initial.view);
  const [method, setMethod] = useState(initial.m);
  const [cx, setCx] = useState(initial.c);
  const [th, setTh] = useState(initial.t);
  const [feats, setFeats] = useState(initial.f);
  const [groups, setGroups] = useState(initial.g);
  const [sel, setSelRaw] = useState(initial.p);
  const [mode, setMode] = useState(initial.p != null || initial.view !== 'cloud' ? 'cloud' : 'dash');
  const [fly, setFly] = useState(null);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const featsKey = [...feats].sort().join(',');
  const res = useMemo(() => E.run(cx, [...feats]), [cx, featsKey]);
  const D = useMemo(() => { E.ensure(res, method); return res.D[method]; }, [res, method]);
  const pos = useMemo(() => E.positions(res, method), [res, method]);
  const order = useMemo(() => Int32Array.from({ length: ds.n }, (_, i) => i).sort((a, b) => D[b] - D[a]), [D]);
  const rank = useMemo(() => { const r = new Int32Array(ds.n); order.forEach((i, k) => { r[i] = k; }); return r; }, [order]);
  const dash = useMemo(() => dashLayout(ds, i => monthOf(ds.rows[i].day)), [ds]);
  const flyKey = useRef(0);
  const flyTo = o => setFly({ ...o, key: ++flyKey.current });
  const setSel = (i, opts = {}) => { setSelRaw(i); if (i != null && opts.fly) { setMode('cloud'); flyTo({ point: i, dist: 9 }); } };

  useEffect(() => {
    const parts = [view];
    if (method !== 'dev') parts.push('m=' + method);
    if (cx !== 'group') parts.push('c=' + cx);
    if (th !== DEF_TH) parts.push('t=' + th);
    if (featsKey !== [...DEF_FEATS].sort().join(',')) parts.push('f=' + [...feats].join(','));
    if (groups.size) parts.push('g=' + [...groups].join(','));
    if (sel != null && (view === 'cloud' || view === 'signals')) parts.push('p=' + ds.rows[sel].id);
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, method, cx, th, featsKey, groups, sel]);
  useEffect(() => {
    const on = () => { const h = parseHash(ds); setView(h.view); setMethod(h.m); setCx(h.c); setTh(h.t); setFeats(h.f); setGroups(h.g); setSelRaw(h.p); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`; }, [view]);
  // ліс ізоляції й сусідів рахуємо заздалегідь у паузі браузера, щоб перший клік по точці не гальмував
  useEffect(() => { const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1200)); const id = idle(() => E.ensure(res, 'iforest')); return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id)); }, [res]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const go = (id, patch = {}) => { if (patch.sel != null) setSel(patch.sel, { fly: id === 'cloud' }); navigate(id); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };

  // Усі записи з оцінками поточного методу (CSV)
  const exportCsv = () => {
    const rows = [['id', 'date', 'time', 'group', 'counterparty', 'amount_uah', 'invoice_date', 'days_to_pay', 'weekday', 'level_sigma', 'flag', 'method', 'baseline', 'truth', 'cause'],
      ...ds.rows.map((x, i) => [x.id, f.day(x.day), f.time(x.t), ds.groups[x.g].id, ds.cps[x.cp].name[lang], x.amount.toFixed(2), f.day(x.inv), x.lag, dow(x.day), D[i].toFixed(2), D[i] >= th ? 1 : 0, method, cx, x.truth, x.cause || ''])];
    download('BC_anomalies_payments.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'));
    notify(T.method.csvDone);
  };

  const ctx = { T, f, lang, ds, E, gl, res, D, pos, dash, order, rank, view, method, setMethod, cx, setCx, th, setTh, feats, setFeats, groups, setGroups, sel, setSel, mode, setMode, fly, flyTo, go, navigate, notify, exportCsv, setLead, assetBase };
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
            <Button icon="download" className="hide-sm" onClick={exportCsv}>{T.csvShort}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => setLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view](f.int(ds.n))}</p>
          </div>
          <div className="hero-art anomaly-art" aria-hidden="true">
            <svg viewBox="0 0 260 170">
              <ellipse className="aa-orbit" cx="128" cy="86" rx="92" ry="38" />
              <ellipse className="aa-orbit o2" cx="128" cy="86" rx="58" ry="58" />
              {Array.from({ length: 70 }, (_, k) => { const a = k * 2.399, r = 6 + Math.sqrt(k) * 6.2; return <circle key={k} className="aa-dot" cx={128 + Math.cos(a) * r * 1.35} cy={86 + Math.sin(a) * r * 0.7} r={k % 7 ? 1.6 : 2.2} style={{ animationDelay: (k % 9) * 0.3 + 's' }} />; })}
              <circle className="aa-hot" cx="226" cy="40" r="4.5" /><circle className="aa-ring" cx="226" cy="40" r="4.5" />
              <circle className="aa-hot" cx="38" cy="138" r="3.6" />
              <circle className="aa-hot" cx="196" cy="146" r="3" />
            </svg>
          </div>
        </section>

        <div className={'page page-' + view} key={view}>
          <Page ctx={ctx} />
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote}</p>
          <div className="foot-actions">
            <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => setLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="anomaly-demo" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
