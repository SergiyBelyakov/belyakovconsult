import { useEffect, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { MODELS, FAMILIES, defaultParams } from '../engine/models.js';
import { runModel, holdout } from '../engine/evaluate.js';
import { DEFAULT_DS } from '../data.js';
import { makeFmt } from '../format.js';
import { Spark } from '../charts.jsx';
import { seriesFor, Caps } from '../common.jsx';

const FAMILY_ICON = { base: 'target', smooth: 'pulse', reg: 'chart', stat: 'layers', special: 'spark', ml: 'graph' };
const CAPS = ['trend', 'season', 'multi', 'drivers', 'events', 'intermittent'];

// Мініатюри й точність рахуються поступово, щоб сторінка з’явилася одразу
function useCards() {
  const [cards, setCards] = useState({});
  useEffect(() => {
    let alive = true, i = 0;
    const step = () => {
      if (!alive || i >= MODELS.length) return;
      const m = MODELS[i++], S = seriesFor(DEFAULT_DS[m.id]);
      try {
        const p = defaultParams(m.id, S), r = runModel(m.id, S, p, S.h), ho = holdout(m.id, S, p, S.H);
        setCards(c => ({ ...c, [m.id]: { y: S.y, fc: r.fc, mase: ho.m.mase, ds: S.id } }));
      } catch { /* модель просто без мініатюри */ }
      setTimeout(step, 0);
    };
    const t = setTimeout(step, 30);
    return () => { alive = false; clearTimeout(t); };
  }, []);
  return cards;
}

export default function Catalog({ ctx }) {
  const { T, openModel, family, setFamily, site, navigate } = ctx;
  const cards = useCards();
  const [cap, setCap] = useState(null);
  // сканер над мініатюрою: положення курсора по ширині графіка наведеної картки
  const [scan, setScan] = useState(null);
  const fmt = makeFmt(T, 2);
  const onScan = (id, e) => {
    const box = e.currentTarget.querySelector('.fc-spark-box');
    if (!box) return;
    const r = box.getBoundingClientRect(), hx = (e.clientX - r.left) / r.width;
    setScan(hx >= 0 && hx <= 1 ? { id, hx } : null);
  };
  const fams = family === 'all' ? FAMILIES : [family];
  const visible = m => (!cap || m.caps[cap]) && fams.includes(m.family);

  return (
    <>
      <div className="fc-filters glass">
        <div className="fc-chips" role="group" aria-label={T.nav.catalog}>
          <button type="button" className={'fc-chip' + (family === 'all' ? ' on' : '')} onClick={() => setFamily('all')}>{T.filterAll}<b>{MODELS.length}</b></button>
          {FAMILIES.map(f => (
            <button key={f} type="button" className={'fc-chip' + (family === f ? ' on' : '')} onClick={() => setFamily(f)}>
              <Icon name={FAMILY_ICON[f]} size={14} />{T.families[f][0]}<b>{MODELS.filter(m => m.family === f).length}</b>
            </button>
          ))}
        </div>
        <div className="fc-chips sm" role="group" aria-label={T.capsTitle}>
          <span className="fc-chips-label">{T.capsTitle}:</span>
          {CAPS.map(c => <button key={c} type="button" className={'fc-chip sm' + (cap === c ? ' on' : '')} aria-pressed={cap === c} onClick={() => setCap(cap === c ? null : c)}>{T.caps[c]}</button>)}
        </div>
      </div>

      <div className="fc-cat-note glass" role="note">
        <span className="fc-cat-note-icon"><Icon name="info" size={18} /></span>
        <p><b>{T.maseNote[0]}</b> {T.maseNote[1]}</p>
        <Button icon="scale" onClick={() => navigate('compare')}>{T.maseNote[2]}</Button>
      </div>

      {fams.map(f => {
        const list = MODELS.filter(m => m.family === f && visible(m));
        if (!list.length) return null;
        return (
          <section key={f} className="fc-family">
            <div className="fc-family-head">
              <span className="fc-family-icon"><Icon name={FAMILY_ICON[f]} size={18} /></span>
              <div><h2>{T.families[f][0]}</h2><p>{T.families[f][1]}</p></div>
            </div>
            <div className="fc-cards">
              {list.map((m, k) => {
                const c = cards[m.id];
                return (
                  <article key={m.id} className="fc-card glass" style={{ animationDelay: k * 0.05 + 's' }} onMouseMove={e => onScan(m.id, e)} onMouseLeave={() => setScan(null)}>
                    <button type="button" className="fc-card-hit" onClick={() => openModel(m.id)} aria-label={`${T.models[m.id].name}: ${T.open}`} />
                    <h3>{T.models[m.id].name}</h3>
                    <p>{T.models[m.id].short}</p>
                    <div className="fc-card-spark">{c ? <Spark y={c.y} fc={c.fc} fmt={fmt} hx={scan && scan.id === m.id ? scan.hx : null} /> : <span className="fc-spark-ph" />}</div>
                    <div className="fc-card-foot">
                      <Caps caps={m.caps} T={T} />
                      {c && Number.isFinite(c.mase) && (
                        <small className="fc-card-acc" title={T.maseNote[1]}><span>{T.onData} «{T.datasets[c.ds].name}»</span><b className={c.mase < 1 ? 'good' : ''}>MASE {fmt.dec2(c.mase)}</b></small>
                      )}
                    </div>
                    <span className="fc-card-go">{T.open}<Icon name="arrowRight" size={14} /></span>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="grid fc-two">
        <Panel title={T.howToRead} className="fc-read">
          <ul className="fc-read-list">
            <li><i className="fc-sw actual" /><span>{T.howToReadItems[0]}</span></li>
            <li><i className="fc-sw fitted" /><span>{T.howToReadItems[1]}</span></li>
            <li><i className="fc-sw test" /><span>{T.howToReadItems[2]}</span></li>
          </ul>
          <div className="fc-read-actions">
            <Button kind="primary" icon="scale" onClick={() => navigate('compare')}>{T.nav.compare}</Button>
            <Button icon="upload" onClick={() => navigate('data')}>{T.nav.data}</Button>
          </div>
        </Panel>
        <Panel title={T.otherTitle} sub={T.otherSub}>
          <div className="fc-other">
            {T.other.map(([slug, kind, text]) => (
              <a key={slug} className="fc-other-card" href={`${site}/cases/${slug}/`}>
                <small>{kind}</small>
                <span>{text}</span>
                <Icon name="arrowRight" size={15} />
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
