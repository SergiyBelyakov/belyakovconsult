import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Status, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { LevelPill } from '../charts.jsx';
import { CASELOAD_NORM, KEY_IMPACT, SIGNALS } from '../model.js';

export default function Signals({ ctx }) {
  const { T, f, base, model } = ctx;
  const [open, setOpen] = useState(ctx.sig || SIGNALS[0].id);
  const listRef = useRef(null);
  useEffect(() => { if (ctx.sig) { setOpen(ctx.sig); setTimeout(() => listRef.current && listRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); } }, [ctx.sig]);
  const def = SIGNALS.find(s => s.id === open);
  const ids = model.sig[open] || [];
  const countOf = s => (s.id === 'duplicates' ? model.sig[s.id].length / 2 : s.id === 'householdMulti' ? model.hhMulti.length : model.sig[s.id].length);
  const desc = s => T.signals[s.id].desc
    .replace('{norm}', f.int(CASELOAD_NORM)).replace('{k}', ctx.people(KEY_IMPACT))
    .replace('{sw}', f.int(model.sig.careGap.filter(id => base.byId.get(id).sw).length));

  const rows = useMemo(() => {
    if (open === 'caseload') return [];
    if (open === 'duplicates') return base.dupPairs.map(e => ({ pair: e, id: e.s }));
    return ids.map(id => ({ id })).sort((a, b) => model.sc(b.id).index - model.sc(a.id).index);
  }, [open, model]);

  return (
    <>
      <div className="signal-grid">
        {SIGNALS.map(s => {
          const n = countOf(s);
          return (
            <button type="button" key={s.id} className={'signal' + (open === s.id ? ' picked' : '') + (n ? '' : ' zero')} onClick={() => setOpen(s.id)} aria-pressed={open === s.id} title={desc(s)}>
              <span className={'signal-icon lvl-' + s.severity}><Icon name={s.icon} size={16} /></span>
              <span className="signal-body">
                <strong>{T.signals[s.id].title}</strong>
              </span>
              <span className="signal-count">{f.int(n)}<small>{T.signalUnit(s.id, n)}</small></span>
              <Status level={s.severity} T={T} />
            </button>
          );
        })}
      </div>

      <div ref={listRef} className="signal-anchor" />
      <Panel title={T.signals[open].title} sub={desc(def)} className="flat-panel"
        aside={<Button icon="nodes" onClick={() => ctx.go('network', { hl: 'signal:' + open })}>{T.showInNetwork}</Button>}>
        <p className="signal-action"><Icon name="arrowRight" size={15} /><span><b>{T.todoLabel}</b> {T.signals[open].action}</span></p>
        {open === 'caseload' ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>{T.cols.worker}</th><th>{T.cols.terr}</th><th className="num">{T.cols.cases}</th><th className="num">{T.cols.norm}</th><th className="num">{T.cols.highCrit}</th><th>{T.cols.status}</th></tr></thead>
              <tbody>
                {base.services.filter(s => s.kind === 'sw').sort((a, b) => b.load - a.load).map(s => {
                  const high = s.cases.filter(id => ['high', 'critical'].includes(model.sc(id).level)).length;
                  const over = s.load > CASELOAD_NORM;
                  return (
                    <tr key={s.id} tabIndex="0" onClick={() => ctx.go('network', { id: s.id })} onKeyDown={e => { if (e.key === 'Enter') ctx.go('network', { id: s.id }); }}>
                      <td className="strong">{ctx.svcName(s)}</td>
                      <td>{ctx.terrName(s.territory)}</td>
                      <td className="num strong">{f.int(s.load)}</td>
                      <td className="num">{f.int(CASELOAD_NORM)}</td>
                      <td className="num">{f.int(high)}</td>
                      <td><Status level={over ? 'warning' : 'healthy'} T={T} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>{T.cols.id}</th><th>{T.cols.terr}</th><th className="num">{T.cols.age}</th><th>{T.cols.level}</th><th className="num">{T.cols.index}</th><th>{T.cols.why}</th><th>{T.cols.action}</th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const p = base.byId.get(r.id), s = model.sc(r.id);
                  return (
                    <tr key={r.id + (r.pair ? r.pair.t : '')} tabIndex="0" onClick={() => ctx.go('network', { id: r.id })} onKeyDown={e => { if (e.key === 'Enter') ctx.go('network', { id: r.id }); }}>
                      <td className="strong">{r.pair ? <>{r.pair.s} <span className="muted">↔</span> {r.pair.t}</> : p.id}</td>
                      <td>{ctx.terrName(p.territory)}</td>
                      <td className="num">{ctx.sexAge(p)}</td>
                      <td><LevelPill level={s.level} T={T} /></td>
                      <td className="num strong">{f.int(s.index)}</td>
                      <td className="why">{why(open, p, r, ctx)}</td>
                      <td className="muted">{T.signals[open].todo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!rows.length && open !== 'caseload' && <p className="empty-line">{T.noSignal}</p>}
      </Panel>
      <p className="hint signal-note">{T.signalNote}</p>
    </>
  );
}

function why(id, p, r, ctx) {
  const { T, f, base, model } = ctx;
  switch (id) {
    case 'careGap': return [T.why.careNeed, p.sw ? T.why.hasSw : T.why.noSw].join(' · ');
    case 'isolatedHigh': return [p.hhSize === 1 ? T.why.alone : null, T.why.noTies, p.dupOf ? T.why.maybeDup : null].filter(Boolean).join(' · ');
    case 'caregiverLoad': return [T.why.cares.replace('{n}', f.int(p.caring)), ['high', 'critical'].includes(model.sc(p.id).level) ? T.why.ownNeed : null].filter(Boolean).join(' · ');
    case 'householdMulti': return T.why.hh.replace('{id}', p.hh);
    case 'medAccess': return [T.why.chronic.replace('{n}', f.int(p.chronic)), !p.declaration ? T.why.noDecl : p.lastVisit == null ? T.why.noVisitData : T.why.lastVisit.replace('{n}', f.int(p.lastVisit))].join(' · ');
    case 'duplicates': return T.why.dup.replace('{s}', f.pct(r.pair.sim));
    case 'keyPeople': return T.why.key.replace('{n}', ctx.people(p.cutImpact)).replace('{h}', f.int(p.cutHouseholds));
    case 'rehabGap': return T.why.rehab;
    case 'benefitGap': return T.why.benefit;
    default: return '';
  }
}
