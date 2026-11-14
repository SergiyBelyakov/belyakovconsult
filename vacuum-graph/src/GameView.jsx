// Ігрове поле: canvas з рушієм, накладки (старт, бриф рівня, розбір, пауза, кінець), кнопки дій і свайпи для дотику.
import { useEffect, useRef, useState } from 'react';
import { Game } from './game.js';
import { setSound, sfx } from './audio.js';
import { track } from './track.js';
import { Icon } from '../../dashboard/src/icons.jsx';

const csvCell = v => (v == null ? '' : /[",\n;]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
function saveCsv(name, rows) {
  const url = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const KEYS = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
const SKILLS = ['orphans', 'legit', 'dups', 'namesakes', 'fakes', 'reals', 'bridges', 'seal'];

function Stars({ n }) { return <span className="vg-stars" aria-label={n + '/3'}>{[0, 1, 2].map(k => <i key={k} className={k < n ? 'on' : ''}>★</i>)}</span>; }

function Skills({ U, sk }) {
  return (
    <div className="vg-skills">
      {SKILLS.filter(k => sk[k] && sk[k][1] > 0).map(k => { const [ok, tot] = sk[k]; return (
        <div key={k} className="vg-skill"><span>{U.skills[k]}</span><span className="vg-bar"><i style={{ width: `${(ok / tot) * 100}%` }} /></span><b>{ok} {U.of} {tot}</b></div>
      ); })}
    </div>
  );
}

function Recap({ T, s, onNext, nextLabel, onRetry, onCsv, children }) {
  const U = T.ui, pct = v => Math.round(v * 100) + '%', mm = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  return (
    <div className="vg-recap">
      <div className="vg-recap-head">
        <h3>{s.quality >= 0.7 ? U.passed(s.lv) : U.failed(s.lv)}</h3>
        <Stars n={s.stars} />
      </div>
      {s.broke && <p className="vg-warn bad"><strong>{U.broke(s.parts)}.</strong> {U.brokeHint}</p>}
      {s.quality < 0.7 && !s.broke && <p className="vg-warn">{U.failedHint}</p>}
      <div className="vg-kpis">
        <div><span>{U.quality}</span><b>{pct(s.quality)}</b></div>
        <div><span>{U.score}</span><b>{s.levelScore}</b></div>
        <div><span>{U.bestCombo}</span><b>{s.best}</b></div>
        <div><span>{U.time}</span><b>{mm(s.time)}</b></div>
      </div>
      <Skills U={U} sk={s.skills} />
      <h4>{U.mistakes}</h4>
      {s.mistakes.length ? (
        <ul className="vg-mistakes">
          {s.mistakes.slice(0, 5).map(m => (
            <li key={m.key} className={m.credit === 0.5 ? 'half' : m.you === 'missed' ? 'miss' : ''}>
              <strong>{T.item[m.type]}</strong>
              <span className="vg-rec mono">{m.label}{m.attr ? ' · ' + m.attr : ''}</span>
              <span className="muted">{U.you}: {U.act[m.you] || m.you}. {U.right}: {U.rightAct[m.correct]}. {m.why}</span>
            </li>
          ))}
        </ul>
      ) : <p className="vg-clean">{U.none}</p>}
      <div className="vg-tip"><Icon name="info" size={16} /><div><strong>{U.tip}</strong><p>{T.levels[s.lv - 1].tip}</p></div></div>
      <div className="vg-actions">
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
  const wrap = useRef(null), cv = useRef(null), G = useRef(null), phaseRef = useRef('title'), seedRef = useRef(0), touch = useRef(null);
  const [phase, setPhaseState] = useState('title');
  const [lv, setLv] = useState(1);
  const [mode, setMode] = useState('normal');
  const [sound, setSnd] = useState(false);
  const [sum, setSum] = useState(null);
  const [hist, setHist] = useState({});
  const [msg, setMsg] = useState(null);
  const [hud, setHud] = useState({});
  const setPhase = p => { phaseRef.current = p; setPhaseState(p); };

  useEffect(() => {
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const g = new Game({ lang, T, reduced, emit: e => {
      if (e.type === 'msg') setMsg({ ...e, k: Date.now() });
      else if (e.type === 'hud') setHud(e.hud);
      else if (e.type === 'levelEnd') {
        const s = e.summary;
        setSum(s); setHist(h => ({ ...h, [s.lv]: s })); setPhase('end');
        track('level_finish', { lv: s.lv, quality: Math.round(s.quality * 100), stars: s.stars, broke: s.broke, mode: s.mode });
      } else if (e.type === 'gameover') { setSum(e.summary); setPhase('over'); track('level_finish', { lv: e.summary.lv, quality: Math.round(e.summary.quality * 100), stars: 0, broke: e.summary.broke, mode: e.summary.mode, over: true }); }
    } });
    G.current = g;
    if (/vgdebug/.test(location.search)) window.__vg = g;   // лише для автоматичних перевірок
    const canvas = cv.current, ctx = canvas.getContext('2d');
    const fit = () => {
      const W = Math.max(300, Math.round(wrap.current.getBoundingClientRect().width));
      // на вузьких екранах граф повернуто (4 колонки × 7 рядів), тож полю потрібно більше висоти
      const H = Math.max(440, Math.min(620, Math.round(W < 760 ? W * 1.5 : W * 0.64)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      g.layout(W, H, dpr);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap.current);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { g.labelsDirty = true; });
    let raf, last = performance.now();
    const loop = now => {
      const dt = Math.max(0, Math.min(1 / 30, (now - last) / 1000)); last = now;
      if (phaseRef.current === 'play' || phaseRef.current === 'title' || phaseRef.current === 'brief') g.update(phaseRef.current === 'play' ? dt : dt * 0.6);
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
    const skip = e => /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) || document.body.classList.contains('modal-open');
    const down = e => {
      const g = G.current, k = e.key.toLowerCase();
      if (phaseRef.current === 'paused' && (k === 'p' || k === 'escape')) { e.preventDefault(); setPhase('play'); return; }
      if (phaseRef.current !== 'play' || skip(e)) return;
      if (KEYS[k]) { e.preventDefault(); g.setWant(...KEYS[k]); }
      else if (k === ' ' || k === 'spacebar') { e.preventDefault(); g.act('suck'); }
      else if (k === 'x') g.act('cut');
      else if (k === 'c') g.act('scan');
      else if (k === 'v') g.act('seal');
      else if (k === 'p' || k === 'escape') { e.preventDefault(); setPhase('paused'); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  // миша показує запис під курсором; свайп повертає пилосос, дотик чи клік по вузлу веде до нього
  const local = e => { const r = cv.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = e => {
    const g = G.current, p = local(e);
    if (e.pointerType === 'mouse') g.hover = p;
    const t = touch.current;
    if (!t || phaseRef.current !== 'play') return;
    const dx = p.x - t.x, dy = p.y - t.y;
    if (Math.hypot(dx, dy) > 18) { g.setWant(dx, dy); t.x = p.x; t.y = p.y; t.swiped = true; }
  };
  const onDown = e => {
    if (phaseRef.current !== 'play') return;
    if (e.pointerType !== 'mouse') e.preventDefault();
    const p = local(e); touch.current = { ...p, x0: p.x, y0: p.y, t: performance.now(), swiped: false };
    try { cv.current.setPointerCapture(e.pointerId); } catch { /* немає захоплення */ }
  };
  const onUp = e => {
    const t = touch.current; touch.current = null;
    if (!t || t.swiped || phaseRef.current !== 'play' || performance.now() - t.t > 600) return;
    const g = G.current, p = local(e);
    let best = null, bd = Math.max(26, g.unit * 0.42);
    for (const id in g.N) { const n = g.N[id]; if (n.slot && !n.used) continue; const q = g.ns(id), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = id; } }
    if (best) g.goTo(best);
    wrap.current.focus({ preventScroll: true });
  };
  const fire = (type, e) => { if (phaseRef.current === 'play') G.current.act(type); if (e && e.currentTarget) e.currentTarget.blur(); wrap.current.focus({ preventScroll: true }); };
  const brief = n => { setLv(n); setMsg(null); setPhase('brief'); };
  // На старті рівня поле має бути на екрані цілком: інакше низ лабіринту й кнопки дій ховаються під згином.
  const fitView = () => {
    const box = wrap.current && wrap.current.parentElement;
    if (!box) return;
    const r = box.getBoundingClientRect(), vh = window.innerHeight;
    if (r.top >= 0 && r.bottom <= vh) return;
    const smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const dy = r.height + 16 <= vh ? r.top - (vh - r.height) / 2 : wrap.current.getBoundingClientRect().top - 8;
    window.scrollBy({ top: dy, behavior: smooth ? 'smooth' : 'auto' });
  };
  const start = () => {
    const g = G.current; g.mode = mode; g.startLevel(lv, seedRef.current); setPhase('play'); wrap.current.focus({ preventScroll: true });
    requestAnimationFrame(fitView);
    track('level_start', { lv, mode });
  };
  const retry = () => { seedRef.current++; const g = G.current; if (sum) g.score = sum.score - sum.levelScore; brief(sum ? sum.lv : lv); };
  const next = () => {
    if (sum.lv >= 5) { setPhase('final'); const t = totals(); track('game_finish', { score: t.score, quality: Math.round(t.q * 100), mode }); }
    else brief(sum.lv + 1);
  };
  const restart = () => { const g = G.current; g.score = 0; g.best = 0; g.combo = 0; seedRef.current++; setHist({}); brief(1); };
  const toggleSound = () => { const v = !sound; setSnd(v); setSound(v); if (v) sfx.good(); };
  const csv = () => {
    const s = sum, rows = [['level', 'item', 'record_or_link', 'key_or_basis', 'correct_action', 'your_action', 'credit', 'explanation']];
    s.log.forEach(m => rows.push([s.lv, T.item[m.type], m.label, m.attr, U.rightAct[m.correct], U.act[m.you] || m.you, m.credit, m.why]));
    saveCsv(`vacuum_graph_level_${s.lv}.csv`, rows);
  };
  const totals = () => {
    const all = Object.values(hist), sk = {};
    all.forEach(s => Object.entries(s.skills).forEach(([k, [a, b]]) => { sk[k] = sk[k] || [0, 0]; sk[k][0] += a; sk[k][1] += b; }));
    return { sk, q: all.length ? all.reduce((s, x) => s + x.quality, 0) / all.length : 0, score: G.current ? G.current.score : 0, best: G.current ? G.current.best : 0 };
  };
  const L = T.levels[lv - 1];

  return (
    <div className="vg-game">
      <div className={'vg-stage' + (phase === 'play' ? ' playing' : '')} ref={wrap} tabIndex="-1" aria-label={T.title}>
        <canvas ref={cv} onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { touch.current = null; }} onPointerLeave={e => { if (e.pointerType === 'mouse') G.current.hover = null; }} role="img" aria-label={T.title} />
        {phase === 'title' && (
          <div className="vg-over vg-title">
            <span className="vg-pixel">{T.title}</span>
            <p>{T.tagline}</p>
            <label className="vg-check"><input type="checkbox" checked={mode === 'calm'} onChange={e => setMode(e.target.checked ? 'calm' : 'normal')} /><span>{U.calm}<small> · {U.calmHint}</small></span></label>
            <div className="vg-actions center">
              <button type="button" className="btn btn-primary vg-big" onClick={() => brief(1)} autoFocus><Icon name="play" size={18} /><span>{U.play}</span></button>
              <button type="button" className="btn btn-ghost" onClick={toggleSound} aria-pressed={sound}><span>{U.sound}: {sound ? U.on : U.off}</span></button>
            </div>
            <p className="vg-keys">{U.controls}</p>
            <p className="vg-keys touch">{U.touch}</p>
          </div>
        )}
        {phase === 'brief' && (
          <div className="vg-over vg-brief">
            <span className="vg-level">{U.brief(lv)}</span>
            <h3>{L.title}</h3>
            <p>{L.text}</p>
            <ul className="vg-ex">{L.ex.map(([a, b], k) => <li key={k}><code>{a}</code><Icon name="arrowRight" size={14} /><span>{b}</span></li>)}</ul>
            <div className="vg-actions center"><button type="button" className="btn btn-primary vg-big" onClick={start} autoFocus><span>{U.start}</span></button></div>
          </div>
        )}
        {phase === 'paused' && (
          <div className="vg-over vg-small">
            <span className="vg-pixel">{U.paused}</span>
            <div className="vg-actions center">
              <button type="button" className="btn btn-primary" onClick={() => { setPhase('play'); wrap.current.focus({ preventScroll: true }); }} autoFocus>{U.resume}</button>
              <button type="button" className="btn btn-ghost" onClick={restart}>{U.restart}</button>
            </div>
          </div>
        )}
        {phase === 'end' && sum && <div className="vg-over vg-scroll"><Recap T={T} s={sum} onNext={sum.quality >= 0.7 || sum.lv < 5 ? next : null} nextLabel={U.next} onRetry={retry} onCsv={csv} /></div>}
        {phase === 'over' && sum && (
          <div className="vg-over vg-scroll">
            <span className="vg-pixel">{U.gameover}</span>
            <p className="vg-center">{U.gameoverText}</p>
            <Recap T={T} s={sum} onRetry={retry} onCsv={csv}><button type="button" className="btn btn-ghost" onClick={restart}>{U.fromStart}</button></Recap>
          </div>
        )}
        {phase === 'final' && (() => { const t = totals(); return (
          <div className="vg-over vg-scroll vg-final">
            <span className="vg-pixel">{U.final}</span>
            <p>{U.finalText}</p>
            <div className="vg-kpis three"><div><span>{U.score}</span><b>{t.score}</b></div><div><span>{U.quality}</span><b>{Math.round(t.q * 100)}%</b></div><div><span>{U.bestCombo}</span><b>{t.best}</b></div></div>
            <Skills U={U} sk={t.sk} />
            <div className="vg-actions center">
              <button type="button" className="btn btn-primary" onClick={() => onLead('final')}><Icon name="mail" size={16} /><span>{U.audit}</span></button>
              <button type="button" className="btn btn-ghost" onClick={restart} autoFocus>{U.again}</button>
            </div>
          </div>
        ); })()}
      </div>
      <div className="vg-controls">
        <button type="button" className="vg-btn b-suck" disabled={phase !== 'play'} onClick={e => fire('suck', e)}>
          <i aria-hidden="true" /><span>{U.btn.suck}</span><kbd>{U.keys.suck}</kbd>
        </button>
        <button type="button" className="vg-btn b-cut" disabled={phase !== 'play'} onClick={e => fire('cut', e)}>
          <i aria-hidden="true" /><span>{U.btn.cut}</span><kbd>{U.keys.cut}</kbd>
        </button>
        {hud.scanner && (
          <button type="button" className={'vg-btn b-scan' + (hud.scanReady ? ' ready' : '')} disabled={phase !== 'play' || !hud.scanReady} onClick={e => fire('scan', e)}>
            <i aria-hidden="true" /><span>{U.btn.scan}</span><kbd>{U.keys.scan}</kbd>
            <em className="vg-charge" style={{ width: `${(hud.scanOn ? 1 : hud.scan || 0) * 100}%` }} aria-hidden="true" />
          </button>
        )}
        {hud.source && hud.ruleReady && phase === 'play' && (
          <button type="button" className="vg-btn b-seal" onClick={e => fire('seal', e)}><i aria-hidden="true" /><span>{U.btn.seal}</span><kbd>{U.keys.seal}</kbd></button>
        )}
        <span className="vg-spacer" />
        <button type="button" className="icon-btn" onClick={() => setPhase(phase === 'paused' ? 'play' : 'paused')} disabled={phase !== 'play' && phase !== 'paused'} aria-label={U.pause} title={U.pause}><Icon name={phase === 'paused' ? 'play' : 'pause'} size={18} /></button>
        <button type="button" className={'icon-btn vg-sound' + (sound ? ' on' : '')} onClick={toggleSound} aria-pressed={sound} aria-label={U.sound} title={U.sound}><Icon name="sound" size={18} /></button>
      </div>
      <div className={'vg-msg' + (msg ? ' t-' + msg.tone : '')} role="status" aria-live="polite">
        {msg ? <><strong>{msg.title}</strong>{msg.text && <span>{msg.text}</span>}</> : <><span className="muted vg-keys-inline">{U.controls}</span><span className="muted vg-touch-inline">{U.touch}</span></>}
      </div>
    </div>
  );
}
