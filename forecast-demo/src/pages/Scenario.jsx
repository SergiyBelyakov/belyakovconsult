// Сценарний прогноз: перемикачі «Базовий», «Оптимістичний», «Стресовий» і повзунки ціни, бюджету й ринку.
// Модель: лог-лінійна регресія замовлень інтернет-магазину на ціну, бюджет і ринок (engine/scenario.js).
import { useMemo, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { ForecastChart, Legend, FC } from '../charts.jsx';
import { Waterfall } from '../exparts.jsx';
import { seriesFor, futureOf, Formula } from '../common.jsx';
import { makeFmt } from '../format.js';
import { fitElastic, planFor, predictElastic, total, decompose, PRESETS, PRESET_IDS } from '../engine/scenario.js';
import { SERIES } from '../../../chart-gallery/src/palette.js';

const COLORS = { base: '#94A3B8', optimistic: SERIES[2], stress: SERIES[1] };
const SLIDERS = [['price', -15, 15, 1], ['budget', -50, 50, 5], ['market', -15, 10, 1]];
const pctTxt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '%';

export default function ScenarioPage({ ctx }) {
  const { T, track, openLead, navigate } = ctx, Q = T.sc;
  const S = useMemo(() => seriesFor('shop'), []);
  const fmt = useMemo(() => makeFmt(T, 0), [T]);
  const fit = useMemo(() => fitElastic(S), [S]);
  const [preset, setPreset] = useState('base');
  const [adj, setAdj] = useState(PRESETS.base);
  const [focus, setFocus] = useState(null);
  const n = S.y.length, h = S.drivers.Xf.length;
  const fcs = useMemo(() => Object.fromEntries(PRESET_IDS.map(id => [id, predictElastic(fit, planFor(S, PRESETS[id]))])), [fit, S]);
  const cur = useMemo(() => predictElastic(fit, planFor(S, adj)), [fit, S, adj]);
  const dec = useMemo(() => decompose(fit, S, adj), [fit, S, adj]);
  const custom = SLIDERS.some(([k]) => adj[k] !== PRESETS[preset][k]);
  const last12 = S.y.slice(n - 12).reduce((a, b) => a + b, 0), curTotal = total(cur);
  const dates = useMemo(() => [...S.dates, ...futureOf(S, h)], [S, h]);
  const overlays = PRESET_IDS.filter(id => id !== preset || custom).map(id => ({ id, label: Q.presets[id], color: COLORS[id], from: n, values: fcs[id].map(f => f.mean) }));
  const curName = custom ? Q.custom : Q.presets[preset];
  const choose = id => { setPreset(id); setAdj(PRESETS[id]); track('scenario', { preset: id }); };
  const year = S.dates[n - 1].slice(0, 4), next = String(Number(year) + 1);

  return (
    <>
      <div className="grid fc-main">
        <Panel className="fc-chart-panel" title={T.datasets.shop.name} sub={Q.chartSub}>
          <ForecastChart dates={dates} y={S.y} fitted={null} fc={cur} overlays={overlays} show={{ fitted: false, test: false }} freq={S.freq} fmt={fmt} T={T}
            from={Math.max(0, n - 36)} fcLabel={curName} label={Q.chartSub} focus={focus} />
          <Legend focus={focus} setFocus={setFocus} items={[
            { key: 'actual', cls: 'actual', label: T.legend.actual },
            { key: 'fc', cls: 'fc', label: curName },
            { key: 'band', cls: 'band', label: T.legend.b80 },
            ...overlays.map(o => ({ key: o.id, color: o.color, label: o.label })),
          ]} />
        </Panel>
        <Panel title={Q.controls} className="fc-sc-controls">
          <div className="fc-seg fc-sc-presets" role="radiogroup" aria-label={Q.controls}>
            {PRESET_IDS.map(id => (
              <button key={id} type="button" role="radio" aria-checked={preset === id} className={preset === id ? 'on' : ''} onClick={() => choose(id)}>
                <i className="fc-sc-dot" style={{ background: COLORS[id] }} />{Q.presets[id]}
              </button>
            ))}
          </div>
          <p className="fc-sc-about">{Q.presetText[preset]}</p>
          <div className="fc-params">
            {SLIDERS.map(([k, lo, hi, step]) => (
              <div className="fc-param" key={k}>
                <div className="fc-param-head"><b>{Q.slider[k][0]}</b><span className="fc-param-val">{pctTxt(adj[k])}</span></div>
                <input type="range" min={lo} max={hi} step={step} value={adj[k]} aria-label={Q.slider[k][0]}
                  onChange={e => { setAdj(a => ({ ...a, [k]: Number(e.target.value) })); track('scenario_slider', { k }); }} />
                <small>{Q.slider[k][1]}</small>
              </div>
            ))}
          </div>
          {custom && <Button icon="reset" onClick={() => setAdj(PRESETS[preset])}>{Q.reset(Q.presets[preset])}</Button>}
          <p className="fc-scen-total">
            <span>{Q.total(next, fmt.val(curTotal))}</span>
            <b className={curTotal >= last12 ? 'up' : 'down'}>{fmt.pctSigned(curTotal / last12 - 1)} {Q.vsYear(year)}</b>
          </p>
        </Panel>
      </div>

      <div className="grid fc-two">
        <Panel title={Q.wfTitle} sub={Q.wfSub(curName)}>
          <Waterfall steps={[
            { name: Q.presets.base, sub: Q.year(next), value: dec.base, kind: 'start' },
            ...dec.steps.map(s => ({ name: Q.factor[s.id], sub: pctTxt(adj[s.id]), value: s.value, kind: 'delta' })),
            { name: curName, sub: Q.year(next), value: dec.end, kind: 'end' },
          ]} fmt={fmt.val} label={Q.wfTitle} />
          <p className="ex-note">{dec.steps.every(s => Math.abs(s.value) < 0.5) ? Q.wfEmpty : Q.wfNote}</p>
        </Panel>
        <Panel title={Q.tableTitle} sub={Q.tableSub(year)}>
          <div className="table-scroll">
            <table className="data-table plain fc-sc-table">
              <thead><tr><th>{Q.colScenario}</th>{SLIDERS.map(([k]) => <th key={k} className="num">{Q.factor[k]}</th>)}<th className="num">{Q.colTotal(next)}</th><th className="num">{Q.colVs(year)}</th></tr></thead>
              <tbody>
                {PRESET_IDS.map(id => { const t = total(fcs[id]); return (
                  <tr key={id} className={!custom && id === preset ? 'fc-row-on' : ''}>
                    <td className="strong"><i className="fc-sc-dot" style={{ background: COLORS[id] }} />{Q.presets[id]}</td>
                    {SLIDERS.map(([k]) => <td key={k} className="num">{pctTxt(PRESETS[id][k])}</td>)}
                    <td className="num">{fmt.val(t)}</td><td className="num">{fmt.pctSigned(t / last12 - 1)}</td>
                  </tr>
                ); })}
                {custom && (
                  <tr className="fc-row-on">
                    <td className="strong"><i className="fc-sc-dot" style={{ background: FC }} />{Q.custom}</td>
                    {SLIDERS.map(([k]) => <td key={k} className="num">{pctTxt(adj[k])}</td>)}
                    <td className="num">{fmt.val(curTotal)}</td><td className="num">{fmt.pctSigned(curTotal / last12 - 1)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid fc-two">
        <Panel title={Q.elTitle} sub={Q.elSub}>
          <ul className="fc-sc-el">
            {fit.coef.map((c, j) => { const k = SLIDERS[j][0]; return (
              <li key={c.id}>
                <div><b>{Q.factor[k]}</b><small>{Q.elWhat[k]}</small></div>
                <span className="fc-sc-el-val">{(c.b > 0 ? '+' : '−') + fmt.dec2(Math.abs(c.b))}<small>± {fmt.dec2(1.96 * c.se)}</small></span>
                <p>{Q.elRead[k]((c.b > 0 ? '+' : '−') + fmt.dec1(Math.abs(c.b * (k === 'budget' ? 10 : 1))))}</p>
              </li>
            ); })}
          </ul>
          <p className="ex-note">{Q.elNote(fmt.pct0(fit.r2))}</p>
        </Panel>
        <Panel title={T.howTitle}>
          <ol className="fc-steps wrapfx">
            {Q.how.map(([text, fx], i) => (
              <li key={i}><span className="how-n">{i + 1}</span><div><p>{text}</p>{fx && <Formula s={fx} />}</div></li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel className="cta-card flat-panel">
        <h3>{Q.ctaTitle}</h3>
        <p>{Q.ctaText}</p>
        <div className="fc-cta-actions">
          <Button kind="primary" icon="mail" onClick={() => openLead('scenario')}>{T.ctaLong}</Button>
          <Button icon="layers" onClick={() => navigate('hier')}>{T.nav.hier}</Button>
        </div>
      </Panel>
    </>
  );
}
