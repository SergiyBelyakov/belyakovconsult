// Хмара записів: спершу «звичайний дашборд» зі стовпців-місяців, потім ті самі точки розкладаються на хмару.
// Праворуч картка вибраного запису, зверху метод, норма й поріг, знизу групи.
import { useEffect, useMemo, useRef, useState } from 'react';
import Cloud3D from '../Cloud3D.jsx';
import Cloud2D from '../Cloud2D.jsx';
import { Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { tally } from '../engine.js';
import { ModelBar, FeatureChips, GroupChips, RecordCard } from './controls.jsx';

// Число, що «добігає» до нового значення
function useCount(value) {
  const [v, setV] = useState(value);
  const cur = useRef(value);
  useEffect(() => {
    const from = cur.current, t0 = performance.now(), dur = 650;
    let raf;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
      cur.current = Math.round(from + (value - from) * e);
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return v;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export default function Cloud({ ctx }) {
  const { T, f, ds, E, gl, res, D, pos, dash, th, groups, sel, setSel, mode, setMode, fly, flyTo, method, cx, order, lang } = ctx;
  const box = useRef(null), api = useRef(null), touched = useRef(false);
  const [spread, setSpread] = useState(1);
  const [tour, setTour] = useState(false);
  const [spin, setSpin] = useState(true);
  const [full, setFull] = useState(false);
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < 760);
  const coarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const tSel = useMemo(() => tally(ds, D, th, groups), [D, th, groups]);
  const tAll = useMemo(() => tally(ds, D, th), [D, th]);
  const count = useCount(mode === 'cloud' ? tSel.total : 0);
  const dim = useMemo(() => ds.groups.map((_, k) => (groups.size && !groups.has(k) ? 0.1 : 1)), [groups]);
  const bases = useMemo(() => res.C.bases.map((b, k) => {
    const all = cx === 'all', s = all ? tSel.total : tAll.byG[k];
    return { c: b.c, r: E.shellRadius(res, method, k, th), label: all ? T.allLabel : (narrow ? T.groupsShort : T.groups)[ds.groups[k].id], sub: T.groupSub(f.int(b.idx.length), f.int(s)), dim: !all && groups.size > 0 && !groups.has(k), hot: s > 0 };
  }), [res, method, th, groups, tSel, tAll, lang, narrow]);
  const neigh = useMemo(() => (sel != null ? E.neighbors(res, sel, 6) : []), [sel, res]);
  const groupF = useMemo(() => Float32Array.from(ds.gi), [ds]);
  const signals = useMemo(() => Array.from(order).filter(i => D[i] >= th && (!groups.size || groups.has(ds.gi[i]))), [order, th, groups]);

  // ракурси: камера сама підбирає відстань, щоб стовпці чи все кільце груп уміщалися в кадр за будь-яких пропорцій
  const view = m => {
    if (m === 'dash') return narrow ? { target: [0, -9, 0], fit: [38, 15, 2], yaw: 0, pitch: 0.08 } : { target: [0, 0.4, 0], fit: [39, 15, 2], yaw: 0, pitch: 0.1 };
    const bs = res.C.bases, ext = Math.max(...bs.map((b, k) => Math.hypot(b.c[0], b.c[2]) + E.shellRadius(res, method, k, th)));
    if (narrow) return { target: [0, 0, 0], fit: [ext * 2.15, ext * 1.9, 0], yaw: 0.5, pitch: cx === 'all' ? 0.6 : 1.0 };
    return cx === 'all' ? { target: [0, 0, 0], fit: [ext * 2.1, ext * 1.6, 0], yaw: 0.5, pitch: 0.36 } : { target: [0, 0, 0], fit: [ext * 2.05, ext * 1.25, ext * 0.6], yaw: 0.5, pitch: 0.52 };
  };
  const focus = gs => {
    if (mode !== 'cloud') return;
    if (gs.size === 1 && cx === 'group') {
      const k = [...gs][0], b = res.C.bases[k], sc = 0.7 + 0.3 * spread, r = E.shellRadius(res, method, k, th) * spread;
      flyTo({ target: [b.c[0] * sc, b.c[1] * sc, b.c[2] * sc], dist: r * 3.1 + 6, dur: 1.6 });
    } else flyTo({ ...view('cloud'), dur: 1.6 });
  };
  ctx.focusGroups = focus;

  // ракурс: одразу на старті, далі плавно при зміні режиму чи норми
  const firstView = useRef(true);
  useEffect(() => { flyTo({ ...view(mode), dur: firstView.current ? 0.01 : mode === 'cloud' ? 2.6 : 1.8 }); firstView.current = false; }, [mode, cx, narrow]);
  // знайомство: дашборд сам розкладається на записи, якщо сцену видно кілька секунд
  useEffect(() => {
    if (mode !== 'dash' || !box.current) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let timer = null;
    const io = new IntersectionObserver(es => {
      clearTimeout(timer);
      if (es[0].intersectionRatio > 0.55) timer = setTimeout(() => { if (!touched.current) setMode('cloud'); }, 3200);
    }, { threshold: [0, 0.55, 1] });
    io.observe(box.current);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [mode]);
  useEffect(() => {
    const ro = new ResizeObserver(es => setNarrow(es[0].contentRect.width < 700));
    box.current && ro.observe(box.current);
    const fs = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', fs);
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', fs); };
  }, []);

  const step = dir => {
    if (!signals.length) return;
    const k = sel != null ? signals.indexOf(sel) : -1;
    const next = signals[(k + dir + signals.length) % signals.length];
    setSel(next, { fly: true });
  };
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (box.current.requestFullscreen) box.current.requestFullscreen().catch(() => {});
  };
  const tip = i => {
    const x = ds.rows[i];
    return `<b>${esc(x.id)}</b><span>${esc(T.groupsShort[ds.groups[x.g].id])} · ${esc(f.uah(x.amount))}</span><em class="${D[i] >= th ? 'hot' : ''}">${esc(f.sigma(D[i]))}</em>`;
  };
  const totalSum = useMemo(() => ds.months.reduce((s, m) => s + m.sum, 0), [ds]);
  const planDev = useMemo(() => totalSum / ds.months.reduce((s, m) => s + m.plan, 0) - 1, [ds]);
  const height = full ? '100%' : narrow ? '64vh' : 'min(74vh, 720px)';

  return (
    <>
      <ModelBar ctx={ctx} />
      <FeatureChips ctx={ctx} />
      <section className={'an-scene glass' + (full ? ' is-full' : '') + (mode === 'dash' ? ' is-dash' : '')} ref={box} onPointerDown={() => { touched.current = true; }}>
        <div className="an-stage" style={{ height }}>
          {gl ? (
            <Cloud3D n={ds.n} pos={pos} dash={dash} mode={mode} spread={spread} D={D} th={th} groups={groupF} dim={dim} bases={bases} of={res.C.of}
              sel={sel} neigh={neigh} fly={fly} tour={tour} spin={spin && !tour} months={T.months} tip={tip} height="100%" label={T.scene.aria} api={api}
              onPick={i => setSel(i)} onTourEnd={() => setTour(false)} instant={false} />
          ) : (
            <Cloud2D ds={ds} pos={pos} D={D} th={th} dim={dim} bases={bases} sel={sel} onPick={i => setSel(i)} label={T.scene.aria} note={T.scene.noGl} />
          )}

          {mode === 'cloud' && (
            <div className="an-hud" aria-live="polite">
              <b>{f.int(count)}</b>
              <span>{T.signalsN(tSel.total)}</span>
              <small>{groups.size ? T.hudGroups(groups.size) + ' · ' : ''}{T.hudOf(f.int(ds.n), f.sigma(th))}</small>
            </div>
          )}

          <div className="an-tools">
            <div className="segmented glass-control an-mode" role="radiogroup" aria-label={T.scene.dash + ' / ' + T.scene.records}>
              {['dash', 'cloud'].map(m => <button type="button" key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'active' : ''} onClick={() => { touched.current = true; setTour(false); setMode(m); }}><Icon name={m === 'dash' ? 'bars' : 'cloud'} size={15} />{m === 'dash' ? T.scene.dash : T.scene.records}</button>)}
            </div>
            {gl && mode === 'cloud' && (
              <div className="an-tool-row">
                <button type="button" className={'icon-btn glass-control' + (tour ? ' on' : '')} title={tour ? T.scene.tourStop : T.scene.tour} aria-label={tour ? T.scene.tourStop : T.scene.tour} onClick={() => setTour(!tour)}><Icon name={tour ? 'pause' : 'play'} size={16} /></button>
                <button type="button" className="icon-btn glass-control" title={spin ? T.scene.pause : T.scene.spin} aria-label={spin ? T.scene.pause : T.scene.spin} onClick={() => setSpin(!spin)}><Icon name={spin ? 'pause' : 'reset'} size={16} /></button>
                <button type="button" className="icon-btn glass-control" title={T.scene.reset} aria-label={T.scene.reset} onClick={() => { setTour(false); flyTo({ ...view('cloud'), dur: 1.4 }); }}><Icon name="target" size={16} /></button>
                {!coarse && <button type="button" className="icon-btn glass-control" title={T.scene.zoomIn} aria-label={T.scene.zoomIn} onClick={() => api.current && api.current.zoom(0.6)}><Icon name="plus" size={16} /></button>}
                {!coarse && <button type="button" className="icon-btn glass-control" title={T.scene.zoomOut} aria-label={T.scene.zoomOut} onClick={() => api.current && api.current.zoom(1.6)}><Icon name="minus" size={16} /></button>}
                <button type="button" className="icon-btn glass-control" title={full ? T.scene.fullOff : T.scene.full} aria-label={full ? T.scene.fullOff : T.scene.full} onClick={toggleFull}><Icon name={full ? 'compress' : 'expand'} size={16} /></button>
              </div>
            )}
          </div>

          {mode === 'dash' && (
            <div className="an-dash glass">
              <span className="an-dash-kicker">{T.dashCard.title}</span>
              <div className="an-dash-kpis">
                {T.dashCard.kpis(f.int(ds.n), f.uahShort(totalSum), f.signedPct(planDev)).map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
              </div>
              <p>{T.dashCard.text}</p>
              <Button kind="primary" icon="cloud" onClick={() => { touched.current = true; setMode('cloud'); }}>{T.dashCard.go}</Button>
            </div>
          )}

          {mode === 'cloud' && (
            <div className="an-foot">
              <div className="an-legend">
                <span><i className="lg-rec" />{T.scene.legendRecord}</span>
                <span><i className="lg-sig" />{T.scene.legendSignal}</span>
                <span><i className="lg-shell" />{T.scene.legendShell}</span>
              </div>
              {gl && (
                <label className="an-spread">
                  <span>{T.scene.spread}</span>
                  <input type="range" min="0.6" max="1.8" step="0.05" value={spread} onChange={e => setSpread(Number(e.target.value))} aria-label={T.scene.spread} />
                </label>
              )}
              <p className="an-hint">{coarse ? T.scene.hintTouch : T.scene.hint}</p>
            </div>
          )}
        </div>
        <aside className="an-side">
          <RecordCard key={sel == null ? 'none' : sel} ctx={ctx} i={sel} onPrev={signals.length ? () => step(-1) : null} onNext={signals.length ? () => step(1) : null} />
        </aside>
      </section>
      <GroupChips ctx={ctx} counts={tAll.byG} />
    </>
  );
}
