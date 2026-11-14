// «Спробуйте себе в ролі CEO»: короткий кейс із трьома проблемами виробничої компанії (маржа, дебіторка,
// плинність), приблизно три хвилини на рішення. Наприкінці: порівняння з базовим сценарієм, збалансована оцінка,
// найкраща комбінація в межах моделі і чесні компроміси кожного рішення.
import { useEffect, useMemo, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { TrendLine, C } from '../charts.jsx';
import { ScenarioChart } from '../charts2.jsx';
import { CEO, ceoActions, ceoBest, simulate, compare, scorecard, SCORE } from '../sim.js';
import { monthKey } from '../outlook.js';
import { causeTree, factorGroups } from '../causes.js';
import { clientAR } from '../cash.js';
import { dataFor, series, ytd, ytdLY, turnover, yearStart } from '../model.js';
import { range } from './controls.jsx';

const LIMIT = 180;

export default function Ceo({ ctx }) {
  const { T, f, i, ind, setInd, ceo, setCeo, openLead, go, track } = ctx;
  const D = dataFor('mfg');
  const { step, choices } = ceo;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (step < 1 || step > 3) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);
  const left = ceo.started ? Math.max(0, LIMIT - Math.round((now - ceo.started) / 1000)) : LIMIT;
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  const start = () => { setCeo({ step: 1, choices: [null, null, null], started: Date.now() }); track && track('ceo_start'); };
  const choose = (k, id) => { const c = [...choices]; c[k] = id; setCeo({ ...ceo, choices: c }); };
  const next = () => { const s = step + 1; setCeo({ ...ceo, step: s, finished: s === 4 ? Date.now() : ceo.finished }); if (s === 4) track && track('ceo_finish', { choices: choices.join(',') }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const back = () => setCeo({ ...ceo, step: Math.max(1, step - 1) });

  // факти для трьох проблем
  const y = ytd(D.units, i), ly = ytdLY(D.units, i);
  const tree = causeTree('mfg', yearStart(i), i);
  const groups = factorGroups(tree);
  const sumF = fs => groups.filter(g => fs.includes(g.factor)).reduce((s, g) => s + g.value, 0);
  const south = D.units.find(u => u.id === 'south');
  const A = clientAR('mfg', i).find(c => c.id === 'a'), A12 = clientAR('mfg', Math.max(0, i - 12)).find(c => c.id === 'a');
  const co = D.company[i], co12 = D.company[Math.max(0, i - 12)];
  const S = series(D.units, Math.max(0, i - 17), i);
  const ticks = S.map(r => f.tick(r.m));
  const evidence = [
    { facts: T.ceo.facts.margin(f, { m: y.margin, mLy: ly ? ly.margin : null, input: sumF(['input']), volume: sumF(['volume']), price: sumF(['price']) }), chart: { values: S.map(r => r.margin), fmt: v => f.pct(v, 1), name: T.kpi.margin, color: C.series.finance } },
    { facts: T.ceo.facts.receivables(f, { dso: co.dso, dso12: co12.dso, a: A.dso, a12: A12.dso, ar: co.ar, cash: co.cash }), chart: { values: D.company.slice(Math.max(0, i - 17), i + 1).map(c => c.dso), fmt: v => f.int(v) + ' ' + T.daysUnit, name: 'DSO', color: C.series.operations, ref: 60 } },
    { facts: T.ceo.facts.turnover(f, { t: turnover([south], i), tLy: turnover([south], Math.max(0, i - 12)), ot: south.rows[i].overtime, vac: south.rows[i].vacDays, def: south.rows[i].defect }), chart: { values: S.map(r => turnover([south], r.i)), fmt: v => f.pct(v, 1), name: T.ceo.southTurnover, color: C.series.health, ref: 0.2 } },
  ];

  const result = useMemo(() => {
    if (step !== 4 || choices.some(c => !c)) return null;
    const base = simulate('mfg', i, []), mine = simulate('mfg', i, ceoActions(choices));
    const cm = compare(mine, base), sc = scorecard(cm);
    const best = ceoBest(i), cb = compare(best.res, base);
    const each = choices.map((id, k) => { const o = CEO[k].options.find(x => x.id === id); return { id, c: compare(simulate('mfg', i, o.actions), base) }; });
    return { base, mine, cm, sc, best, cb, each };
  }, [step, choices.join(','), i]);

  const summary = () => result && T.ceo.leadMsg(choices.map((id, k) => T.ceo.problems[CEO[k].id].options[id].title), f.signedMoney(result.cm.ebitda), f.signedMoney(result.cm.minCash), Math.round(result.sc.total));

  return (
    <>
      {ind !== 'mfg' && <div className="note-strip glass"><Icon name="info" size={16} /><span>{T.ceo.mfgOnly}</span><Button onClick={() => setInd('mfg')}>{T.ceo.switch}</Button></div>}

      {step === 0 && (
        <section className="ceo-intro glass">
          <div className="ceo-intro-text">
            <span className="sit-kicker">{T.ceo.kicker}</span>
            <h2>{T.ceo.introTitle}</h2>
            <p>{T.ceo.introText(f.month(D.company[i].m, true), f.signedPct(ly ? y.rev / ly.rev - 1 : 0), f.signedPct(ly ? y.ebitda / ly.ebitda - 1 : 0), f.money(co.cash))}</p>
            <ol className="ceo-steps-list">{CEO.map(p => <li key={p.id}><b>{T.ceo.problems[p.id].title}</b><span>{T.ceo.problems[p.id].short}</span></li>)}</ol>
            <div className="ceo-cta"><Button kind="primary" icon="play" onClick={start}>{T.ceo.go}</Button><span className="muted small">{T.ceo.timeNote}</span></div>
          </div>
          <div className="ceo-badge" aria-hidden="true"><Icon name="target" size={64} /><span>3:00</span></div>
        </section>
      )}

      {step >= 1 && step <= 3 && (() => {
        const k = step - 1, P = CEO[k], tp = T.ceo.problems[P.id], ev = evidence[k];
        return (
          <section className="ceo-step">
            <div className="ceo-bar glass">
              <div className="ceo-progress">{[1, 2, 3].map(n => <i key={n} className={n < step ? 'done' : n === step ? 'on' : ''} />)}<span>{T.ceo.problemN(step)}</span></div>
              <span className={'ceo-timer' + (left === 0 ? ' out' : left < 30 ? ' low' : '')} role="timer" aria-live="off"><Icon name="clock" size={15} />{left ? mmss(left) : T.ceo.timeOut}</span>
            </div>
            <div className="grid grid-main">
              <Panel title={tp.title} sub={tp.question}>
                <div className="ceo-options" role="radiogroup" aria-label={tp.title}>
                  {P.options.map(o => (
                    <button type="button" key={o.id} role="radio" aria-checked={choices[k] === o.id} className={'ceo-opt' + (choices[k] === o.id ? ' on' : '')} onClick={() => choose(k, o.id)}>
                      <span className="ceo-radio" />
                      <span><strong>{tp.options[o.id].title}</strong><small>{tp.options[o.id].desc}</small></span>
                    </button>
                  ))}
                </div>
                <div className="ceo-nav">
                  {step > 1 && <Button icon="back" onClick={back}>{T.tour.back}</Button>}
                  <Button kind="primary" onClick={next} disabled={!choices[k]}>{step === 3 ? T.ceo.finish : T.tour.next}</Button>
                </div>
              </Panel>
              <Panel title={T.ceo.evidence} sub={tp.evidenceSub}>
                <ul className="ceo-facts">{ev.facts.map((x, n) => <li key={n}>{x}</li>)}</ul>
                <TrendLine values={ev.chart.values} ticks={ticks} domain={range(ev.chart.values, 0.2, ev.chart.ref != null ? 0 : undefined)} refLine={ev.chart.ref} fmt={ev.chart.fmt} name={ev.chart.name} color={ev.chart.color} height={150} />
                <button type="button" className="link-btn" onClick={() => go(tp.page)}>{tp.more}<Icon name="chevronRight" size={14} /></button>
              </Panel>
            </div>
          </section>
        );
      })()}

      {step === 4 && result && (
        <section className="ceo-result">
          <div className="ceo-score glass">
            <div className="ceo-total">
              <span>{T.ceo.score}</span>
              <b>{f.int(result.sc.total)}</b>
              <small>{T.ceo.scoreOf}</small>
            </div>
            <div className="ceo-dims">
              {Object.keys(SCORE).map(dk => (
                <div key={dk} className="ceo-dim">
                  <span>{T.ceo.dims[dk]} <small>{T.ceo.weight(SCORE[dk][0])}</small></span>
                  <div className="dim-track"><i className={result.sc.parts[dk] >= 0 ? 'pos' : 'neg'} style={{ width: Math.abs(result.sc.parts[dk]) * 50 + '%', [result.sc.parts[dk] >= 0 ? 'left' : 'right']: '50%' }} /></div>
                  <b className={result.sc.parts[dk] >= 0 ? 'good' : 'over'}>{T.ceo.dimVal[dk](result.cm, f)}</b>
                </div>
              ))}
            </div>
            <div className="ceo-best">
              <span>{T.ceo.bestTitle}</span>
              <p>{result.best.choices.map((id, k) => T.ceo.problems[CEO[k].id].options[id].title).join(' · ')}</p>
              <small>{T.ceo.bestScore(f.int(result.best.score), f.signedMoney(result.cb.ebitda), f.signedMoney(result.cb.minCash))}</small>
              {result.best.choices.join() === choices.join() && <em className="good">{T.ceo.youBest}</em>}
            </div>
          </div>

          <div className="grid grid-main">
            <Panel title={T.ceo.cashTitle} sub={T.ceo.cashSub(f.money(result.base.threshold))}>
              <ScenarioChart ticks={result.base.months.map(m => f.tick(monthKey(m.t)))} base={result.base.months.map(m => m.cash)} scen={result.mine.months.map(m => m.cash)}
                threshold={{ value: result.base.threshold, label: T.fan.threshold(f.money(result.base.threshold)) }} fmtAxis={f.axisMoney} label={T.ceo.cashTitle} names={{ base: T.dec.base, scen: T.ceo.yours }} height={230}
                tip={k => <><b>{f.month(monthKey(result.base.months[k].t), true)}</b><small>{T.dec.base}: {f.money(result.base.months[k].cash)}</small><small>{T.ceo.yours}: {f.money(result.mine.months[k].cash)}</small></>} />
            </Panel>
            <Panel title={T.ceo.tradeTitle} sub={T.ceo.tradeSub}>
              <ol className="ceo-trades">
                {result.each.map((x, k) => {
                  const tp = T.ceo.problems[CEO[k].id];
                  return (
                    <li key={k}>
                      <strong>{tp.title}: {tp.options[x.id].title}</strong>
                      <span className="ceo-eff">{T.ceo.eff(x.c, f)}</span>
                      <p>{tp.options[x.id].trade}</p>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </div>

          <section className="ceo-final glass">
            <div>
              <h3>{T.ceo.finalTitle}</h3>
              <p>{T.ceo.finalText}</p>
            </div>
            <div className="ceo-final-actions">
              <a className="btn btn-primary" href={ctx.maturityHref} onClick={() => track && track('ceo_maturity')}><Icon name="arrowRight" size={16} /><span>{T.ceo.ctaMaturity}</span></a>
              <Button icon="mail" onClick={() => openLead('ceo-system', { message: summary() })}>{T.ceo.ctaSystem}</Button>
              <Button icon="reset" onClick={start}>{T.ceo.again}</Button>
              <Button icon="flask" onClick={() => go('scenarios')}>{T.ceo.toSim}</Button>
            </div>
          </section>
        </section>
      )}
    </>
  );
}
