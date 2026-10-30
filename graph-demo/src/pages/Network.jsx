import { useEffect, useMemo, useState } from 'react';
import { Panel, Kpi, Select, Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { NetworkGraph, EDGE_GROUPS } from '../graph.jsx';
import { COLORS, LevelLegend, LevelPill } from '../charts.jsx';
import { Profile, ServiceProfile } from '../profile.jsx';
import { SIGNALS, TRAITS, CASELOAD_NORM } from '../model.js';
import { TERRITORY_ORDER } from '../data.js';

const DEFAULT_EDGES = new Set(EDGE_GROUPS.map(([g]) => g));

export function focusOf(ctx) {
  const { base, model, hl } = ctx;
  if (!hl) return null;
  const [kind, id] = hl.split(':');
  if (kind === 'level') return new Set(base.people.filter(p => ['high', 'critical'].includes(model.sc(p.id).level)).map(p => p.id));
  if (kind === 'terr') return new Set(base.nodes.filter(n => n.territory === id).map(n => n.id));
  if (kind === 'trait') { const i = base.traitIdx[id]; return new Set(base.people.filter(p => p.traits[i]).map(p => p.id)); }
  if (kind === 'signal') {
    if (id === 'caseload') return new Set(model.sig.caseload.flatMap(s => [s, ...base.byId.get(s).cases]));
    return new Set(model.sig[id] || []);
  }
  return null;
}

export function hlOptions(T) {
  return [
    { value: '', label: T.hlNone },
    { value: 'level:high', label: T.hlHigh },
    { group: T.hlSignals, options: SIGNALS.map(s => ({ value: 'signal:' + s.id, label: T.signals[s.id].title })) },
    { group: T.hlTraits, options: TRAITS.map(t => ({ value: 'trait:' + t.id, label: T.traits[t.id] })) },
    { group: T.hlTerr, options: TERRITORY_ORDER.map(id => ({ value: 'terr:' + id, label: T.terr[id] })) },
  ];
}

export function GroupedSelect({ value, onChange, options, label }) {
  return (
    <label className="select glass-control wide-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
        {options.map(o => (o.group
          ? <optgroup key={o.group} label={o.group}>{o.options.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</optgroup>
          : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <Icon name="chevron" size={14} />
    </label>
  );
}

export default function Network({ ctx }) {
  const { T, f, base, model, layout, selected, select, hl, setHl, zoomTarget, setZoomTarget } = ctx;
  const [size, setSize] = useState('index');
  const [edgeOn, setEdgeOn] = useState(DEFAULT_EDGES);
  const [mode, setMode] = useState('graph');
  const [sort, setSort] = useState({ key: 'index', dir: -1 });

  useEffect(() => { if (zoomTarget && (zoomTarget.id || zoomTarget.territory)) setMode('graph'); }, [zoomTarget]);
  const traitHl = hl && hl.startsWith('trait:') ? hl.slice(6) : null;
  const focus = useMemo(() => focusOf(ctx), [hl, model]);
  const selFocus = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    for (const x of base.adj.get(selected) || []) s.add(x.id);
    return s;
  }, [selected, base]);

  const styles = useMemo(() => {
    const m = new Map();
    const ti = traitHl ? base.traitIdx[traitHl] : -1;
    const tColor = traitHl ? COLORS[TRAITS[ti].domain] : null;
    for (const n of base.nodes) {
      if (n.kind !== 'person') {
        const over = n.kind === 'sw' && n.load > CASELOAD_NORM;
        m.set(n.id, { r: n.kind === 'rehab' ? 14 : 12, cls: over ? 'over' : '' });
        continue;
      }
      const s = model.sc(n.id);
      const r = size === 'ties' ? 4.4 + Math.sqrt(n.informalDegree + 1) * 1.8
        : size === 'bridge' ? 4.4 + n.bcNorm * 8.5
          : 4.4 + Math.min(1, s.index / 70) * 6.4;
      const fill = traitHl ? (n.traits[ti] ? tColor : COLORS.muted) : COLORS.level[s.level];
      m.set(n.id, { r, fill, halo: !traitHl && s.level === 'critical', cls: n.dupOf ? 'dup' : '' });
    }
    return m;
  }, [base, model, size, traitHl]);

  const toggleEdge = g => setEdgeOn(prev => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });

  const lc = model.levelCounts;
  const highN = lc.high + lc.critical;
  const informalEdges = base.edges.filter(e => ['household', 'family', 'care', 'support'].includes(e.type)).length;
  const node = selected && base.byId.get(selected);

  const rows = useMemo(() => {
    const list = base.people.filter(p => !focus || focus.has(p.id));
    const val = p => ({ id: p.id, terr: p.territory, age: p.age, index: model.sc(p.id).index, ties: p.informalDegree, support: p.support, signals: model.signalsOf.get(p.id).length })[sort.key];
    return list.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || (a.id < b.id ? -1 : 1); });
  }, [base, model, focus, sort]);
  const th = (key, label, num) => (
    <th className={num ? 'num' : ''} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : num ? -1 : 1 }))}>{label}{sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button>
    </th>
  );

  return (
    <>
      <div className="kpi-grid kpi-compact">
        <Kpi icon="users" label={T.kpi.people} value={f.int(base.people.length)} context={T.kpi.peopleCtx} onClick={() => setHl('')} />
        <Kpi icon="link" label={T.kpi.ties} value={f.int(base.edges.length)} context={T.kpi.tiesCtx.replace('{a}', f.int(informalEdges)).replace('{b}', f.int(base.edges.length - informalEdges))} onClick={() => setMode('graph')} />
        <Kpi icon="target" label={T.kpi.high} value={f.int(highN)} unit={' · ' + f.pct(highN / base.people.length)} context={T.kpi.highCtx} accent onClick={() => setHl('level:high')} />
        <Kpi icon="unlink" label={T.kpi.isolated} value={f.int(model.sig.isolatedHigh.length)} context={T.kpi.isolatedCtx} onClick={() => setHl('signal:isolatedHigh')} />
      </div>

      <div className="net-toolbar">
        <GroupedSelect value={hl} onChange={setHl} options={hlOptions(T)} label={T.highlight} />
        <Select value={size} onChange={setSize} label={T.sizeLabel} options={[
          { value: 'index', label: T.size.index }, { value: 'ties', label: T.size.ties }, { value: 'bridge', label: T.size.bridge },
        ]} />
        <Segmented value={mode} onChange={setMode} label={T.viewLabel} options={[{ value: 'graph', label: T.viewGraph }, { value: 'table', label: T.viewTable }]} />
        {(hl || selected) && <Button icon="reset" onClick={() => { setHl(''); select(null); setZoomTarget({ fit: true, n: Date.now() }); }}>{T.reset}</Button>}
      </div>

      <div className="grid grid-net">
        <Panel className="net-panel" title={T.netTitle} sub={hl ? T.hlActive.replace('{n}', f.int(focus ? [...focus].filter(id => base.byId.get(id)?.kind === 'person').length : 0)) : T.netSub}
          aside={<span className="count-pill">{f.int(base.nodes.length)} {T.nodesWord}</span>}>
          {mode === 'graph' ? (
            <>
              <NetworkGraph base={base} layout={layout} styles={styles} edgeOn={edgeOn} selected={selected} focus={selected ? selFocus : focus}
                onSelect={id => select(id)} svcLabel={ctx.svcShort} personLabel={n => n.id} terrName={ctx.terrName} tip={id => <NodeTip ctx={ctx} id={id} />}
                zoomTarget={zoomTarget} T={T} label={T.netAria} />
              <div className="graph-legend">
                {traitHl
                  ? <div className="level-legend"><span><i className="lv" style={{ background: COLORS[TRAITS[base.traitIdx[traitHl]].domain] }} />{T.traits[traitHl]}</span><span><i className="lv" style={{ background: COLORS.muted }} />{T.otherPeople}</span></div>
                  : <LevelLegend T={T} counts={lc} f={f} />}
                <div className="shape-legend">
                  <span><svg width="14" height="14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" rx="2" className="lg-sw" /></svg>{T.kinds.sw}</span>
                  <span><svg width="14" height="14" aria-hidden="true"><path d="M7 1 13 7 7 13 1 7Z" className="lg-clinic" /></svg>{T.kinds.clinicShort}</span>
                  <span className="muted">{T.sizeHint[size]}</span>
                </div>
                <div className="edge-toggles" role="group" aria-label={T.edgesLabel}>
                  {EDGE_GROUPS.map(([g, types]) => (
                    <button type="button" key={g} className={'edge-chip' + (edgeOn.has(g) ? ' on' : '')} aria-pressed={edgeOn.has(g)} onClick={() => toggleEdge(g)}>
                      <svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" className={'e e-' + types[types.length - 1]} /></svg>
                      {T.edgeGroups[g]}<b>{f.int(types.reduce((a, t) => a + base.edgeCount[t], 0))}</b>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="table-scroll net-table">
              <table className="data-table">
                <thead><tr>{th('id', T.cols.id)}{th('terr', T.cols.terr)}{th('age', T.cols.age, true)}<th>{T.cols.level}</th>{th('index', T.cols.index, true)}{th('ties', T.cols.ties, true)}{th('support', T.cols.support, true)}{th('signals', T.cols.signals, true)}</tr></thead>
                <tbody>
                  {rows.map(p => {
                    const s = model.sc(p.id);
                    return (
                      <tr key={p.id} tabIndex="0" onClick={() => { select(p.id, true); setMode('graph'); }} onKeyDown={e => { if (e.key === 'Enter') { select(p.id, true); setMode('graph'); } }}>
                        <td className="strong">{p.id}{p.dupOf && <span className="reason">{T.dupShort}</span>}</td>
                        <td>{ctx.terrName(p.territory)}</td>
                        <td className="num">{ctx.sexAge(p)}</td>
                        <td><LevelPill level={s.level} T={T} /></td>
                        <td className="num strong">{f.int(s.index)}</td>
                        <td className="num">{f.int(p.informalDegree)}</td>
                        <td className="num">{f.int(p.support)}</td>
                        <td className="num">{f.int(model.signalsOf.get(p.id).length)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="side-stack">
          {node && node.kind === 'person' && <Profile ctx={ctx} p={node} />}
          {node && node.kind !== 'person' && <ServiceProfile ctx={ctx} s={node} />}
          {!node && <Overview ctx={ctx} />}
        </aside>
      </div>
    </>
  );
}

function NodeTip({ ctx, id }) {
  const { T, f, base, model } = ctx;
  const n = base.byId.get(id);
  if (!n) return null;
  if (n.kind !== 'person') {
    return (<><b>{T.kinds[n.kind]}</b><strong>{ctx.svcName(n)}</strong><small>{T.tipCases.replace('{n}', f.int(n.load))}</small></>);
  }
  const s = model.sc(id);
  return (
    <>
      <b>{ctx.terrName(n.territory)} · {ctx.sexAge(n)}</b>
      <strong>{n.id}</strong>
      <small>{T.levels[s.level]} · {T.indexShort} {f.int(s.index)}</small>
      <small>{T.tipTies.replace('{n}', f.int(n.informalDegree))}{n.dupOf ? ' · ' + T.dupShort : ''}</small>
    </>
  );
}

function Overview({ ctx }) {
  const { T, f, model, select } = ctx;
  const top = model.ranked.slice(0, 6);
  return (
    <>
      <Panel title={T.howTitle} className="how-panel">
        <ul className="how-list">
          {T.how.map((h, i) => <li key={i}><span className="how-n">{i + 1}</span><span>{h}</span></li>)}
        </ul>
      </Panel>
      <Panel title={T.topTitle} sub={T.topSub}>
        <div className="top-list">
          {top.map(p => {
            const s = model.sc(p.id);
            return (
              <button type="button" key={p.id} className="top-row" onClick={() => select(p.id, true)}>
                <span className="top-id"><strong>{p.id}</strong><small>{ctx.terrName(p.territory)} · {ctx.sexAge(p)}</small></span>
                <LevelPill level={s.level} T={T} />
                <b className="top-val">{f.int(s.index)}</b>
              </button>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
