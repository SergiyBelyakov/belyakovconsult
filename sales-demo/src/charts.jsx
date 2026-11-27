// Спільні графіки демо: пружинна анімація, підказка, міст прибутку з перетягуванням, вибір періоду,
// лінійний графік з перехрестям, розбіжні смуги і число, що «докручується». Неон: сяйво SVG-фільтром.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUid, useWidth, niceTicks, Glow } from '../../forecast-demo/src/charts.jsx';
import { TOT0, TOT1, POS, NEG } from './colors.js';

export { useUid, useWidth, niceTicks, Glow };
export const reduced = () => typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = (ms = 6) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* немає вібрації */ } };

// Пружина з легким перельотом: значення «доїжджають» і трохи гойдаються, а не стрибають
export function useSpring(target, { stiff = 190, damp = 19, immediate = false } = {}) {
  const key = target.map(v => (Number.isFinite(v) ? v.toPrecision(6) : 'x')).join(',');
  const [cur, setCur] = useState(target);
  const s = useRef({ x: target.slice(), v: target.map(() => 0), raf: 0 });
  useEffect(() => {
    const st = s.current;
    cancelAnimationFrame(st.raf);
    if (immediate || reduced() || st.x.length !== target.length) { st.x = target.slice(); st.v = target.map(() => 0); setCur(target.slice()); return undefined; }
    const scale = Math.max(1e-9, ...target.map(v => Math.abs(v) || 0)) * 2e-4;
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(0.034, (now - last) / 1000); last = now;
      let moving = false;
      for (let i = 0; i < target.length; i++) {
        if (!Number.isFinite(target[i])) { st.x[i] = target[i]; continue; }
        if (!Number.isFinite(st.x[i])) st.x[i] = target[i];
        const a = -stiff * (st.x[i] - target[i]) - damp * st.v[i];
        st.v[i] += a * dt; st.x[i] += st.v[i] * dt;
        if (Math.abs(st.v[i]) * 0.02 > scale || Math.abs(st.x[i] - target[i]) > scale) moving = true;
      }
      if (!moving) { st.x = target.slice(); st.v = target.map(() => 0); }
      setCur(st.x.slice());
      if (moving) st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(st.raf);
  }, [key, immediate]);
  // інша довжина (змінилася кількість рядів чи стовпців): одразу нове значення, без проміжного кадру
  return cur.length === target.length ? cur : target;
}

// Число, яке докручується до нового значення
export function Num({ value, fmt, className }) {
  const [v] = useSpring([value], { stiff: 120, damp: 18 });
  return <span className={className}>{fmt(v)}</span>;
}

// Підказка поруч із курсором; на вузькому екрані фіксованої ширини і не виходить за край
export function Tip({ tip, W }) {
  if (!tip) return null;
  const w = Math.min(260, W - 8), right = tip.x > W * 0.56;
  const st = W < 520 ? { left: Math.max(4, Math.min(W - w - 4, tip.x - w / 2)), top: tip.y + 18, width: w } : right ? { right: W - tip.x + 14, top: tip.y } : { left: tip.x + 14, top: tip.y };
  return (
    <div className="sm-tip" style={st} role="status">
      {tip.title && <b>{tip.title}</b>}
      {tip.rows && tip.rows.map((r, i) => (
        <span key={i} className="sm-tip-row">{r.color && <i style={{ background: r.color }} />}<em>{r.label}</em><strong>{r.value}</strong></span>
      ))}
      {tip.note && <small>{tip.note}</small>}
    </div>
  );
}

// Міст прибутку (водоспад): підсумки з краю, впливи посередині. Наближення осі з розривом стовпців підсумку,
// підсвічування, вибір впливу, перетягування кінця стовпця (сценарій) і «привид» фактичних значень.
export function Bridge({ steps, fmtV, fmtTick, height = 340, selected, onSelect, drag = {}, ghost = null, zoom = true, base, T, compact = false, dragging, setDragging }) {
  const ref = useRef(null), W = useWidth(ref, 760), id = useUid('br');
  const [hv, setHv] = useState(null), [tip, setTip] = useState(null);
  const vals = useSpring(steps.map(s => s.value), { immediate: !!dragging });
  const n = steps.length, narrow = W < 560;
  const M = { l: compact ? 8 : narrow ? 40 : 58, r: 10, t: compact ? 18 : 28, b: compact ? 26 : narrow ? 50 : 46 };
  const H = height, ph = H - M.t - M.b, band = (W - M.l - M.r) / n, bw = Math.min(compact ? 40 : 66, band * (narrow ? 0.7 : 0.62));
  // рівні: кінці кожного стовпця
  const lv = []; let run = 0;
  vals.forEach((v, i) => { const s = steps[i]; if (s.total) { lv.push([0, v]); run = v; } else { lv.push([run, run + v]); run += v; } });
  const tv = steps.map(s => s.value); const lvT = []; let r2 = 0;
  tv.forEach((v, i) => { if (steps[i].total) { lvT.push([0, v]); r2 = v; } else { lvT.push([r2, r2 + v]); r2 += v; } });
  // «привид»: рівні фактичного мосту, коли поверх показано сценарій
  const gl = ghost ? (() => { const out = []; let r = 0; steps.forEach(s => { const v = ghost[s.id] ?? s.value; if (s.total) { out.push([0, v]); r = v; } else { out.push([r, r + v]); r += v; } }); return out; })() : null;
  const ext = lvT.flatMap((p, i) => (steps[i].total ? [p[1]] : p)).concat(gl ? gl.flatMap((p, i) => (steps[i].total ? [p[1]] : p)) : []);
  const lo0 = Math.min(...ext), hi0 = Math.max(...ext), span = Math.max(1e-9, hi0 - lo0, Math.max(Math.abs(lo0), Math.abs(hi0)) * 0.06);
  const lo = zoom ? Math.max(Math.min(0, lo0), lo0 - span * 0.55) : Math.min(0, lo0), hi = hi0 + span * 0.14;
  const [dLo, dHi] = useSpring([lo, hi], { stiff: 120, damp: 20 });
  const y = v => M.t + ph * (1 - (v - dLo) / (dHi - dLo || 1));
  const inv = py => dLo + (1 - (py - M.t) / ph) * (dHi - dLo);
  const ticks = niceTicks(dLo, dHi, compact ? 3 : 5).filter(t => t >= dLo && t <= dHi);
  const cx = i => M.l + band * i + band / 2;
  const onDown = (e, i) => {
    const s = steps[i], dd = drag[s.id]; if (!dd) return;
    e.preventDefault(); e.stopPropagation();
    const svg = ref.current.querySelector('svg'), rect = svg.getBoundingClientRect(), startLv = lv[i][0];
    let lastSnap = Math.round(s.value / (dd.snap || 1));
    setDragging && setDragging(s.id); buzz(8);
    const move = ev => {
      const v = Math.max(dd.min ?? -Infinity, Math.min(dd.max ?? Infinity, inv(ev.clientY - rect.top) - startLv));
      const sn = Math.round(v / (dd.snap || 1)); if (sn !== lastSnap) { lastSnap = sn; buzz(4); }
      dd.onDrag(v);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setDragging && setDragging(null); buzz(10); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const show = (e, i) => {
    const r = ref.current.getBoundingClientRect(), s = steps[i];
    setHv(i);
    if (compact) return;
    setTip({ x: e.clientX - r.left, y: Math.max(8, e.clientY - r.top - 60), title: s.label, rows: [
      { label: s.total ? T.br.level : T.br.effect, value: s.total ? fmtV(s.value) : fmtV(s.value, true), color: s.color },
      ...(base && !s.total ? [{ label: T.br.ofBase, value: (s.value >= 0 ? '+' : '−') + Math.abs(s.value / base * 100).toFixed(1).replace('.', T.locale.startsWith('uk') ? ',' : '.') + '%' }] : []),
    ], note: s.note });
  };
  return (
    <div className={'sm-bridge' + (compact ? ' compact' : '')} ref={ref} onPointerLeave={() => { setHv(null); setTip(null); }}>
      <svg width={W} height={H} role="img" aria-label={T.br.aria}>
        <defs>
          <Glow id={id + 'g'} W={W} H={H} s1={2.2} s2={9} k={1.1} />
          {steps.map((s, i) => (
            <linearGradient key={i} id={id + 'f' + i} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity={s.total ? 0.95 : 0.9} /><stop offset="1" stopColor={s.color} stopOpacity={s.total ? 0.42 : 0.34} />
            </linearGradient>
          ))}
          <pattern id={id + 'h'} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.22)" strokeWidth="1.2" /></pattern>
        </defs>
        {!compact && ticks.map(t => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'sm-zero' : 'sm-grid'} />
            <text x={M.l - 8} y={y(t) + 3.5} className="sm-axis" textAnchor="end">{fmtTick(t)}</text>
          </g>
        ))}
        {/* сполучні лінії між стовпцями */}
        {lv.slice(0, -1).map((p, i) => <line key={'c' + i} x1={cx(i) + bw / 2} x2={cx(i + 1) - bw / 2} y1={y(p[1])} y2={y(p[1])} className="sm-conn" />)}
        {steps.map((s, i) => {
          const [a, b] = lv[i], top = y(Math.max(a, b)), bot = s.total ? M.t + ph : y(Math.min(a, b)), h = Math.max(2, bot - top);
          const on = hv === i || selected === s.id, dim = (hv != null || selected) && !on;
          const up = s.total || b >= a, dd = drag[s.id], hy = up ? top : top + h;
          const g = gl ? gl[i] : null;
          return (
            <g key={s.id} className={'sm-bar' + (on ? ' on' : '') + (dim ? ' dim' : '') + (s.total ? ' total' : '') + (dragging === s.id ? ' grab' : '')}
              onPointerMove={e => show(e, i)} onClick={() => onSelect && onSelect(selected === s.id ? null : s.id)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              <rect x={cx(i) - band / 2} y={M.t} width={band} height={ph} fill="transparent" />
              {g && (() => { const gt = y(Math.max(g[0], g[1])), gb = s.total ? M.t + ph : y(Math.min(g[0], g[1])); return <rect x={cx(i) - bw / 2 - 4} y={gt} width={bw + 8} height={Math.max(2, gb - gt)} rx="5" className="sm-ghost" />; })()}
              <rect x={cx(i) - bw / 2} y={top} width={bw} height={h} rx="4" fill={`url(#${id}f${i})`} stroke={s.color} strokeWidth={on ? 1.8 : 1.1} filter={on || s.total ? `url(#${id}g)` : undefined} className="sm-bar-r" />
              {s.total && zoom && dLo > 0 && <path d={`M${cx(i) - bw / 2 - 2} ${M.t + ph - 9}l${bw / 4} -5l${bw / 4} 5l${bw / 4} -5l${bw / 4 + 4} 5`} className="sm-break" />}
              {s.total && <rect x={cx(i) - bw / 2} y={top} width={bw} height={h} rx="4" fill={`url(#${id}h)`} opacity={i === 0 ? 0.5 : 0} />}
              {!compact && !narrow && <text x={cx(i)} y={up ? top - 8 : top + h + 15} className="sm-val" textAnchor="middle">{s.total ? fmtV(s.value) : fmtV(s.value, true)}</text>}
              {(compact || narrow) && <text x={cx(i)} y={up ? top - 5 : top + h + 11} className={'sm-val' + (compact ? ' sm' : ' md')} textAnchor="middle">{s.total ? fmtTick(s.value) : (s.value >= 0 ? '+' : '−') + fmtTick(Math.abs(s.value))}</text>}
              <text x={cx(i)} y={H - M.b + (compact ? 15 : 18)} className={'sm-lab' + (on ? ' on' : '')} textAnchor="middle">
                {(narrow || compact ? s.short || s.label : s.label).split('\n').map((ln, k) => <tspan key={k} x={cx(i)} dy={k ? 13 : 0}>{ln}</tspan>)}
              </text>
              {dd && !compact && (
                <g className="sm-handle" transform={`translate(${cx(i)},${hy})`} onPointerDown={e => onDown(e, i)} role="slider" aria-label={s.label} aria-valuenow={Math.round(s.value)} tabIndex={0}
                  onKeyDown={e => { const st = (dd.step || 1) * (e.shiftKey ? 5 : 1); if (e.key === 'ArrowUp') { e.preventDefault(); dd.onDrag(Math.min(dd.max ?? Infinity, s.value + st)); } if (e.key === 'ArrowDown') { e.preventDefault(); dd.onDrag(Math.max(dd.min ?? -Infinity, s.value - st)); } }}>
                  <circle r="16" className="sm-handle-hit" />
                  <rect x={-14} y={-5} width="28" height="10" rx="5" className="sm-handle-pill" />
                  <path d="M-4 -1.5h8M-4 1.5h8" className="sm-handle-grip" />
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} W={W} />
    </div>
  );
}

// Вибір періоду: місяці поточного року з виручкою (привид: той самий місяць торік), перетягування меж і всього вікна
export function PeriodBar({ months, values, values0, a, b, setRange, fmt, T, presets }) {
  const ref = useRef(null), W = useWidth(ref, 760), H = 74;
  const n = months.length, M = { l: 6, r: 6 }, band = (W - M.l - M.r) / n;
  const max = Math.max(...values, ...values0) || 1;
  const [drag, setDrag] = useState(null);
  const idx = px => Math.max(0, Math.min(n - 1, Math.floor((px - M.l) / band)));
  const down = (e, mode) => {
    e.preventDefault();
    const r = ref.current.getBoundingClientRect(), i0 = idx(e.clientX - r.left), A = a, B = b;
    setDrag(mode); buzz(6);
    let last = null;
    const move = ev => {
      const i = idx(ev.clientX - r.left);
      let na = A, nb = B;
      if (mode === 'a') na = Math.min(i, B); else if (mode === 'b') nb = Math.max(i, A);
      else if (mode === 'move') { const d = Math.max(-A, Math.min(n - 1 - B, i - i0)); na = A + d; nb = B + d; }
      else { na = Math.min(i0, i); nb = Math.max(i0, i); }
      const k = na + ':' + nb;
      if (k !== last) { last = k; buzz(3); setRange(na, nb); }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setDrag(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    if (mode === 'new') setRange(i0, i0);
  };
  const x0 = M.l + a * band, x1 = M.l + (b + 1) * band;
  return (
    <div className="sm-period">
      <div className="sm-period-top">
        <span className="sm-period-label">{T.period.label}</span>
        <strong>{T.period.range(a, b, fmt)}</strong>
        <span className="sm-period-vs">{T.period.vs}</span>
        <div className="sm-presets">
          {presets.map(p => <button type="button" key={p.id} className={'sm-chip sm' + (p.a === a && p.b === b ? ' on' : '')} onClick={() => { setRange(p.a, p.b); buzz(5); }}>{p.label}</button>)}
        </div>
      </div>
      <div className={'sm-period-track' + (drag ? ' dragging' : '')} ref={ref}>
        <svg width={W} height={H} onPointerDown={e => down(e, 'new')} role="img" aria-label={T.period.aria}>
          {months.map((t, i) => {
            const h1 = (values[i] / max) * (H - 26), h0 = (values0[i] / max) * (H - 26), inR = i >= a && i <= b;
            return (
              <g key={t} className={'sm-pm' + (inR ? ' in' : '')}>
                <rect x={M.l + i * band + band * 0.18} y={H - 18 - h0} width={band * 0.64} height={h0} rx="2" className="sm-pm0" />
                <rect x={M.l + i * band + band * 0.28} y={H - 18 - h1} width={band * 0.44} height={h1} rx="2" className="sm-pm1" />
                <text x={M.l + i * band + band / 2} y={H - 4} textAnchor="middle" className="sm-axis">{fmt.mon(t)}</text>
              </g>
            );
          })}
          <rect x={x0} y={2} width={x1 - x0} height={H - 20} rx="6" className="sm-brush" onPointerDown={e => { e.stopPropagation(); down(e, 'move'); }} />
          {[['a', x0], ['b', x1]].map(([m, x]) => (
            <g key={m} className="sm-brush-h" transform={`translate(${x},${(H - 18) / 2})`} onPointerDown={e => { e.stopPropagation(); down(e, m); }}>
              <rect x={-9} y={-24} width="18" height="48" fill="transparent" />
              <rect x={-3.5} y={-15} width="7" height="30" rx="3.5" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// Лінійний графік за місяцями: кілька рядів, заливка між двома рядами, перехрестя з підказкою, вибір місяця
export function LineChart({ xs, series, fillBetween = null, height = 260, yFmt, xFmt, T, onPick, picked, zeroLine = true, tipTitle }) {
  const ref = useRef(null), W = useWidth(ref, 760), id = useUid('lc');
  const [hx, setHx] = useState(null);
  const narrow = W < 560, M = { l: narrow ? 42 : 54, r: 14, t: 16, b: 28 }, H = height, ph = H - M.t - M.b;
  const all = series.flatMap(s => s.values).filter(Number.isFinite);
  const t0 = niceTicks(Math.min(zeroLine ? 0 : Infinity, ...all), Math.max(...all), 5);
  const [lo, hi] = useSpring([t0[0], t0[t0.length - 1]], { stiff: 120, damp: 20 });
  const vs = useSpring(series.flatMap(s => s.values));
  const x = i => M.l + ((W - M.l - M.r) * i) / Math.max(1, xs.length - 1), y = v => M.t + ph * (1 - (v - lo) / (hi - lo || 1));
  const vals = series.map((s, k) => vs.slice(k * xs.length, (k + 1) * xs.length));
  const path = v => v.map((d, i) => (Number.isFinite(d) ? (i && Number.isFinite(v[i - 1]) ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d).toFixed(1) : '')).join('');
  const ticks = niceTicks(lo, hi, 5).filter(t => t >= lo - 1e-9 && t <= hi + 1e-9);
  const between = fillBetween && (() => { const [p, q] = fillBetween, A = vals[p], B = vals[q]; return 'M' + A.map((d, i) => x(i).toFixed(1) + ' ' + y(d).toFixed(1)).join('L') + 'L' + B.map((d, i) => x(i).toFixed(1) + ' ' + y(d).toFixed(1)).reverse().join('L') + 'Z'; })();
  const move = e => { const r = ref.current.getBoundingClientRect(), px = e.clientX - r.left; setHx(Math.max(0, Math.min(xs.length - 1, Math.round((px - M.l) / ((W - M.l - M.r) / Math.max(1, xs.length - 1)))))); };
  const tip = hx != null ? { x: x(hx), y: 10, title: tipTitle ? tipTitle(hx) : xFmt(xs[hx]), rows: series.map((s, k) => ({ label: s.label, value: s.fmt ? s.fmt(series[k].values[hx]) : yFmt(series[k].values[hx]), color: s.color })) } : null;
  return (
    <div className="sm-line" ref={ref} onPointerMove={move} onPointerLeave={() => setHx(null)} onClick={() => onPick && hx != null && onPick(hx)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
      <svg width={W} height={H} role="img" aria-label={series.map(s => s.label).join(', ')}>
        <defs>
          <Glow id={id + 'g'} W={W} H={H} s1={2} s2={7} />
          <linearGradient id={id + 'b'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={series[fillBetween ? fillBetween[0] : 0]?.color} stopOpacity=".34" /><stop offset="1" stopColor={series[fillBetween ? fillBetween[1] : 0]?.color} stopOpacity=".16" /></linearGradient>
        </defs>
        {ticks.map(t => <g key={t}><line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={Math.abs(t) < 1e-12 ? 'sm-zero' : 'sm-grid'} /><text x={M.l - 8} y={y(t) + 3.5} textAnchor="end" className="sm-axis">{yFmt(t)}</text></g>)}
        {xs.map((t, i) => (narrow && i % 2 ? null : <text key={t} x={x(i)} y={H - 8} textAnchor="middle" className={'sm-axis' + (picked === i ? ' on' : '')}>{xFmt(t)}</text>))}
        {between && <path d={between} fill={`url(#${id}b)`} className="sm-between" />}
        {vals.map((v, k) => <path key={k} d={path(v)} fill="none" stroke={series[k].color} strokeWidth={series[k].width || 2.2} strokeDasharray={series[k].dash} strokeLinejoin="round" strokeLinecap="round" filter={series[k].glow === false ? undefined : `url(#${id}g)`} className="sm-path" />)}
        {picked != null && <line x1={x(picked)} x2={x(picked)} y1={M.t} y2={M.t + ph} className="sm-picked" />}
        {hx != null && <line x1={x(hx)} x2={x(hx)} y1={M.t} y2={M.t + ph} className="sm-cross" />}
        {hx != null && vals.map((v, k) => Number.isFinite(v[hx]) && <circle key={k} cx={x(hx)} cy={y(v[hx])} r="4.5" fill={series[k].color} className="sm-dot" />)}
      </svg>
      <Tip tip={tip} W={W} />
    </div>
  );
}

// Розбіжні смуги: внесок кожної групи, нуль посередині. Ширини анімуються пружною кривою CSS.
export function DivBars({ rows, fmtV, onPick, picked, color, max: max0, T, limit = 12 }) {
  const [all, setAll] = useState(false);
  const list = all ? rows : rows.slice(0, limit);
  const max = max0 || Math.max(1e-9, ...rows.map(r => Math.abs(r.value)));
  return (
    <div className="sm-div">
      {list.map(r => {
        const w = (Math.abs(r.value) / max) * 50, pos = r.value >= 0, c = color ? color(r) : pos ? POS : NEG;
        return (
          <button type="button" key={r.key} className={'sm-div-row' + (picked === r.key ? ' on' : '')} onClick={() => onPick && onPick(r.key)} disabled={!onPick}>
            <span className="sm-div-name">{r.label}{r.sub && <small>{r.sub}</small>}</span>
            <span className="sm-div-track"><i style={{ width: w + '%', left: pos ? '50%' : 50 - w + '%', background: `linear-gradient(${pos ? 90 : 270}deg, ${c}55, ${c})`, boxShadow: `0 0 12px ${c}66` }} /></span>
            <span className={'sm-div-val ' + (pos ? 'pos' : 'neg')}>{fmtV(r.value)}</span>
          </button>
        );
      })}
      {rows.length > limit && <button type="button" className="link-btn sm-more" onClick={() => setAll(!all)}>{all ? T.less : T.more(rows.length - limit)}</button>}
    </div>
  );
}

// Легенда-перемикач
export function Legend({ items, hidden = {}, toggle }) {
  return (
    <div className="sm-legend">
      {items.map(it => (
        <button type="button" key={it.id} className={'sm-leg' + (hidden[it.id] ? ' off' : '')} onClick={() => toggle && toggle(it.id)} disabled={!toggle} style={{ '--lc': it.color }}>
          <i className={it.dash ? 'dash' : ''} />{it.label}
        </button>
      ))}
    </div>
  );
}

export const TOTALS = { TOT0, TOT1 };
export function useRaf(cb, on) {
  const r = useRef(cb); r.current = cb;
  useEffect(() => { if (!on) return undefined; let id = 0, last = performance.now(); const f = t => { r.current(t - last); last = t; id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); return () => cancelAnimationFrame(id); }, [on]);
}
export const useMemoDeep = (fn, deps) => useMemo(fn, deps);
