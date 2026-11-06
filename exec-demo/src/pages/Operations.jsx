import { Panel } from '../../../dashboard/src/ui.jsx';
import { SmallMultiples, BarList } from '../../../dashboard/src/charts.jsx';
import { C } from '../charts.jsx';
import { agg, MONTHS } from '../model.js';

const COLORS = [C.series.registry, C.series.finance, C.series.health, C.series.operations, C.series.geo];

export default function Operations({ ctx }) {
  const { T, f, D, ind, i, unitName, unit, setUnit } = ctx;
  const months = MONTHS.slice(0, i + 1);
  const ops = D.units.filter(u => u.kind !== 'office');
  const ser = (key, filter = () => true, scale = 1) => ops.filter(filter).map((u, k) => ({ id: u.id, name: unitName(u.id), color: COLORS[k % COLORS.length], values: u.rows.slice(0, i + 1).map(r => (r[key] == null ? null : r[key] * scale)) }));
  const tip = fmt => (s, m, v) => <><b>{s.name}</b><br />{f.month(m, true)}: {fmt(v)}</>;
  const cur = ops.map(u => ({ id: u.id, name: unitName(u.id), c: agg([u], i) }));
  const bar = (key, fmt, ref, refLabel, good = true) => (
    <BarList items={cur.filter(x => x.c[key] != null).map(x => ({ id: x.id, name: x.name, value: x.c[key], color: ref != null && (good ? x.c[key] < ref : x.c[key] > ref) ? C.status.critical : C.primary }))}
      refLine={ref} refLabel={refLabel} fmt={fmt} picked={unit} onPick={id => setUnit(unit === id ? 'all' : id)} />
  );

  if (ind === 'mfg') {
    return (
      <>
        <p className="page-note muted small">{T.opsNote.mfg}</p>
        <Panel title={T.ops.oee}>
          <SmallMultiples series={ser('oee', () => true, 100)} months={months} tick={f.tick} domain={[55, 85]} refLine={75} fmt={v => f.dec1(v) + '%'} tip={tip(v => f.dec1(v) + '%')} />
        </Panel>
        <Panel title={T.ops.defect}>
          <SmallMultiples series={ser('defect')} months={months} tick={f.tick} domain={[0, 3.5]} refLine={2} fmt={v => f.dec1(v) + '%'} tip={tip(v => f.dec1(v) + '%')} />
        </Panel>
        <Panel title={T.ops.otd}>
          <SmallMultiples series={ser('otd', () => true, 100)} months={months} tick={f.tick} domain={[78, 100]} refLine={95} fmt={v => f.dec1(v) + '%'} tip={tip(v => f.dec1(v) + '%')} />
        </Panel>
        <div className="grid grid-2">
          <Panel title={T.ops.util} sub={f.month(D.company[i].m, true)}>{bar('utilPlant', v => f.pct(v, 0))}</Panel>
          <Panel title={T.ops.downtime} sub={f.month(D.company[i].m, true)}>{bar('downtime', v => f.int(v), 50, '50', false)}</Panel>
        </div>
      </>
    );
  }
  return (
    <>
      <p className="page-note muted small">{T.opsNote.svc}</p>
      <Panel title={T.ops.nps}>
        <SmallMultiples series={ser('nps')} months={months} tick={f.tick} domain={[25, 65]} refLine={40} fmt={v => f.int(v)} tip={tip(v => f.int(v))} />
      </Panel>
      <Panel title={T.ops.wait}>
        <SmallMultiples series={ser('wait', u => u.kind === 'branch')} months={months} tick={f.tick} domain={[0, 32]} refLine={15} fmt={v => f.int(v) + ' ' + T.minUnit} tip={tip(v => f.dec1(v) + ' ' + T.minUnit)} />
      </Panel>
      <div className="grid grid-3">
        <Panel title={T.ops.utilStaff} sub={f.month(D.company[i].m, true)}>{bar('utilStaff', v => f.pct(v, 0), 0.75, '75%')}</Panel>
        <Panel title={T.ops.clients} sub={f.month(D.company[i].m, true)}>{bar('clients', v => f.int(v))}</Panel>
        <Panel title={T.ops.repeat} sub={f.month(D.company[i].m, true)}>{bar('repeat', v => f.pct(v, 0), 0.4, '40%')}</Panel>
      </div>
    </>
  );
}
