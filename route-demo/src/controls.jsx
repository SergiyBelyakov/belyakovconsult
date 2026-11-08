// Тактильні елементи пульта: поворотна ручка з клацаннями, лічильник із прокруткою цифр, чип зміни.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../dashboard/src/icons.jsx';
import { sfx } from './sound.js';

const A0 = -135, A1 = 135, RAD = Math.PI / 180;
const polar = (r, a) => [r * Math.sin(a * RAD), -r * Math.cos(a * RAD)];
const arc = (r, a0, a1) => { const [x0, y0] = polar(r, a0), [x1, y1] = polar(r, a1); return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };

// Поворотна ручка: тягніть по колу або вгору-вниз; стрілки, PageUp/PageDown, Home/End; подвійне клацання
// повертає типове значення. Кожен крок клацає (звук, якщо ввімкнено, і вібрація на телефоні).
export function Knob({ label, value, min, max, step = 1, def, onChange, format = v => v, sub, accent = '#7FDCFF', icon, size = 92, disabled }) {
  const ref = useRef(null), drag = useRef(null), timer = useRef(null), curRef = useRef(value);
  const [bump, setBump] = useState(0), [active, setActive] = useState(false), [cur, setCur] = useState(value);
  // зовнішнє значення приходить лише тоді, коли ручку не крутять; план перераховується після відпускання
  useEffect(() => { if (!drag.current && !timer.current) { curRef.current = value; setCur(value); } }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const steps = Math.round((max - min) / step), frac = (cur - min) / (max - min || 1), ang = A0 + frac * (A1 - A0);
  const snap = v => Math.max(min, Math.min(max, Math.round((v - min) / step) * step + min));
  const set = v => {
    const nv = +snap(v).toFixed(4);
    if (nv !== curRef.current) { curRef.current = nv; setCur(nv); sfx.tick(); setBump(b => b + 1); }
  };
  const commit = () => { clearTimeout(timer.current); timer.current = null; if (curRef.current !== value) onChange(curRef.current); };
  const later = () => { clearTimeout(timer.current); timer.current = setTimeout(commit, 450); };
  const fromAngle = (x, y) => {
    const r = ref.current.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let a = Math.atan2(x - cx, cy - y) / RAD;
    a = Math.max(A0, Math.min(A1, a));
    return min + ((a - A0) / (A1 - A0)) * (max - min);
  };
  const down = e => {
    if (disabled) return;
    e.preventDefault();
    ref.current.focus();
    ref.current.setPointerCapture(e.pointerId);
    const r = ref.current.getBoundingClientRect(), far = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) > r.width * 0.2;
    drag.current = { y: e.clientY, v: curRef.current, mode: far ? 'angle' : 'vert' };
    setActive(true);
    if (far) set(fromAngle(e.clientX, e.clientY));
  };
  const move = e => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'angle') set(fromAngle(e.clientX, e.clientY));
    else set(d.v + ((d.y - e.clientY) / 140) * (max - min));
  };
  const up = () => { if (!drag.current) return; drag.current = null; setActive(false); commit(); };
  const key = e => {
    const big = Math.max(step, Math.round(steps / 5) * step);
    const m = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big }[e.key];
    if (m) { e.preventDefault(); set(curRef.current + m); later(); }
    else if (e.key === 'Home') { e.preventDefault(); set(min); later(); }
    else if (e.key === 'End') { e.preventDefault(); set(max); later(); }
  };
  const R = 38, ticks = [];
  const tickN = steps <= 24 ? steps : 12;
  for (let i = 0; i <= tickN; i++) {
    const a = A0 + (i / tickN) * (A1 - A0), on = i / tickN <= frac + 1e-6, [x0, y0] = polar(R + 4, a), [x1, y1] = polar(R + (i % (tickN > 12 ? 4 : 1) === 0 ? 9 : 7), a);
    ticks.push(<line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={on ? accent : 'rgba(255,255,255,.22)'} strokeWidth={on ? 1.8 : 1.2} />);
  }
  return (
    <div className={'knob' + (active ? ' active' : '') + (disabled ? ' disabled' : '')}>
      <div className="knob-head">{icon && <Icon name={icon} size={15} />}<span>{label}</span></div>
      <div ref={ref} className="knob-dial" role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={cur} aria-valuetext={String(format(cur))}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} onDoubleClick={() => { if (def != null) { set(def); commit(); } }} style={{ width: size, height: size }}>
        <svg viewBox="-56 -56 112 112" width={size} height={size} aria-hidden="true">
          <defs>
            <radialGradient id="kb-body" cx="40%" cy="32%" r="75%"><stop offset="0" stopColor="#2A3446" /><stop offset=".6" stopColor="#121925" /><stop offset="1" stopColor="#080C13" /></radialGradient>
          </defs>
          <g>{ticks}</g>
          <path d={arc(R, A0, A1)} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" strokeLinecap="round" />
          <path d={arc(R, A0, A1)} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="100 100" strokeDashoffset={100 - frac * 100} className="knob-arc" style={{ filter: `drop-shadow(0 0 4px ${accent})`, opacity: frac > 0.001 ? 1 : 0 }} />
          <g key={bump} className="knob-body">
            <circle r={R - 7} fill="url(#kb-body)" stroke="rgba(255,255,255,.14)" />
            <circle r={R - 11} fill="none" stroke="rgba(255,255,255,.05)" strokeDasharray="1.5 3" />
          </g>
          <g className="knob-ptr" style={{ transform: `rotate(${ang}deg)` }}>
            <line x1="0" y1={-(R - 13) * 0.25} x2="0" y2={-(R - 13)} stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="0" cy={-(R - 3)} r="2.2" fill={accent} />
          </g>
        </svg>
        <span className="knob-value">{format(cur)}</span>
      </div>
      {sub && <div className="knob-sub">{sub}</div>}
    </div>
  );
}

// Лічильник, у якого цифри прокручуються як у механічного одометра
export function Odo({ text, className = '' }) {
  const chars = String(text).split('');
  return (
    <span className={'odo ' + className} aria-label={text}>
      {chars.map((c, i) => /\d/.test(c)
        ? <span key={chars.length - i} className="odo-col" aria-hidden="true"><span className="odo-strip" style={{ transform: `translateY(${-Number(c) * 10}%)` }}>{'0123456789'.split('').map(d => <span key={d}>{d}</span>)}</span></span>
        : <span key={'s' + (chars.length - i)} className="odo-sep" aria-hidden="true">{c}</span>)}
    </span>
  );
}

// Чип зміни після дії людини: з'являється, світиться і згасає
export function DeltaChip({ value, text, good, id }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (id == null) return undefined;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3600);
    return () => clearTimeout(t);
  }, [id]);
  if (!show || !text) return null;
  return <span className={'delta-chip ' + (Math.abs(value) < 1e-9 ? 'flat' : good ? 'good' : 'bad')} key={id}><Icon name={value > 0 ? 'arrowUp' : value < 0 ? 'arrowDown' : 'check'} size={11} />{text}</span>;
}
