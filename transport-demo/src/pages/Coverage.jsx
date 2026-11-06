import { useMemo, useState } from 'react';
import { Panel, Kpi, Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { CoverageChart, EquityDots, Marker, modeMarker } from '../charts.jsx';
import { MODE_COLOR, ZONE, NO_ZONE } from '../map.jsx';
import { solve, stats, stopDistances, SIGNALS, bandOf, BANDS } from '../model.js';
import { Controls } from './controls.jsx';

const MODES3 = ['car', 'pt', 'walk'];

export default function Coverage({ ctx }) {
  const { T, f, base, S, service, period, th, go, placeName, facName, exportPlaces } = ctx;
  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState({ key: 'pt', dir: -1 });
  const sols = Object.fromEntries(MODES3.map(m => [m, solve(base, service, m, period, {})]));
  const sts = useMemo(() => Object.fromEntries(MODES3.map(m => [m, stats(base, sols[m], th)])), [service, period, th]);
  const curves = useMemo(() => Object.fromEntries(MODES3.map(m => [m, sts[m].curve(group)])), [sts, group]);
  const sd = stopDistances(base, {}, period);
  const gap = sts.pt.share.old - sts.pt.share.all;

  const rows = useMemo(() => {
    const list = base.places.map(p => {
      const t = m => sols[m].placeT.get(p.id).t;
      return {
        p, car: t('car'), pt: t('pt'), walk: t('walk'), stop: sd.get(p.id),
        fac: sols.car.facs[sols.car.placeT.get(p.id).fac],
        sigs: SIGNALS.filter(s => s.kind === 'place' && S[s.id].some(x => x.id === p.id)).length,
      };
    });
    const val = r => ({ name: placeName(r.p), kind: r.p.kind, pop: r.p.pop, old: r.p.old, car: r.car, pt: r.pt, walk: r.walk, stop: r.stop, sigs: r.sigs })[sort.key];
    return list.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir; });
  }, [sols, sort]);
  const th_ = (key, label, num) => (
    <th className={num ? 'num' : ''} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : num ? -1 : 1 }))}>{label}{sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button>
    </th>
  );
  const tcell = (t, m) => {
    const b = bandOf(t);
    return (
      <td className={'num tcell' + (t > th ? ' over' : '')}>
        <i className="dot" style={{ background: b < BANDS.length ? ZONE[b] : NO_ZONE }} />{f.tmin(t)}
      </td>
    );
  };

  return (
    <>
      <div className="kpi-grid kpi-compact">
        {MODES3.map(m => (
          <Kpi key={m} icon={m === 'car' ? 'car' : m === 'pt' ? 'bus' : 'walk'} label={T.kpi.byMode.replace('{m}', T.modes[m]).replace('{t}', th)} value={f.pct(sts[m].share.all)}
            accent={m === 'pt'} context={T.kpi.byModeCtx.replace('{n}', f.int(sts[m].withinPop)).replace('{med}', f.min(sts[m].median))} />
        ))}
        <Kpi icon="user" label={T.kpi.gap} value={f.signed(Math.round(gap * 100)) + ' ' + T.pp} deltaText={null}
          context={T.kpi.gapCtx.replace('{a}', f.pct(sts.pt.share.old)).replace('{b}', f.pct(sts.pt.share.all))} />
      </div>

      <Controls ctx={ctx} showMode={false} extra={
        <Segmented value={group} onChange={setGroup} label={T.groupLabel} options={[{ value: 'all', label: T.groups.all }, { value: 'old', label: T.groups.old }, { value: 'kids', label: T.groups.kids }]} />
      } />

      <div className="grid grid-main">
        <Panel title={T.curveTitle.replace('{g}', T.groupsLong[group])} sub={T.curveSub.replace('{s}', T.servicesGen[service]).replace('{p}', T.periodsLong[period])}
          aside={<div className="mode-legend">{MODES3.map(m => <span key={m}><svg width="12" height="12" viewBox="-6 -6 12 12"><Marker kind={modeMarker(m)} x={0} y={0} r={4} fill={MODE_COLOR[m]} /></svg>{T.modes[m]}</span>)}</div>}>
          <CoverageChart curves={curves} modes={MODES3} th={th} T={T} f={f} label={T.curveTitle.replace('{g}', T.groupsLong[group])} />
          <p className="hint">{T.curveHint.replace('{t}', th).replace('{car}', f.pct(curves.car[th])).replace('{pt}', f.pct(curves.pt[th]))}</p>
        </Panel>
        <Panel title={T.equityTitle.replace('{t}', th)} sub={T.equitySub}>
          <EquityDots T={T} f={f} modes={MODES3} label={T.equityTitle.replace('{t}', th)} rows={['all', 'old', 'kids'].map(g => ({ id: g, label: T.groups[g], v: Object.fromEntries(MODES3.map(m => [m, sts[m].share[g]])) }))} />
          <div className="equity-notes">
            {['old', 'kids'].map(g => (
              <p key={g}><b>{T.groups[g]}</b> {T.equityNote.replace('{v}', f.pct(sts.pt.share[g])).replace('{a}', f.pct(sts.pt.share.all))}</p>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={T.tableTitle} sub={T.tableSub.replace('{s}', T.servicesGen[service]).replace('{p}', T.periodsLong[period])} className="flat-panel"
        aside={<Button icon="download" onClick={exportPlaces}>{T.csvPlaces}</Button>}>
        <div className="table-scroll cov-scroll">
          <table className="data-table cov-table">
            <thead><tr>
              {th_('name', T.cols.name)}{th_('kind', T.cols.kind)}{th_('pop', T.cols.pop, true)}{th_('old', T.cols.old, true)}
              {th_('car', T.modes.car, true)}{th_('pt', T.modes.pt, true)}{th_('walk', T.modes.walk, true)}{th_('stop', T.cols.stop, true)}
              <th>{T.cols.fac}</th>{th_('sigs', T.cols.sigs, true)}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.p.id} tabIndex="0" onClick={() => go('map', { id: r.p.id })} onKeyDown={e => { if (e.key === 'Enter') go('map', { id: r.p.id }); }}>
                  <td className="strong">{placeName(r.p)}</td>
                  <td>{T.kinds[r.p.kind]}</td>
                  <td className="num">{f.int(r.p.pop)}</td>
                  <td className="num">{f.pct(r.p.old)}</td>
                  {tcell(r.car)}{tcell(r.pt)}{tcell(r.walk)}
                  <td className={'num' + (r.stop > 1.5 ? ' over' : '')}>{!Number.isFinite(r.stop) ? T.noStopShort : r.stop < 0.05 ? T.stopHere : f.km(r.stop)}</td>
                  <td>{r.fac ? facName(r.fac) : ''}</td>
                  <td className="num">{r.sigs ? f.int(r.sigs) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot"><span>{T.tableFoot.replace('{t}', th)}</span></div>
      </Panel>
    </>
  );
}
