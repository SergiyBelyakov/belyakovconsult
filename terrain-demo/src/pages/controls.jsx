import { useState } from 'react';
import { Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { useWidth, C } from '../../../dashboard/src/charts.jsx';
import View3D from '../View3D.jsx';
import Map2D from '../Map2D.jsx';
import { ELEV_STOPS } from '../layers.js';

// Сцена: 3D або карта зверху, перемикач, перебільшення висот, скидання ракурсу, легенда
export function SceneBox({ ctx, colors, places, sites, water, legend, children }) {
  const { T, gl, mode3d, setMode3d, exag, setExag } = ctx;
  const [reset, setReset] = useState(0);
  const use3d = gl && mode3d;
  return (
    <section className="scene-box glass">
      <div className="scene-bar">
        {gl && <Segmented value={mode3d ? '3d' : '2d'} onChange={v => setMode3d(v === '3d')} label={T.view3d} options={[{ value: '3d', label: T.view3d }, { value: '2d', label: T.view2d }]} />}
        {use3d && (
          <label className="exag">
            <span>{T.exag}</span>
            <input type="range" min="4" max="30" step="1" value={exag} onChange={e => setExag(Number(e.target.value))} aria-label={T.exag} />
            <b>×{exag}</b>
          </label>
        )}
        {use3d && <Button icon="reset" onClick={() => setReset(r => r + 1)}>{T.reset}</Button>}
        {children}
      </div>
      {use3d
        ? <View3D T={ctx.T3} colors={colors} exag={exag} places={places} sites={sites} water={water} resetKey={reset} label={T.titles[ctx.view]} />
        : <Map2D T={ctx.T3} colors={colors} places={places} sites={sites} label={T.titles[ctx.view]} />}
      <div className="scene-foot">
        {!gl && <span className="muted small">{T.noGl}</span>}
        {use3d && <span className="muted small">{T.hint}</span>}
        {legend}
      </div>
    </section>
  );
}

export function ElevLegend({ T, min, max }) {
  return (
    <span className="legend-elev">
      <span className="muted small">{T.legendElev}</span>
      <i style={{ background: `linear-gradient(90deg, ${ELEV_STOPS.map(c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`).join(',')})` }} />
      <small>{Math.round(min)}</small><small>{Math.round(max)}</small>
    </span>
  );
}
export const Swatch = ({ color, label }) => <span className="legend-sw"><i style={{ background: color }} />{label}</span>;

// Профіль висот: сіра поверхня, синій рівень води, позначка річки
export function ProfileChart({ data, water, f, T, height = 200 }) {
  const [ref, W] = useWidth();
  const L = 44, R = 10, Tp = 10, B = 26, H = height;
  const lo = Math.floor(Math.min(...data.map(d => Math.min(d.h, d.water))) / 10) * 10 - 5, hi = Math.ceil(Math.max(...data.map(d => d.h)) / 10) * 10 + 5;
  const maxKm = data[data.length - 1].km;
  const x = v => L + (W - L - R) * (v / maxKm), y = v => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
  const ground = data.map((d, i) => (i ? 'L' : 'M') + x(d.km).toFixed(1) + ',' + y(d.h).toFixed(1)).join(' ');
  const area = ground + ` L${x(maxKm)},${H - B} L${x(0)},${H - B} Z`;
  const wl = data.map(d => ({ ...d, wl: d.water + water }));
  const flooded = wl.filter(d => d.h < d.wl);
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={T.profileTitle}>
        {[lo, (lo + hi) / 2, hi].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} /><text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{Math.round(v)}</text></g>)}
        {[0, 0.5, 1].map(t => <text key={t} x={x(maxKm * t)} y={H - 8} className="axis" textAnchor="middle">{f.dec1(maxKm * t)} {T.km}</text>)}
        <path d={area} fill="rgba(124,116,72,.35)" />
        <path d={ground} fill="none" stroke="#c9c1ad" strokeWidth="1.6" />
        {flooded.map((d, i) => <line key={i} x1={x(d.km)} x2={x(d.km)} y1={y(d.wl)} y2={y(d.h)} stroke="#2f6fd6" strokeWidth={Math.max(1.5, (W - L - R) / data.length + 0.5)} opacity=".7" />)}
        {data.filter(d => d.river).slice(0, 1).map(d => <circle key="r" cx={x(d.km)} cy={y(d.h)} r="4" fill="#7fb4ff" />)}
      </svg>
    </div>
  );
}

// Стан населених пунктів для сцени: підписи для селищ, районів міста і позначених
export function scenePlaces(ctx, hot = new Set(), dim = new Set(), labelAll) {
  const { T3, placeName } = ctx;
  return T3.places.map(p => ({
    x: p.x, y: p.y, kind: p.kind, state: hot.has(p.id) ? 'hot' : dim.has(p.id) ? 'dim' : 'normal',
    label: labelAll || hot.has(p.id) || p.kind === 'town' || p.id === 'vrc' || p.pop >= 1400 ? placeName(p, true) : null,
  }));
}
