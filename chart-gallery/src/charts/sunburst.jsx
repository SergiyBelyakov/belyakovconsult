// Sunburst і icicle: ієрархія кільцями або смугами. Клацання елемента наближає його гілку (плавний перехід),
// клацання центру чи першої колонки повертає рівнем вище, шлях угорі веде на будь-який рівень.
// Колір за гілкою першого рівня, глибші рівні тим самим кольором світлішими відтінками прозорості.
import { useEffect, useRef, useState } from 'react';
import { useWidth, useTip, Txt, Frame, Legend, fit, wrap, textW } from './kit.jsx';
import { SERIES, OTHER, EMPH, INK, SURFACE, inkOn } from '../palette.js';

const OPAC = [1, 0.95, 0.7, 0.5, 0.38];
const top1 = nd => { let x = nd; while (x.parent && x.parent.depth > 0) x = x.parent; return x; };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function arcPath(r0, r1, a0, a1) {
  const p = (r, a) => [r * Math.sin(a), -r * Math.cos(a)], big = a1 - a0 > Math.PI ? 1 : 0;
  if (a1 - a0 >= 2 * Math.PI - 1e-6) a1 = a0 + 2 * Math.PI - 1e-4;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0.toFixed(1)},${y0.toFixed(1)}A${r1},${r1} 0 ${big} 1 ${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}A${r0},${r0} 0 ${big} 0 ${x3.toFixed(1)},${y3.toFixed(1)}Z`;
}

export function Sunburst({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [focus, setFocus] = useState(m.root);
  const [hov, setHov] = useState(null);
  const [view, setView] = useState({ x0: 0, x1: 1, d: 0 });
  const raf = useRef(0), cur = useRef(view);
  useEffect(() => { setFocus(m.root); cur.current = { x0: 0, x1: 1, d: 0 }; setView(cur.current); }, [m]);
  // плавний перехід вікна до обраного вузла
  useEffect(() => {
    const to = { x0: focus.x0, x1: focus.x1, d: focus.depth }, from = { ...cur.current };
    cancelAnimationFrame(raf.current);
    if (reduced() || mini) { cur.current = to; setView(to); return; }
    const t0 = performance.now(), dur = 620;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const v = { x0: from.x0 + (to.x0 - from.x0) * e, x1: from.x1 + (to.x1 - from.x1) * e, d: from.d + (to.d - from.d) * e };
      cur.current = v; setView(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [focus]);
  const icicle = !mini && opts.view === 'icicle';
  const tops = m.root.children, color = nd => { const t = top1(nd), k = tops.indexOf(t); return t.other || k >= 5 ? OTHER : SERIES[k]; };
  const pathOf = nd => { const p = []; for (let x = nd; x; x = x.parent) p.unshift(x); return p; };
  const share = nd => f.pct(nd.value / m.root.value, 1);
  const show = (nd, x, y) => { setHov(nd); setTip({ x, y, title: pathOf(nd).slice(1).map(p => p.name).join(' › '), rows: [{ value: f.num(nd.value), label: m.valueName, color: color(nd) }, ...(nd.parent && nd.parent.depth > 0 ? [{ value: f.pct(nd.value / nd.parent.value, 1), label: T.ui.ofParent(nd.parent.name) }] : []), { value: share(nd), label: T.ui.ofTotal }] }); };
  const zoom = nd => { if (nd.children.length) setFocus(nd); };
  const up = () => { if (focus.parent) setFocus(focus.parent); };
  const crumbs = mini ? null : (() => { let x = 0; return pathOf(focus).map((nd, k, a) => { const t = (k ? '› ' : '') + fit(nd.name, 150, 11.5), w = textW(t, 11.5) + 10; const el = <Txt key={k} x={x} y={13} size={11.5} color={k === a.length - 1 ? INK.primary : SERIES[0]} weight={k === a.length - 1 ? 600 : 400} style={{ cursor: k < a.length - 1 ? 'pointer' : 'default' }} onClick={() => setFocus(nd)} role={k < a.length - 1 ? 'button' : undefined} tabIndex={k < a.length - 1 ? 0 : undefined} onKeyDown={e => { if (e.key === 'Enter') setFocus(nd); }}>{t}</Txt>; x += w; return el; }); })();
  const legend = !mini && <Legend items={tops.slice(0, 6).map((t, k) => ({ label: t.other || k >= 5 ? T.ui.other : t.name, color: t.other || k >= 5 ? OTHER : SERIES[k] }))} />;
  const span = view.x1 - view.x0 || 1, rel = v => Math.max(0, Math.min(1, (v - view.x0) / span));

  if (icicle) {
    const H = 420, Tp = 26, rings = Math.max(1, Math.min(3, m.depth - Math.floor(view.d + 1e-6)));
    const c0 = Math.min(150, W * 0.2), cw = (W - c0) / rings, colX = d => (d - view.d <= 0 ? 0 : c0 + (d - view.d - 1) * cw);
    const vis = m.nodes.filter(nd => nd.depth >= Math.floor(view.d) && nd.depth <= view.d + rings + 0.001 && nd.x1 > view.x0 + 1e-9 && nd.x0 < view.x1 - 1e-9);
    return (
      <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} onLeave={() => { setTip(null); setHov(null); }} legend={legend}>
        {crumbs}
        {vis.map(nd => {
          const x0 = colX(nd.depth), w = nd.depth <= view.d ? c0 : cw, y0 = Tp + rel(nd.x0) * (H - Tp), h = (rel(nd.x1) - rel(nd.x0)) * (H - Tp);
          if (h < 0.4) return null;
          const fill = nd.depth === 0 ? '#2C3A50' : color(nd), op = nd.depth === 0 ? 1 : OPAC[Math.min(4, nd.depth)], isF = nd === focus || nd.depth < view.d;
          return (
            <g key={nd.id} style={{ cursor: isF ? (focus.parent ? 'pointer' : 'default') : nd.children.length ? 'pointer' : 'default' }}
              onClick={() => (isF ? up() : zoom(nd))} onPointerMove={() => show(nd, x0 + w / 2, y0 + 4)}>
              <rect x={x0 + 1} y={y0 + 0.5} width={Math.max(0, w - 2)} height={Math.max(0, h - 1)} rx="2" fill={fill} fillOpacity={hov && hov !== nd ? op * 0.7 : op} stroke={hov === nd ? EMPH : 'none'} strokeWidth="2" />
              {h >= 18 && <Txt x={x0 + 8} y={y0 + 15} size={11.5} weight={600} color={nd.depth === 0 ? INK.primary : inkOn(fill)} style={{ pointerEvents: 'none' }}>{fit(nd.name, w - 14, 11.5)}</Txt>}
              {h >= 34 && <Txt x={x0 + 8} y={y0 + 30} size={10.5} color={nd.depth === 0 ? INK.secondary : inkOn(fill)} opacity=".85" style={{ pointerEvents: 'none' }}>{f.num(nd.value)} · {share(nd)}</Txt>}
            </g>
          );
        })}
      </Frame>
    );
  }

  const S = mini ? 118 : Math.max(320, Math.min(540, W * 0.82)), Tp = mini ? 0 : 24, H = S + Tp, cx = W / 2, cy = Tp + S / 2;
  const R = S / 2 - (mini ? 2 : 6), rings = Math.max(1, Math.min(3, m.depth - Math.floor(view.d + 1e-6))), r0 = R * (mini ? 0.3 : 0.26), th = (R - r0) / rings;
  const vis = m.nodes.filter(nd => nd.depth > view.d - 0.999 && nd.depth >= 1 && nd.depth <= view.d + rings + 0.001 && nd.x1 > view.x0 + 1e-9 && nd.x0 < view.x1 - 1e-9);
  const centerName = mini ? [] : wrap(focus.depth ? focus.name : T.ui.total, r0 * 1.7, 12, 3);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHov(null); }} legend={legend}>
      {crumbs}
      <g transform={`translate(${cx},${cy})`}>
        {vis.map(nd => {
          const d = nd.depth - view.d;
          const a0 = rel(nd.x0) * 2 * Math.PI, a1 = rel(nd.x1) * 2 * Math.PI;
          if (a1 - a0 < 0.003) return null;
          const ri = r0 + (d - 1) * th, ro = ri + th - (mini ? 0.5 : 1);
          if (ro <= r0 - 0.5) return null;
          const fill = color(nd), mid = (a0 + a1) / 2, rm = (Math.max(r0, ri) + ro) / 2;
          const deg = (mid * 180) / Math.PI, flip = deg > 180;
          const room = (a1 - a0) * rm > 13 && th > 26;
          return (
            <g key={nd.id} style={{ cursor: mini ? undefined : nd.children.length ? 'pointer' : 'default' }}
              onClick={mini ? undefined : () => zoom(nd)} onPointerMove={mini ? undefined : () => show(nd, cx + rm * Math.sin(mid), cy - rm * Math.cos(mid) - 8)}>
              <path d={arcPath(Math.max(r0, ri), ro, a0, a1)} fill={fill} fillOpacity={(hov && hov !== nd ? 0.7 : 1) * OPAC[Math.min(4, nd.depth)]} stroke={hov === nd ? EMPH : SURFACE} strokeWidth={hov === nd ? 2 : mini ? 0.6 : 1} />
              {!mini && room && <Txt x={0} y={0} anchor="middle" size={10.5} weight={600} color={inkOn(fill)} transform={`rotate(${deg - 90}) translate(${rm},0) rotate(${flip ? 180 : 0})`} dominantBaseline="middle" style={{ pointerEvents: 'none' }}>{fit(nd.name, th - 8, 10.5)}</Txt>}
            </g>
          );
        })}
        {!mini && <g style={{ cursor: focus.parent ? 'pointer' : 'default' }} onClick={up} role={focus.parent ? 'button' : undefined} tabIndex={focus.parent ? 0 : undefined} onKeyDown={e => { if (e.key === 'Enter') up(); }} aria-label={focus.parent ? T.ui.zoomOut : undefined}>
          <circle r={r0 - 2} fill="#141B26" stroke={focus.parent ? 'rgba(255,255,255,.18)' : 'none'} />
          {centerName.map((l, k) => <Txt key={k} x={0} y={-8 - (centerName.length - 1) * 7 + k * 14} anchor="middle" size={12} weight={600} color={INK.primary}>{l}</Txt>)}
          <Txt x={0} y={14 + (centerName.length - 1) * 7} anchor="middle" size={11} color={INK.secondary}>{f.compact(focus.value)}</Txt>
          {focus.parent && <Txt x={0} y={30 + (centerName.length - 1) * 7} anchor="middle" size={10} color={INK.faint}>{T.ui.zoomOut}</Txt>}
        </g>}
      </g>
    </Frame>
  );
}
