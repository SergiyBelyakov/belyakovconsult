import { useMemo, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { TOTAL, BUDGET, LAND, BUILDINGS, SCHOOLS, OBJ_BY, OKRUGS, own, transfers, YEARS } from '../world.js';
import { IND_BY } from '../model.js';
import { HBars, Columns, Scatter, COL } from '../charts.jsx';
import TwinMap from '../TwinMap.jsx';

const NONE = new Set();
const LAND_BR = [0.02, 0.04, 0.06, 0.08, 0.1, 0.12];
const landColor = v => COL.seq[LAND_BR.filter(b => v >= b).length];

export default function Finance({ ctx }) {
  const { T, f, objName, go } = ctx;
  const [pick, setPick] = useState(null);
  const y = 5, ownV = own(y), trV = transfers(y);
  const rev = [...BUDGET.rev.map(([k, v]) => ({ id: k, label: T.fin.rev[k], v: v[y] })), ...BUDGET.transfers.map(([k, v]) => ({ id: k, label: T.fin.rev[k], v: v[y], color: COL.ochre }))];
  const exp = [...BUDGET.exp].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ id: k, label: T.fin.exp[k], v }));
  const pts = SCHOOLS.map(s => ({ id: s.id, label: objName(s), x: s.pupils, y: s.perPupil, tag: s.perPupil > 150 ? objName(s).split(',')[1] : null }));
  const landTot = LAND.reduce((a, l) => ({ agri: a.agri + l.agri, unreg: a.unreg + l.unreg, used: a.used + l.used, gap: a.gap + l.gap }), { agri: 0, unreg: 0, used: 0, gap: 0 });
  const choropleth = useMemo(() => ({ level: 'okrug', value: id => { const l = LAND.find(x => x.okrug === id); return l.used / l.agri; }, color: landColor }), []);
  const bld = { all: BUILDINGS.length, noRights: BUILDINGS.filter(b => !b.rights).length, noCad: BUILDINGS.filter(b => !b.cad).length, noAudit: BUILDINGS.filter(b => !b.audit).length, areaDoc: BUILDINGS.filter(b => b.areaDoc !== b.area).length };
  const top = [...BUILDINGS].sort((a, b) => b.kwh - a.kwh).slice(0, 8);
  return (
    <>
      <div className="kpi-mini-row wide glass five">
        <div><span>{T.fin.kpi.own}</span><b>{f.mln(ownV)}</b><small>{T.fin.kpiSub.own(f.signedPct(ownV / own(4) - 1))}</small></div>
        <div><span>{T.fin.kpi.pc}</span><b>{f.uah(ownV * 1e6 / TOTAL.pop)}</b><small>{T.fin.kpiSub.pc(f.uah(ownV * 1e6 / TOTAL.reg))}</small></div>
        <div><span>{T.fin.kpi.tr}</span><b>{f.pct(trV / (ownV + trV))}</b><small>{T.fin.kpiSub.tr}</small></div>
        <div><span>{T.fin.kpi.capex}</span><b>{f.pct(BUDGET.capex[y])}</b><small>{T.fin.kpiSub.capex}</small></div>
        <div><span>{T.fin.kpi.gap}</span><b className="over">{f.mln(landTot.gap / 1000)}</b><small>{T.fin.kpiSub.gap}</small></div>
      </div>

      <div className="grid grid-2">
        <Panel title={T.fin.revTitle} sub={T.fin.revSub} aside={<div className="mini-leg"><span><i style={{ background: COL.blue }} />{T.fin.kpi.own.replace(' 2026', '')}</span><span><i style={{ background: COL.ochre }} />{T.fin.kpi.tr}</span></div>}>
          <HBars items={rev} fmt={v => f.dec1(v)} label={T.fin.revTitle} />
        </Panel>
        <Panel title={T.fin.ownTitle} sub={T.fin.ownSub}>
          <Columns years={YEARS} values={YEARS.map((_, i) => own(i))} fmt={v => f.mln(v)} fmtAxis={v => f.int(v)} label={T.fin.ownTitle} last />
          <div className="kpi-mini-row">
            <div><span>{T.ind.revPc.n}</span><b>{f.uah(IND_BY.get('revPc').v)}</b></div>
            <div><span>{T.benchMed}</span><b>{f.uah(IND_BY.get('revPc').bench[2])}</b></div>
            <div><span>{T.ind.landPay.n}</span><b>{f.mln(BUDGET.rev[2][1][y])}</b></div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={T.fin.expTitle} sub={T.fin.expSub}>
          <HBars items={exp} fmt={v => f.dec1(v)} label={T.fin.expTitle} />
        </Panel>
        <Panel title={T.fin.schTitle} sub={T.fin.schSub}>
          <Scatter points={pts} fmtX={v => f.int(v)} fmtY={v => f.int(v)} xLabel={T.fin.pupils} yLabel={T.fin.perPupil} label={T.fin.schTitle} onPick={id => go('map', { mode: 'map', sel: { kind: 'obj', id } })} />
        </Panel>
      </div>

      <Panel title={T.fin.landTitle} sub={T.fin.landSub}>
        <div className="grid land-grid">
          <div className="table-scroll">
            <table className="data-table compact plain land-table">
              <thead><tr><th>{T.fin.landCols.okrug}</th><th className="num">{T.fin.landCols.agri}</th><th className="num">{T.fin.landCols.reg}</th><th className="num">{T.fin.landCols.used}</th><th className="num">{T.fin.landCols.gap}</th></tr></thead>
              <tbody>
                {[...LAND].sort((a, b) => b.gap - a.gap).map(l => (
                  <tr key={l.okrug} className={pick === l.okrug ? 'picked' : ''} onClick={() => setPick(pick === l.okrug ? null : l.okrug)}>
                    <td className="strong">{T.okrugName(l.okrug)}</td>
                    <td className="num">{f.ha(l.agri)}</td>
                    <td className="num">{f.pct(l.reg)}</td>
                    <td className={'num' + (l.used >= 800 ? ' over' : '')}>{f.ha(l.used)}</td>
                    <td className="num">{f.thou(l.gap)}</td>
                  </tr>
                ))}
                <tr className="total-row"><td>{T.fin.landTotal}</td><td className="num">{f.ha(landTot.agri)}</td><td className="num">{f.pct(1 - landTot.unreg / landTot.agri)}</td><td className="num">{f.ha(landTot.used)}</td><td className="num">{f.thou(landTot.gap)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <TwinMap ctx={ctx} layers={NONE} choropleth={choropleth} selected={pick ? { kind: 'okrug', id: pick } : null} onSelect={s => setPick(s && s.kind === 'okrug' ? s.id : null)} height={360} compact label={T.fin.landMap}
              tipExtra={(k, id) => { if (k !== 'area') return null; const l = LAND.find(x => x.okrug === id); return <small>{f.ha(l.used)} · {f.pct(l.used / l.agri, 1)}</small>; }} />
            <p className="muted small">{T.fin.landMap}</p>
            <div className="seq-legend">{COL.seq.map((c, i) => <span key={c}><i style={{ background: c }} />{i === 0 ? '< ' + f.pct(LAND_BR[0], 0) : i === COL.seq.length - 1 ? '≥ ' + f.pct(LAND_BR[i - 1], 0) : f.pct(LAND_BR[i - 1], 0) + '…' + f.pct(LAND_BR[i], 0)}</span>)}</div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-2">
        <Panel title={T.fin.bldTitle} sub={T.fin.bldSub}>
          <div className="bld-stats">
            {Object.entries(bld).map(([k, v]) => <div key={k} className={k !== 'all' ? 'warnish' : ''}><b>{f.int(v)}</b><span>{T.fin.bld[k]}</span>{k !== 'all' && <i style={{ width: (v / bld.all) * 100 + '%' }} />}</div>)}
          </div>
        </Panel>
        <Panel title={T.fin.topTitle} sub={T.fin.topSub}>
          <div className="table-scroll">
            <table className="data-table compact plain">
              <thead><tr><th>{T.fin.topCols.name}</th><th className="num">{T.fin.topCols.kwh}</th><th className="num">{T.fin.topCols.cost}</th><th className="num">{T.fin.topCols.save}</th></tr></thead>
              <tbody>
                {top.map(b => (
                  <tr key={b.id} onClick={() => go('map', { mode: 'map', sel: { kind: 'obj', id: b.id } })} className="click">
                    <td className="strong">{objName(OBJ_BY.get(b.id))}<small>{f.int(b.area)} {T.m2}{b.audit ? '' : ' · ' + T.map.iss.noAudit}</small></td>
                    <td className="num">{f.int(b.kwh)}</td>
                    <td className="num">{f.thou(b.cost)}</td>
                    <td className="num good">{f.thou(b.cost * 0.3)}</td>
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
