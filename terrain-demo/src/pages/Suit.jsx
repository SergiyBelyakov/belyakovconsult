import { useMemo } from 'react';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { suitability, flood } from '../dem.js';
import { layerSuit } from '../layers.js';
import { SceneBox, Swatch, scenePlaces } from './controls.jsx';

const CTL = { maxSlope: [1, 10, 0.5, '°'], stage: [0, 8, 0.5, 'm'], roadKm: [0.25, 3, 0.25, 'km'] };

export default function Suit({ ctx }) {
  const { T, f, T3, sp, setSp, placeName } = ctx;
  const R = suitability(T3, sp);
  const W = flood(T3, sp.stage).W;
  const key = JSON.stringify(sp);
  const colors = useMemo(() => layerSuit(T3, R, W), [key]);
  const places = useMemo(() => scenePlaces(ctx), [ctx.lang]);
  const sites = R.top.map((s, i) => ({ x: s.x, y: s.y, label: `${i + 1}`, h: 1.2 }));
  return (
    <>
      <div className="model-bar glass suit-bar">
        {Object.entries(CTL).map(([id, [lo, hi, st, u]]) => (
          <label key={id} className="model-bar-item">
            <span className="muted small">{T.suitCtl[id]}: <b>{f.dec1(sp[id])} {u === 'm' ? T.m : u === 'km' ? T.km : u}</b></span>
            <input type="range" min={lo} max={hi} step={st} value={sp[id]} onChange={e => setSp({ ...sp, [id]: Number(e.target.value) })} aria-label={T.suitCtl[id]} />
          </label>
        ))}
        <div className="model-bar-item">
          <span className="muted small">{T.suitCtl.target}</span>
          <Segmented value={sp.target} onChange={v => setSp({ ...sp, target: v })} label={T.suitCtl.target} options={['far', 'all'].map(x => ({ value: x, label: T.targets[x] }))} />
        </div>
      </div>
      <SceneBox ctx={ctx} colors={colors} places={places} sites={sites} legend={<span className="legend-elev"><span className="muted small">{T.legendSuit}</span><i style={{ background: 'linear-gradient(90deg,#2b5f6a,#f2c14e)' }} /></span>} />
      <Panel title={T.suitTop} sub={`${T.suitArea}: ${f.int(R.area)} ${T.km2}. ${T.suitNote}`}>
        <div className="table-scroll">
          <table className="data-table compact plain">
            <thead><tr><th>{T.cols.site}</th><th>{T.cols.near}</th><th className="num">{T.cols.score}</th><th className="num">{T.cols.h}</th><th className="num">{T.cols.slope}</th><th className="num">{T.cols.road}</th></tr></thead>
            <tbody>
              {R.top.map((s, i) => (
                <tr key={s.cell}>
                  <td className="strong">{i + 1}</td>
                  <td>{placeName(s.near.p)} · {f.dec1(s.near.d)} {T.km}</td>
                  <td className="num">{f.int(s.score * 100)}</td>
                  <td className="num">{f.int(s.h)} {T.m}</td>
                  <td className="num">{f.dec1(s.slope)}°</td>
                  <td className="num">{f.dec1(s.road)} {T.km}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
