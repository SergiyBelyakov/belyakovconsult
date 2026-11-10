// Ігрове поле: автомат ліворуч, панель дослідів праворуч. Тут оберт від натискання до розбору:
// рушій дає результат, барабани його докручують, індикатори й повідомлення показують, а дослід веде облік.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Slot, BETS, loadSave, store } from './game.js';
import { MACHINES, KIND, START_CREDITS } from './engine.js';
import { LESSON_IDS, LESSONS, correct, newRun, feed, progress, debrief } from './lessons.js';
import { Reels } from './reels.js';
import { symbolImage } from './sprites.js';
import { setSound, sfx } from './audio.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import Cabinet from './Cabinet.jsx';
import Lab from './Lab.jsx';

const wait = ms => new Promise(r => setTimeout(r, ms));
const FAKE_LED = { DDD: 'dUP', NNN: 'nULL', XXX: 'tESt' };
const SYM_OF = { C: 0, P: 1, T: 2 };

export default function GameView({ T, lang, onLead, track, assetBase }) {
  const F = T.fmt;
  const cv = useRef(null), win = useRef(null), stage = useRef(null);
  const S = useRef(null), R = useRef(null);
  if (!S.current) S.current = new Slot({ life: loadSave().life });
  const busy = useRef(false), autoLeft = useRef(0), turboOn = useRef(false), alive = useRef(true), run = useRef(null), reduced = useRef(false);
  const [save, setSaveState] = useState(loadSave);
  const saveRef = useRef(save);
  const [ls, setLsState] = useState({ mode: 'intro', idx: 0, phase: null, pick: null, prog: null, d: null });
  const lsRef = useRef(ls);
  const [shown, setShown] = useState({ credits: START_CREDITS, bet: 1, win: 0, take: 0, machine: 'cat', ledText: null });
  const [busyUi, setBusyUi] = useState(false);
  const [auto, setAuto] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [fx, setFx] = useState('');
  const [msg, setMsg] = useState(null);
  const [line, setLine] = useState('');
  const [sound, setSnd] = useState(false);
  const [tab, setTab] = useState('lab');
  const [tick, setTick] = useState(0);
  const icons = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map(s => symbolImage(s, T.bug, 2)), [lang]);

  const setLs = next => { const v = typeof next === 'function' ? next(lsRef.current) : next; lsRef.current = v; setLsState(v); };
  const setSave = next => { const v = typeof next === 'function' ? next(saveRef.current) : next; saveRef.current = v; setSaveState(v); store(v); };
  const sync = extra => { const s = S.current; setShown(p => ({ ...p, credits: s.credits, bet: s.bet, take: s.take, machine: s.machine, ...extra })); };
  const lock = v => { busy.current = v; setBusyUi(v); };
  const persistLife = () => setSave(sv => ({ ...sv, life: { ...S.current.life } }));

  // барабани: полотно під розмір вікна автомата, цикл малювання
  useEffect(() => {
    alive.current = true;
    reduced.current = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const reels = new Reels({ labels: T.bug, reduced: reduced.current, onTick: () => sfx.tick(), onStop: r => sfx.stop(r) });
    reels.setStrips(S.current.M.strips, [2, 7, 12]);
    R.current = reels;
    if (/jcdebug/.test(location.search)) window.__jc = { slot: S.current, reels, MACHINES };   // лише для автоматичних перевірок
    const canvas = cv.current, ctx = canvas.getContext('2d');
    const fit = () => {
      const W = Math.max(220, Math.round(win.current.getBoundingClientRect().width)), H = Math.round(Math.min(280, W * 0.66)), dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      reels.layout(W, H);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(win.current);
    let raf, last = performance.now();
    const loop = now => { const dt = Math.min(1 / 20, (now - last) / 1000); last = now; reels.update(dt); reels.draw(ctx); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { alive.current = false; autoLeft.current = 0; turboOn.current = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // ——— показ результату після зупинки барабанів ———
  const tween = (from, to, ms, set) => new Promise(done => {
    if (ms <= 0 || reduced.current) { set(to); done(); return; }
    const t0 = performance.now();
    const step = now => { const u = Math.min(1, (now - t0) / ms); set(Math.round(from + (to - from) * u)); if (u < 1 && alive.current) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  });
  // пунктирна рамка «майже» з'являється в досліді про «майже виграш» і лишається після нього
  const nearOn = () => !!saveRef.current.done.near || (lsRef.current.mode === 'lesson' && LESSON_IDS[lsRef.current.idx] === 'near');
  const lineCells = (res, sym) => res.line.map((s, r) => (s === sym ? [r, 1] : null)).filter(Boolean);
  async function reveal(res, quick) {
    const s = S.current, reels = R.current, M = MACHINES[res.machine];
    setLine(T.cab.line(res.line.map(x => T.sym[x])));
    if (res.kind === KIND.audit) {
      reels.highlight({ type: 'audit', cells: [[0, 1], [1, 1], [2, 1]] }); setFx('audit'); sfx.audit();
      setMsg({ ...T.msg.audit(res.burned), tone: 'bad' });
      track('audit', { n: res.n, burned: res.burned });
      await tween(res.burned, 0, 900, v => setShown(p => ({ ...p, credits: v })));
      sync({ win: 0 }); await wait(quick ? 500 : 1100);
    } else if (res.kind === KIND.fake) {
      reels.highlight({ type: 'fake', cells: [[0, 1], [1, 1], [2, 1]] }); setFx('fake'); sfx.fake();
      setShown(p => ({ ...p, ledText: FAKE_LED[res.key] })); setMsg({ ...T.msg.fakeCheck, tone: 'info' });
      await wait(quick ? 500 : 950);
      setShown(p => ({ ...p, ledText: null, win: 0 })); setMsg({ ...T.msg.fake[res.key], tone: 'info' });
      await wait(quick ? 250 : 700);
    } else if (res.kind === KIND.win) {
      const sym = SYM_OF[res.key[0]], jackpot = res.key === 'CCC', big = res.pay >= 10;
      reels.highlight({ type: 'win', cells: lineCells(res, sym) }); setFx(jackpot ? 'jackpot' : big ? 'big' : 'win');
      if (jackpot) sfx.jackpot(); else if (big) sfx.big(); else sfx.coin(res.win);
      setMsg({ ...(jackpot ? T.msg.jackpot(res.win, Math.round(1 / M.stats.pCatLine)) : res.pay === 1 ? T.msg.push(T.combo[res.key]) : T.msg.win(T.combo[res.key], res.win)), tone: 'good' });
      const before = res.credits - res.win;
      await Promise.all([tween(0, res.win, quick ? 0 : Math.min(1100, 180 + res.win * 22), v => setShown(p => ({ ...p, win: v }))), tween(before, res.credits, quick ? 0 : Math.min(1100, 180 + res.win * 22), v => setShown(p => ({ ...p, credits: v })))]);
      await wait(quick ? 220 : jackpot ? 1500 : big ? 800 : 320);
    } else {
      const bug = res.line.find(x => x >= 3 && x <= 5);
      if (res.bosses === 2) { reels.highlight({ type: 'boss2', cells: lineCells(res, 6) }); sfx.tease(); setMsg({ ...T.msg.boss2, tone: 'bad' }); }
      else if (res.near >= 0 && nearOn()) { reels.highlight({ type: 'near', cells: res.window.map((w, r) => [r, w[1] === res.near ? 1 : w.indexOf(res.near)]) }); sfx.near(); setMsg({ ...T.msg.near(T.symMany[res.near]), tone: 'info' }); }
      else setMsg({ ...(bug != null ? T.msg.bug(T.bug[['dup', 'null', 'test'][bug - 3]]) : T.msg.none), tone: 'none' });
      setShown(p => ({ ...p, win: 0 }));
      await wait(quick ? 60 : res.bosses === 2 ? 500 : 160);
    }
    sync(); setFx(''); setTick(t => t + 1);
    if (s.v.spins === 10 || s.v.spins === 50 || s.v.spins === 200) track('spins', { n: s.v.spins });
  }

  // ——— дослід: облік обертів і завершення ———
  function account(res) {
    const cur = lsRef.current;
    if (cur.mode !== 'lesson' || cur.phase !== 'play' || !run.current) return false;
    const id = LESSON_IDS[cur.idx], done = feed(run.current, res);
    if (done) {
      const d = debrief(run.current), ok = cur.pick === correct(id);
      autoLeft.current = 0;
      setSave(sv => ({ ...sv, back: sv.back || id === 'ev', done: { ...sv.done, [id]: { pick: cur.pick, ok } }, life: { ...S.current.life } }));
      setLs({ ...cur, phase: 'debrief', d, prog: progress(run.current) }); setTab('lab');
      track('lesson_finish', { id, ok });
      if (ok) sfx.good();
      // розбір довший за екран телефона: показати його початок
      setTimeout(() => { if (stage.current && window.innerWidth < 1000) stage.current.querySelector('.jc-lab').scrollIntoView({ behavior: reduced.current ? 'auto' : 'smooth', block: 'start' }); }, 60);
      return true;
    }
    setLs({ ...cur, prog: progress(run.current) });
    // дослід «Котик чи капібара»: після 10 обертів на «Капібарі» автомат сам стає «Котиком»
    if (id === 'risk' && S.current.machine === 'capy' && run.current.by.capy.n >= LESSONS.risk.each) { autoLeft.current = 0; switchMachine('cat', true); }
    return false;
  }

  async function spinOnce(quick) {
    const s = S.current;
    if (busy.current) return null;
    if (!s.canSpin()) { setMsg({ ...T.msg.broke, tone: 'info' }); return null; }
    lock(true);
    const res = s.spin();
    setShown(p => ({ ...p, credits: res.credits + res.burned - (res.kind === KIND.audit ? 0 : res.win), win: 0, ledText: null }));
    if (!quick) { sfx.pull(); setMsg(null); }
    const hold = !quick && res.line[0] === res.line[1] && (res.line[0] === 0 || res.line[0] === 6);
    await R.current.spinTo(res.stops, { mode: quick ? 'quick' : 'normal', hold });
    if (!alive.current) return null;
    await reveal(res, quick);
    const finished = account(res);
    lock(false);
    if (!quick && !finished) persistLife();
    if (!s.canSpin() && !finished) setMsg({ ...T.msg.broke, tone: 'info' });
    return res;
  }
  const onSpin = () => { if (autoLeft.current > 0) { autoLeft.current = 0; setAuto(0); return; } spinOnce(false); };
  async function onAuto() {
    if (autoLeft.current > 0) { autoLeft.current = 0; setAuto(0); return; }
    if (busy.current) return;
    autoLeft.current = 10; setAuto(10); sfx.click();
    while (autoLeft.current > 0 && alive.current) {
      const res = await spinOnce(true);
      if (!res || res.kind === KIND.audit) break;
      autoLeft.current = Math.max(0, autoLeft.current - 1); setAuto(autoLeft.current);
      if (lsRef.current.phase === 'debrief') break;
      await wait(70);
    }
    autoLeft.current = 0; setAuto(0); persistLife();
  }
  // Дослід про Data Boss: автогра без анімації, доки не випаде аудит
  async function onTurbo() {
    const s = S.current, r = run.current;
    if (busy.current || !r) return;
    lock(true); turboOn.current = true; setTurbo(true); setMsg(null);
    let res = null, frames = 0;
    await new Promise(done => {
      const step = () => {
        if (!alive.current || !turboOn.current) return done();
        const k = frames < 90 ? 3 : frames < 240 ? 10 : 36; frames++;
        for (let i = 0; i < k; i++) {
          if (!s.canSpin()) { s.refill(); r.refills++; }
          res = s.spin();
          if (res.kind === KIND.audit) break;
          feed(r, res);
        }
        R.current.set(res.stops); sfx.tick();
        setShown(p => ({ ...p, credits: res.kind === KIND.audit ? res.burned : s.credits, take: s.take, win: res.win, ledText: null }));
        setLs(c => ({ ...c, prog: { now: r.n + (res.kind === KIND.audit ? 1 : 0), of: 0 } }));
        setMsg({ title: T.msg.turbo(r.n + (res.kind === KIND.audit ? 1 : 0), r.refills * START_CREDITS), tone: 'none' });
        if (res.kind === KIND.audit) return done();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    turboOn.current = false; setTurbo(false);
    if (res && res.kind === KIND.audit && alive.current) { await reveal(res, false); account(res); }
    lock(false); persistLife();
  }

  function switchMachine(id, silent) {
    const s = S.current;
    if ((busy.current && !silent) || s.machine === id) return;
    s.setMachine(id); R.current.setStrips(s.M.strips, [3, 9, 15]); sync({ win: 0 });
    setMsg({ ...T.msg.machine(T.machines[id].name), tone: 'info' }); sfx.click();
  }
  const onBet = () => { const s = S.current; s.setBet(BETS[(BETS.indexOf(s.bet) + 1) % BETS.length]); sync(); sfx.click(); };
  const onRefill = () => { S.current.refill(); sync(); setMsg({ ...T.msg.refilled, tone: 'info' }); sfx.refill(); track('refill', { n: S.current.v.refills }); };
  const toggleSound = () => { const v = !sound; setSnd(v); setSound(v); if (v) sfx.good(); };

  // ——— керування дослідами ———
  const prepare = id => { const s = S.current; s.setBet(1); if (s.machine !== LESSONS[id].machine) { s.setMachine(LESSONS[id].machine); R.current.setStrips(s.M.strips, [3, 9, 15]); } sync({ win: 0 }); };
  const onStart = idx => {
    if (busy.current) return;
    const id = LESSON_IDS[idx]; prepare(id); run.current = null; R.current.highlight(null);
    setLs({ mode: 'lesson', idx, phase: 'predict', pick: null, prog: null, d: null }); setTab('lab'); setMsg(null);
    track('lesson_start', { id });
  };
  const onPick = k => {
    const cur = lsRef.current, id = LESSON_IDS[cur.idx];
    run.current = newRun(id);
    setLs({ ...cur, phase: 'play', pick: k, prog: progress(run.current) }); sfx.click();
    track('lesson_predict', { id, pick: k, ok: k === correct(id) });
    if (window.innerWidth < 1000 && stage.current) stage.current.querySelector('.jc-cab').scrollIntoView({ behavior: reduced.current ? 'auto' : 'smooth', block: 'start' });
  };
  const onNext = () => { const cur = lsRef.current; if (cur.idx >= LESSON_IDS.length - 1) { setLs({ ...cur, mode: 'final', phase: null }); track('final', {}); } else onStart(cur.idx + 1); };
  const onFree = () => { if (busy.current) return; run.current = null; setLs({ mode: 'free', idx: 0, phase: null, pick: null, prog: null, d: null }); track('free', {}); };
  const onOpenBack = () => { setSave(sv => ({ ...sv, back: true })); sfx.good(); track('back_open', {}); };

  // пробіл: оберт, якщо фокус не в полі форми й не на кнопці
  useEffect(() => {
    const down = e => {
      if (e.key !== ' ' || e.repeat || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) || document.body.classList.contains('modal-open')) return;
      const r = stage.current && stage.current.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
      e.preventDefault(); if (!turboOn.current) onSpin();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const inLesson = ls.mode === 'lesson', bossPlay = inLesson && LESSON_IDS[ls.idx] === 'boss' && ls.phase === 'play';
  const broke = !busyUi && shown.credits < shown.bet && !turbo;
  const labFirst = inLesson && ls.phase !== 'play';
  return (
    <div className={'jc-game' + (labFirst ? ' lab-first' : '')} ref={stage}>
      <div className="jc-machine">
        <Cabinet T={T} F={F} shown={shown} icons={icons} busy={busyUi || turbo} auto={auto} fx={fx} canvasRef={cv} windowRef={win} line={line} assetBase={assetBase}
          onSpin={onSpin} onAuto={onAuto} onBet={onBet} onRefill={onRefill} onMachine={id => switchMachine(id)} showSwitch={ls.mode === 'free'} betLocked={inLesson} broke={broke} />
        <div className="jc-under">
          <div className={'jc-msg' + (msg ? ' t-' + msg.tone : '')} role="status" aria-live="polite">
            {msg ? <><strong>{msg.title}</strong>{msg.text && <span>{msg.text}</span>}</> : busyUi ? <span className="muted">{T.msg.spinning}</span> : <><span className="muted jc-keys-inline">{T.msg.ready}</span><span className="muted jc-touch-inline">{T.msg.touch}</span></>}
            {auto > 0 && <em>{T.msg.auto(auto)}</em>}
          </div>
          <button type="button" className={'icon-btn jc-sound' + (sound ? ' on' : '')} onClick={toggleSound} aria-pressed={sound} aria-label={`${T.cab.sound}: ${sound ? T.cab.on : T.cab.off}`} title={`${T.cab.sound}: ${sound ? T.cab.on : T.cab.off}`}><Icon name="sound" size={18} /></button>
        </div>
      </div>
      <Lab T={T} F={F} tab={tab} onTab={setTab} ls={ls} save={save} slot={S.current} tick={tick} icons={icons} shown={shown} turbo={turbo}
        onStart={onStart} onPick={onPick} onNext={onNext} onFree={onFree} onRetry={onStart} onOpenBack={onOpenBack} onTurbo={onTurbo} onLead={onLead} bossPlay={bossPlay} />
    </div>
  );
}
