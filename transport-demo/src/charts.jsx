// Графіки демо: криві покриття, точки рівності доступу, розподіл населення за часом, порівняння способів пересування.
// Палітра способів: Cobalt, Teal, Magenta (перевірено валідатором; кожна лінія ще й з підписом і власним маркером).
import { useState } from 'react';
import { useWidth } from '../../dashboard/src/charts.jsx';
import { BANDS } from './model.js';
import { ZONE, MODE_COLOR, NO_ZONE } from './map.jsx';

const GRID = 'rgba(255,255,255,.08)';
const MARK = { car: 'circle', pt: 'square', walk: 'triangle' };

export function Marker({ kind, x, y, r = 4.5, fill }) {
  if (kind === 'square') return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx="1.2" fill={fill} stroke="#0E131B" strokeWidth="2" />;
  if (kind === 'triangle') return <path d={`M${x},${y - r * 1.15}L${x + r * 1.1},${y + r * 0.8}L${x - r * 1.1},${y + r * 0.8}Z`} fill={fill} stroke="#0E131B" strokeWidth="2" strokeLinejoin="round" />;
  return <circle cx={x} cy={y} r={r} fill={fill} stroke="#0E131B" strokeWidth="2" />;
}
export const modeMarker = m => MARK[m];

// Крива покриття: частка населення, що дістається за t хвилин
export function CoverageChart({ curves, modes, th, T, f, label, height = 300 }) {
  const [ref, W] = useWidth(700);
  const [hi, setHi] = useState(null);
  const L = 46, R = W < 520 ? 16 : 92, Tp = 14, B = 34, H = height, MAX = 120;
  const x = t => L + (W - L - R) * (t / MAX);
  const y = v => Tp + (H - Tp - B) * (1 - v);
  const pathOf = c => { let s = ''; for (let t = 0; t <= MAX; t++) s += (t ? 'L' : 'M') + x(t).toFixed(1) + ',' + y(c[t]).toFixed(1); return s; };
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.round(((e.clientX - r.left - L) / (W - L - R)) * MAX);
    setHi(t >= 0 && t <= MAX ? t : null);
  };
  // підписи на кінцях ліній без накладання
  const ends = modes.map(m => ({ m, v: curves[m][MAX] })).sort((a, b) => b.v - a.v);
  let last = -Infinity;
  ends.forEach(e => { let yy = y(e.v); if (yy - last < 16) yy = last + 16; e.y = yy; last = yy; });
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{f.pct(v)}</text>
          </g>
        ))}
        {[0, 15, 30, 45, 60, 90, 120].map(t => <text key={t} x={x(t)} y={H - 12} className="axis" textAnchor="middle">{t}</text>)}
        <text x={W - R} y={H - 0} className="axis-faint" textAnchor="end">{T.minAxis}</text>
        <line x1={x(th)} x2={x(th)} y1={Tp - 4} y2={H - B} className="th-line" />
        <text x={x(th) + 6} y={H - B - 8} className="th-text">{T.thShort.replace('{t}', th)}</text>
        {modes.map(m => <path key={m} d={pathOf(curves[m])} fill="none" stroke={MODE_COLOR[m]} strokeWidth="2.2" strokeLinejoin="round" strokeDasharray={m === 'walk' ? '5 4' : undefined} />)}
        {modes.map(m => <Marker key={'m' + m} kind={MARK[m]} x={x(th)} y={y(curves[m][th])} fill={MODE_COLOR[m]} />)}
        {W >= 520 && ends.map(e => (
          <g key={e.m}>
            <Marker kind={MARK[e.m]} x={W - R + 12} y={e.y} r={3.8} fill={MODE_COLOR[e.m]} />
            <text x={W - R + 22} y={e.y + 4} className="end-label">{T.modes[e.m]}</text>
          </g>
        ))}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={Tp} y2={H - B} stroke="rgba(244,246,248,.35)" />}
        {hi != null && modes.map(m => <circle key={'h' + m} cx={x(hi)} cy={y(curves[m][hi])} r="4" fill={MODE_COLOR[m]} stroke="#0E131B" strokeWidth="2" />)}
      </svg>
      {hi != null && (
        <div className={'chart-tip' + (x(hi) < W * 0.3 ? ' tip-l' : x(hi) > W * 0.7 ? ' tip-r' : '')} style={{ left: x(hi), top: 6 }} role="status">
          <b>{T.withinMin.replace('{t}', hi)}</b>
          {modes.map(m => <small key={m}><i className="tip-sw" style={{ background: MODE_COLOR[m] }} />{T.modes[m]}: <strong className="tip-v">{f.pct(curves[m][hi])}</strong></small>)}
        </div>
      )}
    </div>
  );
}

// Рівність доступу: для кожної групи частка в межах часу, точка на спосіб пересування
export function EquityDots({ rows, modes, T, f, label }) {
  const [ref, W] = useWidth(520);
  const [hi, setHi] = useState(null);
  const L = W < 420 ? 86 : 120, R = 16, rowH = 46, Tp = 10, H = Tp + rows.length * rowH + 26;
  const x = v => L + (W - L - R) * v;
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label}>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={Tp} y2={H - 24} stroke={GRID} />
            <text x={x(v)} y={H - 8} className="axis" textAnchor="middle">{f.pct(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = Tp + i * rowH + rowH / 2;
          const vs = modes.map(m => r.v[m]);
          return (
            <g key={r.id}>
              <text x={0} y={cy + 4} className="row-label">{r.label}</text>
              <line x1={x(Math.min(...vs))} x2={x(Math.max(...vs))} y1={cy} y2={cy} stroke="rgba(168,176,188,.35)" strokeWidth="2" />
              {modes.map(m => (
                <g key={m} onPointerEnter={() => setHi({ i, m })} onPointerLeave={() => setHi(null)}>
                  <circle cx={x(r.v[m])} cy={cy} r="12" fill="transparent" />
                  <Marker kind={MARK[m]} x={x(r.v[m])} y={cy} r={5.2} fill={MODE_COLOR[m]} />
                </g>
              ))}
              {hi && hi.i === i && <text x={x(r.v[hi.m])} y={cy - 12} textAnchor="middle" className="value-label">{T.modes[hi.m]} {f.pct(r.v[hi.m])}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Розподіл населення за смугами часу: одна смуга, порядкова шкала зон
export function BandBar({ bands, total, T, f, bandHl, setBandHl, label }) {
  const parts = bands.map((v, i) => ({ i, v, c: i < BANDS.length ? ZONE[i] : NO_ZONE }));
  let acc = 0;
  return (
    <div className="bandbar" onMouseLeave={() => setBandHl && setBandHl(null)}>
      <div className="bandbar-track" role="img" aria-label={label}>
        {parts.map(p => {
          const w = (p.v / total) * 100, l = acc; acc += w;
          return w > 0 ? <i key={p.i} className={bandHl === p.i ? 'on' : ''} style={{ left: l + '%', width: `calc(${w}% - 2px)`, background: p.c }} onMouseEnter={() => setBandHl && setBandHl(p.i)} /> : null;
        })}
      </div>
      <div className="band-rows">
        {parts.map(p => (
          <button type="button" key={p.i} className={'band-row' + (bandHl === p.i ? ' on' : '')} onMouseEnter={() => setBandHl && setBandHl(p.i)} onFocus={() => setBandHl && setBandHl(p.i)} onBlur={() => setBandHl && setBandHl(null)}>
            <i style={{ background: p.c }} />
            <span>{i18nBand(T, p.i)}</span>
            <b>{f.int(p.v)}</b>
            <small>{f.pct(p.v / total)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
export const i18nBand = (T, i) => (i < BANDS.length ? T.bands[i] : T.bandsBeyond);

// Час до закладу трьома способами з межею
export function ModeBars({ times, th, T, f, max = 120 }) {
  return (
    <div className="mode-bars">
      {Object.entries(times).map(([m, t]) => {
        const v = Number.isFinite(t) ? Math.min(t, max) : max;
        return (
          <div key={m} className="mode-bar">
            <span className="mode-name"><svg width="12" height="12" viewBox="-6 -6 12 12"><Marker kind={MARK[m]} x={0} y={0} r={4} fill={MODE_COLOR[m]} /></svg>{T.modes[m]}</span>
            <span className="mode-track">
              <i style={{ width: (v / max) * 100 + '%', background: MODE_COLOR[m] }} />
              <s style={{ left: (th / max) * 100 + '%' }} title={T.thShort.replace('{t}', th)} />
            </span>
            <b className={t > th ? 'over' : ''}>{f.tmin(t)}</b>
          </div>
        );
      })}
    </div>
  );
}

// Етапи поїздки однією смугою
const LEG_COLOR = { walk0: '#A8B0BC', walk: '#A8B0BC', walk1: '#A8B0BC', wait: '#FFB020', ride: '#019586', drive0: '#3B82F6', drive: '#3B82F6', park: '#3B82F6' };
export function LegStrip({ legs, total, T, f, nameOf }) {
  const sum = legs.reduce((a, l) => a + l.min, 0) || 1;
  let acc = 0;
  return (
    <div className="leg-strip">
      <div className="leg-track">
        {legs.map((l, i) => {
          const w = (l.min / sum) * 100, left = acc; acc += w;
          return <i key={i} className={'leg-' + l.kind} style={{ left: left + '%', width: `calc(${w}% - 2px)`, background: LEG_COLOR[l.kind] }} />;
        })}
      </div>
      <ol className="leg-list">
        {legs.map((l, i) => (
          <li key={i}>
            <i style={{ background: LEG_COLOR[l.kind] }} className={'leg-dot leg-' + l.kind} />
            <span>{T.legText(l, f, nameOf)}</span>
            <b>{f.min(l.min)}</b>
          </li>
        ))}
      </ol>
      <p className="leg-total">{T.legTotal}<b>{f.min(total)}</b></p>
    </div>
  );
}
