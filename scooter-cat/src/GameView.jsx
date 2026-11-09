// Ігрове поле: canvas із рушієм, накладки (титул із вибором героя, рівні, бриф, пауза, розбір рівня, фінал),
// кнопки для дотику, музика і звуки.
import { useEffect, useRef, useState } from 'react';
import { Game, LEVEL_IDS, PAR, CHAR_IDS } from './game.js';
import { DIFF } from './levels.js';
import { loadProgress, recordFinish, scopeStatus, scopesOf, loadPlayer, boardUrl } from './board.js';
import Leaderboard, { BoardSubmit, ShareButton } from './Leaderboard.jsx';
import { LANGS } from './i18n.js';
import { setSound, setMusic, unlock, pauseAll } from './audio.js';
import { drawPreview } from './riders.js';
import { Icon } from '../../dashboard/src/icons.jsx';

const PREFS = 'bc-scooter-cat-prefs';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватне вікно */ } };
const STATS = { cat: [3, 3, 3], capy: [2, 4, 2], head: [3, 1, 4] };
const NOKEYS = { gas: false, brake: false, back: false, fwd: false };

// складність траси: від однієї до трьох смужок, як рівень сигналу
export function Diff({ d }) { return <i className={'sc-bars d' + d} aria-hidden="true">{[1, 2, 3].map(k => <b key={k} className={k <= d ? 'on' : ''} />)}</i>; }

function Stars({ n, size }) { return <span className={'sc-stars' + (size ? ' ' + size : '')} aria-label={n + '/3'}>{[0, 1, 2].map(k => <i key={k} className={k < n ? 'on' : ''}>★</i>)}</span>; }

// картка героя з живим прев'ю
function CharCard({ id, on, onPick, T }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf, t0 = performance.now();
    const loop = now => { if (ref.current) drawPreview(ref.current, id, (now - t0) / 1000); raf = requestAnimationFrame(loop); };
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) drawPreview(ref.current, id, 0); else raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return (
    <button type="button" className={'sc-char' + (on ? ' on' : '')} onClick={() => onPick(id)} aria-pressed={on}>
      <canvas ref={ref} aria-hidden="true" />
      <strong>{T.chars[id].name}</strong>
      <small>{T.chars[id].note}</small>
      <span className="sc-char-stats">{T.charStats.map((l, k) => <span key={k}><em>{l}</em><i>{[0, 1, 2, 3].map(j => <b key={j} className={j < STATS[id][k] ? 'on' : ''} />)}</i></span>)}</span>
    </button>
  );
}

export default function GameView({ T, lang, onLead, track }) {
  const U = T.ui, F = T.fmt, prefix = LANGS.find(l => l.id === lang).prefix;
  const prefs0 = load(PREFS, {});
  const wrap = useRef(null), cv = useRef(null), G = useRef(null), phaseRef = useRef('title'), tipRef = useRef(0), biteRef = useRef(0);
  const [phase, setPhaseState] = useState('title');
  const [lv, setLv] = useState(0);
  const [mode, setMode] = useState('normal');
  const [char, setChar] = useState(CHAR_IDS.includes(prefs0.char) ? prefs0.char : 'cat');
  const [sound, setSnd] = useState(prefs0.sound !== false);
  const [music, setMus] = useState(prefs0.music !== false);
  const [sum, setSum] = useState(null);
  // рекорди кожного героя окремо (для рейтингу за героями)
  const [prog, setProg] = useState(() => loadProgress());
  const progRef = useRef(prog);
  // рейтинг поверх гри: група, герой (null: усі), куди повертатися
  const [bScope, setBScope] = useState('all');
  const [bChar, setBChar] = useState(null);
  const boardBack = useRef('title');
  const [msg, setMsg] = useState(null);
  const setPhase = p => { phaseRef.current = p; setPhaseState(p); };

  useEffect(() => { setSound(sound); setMusic(music); save(PREFS, { char, sound, music }); }, [sound, music, char]);

  useEffect(() => {
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const g = new Game({ T, lang, reduced, emit: e => {
      if (phaseRef.current !== 'play') return;   // заставка на титулі мовчить
      if (e.type === 'gate') { const q = T.gates[e.gate.key]; setMsg({ tone: 'info', title: q.title, text: q.text(e.gate.args || {}), k: Date.now() }); }
      else if (e.type === 'checkpoint') setMsg({ tone: 'good', title: T.msg.checkpoint(e.n), text: T.msg.checkpointText, k: Date.now() });
      else if (e.type === 'bite') { if (biteRef.current++ < 2) setMsg({ tone: 'bad', title: T.msg.bite, text: T.msg.biteText, k: Date.now() }); }
      else if (e.type === 'crash') {
        const tips = T.msg.tips;
        if (e.n === 3 && g.mode !== 'calm') setMsg({ tone: 'info', title: T.msg.calmTitle, text: T.msg.calmText, action: 'calm', k: Date.now() });
        else if (e.pit) setMsg({ tone: 'bad', title: T.msg.pit, text: T.msg.pitText, k: Date.now() });
        else setMsg({ tone: 'bad', title: T.msg.crash, text: tips[tipRef.current++ % tips.length], k: Date.now() });
      }
      else if (e.type === 'stuck') setMsg({ tone: 'info', title: T.msg.stuck, text: T.msg.stuckText, k: Date.now() });
      else if (e.type === 'finish') {
        const s = e.summary, p = progRef.current, sc = scopesOf(s.id);
        const before = sc.map(x => scopeStatus(p, s.char, x));
        const r = recordFinish(p, s.char, s.id, s.time, s.stars, g.mode === 'calm');
        s.newBest = r.better && r.old != null; s.best = r.best;
        // група рівнів пройдена вперше або її загальний час покращився: пропонуємо рейтинг
        s.board = sc.map(x => scopeStatus(p, s.char, x)).filter((st, k) => st.complete && (!before[k].complete || r.better));
        progRef.current = { ...p }; setProg(progRef.current);
        setSum(s); setPhase('end');
        track && track('level_finish', { level: s.id, char: s.char, stars: s.stars, time: Math.round(s.time) });
      }
    } });
    G.current = g;
    g.char = char;
    if (/scdebug/.test(location.search)) window.__sc = g;   // лише для автоматичних перевірок
    const canvas = cv.current, ctx = canvas.getContext('2d');
    const fit = () => {
      const W = Math.max(300, Math.round(wrap.current.getBoundingClientRect().width));
      const H = W < 620 ? Math.min(600, Math.round(W * 1.18)) : Math.max(420, Math.min(620, Math.round(W * 0.56)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.layout(W, H);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap.current);
    // заставка: автопілот їде трасами, поки відкрито титул чи меню
    g.quiet = true; g.load('trend'); g.start();
    let raf, last = performance.now();
    const loop = now => {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      const p = phaseRef.current;
      if (p === 'play') g.update(dt);
      else if (p === 'title' || p === 'menu' || p === 'final' || (p === 'board' && ['title', 'menu', 'final'].includes(boardBack.current))) {
        g.autopilot(8);
        g.update(reduced ? 0 : dt);
        if (g.state === 'finish' && g.finishT > 2) { g.load(LEVEL_IDS[(LEVEL_IDS.indexOf(g.id) + 1) % LEVEL_IDS.length]); g.start(); }
      }
      g.draw(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const vis = () => { pauseAll(document.hidden); if (document.hidden && phaseRef.current === 'play') { g.setKeys(NOKEYS); setPhase('paused'); } };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // клавіатура: лише під час гри і не тоді, коли фокус у полі форми
  useEffect(() => {
    const map = { arrowup: 'gas', w: 'gas', 'ц': 'gas', arrowdown: 'brake', s: 'brake', 'і': 'brake', 'ы': 'brake', arrowleft: 'back', a: 'back', 'ф': 'back', arrowright: 'fwd', d: 'fwd', 'в': 'fwd' };
    const laser = [' ', 'f', 'x', 'а', 'ч', 'enter'];
    const skip = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || document.body.classList.contains('modal-open');
    const down = e => {
      const g = G.current, k = e.key.toLowerCase();
      if (skip(e)) return;
      if (phaseRef.current === 'paused' && (k === 'p' || k === 'з' || k === 'escape')) { e.preventDefault(); setPhase('play'); return; }
      if (phaseRef.current === 'board' && k === 'escape') { e.preventDefault(); setPhase(boardBack.current); return; }
      if (phaseRef.current !== 'play') return;
      unlock();
      if (map[k]) { e.preventDefault(); g.setKeys({ [map[k]]: true }); }
      else if (laser.includes(k)) { e.preventDefault(); g.fire(); }
      else if (k === 'r' || k === 'к') { e.preventDefault(); if (g.state === 'play' || g.state === 'crash') g.respawn(); }
      else if (k === 'p' || k === 'з' || k === 'escape') { e.preventDefault(); g.setKeys(NOKEYS); setPhase('paused'); }
    };
    const up = e => { const k = e.key.toLowerCase(); if (map[k]) G.current.setKeys({ [map[k]]: false }); };
    const blur = () => G.current && G.current.setKeys(NOKEYS);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  const pickChar = id => {
    setChar(id);
    const g = G.current; g.char = id;
    if (phaseRef.current !== 'play') { g.load(g.id, id); g.start(); }
  };
  const brief = n => { setLv(n); setMsg(null); setPhase('brief'); };
  const start = () => {
    const g = G.current;
    g.mode = mode; g.quiet = false; g.setKeys(NOKEYS);
    g.load(LEVEL_IDS[lv], char); g.start();
    biteRef.current = 0;
    setSum(null); setPhase('play');
    wrap.current.focus({ preventScroll: true });
    track && track('level_start', { level: LEVEL_IDS[lv], char, mode });
  };
  const toMenu = p => { const g = G.current; g.setKeys(NOKEYS); g.quiet = true; if (p !== 'paused') { g.load(g.id, char); g.start(); } setPhase(p); };
  const next = () => { if (lv >= LEVEL_IDS.length - 1) toMenu('final'); else brief(lv + 1); };
  const rec = prog.chars[char] || {};   // рекорди вибраного героя
  const firstOpen = () => { const k = LEVEL_IDS.findIndex(id => !rec[id]); return k < 0 ? 0 : k; };
  const pause = () => { if (phase === 'play') { G.current.setKeys(NOKEYS); setPhase('paused'); } else if (phase === 'paused') setPhase('play'); };
  const toCp = () => { const g = G.current; if (phase === 'play' && (g.state === 'play' || g.state === 'crash')) g.respawn(); };
  const totalStars = LEVEL_IDS.reduce((s, id) => s + ((rec[id] && rec[id].stars) || 0), 0);
  // рейтинг: з гри стає на паузу, після закриття повертає туди, звідки відкрито
  const openBoard = (scope = 'all', ch = null) => {
    const from = phase === 'play' ? 'paused' : phase;
    if (phase === 'play') G.current.setKeys(NOKEYS);
    boardBack.current = from === 'board' ? boardBack.current : from;
    setBScope(scope); setBChar(ch); setPhase('board');
    track && track('board_open', { from, scope });
  };

  // кнопки для дотику: кожна тримається, поки тримають палець
  const hold = key => ({
    onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); G.current.setKeys({ [key]: true }); e.currentTarget.classList.add('on'); },
    onPointerUp: e => { G.current.setKeys({ [key]: false }); e.currentTarget.classList.remove('on'); },
    onPointerCancel: e => { G.current.setKeys({ [key]: false }); e.currentTarget.classList.remove('on'); },
    onContextMenu: e => e.preventDefault(),
  });
  const L = T.levels;

  return (
    <div className="sc-game" onPointerDown={() => unlock()}>
      <div className={'sc-stage' + (phase === 'play' ? ' playing' : '')} ref={wrap} tabIndex="-1" aria-label={T.title}>
        <canvas ref={cv} role="img" aria-label={T.title} />
        {phase === 'play' && (
          <div className="sc-touch" aria-hidden="true">
            <div className="sc-touch-l"><button type="button" {...hold('back')}><Icon name="lean-back" size={26} /></button><button type="button" {...hold('fwd')}><Icon name="lean-fwd" size={26} /></button></div>
            <div className="sc-touch-r">
              <button type="button" className="laser" onPointerDown={e => { e.preventDefault(); G.current.fire(); }} onContextMenu={e => e.preventDefault()}><Icon name="eye" size={24} /></button>
              <button type="button" {...hold('brake')}><Icon name="pedal-brake" size={24} /></button>
              <button type="button" className="gas" {...hold('gas')}><Icon name="pedal-gas" size={26} /></button>
            </div>
          </div>
        )}
        {phase === 'title' && (
          <div className="sc-over sc-scroll sc-title">
            <span className="sc-logo">{T.short}</span>
            <p className="sc-tagline">{T.tagline}</p>
            <div className="sc-chars" role="group" aria-label={U.chooseChar}>
              {CHAR_IDS.map(id => <CharCard key={id} id={id} on={char === id} onPick={pickChar} T={T} />)}
            </div>
            <div className="sc-actions center">
              <button type="button" className="btn btn-primary sc-big" onClick={() => { unlock(); brief(firstOpen()); }} autoFocus><Icon name="play" size={18} /><span>{U.play}</span></button>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('menu')}><span>{U.levels}</span>{totalStars > 0 && <small className="sc-badge">★ {totalStars}</small>}</button>
              <button type="button" className="btn btn-ghost" onClick={() => openBoard('all', null)}><Icon name="trophy" size={16} /><span>{T.board.open}</span></button>
            </div>
            <label className="sc-check"><input type="checkbox" checked={mode === 'calm'} onChange={e => setMode(e.target.checked ? 'calm' : 'normal')} /><span>{U.calm}<small> · {U.calmHint}</small></span></label>
            <p className="sc-keys">{U.controls}</p>
            <p className="sc-keys touch">{U.touch}</p>
          </div>
        )}
        {phase === 'menu' && (
          <div className="sc-over sc-scroll">
            <div className="sc-menu-head"><h3>{U.levels}</h3><span className="muted">{T.chars[char].short} · ★ {totalStars} {U.of} {3 * LEVEL_IDS.length}</span></div>
            {[1, 2, 3].map(d => (
              <section key={d} className="sc-league">
                <h4 className={'sc-league-h d' + d}><Diff d={d} />{U.league[d]}</h4>
                <div className="sc-menu">
                  {LEVEL_IDS.map((id, k) => (DIFF[id] !== d ? null : (
                    <button type="button" key={id} className="sc-lv" onClick={() => brief(k)} autoFocus={k === 0}>
                      <span className="sc-lv-n">{U.brief(k + 1)}</span>
                      <strong>{L[id].title}</strong>
                      <small>{T.chart[id]}</small>
                      <span className="sc-lv-foot"><Stars n={(rec[id] && rec[id].stars) || 0} />{rec[id] && rec[id].best != null && <em>{U.best} {F.time(rec[id].best)}</em>}</span>
                    </button>
                  )))}
                </div>
              </section>
            ))}
            <div className="sc-actions center"><button type="button" className="btn btn-ghost" onClick={() => setPhase('title')}><Icon name="back" size={16} /><span>{U.back}</span></button></div>
          </div>
        )}
        {phase === 'brief' && (
          <div className="sc-over sc-brief">
            <span className="sc-level">{U.brief(lv + 1)} · <span className={'sc-diff d' + DIFF[LEVEL_IDS[lv]]}><Diff d={DIFF[LEVEL_IDS[lv]]} />{U.diff[DIFF[LEVEL_IDS[lv]]]}</span> · {T.chart[LEVEL_IDS[lv]]}</span>
            <h3>{L[LEVEL_IDS[lv]].title}</h3>
            <p>{L[LEVEL_IDS[lv]].brief}</p>
            <p className="sc-par muted">{T.chars[char].name} · {U.par}: {F.time(PAR[LEVEL_IDS[lv]])}{rec[LEVEL_IDS[lv]] && rec[LEVEL_IDS[lv]].best != null ? ` · ${U.best}: ${F.time(rec[LEVEL_IDS[lv]].best)}` : ''}</p>
            <div className="sc-actions center">
              <button type="button" className="btn btn-primary sc-big" onClick={() => { unlock(); start(); }} autoFocus><Icon name="play" size={18} /><span>{U.start}</span></button>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('menu')}>{U.menu}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('title')}>{U.chooseChar}</button>
            </div>
            <p className="sc-keys">{U.controls}</p>
            <p className="sc-keys touch">{U.touch}</p>
          </div>
        )}
        {phase === 'paused' && (
          <div className="sc-over sc-small-over">
            <span className="sc-logo small">{U.paused}</span>
            <div className="sc-actions center">
              <button type="button" className="btn btn-primary" onClick={() => setPhase('play')} autoFocus>{U.resume}</button>
              <button type="button" className="btn btn-ghost" onClick={start}>{U.restart}</button>
              <button type="button" className="btn btn-ghost" onClick={() => toMenu('menu')}>{U.menu}</button>
            </div>
          </div>
        )}
        {phase === 'end' && sum && (() => { const lt = L[sum.id]; return (
          <div className="sc-over sc-scroll">
            <div className="sc-recap">
              <div className="sc-recap-head"><h3>{U.finished(sum.index + 1)}: {lt.title}</h3><Stars n={sum.stars} size="big" /></div>
              <ul className="sc-star-legend">{U.stars.map((s, k) => <li key={k} className={(k === 0 || (k === 1 && sum.share >= 0.9) || (k === 2 && sum.time <= sum.par)) ? 'on' : ''}><i>★</i>{s}</li>)}</ul>
              <div className="sc-kpis four">
                <div><span>{U.time}</span><b>{F.time(sum.time)}</b><small>{U.par} {F.time(sum.par)}{sum.newBest ? ` · ${U.newBest}` : ''}</small></div>
                <div><span>{U.points}</span><b>{sum.pts}/{sum.total}</b><small>{F.pct0(sum.share)}</small></div>
                <div><span>{U.bugs}</span><b>{sum.zapped}/{sum.bugs}</b><small>{U.bitten(sum.bitten)}</small></div>
                <div><span>{U.crashes}</span><b>{sum.crashes}</b><small>{U.best} {F.time(sum.best)}</small></div>
              </div>
              {sum.board && sum.board.length > 0 && <BoardSubmit key={sum.id + ':' + sum.time} T={T} lang={lang} char={sum.char} statuses={sum.board} prev={sum.boardRes} onResult={r => { sum.boardRes = r; }} onOpen={sc => openBoard(sc, sum.char)} track={track} />}
              <div className="sc-lesson"><span>{U.lesson}</span><h4>{lt.lessonTitle}</h4><p>{lt.lesson(sum.stats)}</p></div>
              <div className="sc-tip"><Icon name="info" size={16} /><div><strong>{U.tip}</strong><p>{lt.tip}</p></div></div>
              <div className="sc-actions">
                <button type="button" className="btn btn-primary" onClick={next} autoFocus>{lv >= LEVEL_IDS.length - 1 ? U.final : U.next}</button>
                <button type="button" className="btn btn-ghost" onClick={start}>{U.retry}</button>
                <button type="button" className="btn btn-ghost" onClick={() => toMenu('menu')}>{U.menu}</button>
              </div>
            </div>
          </div>
        ); })()}
        {phase === 'final' && (
          <div className="sc-over sc-scroll sc-final">
            <span className="sc-logo">{U.final}</span>
            <Stars n={3} size="big" />
            <p className="sc-final-total">{U.totalStars}: {totalStars} {U.of} {3 * LEVEL_IDS.length}</p>
            <p>{U.finalText}</p>
            <div className="sc-actions center">
              <button type="button" className="btn btn-primary" onClick={() => onLead('final')}><Icon name="mail" size={16} /><span>{U.cta}</span></button>
              <button type="button" className="btn btn-ghost" onClick={() => openBoard('all', char)}><Icon name="trophy" size={16} /><span>{T.board.open}</span></button>
              <button type="button" className="btn btn-ghost" onClick={() => brief(0)} autoFocus>{U.again}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('title')}>{U.chooseChar}</button>
            </div>
          </div>
        )}
        {phase === 'board' && (() => {
          const pl = loadPlayer(), mine = pl.pid && Object.keys(pl.subs).some(k => k.startsWith(bScope + ':') && (!bChar || k.endsWith(':' + bChar)));
          return (
            <div className="sc-over sc-scroll sc-board-over">
              <div className="sc-menu-head">
                <h3 className="sc-board-title"><Icon name="trophy" size={20} />{T.board.title}</h3>
                <div className="sc-board-actions">
                  <ShareButton T={T} url={boardUrl(prefix, bScope, bChar, mine ? pl.pid : null)} track={track} />
                  <a className="btn btn-ghost" href={`${prefix}/cases/scooter-cat/rating/?s=${bScope}&c=${bChar || 'any'}`}>{T.board.page}</a>
                </div>
              </div>
              <Leaderboard T={T} lang={lang} prefix={prefix} scope={bScope} char={bChar} onScope={setBScope} onChar={setBChar} track={track} />
              <div className="sc-actions center"><button type="button" className="btn btn-ghost" onClick={() => setPhase(boardBack.current)} autoFocus><Icon name="back" size={16} /><span>{U.back}</span></button></div>
            </div>
          );
        })()}
      </div>
      <div className="sc-controls">
        <button type="button" className="icon-btn" onClick={pause} disabled={phase !== 'play' && phase !== 'paused'} aria-label={U.pause} title={U.pause}><Icon name={phase === 'paused' ? 'play' : 'pause'} size={18} /></button>
        <button type="button" className="icon-btn" onClick={toCp} disabled={phase !== 'play'} aria-label={U.toCp} title={U.toCp}><Icon name="reset" size={18} /></button>
        <button type="button" className="icon-btn" onClick={() => toMenu('menu')} aria-label={U.levels} title={U.levels}><Icon name="grid" size={18} /></button>
        <button type="button" className={'icon-btn' + (phase === 'board' ? ' on' : '')} onClick={() => (phase === 'board' ? setPhase(boardBack.current) : openBoard(bScope, bChar))} aria-label={T.board.open} title={T.board.open}><Icon name="trophy" size={18} /></button>
        <button type="button" className={'icon-btn sc-sound' + (music ? ' on' : '')} onClick={() => { unlock(); setMus(!music); }} aria-pressed={music} aria-label={U.music} title={U.music}><Icon name="music" size={18} /></button>
        <button type="button" className={'icon-btn sc-sound' + (sound ? ' on' : '')} onClick={() => { unlock(); setSnd(!sound); }} aria-pressed={sound} aria-label={U.sound} title={U.sound}><Icon name="sound" size={18} /></button>
        <div className={'sc-msg' + (msg ? ' t-' + msg.tone : '')} role="status" aria-live="polite">
          {msg ? <><strong>{msg.title}</strong>{msg.text && <span>{msg.text}</span>}{msg.action === 'calm' && mode !== 'calm' && <button type="button" className="btn btn-ghost sc-msg-btn" onClick={() => { setMode('calm'); G.current.mode = 'calm'; setMsg(null); wrap.current.focus({ preventScroll: true }); }}>{T.msg.calmOn}</button>}</> : <><span className="muted sc-keys-inline">{U.controls}</span><span className="muted sc-touch-inline">{U.touch}</span></>}
        </div>
      </div>
    </div>
  );
}
