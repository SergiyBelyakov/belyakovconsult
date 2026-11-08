import { useState } from 'react';
import { Panel, Select, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { INDICATORS, DOMAINS } from '../model.js';
import { SOURCES, SRC_BY, ageDays, isStale } from '../world.js';
import { readFile, parseDate, parseNum } from '../../../anomaly-demo/src/fileio.js';
import { StatusTag, moduleHref, unitOf } from './controls.jsx';
import { COL } from '../charts.jsx';

const TEMPLATE = INDICATORS.filter(x => x.dom !== 'data' || ['objRights', 'objAudit'].includes(x.id));

// Схема моделі даних: сутності та зв'язки
function ModelDiagram({ T }) {
  const E = T.method.ent;
  const N = {
    community: [95, 50], okrug: [95, 150], place: [275, 150], object: [455, 70], building: [635, 70], parcel: [815, 70],
    people: [455, 210], indicator: [635, 270], source: [815, 270], owner: [815, 355], scenario: [545, 360], module1: [185, 300], module2: [365, 300],
  };
  const L = [['community', 'okrug'], ['okrug', 'place'], ['place', 'object'], ['object', 'building'], ['building', 'parcel'], ['place', 'people'], ['people', 'indicator'], ['object', 'indicator'], ['indicator', 'source'], ['source', 'owner'], ['module1', 'place'], ['module2', 'place'], ['scenario', 'indicator']];
  const hot = new Set(['place', 'indicator', 'source']);
  return (
    <div className="diagram-scroll">
      <svg viewBox="0 0 910 400" className="model-diagram" role="img" aria-label={T.method.modelTitle}>
        <defs><marker id="dm-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L8,4L0,8Z" fill="rgba(244,246,248,.5)" /></marker></defs>
        {L.map(([a, b]) => { const [x1, y1] = N[a], [x2, y2] = N[b]; const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ox = (dx / l) * 70, oy = (dy / l) * 21; return <line key={a + b} x1={x1 + ox} y1={y1 + oy} x2={x2 - ox} y2={y2 - oy} className="dm-link" markerEnd="url(#dm-arr)" />; })}
        {Object.entries(N).map(([k, [x, y]]) => (
          <g key={k} className={'dm-node' + (hot.has(k) ? ' hot' : '') + (k.startsWith('module') ? ' mod' : '')} transform={`translate(${x} ${y})`}>
            <rect x="-80" y="-19" width="160" height="38" rx="6" />
            <text textAnchor="middle" y="5">{E[k]}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Method({ ctx }) {
  const { T, f, exportPassport, exportTemplate, exportCsv, onSite, lang, setInd, go } = ctx;
  const [st, setSt] = useState('');
  const [dm, setDm] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const cat = INDICATORS.filter(x => (!st || x.status === st) && (!dm || x.dom === dm));

  const check = async file => {
    setBusy(true); setRes(null);
    try {
      const { rows, name } = await readFile(file);
      const norm = s => String(s || '').trim().toLowerCase();
      const hi = rows.findIndex(r => r.some(c => ['id', 'код'].includes(norm(c))));
      if (hi < 0) throw new Error('head');
      const head = rows[hi].map(norm);
      const col = keys => head.findIndex(h => keys.some(k => h === k || h.startsWith(k)));
      const c = { id: col(['id', 'код']), v: col(['значення', 'value']), d: col(['дата', 'date']), s: col(['джерело', 'source']), o: col(['власник', 'owner']) };
      if (c.v < 0) throw new Error('value');
      const byId = new Map(TEMPLATE.map(x => [x.id, x]));
      const seen = new Map(), unknown = [];
      for (const r of rows.slice(hi + 1)) {
        const id = String(r[c.id] || '').trim();
        if (!id) continue;
        if (!byId.has(id)) { unknown.push(id); continue; }
        seen.set(id, { v: r[c.v], d: c.d >= 0 ? r[c.d] : '', s: c.s >= 0 ? r[c.s] : '', o: c.o >= 0 ? r[c.o] : '' });
      }
      const today = Math.floor(Date.now() / 864e5);
      const out = { name, filled: [], stale: [], noSrc: [], noOwner: [], missing: [], unknown };
      for (const x of TEMPLATE) {
        const e = seen.get(x.id);
        if (!e || String(e.v ?? '').trim() === '' || !Number.isFinite(parseNum(e.v))) { out.missing.push(x.id); continue; }
        out.filled.push(x.id);
        const freq = x.src[0] && SRC_BY.get(x.src[0]) ? SRC_BY.get(x.src[0]).freq : 365, pd = parseDate(e.d);
        if (!pd || today - pd.day > freq * 1.5) out.stale.push(x.id);
        if (!String(e.s || '').trim()) out.noSrc.push(x.id);
        if (!String(e.o || '').trim()) out.noOwner.push(x.id);
      }
      const bad = new Set([...out.stale, ...out.noSrc, ...out.noOwner]);
      out.score = out.filled.filter(id => !bad.has(id)).length / TEMPLATE.length;
      setRes(out);
    } catch (e) {
      setRes({ error: true });
    }
    setBusy(false);
  };
  const onDrop = e => { e.preventDefault(); setDrag(false); const fl = e.dataTransfer.files && e.dataTransfer.files[0]; if (fl) check(fl); };
  const resList = (key, icon) => res[key].length > 0 && (
    <div className={'res-block ' + key}>
      <h5><Icon name={icon} size={14} />{T.method.res[key]}: {res[key].length}</h5>
      <p>{res[key].slice(0, 12).map(id => (T.ind[id] ? T.ind[id].n : id)).join(', ')}{res[key].length > 12 ? '…' : ''}</p>
    </div>
  );

  return (
    <>
      <Panel title={T.method.modelTitle} sub={T.method.modelSub}>
        <ModelDiagram T={T} />
      </Panel>

      <Panel title={T.method.srcTitle} sub={T.method.srcSub}>
        <div className="table-scroll">
          <table className="data-table compact plain">
            <thead><tr><th>{T.method.srcCols.name}</th><th>{T.method.srcCols.owner}</th><th>{T.method.srcCols.access}</th><th>{T.method.srcCols.freq}</th><th className="num">{T.method.srcCols.updated}</th><th className="num">{T.method.srcCols.records}</th><th>{T.method.srcCols.status}</th></tr></thead>
            <tbody>
              {SOURCES.map(s => {
                const age = Math.max(0, ageDays(s.updated)), ratio = Math.min(1, age / (s.freq * 1.5)), stale = isStale(s);
                return (
                  <tr key={s.id}>
                    <td className="strong wrap">{T.src[s.id]}</td>
                    <td className={'wrap' + (s.owner ? '' : ' over')}>{s.owner ? T.owner[s.owner] : T.noOwner}</td>
                    <td className="muted wrap">{T.access[s.access]}</td>
                    <td>{T.freqText(s.freq)}</td>
                    <td className="num">{f.date(s.updated)}<span className="fresh-bar"><i style={{ width: ratio * 100 + '%', background: stale ? COL.status.stale : COL.status.ok }} /></span></td>
                    <td className="num">{f.int(s.records)}</td>
                    <td><StatusTag s={stale ? 'stale' : 'ok'} T={T} quiet={!stale} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={T.method.catTitle} sub={T.method.catSub} aside={
        <div className="toolbar tight">
          <Select value={dm} onChange={setDm} label={T.method.catCols.dom} options={[{ value: '', label: T.pass.all }, ...DOMAINS.map(d => ({ value: d, label: T.dom[d] }))]} />
          <Select value={st} onChange={setSt} label={T.method.catCols.status} options={[{ value: '', label: T.method.catAll }, ...['ok', 'stale', 'conflict', 'missing'].map(s => ({ value: s, label: T.status[s] }))]} />
        </div>
      }>
        <div className="table-scroll tall">
          <table className="data-table compact plain cat-table">
            <thead><tr><th>{T.method.catCols.name}</th><th>{T.method.catCols.dom}</th><th className="num">{T.method.catCols.value}</th><th>{T.method.catCols.src}</th><th>{T.method.catCols.status}</th></tr></thead>
            <tbody>
              {cat.map(x => (
                <tr key={x.id} className="click" onClick={() => { setInd(x.id); go('passport'); }}>
                  <td className="strong">{T.ind[x.id].n}<small>{T.ind[x.id].d}</small></td>
                  <td className="muted">{T.dom[x.dom]}</td>
                  <td className="num">{f.ind(x)} <small>{unitOf(x, T)}</small></td>
                  <td>{x.src.length ? x.src.map(s => T.src[s]).join(', ') : T.noOwner}</td>
                  <td><StatusTag s={x.status} T={T} quiet={x.status === 'ok'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-2">
        <Panel title={T.method.dlTitle}>
          <div className="dl-list">
            {[['passport', exportPassport, 'download'], ['template', exportTemplate, 'file'], ['csv', exportCsv, 'table']].map(([k, fn, icon]) => (
              <div key={k} className="dl-row">
                <div><strong>{T.method.dl[k][0]}</strong><small>{T.method.dl[k][1]}</small></div>
                <Button icon={icon} onClick={fn}>{k === 'csv' ? 'CSV' : 'XLSX'}</Button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={T.method.checkTitle} sub={T.method.checkSub}>
          <label className={'drop' + (drag ? ' on' : '')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
            <input type="file" accept=".xlsx,.csv,text/csv" onChange={e => e.target.files[0] && check(e.target.files[0])} />
            <Icon name="upload" size={20} /><span><b>{T.method.upload}</b> {T.method.drop}</span>
          </label>
          {busy && <p className="muted">{T.method.reading}</p>}
          {res && res.error && <p className="over">{T.method.bad}</p>}
          {res && !res.error && (
            <div className="check-res">
              <div className="cr-score"><b>{f.pct(res.score, 0)}</b><span>{T.method.res.score}<small>{res.name} · {T.method.res.filled} {res.filled.length} {T.of} {TEMPLATE.length}</small></span></div>
              {resList('missing', 'info')}{resList('stale', 'clock')}{resList('noSrc', 'database')}{resList('noOwner', 'user')}{resList('unknown', 'warning')}
              {!res.missing.length && !res.stale.length && !res.noSrc.length && !res.noOwner.length && <p className="good"><Icon name="check" size={14} />{T.method.res.ok}</p>}
              <p className="muted small">{T.method.resNote}</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={T.method.limTitle}>
        <ul className="lim-list">{T.method.lim.map(t => <li key={t}>{t}</li>)}</ul>
        <div className="mod-links">
          <a className="btn btn-ghost" href={moduleHref('transport', onSite, lang)}><Icon name="bus" size={16} /><span>{T.method.open1}</span></a>
          <a className="btn btn-ghost" href={moduleHref('terrain', onSite, lang)}><Icon name="layersAlt" size={16} /><span>{T.method.open2}</span></a>
        </div>
      </Panel>
    </>
  );
}
