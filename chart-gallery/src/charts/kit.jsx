// Спільні частини графіків: шкали з «круглими» поділками, підписи з явними атрибутами (щоб SVG можна було
// зберегти як файл), підказка, легенда, форми стовпчиків із заокругленим кінцем даних і квадратною основою.
import { useState } from 'react';
import { useWidth } from '../../../dashboard/src/charts.jsx';
import { INK, GRID, BASE, SURFACE } from '../palette.js';
export { useWidth };

export const FONT = "Inter, 'Segoe UI', Arial, sans-serif";

export function niceStep(range, count) {
  const raw = range / Math.max(1, count), mag = 10 ** Math.floor(Math.log10(raw || 1)), r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
}
export function niceScale(lo, hi, count = 5, zero = true) {
  if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (hi === lo) hi = lo + (Math.abs(lo) || 1);
  const step = niceStep(hi - lo, count);
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let v = a; v <= b + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
  return { lo: a, hi: b, ticks, step };
}
export const scale = (d0, d1, r0, r1) => v => r0 + (r1 - r0) * ((v - d0) / (d1 - d0 || 1));

// Ширина тексту без вимірювання: середня ширина символу Inter 11px близько 6,1px
export const textW = (s, size = 11) => String(s).length * size * 0.56;
export const fit = (s, px, size = 11) => { s = String(s); const max = Math.floor(px / (size * 0.56)); return s.length <= max ? s : max <= 1 ? '' : s.slice(0, max - 1) + '…'; };

// Перенесення підпису на кілька рядків за словами (для SVG без foreignObject)
export function wrap(s, px, size = 11, lines = 3) {
  const words = String(s).split(/\s+/), out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textW(t, size) <= px || !cur) cur = t; else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = fit(out[lines - 1] + '…', px, size); }
  return out.map(l => fit(l, px, size));
}
export function Txt({ x, y, children, anchor = 'start', size = 11, color = INK.muted, weight = 400, base, ...rest }) {
  return <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color} fontWeight={weight} fontFamily={FONT} dominantBaseline={base} {...rest}>{children}</text>;
}
export const HLine = ({ x1, x2, y, color = GRID }) => <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth="1" shapeRendering="crispEdges" />;
export const VLine = ({ x, y1, y2, color = GRID, w = 1 }) => <line x1={x} x2={x} y1={y1} y2={y2} stroke={color} strokeWidth={w} shapeRendering="crispEdges" />;

// Вертикальний стовпчик: квадратна основа на y0, заокруглений кінець даних на y1
export function colPath(x, w, y0, y1, r = 4) {
  if (Math.abs(y1 - y0) < 0.5) return '';
  const up = y1 < y0, rr = Math.min(r, w / 2, Math.abs(y1 - y0));
  if (up) return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`;
}
// Горизонтальна смуга: основа на x0, кінець на x1
export function barPath(y, h, x0, x1, r = 4) {
  if (Math.abs(x1 - x0) < 0.5) return '';
  const right = x1 > x0, rr = Math.min(r, h / 2, Math.abs(x1 - x0));
  if (right) return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`;
  return `M${x0},${y}H${x1 + rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 + rr},${y + h}H${x0}Z`;
}
// Маркер точки за формою (друга ознака групи поруч із кольором)
export function Marker({ shape = 'circle', x, y, r = 4.5, fill, ring = SURFACE, opacity = 1 }) {
  const common = { fill, fillOpacity: opacity, stroke: ring, strokeWidth: 2, paintOrder: 'stroke' };
  if (shape === 'square') return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx="1.5" {...common} />;
  if (shape === 'diamond') return <path d={`M${x},${y - r * 1.25}L${x + r * 1.25},${y}L${x},${y + r * 1.25}L${x - r * 1.25},${y}Z`} {...common} />;
  return <circle cx={x} cy={y} r={r} {...common} />;
}

// Підказка: значення головне, назва серії другорядна; ключ серії коротким штрихом
export function Tip({ tip, w }) {
  if (!tip) return null;
  const side = tip.x < w * 0.3 ? ' tip-l' : tip.x > w * 0.7 ? ' tip-r' : '';
  return (
    <div className={'chart-tip cg-tip' + side} style={{ left: tip.x, top: tip.y }} role="status">
      {tip.title && <b>{tip.title}</b>}
      {tip.rows.map((r, k) => (
        <span key={k} className="cg-tip-row">
          {r.color && <i className={r.dot ? 'dot' : ''} style={{ background: r.color }} />}
          <strong>{r.value}</strong>{r.label && <small>{r.label}</small>}
        </span>
      ))}
      {tip.note && <small className="cg-tip-note">{tip.note}</small>}
    </div>
  );
}
export function useTip() { const [tip, setTip] = useState(null); return [tip, setTip]; }

// Легенда: для двох і більше серій; форма ключа повторює позначку (смуга, лінія, точка)
export function Legend({ items, kind = 'box' }) {
  if (!items || items.length < 2) return null;
  return (
    <div className="cg-legend" aria-label="legend">
      {items.map((it, k) => (
        <span key={k}><i className={'k-' + (it.kind || kind) + (it.shape ? ' s-' + it.shape : '')} style={{ background: it.color, color: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}

// Обгортка: SVG з ролью зображення, підказка поверх, легенда під графіком
export function Frame({ refEl, w, h, label, tip, legend, children, onLeave, className = '', mini, svgProps = {} }) {
  return (
    <div className={'chart cg-chart ' + className} ref={refEl}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} onPointerLeave={onLeave} xmlns="http://www.w3.org/2000/svg" {...svgProps}>{children}</svg>
      {!mini && <Tip tip={tip} w={w} />}
      {!mini && legend}
    </div>
  );
}

// Поділки осі часу: перші числа місяців з кроком, щоб підписи не злипались
export function monthTicks(d0, d1, px, ymd, dayOf) {
  const [y0, m0] = ymd(d0), out = [];
  for (let y = y0, m = m0; ; ) {
    const day = dayOf(y, m, 1);
    if (day > d1) break;
    if (day >= d0) out.push({ day, m, y });
    m++; if (m > 12) { m = 1; y++; }
  }
  const per = Math.max(1, Math.ceil(out.length / Math.max(2, Math.floor(px / 54))));
  const step = [1, 2, 3, 4, 6, 12].find(s => s >= per) || 12;
  return out.filter(t => (t.m - 1) % step === 0);
}
export { INK, GRID, BASE, SURFACE };
