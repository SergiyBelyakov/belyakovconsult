// Карта: показник за регіонами й містами, склади й потоки логістики, відтворення року місяць за місяцем,
// деталі регіону з мостом прибутку, каналами й клієнтами
import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { CHANNELS } from '../model/data.js';
import { CITIES, CITY, HUBS, dist } from '../model/geo.js';
import { rollup, REGIONS, DIMS, EFFECTS } from '../model/pvm.js';
import { Bridge, DivBars } from '../charts.jsx';
import { MapView } from '../MapView.jsx';
import { bridgeSteps, Chips, nm, regionName } from '../common.jsx';
import { diverge, seq, POS, NEG, CH_COL, BRAND } from '../colors.js';

const METRICS = ['dgp', 'gr', 'dgm', 'r1', 'price', 'cost', 'mix', 'vol', 'cm'];

export default function MapPage({ ctx }) {
  const { T, fmt, lang, D, Upk, Epk, CV, a, b, setRange, params, track, t1 } = ctx;
  const [metric, setMetric] = useState('dgp');
  const [sel, setSel] = useState(params.region || null);
  const [showCities, setShowCities] = useState(true), [showFlows, setShowFlows] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  const reg = useMemo(() => rollup(D, Upk, Epk, 'region'), [Epk]);
  const city = useMemo(() => rollup(D, Upk, Epk, 'city'), [Epk]);
  // внесок після обслуговування за регіонами й містами
  const cm = useMemo(() => {
    const r = {}, c = {};
    CV.forEach(o => { const cu = D.customers[o.k]; for (const [m, key] of [[r, cu.region], [c, cu.cityI]]) { m[key] = m[key] || { cm: 0, r: 0 }; m[key].cm += o.cm1; m[key].r += o.r1; } });
    return { r, c };
  }, [CV]);
  const val = (g, key, isCity) => {
    if (!g) return NaN;
    if (metric === 'r1') return g.r1;
    if (metric === 'gr') return g.gr;
    if (metric === 'dgm') return g.dgm;
    if (metric === 'cm') { const o = (isCity ? cm.c : cm.r)[key]; return o && o.r ? o.cm / o.r : NaN; }
    return metric === 'dgp' ? g.dgp : g[metric];
  };
  const byReg = new Map(reg.map(g => [REGIONS[g.k], g]));
  const rv = REGIONS.map(id => val(byReg.get(id), id)).filter(Number.isFinite);
  const maxAbs = Math.max(1e-9, ...rv.map(Math.abs)), maxR = Math.max(1e-9, ...rv);
  const color = v => (!Number.isFinite(v) ? null : metric === 'r1' ? seq(v / maxR) : diverge(v / maxAbs));
  const fv = v => (!Number.isFinite(v) ? '·' : metric === 'r1' ? fmt.money(v) : metric === 'gr' ? fmt.pctS(v) : metric === 'dgm' ? fmt.pp(v) : metric === 'cm' ? fmt.pct(v) : fmt.moneyS(v));
  const regionTip = id => { const g = byReg.get(id); return { title: regionName(id, lang), rows: g ? [{ label: T.map.metrics[metric], value: fv(val(g, id)) }, { label: T.k.rev, value: `${fmt.money(g.r1)} · ${fmt.pctS(g.gr)}` }, { label: T.k.gp, value: `${fmt.money(g.gp1)} · ${fmt.moneyS(g.dgp)}` }, { label: T.k.gm, value: `${fmt.pct(g.gm1)} · ${fmt.pp(g.dgm)}` }] : [] }; };
  const maxCity = Math.max(...city.map(g => g.r1));
  const cityList = city.filter(g => g.r1 > 0 || g.r0 > 0).map(g => {
    const c = CITIES[g.k], v = val(g, g.k, true);
    return { id: c.id, r: 3 + 15 * Math.sqrt(g.r1 / maxCity), color: color(v) || BRAND.slate, name: nm(c, lang), label: g.r1 > maxCity * 0.2, on: sel === c.region,
      tip: { title: nm(c, lang), rows: [{ label: T.map.metrics[metric], value: fv(v) }, { label: T.k.rev, value: `${fmt.money(g.r1)} · ${fmt.pctS(g.gr)}` }, { label: T.k.gm, value: `${fmt.pct(g.gm1)} · ${fmt.pp(g.dgm)}` }] },
      onClick: () => pick(c.region) };
  });
  // потоки: від найближчого відкритого складу до кожного міста, товщина за виручкою
  const flows = useMemo(() => {
    const hubs = HUBS.filter(h => t1 >= h.from).map(h => CITY[h.city]);
    return city.filter(g => g.r1 > 0).map(g => { const c = CITIES[g.k], h = hubs.reduce((x, y) => (dist(y, c) < dist(x, c) ? y : x)); return h.id === c.id ? null : { from: h.id, to: c.id, w: (0.8 + 5 * Math.sqrt(g.r1 / maxCity)).toFixed(2), color: h.id === 'dnipro' ? BRAND.amber : h.id === 'lviv' ? BRAND.magenta : BRAND.cyan }; }).filter(Boolean);
  }, [city, t1]);
  const pick = id => { setSel(id); if (id) track('region', { region: id }); };
  useEffect(() => () => clearInterval(timer.current), []);
  const play = () => {
    if (playing) { clearInterval(timer.current); setPlaying(false); return; }
    track('map_play');
    let m = 0; setRange(0, 0); setPlaying(true);
    timer.current = setInterval(() => { m++; if (m > 9) { clearInterval(timer.current); setPlaying(false); return; } setRange(0, m); }, 850);
  };
  const g = sel ? byReg.get(sel) : null;
  const sub = useMemo(() => {
    if (!sel) return null;
    const ri = REGIONS.indexOf(sel), o = { R0: 0, R1: 0, GP0: 0, GP1: 0 }, chs = CHANNELS.map(() => ({ r1: 0, dgp: 0 }));
    for (const e of EFFECTS) o[e] = 0;
    for (let i = 0; i < Upk.n; i++) {
      if (!Epk.cls[i] || DIMS.region.key(Upk, i, D) !== ri) continue;
      o.R0 += Upk.r0[i]; o.R1 += Upk.r1[i]; o.GP0 += Upk.r0[i] - Upk.c0[i]; o.GP1 += Upk.r1[i] - Upk.c1[i];
      for (const e of EFFECTS) o[e] += Epk[e][i];
      const c = chs[Upk.ch[i]]; c.r1 += Upk.r1[i]; c.dgp += Upk.r1[i] - Upk.c1[i] - (Upk.r0[i] - Upk.c0[i]);
    }
    const custs = CV.filter(x => D.customers[x.k].region === sel).map(x => ({ key: x.k, label: nm(D.customers[x.k], lang), value: x.gp1 - x.gp0, sub: `${T.k.rev} ${fmt.money(x.r1)} · ${T.k.cm} ${fmt.money(x.cm1)}` })).sort((p, q) => Math.abs(q.value) - Math.abs(p.value));
    const km = Math.min(...HUBS.filter(h => t1 >= h.from).map(h => dist(CITIES.filter(c => c.region === sel).sort((p, q) => q.w - p.w)[0], CITY[h.city])));
    return { o, chs, custs, km };
  }, [sel, Epk, CV]);
  const legend = (
    <div className="sm-map-legend">
      <b>{T.map.metrics[metric]}</b>
      {metric === 'r1'
        ? <div className="sm-divlegend"><i style={{ background: `linear-gradient(90deg, ${seq(0)}, ${seq(1)})` }} /><span>0</span><span /><span>{fmt.money(maxR)}</span></div>
        : <div className="sm-divlegend"><i style={{ background: `linear-gradient(90deg, ${NEG}, #2A3342, ${POS})` }} /><span>{fv(-maxAbs)}</span><span>0</span><span>{fv(maxAbs)}</span></div>}
      {showFlows && <div className="sm-hubs-leg">{HUBS.map(h => <span key={h.id}><i style={{ background: h.id === 'dnipro' ? BRAND.amber : h.id === 'lviv' ? BRAND.magenta : BRAND.cyan }} />{nm(CITY[h.city], lang)}{h.from ? ' · ' + T.map.hubSince : ''}</span>)}</div>}
    </div>
  );

  return (
    <>
      <Panel className="sm-controls">
        <div className="sm-ctl-row">
          <Chips label={T.map.metric} value={metric} onChange={m => { setMetric(m); track('map_metric', { metric: m }); }} options={METRICS.map(m => ({ value: m, label: T.map.metrics[m] }))} small />
        </div>
        <div className="sm-ctl-row">
          <button type="button" className={'sm-play' + (playing ? ' on' : '')} onClick={play}><Icon name={playing ? 'pause' : 'play'} size={16} />{playing ? T.map.pause : T.map.play}</button>
          <span className="sm-play-m">{T.map.month(fmt.monY(t1))}</span>
          <span className="sm-sp" />
          <label className="sm-toggle"><input type="checkbox" checked={showCities} onChange={e => setShowCities(e.target.checked)} />{T.map.cities}</label>
          <label className="sm-toggle"><input type="checkbox" checked={showFlows} onChange={e => setShowFlows(e.target.checked)} />{T.map.flows}</label>
        </div>
      </Panel>
      <div className="grid sm-map-grid">
        <Panel className="sm-map-panel">
          <MapView T={T} regionFill={id => color(val(byReg.get(id), id))} regionTip={regionTip} cities={cityList} flows={flows} showFlows={showFlows} showCities={showCities} selected={sel} onSelect={pick} legend={legend} />
          <p className="note"><Icon name="hand" size={14} />{T.map.drag}</p>
        </Panel>
        <div className="side-stack">
          {!sel && (
            <Panel title={T.map.metrics.dgp} sub={T.map.pick}>
              <DivBars rows={reg.filter(x => x.r0 || x.r1).map(x => ({ key: REGIONS[x.k], label: regionName(REGIONS[x.k], lang), value: x.dgp, sub: `${T.k.rev} ${fmt.pctS(x.gr, 0)} · ${T.k.gm} ${fmt.pct(x.gm1)}` })).sort((p, q) => Math.abs(q.value) - Math.abs(p.value))} fmtV={fmt.moneyS} T={T} onPick={pick} limit={10} />
            </Panel>
          )}
          {sel && g && sub && (
            <Panel title={regionName(sel, lang)} sub={`${T.map.customers(CV.filter(x => D.customers[x.k].region === sel && x.r1 > 0).length)} · ${Math.round(sub.km)} ${T.map.km}`}
              aside={<button type="button" className="icon-btn" onClick={() => pick(null)} aria-label={T.close}><Icon name="x" size={16} /></button>}>
              <div className="sm-reg-kpi">
                <span><small>{T.k.rev}</small><b>{fmt.money(g.r1)}</b><em className={g.gr >= 0 ? 'pos' : 'neg'}>{fmt.pctS(g.gr)}</em></span>
                <span><small>{T.k.gp}</small><b>{fmt.money(g.gp1)}</b><em className={g.dgp >= 0 ? 'pos' : 'neg'}>{fmt.moneyS(g.dgp)}</em></span>
                <span><small>{T.k.gm}</small><b>{fmt.pct(g.gm1)}</b><em className={g.dgm >= 0 ? 'pos' : 'neg'}>{fmt.pp(g.dgm)}</em></span>
              </div>
              <Bridge steps={bridgeSteps(sub.o, T)} fmtV={(v, s) => (s ? fmt.mlnS(v) : fmt.mln(v))} fmtTick={v => fmt.mln(v)} height={190} compact T={T} />
              <h4 className="sm-h4">{T.map.byCh}</h4>
              <div className="sm-chsplit">
                {sub.chs.map((c, k) => c.r1 > 0 && <span key={k} style={{ '--cc': CH_COL[k], flex: c.r1 }} title={`${nm(CHANNELS[k], lang)}: ${fmt.money(c.r1)}`}><i /></span>)}
              </div>
              <div className="sm-chsplit-leg">{sub.chs.map((c, k) => c.r1 > 0 && <span key={k} style={{ '--cc': CH_COL[k] }}><i />{nm(CHANNELS[k], lang)} <b>{fmt.pct(c.r1 / sub.o.R1, 0)}</b></span>)}</div>
              <h4 className="sm-h4">{T.map.topCust}</h4>
              <DivBars rows={sub.custs} fmtV={fmt.moneyS} T={T} limit={6} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
