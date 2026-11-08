import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n-ui.js';
import { TEXTS } from './i18n-types.js';
import { makeFmt } from './format.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import { readFile } from '../../anomaly-demo/src/fileio.js';
import { TYPES, TYPE, GROUPS, defOpts } from './types.js';
import { sample } from './samples.js';
import { sampleMap, labelsFor, build } from './model.js';
import { profileTable, autoMap } from './mapping.js';
import { xlsxBlob, csvBlob, saveBlob } from './xlsx.js';
import Gallery from './pages/Gallery.jsx';
import Detail from './pages/Detail.jsx';
import Choose from './pages/Choose.jsx';
import Own from './pages/Own.jsx';

const NAV = [['gallery', 'gallery'], ['choose', 'compass'], ['own', 'upload']];
const VIEWS = ['gallery', 'chart', 'choose', 'own'];

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const v = VIEWS.includes(view) ? view : 'gallery';
  return { view: v === 'chart' && !TYPE[q.t] ? 'gallery' : v, t: TYPE[q.t] ? q.t : TYPES[0].id, g: GROUPS.includes(q.g) ? q.g : 'all', d: q.d === 'own' ? 'own' : 'sample' };
}
// назва аркуша Excel: без дужок і не довша за 31 символ, обрізана по слову
const sheetName = s => { let t = s.replace(/\s*\(.*?\)\s*/g, ' ').trim(); if (t.length > 31) t = t.slice(0, 31).replace(/\s+\S*$/, ''); return t; };

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang], TT = TEXTS[lang];
  const f = useMemo(() => makeFmt(lang), [lang]);
  const L = useMemo(() => labelsFor(T, lang), [lang]);
  const initial = useMemo(parseHash, []);
  const [view, setView] = useState(initial.view);
  const [typeId, setTypeId] = useState(initial.t);
  const [group, setGroup] = useState(initial.g);
  const [src, setSrc] = useState(initial.d);
  const [own, setOwn] = useState(null);
  const [maps, setMaps] = useState({});
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const fileRef = useRef(null), fileFor = useRef(null);

  // зразки й моделі для мініатюр рахуємо один раз
  const samples = useMemo(() => Object.fromEntries(TYPES.map(t => { const table = sample(t.id, lang); return [t.id, { table, model: build(t, table, sampleMap(t), defOpts(t), L) }]; })), [lang]);

  useEffect(() => {
    const parts = [view];
    if (view === 'chart') { parts.push('t=' + typeId); if (src === 'own' && own) parts.push('d=own'); }
    if (view === 'gallery' && group !== 'all') parts.push('g=' + group);
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, typeId, group, src, own]);
  useEffect(() => {
    const on = () => { const h = parseHash(); setView(h.view); setTypeId(h.t); setGroup(h.g); if (h.d === 'own' && own) setSrc('own'); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [own]);
  const pageTitle = view === 'chart' ? TT[typeId].name : T.titles[view];
  useEffect(() => { document.title = `${pageTitle} · ${T.demoName} | Belyakov Consult`; }, [pageTitle]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const open = (id, d) => { setTypeId(id); if (d) setSrc(d); else if (!own) setSrc('sample'); setView('chart'); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash.replace('&d=own', '');
  };

  // Файл відвідувача: читаємо в браузері, визначаємо типи колонок
  const loadFile = async file => {
    try {
      const { name, rows } = await readFile(file);
      if (!rows || rows.length < 2) { notify(T.err.empty, 'warning'); return null; }
      const head = rows[0].map((h, k) => String(h || '').trim() || `col_${k + 1}`);
      const body = rows.slice(1).map(r => head.map((_, k) => (r[k] == null ? '' : String(r[k]).trim())));
      const o = { name, head, rows: body, cols: profileTable(head, body) };
      setOwn(o); setMaps({});
      return o;
    } catch (e) {
      notify(e && e.message === 'nostream' ? T.err.noStream : T.err.read, 'warning');
      return null;
    }
  };
  const pickFile = async (file, forType) => {
    if (!file) { fileFor.current = forType || null; fileRef.current && fileRef.current.click(); return; }
    const o = await loadFile(file);
    if (!o) return;
    notify(T.d.fileLoaded(o.name, o.rows.length));
    if (forType) { setTypeId(forType); setSrc('own'); setView('chart'); } else if (view !== 'own') { setSrc('own'); }
  };
  const onFileInput = e => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) pickFile(file, fileFor.current); };
  const clearOwn = () => { setOwn(null); setMaps({}); setSrc('sample'); };
  const trySample = () => {
    const s = sample('table', lang);
    const o = { name: lang === 'en' ? 'sample_community_indicators.xlsx' : 'зразок_показники_громад.xlsx', head: s.head, rows: s.rows, cols: profileTable(s.head, s.rows) };
    setOwn(o); setMaps({});
  };
  const setMap = (id, m) => setMaps(x => ({ ...x, [id]: m }));

  // Зразки для завантаження: дані + аркуш з поясненнями колонок
  const explain = t => {
    const tx = TT[t.id], s = samples[t.id].table;
    const rows = t.roles.map((r, i) => [s.head[i], T.roles[r.id], T.kinds[r.kind], r.opt ? T.d.opt : T.d.req, T.roleHint[r.id]]);
    if (t.multi) s.head.slice(t.roles.length).forEach(h => rows.push(t.multi === 'text' ? [h, T.roles.dims, T.kinds.text, T.d.req, T.roleHint.multiText] : [h, T.roles.value, T.kinds.num, T.d.req, T.roleHint.multi]));
    return [...rows, [], [T.d.data, tx.data], [T.d.what, tx.what], ...tx.tips.map((x, k) => [k ? '' : T.d.tips, x])];
  };
  const explainHead = () => [T.d.column, T.d.role, T.d.kind, '', lang === 'en' ? 'What to enter' : 'Що писати'];
  const downloadSample = (id, kind) => {
    const t = TYPE[id], s = samples[id].table, name = 'BC_' + id + '_sample';
    if (kind === 'csv') saveBlob(name + '.csv', csvBlob(s.head, s.rows));
    else saveBlob(name + '.xlsx', xlsxBlob([{ name: lang === 'en' ? 'Data' : 'Дані', head: s.head, rows: s.rows }, { name: lang === 'en' ? 'Explanation' : 'Пояснення', head: explainHead(), rows: explain(t), widths: [28, 18, 10, 14, 60], wrap: true }]));
    notify(T.d.downloaded);
  };
  const downloadAll = () => {
    const contents = TYPES.map(t => [sheetName(TT[t.id].name), T.groups[t.group], TT[t.id].sample, TT[t.id].data]);
    const sheets = [{ name: lang === 'en' ? 'Contents' : 'Зміст', head: [lang === 'en' ? 'Sheet' : 'Аркуш', lang === 'en' ? 'Task' : 'Задача', lang === 'en' ? 'Sample' : 'Зразок', T.d.data], rows: contents, widths: [30, 22, 44, 90], wrap: true },
      ...TYPES.map(t => ({ name: sheetName(TT[t.id].name), head: samples[t.id].table.head, rows: samples[t.id].table.rows }))];
    saveBlob('BC_chart_gallery_samples.xlsx', xlsxBlob(sheets));
    notify(T.d.downloaded);
  };

  const ctx = { T, TT, f, L, lang, view, typeId, group, setGroup, src, setSrc, own, maps, setMap, samples, open, navigate, notify, pickFile, clearOwn, trySample, downloadSample, downloadAll, setLead, assetBase };
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const tx = TT[typeId];
  const navActive = view === 'chart' ? 'gallery' : view;

  return (
    <div className="app motion">
      <div className="bg" aria-hidden="true"><div className="bg-wave" /><div className="bg-grid" /><div className="bg-glow g1" /><div className="bg-glow g2" /></div>
      <input type="file" ref={fileRef} accept=".csv,.txt,.tsv,.xlsx" hidden onChange={onFileInput} />

      <aside className={'sidebar glass' + (menu ? ' open' : '')} aria-label={T.navCaption}>
        <a className="side-brand" href={home} aria-label="Belyakov Consult">
          <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="102" height="52" />
          <span className="brand-name">Belyakov Consult</span>
          <span className="brand-caption">BI • Data Architecture • Data Governance</span>
        </a>
        <p className="nav-caption">{T.navCaption}</p>
        <nav>
          {NAV.map(([id, icon]) => (
            <a key={id} href={'#' + id} className={'nav-item' + (navActive === id ? ' active' : '')} aria-current={navActive === id ? 'page' : undefined} onClick={e => { e.preventDefault(); navigate(id); }}>
              <Icon name={icon} size={18} /><span>{T.nav[id]}</span>
            </a>
          ))}
        </nav>
        <p className="nav-caption">{T.related}</p>
        <nav><a className="nav-item" href={(onSite ? langPrefix : 'https://www.belyakovconsult.com' + langPrefix) + '/cases/laser-kitty/'}><Icon name="paw" size={18} /><span>{T.game}</span></a></nav>
        <div className="side-cta">
          <span className="signal-line" />
          <strong>{T.ctaSide}</strong>
          <p>{T.ctaSideText}</p>
          <Button kind="primary" onClick={() => setLead('sidebar')}>{T.ctaSideButton}</Button>
        </div>
        <a className="side-back" href={onSite ? (langPrefix || '') + '/cases/' : 'https://www.belyakovconsult.com/cases/'}><Icon name="back" size={14} />belyakovconsult.com</a>
      </aside>
      {menu && <button type="button" className="scrim" aria-label={T.close} onClick={() => setMenu(false)} />}

      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label={T.menu} aria-expanded={menu}><Icon name="menu" size={20} /></button>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button icon="upload" className="hide-sm" onClick={() => navigate('own')}>{T.nav.own}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => setLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{view === 'chart' ? T.groups[TYPE[typeId].group] : T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{pageTitle}</h1>
            <p>{view === 'chart' ? tx.short + ' ' + T.leads.chart() : T.leads[view](TYPES.length)}</p>
          </div>
          <div className="hero-art cg-art" aria-hidden="true">
            <svg viewBox="0 0 260 170">
              <g className="cg-art-bars">{[38, 62, 48, 86, 70, 104].map((h, k) => <rect key={k} x={22 + k * 20} y={150 - h} width="12" height={h} rx="3" style={{ animationDelay: k * 0.12 + 's' }} />)}</g>
              <path className="cg-art-line" d="M150 120 C170 104 182 112 196 86 S226 52 244 40" />
              {[[150, 120], [196, 86], [244, 40]].map(([x, y], k) => <circle key={k} className="cg-art-dot" cx={x} cy={y} r="4" />)}
              <circle className="cg-art-ring" cx="196" cy="128" r="22" />
              <circle className="cg-art-arc" cx="196" cy="128" r="22" pathLength="100" />
            </svg>
          </div>
        </section>

        <div className={'page page-' + view} key={view + (view === 'chart' ? typeId : '')}>
          {view === 'gallery' && <Gallery ctx={ctx} />}
          {view === 'chart' && <Detail key={typeId} ctx={ctx} />}
          {view === 'choose' && <Choose ctx={ctx} />}
          {view === 'own' && <Own ctx={ctx} />}
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote}</p>
          <div className="foot-actions">
            <Button icon="compass" onClick={() => navigate('choose')}>{T.nav.choose}</Button>
            <Button kind="primary" onClick={() => setLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="chart-gallery" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
