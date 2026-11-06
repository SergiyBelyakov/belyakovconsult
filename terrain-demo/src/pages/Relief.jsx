import { useMemo, useState } from 'react';
import { Panel, Select } from '../../../dashboard/src/ui.jsx';
import { layerElev } from '../layers.js';
import { floodStageOf, profile, WORLD } from '../dem.js';
import { SceneBox, ElevLegend, ProfileChart, scenePlaces } from './controls.jsx';

export default function Relief({ ctx }) {
  const { T, f, T3, placeName, stage } = ctx;
  const colors = useMemo(() => layerElev(T3), []);
  const places = useMemo(() => scenePlaces(ctx), [ctx.lang]);
  const st = floodStageOf(T3);
  const [a, setA] = useState('yas'), [b, setB] = useState('oze');
  const prof = profile(T3, T3.byId.get(a), T3.byId.get(b));
  const sorted = [...T3.places].sort((x, y) => x.h - y.h);
  const opts = T3.places.map(p => ({ value: p.id, label: placeName(p) })).sort((x, y) => x.label.localeCompare(y.label));
  return (
    <>
      <SceneBox ctx={ctx} colors={colors} places={places} legend={<ElevLegend T={T} min={T3.min} max={T3.max} />} />
      <div className="kpi-mini-row wide glass">
        <div><span>{T.stats.min}</span><b>{f.int(T3.min)} {T.m}</b></div>
        <div><span>{T.stats.max}</span><b>{f.int(T3.max)} {T.m}</b></div>
        <div><span>{T.stats.relief}</span><b>{f.int(T3.max - T3.min)} {T.m}</b></div>
        <div><span>{T.stats.places}</span><b>{f.int(T3.places.length)}</b></div>
        <div><span>{T.stats.area}</span><b>≈ {f.int(WORLD.w * WORLD.h * 0.78)} {T.km2}</b></div>
        <div><span>{T.cols.pop}</span><b>{f.int(T3.base.total.all)}</b></div>
      </div>
      <div className="grid grid-2">
        <Panel title={T.profileTitle} sub={T.profileSub}>
          <div className="toolbar">
            <Select value={a} onChange={setA} options={opts} label={T.from} />
            <Select value={b} onChange={setB} options={opts} label={T.to} />
          </div>
          <ProfileChart data={prof} water={stage} f={f} T={T} />
        </Panel>
        <Panel title={T.placesTitle} sub={T.placesSub}>
          <div className="table-scroll short">
            <table className="data-table compact plain">
              <thead><tr><th>{T.cols.place}</th><th className="num">{T.cols.h}</th><th className="num">{T.cols.stage}</th><th className="num">{T.cols.pop}</th></tr></thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id}>
                    <td className="strong">{placeName(p)}</td>
                    <td className="num">{f.int(p.h)} {T.m}</td>
                    <td className={'num' + (st.has(p.id) && st.get(p.id) <= 3 ? ' over' : '')}>{st.has(p.id) ? '+' + f.dec1(st.get(p.id)) + ' ' + T.m : T.never}</td>
                    <td className="num">{f.int(p.pop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
