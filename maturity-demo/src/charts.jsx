// Графіки оцінки: пелюсткова діаграма (зараз проти цілі), смуги вимірів з рискою цілі, сходинки рівнів.
// Одна серія кольору Cobalt; ціль нейтральна пунктирна, бо це орієнтир, а не друга серія.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../dashboard/src/icons.jsx';
import { DIMS, gapShown } from './model.js';
import { DIM_ICON } from './icons.js';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Плавний перехід масиву чисел (morph пелюсток і смуг при зміні відповідей).
export function useTween(values, ms = 700) {
  const safe = values.map(v => (v == null ? 0 : v));
  const [cur, setCur] = useState(() => (reduced() ? safe : safe.map(() => 0)));
  const now = useRef(cur);
  const raf = useRef(0);
  const key = safe.join(',');
  useEffect(() => {
    if (reduced()) { now.current = safe; setCur(safe); return undefined; }
    const a = now.current.slice();
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = t => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = safe.map((x, i) => (a[i] ?? 0) + (x - (a[i] ?? 0)) * e);
      now.current = v;
      setCur(v);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key]);
  return cur;
}

const ang = i => -Math.PI / 2 + (i * 2 * Math.PI) / DIMS.length;
const pt = (cx, cy, r, i) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
const poly = (cx, cy, R, vals) => vals.map((v, i) => pt(cx, cy, (R * Math.max(0, v)) / 5, i).map(n => n.toFixed(1)).join(',')).join(' ');

export function Radar({ S, T, f, hl, setHl, mini = false, label, onPick }) {
  const W = mini ? 240 : 400, H = mini ? 220 : 340;
  const cx = W / 2, cy = mini ? 108 : 168, R = mini ? 78 : 118;
  const vals = useTween(DIMS.map(d => S.dims[d].avg));
  const tgt = useTween(DIMS.map(d => S.target[d]), 500);
  const known = DIMS.map(d => S.dims[d].avg != null);
  return (
    <svg className={'mt-radar' + (mini ? ' mini' : '')} viewBox={`0 0 ${W} ${H}`} role={mini ? 'img' : 'group'} aria-label={label}>
      {[1, 2, 3, 4, 5].map(l => <polygon key={l} points={poly(cx, cy, R, DIMS.map(() => l))} className={'rd-ring' + (l === 5 ? ' outer' : '')} />)}
      {DIMS.map((d, i) => { const [x, y] = pt(cx, cy, R, i); return <line key={d} x1={cx} y1={cy} x2={x} y2={y} className={'rd-axis' + (hl === d ? ' on' : '')} />; })}
      {!mini && [1, 2, 3, 4, 5].map(l => <text key={l} x={cx + 4} y={cy - (R * l) / 5 + 3.5} className="rd-tick">{l}</text>)}
      <polygon points={poly(cx, cy, R, tgt)} className="rd-target" />
      <polygon points={poly(cx, cy, R, vals)} className="rd-now" />
      {DIMS.map((d, i) => {
        if (!known[i]) return null;
        const [x, y] = pt(cx, cy, (R * vals[i]) / 5, i);
        return <circle key={d} cx={x} cy={y} r={hl === d ? 5.5 : mini ? 3 : 4} className={'rd-dot' + (hl === d ? ' on' : '')} />;
      })}
      {DIMS.map((d, i) => {
        const [x, y] = pt(cx, cy, R + (mini ? 13 : 24), i);
        const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
        const dy = y < cy - R * 0.6 ? -2 : y > cy + R * 0.6 ? 8 : 3;
        const x2 = anchor === 'start' ? x - 2 : anchor === 'end' ? x + 2 : x;
        const x3 = x2 + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0);
        return (
          <g key={d} className={'rd-label' + (hl === d ? ' on' : '') + (onPick || setHl ? ' live' : '')} tabIndex={mini ? undefined : 0} role={mini ? undefined : 'button'}
            aria-label={mini ? undefined : `${T.dims[d].name}: ${known[i] ? f.dec1(S.dims[d].avg) : '?'} / ${T.target} ${S.target[d]}`}
            onMouseEnter={() => setHl && setHl(d)} onMouseLeave={() => setHl && setHl(null)} onFocus={() => setHl && setHl(d)} onBlur={() => setHl && setHl(null)}
            onClick={() => onPick && onPick(d)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && onPick) { e.preventDefault(); onPick(d); } }}>
            <text x={x3} y={y + dy} textAnchor={anchor} className="rd-name">{T.dims[d].short}</text>
            {!mini && <text x={x3} y={y + dy + 15} textAnchor={anchor} className="rd-val"><tspan className="rd-v">{known[i] ? f.dec1(S.dims[d].avg) : '·'}</tspan><tspan className="rd-t"> / {S.target[d]}</tspan></text>}
          </g>
        );
      })}
    </svg>
  );
}

export function RadarLegend({ T }) {
  return (
    <div className="legend-row mt-legend">
      <span><i className="lg-now" />{T.you}</span>
      <span><i className="lg-target" />{T.target}</span>
    </div>
  );
}

// Статус розриву: на цілі, невеликий розрив, великий розрив. Колір завжди з підписом.
export const gapLevel = g => (g <= 0.05 ? 'healthy' : g <= 1 ? 'warning' : 'critical');

export function DimBars({ S, T, f, hl, setHl, onPick }) {
  const vals = useTween(DIMS.map(d => S.dims[d].avg));
  return (
    <ul className="mt-bars">
      {DIMS.map((d, i) => {
        const x = S.dims[d];
        const g = gapShown(x);
        const lv = gapLevel(g);
        return (
          <li key={d} className={hl === d ? 'on' : ''} onMouseEnter={() => setHl(d)} onMouseLeave={() => setHl(null)}>
            <button type="button" className="mt-bar-row" onClick={() => onPick && onPick(d)} onFocus={() => setHl(d)} onBlur={() => setHl(null)}
              aria-label={`${T.dims[d].name}: ${f.dec1(x.avg)} ${T.ofFive}, ${T.target} ${x.target}`}>
              <span className="mt-bar-name"><Icon name={DIM_ICON[d]} size={16} /><span>{T.dims[d].name}</span></span>
              <span className="mt-bar-track" aria-hidden="true">
                {[1, 2, 3, 4].map(k => <i key={k} className="mt-bar-grid" style={{ left: k * 20 + '%' }} />)}
                <span className="mt-bar-fill" style={{ width: (vals[i] / 5) * 100 + '%' }} />
                <span className="mt-bar-target" style={{ left: (x.target / 5) * 100 + '%' }} />
              </span>
              <span className="mt-bar-val">{f.dec1(x.avg)}</span>
              <span className={'status ' + lv}>{g <= 0.05 ? T.gapOk : T.gapN(f.dec1(g))}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Сходинки рівнів 1..5: де організація зараз і де ціль.
export function Stairs({ level, tLevel, T }) {
  const W = 300, H = 158, sw = 52, gap = 6, base = 154;
  const hOf = l => 22 + (l - 1) * 27;
  // маркер «ви тут» піднімається сходинками від першого рівня до поточного
  const pos = Math.max(1, useTween([level], 1100)[0]);
  const markX = 4 + (pos - 1) * (sw + gap) + sw / 2;
  const markY = base - hOf(pos) - 8;
  return (
    <svg className="mt-stairs" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${T.levelWord} ${level}: ${T.levels[level - 1].name}. ${T.targetWord}: ${tLevel}`}>
      {[1, 2, 3, 4, 5].map(l => {
        const x = 4 + (l - 1) * (sw + gap), h = hOf(l);
        return (
          <g key={l} className={'st-step' + (l < level ? ' past' : l === level ? ' now' : '') + (l === tLevel ? ' tgt' : '')}>
            <rect x={x} y={base - h} width={sw} height={h} rx="3" />
            <text x={x + sw / 2} y={base - h + 17} textAnchor="middle" className="st-n">{l}</text>
            {l === tLevel && <g className="st-flag" transform={`translate(${x + sw - 13} ${base - h - 17})`}><path d="M1 15V1h9l-2 3.5L10 8H1" /></g>}
          </g>
        );
      })}
      <g className="st-mark" transform={`translate(${markX.toFixed(1)} ${markY.toFixed(1)})`}>
        <circle r="5" className="st-pulse" />
        <circle r="4" className="st-dot" />
      </g>
    </svg>
  );
}
