// Будівельні блоки пояснювальних графіків: рамка, лінії, стовпчики, горизонтальні стовпчики, водоспад внесків,
// «льодяники» поодиноких замовлень і складені стовпчики внесків по кроках. Одна вісь, тонкі позначки,
// числа текстовими кольорами; колір несе лише належність до ряду. Неоновий стиль як в основному графіку:
// сяйво кольорових ліній, градієнт прогнозу, м’які заливки; наведення підсвічує позначку і показує значення.
import { Fragment, useRef, useState } from 'react';
import { useWidth, useUid, niceTicks, pathOf, areaOf, Glow, BRAND, ACT, FC, FC_GRAD, POL, ZeroFill, gradStops, tipSide } from './charts.jsx';
import { GRID, BASE } from '../../chart-gallery/src/palette.js';
import { futureDates } from './format.js';

// історія (факт) кобальтом, як на основному графіку
export const NEUTRAL = ACT;
// полярність бренд-буку: вище нуля Cyan, нижче Coral (пара перевірена валідатором палітри)
export const UP = POL.pos, DOWN = POL.neg;
// внутрішні величини моделі (ваги, приріст, важливість) за замовчуванням Violet
export const MODEL = BRAND.violet;
const WHITE = '#F4F6F8';

export function Frame({ title, sub, children, aside, className = '' }) {
  return (
    <div className={'ex-frame ' + className}>
      <div className="ex-head"><div><h5>{title}</h5>{sub && <small>{sub}</small>}</div>{aside}</div>
      {children}
    </div>
  );
}

// Підпис дати для підказки: індекс i рахується від from, за кінцем ряду йдуть майбутні дати
export function dateLab(S, from, fmt) {
  const n = S.dates.length;
  let fut = [];
  return i => {
    const t = from + i;
    if (t < 0) return '';
    if (t < n) return fmt.dateLong(S.dates[t], S.freq);
    if (fut.length <= t - n) fut = futureDates(S.dates[n - 1], t - n + 32, S.freq);
    return fmt.dateLong(fut[t - n], S.freq);
  };
}

// Спільні означення: сяйво і вертикальний градієнт для лінії наведення
function Defs({ u, W, H, t, b }) {
  return (
    <>
      <Glow id={`${u}-g`} W={W} H={H} s1={1.5} s2={4.5} k={0.85} />
      <linearGradient id={`${u}-v`} gradientUnits="userSpaceOnUse" x1="0" y1={t} x2="0" y2={b}>
        <stop offset="0" stopColor="#93C5FD" stopOpacity="0" /><stop offset=".2" stopColor="#93C5FD" stopOpacity=".7" />
        <stop offset=".8" stopColor="#93C5FD" stopOpacity=".7" /><stop offset="1" stopColor="#93C5FD" stopOpacity="0" />
      </linearGradient>
    </>
  );
}
const neonStops = gradStops(FC_GRAD);

// Підказка: заголовок (дата чи позиція) і рядки «колір · назва · значення»
export function Tip({ x, W, head, rows, fmt }) {
  return (
    <div className="fc-tip fc-tip-sm ex-tip" style={tipSide(x, W)}>
      {head && <strong>{head}</strong>}
      {rows.map((r, k) => (
        <span key={k}>
          <i className={'fc-sw' + (r.dash ? ' dash' : '') + (r.cls ? ' ' + r.cls : '')} style={r.color ? { background: r.color, '--sw': r.color } : null} />
          <em className="fc-tip-l">{r.name || ''}</em><b>{r.text ?? fmt(r.v)}</b>
        </span>
      ))}
    </div>
  );
}

// Кілька ліній на одній осі. marks: вертикальні позначки [{ x, label }], ticks: підписи осі X [{ i, label }].
// Ряд: { values, x0, color, w, dash, op, name } або коридор { band: true, lo, hi, color }. xlab(i): заголовок підказки
export function Lines({ series, height = 120, zero = false, label, fmt, vfmt, markX, marks = [], ticks = null, dots = null, xlab = null }) {
  const ref = useRef(null), W = useWidth(ref, 400), u = useUid('ln');
  const [hov, setHov] = useState(null);
  const all = series.flatMap(s => (s.band ? [...s.lo, ...s.hi] : s.values).filter(Number.isFinite));
  if (dots) dots.forEach(d => { if (Number.isFinite(d.y)) all.push(d.y); });
  if (zero) all.push(0);
  const yt = niceTicks(Math.min(...all), Math.max(...all), 3), y0 = yt[0], y1 = yt[yt.length - 1];
  const N = Math.max(...series.map(s => (s.x0 || 0) + (s.values || s.lo).length));
  const M = { l: 44, r: 8, t: marks.some(m => m.label) ? 16 : 6, b: ticks ? 18 : 6 }, bottom = height - M.b;
  const X = i => M.l + (i / Math.max(1, N - 1)) * (W - M.l - M.r), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  // підписи позначок не налазять один на одного: ближчий за ~64 px підпис пропускається, лінія лишається
  let lastX = -1e9;
  const shown = marks.map(m => { const x = X(m.x), ok = !!m.label && x - lastX > 64; if (ok) lastX = x; return ok; });
  const op = s => s.op ?? 1, wd = s => s.w || 1.6;
  const plain = c => !c || c === WHITE || c === BRAND.pale || c === BRAND.silver || c === BRAND.slate;
  // сяють кольорові помітні лінії; лінії кольору прогнозу беруть неоновий градієнт, спільний на всю ширину, тож стики не рвуться
  const glows = s => !plain(s.color) && op(s) >= 0.6 && wd(s) >= 1.2;
  const neon = s => s.color === FC && wd(s) >= 1.8 && op(s) >= 0.6;
  const lines = series.map((s, k) => ({ s, k })).filter(o => !o.s.band);
  const solo = series.length === 1 && !series[0].band && !plain(series[0].color) ? series[0] : null;
  const zIn = zero && y0 <= 0 && y1 >= 0, zy = zIn ? Y(0) : bottom;
  // одна лінія з нулем на осі: полярність TRON, вище нуля блакитна, нижче помаранчева, заливка до нуля
  const polar = solo && zIn && solo.values.filter(Number.isFinite).length >= 2 ? solo : null;
  const sgn = v => (v >= 0 ? POL.pos : POL.neg);
  // головна лінія моделі (колір прогнозу, суцільна, остання) отримує заливку до нуля свого градієнта
  const prim = polar ? null : [...lines].reverse().map(o => o.s).find(x => neon(x) && !x.dash) || null;
  // колір для проекцій, точок і підказки: полярність за знаком, неон прогнозу рубіном, інакше колір ряду
  const colOf = (x, v) => (x === polar ? sgn(v) : neon(x) ? FC : x.color || NEUTRAL);
  const later = i => markX != null && i > markX;
  const xr = s => { const a = s.x0 || 0, len = (s.values || s.lo).length; return [X(a), Math.max(X(a) + 1, X(a + len - 1))]; };
  const ptsOf = s => s.values.map((v, i) => [X((s.x0 || 0) + i), Y(v)]);
  const vf = vfmt || fmt || (v => String(v)), compact = height < 100;

  const onMove = e => {
    const r = ref.current.getBoundingClientRect(), i = Math.round(((e.clientX - r.left - M.l) / Math.max(1, W - M.l - M.r)) * (N - 1));
    setHov(i >= 0 && i < N ? i : null);
  };
  let rows = [];
  if (hov != null) {
    rows = lines.filter(o => op(o.s) >= 0.5).map(o => {
      const j = hov - (o.s.x0 || 0);
      return { ...o, j, v: j >= 0 && j < o.s.values.length ? o.s.values[j] : NaN };
    }).filter(o => Number.isFinite(o.v));
    // точка стику прогнозу з історією повторює останній факт: лишаємо її один раз
    const joint = o => o.j === 0 && (o.s.x0 || 0) > 0;
    rows = rows.filter(o => !(joint(o) && rows.some(p => p !== o && !joint(p) && Math.abs(p.v - o.v) < 1e-9)));
    if (rows.length > 6) { const keep = new Set(rows.slice().sort((a, b) => wd(b.s) - wd(a.s)).slice(0, 6).map(o => o.k)); rows = rows.filter(o => keep.has(o.k)); }
  }
  // коридори з назвою теж потрапляють у підказку як «від … до»
  const bandRows = hov == null ? [] : series.map((s, k) => ({ s, k })).filter(o => o.s.band && o.s.name).map(o => {
    const j = hov - (o.s.x0 || 0), lo = o.s.lo[j], hi = o.s.hi[j];
    return j > 0 && Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? { ...o, lo, hi } : null;
  }).filter(Boolean);

  return (
    <div ref={ref} className="ex-lines" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
      <svg width={W} height={height} role="img" aria-label={label}>
        <defs>
          <Defs u={u} W={W} H={height} t={M.t} b={bottom} />
          {lines.some(o => neon(o.s)) && <linearGradient id={`${u}-n`} gradientUnits="userSpaceOnUse" x1={M.l} x2={W - M.r} y1="0" y2="0">{neonStops}</linearGradient>}
          {series.map((s, k) => {
            if (!s.band || s.color !== FC) return null;
            const [a, b] = xr(s);
            return <linearGradient key={'b' + k} id={`${u}-b${k}`} gradientUnits="userSpaceOnUse" x1={a} x2={b} y1="0" y2="0">{gradStops(FC_GRAD, 0.34, 0.26)}</linearGradient>;
          })}
          {solo && !polar && (
            <linearGradient id={`${u}-a`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={M.t} y2={bottom}>
              <stop offset="0" stopColor={solo.color} stopOpacity=".3" /><stop offset=".6" stopColor={solo.color} stopOpacity=".08" /><stop offset="1" stopColor={solo.color} stopOpacity="0" />
            </linearGradient>
          )}
        </defs>
        {yt.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 && zero ? null : GRID} className={v === 0 && zero ? 'ex-zero' : null} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt ? fmt(v) : v}</text></g>)}
        {markX != null && <line x1={X(markX)} x2={X(markX)} y1={M.t} y2={bottom} className="fc-today" />}
        {marks.map((m, k) => <g key={k}><line x1={X(m.x)} x2={X(m.x)} y1={M.t - 4} y2={bottom} className="ex-mark" />{shown[k] && <text x={Math.min(W - M.r - 2, Math.max(M.l + 2, X(m.x)))} y={M.t - 6} textAnchor={X(m.x) > W - 60 ? 'end' : X(m.x) < M.l + 40 ? 'start' : 'middle'} className="ex-mark-label">{m.label}</text>}</g>)}
        {solo && !polar && !neon(solo) && <ZeroFill id={`${u}-s`} pts={ptsOf(solo)} zy={zy} top={M.t} bot={bottom} W={W} color={solo.color} k={0.85} />}
        {prim && <ZeroFill id={`${u}-f`} pts={ptsOf(prim)} zy={zy} top={M.t} bot={bottom} W={W} grad={FC_GRAD} x1={M.l} x2={W - M.r} k={0.6} />}
        {polar && <ZeroFill id={`${u}-z`} pts={ptsOf(polar)} zy={zy} top={M.t} bot={bottom} W={W} color={POL.pos} neg={POL.neg} k={1.15} />}
        {polar && [['a', POL.pos], ['b', POL.neg]].map(([c, col]) => <path key={c} d={pathOf(ptsOf(polar))} fill="none" stroke={col} strokeWidth={wd(polar)} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${u}-z-${c})`} filter={`url(#${u}-g)`} />)}
        {series.map((s, k) => s === polar ? null : s.band
          ? <path key={k} d={areaOf(s.lo.map((_, i) => X((s.x0 || 0) + i)), s.lo.map(Y), s.hi.map(Y))} fill={s.color === FC ? `url(#${u}-b${k})` : s.color} opacity={s.color === FC ? 1 : 0.18} className="fc-fill" />
          : <path key={k} d={pathOf(ptsOf(s))} fill="none" stroke={neon(s) ? `url(#${u}-n)` : s.color || NEUTRAL} strokeWidth={wd(s)} strokeDasharray={s.dash || null}
              strokeLinejoin="round" strokeLinecap={s.dash ? null : 'round'} opacity={op(s)} filter={glows(s) ? `url(#${u}-g)` : null} />)}
        {dots && dots.map((d, k) => <circle key={k} cx={X(d.x)} cy={Y(d.y)} r={d.r || 3} fill={d.color || FC} stroke="#0E131B" strokeWidth="1.5" />)}
        {ticks && ticks.map(t => <text key={t.i} x={X(t.i)} y={height - 4} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
        {hov != null && rows.length + bandRows.length > 0 && (
          <g pointerEvents="none">
            <line x1={X(hov)} x2={X(hov)} y1={M.t} y2={bottom} stroke={`url(#${u}-v)`} strokeWidth="1" opacity=".5" />
            {rows.length > 0 && (() => {
              // проекції TRON головної точки на підлогу (нуль чи низ) і на вісь значень
              const pr = rows[rows.length - 1], py = Y(pr.v), x = X(hov);
              return (
                <g className={'ex-projg' + (later(hov) ? ' fut' : '')} filter={`url(#${u}-g)`} style={{ '--pc': colOf(pr.s, pr.v) }}>
                  <line x1={x} x2={x} y1={py} y2={zy} className="ex-proj" />
                  <line x1={M.l} x2={x} y1={py} y2={py} className="ex-proj" />
                  <rect x="-3.2" y="-3.2" width="6.4" height="6.4" transform={`translate(${x.toFixed(1)},${zy.toFixed(1)}) rotate(45)`} className="ex-pdia" />
                  <rect x="-3.2" y="-3.2" width="6.4" height="6.4" transform={`translate(${M.l},${py.toFixed(1)}) rotate(45)`} className="ex-pdia" />
                </g>
              );
            })()}
            {rows.map(o => <circle key={o.k} cx={X(hov)} cy={Y(o.v)} r={glows(o.s) || o.s === polar ? 3.8 : 3.2} fill={colOf(o.s, o.v)} stroke="#F4F6F8" strokeWidth="1.2" filter={glows(o.s) || o.s === polar ? `url(#${u}-g)` : null} />)}
          </g>
        )}
      </svg>
      {hov != null && compact && rows.length > 0 && (() => {
        const o = rows[rows.length - 1], x = X(hov), y = Math.max(-6, Y(o.v) - 24);
        return <span className="fc-sp-val" style={{ top: y, ...(x > W * 0.7 ? { right: W - x + 8 } : { left: x + 8 }) }}>{vf(o.v)}</span>;
      })()}
      {hov != null && !compact && rows.length + bandRows.length > 0 && (
        <Tip x={X(hov)} W={W} head={xlab ? xlab(hov) : null} fmt={vf}
          rows={[...rows.map(o => ({ v: o.v, name: o.s.name, dash: !!o.s.dash, color: neon(o.s) && !o.s.dash ? null : colOf(o.s, o.v), cls: o.s !== polar && neon(o.s) && !o.s.dash ? 'fc' : '' })),
            ...bandRows.map(o => ({ name: o.s.name, text: `${vf(o.lo)} … ${vf(o.hi)}`, color: o.s.color === FC ? null : o.s.color, cls: o.s.color === FC ? 'band' : '' }))]} />
      )}
    </div>
  );
}

// Стовпчики з підписами під ними (вертикальні): градієнт від вершини до осі, наведений стовпчик світиться
export function Bars({ values, labels, height = 120, fmt, color = MODEL, colors, highlight, label, se, xlab = null }) {
  const ref = useRef(null), W = useWidth(ref, 400), u = useUid('br');
  const [hov, setHov] = useState(null);
  const lo = Math.min(0, ...values.map((v, i) => v - (se?.[i] ? 1.96 * se[i] : 0)).filter(Number.isFinite));
  const hi = Math.max(0, ...values.map((v, i) => v + (se?.[i] ? 1.96 * se[i] : 0)).filter(Number.isFinite));
  const ticks = niceTicks(lo, hi, 3), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const M = { l: 44, r: 6, t: 6, b: labels ? 18 : 6 }, n = values.length, gap = n > 30 ? 1 : 2;
  const bw = (W - M.l - M.r) / n - gap, X = i => M.l + i * (bw + gap), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  const every = Math.ceil(n / Math.max(1, Math.floor((W - M.l) / 34)));
  // один колір за замовчуванням і значення обох знаків: полярність бренд-буку (Cyan вище нуля, Coral нижче)
  const polar = !colors && color === MODEL && values.some(v => v < 0);
  const colOf = i => (highlight === i ? WHITE : colors ? colors[i] : polar ? (values[i] >= 0 ? UP : DOWN) : color);
  const pal = [...new Set(values.map((_, i) => colOf(i)))];
  const fill = i => `url(#${u}-${values[i] < 0 ? 'q' : 'p'}${pal.indexOf(colOf(i))})`;
  const fm = fmt || (v => String(v));
  return (
    <div ref={ref} className={'ex-bars' + (hov != null ? ' hovering' : '')} onMouseLeave={() => setHov(null)}>
      <svg width={W} height={height} role="img" aria-label={label}>
        <defs>
          <Glow id={`${u}-g`} W={W} H={height} s1={1.4} s2={4} k={0.9} />
          {pal.map((c, k) => (
            <Fragment key={k}>
              <linearGradient id={`${u}-p${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity=".4" /></linearGradient>
              <linearGradient id={`${u}-q${k}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity=".4" /></linearGradient>
            </Fragment>
          ))}
        </defs>
        {ticks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? null : GRID} className={v === 0 ? 'ex-zero' : null} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt ? fmt(v) : v}</text></g>)}
        {hov != null && Number.isFinite(values[hov]) && (
          <g className="ex-projg" filter={`url(#${u}-g)`} pointerEvents="none" style={{ '--pc': colOf(hov) }}>
            <line x1={M.l} x2={X(hov) + bw / 2} y1={Y(values[hov])} y2={Y(values[hov])} className="ex-proj" />
            <rect x="-3.2" y="-3.2" width="6.4" height="6.4" transform={`translate(${M.l},${Y(values[hov]).toFixed(1)}) rotate(45)`} className="ex-pdia" />
          </g>
        )}
        {values.map((v, i) => Number.isFinite(v) && (
          <g key={i} className={'ex-bar' + (hov === i ? ' on' : '')} onMouseEnter={() => setHov(i)}>
            <rect x={X(i) - gap / 2} y={M.t} width={Math.max(1, bw + gap)} height={height - M.t - M.b} className="ex-bar-hit" />
            <rect x={X(i)} y={Math.min(Y(0), Y(v))} width={Math.max(1, bw)} height={Math.max(0.5, Math.abs(Y(v) - Y(0)))} rx={bw > 6 ? 2 : 0} fill={fill(i)}
              opacity={highlight == null || highlight === i ? 1 : 0.75} filter={hov === i || highlight === i ? `url(#${u}-g)` : null} className="ex-bar-r" />
            {se?.[i] > 0 && <line x1={X(i) + bw / 2} x2={X(i) + bw / 2} y1={Y(v - 1.96 * se[i])} y2={Y(v + 1.96 * se[i])} className="ex-whisk" />}
            {labels && i % every === 0 && <text x={X(i) + bw / 2} y={height - 4} textAnchor="middle" className="fc-xtick">{labels[i]}</text>}
          </g>
        ))}
      </svg>
      {hov != null && Number.isFinite(values[hov]) && (
        <Tip x={X(hov) + bw / 2} W={W} head={xlab ? xlab(hov) : labels?.[hov] || null} fmt={fm}
          rows={[{ v: values[hov], color: colOf(hov), text: se?.[hov] > 0 ? `${fm(values[hov])} ± ${fm(1.96 * se[hov])}` : null }]} />
      )}
    </div>
  );
}

// Підпис позиції сезону: місяць, день тижня чи номер тижня
export function seasonLabels(dates, m, freq, fmt, offset = 0) {
  return Array.from({ length: m }, (_, p) => {
    const d = dates[(p + offset) % dates.length] || dates[p];
    if (freq === 'M') return fmt.monShort(d);
    if (freq === 'D' && m === 7) return fmt.dowShort(d);
    return String(p + 1);
  });
}

// Горизонтальні стовпчики від нуля: ефекти подій, важливість ознак. Колір смуги в --c, сяйво і градієнт у CSS
export function HBars({ rows, fmt, label }) {
  const lo = Math.min(0, ...rows.map(r => r.value)), hi = Math.max(0, ...rows.map(r => r.value)), span = hi - lo || 1, z = (-lo / span) * 100;
  return (
    <ul className="ex-hbars" aria-label={label}>
      {rows.map(r => {
        const w = (Math.abs(r.value) / span) * 100, left = r.value >= 0 ? z : z - w;
        return (
          <li key={r.id}>
            <span className="ex-hb-name">{r.name}{r.sub && <small>{r.sub}</small>}</span>
            <span className="ex-hb-track">{lo < 0 && <i className="ex-hb-zero" style={{ left: z + '%' }} />}<i className={'ex-hb-bar' + (r.value < 0 ? ' neg' : '')} style={{ left: left + '%', width: Math.max(0.6, w) + '%', '--c': r.color || MODEL }} /></span>
            <b>{fmt(r.value)}</b>
          </li>
        );
      })}
    </ul>
  );
}

// Горизонтальний водоспад: від стартового значення через внески до підсумку. zero: вісь від нуля
export function Waterfall({ steps, fmt, label, zero = false }) {
  let acc = 0;
  const bars = steps.map(s => {
    if (s.kind === 'delta') { const a = acc; acc += s.value; return { ...s, a, b: acc }; }
    acc = s.value; return { ...s, a: null, b: s.value };
  });
  const vals = bars.flatMap(b => (b.a == null ? [b.b] : [b.a, b.b]));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1;
  lo = zero ? Math.min(0, lo) : lo - pad; hi += pad;
  const P = v => ((v - lo) / (hi - lo || 1)) * 100;
  return (
    <ul className="ex-wf" aria-label={label}>
      {bars.map((b, k) => {
        // без нуля на осі старт і підсумок показуються міткою на своєму значенні, а не смугою від краю
        const pin = b.a == null && !zero;
        const x1 = pin ? P(b.b) - 0.7 : b.a == null ? P(lo) : P(Math.min(b.a, b.b)), x2 = pin ? P(b.b) + 0.7 : P(b.a == null ? b.b : Math.max(b.a, b.b));
        const color = b.kind === 'delta' ? (b.value >= 0 ? UP : DOWN) : b.kind === 'end' ? FC : NEUTRAL;
        return (
          <li key={k} className={b.kind}>
            <span className="ex-wf-name">{b.name}{b.sub && <small>{b.sub}</small>}</span>
            <span className="ex-wf-track">
              {b.a != null && <i className="ex-wf-link" style={{ left: P(b.a) + '%' }} />}
              <i className={'ex-wf-bar' + (pin ? ' pin' : '') + (b.kind === 'delta' && b.value < 0 ? ' neg' : '')} style={{ left: x1 + '%', width: Math.max(0.6, x2 - x1) + '%', '--c': color }} />
            </span>
            <b>{b.kind === 'delta' ? (b.value > 0 ? '+' : b.value < 0 ? '−' : '') + fmt(Math.abs(b.value)) : fmt(b.value)}</b>
          </li>
        );
      })}
    </ul>
  );
}

// «Льодяники»: окремі замовлення як стебла з точкою, нулі лишаються порожніми; rate: лінія середнього попиту.
// names: { v, rate } для рядків підказки
export function Lollipop({ values, height = 130, fmt, label, rate, ticks, xlab = null, names = {} }) {
  const ref = useRef(null), W = useWidth(ref, 400), u = useUid('lp');
  const [hov, setHov] = useState(null);
  const yt = niceTicks(0, Math.max(...values, rate || 0, 1), 3), y1 = yt[yt.length - 1];
  const M = { l: 34, r: 8, t: 8, b: ticks ? 18 : 6 }, n = values.length, bottom = height - M.b;
  const X = i => M.l + ((i + 0.5) / n) * (W - M.l - M.r), Y = v => M.t + (1 - v / (y1 || 1)) * (height - M.t - M.b);
  const cw = (W - M.l - M.r) / n;
  const onMove = e => {
    const r = ref.current.getBoundingClientRect(), i = Math.floor(((e.clientX - r.left - M.l) / Math.max(1, W - M.l - M.r)) * n);
    setHov(i >= 0 && i < n ? i : null);
  };
  return (
    <div ref={ref} className="ex-bars ex-lolli" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
      <svg width={W} height={height} role="img" aria-label={label}>
        <defs>
          <Defs u={u} W={W} H={height} t={M.t} b={bottom} />
          <linearGradient id={`${u}-s`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={Y(0)} y2={M.t}><stop offset="0" stopColor={ACT} stopOpacity=".28" /><stop offset="1" stopColor="#BFD7FE" stopOpacity=".95" /></linearGradient>
          <linearGradient id={`${u}-r`} gradientUnits="userSpaceOnUse" x1={M.l} x2={W - M.r} y1="0" y2="0">{neonStops}</linearGradient>
        </defs>
        {yt.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? null : GRID} className={v === 0 ? 'ex-zero' : null} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt(v)}</text></g>)}
        {hov != null && <rect x={X(hov) - Math.max(3, cw / 2)} y={M.t} width={Math.max(6, cw)} height={bottom - M.t} rx="3" className="ex-col-hi" />}
        {values.map((v, i) => v > 0 && (
          <g key={i}>
            <line x1={X(i)} x2={X(i)} y1={Y(0)} y2={Y(v)} stroke={hov === i ? '#E2E8F0' : `url(#${u}-s)`} strokeWidth={hov === i ? 2 : 1.5} />
            <circle cx={X(i)} cy={Y(v)} r={hov === i ? 4.4 : 3} fill={hov === i ? '#FFFFFF' : '#C7DCFE'} stroke="#0E131B" strokeWidth="1" filter={hov === i ? `url(#${u}-g)` : null} />
          </g>
        ))}
        {Number.isFinite(rate) && <line x1={M.l} x2={W - M.r} y1={Y(rate)} y2={Y(rate)} stroke={`url(#${u}-r)`} strokeWidth="2" strokeDasharray="5 4" filter={`url(#${u}-g)`} />}
        {ticks && ticks.map(t => <text key={t.i} x={X(t.i)} y={height - 4} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
      </svg>
      {hov != null && (
        <Tip x={X(hov)} W={W} head={xlab ? xlab(hov) : null} fmt={fmt}
          rows={[{ v: values[hov], color: ACT, name: names.v }, ...(Number.isFinite(rate) ? [{ v: rate, cls: 'fc', name: names.rate }] : [])]} />
      )}
    </div>
  );
}

// Складені стовпчики внесків по кроках: додатні вгору від нуля, від’ємні вниз; клік обирає крок.
// Наведений і обраний стовпчики світяться, решта притухає
export function StackBars({ groups, height = 170, fmt, sel, onSel, label, ticks, xlab = null }) {
  const ref = useRef(null), W = useWidth(ref, 500), n = groups[0].values.length, u = useUid('sb');
  const [hov, setHov] = useState(null);
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) { let p = 0, q = 0; groups.forEach(g => { const v = g.values[i]; if (v > 0) p += v; else q += v; }); hi = Math.max(hi, p); lo = Math.min(lo, q); }
  const yt = niceTicks(lo, hi, 4), y0 = yt[0], y1 = yt[yt.length - 1];
  const M = { l: 44, r: 6, t: 6, b: ticks ? 18 : 6 }, gap = n > 40 ? 1 : 2, bw = (W - M.l - M.r) / n - gap;
  const X = i => M.l + i * (bw + gap), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  return (
    <div ref={ref} className={'ex-bars ex-stack' + (hov != null ? ' hovering' : '')} onMouseLeave={() => setHov(null)}>
      <svg width={W} height={height} role="img" aria-label={label}>
        <defs><Glow id={`${u}-g`} W={W} H={height} s1={1.3} s2={3.8} k={0.85} /></defs>
        {yt.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? null : GRID} className={v === 0 ? 'ex-zero' : null} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt(v)}</text></g>)}
        {Array.from({ length: n }, (_, i) => {
          let p = 0, q = 0;
          return (
            <g key={i} className={'ex-stack-col' + (sel === i ? ' on' : '') + (hov === i ? ' hov' : '')} onClick={onSel ? () => onSel(i) : undefined} onMouseEnter={() => setHov(i)}>
              <rect x={X(i) - gap / 2} y={M.t} width={bw + gap} height={height - M.t - M.b} className="ex-stack-hit" />
              <g className="ex-stack-seg" filter={hov === i || sel === i ? `url(#${u}-g)` : null}>
                {groups.map(g => {
                  const v = g.values[i]; if (!v) return null;
                  const a = v > 0 ? p : q, b = a + v;
                  if (v > 0) p = b; else q = b;
                  return <rect key={g.id} x={X(i)} y={Math.min(Y(a), Y(b))} width={Math.max(1, bw)} height={Math.max(0.5, Math.abs(Y(b) - Y(a)) - 1)} fill={g.color} />;
                })}
              </g>
            </g>
          );
        })}
        {ticks && ticks.map(t => <text key={t.i} x={X(t.i) + bw / 2} y={height - 4} textAnchor="middle" className="fc-xtick">{t.label}</text>)}
      </svg>
      {hov != null && (
        <Tip x={X(hov) + bw / 2} W={W} head={xlab ? xlab(hov) : null} fmt={fmt}
          rows={groups.filter(g => Math.abs(g.values[hov]) > 1e-9).map(g => ({ name: g.name, color: g.color, text: (g.values[hov] > 0 ? '+' : '−') + fmt(Math.abs(g.values[hov])) }))} />
      )}
    </div>
  );
}
