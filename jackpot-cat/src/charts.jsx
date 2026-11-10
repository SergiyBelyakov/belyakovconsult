// Графіки розборів і журналу на SVG. Один колір для даних, рубіновий лише для того, на що треба дивитися
// (ваш результат, аудит); підписи кольором тексту, сітка тиха, значення під курсором у рядку під графіком.
import { useEffect, useRef, useState } from 'react';

// Ширина графіка дорівнює ширині блока: підписи лишаються читабельними й на телефоні
function useWidth(key = 0) {
  const ref = useRef(null), [w, setW] = useState(520);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const fit = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  return [ref, w];
}
// стовпчик із заокругленим верхом і прямою основою
const barPath = (x, y, w, h, r) => { const q = Math.min(r, h, w / 2); return `M${x} ${y + h}V${y + q}Q${x} ${y} ${x + q} ${y}H${x + w - q}Q${x + w} ${y} ${x + w} ${y + q}V${y + h}Z`; };
const px = (e, W) => { const r = e.currentTarget.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };

// Гістограма: bins лічильники, axis { min, max, bins }, mark { x, label } (ви), refLine { x, label } (за таблицею)
export function Hist({ bins, axis, ticks, fmt, mark, refLine, tip, caption, height = 132, label }) {
  const [hover, setHover] = useState(-1), [ref, W] = useWidth();
  const m = { l: 10, r: 10, t: 24, b: 22 }, pw = W - m.l - m.r, ph = height - m.t - m.b, n = bins.length, slot = pw / n, bw = Math.min(24, slot - 2);
  const max = Math.max(...bins, 1), step = (axis.max - axis.min) / n;
  const X = v => m.l + ((Math.max(axis.min, Math.min(axis.max, v)) - axis.min) / (axis.max - axis.min)) * pw;
  const move = e => setHover(Math.max(0, Math.min(n - 1, Math.floor((px(e, W) - m.l) / slot))));
  const mx = mark ? X(mark.x) : 0, flip = mx > W - 110, rx = refLine ? X(refLine.x) : 0, rflip = rx > W - 130;
  return (
    <figure className="jc-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(-1)}>
        <line x1={m.l} x2={W - m.r} y1={m.t + ph} y2={m.t + ph} className="ax" />
        {bins.map((c, i) => c > 0 && <path key={i} d={barPath(m.l + i * slot + (slot - bw) / 2, m.t + ph - Math.max(2, (c / max) * ph), bw, Math.max(2, (c / max) * ph), 4)} className={'bar' + (i === hover ? ' hot' : '')} />)}
        {ticks.map(t => <text key={t} x={X(t)} y={height - 6} className="tick" textAnchor={t === axis.min ? 'start' : t === axis.max ? 'end' : 'middle'}>{fmt(t)}{t === axis.max ? '+' : ''}</text>)}
        {refLine && <g><line x1={X(refLine.x)} x2={X(refLine.x)} y1={m.t - 8} y2={m.t + ph} className="ref" /><text x={rx + (rflip ? -5 : 5)} y={m.t - 12} className="lab" textAnchor={rflip ? 'end' : 'start'}>{refLine.label}</text></g>}
        {mark && <g><line x1={mx} x2={mx} y1={m.t + 8} y2={m.t + ph} className="you" /><circle cx={mx} cy={m.t + 8} r="5" className="you-dot" /><text x={mx + (flip ? -10 : 10)} y={m.t + 12} className="lab strong" textAnchor={flip ? 'end' : 'start'}>{mark.label}</text></g>}
      </svg>
      <figcaption>{hover >= 0 ? tip(axis.min + hover * step, axis.min + (hover + 1) * step, bins[hover], hover === 0, hover === n - 1) : caption}</figcaption>
    </figure>
  );
}

// Два-три горизонтальні стовпчики з підписом на кінці
export function Bars({ rows, max, title }) {
  return (
    <figure className="jc-chart jc-bars" aria-label={title}>
      {title && <figcaption className="jc-bars-title">{title}</figcaption>}
      {rows.map((r, k) => (
        <div key={k} className="jc-bars-row">
          <span className="jc-bars-name">{r.name}</span>
          <span className="jc-bars-track"><i style={{ width: `${Math.max(0.6, (r.v / max) * 100)}%` }} /><b>{r.text}</b></span>
        </div>
      ))}
    </figure>
  );
}

// Крива «до кого Data Boss ще не приходив»: (1 − p)^n. Повзунок і курсор рухають горизонт.
export function Survival({ p, you, T, F }) {
  const span = Math.min(8000, Math.max(4000, Math.ceil(((you || 0) + 600) / 1000) * 1000));
  const [n, setN] = useState(1000), [ref, W] = useWidth();
  const H = 190, m = { l: 40, r: 14, t: 16, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const X = v => m.l + (v / span) * pw, Y = v => m.t + (1 - v / 100) * ph, S = v => 100 * (1 - p) ** v;
  let d = ''; for (let v = 0; v <= span; v += span / 120) d += (d ? 'L' : 'M') + X(v).toFixed(1) + ' ' + Y(S(v)).toFixed(1);
  const move = e => setN(Math.max(100, Math.min(span, Math.round(((px(e, W) - m.l) / pw) * span / 50) * 50)));
  const youIn = you && you <= span, kStep = W < 420 ? 2000 : 1000;
  return (
    <figure className="jc-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.ch.surv} onPointerMove={move} onPointerDown={move}>
        {[0, 50, 100].map(v => <g key={v}><line x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} className={v ? 'grid' : 'ax'} /><text x={m.l - 6} y={Y(v) + 4} className="tick" textAnchor="end">{v}%</text></g>)}
        {Array.from({ length: span / kStep + 1 }, (_, k) => k * kStep).map(v => <text key={v} x={X(v)} y={H - 7} className="tick" textAnchor={v === 0 ? 'start' : v === span ? 'end' : 'middle'}>{F.n(v)}</text>)}
        <path d={d + `L${X(span)} ${Y(0)}L${X(0)} ${Y(0)}Z`} className="wash" />
        <path d={d} className="line" />
        <line x1={X(n)} x2={X(n)} y1={Y(S(n))} y2={Y(0)} className="ref" />
        <circle cx={X(n)} cy={Y(S(n))} r="5" className="dot" />
        <text x={X(n) + (X(n) > W - 130 ? -10 : 10)} y={Y(S(n)) - 8} className="lab strong" textAnchor={X(n) > W - 130 ? 'end' : 'start'}>{F.pct(S(n))}</text>
        {youIn && <g><circle cx={X(you)} cy={Y(S(you))} r="5" className="you-dot" /><text x={X(you) + (X(you) > W - 130 ? -10 : 10)} y={Y(S(you)) + 16} className="lab" textAnchor={X(you) > W - 130 ? 'end' : 'start'}>{T.ch.yourAudit}</text></g>}
      </svg>
      <figcaption>{T.ch.surv}</figcaption>
      <label className="jc-range">
        <span>{T.ch.horizon}: <b>{T.ch.spins(n)}</b></span>
        <input type="range" min="100" max={span} step="50" value={n} onChange={e => setN(+e.target.value)} />
      </label>
      <p className="jc-range-out">{T.ch.horizonOut(n, 100 - S(n))}</p>
    </figure>
  );
}

// Журнал: накопичений результат проти очікування з коридором ±1,96σ; аудити рисками на осі
export function JournalChart({ series, T, F }) {
  const N = series.net.length - 1;
  const [hover, setHover] = useState(-1), [ref, W] = useWidth(N < 1 ? 0 : 1);
  if (N < 1) return <p className="jc-empty muted" ref={ref}>{T.journal.empty}</p>;
  const H = 210, m = { l: 40, r: 46, t: 14, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b, stepI = Math.max(1, Math.ceil(N / 240));
  const idx = []; for (let i = 0; i <= N; i += stepI) idx.push(i); if (idx[idx.length - 1] !== N) idx.push(N);
  const band = i => 1.96 * Math.sqrt(series.vr[i]);
  let lo = 0, hi = 0; for (const i of idx) { lo = Math.min(lo, series.net[i], series.exp[i] - band(i)); hi = Math.max(hi, series.net[i], series.exp[i] + band(i)); }
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const X = i => m.l + (i / N) * pw, Y = v => m.t + (1 - (v - lo) / (hi - lo)) * ph;
  const path = f => idx.map((i, k) => (k ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(f(i)).toFixed(1)).join('');
  const area = path(i => series.exp[i] + band(i)) + idx.slice().reverse().map(i => 'L' + X(i).toFixed(1) + ' ' + Y(series.exp[i] - band(i)).toFixed(1)).join('') + 'Z';
  const move = e => setHover(Math.max(0, Math.min(N, Math.round(((px(e, W) - m.l) / pw) * N))));
  const h = hover >= 0 ? hover : N, close = Math.abs(Y(series.net[N]) - Y(series.exp[N])) < 14, up = series.net[N] >= series.exp[N];
  return (
    <figure className="jc-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.journal.chart} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(-1)}>
        <line x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} className="ax" /><text x={m.l - 6} y={Y(0) + 4} className="tick" textAnchor="end">0</text>
        <text x={m.l} y={H - 7} className="tick">0</text><text x={W - m.r} y={H - 7} className="tick" textAnchor="end">{T.ch.spins(N)}</text>
        <path d={area} className="band" />
        <path d={path(i => series.exp[i])} className="exp" />
        <path d={path(i => series.net[i])} className="line" />
        {series.audits.filter(a => a <= N).map((a, k) => <line key={k} x1={X(a)} x2={X(a)} y1={m.t + ph - 12} y2={m.t + ph + 2} className="you" />)}
        {hover >= 0 && <line x1={X(h)} x2={X(h)} y1={m.t} y2={m.t + ph} className="ref" />}
        <circle cx={X(h)} cy={Y(series.net[h])} r="5" className="dot" />
        {hover < 0 && <>
          <text x={X(N) + 8} y={Y(series.net[N]) + (close ? (up ? -4 : 12) : 4)} className="lab strong">{F.signed(series.net[N])}</text>
          <text x={X(N) + 8} y={Y(series.exp[N]) + (close ? (up ? 12 : -4) : 4)} className="lab">{F.signed(series.exp[N], 1)}</text>
        </>}
      </svg>
      <figcaption>{hover >= 0 ? T.journal.tip(h, series.net[h], series.exp[h]) : T.journal.chart}</figcaption>
      <ul className="jc-legend">
        <li><i className="k-line" />{T.journal.you}</li><li><i className="k-exp" />{T.journal.exp}</li><li><i className="k-band" />{T.journal.band}</li>
        {series.audits.length > 0 && <li><i className="k-audit" />{T.journal.auditMark}</li>}
      </ul>
    </figure>
  );
}
