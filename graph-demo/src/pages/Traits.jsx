import { useMemo, useState } from 'react';
import { Panel, Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { TraitGraph } from '../graph.jsx';
import { COLORS } from '../charts.jsx';
import { MIN_GROUP, TRAITS } from '../model.js';

const LIFTS = [1.3, 1.6, 2];

export default function Traits({ ctx }) {
  const { T, f, base, model, traitLayout } = ctx;
  const [minLift, setMinLift] = useState(1.6);
  const [sel, setSel] = useState(ctx.hl && ctx.hl.startsWith('trait:') ? ctx.hl.slice(6) : 'alone');
  const links = useMemo(() => base.pairs.filter(p => p.n >= MIN_GROUP && p.lift >= minLift), [base, minLift]);
  const N = base.people.length;
  const i = sel != null ? base.traitIdx[sel] : -1;
  const partners = useMemo(() => {
    if (sel == null) return [];
    return base.pairs.filter(p => (p.a === sel || p.b === sel) && p.n >= MIN_GROUP && p.lift > 1)
      .map(p => ({ id: p.a === sel ? p.b : p.a, lift: p.lift, n: p.n }))
      .sort((a, b) => b.lift - a.lift).slice(0, 7);
  }, [base, sel]);
  const maxLift = Math.max(2, ...partners.map(p => p.lift));
  const strongest = useMemo(() => base.pairs.filter(p => p.n >= MIN_GROUP && p.lift >= minLift).sort((a, b) => b.lift - a.lift).slice(0, 12)
    .map(p => {
      const both = base.people.filter(x => x.traits[p.ai] && x.traits[p.bi]);
      return { ...p, avg: both.reduce((a, x) => a + model.sc(x.id).index, 0) / both.length };
    }), [base, model, minLift]);
  const domainName = d => T.domains[d];

  return (
    <>
      <div className="toolbar trait-toolbar">
        <span className="tool-label">{T.minLift}</span>
        <Segmented value={minLift} onChange={setMinLift} label={T.minLift} options={LIFTS.map(v => ({ value: v, label: '×' + f.dec1(v) }))} />
        <span className="tool-note">{T.minGroupNote.replace('{k}', f.int(MIN_GROUP))}</span>
      </div>
      <div className="grid grid-net">
        <Panel title={T.traitMapTitle} sub={T.traitMapSub} aside={<span className="count-pill">{f.int(links.length)} {T.pairsWord}</span>}>
          <TraitGraph traits={TRAITS} layout={traitLayout} prevalence={base.prevalence} links={links} selected={sel} onSelect={setSel}
            color={d => COLORS[d]} name={id => T.traitsShort[id] || T.traits[id]} label={T.traitMapTitle}
            tip={id => {
              const k = base.traitIdx[id];
              return (<><b>{domainName(TRAITS[k].domain)}</b><strong>{T.traits[id]}</strong>
                <small>{f.int(base.prevalence[k])} {T.peopleWord(base.prevalence[k])} · {f.pct(base.prevalence[k] / N)}</small>
                <small>{T.avgIndex} {f.int(model.traitIndex[k])}</small></>);
            }} />
          <div className="graph-legend">
            <div className="level-legend">
              {['d', 's', 'm'].map(d => <span key={d}><i className="lv" style={{ background: COLORS[d] }} />{T.domains[d]}</span>)}
            </div>
            <span className="muted small">{T.traitLegend}</span>
          </div>
        </Panel>
        <aside className="side-stack">
          {sel != null ? (
            <Panel className="profile">
              <div className="profile-head">
                <div>
                  <span className="profile-kicker"><i className="kick-dot" style={{ background: COLORS[TRAITS[i].domain] }} />{domainName(TRAITS[i].domain)}</span>
                  <h3>{T.traits[sel]}</h3>
                  <p className="muted">{T.traitDesc[sel]}</p>
                </div>
              </div>
              <dl className="detail-list compact">
                <div><dt>{T.carriers}</dt><dd>{f.int(base.prevalence[i])} · {f.pct(base.prevalence[i] / N)}</dd></div>
                <div><dt>{T.avgIndex}</dt><dd>{f.int(model.traitIndex[i])} <small className="muted">({T.allPeople} {f.int(model.avg)})</small></dd></div>
                <div><dt>{T.highShare}</dt><dd>{f.pct(model.traitHigh[i])}</dd></div>
              </dl>
              <div className="profile-block">
                <h4>{T.togetherTitle}</h4>
                <p className="muted small">{T.togetherSub}</p>
                <div className="lift-list">
                  {partners.map(p => (
                    <button type="button" key={p.id} className="lift-row" onClick={() => setSel(p.id)}>
                      <span className="lift-name"><i style={{ background: COLORS[TRAITS[base.traitIdx[p.id]].domain] }} />{T.traits[p.id]}</span>
                      <span className="lift-track"><i style={{ width: ((p.lift - 1) / (maxLift - 1)) * 100 + '%' }} /></span>
                      <b>×{f.dec1(p.lift)}</b>
                    </button>
                  ))}
                  {!partners.length && <p className="muted small">{T.noPartners}</p>}
                </div>
              </div>
              <div className="report-actions">
                <Button kind="primary" icon="nodes" onClick={() => ctx.go('network', { hl: 'trait:' + sel })}>{T.showInNetwork}</Button>
              </div>
            </Panel>
          ) : (
            <Panel title={T.traitPick}><p className="muted">{T.traitPickText}</p></Panel>
          )}
        </aside>
      </div>
      <Panel title={T.strongTitle} sub={T.strongSub} className="flat-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>{T.cols.pair}</th><th className="num">{T.cols.together}</th><th className="num">{T.cols.lift}</th><th className="num">{T.cols.avgIdx}</th></tr></thead>
            <tbody>
              {strongest.map(p => (
                <tr key={p.a + p.b} tabIndex="0" onClick={() => setSel(p.a)} onKeyDown={e => { if (e.key === 'Enter') setSel(p.a); }}>
                  <td><span className="pair"><i style={{ background: COLORS[TRAITS[p.ai].domain] }} />{T.traits[p.a]}<span className="plus">+</span><i style={{ background: COLORS[TRAITS[p.bi].domain] }} />{T.traits[p.b]}</span></td>
                  <td className="num">{f.int(p.n)}</td>
                  <td className="num strong">×{f.dec1(p.lift)}</td>
                  <td className="num">{f.int(p.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">{T.liftHint}</p>
      </Panel>
    </>
  );
}
