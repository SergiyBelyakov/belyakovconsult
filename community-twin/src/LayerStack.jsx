// «Розібраний» двійник: шість шарів однієї моделі, складені в перспективі (CSS 3D).
// Кожен шар малює справжні дані: рельєф, межі, дороги, мешканців, заклади, ризики.
import { memo, useEffect, useState } from 'react';
import { S, PLACES, OKRUGS, BY_ID, OBJECTS, ROADS } from './world.js';
import { baseRaster, areaPath, floodPath, sirenPath, DOM_OF } from './TwinMap.jsx';
import { CAT_COLOR } from './charts.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';

const W = S.world.w, H = S.world.h;
const line = pts => 'M' + pts.map(p => p[0] + ',' + p[1]).join('L');
const BOUND = 'M' + S.boundary.map(p => p.join(',')).join('L') + 'Z';
export const STACK = ['relief', 'bounds', 'roads', 'people', 'services', 'risks'];
export const STACK_OPEN = { relief: ['pop'], bounds: ['okrugs', 'pop'], roads: ['roads'], people: ['pop'], services: ['edu', 'health', 'services'], risks: ['safety', 'flood', 'sirens'] };
export const stackCount = id => ({
  relief: S.streams.length, bounds: OKRUGS.length, roads: ROADS.length, people: PLACES.length,
  services: OBJECTS.filter(o => ['edu', 'health', 'services'].includes(DOM_OF[o.cat])).length, risks: OBJECTS.filter(o => DOM_OF[o.cat] === 'safety').length,
}[id]);

const Plane = memo(function Plane({ id }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><clipPath id={'st-clip-' + id}><path d={BOUND} /></clipPath></defs>
      {id === 'relief' && (
        <>
          <image href={baseRaster()} x="0" y="0" width={W} height={H} preserveAspectRatio="none" clipPath={'url(#st-clip-' + id + ')'} opacity=".95" />
          {S.streams.map((s, i) => <path key={i} d={line(s.pts)} className="sp-stream" />)}
          <path d={line(S.river)} className="sp-river" />
        </>
      )}
      {id === 'bounds' && (
        <g clipPath={'url(#st-clip-' + id + ')'}>
          {OKRUGS.map((o, i) => <path key={o.id} d={areaPath('okrug', o.id)} className="sp-okrug" style={{ fillOpacity: 0.05 + (i % 3) * 0.05 }} />)}
        </g>
      )}
      {id === 'roads' && (
        <>
          {ROADS.map(r => <path key={r.id} d={line(r.pts)} className={'sp-road sp-' + r.cls} />)}
        </>
      )}
      {id === 'people' && PLACES.map(p => <circle key={p.id} cx={p.x} cy={p.y} r={0.35 + Math.sqrt(p.pop) / 34} className="sp-pop" />)}
      {id === 'services' && OBJECTS.filter(o => ['edu', 'health', 'services'].includes(DOM_OF[o.cat])).map(o => <circle key={o.id} cx={o.x} cy={o.y} r=".42" fill={CAT_COLOR[DOM_OF[o.cat]]} className="sp-obj" />)}
      {id === 'risks' && (
        <>
          <path d={floodPath(6)} className="sp-flood" clipPath={'url(#st-clip-' + id + ')'} />
          <path d={sirenPath()} className="sp-siren" />
          {OBJECTS.filter(o => DOM_OF[o.cat] === 'safety').map(o => <circle key={o.id} cx={o.x} cy={o.y} r=".42" fill={CAT_COLOR.safety} className="sp-obj" />)}
        </>
      )}
      <path d={BOUND} className="sp-bound" />
    </svg>
  );
});

export default function LayerStack({ T, f, onOpen }) {
  const [hl, setHl] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div className="stack-wrap">
      <div className={'stack-scene' + (ready ? ' ready' : '')} onPointerLeave={() => setHl(null)}>
        <div className="stack">
          {STACK.map((id, i) => (
            <button type="button" key={id} className={'plane' + (hl === id ? ' hl' : hl ? ' dim' : '')} style={{ '--i': i }} onPointerEnter={() => setHl(id)} onFocus={() => setHl(id)} onClick={() => onOpen(id)} aria-label={T.map.lay[id][0]}>
              <Plane id={id} />
              <span className="plane-no">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
      <ol className="stack-list">
        {[...STACK].reverse().map(id => {
          const i = STACK.indexOf(id), [name, desc, src] = T.map.lay[id];
          return (
            <li key={id} className={hl === id ? 'hl' : ''} onPointerEnter={() => setHl(id)} onPointerLeave={() => setHl(null)}>
              <button type="button" onClick={() => onOpen(id)}>
                <span className="sl-no">{i + 1}</span>
                <span className="sl-body"><strong>{name}</strong><small>{desc}</small><em>{src}</em></span>
                <Icon name="arrowRight" size={15} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
