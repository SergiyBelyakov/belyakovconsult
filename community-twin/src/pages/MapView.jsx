import { useMemo } from 'react';
import { Panel, Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import TwinMap, { GlyphLegend, DOM_OF } from '../TwinMap.jsx';
import LayerStack, { STACK_OPEN } from '../LayerStack.jsx';
import { BY_ID, OBJECTS, OBJ_BY, OKRUG_OF } from '../world.js';
import { placeSignals, STAGE100 } from '../model.js';
import { LayerChips, ObjCard } from './controls.jsx';

const LAYER_IDS = ['pop', 'edu', 'health', 'safety', 'services', 'roads', 'flood', 'sirens', 'okrugs'];
const GLYPHS = { edu: ['school', 'kg'], health: ['hospital', 'amb', 'fap'], safety: ['shelter', 'point'], services: ['cnap', 'starosta', 'water', 'culture'] };

export function PlaceCard({ id, ctx }) {
  const { T, f, placeName, go } = ctx;
  const p = BY_ID.get(id), sigs = placeSignals(id), objs = OBJECTS.filter(o => o.place === id);
  return (
    <div className="obj-card">
      <div className="oc-head"><span className="pc-dot" /><div><span className="oc-cat">{T.kindsPlace[p.kind]} · {T.okrugName(OKRUG_OF[id])}</span><strong>{placeName(p)}</strong></div></div>
      <dl className="oc-rows">
        <div><dt>{T.places.est}</dt><dd>{f.int(p.pop)}</dd></div>
        <div><dt>{T.places.reg}</dt><dd>{f.int(p.src.reg)} <small className={p.src.reg > p.pop * 1.25 ? 'over' : 'muted'}>{f.signedPct(p.src.reg / p.pop - 1)}</small></dd></div>
        <div><dt>65+</dt><dd>{f.pct(p.old)}</dd></div>
        <div><dt>{T.places.services}</dt><dd>{objs.length}</dd></div>
        <div><dt>{T.places.flood}</dt><dd>{p.flood != null ? T.scen.flood.m(f.dec1(p.flood)) : T.places.never}</dd></div>
        <div><dt>{T.places.sigs}</dt><dd>{sigs.length}</dd></div>
      </dl>
      <Button kind="primary" icon="home" onClick={() => go('places', { place: id })}>{T.map.placePass}</Button>
    </div>
  );
}

export default function MapView({ ctx }) {
  const { T, f, mode, setMode, layers, setLayers, sel, setSel } = ctx;
  const counts = useMemo(() => Object.fromEntries(['edu', 'health', 'safety', 'services'].map(d => [d, OBJECTS.filter(o => DOM_OF[o.cat] === d).length])), []);
  const openLayer = id => { setLayers(new Set(STACK_OPEN[id])); setSel(null); setMode('map'); };
  const zoomTo = useMemo(() => {
    if (!sel) return null;
    const o = sel.kind === 'obj' ? OBJ_BY.get(sel.id) : BY_ID.get(sel.id);
    return o ? { x: o.x, y: o.y, k: 2.2 } : null;
  }, [sel && sel.id]);
  return (
    <>
      <div className="toolbar view-switch">
        <Segmented value={mode} onChange={setMode} label={T.nav.map} options={[{ value: 'stack', label: T.map.stack }, { value: 'map', label: T.map.map }]} />
        {mode === 'map' && <span className="muted small hide-sm">{T.map.hint}</span>}
      </div>
      {mode === 'stack' ? (
        <Panel title={T.map.stackTitle} sub={T.map.stackSub} className="stack-panel">
          <LayerStack T={T} f={f} onOpen={openLayer} />
        </Panel>
      ) : (
        <div className="map-layout">
          <Panel className="map-panel">
            <LayerChips T={T} layers={layers} setLayers={setLayers} ids={LAYER_IDS} counts={counts} />
            <TwinMap ctx={ctx} layers={layers} selected={sel} onSelect={setSel} height={640} label={T.nav.map} zoomTo={zoomTo} />
            <div className="map-legend">
              <GlyphLegend T={T} cats={Object.entries(GLYPHS).filter(([d]) => layers.has(d)).flatMap(([, g]) => g)} />
              <div className="sym-legend">
                {layers.has('roads') && ['good', 'fair', 'poor'].map(c => <span key={c}><i className={'rd-sw rdc-' + c} />{T.road[c]}</span>)}
                {layers.has('flood') && <span><i className="sw-flood" />{T.layer.flood} ({T.scen.flood.m(f.dec1(STAGE100))})</span>}
                {layers.has('sirens') && <span><i className="sw-siren" />{T.layer.sirens}</span>}
                {layers.has('pop') && <span><i className="sw-pop" />{T.layer.pop}</span>}
              </div>
            </div>
          </Panel>
          <aside className="map-side glass">
            {sel && sel.kind === 'obj' ? <ObjCard id={sel.id} ctx={ctx} onPick={id => setSel({ kind: 'obj', id })} />
              : sel && sel.kind === 'place' ? <PlaceCard id={sel.id} ctx={ctx} />
                : <div className="side-hint"><Icon name="pin" size={20} /><p>{T.map.pick}</p></div>}
          </aside>
        </div>
      )}
    </>
  );
}
