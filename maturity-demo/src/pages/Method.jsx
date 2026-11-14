import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { DIMS, ORGS, TARGETS } from '../model.js';
import { DIM_ICON } from '../icons.js';

export default function Method({ ctx }) {
  const { T, f, openLead } = ctx;
  return (
    <>
      <Panel title={T.levelsTitle} className="flat-panel">
        <ol className="mt-levels">
          {T.levels.map((l, i) => (
            <li key={i} style={{ animationDelay: i * 0.06 + 's' }}>
              <span className="mt-lv-n">{f.int(i + 1)}</span>
              <div><strong>{l.name}</strong><p>{l.text}</p></div>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid grid-main">
        <Panel title={T.formulaTitle}>
          {T.formulas.map((x, i) => <p key={i} className="formula"><b>{x[0]}</b> {x[1]}</p>)}
        </Panel>
        <Panel title={T.sourcesTitle}>
          <dl className="glossary">{T.sources.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
          <p className="note"><Icon name="info" size={15} /><span>{T.sourcesNote}</span></p>
        </Panel>
      </div>

      <Panel title={T.targetsTitle} sub={T.targetsSub} className="flat-panel">
        <div className="table-scroll">
          <table className="data-table plain mt-targets">
            <thead><tr><th>{T.dimCol}</th>{ORGS.map(o => <th key={o} className="num">{T.orgs[o]}</th>)}</tr></thead>
            <tbody>
              {DIMS.map(d => (
                <tr key={d}>
                  <td className="strong"><span className="mt-td-dim"><Icon name={DIM_ICON[d]} size={15} />{T.dims[d].name}</span></td>
                  {ORGS.map(o => <td key={o} className="num"><span className={'mt-tl l' + TARGETS[o][d]}>{f.int(TARGETS[o][d])}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={T.questionsTitle} sub={T.questionsSub} className="flat-panel">
        <div className="mt-qlist">
          {DIMS.map((d, i) => (
            <details key={d}>
              <summary><Icon name={DIM_ICON[d]} size={16} /><span>{f.int(i + 1)}. {T.dims[d].name}</span><Icon name="chevron" size={14} /></summary>
              <ol>
                {T.dims[d].q.map((q, k) => (
                  <li key={k}>
                    <strong>{q.t}</strong>
                    <ol className="mt-qlist-o">{q.o.map((o, j) => <li key={j}><b>{f.int(j + 1)}</b> {o}</li>)}</ol>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </Panel>

      <div className="grid grid-main">
        <Panel title={T.limitsTitle}>
          <ul className="check-list warn-list">{T.limits.map((t, i) => <li key={i}><Icon name="info" size={16} /><span>{t}</span></li>)}</ul>
        </Panel>
        <Panel title={T.privacyTitle}>
          <ul className="check-list">{T.privacyItems.map((t, i) => <li key={i}><Icon name="lock" size={16} /><span>{t}</span></li>)}</ul>
        </Panel>
      </div>

      <Panel className="cta-card flat-panel">
        <h3>{T.ctaSide}</h3>
        <p>{T.ctaSideText}</p>
        <Button kind="primary" icon="mail" onClick={() => openLead('method')}>{T.ctaSideButton}</Button>
      </Panel>
    </>
  );
}
