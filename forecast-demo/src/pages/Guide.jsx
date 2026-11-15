// Як обрати модель: кілька питань про ряд дають моделі, з яких почати, і орієнтир для порівняння.
// Нижче правила чесного прогнозу, словник і джерела.
import { useMemo, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { BY_ID } from '../engine/models.js';
import { Caps } from '../common.jsx';

const QS = ['season', 'multi', 'trend', 'events', 'drivers', 'zeros', 'saturation', 'range'];
const VAL = { yes: 1, no: 0 };
// Без відповіді (або «не знаю») питання важить як типовий ряд: сезон і тренд під питанням, решта рідкість
const PRIOR = { season: 0.5, multi: 0.15, trend: 0.5, events: 0.2, drivers: 0.2, zeros: 0.1, saturation: 0.15, range: 0.3 };

export function scores(a) {
  const v = k => (a[k] in VAL ? VAL[a[k]] : PRIOR[k]);
  const s = v('season'), t = v('trend'), d = v('drivers'), z = v('zeros'), g = v('saturation'), r = v('range'), nz = 1 - z;
  const mu = v('multi'), ev = v('events');
  return {
    croston: 4 * z,
    ses: (1.6 * (1 - t) * (1 - s) + 0.2) * nz + 0.6 * z,
    ma: 0.9 * (1 - t) * (1 - s) * nz + 0.9 * z,
    drift: 1.2 * t * (1 - s) * nz,
    holt: (2.4 * t * (1 - s) + 0.3 * t) * nz * (1 - 0.5 * g),
    linear: 1.3 * t * (1 - s) * nz * (1 - g),
    hw: (2.8 * s + 0.5 * s * t) * nz,
    trendseason: 2 * s * (0.4 + 0.6 * t) * nz,
    decomp: 1.6 * s * nz,
    theta: (1.3 + 0.5 * t) * nz,
    arima: (1.4 + 0.3 * s) * nz,
    drivers: 3.4 * d * nz,
    growth: 3.6 * g * nz,
    montecarlo: 3.2 * r,
    knn: 0.9 * s * nz,
    ensemble: 1.5 * nz + 0.2,
    prophet: (3.6 * ev + 0.8 * mu + 0.4 * s * t) * nz,
    tbats: (3.8 * mu + 0.3 * s) * nz,
    sarimax: (2.6 + 0.8 * s) * d * nz,
    boost: (1.6 * d + 0.4 * mu) * nz,
  };
}
export function recommend(a, k = 4) {
  return Object.entries(scores(a)).filter(([, v]) => v >= 0.5).sort((x, y) => y[1] - x[1]).slice(0, k).map(([id, v]) => ({ id, v }));
}

export default function Guide({ ctx }) {
  const { T, openModel, navigate, openLead, track } = ctx;
  const [ans, setAns] = useState({});
  const recs = useMemo(() => recommend(ans), [ans]);
  const answered = QS.filter(q => ans[q]).length;
  const base = ans.season === 'yes' ? 'snaive' : 'naive';
  const set = (q, v) => { setAns(a => ({ ...a, [q]: a[q] === v ? undefined : v })); track('guide', { q, v }); };

  return (
    <>
      <div className="grid fc-guide">
        <Panel title={T.qTitle} sub={T.answered(answered, QS.length)} className="fc-qs"
          aside={answered > 0 ? <Button icon="reset" onClick={() => setAns({})}>{T.recReset}</Button> : null}>
          <ol className="fc-qlist">
            {QS.map((q, i) => (
              <li key={q} className={ans[q] ? 'done' : ''}>
                <span className="how-n">{i + 1}</span>
                <div className="fc-q-text"><b>{T.qs[q][0]}</b><small>{T.qs[q][1]}</small></div>
                <div className="fc-seg fc-ans" role="radiogroup" aria-label={T.qs[q][0]}>
                  {['yes', 'no', 'unsure'].map(v => (
                    <button key={v} type="button" role="radio" aria-checked={ans[q] === v} className={ans[q] === v ? 'on ' + v : ''} onClick={() => set(q, v)}>{T[v]}</button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={T.recTitle} sub={T.recSub} className="fc-recs">
          <ol className="fc-rec-list">
            {recs.map((r, k) => (
              <li key={r.id} className="fc-rec" style={{ animationDelay: k * 0.05 + 's' }}>
                <span className="fc-rec-n">{k + 1}</span>
                <div className="fc-rec-body">
                  <div className="fc-rec-head">
                    <button type="button" className="link-btn" onClick={() => openModel(r.id)}>{T.models[r.id].name}</button>
                    <small>{T.families[BY_ID[r.id].family][0]}</small>
                  </div>
                  <p>{T.recWhy[r.id]}</p>
                  <Caps caps={BY_ID[r.id].caps} T={T} />
                </div>
              </li>
            ))}
          </ol>
          <div className="fc-rec-base">
            <Icon name="target" size={16} />
            <div><small>{T.recBase}</small><button type="button" className="link-btn" onClick={() => openModel(base)}>{T.models[base].name}</button><p>{T.recWhy[base]}</p></div>
          </div>
          <div className="fc-cta-actions">
            <Button kind="primary" icon="upload" onClick={() => navigate('data')}>{T.tryOwn}</Button>
            <Button icon="scale" onClick={() => navigate('compare')}>{T.nav.compare}</Button>
          </div>
        </Panel>
      </div>

      <div className="grid fc-two">
        <Panel title={T.rulesTitle}>
          <ol className="how-list fc-rules">{T.rules.map((t, i) => <li key={i}><span className="how-n">{i + 1}</span><span>{t}</span></li>)}</ol>
        </Panel>
        <Panel title={T.glossTitle}>
          <dl className="glossary">{T.gloss.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
      </div>

      <div className="grid fc-two">
        <Panel title={T.sourcesTitle}>
          <ul className="fc-sources">
            {T.sources.map(([title, text, url]) => (
              <li key={title}>
                <Icon name="book" size={16} />
                <div>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{title}</a> : <b>{title}</b>}<p>{text}</p></div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="cta-card flat-panel">
          <h3>{T.ctaTitle}</h3>
          <p>{T.ctaText}</p>
          <div className="fc-cta-actions">
            <Button kind="primary" icon="mail" onClick={() => openLead('guide')}>{T.ctaLong}</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
