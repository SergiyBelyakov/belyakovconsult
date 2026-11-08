// Вміст панелі «Пояснити зміну»: розраховані фактори, тривалість, джерела даних, що компенсувало,
// наскільки пояснення повне і два сценарії для перевірки з ефектом із симулятора.
import { Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { explain } from '../explain.js';
import { causeTree, leafFor, pathFrom } from '../causes.js';
import { yearStart } from '../model.js';
import { Conf } from '../parts.jsx';
import { confLevel } from '../risk.js';

export default function ExplainBody({ ctx, per, setPer, onClose }) {
  const { T, f, ind, unit, i, unitName, openCause, applyPresets, applySliders, D } = ctx;
  const e = explain(ind, unit, i, per);
  const scope = unit === 'all' ? T.companyShort[ind] : unitName(unit);
  const period = per === 'ytd' ? T.causes.perYtd(f.month(D.company[e.from].m), f.month(D.company[i].m)) : f.month(D.company[i].m, true);
  const fName = g => T.factors[ind][g.factor] + ' · ' + unitName(g.unit);
  const toTree = g => {
    const tree = causeTree(ind, per === 'ytd' ? yearStart(i) : i, i);
    const leaf = g ? leafFor(tree, g.unit, [g.factor]) : null;
    onClose();
    openCause(leaf ? pathFrom(tree, leaf.id) : null, per);
  };
  const apply = s => {
    onClose();
    if (s.id === 'southTeam' || s.id === 'eastTeam') applyPresets([s.id]);
    else applySliders({ procure5: { cost: -5 }, price3: { price: 3 }, opex8: { opex: -8 } }[s.id] || {});
  };
  return (
    <div className="explain">
      <div className="explain-ctl">
        <Segmented value={per} onChange={setPer} label={T.causes.period} options={[{ value: 'm', label: T.causes.month }, { value: 'ytd', label: T.causes.ytd }]} />
        <span className="explain-badge"><Icon name="check" size={13} />{T.explain.badge}</span>
      </div>
      <p className="explain-head">{T.explain.head(scope, period, f.money(e.fact), f.money(e.plan), f.signedMoney(e.gap), f.signedPct(e.pct))}</p>

      <h4>{T.explain.whatTitle}</h4>
      <ol className="explain-list">
        {e.top.map(g => (
          <li key={g.unit + g.factor}>
            <div className="explain-item">
              <strong>{fName(g)}</strong>
              <b className="over">{f.signedMoney(g.value)}</b>
              <small>{T.explain.share(f.pct(g.share, 0))}</small>
            </div>
            <p>{T.explain.why[g.factor] ? T.explain.why[g.factor](ind) : ''} {g.chronic ? T.explain.chronic : g.months ? T.explain.months(g.months) : T.explain.oneOff}</p>
            <div className="explain-meta">
              <Conf level={g.chronic ? 'high' : confLevel(g.months)} T={T} />
              <span className="explain-src">{T.explain.sources}: {g.sources.map(s => T.explain.src[s]).join(', ')}</span>
              <button type="button" className="link-btn" onClick={() => toTree(g)}><Icon name="tree" size={13} />{T.explain.toTree}</button>
            </div>
          </li>
        ))}
      </ol>
      {e.offsets.length > 0 && (
        <>
          <h4>{T.explain.offsetTitle}</h4>
          <ul className="explain-off">{e.offsets.map(g => <li key={g.unit + g.factor}><span>{fName(g)}</span><b className="good">{f.signedMoney(g.value)}</b></li>)}</ul>
        </>
      )}
      <p className="explain-trust"><Icon name="info" size={15} /><span>{T.explain.trust(f.pct(e.top3, 0), e.top.length)}</span></p>

      <h4>{T.explain.checkTitle}</h4>
      <div className="explain-sug">
        {e.sug.map(s => (
          <div key={s.id} className="sug glass">
            <strong>{T.explain.sug[s.id](unit === 'all' ? null : unitName(unit))}</strong>
            <span>{T.dec.out.ebitda}: <b className={s.effect.ebitda >= 0 ? 'good' : 'over'}>{f.signedMoney(s.effect.ebitda)}</b></span>
            <small className="muted">{T.explain.sugNote(s.effect, f)}</small>
            <Button icon="flask" onClick={() => apply(s)}>{T.explain.open}</Button>
          </div>
        ))}
      </div>
      <p className="muted small">{T.explain.note}</p>
    </div>
  );
}
