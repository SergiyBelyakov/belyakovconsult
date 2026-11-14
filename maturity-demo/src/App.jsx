import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import {
  DIMS, NQ, NALL, ORGS, SIZES, AMBITIONS, SAMPLES, emptyAnswers, encode, decode, score, priorities, antiPatterns, warnings, strengths,
  isComplete, answeredCount, firstOpen,
} from './model.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import { track } from './track.js';
import Start from './pages/Start.jsx';
import Assess from './pages/Assess.jsx';
import Results from './pages/Results.jsx';
import Roadmap from './pages/Roadmap.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [['start', 'home', Start], ['assess', 'listCheck', Assess], ['results', 'radar', Results], ['roadmap', 'route', Roadmap], ['method', 'book', Method]];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const KEY = 'bc-maturity-v1';

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!x) return null;
    return { a: decode(x.a) || emptyAnswers(), org: ORGS.includes(x.o) ? x.o : null, size: SIZES.includes(x.s) ? x.s : null, amb: AMBITIONS.includes(x.t) ? x.t : 'rec', done: x.done && typeof x.done === 'object' ? x.done : {} };
  } catch { return null; }
}
function save(st) {
  try { localStorage.setItem(KEY, JSON.stringify({ a: encode(st.a), o: st.org, s: st.size, t: st.amb, done: st.done })); } catch { /* приватний режим: працюємо без збереження */ }
}

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const a = decode(q.a);
  return {
    view: PAGES[view] ? view : null,
    step: DIMS.includes(q.d) ? DIMS.indexOf(q.d) : null,
    sample: SAMPLES[q.ex] ? q.ex : null,
    link: a ? { a, org: ORGS.includes(q.o) ? q.o : 'other', size: SIZES.includes(q.s) ? q.s : null, amb: AMBITIONS.includes(q.t) ? q.t : 'rec' } : null,
  };
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const init = useMemo(parseHash, []);
  const stored = useMemo(load, []);

  const [mine, setMine] = useState(() => stored ? stored.a : emptyAnswers());
  const [org, setOrg] = useState(() => (stored && stored.org) || null);
  const [size, setSize] = useState(() => (stored && stored.size) || null);
  const [amb, setAmb] = useState(() => (stored && stored.amb) || 'rec');
  const [done, setDone] = useState(() => (stored && stored.done) || {});
  const [sample, setSample] = useState(init.sample);
  const [link, setLink] = useState(init.sample ? null : init.link);
  const [view, setView] = useState(init.view || (init.sample || init.link ? 'results' : 'start'));
  const [step, setStep] = useState(init.step ?? Math.max(0, Math.floor(Math.max(0, firstOpen(stored ? stored.a : emptyAnswers())) / NQ)));
  const [hl, setHl] = useState(null);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef(null);

  // Що показуємо: приклад, результат за посиланням або власні відповіді.
  const shown = sample ? { kind: 'sample', a: decode(SAMPLES[sample].a), org: SAMPLES[sample].org, size: SAMPLES[sample].size, amb: SAMPLES[sample].amb }
    : link ? { kind: 'link', ...link }
      : { kind: 'mine', a: mine, org: org || 'other', size, amb };
  const S = useMemo(() => score(shown.a, shown.org, shown.amb), [shown.a, shown.org, shown.amb]);
  const complete = isComplete(shown.a);
  const pr = useMemo(() => (complete ? priorities(S) : []), [S, complete]);
  const anti = useMemo(() => (complete ? antiPatterns(S) : []), [S, complete]);
  const warn = useMemo(() => (complete ? warnings(S, shown.a) : []), [S, complete]);
  const strong = useMemo(() => (complete ? strengths(S) : []), [S, complete]);

  useEffect(() => { save({ a: mine, org, size, amb, done }); }, [mine, org, size, amb, done]);
  useEffect(() => {
    const parts = [view];
    if (view === 'assess') parts.push('d=' + DIMS[step]);
    if (sample) parts.push('ex=' + sample);
    else if (link) parts.push('a=' + encode(link.a), 'o=' + link.org, ...(link.size ? ['s=' + link.size] : []), 't=' + link.amb);
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, step, sample, link]);
  useEffect(() => {
    const on = () => {
      const h = parseHash();
      if (h.view) setView(h.view);
      if (h.step != null) setStep(h.step);
      if (h.sample) { setSample(h.sample); setLink(null); } else if (h.link) { setLink(h.link); setSample(null); }
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.title = `${T.nav[view]} · ${T.demoName} | Belyakov Consult`; track('view', { view }); }, [view]);

  const notify = (text, icon = 'check') => {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };

  // ——— дії ———
  const setAnswer = (i, v) => {
    setMine(a => {
      const n = a.slice();
      n[i] = v;
      const d = Math.floor(i / NQ);
      if (n.slice(d * NQ, d * NQ + NQ).every(x => x != null) && a.slice(d * NQ, d * NQ + NQ).some(x => x == null)) track('step', { dim: DIMS[d] });
      return n;
    });
  };
  const own = () => { setSample(null); setLink(null); };
  const begin = () => {
    own();
    const i = firstOpen(mine);
    setStep(i < 0 ? 0 : Math.floor(i / NQ));
    track('start', { org: org || 'none', resume: answeredCount(mine) > 0 });
    navigate(i < 0 ? 'results' : 'assess');
  };
  const goStep = i => { own(); setStep(i); navigate('assess'); };
  const finish = () => {
    const i = firstOpen(mine);
    if (i >= 0) {
      notify(T.missing(NALL - answeredCount(mine)), 'info');
      setStep(Math.floor(i / NQ));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    track('complete', { org: org || 'other', level: score(mine, org || 'other', amb).level });
    navigate('results');
    return true;
  };
  const reset = () => {
    setMine(emptyAnswers()); setDone({}); setStep(0); own();
    track('reset');
    notify(T.resetDone);
    navigate('start');
  };
  const openSample = id => { setSample(id); setLink(null); track('sample', { id }); navigate('results'); };
  const adoptLink = () => {
    if (!link) return;
    setMine(link.a); setOrg(link.org); setSize(link.size); setAmb(link.amb); setLink(null); track('adopt');
  };
  const shareUrl = () => location.origin + location.pathname + `#results&a=${encode(shown.a)}&o=${shown.org}${shown.size ? '&s=' + shown.size : ''}&t=${shown.amb}`;
  const share = async () => {
    const url = shareUrl();
    track('share', { kind: shown.kind });
    try {
      await navigator.clipboard.writeText(url);
      notify(T.shareDone, 'link');
    } catch {
      history.replaceState(null, '', url.slice(location.origin.length));
      notify(T.shareFail, 'info');
    }
  };
  const pdf = async () => {
    if (busy) return;
    setBusy(true);
    notify(T.pdfBusy, 'pdf');
    try {
      const { buildPdf } = await import('./pdf.js');
      await buildPdf({ T, f, lang, S, pr, anti, warn, strong, shown, langPrefix: LANGS.find(l => l.id === lang).prefix, link: shareUrl() }, assetBase);
      notify(T.pdfDone, 'pdf');
      track('pdf', { kind: shown.kind, level: S.level });
    } catch (e) {
      notify(T.pdfFail, 'warning');
    } finally { setBusy(false); }
  };
  const openLead = where => { setLead(where); track('lead_open', { where }); };
  const leadMessage = complete ? T.leadMsg({
    org: T.orgsShort[shown.org], size: shown.size ? T.sizes[shown.size].toLowerCase() : T.notSet, level: S.level, levelName: T.levels[S.level - 1].name, index: S.index,
    prio: pr.map(p => T.dims[p.id].name).join(', '), link: shareUrl(),
  }) : undefined;

  const ctx = {
    T, f, lang, view, navigate, notify, S, pr, anti, warn, strong, shown, complete, mine, org, setOrg: o => { setOrg(o); track('org', { org: o }); }, size, setSize, amb, setAmb,
    step, setStep, goStep, setAnswer, begin, finish, reset, openSample, own, adoptLink, sample, link, share, pdf, busy, openLead, hl, setHl,
    done, setDone, onSite, langPrefix: LANGS.find(l => l.id === lang).prefix, assetBase,
  };
  const Page = PAGES[view];
  const langPrefix = ctx.langPrefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const nMine = answeredCount(mine);

  return (
    <div className="app motion mt-app">
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
              onClick={e => { e.preventDefault(); if (id === 'assess') own(); navigate(id); }}>
              <Icon name={icon} size={18} /><span>{T.nav[id]}</span>
              {id === 'assess' && nMine > 0 && nMine < NALL && <span className="nav-count mt-nav-n">{nMine}/{NALL}</span>}
              {id === 'results' && isComplete(mine) && <span className="mt-nav-ok"><Icon name="check" size={13} /></span>}
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
          <div className={'mt-progress hide-sm' + (view === 'assess' || view === 'start' ? '' : ' off')} aria-hidden={view !== 'assess'}>
            <span className="mt-progress-track"><span style={{ width: (nMine / NALL) * 100 + '%' }} /></span>
            <small>{T.progressOf(nMine, NALL)}</small>
          </div>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            {complete && view !== 'assess' && <Button icon="pdf" className="hide-sm" onClick={pdf} disabled={busy}>{T.pdf}</Button>}
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
            <Button kind="primary" onClick={() => openLead('footer')}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {lead && <LeadModal T={T} lang={lang} where={lead} source="data-maturity" message={leadMessage} onClose={() => setLead(null)} onSent={() => track('lead_sent', { where: lead })} />}
      <Toast toast={toast} />
    </div>
  );
}

// Hero: пелюстка зрілості повільно змінює форму між трьома профілями, сканер обертається.
const HERO = [[2, 3, 2, 3, 1.6, 3.4, 2.4, 2], [3.4, 2.4, 3, 2.2, 2.6, 2.6, 3.2, 3], [2.6, 3.4, 3.6, 3, 3.2, 2.2, 2.8, 3.6]];
function heroPoints(vals) {
  return vals.map((v, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    return [130 + (68 * v) / 4 * Math.cos(a), 86 + (68 * v) / 4 * Math.sin(a)].map(n => n.toFixed(1)).join(',');
  }).join(' ');
}
function HeroArt() {
  const motion = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const p = HERO.map(heroPoints);
  const ring = r => heroPoints(Array(8).fill(r));
  return (
    <div className="hero-art mt-art" aria-hidden="true">
      <svg viewBox="0 0 260 172">
        {[1, 2, 3, 4].map(r => <polygon key={r} points={ring(r)} className="ma-ring" />)}
        {Array.from({ length: 8 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 4; return <line key={i} x1="130" y1="86" x2={130 + 68 * Math.cos(a)} y2={86 + 68 * Math.sin(a)} className="ma-axis" />; })}
        <polygon points={ring(3)} className="ma-target" />
        <polygon points={p[0]} className="ma-shape">
          {motion && <animate attributeName="points" dur="9s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .25 1;.45 0 .25 1;.45 0 .25 1" values={`${p[0]};${p[1]};${p[2]};${p[0]}`} />}
        </polygon>
        <g className="ma-sweep"><path d="M130 86 L130 16 A70 70 0 0 1 171 29 Z" /></g>
        <circle cx="130" cy="86" r="3.2" className="ma-core" />
      </svg>
    </div>
  );
}
