import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { buildTerrain, floodStageOf, coverage, EXISTING_SIRENS, SIGNALS } from './dem.js';
import { webglOk } from './View3D.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import Relief from './pages/Relief.jsx';
import Flood from './pages/Flood.jsx';
import Cover from './pages/Cover.jsx';
import Suit from './pages/Suit.jsx';
import Signals from './pages/Signals.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [
  ['relief', 'layers', Relief], ['flood', 'waves', Flood], ['cover', 'radio', Cover], ['suit', 'pin', Suit],
  ['signals', 'warning', Signals], ['method', 'book', Method],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const DEF_SP = { maxSlope: 4, stage: 5, roadKm: 1, target: 'far' };

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const stage = Number(q.w);
  return {
    view: PAGES[view] ? view : 'relief',
    stage: stage >= 0 && stage <= 10 ? Math.round(stage * 5) / 5 : 3,
    kind: q.k === 'tower' ? 'tower' : 'siren',
    smode: ['existing', 'best', 'pick'].includes(q.s) ? q.s : 'existing',
    sig: SIGNALS.includes(q.sig) ? q.sig : null,
    map: q.map === '1',
  };
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const initial = useMemo(parseHash, []);
  const T3 = useMemo(buildTerrain, []);
  const gl = useMemo(webglOk, []);

  const [view, setView] = useState(initial.view);
  const [mode3d, setMode3d] = useState(!initial.map);
  const [exag, setExag] = useState(14);
  const [stage, setStage] = useState(initial.stage);
  const [kind, setKind] = useState(initial.kind);
  const [smode, setSmode] = useState(initial.kind === 'tower' && initial.smode === 'existing' ? 'best' : initial.smode);
  const [k, setK] = useState(3);
  const [picked, setPicked] = useState([]);
  const [sp, setSp] = useState(DEF_SP);
  const [sig, setSig] = useState(initial.sig);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const parts = [view];
    if (view === 'flood' && stage !== 3) parts.push('w=' + stage);
    if (view === 'cover') { if (kind !== 'siren') parts.push('k=' + kind); if (smode !== 'existing') parts.push('s=' + smode); }
    if (view === 'signals' && sig) parts.push('sig=' + sig);
    if (!mode3d) parts.push('map=1');
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, stage, kind, smode, sig, mode3d]);
  useEffect(() => {
    const on = () => { const h = parseHash(); setView(h.view); setStage(h.stage); setKind(h.kind); setSmode(h.smode); setSig(h.sig); setMode3d(!h.map); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`; }, [view]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const go = (id, patch = {}) => {
    if (patch.stage != null) setStage(Math.round(patch.stage * 5) / 5);
    if (patch.kind) setKind(patch.kind);
    if (patch.smode) setSmode(patch.smode);
    navigate(id);
  };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  // Назва населеного пункту: для районів міста в англійській «Velyka Ruta, North»; short: без назви міста
  const placeName = (p, short) => (short && p.id === 'vrc' ? T.townName : p.kind === 'district' ? (short ? (lang === 'uk' ? p.name.uk.replace('Велика Рута, ', '') : T.district[p.district]) : lang === 'uk' ? p.name.uk : T.townName + ', ' + T.district[p.district]) : lang === 'uk' ? p.name.uk : p.name.lat);
  const nodeName = id => (T3.byId.has(id) ? placeName(T3.byId.get(id)) : T.junction[id] || id);
  const exportCsv = () => {
    const st = floodStageOf(T3);
    const sir = coverage(T3, 'siren', EXISTING_SIRENS.map(id => T3.byId.get(id).cell));
    const rows = [['id', 'name_uk', 'name_lat', 'kind', 'x_km', 'y_km', 'population', 'elevation_m', 'flood_from_m', 'siren_audible'],
      ...T3.places.map(p => [p.id, p.name.uk, p.name.lat, p.kind, p.x, p.y, p.pop, p.h.toFixed(1), st.has(p.id) ? st.get(p.id) : '', sir.covered.includes(p) ? 1 : 0])];
    download('BC_terrain_settlements.csv', rows.map(r => r.map(v => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\n'));
    notify(T.method.csvDone);
  };

  const ctx = { T, f, lang, T3, gl, view, mode3d, setMode3d, exag, setExag, stage, setStage, kind, setKind, smode, setSmode, k, setK, picked, setPicked, sp, setSp, sig, setSig, go, navigate, notify, placeName, nodeName, exportCsv };
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
            <p>{T.leads[view]}</p>
          </div>
          <div className="hero-art terrain-art" aria-hidden="true">
            <svg viewBox="0 0 260 170">
              {[0, 1, 2, 3, 4, 5].map(i => <path key={i} className="ta-line" style={{ animationDelay: i * 0.25 + 's' }} d={`M10 ${130 - i * 14} C60 ${110 - i * 16 - (i % 2) * 10} 100 ${128 - i * 12} 140 ${112 - i * 15} S220 ${100 - i * 14} 250 ${118 - i * 15}`} />)}
              <path className="ta-water" d="M10 138 C70 134 120 140 160 136 S230 132 250 138" />
              <circle className="ta-dot" cx="182" cy="62" r="4.5" />
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
          <p>{T.dataNote}</p>
          <div className="foot-actions">
            <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => setLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="terrain-demo" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
