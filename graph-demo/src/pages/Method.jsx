import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { COLORS } from '../charts.jsx';
import { FACTORS, LEVELS, MIN_GROUP, NEED_FULL, THRESHOLDS, CASELOAD_NORM, KEY_IMPACT } from '../model.js';

export default function Method({ ctx }) {
  const { T, f, base } = ctx;
  const M = T.method;
  return (
    <>
      <div className="grid grid-main">
        <Panel title={M.modelTitle} sub={M.modelSub}>
          <DataModel T={T} />
          <div className="model-counts">
            {[['people', base.people.length], ['households', base.households.filter(h => h.members.length).length], ['services', base.services.length], ['edges', base.edges.length]].map(([k, v]) => (
              <span key={k}><b>{f.int(v)}</b><small>{M.counts[k]}</small></span>
            ))}
          </div>
        </Panel>
        <Panel title={M.indexTitle} sub={M.indexSub}>
          <p className="formula">{M.formula}</p>
          <div className="level-scale">
            {LEVELS.map((l, i) => (
              <span key={l}><i className={'lv lv-' + l} /><b>{T.levels[l]}</b><small>{i === 0 ? M.below.replace('{a}', THRESHOLDS[0]) : M.from.replace('{a}', THRESHOLDS[i - 1])}</small></span>
            ))}
          </div>
          <p className="formula muted">{M.networkFormula.replace('{k}', f.int(NEED_FULL))}</p>
          <p className="hint">{M.indexNote}</p>
        </Panel>
      </div>

      <div className="factor-grid">
        {['d', 's', 'm', 'n'].map(k => (
          <Panel key={k} className="factor-card">
            <h3><i style={{ background: COLORS[k] }} />{T.comp[k]}</h3>
            <p className="muted small">{M.compText[k]}</p>
            <table className="factor-table">
              <tbody>
                {FACTORS[k].map(([id, pts, cap]) => (
                  <tr key={id}><td>{T.factors[id]}</td><td className="num">+{pts}{cap > 1 ? <small> × {cap}</small> : null}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">{k === 'n' ? M.capSupport : M.cap}</p>
          </Panel>
        ))}
      </div>

      <div className="grid grid-main">
        <Panel title={M.metricsTitle} sub={M.metricsSub}>
          <dl className="glossary">
            {M.metrics.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d.replace('{k}', ctx.people(KEY_IMPACT)).replace('{norm}', f.int(CASELOAD_NORM)).replace('{min}', f.int(MIN_GROUP))}</dd></div>)}
          </dl>
        </Panel>
        <Panel title={M.privacyTitle} sub={M.privacySub}>
          <ul className="check-list">
            {M.privacy.map((t, i) => <li key={i}><Icon name="shield" size={16} /><span>{t.replace('{min}', f.int(MIN_GROUP))}</span></li>)}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-main">
        <Panel title={M.exportTitle} sub={M.exportSub}>
          <div className="report-actions wrap">
            <Button icon="download" onClick={ctx.exportNodes}>{M.exportNodes}</Button>
            <Button icon="download" onClick={ctx.exportEdges}>{M.exportEdges}</Button>
          </div>
          <p className="hint">{M.exportNote}</p>
        </Panel>
        <section className="panel glass cta-card">
          <span className="signal-line" />
          <h3>{T.ctaTitle}</h3>
          <p>{T.ctaText}</p>
          <Button kind="primary" icon="mail" onClick={() => ctx.openLead('method')}>{T.ctaButton}</Button>
        </section>
      </div>
    </>
  );
}

function DataModel({ T }) {
  const D = T.method.diagram;
  const box = (x, y, label, main) => (
    <g>
      <rect x={x} y={y} width="176" height="46" rx="4" className={'dm-box' + (main ? ' main' : '')} />
      {main && <circle cx={x + 16} cy={y + 23} r="4" className="dm-dot" />}
      <text x={x + 88 + (main ? 6 : 0)} y={y + 28} textAnchor="middle" className="dm-label">{label}</text>
    </g>
  );
  return (
    <svg className="data-model" viewBox="0 0 690 300" role="img" aria-label={T.method.modelTitle}>
      <path d="M238 66 V127" className="dm-edge" />
      <path d="M238 173 V234" className="dm-edge loop" />
      <path d="M326 43 H490" className="dm-edge" />
      <path d="M326 150 H490" className="dm-edge" />
      <path d="M326 165 L490 250" className="dm-edge" />
      <text x="228" y="101" className="dm-rel" textAnchor="end">{D.member}</text>
      <text x="228" y="208" className="dm-rel" textAnchor="end">{D.ties}</text>
      <text x="408" y="35" className="dm-rel" textAnchor="middle">{D.inCommunity}</text>
      <text x="408" y="142" className="dm-rel" textAnchor="middle">{D.service}</text>
      <text x="405" y="229" className="dm-rel" textAnchor="middle">{D.medical}</text>
      {box(150, 20, D.household)}
      {box(150, 127, D.person, true)}
      {box(150, 234, D.person2)}
      {box(490, 20, D.community)}
      {box(490, 127, D.worker)}
      {box(490, 234, D.facility)}
    </svg>
  );
}
