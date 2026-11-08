// Граф залежностей бізнесу: як люди, процеси, клієнти й фінанси впливають одне на одного.
// Причинні зв'язки (суцільні стрілки) мають механізм і часовий порядок; кореляції (пунктир) лише рухаються разом.
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { DepGraph, ZPair, Legend, COL } from '../charts2.jsx';
import { graphFor, linkCols, nodeSeries } from '../links.js';
import { Status } from '../parts.jsx';
import { MONTHS } from '../model.js';

export default function Links({ ctx }) {
  const { T, f, D, ind, unit, i, unitName, linkSel, setLinkSel } = ctx;
  const G = graphFor(ind, unit, i);
  // без вибору панель деталей показує показовий зв'язок, а граф лишається без підсвічування
  const detail = linkSel || { mfg: 'overtime>turnover', svc: 'turnover>wait' }[ind];
  const edge = G.edges.find(e => e.id === detail);
  const node = G.nodes.find(n => n.id === detail);
  const fmtNode = (id, v) => {
    if (['overtime', 'turnover', 'oee', 'otd', 'cogsRate', 'payRatio', 'margin', 'util', 'repeat', 'sick'].includes(id)) return f.pct(v, 1);
    if (id === 'vsPlan') return f.signedPct(v);
    if (id === 'defect') return f.dec1(v) + '%';
    if (id === 'vacDays' || id === 'dso') return f.int(v) + ' ' + T.daysUnit;
    if (id === 'wait') return f.int(v) + ' ' + T.minUnit;
    if (id === 'cash') return f.money(v);
    return f.int(v);
  };
  const ticks = MONTHS.slice(0, i + 1).map(m => f.tick(m));
  const nm = id => T.links.nodes[ind][id];
  const related = node ? G.edges.filter(e => e.from === node.id || e.to === node.id) : [];
  const strength = r => (Math.abs(r) >= 0.7 ? T.links.strong : Math.abs(r) >= 0.4 ? T.links.medium : T.links.weak);
  const dec = T.locale.startsWith('uk') ? ',' : '.';
  const fr = r => (r >= 0 ? '+' : '−') + Math.abs(r).toFixed(2).replace('.', dec);

  return (
    <>
      <p className="page-note muted small">{T.links.scope(unitName(G.scope))}</p>
      <Panel title={T.links.title} sub={T.links.sub} className="dep-panel">
        <div className="legend legend-static">
          <span><i className="line" style={{ '--c': '#CBD5E1' }} />{T.links.cause}</span>
          <span><i className="dash" style={{ '--c': COL.warn }} />{T.links.corr}</span>
          <span><i className="band" style={{ '--c': COL.crit }} />{T.status.critical}</span>
          <span><i className="band" style={{ '--c': COL.warn }} />{T.status.warning}</span>
          <span><i className="band" style={{ '--c': COL.good }} />{T.status.healthy}</span>
          <span>◆ {T.links.companyNode}</span>
        </div>
        <DepGraph nodes={G.nodes} edges={G.edges} cols={linkCols} colName={c => T.links.cols[c]} name={nm} value={n => fmtNode(n.id, n.value)} sel={linkSel} onSel={setLinkSel} label={T.links.title} />
        <p className="muted small">{T.links.hint}</p>
      </Panel>

      <div className="grid grid-2 start">
        <Panel title={edge ? nm(edge.from) + ' → ' + nm(edge.to) : node ? nm(node.id) : T.links.pickTitle} sub={edge ? (edge.type === 'cause' ? T.links.cause : T.links.corr) : node ? T.links.nodeSub : T.links.pickSub}>
          {edge && (
            <div className="link-detail">
              <div className="link-figs">
                <div><span>{T.links.r}</span><b>{fr(edge.r)}</b><small>{strength(edge.r)}</small></div>
                <div><span>{T.links.lag}</span><b>{f.int(edge.lag)} {T.links.monthsShort}</b><small>{edge.lag ? T.links.leads(nm(edge.from)) : T.links.together}</small></div>
                <div><span>{T.links.kind}</span><b>{edge.type === 'cause' ? T.links.causeShort : T.links.corrShort}</b><small>{edge.type === 'cause' ? T.links.causeWhy : T.links.corrWhy}</small></div>
              </div>
              <p className="link-mech"><Icon name={edge.type === 'cause' ? 'arrowRight' : 'info'} size={16} /><span>{T.links.mech[ind][edge.id]}</span></p>
              <ZPair a={G.series[edge.from].slice(0, G.series[edge.from].length - edge.lag)} b={G.series[edge.to].slice(edge.lag)} ticks={ticks.slice(edge.lag)} names={[nm(edge.from) + (edge.lag ? ' (' + T.links.shifted(edge.lag) + ')' : ''), nm(edge.to)]} label={T.links.zLabel} />
              <p className="muted small">{T.links.zNote}</p>
            </div>
          )}
          {node && !edge && (
            <div className="link-detail">
              <div className="link-figs">
                <div><span>{T.links.now}</span><b>{fmtNode(node.id, node.value)}</b><Status level={node.level === 'info' ? 'info' : node.level} T={T} text={node.level === 'info' ? T.links.noThr : null} /></div>
                <div><span>{T.links.inEdges}</span><b>{f.int(related.filter(e => e.to === node.id).length)}</b><small>{T.links.inNote}</small></div>
                <div><span>{T.links.outEdges}</span><b>{f.int(related.filter(e => e.from === node.id).length)}</b><small>{T.links.outNote}</small></div>
              </div>
              <ul className="link-rel">
                {related.map(e => (
                  <li key={e.id}><button type="button" className="link-btn" onClick={() => setLinkSel(e.id)}>{nm(e.from)} {e.type === 'cause' ? '→' : '↔'} {nm(e.to)}</button><small className="muted">r {fr(e.r)}, {strength(e.r)}</small></li>
                ))}
              </ul>
            </div>
          )}
          {!edge && !node && <p className="muted">{T.links.pickText}</p>}
        </Panel>
        <Panel title={T.links.tableTitle} sub={T.links.tableSub}>
          <div className="table-scroll">
            <table className="data-table plain compact">
              <thead><tr><th>{T.links.from}</th><th>{T.links.to}</th><th>{T.links.kind}</th><th className="num">r</th><th className="num">{T.links.lag}</th></tr></thead>
              <tbody>
                {G.edges.map(e => (
                  <tr key={e.id} tabIndex="0" className={linkSel === e.id ? 'picked' : ''} onClick={() => setLinkSel(e.id)} onKeyDown={ev => { if (ev.key === 'Enter') setLinkSel(e.id); }}>
                    <td>{nm(e.from)}</td><td>{nm(e.to)}</td>
                    <td>{e.type === 'cause' ? T.links.causeShort : <span className="corr-tag">{T.links.corrShort}</span>}</td>
                    <td className="num">{fr(e.r)}</td>
                    <td className="num">{f.int(e.lag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <p className="page-note muted small">{T.links.note}</p>
    </>
  );
}
