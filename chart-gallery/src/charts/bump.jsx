// Рейтинг у часі (bump chart): місце кожного учасника в кожному періоді, плавні переходи між періодами.
// Усі лінії нейтральні; кольором закріплено до п'яти учасників (спершу найбільший підйом і найбільше падіння),
// наведення виділяє рубіновим. Клацання лінії чи підпису закріплює або знімає учасника.
import { useMemo, useState } from 'react';
import { useWidth, useTip, Txt, Frame, Legend, fit, textW } from './kit.jsx';
import { SERIES, EMPH, INK, SURFACE, GRID } from '../palette.js';

const QUIET = '#4A5568', QUIET_DOT = '#5B6779';
// плавний перехід між сусідніми періодами: горизонтальні дотичні на кожній точці
function curve(pts) {
  let d = '', prev = null;
  pts.forEach(p => {
    if (!p) { prev = null; return; }
    if (!prev) d += `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    else { const mx = (prev[0] + p[0]) / 2; d += `C${mx.toFixed(1)},${prev[1].toFixed(1)} ${mx.toFixed(1)},${p[1].toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`; }
    prev = p;
  });
  return d;
}

export function Bump({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hov, setHov] = useState(null);
  const initial = useMemo(() => [m.rise, m.fall].filter(Boolean), [m]);
  const [pins, setPins] = useState(initial);
  const P = m.periods.length, N = m.N;
  const row = mini ? Math.min(12, 104 / N) : Math.max(24, Math.min(34, 420 / N));
  const Tp = mini ? 7 : 34, B = mini ? 6 : 14, H = Tp + (N - 1) * row + B + (mini ? 0 : 8);
  const showLeft = !mini && W >= 560;
  const nameW = Math.max(...m.items.map(i => textW(i.name, 12)));
  const labL = showLeft ? Math.min(W * 0.2, nameW + 22) : mini ? 6 : 16;
  const labR = mini ? 6 : Math.min(W * (showLeft ? 0.24 : 0.36), nameW + 46);
  const x = t => labL + (P > 1 ? ((W - labL - labR) * t) / (P - 1) : 0), y = r => Tp + (r - 1) * row;
  const colorOf = name => (hov === name ? EMPH : pins.includes(name) ? SERIES[pins.indexOf(name)] : null);
  const toggle = name => setPins(p => (p.includes(name) ? p.filter(n => n !== name) : [...p, name].slice(-5)));
  const order = [...m.items].sort((a, b) => (colorOf(a.name) ? 1 : 0) - (colorOf(b.name) ? 1 : 0) || (a.name === hov) - (b.name === hov));
  const last = P - 1;
  const show = (it, e) => {
    let t = last;
    if (e && e.currentTarget.ownerSVGElement) {
      const r = e.currentTarget.ownerSVGElement.getBoundingClientRect(), px = e.clientX - r.left;
      let bd = Infinity; m.periods.forEach((_, k) => { if (it.r[k] != null && Math.abs(x(k) - px) < bd) { bd = Math.abs(x(k) - px); t = k; } });
    }
    const first = it.r.findIndex(v => v != null);
    setHov(it.name);
    setTip({ x: x(t), y: y(it.r[t] ?? 1) - 14, title: it.name, rows: [
      { value: T.ui.place(it.r[t]), label: m.periods[t], color: EMPH, dot: true },
      ...(it.v[t] != null ? [{ value: f.num(it.v[t]), label: m.valueName }] : []),
      ...(t !== first && it.r[first] != null ? [{ value: T.ui.placeFrom(it.r[first], it.r[t]), label: m.periods[first] + ' → ' + m.periods[t] }] : []),
    ] });
  };
  const leave = () => { setHov(null); setTip(null); };
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={leave}
      legend={!mini && pins.length > 0 && <Legend kind="line" items={pins.length > 1 ? pins.map((n, k) => ({ label: n, color: SERIES[k] })) : [{ label: pins[0], color: SERIES[0] }, { label: T.ui.bumpOthers, color: QUIET }]} />}>
      {!mini && m.periods.map((p, k) => <Txt key={k} x={x(k)} y={14} anchor="middle" size={11.5} color={INK.secondary} weight={k === last ? 600 : 400}>{fit(p, (W - labL - labR) / Math.max(1, P - 1) - 4, 11.5)}</Txt>)}
      {!mini && m.periods.map((p, k) => <line key={k} x1={x(k)} x2={x(k)} y1={Tp - 10} y2={H - B} stroke={GRID} strokeWidth="1" />)}
      {order.map(it => {
        const c = colorOf(it.name), pts = it.r.map((r, k) => (r == null ? null : [x(k), y(r)]));
        return (
          <g key={it.name} style={{ cursor: mini ? undefined : 'pointer' }}>
            <path d={curve(pts)} fill="none" stroke={c || QUIET} strokeWidth={mini ? (c ? 2 : 1.2) : c ? 3 : 2} strokeLinecap="round" opacity={hov && !c ? 0.45 : 1} />
            {!mini && <path d={curve(pts)} fill="none" stroke="transparent" strokeWidth="14" onPointerMove={e => show(it, e)} onClick={() => toggle(it.name)} />}
            {!mini && pts.map((p, k) => p && (c
              ? <g key={k} style={{ pointerEvents: 'none' }}><circle cx={p[0]} cy={p[1]} r="9.5" fill={c} stroke={SURFACE} strokeWidth="2" /><Txt x={p[0]} y={p[1] + 3.8} anchor="middle" size={10.5} weight={600} color="#FFFFFF">{it.r[k]}</Txt></g>
              : <circle key={k} cx={p[0]} cy={p[1]} r="3.5" fill={QUIET_DOT} stroke={SURFACE} strokeWidth="1.5" opacity={hov ? 0.45 : 1} style={{ pointerEvents: 'none' }} />))}
            {mini && c && pts.map((p, k) => p && <circle key={k} cx={p[0]} cy={p[1]} r="2.4" fill={c} />)}
          </g>
        );
      })}
      {!mini && m.items.map(it => {
        const c = colorOf(it.name), rl = it.r[last], rf = it.r.find(v => v != null), kf = it.r.findIndex(v => v != null);
        const ink = c ? INK.primary : hov ? INK.faint : INK.muted;
        return (
          <g key={'l' + it.name}>
            {rl != null && <g>
              <Txt x={x(last) + 16} y={y(rl) + 4} size={12} color={ink} weight={c ? 600 : 400}>{fit(it.name, labR - 20, 12)}</Txt>
              <rect x={x(last) + 10} y={y(rl) - row / 2} width={labR - 10} height={row} fill="transparent" tabIndex="0" role="button" aria-pressed={pins.includes(it.name)} aria-label={it.name}
                style={{ cursor: 'pointer' }} onPointerMove={e => show(it, e)} onFocus={() => show(it)} onBlur={leave} onClick={() => toggle(it.name)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(it.name); } }} />
            </g>}
            {showLeft && rf != null && <Txt x={x(kf) - 16} y={y(rf) + 4} anchor="end" size={12} color={ink} style={{ pointerEvents: 'none' }}>{fit(it.name, labL - 20, 12)}</Txt>}
          </g>
        );
      })}
      {!mini && <Txt x={W} y={H - 2} anchor="end" size={10.5} color={INK.faint}>{m.desc ? T.ui.rankDesc : T.ui.rankAsc}</Txt>}
    </Frame>
  );
}
