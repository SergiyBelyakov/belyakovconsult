import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { roadmap } from '../model.js';
import { DIM_ICON } from '../icons.js';
import { ModeBanner, NotDone } from './Results.jsx';
import { track } from '../track.js';

export default function Roadmap({ ctx }) {
  const { T, f, pr, complete, done, setDone, pdf, busy, openLead, shown } = ctx;
  if (!complete) return <><ModeBanner ctx={ctx} /><NotDone ctx={ctx} /></>;
  const cols = roadmap(pr);
  const keyOf = x => `${x.dim}-${x.from}-${x.i}`;
  const all = cols.flatMap(c => c.items);
  const nDone = all.filter(x => done[keyOf(x)]).length;
  const toggle = x => {
    const k = keyOf(x);
    setDone(d => { const n = { ...d }; if (n[k]) delete n[k]; else n[k] = true; return n; });
    if (!done[k]) track('step_done', { dim: x.dim, h: x.i });
  };
  return (
    <>
      <ModeBanner ctx={ctx} />
      <div className="mt-rm-head glass">
        <div className="mt-rm-prio">
          {pr.map((p, i) => (
            <span key={p.id} className="mt-rm-chip"><b>{f.int(i + 1)}</b><Icon name={DIM_ICON[p.id]} size={16} />{T.dims[p.id].name}<small>{f.int(p.from)} → {f.int(p.to)}</small></span>
          ))}
        </div>
        <div className="mt-rm-meta">
          <span className="mt-live-n"><span className="mt-progress-track"><span style={{ width: (nDone / all.length) * 100 + '%' }} /></span><small>{T.doneOf(nDone, all.length)}</small></span>
          <Button icon="pdf" onClick={pdf} disabled={busy}>{T.pdf}</Button>
          <Button icon="print" className="hide-sm" onClick={() => { track('print'); window.print(); }}>{T.rmPrint}</Button>
        </div>
      </div>

      <div className="mt-rm">
        {cols.map((c, ci) => (
          <section key={c.h} className="mt-rm-col glass" style={{ animationDelay: ci * 0.1 + 's' }}>
            <header>
              <span className="mt-rm-h">{T.horizons[c.h][0]}</span>
              <span className="mt-rm-s">{T.horizons[c.h][1]}</span>
            </header>
            <ol>
              {c.items.map(x => {
                const k = keyOf(x);
                return (
                  <li key={k} className={done[k] ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={!!done[k]} onChange={() => toggle(x)} />
                      <span className="mt-rm-box" aria-hidden="true"><Icon name="check" size={13} /></span>
                      <span className="mt-rm-body">
                        <span className="mt-rm-dim"><Icon name={DIM_ICON[x.dim]} size={14} />{T.dims[x.dim].short}</span>
                        <span className="mt-rm-text">{T.dims[x.dim].act[x.from][x.i]}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <div className="grid mt-two">
        <Panel title={T.measureTitle}>
          <ul className="check-list">{T.measure.map((t, i) => <li key={i}><Icon name="check" size={16} /><span>{t}</span></li>)}</ul>
        </Panel>
        <Panel title={T.antiTitle}>
          {ctx.anti.length ? (
            <ul className="mt-list anti">{ctx.anti.map(a => <li key={a}><span className="mt-stop"><Icon name="stop" size={18} /></span><p>{T.anti[a]}</p></li>)}</ul>
          ) : <p className="muted">{T.antiNone}</p>}
        </Panel>
      </div>

      <Panel className="cta-card flat-panel">
        <h3>{T.ctaTitle}</h3>
        <p>{T.ctaText}</p>
        <Button kind="primary" icon="mail" onClick={() => openLead('roadmap')}>{T.ctaBtn}</Button>
      </Panel>
      {shown.kind !== 'mine' && <p className="note"><Icon name="info" size={15} /><span>{T.rmSampleNote}</span></p>}
    </>
  );
}
