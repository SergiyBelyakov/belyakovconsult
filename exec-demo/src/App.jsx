import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { dataFor, signals, SIGNALS, DRIVERS, DRIVER_RANGE, IND, MONTHS, LAST } from './model.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Select, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import Overview from './pages/Overview.jsx';
import Finance from './pages/Finance.jsx';
import People from './pages/People.jsx';
import Operations from './pages/Operations.jsx';
import Risks from './pages/Risks.jsx';
import Scenarios from './pages/Scenarios.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [
  ['overview', 'grid', Overview], ['finance', 'coins', Finance], ['people', 'users', People], ['operations', 'factory', Operations],
  ['risks', 'warning', Risks], ['scenarios', 'flask', Scenarios], ['method', 'book', Method],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const ind = IND.includes(q.ind) ? q.ind : 'mfg';
  const D = dataFor(ind);
  const drv = {};
  (q.d || '').split(',').forEach(p => {
    const [k, v] = p.split(':'), n = Number(v);
    if (DRIVERS.includes(k) && Number.isFinite(n) && n >= DRIVER_RANGE[k][0] && n <= DRIVER_RANGE[k][1]) drv[k] = n;
  });
  const m = MONTHS.indexOf(q.m);
  return {
    view: PAGES[view] ? view : 'overview',
    ind,
    unit: q.u && D.units.some(u => u.id === q.u) ? q.u : 'all',
    i: m >= 0 ? m : LAST,
    sig: SIGNALS.some(s => s.id === q.sig) ? q.sig : null,
    drv,
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

  const [view, setView] = useState(initial.view);
  const [ind, setIndState] = useState(initial.ind);
  const [unit, setUnit] = useState(initial.unit);
  const [i, setI] = useState(initial.i);
  const [sig, setSig] = useState(initial.sig);
  const [drv, setDrv] = useState(initial.drv);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const D = dataFor(ind);
  const S = useMemo(() => signals(D, ind, i), [ind, i]);

  useEffect(() => {
    const parts = [view];
    if (ind !== 'mfg') parts.push('ind=' + ind);
    if (unit !== 'all' && ['finance', 'people', 'operations'].includes(view)) parts.push('u=' + unit);
    if (i !== LAST && view !== 'scenarios' && view !== 'method') parts.push('m=' + MONTHS[i]);
    if (view === 'risks' && sig) parts.push('sig=' + sig);
    if (view === 'scenarios') { const d = DRIVERS.filter(k => drv[k]).map(k => k + ':' + drv[k]); if (d.length) parts.push('d=' + d.join(',')); }
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, ind, unit, i, sig, drv]);
  useEffect(() => {
    const on = () => { const h = parseHash(); setView(h.view); setIndState(h.ind); setUnit(h.unit); setI(h.i); setSig(h.sig); setDrv(h.drv); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`; }, [view]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const setInd = v => { if (v === ind) return; setIndState(v); setUnit('all'); setSig(null); setDrv({}); };
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const go = (id, patch = {}) => {
    if (patch.unit) setUnit(patch.unit);
    if (patch.sig) setSig(patch.sig);
    navigate(id);
  };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  const unitName = id => T.units[ind][id];
  const exportCsv = () => {
    const keys = ['rev', 'revPlan', 'cogs', 'cogsPlan', 'payroll', 'payrollPlan', 'other', 'otherPlan', 'hc', 'hcPlan', 'hires', 'exits', 'vol', 'vacancies', 'vacDays', 'overtime', 'sick', 'training',
      ...(ind === 'mfg' ? ['output', 'cap', 'oee', 'defect', 'otd', 'downtime'] : ['clients', 'ticket', 'nps', 'wait', 'util', 'repeat'])];
    const rows = [['month', 'unit', ...keys]];
    D.units.forEach(u => u.rows.forEach(r => rows.push([r.m, u.id, ...keys.map(k => r[k])])));
    download(`BC_executive_${ind}_units.csv`, csv(rows));
    const co = [['month', 'revenue', 'ebitda', 'dso', 'receivables', 'overdue_60plus', 'cash', 'debt'], ...D.company.map(c => [c.m, c.rev, c.ebitda, c.dso, c.ar, c.aging[2] + c.aging[3], c.cash, c.debt])];
    setTimeout(() => download(`BC_executive_${ind}_company.csv`, csv(co)), 400);
    notify(T.method.csvDone);
  };

  const ctx = { T, f, lang, ind, setInd, D, unit, setUnit, i, setI, sig, setSig, drv, setDrv, S, go, navigate, notify, unitName, exportCsv, openLead: w => setLead(w) };
  const Page = PAGES[view];
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const critical = SIGNALS.reduce((a, s) => a + S[s.id].filter(x => x.level === 'critical').length, 0);
  const lead_ = T.leads[view].replace('{company}', T.company[ind]).replace('{ops}', T.opsList[ind]);

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
              {id === 'risks' && critical > 0 && <em className="nav-count">{f.int(critical)}</em>}
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
          <Segmented value={ind} onChange={setInd} label={T.industryLabel} options={IND.map(x => ({ value: x, label: T.industry[x] }))} />
          <Select value={String(i)} onChange={v => setI(Number(v))} label={T.monthLabel} options={MONTHS.map((m, k) => ({ value: String(k), label: f.month(m, true) })).reverse()} />
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
            <p>{lead_}</p>
          </div>
          <div className="hero-art exec-art" aria-hidden="true">
            <svg viewBox="0 0 260 170">
              <path className="ea-plan" d="M14 112 L70 96 L126 86 L182 70 L246 52" />
              <rect className="ea-bar" x="34" y="104" width="26" height="50" rx="3" />
              <rect className="ea-bar" x="90" y="92" width="26" height="62" rx="3" />
              <rect className="ea-bar" x="146" y="86" width="26" height="68" rx="3" />
              <rect className="ea-bar ea-last" x="202" y="96" width="26" height="58" rx="3" />
              <path className="ea-line" d="M14 128 C50 120 80 104 110 100 S170 78 200 86 S236 98 252 92" />
              <circle className="ea-pulse" cx="215" cy="88" r="7" />
              <circle className="ea-dot" cx="215" cy="88" r="4.5" />
            </svg>
          </div>
        </section>

        <div className="page" key={view + ind}>
          <Page ctx={ctx} />
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote.replace('{company}', T.companyShort[ind])}</p>
          <div className="foot-actions">
            <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => setLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="executive-demo" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
