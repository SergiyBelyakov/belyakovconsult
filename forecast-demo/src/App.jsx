import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { MODELS, BY_ID } from './engine/models.js';
import { DATASET_IDS, DEFAULT_DS } from './data.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import { track } from './track.js';
import Catalog from './pages/Catalog.jsx';
import ModelPage from './pages/ModelPage.jsx';
import Compare from './pages/Compare.jsx';
import OwnData from './pages/OwnData.jsx';
import Guide from './pages/Guide.jsx';
import ScenarioPage from './pages/Scenario.jsx';
import HierPage from './pages/Hierarchy.jsx';

const VIEWS = [['catalog', 'grid', Catalog], ['model', 'chart', ModelPage], ['compare', 'scale', Compare], ['scenario', 'sliders', ScenarioPage], ['hier', 'layers', HierPage], ['data', 'upload', OwnData], ['guide', 'compass', Guide]];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  return { view: PAGES[view] ? view : null, m: BY_ID[q.m] ? q.m : null, d: DATASET_IDS.includes(q.d) ? q.d : null, f: q.f || null };
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang, T = STRINGS[lang];
  const fmtBase = useMemo(() => makeFmt(T, 1), [lang]);
  const init = useMemo(parseHash, []);
  const [view, setView] = useState(init.view || (init.m ? 'model' : 'catalog'));
  const [modelId, setModelId] = useState(init.m || 'hw');
  const [dsId, setDsId] = useState(init.d || DEFAULT_DS[init.m || 'hw']);
  const [family, setFamily] = useState(init.f || 'all');
  const [cmpDs, setCmpDs] = useState(init.d || 'cafe');
  const [own, setOwn] = useState(null);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const parts = [view];
    if (view === 'model') parts.push('m=' + modelId, 'd=' + dsId);
    if (view === 'compare') parts.push('d=' + cmpDs);
    if (view === 'catalog' && family !== 'all') parts.push('f=' + family);
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, modelId, dsId, cmpDs, family]);
  useEffect(() => {
    const on = () => { const h = parseHash(); if (h.view) setView(h.view); if (h.m) setModelId(h.m); if (h.d) { setDsId(h.d); setCmpDs(h.d); } else if (h.m) setDsId(DEFAULT_DS[h.m]); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    const title = view === 'model' ? `${T.models[modelId].name} · ${T.demoName}` : `${T.nav[view]} · ${T.demoName}`;
    document.title = `${title} | Belyakov Consult`;
    track('view', { view, model: view === 'model' ? modelId : undefined });
  }, [view, modelId]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openModel = (id, d) => { setModelId(id); setDsId(d || DEFAULT_DS[id]); track('model', { model: id }); navigate('model'); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  const openLead = (where, message) => { setLead({ where, message }); track('lead_open', { where }); };
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const site = onSite ? langPrefix : 'https://www.belyakovconsult.com' + langPrefix;
  const ctx = {
    T, lang, fmtBase, view, navigate, notify, modelId, setModelId, dsId, setDsId, openModel, family, setFamily,
    cmpDs, setCmpDs, own, setOwn, openLead, site, assetBase, track,
  };
  const Page = PAGES[view];
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const title = view === 'model' ? T.models[modelId].name : T.titles[view];
  const leadText = view === 'model' ? T.models[modelId].short : T.leads[view];

  return (
    <div className="app motion fc-app">
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
              {id === 'catalog' && <span className="nav-count">{MODELS.length}</span>}
            </a>
          ))}
        </nav>
        <div className="side-cta">
          <span className="signal-line" />
          <strong>{T.ctaSide}</strong>
          <p>{T.ctaSideText}</p>
          <Button kind="primary" onClick={() => openLead('sidebar')}>{T.ctaSideButton}</Button>
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
            <Button icon="upload" className="hide-sm" onClick={() => navigate('data')}>{T.nav.data}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => openLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{view === 'model' ? T.families[BY_ID[modelId].family][0] : T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{title}</h1>
            <p>{leadText}</p>
          </div>
          <HeroArt />
        </section>

        <div className="page" key={view + (view === 'model' ? modelId : '')}>
          <Page ctx={ctx} />
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote}</p>
          <div className="foot-actions">
            <Button icon="compass" onClick={() => navigate('guide')}>{T.nav.guide}</Button>
            <Button kind="primary" onClick={() => openLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead.where} source="forecast-models" message={lead.message} onClose={() => setLead(null)} onSent={() => track('lead_sent', { where: lead.where })} />}
      <Toast toast={toast} />
    </div>
  );
}

// Hero: ряд, який продовжується віялом прогнозу; смуги коридору «дихають», лінія прогнозу перемальовується
function HeroArt() {
  const motion = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pts = Array.from({ length: 28 }, (_, i) => [8 + i * 6, 112 - i * 1.4 - 16 * Math.sin(i / 1.9) - (i % 5 === 0 ? 6 : 0)]);
  const last = pts[pts.length - 1], fx = k => last[0] + k * 6;
  const fcY = k => last[1] - k * 1.3 - 14 * Math.sin((27 + k) / 1.9);
  const fcPts = Array.from({ length: 13 }, (_, k) => [fx(k), k ? fcY(k) : last[1]]);
  const band = s => [...fcPts.map(([x, y], k) => [x, y - s * Math.sqrt(k) * 5.2]), ...fcPts.slice().reverse().map(([x, y], j) => [x, y + s * Math.sqrt(12 - j) * 5.2])];
  const d = p => 'M' + p.map(q => q.map(v => v.toFixed(1)).join(' ')).join('L');
  return (
    <div className="hero-art fc-art" aria-hidden="true">
      <svg viewBox="0 0 260 172">
        {[40, 80, 120, 160].map(y => <line key={y} x1="0" x2="260" y1={y} y2={y} className="fa-grid" />)}
        <path d={d(band(1.96)) + 'Z'} className="fa-b95" />
        <path d={d(band(1.28)) + 'Z'} className="fa-b80" />
        <path d={d(pts)} className="fa-hist" />
        <path d={d(fcPts)} className={'fa-fc' + (motion ? ' draw' : '')} pathLength="100" />
        <line x1={last[0]} x2={last[0]} y1="14" y2="166" className="fa-now" />
        <circle cx={last[0]} cy={last[1]} r="3.4" className="fa-dot" />
      </svg>
    </div>
  );
}
