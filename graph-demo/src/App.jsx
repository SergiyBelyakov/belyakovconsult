import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { buildBase, buildModel, COMPONENTS, MIN_GROUP, PRESETS, SIGNALS, TRAITS } from './model.js';
import { layoutNetwork, layoutTraits } from './layout.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import Network from './pages/Network.jsx';
import Traits from './pages/Traits.jsx';
import IndexPage from './pages/Index.jsx';
import Communities from './pages/Communities.jsx';
import Signals from './pages/Signals.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [
  ['network', 'nodes', Network], ['traits', 'traits', Traits], ['index', 'gauge', IndexPage],
  ['communities', 'map', Communities], ['signals', 'warning', Signals], ['method', 'book', Method],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  let w = null;
  if (q.w && /^\d+(-\d+){3}$/.test(q.w)) {
    const a = q.w.split('-').map(Number);
    if (a.some(x => x > 0) && a.every(x => x <= 60)) w = Object.fromEntries(COMPONENTS.map((k, i) => [k, a[i]]));
  }
  return { view: PAGES[view] ? view : 'network', id: q.id || null, hl: q.hl || '', sig: q.sig || null, w };
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const csv = rows => rows.map(r => r.map(v => (v == null ? '' : /[",;\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\n');

export default function App({ initialLang, base: assetBase, onSite }) {
  const initial = useMemo(parseHash, []);
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const base = useMemo(buildBase, []);
  const layout = useMemo(() => layoutNetwork(base), [base]);
  const traitLayout = useMemo(() => layoutTraits(TRAITS, base.pairs, MIN_GROUP, 1.3), [base]);
  const valid = id => id && base.byId.has(id);
  const validHl = h => {
    if (!h) return '';
    const [k, v] = h.split(':');
    if (k === 'level' && v === 'high') return h;
    if (k === 'trait' && base.traitIdx[v] != null) return h;
    if (k === 'signal' && SIGNALS.some(s => s.id === v)) return h;
    if (k === 'terr' && base.people.some(p => p.territory === v)) return h;
    return '';
  };

  const [view, setView] = useState(initial.view);
  const [weights, setWeightsState] = useState(initial.w || PRESETS.base);
  const [selected, setSelected] = useState(valid(initial.id) ? initial.id : null);
  const [hl, setHlState] = useState(validHl(initial.hl));
  const [sig, setSig] = useState(SIGNALS.some(s => s.id === initial.sig) ? initial.sig : null);
  const [zoomTarget, setZoomTarget] = useState(valid(initial.id) ? { id: initial.id, n: 1 } : initial.hl && initial.hl.startsWith('terr:') ? { territory: initial.hl.slice(5), n: 1 } : null);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState('');
  const toastTimer = useRef(null);
  const model = useMemo(() => buildModel(base, weights), [base, weights]);

  useEffect(() => {
    const parts = [view];
    if (view === 'network' && selected) parts.push('id=' + selected);
    if (view === 'network' && hl) parts.push('hl=' + hl);
    if (view === 'signals' && sig) parts.push('sig=' + sig);
    if (COMPONENTS.some(k => weights[k] !== PRESETS.base[k])) parts.push('w=' + COMPONENTS.map(k => weights[k]).join('-'));
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, selected, hl, sig, weights]);
  useEffect(() => {
    const on = () => {
      const h = parseHash();
      const id = valid(h.id) ? h.id : null;
      const hl2 = validHl(h.hl);
      setView(h.view);
      setSelected(id);
      setHlState(hl2);
      if (h.sig && SIGNALS.some(s => s.id === h.sig)) setSig(h.sig);
      setZoomTarget(id ? { id, n: Date.now() } : hl2.startsWith('terr:') ? { territory: hl2.slice(5), n: Date.now() } : { fit: true, n: Date.now() });
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
  const setWeights = w => { if (COMPONENTS.some(k => w[k] > 0)) setWeightsState(w); };
  const select = (id, zoom) => {
    setSelected(id);
    if (id && zoom) setZoomTarget({ id, n: Date.now() });
  };
  const setHl = v => {
    setHlState(v); setSelected(null);
    if (v && v.startsWith('terr:')) setZoomTarget({ territory: v.slice(5), n: Date.now() });
    else setZoomTarget({ fit: true, n: Date.now() });
  };
  const navigate = id => {
    setView(id); setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const go = (id, patch = {}) => {
    if (patch.hl != null) { setHlState(validHl(patch.hl)); setSelected(null); setZoomTarget(patch.hl.startsWith('terr:') ? { territory: patch.hl.slice(5), n: Date.now() } : { fit: true, n: Date.now() }); }
    if (patch.id) { setSelected(patch.id); setHlState(''); setZoomTarget({ id: patch.id, n: Date.now() }); }
    if (patch.sig) setSig(patch.sig);
    navigate(id);
  };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };
  const search = e => {
    e.preventDefault();
    const t = q.trim().toUpperCase().replace(/\s/g, '');
    if (!t) return;
    const n = base.people.find(x => x.id === t || x.id === 'P-' + t || x.id.endsWith(t));
    if (n) { go('network', { id: n.id }); setQ(''); } else notify(T.notFound.replace('{q}', q.trim()), 'info');
  };

  const terrName = id => T.terr[id];
  const svcName = s => (s.kind === 'sw' ? T.svc.sw.replace('{n}', s.n) : s.kind === 'clinic' ? T.svc.clinic.replace('{t}', T.terrLetter[s.territory]) : T.svc.rehab);
  const svcShort = s => (s.kind === 'sw' ? T.svcShort.sw.replace('{n}', s.n) : s.kind === 'clinic' ? T.svcShort.clinic.replace('{t}', T.terrLetter[s.territory]) : T.svcShort.rehab);
  const sexAge = p => `${T.sex[p.sex]}, ${p.age}`;
  const sexAgeLong = p => `${T.sexLong[p.sex]}, ${p.age} ${T.yearsWord(p.age)}`;

  const exportNodes = () => {
    const head = ['id', 'kind', 'territory', 'household', 'age', 'sex', 'level', 'index', 'demographic', 'social', 'medical', 'network', 'support', 'informal_ties', 'betweenness', 'support_circle', 'traits', 'signals', 'possible_duplicate_of'];
    const rows = base.nodes.map(n => {
      if (n.kind !== 'person') return [n.id, n.kind, n.territory || '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
      const s = model.sc(n.id);
      return [n.id, 'person', n.territory, n.hh, n.age, n.sex, s.level, s.index.toFixed(1), n.sub.d, n.sub.s, n.sub.m, n.sub.n, n.support, n.informalDegree, n.betweenness.toFixed(1), n.circle,
        TRAITS.filter((t, i) => n.traits[i]).map(t => t.id).join(';'), model.signalsOf.get(n.id).join(';'), n.dupOf || ''];
    });
    download('BC_graph_nodes.csv', csv([head, ...rows]));
    notify(T.csvDone);
  };
  const exportEdges = () => {
    download('BC_graph_edges.csv', csv([['source', 'target', 'type', 'similarity'], ...base.edges.map(e => [e.s, e.t, e.type, e.sim || ''])]));
    notify(T.csvDone);
  };

  const ctx = {
    T, f, lang, base, model, layout, traitLayout, weights, setWeights, selected, select, hl, setHl, sig, go, navigate,
    zoomTarget, setZoomTarget, openLead: where => setLead(where), notify, terrName, svcName, svcShort, sexAge, sexAgeLong,
    exportNodes, exportEdges, people: n => `${f.int(n)} ${T.peopleWord(n)}`, langPrefix: LANGS.find(l => l.id === lang).prefix,
  };
  const Page = PAGES[view];
  const home = onSite ? (ctx.langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';

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
              {id === 'signals' && <em className="nav-count">{f.int(SIGNALS.filter(s => s.severity === 'critical').reduce((a, s) => a + model.sig[s.id].length, 0))}</em>}
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
            <input type="search" value={q} placeholder={T.search} aria-label={T.search} onChange={e => setQ(e.target.value)} />
          </form>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button icon="download" className="hide-sm" onClick={exportNodes}>{T.csvShort}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => setLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view]}</p>
          </div>
          <div className="hero-art graph-art" aria-hidden="true"><i /><i /><i /></div>
        </section>

        <div className="page" key={view}>
          <Page ctx={ctx} />
        </div>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote.replace('{p}', f.int(base.people.length)).replace('{s}', f.int(base.services.length))}</p>
          <div className="foot-actions">
            <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
            <Button kind="primary" onClick={() => setLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="graph-demo" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
