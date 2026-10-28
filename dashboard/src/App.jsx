import { useEffect, useMemo, useRef, useState } from 'react';
import { DOMAINS, REGIONS, DEFAULT_TARGET, demoRows, filterRows, label, parseCSV, pct, statusQuality, toCSV } from './data.js';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { buildModel } from './model.js';
import { Icon } from './icons.jsx';
import { Button, Empty, Modal, Segmented, Select, Status, Toast } from './ui.jsx';
import { LeadModal } from './lead.jsx';
import { C } from './charts.jsx';
import { buildPdf } from './pdf.js';
import Overview from './pages/Overview.jsx';
import Analytics from './pages/Analytics.jsx';
import Quality from './pages/Quality.jsx';
import Sources from './pages/Sources.jsx';
import Reports, { SECTION_IDS } from './pages/Reports.jsx';
import Appearance, { DEFAULT_LOOK } from './pages/Appearance.jsx';

const VIEWS = [
  ['overview', 'grid', Overview], ['analytics', 'chart', Analytics], ['quality', 'shield', Quality],
  ['sources', 'database', Sources], ['reports', 'report', Reports], ['appearance', 'sliders', Appearance],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const DEFAULT_FILTERS = { period: 12, region: 'all', domain: 'all', search: '' };

function readHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => p.split('=')).filter(p => p.length === 2));
  const filters = { ...DEFAULT_FILTERS };
  if ([12, 6, 3].includes(Number(q.period))) filters.period = Number(q.period);
  if (REGIONS.some(r => r.id === q.region)) filters.region = q.region;
  if (DOMAINS.some(d => d.id === q.domain)) filters.domain = q.domain;
  return { view: PAGES[view] ? view : 'overview', filters };
}

function writeHash(view, filters) {
  const parts = [view];
  if (filters.period !== 12) parts.push('period=' + filters.period);
  if (filters.region !== 'all') parts.push('region=' + filters.region);
  if (filters.domain !== 'all') parts.push('domain=' + filters.domain);
  const h = '#' + parts.join('&');
  if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватний режим */ } },
};

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function App({ initialLang, base, onSite }) {
  const initial = useMemo(readHash, []);
  const [lang, setLang] = useState(initialLang);
  const [view, setView] = useState(initial.view);
  const [filters, setFilters] = useState(initial.filters);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [all, setAll] = useState(demoRows);
  const [uploaded, setUploaded] = useState(false);
  const [look, setLookState] = useState(() => store.get('bc-dashboard-look', DEFAULT_LOOK));
  const [modal, setModal] = useState(null);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [report, setReport] = useState(() => ({ title: '', sections: Object.fromEntries(SECTION_IDS.map(id => [id, id !== 'detail'])) }));
  const fileRef = useRef(null);
  const toastTimer = useRef(null);

  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(lang), [lang]);
  const rows = useMemo(() => filterRows(all, filters, lang), [all, filters, lang]);
  const periodRows = useMemo(() => filterRows(all, { ...filters, region: 'all', domain: 'all' }, lang), [all, filters.period, filters.search, lang]);
  const m = useMemo(() => buildModel(rows, target, periodRows), [rows, target, periodRows]);

  useEffect(() => { writeHash(view, filters); }, [view, filters]);
  useEffect(() => {
    const on = () => { const h = readHash(); setView(h.view); setFilters(h.filters); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demo} | Belyakov Consult`; }, [view, lang]);

  const setLook = v => { setLookState(v); store.set('bc-dashboard-look', v); };
  const notify = (text, extra = {}) => {
    setToast({ text, ...extra });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), extra.action ? 9000 : 4200);
  };
  const setFilter = patch => setFilters(prev => ({ ...prev, ...patch }));
  const navigate = id => {
    setView(id); setMenu(false);
    window.scrollTo({ top: 0, behavior: look.motion ? 'smooth' : 'auto' });
  };
  const go = (id, patch = {}) => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v));
    if (Object.keys(clean).length) setFilter(clean);
    navigate(id);
  };
  const switchLang = id => {
    if (id === lang) return;
    if (onSite) {
      const cur = LANGS.find(l => l.id === lang).prefix;
      const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
      location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
      return;
    }
    setLang(id);
  };

  const exportCSV = () => {
    download(`BC_dashboard_${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
    notify(T.csvDone, { icon: 'download' });
  };
  const sampleCSV = () => download('BC_dashboard_sample.csv', '﻿' + toCSV(demoRows()), 'text/csv;charset=utf-8');
  const importCSV = () => fileRef.current && fileRef.current.click();
  const onFile = file => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = parseCSV(fr.result);
        setAll(parsed); setUploaded(true); setFilters(DEFAULT_FILTERS);
        notify(T.csvOk, { icon: 'check' });
      } catch {
        notify(T.csvFail, { icon: 'warning' });
      }
    };
    fr.readAsText(file);
    fileRef.current.value = '';
  };
  const restoreDemo = () => { setAll(demoRows()); setUploaded(false); setFilters(DEFAULT_FILTERS); };
  const openLead = where => { setLead(where); setToast(null); };

  const ctx = {
    T, f, lang, m, filters, setFilter, target, setTarget, go, navigate, setModal, notify, look, setLook, switchLang,
    exportCSV, importCSV, sampleCSV, restoreDemo, uploaded, openLead, report, setReport, pdfBusy,
    langPrefix: LANGS.find(l => l.id === lang).prefix,
    openMetric: id => setModal({ type: 'metric', id }),
  };
  ctx.makePdf = async () => {
    setPdfBusy(true);
    try {
      await buildPdf(ctx, base);
      notify(T.afterPdf, { icon: 'check', action: T.ctaSideButton });
    } catch (e) {
      console.error(e);
      notify(T.pdfFail, { icon: 'warning' });
    } finally {
      setPdfBusy(false);
    }
  };

  const Page = PAGES[view];
  const needsRows = view !== 'reports' && view !== 'appearance';
  const style = {
    '--glass-a': (0.92 - (look.glass / 100) * 0.7).toFixed(3),
    '--glow-a': (look.glow / 100).toFixed(2),
  };

  return (
    <div className={'app' + (look.motion ? ' motion' : '')} style={style}>
      <div className="bg" aria-hidden="true">
        <div className="bg-wave" />
        <div className="bg-grid" />
        <div className="bg-glow g1" />
        <div className="bg-glow g2" />
      </div>

      <aside className={'sidebar glass' + (menu ? ' open' : '')} aria-label={T.navCaption}>
        <a className="side-brand" href={onSite ? (ctx.langPrefix || '') + '/' : 'https://www.belyakovconsult.com/'} aria-label="Belyakov Consult">
          <img src={base + 'img/bc-negative.png'} alt="BC." width="102" height="52" />
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
          <Button kind="primary" onClick={() => openLead('sidebar')}>{T.ctaSideButton}</Button>
        </div>
        <a className="side-back" href={onSite ? (ctx.langPrefix || '') + '/cases/' : 'https://www.belyakovconsult.com/cases/'}>
          <Icon name="back" size={14} />belyakovconsult.com
        </a>
      </aside>
      {menu && <button type="button" className="scrim" aria-label={T.close} onClick={() => setMenu(false)} />}

      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label={T.menu} aria-expanded={menu}><Icon name="menu" size={20} /></button>
          <label className="search glass-control">
            <Icon name="search" size={17} />
            <input type="search" value={filters.search} placeholder={T.search} aria-label={T.search} onChange={e => setFilter({ search: e.target.value })} />
            {filters.search && <button type="button" className="icon-btn" onClick={() => setFilter({ search: '' })} aria-label={T.reset}><Icon name="x" size={14} /></button>}
          </label>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language_} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button icon="pdf" className="hide-sm" onClick={() => navigate('reports')}>{T.pdfShort}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => openLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view]}</p>
          </div>
          <div className="hero-art" aria-hidden="true"><i /><i /><i /></div>
        </section>

        {view !== 'appearance' && (
          <div className="filters">
            <Segmented value={filters.period} onChange={v => setFilter({ period: v })} label={T.periodLabel}
              options={[12, 6, 3].map(n => ({ value: n, label: T.periods[n] }))} />
            <Select value={filters.region} onChange={v => setFilter({ region: v })} label={T.cols.region}
              options={[{ value: 'all', label: T.allRegions }, ...REGIONS.map(r => ({ value: r.id, label: r[lang] }))]} />
            <Select value={filters.domain} onChange={v => setFilter({ domain: v })} label={T.cols.domain}
              options={[{ value: 'all', label: T.allDomains }, ...DOMAINS.map(d => ({ value: d.id, label: d[lang] }))]} />
            {(filters.region !== 'all' || filters.domain !== 'all' || filters.period !== 12 || filters.search) &&
              <Button icon="reset" onClick={() => setFilters(DEFAULT_FILTERS)}>{T.reset}</Button>}
            {uploaded && <span className="own-data-pill"><Icon name="file" size={14} />CSV</span>}
          </div>
        )}

        <div className="page" key={view}>
          {needsRows && !rows.length ? <Empty T={T} onReset={() => setFilters(DEFAULT_FILTERS)} /> : <Page ctx={ctx} />}
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={base + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote}</p>
          <div className="foot-actions">
            <Button icon="upload" onClick={importCSV}>{T.csvImport}</Button>
            <Button icon="pdf" onClick={() => navigate('reports')}>{T.pdfShort}</Button>
            <Button kind="primary" onClick={() => openLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e => onFile(e.target.files[0])} />
      {modal && <Details modal={modal} ctx={ctx} onClose={() => setModal(null)} />}
      {lead && <LeadModal T={T} lang={lang} where={lead} onClose={() => setLead(null)} />}
      <Toast toast={toast} onAction={() => openLead('after-pdf')} />
    </div>
  );
}

function Details({ modal, ctx, onClose }) {
  const { T, f, lang, m } = ctx;
  if (modal.type === 'row') {
    const r = modal.row, q = pct(r.valid, r.processed);
    const items = [
      [T.cols.month, f.monthLong(r.month)], [T.cols.region, label(REGIONS, r.region, lang)], [T.cols.domain, label(DOMAINS, r.domain, lang)],
      [T.cols.processed, f.int(r.processed)], [T.cols.valid, f.int(r.valid)], [T.cols.quality, f.pct(q)],
      [T.cols.incidents, f.int(r.incidents)], [T.cols.latency, f.ms(r.latency)], [T.cols.availability, f.pct(r.availability)],
    ];
    return (
      <Modal title={`${label(REGIONS, r.region, lang)} · ${label(DOMAINS, r.domain, lang)}`} onClose={onClose} T={T}>
        <div className="detail-top"><span className="detail-big">{f.pct(q)}</span><Status level={statusQuality(q, m.target)} T={T} /></div>
        <dl className="detail-list">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <div className="modal-actions">
          <Button onClick={() => { ctx.setFilter({ region: r.region, domain: r.domain }); onClose(); }}>{T.details}</Button>
          <Button kind="primary" onClick={onClose}>{T.close}</Button>
        </div>
      </Modal>
    );
  }
  const id = modal.id;
  const t = m.t;
  const value = { processed: f.int(t.vol), quality: f.pct(t.quality), availability: f.pct(t.avail), incidents: f.int(t.inc) }[id];
  const formula = { processed: 0, quality: 1, availability: 2, incidents: 3 }[id];
  const by = m.domains.filter(d => d.rows).map(d => ({ d, v: { processed: d.vol, quality: d.quality, availability: d.avail, incidents: d.inc }[id] }));
  const max = Math.max(...by.map(x => x.v), 1);
  const fmt = v => (id === 'quality' || id === 'availability' ? f.pct(v) : f.int(v));
  return (
    <Modal title={T.kpi[id]} onClose={onClose} T={T}>
      <div className="detail-top"><span className="detail-big">{value}</span></div>
      <p className="detail-formula">{T.pdf.method[formula].replace('{sla}', f.dec1(m.sla.availability)).replace('{target}', f.dec1(m.target))}</p>
      <div className="detail-bars">
        {by.map(({ d, v }) => (
          <div key={d.id} className="detail-bar">
            <span><i style={{ background: C.series[d.id] }} />{label(DOMAINS, d.id, lang)}</span>
            {id === 'quality' || id === 'availability'
              ? <b>{fmt(v)}</b>
              : <><span className="detail-track"><i style={{ width: (v / max) * 100 + '%' }} /></span><b>{fmt(v)}</b></>}
          </div>
        ))}
      </div>
      <div className="modal-actions"><Button kind="primary" onClick={onClose}>{T.close}</Button></div>
    </Modal>
  );
}

