import { useEffect, useRef, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { DIMS, NQ, NALL, answeredCount, score } from '../model.js';
import { DIM_ICON } from '../icons.js';
import { Radar, RadarLegend } from '../charts.jsx';

export default function Assess({ ctx }) {
  const { T, f, mine, step, setStep, setAnswer, finish, org, amb, hl, setHl } = ctx;
  const d = DIMS[step];
  const C = T.dims[d];
  const base = step * NQ;
  const vals = mine.slice(base, base + NQ);
  const firstOpenHere = vals.findIndex(v => v == null);
  const [active, setActive] = useState(firstOpenHere < 0 ? 0 : firstOpenHere);
  const refs = useRef([]);
  const S = score(mine, org || 'other', amb);
  const n = answeredCount(mine);
  const last = step === DIMS.length - 1;
  const stepDone = vals.every(v => v != null);

  useEffect(() => { const i = mine.slice(base, base + NQ).findIndex(v => v == null); setActive(i < 0 ? 0 : i); }, [step]);

  const pick = (k, v) => {
    setAnswer(base + k, v);
    const later = vals.findIndex((x, j) => j > k && x == null);
    const nextOpen = later >= 0 ? later : vals.findIndex((x, j) => j !== k && x == null);
    if (nextOpen >= 0) {
      setActive(nextOpen);
      const el = refs.current[nextOpen];
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.72 || r.top < 60) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 160);
      }
    } else setActive(k);
  };

  // Клавіші 1..5 і 0 відповідають на активне питання.
  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' && t.type !== 'radio' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (/^[0-5]$/.test(e.key)) { e.preventDefault(); pick(active, Number(e.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const go = i => { setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <>
      <nav className="mt-steps glass" aria-label={T.nav.assess}>
        {DIMS.map((x, i) => {
          const k = mine.slice(i * NQ, i * NQ + NQ).filter(v => v != null).length;
          return (
            <button key={x} type="button" className={'mt-step' + (i === step ? ' on' : '') + (k === NQ ? ' full' : '')} onClick={() => go(i)}
              aria-current={i === step ? 'step' : undefined} aria-label={`${T.stepOf(i + 1, DIMS.length)}: ${T.dims[x].name}, ${k}/${NQ}`}>
              <Icon name={k === NQ && i !== step ? 'check' : DIM_ICON[x]} size={16} />
              <span className="mt-step-name">{T.dims[x].short}</span>
              <span className="mt-step-fill" style={{ width: (k / NQ) * 100 + '%' }} />
            </button>
          );
        })}
      </nav>

      <div className="grid mt-assess">
        <div className="mt-qcol">
          <div className="mt-dimhead glass" key={d}>
            <span className="mt-dim-icon big"><Icon name={DIM_ICON[d]} size={24} /></span>
            <div>
              <span className="profile-kicker"><i className="kick-dot" />{T.stepKicker(step + 1, DIMS.length)}</span>
              <h2>{C.name}</h2>
              <p>{C.desc}</p>
            </div>
          </div>

          {C.q.map((q, k) => {
            const i = base + k;
            const v = mine[i];
            return (
              <fieldset key={d + k} ref={el => { refs.current[k] = el; }} className={'mt-q glass' + (active === k ? ' active' : '') + (v != null ? ' answered' : '')}
                onFocus={() => setActive(k)} onPointerDown={() => setActive(k)} style={{ animationDelay: k * 0.06 + 's' }}>
                <legend className="sr-only">{q.t}</legend>
                <div className="mt-q-head">
                  <span className="mt-q-n">{f.int(step + 1)}.{f.int(k + 1)}</span>
                  <h3 aria-hidden="true">{q.t}</h3>
                </div>
                <p className="mt-q-hint"><Icon name="bulb" size={15} /><span>{q.hint}</span></p>
                <div className="mt-opts">
                  {q.o.map((o, j) => (
                    <label key={j} className={'mt-opt' + (v === j + 1 ? ' on' : '')}>
                      <input type="radio" name={'q' + i} value={j + 1} checked={v === j + 1} onChange={() => pick(k, j + 1)} />
                      <span className="mt-opt-lv" aria-hidden="true">{j + 1}</span>
                      <span className="mt-opt-t">{o}</span>
                    </label>
                  ))}
                  <label className={'mt-opt dunno' + (v === 0 ? ' on' : '')}>
                    <input type="radio" name={'q' + i} value={0} checked={v === 0} onChange={() => pick(k, 0)} />
                    <span className="mt-opt-lv" aria-hidden="true">?</span>
                    <span className="mt-opt-t">{T.unknown}</span>
                  </label>
                </div>
              </fieldset>
            );
          })}

          <div className="mt-qnav">
            <Button icon="back" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}>{T.prev}</Button>
            <span className={'mt-qnav-status' + (stepDone ? ' ok' : '')}>
              {stepDone ? <><Icon name="check" size={15} />{n === NALL ? T.allDone : T.stepDone}</> : T.left(vals.filter(x => x == null).length)}
            </span>
            {last
              ? <Button kind="primary" icon="radar" onClick={finish}>{T.finish}</Button>
              : <Button kind={stepDone ? 'primary' : 'ghost'} icon="arrowRight" className={stepDone ? 'mt-pulse' : ''} onClick={() => go(step + 1)}>{T.next}</Button>}
          </div>
        </div>

        <aside className="mt-side">
          <Panel title={T.liveTitle} sub={T.liveSub} className="mt-live">
            <Radar S={S} T={T} f={f} hl={hl || d} setHl={setHl} mini label={T.liveTitle} onPick={x => go(DIMS.indexOf(x))} />
            <RadarLegend T={T} />
            <div className="mt-live-n">
              <span className="mt-progress-track"><span style={{ width: (n / NALL) * 100 + '%' }} /></span>
              <small>{T.progressOf(n, NALL)}</small>
            </div>
            {n === NALL && <Button kind="primary" icon="radar" onClick={finish}>{T.finish}</Button>}
          </Panel>
          <p className="note mt-keys"><Icon name="info" size={15} /><span>{T.keysHint}</span></p>
        </aside>
      </div>
    </>
  );
}
