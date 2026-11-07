// Динаміка: лінії, площа, картка показника, календар, діаграма Ганта.
import { useMemo, useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, Frame, Legend, fit, textW, monthTicks, Marker, barPath } from './kit.jsx';
import { SERIES, OTHER, EMPH, DIM, INK, SURFACE, GRID, BASE, SEQ, STATUS, seriesColor } from '../palette.js';
import { ymd, dayOf, weekday } from '../format.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });
const path = (pts) => { let d = '', pen = false; pts.forEach(p => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); pen = true; }); return d; };

function TimeAxis({ d0, d1, x, y, f, px }) {
  const ticks = monthTicks(d0, d1, px, ymd, dayOf);
  return ticks.map((t, k) => (
    <g key={t.day}>
      <VLine x={x(t.day)} y1={y} y2={y + 4} color={BASE} />
      <Txt x={x(t.day)} y={y + 17} anchor="middle">{f.monthIdx(t.m - 1)}{t.m === 1 || k === 0 ? ' ' + t.y : ''}</Txt>
    </g>
  ));
}
// Шукаємо найближчу дату до вказівника (перехрестя знаходить X)
const nearest = (days, x, px) => { let best = 0, bd = Infinity; days.forEach((d, k) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; best = k; } }); return best; };

export function Line({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(null);
  const S = m.names.length, H = mini ? 118 : 330;
  const all = m.val.flat().filter(v => v != null);
  const lo = Math.min(...all), hi = Math.max(...all);
  const sc = niceScale(lo >= 0 && lo < hi * 0.5 ? 0 : lo, hi, 5, lo >= 0 && lo < hi * 0.5);
  const d0 = m.days[0], d1 = m.days[m.days.length - 1];
  // підписи на кінцях ліній, якщо серій до чотирьох і вони не злипаються
  let ends = null;
  const Tp = mini ? 8 : 18, B = mini ? 4 : 34, L = mini ? 4 : 52;
  const y = scale(sc.lo, sc.hi, H - B, Tp);
  if (!mini && m.hasSeries && S <= 4) {
    const last = m.names.map((nm, a) => { let k = m.days.length - 1; while (k > 0 && m.val[a][k] == null) k--; return { a, nm, yy: y(m.val[a][k] ?? 0) }; }).sort((p, q) => p.yy - q.yy);
    if (last.every((p, k) => !k || p.yy - last[k - 1].yy >= 14)) ends = last;
  }
  const R = mini ? 4 : ends ? Math.min(150, Math.max(...m.names.map(nm => textW(nm, 11.5))) + 16) : 14;
  const x = scale(d0, d1, L, W - R);
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), k = nearest(m.days, x, e.clientX - r.left);
    setHk(k);
    setTip(tipAt(x(m.days[k]), Tp, f.date(m.days[k]), m.names.map((nm, a) => ({ value: m.val[a][k] == null ? T.ui.noData : f.num(m.val[a][k]), label: m.hasSeries ? nm : m.valueName, color: seriesColor(a) }))));
  };
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(null); }}
      legend={m.hasSeries && <Legend kind="line" items={m.names.map((nm, a) => ({ label: nm, color: seriesColor(a) }))} />}>
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, sc.hi)}</Txt></g>)}
      {!mini && <TimeAxis d0={d0} d1={d1} x={x} y={H - B} f={f} px={W - L - R} />}
      {m.names.map((nm, a) => <path key={a} d={path(m.days.map((d, k) => (m.val[a][k] == null ? null : [x(d), y(m.val[a][k])])))} fill="none" stroke={seriesColor(a)} strokeWidth={mini ? 1.6 : 2} strokeLinejoin="round" strokeLinecap="round" />)}
      {ends && ends.map(p => <Txt key={p.a} x={W - R + 8} y={p.yy + 4} color={INK.secondary} size={11.5}>{fit(p.nm, R - 10, 11.5)}</Txt>)}
      {hk != null && <g><VLine x={x(m.days[hk])} y1={Tp} y2={H - B} color="rgba(255,255,255,.4)" />{m.names.map((nm, a) => m.val[a][hk] != null && <Marker key={a} x={x(m.days[hk])} y={y(m.val[a][hk])} r={4} fill={seriesColor(a)} />)}</g>}
      {!mini && <rect x={L} y={Tp} width={Math.max(0, W - L - R)} height={H - B - Tp} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}

export function Area({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hk, setHk] = useState(null);
  const H = mini ? 118 : 330, Tp = mini ? 8 : 18, B = mini ? 4 : 34, L = mini ? 4 : 52, R = mini ? 4 : 14;
  const sc = niceScale(0, Math.max(...m.vals), 5);
  const d0 = m.days[0], d1 = m.days[m.days.length - 1];
  const x = scale(d0, d1, L, W - R), y = scale(sc.lo, sc.hi, H - B, Tp);
  const line = path(m.days.map((d, k) => [x(d), y(m.vals[k])]));
  const area = line + `L${x(d1)},${y(0)}L${x(d0)},${y(0)}Z`;
  const ma = m.ma && path(m.days.map((d, k) => (m.ma[k] == null ? null : [x(d), y(m.ma[k])])));
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), k = nearest(m.days, x, e.clientX - r.left);
    setHk(k);
    setTip(tipAt(x(m.days[k]), Tp, f.date(m.days[k]), [{ value: f.num(m.vals[k]), label: m.valueName, color: SERIES[0] }, ...(m.ma && m.ma[k] != null ? [{ value: f.num(m.ma[k]), label: T.ui.ma3, color: SEQ[6] }] : [])]));
  };
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHk(null); }}
      legend={m.ma && <Legend kind="line" items={[{ label: m.valueName, color: SERIES[0] }, { label: T.ui.ma3, color: SEQ[6] }]} />}>
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, sc.hi)}</Txt></g>)}
      {!mini && <TimeAxis d0={d0} d1={d1} x={x} y={H - B} f={f} px={W - L - R} />}
      <path d={area} fill={SERIES[0]} fillOpacity=".14" />
      <path d={line} fill="none" stroke={SERIES[0]} strokeWidth={mini ? 1.6 : 2} strokeLinejoin="round" />
      {ma && <path d={ma} fill="none" stroke={SEQ[6]} strokeWidth="2" strokeLinejoin="round" />}
      {hk != null && <g><VLine x={x(m.days[hk])} y1={Tp} y2={H - B} color="rgba(255,255,255,.4)" /><Marker x={x(m.days[hk])} y={y(m.vals[hk])} r={4} fill={SERIES[0]} /></g>}
      {!mini && <rect x={L} y={Tp} width={Math.max(0, W - L - R)} height={H - B - Tp} fill="transparent" onPointerMove={move} />}
    </Frame>
  );
}

// Картка показника: велике число, зміна зі знаком і стрілкою, контекст, спарклайн
export function Kpi({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const n = m.vals.length, cur = m.vals[n - 1], prev = m.vals[n - 2];
  const delta = prev ? (cur - prev) / Math.abs(prev) : 0;
  const better = opts.better || m.better || 'less';
  const good = delta === 0 ? null : (delta < 0) === (better === 'less');
  const gaps = m.days.slice(1).map((d, k) => d - m.days[k]).sort((a, b) => a - b), gap = gaps[gaps.length >> 1] || 7;
  const per = gap <= 1 ? 'day' : gap <= 8 ? 'week' : gap <= 31 ? 'month' : gap <= 92 ? 'quarter' : 'year';
  const avg = m.vals.reduce((s, v) => s + v, 0) / n, mn = Math.min(...m.vals), mx = Math.max(...m.vals);
  const H = mini ? 118 : 250;
  const sw = mini ? W * 0.5 : Math.min(360, W * 0.46), sh = mini ? 54 : 110, sx0 = W - sw - (mini ? 4 : 8), sy0 = mini ? 54 : 70;
  const sc = niceScale(mn, mx, 3, false), x = scale(0, n - 1, sx0, sx0 + sw), y = scale(sc.lo, sc.hi, sy0 + sh, sy0);
  const col = good == null ? INK.muted : good ? STATUS.good : STATUS.bad;
  const arrow = delta > 0 ? 'M0,6 L6,0 L12,6' : 'M0,0 L6,6 L12,0';
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && <Txt x={8} y={30} size={13} color={INK.muted}>{fit(m.valueName, W - sw - 30, 13)}</Txt>}
      <Txt x={mini ? 4 : 8} y={mini ? 46 : 100} size={mini ? 34 : 56} color={INK.primary} weight={600}>{f.num(cur)}</Txt>
      {!mini && <g transform="translate(8,136)">
        {delta !== 0 && <path d={arrow} transform="translate(0,-10)" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        <Txt x={delta !== 0 ? 18 : 0} y={0} size={14} color={col} weight={600}>{f.signedPct(delta)}</Txt>
        <Txt x={(delta !== 0 ? 18 : 0) + textW(f.signedPct(delta), 14) + 8} y={0} size={13} color={INK.muted}>{T.ui.vsPrev[per]}{good != null ? ' · ' + (good ? T.ui.better : T.ui.worse) : ''}</Txt>
      </g>}
      {!mini && <Txt x={8} y={170} size={12.5} color={INK.muted}>{T.ui.avgOver(n, per)}: {f.num(avg)}</Txt>}
      {!mini && <Txt x={8} y={192} size={12.5} color={INK.muted}>{T.ui.minMax}: {f.num(mn)} · {f.num(mx)}</Txt>}
      <path d={path(m.vals.map((v, k) => [x(k), y(v)]))} fill="none" stroke={DIM} strokeWidth="2" strokeLinejoin="round" />
      <path d={path(m.vals.slice(-2).map((v, k) => [x(n - 2 + k), y(v)]))} fill="none" stroke={SERIES[0]} strokeWidth="2" />
      <Marker x={x(n - 1)} y={y(cur)} r={mini ? 3.5 : 4.5} fill={SERIES[0]} />
      {!mini && <Txt x={sx0} y={sy0 + sh + 22} size={11}>{f.date(m.days[0])}</Txt>}
      {!mini && <Txt x={sx0 + sw} y={sy0 + sh + 22} size={11} anchor="end">{f.date(m.days[n - 1])}</Txt>}
      {!mini && m.vals.map((v, k) => <rect key={k} x={x(k) - sw / n / 2} y={sy0 - 10} width={sw / n} height={sh + 20} fill="transparent" onPointerMove={() => setTip(tipAt(x(k), sy0 - 8, f.date(m.days[k]), [{ value: f.num(v), label: m.valueName, color: k === n - 1 ? SERIES[0] : DIM }]))} />)}
    </Frame>
  );
}

const CAL = [SEQ[0], SEQ[2], SEQ[3], SEQ[4], SEQ[6]];
export function Calendar({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const from = mini ? Math.max(m.first, m.last - 7 * 22) : m.first;
  const start = from - weekday(from), weeks = Math.ceil((m.last - start + 1) / 7);
  const L = mini ? 2 : 30, Tp = mini ? 4 : 22, R = 2;
  const pitch = Math.max(4, Math.min(mini ? 15 : 17, Math.floor((W - L - R) / weeks))), cell = pitch - (mini ? 1.5 : 2);
  const H = Tp + 7 * pitch + (mini ? 2 : 40);
  const vals = [...m.map.values()].sort((a, b) => a - b), q = p => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const br = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const cls = v => br.filter(b => v > b).length;
  const cells = [];
  for (let d = Math.max(start, from); d <= m.last; d++) {
    const w = Math.floor((d - start) / 7), wd = weekday(d), v = m.map.get(d);
    cells.push({ d, x: L + w * pitch, y: Tp + wd * pitch, v });
  }
  const months = [];
  if (!mini) { let prev = -1; cells.forEach(c => { const [yy, mm, dd] = ymd(c.d); if (dd === 1 || (prev === -1)) { if (mm !== prev) months.push({ x: c.x, m: mm, y: yy }); prev = mm; } }); }
  const wdNames = T.ui.weekdays;
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {!mini && [0, 2, 4].map(k => <Txt key={k} x={L - 6} y={Tp + k * pitch + cell - 2} anchor="end" size={10}>{wdNames[k]}</Txt>)}
      {months.map((mm, k) => (k === 0 || mm.x - months[k - 1].x > 26) && <Txt key={k} x={mm.x} y={Tp - 8} size={10.5}>{f.monthIdx(mm.m - 1)}</Txt>)}
      {cells.map(c => <rect key={c.d} x={c.x} y={c.y} width={cell} height={cell} rx={mini ? 1 : 2} fill={c.v == null ? GRID : CAL[cls(c.v)]}
        onPointerMove={mini ? undefined : () => setTip(tipAt(c.x + cell / 2, c.y - 6, f.date(c.d) + ', ' + T.ui.weekdaysFull[weekday(c.d)], [{ value: c.v == null ? T.ui.noData : f.num(c.v), label: m.valueName, color: c.v == null ? null : CAL[cls(c.v)] }]))} />)}
      {!mini && <g transform={`translate(${L},${Tp + 7 * pitch + 18})`}>
        <Txt x={0} y={9} size={11}>{T.ui.less}</Txt>
        {CAL.map((c, k) => <rect key={k} x={textW(T.ui.less) + 8 + k * 18} y={0} width={14} height={12} rx="2" fill={c} />)}
        <Txt x={textW(T.ui.less) + 8 + CAL.length * 18 + 4} y={9} size={11}>{T.ui.more}</Txt>
        <rect x={textW(T.ui.less) + textW(T.ui.more) + CAL.length * 18 + 34} y={0} width={14} height={12} rx="2" fill={GRID} />
        <Txt x={textW(T.ui.less) + textW(T.ui.more) + CAL.length * 18 + 54} y={9} size={11}>{T.ui.noData}</Txt>
      </g>}
    </Frame>
  );
}

export function Gantt({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const rows = mini ? m.rows.slice(0, 8) : m.rows, n = rows.length;
  const row = mini ? 12 : 30, bh = mini ? 7 : 16;
  const labW = mini ? 0 : Math.min(W * 0.36, Math.max(...rows.map(r => textW(r.label, 12))) + 14);
  const Tp = mini ? 4 : 30, B = mini ? 4 : 10, H = Tp + n * row + B, R = mini ? 4 : 12;
  const d0 = Math.min(...rows.map(r => r.s)), d1 = Math.max(...rows.map(r => r.e)) + 1;
  const x = scale(d0, d1, labW + 4, W - R);
  const today = Math.floor(Date.now() / 864e5);
  const gc = g => (g === T.ui.other ? OTHER : seriesColor(m.groups.indexOf(g))), color = r => (m.groups.length ? gc(r.g) : SERIES[0]);
  const ticks = monthTicks(d0, d1, W - labW - R, ymd, dayOf);
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.timeline} tip={tip} mini={mini} onLeave={() => setTip(null)}
      legend={m.groups.length > 1 && <Legend items={m.groups.map(g => ({ label: g, color: gc(g) }))} />}>
      {!mini && ticks.map((t, k) => <g key={t.day}><VLine x={x(t.day)} y1={Tp - 6} y2={H - B} color={GRID} /><Txt x={x(t.day) + 4} y={Tp - 12} size={10.5}>{f.monthIdx(t.m - 1)}{t.m === 1 || k === 0 ? ' ' + t.y : ''}</Txt></g>)}
      {rows.map((r, k) => {
        const yy = Tp + k * row + (row - bh) / 2, x0 = x(r.s), x1 = Math.max(x(r.e + 1), x0 + 3);
        const show = () => setTip(tipAt((x0 + x1) / 2, yy - 4, r.label, [{ value: T.ui.fromTo(f.date(r.s), f.date(r.e)), label: '', color: color(r) }, { value: String(r.e - r.s + 1), label: T.ui.days }, ...(r.g ? [{ value: r.g, label: '' }] : [])]));
        return (
          <g key={k}>
            {!mini && <Txt x={labW - 6} y={yy + bh / 2 + 4} anchor="end" color={INK.secondary} size={12}>{fit(r.label, labW - 10, 12)}</Txt>}
            <rect x={x0} y={yy} width={x1 - x0} height={bh} rx={mini ? 2 : 4} fill={color(r)} />
            {!mini && <rect x={0} y={Tp + k * row} width={W} height={row} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
      {!mini && today >= d0 && today <= d1 && <g><VLine x={x(today)} y1={Tp - 4} y2={H - B} color={EMPH} w={1.5} /><Txt x={x(today) + 4} y={H - B - 4} size={10.5} color={INK.secondary}>{T.ui.today}</Txt></g>}
    </Frame>
  );
}
