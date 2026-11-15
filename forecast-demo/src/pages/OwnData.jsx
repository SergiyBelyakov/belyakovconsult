// Прогноз на файлі відвідувача: читання й налаштування ряду, перевірка всіх моделей на відкладених даних,
// прогноз обраною моделлю і вивантаження. Файл обробляється лише у браузері.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Button, Select, Segmented } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { readFile, profile, MAX_ROWS } from '../../../anomaly-demo/src/fileio.js';
import { MODELS, BY_ID, applies, defaultParams } from '../engine/models.js';
import { runModel, holdout, seriesInfo } from '../engine/evaluate.js';
import { DATASET_IDS } from '../data.js';
import { makeFmt, futureDates } from '../format.js';
import { ForecastChart, ChartLegend } from '../charts.jsx';
import { Leaderboard } from './Compare.jsx';
import { seriesFor, MetricTiles } from '../common.jsx';
import { buildSeries, defaultMap, sampleRows } from '../own.js';
import { downloadSample, forecastTable, downloadForecastCsv, downloadForecastXlsx } from '../io.js';

const HORIZONS = { D: [7, 14, 28, 56, 91], W: [4, 8, 13, 26, 52], M: [3, 6, 12, 18, 24], Q: [2, 4, 6, 8], Y: [1, 2, 3, 5] };
const SHOW = { D: 140, W: 120, M: 96 };
const r4 = v => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : '');
let seq = 0;

// Моделі перевіряються по кілька за кадр, щоб сторінка не завмирала на довгих рядах
function useRanking(S) {
  const [st, setSt] = useState({ rows: [], done: 0, S: null });
  useEffect(() => {
    if (!S) return undefined;
    let alive = true, i = 0, timer = 0;
    const rows = [], info = seriesInfo(S), infoTrain = { ...info, n: info.n - S.H, futureDrivers: info.drivers };
    setSt({ rows: [], done: 0, S });
    const step = () => {
      if (!alive) return;
      const t0 = performance.now();
      while (i < MODELS.length && performance.now() - t0 < 45) {
        const id = MODELS[i++].id;
        const ok = id === 'ensemble' ? true : applies(BY_ID[id], infoTrain);
        if (ok !== true) { rows.push({ id, skip: ok }); continue; }
        try { const ev = holdout(id, S, defaultParams(id, S), S.H); rows.push({ id, ...ev.m, fc: ev.r.fc }); }
        catch { rows.push({ id, skip: 'error' }); }
      }
      setSt({ rows: rows.slice(), done: i, S });
      if (i < MODELS.length) timer = setTimeout(step, 0);
    };
    timer = setTimeout(step, 30);
    return () => { alive = false; clearTimeout(timer); };
  }, [S]);
  const fresh = st.S === S;
  const rows = fresh ? st.rows : [];
  return {
    ok: rows.filter(r => !r.skip && Number.isFinite(r.mase)).sort((a, b) => a.mase - b.mase),
    skipped: rows.filter(r => r.skip || !Number.isFinite(r.mase)),
    done: fresh ? st.done : 0, total: MODELS.length,
  };
}

function Field({ label, children, wide }) {
  return <div className={'fc-field' + (wide ? ' wide' : '')}><span className="fc-field-label">{label}</span>{children}</div>;
}

export default function OwnData({ ctx }) {
  const { T, own, setOwn, openModel, openLead, notify, track } = ctx;
  const [status, setStatus] = useState({ step: 'idle' });
  const [over, setOver] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [show, setShow] = useState({ fitted: false, test: true });
  const input = useRef(null);

  const load = async (getRows, name, hint) => {
    setStatus({ step: 'reading' });
    try {
      const rows = await getRows();
      if (!rows || rows.length < 3) throw new Error('empty');
      const P = profile(rows);
      const map = { ...defaultMap(P), ...(hint ? hint(P) : {}) };
      setOwn({ name, P, map, id: ++seq, truncated: rows.length - 1 > MAX_ROWS, pick: null, h: null });
      setStatus({ step: 'idle' });
      track('own_load', { sample: hint ? 1 : 0, rows: rows.length - 1 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setStatus({ step: 'error', msg: e && e.message === 'nostream' ? T.xlsxOld : T.upErr.read });
    }
  };
  const onFile = f => f && load(async () => (await readFile(f)).rows, f.name);
  const trySample = id => load(async () => sampleRows(seriesFor(id), T), T.datasets[id].name,
    P => ({ drivers: P.cols.filter(c => c.type === 'num' && c.k >= 2).map(c => c.k), agg: id === 'fuel' ? 'mean' : 'sum' }));

  const built = useMemo(() => (own ? buildSeries(own.P, own.map) : null), [own && own.P, own && own.map]);
  const S = built && built.S ? built.S : null;
  const ranking = useRanking(S);

  if (!own) return <Upload {...{ T, status, over, setOver, onFile, trySample, input, track }} />;

  const P = own.P, map = own.map;
  const setMap = patch => setOwn({ ...own, map: { ...map, ...patch }, pick: null, h: null });
  const dateCols = P.cols.filter(c => c.type === 'date'), numCols = P.cols.filter(c => c.type === 'num' && c.k !== map.date);
  const fmt = makeFmt(T, S ? S.dec : 2);
  const head = (
    <Panel title={T.mapTitle} sub={T.upLoaded(own.name, fmt.int(P.body.length), fmt.int(P.head.length))} className="fc-map-panel"
      aside={<Button icon="reset" onClick={() => { setOwn(null); track('own_reset'); }}>{T.upOther}</Button>}>
      <div className="fc-map">
        <Field label={T.mapDate}>
          <Select label={T.mapDate} value={String(map.date)} onChange={v => setMap({ date: Number(v) })}
            options={dateCols.length ? dateCols.map(c => ({ value: String(c.k), label: c.name })) : [{ value: '-1', label: T.none }]} />
        </Field>
        <Field label={T.mapValue}>
          <Select label={T.mapValue} value={String(map.value)} onChange={v => setMap({ value: Number(v), drivers: map.drivers.filter(k => k !== Number(v)) })}
            options={numCols.length ? numCols.map(c => ({ value: String(c.k), label: c.name })) : [{ value: '-1', label: T.none }]} />
        </Field>
        <Field label={T.mapAgg}>
          <Segmented label={T.mapAgg} value={map.agg} onChange={v => setMap({ agg: v, gaps: 'auto' })} options={['sum', 'mean', 'last'].map(k => ({ value: k, label: T.aggOpt[k] }))} />
        </Field>
        <Field label={T.mapFreq}>
          <Select label={T.mapFreq} value={map.freq} onChange={v => setMap({ freq: v })}
            options={['auto', 'D', 'W', 'M', 'Q', 'Y'].map(k => ({ value: k, label: k === 'auto' && S ? `${T.freqOpt.auto} (${T.freqOpt[S.freq].toLowerCase()})` : T.freqOpt[k] }))} />
        </Field>
        <Field label={T.mapSeason}>
          <Select label={T.mapSeason} value={String(map.season)} onChange={v => setMap({ season: v })}
            options={['auto', '0', '4', '7', '12', '52'].map(k => ({ value: k, label: k === 'auto' && S ? `${T.seasonOpt.auto} (${T.seasonName[S.m] ?? S.m})` : T.seasonOpt[k] }))} />
        </Field>
        {built && built.info && built.info.gaps > 0 && (
          <Field label={T.mapGaps}>
            <Segmented label={T.mapGaps} value={map.gaps === 'auto' ? built.info.gapsMode : map.gaps} onChange={v => setMap({ gaps: v })} options={['zero', 'interp'].map(k => ({ value: k, label: T.gapsOpt[k] }))} />
          </Field>
        )}
      </div>
      {numCols.length > 1 && (
        <div className="fc-drivers">
          <span className="fc-field-label">{T.mapDrivers}</span>
          <div className="fc-chips sm">
            {numCols.filter(c => c.k !== map.value).map(c => {
              const on = map.drivers.includes(c.k);
              return <button key={c.k} type="button" className={'fc-chip sm' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setMap({ drivers: on ? map.drivers.filter(k => k !== c.k) : [...map.drivers, c.k] })}><Icon name={on ? 'check' : 'sliders'} size={13} />{c.name}</button>;
            })}
          </div>
          <small className="muted">{T.driversHint}</small>
        </div>
      )}
      {built && built.info && (
        <div className="fc-summary">
          <span className="fc-pill strong"><Icon name="clock" size={14} />{T.summary(built.info.n, fmt.dateLong(built.info.from, built.info.freq), fmt.dateLong(built.info.to, built.info.freq), built.info.freq, T)}</span>
          <span className="fc-pill">{T.detected(built.info.m, T)}</span>
          {built.info.gaps > 0 && <span className="fc-pill">{T.gapsFilled(fmt.int(built.info.gaps), built.info.gapsMode)}</span>}
          {map.drivers.length > 0 && <span className={'fc-pill' + (built.info.future ? '' : ' warn')}>{T.futureRows(fmt.int(built.info.future))}</span>}
          {built.info.cut > 0 && <span className="fc-pill warn">{T.truncated(fmt.int(S.y.length))}</span>}
          {own.truncated && <span className="fc-pill warn">{T.upErr.large}</span>}
        </div>
      )}
      {built && built.err && <p className="fc-error" role="alert"><Icon name="warning" size={16} />{T.upErr[built.err] || T.upErr.read}</p>}
    </Panel>
  );
  if (!S) return head;

  const n = S.y.length, info = seriesInfo(S);
  const canForecast = id => id === 'ensemble' || applies(BY_ID[id], info) === true;
  const done = ranking.done >= ranking.total;
  const best = ranking.ok.find(r => canForecast(r.id)) || ranking.ok[0];
  const chosen = own.pick && ranking.ok.some(r => r.id === own.pick) ? own.pick : best ? best.id : null;
  const row = ranking.ok.find(r => r.id === chosen);
  const hCap = Math.max(S.H, Math.floor(n / 2));
  const hOpts = [...new Set([...(HORIZONS[S.freq] || []).filter(v => v <= hCap), S.H])].sort((a, b) => a - b);
  const hWant = own.h && hOpts.includes(own.h) ? own.h : S.H;
  const fcOk = done && chosen && canForecast(chosen);
  const h = chosen === 'drivers' && S.drivers ? Math.min(hWant, S.drivers.Xf.length) : hWant;

  return (
    <>
      {head}
      <OwnResult {...{ T, S, own, setOwn, ranking, done, chosen, row, h, hOpts, hWant, fcOk, fmt, show, setShow, showAll, setShowAll, openModel, openLead, notify, track, built }} />
    </>
  );
}

function OwnResult({ T, S, own, setOwn, ranking, done, chosen, row, h, hOpts, hWant, fcOk, fmt, show, setShow, showAll, setShowAll, openModel, openLead, notify, track, built }) {
  const n = S.y.length;
  const run = useMemo(() => {
    if (!fcOk) return null;
    try { const r = runModel(chosen, S, defaultParams(chosen, S), h); return r.fc.every(f => Number.isFinite(f.mean)) ? r : null; } catch { return null; }
  }, [fcOk, chosen, S, h]);
  const fdates = useMemo(() => futureDates(S.dates[n - 1], h, S.freq), [S, h]);
  const from = showAll || !SHOW[S.freq] ? 0 : Math.max(0, n - SHOW[S.freq]);
  const name = chosen ? T.models[chosen].name : '';
  const valueName = own.P.cols[own.map.value] ? own.P.cols[own.map.value].name : T.xl.head.value;
  const summary = T.summary(n, fmt.dateLong(S.dates[0], S.freq), fmt.dateLong(S.dates[n - 1], S.freq), S.freq, T);
  const test = row && show.test ? { from: n - S.H, fc: row.fc } : null;
  const naiveRow = ranking.ok.find(r => r.id === (S.m > 1 ? 'snaive' : 'naive'));

  const dlXlsx = () => {
    const fcT = forecastTable(S, run, T, fdates);
    const sheets = [
      { name: T.ownSheet.fc, head: fcT.head, rows: fcT.rows, widths: [14, 14, 14, 14, 14, 14] },
      { name: T.ownSheet.data, head: [T.fcCols.date, valueName, T.legend.fitted], rows: S.y.map((v, t) => [S.dates[t], v, r4(run.fitted[t])]), widths: [14, 18, 20] },
      { name: T.ownSheet.rank, head: [T.cmpCols.model, 'MASE', 'MAPE', 'MAE', T.cmpCols.bias, T.cmpCols.cover], rows: ranking.ok.map(r => [T.models[r.id].name, r4(r.mase), r4(r.mape), r4(r.mae), r4(r.bias), r4(r.cover80)]), widths: [30, 10, 10, 12, 12, 16] },
      { name: T.ownSheet.about, head: ['', ''], widths: [18, 90], wrap: true, rows: [
        [T.ownAbout.file, own.name], [T.ownAbout.series, `${valueName}, ${summary}`],
        [T.ownAbout.model, `${name}, MASE ${fmt.dec2(row.mase)}`], [T.ownAbout.check, T.rankedSub(S.H, T, S.freq)], ['', T.ownAbout.note],
      ] },
    ];
    downloadForecastXlsx(`forecast_${chosen}`, sheets);
    track('download', { what: 'own_xlsx', model: chosen });
    notify(T.dlOwnXlsx, 'download');
  };
  const dlCsv = () => { downloadForecastCsv(`forecast_${chosen}`, S, run, T, fdates); track('download', { what: 'own_csv', model: chosen }); notify(T.dlOwnCsv, 'download'); };

  return (
    <>
      <div className="grid fc-main">
        <Panel className="fc-chart-panel" title={done && chosen ? name : T.ranked} sub={done && chosen ? `${T.chosen} · ${valueName}` : T.checking(ranking.done, ranking.total)}
          aside={(
            <div className="fc-controls">
              {hOpts.length > 1 && <Select label={T.mapH} value={String(hWant)} onChange={v => setOwn({ ...own, h: Number(v) })} options={hOpts.map(k => ({ value: String(k), label: `${T.mapH}: ${T.per(k, S.freq, T)}` }))} />}
            </div>
          )}>
          {!done && <div className="fc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={ranking.total} aria-valuenow={ranking.done}><span style={{ width: (ranking.done / ranking.total) * 100 + '%' }} /></div>}
          <ForecastChart dates={[...S.dates, ...fdates]} y={S.y} fitted={run ? run.fitted : null} fc={run ? run.fc : null} hideFuture={!run}
            test={test} show={{ fitted: show.fitted && !!run, test: show.test }} freq={S.freq} fmt={fmt} T={T} from={from} label={`${name}: ${valueName}`} />
          <div className="fc-chart-foot">
            <ChartLegend T={T} show={{ fitted: show.fitted && !!run, test: show.test }} hasBand={!!run && run.fc.some(f => Number.isFinite(f.lo80))} hasTest={!!row} />
            <div className="fc-toggles">
              <label className="fc-check"><input type="checkbox" checked={show.fitted} onChange={e => setShow(s => ({ ...s, fitted: e.target.checked }))} />{T.showFitted}</label>
              <label className="fc-check"><input type="checkbox" checked={show.test} onChange={e => setShow(s => ({ ...s, test: e.target.checked }))} />{T.showTest}</label>
              {SHOW[S.freq] && n > SHOW[S.freq] && <label className="fc-check"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />{T.showAll}</label>}
            </div>
          </div>
          {done && chosen && !fcOk && <p className="note"><Icon name="info" size={15} /><span>{T.noFuture}</span></p>}
        </Panel>

        <div className="side-stack fc-side">
          <Panel title={T.metricsTitle} sub={T.metricsSub(S.H, T, S.freq)}>
            {row ? <MetricTiles m={row} T={T} fmt={fmt} /> : <div className="fc-metrics-ph" aria-hidden="true">{[0, 1, 2, 3, 4].map(k => <i key={k} />)}</div>}
            {row && naiveRow && chosen !== naiveRow.id && <p className="note"><Icon name="spark" size={15} /><span><b>{T.vsNaive(row.mase / naiveRow.mase)}</b> ({T.models[naiveRow.id].name}, MASE {fmt.dec2(naiveRow.mase)})</span></p>}
          </Panel>
          <Panel title={T.downloadsTitle}>
            <div className="fc-dl">
              <Button kind="primary" icon="download" disabled={!run} onClick={dlXlsx}>{T.dlOwnXlsx}</Button>
              <Button icon="download" disabled={!run} onClick={dlCsv}>{T.dlOwnCsv}</Button>
              {chosen && <Button icon="book" onClick={() => openModel(chosen)}>{T.howModel}</Button>}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title={T.ranked} sub={T.rankedSub(S.H, T, S.freq)} className="flat-panel">
        {ranking.ok.length > 0
          ? <Leaderboard lb={ranking} T={T} fmt={fmt} active={chosen} onPick={id => { setOwn({ ...own, pick: id }); track('own_pick', { model: id }); }} />
          : <div className="fc-lb-ph" aria-hidden="true">{[0, 1, 2, 3].map(k => <i key={k} />)}</div>}
        <p className="note"><Icon name="info" size={15} /><span>{T.chooseHint}</span></p>
        {done && ranking.skipped.length > 0 && <p className="note"><Icon name="info" size={15} /><span><b>{T.cmpSkipped}:</b> {ranking.skipped.map(r => T.models[r.id].name).join(', ')}</span></p>}
      </Panel>

      <div className="grid fc-two">
        <Panel title={T.fcTable} sub={run ? `${name} · ${T.per(h, S.freq, T)} · ${T.fcTableNote}` : null} className="flat-panel">
          {run ? (
            <div className="table-scroll fc-fc-table">
              <table className="data-table plain">
                <thead><tr>{['date', 'mean', 'lo80', 'hi80'].map(k => <th key={k} className={k === 'date' ? '' : 'num'}>{T.fcCols[k]}</th>)}</tr></thead>
                <tbody>{run.fc.map((f, k) => <tr key={k}><td>{fmt.dateLong(fdates[k], S.freq)}</td><td className="num strong">{fmt.val(f.mean)}</td><td className="num">{fmt.val(f.lo80)}</td><td className="num">{fmt.val(f.hi80)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="muted small">{done ? T.noFuture : T.checking(ranking.done, ranking.total)}</p>}
        </Panel>
        <Panel title={T.readTitle}>
          <ul className="check-list">{T.readItems.map((t, i) => <li key={i}><Icon name="bulb" size={16} /><span>{t}</span></li>)}</ul>
          {row && (
            <div className="fc-cta-actions">
              <Button kind="primary" icon="mail" onClick={() => openLead('own', T.leadMsg({ n: `${valueName}, ${summary}`, model: name, mase: fmt.dec2(row.mase) }))}>{T.ctaLong}</Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function Upload({ T, status, over, setOver, onFile, trySample, input, track }) {
  const fmt0 = makeFmt(T, 0);
  return (
    <>
      <div className="grid fc-main">
        <Panel className="fc-upload">
          <div className={'fc-drop' + (over ? ' dragging' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}>
            <span className="fc-drop-icon"><Icon name="upload" size={28} /></span>
            <strong>{status.step === 'reading' ? T.upReading : T.upDrop}</strong>
            <div className="fc-drop-actions">
              <Button kind="primary" icon="file" onClick={() => input.current && input.current.click()}>{T.upPick}</Button>
              <Button icon="play" onClick={() => trySample('cafe')}>{T.upSample}</Button>
            </div>
            {status.step === 'error' && <p className="fc-error" role="alert"><Icon name="warning" size={16} />{status.msg}</p>}
            <p className="fc-privacy"><Icon name="lock" size={15} />{T.upPrivacy}</p>
            <p className="muted small">{T.upLimits}</p>
          </div>
          <input ref={input} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv" hidden onChange={e => { onFile(e.target.files[0]); e.target.value = ''; }} />
        </Panel>
        <Panel title={T.formatTitle} className="fc-format">
          <ul className="check-list">{T.formatItems.map((t, i) => <li key={i}><Icon name="check" size={16} /><span>{t}</span></li>)}</ul>
          <div className="fc-format-table" aria-hidden="true">
            <div className="fc-ft-row head">{T.formatHead.map(h => <span key={h}>{h}</span>)}</div>
            <div className="fc-ft-row"><span>2025-06-02</span><span>{fmt0.int(1240)}</span><span>24</span></div>
            <div className="fc-ft-row"><span>2025-06-09</span><span>{fmt0.int(1410)}</span><span>27</span></div>
            <div className="fc-ft-row fut"><span>2025-06-16</span><span className="fc-blank" /><span>25</span></div>
            <small><i className="fc-sw fc" />{T.formatFuture}</small>
          </div>
        </Panel>
      </div>

      <Panel title={T.samplesTitle} sub={T.samplesSub} className="flat-panel">
        <div className="fc-samples">
          {DATASET_IDS.map((id, k) => {
            const S = seriesFor(id), D = T.datasets[id];
            return (
              <article key={id} className="fc-sample" style={{ animationDelay: k * 0.04 + 's' }}>
                <div className="fc-sample-top">
                  <h4>{D.name}</h4>
                  <small>{T.per(S.y.length, S.freq, T)} · {D.unit}{S.drivers ? ` · ${T.caps.drivers.toLowerCase()}` : ''}</small>
                </div>
                <p>{D.look}</p>
                <div className="fc-sample-actions">
                  <Button kind="primary" icon="play" onClick={() => { trySample(id); track('own_sample', { d: id }); }}>{T.sampleUse}</Button>
                  <Button icon="download" onClick={() => { downloadSample(S, T, 'csv'); track('download', { what: 'csv', d: id, where: 'own' }); }}>CSV</Button>
                  <Button icon="download" onClick={() => { downloadSample(S, T, 'xlsx'); track('download', { what: 'xlsx', d: id, where: 'own' }); }}>Excel</Button>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
