// Графіки розділу: основний графік прогнозу (факт, модель на історії, перевірка, прогноз і коридори),
// мініатюри для каталогу і залишки. Неоновий стиль: сяйво ліній фільтром SVG, градієнти коридорів і площі під
// фактом, поява зліва направо, «маячки» на останньому факті й кінці прогнозу. Одна вісь, сірий факт, синій прогноз.
// Взаємодія: перехрестя з міткою значення на осі, підсвічування ряду з легенди, навігатор по всій історії.
import { useEffect, useMemo, useRef, useState } from 'react';
import { INK, GRID, BASE, SURFACE } from '../../chart-gallery/src/palette.js';

export const FC = '#3B82F6';
export const NEON = { sky: '#38BDF8', blue: '#3B82F6', violet: '#8B5CF6', cyan: '#22D3EE', silver: '#C9D0DA' };
// TRON: полярність «вище нуля / нижче нуля». cyan і orange перевірені валідатором палітри для темної теми
// (смуга світлоти, розрізнення при дальтонізмі); glow, ice й ember лише для сяйва, країв і проекцій
export const TRON = { cyan: '#119DBA', orange: '#E8661C', glow: '#22D3EE', ice: '#A5F3FC', ember: '#FB923C' };
const reduced = () => typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Унікальні id для градієнтів і фільтрів: на сторінці кілька графіків
let UID = 0;
export function useUid(prefix = 'fx') {
  const r = useRef(null);
  if (r.current == null) r.current = `${prefix}${++UID}`;
  return r.current;
}

export function useWidth(ref, fallback = 800) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(es => { const cw = Math.floor(es[0].contentRect.width); if (cw > 0) setW(cw); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

// Плавний перехід між двома наборами чисел однакової форми (прогноз перебудовується, а не стрибає)
export function useTween(vec, ms = 650) {
  const key = vec.map(v => (Number.isFinite(v) ? v.toFixed(4) : 'x')).join(',');
  const [cur, setCur] = useState(vec);
  const prev = useRef(vec), raf = useRef(0);
  useEffect(() => {
    const from = prev.current;
    if (reduced() || from.length !== vec.length) { prev.current = vec; setCur(vec); return undefined; }
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3;
      const v = vec.map((x, i) => (Number.isFinite(x) && Number.isFinite(from[i]) ? from[i] + (x - from[i]) * e : x));
      prev.current = v; setCur(v);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key]);
  return cur;
}

// «Гарні» поділки осі
export function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) { hi = lo + 1; }
  const span = hi - lo, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), r = step0 / mag;
  const step = (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
  for (let v = a; v <= b + step * 0.5; v += step) out.push(+v.toFixed(10));
  return out;
}

const pathOf = (pts) => {
  let d = '', pen = false;
  for (const [x, y] of pts) {
    if (!Number.isFinite(y)) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    pen = true;
  }
  return d;
};
const areaOf = (xs, lo, hi) => {
  const top = [], bot = [];
  xs.forEach((x, i) => { if (Number.isFinite(lo[i]) && Number.isFinite(hi[i])) { top.push([x, hi[i]]); bot.push([x, lo[i]]); } });
  if (top.length < 2) return '';
  return 'M' + top.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'L' + bot.reverse().map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
};
// Площа від лінії до низу області графіка (для градієнта під фактом)
const underOf = (pts, base) => {
  const ok = pts.filter(p => Number.isFinite(p[1]));
  if (ok.length < 2) return '';
  return 'M' + ok[0][0].toFixed(1) + ' ' + base.toFixed(1) + ok.map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + 'L' + ok[ok.length - 1][0].toFixed(1) + ' ' + base.toFixed(1) + 'Z';
};

// Заливка між лінією і нулем у стилі TRON: вище нуля холодна, нижче тепла, найяскравіша далі від нуля.
// zy: висота нуля (або край області, якщо нуль поза віссю), top і bot: межі області
export function ZeroFill({ id, pts, zy, top, bot, W, pos = TRON.glow, neg = TRON.ember, k = 1, className = '' }) {
  const ok = pts.filter(p => Number.isFinite(p[1]));
  if (ok.length < 2) return null;
  const d = areaOf(ok.map(p => p[0]), ok.map(() => zy), ok.map(p => p[1]));
  return (
    <g className={className}>
      <defs>
        <linearGradient id={`${id}-p`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={Math.max(top + 1, zy)}>
          <stop offset="0" stopColor={pos} stopOpacity={0.34 * k} /><stop offset=".6" stopColor={pos} stopOpacity={0.12 * k} /><stop offset="1" stopColor={pos} stopOpacity={0.03 * k} />
        </linearGradient>
        <linearGradient id={`${id}-n`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={zy} y2={Math.max(zy + 1, bot)}>
          <stop offset="0" stopColor={neg} stopOpacity={0.03 * k} /><stop offset=".4" stopColor={neg} stopOpacity={0.12 * k} /><stop offset="1" stopColor={neg} stopOpacity={0.34 * k} />
        </linearGradient>
        <clipPath id={`${id}-a`}><rect x={-10} y={top - 40} width={W + 20} height={Math.max(0, zy - top + 40)} /></clipPath>
        <clipPath id={`${id}-b`}><rect x={-10} y={zy} width={W + 20} height={Math.max(0, bot - zy + 40)} /></clipPath>
      </defs>
      {zy > top && <path d={d} fill={`url(#${id}-p)`} clipPath={`url(#${id}-a)`} />}
      {zy < bot && <path d={d} fill={`url(#${id}-n)`} clipPath={`url(#${id}-b)`} />}
    </g>
  );
}
// Короткий підпис дати для мітки на осі X
export const xLab = (d, freq, fmt) => (!d ? '' : freq === 'M' ? `${fmt.monShort(d)} ${d.slice(0, 4)}` : freq === 'Q' || freq === 'Y' ? fmt.dateLong(d, freq) : fmt.dateShort(d));

// Сяйво: два розмиття (вузьке й широке) під самою лінією. Межі фільтра в пікселях, щоб пласка лінія не обрізалася
export function Glow({ id, W, H, s1 = 2.4, s2 = 7, k = 1 }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x={-30} y={-30} width={W + 60} height={H + 60} colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={s2} result="wide" />
      <feGaussianBlur in="SourceGraphic" stdDeviation={s1} result="near" />
      <feComponentTransfer in="wide" result="wideA"><feFuncA type="linear" slope={0.75 * k} /></feComponentTransfer>
      <feMerge><feMergeNode in="wideA" /><feMergeNode in="near" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  );
}

// Підписи осі X за частотою ряду
export function xTicks(dates, from, to, freq, fmt) {
  const out = [];
  for (let i = from; i <= to; i++) {
    const d = dates[i];
    if (!d) continue;
    const [y, m, dd] = d.split('-').map(Number);
    if (freq === 'M' && m === 1) out.push({ i, label: String(y) });
    else if (freq === 'W' && (m - 1) % 3 === 0 && dd <= 7) out.push({ i, label: m === 1 ? String(y) : fmt.monShort(d) });
    else if (freq === 'D' && dd === 1) out.push({ i, label: m === 1 ? String(y) : fmt.monShort(d) });
    else if ((freq === 'Q' || freq === 'Y') && m === 1) out.push({ i, label: String(y) });
  }
  const span = to - from;
  if (out.length > 8) return out.filter((_, k) => k % Math.ceil(out.length / 8) === 0);
  // вузьке вікно (навігатор): дрібніші підписи замість років, без накладань
  if (out.length < 3 && span > 0) {
    const alt = [];
    if (freq === 'M') {
      const s = [1, 2, 3, 6].find(k => span / k <= 7) || 6;
      for (let i = from; i <= to; i++) { const d = dates[i]; if (!d) continue; const m = Number(d.slice(5, 7)); if ((m - 1) % s === 0) alt.push({ i, label: m === 1 ? d.slice(0, 4) : fmt.monShort(d) }); }
    } else {
      const s = Math.max(1, Math.ceil(span / 6));
      for (let i = from; i <= to; i += s) if (dates[i]) alt.push({ i, label: freq === 'Q' || freq === 'Y' ? fmt.dateLong(dates[i], freq) : fmt.dm(dates[i]) });
    }
    if (alt.length >= 2) return alt;
  }
  return out;
}

/*
  Основний графік.
  dates: дати історії й горизонту (історія n, далі h майбутніх)
  y: факт (n), fitted: модель на історії (n), fc: прогноз із коридорами (h)
  test: { from, fc } прогноз на відкладених даних, починаючи з індексу from
  overlays: [{ id, label, color, from, values }] додаткові лінії (порівняння моделей, сценарії)
  show: { fitted, test, band } що показувати; focus: ключ ряду, який підсвічено з легенди
  nav: навігатор під графіком; вікно від from до кінця прогнозу, тягнеться й змінює ширину
*/
export function ForecastChart({ dates, y, fitted, fc, test, overlays = [], show = {}, freq, fmt, T, height = 320, from = 0, label, marks = [], hideFuture = false, fcLabel, focus = null, nav = false }) {
  const ref = useRef(null), W = useWidth(ref), H = W < 560 ? Math.min(height, 260) : height;
  const u = useUid('fc');
  const n = y.length, h = hideFuture ? 0 : fc ? fc.length : 0, last = n - 1 + h;
  const showBand = show.band !== false;
  // вікно перегляду: за замовчуванням від from до кінця прогнозу; навігатор його рухає
  const [win, setWin] = useState([from, last]);
  const winKey = `${from}|${last}|${n}|${dates[0]}`;
  useEffect(() => { setWin([from, last]); }, [winKey]);
  const a = nav ? Math.max(0, Math.min(win[0], last - 3)) : from, b = nav ? Math.min(last, Math.max(win[1], a + 3)) : last;
  const M = { l: W < 560 ? 40 : 54, r: 12, t: 16, b: 26 };
  const fcVec = useTween(fc ? fc.flatMap(f => [f.mean, f.lo80, f.hi80, f.lo95, f.hi95]) : []);
  const tVec = useTween(test ? test.fc.flatMap(f => [f.mean, f.lo80, f.hi80]) : []);
  const fitVec = useTween(show.fitted && fitted ? fitted : []);
  const [hover, setHover] = useState(null);

  const ys = useMemo(() => {
    const v = [], add = x => { if (Number.isFinite(x)) v.push(x); };
    for (let i = a; i <= Math.min(b, n - 1); i++) add(y[i]);
    if (fc && h) {
      if (b >= n) add(y[n - 1]);
      for (let k = Math.max(0, a - n); k < h && n + k <= b; k++) { const f = fc[k]; add(f.mean); if (showBand) [f.lo95, f.hi95, f.lo80, f.hi80].forEach(add); }
    }
    if (test && show.test) test.fc.forEach((f, k) => { const i = test.from + k; if (i >= a && i <= b) [f.mean, f.lo80, f.hi80].forEach(add); });
    overlays.forEach(o => o.values.forEach((x, k) => { const i = o.from + k; if (i >= a && i <= b) add(x); }));
    if (show.fitted && fitted) for (let i = a; i <= Math.min(b, n - 1); i++) add(fitted[i]);
    if (!v.length) v.push(0, 1);
    let lo = Math.min(...v), hi = Math.max(...v);
    const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1;
    if (lo >= 0 && lo - pad < 0) lo = 0; else lo -= pad;
    return niceTicks(lo, hi + pad, H < 280 ? 4 : 5);
  }, [y, fc, test, overlays, fitted, show.fitted, show.test, showBand, a, b, h, H]);
  const y0 = ys[0], y1 = ys[ys.length - 1];
  const X = i => M.l + ((i - a) / Math.max(1, b - a)) * (W - M.l - M.r);
  const Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const ticks = xTicks(dates, a, b, freq, fmt), bottom = H - M.b;
  // «підлога» TRON: нуль, якщо він на осі, інакше край області
  const zy = y0 <= 0 && y1 >= 0 ? Y(0) : y1 < 0 ? M.t : bottom;

  const fut = Array.from({ length: h }, (_, k) => ({
    x: X(n + k), mean: fcVec[k * 5], lo80: fcVec[k * 5 + 1], hi80: fcVec[k * 5 + 2], lo95: fcVec[k * 5 + 3], hi95: fcVec[k * 5 + 4],
  }));
  // прогноз з’єднується з останньою точкою факту
  const anchor = [X(n - 1), Y(y[n - 1])];
  const futLine = h ? pathOf([anchor, ...fut.map(p => [p.x, Y(p.mean)])]) : '';
  const xsF = [X(n - 1), ...fut.map(p => p.x)];
  const band = (lo, hi) => areaOf(xsF, [y[n - 1], ...fut.map(p => lo(p))].map(Y), [y[n - 1], ...fut.map(p => hi(p))].map(Y));
  const tn = test ? test.fc.length : 0, tFrom = test ? test.from : 0;
  const tp = Array.from({ length: tn }, (_, k) => ({ x: X(tFrom + k), mean: tVec[k * 3], lo80: tVec[k * 3 + 1], hi80: tVec[k * 3 + 2] }));
  const tAnchor = test && tFrom > 0 ? [X(tFrom - 1), Y(y[tFrom - 1])] : null;
  const xsT = tAnchor ? [tAnchor[0], ...tp.map(p => p.x)] : tp.map(p => p.x);
  const tBand = test && show.test ? areaOf(xsT, (tAnchor ? [y[tFrom - 1]] : []).concat(tp.map(p => p.lo80)).map(Y), (tAnchor ? [y[tFrom - 1]] : []).concat(tp.map(p => p.hi80)).map(Y)) : '';
  // історію малюємо трохи ширше за вікно, щоб лінія не обривалася на краю
  const i0 = Math.max(0, a - 1), i1 = Math.min(n - 1, b + 1);
  const actPts = [];
  for (let i = i0; i <= i1; i++) actPts.push([X(i), Y(y[i])]);
  const fitPts = [];
  if (show.fitted && fitted) for (let i = i0; i <= i1; i++) fitPts.push([X(i), Y(fitVec[i])]);
  const dim = k => (focus && focus !== k && !(focus === 'fc' && k === 'band') ? ' dim' : '') + (focus === k ? ' lit' : '');
  const todayX = X(n - 1), todayIn = h > 0 && todayX >= M.l - 1 && todayX <= W - M.r + 1;
  const revealKey = `${dates[0]}|${n}|${label}`;

  const onMove = e => {
    const r = ref.current.getBoundingClientRect(), px = e.clientX - r.left;
    const i = Math.round(a + ((px - M.l) / Math.max(1, W - M.l - M.r)) * (b - a));
    setHover(i >= a && i <= b ? i : null);
  };
  const tip = hover == null ? null : (() => {
    const rows = [];
    let primary = null, bandAt = null;
    if (hover < n) {
      primary = y[hover];
      rows.push([T.legend.actual, fmt.val(y[hover]), 'actual']);
      if (show.fitted && fitted && Number.isFinite(fitted[hover])) rows.push([T.legend.fitted, fmt.val(fitted[hover]), 'fitted']);
      if (test && show.test && hover >= tFrom && hover < tFrom + tn) { const p = test.fc[hover - tFrom]; rows.push([T.legend.test + ': ' + T.legend.forecast.toLowerCase(), fmt.val(p.mean), 'fc']); if (Number.isFinite(p.lo80)) bandAt = [p.lo80, p.hi80]; }
      overlays.forEach(o => { const k = hover - o.from; if (k >= 0 && k < o.values.length && Number.isFinite(o.values[k])) rows.push([o.label, fmt.val(o.values[k]), o.color]); });
    } else {
      const p = fc[hover - n];
      primary = p.mean;
      rows.push([fcLabel || T.legend.forecast, fmt.val(p.mean), 'fc']);
      if (showBand && Number.isFinite(p.lo80)) { rows.push([T.legend.b80, `${fmt.val(p.lo80)} … ${fmt.val(p.hi80)}`, 'band']); bandAt = [p.lo80, p.hi80]; }
      if (showBand && Number.isFinite(p.lo95)) rows.push([T.legend.b95, `${fmt.val(p.lo95)} … ${fmt.val(p.hi95)}`, 'band2']);
      overlays.forEach(o => { const k = hover - o.from; if (k >= 0 && k < o.values.length && Number.isFinite(o.values[k])) rows.push([o.label, fmt.val(o.values[k]), o.color]); });
    }
    return { x: X(hover), date: fmt.dateLong(dates[hover], freq), rows, primary, bandAt };
  })();
  const dots = [];
  if (tip) {
    if (hover < n) {
      if (show.fitted && fitted && Number.isFinite(fitted[hover])) dots.push({ y: fitted[hover], c: 'fitted' });
      if (test && show.test && hover >= tFrom && hover < tFrom + tn) dots.push({ y: test.fc[hover - tFrom].mean, c: 'test' });
      overlays.forEach(o => { const k = hover - o.from; if (k >= 0 && k < o.values.length && Number.isFinite(o.values[k])) dots.push({ y: o.values[k], color: o.color }); });
      dots.push({ y: y[hover], c: 'actual' });
    } else {
      overlays.forEach(o => { const k = hover - o.from; if (k >= 0 && k < o.values.length && Number.isFinite(o.values[k])) dots.push({ y: o.values[k], color: o.color }); });
      dots.push({ y: fut[hover - n].mean, c: 'fc' });
    }
  }

  return (
    <div className={'fc-chart' + (focus ? ' has-focus' : '')} data-focus={focus || undefined}>
      <div className="fc-plot" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onDoubleClick={() => nav && setWin([from, last])}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
          <defs>
            <pattern id={`${u}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="rgba(255,255,255,0.015)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
            </pattern>
            <Glow id={`${u}-glow`} W={W} H={H} />
            <Glow id={`${u}-soft`} W={W} H={H} s1={1.6} s2={4} k={0.55} />
            <linearGradient id={`${u}-fcl`} gradientUnits="userSpaceOnUse" x1={todayX} x2={Math.max(todayX + 1, X(last))} y1="0" y2="0">
              <stop offset="0" stopColor={NEON.sky} /><stop offset=".5" stopColor={NEON.blue} /><stop offset="1" stopColor={NEON.violet} />
            </linearGradient>
            <linearGradient id={`${u}-b80`} gradientUnits="userSpaceOnUse" x1={todayX} x2={Math.max(todayX + 1, X(last))} y1="0" y2="0">
              <stop offset="0" stopColor={NEON.sky} stopOpacity=".42" /><stop offset="1" stopColor={NEON.violet} stopOpacity=".24" />
            </linearGradient>
            <linearGradient id={`${u}-b95`} gradientUnits="userSpaceOnUse" x1={todayX} x2={Math.max(todayX + 1, X(last))} y1="0" y2="0">
              <stop offset="0" stopColor={NEON.sky} stopOpacity=".18" /><stop offset="1" stopColor={NEON.violet} stopOpacity=".1" />
            </linearGradient>
            <linearGradient id={`${u}-zone`} gradientUnits="userSpaceOnUse" x1={todayX} x2={W - M.r} y1="0" y2="0">
              <stop offset="0" stopColor={NEON.blue} stopOpacity=".11" /><stop offset="1" stopColor={NEON.violet} stopOpacity=".03" />
            </linearGradient>
            <linearGradient id={`${u}-vline`} gradientUnits="userSpaceOnUse" x1="0" y1={M.t} x2="0" y2={bottom}>
              <stop offset="0" stopColor="#93C5FD" stopOpacity="0" /><stop offset=".25" stopColor="#93C5FD" stopOpacity=".75" /><stop offset=".75" stopColor="#93C5FD" stopOpacity=".75" /><stop offset="1" stopColor="#93C5FD" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${u}-plot`}><rect x={M.l} y={0} width={Math.max(0, W - M.l - M.r)} height={H} /></clipPath>
            <clipPath id={`${u}-rev`}><rect key={revealKey} className="fc-reveal" x="0" y="0" width={W} height={H} /></clipPath>
          </defs>
          {todayIn && todayX < W - M.r && <rect x={Math.max(M.l, todayX)} y={M.t} width={W - M.r - Math.max(M.l, todayX)} height={bottom - M.t} fill={`url(#${u}-zone)`} />}
          {ys.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} className="fc-grid" /><text x={M.l - 8} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt.axis(v)}</text></g>)}
          {ticks.map(t => <g key={t.i}><line x1={X(t.i)} x2={X(t.i)} y1={M.t} y2={bottom} className="fc-grid v" /><text x={X(t.i)} y={H - 7} textAnchor="middle" className="fc-xtick">{t.label}</text></g>)}
          <line x1={M.l} x2={W - M.r} y1={zy} y2={zy} className="fc-floor" filter={`url(#${u}-soft)`} />
          <g clipPath={`url(#${u}-plot)`}>
            {marks.map((m, k) => <rect key={k} x={X(m.a) - 2} y={M.t} width={Math.max(3, X(m.b) - X(m.a) + 4)} height={bottom - M.t} className={'fc-mark ' + (m.kind || '')} />)}
            {test && show.test && <g className={'fc-s' + dim('test')}>
              <rect x={X(tFrom) - (X(tFrom) - X(tFrom - 1)) / 2} y={M.t} width={X(n - 1) - X(tFrom) + (X(tFrom) - X(tFrom - 1))} height={bottom - M.t} fill={`url(#${u}-hatch)`} />
              <text x={X(tFrom) + 4} y={M.t + 12} className="fc-zone">{T.testZone}</text>
            </g>}
            <g clipPath={`url(#${u}-rev)`}>
              <ZeroFill id={`${u}-za`} pts={actPts} zy={zy} top={M.t} bot={bottom} W={W} className={'fc-s fc-under' + dim('actual')} />
              {h > 0 && <ZeroFill id={`${u}-zf`} pts={[anchor, ...fut.map(p => [p.x, Y(p.mean)])]} zy={zy} top={M.t} bot={bottom} W={W} pos={NEON.violet} k={1.1} className={'fc-s fc-under' + dim('fc')} />}
              {h > 0 && showBand && <path d={band(p => p.lo95, p => p.hi95)} fill={`url(#${u}-b95)`} className={'fc-s fc-b95' + dim('band')} />}
              {h > 0 && showBand && <path d={band(p => p.lo80, p => p.hi80)} fill={`url(#${u}-b80)`} className={'fc-s fc-b80' + dim('band')} />}
              {tBand && <path d={tBand} className={'fc-s fc-tband' + dim('test')} />}
              <path d={pathOf(actPts)} className={'fc-s fc-actual' + dim('actual')} filter={`url(#${u}-soft)`} />
              {fitPts.length > 0 && <path d={pathOf(fitPts)} className={'fc-s fc-fitted' + dim('fitted')} />}
              {test && show.test && <path d={pathOf([...(tAnchor ? [tAnchor] : []), ...tp.map(p => [p.x, Y(p.mean)])])} className={'fc-s fc-tline' + dim('test')} filter={`url(#${u}-soft)`} />}
              {overlays.map(o => <path key={o.id} d={pathOf([...(o.from > 0 ? [[X(o.from - 1), Y(y[o.from - 1])]] : []), ...o.values.map((v, k) => [X(o.from + k), Y(v)])])} className={'fc-s fc-overlay' + dim(o.id)} stroke={o.color} filter={`url(#${u}-soft)`} />)}
              {test && show.test && y.slice(tFrom).map((v, k) => <circle key={k} cx={X(tFrom + k)} cy={Y(v)} r={tn > 40 ? 1.8 : 3} className={'fc-s fc-testdot' + dim('test')} />)}
              {h > 0 && <path d={futLine} className={'fc-s fc-line' + dim('fc')} stroke={`url(#${u}-fcl)`} filter={`url(#${u}-glow)`} />}
              {h > 0 && <path d={futLine} className={'fc-s fc-core' + dim('fc')} />}
            </g>
          </g>
          {todayIn && <g className="fc-today-g">
            <line x1={todayX} x2={todayX} y1={M.t} y2={bottom} stroke={`url(#${u}-vline)`} className="fc-today-v" />
            {todayX < W - M.r - 50 && <g transform={`translate(${todayX + 6},${M.t - 2})`}><rect x="0" y="-9" width={fcTagW(T)} height="15" rx="7.5" className="fc-today-tag" /><text x={fcTagW(T) / 2} y="2" textAnchor="middle" className="fc-today-t">{T.legend.forecast} →</text></g>}
          </g>}
          {todayIn && Number.isFinite(y[n - 1]) && <g className={'fc-beacon' + dim('actual')} transform={`translate(${todayX.toFixed(1)},${Y(y[n - 1]).toFixed(1)})`}>
            <g key={revealKey} className="fc-beacon-in"><circle r="8" className="fc-beacon-ring" /><circle r="3.4" className="fc-beacon-dot" /></g>
          </g>}
          {h > 0 && X(last) <= W - M.r + 1 && Number.isFinite(fut[h - 1]?.mean) && <g className={'fc-beacon end' + dim('fc')} transform={`translate(${X(last).toFixed(1)},${Y(fut[h - 1].mean).toFixed(1)})`}>
            <g key={revealKey} className="fc-beacon-in"><circle r="9" className="fc-beacon-ring" /><circle r="3.8" className="fc-beacon-dot" /></g>
          </g>}
          {tip && <g pointerEvents="none" className={'fc-hover' + (hover >= n ? ' fut' : '')}>
            <line x1={tip.x} x2={tip.x} y1={M.t} y2={bottom} stroke={`url(#${u}-vline)`} strokeWidth="1" opacity=".45" />
            {Number.isFinite(tip.primary) && <g filter={`url(#${u}-soft)`}>
              <line x1={tip.x} x2={tip.x} y1={Y(tip.primary)} y2={bottom} className="fc-proj" />
              <line x1={M.l} x2={tip.x} y1={Y(tip.primary)} y2={Y(tip.primary)} className="fc-proj" />
              <rect x="-3.6" y="-3.6" width="7.2" height="7.2" transform={`translate(${tip.x.toFixed(1)},${bottom}) rotate(45)`} className="fc-pdia" />
              <rect x="-3.6" y="-3.6" width="7.2" height="7.2" transform={`translate(${M.l},${Y(tip.primary).toFixed(1)}) rotate(45)`} className="fc-pdia" />
            </g>}
            {tip.bandAt && <line x1={tip.x} x2={tip.x} y1={Y(tip.bandAt[0])} y2={Y(tip.bandAt[1])} className="fc-hband" />}
            {dots.map((d, k) => <circle key={k} cx={tip.x} cy={Y(d.y)} r={d.c === 'fc' || d.c === 'actual' ? 4.6 : 3.6} className={'fc-hdot ' + (d.c || '')} style={d.color ? { fill: d.color, '--dc': d.color } : null} filter={`url(#${u}-soft)`} />)}
            {Number.isFinite(tip.primary) && <g transform={`translate(0,${Y(tip.primary).toFixed(1)})`}>
              <rect x={2} y={-9} width={M.l - 6} height={18} rx={5} className={'fc-ychip' + (hover >= n ? ' fc' : '')} />
              <text x={M.l - 8} y={4} textAnchor="end" className="fc-ychip-t">{fmt.axis(tip.primary)}</text>
            </g>}
            {(() => {
              const xl = xLab(dates[hover], freq, fmt), xw = xl.length * 6.2 + 16, xc = Math.max(M.l + xw / 2, Math.min(W - M.r - xw / 2, tip.x));
              return <g transform={`translate(${xc.toFixed(1)},${H - 11})`}><rect x={-xw / 2} y={-9} width={xw} height={17} rx={5} className="fc-xchip" /><text y={3.6} textAnchor="middle" className="fc-ychip-t">{xl}</text></g>;
            })()}
          </g>}
        </svg>
        {tip && (
          <div className="fc-tip" style={tipPos(tip, W, H, M, Y)}>
            <strong>{tip.date}</strong>
            {tip.rows.map((r, k) => <span key={k}><i className={'fc-sw ' + (r[2].startsWith('#') ? '' : r[2])} style={r[2].startsWith('#') ? { background: r[2], '--sw': r[2] } : null} /><em className="fc-tip-l">{r[0]}</em><b>{r[1]}</b></span>)}
          </div>
        )}
      </div>
      {nav && W > 0 && <Navigator dates={dates} y={y} fc={h ? fc : null} n={n} last={last} a={a} b={b} W={W} M={M} setWin={setWin} reset={() => setWin([from, last])} isDefault={a === from && b === last} T={T} fmt={fmt} freq={freq} u={u} />}
    </div>
  );
}
const fcTagW = T => Math.max(62, (T.legend.forecast.length + 2) * 6.4);
// Бік підказки відносно позначки x: на широкому графіку поруч, на вузькому фіксованої ширини і не виходить за край
export function tipSide(x, W, d = 12) {
  if (W >= 520) return x > W * 0.55 ? { right: Math.max(4, W - x + d) } : { left: Math.max(4, x + d) };
  const w = Math.min(230, W - 8);
  if (x + d + w <= W - 4) return { left: x + d, width: w };
  if (x - d - w >= 4) return { left: x - d - w, width: w };
  return { left: Math.round((W - w) / 2), width: w };
}
// Підказка поруч із перехрестям; на вузькому екрані вона фіксованої ширини і стає туди, де не закриває точку
function tipPos(tip, W, H, M, Y) {
  if (W >= 520) return tip.x > W * 0.55 ? { right: Math.max(4, W - tip.x + 16) } : { left: Math.max(4, tip.x + 16) };
  const w = Math.min(250, W - 8), st = { width: w };
  if (tip.x + 14 + w <= W - 4) st.left = tip.x + 14;
  else if (tip.x - 14 - w >= 4) st.left = tip.x - 14 - w;
  else {
    st.left = Math.round((W - w) / 2);
    // точка вгорі: підказку вниз, над віссю
    if (Number.isFinite(tip.primary) && Y(tip.primary) < M.t + (H - M.t - M.b) * 0.5) { st.top = 'auto'; st.bottom = M.b + 6; }
  }
  return st;
}

// Навігатор: уся історія й прогноз дрібно, вікно перегляду тягнеться за середину й розширюється за краї
function Navigator({ dates, y, fc, n, last, a, b, W, M, setWin, reset, isDefault, T, fmt, freq, u }) {
  const NH = 46, top = 6, bot = NH - 6;
  const drag = useRef(null);
  const span = Math.max(1, last);
  const X = i => M.l + (i / span) * (W - M.l - M.r);
  const vals = [...y, ...(fc ? fc.map(f => f.mean) : [])].filter(Number.isFinite);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const Y = v => top + (1 - (v - lo) / (hi - lo || 1)) * (bot - top);
  const step = Math.max(1, Math.floor(n / Math.max(60, W - M.l - M.r)));
  const pts = [];
  for (let i = 0; i < n; i += step) pts.push([X(i), Y(y[i])]);
  pts.push([X(n - 1), Y(y[n - 1])]);
  const fpts = fc ? [[X(n - 1), Y(y[n - 1])], ...fc.map((f, k) => [X(n + k), Y(f.mean)])] : [];
  const minSpan = Math.max(6, Math.round(last * 0.04));
  const idxAt = px => ((px - M.l) / Math.max(1, W - M.l - M.r)) * span;
  const onDown = e => {
    const r = e.currentTarget.getBoundingClientRect(), px = e.clientX - r.left;
    const xa = X(a), xb = X(b);
    let mode = 'move';
    if (Math.abs(px - xa) <= 9) mode = 'l';
    else if (Math.abs(px - xb) <= 9) mode = 'r';
    else if (px < xa || px > xb) {
      // клік поза вікном переносить вікно туди, зберігаючи ширину
      const w = b - a, c = idxAt(px), na = Math.round(Math.max(0, Math.min(last - w, c - w / 2)));
      setWin([na, na + w]);
      drag.current = { mode: 'move', x0: px, a0: na, b0: na + w };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    drag.current = { mode, x0: px, a0: a, b0: b };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMoveN = e => {
    const d = drag.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect(), px = e.clientX - r.left;
    const di = Math.round(idxAt(px) - idxAt(d.x0));
    if (d.mode === 'move') { const w = d.b0 - d.a0, na = Math.max(0, Math.min(last - w, d.a0 + di)); setWin([na, na + w]); }
    else if (d.mode === 'l') setWin([Math.max(0, Math.min(d.b0 - minSpan, d.a0 + di)), d.b0]);
    else setWin([d.a0, Math.min(last, Math.max(d.a0 + minSpan, d.b0 + di))]);
  };
  const onUp = () => { drag.current = null; };
  const onKey = e => {
    const w = b - a, s = Math.max(1, Math.round(w * 0.1));
    if (e.key === 'ArrowLeft') { e.preventDefault(); const na = Math.max(0, a - s); setWin([na, na + w]); }
    if (e.key === 'ArrowRight') { e.preventDefault(); const na = Math.min(last - w, a + s); setWin([na, na + w]); }
    if (e.key === '-' ) { e.preventDefault(); setWin([Math.max(0, a - s), Math.min(last, b + s)]); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); if (w - 2 * s >= minSpan) setWin([a + s, b - s]); }
  };
  return (
    <div className="fc-nav">
      <svg width={W} height={NH} className="fc-nav-svg" role="slider" tabIndex={0} aria-label={T.navLabel} aria-valuemin={0} aria-valuemax={last} aria-valuenow={a}
        aria-valuetext={`${fmt.dateLong(dates[a], freq)} … ${fmt.dateLong(dates[b], freq)}`}
        onPointerDown={onDown} onPointerMove={onMoveN} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
        <defs>
          <linearGradient id={`${u}-nav`} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={bot}>
            <stop offset="0" stopColor={TRON.glow} stopOpacity=".24" /><stop offset="1" stopColor={TRON.glow} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${u}-navfc`} gradientUnits="userSpaceOnUse" x1={X(n - 1)} x2={Math.max(X(n - 1) + 1, X(last))} y1="0" y2="0">
            <stop offset="0" stopColor={NEON.sky} /><stop offset="1" stopColor={NEON.violet} />
          </linearGradient>
        </defs>
        <rect x={M.l} y={1} width={W - M.l - M.r} height={NH - 2} rx="6" className="fc-nav-bg" />
        <path d={underOf(pts, bot)} fill={`url(#${u}-nav)`} />
        <path d={pathOf(pts)} className="fc-nav-act" />
        {fpts.length > 1 && <path d={pathOf(fpts)} className="fc-nav-fc" stroke={`url(#${u}-navfc)`} />}
        <rect x={M.l} y={1} width={Math.max(0, X(a) - M.l)} height={NH - 2} className="fc-nav-shade" />
        <rect x={X(b)} y={1} width={Math.max(0, W - M.r - X(b))} height={NH - 2} className="fc-nav-shade" />
        <rect x={X(a)} y={1} width={Math.max(2, X(b) - X(a))} height={NH - 2} rx="5" className="fc-nav-win" />
        {[X(a), X(b)].map((x, k) => <g key={k} className="fc-nav-handle" transform={`translate(${x},${NH / 2})`}><rect x="-4" y="-12" width="8" height="24" rx="3" /><line x1="-1.2" x2="-1.2" y1="-5" y2="5" /><line x1="1.2" x2="1.2" y1="-5" y2="5" /></g>)}
      </svg>
      <div className="fc-nav-foot">
        <small>{T.navHint}</small>
        {!isDefault && <button type="button" className="fc-nav-reset" onClick={reset}>{T.navReset}</button>}
      </div>
    </div>
  );
}

// Легенда-перемикачі: наведення підсвічує ряд на графіку, клік ховає чи показує ряд (де це можна)
export function Legend({ items, focus, setFocus, className = '' }) {
  return (
    <div className={'fc-legend fc-lgd ' + className}>
      {items.map(it => {
        const sw = <i className={'fc-sw ' + (it.cls || '')} style={it.color ? { background: it.color, '--sw': it.color } : null} />;
        const cls = 'fc-lg' + (it.on === false ? ' off' : '') + (focus === it.key ? ' focus' : '');
        // схований ряд не підсвічується; після кліку підсвічування йде за новим станом
        const hov = setFocus ? { onMouseEnter: () => setFocus(it.on === false ? null : it.key), onMouseLeave: () => setFocus(null) } : {};
        const click = () => { it.toggle(); if (setFocus) setFocus(it.on === false ? it.key : null); };
        return it.toggle
          ? <button key={it.key} type="button" className={cls} aria-pressed={it.on !== false} onClick={click} onFocus={hov.onMouseEnter} onBlur={hov.onMouseLeave} {...hov}>{sw}{it.label}</button>
          : <span key={it.key} className={cls} {...hov}>{sw}{it.label}</span>;
      })}
    </div>
  );
}

// hidden і setHidden: які додаткові лінії сховано кліком (графік отримує лише видимі)
export function ChartLegend({ T, show, setShow, focus, setFocus, hasBand, hasTest, overlays = [], fcLabel, hidden = {}, setHidden }) {
  const tog = k => (setShow ? () => setShow(s => ({ ...s, [k]: s[k] === false ? true : !s[k] })) : null);
  const items = [{ key: 'actual', cls: 'actual', label: T.legend.actual }];
  if (setShow || show.fitted) items.push({ key: 'fitted', cls: 'fitted', label: T.legend.fitted, on: !!show.fitted, toggle: tog('fitted') });
  if (hasTest && (setShow || show.test)) items.push({ key: 'test', cls: 'test', label: T.legend.test, on: !!show.test, toggle: tog('test') });
  if (!overlays.length) items.push({ key: 'fc', cls: 'fc', label: fcLabel || T.legend.forecast });
  if (hasBand && !overlays.length) items.push({ key: 'band', cls: 'band', label: `${T.legend.b80} · ${T.legend.b95}`, on: show.band !== false, toggle: setShow ? () => setShow(s => ({ ...s, band: s.band === false })) : null });
  overlays.forEach(o => items.push({ key: o.id, color: o.color, label: o.label, ...(setHidden ? { on: !hidden[o.id], toggle: () => setHidden(h => ({ ...h, [o.id]: !h[o.id] })) } : {}) }));
  return <Legend items={items} focus={focus} setFocus={setFocus} />;
}

// Мініатюра для картки каталогу: кінець історії з площею, неоновий прогноз з коридором і маячком.
// hx: положення курсора над карткою (0..1), тоді показується сканер зі значенням
export function Spark({ y, fc, height = 62, hx = null, fmt }) {
  const ref = useRef(null), W = useWidth(ref, 260), u = useUid('sp');
  const n = y.length, tail = Math.min(n, Math.max(24, fc.length * 3)), from = n - tail, last = n - 1 + fc.length;
  const vals = [...y.slice(from), ...fc.flatMap(f => [f.mean, f.lo80, f.hi80])].filter(Number.isFinite);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const X = i => 4 + ((i - from) / Math.max(1, last - from)) * (W - 10), Y = v => 6 + (1 - (v - lo) / span) * (height - 12);
  const xs = [X(n - 1), ...fc.map((_, k) => X(n + k))];
  const bnd = areaOf(xs, [y[n - 1], ...fc.map(f => f.lo80)].map(Y), [y[n - 1], ...fc.map(f => f.hi80)].map(Y));
  const act = y.slice(from).map((v, i) => [X(from + i), Y(v)]);
  const fl = [[X(n - 1), Y(y[n - 1])], ...fc.map((f, k) => [X(n + k), Y(f.mean)])];
  const endY = Y(fc[fc.length - 1]?.mean);
  let scan = null;
  if (hx != null && W > 0) {
    const i = Math.max(from, Math.min(last, Math.round(from + hx * (last - from))));
    const v = i < n ? y[i] : fc[i - n].mean;
    if (Number.isFinite(v)) scan = { x: X(i), y: Y(v), v, fut: i >= n };
  }
  return (
    <div ref={ref} className="fc-spark-box">
      <svg className="fc-spark" width={W} height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden="true">
        <defs>
          <Glow id={`${u}-g`} W={W} H={height} s1={1.6} s2={4.5} />
          <linearGradient id={`${u}-a`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            <stop offset="0" stopColor={TRON.glow} stopOpacity=".26" /><stop offset="1" stopColor={TRON.glow} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${u}-w`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            <stop offset="0" stopColor={NEON.violet} stopOpacity=".34" /><stop offset="1" stopColor={NEON.violet} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${u}-l`} gradientUnits="userSpaceOnUse" x1={X(n - 1)} x2={X(last)} y1="0" y2="0">
            <stop offset="0" stopColor={NEON.sky} /><stop offset=".5" stopColor={NEON.blue} /><stop offset="1" stopColor={NEON.violet} />
          </linearGradient>
          <linearGradient id={`${u}-b`} gradientUnits="userSpaceOnUse" x1={X(n - 1)} x2={X(last)} y1="0" y2="0">
            <stop offset="0" stopColor={NEON.sky} stopOpacity=".38" /><stop offset="1" stopColor={NEON.violet} stopOpacity=".2" />
          </linearGradient>
        </defs>
        <rect x={X(n - 1)} y="0" width={Math.max(0, W - X(n - 1))} height={height} className="fc-sp-zone" />
        <path d={underOf(act, height)} fill={`url(#${u}-a)`} />
        <path d={underOf(fl, height)} fill={`url(#${u}-w)`} className="fc-sp-wall" />
        {bnd && <path d={bnd} fill={`url(#${u}-b)`} className="fc-sp-band" />}
        <path d={pathOf(act)} className="fc-sp-act" pathLength="1" />
        <path d={pathOf(fl)} className="fc-sp-fc" stroke={`url(#${u}-l)`} filter={`url(#${u}-g)`} pathLength="1" />
        {Number.isFinite(endY) && <g transform={`translate(${X(last).toFixed(1)},${endY.toFixed(1)})`} className="fc-sp-beacon"><g className="fc-beacon-in"><circle r="6" className="fc-beacon-ring" /><circle r="2.6" className="fc-beacon-dot" /></g></g>}
        {scan && <g className="fc-sp-scan">
          <line x1={scan.x} x2={scan.x} y1="2" y2={height - 2} />
          <circle cx={scan.x} cy={scan.y} r="3.4" className={scan.fut ? 'fut' : ''} filter={`url(#${u}-g)`} />
        </g>}
      </svg>
      {scan && fmt && <span className={'fc-sp-val' + (scan.fut ? ' fut' : '') + (scan.x > W * 0.6 ? ' left' : '')} style={scan.x > W * 0.6 ? { right: W - scan.x + 8 } : { left: scan.x + 8 }}>{fmt.axis(scan.v)}</span>}
    </div>
  );
}

// Залишки: стовпчики по часу і межі ±2σ; вихід за межі світиться, наведення показує дату й значення
export function Residuals({ y, fitted, dates, freq, fmt, T }) {
  const ref = useRef(null), W = useWidth(ref, 500), H = 130, u = useUid('rs');
  const [hov, setHov] = useState(null);
  const e = y.map((v, t) => (Number.isFinite(fitted[t]) ? v - fitted[t] : NaN));
  const ok = e.filter(Number.isFinite);
  if (ok.length < 3) return <div ref={ref} className="fc-resid fc-empty" />;
  const s = Math.sqrt(ok.reduce((a, v) => a + v * v, 0) / ok.length), lim = Math.max(...ok.map(Math.abs), 2 * s) * 1.05;
  const M = { l: 44, r: 8, t: 8, b: 20 }, n = y.length, bw = Math.max(1, (W - M.l - M.r) / n - 1);
  const X = i => M.l + (i / n) * (W - M.l - M.r), Y = v => M.t + (1 - (v + lim) / (2 * lim)) * (H - M.t - M.b);
  const ticks = xTicks(dates, 0, n - 1, freq, fmt);
  const onMove = ev => { const r = ref.current.getBoundingClientRect(), i = Math.floor(((ev.clientX - r.left - M.l) / (W - M.l - M.r)) * n); setHov(i >= 0 && i < n && Number.isFinite(e[i]) ? i : null); };
  return (
    <div ref={ref} className="fc-resid" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
      <svg width={W} height={H} role="img" aria-label={T.residTitle}>
        <defs>
          <Glow id={`${u}-g`} W={W} H={H} s1={1.4} s2={4} />
          <linearGradient id={`${u}-p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={TRON.cyan} stopOpacity=".85" /><stop offset="1" stopColor={TRON.cyan} stopOpacity=".3" /></linearGradient>
          <linearGradient id={`${u}-n`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={TRON.orange} stopOpacity=".85" /><stop offset="1" stopColor={TRON.orange} stopOpacity=".3" /></linearGradient>
        </defs>
        <rect x={M.l} y={Y(2 * s)} width={W - M.l - M.r} height={Math.max(0, Y(-2 * s) - Y(2 * s))} className="fc-sigma-zone" />
        <line x1={M.l} x2={W - M.r} y1={Y(0)} y2={Y(0)} className="fc-floor" />
        {[2 * s, -2 * s].map(v => <line key={v} x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} className="fc-sigma" />)}
        <text x={M.l - 6} y={Y(2 * s) + 4} textAnchor="end" className="fc-ytick">+2σ</text>
        <text x={M.l - 6} y={Y(-2 * s) + 4} textAnchor="end" className="fc-ytick">−2σ</text>
        {e.map((v, i) => {
          if (!Number.isFinite(v)) return null;
          const out = Math.abs(v) > 2 * s;
          return <rect key={i} x={X(i)} y={Math.min(Y(0), Y(v))} width={bw} height={Math.max(0.5, Math.abs(Y(v) - Y(0)))} rx={bw > 4 ? 1.5 : 0}
            className={'fc-rbar' + (out ? ' out' : '') + (hov === i ? ' on' : '')} fill={out ? (v >= 0 ? TRON.glow : TRON.ember) : `url(#${u}-${v >= 0 ? 'p' : 'n'})`} filter={out || hov === i ? `url(#${u}-g)` : null} />;
        })}
        {ticks.map(t => <text key={t.i} x={X(t.i)} y={H - 5} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
      </svg>
      {hov != null && (
        <div className="fc-tip fc-tip-sm" style={X(hov) > W * 0.5 ? { right: Math.max(4, W - X(hov) + 10) } : { left: Math.max(4, X(hov) + bw + 10) }}>
          <strong>{fmt.dateLong(dates[hov], freq)}</strong>
          <span><i className="fc-sw" style={{ background: e[hov] >= 0 ? TRON.glow : TRON.ember, '--sw': e[hov] >= 0 ? TRON.glow : TRON.ember }} /><em className="fc-tip-l">{T.residWord || 'e'}</em><b>{fmt.signed(e[hov])}</b></span>
        </div>
      )}
    </div>
  );
}

export { pathOf, areaOf, underOf, INK, GRID, BASE, SURFACE };
