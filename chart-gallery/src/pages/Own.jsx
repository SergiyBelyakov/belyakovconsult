// Ваші дані: профіль колонок файлу і всі графіки, які з нього можна побудувати (мініатюри на ваших даних).
import { useMemo, useState } from 'react';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Button, Panel } from '../../../dashboard/src/ui.jsx';
import { TYPES, defOpts } from '../types.js';
import { build } from '../model.js';
import { autoMap, complete, missing } from '../mapping.js';

export default function Own({ ctx }) {
  const { T, TT, f, lang, own, pickFile, clearOwn, open, L, maps, trySample } = ctx;
  const [over, setOver] = useState(false);
  const res = useMemo(() => {
    if (!own) return null;
    return TYPES.map(t => {
      const map = maps[t.id] || autoMap(t, own.cols);
      if (!complete(t, map)) return { t, miss: missing(t, map) };
      const model = build(t, own, map, defOpts(t), L);
      return { t, model };
    });
  }, [own, maps, lang]);
  const drop = e => { e.preventDefault(); setOver(false); const file = e.dataTransfer.files && e.dataTransfer.files[0]; if (file) pickFile(file); };

  if (!own) {
    return (
      <Panel>
        <div className={'cg-drop' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
          <Icon name="upload" size={34} />
          <strong>{T.own.drop}</strong>
          <span className="muted">{T.d.uploadHint}</span>
          <div className="cg-actions center">
            <Button kind="primary" icon="file" onClick={() => pickFile(null)}>{T.own.pick}</Button>
            <Button icon="table" onClick={trySample}>{T.own.sampleTry}</Button>
          </div>
        </div>
        <p className="muted small cg-tipline"><Icon name="info" size={14} />{T.own.mixed}</p>
      </Panel>
    );
  }
  const yes = res.filter(r => r.model && !r.model.error), no = res.filter(r => !r.model || r.model.error);
  const errText = e => (typeof T.err[e[0]] === 'function' ? T.err[e[0]](...e.slice(1)) : T.err[e[0]] || '');
  return (
    <>
      <Panel title={T.d.fileLoaded(own.name, own.rows.length)} aside={<div className="cg-actions"><Button icon="upload" onClick={() => pickFile(null)}>{T.own.pick}</Button><Button icon="x" onClick={clearOwn}>{T.d.clear}</Button></div>}>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead><tr><th>{T.own.colName}</th><th>{T.own.colType}</th><th className="num">{T.own.filled}</th><th className="num">{T.own.distinct}</th></tr></thead>
            <tbody>{own.cols.map(c => <tr key={c.k}><td className="strong">{c.name}</td><td><span className={'cg-kind k-' + c.type}>{T.kinds[c.type]}</span></td><td className="num">{f.num(c.filled)}</td><td className="num">{f.num(c.distinct)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="muted small cg-tipline"><Icon name="info" size={14} />{T.own.typeTip} {T.own.mixed}</p>
      </Panel>
      <h2 className="cg-h2">{T.own.fit(yes.length)}</h2>
      <div className="cg-grid">
        {yes.map(({ t, model }) => (
          <a key={t.id} className="cg-card glass" href={'#chart&t=' + t.id + '&d=own'} onClick={e => { e.preventDefault(); open(t.id, 'own'); }}>
            <div className="cg-thumb" aria-hidden="true"><t.Chart m={model} f={f} T={T} mini lang={lang} opts={defOpts(t)} /></div>
            <span className="cg-tag">{T.groups[t.group]}</span>
            <h3>{TT[t.id].name}</h3>
            <p>{t.roles.filter(r => (maps[t.id] || autoMap(t, own.cols))[r.id] >= 0).map(r => T.roles[r.id] + ': ' + own.cols[(maps[t.id] || autoMap(t, own.cols))[r.id]].name).join(' · ')}</p>
            <span className="cg-more">{T.d.open}<Icon name="arrowRight" size={14} /></span>
          </a>
        ))}
      </div>
      {no.length > 0 && (
        <Panel title={T.own.noFit} className="cg-nofit">
          <ul>
            {no.map(({ t, miss, model }) => (
              <li key={t.id}>
                <a href={'#chart&t=' + t.id + '&d=own'} onClick={e => { e.preventDefault(); open(t.id, 'own'); }}>{TT[t.id].name}</a>
                <span className="muted">{miss ? T.own.needs + ': ' + miss.map(r => T.roles[r.id] + ' (' + T.kinds[r.kind] + ')').join(', ') : errText(model.error)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
