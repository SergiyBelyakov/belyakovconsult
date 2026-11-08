// Рівень 3: «Що станеться, якщо я втручуся?» Симулятор рішень: ситуація і причини, готові рішення,
// важелі з лагами й еластичністю, EBITDA і гроші проти порогу, внесок кожного рішення, компроміси,
// матриця альтернатив «ефект × ризик» і збережені рішення.
import { useMemo, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Waterfall } from '../charts.jsx';
import { ScenarioChart, ImpactScatter } from '../charts2.jsx';
import { simulate, attribute, compare, execRisk, riskLevel, sliderActions, presetActions, PRESETS, LEVERS, LEVER_RANGE, FIRST, FULL, K } from '../sim.js';
import { monthKey } from '../outlook.js';
import { attention } from '../risk.js';
import { situation } from './Overview.jsx';
import { Status, useTween } from '../parts.jsx';

const KEY = 'bc-exec-decisions-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const store = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } };

function Out({ label, a, b, d, fmtD, good = 1, note, level, T }) {
  const tv = useTween(d);
  const cls = Math.abs(d) < 0.5 ? 'muted' : d * good > 0 ? 'good' : 'over';
  return (
    <div className={'scen-card glass' + (level === 'critical' ? ' crit' : '')}>
      <span>{label}</span>
      <div className="scen-vals"><small>{a}</small><Icon name="arrowRight" size={14} /><b>{b}</b></div>
      <em className={cls}>{Math.abs(d) < 0.5 ? T.scen.same : fmtD(tv)}</em>
      {note && <small className="muted">{note}</small>}
    </div>
  );
}

export default function Scenarios({ ctx }) {
  const { T, f, D, ind, unit, i, drv, setDrv, presets, setPresets, unitName, notify, openCause, go, track } = ctx;
  const [saved, setSaved] = useState(() => (load()[ind] || []));
  const [name, setName] = useState('');
  const scope = unit;
  const actions = useMemo(() => [...presetActions(ind, presets), ...sliderActions(ind, scope, drv)], [ind, presets, scope, drv]);
  const att = attention(ind, i);
  const { steps, base, scen } = useMemo(() => attribute(ind, i, actions), [ind, i, actions]);
  const c = compare(scen, base);
  const risk = execRisk(actions, scen, base);
  const sit = situation(D, ind, 'all', i);
  const ticks = base.months.map(m => f.tick(monthKey(m.t)));
  const any = actions.length > 0;
  const set = (k, v) => setDrv({ ...drv, [k]: v });
  const togglePreset = id => setPresets(presets.includes(id) ? presets.filter(x => x !== id) : [...presets, id]);
  const firstBelow = r => (r.firstBelow != null ? f.month(monthKey(r.firstBelow), true) : T.cash.never);

  // компроміси: кожен важіль окремо проти бази
  const isolated = LEVERS.filter(k => drv[k]).map(k => {
    const acts = sliderActions(ind, scope, { [k]: drv[k] });
    const r = simulate(ind, i, acts);
    return { k, v: drv[k], c: compare(r, base), r };
  });
  const presetRes = PRESETS[ind].map(p => {
    const r = simulate(ind, i, p.actions);
    return { id: p.id, name: T.presets[ind][p.id], c: compare(r, base), risk: execRisk(p.actions, r, base), r };
  });

  // збережені рішення
  const autoName = () => [...presets.map(p => T.presets[ind][p]), ...LEVERS.filter(k => drv[k]).map(k => T.levers.names[k] + ' ' + (drv[k] > 0 ? '+' : '−') + Math.abs(drv[k]) + (k === 'dso' || k === 'dpo' ? ' ' + T.daysUnit : '%'))].join(', ').slice(0, 80) || T.dec.unnamed;
  const save = () => {
    const item = { id: Date.now().toString(36), name: (name || autoName()).slice(0, 80), d: drv, p: presets, scope };
    const next = [item, ...saved].slice(0, 8);
    setSaved(next);
    const all = load(); all[ind] = next;
    notify(store(all) ? T.dec.saved : T.dec.savedSession, 'save');
    setName('');
    track && track('decision_saved', { ind, levers: LEVERS.filter(k => drv[k]).length, presets: presets.length });
  };
  const remove = id => { const next = saved.filter(s => s.id !== id); setSaved(next); const all = load(); all[ind] = next; store(all); };
  const loadOne = s => { setPresets(s.p || []); setDrv(s.d || {}); if (s.scope && s.scope !== unit) ctx.setUnit(s.scope, true); };
  const share = () => {
    const url = location.href;
    const done = () => notify(T.dec.copied, 'link');
    try { navigator.clipboard.writeText(url).then(done, () => notify(url, 'link')); } catch { notify(url, 'link'); }
  };
  const savedRes = saved.map(s => {
    const acts = [...presetActions(ind, s.p || []), ...sliderActions(ind, s.scope || 'all', s.d || {})];
    const r = simulate(ind, i, acts);
    return { s, c: compare(r, base), risk: execRisk(acts, r, base), r };
  });
  const alts = [
    ...presetRes.map(p => ({ id: 'p:' + p.id, name: p.name, x: p.risk, y: p.c.ebitda, c: p.c, r: p.r, risk: p.risk, current: presets.length === 1 && presets[0] === p.id && !LEVERS.some(k => drv[k]), preset: p.id })),
    ...savedRes.map(x => ({ id: 's:' + x.s.id, name: x.s.name, x: x.risk, y: x.c.ebitda, c: x.c, r: x.r, risk: x.risk, saved: true, item: x.s,
      current: (x.s.scope || 'all') === scope && (x.s.p || []).join() === presets.join() && LEVERS.every(k => (x.s.d || {})[k] === drv[k]) })),
  ];
  if (any && !alts.some(a => a.current)) alts.push({ id: 'cur', name: T.dec.current, x: risk, y: c.ebitda, c, r: scen, risk, current: true });

  return (
    <>
      <section className="dec-sit glass">
        <div>
          <span className="sit-kicker">{T.dec.sitKicker}</span>
          <p className="dec-sit-text">{T.dec.sitText[ind](sit, f)}</p>
          <div className="dec-causes">
            <span className="muted small">{T.dec.causes}</span>
            {att.map(a => <button key={a.id} type="button" className="chip" onClick={() => (a.id === 'receivables' ? go('cash') : openCause(null, 'ytd'))}>{T.att.titles[a.id](ind, a.main ? unitName(a.main) : '')} · {f.signedMoney(a.impact)}</button>)}
          </div>
        </div>
      </section>

      <div className="scen-presets" data-tour="presets">
        <span className="muted small">{T.dec.ready}</span>
        {PRESETS[ind].map(p => (
          <button type="button" key={p.id} className={'chip' + (presets.includes(p.id) ? ' active' : '')} aria-pressed={presets.includes(p.id)} onClick={() => togglePreset(p.id)}>
            {presets.includes(p.id) && <Icon name="check" size={13} />}{T.presets[ind][p.id]}
          </button>
        ))}
        {any && <Button icon="reset" onClick={() => { setDrv({}); setPresets([]); }}>{T.scen.reset}</Button>}
      </div>

      <div className="grid grid-scen">
        <Panel title={T.dec.levers} sub={T.dec.leversSub(unit === 'all' ? T.allUnits : unitName(unit))} className="levers-panel">
          <div className="drivers" data-tour="levers">
            {LEVERS.map(k => {
              const [lo, hi, step] = LEVER_RANGE[k], v = drv[k] || 0;
              return (
                <label key={k} className="driver">
                  <span className="driver-head"><span>{T.levers.names[k]}</span><b className={v ? 'on' : ''}>{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(v)} {T.levers.units[k]}</b></span>
                  <input type="range" min={lo} max={hi} step={step} value={v} onChange={e => set(k, Number(e.target.value))} aria-label={T.levers.names[k]} />
                  <small className="muted">{T.levers.hint[k](ind)} {T.levers.timing(FIRST[k], FULL[k])}</small>
                </label>
              );
            })}
          </div>
        </Panel>
        <div className="stack">
          <div className="scen-out">
            <Out T={T} label={T.dec.out.ebitda} a={f.money(base.ebitda12)} b={f.money(scen.ebitda12)} d={c.ebitda} fmtD={f.signedMoney} />
            <Out T={T} label={T.dec.out.rev} a={f.money(base.rev12)} b={f.money(scen.rev12)} d={c.rev} fmtD={f.signedMoney} note={Math.abs(c.vol) >= 0.001 ? T.dec.vol(f.signedPct(c.vol)) : null} />
            <Out T={T} label={T.dec.out.minCash} a={f.money(base.minCash)} b={f.money(scen.minCash)} d={c.minCash} fmtD={f.signedMoney} level={scen.minCash < scen.threshold ? 'critical' : null} note={T.dec.below(firstBelow(scen), scen.monthsBelow)} />
            <Out T={T} label={T.dec.out.wf} a={f.int(base.wfEnd)} b={f.int(scen.wfEnd)} d={c.wf} fmtD={v => f.sign(v) + f.int(Math.abs(v))} good={-1} note={T.dec.wfNote} />
            <div className="scen-card glass">
              <span>{T.dec.out.risk}</span>
              <div className="scen-vals"><b>{f.int(risk)}</b><small>/ 100</small></div>
              <Status level={riskLevel(risk)} T={T} text={T.dec.riskLvl[riskLevel(risk)]} />
              <small className="muted">{any ? T.dec.timing(scen.first, scen.full) : T.dec.noAction}</small>
            </div>
          </div>
          <div className="grid grid-2 tight">
            <Panel title={T.dec.ebitdaTitle} sub={T.dec.ebitdaSub}>
              <ScenarioChart ticks={ticks} base={base.months.map(m => m.ebitda)} scen={scen.months.map(m => m.ebitda)} fmtAxis={f.axisMoney} label={T.dec.ebitdaTitle} names={{ base: T.dec.base, scen: T.dec.scen }} height={210}
                tip={k => <><b>{ticks[k]}</b><small>{T.dec.base}: {f.money(base.months[k].ebitda)}</small>{any && <small>{T.dec.scen}: {f.money(scen.months[k].ebitda)}</small>}</>} />
            </Panel>
            <Panel title={T.dec.cashTitle} sub={T.dec.cashSub(f.money(base.threshold))}>
              <ScenarioChart ticks={ticks} base={base.months.map(m => m.cash)} scen={scen.months.map(m => m.cash)} threshold={{ value: base.threshold, label: T.fan.threshold(f.money(base.threshold)) }} fmtAxis={f.axisMoney} label={T.dec.cashTitle} names={{ base: T.dec.base, scen: T.dec.scen }} height={210}
                tip={k => <><b>{ticks[k]}</b><small>{T.dec.base}: {f.money(base.months[k].cash)}</small>{any && <small>{T.dec.scen}: {f.money(scen.months[k].cash)}</small>}</>} />
            </Panel>
          </div>
        </div>
      </div>

      <div className="grid grid-main">
        <Panel title={T.dec.stepsTitle} sub={T.dec.stepsSub}>
          <Waterfall steps={steps} name={id => T.dec.stepNames[id]} fmt={f.money} fmtShort={v => f.dec1(v / 1000)} label={T.dec.stepsTitle} height={290} />
        </Panel>
        <Panel title={T.dec.tradeTitle} sub={T.dec.tradeSub}>
          {any ? (
            <ul className="trade-list">
              {presets.map(p => <li key={p}><b>{T.presets[ind][p]}.</b> {T.dec.presetTrade[ind][p]}</li>)}
              {isolated.map(x => <li key={x.k}><b>{T.levers.names[x.k]} {x.v > 0 ? '+' : '−'}{Math.abs(x.v)} {T.levers.units[x.k]}.</b> {T.dec.trade[x.k](x, f, ind, K)}</li>)}
              {scen.minCash < scen.threshold && <li className="warn"><Icon name="warning" size={14} /> {T.dec.cashWarn(firstBelow(scen))}</li>}
              {c.wf > 3 && <li className="warn"><Icon name="warning" size={14} /> {T.dec.wfWarn(f.int(c.wf))}</li>}
            </ul>
          ) : <p className="muted">{T.dec.tradeEmpty}</p>}
          <p className="muted small">{T.dec.modelNote}</p>
        </Panel>
      </div>

      <Panel title={T.dec.matrixTitle} sub={T.dec.matrixSub} className="matrix-panel">
        <ImpactScatter points={alts.map(a => ({ ...a, tip: <><b>{a.name}</b><small>{T.dec.out.ebitda}: {f.signedMoney(a.c.ebitda)}</small><small>{T.dec.out.minCash}: {f.signedMoney(a.c.minCash)}</small><small>{T.dec.out.risk}: {f.int(a.risk)}</small></> }))}
          fmtY={f.axisMoney} label={T.dec.matrixTitle} names={{ preset: T.dec.lgPreset, saved: T.dec.lgSaved, current: T.dec.lgCurrent, xAxis: T.dec.xAxis }} quad={T.dec.quad}
          onPick={a => (a.preset ? togglePreset(a.preset) : a.item ? loadOne(a.item) : null)} />
        <div className="table-scroll">
          <table className="data-table compact">
            <thead><tr><th>{T.dec.alt}</th><th className="num">{T.dec.out.ebitda}</th><th className="num">{T.dec.out.minCash}</th><th className="num">{T.dec.monthsBelowCol}</th><th className="num">{T.dec.out.wf}</th><th className="num">{T.dec.out.risk}</th><th className="num">{T.dec.fullCol}</th></tr></thead>
            <tbody>
              {alts.map(a => (
                <tr key={a.id} className={a.current ? 'picked' : ''} tabIndex="0" onClick={() => (a.preset ? togglePreset(a.preset) : a.item ? loadOne(a.item) : null)}
                  onKeyDown={e => { if (e.key === 'Enter') { if (a.preset) togglePreset(a.preset); else if (a.item) loadOne(a.item); } }}>
                  <td className="strong">{a.name}{a.saved && <span className="tag">{T.dec.lgSaved}</span>}</td>
                  <td className={'num ' + (a.c.ebitda >= 0 ? 'good' : 'over')}>{f.signedMoney(a.c.ebitda)}</td>
                  <td className={'num ' + (a.c.minCash >= 0 ? 'good' : 'over')}>{f.signedMoney(a.c.minCash)}</td>
                  <td className="num">{f.int(a.r.monthsBelow)}</td>
                  <td className={'num ' + (a.c.wf <= 0 ? 'good' : 'over')}>{f.sign(a.c.wf)}{f.int(Math.abs(a.c.wf))}</td>
                  <td className="num"><span className={'status ' + riskLevel(a.risk)}>{f.int(a.risk)}</span></td>
                  <td className="num">{f.int(a.r.full)} {T.head.monthsUnit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={T.dec.saveTitle} sub={T.dec.saveSub}>
        <div className="save-row">
          <input className="text-input" value={name} onChange={e => setName(e.target.value)} placeholder={any ? autoName() : T.dec.namePh} aria-label={T.dec.nameLabel} maxLength={80} />
          <Button kind="primary" icon="save" onClick={save} disabled={!any}>{T.dec.save}</Button>
          <Button icon="link" onClick={share}>{T.dec.share}</Button>
        </div>
        {saved.length > 0 && (
          <ul className="saved-list">
            {savedRes.map(x => (
              <li key={x.s.id}>
                <button type="button" className="saved-load" onClick={() => loadOne(x.s)}><Icon name="flask" size={14} /><span>{x.s.name}</span></button>
                <small className={x.c.ebitda >= 0 ? 'good' : 'over'}>{f.signedMoney(x.c.ebitda)}</small>
                <button type="button" className="icon-btn" onClick={() => remove(x.s.id)} aria-label={T.dec.remove}><Icon name="trash" size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">{T.dec.saveNote}</p>
      </Panel>
    </>
  );
}
