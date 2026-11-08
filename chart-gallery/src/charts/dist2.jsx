// Повний розподіл: скрипкова діаграма з роєм точок (у трьох виглядах) і хвилі розподілів (ridgeline).
// Щільність рахує prep2.js (гаусове ядро, вікно Сільвермана); тут лише геометрія, рій точок і підказки.
import { useMemo, useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, VLine, Frame, fit, textW } from './kit.jsx';
import { SERIES, EMPH, INK, SURFACE, GRID, SEQ, seq } from '../palette.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });

// Рій точок: кожну точку ставимо на найближчу до осі вільну позицію (один бік або обидва)
export function dodge(xs, r, both) {
  const out = new Float64Array(xs.length), placed = [], d2 = 2 * r;
  const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]);
  for (const i of order) {
    const x = xs[i], block = [];
    for (let k = placed.length - 1; k >= 0 && x - placed[k][0] < d2; k--) {
      const dx = x - placed[k][0], dy = Math.sqrt(Math.max(0, d2 * d2 - dx * dx));
      block.push([placed[k][1] - dy, placed[k][1] + dy]);
    }
    const free = y => block.every(([a, b]) => y <= a + 1e-6 || y >= b - 1e-6);
    let best = 0;
    if (!free(0)) {
      const cand = block.flatMap(([a, b]) => [a, b]).filter(y => (both || y >= 0) && free(y));
      best = cand.length ? cand.reduce((p, q) => (Math.abs(q) < Math.abs(p) ? q : p)) : Math.max(...block.map(b => b[1]));
    }
    out[i] = best; placed.push([x, best]);
  }
  return out;
}
// не більше max точок на групу: рівномірно за рангом, щоб форма розподілу зберіглась
const thin = (v, max) => (v.length <= max ? Array.from(v) : Array.from({ length: max }, (_, i) => v[Math.round((i * (v.length - 1)) / (max - 1))]));

export function Violin({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hp, setHp] = useState(null);
  const view = mini ? 'rain' : opts.view || 'rain';
  const groups = mini ? m.groups.slice(0, 3) : m.groups, n = groups.length;
  const row = mini ? Math.min(56, 112 / n) : view === 'rain' ? 118 : view === 'violin' ? 80 : 76;
  const labW = mini ? 0 : Math.min(W * 0.3, Math.max(...groups.map(g => textW(g.label, 12))) + 14);
  const Tp = mini ? 2 : 6, B = mini ? 2 : 30, H = Tp + n * row + B, R = mini ? 4 : 16;
  const sc = niceScale(m.lo, m.hi, 6, m.lo >= 0 && m.lo < m.hi * 0.3);
  const x = scale(sc.lo, sc.hi, labW + 8, W - R);
  const pr = mini ? 1.3 : 2.5;
  const lay = useMemo(() => groups.map((g, k) => {
    const pts = thin(g.v, mini ? 120 : 600), xs = pts.map(v => x(v));
    const off = dodge(xs, pr + (mini ? 0.2 : 0.45), view !== 'rain');
    const cloud = view === 'rain' ? row * 0.46 : 0, room = view === 'rain' ? row - cloud - 20 : row / 2 - 6;
    const maxOff = Math.max(1e-6, ...Array.from(off, Math.abs)), squeeze = maxOff > room ? room / maxOff : 1;
    return { pts, xs, off: Array.from(off, o => o * squeeze), cloud, k };
  }), [m, W, view, mini]);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHp(null); }}>
      {!mini && sc.ticks.map(v => <g key={v}><VLine x={x(v)} y1={Tp} y2={H - B + 4} color={GRID} /><Txt x={x(v)} y={H - 8} anchor="middle">{f.axis(v, sc.hi)}</Txt></g>)}
      {groups.map((g, k) => {
        const L = lay[k], top = Tp + k * row, kH = (view === 'rain' ? L.cloud * 0.92 : row / 2 - 6) / Math.max(...g.dens);
        const base = view === 'rain' ? top + L.cloud + 2 : top + row / 2;
        const up = g.grid.map((v, i) => [x(v), base - g.dens[i] * kH]);
        const cloudD = view === 'swarm' ? '' : view === 'rain'
          ? `M${x(g.grid[0])},${base}` + up.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + `L${x(g.grid[g.grid.length - 1])},${base}Z`
          : 'M' + up.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + [...up].reverse().map(p => `L${p[0].toFixed(1)},${(2 * base - p[1]).toFixed(1)}`).join('') + 'Z';
        const rainY = view === 'rain' ? base + 14 : base;
        const show = e => {
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
          let best = -1, bd = 64;
          L.xs.forEach((xx, i) => { const d = (xx - px) ** 2 + (rainY + L.off[i] - py) ** 2; if (d < bd) { bd = d; best = i; } });
          setHp(best >= 0 ? k + ':' + best : null);
          setTip(tipAt(best >= 0 ? L.xs[best] : x(g.med), best >= 0 ? rainY + L.off[best] - 10 : base - 12, g.label, [
            ...(best >= 0 ? [{ value: f.num(L.pts[best]), label: T.ui.thisValue, color: EMPH, dot: true }] : []),
            { value: f.num(g.med), label: T.ui.median, color: best >= 0 ? null : SERIES[0] },
            { value: T.ui.fromTo(f.num(g.q1), f.num(g.q3)), label: T.ui.iqr },
            { value: T.ui.fromTo(f.num(g.min), f.num(g.max)), label: T.ui.range },
            { value: f.num(g.n), label: T.ui.records },
          ]));
        };
        return (
          <g key={k}>
            {!mini && <Txt x={labW - 6} y={base + 4} anchor="end" color={INK.secondary} size={12}>{fit(g.label, labW - 10, 12)}</Txt>}
            {cloudD && <path d={cloudD} fill={SERIES[0]} fillOpacity={view === 'rain' ? 0.42 : 0.3} stroke={SERIES[0]} strokeWidth="1.5" strokeLinejoin="round" />}
            {view === 'rain' && <g>
              <line x1={x(g.min)} x2={x(g.max)} y1={base + 6} y2={base + 6} stroke={INK.faint} strokeWidth="1" />
              <rect x={x(g.q1)} y={base + 3.5} width={Math.max(2, x(g.q3) - x(g.q1))} height={5} rx="2" fill={INK.secondary} />
              <circle cx={x(g.med)} cy={base + 6} r={mini ? 2 : 3.6} fill={INK.primary} stroke={SURFACE} strokeWidth="1.5" />
            </g>}
            {view === 'violin' && <g>
              <rect x={x(g.q1)} y={base - 3} width={Math.max(2, x(g.q3) - x(g.q1))} height={6} rx="2" fill={INK.secondary} />
              <circle cx={x(g.med)} cy={base} r="3.6" fill={INK.primary} stroke={SURFACE} strokeWidth="1.5" />
            </g>}
            {view !== 'violin' && L.xs.map((xx, i) => <circle key={i} cx={xx} cy={rainY + L.off[i]} r={hp === k + ':' + i ? pr + 1.5 : pr} fill={hp === k + ':' + i ? EMPH : SEQ[5]} fillOpacity={hp === k + ':' + i ? 1 : 0.78} />)}
            {view === 'swarm' && <line x1={x(g.med)} x2={x(g.med)} y1={base - row / 2 + 6} y2={base + row / 2 - 6} stroke={INK.primary} strokeWidth="2" opacity=".8" />}
            {!mini && <rect x={labW} y={top} width={W - labW} height={row} fill="transparent" tabIndex="0" onPointerMove={show}
              onFocus={() => setTip(tipAt(x(g.med), base - 12, g.label, [{ value: f.num(g.med), label: T.ui.median, color: SERIES[0] }, { value: T.ui.fromTo(f.num(g.q1), f.num(g.q3)), label: T.ui.iqr }, { value: f.num(g.n), label: T.ui.records }]))}
              onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}

// Хвилі розподілів: криві щільності, що трохи перекривають рядок вище; колір за медіаною (послідовна шкала)
export function Ridge({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(null);
  const n = m.groups.length, own = opts.scale === 'own';
  const step = mini ? 100 / (n + 1.6) : Math.max(22, Math.min(36, 460 / n)), peak = step * (mini ? 2.2 : 2.4);
  const Tp = peak - step + (mini ? 4 : 8), B = mini ? 2 : 52, H = Tp + n * step + B;
  const labW = mini ? 0 : Math.min(W * 0.26, Math.max(...m.groups.map(g => textW(g.label, 12))) + 14);
  const sc = niceScale(m.lo, m.hi, 6, false), R = mini ? 4 : 18;
  const x = scale(m.lo, m.hi, labW + 6, W - R);
  const tcol = g => seq(0.12 + 0.76 * (m.medHi > m.medLo ? (g.med - m.medLo) / (m.medHi - m.medLo) : 0.5));
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(null); }}>
      {!mini && sc.ticks.filter(v => v >= m.lo && v <= m.hi).map(v => <g key={v}><VLine x={x(v)} y1={Tp - peak + step} y2={Tp + n * step + 4} color={GRID} /><Txt x={x(v)} y={Tp + n * step + 20} anchor="middle">{f.axis(v, sc.hi)}</Txt></g>)}
      {m.groups.map((g, k) => {
        const yb = Tp + (k + 1) * step, kd = peak / (own ? g.dmax : m.dmax);
        const pts = m.grid.map((v, i) => [x(v), yb - g.dens[i] * kd]);
        const line = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
        const at = v => { const i = Math.max(0, Math.min(m.grid.length - 1, Math.round(((v - m.lo) / (m.hi - m.lo)) * (m.grid.length - 1)))); return yb - g.dens[i] * kd; };
        const act = hk === k, col = tcol(g);
        const show = () => { setHk(k); setTip(tipAt(x(g.med), at(g.med) - 8, g.label, [{ value: f.num(g.med), label: T.ui.median, color: col }, { value: T.ui.fromTo(f.num(g.q1), f.num(g.q3)), label: T.ui.iqr }, { value: f.num(g.mean), label: T.ui.mean }, { value: f.num(g.n), label: T.ui.records }])); };
        return (
          <g key={k}>
            <path d={line + `L${x(m.hi)},${yb}L${x(m.lo)},${yb}Z`} fill={col} fillOpacity={hk == null || act ? 0.92 : 0.55} stroke={SURFACE} strokeWidth="1.5" />
            <path d={line} fill="none" stroke={act ? EMPH : INK.primary} strokeOpacity={act ? 1 : 0.55} strokeWidth={act ? 2.2 : 1.1} />
            {!mini && <line x1={x(g.med)} x2={x(g.med)} y1={yb} y2={at(g.med)} stroke={SURFACE} strokeWidth="1.6" />}
            {!mini && <Txt x={labW - 8} y={yb - 3} anchor="end" size={12} color={act ? INK.primary : INK.secondary}>{fit(g.label, labW - 12, 12)}</Txt>}
            {!mini && <rect x={0} y={yb - step} width={W} height={step} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => { setTip(null); setHk(null); }} />}
          </g>
        );
      })}
      {!mini && <g transform={`translate(${labW + 6},${H - 18})`}>
        <Txt x={0} y={9} size={10.5}>{T.ui.medianColor}</Txt>
        <defs><linearGradient id="cg-ridge-grad">{[0, 0.5, 1].map(s => <stop key={s} offset={s} stopColor={seq(0.12 + 0.76 * s)} />)}</linearGradient></defs>
        <rect x={textW(T.ui.medianColor, 10.5) + 8} y={0} width={120} height={10} rx="2" fill="url(#cg-ridge-grad)" />
        <Txt x={textW(T.ui.medianColor, 10.5) + 136} y={9} size={10.5}>{f.num(m.medLo)} · {f.num(m.medHi)}</Txt>
      </g>}
    </Frame>
  );
}
