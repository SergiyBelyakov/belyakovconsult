import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { flood, floodStageOf, riverLevel } from '../dem.js';
import { layerFlood } from '../layers.js';
import { SceneBox, Swatch, scenePlaces } from './controls.jsx';

export default function Flood({ ctx }) {
  const { T, f, T3, stage, setStage, placeName, gl, mode3d } = ctx;
  const R = flood(T3, stage);
  const st = floodStageOf(T3);
  const colors = useMemo(() => layerFlood(T3, R.W, !(gl && mode3d)), [stage, gl, mode3d]);
  const hot = new Set([...R.places.map(p => p.id), ...R.isolated.map(p => p.id)]);
  const places = useMemo(() => scenePlaces(ctx, hot), [stage, ctx.lang]);
  const water = useMemo(() => ({ W: R.W, level: x => riverLevel(x) + stage }), [stage]);
  const [play, setPlay] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!play) return;
    timer.current = setInterval(() => setStage(s => { if (s >= 8) { setPlay(false); return 8; } return Math.round((s + 0.2) * 10) / 10; }), 260);
    return () => clearInterval(timer.current);
  }, [play]);
  const list = T3.places.filter(p => st.has(p.id) && st.get(p.id) <= 10).sort((a, b) => st.get(a.id) - st.get(b.id));
  return (
    <>
      <SceneBox ctx={ctx} colors={colors} places={places} water={gl && mode3d ? water : null} legend={<Swatch color="#2f6fd6" label={T.legendWater} />}>
        <label className="stage-ctl">
          <span>{T.stage}</span>
          <input type="range" min="0" max="10" step="0.2" value={stage} onChange={e => { setPlay(false); setStage(Number(e.target.value)); }} aria-label={T.stage} />
          <b>+{f.dec1(stage)} {T.m}</b>
        </label>
        <Button icon={play ? 'x' : 'arrowUp'} onClick={() => { if (!play && stage >= 8) setStage(0); setPlay(!play); }}>{play ? T.stop : T.play}</Button>
      </SceneBox>
      <div className="kpi-mini-row wide glass">
        <div><span>{T.floodStats.area}</span><b>{f.dec1(R.area)} {T.km2}</b></div>
        <div><span>{T.floodStats.places}</span><b className={R.places.length ? 'over' : ''}>{f.int(R.places.length)}</b></div>
        <div><span>{T.floodStats.pop}</span><b>{f.int(R.pop)}</b></div>
        <div><span>{T.floodStats.isolated}</span><b className={R.isolated.length ? 'over' : ''}>{f.int(R.isolated.length)}</b><small>{R.isolated.length ? T.people(R.isoPop) : ''}</small></div>
        <div><span>{T.floodStats.roads}</span><b>{f.int(R.cutRoads.size)}</b></div>
        <div><span>{T.floodStats.fac}</span><b className={R.facilities.length ? 'over' : ''}>{f.int(R.facilities.length)}</b><small>{R.facilities.map(x => T.fac[x.id]).join(', ')}</small></div>
      </div>
      <Panel title={T.floodPlaces} sub={T.isoNote}>
        <div className="table-scroll">
          <table className="data-table compact plain">
            <thead><tr><th>{T.cols.place}</th><th className="num">{T.cols.h}</th><th className="num">{T.cols.stage}</th><th className="num">{T.cols.pop}</th><th>{T.cols.why}</th></tr></thead>
            <tbody>
              {list.map(p => {
                const s = st.get(p.id), under = s <= stage, iso = R.isolated.some(x => x.id === p.id);
                return (
                  <tr key={p.id} className={under ? 'picked' : ''}>
                    <td className="strong">{placeName(p)}</td>
                    <td className="num">{f.int(p.h)} {T.m}</td>
                    <td className="num">+{f.dec1(s)} {T.m}</td>
                    <td className="num">{f.int(p.pop)}</td>
                    <td>{under ? <span className="status critical">{T.legendWater}</span> : null} {iso ? <span className="status warning">{T.floodStats.isolated}</span> : null}</td>
                  </tr>
                );
              })}
              {R.isolated.filter(p => !list.includes(p)).map(p => (
                <tr key={p.id} className="picked"><td className="strong">{placeName(p)}</td><td className="num">{f.int(p.h)} {T.m}</td><td className="num">{T.never}</td><td className="num">{f.int(p.pop)}</td><td><span className="status warning">{T.floodStats.isolated}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
