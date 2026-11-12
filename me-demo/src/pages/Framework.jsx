import { useMemo, useState } from 'react';
import { IND, OUTCOME_IDS, PARTNER_IDS, PARTNERS, REGION_IDS, BUDGET } from '../data.js';
import { statusOf, summary, spendByRegion, regionStats } from '../model.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Status, Meter } from '../parts.jsx';
import { MoneySankey } from '../charts.jsx';

const ASSUME = { o1: 'a1', o2: 'a2', o3: 'a3', o4: 'a4' };
const OUT_PARTNER = { o1: ['A', 'D'], o2: ['C'], o3: ['B'], o4: ['E'] };

function Chip({ x, ctx }) {
  const { T, f, k, code, openInd } = ctx;
  const s = statusOf(x, k);
  const prog = s.ratio;
  return (
    <button type="button" className={'ind-chip lvl-' + s.level} onClick={() => openInd(x.id)}>
      <span className="ic-top"><span className="ic-code">{code(x)}</span><span className="ic-name">{T.ind[x.id].s}</span></span>
      <span className="ic-val"><b>{f.value(x, s.v)}</b><small>/ {f.value(x, x.target)}</small></span>
      <span className="ic-meter"><Meter value={prog} level={s.level} /><em className={'ic-st ' + s.level}>{T.status[s.level]}</em></span>
    </button>
  );
}

function Assume({ id, T }) {
  const a = T.fw.as[id];
  return (
    <div className={'assume ' + a.s} title={a.note}>
      <span className="as-ic"><Icon name={a.s === 'healthy' ? 'check' : 'warning'} size={12} /></span>
      <span><b>{a.t}</b><small>{a.note}</small></span>
    </div>
  );
}

export default function Framework({ ctx }) {
  const { T, f, k, partnerName, regionName } = ctx;
  const [showA, setShowA] = useState(true);
  const S = useMemo(() => summary(k), [k]);
  const impact = IND.filter(x => x.lvl === 'impact'), cross = IND.filter(x => x.lvl === 'cross');

  const sk = useMemo(() => {
    const sp = spendByRegion(k), RS = regionStats(k);
    const nodes = [
      ...OUTCOME_IDS.map(o => ({ id: o, color: '#CBD5E1' })), { id: 'mgmt', color: '#CBD5E1' },
      ...[...PARTNER_IDS, 'M'].map(p => ({ id: p, color: PARTNERS[p].color })),
      ...REGION_IDS.map(r => ({ id: r, color: '#9CC0F0' })), { id: 'prog', color: '#9CC0F0' },
    ];
    const links = [];
    for (const o of OUTCOME_IDS) for (const p of OUT_PARTNER[o]) links.push({ source: o, target: p, value: BUDGET[p].actual[k] });
    links.push({ source: 'mgmt', target: 'M', value: BUDGET.M.actual[k] });
    for (const p of PARTNER_IDS) for (const [r, v] of Object.entries(sp[p])) if (v > 0) links.push({ source: p, target: r, value: v });
    links.push({ source: 'M', target: 'prog', value: BUDGET.M.actual[k] });
    return { nodes, links, RS };
  }, [k]);
  const nodeName = id => (OUTCOME_IDS.includes(id) ? T.outcomeShort[id] : id === 'mgmt' ? T.fw.mgmt : id === 'prog' ? T.sigSubject.program : REGION_IDS.includes(id) ? regionName(id, true) : T.partner(id));
  const side = id => {
    if (OUTCOME_IDS.includes(id)) { const b = S.byOutcome[id]; return b.prog == null ? '' : f.pct(b.prog * 100) + ' ' + T.ofPlan; }
    if (REGION_IDS.includes(id)) { const x = sk.RS.by[id]; return x.perPerson ? f.eur(x.perPerson) + ' ' + T.fw.perPerson : ''; }
    return '';
  };

  return (
    <>
      <Panel title={T.fw.tree} sub={T.fw.treeSub} aside={<label className="toggle"><input type="checkbox" checked={showA} onChange={e => setShowA(e.target.checked)} /><span>{T.fw.showAssumptions}</span></label>}>
        <div className="rf">
          <div className="rf-goal">
            <span className="rf-lvl">{T.lvlPlural.impact}</span>
            <h3>{T.goal}</h3>
            <div className="rf-chips">{impact.map(x => <Chip key={x.id} x={x} ctx={ctx} />)}</div>
          </div>
          {showA && <div className="rf-as-goal"><Assume id="a5" T={T} /></div>}
          <div className="rf-outs">
            {OUTCOME_IDS.map((o, i) => {
              const outc = IND.filter(x => x.out === o && x.lvl === 'outcome'), outp = IND.filter(x => x.out === o && x.lvl === 'output');
              const b = S.byOutcome[o];
              return (
                <div key={o} className={'rf-col lvl-' + b.worst}>
                  <div className="rf-out">
                    <span className="rf-lvl">{T.lvl.outcome} {i + 1}</span>
                    <h4>{T.outcome[o]}</h4>
                    <span className="rf-partners">{OUT_PARTNER[o].map(p => <i key={p} style={{ '--c': PARTNERS[p].color }} title={partnerName(p)}>{p}</i>)}</span>
                    <div className="rf-chips">{outc.map(x => <Chip key={x.id} x={x} ctx={ctx} />)}</div>
                  </div>
                  {showA && <Assume id={ASSUME[o]} T={T} />}
                  <div className="rf-outputs">
                    <span className="rf-lvl">{T.lvlPlural.output}</span>
                    {outp.map(x => <Chip key={x.id} x={x} ctx={ctx} />)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rf-cross">
            <span className="rf-lvl">{T.cross}</span>
            <div className="rf-chips">{cross.map(x => <Chip key={x.id} x={x} ctx={ctx} />)}</div>
          </div>
        </div>
      </Panel>

      <Panel title={T.fw.sankey} sub={T.fw.sankeySub(f.q(k))}>
        <MoneySankey nodes={sk.nodes} links={sk.links} name={nodeName} fmt={f.eur} side={side} label={T.fw.sankey} height={420} />
      </Panel>
    </>
  );
}
