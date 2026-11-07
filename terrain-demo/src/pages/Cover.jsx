import { useMemo } from 'react';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { coverage, candidates, bestSites, EXISTING_SIRENS, COVER, cellXY } from '../dem.js';
import { layerCover } from '../layers.js';
import { SceneBox, Swatch, scenePlaces } from './controls.jsx';

export default function Cover({ ctx }) {
  const { T, f, T3, kind, setKind, smode, setSmode, k, setK, picked, setPicked, placeName } = ctx;
  const cand = candidates(T3, kind);
  const sites = useMemo(() => {
    if (smode === 'existing') return kind === 'siren' ? EXISTING_SIRENS.map(id => ({ id, cell: T3.byId.get(id).cell, place: id })) : [];
    if (smode === 'best') return bestSites(T3, kind, k);
    return cand.filter(c => picked.includes(c.id));
  }, [kind, smode, k, picked.join()]);
  const R = coverage(T3, kind, sites.map(s => s.cell));
  const colors = useMemo(() => layerCover(T3, R.V), [kind, smode, k, picked.join()]);
  const label = s => (s.place ? placeName(T3.byId.get(s.place), true) : T.peak(s.id.slice(1)));
  const sceneSites = useMemo(() => sites.map(s => { const [x, y] = cellXY(s.cell); return { x, y, label: label(s), h: kind === 'tower' ? 2.4 : 1.3, ring: COVER[kind].r }; }), [kind, smode, k, picked.join(), ctx.lang]);
  const places = useMemo(() => scenePlaces(ctx, new Set(), new Set(R.missed.map(p => p.id))), [kind, smode, k, picked.join(), ctx.lang]);
  const toggle = id => setPicked(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  return (
    <>
      <div className="model-bar glass">
        <div className="model-bar-item">
          <Segmented value={kind} onChange={v => { setKind(v); if (v === 'tower' && smode === 'existing') setSmode('best'); setPicked([]); }} label={T.kinds.siren} options={['siren', 'tower'].map(x => ({ value: x, label: T.kinds[x] }))} />
          <small className="muted">{T.kindHint[kind]}</small>
        </div>
        <div className="model-bar-item">
          <Segmented value={smode} onChange={setSmode} label={T.sitesCount} options={(kind === 'siren' ? ['existing', 'best', 'pick'] : ['best', 'pick']).map(x => ({ value: x, label: T.sitesMode[x] }))} />
          {smode === 'best' && (
            <label className="exag"><span>{T.sitesCount}</span><input type="range" min="1" max={kind === 'siren' ? 15 : 6} value={k} onChange={e => setK(Number(e.target.value))} aria-label={T.sitesCount} /><b>{k}</b></label>
          )}
          <small className="muted">{smode === 'existing' ? T.existingNote : smode === 'best' ? T.bestNote : T.pickNote}</small>
        </div>
      </div>
      <SceneBox ctx={ctx} colors={colors} places={places} sites={sceneSites} legend={<Swatch color="#19b3a0" label={T.legendCover} />} />
      <div className="grid grid-2">
        <Panel title={T.covered} sub={`${f.pct(R.share, 0)} · ${T.people(f.int(R.pop))}`}>
          <div className="cover-bar"><i style={{ width: R.share * 100 + '%' }} /></div>
          {smode === 'pick' && (
            <div className="chips cand-chips">
              {cand.map(c => <button type="button" key={c.id} className={'chip' + (picked.includes(c.id) ? ' active' : '')} aria-pressed={picked.includes(c.id)} onClick={() => toggle(c.id)}>{label(c)}</button>)}
            </div>
          )}
          {smode !== 'pick' && <ul className="site-list">{sites.map(s => <li key={s.id}>{label(s)}</li>)}</ul>}
        </Panel>
        <Panel title={T.missed} sub={`${f.int(R.missed.length)} · ${T.people(f.int(R.missed.reduce((a, p) => a + p.pop, 0)))}`}>
          <div className="chips">{[...R.missed].sort((a, b) => b.pop - a.pop).map(p => <span key={p.id} className="reason">{placeName(p)} · {f.int(p.pop)}</span>)}</div>
        </Panel>
      </div>
    </>
  );
}
