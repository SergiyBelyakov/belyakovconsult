// Ігрове поле: canvas з рушієм, накладки (старт, бриф рівня, розбір, пауза, кінець), кнопки дій для дотику.
import { useEffect, useRef, useState } from 'react';
import { Game } from './game.js';
import { correct } from './records.js';
import { setSound, sfx } from './audio.js';
import { Icon } from '../../dashboard/src/icons.jsx';

const csvCell = v => (v == null ? '' : /[",\n;]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
function saveCsv(name, rows) {
  const url = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const KIND = { ok: 'ok', fix: 'fixable', err: 'error', dup: 'duplicate' };

function Stars({ n }) { return <span className="lk-stars" aria-label={n + '/3'}>{[0, 1, 2].map(k => <i key={k} className={k < n ? 'on' : ''}>★</i>)}</span>; }

function Recap({ T, s, onNext, nextLabel, onRetry, onCsv, children }) {
  const U = T.ui, pct = v => Math.round(v * 100) + '%';
  return (
    <div className="lk-recap">
      <div className="lk-recap-head">
        <h3>{s.quality >= 0.7 ? U.passed(s.lv) : U.failed(s.lv)}</h3>
        <Stars n={s.stars} />
      </div>
      {s.quality < 0.7 && <p className="lk-warn">{U.failedHint}</p>}
      <div className="lk-kpis">
        <div><span>{U.quality}</span><b>{pct(s.quality)}</b></div>
        <div><span>{U.score}</span><b>{s.levelScore}</b></div>
        <div><span>{U.bestCombo}</span><b>{s.best}</b></div>
      </div>
      <div className="lk-skills">
        {Object.entries(s.skills).filter(([, [, tot]]) => tot > 0).map(([k, [ok, tot]]) => (
          <div key={k} className="lk-skill"><span>{U.skills[k]}</span><span className="lk-bar"><i style={{ width: `${(ok / tot) * 100}%` }} /></span><b>{ok} {U.of} {tot}</b></div>
        ))}
        {s.lv === 5 && <p className="muted small">{U.source(s.source.cleaned)}</p>}
      </div>
      <h4>{U.mistakes}</h4>
      {s.mistakes.length ? (
        <ul className="lk-mistakes">
          {s.mistakes.slice(0, 5).map((m, k) => (
            <li key={k}>
              <strong>{m.title}</strong>
              <span className="lk-rec mono">{m.rec.name} · {T.fields[m.rec.field]} {m.rec.value}</span>
              <span className="muted">{U.you}: {U.act[m.action]}. {U.right}: {U.rightAct[correct(m.rec)]}. {m.why}</span>
            </li>
          ))}
        </ul>
      ) : <p className="lk-clean">{U.none}</p>}
      <div className="lk-tip"><Icon name="info" size={16} /><div><strong>{U.tip}</strong><p>{T.levels[s.lv - 1].tip}</p></div></div>
      <div className="lk-actions">
        {onNext && <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>{nextLabel}</button>}
        <button type="button" className="btn btn-ghost" onClick={onRetry}>{U.retry}</button>
        <button type="button" className="btn btn-ghost" onClick={onCsv}><Icon name="download" size={16} /><span>{U.csv}</span></button>
        {children}
      </div>
    </div>
  );
}

export default function GameView({ T, lang, onLead }) {
  const U = T.ui;
  const wrap = useRef(null), cv = useRef(null), G = useRef(null), phaseRef = useRef('title'), seedRef = useRef(0);
  const [phase, setPhaseState] = useState('title');
  const [lv, setLv] = useState(1);
  const [mode, setMode] = useState('normal');
  const [sound, setSnd] = useState(false);
  const [sum, setSum] = useState(null);
  const [hist, setHist] = useState({});
  const [msg, setMsg] = useState(null);
  const [mega, setMega] = useState(false);
  const setPhase = p => { phaseRef.current = p; setPhaseState(p); };

  useEffect(() => {
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const g = new Game({ lang, T, reduced, emit: e => {
      if (e.type === 'msg') setMsg({ ...e, k: Date.now() });
      else if (e.type === 'hud') setMega(!!e.game.megaReady);
      else if (e.type === 'levelEnd') { setSum(e.summary); setHist(h => ({ ...h, [e.summary.lv]: e.summary })); setPhase('end'); }
      else if (e.type === 'gameover') { setSum(e.summary); setPhase('over'); }
    } });
    G.current = g;
    if (/lkdebug/.test(location.search)) window.__lk = g;   // лише для автоматичних перевірок
    const canvas = cv.current, ctx = canvas.getContext('2d');
    const fit = () => {
      const W = Math.max(300, Math.round(wrap.current.getBoundingClientRect().width)), H = Math.max(440, Math.min(620, Math.round(W * 0.64)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      g.layout(W, H);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap.current);
    let raf, last = performance.now();
    const loop = now => {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      if (phaseRef.current === 'play' || phaseRef.current === 'title' || phaseRef.current === 'brief') g.update(phaseRef.current === 'play' ? dt : dt * 0.3);
      g.draw(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const vis = () => { if (document.hidden && phaseRef.current === 'play') setPhase('paused'); };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // клавіатура: лише під час гри і не тоді, коли фокус у полі форми чи на кнопці
  useEffect(() => {
    const skip = e => /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName) || document.body.classList.contains('modal-open');
    const down = e => {
      const g = G.current, k = e.key.toLowerCase();
      if (phaseRef.current === 'paused' && (k === 'p' || k === 'escape')) { e.preventDefault(); setPhase('play'); return; }
      if (phaseRef.current !== 'play' || skip(e)) return;
      if (k === 'arrowleft' || k === 'a') { g.keys.left = true; g.target = null; e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { g.keys.right = true; g.target = null; e.preventDefault(); }
      else if (k === ' ' || k === 'z') { e.preventDefault(); g.fire('laser'); }
      else if (k === 'x') g.fire('fix');
      else if (k === 'c') g.fire('merge');
      else if (k === 'v') g.fire('mega');
      else if (k === 'p' || k === 'escape') { e.preventDefault(); setPhase('paused'); }
      else if (k === 'arrowup' || k === 'arrowdown') e.preventDefault();
    };
    const up = e => { const g = G.current, k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') g.keys.left = false; if (k === 'arrowright' || k === 'd') g.keys.right = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const point = e => { if (phaseRef.current !== 'play') return; const r = cv.current.getBoundingClientRect(); G.current.target = e.clientX - r.left; };
  const fire = type => { if (phaseRef.current === 'play') G.current.fire(type); };
  const brief = n => { setLv(n); setMsg(null); setPhase('brief'); };
  const start = () => { const g = G.current; g.mode = mode; g.lives = 3; g.startLevel(lv, seedRef.current); setPhase('play'); wrap.current.focus({ preventScroll: true }); };
  const retry = () => { seedRef.current++; const g = G.current; if (sum) g.score = sum.score - sum.levelScore; brief(sum ? sum.lv : lv); };
  const next = () => { if (sum.lv >= 5) setPhase('final'); else brief(sum.lv + 1); };
  const restart = () => { const g = G.current; g.score = 0; g.best = 0; g.combo = 0; seedRef.current++; setHist({}); brief(1); };
  const toggleSound = () => { const v = !sound; setSnd(v); setSound(v); if (v) sfx.good(); };
  const csv = () => {
    const s = sum, rows = [['name', 'field', 'value', 'type', 'issue', 'correct_action', 'your_action', 'explanation']];
    s.log.forEach(({ rec, act }) => rows.push([rec.name, rec.field, rec.value, KIND[rec.kind] || rec.kind, rec.issue, U.rightAct[correct(rec)], U.act[act] || act, T.explain[rec.issue] || '']));
    saveCsv(`laser_kitty_level_${s.lv}.csv`, rows);
  };
  const totals = () => {
    const all = Object.values(hist), sk = { fix: [0, 0], del: [0, 0], merge: [0, 0], keep: [0, 0] };
    all.forEach(s => Object.entries(s.skills).forEach(([k, [a, b]]) => { sk[k][0] += a; sk[k][1] += b; }));
    return { sk, q: all.length ? all.reduce((s, x) => s + x.quality, 0) / all.length : 0, score: G.current ? G.current.score : 0, best: G.current ? G.current.best : 0 };
  };

  return (
    <div className="lk-game">
      <div className={'lk-stage' + (phase === 'play' ? ' playing' : '')} ref={wrap} tabIndex="-1" aria-label={T.title}>
        <canvas ref={cv} onPointerMove={point} onPointerDown={e => { point(e); if (e.pointerType !== 'mouse') e.preventDefault(); }} role="img" aria-label={T.title} />
        {phase === 'title' && (
          <div className="lk-over lk-title">
            <span className="lk-pixel">{T.title}</span>
            <p>{T.tagline}</p>
            <label className="lk-check"><input type="checkbox" checked={mode === 'calm'} onChange={e => setMode(e.target.checked ? 'calm' : 'normal')} /><span>{U.calm}<small> · {U.calmHint}</small></span></label>
            <div className="lk-actions center">
              <button type="button" className="btn btn-primary lk-big" onClick={() => brief(1)} autoFocus><Icon name="play" size={18} /><span>{U.play}</span></button>
              <button type="button" className="btn btn-ghost" onClick={toggleSound} aria-pressed={sound}><span>{U.sound}: {sound ? U.on : U.off}</span></button>
            </div>
            <p className="lk-keys">{U.controls}</p>
            <p className="lk-keys touch">{U.touch}</p>
          </div>
        )}
        {phase === 'brief' && (
          <div className="lk-over lk-brief">
            <span className="lk-level">{U.brief(lv)}</span>
            <h3>{T.levels[lv - 1].title}</h3>
            <p>{T.levels[lv - 1].text}</p>
            <ul className="lk-ex">{T.levels[lv - 1].ex.map(([a, b], k) => <li key={k}><code>{a}</code><Icon name="arrowRight" size={14} /><span>{b}</span></li>)}</ul>
            <div className="lk-actions center"><button type="button" className="btn btn-primary lk-big" onClick={start} autoFocus><span>{U.start}</span></button></div>
          </div>
        )}
        {phase === 'paused' && (
          <div className="lk-over lk-small">
            <span className="lk-pixel">{U.paused}</span>
            <div className="lk-actions center">
              <button type="button" className="btn btn-primary" onClick={() => setPhase('play')} autoFocus>{U.resume}</button>
              <button type="button" className="btn btn-ghost" onClick={restart}>{U.restart}</button>
            </div>
          </div>
        )}
        {phase === 'end' && sum && <div className="lk-over lk-scroll"><Recap T={T} s={sum} onNext={sum.quality >= 0.7 || sum.lv < 5 ? next : null} nextLabel={U.next} onRetry={retry} onCsv={csv} /></div>}
        {phase === 'over' && sum && (
          <div className="lk-over lk-scroll">
            <span className="lk-pixel">{U.gameover}</span>
            <p>{U.gameoverText}</p>
            <Recap T={T} s={sum} onRetry={retry} onCsv={csv}><button type="button" className="btn btn-ghost" onClick={restart}>{U.fromStart}</button></Recap>
          </div>
        )}
        {phase === 'final' && (() => { const t = totals(); return (
          <div className="lk-over lk-scroll lk-final">
            <span className="lk-pixel">{U.final}</span>
            <p>{U.finalText}</p>
            <div className="lk-kpis"><div><span>{U.score}</span><b>{t.score}</b></div><div><span>{U.quality}</span><b>{Math.round(t.q * 100)}%</b></div><div><span>{U.bestCombo}</span><b>{t.best}</b></div></div>
            <div className="lk-skills">{Object.entries(t.sk).map(([k, [a, b]]) => b > 0 && <div key={k} className="lk-skill"><span>{U.skills[k]}</span><span className="lk-bar"><i style={{ width: `${(a / b) * 100}%` }} /></span><b>{a} {U.of} {b}</b></div>)}</div>
            <div className="lk-actions center">
              <button type="button" className="btn btn-primary" onClick={() => onLead('final')}><Icon name="mail" size={16} /><span>{U.audit}</span></button>
              <button type="button" className="btn btn-ghost" onClick={restart} autoFocus>{U.again}</button>
            </div>
          </div>
        ); })()}
      </div>
      <div className="lk-controls">
        {['laser', 'fix', 'merge'].map(k => (
          <button key={k} type="button" className={'lk-btn b-' + k} disabled={phase !== 'play'} onClick={() => fire(k)}>
            <i aria-hidden="true" /><span>{U.btn[k]}</span><kbd>{U.keys[k]}</kbd>
          </button>
        ))}
        {mega && phase === 'play' && <button type="button" className="lk-btn b-mega" onClick={() => fire('mega')}><i aria-hidden="true" /><span>{U.btn.mega}</span><kbd>V</kbd></button>}
        <span className="lk-spacer" />
        <button type="button" className="icon-btn" onClick={() => setPhase(phase === 'paused' ? 'play' : 'paused')} disabled={phase !== 'play' && phase !== 'paused'} aria-label={U.pause} title={U.pause}><Icon name={phase === 'paused' ? 'play' : 'pause'} size={18} /></button>
        <button type="button" className={'icon-btn lk-sound' + (sound ? ' on' : '')} onClick={toggleSound} aria-pressed={sound} aria-label={U.sound} title={U.sound}><Icon name="sound" size={18} /></button>
      </div>
      <div className={'lk-msg' + (msg ? ' t-' + msg.tone : '')} role="status" aria-live="polite">
        {msg ? <><strong>{msg.title}</strong>{msg.text && <span>{msg.text}</span>}</> : <><span className="muted lk-keys-inline">{U.controls}</span><span className="muted lk-touch-inline">{U.touch}</span></>}
      </div>
    </div>
  );
}
