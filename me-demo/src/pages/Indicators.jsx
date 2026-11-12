import { useMemo, useState } from 'react';
import { IND, OUTCOME_IDS, REGION_IDS, PARTNER_IDS, QS } from '../data.js';
import { statusOf, forecast, lastAt, rank } from '../model.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Select, Button } from '../../../dashboard/src/ui.jsx';
import { MiniSpark } from '../charts.jsx';
import { Status, Meter } from '../parts.jsx';

const LEVELS = ['impact', 'outcome', 'output', 'cross'];

// значення показника для області: план і факт за часткою області
function regional(d, r, k) {
  if (!r || d.kind === 'survey' || !d.reg || !d.reg[r]) return null;
  if (d.kind === 'cum' || d.kind === 'level') {
    const v = d.reg[r][k], p = d.regPlan[r][k];
    const tgt = d.regPlan[r][d.regPlan[r].length - 1];
    return { v, plan: p, ratio: p ? v / p : null, target: tgt, series: d.reg[r].slice(0, k + 1) };
  }
  const { v } = lastAt(d.reg[r], k), p = d.plan[k];
  return { v, plan: p, ratio: v != null && p ? v / p : null, target: d.target, series: d.reg[r].slice(0, k + 1).filter(x => x != null) };
}
const levelOf = (d, ratio) => (ratio == null ? 'info' : d.unit === 'pct' ? (ratio >= 0.95 ? 'healthy' : ratio >= 0.85 ? 'warning' : 'critical') : ratio >= 0.9 ? 'healthy' : ratio >= 0.75 ? 'warning' : 'critical');

export default function Indicators({ ctx }) {
  const { T, f, k, openInd, code, regionName, partnerName, exportIptt } = ctx;
  const [lvl, setLvl] = useState('all');
  const [out, setOut] = useState('all');
  const [st, setSt] = useState('all');
  const [reg, setReg] = useState('all');
  const [par, setPar] = useState('all');
  const [sort, setSort] = useState({ key: 'code', dir: 1 });

  const rows = useMemo(() => IND.map((d, i) => {
    const s = statusOf(d, k), fc = forecast(d, k);
    const rg = reg !== 'all' ? regional(d, reg, k) : null;
    const v = rg ? rg.v : s.v, plan = rg ? rg.plan : s.plan, ratio = rg ? rg.ratio : s.ratio, target = rg ? rg.target : d.target;
    const level = rg ? levelOf(d, ratio) : s.level;
    const series = rg ? rg.series : d.actual ? d.actual.slice(0, k + 1).filter(x => x != null) : [];
    return { d, i, s, fc, v, plan, ratio, target, level, series, regional: !!rg };
  }), [k, reg]);
  const list = rows.filter(x =>
    (lvl === 'all' || x.d.lvl === lvl) && (out === 'all' || x.d.out === out) && (st === 'all' || x.level === st) &&
    (par === 'all' || x.d.partners.includes(par)) && (reg === 'all' || x.regional || x.d.kind === 'survey'));
  const val = x => ({ code: x.i, ratio: x.ratio ?? -1, pReach: x.fc.pReach ?? -1, status: rank(x.level) })[sort.key];
  list.sort((a, b) => (val(a) - val(b)) * sort.dir);
  const th = (key, label, cls = '') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : key === 'code' ? 1 : -1 }))}>{label}{sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button>
    </th>
  );
  const counts = { healthy: 0, warning: 0, critical: 0 };
  list.forEach(x => { if (counts[x.level] != null) counts[x.level]++; });
  const reset = () => { setLvl('all'); setOut('all'); setSt('all'); setReg('all'); setPar('all'); };

  return (
    <>
      <div className="toolbar me-filters">
        <Select value={lvl} onChange={setLvl} label={T.tbl.allLevels} options={[{ value: 'all', label: T.tbl.allLevels }, ...LEVELS.map(l => ({ value: l, label: T.lvlPlural[l] }))]} />
        <Select value={out} onChange={setOut} label={T.tbl.allOutcomes} options={[{ value: 'all', label: T.tbl.allOutcomes }, ...OUTCOME_IDS.map(o => ({ value: o, label: T.outcome[o] }))]} />
        <Select value={st} onChange={setSt} label={T.tbl.allStatus} options={[{ value: 'all', label: T.tbl.allStatus }, ...['healthy', 'warning', 'critical'].map(s => ({ value: s, label: T.status[s] }))]} />
        <Select value={reg} onChange={setReg} label={T.tbl.allRegions} options={[{ value: 'all', label: T.tbl.allRegions }, ...REGION_IDS.map(r => ({ value: r, label: regionName(r) }))]} />
        <Select value={par} onChange={setPar} label={T.tbl.allPartners} options={[{ value: 'all', label: T.tbl.allPartners }, ...PARTNER_IDS.map(p => ({ value: p, label: partnerName(p) }))]} />
        <Button icon="reset" onClick={reset}>{T.tbl.reset}</Button>
        <Button icon="download" className="push-right" onClick={exportIptt}>{T.rep.xlsx}</Button>
      </div>
      <Panel title={T.tbl.found(list.length) + (reg !== 'all' ? ' · ' + regionName(reg) : '')} sub={reg !== 'all' ? T.tbl.regionNote : null}
        aside={<div className="st-counts">{['healthy', 'warning', 'critical'].map(s => <Status key={s} level={s} T={T} text={T.status[s] + ': ' + counts[s]} />)}</div>}>
        {list.length ? (
          <div className="table-scroll">
            <table className="data-table iptt">
              <thead>
                <tr>
                  {th('code', T.tbl.code)}
                  <th>{T.tbl.name}</th>
                  <th className="num">{T.tbl.base}</th>
                  <th className="num">{T.tbl.target}</th>
                  <th className="num">{T.tbl.plan}</th>
                  <th className="num">{T.tbl.actual}</th>
                  {th('ratio', T.tbl.ofPlan, 'num')}
                  <th>{T.tbl.trend}</th>
                  <th className="num" title={T.tbl.fcLong}>{T.tbl.fc}</th>
                  {th('pReach', T.tbl.pReach, 'num')}
                  {th('status', T.tbl.status)}
                </tr>
              </thead>
              <tbody>
                {list.map(x => {
                  const d = x.d, fv = v => f.value(d, v);
                  return (
                    <tr key={d.id} className="row-btn" onClick={() => openInd(d.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openInd(d.id); }}>
                      <td><span className={'code-tag lvl-' + d.lvl}>{code(d)}</span></td>
                      <td className="ind-cell"><b>{T.ind[d.id].n}</b><small>{d.out ? T.outcomeShort[d.out] : T.lvl[d.lvl]} · {d.partners.filter(p => p !== 'M').join(', ') || T.tbl.survey} · {T.tbl.unitName[d.unit]}</small></td>
                      <td className="num muted">{d.base != null ? fv(d.base) : d.kind === 'cum' ? '0' : '·'}</td>
                      <td className="num">{fv(x.target)}</td>
                      <td className="num muted">{x.plan == null ? '·' : fv(x.plan)}</td>
                      <td className="num"><b>{fv(x.v)}</b></td>
                      <td className="num"><span className="ratio-cell"><Meter value={x.ratio} level={x.level} />{x.ratio == null ? '·' : f.pct(x.ratio * 100)}</span></td>
                      <td className="spark-cell">{x.series.length > 1 ? <MiniSpark values={x.series} /> : <span className="muted">·</span>}</td>
                      <td className="num">{x.regional ? '·' : x.fc.end == null ? <small className="muted" title={T.tbl.noFc}>{f.q(11)}</small> : fv(x.fc.end)}</td>
                      <td className="num">{x.regional || x.fc.pReach == null ? '·' : <span className={'p-reach ' + (x.fc.pReach >= 0.7 ? 'ok' : x.fc.pReach >= 0.3 ? 'mid' : 'low')}>{f.pct(x.fc.pReach * 100)}</span>}</td>
                      <td><Status level={x.level} T={T} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-note">{T.tbl.none}</p>}
      </Panel>
    </>
  );
}
