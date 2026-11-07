// Потоки й мережі: діаграма Санкі (шари за найдовшим шляхом, зменшення перетинів) і мережевий граф (силове розміщення).
import { useMemo, useState } from 'react';
import { useWidth, useTip, Txt, Frame, fit, textW } from './kit.jsx';
import { rng } from '../../../anomaly-demo/src/stats.js';
import { SERIES, INK, SURFACE, GRID, BASE, EMPH, SEQ, DIM } from '../palette.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });

function sankeyLayout(m, W, H, pad, nodeW, labelL, labelR) {
  const nodes = m.names.map(n => ({ name: n, layer: m.layer.get(n), in: 0, out: 0, inL: [], outL: [] }));
  const by = new Map(nodes.map(n => [n.name, n]));
  const links = m.links.map(l => ({ ...l, src: by.get(l.s), dst: by.get(l.t) }));
  links.forEach(l => { l.src.out += l.value; l.dst.in += l.value; l.src.outL.push(l); l.dst.inL.push(l); });
  nodes.forEach(n => { n.value = Math.max(n.in, n.out); });
  const layers = Array.from({ length: m.layers }, (_, k) => nodes.filter(n => n.layer === k));
  const ky = Math.min(...layers.map(ls => (H - pad * (ls.length - 1)) / (ls.reduce((s, n) => s + n.value, 0) || 1)));
  const x0 = labelL, x1 = W - labelR - nodeW;
  layers.forEach((ls, k) => ls.forEach(n => { n.x = m.layers > 1 ? x0 + ((x1 - x0) * k) / (m.layers - 1) : x0; n.h = Math.max(2, n.value * ky); }));
  const stack = ls => { let y = 0; ls.forEach(n => { n.y = y; y += n.h + pad; }); const extra = H - (y - pad); ls.forEach(n => { n.y += extra / 2; }); };
  layers.forEach((ls, k) => { if (k === 0) ls.sort((a, b) => b.value - a.value); stack(ls); });
  // кілька проходів: впорядковуємо вузли за середньою висотою пов'язаних вузлів
  for (let it = 0; it < 4; it++) {
    for (let k = 1; k < layers.length; k++) { layers[k].forEach(n => { const w = n.inL.reduce((s, l) => s + l.value, 0); n.c = w ? n.inL.reduce((s, l) => s + (l.src.y + l.src.h / 2) * l.value, 0) / w : n.y; }); layers[k].sort((a, b) => a.c - b.c); stack(layers[k]); }
    for (let k = layers.length - 2; k >= 1; k--) { layers[k].forEach(n => { const w = n.outL.reduce((s, l) => s + l.value, 0); n.c = w ? n.outL.reduce((s, l) => s + (l.dst.y + l.dst.h / 2) * l.value, 0) / w : n.y; }); layers[k].sort((a, b) => a.c - b.c); stack(layers[k]); }
  }
  nodes.forEach(n => { n.outL.sort((a, b) => a.dst.y - b.dst.y); n.inL.sort((a, b) => a.src.y - b.src.y); let so = 0; n.outL.forEach(l => { l.sy = n.y + so; l.w = l.value * ky; so += l.w; }); let ti = 0; n.inL.forEach(l => { l.ty = n.y + ti; ti += l.value * ky; }); });
  return { nodes, links, ky };
}
const band = (l, nodeW) => { const xa = l.src.x + nodeW, xb = l.dst.x, xm = (xa + xb) / 2; return `M${xa},${l.sy}C${xm},${l.sy} ${xm},${l.ty} ${xb},${l.ty}L${xb},${l.ty + l.w}C${xm},${l.ty + l.w} ${xm},${l.sy + l.w} ${xa},${l.sy + l.w}Z`; };

export function Sankey({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hn, setHn] = useState(null);
  const [hl, setHl] = useState(null);
  const H = mini ? 118 : Math.max(320, Math.min(520, m.names.length * 34)), Tp = mini ? 4 : 10;
  const nodeW = mini ? 6 : 12;
  const lastNames = m.names.filter(n => m.layer.get(n) === m.layers - 1), firstNames = m.names.filter(n => m.layer.get(n) === 0);
  const labelR = mini ? 2 : Math.min(W * 0.24, Math.max(...lastNames.map(n => textW(n, 11.5))) + 10);
  const labelL = mini ? 2 : 0;
  const lay = useMemo(() => sankeyLayout(m, W, H - Tp * 2, mini ? 4 : 12, nodeW, labelL, labelR), [m, W, H]);
  const active = l => (hl != null ? l === hl : hn != null ? l.src.name === hn || l.dst.name === hn : null);
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.flows} tip={tip} mini={mini} onLeave={() => { setTip(null); setHn(null); setHl(null); }}>
      <g transform={`translate(0,${Tp})`}>
        {lay.links.map((l, k) => {
          const a = active(l);
          const show = e => { const b = e.currentTarget.ownerSVGElement.getBoundingClientRect(); setHl(l); setTip(tipAt(e.clientX - b.left, e.clientY - b.top - 14, l.s + ' → ' + l.t, [{ value: f.num(l.value), label: T.ui.flowShare(f.pct(l.value / (l.src.out || 1))), color: SERIES[0] }])); };
          return <path key={k} d={band(l, nodeW)} fill={SERIES[0]} fillOpacity={a == null ? 0.3 : a ? 0.75 : 0.08} onPointerMove={mini ? undefined : show} onPointerLeave={() => setHl(null)} />;
        })}
        {lay.nodes.map((n, k) => {
          const last = n.layer === m.layers - 1;
          const show = () => { setHn(n.name); setTip(tipAt(n.x + nodeW / 2, n.y - 6, n.name, [{ value: f.num(n.value), label: n.in && n.out ? T.ui.through : n.out ? T.ui.outgoing : T.ui.incoming, color: INK.secondary }])); };
          return (
            <g key={k}>
              <rect x={n.x} y={n.y} width={nodeW} height={n.h} rx="2" fill={hn === n.name ? EMPH : INK.secondary} tabIndex={mini ? undefined : 0} onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => { setTip(null); setHn(null); }} />
              {!mini && <Txt x={last ? n.x + nodeW + 6 : n.x + nodeW + 6} y={n.y + n.h / 2 + 4} size={11.5} color={INK.primary} stroke={SURFACE} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{fit(n.name, last ? labelR - 8 : 150, 11.5)}</Txt>}
              {!mini && n.h > 26 && <Txt x={n.x + nodeW + 6} y={n.y + n.h / 2 + 18} size={10.5} color={INK.muted} stroke={SURFACE} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{f.num(n.value)}</Txt>}
            </g>
          );
        })}
      </g>
    </Frame>
  );
}

// Силове розміщення Фрюхтермана–Рейнгольда з фіксованим зерном: щоразу однакова картинка
function forceLayout(m) {
  const n = m.names.length, idx = new Map(m.names.map((nm, k) => [nm, k])), R = rng(42);
  const P = m.names.map((_, k) => { const a = (k / n) * Math.PI * 2; return [Math.cos(a) + (R() - 0.5) * 0.1, Math.sin(a) + (R() - 0.5) * 0.1]; });
  const E = m.edges.map(e => [idx.get(e.s), idx.get(e.t), e.value]);
  const k0 = Math.sqrt(4 / n);
  let t = 0.25;
  for (let it = 0; it < 320; it++) {
    const D = P.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d = Math.hypot(dx, dy) || 1e-3;
      const fr = (k0 * k0) / d; dx /= d; dy /= d;
      D[i][0] += dx * fr; D[i][1] += dy * fr; D[j][0] -= dx * fr; D[j][1] -= dy * fr;
    }
    E.forEach(([a, b]) => { let dx = P[a][0] - P[b][0], dy = P[a][1] - P[b][1], d = Math.hypot(dx, dy) || 1e-3; const fa = (d * d) / k0; dx /= d; dy /= d; D[a][0] -= dx * fa; D[a][1] -= dy * fa; D[b][0] += dx * fa; D[b][1] += dy * fa; });
    for (let i = 0; i < n; i++) { const d = Math.hypot(D[i][0], D[i][1]) || 1; P[i][0] += (D[i][0] / d) * Math.min(d, t) - P[i][0] * 0.01; P[i][1] += (D[i][1] / d) * Math.min(d, t) - P[i][1] * 0.01; }
    t *= 0.985;
  }
  return { P, E, idx };
}
export function Network({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hn, setHn] = useState(null);
  const lay = useMemo(() => forceLayout(m), [m]);
  const H = mini ? 118 : Math.max(360, Math.min(520, W * 0.66)), pad = mini ? 10 : 34;
  const xs = lay.P.map(p => p[0]), ys = lay.P.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = v => pad + ((v - x0) / (x1 - x0 || 1)) * (W - pad * 2), sy = v => pad + ((v - y0) / (y1 - y0 || 1)) * (H - pad * 2);
  const maxDeg = Math.max(...m.deg.values()), maxW = Math.max(...m.edges.map(e => e.value));
  const r = k => (mini ? 2 : 4) + (mini ? 3 : 8) * Math.sqrt(m.deg.get(m.names[k]) / maxDeg);
  const nb = useMemo(() => { const s = new Map(m.names.map(nm => [nm, new Set()])); m.edges.forEach(e => { s.get(e.s).add(e.t); s.get(e.t).add(e.s); }); return s; }, [m]);
  const labels = new Set([...m.names].sort((a, b) => m.deg.get(b) - m.deg.get(a)).slice(0, mini ? 0 : 9));
  const on = nm => hn == null || nm === hn || nb.get(hn).has(nm);
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.network} tip={tip} mini={mini} onLeave={() => { setTip(null); setHn(null); }}>
      {lay.E.map(([a, b, w], k) => {
        const act = hn != null && (m.names[a] === hn || m.names[b] === hn);
        return <line key={k} x1={sx(lay.P[a][0])} y1={sy(lay.P[a][1])} x2={sx(lay.P[b][0])} y2={sy(lay.P[b][1])} stroke={act ? SERIES[0] : '#46546A'} strokeOpacity={hn == null ? 0.75 : act ? 0.95 : 0.18} strokeWidth={mini ? 0.8 : m.weighted ? 1 + 3 * (w / maxW) : 1.4} />;
      })}
      {m.names.map((nm, k) => {
        const cx = sx(lay.P[k][0]), cy = sy(lay.P[k][1]);
        const show = () => { setHn(nm); setTip(tipAt(cx, cy - r(k) - 8, nm, [{ value: f.num(m.deg.get(nm)), label: T.ui.links, color: SERIES[0], dot: true }], [...nb.get(nm)].slice(0, 5).join(', ') + (nb.get(nm).size > 5 ? '…' : ''))); };
        return (
          <g key={k} opacity={on(nm) ? 1 : 0.25}>
            <circle cx={cx} cy={cy} r={r(k)} fill={hn === nm ? EMPH : SERIES[0]} stroke={SURFACE} strokeWidth="2" tabIndex={mini ? undefined : 0} onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => { setTip(null); setHn(null); }} />
            {!mini && (labels.has(nm) || hn === nm || (hn && nb.get(hn).has(nm))) && <Txt x={cx + r(k) + 4} y={cy + 4} size={11} color={INK.primary} stroke={SURFACE} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{fit(nm, 160)}</Txt>}
          </g>
        );
      })}
    </Frame>
  );
}
