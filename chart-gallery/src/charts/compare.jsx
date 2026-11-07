// Порівняння: стовпчики, смуги, згруповані й складені стовпчики, гантелі, маркерна діаграма, шкала виконання.
import { useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, colPath, barPath, Frame, Legend, fit, textW, Marker } from './kit.jsx';
import { SERIES, OTHER, EMPH, DIM, INK, SURFACE, GRID, BASE, SEQ, TRACK, STATUS, seriesColor } from '../palette.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });

export function Column({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [pick, setPick] = useState(null);
  const n = m.items.length, H = mini ? 118 : 330;
  const L = mini ? 4 : 56, R = mini ? 4 : 12, Tp = mini ? 8 : 24, B = mini ? 4 : 42;
  const vals = m.items.map(i => i.value);
  const sc = niceScale(Math.min(0, ...vals), Math.max(0, ...vals), 5);
  const y = scale(sc.lo, sc.hi, H - B, Tp), y0 = y(0);
  const band = (W - L - R) / n, bw = Math.min(mini ? 14 : 24, band * 0.62), x = k => L + band * k + (band - bw) / 2;
  const color = k => (m.items[k].other ? OTHER : pick == null ? SERIES[0] : pick === k ? EMPH : DIM);
  const showVals = !mini && band >= Math.max(...vals.map(v => textW(f.num(v), 11))) + 4;
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, sc.hi)}</Txt></g>)}
      {mini && <HLine x1={L} x2={W - R} y={y0} color={BASE} />}
      {m.items.map((it, k) => (
        <g key={k}>
          <path d={colPath(x(k), bw, y0, y(it.value))} fill={color(k)} />
          {showVals && <Txt x={x(k) + bw / 2} y={it.value >= 0 ? y(it.value) - 6 : y(it.value) + 14} anchor="middle" color={INK.secondary} size={11}>{f.num(it.value)}</Txt>}
          {!mini && <Txt x={L + band * k + band / 2} y={H - B + 18} anchor="middle">{fit(it.label, band - 4)}</Txt>}
          {!mini && <rect x={L + band * k} y={Tp} width={band} height={H - B - Tp} fill="transparent" tabIndex="0"
            onPointerMove={() => setTip(tipAt(L + band * k + band / 2, Math.min(y(it.value), y0) - 8, it.label, [{ value: f.num(it.value), label: m.valueName, color: color(k) }], pick == null ? T.ui.clickEmph : null))}
            onFocus={() => setTip(tipAt(L + band * k + band / 2, Math.min(y(it.value), y0) - 8, it.label, [{ value: f.num(it.value), label: m.valueName, color: color(k) }]))} onBlur={() => setTip(null)}
            onClick={() => setPick(pick === k ? null : k)} style={{ cursor: 'pointer' }} />}
        </g>
      ))}
    </Frame>
  );
}

export function Bar({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const items = mini ? m.items.slice(0, 7) : m.items, n = items.length;
  const row = mini ? 15 : 32, bh = mini ? 8 : 16;
  const labW = mini ? 0 : Math.min(W * 0.4, Math.max(...items.map(i => textW(i.label, 12))) + 14);
  const valW = mini ? 4 : Math.max(...items.map(i => textW(f.num(i.value), 11))) + 14;
  const Tp = mini ? 6 : 8, B = mini ? 4 : 26, H = Tp + n * row + B;
  const max = Math.max(...items.map(i => i.value), 0), min = Math.min(0, ...items.map(i => i.value));
  const sc = niceScale(min, max, 4);
  const x = scale(sc.lo, sc.hi, labW, W - valW), x0 = x(0);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && sc.ticks.map(v => <g key={v}><VLine x={x(v)} y1={Tp} y2={H - B + 4} color={v === 0 ? BASE : GRID} /><Txt x={x(v)} y={H - 6} anchor="middle">{f.axis(v, sc.hi)}</Txt></g>)}
      {items.map((it, k) => {
        const yy = Tp + k * row + (row - bh) / 2, c = it.other ? OTHER : SERIES[0];
        return (
          <g key={k}>
            {!mini && <Txt x={labW - 10} y={yy + bh / 2 + 4} anchor="end" color={INK.secondary} size={12}>{fit(it.label, labW - 14, 12)}</Txt>}
            <path d={barPath(yy, bh, x0, x(it.value))} fill={c} />
            {!mini && <Txt x={it.value >= 0 ? x(it.value) + 6 : x(it.value) - 6} y={yy + bh / 2 + 4} anchor={it.value >= 0 ? 'start' : 'end'} color={INK.secondary}>{f.num(it.value)}</Txt>}
            {!mini && <rect x={0} y={Tp + k * row} width={W} height={row} fill="transparent" tabIndex="0"
              onPointerMove={() => setTip(tipAt(Math.min(W - 60, x(Math.max(0, it.value)) + 20), yy - 4, it.label, [{ value: f.num(it.value), label: m.valueName, color: c }]))}
              onFocus={() => setTip(tipAt(x(Math.max(0, it.value)), yy - 4, it.label, [{ value: f.num(it.value), label: m.valueName, color: c }]))} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}

const sColor = (m, k) => (m.otherS && k === m.series.length - 1 ? OTHER : seriesColor(k));

export function Grouped({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hi, setHi] = useState(null);
  const C = m.cats.length, S = m.series.length, H = mini ? 118 : 330;
  const L = mini ? 4 : 56, R = mini ? 4 : 12, Tp = mini ? 8 : 18, B = mini ? 4 : 42;
  const all = m.v.flat();
  const sc = niceScale(Math.min(0, ...all), Math.max(0, ...all), 5);
  const y = scale(sc.lo, sc.hi, H - B, Tp), y0 = y(0);
  const band = (W - L - R) / C, bw = Math.max(2, Math.min(mini ? 9 : 18, (band * 0.78 - 2 * (S - 1)) / S)), gw = S * bw + 2 * (S - 1);
  const show = (a) => tipAt(L + band * a + band / 2, Math.min(...m.v[a].map(y)) - 8, m.cats[a], m.series.map((s, b) => ({ value: f.num(m.v[a][b]), label: s, color: sColor(m, b) })));
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHi(null); }}
      legend={<Legend items={m.series.map((s, b) => ({ label: s, color: sColor(m, b) }))} />}>
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, sc.hi)}</Txt></g>)}
      {mini && <HLine x1={L} x2={W - R} y={y0} color={BASE} />}
      {m.cats.map((c, a) => {
        const gx = L + band * a + (band - gw) / 2;
        return (
          <g key={a} opacity={hi == null || hi === a ? 1 : 0.45}>
            {m.series.map((s, b) => <path key={b} d={colPath(gx + b * (bw + 2), bw, y0, y(m.v[a][b]))} fill={sColor(m, b)} />)}
            {!mini && <Txt x={L + band * a + band / 2} y={H - B + 18} anchor="middle">{fit(c, band - 4)}</Txt>}
            {!mini && <rect x={L + band * a} y={Tp} width={band} height={H - B - Tp} fill="transparent" tabIndex="0" onPointerMove={() => { setHi(a); setTip(show(a)); }} onFocus={() => { setHi(a); setTip(show(a)); }} onBlur={() => { setTip(null); setHi(null); }} />}
          </g>
        );
      })}
    </Frame>
  );
}

export function Stacked({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hi, setHi] = useState(null);
  const pct = opts.mode === 'pct';
  const C = m.cats.length, S = m.series.length, H = mini ? 118 : 330;
  const L = mini ? 4 : 56, R = mini ? 4 : 12, Tp = mini ? 8 : 18, B = mini ? 4 : 42;
  const tot = m.v.map(r => r.reduce((s, v) => s + Math.max(0, v), 0));
  const sc = pct ? { lo: 0, hi: 1, ticks: [0, 0.25, 0.5, 0.75, 1] } : niceScale(0, Math.max(...tot), 5);
  const y = scale(sc.lo, sc.hi, H - B, Tp), y0 = y(0);
  const band = (W - L - R) / C, bw = Math.min(mini ? 16 : 30, band * 0.62);
  const val = (a, b) => (pct ? (tot[a] ? Math.max(0, m.v[a][b]) / tot[a] : 0) : Math.max(0, m.v[a][b]));
  const show = a => tipAt(L + band * a + band / 2, y(pct ? 1 : tot[a]) - 8, m.cats[a] + (pct ? '' : ' · ' + f.num(tot[a])), m.series.map((s, b) => ({ value: pct ? f.pct(val(a, b), 1) : f.num(m.v[a][b]), label: s + (pct ? '' : ' · ' + f.pct(tot[a] ? m.v[a][b] / tot[a] : 0)), color: sColor(m, b) })).reverse());
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHi(null); }}
      legend={<Legend items={m.series.map((s, b) => ({ label: s, color: sColor(m, b) }))} />}>
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{pct ? f.pct(v) : f.axis(v, sc.hi)}</Txt></g>)}
      {m.cats.map((c, a) => {
        const x = L + band * a + (band - bw) / 2;
        let cum = 0;
        const top = m.series.map((_, b) => val(a, b)).reduce((last, v, b) => (v > 0 ? b : last), -1);
        const segs = m.series.map((s, b) => {
          const v = val(a, b); if (v <= 0) return null;
          const ya = y(cum), yb = y(cum + v); cum += v;
          return b === top ? <path key={b} d={colPath(x, bw, ya, yb)} fill={sColor(m, b)} /> : <rect key={b} x={x} y={yb} width={bw} height={Math.max(0, ya - yb)} fill={sColor(m, b)} />;
        });
        // 2px розриви кольором тла між сегментами
        let c2 = 0;
        const gaps = m.series.map((_, b) => { const v = val(a, b); if (v <= 0) return null; c2 += v; return b === top ? null : <line key={'g' + b} x1={x - 0.5} x2={x + bw + 0.5} y1={y(c2)} y2={y(c2)} stroke={SURFACE} strokeWidth="2" />; });
        return (
          <g key={a} opacity={hi == null || hi === a ? 1 : 0.5}>
            {segs}{gaps}
            {!mini && <Txt x={L + band * a + band / 2} y={H - B + 18} anchor="middle">{fit(c, band - 4)}</Txt>}
            {!mini && <rect x={L + band * a} y={Tp} width={band} height={H - B - Tp} fill="transparent" tabIndex="0" onPointerMove={() => { setHi(a); setTip(show(a)); }} onFocus={() => { setHi(a); setTip(show(a)); }} onBlur={() => { setTip(null); setHi(null); }} />}
          </g>
        );
      })}
      {!mini && <HLine x1={L} x2={W - R} y={y0} color={BASE} />}
    </Frame>
  );
}

export function Dumbbell({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const rows = mini ? m.rows.slice(0, 7) : m.rows, n = rows.length;
  const row = mini ? 15 : 34;
  const labW = mini ? 0 : Math.min(W * 0.4, Math.max(...rows.map(r => textW(r.label, 12))) + 14), chW = mini ? 4 : 58;
  const Tp = mini ? 6 : 8, B = mini ? 4 : 26, H = Tp + n * row + B;
  const sc = niceScale(0, Math.max(...rows.flatMap(r => [r.a, r.b])), 5);
  const x = scale(sc.lo, sc.hi, labW + 8, W - chW);
  const cA = SEQ[1], cB = SEQ[5];
  return (
    <Frame refEl={ref} w={W} h={H} label={m.names.join(' / ')} tip={tip} mini={mini} onLeave={() => setTip(null)}
      legend={<Legend kind="dot" items={[{ label: m.names[0], color: cA }, { label: m.names[1], color: cB }]} />}>
      {!mini && sc.ticks.map(v => <g key={v}><VLine x={x(v)} y1={Tp} y2={H - B + 4} color={v === 0 ? BASE : GRID} /><Txt x={x(v)} y={H - 6} anchor="middle">{f.axis(v, sc.hi)}</Txt></g>)}
      {rows.map((r, k) => {
        const yy = Tp + k * row + row / 2, d = r.b - r.a;
        const show = () => setTip(tipAt(x(Math.max(r.a, r.b)), yy - 10, r.label, [{ value: f.num(r.a), label: m.names[0], color: cA, dot: true }, { value: f.num(r.b), label: m.names[1], color: cB, dot: true }, { value: f.signed(d) + (r.a ? ' (' + f.signedPct(d / r.a) + ')' : ''), label: T.ui.change }]));
        return (
          <g key={k}>
            {!mini && <Txt x={labW - 4} y={yy + 4} anchor="end" color={INK.secondary} size={12}>{fit(r.label, labW - 10, 12)}</Txt>}
            <line x1={x(r.a)} x2={x(r.b)} y1={yy} y2={yy} stroke={BASE} strokeWidth="2" strokeLinecap="round" />
            <Marker x={x(r.a)} y={yy} r={mini ? 3 : 5} fill={cA} />
            <Marker x={x(r.b)} y={yy} r={mini ? 3 : 5} fill={cB} />
            {!mini && <Txt x={W - 4} y={yy + 4} anchor="end" color={INK.secondary}>{f.signed(d)}</Txt>}
            {!mini && <rect x={0} y={yy - row / 2} width={W} height={row} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}

const BANDS = ['#18202B', '#1F2835', '#27323F'];
export function Bullet({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const rows = mini ? m.rows.slice(0, 5) : m.rows, n = rows.length;
  const row = mini ? 22 : 44, bh = mini ? 14 : 24;
  const labW = mini ? 0 : Math.min(W * 0.36, Math.max(...rows.map(r => textW(r.label, 12))) + 14), valW = mini ? 4 : 112;
  const Tp = mini ? 4 : 6, B = mini ? 2 : 8, H = Tp + n * row + B;
  return (
    <Frame refEl={ref} w={W} h={H} label={m.names.join(' / ')} tip={tip} mini={mini} onLeave={() => setTip(null)}
      legend={<Legend items={[{ label: m.names[0], color: SERIES[0] }, { label: m.names[1], color: INK.primary, kind: 'tick' }]} />}>
      {rows.map((r, k) => {
        const max = Math.max(r.a, r.t) * 1.12 || 1, x = scale(0, max, labW, W - valW), yy = Tp + k * row + (row - bh) / 2;
        const ratio = r.t ? r.a / r.t : 0;
        const show = () => setTip(tipAt(x(Math.max(r.a, r.t)), yy - 4, r.label, [{ value: f.num(r.a), label: m.names[0], color: SERIES[0] }, { value: f.num(r.t), label: m.names[1] }, { value: f.pct(ratio), label: T.ui.ofTarget }]));
        return (
          <g key={k}>
            {!mini && <Txt x={labW - 10} y={yy + bh / 2 + 4} anchor="end" color={INK.secondary} size={12}>{fit(r.label, labW - 14, 12)}</Txt>}
            {[[0, 0.6], [0.6, 0.9], [0.9, max / (r.t || 1)]].map(([a, b], j) => <rect key={j} x={x(a * r.t)} y={yy} width={Math.max(0, x(Math.min(max, b * r.t)) - x(a * r.t))} height={bh} fill={BANDS[j]} />)}
            <path d={barPath(yy + bh / 2 - (mini ? 3 : 5), mini ? 6 : 10, x(0), x(r.a), 3)} fill={SERIES[0]} />
            <line x1={x(r.t)} x2={x(r.t)} y1={yy - 3} y2={yy + bh + 3} stroke={INK.primary} strokeWidth="2.5" />
            {!mini && <Txt x={W - valW + 10} y={yy + bh / 2 + 4} color={INK.primary} weight={600}>{f.num(r.a)}</Txt>}
            {!mini && <Txt x={W - 4} y={yy + bh / 2 + 4} anchor="end">{f.pct(ratio)}</Txt>}
            {!mini && <rect x={0} y={Tp + k * row} width={W} height={row} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}

// Шкала виконання замість «спідометра»: доріжка того самого відтінку, заповнення несе стан, поруч слово й значок
export function Meter({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const rows = mini ? m.rows.slice(0, 3) : m.rows, n = rows.length;
  const row = mini ? 34 : 84, Tp = mini ? 6 : 6, H = Tp + n * row - (mini ? 0 : 12);
  const state = r => (r >= 0.9 ? 'ok' : r >= 0.6 ? 'warn' : 'bad');
  const col = { ok: SERIES[0], warn: STATUS.warn, bad: STATUS.bad };
  return (
    <Frame refEl={ref} w={W} h={H} label={m.names.join(' / ')} mini={mini}>
      {rows.map((r, k) => {
        const ratio = r.t ? r.a / r.t : 0, st = state(ratio), y0 = Tp + k * row, ty = y0 + (mini ? 18 : 34), th = mini ? 7 : 10;
        const x = scale(0, 1, 0, W);
        return (
          <g key={k}>
            {!mini && <Txt x={0} y={y0 + 14} color={INK.secondary} size={12.5}>{fit(r.label, W - 150, 12.5)}</Txt>}
            {!mini && <Txt x={W} y={y0 + 16} anchor="end" color={INK.primary} size={20} weight={600}>{f.pct(ratio)}</Txt>}
            {mini && <Txt x={0} y={y0 + 11} color={INK.primary} size={11} weight={600}>{f.pct(ratio)}</Txt>}
            <rect x={0} y={ty} width={W} height={th} rx={th / 2} fill={TRACK} />
            <rect x={0} y={ty} width={Math.max(th, x(Math.min(1, ratio)))} height={th} rx={th / 2} fill={col[st]} />
            {!mini && <g transform={`translate(0,${ty + th + 16})`}>
              <MeterIcon st={st} color={col[st]} />
              <Txt x={16} y={0} size={11.5} color={INK.muted}>{T.ui.meter[st]} · {f.num(r.a)} {T.ui.of} {f.num(r.t)}{ratio > 1 ? ' · ' + f.signedPct(ratio - 1) : ''}</Txt>
            </g>}
          </g>
        );
      })}
    </Frame>
  );
}
function MeterIcon({ st, color }) {
  if (st === 'ok') return <path d="M1,-4 L4,-1 L10,-8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
  if (st === 'warn') return <g><path d="M5.5,-10 L11,0 L0,0 Z" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" /><line x1="5.5" x2="5.5" y1="-6.5" y2="-3.5" stroke={color} strokeWidth="1.6" /></g>;
  return <g><circle cx="5.5" cy="-4" r="5" fill="none" stroke={color} strokeWidth="1.6" /><path d="M3.5,-6 L7.5,-2 M7.5,-6 L3.5,-2" stroke={color} strokeWidth="1.6" /></g>;
}
