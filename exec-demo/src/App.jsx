// Каркас панелі керівника: три рівні (що відбувається → чому → що робити), спільні фільтри,
// стан у посиланні, палітра команд, повноекранний режим, панель «Пояснити зміну» та екскурсія.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { dataFor, signals, SIGNALS, IND, MONTHS, LAST } from './model.js';
import { LEVERS, LEVER_RANGE, PRESETS, CEO } from './sim.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Select, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import { CommandPalette, Tour, LevelSteps, Drawer } from './parts.jsx';
import { track } from './track.js';
import Overview from './pages/Overview.jsx';
import Causes from './pages/Causes.jsx';
import Finance from './pages/Finance.jsx';
import Cash from './pages/Cash.jsx';
import People from './pages/People.jsx';
import Operations from './pages/Operations.jsx';
import Risks from './pages/Risks.jsx';
import Links from './pages/Links.jsx';
import Scenarios from './pages/Scenarios.jsx';
import Ceo from './pages/Ceo.jsx';
import Method from './pages/Method.jsx';
import ExplainBody from './pages/Explain.jsx';

const VIEWS = [
  ['overview', 'grid', Overview, 0], ['causes', 'tree', Causes, 1], ['finance', 'coins', Finance, 1], ['cash', 'wallet', Cash, 1],
  ['people', 'users', People, 1], ['operations', 'factory', Operations, 1], ['risks', 'warning', Risks, 1], ['links', 'graph', Links, 1],
  ['scenarios', 'flask', Scenarios, 2], ['ceo', 'target', Ceo, 2], ['method', 'book', Method, 3],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const LEVEL = Object.fromEntries(VIEWS.map(([id, , , l]) => [id, l]));
const UNIT_VIEWS = ['overview', 'causes', 'finance', 'people', 'operations', 'links', 'scenarios'];
const TOUR = [
  { id: 'kpis', view: 'overview', sel: '.hk-grid' },
  { id: 'attention', view: 'overview', sel: '.attention' },
  { id: 'tree', view: 'causes', sel: '.dtree-panel' },
  { id: 'levers', view: 'scenarios', sel: '.levers-panel' },
  { id: 'matrix', view: 'scenarios', sel: '.matrix-panel' },
  { id: 'ceo', view: 'ceo', sel: '.ceo-intro' },
];
const OLD = { other: 'opex' };                       // ключі старих посилань на сценарії

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const ind = IND.includes(q.ind) ? q.ind : 'mfg';
  const D = dataFor(ind);
  const drv = {};
  (q.d || '').split(',').forEach(p => {
    const [k0, v] = p.split(':'), k = OLD[k0] || k0, n = Number(v);
    if (LEVERS.includes(k) && Number.isFinite(n)) drv[k] = Math.max(LEVER_RANGE[k][0], Math.min(LEVER_RANGE[k][1], Math.round(n)));
  });
  const presets = (q.p || '').split(',').filter(id => PRESETS[ind].some(p => p.id === id));
  const ct = {};
  (q.ct || '').split(',').forEach(p => { const [k, v] = p.split(':'), n = Number(v); if (['lead', 'rest', 'dpo'].includes(k) && Number.isFinite(n)) ct[k] = n; });
  const ch = (q.c || '').split(',');
  const choices = CEO.map((p, k) => (p.options.some(o => o.id === ch[k]) ? ch[k] : null));
  let step = Math.max(0, Math.min(4, Number(q.step) || 0));
  if (step === 4 && choices.some(c => !c)) step = 0;
  const m = MONTHS.indexOf(q.m);
  return {
    view: PAGES[view] ? view : 'overview',
    ind,
    unit: q.u && D.units.some(u => u.id === q.u) ? q.u : 'all',
    i: m >= 0 ? m : LAST,
    sig: SIGNALS.some(s => s.id === q.sig) ? q.sig : null,
    drv, presets, ct,
    node: q.node || null, per: q.per === 'm' ? 'm' : 'ytd', fl: q.fl != null && q.fl !== '' ? Math.max(0, Math.min(4, Number(q.fl) || 0)) : null,
    sel: q.sel || null,
    ceo: { step, choices, started: step >= 1 && step <= 3 ? Date.now() : null },
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
  const [unit, setUnitState] = useState(initial.unit);
  const [i, setI] = useState(initial.i);
  const [sig, setSig] = useState(initial.sig);
  const [drv, setDrv] = useState(initial.drv);
  const [presets, setPresets] = useState(initial.presets);
  const [cashTerms, setCashTerms] = useState(initial.ct);
  const [causeNode, setCauseNode] = useState(initial.node);
  const [causeFocus, setCauseFocus] = useState(initial.fl);
  const [per, setPer] = useState(initial.per);
  const [linkSel, setLinkSel] = useState(initial.sel);
  const [ceo, setCeo] = useState(initial.ceo);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const [palette, setPalette] = useState(false);
  const [explainOpen, setExplainOpen] = useState(null);
  const [tour, setTour] = useState(null);
  const [full, setFull] = useState(false);
  const toastTimer = useRef(null);
  const prevLevel = useRef(LEVEL[initial.view]);
  const D = dataFor(ind);
  const S = useMemo(() => signals(D, ind, i), [ind, i]);

  // стан у посиланні: його можна надіслати колезі, і він відкриє ту саму картину
  useEffect(() => {
    const parts = [view];
    if (ind !== 'mfg') parts.push('ind=' + ind);
    if (unit !== 'all' && UNIT_VIEWS.includes(view)) parts.push('u=' + unit);
    if (i !== LAST && !['method', 'ceo'].includes(view)) parts.push('m=' + MONTHS[i]);
    if (view === 'risks' && sig) parts.push('sig=' + sig);
    if (view === 'causes') { if (per !== 'ytd') parts.push('per=' + per); if (causeNode) parts.push('node=' + causeNode); if (causeFocus != null) parts.push('fl=' + causeFocus); }
    if (view === 'cash') { const c = ['lead', 'rest', 'dpo'].filter(k => cashTerms[k]).map(k => k + ':' + cashTerms[k]); if (c.length) parts.push('ct=' + c.join(',')); }
    if (view === 'links' && linkSel) parts.push('sel=' + linkSel);
    if (view === 'scenarios') { const d = LEVERS.filter(k => drv[k]).map(k => k + ':' + drv[k]); if (presets.length) parts.push('p=' + presets.join(',')); if (d.length) parts.push('d=' + d.join(',')); }
    if (view === 'ceo' && ceo.step) { parts.push('step=' + ceo.step); if (ceo.choices.some(Boolean)) parts.push('c=' + ceo.choices.map(c => c || '').join(',')); }
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, ind, unit, i, sig, drv, presets, per, causeNode, causeFocus, cashTerms, linkSel, ceo]);
  useEffect(() => {
    const on = () => {
      const h = parseHash();
      setView(h.view); setIndState(h.ind); setUnitState(h.unit); setI(h.i); setSig(h.sig); setDrv(h.drv); setPresets(h.presets); setCashTerms(h.ct);
      setCauseNode(h.node); setCauseFocus(h.fl); setPer(h.per); setLinkSel(h.sel); setCeo(h.ceo);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`; track('view', { view }); }, [view]);
  useEffect(() => { prevLevel.current = LEVEL[view]; }, [view]);
  // палітра команд: Ctrl/⌘+K або «/»
  useEffect(() => {
    const k = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); }
      else if (e.key === '/' && !typing && !palette) { e.preventDefault(); setPalette(true); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [palette]);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const unitName = id => T.units[ind][id];
  const setInd = v => { if (v === ind) return; setIndState(v); setUnitState('all'); setSig(null); setDrv({}); setPresets([]); setCauseNode(null); setCauseFocus(null); setLinkSel(null); setCashTerms({}); };
  const setUnit = (v, say) => {
    setUnitState(v); setCauseNode(null); setCauseFocus(null);
    if (say) notify(T.filterToast(v === 'all' ? T.allUnits : unitName(v)), 'sliders');
  };
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  const go = (id, patch = {}) => {
    if (patch.unit) setUnitState(patch.unit);
    if (patch.sig) setSig(patch.sig);
    navigate(id);
  };
  const openCause = (path, p) => {
    if (p) setPer(p);
    setCauseNode(path && path.length ? path[path.length - 1] : null);
    setCauseFocus(path && path.length ? Math.max(0, path.length - 1) : null);
    navigate('causes');
  };
  const applyPresets = ids => { setPresets(ids); setDrv({}); navigate('scenarios'); track('preset', { ids: ids.join(',') }); };
  const applySliders = d => { setPresets([]); setDrv(d); navigate('scenarios'); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  const toggleFull = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => setFull(x => !x));
    else setFull(x => !x);
    track('fullscreen');
  };
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
  const copyLink = () => { try { navigator.clipboard.writeText(location.href).then(() => notify(T.dec.copied, 'link'), () => notify(location.href, 'link')); } catch { notify(location.href, 'link'); } };
  const openLead = (where, opts = {}) => { setLead({ where, ...opts }); track('lead_open', { where }); };
  const openExplain = (opts = {}) => { setExplainOpen({ per: opts.per || 'm' }); track('explain'); };
  const startTour = () => { setTour(0); track('tour'); };

  const ctx = {
    T, f, lang, ind, setInd, D, unit, setUnit, i, setI, sig, setSig, drv, setDrv, presets, setPresets, S, go, navigate, notify, unitName, exportCsv,
    openLead, openExplain, openCause, applyPresets, applySliders, per, setPer, causePath: null, setCausePath: null, causeFocus, setCauseFocus,
    cashTerms, setCashTerms, linkSel, setLinkSel, ceo, setCeo, startTour, track,
    // виклик CEO веде на самооцінку зрілості даних у Лабораторії
    maturityHref: (onSite ? '' : 'https://www.belyakovconsult.com') + LANGS.find(l => l.id === lang).prefix + '/cases/data-maturity/',
  };
  // шлях дерева причин зберігаємо як найглибший вузол; сторінка відновлює гілку від кореня
  ctx.causePath = causeNode ? causeNode.split('/').map((_, k, a) => a.slice(0, k + 1).join('/')) : null;
  ctx.setCausePath = p => setCauseNode(p && p.length ? p[p.length - 1] : null);

  // палітра команд
  const items = useMemo(() => {
    const out = [];
    VIEWS.forEach(([id, icon, , l]) => out.push({ id: 'v:' + id, group: 'pages', icon, label: T.nav[id], hint: T.navGroups[l], keys: T.palette.pageKeys[id] || '', top: true, run: () => navigate(id) }));
    Object.entries(T.palette.metrics).forEach(([id, m]) => { if (!m.ind || m.ind === ind) out.push({ id: 'm:' + id, group: 'metrics', icon: 'chart', label: m.label, hint: T.nav[m.page], keys: m.keys, run: () => (m.explain ? openExplain({ per: 'm' }) : navigate(m.page)) }); });
    out.push({ id: 'u:all', group: 'units', icon: 'grid', label: T.allUnits, hint: T.unitLabel, run: () => setUnit('all', true) });
    D.units.forEach(u => out.push({ id: 'u:' + u.id, group: 'units', icon: 'sliders', label: unitName(u.id), hint: T.unitLabel, run: () => setUnit(u.id, true) }));
    IND.forEach(x => out.push({ id: 'i:' + x, group: 'units', icon: 'factory', label: T.industry[x], hint: T.industryLabel, run: () => setInd(x) }));
    PRESETS[ind].forEach(p => out.push({ id: 'p:' + p.id, group: 'decisions', icon: 'flask', label: T.presets[ind][p.id], hint: T.nav.scenarios, run: () => applyPresets([p.id]) }));
    SIGNALS.forEach(s => S[s.id].forEach(x => out.push({ id: 's:' + s.id + (x.unit || ''), group: 'signals', icon: 'warning', label: T.signals[s.id].title, hint: x.unit ? unitName(x.unit) : T.companyWide, run: () => { setSig(s.id); navigate('risks'); } })));
    MONTHS.slice(-6).reverse().forEach(m => out.push({ id: 'mo:' + m, group: 'actions', icon: 'clock', label: T.palette.month(f.month(m, true)), keys: m, run: () => setI(MONTHS.indexOf(m)) }));
    const acts = [
      ['explain', 'bulb', T.explain.button + ': EBITDA', () => openExplain({ per: 'm' })],
      ['ceo', 'target', T.ceo.start, () => navigate('ceo')],
      ['tour', 'play', T.tour.start, startTour],
      ['full', full ? 'shrink' : 'expand', full ? T.fullExit : T.fullEnter, toggleFull],
      ['link', 'link', T.palette.copyLink, copyLink],
      ['csv', 'download', T.method.csv, exportCsv],
      ['lang', 'globe', lang === 'uk' ? 'English' : 'Українська', () => switchLang(lang === 'uk' ? 'en' : 'uk')],
      ['reset', 'reset', T.palette.reset, () => { setUnit('all'); setI(LAST); setDrv({}); setPresets([]); setCashTerms({}); }],
      ['lead', 'mail', T.cta, () => openLead('palette')],
    ];
    acts.forEach(([id, icon, label, run]) => out.push({ id: 'a:' + id, group: 'actions', icon, label, top: ['explain', 'ceo', 'full'].includes(id), run }));
    return out;
  }, [lang, ind, i, S, full, unit]);

  const level = LEVEL[view];
  const dir = level > prevLevel.current ? 'deeper' : level < prevLevel.current ? 'up' : 'same';
  const Page = PAGES[view];
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const critical = SIGNALS.reduce((a, s) => a + S[s.id].filter(x => x.level === 'critical').length, 0);
  const lead_ = T.leads[view].replace('{company}', T.company[ind]).replace('{ops}', T.opsList[ind]);
  const leadT = lead && lead.kind === 'maturity' ? { ...T, lead: { ...T.lead, ...T.leadMaturity } } : T;
  const unitOpts = [{ value: 'all', label: T.allUnits }, ...D.units.map(u => ({ value: u.id, label: unitName(u.id) }))];
  const groups = [0, 1, 2, 3];

  return (
    <div className={'app motion' + (full ? ' is-full' : '')}>
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
        <nav>
          {groups.map(g => (
            <div key={g} className="nav-group">
              <p className="nav-caption">{T.navGroups[g]}</p>
              {VIEWS.filter(v => v[3] === g).map(([id, icon]) => (
                <a key={id} href={'#' + id} className={'nav-item' + (view === id ? ' active' : '')} aria-current={view === id ? 'page' : undefined}
                  onClick={e => { e.preventDefault(); navigate(id); }}>
                  <Icon name={icon} size={18} /><span>{T.nav[id]}</span>
                  {id === 'risks' && critical > 0 && <em className="nav-count" title={T.status.critical}>{f.int(critical)}</em>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-cta">
          <span className="signal-line" />
          <strong>{T.ctaSide}</strong>
          <p>{T.ctaSideText}</p>
          <Button onClick={() => openLead('sidebar')}>{T.ctaSideButton}</Button>
        </div>
        <a className="side-back" href={onSite ? (langPrefix || '') + '/cases/' : 'https://www.belyakovconsult.com/cases/'}>
          <Icon name="back" size={14} />belyakovconsult.com
        </a>
      </aside>
      {menu && <button type="button" className="scrim" aria-label={T.close} onClick={() => setMenu(false)} />}

      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label={T.menu} aria-expanded={menu}><Icon name="menu" size={20} /></button>
          <div className="filters" role="group" aria-label={T.filtersLabel}>
            <Segmented value={ind} onChange={setInd} label={T.industryLabel} options={IND.map(x => ({ value: x, label: T.industry[x] }))} />
            <Select value={unit} onChange={v => setUnit(v, true)} label={T.unitLabel} options={unitOpts} />
            <Select value={String(i)} onChange={v => setI(Number(v))} label={T.monthLabel} options={MONTHS.map((m, k) => ({ value: String(k), label: f.month(m, true) })).reverse()} />
          </div>
          <div className="topbar-right">
            <button type="button" className="btn btn-ghost search-btn" onClick={() => setPalette(true)} aria-label={T.palette.title} title={T.palette.title}><Icon name="search" size={16} /><kbd className="hide-sm">⌘K</kbd></button>
            <button type="button" className="icon-btn full-btn" onClick={toggleFull} aria-label={full ? T.fullExit : T.fullEnter} title={full ? T.fullExit : T.fullEnter}><Icon name={full ? 'shrink' : 'expand'} size={18} /></button>
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => openLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><LevelSteps level={Math.min(level, 2)} T={T} go={navigate} /><span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{lead_}</p>
            {unit !== 'all' && UNIT_VIEWS.includes(view) && (
              <p className="context-line"><Icon name="sliders" size={14} />{T.contextLine(unitName(unit))}<button type="button" className="link-btn" onClick={() => setUnit('all', true)}>{T.clearUnit}</button></p>
            )}
          </div>
          <div className={'hero-art exec-art' + (critical ? ' crit' : '')} aria-hidden="true">
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

        <div className={'page enter-' + dir} key={view + ind}>
          <Page ctx={ctx} />
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote.replace('{company}', T.companyShort[ind])}</p>
          <div className="foot-actions">
            <Button icon="download" onClick={exportCsv}>{T.csvShort}</Button>
            <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => openLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {full && <button type="button" className="full-exit" onClick={toggleFull}><Icon name="shrink" size={16} />{T.fullExit}</button>}
      {explainOpen && (
        <Drawer title={T.explain.title} onClose={() => setExplainOpen(null)} T={T}>
          <ExplainBody ctx={ctx} per={explainOpen.per} setPer={p => setExplainOpen({ per: p })} onClose={() => setExplainOpen(null)} />
        </Drawer>
      )}
      {palette && <CommandPalette items={items} onClose={() => setPalette(false)} T={T} />}
      {tour != null && <Tour steps={TOUR} step={tour} setStep={setTour} onClose={() => setTour(null)} T={T} navigate={navigate} view={view} />}
      {lead && <LeadModal T={leadT} lang={lang} where={lead.where} source="executive-demo" message={lead.message} onClose={() => setLead(null)} onSent={() => track('lead_sent', { where: lead.where })} />}
      <Toast toast={toast} />
    </div>
  );
}
