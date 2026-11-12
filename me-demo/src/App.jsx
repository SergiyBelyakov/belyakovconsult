import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { makeFmt } from './format.js';
import { NOW, NQ, QS, IND, IND_BY, REGION_IDS, REGIONS, HROMADAS, PARTNER_IDS, BUDGET_IDS, PARTNERS } from './data.js';
import { statusOf, forecast, regionStats, hromadaStats, finance, dqa, DQA_STD, signals } from './model.js';
import { xlsxBlob, saveBlob, csvBlob } from '../../chart-gallery/src/xlsx.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented, Toast } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import { QuarterBar, IndicatorDrawer, ReportModal } from './parts.jsx';
import { track } from './track.js';
import Overview from './pages/Overview.jsx';
import Framework from './pages/Framework.jsx';
import Indicators from './pages/Indicators.jsx';
import Regions from './pages/Regions.jsx';
import Finance from './pages/Finance.jsx';
import Quality from './pages/Quality.jsx';
import Evaluation from './pages/Evaluation.jsx';
import Method from './pages/Method.jsx';

const VIEWS = [
  ['overview', 'grid', Overview], ['framework', 'layers', Framework], ['indicators', 'chart', Indicators], ['regions', 'map', Regions],
  ['finance', 'coins', Finance], ['quality', 'shield', Quality], ['evaluation', 'scale', Evaluation], ['method', 'book', Method],
];
const PAGES = Object.fromEntries(VIEWS.map(([id, , P]) => [id, P]));

function parseHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('&');
  const q = Object.fromEntries(rest.map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
  const k = Number(q.q);
  return {
    view: PAGES[view] ? view : 'overview',
    k: Number.isInteger(k) && k >= 0 && k <= NOW ? k : NOW,
    ind: IND_BY[q.i] ? q.i : null,
    region: REGION_IDS.includes(q.r) ? q.r : null,
    partner: [...PARTNER_IDS, 'all'].includes(q.p) ? q.p : null,
    method: ['pre', 'post', 'did'].includes(q.m) ? q.m : null,
    outcome: ['inc', 'svc'].includes(q.o) ? q.o : null,
  };
}

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang;
  const T = STRINGS[lang];
  const f = useMemo(() => makeFmt(T), [lang]);
  const init = useMemo(parseHash, []);
  const [view, setView] = useState(init.view);
  const [k, setK] = useState(init.k);
  const [ind, setInd] = useState(init.ind);
  const [region, setRegion] = useState(init.region || 'kir');
  const [partner, setPartner] = useState(init.partner || 'B');
  const [method, setMethod] = useState(init.method || 'did');
  const [outcome, setOutcome] = useState(init.outcome || 'inc');
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [report, setReport] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const parts = [view];
    if (k !== NOW) parts.push('q=' + k);
    if (ind) parts.push('i=' + ind);
    if (view === 'regions') parts.push('r=' + region);
    if (view === 'finance') parts.push('p=' + partner);
    if (view === 'evaluation') { parts.push('m=' + method); if (outcome !== 'inc') parts.push('o=' + outcome); }
    const h = '#' + parts.join('&');
    if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
  }, [view, k, ind, region, partner, method, outcome]);
  useEffect(() => {
    const on = () => {
      const h = parseHash();
      setView(h.view); setK(h.k); setInd(h.ind);
      if (h.region) setRegion(h.region); if (h.partner) setPartner(h.partner); if (h.method) setMethod(h.method); if (h.outcome) setOutcome(h.outcome);
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
  const go = (id, patch = {}) => {
    if (patch.region) setRegion(patch.region);
    if (patch.partner) setPartner(patch.partner);
    if (patch.method) setMethod(patch.method);
    if (patch.ind !== undefined) setInd(patch.ind);
    navigate(id);
  };
  const openInd = id => { setInd(id); track('indicator', { id }); };
  const setQuarter = q => { setK(q); track('asof', { q }); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search + location.hash;
  };

  // назви
  const code = d => T.lvlPrefix[d.lvl] + d.num;
  const indName = id => T.ind[id].n;
  const regionName = (id, short) => (short ? T.regionShort(id) : T.region(id));
  const partnerName = p => T.partner(p) + (p !== 'M' ? ' · ' + T.sector[PARTNERS[p].sector] : '');
  const unitName = d => T.tbl.unitName[d.unit];

  // ——— вивантаження ———
  const L = lang === 'uk';
  const indRows = () => IND.map(d => {
    const s = statusOf(d, k), fc = forecast(d, k);
    return [code(d), T.lvl[d.lvl], d.out ? T.outcome[d.out] : d.lvl === 'cross' ? T.cross : T.goal, indName(d.id), unitName(d), d.base ?? '', d.target,
      s.plan == null ? '' : Math.round(s.plan * 10) / 10, s.v == null ? '' : Math.round(s.v * 10) / 10, s.ratio == null ? '' : Math.round(s.ratio * 1000) / 10,
      s.v == null ? '' : Math.round((s.v / d.target) * 1000) / 10, fc.end == null ? '' : Math.round(fc.end * 10) / 10, fc.pReach == null ? '' : Math.round(fc.pReach * 100),
      T.status[s.level], T.src[d.src], T.freq[d.freq], d.partners.map(p => T.partner(p)).join(', ')];
  });
  const indHead = [T.tbl.code, L ? 'Рівень' : 'Level', L ? 'Напрям' : 'Outcome', T.tbl.name, T.tbl.unit, T.tbl.base, T.tbl.target, T.tbl.plan, T.tbl.actual, T.tbl.ofPlan, T.tbl.ofTarget, T.tbl.fc, T.tbl.pReach + ', %', T.tbl.status, T.drw.src, T.drw.freq, T.tbl.partner];
  const longHead = ['code', 'indicator_id', L ? 'показник' : 'indicator', L ? 'квартал' : 'quarter', 'quarter_index', 'plan', 'actual', 'unit'];
  const longRows = () => IND.flatMap(d => QS.map(q => [code(d), d.id, indName(d.id), f.q(q.i), q.i, d.plan[q.i] == null ? '' : Math.round(d.plan[q.i] * 10) / 10, q.i <= k && d.actual && d.actual[q.i] != null ? Math.round(d.actual[q.i] * 10) / 10 : '', d.unit]));
  const exportIptt = () => {
    const RS = regionStats(k), F = finance(k), Q = dqa(k), S = signals(k);
    saveBlob('BC_programme_IPTT_' + QS[k].y + 'Q' + QS[k].q + '.xlsx', xlsxBlob([
      { name: L ? 'Показники' : 'Indicators', head: indHead, rows: indRows(), widths: [8, 12, 30, 60, 10, 10, 10, 12, 12, 10, 10, 14, 12, 14, 40, 22, 22] },
      { name: L ? 'За кварталами' : 'By quarter', head: longHead, rows: longRows(), widths: [8, 10, 60, 14, 8, 12, 12, 10] },
      { name: L ? 'Області' : 'Oblasts', head: [L ? 'Область' : 'Oblast', T.reg.pin, T.reg.unique, T.reg.coverage + ', %', T.reg.progress + ', %', T.reg.spend + ', EUR', T.reg.perPerson + ', EUR', T.reg.partners], rows: RS.list.map(x => [regionName(x.id), x.pin, x.unique, Math.round(x.coverage * 1000) / 10, x.progress == null ? '' : Math.round(x.progress * 1000) / 10, Math.round(x.spend), x.perPerson == null ? '' : Math.round(x.perPerson), x.partners.join(', ')]), widths: [26, 14, 12, 12, 14, 16, 16, 14] },
      { name: L ? 'Громади' : 'Communities', head: [T.reg.hCode, L ? 'Область' : 'Oblast', T.reg.hPop, T.reg.hPin, T.reg.hReach, T.reg.hCov + ', %', T.reg.hParts], rows: REGION_IDS.flatMap(r => hromadaStats(k, r).map(h => [h.id, regionName(r), h.pop, h.pin, h.unique, Math.round(h.coverage * 1000) / 10, h.partners.join(', ')])), widths: [12, 26, 12, 12, 12, 12, 12] },
      { name: L ? 'Бюджет' : 'Budget', head: [T.tbl.partner, T.fin.bac, T.fin.pv, T.fin.ac, T.fin.ev, T.fin.cpi, T.fin.spi, T.fin.eac, T.fin.vac], rows: F.rows.map(r => [partnerName(r.p), r.bac, r.pv, r.ac, Math.round(r.ev), Math.round(r.cpi * 100) / 100, Math.round(r.spi * 100) / 100, Math.round(r.eac), Math.round(r.vac)]), widths: [40, 14, 14, 14, 14, 10, 10, 16, 16] },
      { name: L ? 'Якість даних' : 'Data quality', head: [T.tbl.partner, ...DQA_STD.map(s => T.dq.std[s]), T.dq.score], rows: Q.rows.map(r => [partnerName(r.p), ...DQA_STD.map(s => Math.round(r.s[s])), Math.round(r.score)]), widths: [40, 14, 14, 14, 14, 14, 10] },
      { name: L ? 'Сигнали' : 'Signals', head: [L ? 'Рівень' : 'Level', L ? 'Сигнал' : 'Signal', L ? 'Що' : 'Subject', T.dq.rule, T.dq.step], rows: S.map(s => [T.sigLevel[s.level], T.sig[s.id].t, s.ind ? code(IND_BY[s.ind]) + ' ' + indName(s.ind) : s.partner ? T.partner(s.partner) : s.region ? regionName(s.region) : T.sigSubject.program, T.sig[s.id].rule, T.sig[s.id].step]), wrap: true, widths: [12, 30, 50, 60, 60] },
    ]));
    notify(T.method.done); track('export', { kind: 'iptt' });
  };
  const exportPirs = () => {
    saveBlob('BC_indicator_reference_sheet_template.xlsx', xlsxBlob([
      { name: 'PIRS', head: [T.tbl.code, T.drw.level, T.tbl.name, T.drw.def, T.tbl.unit, T.drw.calc, T.drw.dis, T.drw.src, T.drw.freq, T.drw.who, T.tbl.base, L ? 'Дата базового' : 'Baseline date', T.tbl.target, L ? 'Проміжні цілі' : 'Interim targets', L ? 'Обмеження даних' : 'Data limitations', L ? 'Остання перевірка DQA' : 'Last DQA'],
        rows: IND.map(d => [code(d), T.lvl[d.lvl], indName(d.id), T.ind[d.id].d, unitName(d), T.ind[d.id].m, T.ind[d.id].dis, T.src[d.src], T.freq[d.freq], d.partners.map(p => T.partner(p)).join(', '), '', '', '', '', '', '']), wrap: true, widths: [8, 12, 50, 60, 10, 60, 40, 40, 20, 20, 10, 12, 10, 20, 30, 14] },
    ]));
    notify(T.method.done); track('export', { kind: 'pirs' });
  };
  const exportCsv = () => { saveBlob('BC_programme_indicators_by_quarter.csv', csvBlob(longHead, longRows())); notify(T.method.done); track('export', { kind: 'csv' }); };

  const ctx = {
    T, f, lang, view, navigate, go, notify, k, setK: setQuarter, openInd, region, setRegion, partner, setPartner, method, setMethod, outcome, setOutcome,
    code, indName, regionName, partnerName, unitName, exportIptt, exportPirs, exportCsv, openReport: () => { setReport(true); track('report', { q: k }); }, onSite, assetBase,
  };
  const Page = PAGES[view];
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const home = onSite ? (langPrefix || '') + '/' : 'https://www.belyakovconsult.com/';
  const crit = useMemo(() => signals(k).filter(s => s.level === 'critical').length, [k]);

  return (
    <div className="app motion me-app">
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
              {id === 'quality' && crit > 0 && <span className="nav-count">{crit}</span>}
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
          <div className="me-prog hide-sm"><b>{T.program}</b><span>{T.programMeta}</span></div>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button icon="report" className="hide-sm" onClick={ctx.openReport}>{T.report}</Button>
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => { setLead('topbar'); track('lead_open', { where: 'topbar' }); }}>{T.cta}</Button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.titles[view]}</h1>
            <p>{T.leads[view]}</p>
          </div>
          <div className="hero-art me-art" aria-hidden="true">
            <svg viewBox="0 0 270 170">
              <path className="me-chain" d="M18 132 C 70 132, 70 96, 112 96 S 160 58, 200 58 S 238 30, 256 26" />
              {[[18, 132, 'in'], [112, 96, 'act'], [200, 58, 'out'], [256, 26, 'imp']].map(([x, y, id], i) => (
                <g key={id} style={{ animationDelay: i * 0.1 + 's' }} className="me-node">
                  <rect x={x - 13} y={y - 13} width="26" height="26" rx="4" className={'me-box b' + i} />
                </g>
              ))}
              <circle r="4" className="me-pulse"><animateMotion dur="3.2s" repeatCount="indefinite" path="M18 132 C 70 132, 70 96, 112 96 S 160 58, 200 58 S 238 30, 256 26" /></circle>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <rect key={i} x={20 + i * 20} y={152} width="14" height="6" rx="1.5" className={'me-q' + (i <= k ? ' on' : '') + (i === k ? ' cur' : '')} />)}
            </svg>
          </div>
        </section>

        {view !== 'method' && <QuarterBar T={T} f={f} k={k} setK={setQuarter} />}

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
            <Button kind="primary" onClick={() => { setLead('footer'); track('lead_open', { where: 'footer' }); }}>{T.ctaLong}</Button>
          </div>
        </footer>
      </main>

      {ind && <IndicatorDrawer ctx={ctx} id={ind} onClose={() => setInd(null)} />}
      {report && <ReportModal ctx={ctx} onClose={() => setReport(false)} />}
      {lead && <LeadModal T={T} lang={lang} where={lead} source="monitoring-evaluation" onClose={() => setLead(null)} onSent={() => track('lead_sent', { where: lead })} />}
      <Toast toast={toast} />
    </div>
  );
}
