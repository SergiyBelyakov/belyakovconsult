// Шари двійника для 3D-моделі: рельєф, межі, дороги, мешканці, заклади, ризики.
// Кожен шар малює справжні дані тієї самої моделі на одній сітці координат (км).
import { memo } from 'react';
import { S, PLACES, OKRUGS, OBJECTS, ROADS } from './world.js';
import { baseRaster, areaPath, floodPath, sirenPath, reliefLines, DOM_OF } from './TwinMap.jsx';
import { CAT_COLOR } from './charts.jsx';
import { STAGE100 } from './model.js';

const W = S.world.w, H = S.world.h;
const line = pts => 'M' + pts.map(p => p[0] + ',' + p[1]).join('L');
const BOUND = 'M' + S.boundary.map(p => p.join(',')).join('L') + 'Z';
export const STACK = ['relief', 'bounds', 'roads', 'people', 'services', 'risks'];
export const STACK_OPEN = { relief: ['pop'], bounds: ['okrugs', 'pop'], roads: ['roads'], people: ['pop'], services: ['edu', 'health', 'services'], risks: ['safety', 'flood', 'sirens'] };
const SVC = OBJECTS.filter(o => ['edu', 'health', 'services'].includes(DOM_OF[o.cat]));
const SAFE = OBJECTS.filter(o => DOM_OF[o.cat] === 'safety');
const ROAD_W = { national: 0.34, regional: 0.26, town: 0.2, local: 0.15, dirt: 0.12, ponton: 0.14 };

// м'яке світіння навколо точки: той самий колір, прозорість спадає до краю
const Halo = ({ id, color }) => (
  <radialGradient id={id}>
    <stop offset="0" stopColor={color} stopOpacity=".55" />
    <stop offset=".45" stopColor={color} stopOpacity=".16" />
    <stop offset="1" stopColor={color} stopOpacity="0" />
  </radialGradient>
);

export const Plane = memo(function Plane({ id, uid = 'ts' }) {
  const k = uid + '-' + id, clip = 'url(#' + k + '-clip)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={k + '-clip'}><path d={BOUND} /></clipPath>
        {id === 'people' && <Halo id={k + '-h'} color="#9FD8FF" />}
        {id === 'services' && ['edu', 'health', 'services'].map(d => <Halo key={d} id={k + '-' + d} color={CAT_COLOR[d]} />)}
        {id === 'risks' && <Halo id={k + '-h'} color={CAT_COLOR.safety} />}
      </defs>
      {id === 'relief' && (
        <>
          <image href={baseRaster()} x="0" y="0" width={W} height={H} preserveAspectRatio="none" clipPath={clip} className="sp-raster" />
          <g clipPath={clip}>
            <path d={reliefLines().minor} className="sp-iso" />
            <path d={reliefLines().major} className="sp-iso major" />
          </g>
          {S.streams.map((s, i) => <path key={i} d={line(s.pts)} className="sp-stream" />)}
          <path d={line(S.river)} className="sp-river-glow" />
          <path d={line(S.river)} className="sp-river" />
        </>
      )}
      {id === 'bounds' && (
        <g clipPath={clip}>
          {OKRUGS.map((o, i) => <path key={o.id} d={areaPath('okrug', o.id)} className="sp-okrug" style={{ fillOpacity: 0.05 + (i % 3) * 0.045 }} />)}
        </g>
      )}
      {id === 'roads' && (
        <>
          {ROADS.map(r => <path key={'g' + r.id} d={line(r.pts)} className="sp-road-glow" style={{ strokeWidth: ROAD_W[r.cls] * 3.2 }} />)}
          {ROADS.map(r => <path key={r.id} d={line(r.pts)} className={'sp-road sp-' + r.cls} style={{ strokeWidth: ROAD_W[r.cls] }} />)}
        </>
      )}
      {id === 'people' && PLACES.map(p => {
        const r = 0.32 + Math.sqrt(p.pop) / 36;
        return <g key={p.id}><circle cx={p.x} cy={p.y} r={r * 2.4} fill={'url(#' + k + '-h)'} /><circle cx={p.x} cy={p.y} r={r} className="sp-pop" /></g>;
      })}
      {id === 'services' && SVC.map(o => (
        <g key={o.id}><circle cx={o.x} cy={o.y} r="1.25" fill={'url(#' + k + '-' + DOM_OF[o.cat] + ')'} /><circle cx={o.x} cy={o.y} r=".38" fill={CAT_COLOR[DOM_OF[o.cat]]} className="sp-obj" /></g>
      ))}
      {id === 'risks' && (
        <>
          <path d={sirenPath()} className="sp-siren" />
          <path d={floodPath(STAGE100)} className="sp-flood" clipPath={clip} />
          {SAFE.map(o => <g key={o.id}><circle cx={o.x} cy={o.y} r="1.2" fill={'url(#' + k + '-h)'} /><circle cx={o.x} cy={o.y} r=".38" fill={CAT_COLOR.safety} className="sp-obj" /></g>)}
        </>
      )}
      <path d={BOUND} className="sp-bound" />
    </svg>
  );
});
