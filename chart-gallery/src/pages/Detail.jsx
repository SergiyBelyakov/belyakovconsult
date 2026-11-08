// Сторінка типу: живий графік (зразок або файл відвідувача), опис, структура даних, зразок для завантаження.
import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Button, Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { TYPE, TYPES, defOpts } from '../types.js';
import { sampleMap, build, chartSvg, saveSvg, savePng } from '../model.js';
import { autoMap, complete } from '../mapping.js';
import { isoDay } from '../format.js';

export function ModelTable({ m, f, T }) {
  const tb = m.table, dc = new Set(m.dateCols || []), pc = new Set(m.pctCols || []);
  const cell = (v, k) => (v == null || v === '' ? T.ui.na : dc.has(k) && typeof v === 'number' ? f.date(v) : pc.has(k) ? f.pct(v, 1) : typeof v === 'number' ? f.num(v) : String(v));
  return (
    <div className="table-scroll cg-model-table">
      <table className="data-table compact">
        <thead><tr>{tb.head.map((h, k) => <th key={k} className={k ? 'num' : ''}>{h}</th>)}</tr></thead>
        <tbody>{tb.rows.slice(0, 400).map((r, i) => <tr key={i}>{r.map((v, k) => <td key={k} className={typeof v === 'number' && !dc.has(k) ? 'num' : ''}>{cell(v, k)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const showVal = v => (typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? ''));

export default function Detail({ ctx }) {
  const { T, TT, f, lang, typeId, own, maps, setMap, src, setSrc, samples, L, open, pickFile, downloadSample, notify } = ctx;
  const t = TYPE[typeId], tx = TT[typeId];
  const [opts, setOpts] = useState(defOpts(t));
  const [view, setView] = useState('chart');
  const [over, setOver] = useState(false);
  const ref = useRef(null);
  const useOwn = src === 'own' && !!own;
  const map = useOwn ? maps[typeId] || autoMap(t, own.cols) : sampleMap(t);
  const table = useOwn ? own : samples[typeId].table;
  const ready = !useOwn || complete(t, map);
  const mapKey = JSON.stringify(map), optKey = JSON.stringify(opts);
  const model = useMemo(() => (ready ? build(t, table, map, opts, L) : null), [typeId, useOwn, own, mapKey, optKey, lang]);
  const idx = TYPES.findIndex(x => x.id === typeId), prev = TYPES[(idx + TYPES.length - 1) % TYPES.length], next = TYPES[(idx + 1) % TYPES.length];
  const err = model && model.error;
  const errText = err ? (typeof T.err[err[0]] === 'function' ? T.err[err[0]](...err.slice(1)) : T.err[err[0]] || T.err.read) : '';
  const title = useOwn ? own.name : tx.sample;
  const exp = async kind => {
    const s = chartSvg(ref.current, { title, sub: tx.name, source: 'belyakovconsult.com · ' + T.demoName });
    if (!s) return;
    const name = 'BC_' + t.id + (useOwn ? '_own' : '_sample') + '.' + kind;
    try { if (kind === 'svg') saveSvg(s, name); else await savePng(s, name); notify(T.d.exported); }
    catch (e) { console.error(e); notify(T.err.read, 'warning'); }
  };
  const drop = e => { e.preventDefault(); setOver(false); const file = e.dataTransfer.files && e.dataTransfer.files[0]; if (file) pickFile(file, typeId); };
  const sampleTable = samples[typeId].table;

  return (
    <>
      <div className="cg-crumbs">
        <a href="#gallery" onClick={e => { e.preventDefault(); ctx.navigate('gallery'); }}><Icon name="back" size={14} />{T.d.back}</a>
        <span className="cg-crumb-group">{T.groups[t.group]}</span>
        <div className="cg-pn">
          <Button icon="chevronLeft" onClick={() => open(prev.id)} title={T.d.prev + ': ' + TT[prev.id].name}><span className="hide-sm">{TT[prev.id].name}</span></Button>
          <Button onClick={() => open(next.id)} title={T.d.next + ': ' + TT[next.id].name}><span className="hide-sm">{TT[next.id].name}</span><Icon name="chevronRight" size={16} /></Button>
        </div>
      </div>

      <Panel className="cg-main">
        <div className="cg-toolbar">
          <div className="cg-tools-left">
            <Segmented value={useOwn ? 'own' : 'sample'} label={T.d.source} onChange={v => { if (v === 'own' && !own) pickFile(null, typeId); else setSrc(v); }} options={[{ value: 'sample', label: T.d.sample }, { value: 'own', label: T.d.yours }]} />
            <Segmented value={view} label={T.d.chart} onChange={setView} options={[{ value: 'chart', label: T.d.chart }, { value: 'table', label: T.d.table }]} />
            {view === 'chart' && t.opts.map(o => (
              <span className="cg-opt" key={o.id}><span className="cg-opt-label">{T.opt[o.id].label}</span>
                <Segmented value={opts[o.id]} label={T.opt[o.id].label} onChange={v => setOpts({ ...opts, [o.id]: v })} options={o.values.map(v => ({ value: v, label: T.opt[o.id].values[v] }))} />
              </span>
            ))}
          </div>
          {!t.noExport && view === 'chart' && model && !err && (
            <div className="cg-tools-right">
              <Button icon="download" onClick={() => exp('png')}>{T.d.png}</Button>
              <Button onClick={() => exp('svg')}>{T.d.svg}</Button>
            </div>
          )}
        </div>
        {useOwn && !ready && <p className="cg-error" role="alert"><Icon name="info" size={16} />{T.d.needCols}</p>}
        {err && <p className="cg-error" role="alert"><Icon name="warning" size={16} />{errText}</p>}
        {model && !err && model.warn && model.warn.length > 0 && (
          <ul className="cg-warn">{model.warn.map((w, k) => <li key={k}><Icon name="info" size={14} />{typeof T.warn[w[0]] === 'function' ? T.warn[w[0]](...w.slice(1)) : T.warn[w[0]]}</li>)}</ul>
        )}
        {model && !err && (
          <div className="cg-stage" ref={ref}>
            {view === 'chart' ? <t.Chart m={model} f={f} T={T} lang={lang} opts={opts} /> : <ModelTable m={model} f={f} T={T} />}
          </div>
        )}
        <p className="cg-caption muted">{useOwn ? T.d.fileLoaded(own.name, own.rows.length) : tx.sample + (/[.!?]$/.test(tx.sample) ? ' ' : '. ') + T.dataNote.split('.')[0] + '.'}</p>
      </Panel>

      <div className="cg-detail-grid">
        <Panel title={T.d.what} className="cg-text">
          <p className="cg-lead">{tx.what}</p>
          <h4>{T.d.when}</h4>
          <ul className="cg-list ok">{tx.when.map((s, k) => <li key={k}><Icon name="check" size={14} />{s}</li>)}</ul>
          <h4>{T.d.avoid}</h4>
          <ul className="cg-list no">{tx.avoid.map(([s, alts], k) => (
            <li key={k}><Icon name="x" size={14} /><span>{s}{alts.length > 0 && <span className="cg-alts">{alts.map(a => <a key={a} href={'#chart&t=' + a} onClick={e => { e.preventDefault(); open(a); }}>{TT[a].name}<Icon name="arrowRight" size={12} /></a>)}</span>}</span></li>
          ))}</ul>
          <h4>{T.d.tips}</h4>
          <ul className="cg-list tip">{tx.tips.map((s, k) => <li key={k}><span className="cg-num">{k + 1}</span>{s}</li>)}</ul>
        </Panel>

        <Panel title={T.d.data} className={'cg-data' + (over ? ' over' : '')}>
          <div onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
            <p className="cg-lead">{tx.data}</p>
            <div className="table-scroll">
              <table className="data-table compact cg-roles">
                <thead><tr><th>{T.d.role}</th><th>{T.d.column}</th><th>{T.d.kind}</th></tr></thead>
                <tbody>
                  {t.roles.map((r, i) => (
                    <tr key={r.id}>
                      <td><strong>{T.roles[r.id]}</strong><small className="cell-sub">{r.opt ? T.d.opt : T.d.req}</small></td>
                      <td className="mono">{sampleTable.head[i]}</td>
                      <td>{T.kinds[r.kind]}<small className="cell-sub">{T.roleHint[r.id]}</small></td>
                    </tr>
                  ))}
                  {t.multi && <tr><td><strong>{T.roles.value}</strong><small className="cell-sub">{T.d.req}</small></td><td className="mono">{sampleTable.head.slice(t.roles.length).join(', ')}</td><td>{T.kinds.num}<small className="cell-sub">{T.roleHint.multi}</small></td></tr>}
                </tbody>
              </table>
            </div>
            <h4>{T.d.preview} <small className="muted">({T.d.rowsTotal(sampleTable.rows.length)})</small></h4>
            <div className="table-scroll">
              <table className="data-table compact cg-preview">
                <thead><tr>{sampleTable.head.map((h, k) => <th key={k}>{h}</th>)}</tr></thead>
                <tbody>{sampleTable.rows.slice(0, 5).map((r, i) => <tr key={i}>{r.map((v, k) => <td key={k} className="mono">{showVal(v) || <span className="muted">{T.ui.na}</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="cg-actions">
              <Button icon="download" kind="primary" onClick={() => downloadSample(t.id, 'xlsx')}>{T.d.xlsx}</Button>
              <Button icon="download" onClick={() => downloadSample(t.id, 'csv')}>{T.d.csv}</Button>
              <Button icon="upload" onClick={() => pickFile(null, typeId)}>{T.d.upload}</Button>
            </div>
            <p className="muted small">{T.d.uploadHint}</p>
            {useOwn && (
              <div className="cg-mapping">
                <h4>{T.d.mapping}</h4>
                {t.roles.map(r => (
                  <label key={r.id} className="cg-map-row">
                    <span>{T.roles[r.id]}{r.opt ? <em> · {T.d.opt}</em> : ''}</span>
                    <select value={map[r.id]} onChange={e => setMap(typeId, { ...map, [r.id]: Number(e.target.value) })}>
                      <option value={-1}>{T.d.none}</option>
                      {own.cols.map(c => <option key={c.k} value={c.k}>{c.name} · {T.kinds[c.type]}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
