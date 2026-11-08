// Графіки демо: розклад машин (Ґантт) з повзунком часу, структура вартості, горизонтальні смуги, години доставок.
import { useEffect, useRef, useState } from 'react';
import { useWidth } from '../../dashboard/src/charts.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';
import { TYPES, DAY, NODES } from './world.js';
import { COL, rgba } from './engine.js';
import { hm } from './clock.js';
import { sfx } from './sound.js';

const VICON = ['truck', 'lorry', 'van'];
export const vIcon = t => VICON[t];

// ——— розклад машин ———
export function Gantt({ ctx, sol, clock, selRoute, setSelRoute, onStop }) {
  const { T, f, placeName } = ctx;
  const [ref, W] = useWidth(900);
  const [hov, setHov] = useState(null);
  const headRef = useRef(null), labRef = useRef(null), drag = useRef(false);
  const narrow = W < 640, LW = narrow ? 86 : 150, RH = narrow ? 30 : 32, TOP = 26;
  const rows = sol.routes.length + (sol.unserved.length ? 1 : 0), H = TOP + rows * RH + 8;
  const x = m => LW + ((m - DAY[0]) / (DAY[1] - DAY[0])) * (W - LW - 10);
  const inv = px => DAY[0] + ((px - LW) / (W - LW - 10)) * (DAY[1] - DAY[0]);
  useEffect(() => clock.sub(v => {
    if (headRef.current) headRef.current.setAttribute('transform', `translate(${x(v).toFixed(1)},0)`);
    if (labRef.current) labRef.current.textContent = hm(v);
  }), [W]);
  const scrub = e => {
    const r = ref.current.getBoundingClientRect(), px = e.clientX - r.left;
    if (px < LW) return;
    const v = inv(px), prev = clock.get();
    if (Math.floor(v / 60) !== Math.floor(prev / 60)) sfx.tick();
    clock.play(false); clock.set(v);
  };
  const hours = [];
  for (let h = DAY[0] / 60; h <= DAY[1] / 60; h++) hours.push(h);
  const hs = hov && hov.x;
  return (
    <div className="gantt" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={T.gantt.aria}
        onPointerDown={e => { if (e.target.closest('[data-stop]')) return; drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }}
        onPointerMove={e => drag.current && scrub(e)} onPointerUp={() => { drag.current = false; }} onPointerLeave={() => setHov(null)}>
        <defs>
          <pattern id="gt-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,.28)" strokeWidth="1.2" /></pattern>
        </defs>
        {hours.map(h => (
          <g key={h} transform={`translate(${x(h * 60)},0)`}>
            <line y1={TOP - 4} y2={H} stroke={h % 3 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.09)'} />
            {(!narrow || h % 3 === 0) && <text y="14" textAnchor="middle" className="gt-hour">{String(h).padStart(2, '0')}</text>}
          </g>
        ))}
        {hs && <rect x={x(hs.stop.a)} y={TOP - 4} width={Math.max(1, x(hs.stop.b) - x(hs.stop.a))} height={H - TOP + 4} fill="rgba(127,220,255,.07)" stroke="rgba(127,220,255,.35)" strokeDasharray="3 3" />}
        {sol.routes.map((r, ri) => {
          const y = TOP + ri * RH, col = COL.depot[r.d], dim = selRoute != null && selRoute !== ri;
          return (
            <g key={r.id} opacity={dim ? 0.38 : 1} onClick={() => setSelRoute(selRoute === ri ? null : ri)} style={{ cursor: 'pointer' }}>
              <rect x="0" y={y} width={W} height={RH} fill={selRoute === ri ? 'rgba(255,255,255,.05)' : 'transparent'} />
              <rect x="2" y={y + RH / 2 - 9} width="4" height="18" rx="2" fill={col} />
              <text x="12" y={y + RH / 2 + 4} className="gt-id">{r.id}</text>
              <g transform={`translate(${narrow ? 40 : 46},${y + RH / 2 - 8})`} className="gt-ic"><title>{T.vehicle[TYPES[r.t].id]}</title><Icon name={VICON[r.t]} size={16} /></g>
              {!narrow && <>
                <rect x="68" y={y + RH / 2 - 3} width="70" height="6" rx="3" fill="rgba(255,255,255,.07)" />
                <rect x="68" y={y + RH / 2 - 3} width={70 * Math.min(1, r.load / r.cap)} height="6" rx="3" fill={rgba(col, 0.8)} />
              </>}
              <line x1={x(r.start)} x2={x(r.end)} y1={y + RH / 2} y2={y + RH / 2} stroke={rgba(col, 0.35)} strokeWidth="1.5" />
              {r.legs.map((l, k) => <rect key={'l' + k} x={x(l.dep)} y={y + RH / 2 - 2} width={Math.max(0.5, x(l.arr) - x(l.dep))} height="4" rx="2" fill={rgba(col, 0.75)} />)}
              {r.stops.map((s, k) => {
                const bx = x(s.start), bw = Math.max(3, x(s.end) - x(s.start)), late = s.late > 0.5;
                return (
                  <g key={k} data-stop="1" onPointerEnter={() => setHov({ r, s, x: s, ri })} onPointerLeave={() => setHov(null)} onClick={e => { e.stopPropagation(); onStop && onStop(s.stop.node, ri); }}>
                    {s.wait > 0.5 && <rect x={x(s.arr)} y={y + RH / 2 - 6} width={Math.max(1, x(s.start) - x(s.arr))} height="12" fill="url(#gt-hatch)" />}
                    <rect x={bx} y={y + RH / 2 - 7} width={bw} height="14" rx="3" fill={col} stroke={late ? COL.rubyHi : 'rgba(6,10,17,.9)'} strokeWidth={late ? 2 : 1} />
                    {late && <circle cx={bx + bw} cy={y + RH / 2 - 7} r="3.5" fill={COL.rubyHi} />}
                  </g>
                );
              })}
            </g>
          );
        })}
        {sol.unserved.length > 0 && (() => {
          const y = TOP + sol.routes.length * RH;
          return (
            <g>
              <rect x="2" y={y + RH / 2 - 9} width="4" height="18" rx="2" fill={COL.rubyHi} />
              <text x="12" y={y + RH / 2 + 4} className="gt-id bad">{narrow ? '!' : T.gantt.unserved}</text>
              {sol.unserved.map((u, k) => <rect key={k} x={x(u.stop.a)} y={y + RH / 2 - 5 + (k % 3) * 3 - 3} width={Math.max(2, x(u.stop.b) - x(u.stop.a))} height="3" rx="1.5" fill={rgba(COL.rubyHi, 0.55)} />)}
            </g>
          );
        })()}
        <g ref={headRef} transform={`translate(${x(clock.get())},0)`} className="gt-head">
          <line y1={TOP - 6} y2={H} />
          <rect x="-20" y="0" width="40" height="17" rx="3" />
          <text ref={labRef} y="12.5" textAnchor="middle">{hm(clock.get())}</text>
        </g>
      </svg>
      {hov && (
        <div className="chart-tip gt-tip" style={{ left: Math.min(W - 230, Math.max(0, x(hov.s.start) - 40)), top: TOP + hov.ri * RH + RH }}>
          <strong>{placeName(NODES[hov.s.stop.node])} · {T.kind[hov.s.stop.c.kind]}</strong>
          <span>{T.gantt.window}: {hm(hov.s.stop.a)}-{hm(hov.s.stop.b)}</span>
          <span>{T.gantt.arrive}: {hm(hov.s.arr)}{hov.s.wait > 0.5 ? ' · ' + T.gantt.wait + ' ' + f.min(hov.s.wait) : ''}</span>
          <span>{T.gantt.unload}: {hm(hov.s.start)}-{hm(hov.s.end)} · {f.int(hov.s.stop.q)} {T.units.pal}</span>
          {hov.s.late > 0.5 && <span className="bad">{T.gantt.late} {f.min(hov.s.late)}</span>}
        </div>
      )}
    </div>
  );
}

// ——— структура вартості: два стовпці (оптимізований і ручний план) ———
const PART_COL = { fixed: '#2A4F86', fuel: '#5C93D6', wear: '#86B6EE', driver: '#ACD5FF', pen: COL.rubyHi };
export function CostStack({ ctx, rows }) {
  const { T, f } = ctx;
  const [ref, W] = useWidth(520);
  const max = Math.max(...rows.map(r => r.total)), LW = 96;
  return (
    <div ref={ref} className="cost-stack">
      {rows.map(r => (
        <div key={r.key} className="cs-row">
          <span className="cs-name">{r.label}</span>
          <div className="cs-bar" style={{ width: Math.max(40, ((W - LW - 128) * r.total) / max) }}>
            {['fixed', 'fuel', 'wear', 'driver', 'pen'].map(k => r.parts[k] > 1 && (
              <i key={k} style={{ flex: r.parts[k], background: PART_COL[k] }} title={T.parts[k] + ': ' + f.uah(r.parts[k])} />
            ))}
          </div>
          <b>{f.uahK(r.total)}</b>
        </div>
      ))}
      <div className="cs-legend">
        {['fixed', 'fuel', 'wear', 'driver', 'pen'].map(k => <span key={k}><i style={{ background: PART_COL[k] }} />{T.parts[k]}</span>)}
      </div>
    </div>
  );
}

// ——— горизонтальні смуги зі значенням і підписом ———
export function HBars({ items, fmt, colorOf, onPick, selected, max: mx, neg }) {
  const max = mx || Math.max(1e-9, ...items.map(i => Math.abs(i.v)));
  return (
    <div className="hbars">
      {items.map(i => (
        <button type="button" key={i.key} className={'hb-row' + (selected === i.key ? ' on' : '')} onClick={() => onPick && onPick(i)}>
          <span className="hb-name">{i.icon && <Icon name={i.icon} size={14} />}{i.label}</span>
          <span className="hb-track">
            <i style={{ width: Math.max(1.5, (Math.abs(i.v) / max) * 100) + '%', background: colorOf ? colorOf(i) : COL.hud, marginLeft: neg && i.v < 0 ? 0 : undefined }} />
          </span>
          <b>{fmt(i.v, i)}</b>
        </button>
      ))}
    </div>
  );
}

// ——— доставки за годинами: вчасно і із запізненням ———
export function HourBars({ ctx, sol }) {
  const { T, f } = ctx;
  const [ref, W] = useWidth(520);
  const H = 150, B = 22, hours = [];
  for (let h = DAY[0] / 60; h < DAY[1] / 60; h++) hours.push({ h, ok: 0, late: 0 });
  sol.routes.forEach(r => r.stops.forEach(s => { const k = Math.floor(s.start / 60) - DAY[0] / 60; if (hours[k]) hours[k][s.late > 0.5 ? 'late' : 'ok']++; }));
  const max = Math.max(1, ...hours.map(h => h.ok + h.late)), bw = (W - 30) / hours.length;
  const [hov, setHov] = useState(null);
  return (
    <div ref={ref} className="hour-bars">
      <svg width={W} height={H + B} role="img" aria-label={T.orders.hoursAria}>
        {[0.5, 1].map(k => <line key={k} x1="26" x2={W} y1={H - (H - 10) * k} y2={H - (H - 10) * k} stroke="rgba(255,255,255,.06)" />)}
        <text x="0" y="14" className="gt-hour">{f.int(max)}</text>
        {hours.map((h, i) => {
          const x0 = 30 + i * bw, ho = ((H - 10) * h.ok) / max, hl = ((H - 10) * h.late) / max;
          return (
            <g key={h.h} onPointerEnter={() => setHov(h)} onPointerLeave={() => setHov(null)}>
              <rect x={x0} y="0" width={bw} height={H} fill="transparent" />
              {h.ok > 0 && <rect x={x0 + 2} y={H - ho} width={bw - 4} height={ho} rx="3" fill={COL.hud} fillOpacity=".8" />}
              {h.late > 0 && <rect x={x0 + 2} y={H - ho - hl - (h.ok ? 2 : 0)} width={bw - 4} height={hl} rx="3" fill={COL.rubyHi} />}
              {(i % 2 === 0 || W > 520) && <text x={x0 + bw / 2} y={H + 15} textAnchor="middle" className="gt-hour">{String(h.h).padStart(2, '0')}</text>}
            </g>
          );
        })}
      </svg>
      {hov && <div className="chart-tip" style={{ left: Math.min(W - 170, 30 + (hov.h - DAY[0] / 60) * bw), top: 4 }}><strong>{String(hov.h).padStart(2, '0')}:00-{String(hov.h + 1).padStart(2, '0')}:00</strong><span>{T.orders.onTime}: {f.int(hov.ok)}</span>{hov.late > 0 && <span className="bad">{T.orders.lateN}: {f.int(hov.late)}</span>}</div>}
      <div className="cs-legend"><span><i style={{ background: COL.hud }} />{T.orders.onTime}</span><span><i style={{ background: COL.rubyHi }} />{T.orders.lateN}</span></div>
    </div>
  );
}
