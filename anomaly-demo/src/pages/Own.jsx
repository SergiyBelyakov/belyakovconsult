// Лід-магніт: пошук аномалій у власному файлі. Читання, розрахунок і вивантаження відбуваються в браузері.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Button, Segmented } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import Cloud3D from '../Cloud3D.jsx';
import Cloud2D from '../Cloud2D.jsx';
import { makeEngine, tally, METHODS } from '../engine.js';
import { readFile, parseCsv, profile, buildOwn, parseNum, parseDate, MAX_ROWS } from '../fileio.js';
import { Gauge } from './controls.jsx';
import { logQ } from '../stats.js';
import { download, csvCell } from '../util.js';

const LP05 = Math.log(0.05);
let seq = 0;

function sampleCsv(ctx) {
  const { T, ds, lang } = ctx;
  const pad = v => String(v).padStart(2, '0');
  const lines = [T.own.sampleHead.join(',')];
  ds.rows.forEach(x => {
    const d = new Date(Date.UTC(2026, 0, 1 + x.day)), h = Math.floor(x.t), m = Math.min(59, Math.round((x.t - h) * 60));
    lines.push([x.id, `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(h)}:${pad(m)}`, T.groupsShort[ds.groups[x.g].id], ds.cps[x.cp].name[lang], x.amount.toFixed(2), x.lag].map(csvCell).join(','));
  });
  return lines.join('\n');
}

// Пояснення для запису з файлу: колонка, значення, медіана групи, наскільки рідко
function ownReasons(ctx, O, i) {
  const { T, f } = ctx, { ds, E, res, P } = O;
  return E.reasons(res, i).filter(r => r.lp < LP05 && !(ds.missing && ds.missing[i * ds.d + r.j])).slice(0, 4).map(r => {
    const ft = ds.features[r.j];
    let text;
    if (ft.derived === 'off') { const p = parseDate(P.body[i][O.map.date]); text = T.reasons.offHours(p && p.hour != null ? f.time(p.hour) : ''); }
    else if (ft.derived === 'we') { const p = parseDate(P.body[i][O.map.date]); text = T.reasons.weekend(p ? T.days[((p.day % 7) + 11) % 7] : ''); }
    else {
      const v = parseNum(P.body[i][ft.col]), med = ft.log ? 10 ** r.med : r.med;
      const k = v > 0 && med > 0 ? (v >= med ? v / med : med / v) : 0;
      text = T.reasons.generic(ft.name, f.num(v), f.num(med), k >= 1.5 ? f.times(k) : 0, v >= med);
    }
    return { id: ft.id, text, lp: r.lp, z: r.z };
  });
}

function OwnCard({ ctx, O, i, th }) {
  const { T, f } = ctx, { ds, P, map } = O;
  if (i == null) return <div className="an-card an-card-empty"><Icon name="cloud" size={28} /><p>{T.card.empty}</p></div>;
  const D = O.D, lvl = D[i], hot = lvl >= th;
  const lines = ownReasons(ctx, O, i);
  const title = map.id >= 0 ? P.body[i][map.id] : `${T.own.row} ${i + 2}`;
  return (
    <div className="an-card">
      <div className="an-card-head">
        <div><span className="mono muted small">{ds.groups[ds.gi[i]].name}</span><h3>{title}</h3></div>
        <span className={'an-badge ' + (hot ? 'hot' : lvl >= th - 1 ? 'near' : 'ok')}>{hot ? T.card.signal : lvl >= th - 1 ? T.card.near : T.card.ok}</span>
      </div>
      <h4>{T.card.level}: <b className={hot ? 'ruby' : ''}>{f.sigma(lvl)}</b></h4>
      <Gauge D={lvl} th={th} f={f} />
      <p className="muted small an-card-meta">{T.card.rarer(f.oneIn(Math.exp(logQ(Math.max(0, lvl)))))} · {T.card.rank(f.int(O.rank[i] + 1), f.int(ds.n))}</p>
      <h4>{hot ? T.card.why : T.card.whyNot}</h4>
      {lines.length ? (
        <ul className="an-reasons">{lines.map(l => <li key={l.id}><span className="an-reason-text">{l.text}</span><span className="an-reason-meta"><span className="mini-track"><i style={{ width: `${Math.min(100, (Math.abs(l.z) / 8) * 100)}%` }} /></span><small>{T.card.rareIn(f.oneIn(Math.exp(l.lp)))}</small></span></li>)}</ul>
      ) : <p className="muted small">{T.card.nothingRare}</p>}
      <h4>{T.own.values}</h4>
      <dl className="case-fields an-values">{P.head.slice(0, 14).map((h, k) => <div key={k}><dt>{h}</dt><dd>{P.body[i][k]}</dd></div>)}</dl>
      <p className="muted small">{T.own.note}</p>
    </div>
  );
}

export default function Own({ ctx }) {
  const { T, f, gl, notify, setLead } = ctx;
  const [state, setState] = useState({ step: 'idle' });
  const [map, setMap] = useState(null);
  const [method, setMethod] = useState('dev');
  const [cx, setCx] = useState('group');
  const [th, setTh] = useState(3.5);
  const [sel, setSel] = useState(null);
  const [over, setOver] = useState(false);
  const [fly, setFly] = useState(null);
  const input = useRef(null), flyKey = useRef(0);

  const load = async (getRows, name) => {
    setState({ step: 'reading' });
    try {
      const rows = await getRows();
      if (!rows || rows.length < 3) throw new Error('empty');
      const P = profile(rows);
      setMap(P.def); setSel(null);
      setState({ step: 'ready', P, name, truncated: rows.length - 1 > MAX_ROWS, id: ++seq });
    } catch (e) {
      setState({ step: 'error', msg: e && e.message === 'nostream' ? T.own.xlsxOld : T.own.failed });
    }
  };
  const onFile = file => file && load(async () => (await readFile(file)).rows, file.name);
  const sample = () => load(async () => parseCsv(sampleCsv(ctx)), T.own.sampleName);

  const O = useMemo(() => {
    if (state.step !== 'ready' || !map || !map.feats.length) return null;
    const ds = buildOwn(state.P, map, { offHours: T.features.offHours, weekend: T.features.weekend, all: T.own.allRecords, other: T.own.otherGroup });
    if (!ds.d) return null;
    return { ds, E: makeEngine(ds), P: state.P, map, key: state.id + ':' + JSON.stringify(map) };
  }, [state, map]);
  const knnOk = O && O.ds.n <= 20000;
  const m = method === 'knn' && !knnOk ? 'dev' : method;
  const R = useMemo(() => {
    if (!O) return null;
    const res = O.E.run(O.ds.groups.length > 1 ? cx : 'all', O.ds.features.map(x => x.id));
    O.E.ensure(res, m);
    const D = res.D[m], pos = O.E.positions(res, m);
    const order = Int32Array.from({ length: O.ds.n }, (_, i) => i).sort((a, b) => D[b] - D[a]);
    const rank = new Int32Array(O.ds.n); order.forEach((i, k) => { rank[i] = k; });
    return { res, D, pos, order, rank };
  }, [O, cx, m]);
  const Ox = O && R ? { ...O, ...R } : null;
  const t = useMemo(() => (Ox ? tally(Ox.ds, Ox.D, th) : null), [R, th]);
  const groupF = useMemo(() => (O ? Float32Array.from(O.ds.gi) : null), [O]);
  const bases = useMemo(() => (Ox ? Ox.res.C.bases.map((b, k) => ({ c: b.c, r: Ox.E.shellRadius(Ox.res, m, k, th), label: Ox.res.C.bases.length === 1 ? T.own.allRecords : Ox.ds.groups[k].name, sub: T.groupSub(f.int(b.idx.length), f.int(Ox.ds.groups.length > 1 && Ox.res.C.bases.length > 1 ? t.byG[k] : t.total)), hot: true })) : []), [R, th, t]);
  const dim = useMemo(() => new Array(24).fill(1), []);
  const neigh = useMemo(() => (Ox && sel != null ? Ox.E.neighbors(Ox.res, sel, 6) : []), [R, sel]);

  useEffect(() => {
    if (!Ox) return;
    const G = Ox.res.C.bases.length, Rr = Math.max(17, G * 2.6);
    setFly({ target: [0, 0, 0], dist: G > 1 ? Rr * 3.9 : 34, yaw: 0.5, pitch: 0.45, dur: 0.01, key: ++flyKey.current });
  }, [O && O.key, cx]);

  const exportCsv = () => {
    const { P, ds } = Ox;
    const list = Array.from(Ox.order).filter(i => Ox.D[i] >= th);
    const rows = [[...P.head, 'bc_rank', 'bc_level_sigma', 'bc_flag', 'bc_group', 'bc_reasons'], ...list.map(i => [...P.body[i], Ox.rank[i] + 1, Ox.D[i].toFixed(2), 1, ds.groups[ds.gi[i]].name, ownReasons(ctx, Ox, i).map(l => l.text).join('; ')])];
    download('BC_suspicious_records.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'));
    notify(T.own.exportDone, 'download');
  };

  if (state.step !== 'ready') {
    return (
      <Panel className="an-upload">
        <div className={'an-drop' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}>
          <Icon name="upload" size={30} />
          <strong>{state.step === 'reading' ? T.own.reading : T.own.drop}</strong>
          <span className="muted">{T.own.or}</span>
          <div className="an-drop-actions">
            <Button kind="primary" icon="file" onClick={() => input.current && input.current.click()}>{T.own.pick}</Button>
            <Button icon="cloud" onClick={sample}>{T.own.sample}</Button>
            <Button icon="download" onClick={() => download(T.own.sampleName, sampleCsv(ctx))}>{T.own.sampleFile}</Button>
          </div>
          {state.step === 'error' && <p className="lead-fail" role="alert">{state.msg}</p>}
          <p className="an-privacy"><Icon name="lock" size={15} />{T.own.privacy}</p>
          <p className="muted small">{T.own.limits}</p>
        </div>
        <input ref={input} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv" hidden onChange={e => onFile(e.target.files[0])} />
      </Panel>
    );
  }

  const P = state.P, numCols = P.cols.filter(c => c.type === 'num'), txtCols = P.cols.filter(c => c.type === 'text'), dateCols = P.cols.filter(c => c.type === 'date');
  const toggleFeat = k => setMap({ ...map, feats: map.feats.includes(k) ? map.feats.filter(x => x !== k) : [...map.feats, k] });
  const top = Ox ? Array.from(Ox.order).slice(0, 40) : [];

  return (
    <>
      <Panel title={T.own.mapTitle} sub={T.own.loaded(state.name, f.int(P.body.length), f.int(P.head.length))} aside={<Button icon="reset" onClick={() => setState({ step: 'idle' })}>{T.own.again}</Button>}>
        {state.truncated && <p className="muted small">{T.own.truncated(f.int(MAX_ROWS))}</p>}
        <div className="an-map">
          <div>
            <span className="muted small">{T.own.numeric}</span>
            <div className="chips">{numCols.map(c => <button type="button" key={c.k} className={'chip' + (map.feats.includes(c.k) ? ' active' : '')} aria-pressed={map.feats.includes(c.k)} onClick={() => toggleFeat(c.k)}>{c.name}</button>)}</div>
            {!map.feats.length && <p className="lead-fail">{T.own.needFeat}</p>}
            <small className="muted">{T.own.logNote}</small>
          </div>
          <label><span className="muted small">{T.own.groupCol}</span>
            <select className="glass-control an-select" value={map.group} onChange={e => setMap({ ...map, group: Number(e.target.value) })}><option value={-1}>{T.own.none}</option>{txtCols.map(c => <option key={c.k} value={c.k}>{c.name} ({c.distinct})</option>)}</select></label>
          <label><span className="muted small">{T.own.idCol}</span>
            <select className="glass-control an-select" value={map.id} onChange={e => setMap({ ...map, id: Number(e.target.value) })}><option value={-1}>{T.own.none}</option>{P.cols.map(c => <option key={c.k} value={c.k}>{c.name}</option>)}</select></label>
          <label><span className="muted small">{T.own.dateCol}</span>
            <select className="glass-control an-select" value={map.date} onChange={e => setMap({ ...map, date: Number(e.target.value) })}><option value={-1}>{T.own.none}</option>{dateCols.map(c => <option key={c.k} value={c.k}>{c.name}</option>)}</select>
            {map.date >= 0 && <small className="muted">{T.own.dateFeats}</small>}</label>
        </div>
      </Panel>

      {Ox && (
        <>
          <div className="model-bar an-model glass compact">
            <div className="model-bar-item">
              <span className="muted small">{T.methodLabel}</span>
              <Segmented value={m} onChange={setMethod} label={T.methodLabel} options={METHODS.filter(x => x !== 'knn' || knnOk).map(x => ({ value: x, label: T.methods[x] }))} />
              {!knnOk && <small className="muted">{T.own.kOnlySmall}</small>}
            </div>
            {Ox.ds.groups.length > 1 && (
              <div className="model-bar-item">
                <span className="muted small">{T.contextLabel}</span>
                <Segmented value={cx} onChange={setCx} label={T.contextLabel} options={['group', 'all'].map(c => ({ value: c, label: T.contexts[c] }))} />
              </div>
            )}
            <label className="model-bar-item cap">
              <span className="muted small">{T.thLabel}: <b>{f.sigma(th)}</b></span>
              <input type="range" min="2" max="7" step="0.1" value={th} onChange={e => setTh(Number(e.target.value))} aria-label={T.thLabel} />
              <small className="muted">{T.thHint(f.oneIn(Math.exp(logQ(th))))}</small>
            </label>
          </div>
          <section className="an-scene glass">
            <div className="an-stage" style={{ height: 'min(64vh, 600px)' }}>
              {gl ? (
                <Cloud3D key={O.key} n={Ox.ds.n} pos={Ox.pos} dash={Ox.pos} mode="cloud" spread={1} D={Ox.D} th={th} groups={groupF} dim={dim} bases={bases} of={Ox.res.C.of}
                  sel={sel} neigh={neigh} fly={fly} spin months={[]} height="100%" label={T.scene.aria} onPick={setSel}
                  tip={i => `<b>${String(Ox.map.id >= 0 ? Ox.P.body[i][Ox.map.id] : T.own.row + ' ' + (i + 2)).replace(/</g, '&lt;')}</b><span>${String(Ox.ds.groups[Ox.ds.gi[i]].name).replace(/</g, '&lt;')}</span><em class="${Ox.D[i] >= th ? 'hot' : ''}">${f.sigma(Ox.D[i])}</em>`} />
              ) : <Cloud2D ds={Ox.ds} pos={Ox.pos} D={Ox.D} th={th} dim={dim} bases={bases} sel={sel} onPick={setSel} label={T.scene.aria} note={T.scene.noGl} />}
              <div className="an-hud"><b>{f.int(t.total)}</b><span>{T.signalsN(t.total)}</span><small>{T.hudOf(f.int(Ox.ds.n), f.sigma(th))}</small></div>
              <div className="an-foot"><p className="an-hint">{T.scene.hint}</p></div>
            </div>
            <aside className="an-side"><OwnCard key={sel == null ? 'n' : sel} ctx={ctx} O={Ox} i={sel} th={th} /></aside>
          </section>
          <div className="grid grid-2 an-own-bottom">
            <Panel title={T.own.result(f.int(t.total), f.int(Ox.ds.n))} aside={<Button kind="primary" icon="download" onClick={exportCsv} disabled={!t.total}>{T.own.export}</Button>}>
              <div className="table-scroll">
                <table className="data-table compact an-table">
                  <thead><tr><th>{T.own.rank}</th><th>{T.signalsPage.cols.id}</th><th>{T.own.group}</th><th className="num">{T.own.level}</th><th>{T.own.reason}</th></tr></thead>
                  <tbody>
                    {top.map(i => (
                      <tr key={i} tabIndex="0" className={sel === i ? 'picked' : ''} onClick={() => setSel(i)} onKeyDown={e => { if (e.key === 'Enter') setSel(i); }}>
                        <td className="num">{Ox.rank[i] + 1}</td>
                        <td className="mono">{Ox.map.id >= 0 ? Ox.P.body[i][Ox.map.id] : `${T.own.row} ${i + 2}`}</td>
                        <td>{Ox.ds.groups[Ox.ds.gi[i]].name}</td>
                        <td className="num"><span className={'score-pill an-pill' + (Ox.D[i] >= th ? '' : ' calm')}>{f.sigma(Ox.D[i])}</span></td>
                        <td className="reasons">{(ownReasons(ctx, Ox, i)[0] || {}).text || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel className="an-own-cta">
              <span className="signal-line" />
              <p>{T.own.cta}</p>
              <Button kind="primary" icon="mail" onClick={() => setLead('own-file')}>{T.own.ctaBtn}</Button>
              <p className="an-privacy"><Icon name="lock" size={15} />{T.own.privacy}</p>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
