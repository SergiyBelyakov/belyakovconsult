import { useEffect, useMemo, useState } from 'react';
import { Panel, Button, Select } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { seriesInfo, originsOf, rolling } from '../engine/evaluate.js';
import { MODELS, BY_ID, applies, defaultParams } from '../engine/models.js';
import { DATASET_IDS } from '../data.js';
import { makeFmt } from '../format.js';
import { ForecastChart, ChartLegend, SER } from '../charts.jsx';
import { seriesFor } from '../common.jsx';

export function Leaderboard({ lb, T, fmt, sel, toggle, onOpen, active, onPick }) {
  const max = Math.max(1.6, ...lb.ok.map(r => Math.min(r.mase, 4)));
  return (
    <div className="table-scroll">
      <table className="data-table plain fc-lb">
        <thead><tr><th>{T.cmpCols.model}</th><th className="fc-lb-bar">{T.cmpCols.mase}</th><th className="num">{T.cmpCols.mape}</th><th className="num">{T.cmpCols.mae}</th><th className="num">{T.cmpCols.bias}</th><th className="num">{T.cmpCols.cover}</th>{toggle && <th className="num">{T.cmpShow}</th>}</tr></thead>
        <tbody>
          {lb.ok.map((r, k) => {
            const on = sel ? sel.indexOf(r.id) : -1;
            return (
              <tr key={r.id} className={(active === r.id ? 'fc-row-on ' : '') + (onPick ? 'fc-row-pick' : '')} onClick={onPick ? () => onPick(r.id) : undefined}>
                <td className="strong">
                  <span className="fc-lb-rank">{k + 1}</span>
                  {onOpen ? <button type="button" className="link-btn" onClick={e => { e.stopPropagation(); onOpen(r.id); }}>{T.models[r.id].name}</button> : T.models[r.id].name}
                  {k === 0 && <span className="fc-best">{T.bestTag}</span>}
                </td>
                <td className="fc-lb-bar">
                  <span className="fc-lb-cell">
                    <span className="fc-bar"><i style={{ width: (Math.min(r.mase, 4) / max) * 100 + '%' }} className={r.mase < 1 ? 'good' : ''} /><em style={{ left: (1 / max) * 100 + '%' }} /></span>
                    <b>{fmt.dec2(r.mase)}</b>
                  </span>
                </td>
                <td className="num">{Number.isFinite(r.mape) ? fmt.pct1(r.mape) : '·'}</td>
                <td className="num">{fmt.val(r.mae)}</td>
                <td className="num">{fmt.signed(r.bias)}</td>
                <td className="num">{Number.isFinite(r.cover80) ? fmt.pct0(r.cover80) : '·'}</td>
                {toggle && <td className="num"><label className="fc-dotcheck" onClick={e => e.stopPropagation()}><input type="checkbox" checked={on >= 0} onChange={() => toggle(r.id)} /><i style={on >= 0 ? { background: SER[on % SER.length], borderColor: SER[on % SER.length] } : null} /></label></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Ковзне походження: кожна модель проходить K перевірок з тим самим горизонтом; рахуємо поступово,
// щоб таблиця наповнювалася на очах, а сторінка не зависала на довгих щоденних рядах
function useRolling(S) {
  const [st, setSt] = useState({ rows: [], done: 0, total: MODELS.length, cuts: [] });
  useEffect(() => {
    let alive = true, i = 0;
    const cuts = originsOf(S, S.H, 4), info = seriesInfo(S), rows = [];
    setSt({ rows: [], done: 0, total: MODELS.length, cuts });
    const step = () => {
      if (!alive) return;
      if (i >= MODELS.length) return;
      const m = MODELS[i++];
      const ok = !cuts.length ? 'short' : m.id === 'ensemble' ? true : applies(BY_ID[m.id], { ...info, n: cuts[0], futureDrivers: info.drivers });
      if (ok !== true) rows.push({ id: m.id, skip: ok });
      else {
        try { const r = rolling(m.id, S, defaultParams(m.id, S), S.H, cuts); rows.push({ id: m.id, ...r }); } catch (e) { rows.push({ id: m.id, skip: 'error' }); }
      }
      setSt({ rows: rows.slice(), done: i, total: MODELS.length, cuts });
      setTimeout(step, 0);
    };
    const t = setTimeout(step, 30);
    return () => { alive = false; clearTimeout(t); };
  }, [S]);
  // перемоги: у скількох перевірках модель найточніша
  const ok = st.rows.filter(r => !r.skip && Number.isFinite(r.mase)).sort((a, b) => a.mase - b.mase);
  const wins = Object.fromEntries(ok.map(r => [r.id, 0]));
  if (ok.length) st.cuts.forEach((_, f) => { const b = ok.reduce((x, y) => (y.folds[f].m.mase < x.folds[f].m.mase ? y : x), ok[0]); wins[b.id]++; });
  return { ...st, ok, wins, skipped: st.rows.filter(r => r.skip || !Number.isFinite(r.mase)) };
}

function Folds({ S, cuts, T, fmt }) {
  const n = S.y.length, H = S.H, from = Math.max(0, cuts[0] - Math.max(2 * H, 3 * (S.m || 4)));
  const X = i => ((i - from) / (n - from)) * 100;
  return (
    <div className="fc-folds" aria-label={T.foldsTitle}>
      {cuts.map((c, k) => (
        <div key={c} className="fc-fold">
          <span className="fc-fold-n">{k + 1}</span>
          <span className="fc-fold-track">
            <i className="fc-fold-train" style={{ left: 0, width: X(c) + '%' }} />
            <i className="fc-fold-test" style={{ left: X(c) + '%', width: X(Math.min(n, c + H)) - X(c) + '%' }} />
          </span>
          <small>{fmt.dateShort(S.dates[c])} … {fmt.dateShort(S.dates[Math.min(n, c + H) - 1])}</small>
        </div>
      ))}
      <div className="fc-legend small"><span><i className="fc-sw fc-fold-sw" />{T.foldTrain}</span><span><i className="fc-sw fc-fold-sw test" />{T.foldTest(T.per(H, S.freq, T))}</span></div>
    </div>
  );
}

export function RollingBoard({ st, T, fmt, sel, toggle, onOpen }) {
  const max = Math.max(1.6, ...st.ok.map(r => Math.min(Math.max(r.mase, ...r.folds.map(f => f.m.mase)), 4)));
  const K = st.cuts.length;
  return (
    <div className="table-scroll">
      <table className="data-table plain fc-lb fc-roll">
        <thead><tr><th>{T.cmpCols.model}</th><th className="fc-lb-bar">{T.cmpCols.maseMean(K)}</th><th className="num">{T.cmpCols.wins}</th><th className="num">{T.cmpCols.mape}</th><th className="num">{T.cmpCols.bias}</th><th className="num">{T.cmpCols.cover}</th>{toggle && <th className="num">{T.cmpShow}</th>}</tr></thead>
        <tbody>
          {st.ok.map((r, k) => {
            const on = sel ? sel.indexOf(r.id) : -1;
            return (
              <tr key={r.id}>
                <td className="strong">
                  <span className="fc-lb-rank">{k + 1}</span>
                  <button type="button" className="link-btn" onClick={() => onOpen(r.id)}>{T.models[r.id].name}</button>
                  {k === 0 && <span className="fc-best">{T.bestTag}</span>}
                </td>
                <td className="fc-lb-bar">
                  <span className="fc-lb-cell">
                    <span className="fc-bar" title={r.folds.map((f, i) => `${i + 1}: ${fmt.dec2(f.m.mase)}`).join(' · ')}>
                      <i style={{ width: (Math.min(r.mase, 4) / max) * 100 + '%' }} className={r.mase < 1 ? 'good' : ''} />
                      <em style={{ left: (1 / max) * 100 + '%' }} />
                      {r.folds.map((f, i) => <u key={i} style={{ left: (Math.min(f.m.mase, 4) / max) * 100 + '%' }} />)}
                    </span>
                    <b>{fmt.dec2(r.mase)}</b>
                  </span>
                </td>
                <td className="num">{st.wins[r.id] ? `${st.wins[r.id]} / ${K}` : '·'}</td>
                <td className="num">{Number.isFinite(r.mape) ? fmt.pct1(r.mape) : '·'}</td>
                <td className="num">{fmt.signed(r.bias)}</td>
                <td className="num">{Number.isFinite(r.cover80) ? fmt.pct0(r.cover80) : '·'}</td>
                {toggle && <td className="num"><label className="fc-dotcheck"><input type="checkbox" checked={on >= 0} onChange={() => toggle(r.id)} /><i style={on >= 0 ? { background: SER[on % SER.length], borderColor: SER[on % SER.length] } : null} /></label></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Compare({ ctx }) {
  const { T, cmpDs, setCmpDs, openModel, track } = ctx;
  const S = useMemo(() => seriesFor(cmpDs), [cmpDs]);
  const fmt = useMemo(() => makeFmt(T, S.dec), [T, S.dec]);
  const st = useRolling(S);
  const done = st.done >= st.total;
  const naiveId = S.m > 1 ? 'snaive' : 'naive';
  const [sel, setSel] = useState([]);
  const [focus, setFocus] = useState(null);
  const [hidden, setHidden] = useState({});
  useEffect(() => { setSel([]); setHidden({}); }, [S]);
  useEffect(() => {
    if (!done) return;
    const top = st.ok.slice(0, 3).map(r => r.id);
    if (!top.includes(naiveId) && st.ok.some(r => r.id === naiveId)) top.push(naiveId);
    setSel(top);
  }, [done, S]);
  // sel: слоти кольорів (id або null). Знята модель звільняє свій слот, тож решта ліній не перефарбовується
  const toggle = id => setSel(s => {
    const i = s.indexOf(id);
    if (i >= 0) { const t = s.slice(); t[i] = null; while (t.length && t[t.length - 1] == null) t.pop(); return t; }
    if (s.filter(Boolean).length >= SER.length) return s;
    const free = s.indexOf(null);
    if (free < 0) return [...s, id];
    const t = s.slice(); t[free] = id; return t;
  });
  const n = S.y.length, from = Math.max(0, n - S.H - Math.max(S.H * 3, S.m > 1 ? 2 * S.m : 24));
  const last = st.cuts.length - 1;
  const overlays = sel.map((id, k) => { const r = id && st.ok.find(x => x.id === id); return r ? { id, label: T.models[id].name, color: SER[k % SER.length], from: n - S.H, values: r.folds[last].fc.map(f => f.mean) } : null; }).filter(Boolean);
  const best = st.ok[0], naive = st.ok.find(r => r.id === naiveId);
  const D = T.datasets[S.id];

  return (
    <>
      <Panel title={D.name} sub={D.desc} className="fc-cmp-head"
        aside={<Select label={T.dataLabel} value={cmpDs} onChange={v => { setCmpDs(v); track('compare', { d: v }); }} options={DATASET_IDS.map(id => ({ value: id, label: T.datasets[id].name }))} />}>
        {done && best
          ? <p className="fc-insight"><Icon name="spark" size={16} /><span>{T.cmpBest(`${T.models[best.id].name} (MASE ${fmt.dec2(best.mase)}, ${T.winsTxt(st.wins[best.id] || 0, st.cuts.length)})`, naive ? `${T.models[naive.id].name}, MASE ${fmt.dec2(naive.mase)}, ${st.ok.indexOf(naive) + 1} / ${st.ok.length}` : '·')}</span></p>
          : <div className="fc-cmp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={st.total} aria-valuenow={st.done}><span>{T.checking(st.done, st.total)}</span><i><b style={{ width: (100 * st.done) / st.total + '%' }} /></i></div>}
      </Panel>

      <div className="grid fc-two">
        <Panel title={T.foldsTitle} sub={T.foldsSub(st.cuts.length, T.per(S.H, S.freq, T))}>
          {st.cuts.length > 0 && <Folds S={S} cuts={st.cuts} T={T} fmt={fmt} />}
          <p className="ex-note">{T.foldsNote}</p>
        </Panel>
        <Panel title={T.cmpChart} sub={T.maxShown}>
          <ForecastChart dates={S.dates} y={S.y} fitted={null} fc={null} hideFuture test={{ from: n - S.H, fc: [] }} overlays={overlays.filter(o => !hidden[o.id])}
            show={{ fitted: false, test: true }} freq={S.freq} fmt={fmt} T={T} from={from} height={260} label={T.cmpChart} focus={focus} nav />
          <div className="fc-chart-foot">
            <ChartLegend T={T} show={{ fitted: false, test: true }} hasBand={false} hasTest testCls="tdot" overlays={overlays} focus={focus} setFocus={setFocus} hidden={hidden} setHidden={setHidden} />
            <small className="fc-lg-hint">{T.legendHint}</small>
          </div>
        </Panel>
      </div>

      <Panel title={T.cmpTable} sub={T.cmpSubRoll(st.cuts.length, T.per(S.H, S.freq, T))} className="flat-panel">
        {st.ok.length ? <RollingBoard st={st} T={T} fmt={fmt} sel={sel} toggle={done ? toggle : null} onOpen={id => openModel(id, cmpDs)} /> : <div className="fc-lb-ph"><i /><i /><i /></div>}
        {done && st.skipped.length > 0 && <p className="note"><Icon name="info" size={15} /><span><b>{T.cmpSkipped}:</b> {st.skipped.map(r => T.models[r.id].name).join(', ')}</span></p>}
        <p className="note"><Icon name="info" size={15} /><span>{T.cmpDots}</span></p>
      </Panel>

      <div className="grid fc-two">
        <Panel title={T.cmpWhyTitle}>
          <ul className="check-list">{T.cmpWhy.map((t, i) => <li key={i}><Icon name="bulb" size={16} /><span>{t}</span></li>)}</ul>
        </Panel>
        <Panel title={T.metricsTitle}>
          <dl className="glossary">{['mase', 'mape', 'mae', 'bias', 'cover'].map(k => <div key={k}><dt>{T.metric[k][0]}</dt><dd>{T.metric[k][1]}</dd></div>)}</dl>
        </Panel>
      </div>
    </>
  );
}
