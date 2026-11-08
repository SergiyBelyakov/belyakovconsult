import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { PLACES, BY_ID, OBJECTS, OBJ_BY, SOURCES, SCHOOLS, OKRUG_OF, BUILDINGS, TOTAL, sumAge, isStale } from './world.js';
import { INDICATORS, SIGNALS, SIG, DOMAINS, IND_BY } from './model.js';
import { xlsxBlob, saveBlob, csvBlob } from '../../chart-gallery/src/xlsx.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import Passport from './pages/Passport.jsx';
import MapView from './pages/MapView.jsx';
import Places from './pages/Places.jsx';
import People from './pages/People.jsx';
import Finance from './pages/Finance.jsx';
import Scenarios from './pages/Scenarios.jsx';
import Signals from './pages/Signals.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [
  ['passport', 'idcard', Passport], ['map', 'map', MapView], ['places', 'home', Places], ['people', 'users', People],
  ['finance', 'coins', Finance], ['scenarios', 'sliders', Scenarios], ['signals', 'warning', Signals], ['method', 'book', Method],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));
const LAYER_IDS = ['pop', 'edu', 'health', 'safety', 'services', 'roads', 'flood', 'sirens', 'okrugs'];
export const DEF_LAYERS = ['pop', 'edu', 'health', 'safety', 'services'];
const SCHOOL_IDS = new Set(SCHOOLS.map(s => s.id));

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const states = {};
  (q.s || '').split(',').forEach(x => { const m = /^(s\d+)([pc])$/.exec(x); if (m && SCHOOL_IDS.has(m[1])) states[m[1]] = m[2] === 'p' ? 'primary' : 'close'; });
  const w = Number(q.w), h = Number(q.h);
  return {
    view: PAGES[view] ? view : 'passport',
    dom: DOMAINS.includes(q.d) ? q.d : null,
    ind: IND_BY.has(q.i) ? q.i : null,
    mode: q.m === 'stack' ? 'stack' : q.m === 'map' ? 'map' : null,
    layers: q.l ? q.l.split(',').filter(x => LAYER_IDS.includes(x)) : null,
    obj: OBJ_BY.has(q.o) ? q.o : null,
    place: BY_ID.has(q.id) ? q.id : null,
    okrug: q.ok || null,
    scen: ['low', 'base', 'high'].includes(q.sc) ? q.sc : 'base',
    tab: ['school', 'blackout', 'flood'].includes(q.t) ? q.t : 'school',
    states, hours: [6, 12, 24, 48, 72].includes(h) ? h : 24, gens: (q.g || '').split(',').filter(id => OBJ_BY.has(id) && OBJ_BY.get(id).cat === 'water'),
    fuel: q.fuel === '1', repair: q.rep === '1', stage: w >= 0 && w <= 8 ? Math.round(w * 5) / 5 : 4,
    sig: SIGNALS.some(s => s.id === q.sig) ? q.sig : null,
  };
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const init = useMemo(parseHash, []);
  const [view, setView] = useState(init.view);
  const [dom, setDom] = useState(init.dom);
  const [ind, setInd] = useState(init.ind);
  const [mode, setMode] = useState(init.mode || 'map');
  const [layers, setLayers] = useState(new Set(init.layers || DEF_LAYERS));
  const [sel, setSel] = useState(init.obj ? { kind: 'obj', id: init.obj } : init.view === 'map' && init.place ? { kind: 'place', id: init.place } : null);
  const [place, setPlace] = useState(init.place || 'luh');
  const [okrug, setOkrug] = useState(init.okrug);
  const [scen, setScen] = useState(init.scen);
  const [tab, setTab] = useState(init.tab);
  const [states, setStates] = useState(init.states);
  const [hours, setHours] = useState(init.hours);
  const [gens, setGens] = useState(init.gens);
  const [fuel, setFuel] = useState(init.fuel);
  const [repair, setRepair] = useState(init.repair);
  const [stage, setStage] = useState(init.stage);
  const [sig, setSig] = useState(init.sig);
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const parts = [view];
    if (view === 'passport') { if (dom) parts.push('d=' + dom); if (ind) parts.push('i=' + ind); }
    if (view === 'map') {
      parts.push('m=' + mode);
      if (mode === 'map') { const l = [...layers].sort().join(','); if (l !== [...DEF_LAYERS].sort().join(',')) parts.push('l=' + l); }
      if (sel && sel.kind === 'obj') parts.push('o=' + sel.id); else if (sel && sel.kind === 'place') parts.push('id=' + sel.id);
    }
    if (view === 'places') { parts.push('id=' + place); if (okrug) parts.push('ok=' + okrug); }
    if (view === 'people' && scen !== 'base') parts.push('sc=' + scen);
    if (view === 'scenarios') {
      parts.push('t=' + tab);
      if (tab === 'school') { const s = Object.entries(states).filter(([, v]) => v !== 'keep').map(([k, v]) => k + (v === 'primary' ? 'p' : 'c')).join(','); if (s) parts.push('s=' + s); }
      if (tab === 'blackout') { parts.push('h=' + hours); if (gens.length) parts.push('g=' + gens.join(',')); if (fuel) parts.push('fuel=1'); if (repair) parts.push('rep=1'); }
      if (tab === 'flood') parts.push('w=' + stage);
    }
    if (view === 'signals' && sig) parts.push('sig=' + sig);
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, dom, ind, mode, layers, sel, place, okrug, scen, tab, states, hours, gens, fuel, repair, stage, sig]);
  useEffect(() => {
    const on = () => {
      const h = parseHash();
      setView(h.view); setDom(h.dom); setInd(h.ind); if (h.mode) setMode(h.mode); if (h.layers) setLayers(new Set(h.layers));
      if (h.obj) setSel({ kind: 'obj', id: h.obj }); if (h.place) setPlace(h.place); setScen(h.scen); setTab(h.tab); setStates(h.states);
      setHours(h.hours); setGens(h.gens); setFuel(h.fuel); setRepair(h.repair); setStage(h.stage); setSig(h.sig);
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
  const navigate = id => { setView(id); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const go = (id, patch = {}) => {
    if (patch.place) setPlace(patch.place);
    if (patch.okrug !== undefined) setOkrug(patch.okrug);
    if (patch.sel !== undefined) setSel(patch.sel);
    if (patch.layers) setLayers(new Set(patch.layers));
    if (patch.mode) setMode(patch.mode);
    if (patch.tab) setTab(patch.tab);
    if (patch.sig !== undefined) setSig(patch.sig);
    if (patch.dom !== undefined) setDom(patch.dom);
    if (patch.ind !== undefined) setInd(patch.ind);
    navigate(id);
  };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };

  // назви
  const placeName = (p, short) => (p.kind === 'district' ? (short ? T.district[p.district] : lang === 'uk' ? p.name.uk : T.townName + ', ' + T.district[p.district]) : lang === 'uk' ? p.name.uk : p.name.lat);
  const objPlace = o => placeName(BY_ID.get(o.place));
  const no = n => (lang === 'uk' ? ' №' + n : ' No. ' + n);
  const objName = o => {
    if (!o) return '';
    switch (o.cat) {
      case 'school': return T.schoolType[o.type] + (o.no ? no(o.no) : '') + ', ' + objPlace(o);
      case 'kg': return T.glyph.kg + no(o.no) + ', ' + objPlace(o);
      case 'health': return o.kind === 'fap' ? T.glyph.fap + ', ' + objPlace(o) : T.fac[o.id];
      case 'admin': return o.kind === 'starosta' ? T.adminKind.starosta + ', ' + objPlace(o) : o.kind === 'cnap' ? T.fac.c1 : T.adminKind.remote + ', ' + objPlace(o);
      case 'shelter': return o.school ? T.glyph.shelter + ': ' + objName(OBJ_BY.get(o.school)) : T.shelterKind[o.kind] + ', ' + objPlace(o);
      case 'point': return T.glyph.point + ', ' + objPlace(o);
      case 'water': return T.glyph.water + ', ' + objPlace(o);
      default: return T.cultKind[o.kind] + ', ' + objPlace(o);
    }
  };
  const indName = id => T.ind[id].n;

  // ——— вивантаження ———
  const placeRows = () => PLACES.map(p => [
    p.id, p.name.uk, p.name.lat, T.kindsPlace[p.kind], T.okrugName(OKRUG_OF[p.id]), p.x, p.y, p.pop, p.src.reg, p.src.idp, p.src.decl, p.src.meters,
    Math.round(p.range[0]), Math.round(p.range[1]), Math.round(sumAge(p.age, 0, 17)), Math.round(sumAge(p.age, 65, 90)),
    p.t.primaryCar, p.t.primaryPt, p.t.hospitalPt, p.t.cnapPt, p.flood == null ? '' : p.flood, p.siren,
  ]);
  const placeHead = ['id', 'name_uk', 'name_lat', lang === 'uk' ? 'тип' : 'type', lang === 'uk' ? 'округ' : 'district', 'x_km', 'y_km', 'residents_estimate', 'register', 'idp', 'gp_registrations', 'active_meters', 'estimate_min', 'estimate_max', 'children_0_17', 'aged_65_plus', 'clinic_car_min', 'clinic_bus_min', 'hospital_bus_min', 'cnap_bus_min', 'flood_from_m', 'siren_audible'];
  const indRows = () => INDICATORS.map(x => [x.id, T.dom[x.dom], T.ind[x.id].n, x.v == null ? '' : Math.round(x.v * 10) / 10, T.units[x.unit] || '%', T.status[x.status], x.src.map(s => T.src[s]).join('; '), x.owner ? T.owner[x.owner] : T.noOwner, x.updated || '', x.bench ? x.bench[2] : '', T.ind[x.id].d, T.ind[x.id].m]);
  const exportPassport = () => {
    const L = lang === 'uk';
    saveBlob('BC_community_twin_passport.xlsx', xlsxBlob([
      { name: L ? 'Показники' : 'Indicators', head: ['id', L ? 'Розділ' : 'Section', L ? 'Показник' : 'Indicator', L ? 'Значення' : 'Value', L ? 'Одиниця' : 'Unit', L ? 'Статус' : 'Status', L ? 'Джерело' : 'Source', L ? 'Власник' : 'Owner', L ? 'Оновлено' : 'Updated', L ? 'Медіана схожих' : 'Peer median', L ? 'Визначення' : 'Definition', L ? 'Як рахується' : 'Calculation'], rows: indRows(), widths: [16, 20, 42, 12, 14, 18, 34, 34, 12, 14, 60, 70] },
      { name: L ? 'Населені пункти' : 'Settlements', head: placeHead, rows: placeRows() },
      { name: L ? "Об'єкти" : 'Facilities', head: ['id', L ? 'Назва' : 'Name', L ? 'Категорія' : 'Category', 'place', 'x_km', 'y_km', L ? 'Потужність' : 'Capacity', L ? 'Стан' : 'Condition'], rows: OBJECTS.map(o => [o.id, objName(o), T.catName[o.cat], o.place, o.x, o.y, o.cap || '', o.state ? T.shelterState[o.state] : o.cat === 'point' ? (o.broken ? T.map.iss.broken : '') : '']) },
      { name: L ? 'Джерела' : 'Sources', head: ['id', L ? 'Джерело' : 'Source', L ? 'Власник' : 'Owner', L ? 'Як надходить' : 'Access', L ? 'Оновлення' : 'Updates', L ? 'Останнє оновлення' : 'Last update', L ? 'Записів' : 'Records', L ? 'Статус' : 'Status'], rows: SOURCES.map(s => [s.id, T.src[s.id], s.owner ? T.owner[s.owner] : T.noOwner, T.access[s.access], T.freqText(s.freq), s.updated, s.records, isStale(s) ? T.status.stale : T.status.ok]) },
      { name: L ? 'Сигнали' : 'Signals', head: ['id', L ? 'Рівень' : 'Level', L ? 'Сигнал' : 'Signal', L ? 'Записів' : 'Records', L ? 'Правило' : 'Rule', L ? 'Перший крок' : 'First step'], rows: SIGNALS.map(s => [s.id, T.sigLevel[s.level], T.sig[s.id].t, SIG[s.id].length, T.sig[s.id].rule, T.sig[s.id].step]), wrap: true },
    ]));
    notify(T.method.done);
  };
  const exportTemplate = () => {
    const L = lang === 'uk';
    saveBlob('BC_community_passport_template.xlsx', xlsxBlob([
      { name: L ? 'Паспорт' : 'Passport', head: ['id', L ? 'Показник' : 'Indicator', L ? 'Розділ' : 'Section', L ? 'Одиниця' : 'Unit', L ? 'Значення' : 'Value', L ? 'Дата' : 'Date', L ? 'Джерело' : 'Source', L ? 'Власник' : 'Owner', L ? 'Оновлення' : 'Updates', L ? 'Визначення' : 'Definition', L ? 'Як рахувати' : 'How to calculate'],
        rows: INDICATORS.filter(x => x.dom !== 'data' || ['objRights', 'objAudit'].includes(x.id)).map(x => { const s = x.src[0] ? SOURCES.find(y => y.id === x.src[0]) : null; return [x.id, T.ind[x.id].n, T.dom[x.dom], T.units[x.unit] || '%', '', '', x.src[0] ? T.src[x.src[0]] : '', x.owner ? T.owner[x.owner] : '', s ? T.freqText(s.freq) : '', T.ind[x.id].d, T.ind[x.id].m]; }), widths: [16, 42, 20, 14, 12, 12, 30, 30, 12, 60, 70] },
    ]));
    notify(T.method.done);
  };
  const exportCsv = () => { saveBlob('BC_community_twin_settlements.csv', csvBlob(placeHead, placeRows())); notify(T.method.done); };

  const ctx = {
    T, f, lang, view, navigate, go, notify, placeName, objName, indName, assetBase,
    dom, setDom, ind, setInd, mode, setMode, layers, setLayers, sel, setSel, place, setPlace, okrug, setOkrug, scen, setScen,
    tab, setTab, states, setStates, hours, setHours, gens, setGens, fuel, setFuel, repair, setRepair, stage, setStage, sig, setSig,
    exportPassport, exportTemplate, exportCsv, onSite,
  };
  const Page = PAGES[view];
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const sigCount = SIGNALS.filter(s => s.level === 'critical').reduce((a, s) => a + (SIG[s.id].length ? 1 : 0), 0);

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
              {id === 'signals' && sigCount > 0 && <span className="nav-count">{sigCount}</span>}
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
            <Button icon="download" className="hide-sm" onClick={exportPassport}>{T.xlsxShort}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => setLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view]}</p>
          </div>
          {view !== 'passport' && <div className="hero-art twin-art" aria-hidden="true">
            <svg viewBox="0 0 260 170">
              {[0, 1, 2, 3].map(i => (
                <g key={i} className={'tl-layer l' + i} style={{ '--ty': -i * 27 + 'px', animationDelay: i * 0.16 + 's' }}>
                  <path d="M130 156 L216 132 L130 108 L44 132 Z" className={'tl-plane p' + i} />
                  {i === 3 && [[104, 130, 0], [150, 124, 1], [172, 134, 0], [126, 140, 0], [88, 134, 0]].map(([x, y, h], k) => <circle key={k} cx={x} cy={y} r={h ? 4.2 : 2.4} className={h ? 'tl-hot' : 'tl-dot'} />)}
                </g>
              ))}
            </svg>
          </div>}
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

      {lead && <LeadModal T={T} lang={lang} where={lead} source="community-twin" onClose={() => setLead(null)} />}
      <Toast toast={toast} />
    </div>
  );
}
