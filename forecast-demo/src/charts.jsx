// Графіки розділу: основний графік прогнозу (факт, модель на історії, перевірка, прогноз і коридори),
// мініатюри для каталогу і залишки. Одна вісь, сірий факт, синій прогноз, коридори тим самим відтінком.
import { useEffect, useMemo, useRef, useState } from 'react';
import { INK, GRID, BASE, SURFACE } from '../../chart-gallery/src/palette.js';

export const FC = '#3B82F6';
const reduced = () => typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  if (out.length < 2) { const step = Math.max(1, Math.round(span / 5)); for (let i = from; i <= to; i += step) if (dates[i]) out.push({ i, label: fmt.dateShort(dates[i]) }); }
  return out;
}

/*
  Основний графік.
  dates: дати історії й горизонту (історія n, далі h майбутніх)
  y: факт (n), fitted: модель на історії (n), fc: прогноз із коридорами (h)
  test: { from, fc } прогноз на відкладених даних, починаючи з індексу from
  overlays: [{ id, label, color, from, values }] додаткові лінії (порівняння моделей)
*/
export function ForecastChart({ dates, y, fitted, fc, test, overlays = [], show = {}, freq, fmt, T, height = 320, from = 0, label, marks = [], hideFuture = false, fcLabel }) {
  const ref = useRef(null), W = useWidth(ref), H = W < 560 ? Math.min(height, 260) : height;
  const n = y.length, h = hideFuture ? 0 : fc ? fc.length : 0, to = n - 1 + h;
  const M = { l: W < 560 ? 40 : 54, r: 12, t: 12, b: 26 };
  const fcVec = useTween(fc ? fc.flatMap(f => [f.mean, f.lo80, f.hi80, f.lo95, f.hi95]) : []);
  const tVec = useTween(test ? test.fc.flatMap(f => [f.mean, f.lo80, f.hi80]) : []);
  const fitVec = useTween(show.fitted && fitted ? fitted.slice(from) : []);
  const [hover, setHover] = useState(null);

  const ys = useMemo(() => {
    const v = y.slice(from).filter(Number.isFinite);
    if (fc && !hideFuture) fc.forEach(f => { [f.mean, f.lo95, f.hi95, f.lo80, f.hi80].forEach(x => { if (Number.isFinite(x)) v.push(x); }); });
    if (test && show.test) test.fc.forEach(f => { [f.mean, f.lo80, f.hi80].forEach(x => { if (Number.isFinite(x)) v.push(x); }); });
    overlays.forEach(o => o.values.forEach(x => { if (Number.isFinite(x)) v.push(x); }));
    if (show.fitted && fitted) fitted.slice(from).forEach(x => { if (Number.isFinite(x)) v.push(x); });
    let lo = Math.min(...v), hi = Math.max(...v);
    const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1;
    if (lo >= 0 && lo - pad < 0) lo = 0; else lo -= pad;
    return niceTicks(lo, hi + pad, H < 280 ? 4 : 5);
  }, [y, fc, test, overlays, fitted, show.fitted, show.test, from, hideFuture, H]);
  const y0 = ys[0], y1 = ys[ys.length - 1];
  const X = i => M.l + ((i - from) / Math.max(1, to - from)) * (W - M.l - M.r);
  const Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const ticks = xTicks(dates, from, to, freq, fmt);

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

  const onMove = e => {
    const r = ref.current.getBoundingClientRect(), px = e.clientX - r.left;
    const i = Math.round(from + ((px - M.l) / Math.max(1, W - M.l - M.r)) * (to - from));
    setHover(i >= from && i <= to ? i : null);
  };
  const tip = hover == null ? null : (() => {
    const rows = [];
    if (hover < n) {
      rows.push([T.legend.actual, fmt.val(y[hover]), 'actual']);
      if (show.fitted && fitted && Number.isFinite(fitted[hover])) rows.push([T.legend.fitted, fmt.val(fitted[hover]), 'fitted']);
      if (test && show.test && hover >= tFrom && hover < tFrom + tn) { const p = test.fc[hover - tFrom]; rows.push([T.legend.test + ': ' + T.legend.forecast.toLowerCase(), fmt.val(p.mean), 'fc']); }
      overlays.forEach(o => { const k = hover - o.from; if (k >= 0 && k < o.values.length && Number.isFinite(o.values[k])) rows.push([o.label, fmt.val(o.values[k]), o.color]); });
    } else {
      const p = fc[hover - n];
      rows.push([fcLabel || T.legend.forecast, fmt.val(p.mean), 'fc']);
      if (Number.isFinite(p.lo80)) rows.push([T.legend.b80, `${fmt.val(p.lo80)} … ${fmt.val(p.hi80)}`, 'band']);
      if (Number.isFinite(p.lo95)) rows.push([T.legend.b95, `${fmt.val(p.lo95)} … ${fmt.val(p.hi95)}`, 'band2']);
      overlays.forEach(o => { const k = hover - o.from; if (k >= 0 && k < o.values.length && Number.isFinite(o.values[k])) rows.push([o.label, fmt.val(o.values[k]), o.color]); });
    }
    return { x: X(hover), date: fmt.dateLong(dates[hover], freq), rows };
  })();

  return (
    <div className="fc-chart" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <pattern id="fc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(255,255,255,0.015)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
          </pattern>
        </defs>
        {ys.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={GRID} /><text x={M.l - 8} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt.axis(v)}</text></g>)}
        {ticks.map(t => <text key={t.i} x={X(t.i)} y={H - 7} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
        {marks.map((m, k) => <rect key={k} x={X(m.a) - 2} y={M.t} width={Math.max(3, X(m.b) - X(m.a) + 4)} height={H - M.t - M.b} className={'fc-mark ' + (m.kind || '')} />)}
        {test && show.test && <g>
          <rect x={X(tFrom) - (X(tFrom) - X(tFrom - 1)) / 2} y={M.t} width={X(n - 1) - X(tFrom) + (X(tFrom) - X(tFrom - 1))} height={H - M.t - M.b} fill="url(#fc-hatch)" />
          <text x={X(tFrom) + 4} y={M.t + 12} className="fc-zone">{T.testZone}</text>
        </g>}
        {h > 0 && <line x1={X(n - 1)} x2={X(n - 1)} y1={M.t} y2={H - M.b} className="fc-today" />}
        {h > 0 && <path d={band(p => p.lo95, p => p.hi95)} className="fc-b95" />}
        {h > 0 && <path d={band(p => p.lo80, p => p.hi80)} className="fc-b80" />}
        {tBand && <path d={tBand} className="fc-tband" />}
        <path d={pathOf(y.slice(from).map((v, i) => [X(from + i), Y(v)]))} className="fc-actual" />
        {show.fitted && fitted && <path d={pathOf(fitVec.map((v, i) => [X(from + i), Y(v)]))} className="fc-fitted" />}
        {test && show.test && <path d={pathOf([...(tAnchor ? [tAnchor] : []), ...tp.map(p => [p.x, Y(p.mean)])])} className="fc-tline" />}
        {overlays.map(o => <path key={o.id} d={pathOf([...(o.from > 0 ? [[X(o.from - 1), Y(y[o.from - 1])]] : []), ...o.values.map((v, k) => [X(o.from + k), Y(v)])])} className="fc-overlay" stroke={o.color} />)}
        {test && show.test && y.slice(tFrom).map((v, k) => <circle key={k} cx={X(tFrom + k)} cy={Y(v)} r={tn > 40 ? 1.8 : 3} className="fc-testdot" />)}
        {h > 0 && <path d={futLine} className="fc-line" />}
        {tip && <g pointerEvents="none">
          <line x1={tip.x} x2={tip.x} y1={M.t} y2={H - M.b} className="fc-cross" />
          {hover < n ? <circle cx={tip.x} cy={Y(y[hover])} r="4" className="fc-hdot" /> : <circle cx={tip.x} cy={Y(fut[hover - n].mean)} r="4.5" className="fc-hdot fc" />}
        </g>}
      </svg>
      {tip && (
        <div className="fc-tip" style={tip.x > W * 0.55 ? { right: Math.max(4, W - tip.x + 14) } : { left: Math.max(4, tip.x + 14) }}>
          <strong>{tip.date}</strong>
          {tip.rows.map((r, k) => <span key={k}><i className={'fc-sw ' + (r[2].startsWith('#') ? '' : r[2])} style={r[2].startsWith('#') ? { background: r[2] } : null} />{r[0]}<b>{r[1]}</b></span>)}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ T, show, hasBand, hasTest, overlays = [] }) {
  return (
    <div className="fc-legend">
      <span><i className="fc-sw actual" />{T.legend.actual}</span>
      {show.fitted && <span><i className="fc-sw fitted" />{T.legend.fitted}</span>}
      {hasTest && show.test && <span><i className="fc-sw test" />{T.legend.test}</span>}
      {!overlays.length && <span><i className="fc-sw fc" />{T.legend.forecast}</span>}
      {hasBand && !overlays.length && <span><i className="fc-sw band" />{T.legend.b80}</span>}
      {hasBand && !overlays.length && <span><i className="fc-sw band2" />{T.legend.b95}</span>}
      {overlays.map(o => <span key={o.id}><i className="fc-sw" style={{ background: o.color }} />{o.label}</span>)}
    </div>
  );
}

// Мініатюра для картки каталогу: кінець історії і прогноз з коридором
export function Spark({ y, fc, width = 260, height = 70 }) {
  const n = y.length, tail = Math.min(n, Math.max(24, fc.length * 3)), from = n - tail;
  const vals = [...y.slice(from), ...fc.flatMap(f => [f.mean, f.lo80, f.hi80])].filter(Number.isFinite);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const X = i => 2 + ((i - from) / (n - 1 + fc.length - from)) * (width - 4), Y = v => 4 + (1 - (v - lo) / span) * (height - 8);
  const xs = [X(n - 1), ...fc.map((_, k) => X(n + k))];
  const b = areaOf(xs, [y[n - 1], ...fc.map(f => f.lo80)].map(Y), [y[n - 1], ...fc.map(f => f.hi80)].map(Y));
  return (
    <svg className="fc-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {b && <path d={b} className="fc-b80" />}
      <path d={pathOf(y.slice(from).map((v, i) => [X(from + i), Y(v)]))} className="fc-actual" vectorEffect="non-scaling-stroke" />
      <path d={pathOf([[X(n - 1), Y(y[n - 1])], ...fc.map((f, k) => [X(n + k), Y(f.mean)])])} className="fc-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Залишки: стовпчики по часу і межі ±2σ
export function Residuals({ y, fitted, dates, freq, fmt, T }) {
  const ref = useRef(null), W = useWidth(ref, 500), H = 130;
  const e = y.map((v, t) => (Number.isFinite(fitted[t]) ? v - fitted[t] : NaN));
  const ok = e.filter(Number.isFinite);
  if (ok.length < 3) return <div ref={ref} className="fc-resid fc-empty" />;
  const s = Math.sqrt(ok.reduce((a, v) => a + v * v, 0) / ok.length), lim = Math.max(...ok.map(Math.abs), 2 * s) * 1.05;
  const M = { l: 44, r: 8, t: 8, b: 20 }, n = y.length, bw = Math.max(1, (W - M.l - M.r) / n - 1);
  const X = i => M.l + (i / n) * (W - M.l - M.r), Y = v => M.t + (1 - (v + lim) / (2 * lim)) * (H - M.t - M.b);
  const ticks = xTicks(dates, 0, n - 1, freq, fmt);
  return (
    <div ref={ref} className="fc-resid">
      <svg width={W} height={H} role="img" aria-label={T.residTitle}>
        <line x1={M.l} x2={W - M.r} y1={Y(0)} y2={Y(0)} stroke={BASE} />
        {[2 * s, -2 * s].map(v => <line key={v} x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} className="fc-sigma" />)}
        <text x={M.l - 6} y={Y(2 * s) + 4} textAnchor="end" className="fc-ytick">+2σ</text>
        <text x={M.l - 6} y={Y(-2 * s) + 4} textAnchor="end" className="fc-ytick">−2σ</text>
        {e.map((v, i) => (Number.isFinite(v) ? <rect key={i} x={X(i)} y={Math.min(Y(0), Y(v))} width={bw} height={Math.max(0.5, Math.abs(Y(v) - Y(0)))} className={'fc-rbar' + (Math.abs(v) > 2 * s ? ' out' : '')} /> : null))}
        {ticks.map(t => <text key={t.i} x={X(t.i)} y={H - 5} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
      </svg>
    </div>
  );
}

export { pathOf, areaOf, INK, GRID, BASE, SURFACE };
