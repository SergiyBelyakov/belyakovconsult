// Карта часу доїзду (ізохрони) з даних про населені пункти: зони 15, 30, 45 і 60 хвилин, штрихування поза
// обраною межею, населені пункти розміром за кількістю мешканців, рубінове кільце для тих, хто поза межею.
// Поле між пунктами оцінене як час до найближчого пункту з відомим часом плюс дорога до нього (prep4.js).
// Повна мережева модель з дорогами й автобусами є в демо транспортної доступності, посилання під картою.
import { useMemo, useState } from 'react';
import { contours } from 'd3-contour';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { useWidth, useTip, Txt, Frame, Legend, fit, wrap } from './kit.jsx';
import { ISO, EMPH, INK, SURFACE, GRID } from '../palette.js';
import { ISO_STEPS } from '../prep4.js';

const ringPath = (rings, X, Y) => rings.map(r => 'M' + r.map(([gx, gy]) => X(gx).toFixed(1) + ',' + Y(gy).toFixed(1)).join('L') + 'Z').join('');
const band = t => ISO_STEPS.findIndex(s => t <= s);

export function Iso({ m, f, T, mini, lang }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hp, setHp] = useState(null);
  const head1 = mini ? '' : m.hasPop ? T.ui.isoSummary(m.T, f.num(m.popOut), f.pct(m.popAll ? m.popOut / m.popAll : 0, 1), m.out) : T.ui.isoSummaryN(m.T, m.out, m.pts.length);
  const headL = mini ? [] : wrap(head1, W, 13, 2), head = mini ? 0 : 12 + headL.length * 18;
  const gw = (m.nx - 1) * m.step, gh = (m.ny - 1) * m.step;
  const maxH = mini ? 118 : Math.min(560, Math.max(320, W * 0.72));
  const s = Math.min(W / gw, (maxH - head) / gh), mw = gw * s, mh = gh * s, ox = (W - mw) / 2, oy = head;
  const H = mini ? 118 : head + mh + 6;
  // ізолінії в координатах сітки: від'ємне поле, щоб контур означав «не довше за t»
  const shapes = useMemo(() => {
    const neg = Array.from(m.grid, v => -v);
    const gen = contours().size([m.nx, m.ny]).thresholds(ISO_STEPS.map(t => -t));
    return gen(neg).map(c => ({ t: -c.value, rings: c.coordinates.flat() }));
  }, [m]);
  // значення d3-contour відносяться до центрів клітинок: зсув на пів клітинки
  const X = gx => ox + (gx - 0.5) * (mw / (m.nx - 1)), Y = gy => oy + (gy - 0.5) * (mh / (m.ny - 1));
  const kx = x => ox + ((x - m.x0) / gw) * mw, ky = y => oy + ((m.y1 - y) / gh) * mh;
  const shell = 'M' + m.shell.map(([x, y]) => kx(x).toFixed(1) + ',' + ky(y).toFixed(1)).join('L') + 'Z';
  const inside = shapes.find(c => c.t === m.T);
  const maxPop = Math.max(1, ...m.pts.map(p => p.pop || 0));
  const rad = p => (mini ? 1.6 : m.hasPop && p.pop != null ? 3 + 8 * Math.sqrt(p.pop / maxPop) : 4.5);
  const order = [...m.pts].sort((a, b) => (b.pop || 0) - (a.pop || 0));
  // підписи: найбільші й найвіддаленіші пункти, без накладання прямокутників підписів
  const named = [];
  if (!mini) {
    const boxes = [];
    [...[...m.pts].filter(p => p.t > m.T).sort((a, b) => b.t - a.t).slice(0, 4), ...order.slice(0, 8)].forEach(p => {
      if (!p.label || named.includes(p) || named.length >= 9) return;
      const x = kx(p.kx) + rad(p) + 4, y = ky(p.ky), w = Math.min(140, p.label.length * 6.2), b = [x - 2, y - 9, x + w + 2, y + 5];
      if (x + w > W || boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))) return;
      boxes.push(b); named.push(p);
    });
  }
  const fieldAt = (px, py) => { const gx = Math.round(((px - ox) / mw) * (m.nx - 1)), gy = Math.round(((py - oy) / mh) * (m.ny - 1)); return gx >= 0 && gy >= 0 && gx < m.nx && gy < m.ny ? m.grid[gy * m.nx + gx] : null; };
  const move = e => {
    const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let best = null, bd = 196; m.pts.forEach(p => { const d = (kx(p.kx) - px) ** 2 + (ky(p.ky) - py) ** 2; if (d < bd) { bd = d; best = p; } });
    setHp(best);
    if (best) return setTip({ x: kx(best.kx), y: ky(best.ky) - rad(best) - 8, title: best.label || T.ui.isoPoint, rows: [{ value: f.num(best.t) + ' ' + T.ui.min, label: m.timeName, color: best.t > 60 ? null : ISO[Math.max(0, band(best.t))], dot: true }, ...(best.pop != null ? [{ value: f.num(best.pop), label: m.popName }] : [])], note: best.t > m.T ? T.ui.isoBeyond(m.T) : null });
    const v = fieldAt(px, py);
    setTip(v == null ? null : { x: px, y: py - 12, title: T.ui.isoEst, rows: [{ value: '≈ ' + f.num(Math.round(v)) + ' ' + T.ui.min, label: m.timeName }] });
  };
  const href = (lang === 'en' ? '/en' : '') + '/cases/transport-accessibility/';
  return (
    <Frame refEl={ref} w={W} h={H} label={m.timeName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHp(null); }}
      legend={!mini && <>
        <Legend items={[...ISO_STEPS.map((t, k) => ({ label: T.ui.isoBand(t), color: ISO[k] })), { label: T.ui.isoOut(m.T), color: '#FFB020' }]} />
        <a className="cg-iso-link" href={href}><Icon name="arrowRight" size={14} />{T.ui.isoDemo}</a>
      </>}>
      <defs>
        <clipPath id="cg-iso-clip"><path d={shell} /></clipPath>
        <pattern id="cg-iso-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#FFB020" strokeWidth="1.3" strokeOpacity=".75" /></pattern>
      </defs>
      {headL.map((l, k) => <Txt key={'h' + k} x={0} y={16 + k * 18} size={13} weight={600} color={m.out ? INK.primary : INK.secondary}>{l}</Txt>)}
      <g clipPath="url(#cg-iso-clip)">
        <path d={shell} fill={GRID} />
        {shapes.map(c => <path key={c.t} d={ringPath(c.rings, X, Y)} fill={ISO[ISO_STEPS.indexOf(c.t)]} fillOpacity={c.t > m.T ? 0.55 : 0.92} fillRule="evenodd" />)}
        <path d={shell + (inside ? ringPath(inside.rings, X, Y) : '')} fill="url(#cg-iso-hatch)" fillRule="evenodd" style={{ pointerEvents: 'none' }} />
        {shapes.map(c => <path key={'l' + c.t} d={ringPath(c.rings, X, Y)} fill="none" stroke={c.t === m.T ? INK.primary : SURFACE} strokeWidth={c.t === m.T ? (mini ? 1 : 1.6) : 0.8} strokeOpacity={c.t === m.T ? 0.9 : 0.6} />)}
      </g>
      <path d={shell} fill="none" stroke={INK.faint} strokeWidth="1" strokeDasharray="3 3" />
      {order.slice().reverse().map((p, k) => <circle key={k} cx={kx(p.kx)} cy={ky(p.ky)} r={hp === p ? rad(p) + 1.5 : rad(p)} fill={p.t > 60 ? '#5B6779' : ISO[Math.max(0, band(p.t))]} stroke={p.t > m.T ? EMPH : SURFACE} strokeWidth={p.t > m.T ? (mini ? 1.2 : 2.4) : 1.2} />)}
      {named.map((p, k) => <Txt key={'n' + k} x={kx(p.kx) + rad(p) + 4} y={ky(p.ky) + 4} size={11} color={p.t > m.T ? INK.primary : INK.secondary} stroke={SURFACE} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{fit(p.label, 140, 11)}</Txt>)}
      {!mini && <rect x={ox} y={oy} width={mw} height={mh} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}
