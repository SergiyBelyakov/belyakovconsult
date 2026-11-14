import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { DIMS, ORGS, SIZES, AMBITIONS, NALL, NQ, answeredCount, isComplete } from '../model.js';
import { DIM_ICON } from '../icons.js';

function Choice({ name, value, options, onChange, label, cols }) {
  return (
    <fieldset className={'mt-choice' + (cols ? ' c' + cols : '')}>
      <legend>{label}</legend>
      {options.map(o => (
        <label key={o.value} className={'mt-opt-card' + (value === o.value ? ' on' : '')}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.icon && <Icon name={o.icon} size={17} />}
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

const ORG_ICON = { community: 'home', public: 'scale', business: 'factory', ngo: 'users', other: 'grid' };

export default function Start({ ctx }) {
  const { T, mine, org, setOrg, size, setSize, amb, setAmb, begin, reset, openSample, navigate, f } = ctx;
  const n = answeredCount(mine);
  const doneAll = isComplete(mine);
  return (
    <>
      <div className="grid mt-start">
        <Panel title={T.ctxTitle} sub={T.ctxSub} className="mt-ctx">
          <Choice name="org" label={T.orgLabel} value={org} onChange={setOrg} cols={3}
            options={ORGS.map(o => ({ value: o, label: T.orgs[o], icon: ORG_ICON[o] }))} />
          <div className="mt-ctx-row">
            <Choice name="size" label={T.sizeLabel} value={size} onChange={setSize} options={SIZES.map(s => ({ value: s, label: T.sizes[s] }))} />
            <Choice name="amb" label={T.ambLabel} value={amb} onChange={setAmb} options={AMBITIONS.map(a => ({ value: a, label: T.amb[a] }))} />
          </div>
          <p className="mt-amb-hint"><Icon name="target" size={15} />{T.ambHint[amb]}</p>
          <div className="mt-start-actions">
            <Button kind="primary" icon={n ? 'play' : 'arrowRight'} onClick={begin}>{doneAll ? T.resultsBtn : n ? T.continueBtn : T.startBtn}</Button>
            {n > 0 && <span className="mt-start-prog"><span className="mt-progress-track"><span style={{ width: (n / NALL) * 100 + '%' }} /></span><small>{T.progressOf(n, NALL)}</small></span>}
            {n > 0 && <Button icon="reset" onClick={reset}>{T.resetBtn}</Button>}
          </div>
          <p className="note"><Icon name="lock" size={15} /><span><b>{T.privacyTitle}.</b> {T.privacy}</span></p>
        </Panel>

        <Panel title={T.howTitle} className="how-panel">
          <ol className="how-list">
            {T.how.map((t, i) => <li key={i}><span className="how-n">{i + 1}</span><span>{t}</span></li>)}
          </ol>
          <div className="mt-samples">
            <h4>{T.samplesTitle}</h4>
            <p className="muted small">{T.samplesSub}</p>
            {['community', 'business', 'ngo'].map(id => (
              <button key={id} type="button" className="mt-sample" onClick={() => openSample(id)}>
                <span><strong>{T.samples[id]}</strong><small>{T.sampleText[id]}</small></span>
                <Icon name="chevronRight" size={16} />
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={T.dimsTitle} sub={T.dimsSub} className="flat-panel">
        <div className="mt-dims">
          {DIMS.map((d, i) => {
            const k = mine.slice(i * NQ, i * NQ + NQ).filter(v => v != null).length;
            return (
              <button key={d} type="button" className="mt-dim-card" onClick={() => ctx.goStep(i)} style={{ animationDelay: i * 0.05 + 's' }}>
                <span className="mt-dim-icon"><Icon name={DIM_ICON[d]} size={20} /></span>
                <span className="mt-dim-n">{f.int(i + 1)}</span>
                <strong>{T.dims[d].name}</strong>
                <p>{T.dims[d].desc}</p>
                <span className="mt-dim-dots" aria-hidden="true">{[0, 1, 2, 3].map(j => <i key={j} className={j < k ? 'on' : ''} />)}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      <div className="mt-method-link">
        <Button icon="book" onClick={() => navigate('method')}>{T.nav.method}</Button>
      </div>
    </>
  );
}
