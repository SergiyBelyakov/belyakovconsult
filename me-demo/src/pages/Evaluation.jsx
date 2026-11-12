import { useMemo } from 'react';
import { REGION_IDS, PRE_TREND, SURVEY_AT, FB_CATS, FB_CHANNELS, IND_BY } from '../data.js';
import { effect, dac, DAC, feedbackAt, statusOf, regionStats, finance, reach, summary, sum } from '../model.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { Status } from '../parts.jsx';
import { DidChart, Forest, TrendPair } from '../charts.jsx';

const PEOPLE = ['all', 'female', 'male', 'older', 'younger', 'disability', 'nodisability', 'idp', 'local', 'rural', 'urban'];

export default function Evaluation({ ctx }) {
  const { T, f, k, method, setMethod, outcome, setOutcome, regionName } = ctx;
  const ready = k >= SURVEY_AT.mid;
  const E = useMemo(() => effect(outcome), [outcome]);
  const forest = useMemo(() => [
    ...PEOPLE.map((id, i) => ({ id, name: T.ev.sub[id], head: id === 'all', ...effect(outcome, id).did })),
    ...REGION_IDS.map((r, i) => ({ id: r, name: regionName(r, true), gap: i === 0, ...effect(outcome, r).did })),
  ], [outcome, T]);
  const D = useMemo(() => dac(k), [k]);
  const FB = useMemo(() => feedbackAt(k), [k]);
  const m = T.ev.methods[method];
  const est = E[method];
  const pp = (v, raw) => (raw === 'v' ? f.pct(v, 1) : f.pp(v));

  const evid = c => {
    const ev = D[c].ev;
    switch (c) {
      case 'relevance': return T.dacEv.relevance(f.pct(ev.x1.v, 1), f.pct(ev.x2.v, 1), ev.low.map(x => regionName(x.id, true)).join(', '));
      case 'coherence': return T.dacEv.coherence(f.int(ev.ov));
      case 'effectiveness': return T.dacEv.effectiveness(ev.onTrack, ev.n);
      case 'efficiency': return T.dacEv.efficiency(f.dec2(ev.cpi), ev.worst.p, f.dec2(ev.worst.cpi), ev.slow.p, f.pct(ev.slow.burnGap * 100));
      case 'impact': return T.dacEv.impact(ev.eff ? f.pp(ev.eff.did.est) : null, ev.eff ? f.signed(ev.eff.did.lo) : '', ev.eff ? f.signed(ev.eff.did.hi) : '');
      default: return T.dacEv.sustainability(ev.surv.v == null ? '·' : f.pct(ev.surv.v), ev.r41.v == null ? '·' : f.pct(ev.r41.v));
    }
  };
  const fbMax = Math.max(...FB_CATS.map(c => FB.by[c]));
  const gaps = PRE_TREND.P.map((v, i) => v - PRE_TREND.C[i]), gapLo = Math.min(...gaps), gapHi = Math.max(...gaps);

  return (
    <>
      <div className="toolbar me-ev-ctl">
        <div className="ctl-group"><span>{T.ev.outcome}</span><Segmented value={outcome} onChange={setOutcome} label={T.ev.outcome} options={['inc', 'svc'].map(o => ({ value: o, label: T.ev.outcomes[o] }))} /></div>
        <div className="ctl-group"><span>{T.ev.method}</span><Segmented value={method} onChange={setMethod} label={T.ev.method} options={['pre', 'post', 'did'].map(x => ({ value: x, label: T.ev.methods[x].n }))} /></div>
      </div>

      {!ready && <div className="wait-note glass"><Icon name="clock" size={18} /><p>{T.ev.wait}</p></div>}

      {ready && (
        <div className="grid me-ev-main">
          <Panel title={T.ev.outcomes[outcome] + ': ' + m.n} sub={m.d}>
            <DidChart e={E} method={method} names={T.ev.groups} times={T.ev.times} timesShort={T.ev.timesShort} fmt={pp} label={T.ev.outcomes[outcome]} />
            <p className={'note' + (method === 'did' ? '' : ' warn')}><Icon name={method === 'did' ? 'check' : 'warning'} size={14} />{m.bias}</p>
          </Panel>
          <div className="ev-side">
            <section className="ev-est glass">
              <span>{T.ev.estimate}</span>
              <b>{f.pp(est.est)}</b>
              <small>{T.ev.ci(f.signed(est.lo), f.signed(est.hi))}</small>
              <small className="muted">{T.ev.n(f.int(E.nP), f.int(E.nC))}</small>
            </section>
            <section className="ev-answers glass">
              <h4>{T.ev.answers}</h4>
              {['pre', 'post', 'did'].map(x => (
                <button type="button" key={x} className={'ans-row' + (x === method ? ' on' : '') + (x === 'did' ? ' honest' : '')} onClick={() => setMethod(x)}>
                  <span>{T.ev.methods[x].n}{x === 'did' && <em>{T.ev.truth}</em>}</span>
                  <b>{f.pp(E[x].est)}</b>
                  <span className="ans-bar"><i style={{ left: '50%', width: Math.abs(E[x].est) * 2.2 + '%', transform: E[x].est < 0 ? 'translateX(-100%)' : 'none' }} /></span>
                </button>
              ))}
            </section>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <Panel title={T.ev.forest} sub={T.ev.forestSub}>
          {ready ? <Forest rows={forest} fmt={(v, axis) => (axis ? f.signed(v, 0) : f.signed(v, 1))} label={T.ev.forest} notProven={T.ev.notProven} /> : <p className="muted small">{T.ev.wait}</p>}
        </Panel>
        <Panel title={T.ev.trend} sub={T.ev.trendSub}>
          <TrendPair ticks={PRE_TREND.ticks} a={PRE_TREND.P} b={PRE_TREND.C} names={T.ev.groups} label={T.ev.trend} />
          <p className="note"><Icon name="check" size={14} />{T.ev.trendNote(f.dec1(gapLo), f.dec1(gapHi))}</p>
        </Panel>
      </div>

      <Panel title={T.ev.dac} sub={T.ev.dacSub}>
        <div className="dac-grid">
          {DAC.map(c => {
            const s = D[c].score;
            return (
              <article key={c} className={'dac-card r' + (s || 0)}>
                <div className="dac-top">
                  <h4>{T.ev.dacName[c]}</h4>
                  <span className="dac-rate" aria-label={s ? T.ev.rating[s] : T.ev.ratingNone}>{[1, 2, 3, 4].map(i => <i key={i} className={s && i <= s ? 'on' : ''} />)}</span>
                </div>
                <p className="dac-q">{T.ev.dacQ[c]}</p>
                <b className="dac-word">{s ? T.ev.rating[s] : T.ev.ratingNone}</b>
                <ul>{evid(c).map((x, i) => <li key={i}>{x}</li>)}</ul>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title={T.ev.feedback} sub={T.ev.feedbackSub}>
        <div className="fb-wrap">
          <div className="fb-figs">
            <div><span>{T.ev.fbTotal}</span><b>{f.int(FB.n)}</b><small>{f.int(FB.q.n)} {T.ev.fbQuarter}</small></div>
            <div><span>{T.ind.p43.s}</span><b>{f.pct(FB.closedShare, 1)}</b><Status level={statusOf(IND_BY.p43, k).level} T={T} /></div>
            <div><span>{T.ev.fbDays}</span><b>{f.dec1(FB.q.days)} {T.units.days}</b></div>
          </div>
          <div className="fb-cats">
            {FB_CATS.map(c => (
              <div key={c} className={'fb-row' + (c === 'conduct' ? ' conf' : '') + (c === 'delay' ? ' hot' : '')}>
                <span>{T.ev.fbCat[c]}</span>
                <span className="fb-bar"><i style={{ width: (FB.by[c] / fbMax) * 100 + '%' }} /></span>
                <b>{f.int(FB.by[c])}</b>
              </div>
            ))}
          </div>
          <div className="fb-ch">
            {FB_CHANNELS.map(c => <span key={c}><b>{f.pct((FB.q.ch[c] / FB.q.n) * 100)}</b>{T.ev.fbCh[c]}</span>)}
          </div>
        </div>
        <p className="note"><Icon name="shield" size={14} />{T.ev.fbNote}</p>
      </Panel>
    </>
  );
}
