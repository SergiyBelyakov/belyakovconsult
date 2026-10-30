import { useMemo } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { BarList } from '../../../dashboard/src/charts.jsx';
import { COLORS, StackedBars } from '../charts.jsx';
import { MiniGraph } from '../graph.jsx';
import { COMPONENTS, CASELOAD_NORM } from '../model.js';
import { TERRITORIES } from '../data.js';

const KIND = Object.fromEntries(TERRITORIES.map(t => [t.id, t.kind]));

export default function Communities({ ctx }) {
  const { T, f, base, model, layout } = ctx;
  const styles = useMemo(() => new Map(base.nodes.map(n => [n.id, n.kind === 'person'
    ? { r: 4 + Math.min(1, model.sc(n.id).index / 70) * 6.4, fill: COLORS.level[model.sc(n.id).level] }
    : { r: 11 }])), [base, model]);
  const terr = model.territories;
  const openTerr = id => ctx.go('network', { hl: 'terr:' + id });

  return (
    <>
      <div className="terr-grid">
        {terr.map(t => (
          <button type="button" key={t.id} className="terr-card glass" onClick={() => openTerr(t.id)}>
            <span className="terr-head">
              <strong>{ctx.terrName(t.id)}</strong>
              <small>{T.terrKind[KIND[t.id]]}</small>
            </span>
            <MiniGraph base={base} pos={layout.pos} territory={t.id} styles={styles} label={ctx.terrName(t.id)} />
            <span className="terr-stats">
              <span><b>{f.int(t.avg)}</b><small>{T.tAvg}</small></span>
              <span><b>{f.pct(t.highShare)}</b><small>{T.tHigh}</small></span>
              <span><b>{f.int(t.isolatedHigh)}</b><small>{T.tIsolated}</small></span>
            </span>
            <span className="terr-foot">{T.tPeople.replace('{p}', f.int(t.people)).replace('{h}', f.int(t.households))}<span className="terr-go">{T.openInNetwork} →</span></span>
          </button>
        ))}
      </div>

      <div className="grid grid-main">
        <Panel title={T.decompTitle} sub={T.decompSub}
          aside={<div className="legend-inline">{COMPONENTS.map(k => <span key={k}><i style={{ background: COLORS[k] }} />{T.compShort[k]}</span>)}</div>}>
          <StackedBars rows={terr.map(t => ({ id: t.id, name: ctx.terrName(t.id), parts: t.contrib }))} keys={COMPONENTS} colors={COLORS} names={T.comp}
            fmt={v => f.dec1(v)} label={T.decompTitle} onPick={openTerr} />
          <p className="hint">{T.decompHint}</p>
        </Panel>
        <Panel title={T.careCovTitle} sub={T.careCovSub}>
          <BarList items={terr.map(t => ({ id: t.id, name: ctx.terrName(t.id), value: t.careCovered * 100 }))} max={100} refLine={90} refLabel={T.target90}
            fmt={(v, it) => f.pct(v / 100) + ' · ' + f.int(terr.find(x => x.id === it.id).careNeed)} color={COLORS.n} onPick={openTerr} />
        </Panel>
      </div>
      <div className="grid grid-main">
        <Panel title={T.chronicTitle} sub={T.chronicSub}>
          <BarList items={terr.map(t => ({ id: t.id, name: ctx.terrName(t.id), value: t.chronicCovered * 100 }))} max={100} refLine={90} refLabel={T.target90}
            fmt={(v, it) => f.pct(v / 100) + ' · ' + f.int(terr.find(x => x.id === it.id).chronic)} color={COLORS.m} onPick={openTerr} />
        </Panel>
        <Panel title={T.loadTitle} sub={T.loadSub}>
          <BarList items={base.services.filter(s => s.kind === 'sw').map(s => ({ id: s.id, name: ctx.svcShort(s) + ' · ' + T.terrLetter[s.territory], value: s.load, color: s.load > CASELOAD_NORM ? '#FFB020' : '#A8B0BC' }))}
            max={Math.max(CASELOAD_NORM * 1.5, ...base.services.filter(s => s.kind === 'sw').map(s => s.load))} refLine={CASELOAD_NORM} refLabel={T.normMark}
            fmt={(v, it) => f.int(v) + (v > CASELOAD_NORM ? ' · ' + T.overNorm : '')} onPick={id => ctx.go('network', { id })} />
        </Panel>
      </div>

      <Panel title={T.compareTitle} sub={T.compareSub} className="flat-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr>
              <th>{T.cols.terr}</th><th className="num">{T.cols.people}</th><th className="num">{T.cols.avgIdx}</th><th className="num">{T.cols.highCrit}</th>
              <th className="num">{T.cols.isolatedHigh}</th><th className="num">{T.cols.careCov}</th><th className="num">{T.cols.chronicCov}</th>
              <th className="num">{T.cols.caseload}</th><th className="num">{T.cols.tiesPer}</th>
            </tr></thead>
            <tbody>
              {terr.map(t => (
                <tr key={t.id} tabIndex="0" onClick={() => openTerr(t.id)} onKeyDown={e => { if (e.key === 'Enter') openTerr(t.id); }}>
                  <td className="strong">{ctx.terrName(t.id)} <span className="muted">· {T.terrKind[KIND[t.id]]}</span></td>
                  <td className="num">{f.int(t.people)}</td>
                  <td className="num strong">{f.int(t.avg)}</td>
                  <td className="num">{f.int(t.high)} · {f.pct(t.highShare)}</td>
                  <td className="num">{f.int(t.isolatedHigh)}</td>
                  <td className="num">{f.pct(t.careCovered)}</td>
                  <td className="num">{f.pct(t.chronicCovered)}</td>
                  <td className="num">{f.dec1(t.caseload)}{t.caseload > CASELOAD_NORM && <span className="reason warn">{T.overNorm}</span>}</td>
                  <td className="num">{f.dec1(t.avgTies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">{T.compareHint.replace('{norm}', f.int(CASELOAD_NORM))}</p>
      </Panel>
    </>
  );
}
