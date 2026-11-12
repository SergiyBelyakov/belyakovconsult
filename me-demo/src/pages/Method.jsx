import { useRef, useState } from 'react';
import { IND } from '../data.js';
import { statusOf } from '../model.js';
import { readFile, parseNum } from '../../../anomaly-demo/src/fileio.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Status } from '../parts.jsx';
import { track } from '../track.js';

const SYN = {
  name: ['показник', 'індикатор', 'indicator', 'назва', 'name', 'metric'],
  base: ['базов', 'baseline', 'base'],
  target: ['ціль', 'цільов', 'target', 'мета'],
  plan: ['план', 'plan', 'проміжн', 'milestone', 'expected'],
  actual: ['факт', 'actual', 'досягн', 'achieved', 'result', 'значення', 'value'],
};
function detect(head) {
  const h = head.map(x => String(x || '').toLowerCase());
  const used = new Set(), out = {};
  for (const key of ['name', 'base', 'target', 'plan', 'actual']) {
    const i = h.findIndex((x, j) => !used.has(j) && SYN[key].some(s => x.includes(s)));
    if (i >= 0) { out[key] = i; used.add(i); }
  }
  return out;
}
function check(rows) {
  if (!rows || rows.length < 2) return null;
  const head = rows[0], c = detect(head);
  if (c.name == null || c.target == null || c.actual == null) return { error: true };
  const items = rows.slice(1).filter(r => String(r[c.name] || '').trim()).slice(0, 200).map(r => {
    const name = String(r[c.name]).trim();
    const num = key => (c[key] == null ? NaN : parseNum(r[c[key]]));
    const base = num('base'), target = num('target'), plan = num('plan'), actual = num('actual');
    const pct = /%|частк|відсот|share|rate|percent/i.test(name) || /%/.test(String(r[c.actual] || ''));
    const flags = [];
    if (!Number.isFinite(target)) flags.push('noTarget');
    if (c.base != null && !Number.isFinite(base)) flags.push('noBase');
    if (c.base == null) flags.push('noBase');
    const ref = Number.isFinite(plan) ? plan : target;
    if (!Number.isFinite(plan)) flags.push('noPlan');
    if (Number.isFinite(plan) && plan === 0) flags.push('zero');
    if (Number.isFinite(actual) && Number.isFinite(ref) && ref > 0 && actual > ref * 2) flags.push('over');
    if (pct && (actual > 100 || target > 100)) flags.push('pct');
    if ([base, target, plan, actual].some(v => Number.isFinite(v) && v < 0)) flags.push('neg');
    const ratio = Number.isFinite(actual) && Number.isFinite(ref) && ref > 0 ? actual / ref : null;
    const level = ratio == null ? 'info' : pct ? (ratio >= 0.95 ? 'healthy' : ratio >= 0.85 ? 'warning' : 'critical') : ratio >= 0.9 ? 'healthy' : ratio >= 0.75 ? 'warning' : 'critical';
    return { name, base, target, plan, actual, ratio, level, flags: [...new Set(flags)] };
  });
  return { items, cols: c };
}

export default function Method({ ctx }) {
  const { T, f, k, code, indName, exportIptt, exportPirs, exportCsv } = ctx;
  const M = T.method;
  const [res, setRes] = useState(null);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const load = async fl => {
    if (!fl) return;
    try {
      const { name, rows } = await readFile(fl);
      setFile(name); setRes(check(rows)); track('upload', { rows: rows.length });
    } catch { setFile(fl.name); setRes({ error: true }); }
  };
  const sample = () => {
    const L = ctx.lang === 'uk';
    const head = [M.ownCols.name, M.ownCols.base, M.ownCols.target, M.ownCols.plan, M.ownCols.actual];
    const rows = IND.filter(d => d.lvl !== 'impact').slice(0, 12).map((d, i) => {
      const s = statusOf(d, k);
      const nm = code(d) + ' ' + indName(d.id) + (d.unit === 'pct' ? ', %' : '');
      return [nm, i === 3 ? '' : d.base ?? 0, d.target, i === 7 ? '' : Math.round(s.plan ?? 0), i === 5 ? Math.round((s.v ?? 0) * 3) : Math.round(s.v ?? 0)];
    });
    setFile(L ? 'зразок' : 'sample'); setRes(check([head, ...rows]));
  };
  const items = res && !res.error ? res.items : [];
  const cnt = l => items.filter(x => x.level === l).length;
  const flagged = items.filter(x => x.flags.length);

  return (
    <>
      <Panel title={M.flow}>
        <ol className="flow">
          {M.flowSteps.map(([h, p], i) => (
            <li key={h}><span className="flow-n">{i + 1}</span><b>{h}</b><small>{p}</small></li>
          ))}
        </ol>
      </Panel>

      <div className="grid grid-2">
        <Panel title={M.rules}>
          <dl className="method-list">
            {M.items.map(([h, p]) => <div key={h}><dt>{h}</dt><dd>{p}</dd></div>)}
          </dl>
        </Panel>
        <div className="stack">
          <Panel title={M.downloads}>
            <div className="dl-list">
              <button type="button" className="dl-card" onClick={exportIptt}><Icon name="download" size={18} /><span><b>{M.dlIptt}</b><small>{M.dlIpttD}</small></span></button>
              <button type="button" className="dl-card" onClick={exportPirs}><Icon name="file" size={18} /><span><b>{M.dlPirs}</b><small>{M.dlPirsD}</small></span></button>
              <button type="button" className="dl-card" onClick={exportCsv}><Icon name="table" size={18} /><span><b>{M.dlCsv}</b><small>{M.dlCsvD}</small></span></button>
            </div>
          </Panel>
          <Panel title={M.limits}><p className="muted">{M.limitsText}</p></Panel>
        </div>
      </div>

      <Panel title={M.own} sub={M.ownSub}>
        <div className={'drop' + (drag ? ' on' : '')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}>
          <Icon name="upload" size={22} />
          <Button kind="primary" onClick={() => input.current && input.current.click()}>{M.ownPick}</Button>
          <span className="muted">{M.ownDrop}</span>
          <Button onClick={sample}>{M.ownSample}</Button>
          <input ref={input} type="file" accept=".csv,.xlsx,.txt" hidden onChange={e => load(e.target.files[0])} />
          {file && <span className="drop-file"><Icon name="file" size={14} />{file}</span>}
        </div>
        {res && res.error && <p className="note warn"><Icon name="warning" size={14} />{M.ownErr}</p>}
        {items.length > 0 && (
          <>
            <p className="own-sum">{M.ownSummary(items.length, cnt('healthy'), cnt('warning'), cnt('critical'))}</p>
            <div className="table-scroll">
              <table className="data-table compact">
                <thead><tr><th>{M.ownCols.name}</th><th className="num">{M.ownCols.base}</th><th className="num">{M.ownCols.target}</th><th className="num">{M.ownCols.plan}</th><th className="num">{M.ownCols.actual}</th><th className="num">{T.tbl.ofPlan}</th><th>{T.tbl.status}</th><th>{M.ownFlagsTitle}</th></tr></thead>
                <tbody>
                  {items.map((x, i) => (
                    <tr key={i}>
                      <td>{x.name}</td>
                      <td className="num muted">{Number.isFinite(x.base) ? f.num(x.base, x.base % 1 ? 1 : 0) : '·'}</td>
                      <td className="num">{Number.isFinite(x.target) ? f.num(x.target, x.target % 1 ? 1 : 0) : '·'}</td>
                      <td className="num muted">{Number.isFinite(x.plan) ? f.num(x.plan, x.plan % 1 ? 1 : 0) : '·'}</td>
                      <td className="num"><b>{Number.isFinite(x.actual) ? f.num(x.actual, x.actual % 1 ? 1 : 0) : '·'}</b></td>
                      <td className="num">{x.ratio == null ? '·' : f.pct(x.ratio * 100)}</td>
                      <td><Status level={x.level} T={T} /></td>
                      <td className="flags">{x.flags.map(fl => <span key={fl} className="flag">{M.ownFlags[fl]}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {flagged.length > 0 && <p className="note"><Icon name="info" size={14} />{M.ownFlagsTitle}: {flagged.length}</p>}
          </>
        )}
      </Panel>
    </>
  );
}
