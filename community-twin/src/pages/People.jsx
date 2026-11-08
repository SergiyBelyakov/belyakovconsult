import { useMemo, useState } from 'react';
import { Panel, Select, Segmented } from '../../../dashboard/src/ui.jsx';
import { PLACES, BY_ID, OKRUGS, TOTAL, EST_W, sumAge } from '../world.js';
import { projection } from '../model.js';
import { Waterfall, Dumbbell, Pyramid, ForecastMini, COL } from '../charts.jsx';
import TwinMap from '../TwinMap.jsx';

const NONE = new Set();
const GAP_BR = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
const gapColor = v => COL.seq[GAP_BR.filter(b => v >= b).length];

export default function People({ ctx }) {
  const { T, f, scen, setScen, placeName, go } = ctx;
  const [pyr, setPyr] = useState('all');
  const [pick, setPick] = useState(null);
  const est = { meters: 0, decl: 0, reg: 0 };
  PLACES.forEach(p => { est.meters += p.est.meters; est.decl += p.est.decl; est.reg += p.est.reg; });
  const rmin = PLACES.reduce((a, p) => a + p.range[0], 0), rmax = PLACES.reduce((a, p) => a + p.range[1], 0);
  const gapRows = useMemo(() => [...PLACES].sort((a, b) => (b.src.reg / b.pop) - (a.src.reg / a.pop)).slice(0, 15)
    .map(p => ({ id: p.id, label: placeName(p), a: p.src.reg, b: p.pop, gapLabel: f.signedPct(p.src.reg / p.pop - 1, 0) })), [ctx.lang]);
  const choropleth = useMemo(() => ({ level: 'place', value: id => { const p = BY_ID.get(id); return p.src.reg / p.pop - 1; }, color: gapColor }), []);
  // піраміда: громада або округ, 2026 і базовий прогноз 2035
  const P = projection('base');
  const pyrData = useMemo(() => {
    const ids = pyr === 'all' ? PLACES.map(p => p.id) : OKRUGS.find(o => o.id === pyr).places;
    const M = new Float64Array(91), F = new Float64Array(91), M2 = new Float64Array(91), F2 = new Float64Array(91);
    ids.forEach(id => { const i = BY_ID.get(id).i, a = PLACES[i].age, b = P.P.byPlace[i][9]; for (let k = 0; k <= 90; k++) { M[k] += a.M[k]; F[k] += a.F[k]; M2[k] += b.M[k]; F2[k] += b.F[k]; } });
    return { M, F, M2, F2 };
  }, [pyr]);
  const fc = useMemo(() => ({ base: projection('base').years, low: projection('low').years, high: projection('high').years }), []);
  const cur = projection(scen).years, y0 = cur[0], y9 = cur[9];
  const impl = { pop: y9.pop, popChg: y9.pop / y0.pop - 1, schoolDrop: y0.school - y9.school, first: cur[6].first, first0: y0.first, old0: y0.old / y0.pop, old1: y9.old / y9.pop };
  const years = fc.base.map(r => r.year);
  const methods = [['meters', est.meters], ['decl', est.decl], ['reg', est.reg]];
  return (
    <>
      <div className="kpi-mini-row wide glass five">
        <div><span>{T.people.kpi.est}</span><b>{f.int(TOTAL.pop)}</b><small>{T.people.kpiSub.est(f.int(rmin) + '…' + f.int(rmax))}</small></div>
        <div><span>{T.people.kpi.reg}</span><b>{f.int(TOTAL.reg)}</b><small className="over">{T.people.kpiSub.reg(f.signedPct(TOTAL.reg / TOTAL.pop - 1))}</small></div>
        <div><span>{T.people.kpi.idp}</span><b>{f.int(TOTAL.idp)}</b><small>{T.people.kpiSub.idp}</small></div>
        <div><span>{T.people.kpi.decl}</span><b>{f.int(TOTAL.decl)}</b><small>{T.people.kpiSub.decl(f.pct(TOTAL.decl / TOTAL.pop))}</small></div>
        <div><span>{T.people.kpi.meters}</span><b>{f.int(TOTAL.meters)}</b><small>{T.people.kpiSub.meters}</small></div>
      </div>

      <div className="grid grid-2">
        <Panel title={T.people.wfTitle} sub={T.people.wfSub}>
          <Waterfall label={T.people.wfTitle} fmt={f.int} height={340} steps={[
            { label: T.people.wf.reg, v: TOTAL.reg, kind: 'start' },
            { label: T.people.wf.absent, v: -(TOTAL.reg + TOTAL.idp - TOTAL.pop), kind: 'minus', note: T.people.wfNote.absent },
            { label: T.people.wf.idp, v: TOTAL.idp, kind: 'plus', note: T.people.wfNote.idp },
            { label: T.people.wf.est, v: TOTAL.pop, kind: 'end' },
          ]} />
        </Panel>
        <Panel title={T.people.methodsTitle} sub={T.people.methodsSub}>
          <div className="methods">
            {methods.map(([k, v]) => (
              <div key={k} className="method-row">
                <div className="mr-top"><strong>{T.people.m[k][0]}</strong><b>{f.int(v)}</b></div>
                <div className="mr-dev" title={f.signedPct(v / TOTAL.pop - 1)}><i style={(() => { const d = Math.max(-0.06, Math.min(0.06, v / TOTAL.pop - 1)), w = (Math.abs(d) / 0.06) * 50; return d >= 0 ? { left: '50%', width: w + '%' } : { left: 50 - w + '%', width: w + '%' }; })()} /><em /></div>
                <p>{T.people.m[k][1]}</p>
                <small>{T.people.weight} {f.dec2(EST_W[k])} · {f.signedPct(v / TOTAL.pop - 1)} {T.people.dev}</small>
              </div>
            ))}
            <div className="method-row total"><div className="mr-top"><strong>{T.people.kpi.est}</strong><b>{f.int(TOTAL.pop)}</b></div></div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={T.people.gapTitle} sub={T.people.gapSub} aside={<div className="mini-leg"><span><i className="sq" style={{ background: COL.ochre }} />{T.people.regName}</span><span><i style={{ background: COL.blue }} />{T.people.estName}</span></div>}>
          <Dumbbell rows={gapRows} fmt={f.int} names={[T.people.regName, T.people.estName]} label={T.people.gapTitle} onPick={id => setPick(id)} picked={pick} />
        </Panel>
        <Panel title={T.people.mapTitle} sub={T.people.mapSub}>
          <TwinMap ctx={ctx} layers={NONE} choropleth={choropleth} selected={pick ? { kind: 'place', id: pick } : null} onSelect={s => s && s.kind === 'place' ? setPick(s.id) : setPick(null)} height={420} compact label={T.people.mapTitle}
            tipExtra={(k, id) => { const p = BY_ID.get(id); return p ? <small>{T.people.regName}: {f.int(p.src.reg)} · {T.people.estName}: {f.int(p.pop)} · {f.signedPct(p.src.reg / p.pop - 1, 0)}</small> : null; }} />
          <div className="seq-legend">
            {COL.seq.map((c, i) => <span key={c}><i style={{ background: c }} />{i === 0 ? '< ' + f.pct(GAP_BR[0], 0) : i === COL.seq.length - 1 ? '≥ ' + f.pct(GAP_BR[i - 1], 0) : f.pct(GAP_BR[i - 1], 0) + '…' + f.pct(GAP_BR[i], 0)}</span>)}
          </div>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={T.people.pyrTitle} sub={T.people.pyrSub} aside={<Select value={pyr} onChange={setPyr} label={T.people.pyrTitle} options={[{ value: 'all', label: T.people.pyrAll }, ...OKRUGS.map(o => ({ value: o.id, label: T.okrugName(o.id) }))]} />}>
          <div className="mini-leg"><span><i style={{ background: COL.blue }} />{T.men}</span><span><i style={{ background: COL.pink }} />{T.women}</span><span><i className="dash" />{T.pyr2035}</span></div>
          <Pyramid {...pyrData} T={T} f={f} label={T.people.pyrTitle} />
        </Panel>
        <Panel title={T.people.fcTitle} sub={T.people.fcSub} aside={<Segmented value={scen} onChange={setScen} label={T.people.fcTitle} options={['low', 'base', 'high'].map(s => ({ value: s, label: T.people.scen[s] }))} />}>
          <p className="muted small scen-note">{T.people.scen[scen]}: {T.people.scenNote[scen]}</p>
          <div className="fc-grid">
            {['pre', 'school', 'work', 'old'].map(k => (
              <ForecastMini key={k} title={T.people.fc[k]} years={years} base={cur.map(r => r[k])} low={fc.low.map(r => r[k])} high={fc.high.map(r => r[k])} fmt={f.int} T={T} f={f} />
            ))}
          </div>
          <h4 className="impl-title">{T.people.impl}</h4>
          <ul className="impl-list">{T.people.implItems(impl, f).map(t => <li key={t}>{t}</li>)}</ul>
        </Panel>
      </div>
    </>
  );
}
