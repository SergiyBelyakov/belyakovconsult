// Корпус автомата: табло з лампочками, скло з таблицею виплат, вікно барабанів (canvas), індикатори,
// кнопки, лоток із касою і важіль. Усе, крім барабанів, звичайна розмітка: кнопки справжні, текст чіткий.
import { useState } from 'react';
import { Led } from './Led.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';
import { MACHINES, MACHINE_IDS } from './engine.js';

const SYM_OF = { C: 0, P: 1, T: 2 };
const BULBS = 13;

export function ComboIcons({ k, icons, size = 22 }) {
  return <span className="jc-combo" aria-hidden="true">{Array.from(k, (ch, i) => <img key={i} src={icons[SYM_OF[ch]]} width={size} height={size} alt="" />)}</span>;
}

export default function Cabinet({ T, shown, icons, busy, auto, fx, canvasRef, windowRef, line, onSpin, onAuto, onBet, onRefill, onMachine, showSwitch, betLocked, broke, assetBase, F }) {
  const [pull, setPull] = useState(false);
  const M = MACHINES[shown.machine], C = T.cab;
  const lever = () => { if (busy && !auto) return; setPull(true); setTimeout(() => setPull(false), 520); onSpin(); };
  const row = r => <li key={r.key} title={T.combo[r.key]}><ComboIcons k={r.key} icons={icons} /><b>×{r.pay}</b><span className="sr-only">{T.combo[r.key]}</span></li>;
  const bulbs = <div className="jc-bulbs" aria-hidden="true">{Array.from({ length: BULBS }, (_, k) => <i key={k} style={{ animationDelay: `${(k % 4) * 0.18}s` }} />)}</div>;
  return (
    <div className={'jc-cab fx-' + (fx || 'idle') + (busy ? ' spinning' : '')}>
      <div className="jc-body">
        <div className="jc-top">
          {bulbs}
          <div className="jc-marquee"><span className="jc-name">{C.name}</span><span className="jc-plate">{T.machines[shown.machine].name} · {T.machines[shown.machine].plate}</span></div>
          {bulbs}
        </div>

        <div className="jc-award" aria-label={C.payTitle}>
          <div className="jc-award-head"><span>{C.payTitle}</span><span>{C.payNote}</span></div>
          <div className="jc-award-cols">
            <ul>
              {M.stats.rows.filter(r => r.key.length === 3).map(row)}
              <li className="zero" title={T.math.fake}><span className="jc-combo" aria-hidden="true">{[3, 4, 5].map(s => <img key={s} src={icons[s]} width="22" height="22" alt="" />)}</span><b>0</b><span className="sr-only">{T.math.fake}</span></li>
            </ul>
            <ul>
              {M.stats.rows.filter(r => r.key.length < 3).map(row)}
              <li className="burn" title={T.math.audit}><span className="jc-combo" aria-hidden="true">{[0, 1, 2].map(s => <img key={s} src={icons[6]} width="22" height="22" alt="" />)}</span><b>{C.payAll}</b><span className="sr-only">{T.math.audit}</span></li>
            </ul>
          </div>
        </div>

        {showSwitch && (
          <div className="jc-switch" role="radiogroup" aria-label={C.machine}>
            {MACHINE_IDS.map(id => <button key={id} type="button" role="radio" aria-checked={shown.machine === id} className={shown.machine === id ? 'on' : ''} disabled={busy} onClick={() => onMachine(id)}><img src={icons[id === 'cat' ? 0 : 1]} width="20" height="20" alt="" /><span>{T.machines[id].name}</span></button>)}
          </div>
        )}

        <div className="jc-windowrow">
          <span className="jc-arrow" aria-hidden="true" />
          <div className="jc-window">
            <div className="jc-window-in" ref={windowRef}>
              <canvas ref={canvasRef} role="img" aria-label={C.window} />
              <span className="jc-glass" aria-hidden="true" />
            </div>
          </div>
          <span className="jc-arrow r" aria-hidden="true" />
        </div>
        <p className="sr-only" aria-live="polite">{line}</p>

        <div className="jc-leds">
          <div className="jc-ledbox"><Led value={shown.credits} digits={4} label={C.credits} /><span aria-hidden="true">{C.credits}</span></div>
          <div className="jc-ledbox narrow"><Led value={shown.bet} digits={2} label={C.bet} /><span aria-hidden="true">{C.bet}</span></div>
          <div className="jc-ledbox"><Led value={shown.win} digits={4} text={shown.ledText} blink={!!shown.ledText || fx === 'win' || fx === 'big' || fx === 'jackpot'} label={C.win} /><span aria-hidden="true">{C.win}</span></div>
        </div>

        <div className="jc-deck">
          <button type="button" className="jc-key" onClick={onBet} disabled={busy || betLocked} title={betLocked ? C.betLocked : undefined}>{C.betBtn}</button>
          <button type="button" className={'jc-key' + (auto ? ' lit' : '')} onClick={onAuto} disabled={broke || (busy && !auto)} aria-pressed={!!auto}>{auto ? C.stop : C.auto}</button>
          {broke
            ? <button type="button" className="jc-key jc-spin" onClick={onRefill}>{C.refill}</button>
            : <button type="button" className="jc-key jc-spin" onClick={onSpin} disabled={busy}>{C.spin}</button>}
        </div>

        <div className="jc-tray">
          <img src={assetBase + 'img/bc-negative.png'} alt="Belyakov Consult" width="59" height="30" />
          <div className="jc-take" title={T.journal.takeHint}><span>{C.take}</span><Led value={shown.take} text={shown.take < 0 ? '-' + Math.abs(shown.take) : null} digits={5} small label={C.take} /></div>
        </div>
      </div>

      <button type="button" className={'jc-lever' + (pull ? ' pull' : '')} onClick={lever} disabled={broke || (busy && !auto)} aria-label={C.lever} title={C.lever}>
        <span className="jc-slot" /><span className="jc-arm"><span className="jc-knob" /></span>
      </button>
    </div>
  );
}

// Вкладка «Математика»: таблиця виплат із шансами і внеском у повернення, стрічки барабанів
export function MathPanel({ T, machine, icons, F }) {
  const M = MACHINES[machine], S = M.stats, max = Math.max(...S.rows.map(r => r.contrib));
  const odds = p => T.math.odds(Math.round(1 / p));
  return (
    <div className="jc-math">
      <h3>{T.math.title(T.machines[machine].name)}</h3>
      <div className="jc-table" role="table">
        <div className="jc-tr head" role="row"><span role="columnheader">{T.math.col.combo}</span><span role="columnheader">{T.math.col.pay}</span><span role="columnheader">{T.math.col.odds}</span><span role="columnheader">{T.math.col.contrib}</span></div>
        {S.rows.map(r => (
          <div key={r.key} className="jc-tr" role="row">
            <span role="cell" className="jc-td-combo"><ComboIcons k={r.key} icons={icons} size={20} /><em>{T.combo[r.key]}</em></span>
            <span role="cell">×{r.pay}</span><span role="cell">{odds(r.p)}</span>
            <span role="cell" className="jc-td-bar"><i style={{ width: `${(r.contrib / max) * 100}%` }} /><b>{F.n(r.contrib * 100, 1)}</b></span>
          </div>
        ))}
        <div className="jc-tr quiet" role="row"><span role="cell" className="jc-td-combo"><em>{T.math.none}</em></span><span role="cell">0</span><span role="cell">{F.pct(S.pNone * 100, 1)}</span><span role="cell" /></div>
        <div className="jc-tr quiet" role="row"><span role="cell" className="jc-td-combo"><em>{T.math.fake}</em></span><span role="cell">0</span><span role="cell">{odds(S.pFake)}</span><span role="cell" /></div>
        <div className="jc-tr quiet burn" role="row"><span role="cell" className="jc-td-combo"><em>{T.math.audit}</em></span><span role="cell" /><span role="cell">{odds(S.pAudit)}</span><span role="cell" /></div>
        <div className="jc-tr total" role="row"><span role="cell">{T.math.total}</span><span role="cell" /><span role="cell" /><span role="cell"><b>{F.n(S.rtp * 100, 1)}</b></span></div>
        <div className="jc-tr total edge" role="row"><span role="cell">{T.math.edge}</span><span role="cell" /><span role="cell" /><span role="cell"><b>{F.n(S.edge * 100, 1)}</b></span></div>
      </div>
      <h4>{T.math.strips}</h4>
      <p className="muted">{T.math.stripsText}</p>
      <div className="jc-strips">
        {M.strips.map((st, r) => (
          <div key={r} className="jc-strip"><span>{T.math.reel(r + 1)}</span><div>{st.map((s, i) => <img key={i} src={icons[s]} width="24" height="24" alt={T.sym[s]} title={T.sym[s]} />)}</div></div>
        ))}
      </div>
    </div>
  );
}
