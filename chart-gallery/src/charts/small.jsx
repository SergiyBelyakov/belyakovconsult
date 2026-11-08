// Малі мультиплі: сітка однакових маленьких графіків з однією шкалою. Кожна панель показує свою серію, а решту
// серій сірим тлом, тому видно і форму, і місце серед інших. Наведення синхронізоване: одна дата в усіх панелях.
// Ті самі панелі вмикаються як вигляд для ліній, згрупованих стовпчиків і розсіювання.
import { useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, Frame, fit, colPath } from './kit.jsx';
import { SERIES, EMPH, INK, SURFACE, GRID, BASE } from '../palette.js';

const GHOST = '#2E3848';
const path = pts => { let d = '', pen = false; pts.forEach(p => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); pen = true; }); return d; };
function layoutGrid(W, n, { mini, minW = 176, gutter = 34 }) {
  const gap = mini ? 5 : 16, g = mini ? 0 : gutter;
  const cols = mini ? Math.min(n, 4) : Math.max(1, Math.min(n, Math.floor((W - g + gap) / (minW + gap))));
  const pw = (W - g - gap * (cols - 1)) / cols;
  return { cols, rows: Math.ceil(n / cols), pw, gap, g };
}
const lastOf = row => { for (let k = row.length - 1; k >= 0; k--) if (row[k] != null) return k; return -1; };
const firstOf = row => row.findIndex(v => v != null);

// Часові ряди: m = { days, names, val, valueName }
export function SmallLines({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(null);
  let order = m.names.map((_, a) => a);
  const lastV = a => m.val[a][lastOf(m.val[a])], firstV = a => m.val[a][firstOf(m.val[a])];
  if (opts.sort === 'last') order.sort((a, b) => lastV(b) - lastV(a));
  if (opts.sort === 'change') order.sort((a, b) => (lastV(b) - firstV(b)) / Math.abs(firstV(b) || 1) - (lastV(a) - firstV(a)) / Math.abs(firstV(a) || 1));
  if (mini) order = order.slice(0, 8);
  const G = layoutGrid(W, order.length, { mini });
  const titleH = mini ? 0 : 22, ph = mini ? (118 - G.gap * (G.rows - 1)) / G.rows : 84, foot = mini ? 0 : 18;
  const cellH = titleH + ph + foot, H = G.rows * cellH + (G.rows - 1) * (mini ? G.gap : 14);
  const own = opts.scale === 'own';
  const all = m.val.flat().filter(v => v != null);
  const zeroOk = lo => lo >= 0 && lo < Math.max(...all) * 0.5;
  const shared = niceScale(Math.min(...all), Math.max(...all), 3, zeroOk(Math.min(...all)));
  const d0 = m.days[0], d1 = m.days[m.days.length - 1];
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(null); }}>
      {order.map((a, idx) => {
        const c = idx % G.cols, r = Math.floor(idx / G.cols);
        const x0 = G.g + c * (G.pw + G.gap), y0 = r * (cellH + (mini ? G.gap : 14));
        const vals = m.val[a].filter(v => v != null);
        const sc = own ? niceScale(Math.min(...vals), Math.max(...vals), 3, zeroOk(Math.min(...vals))) : shared;
        const x = scale(d0, d1, x0 + 2, x0 + G.pw - 4), y = scale(sc.lo, sc.hi, y0 + titleH + ph, y0 + titleH + 4);
        const k = hk ?? lastOf(m.val[a]), v = m.val[a][k];
        const line = path(m.days.map((d, j) => (m.val[a][j] == null ? null : [x(d), y(m.val[a][j])])));
        const move = e => {
          const b = e.currentTarget.ownerSVGElement.getBoundingClientRect(), px = e.clientX - b.left;
          let best = 0, bd = Infinity; m.days.forEach((d, j) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; best = j; } });
          setHk(best);
          const vv = m.val[a][best];
          setTip({ x: x(m.days[best]), y: y(vv ?? sc.lo) - 12, title: m.names[a], rows: [{ value: vv == null ? T.ui.noData : f.num(vv), label: f.date(m.days[best]), color: SERIES[0] }] });
        };
        return (
          <g key={a}>
            {!mini && <Txt x={x0} y={y0 + 14} size={12} color={INK.primary} weight={600}>{fit(m.names[a], G.pw - 64, 12)}</Txt>}
            {!mini && v != null && <Txt x={x0 + G.pw} y={y0 + 14} anchor="end" size={12} color={hk != null ? EMPH : INK.secondary} weight={600}>{f.compact(v)}</Txt>}
            {!mini && sc.ticks.map(t => <HLine key={t} x1={x0} x2={x0 + G.pw} y={y(t)} color={t === 0 ? BASE : GRID} />)}
            {!mini && (c === 0 || own) && sc.ticks.map(t => <Txt key={'t' + t} x={own && c > 0 ? x0 + 2 : x0 - 6} y={y(t) + (own && c > 0 ? -3 : 3.5)} anchor={own && c > 0 ? 'start' : 'end'} size={9.5} color={INK.faint}>{f.axis(t, sc.hi)}</Txt>)}
            {m.names.map((_, b) => b !== a && <path key={b} d={path(m.days.map((d, j) => (m.val[b][j] == null ? null : [x(d), y(m.val[b][j])])))} fill="none" stroke={GHOST} strokeWidth={mini ? 0.8 : 1} />)}
            {!own && <path d={line + `L${x(d1)},${y(Math.max(sc.lo, 0))}L${x(d0)},${y(Math.max(sc.lo, 0))}Z`} fill={SERIES[0]} fillOpacity=".13" />}
            <path d={line} fill="none" stroke={SERIES[0]} strokeWidth={mini ? 1.4 : 2} strokeLinejoin="round" />
            {!mini && v != null && <circle cx={x(m.days[k])} cy={y(v)} r="3.5" fill={hk != null ? EMPH : SERIES[0]} stroke={SURFACE} strokeWidth="1.5" />}
            {!mini && hk != null && <line x1={x(m.days[hk])} x2={x(m.days[hk])} y1={y0 + titleH} y2={y0 + titleH + ph} stroke="rgba(255,255,255,.28)" />}
            {!mini && idx + G.cols >= order.length && <g><Txt x={x0} y={y0 + titleH + ph + 14} size={10} color={INK.faint}>{f.month(d0)}</Txt><Txt x={x0 + G.pw} y={y0 + titleH + ph + 14} anchor="end" size={10} color={INK.faint}>{f.month(d1)}</Txt></g>}
            {!mini && <rect x={x0} y={y0 + titleH} width={G.pw} height={ph} fill="transparent" onPointerMove={move} />}
          </g>
        );
      })}
    </Frame>
  );
}
export const Small = SmallLines;

// Згруповані стовпчики як мультиплі: панель на серію, однакова шкала
export function SmallBars({ m, f, T }) {
  const [ref, W] = useWidth(640);
  const [tip, setTip] = useTip();
  const S = m.series.length, C = m.cats.length;
  const G = layoutGrid(W, S, { minW: Math.max(150, C * 22) });
  const titleH = 22, ph = 96, foot = 30, cellH = titleH + ph + foot, H = G.rows * cellH + (G.rows - 1) * 12;
  const vals = m.v.flat(), sc = niceScale(Math.min(0, ...vals), Math.max(0, ...vals), 3);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} onLeave={() => setTip(null)}>
      {m.series.map((s, b) => {
        const c = b % G.cols, r = Math.floor(b / G.cols), x0 = G.g + c * (G.pw + G.gap), y0 = r * (cellH + 12);
        const y = scale(sc.lo, sc.hi, y0 + titleH + ph, y0 + titleH + 4), band = G.pw / C, bw = Math.max(2, Math.min(26, band * 0.68));
        return (
          <g key={b}>
            <Txt x={x0} y={y0 + 14} size={12} color={INK.primary} weight={600}>{fit(s, G.pw, 12)}</Txt>
            {sc.ticks.map(t => <HLine key={t} x1={x0} x2={x0 + G.pw} y={y(t)} color={t === 0 ? BASE : GRID} />)}
            {c === 0 && sc.ticks.map(t => <Txt key={'t' + t} x={x0 - 6} y={y(t) + 3.5} anchor="end" size={9.5} color={INK.faint}>{f.axis(t, sc.hi)}</Txt>)}
            {m.cats.map((cat, a) => {
              const bx = x0 + a * band + (band - bw) / 2, v = m.v[a][b];
              const show = () => setTip({ x: bx + bw / 2, y: y(Math.max(0, v)) - 8, title: cat, rows: [{ value: f.num(v), label: s, color: SERIES[0] }] });
              return <g key={a}>
                <path d={colPath(bx, bw, y(0), y(v), 3)} fill={SERIES[0]} />
                <rect x={x0 + a * band} y={y0 + titleH} width={band} height={ph} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />
                {r === G.rows - 1 || S - b <= G.cols ? band >= 22 && <Txt x={bx + bw / 2} y={y0 + titleH + ph + 14} anchor="middle" size={9.5} color={INK.faint}>{fit(cat, band - 2, 9.5)}</Txt> : null}
              </g>;
            })}
          </g>
        );
      })}
    </Frame>
  );
}

// Розсіювання як мультиплі: панель на групу, решта точок сірим тлом, спільні осі
export function SmallScatter({ m, f, T }) {
  const [ref, W] = useWidth(640);
  const [tip, setTip] = useTip();
  const [hp, setHp] = useState(null);
  const groups = m.groups;
  const G = layoutGrid(W, groups.length, { minW: 190 });
  const titleH = 22, ph = 140, foot = 18, cellH = titleH + ph + foot, top = 22, H = top + G.rows * cellH + (G.rows - 1) * 12;
  // логарифмічна вісь X, якщо її обрано в параметрах розсіювання
  const tx = v => (m.log ? Math.log10(v) : v), xs = m.pts.map(p => tx(p.x)), ys = m.pts.map(p => p.y);
  const xsc = niceScale(Math.min(...xs), Math.max(...xs), 3, false), ysc = niceScale(Math.min(...ys), Math.max(...ys), 3, false);
  if (m.log) { xsc.lo = Math.min(...xs) - 0.05; xsc.hi = Math.max(...xs) + 0.05; xsc.ticks = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 1e4].map(Math.log10).filter(t => t >= xsc.lo && t <= xsc.hi); }
  return (
    <Frame refEl={ref} w={W} h={H} label={m.names.join(' / ')} tip={tip} onLeave={() => { setTip(null); setHp(null); }}>
      {groups.map((g, b) => {
        const c = b % G.cols, r = Math.floor(b / G.cols), x0 = G.g + c * (G.pw + G.gap), y0 = top + r * (cellH + 12);
        const xl = scale(xsc.lo, xsc.hi, x0 + 4, x0 + G.pw - 4), x = v => xl(tx(v)), y = scale(ysc.lo, ysc.hi, y0 + titleH + ph - 4, y0 + titleH + 4);
        const mine = m.pts.filter(p => p.g === g);
        const move = e => {
          const bb = e.currentTarget.ownerSVGElement.getBoundingClientRect(), px = e.clientX - bb.left, py = e.clientY - bb.top;
          let best = null, bd = 144; mine.forEach(p => { const d = (x(p.x) - px) ** 2 + (y(p.y) - py) ** 2; if (d < bd) { bd = d; best = p; } });
          setHp(best);
          if (!best) return setTip(null);
          setTip({ x: x(best.x), y: y(best.y) - 10, title: best.label || g, rows: [{ value: f.num(best.y), label: m.names[1], color: SERIES[0], dot: true }, { value: f.num(best.x), label: m.names[0] }] });
        };
        return (
          <g key={b}>
            <Txt x={x0} y={y0 + 14} size={12} color={INK.primary} weight={600}>{fit(g, G.pw - 40, 12)}</Txt>
            <Txt x={x0 + G.pw} y={y0 + 14} anchor="end" size={11} color={INK.muted}>{mine.length}</Txt>
            <rect x={x0} y={y0 + titleH} width={G.pw} height={ph} fill="none" stroke={GRID} />
            {c === 0 && ysc.ticks.map(t => <Txt key={t} x={x0 - 6} y={y(t) + 3.5} anchor="end" size={9.5} color={INK.faint}>{f.axis(t, ysc.hi)}</Txt>)}
            {b + G.cols >= groups.length && xsc.ticks.map(t => <Txt key={t} x={xl(t)} y={y0 + titleH + ph + 13} anchor="middle" size={9.5} color={INK.faint}>{f.axis(m.log ? 10 ** t : t, m.log ? 10 ** xsc.hi : xsc.hi)}</Txt>)}
            {m.pts.map((p, k) => p.g !== g && <circle key={k} cx={x(p.x)} cy={y(p.y)} r="2" fill={GHOST} />)}
            {mine.map((p, k) => <circle key={'m' + k} cx={x(p.x)} cy={y(p.y)} r={hp === p ? 5 : 3.2} fill={hp === p ? EMPH : SERIES[0]} fillOpacity=".9" stroke={SURFACE} strokeWidth="1.2" />)}
            <rect x={x0} y={y0 + titleH} width={G.pw} height={ph} fill="transparent" onPointerMove={move} />
          </g>
        );
      })}
      <Txt x={G.g} y={11} size={11} color={INK.secondary}>{fit(m.names[1] + ' ↑ · ' + m.names[0] + (m.log ? ' (' + T.ui.logScale + ')' : '') + ' →', W - G.g, 11)}</Txt>
    </Frame>
  );
}
