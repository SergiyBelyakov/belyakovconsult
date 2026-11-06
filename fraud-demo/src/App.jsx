import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { build, thresholdFor, MODELS } from './model.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import Overview from './pages/Overview.jsx';
import Scoring from './pages/Scoring.jsx';
import Queue from './pages/Queue.jsx';
import Schemes from './pages/Schemes.jsx';
import Fairness from './pages/Fairness.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [
  ['overview', 'grid', Overview], ['scoring', 'target', Scoring], ['queue', 'search', Queue], ['schemes', 'layers', Schemes],
  ['fairness', 'scale', Fairness], ['method', 'book', Method],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const cap = Number(q.cap);
  return {
    view: PAGES[view] ? view : 'overview',
    model: MODELS.includes(q.m) ? q.m : 'logit',
    cap: cap >= 0.005 && cap <= 0.1 ? Math.round(cap * 200) / 200 : 0.03,
    caseId: /^R-\d{6}$/.test(q.case || '') ? q.case : null,
    cluster: /^C\d+$/.test(q.c || '') ? q.c : null,
    truth: q.truth === '1',
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
  const initial = useMemo(parseHash, []);
  const B = useMemo(build, []);

  const [view, setView] = useState(initial.view);
  const [model, setModel] = useState(initial.model);
  const [cap, setCap] = useState(initial.cap);
  const [caseId, setCaseId] = useState(initial.caseId);
  const [cluster, setCluster] = useState(initial.cluster);
  const [truth, setTruth] = useState(initial.truth);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const th = useMemo(() => thresholdFor(B.rows, model, cap), [model, cap]);

  useEffect(() => {
    const parts = [view];
    if (model !== 'logit') parts.push('m=' + model);
    if (cap !== 0.03) parts.push('cap=' + cap);
    if (view === 'queue' && caseId) parts.push('case=' + caseId);
    if (view === 'schemes' && cluster) parts.push('c=' + cluster);
    if (truth && (view === 'queue' || view === 'schemes')) parts.push('truth=1');
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, model, cap, caseId, cluster, truth]);
  useEffect(() => {
    const on = () => { const h = parseHash(); setView(h.view); setModel(h.model); setCap(h.cap); setCaseId(h.caseId); setCluster(h.cluster); setTruth(h.truth); };
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
  const go = id => navigate(id);
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  const exportCsv = () => {
    const head = ['id', 'district', 'program', 'amount', 'months', 'age', 'children', 'idp', 'collective', 'channel', 'night', 'operator', 'doc_min', 'shared_iban', 'shared_phone', 'shared_addr', 'tax_ratio', 'abroad_days', 'death_hit', 'double_programme', 'score_rules', 'score_logit', 'score_combined', 'sample', 'investigated_scheme'];
    const rows = [head, ...B.rows.map(x => [x.id, x.district, x.program, x.amount, x.months, x.age, x.children, x.idp ? 1 : 0, x.collective ? 1 : 0, x.channel, x.night ? 1 : 0, x.operator, x.docMin, x.sharedIban, x.sharedPhone, x.sharedAddr, x.taxRatio, x.abroad, x.deathM > 0 ? 1 : 0, x.dup ? 1 : 0,
      x.score.rules.toFixed(4), x.score.logit.toFixed(4), x.score.combo.toFixed(4), x.test ? 'test' : 'train', x.scheme || ''])];
    download('BC_fraud_scores.csv', csv(rows));
    notify(T.method.csvDone);
  };

  const ctx = { T, f, lang, B, model, setModel, cap, setCap, th, caseId, setCaseId, cluster, setCluster, truth, setTruth, go, navigate, notify, exportCsv, openLead: w => setLead(w) };
  const Page = PAGES[view];
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const queued = B.rows.filter(x => x.score[model] >= th).length;

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
              {id === 'queue' && <em className="nav-count">{f.int(queued)}</em>}
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
          <div className="hero-art fraud-art" aria-hidden="true">
            <svg viewBox="0 0 260 170">
              {Array.from({ length: 48 }, (_, k) => { const x = 20 + (k % 12) * 20, y = 30 + Math.floor(k / 12) * 30, hot = [5, 17, 18, 30, 41].includes(k); return <circle key={k} cx={x} cy={y} r={hot ? 5 : 3.2} className={hot ? 'fa-hot' : 'fa-dot'} />; })}
              <path className="fa-link" d="M120 30 L140 60 L120 60 M140 60 L140 90 L240 120" />
              <rect className="fa-scan" x="10" y="14" width="3" height="128" rx="1.5" />
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

      {lead && <LeadModal T={T} lang={lang} where={lead} source="fraud-demo" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
