import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { buildData, NM, Y1 } from './model/data.js';
import { periodSums, toUnits, pvm, monthly, customerView } from './model/pvm.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import { PeriodBar } from './charts.jsx';
import { EFF_COL, TOT0, TOT1 } from './colors.js';
import { track } from './track.js';
import Overview from './pages/Overview.jsx';
import BridgePage from './pages/BridgePage.jsx';
import MapPage from './pages/MapPage.jsx';
import Products from './pages/Products.jsx';
import Customers from './pages/Customers.jsx';
import Channels from './pages/Channels.jsx';
import Managers from './pages/Managers.jsx';
import Scenario from './pages/Scenario.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [['overview', 'grid', Overview], ['bridge', 'bridge', BridgePage], ['map', 'globe', MapPage], ['products', 'box', Products], ['customers', 'users', Customers],
  ['channels', 'flow', Channels], ['managers', 'medal', Managers], ['scenario', 'sliders', Scenario], ['method', 'book', Method]];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const NCUR = NM - Y1;   // місяців поточного року в даних

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const m = /^(\d)-(\d)$/.exec(q.p || '');
  const per = m && +m[1] <= +m[2] && +m[2] < NCUR ? [+m[1], +m[2]] : null;
  return { view: PAGES[view] ? view : null, per, lv: ['p', 'pc', 'pk'].includes(q.l) ? q.l : null };
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang, T = STRINGS[lang];
  const fmt = useMemo(() => makeFmt(T), [lang]);
  const init = useMemo(parseHash, []);
  const [view, setView] = useState(init.view || 'overview');
  const [params, setParams] = useState({});
  const [[a, b], setPer] = useState(init.per || [0, NCUR - 1]);
  const [level, setLevel] = useState(init.lv || 'pk');
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null), perTimer = useRef(null);

  // Модель: дані генеруються один раз, розкладання перераховується на кожну зміну періоду чи рівня
  const D = useMemo(() => buildData(), []);
  const M = useMemo(() => monthly(D), [D]);
  const S = useMemo(() => periodSums(D, Y1 + a, Y1 + b), [a, b]);
  const Upk = useMemo(() => toUnits(D, S, 'pk'), [S]);
  const Epk = useMemo(() => pvm(Upk), [Upk]);
  const U = useMemo(() => (level === 'pk' ? Upk : toUnits(D, S, level)), [S, level]);
  const E = useMemo(() => (level === 'pk' ? Epk : pvm(U)), [U]);
  const CV = useMemo(() => customerView(D, Y1 + a, Y1 + b), [a, b]);

  useEffect(() => {
    const parts = [view];
    if (a !== 0 || b !== NCUR - 1) parts.push(`p=${a}-${b}`);
    if (level !== 'pk') parts.push('l=' + level);
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, a, b, level]);
  useEffect(() => {
    const on = () => { const h = parseHash(); if (h.view) setView(h.view); if (h.per) setPer(h.per); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`;
    track('view', { view });
  }, [view]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const setRange = (x, y) => {
    setPer([x, y]);
    clearTimeout(perTimer.current);
    perTimer.current = setTimeout(() => track('period', { from: x, to: y }), 900);
  };
  const go = (id, p = {}) => { setParams(p); setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  const openLead = (where, message) => { setLead({ where, message }); track('lead_open', { where }); };
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const setLv = l => { setLevel(l); track('level', { level: l }); };
  const ctx = { T, lang, fmt, D, M, a, b, t0: Y1 + a, t1: Y1 + b, S, Upk, Epk, U, E, CV, level, setLevel: setLv, setRange, go, params, notify, openLead, track, assetBase };
  const Page = PAGES[view];
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const presets = [['ytd', 0, NCUR - 1], ['q1', 0, 2], ['q2', 3, 5], ['q3', 6, 8], ['oct', NCUR - 1, NCUR - 1]].map(([id, x, y]) => ({ id, a: x, b: y, label: T.period.presets[id] }));

  return (
    <div className="app motion sm-app">
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
              onClick={e => { e.preventDefault(); go(id); }}>
              <Icon name={icon} size={18} /><span>{T.nav[id]}</span>
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
            <Button icon="download" className="hide-sm" onClick={() => go('method', { files: 1 })}>{T.me.files}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => openLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view]}</p>
          </div>
          <HeroArt />
        </section>

        <PeriodBar months={Array.from({ length: NCUR }, (_, i) => Y1 + i)} values={Array.from({ length: NCUR }, (_, i) => M.r[Y1 + i])} values0={Array.from({ length: NCUR }, (_, i) => M.r[i])}
          a={a} b={b} setRange={setRange} fmt={fmt} T={T} presets={presets} />

        <div className="page" key={view}>
          <Page ctx={ctx} />
        </div>

        <section className="sm-cta glass">
          <div><h2>{T.ctaTitle}</h2><p>{T.ctaText}</p></div>
          <Button kind="primary" icon="mail" onClick={() => openLead('bottom')}>{T.ctaLong}</Button>
        </section>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote}</p>
          <div className="foot-actions">
            <Button icon="book" onClick={() => go('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => openLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead.where} source="sales-margin" message={lead.message} onClose={() => setLead(null)} onSent={() => track('lead_sent', { where: lead.where })} />}
      <Toast toast={toast} />
    </div>
  );
}

// Hero: міст прибутку, що збирається і розбирається; підсумок поточного року світиться рубіновим
function HeroArt() {
  const bars = [[0, 96, TOT0, 1], [96, 108, EFF_COL.vol], [108, 103, EFF_COL.mix], [103, 133, EFF_COL.price], [133, 95, EFF_COL.cost], [95, 107, EFF_COL.nw], [107, 98, EFF_COL.lost], [0, 98, TOT1, 1]];
  const Y = v => 160 - v;
  return (
    <div className="hero-art sm-art" aria-hidden="true">
      <svg viewBox="0 0 264 172">
        {[40, 80, 120, 160].map(y => <line key={y} x1="0" x2="264" y1={y} y2={y} className="sa-grid" />)}
        {bars.map(([s, e, c, tot], i) => {
          const top = Y(Math.max(s, e)), h = Math.abs(e - s);
          return <rect key={i} x={10 + i * 31} y={top} width="22" height={h} rx="3" fill={c} fillOpacity={tot ? 0.9 : 0.75} className={'sa-bar' + (i === 7 ? ' last' : '')} style={{ animationDelay: i * 0.18 + 's', '--c': c }} />;
        })}
        {bars.slice(0, -1).map(([, e], i) => <line key={'l' + i} x1={32 + i * 31} x2={41 + i * 31} y1={Y(e)} y2={Y(e)} className="sa-conn" />)}
      </svg>
    </div>
  );
}
