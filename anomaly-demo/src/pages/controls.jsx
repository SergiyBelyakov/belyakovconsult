// Спільні елементи сторінок: вибір методу, норми й порогу, ознаки, групи, картка запису з поясненням.
import { useMemo, useState } from 'react';
import { Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { useWidth } from '../../../dashboard/src/charts.jsx';
import { METHODS, CONTEXTS } from '../engine.js';
import { dow, monthOf, FEATURES } from '../data.js';
import { logQ } from '../stats.js';

const LP05 = Math.log(0.05);

// Метод, норма, поріг
export function ModelBar({ ctx, compact }) {
  const { T, f, method, setMethod, cx, setCx, th, setTh } = ctx;
  return (
    <div className={'model-bar an-model glass' + (compact ? ' compact' : '')}>
      <div className="model-bar-item">
        <span className="muted small">{T.methodLabel}</span>
        <Segmented value={method} onChange={setMethod} label={T.methodLabel} options={METHODS.map(m => ({ value: m, label: T.methods[m] }))} />
        <small className="muted">{T.methodHints[method]}</small>
      </div>
      <div className="model-bar-item">
        <span className="muted small">{T.contextLabel}</span>
        <Segmented value={cx} onChange={setCx} label={T.contextLabel} options={CONTEXTS.map(c => ({ value: c, label: T.contexts[c] }))} />
        <small className="muted">{T.contextHints[cx]}</small>
      </div>
      <label className="model-bar-item cap">
        <span className="muted small">{T.thLabel}: <b>{f.sigma(th)}</b></span>
        <input type="range" min="2" max="7" step="0.1" value={th} onChange={e => setTh(Number(e.target.value))} aria-label={T.thLabel} />
        <small className="muted">{T.thHint(f.oneIn(Math.exp(logQ(th))))}</small>
      </label>
    </div>
  );
}

export function FeatureChips({ ctx }) {
  const { T, feats, setFeats } = ctx;
  const toggle = id => {
    const next = new Set(feats);
    if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
    setFeats(next);
  };
  return (
    <div className="an-chips" role="group" aria-label={T.featLabel}>
      <span className="muted small an-chips-label">{T.featLabel}</span>
      {FEATURES.map(ft => (
        <button type="button" key={ft.id} className={'chip feat-chip' + (feats.has(ft.id) ? ' active' : '')} aria-pressed={feats.has(ft.id)} title={T.featHint[ft.id]} onClick={() => toggle(ft.id)}>
          <i aria-hidden="true" />{T.features[ft.id]}
        </button>
      ))}
    </div>
  );
}

export function GroupChips({ ctx, counts }) {
  const { T, f, ds, groups, setGroups, focusGroups } = ctx;
  const toggle = g => {
    const next = new Set(groups);
    next.has(g) ? next.delete(g) : next.add(g);
    setGroups(next);
    focusGroups && focusGroups(next);
  };
  return (
    <div className="an-chips" role="group" aria-label={T.groupLabel}>
      <span className="muted small an-chips-label">{T.groupLabel}</span>
      <button type="button" className={'chip' + (!groups.size ? ' active' : '')} aria-pressed={!groups.size} onClick={() => { setGroups(new Set()); focusGroups && focusGroups(new Set()); }}>{T.allGroups}</button>
      {ds.groups.map((g, k) => (
        <button type="button" key={g.id} className={'chip group-chip' + (groups.has(k) ? ' active' : '')} aria-pressed={groups.has(k)} onClick={() => toggle(k)}>
          {T.groupsShort[g.id] || g.name}<b className={counts && counts[k] ? 'hot' : ''}>{counts ? f.int(counts[k]) : ''}</b>
        </button>
      ))}
    </div>
  );
}

// Рівень відхилення: шкала до 8σ, поріг і значення
export function Gauge({ D, th, f, max = 10 }) {
  const x = v => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className="an-gauge" role="img" aria-label={`${f.sigma(D)} / ${f.sigma(th)}`}>
      <div className="an-gauge-track"><i className={(D >= th ? 'hot' : '') + (D > max ? ' over' : '')} style={{ width: x(Math.max(0, D)) }} /><b style={{ left: x(th) }} /></div>
      <div className="an-gauge-ticks"><span>0σ</span><span style={{ left: x(th) }}>{f.sigma(th)}</span><span>{max}σ+</span></div>
    </div>
  );
}

// Текст причини для синтетичного платежу
export function reasonLine(ctx, i, r) {
  const { T, f, ds } = ctx, x = ds.rows[i], R = T.reasons;
  switch (r.id) {
    case 'amount': { const med = 10 ** r.med, k = x.amount / med; return k >= 1 ? R.amountHi(f.uah(x.amount), f.uah(med), f.times(k)) : R.amountLo(f.uah(x.amount), f.uah(med), f.times(1 / k)); }
    case 'vsCp': { if (!x.cpMed) return null; const k = x.amount / x.cpMed; return k >= 1 ? R.vsCpHi(f.times(k), f.uah(x.cpMed), x.cpN) : R.vsCpLo(f.times(1 / k), f.uah(x.cpMed), x.cpN); }
    case 'offHours': return R.offHours(f.time(x.t));
    case 'weekend': return R.weekend(T.days[dow(x.day)]);
    case 'lag': { const med = Math.max(0, Math.round(10 ** r.med - 1)); return x.lag === 0 ? R.lagZero(med) : x.lag < med ? R.lagLo(x.lag, med) : R.lagHi(x.lag, med); }
    case 'novelty': return R.novelty(x.nov);
    case 'freq': return R.freq(x.freq, Math.round(Math.expm1(r.med)));
    case 'sameDay': return R.sameDay(x.sameDay);
    case 'repeat': return x.repeatOf != null ? R.repeat(x.repeatDays, ds.rows[x.repeatOf].id) : R.repeatNone;
    case 'cpGroup': return R.cpGroup(f.pct(x.cpGroup));
    case 'round': return R.round(f.uah(x.amount));
    default: return null;
  }
}

// Гіпотези «може бути нормою», «може бути проблемою» і що перевірити за головними причинами
export function hypotheses(ctx, i, top) {
  const { T, ds } = ctx, x = ds.rows[i], H = T.hyp, g = ds.groups[x.g].id, m = monthOf(x.day);
  const ok = [], bad = [], check = [];
  const push = (arr, v) => { if (v && !arr.includes(v)) arr.push(v); };
  top.slice(0, 2).forEach(r => {
    let key = r.id;
    if (key === 'amount' || key === 'vsCp') key = r.z >= 0 ? 'amountHi' : 'amountLo';
    if (key === 'lag') key = r.z >= 0 ? 'lagHi' : 'lagLo';
    const h = H[key];
    if (!h) return;
    if (key === 'amountHi') {
      if (g === 'utilities' && [0, 1, 11].includes(m)) push(ok, H.season);
      if (g === 'supplies' && m === 11) push(ok, H.yearEnd);
      if ((g === 'rent' || g === 'it') && (x.cpN || 0) <= 1) push(ok, H.annual);
    }
    h.ok.forEach(v => push(ok, v)); h.bad.forEach(v => push(bad, v)); push(check, h.check);
  });
  return { ok: ok.slice(0, 3), bad: bad.slice(0, 3), check: check.slice(0, 3) };
}

// Платежі цьому контрагенту за рік: точки за датою й сумою (логарифм), виділений рубіновим
function CpHistory({ ctx, i }) {
  const { ds, f, T } = ctx, x = ds.rows[i];
  const [ref, W] = useWidth(300);
  const list = useMemo(() => ds.rows.map((r, k) => (r.cp === x.cp ? k : -1)).filter(k => k >= 0), [i]);
  const H = 84, L = 6, R = 6, Tp = 8, B = 16;
  const ys = list.map(k => Math.log10(ds.rows[k].amount)), lo = Math.min(...ys) - 0.15, hi = Math.max(...ys) + 0.15;
  const X = d => L + (W - L - R) * (d / 364), Y = v => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo || 1));
  return (
    <div className="an-cp" ref={ref}>
      <span className="muted small">{T.card.cpHistory(list.length)}</span>
      <svg width={W} height={H} role="img" aria-label={T.card.cpHistory(list.length)}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="rgba(255,255,255,.1)" />
        {[0, 3, 6, 9].map(m => <text key={m} x={X([0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m])} y={H - 3} className="axis">{T.months[m]}</text>)}
        {x.cpMed && <line x1={L} x2={W - R} y1={Y(Math.log10(x.cpMed))} y2={Y(Math.log10(x.cpMed))} stroke="rgba(168,176,188,.45)" strokeDasharray="3 4" />}
        {list.map(k => k !== i && <circle key={k} cx={X(ds.rows[k].day)} cy={Y(Math.log10(ds.rows[k].amount))} r="3" fill="rgba(156,192,240,.7)" />)}
        <circle cx={X(x.day)} cy={Y(Math.log10(x.amount))} r="5" fill="#F0153B" stroke="#0E131B" strokeWidth="2" />
      </svg>
      <span className="muted small">{f.uah(Math.min(...list.map(k => ds.rows[k].amount)))} … {f.uah(Math.max(...list.map(k => ds.rows[k].amount)))}</span>
    </div>
  );
}

// Картка запису: рівень, причини, контекст, гіпотези, перевірка
export function RecordCard({ ctx, i, onPrev, onNext, actions }) {
  const { T, f, ds, E, res, method, th, D, rank, lang } = ctx;
  const [truth, setTruth] = useState(false);
  const x = i != null ? ds.rows[i] : null;
  const info = useMemo(() => {
    if (i == null) return null;
    E.ensure(res, 'iforest');
    const rs = E.reasons(res, i);
    const top = rs.filter(r => r.lp < LP05);
    const agree = ['dev', 'iforest', 'knn'].filter(m => res.D[m][i] >= th).length;
    const nb = E.neighbors(res, i, 4);
    return { rs, top, agree, nb };
  }, [i, res, th]);
  if (x == null) return <div className="an-card an-card-empty"><Icon name="cloud" size={28} /><p>{T.card.empty}</p>{onNext && <Button kind="primary" icon="chevronRight" onClick={onNext}>{T.card.start}</Button>}</div>;
  const lvl = D[i], hot = lvl >= th, near = !hot && lvl >= th - 1;
  const b = res.C.bases[res.C.of[i]];
  const cp = ds.cps[x.cp];
  const month = T.monthsName[monthOf(x.day)] + (lang === 'uk' ? ' 2026' : ' 2026');
  const hyp = hypotheses(ctx, i, info.top);
  const lines = info.top.slice(0, 4).map(r => ({ r, text: reasonLine(ctx, i, r) })).filter(l => l.text);
  const ext = res.extra;
  const bi = res.C.of[i];
  const causeArgs = { orig: x.orig != null ? f.uah(x.orig) : '', twin: x.dupOf != null ? ds.rows[x.dupOf].id : '', k: x.orig ? f.times(x.amount / x.orig) : '' };
  const truthText = x.truth === 'normal' ? (hot ? T.causes.normalHit() : T.causes.normal()) : T.causes[x.cause](causeArgs);
  return (
    <div className="an-card" aria-live="polite">
      <div className="an-card-head">
        <div>
          <span className="mono muted small">{x.id} · {T.groups[ds.groups[x.g].id]}</span>
          <h3>{cp.name[lang]}</h3>
          <p className="muted small">{f.day(x.day)}, {f.time(x.t)} · {T.card.invoice} {f.day(x.inv)}</p>
        </div>
        <span className={'an-badge ' + (hot ? 'hot' : near ? 'near' : 'ok')}>{hot ? T.card.signal : near ? T.card.near : T.card.ok}</span>
      </div>
      <div className="an-card-amount"><b>{f.uah(x.amount)}</b><span className="muted small">{T.purposes[x.purpose] ? T.purposes[x.purpose](month) : ''}</span></div>

      <h4>{T.card.level}: <b className={hot ? 'ruby' : ''}>{f.sigma(lvl)}</b></h4>
      <Gauge D={lvl} th={th} f={f} />
      <p className="muted small an-card-meta">{T.card.rarer(f.oneIn(Math.exp(logQ(Math.max(0, lvl)))))} · {T.card.rank(f.int(rank[i] + 1), f.int(ds.n))} · {T.card.methods(info.agree)}</p>

      <h4>{hot ? T.card.why : T.card.whyNot}</h4>
      {lines.length ? (
        <ul className="an-reasons">
          {lines.map(({ r, text }) => (
            <li key={r.id}>
              <span className="an-reason-text">{text}</span>
              <span className="an-reason-meta"><span className="mini-track"><i style={{ width: `${Math.min(100, (Math.abs(r.z) / 8) * 100)}%` }} /></span><small>{T.card.rareIn(f.oneIn(Math.exp(r.lp)))}</small></span>
            </li>
          ))}
        </ul>
      ) : <p className="muted small">{T.card.nothingRare}</p>}
      {method === 'iforest' && ext.ifPath && <p className="muted small">{T.card.ifNote(f.dec1(ext.ifPath[i]), f.dec1(ext.ifTypical[bi] || 0))}</p>}
      {method === 'knn' && ext.knnDist && ext.knnTypical[bi] > 0 && <p className="muted small">{T.card.knnNote(f.times(ext.knnDist[i] / ext.knnTypical[bi]))}</p>}

      <h4>{T.card.context}</h4>
      <CpHistory ctx={ctx} i={i} />
      <div className="an-similar">
        <span className="muted small">{T.card.similar}</span>
        {info.nb.map(o => (
          <button type="button" key={o} className="an-sim" onClick={() => ctx.setSel(o)}>
            <span className="mono">{ds.rows[o].id}</span><span>{f.uah(ds.rows[o].amount)}</span><span className={D[o] >= th ? 'ruby' : 'muted'}>{f.sigma(D[o])}</span>
          </button>
        ))}
      </div>

      {(hyp.ok.length > 0 || hyp.bad.length > 0) && (
        <div className="an-hyp">
          <div><h4>{T.card.maybeOk}</h4><ul>{hyp.ok.map(v => <li key={v}>{v}</li>)}</ul></div>
          <div><h4>{T.card.maybeBad}</h4><ul>{hyp.bad.map(v => <li key={v}>{v}</li>)}</ul></div>
        </div>
      )}
      {hyp.check.length > 0 && (<><h4>{T.card.check}</h4><ul className="an-check">{hyp.check.map(v => <li key={v}><Icon name="check" size={14} />{v}</li>)}</ul></>)}

      <div className="an-truth">
        <Button icon="eye" onClick={() => setTruth(!truth)}>{truth ? T.card.hide : T.card.reveal}</Button>
        {truth && (
          <div className={'an-truth-box t-' + x.truth}>
            <span className="muted small">{T.card.truthTitle}</span>
            <b>{T.truth[x.truth]}</b>
            <p>{truthText}{x.truth !== 'normal' && !hot ? ' ' + T.causes.missed : ''}</p>
          </div>
        )}
      </div>
      {(onPrev || onNext || actions) && (
        <div className="an-card-nav">
          {onPrev && <Button icon="chevronLeft" onClick={onPrev}>{T.scene.prev}</Button>}
          {onNext && <Button icon="chevronRight" onClick={onNext}>{T.scene.next}</Button>}
          {actions}
        </div>
      )}
    </div>
  );
}
