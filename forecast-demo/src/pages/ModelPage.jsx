import { useEffect, useMemo, useState } from 'react';
import { Panel, Button, Select } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { MODELS, BY_ID, defaultParams } from '../engine/models.js';
import { runModel, holdout } from '../engine/evaluate.js';
import { DATASET_IDS, DEFAULT_DS } from '../data.js';
import { TOOLS } from '../content.js';
import { makeFmt } from '../format.js';
import { ForecastChart, ChartLegend, Residuals } from '../charts.jsx';
import Explain from '../explain.jsx';
import { Formula, seriesFor, futureOf, applicability, Caps, ParamControl, MetricTiles, Code } from '../common.jsx';
import { downloadSample, downloadForecastCsv, downloadFormulas, FORMULA_MODELS } from '../io.js';

const SHOW = { D: 140, W: 120, M: 96 };
const WIDE = ['prophet', 'tbats', 'sarimax', 'shap', 'intermittent'];

export default function ModelPage({ ctx }) {
  const { T, modelId, dsId, setDsId, openModel, track, openLead, notify } = ctx;
  const model = BY_ID[modelId], C = T.models[modelId];
  const [params, setParams] = useState(() => defaultParams(modelId, seriesFor(dsId)));
  const [hMul, setHMul] = useState(1);
  const [show, setShow] = useState({ fitted: true, test: true, band: true });
  const [focus, setFocus] = useState(null);
  const [scen, setScen] = useState({ temp: 0, price: 0, promo: true });
  useEffect(() => { setParams(defaultParams(modelId, seriesFor(dsId))); setHMul(1); }, [dsId, modelId]);

  const S = useMemo(() => seriesFor(dsId, modelId === 'drivers' ? scen : null), [dsId, modelId, scen]);
  const fmt = useMemo(() => makeFmt(T, S.dec), [T, S.dec]);
  const n = S.y.length, maxH = S.drivers ? S.drivers.Xf.length : S.h * 2, h = Math.min(maxH, S.h * hMul);
  const ok = applicability(modelId, S, S.H), okFull = applicability(modelId, S, 0);
  const res = useMemo(() => {
    if (okFull !== true) return { err: okFull };
    try {
      const r = runModel(modelId, S, params, h);
      const ho = ok === true ? holdout(modelId, S, params, S.H) : null;
      return { r, ho };
    } catch (e) { return { err: 'error', msg: String(e) }; }
  }, [modelId, S, params, h, ok, okFull]);
  const r = res.r, fdates = futureOf(S, h);
  // багаті пояснення (кілька графіків) займають усю ширину під кроками моделі
  const wide = !!r && WIDE.includes(r.explain?.kind);
  // базовий план факторів, щоб показати, наскільки сценарій змінює підсумок
  const baseTotal = useMemo(() => {
    if (modelId !== 'drivers' || S.id !== 'icecream' || !r) return null;
    try { return runModel('drivers', seriesFor(dsId, { temp: 0, price: 0, promo: true }), params, h).fc.reduce((a, f) => a + f.mean, 0); } catch { return null; }
  }, [modelId, dsId, params, h, !!r]);
  const scenTotal = r ? r.fc.reduce((a, f) => a + f.mean, 0) : null;
  const dates = [...S.dates, ...fdates];
  const from = Math.max(0, n - (SHOW[S.freq] || 96));
  const specs = model.params(S).filter(s => !s.when || (s.when === '!auto' ? params.auto === false : s.when.includes('=') ? String(params[s.when.split('=')[0]] ?? '') === s.when.split('=')[1] : !!params[s.when]));
  const idx = MODELS.findIndex(x => x.id === modelId), prev = MODELS[(idx + MODELS.length - 1) % MODELS.length], next = MODELS[(idx + 1) % MODELS.length];
  const tool = TOOLS[modelId], excel = tool.excel ? (T.locale.startsWith('uk') ? tool.excel : tool.excel.replace(/;/g, ',')) : null;
  const D = T.datasets[S.id];
  const setP = (k, v) => { setParams(p => ({ ...p, [k]: v })); track('param', { model: modelId, p: k }); };

  return (
    <>
      <div className="fc-model-head glass">
        <div className="fc-model-nav">
          <Button icon="back" onClick={() => openModel(prev.id)}>{T.models[prev.id].name}</Button>
          <span className="fc-fam">{T.families[model.family][0]}</span>
          <Button icon="arrowRight" onClick={() => openModel(next.id)}>{T.models[next.id].name}</Button>
        </div>
        <Caps caps={model.caps} T={T} />
      </div>

      <div className="grid fc-main">
        <div className="side-stack fc-left">
        <Panel className="fc-chart-panel" title={D.name} sub={`${D.unit} · ${D.look}`}
          aside={(
            <div className="fc-controls">
              <Select label={T.dataLabel} value={dsId} onChange={v => { setDsId(v); track('dataset', { model: modelId, d: v }); }} options={DATASET_IDS.map(id => ({ value: id, label: T.datasets[id].name }))} />
              {maxH > S.h && <Select label={T.horizonLabel} value={String(hMul)} onChange={v => setHMul(Number(v))} options={[1, 2].map(k => ({ value: String(k), label: T.per(S.h * k, S.freq, T) }))} />}
            </div>
          )}>
          {res.err ? (
            <div className="fc-na">
              <Icon name="info" size={20} />
              <p>{T.notApplicable[res.err] || T.notApplicable.error}</p>
              <Button kind="primary" icon="reset" onClick={() => setDsId(DEFAULT_DS[modelId])}>{T.datasets[DEFAULT_DS[modelId]].name}</Button>
            </div>
          ) : (
            <>
              <ForecastChart dates={dates} y={S.y} fitted={r.fitted} fc={r.fc} test={res.ho ? { from: n - S.H, fc: res.ho.r.fc } : null}
                show={show} freq={S.freq} fmt={fmt} T={T} from={from} label={`${C.name}: ${D.name}`} focus={focus} nav />
              <div className="fc-chart-foot">
                <ChartLegend T={T} show={show} setShow={setShow} focus={focus} setFocus={setFocus} hasBand={r.fc.some(f => Number.isFinite(f.lo80))} hasTest={!!res.ho} />
                <small className="fc-lg-hint">{T.legendHint}</small>
              </div>
            </>
          )}
        </Panel>
        {r && !res.err && r.fitted.some(Number.isFinite) && (
          <Panel title={T.residTitle} sub={T.residSub} className="fc-resid-panel">
            <Residuals y={S.y} fitted={r.fitted} dates={S.dates} freq={S.freq} fmt={fmt} T={T} />
          </Panel>
        )}
        </div>

        <div className="side-stack fc-side">
          {(specs.length > 0 || modelId === 'drivers') && !res.err && (
            <Panel title={T.paramsTitle} aside={specs.some(s => s.auto) ? <Button icon="reset" onClick={() => setParams(defaultParams(modelId, S))}>{T.resetParams}</Button> : null}>
              <div className="fc-params">
                {specs.map(s => <ParamControl key={s.id} spec={s} value={params[s.id]} used={r.used[s.id]} onChange={v => setP(s.id, v)} T={T} fmt={fmt} />)}
                {modelId === 'drivers' && S.id === 'icecream' && <Scenario scen={scen} setScen={setScen} T={T} fmt={fmt} total={scenTotal} base={baseTotal} />}
              </div>
              {specs.some(s => s.auto) && <p className="note"><Icon name="info" size={15} /><span>{T.autoNote}</span></p>}
            </Panel>
          )}
          {res.ho && (
            <Panel title={T.metricsTitle} sub={T.metricsSub(S.H, T, S.freq)}>
              <MetricTiles m={res.ho.m} T={T} fmt={fmt} />
            </Panel>
          )}
        </div>
      </div>

      <div className={'grid ' + (wide ? 'fc-wide' : 'fc-two')}>
        <Panel title={T.howTitle} className="fc-how">
          <ol className={'fc-steps' + (wide ? ' cols' : '')}>
            {C.how.map(([text, fx], i) => (
              <li key={i} style={{ animationDelay: i * 0.07 + 's' }}>
                <span className="how-n">{i + 1}</span>
                <div><p>{text}</p>{fx && <Formula s={fx} />}</div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={T.insideTitle} sub={D.name} className="fc-inside">
          {r && !res.err ? <Explain id={modelId} r={r} S={S} T={T} fmt={fmt} h={h} params={params} ho={res.ho} /> : <p className="muted">{T.notApplicable[res.err] || ''}</p>}
        </Panel>
      </div>

      <div className="fc-facts">
        {[['whenTitle', C.when, 'target'], ['plusTitle', C.plus, 'check'], ['minusTitle', C.minus, 'warning']].map(([k, list, icon]) => (
          <Panel key={k} title={T[k]} className="fc-fact">
            <ul className="check-list">{list.map((t, i) => <li key={i}><Icon name={icon} size={16} /><span>{t}</span></li>)}</ul>
          </Panel>
        ))}
        <Panel title={T.caseTitle} className="fc-fact case"><p>{C.case}</p></Panel>
      </div>

      <div className="grid fc-two">
        <Panel title={T.toolsTitle} className="fc-tools">
          <div className="fc-tool"><h5>Excel</h5>{excel ? <Code>{excel}</Code> : <p className="muted small">{T.toolsNoExcel}</p>}</div>
          <div className="fc-tool"><h5>Power BI</h5><p className="muted small">{T.toolPbi}</p></div>
          <div className="fc-tool"><h5>Python</h5><Code>{tool.python}</Code></div>
          <div className="fc-tool"><h5>R</h5><Code>{tool.r}</Code></div>
        </Panel>
        <div className="side-stack">
          <Panel title={T.downloadsTitle}>
            <div className="fc-dl">
              <Button icon="download" onClick={() => { downloadSample(S, T, 'csv'); track('download', { what: 'csv', d: S.id }); }}>{T.dlCsv}</Button>
              <Button icon="download" onClick={() => { downloadSample(S, T, 'xlsx'); track('download', { what: 'xlsx', d: S.id }); }}>{T.dlXlsx}</Button>
              {r && !res.err && <Button icon="download" onClick={() => { downloadForecastCsv(`forecast_${modelId}_${S.id}`, S, r, T, fdates); track('download', { what: 'fc', model: modelId }); }}>{T.dlFc}</Button>}
              {r && !res.err && FORMULA_MODELS.includes(modelId) && <Button kind="primary" icon="download" onClick={() => { downloadFormulas(modelId, S, r, T, h); track('download', { what: 'formulas', model: modelId }); notify(T.dlFormulas); }}>{T.dlFormulas}</Button>}
            </div>
            {FORMULA_MODELS.includes(modelId) && <p className="note"><Icon name="info" size={15} /><span>{T.dlFormulasHint}</span></p>}
          </Panel>
        </div>
      </div>

      <Panel className="cta-card flat-panel">
        <h3>{T.ctaTitle}</h3>
        <p>{T.ctaText}</p>
        <div className="fc-cta-actions">
          <Button kind="primary" icon="mail" onClick={() => openLead('model')}>{T.ctaLong}</Button>
          <Button icon="upload" onClick={() => ctx.navigate('data')}>{T.nav.data}</Button>
        </div>
      </Panel>
    </>
  );
}

function Scenario({ scen, setScen, T, fmt, total, base }) {
  const E = T.ex;
  return (
    <div className="fc-scen">
      <h5>{E.scenario}</h5>
      <div className="fc-param">
        <div className="fc-param-head"><b>{E.scTemp}</b><span className="fc-param-val">{(scen.temp > 0 ? '+' : scen.temp < 0 ? '−' : '') + fmt.int(Math.abs(scen.temp))} °C</span></div>
        <input type="range" min={-6} max={6} step={1} value={scen.temp} onChange={e => setScen(s => ({ ...s, temp: Number(e.target.value) }))} aria-label={E.scTemp} />
      </div>
      <div className="fc-param">
        <div className="fc-param-head"><b>{E.scPrice}</b><span className="fc-param-val">{(scen.price > 0 ? '+' : scen.price < 0 ? '−' : '') + fmt.int(Math.abs(scen.price))}%</span></div>
        <input type="range" min={-20} max={20} step={5} value={scen.price} onChange={e => setScen(s => ({ ...s, price: Number(e.target.value) }))} aria-label={E.scPrice} />
      </div>
      <label className="fc-toggle">
        <input type="checkbox" checked={scen.promo} onChange={e => setScen(s => ({ ...s, promo: e.target.checked }))} />
        <span className="fc-switch" aria-hidden="true" />
        <span><b>{E.scPromo}</b><small>{scen.promo ? E.scOn : E.scOff}</small></span>
      </label>
      {Number.isFinite(total) && Number.isFinite(base) && (
        <p className="fc-scen-total">
          <span>{E.scTotal(fmt.val(total), fmt.val(base))}</span>
          {Math.abs(total - base) > 0.5 && <b className={total > base ? 'up' : 'down'}>{fmt.pctSigned(total / base - 1)}</b>}
        </p>
      )}
    </div>
  );
}
