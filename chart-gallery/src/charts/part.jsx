// Частка цілого: кільцева (з перемиканням на смугу й ранжовані смуги), дерево-карта, каскадна, воронка, шкала згоди.
import { useState } from 'react';
import { useWidth, useTip, niceScale, scale, Txt, HLine, VLine, colPath, barPath, Frame, Legend, fit, textW, wrap } from './kit.jsx';
import { SERIES, OTHER, EMPH, DIM, INK, SURFACE, GRID, BASE, SEQ, DIV, UP, DOWN, TOTAL, seriesColor, inkOn } from '../palette.js';

const tipAt = (x, y, title, rows, note) => ({ x, y, title, rows, note });
const pc = (it, k) => (it.other ? OTHER : seriesColor(k));

function arc(cx, cy, r0, r1, a0, a1) {
  const big = a1 - a0 > Math.PI ? 1 : 0, p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  if (a1 - a0 >= Math.PI * 2 - 1e-6) return `M${cx},${cy - r1}A${r1},${r1} 0 1 1 ${cx - 0.01},${cy - r1}ZM${cx},${cy - r0}A${r0},${r0} 0 1 0 ${cx + 0.01},${cy - r0}Z`;
  return `M${x0},${y0}A${r1},${r1} 0 ${big} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${big} 0 ${x3},${y3}Z`;
}

export function Donut({ m, f, T, mini, opts = {} }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hi, setHi] = useState(null);
  const view = mini ? 'donut' : opts.view || 'donut';
  const items = m.items, tot = m.total;
  const share = it => it.value / tot;
  const legend = <Legend items={items.map((it, k) => ({ label: it.label, color: pc(it, k) }))} />;
  if (view === 'bar') {
    const H = 120, bh = 28, y0 = 30;
    let acc = 0;
    return (
      <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} onLeave={() => setTip(null)} legend={legend}>
        <Txt x={0} y={16} size={12} color={INK.muted}>{T.ui.total}: {f.num(tot)}</Txt>
        {items.map((it, k) => {
          const x0 = (acc / tot) * W, w = (it.value / tot) * W; acc += it.value;
          const lab = f.pct(share(it));
          const show = () => setTip(tipAt(x0 + w / 2, y0 - 4, it.label, [{ value: f.num(it.value), label: m.valueName, color: pc(it, k) }, { value: f.pct(share(it), 1), label: T.ui.share }]));
          return (
            <g key={k}>
              <rect x={x0 + (k ? 1 : 0)} y={y0} width={Math.max(0, w - (k ? 1 : 0) - (k < items.length - 1 ? 1 : 0))} height={bh} rx="4" fill={pc(it, k)} />
              {w > textW(lab, 12) + 14 && <Txt x={x0 + 8} y={y0 + bh / 2 + 4} size={12} weight={600} color={inkOn(pc(it, k))}>{lab}</Txt>}
              <rect x={x0} y={y0} width={w} height={bh} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />
            </g>
          );
        })}
        <Txt x={0} y={y0 + bh + 26} size={11.5} color={INK.faint}>{T.ui.barHint}</Txt>
      </Frame>
    );
  }
  if (view === 'ranked') {
    const row = 32, bh = 16, labW = Math.min(W * 0.42, Math.max(...items.map(i => textW(i.label, 12))) + 14), H = items.length * row + 8;
    const x = scale(0, Math.max(...items.map(share)), labW, W - 64);
    return (
      <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} onLeave={() => setTip(null)}>
        {items.map((it, k) => (
          <g key={k}>
            <Txt x={labW - 10} y={k * row + row / 2 + 4} anchor="end" color={INK.secondary} size={12}>{fit(it.label, labW - 14, 12)}</Txt>
            <path d={barPath(k * row + (row - bh) / 2, bh, x(0), x(share(it)))} fill={it.other ? OTHER : SERIES[0]} />
            <Txt x={x(share(it)) + 6} y={k * row + row / 2 + 4} color={INK.secondary}>{f.pct(share(it), 1)}</Txt>
          </g>
        ))}
      </Frame>
    );
  }
  const size = mini ? 108 : Math.min(260, W * 0.62), H = mini ? 118 : size + 16, cx = mini ? W / 2 : Math.min(W / 2, size / 2 + 8), cy = H / 2, r1 = size / 2, r0 = r1 * 0.62;
  let a = 0;
  const gap = 2 / r1;
  const listX = cx + r1 + 28, showList = !mini && W - listX > 200, listW = Math.min(440, W - listX);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => { setTip(null); setHi(null); }} legend={!showList && legend}>
      {items.map((it, k) => {
        const a0 = a, a1 = a + share(it) * Math.PI * 2; a = a1;
        const show = () => { setHi(k); setTip(tipAt(cx + (r1 + 8) * Math.sin((a0 + a1) / 2), cy - (r1 + 8) * Math.cos((a0 + a1) / 2), it.label, [{ value: f.pct(share(it), 1), label: f.num(it.value), color: pc(it, k) }])); };
        return <path key={k} d={arc(cx, cy, hi === k ? r0 - 2 : r0, hi === k ? r1 + 3 : r1, a0 + (items.length > 1 ? gap / 2 : 0), a1 - (items.length > 1 ? gap / 2 : 0))} fill={pc(it, k)} tabIndex={mini ? undefined : 0} onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => { setTip(null); setHi(null); }} />;
      })}
      {!mini && <Txt x={cx} y={cy - 2} anchor="middle" size={Math.min(26, r0 * 0.42)} color={INK.primary} weight={600}>{f.compact(tot)}</Txt>}
      {!mini && <Txt x={cx} y={cy + 18} anchor="middle" size={11.5}>{T.ui.total}</Txt>}
      {showList && items.map((it, k) => (
        <g key={k} transform={`translate(${listX},${cy - (items.length * 30) / 2 + k * 30 + 18})`} opacity={hi == null || hi === k ? 1 : 0.55}>
          <rect x={0} y={-9} width={10} height={10} rx="2" fill={pc(it, k)} />
          <Txt x={18} y={0} size={12} color={INK.secondary}>{fit(it.label, listW - 70, 12)}</Txt>
          <Txt x={listW - 4} y={0} anchor="end" size={12} color={INK.primary} weight={600}>{f.pct(share(it))}</Txt>
        </g>
      ))}
    </Frame>
  );
}

// Дерево-карта: квадратизоване розбиття (Bruls, Huizing, van Wijk), спершу групи, потім елементи групи
function squarify(items, x, y, w, h) {
  const out = [], total = items.reduce((s, i) => s + i.value, 0);
  if (!total || w <= 0 || h <= 0) return out;
  const scaleF = (w * h) / total;
  let rest = items.map(i => ({ ...i, area: i.value * scaleF })), rx = x, ry = y, rw = w, rh = h;
  while (rest.length) {
    const side = Math.min(rw, rh);
    let row = [rest[0]], best = Infinity, k = 1;
    const worst = r => { const s = r.reduce((a, b) => a + b.area, 0), mx = Math.max(...r.map(i => i.area)), mn = Math.min(...r.map(i => i.area)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
    best = worst(row);
    while (k < rest.length) { const nr = [...row, rest[k]], wv = worst(nr); if (wv > best) break; row = nr; best = wv; k++; }
    const s = row.reduce((a, b) => a + b.area, 0);
    if (rw >= rh) { const cw = s / rh; let yy = ry; row.forEach(i => { const ch = i.area / cw; out.push({ ...i, x: rx, y: yy, w: cw, h: ch }); yy += ch; }); rx += cw; rw -= cw; }
    else { const ch = s / rw; let xx = rx; row.forEach(i => { const cw = i.area / ch; out.push({ ...i, x: xx, y: ry, w: cw, h: ch }); xx += cw; }); ry += ch; rh -= ch; }
    rest = rest.slice(k);
  }
  return out;
}
export function Treemap({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const H = mini ? 118 : Math.max(300, Math.min(440, W * 0.58));
  const gcol = (g, k) => (g.name === T.ui.other && k === m.groups.length - 1 ? OTHER : seriesColor(k));
  const blocks = squarify(m.groups.map((g, k) => ({ ...g, k })), 0, 0, W, H);
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.treemap} tip={tip} mini={mini} onLeave={() => setTip(null)}
      legend={m.hasGroups && <Legend items={m.groups.map((g, k) => ({ label: g.name, color: gcol(g, k) }))} />}>
      {blocks.map(b => squarify(b.items, b.x + 1, b.y + 1, b.w - 2, b.h - 2).map((c, j) => {
        const col = gcol(b, b.k), x = c.x + 1, y = c.y + 1, w = Math.max(0, c.w - 2), h = Math.max(0, c.h - 2), ink = inkOn(col);
        const show = () => setTip(tipAt(x + w / 2, y + 6, c.label, [{ value: f.num(c.value), label: m.hasGroups ? b.name : '', color: col }, { value: f.pct(c.value / m.total, 1), label: T.ui.ofTotal }]));
        return (
          <g key={b.k + '-' + j}>
            <rect x={x} y={y} width={w} height={h} rx={mini ? 1.5 : 3} fill={col} fillOpacity={c.other ? 0.55 : 0.9} tabIndex={mini ? undefined : 0} onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => setTip(null)} />
            {!mini && w > 46 && h > 30 && <Txt x={x + 7} y={y + 17} size={11.5} weight={600} color={ink} style={{ pointerEvents: 'none' }}>{fit(c.label, w - 12, 11.5)}</Txt>}
            {!mini && w > 46 && h > 48 && <Txt x={x + 7} y={y + 33} size={11} color={ink} opacity=".85" style={{ pointerEvents: 'none' }}>{fit(f.num(c.value), w - 12)}</Txt>}
          </g>
        );
      }))}
    </Frame>
  );
}

export function Waterfall({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const n = m.bars.length, H = mini ? 118 : 340;
  const L = mini ? 4 : 56, R = mini ? 4 : 10, Tp = mini ? 8 : 24, B = mini ? 4 : 56;
  const vals = m.bars.flatMap(b => [b.from, b.to]);
  const sc = niceScale(Math.min(0, ...vals), Math.max(0, ...vals), 5);
  const y = scale(sc.lo, sc.hi, H - B, Tp);
  const band = (W - L - R) / n, bw = Math.min(mini ? 14 : 34, band * 0.66);
  const col = b => (b.kind === 'total' ? TOTAL : b.kind === 'up' ? UP : DOWN);
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.waterfall} tip={tip} mini={mini} onLeave={() => setTip(null)}
      legend={<Legend items={[{ label: T.ui.wf.total, color: TOTAL }, { label: T.ui.wf.up, color: UP }, { label: T.ui.wf.down, color: DOWN }]} />}>
      {!mini && sc.ticks.map(v => <g key={v}><HLine x1={L} x2={W - R} y={y(v)} color={v === 0 ? BASE : GRID} /><Txt x={L - 8} y={y(v) + 4} anchor="end">{f.axis(v, sc.hi)}</Txt></g>)}
      {m.bars.map((b, k) => {
        const x = L + band * k + (band - bw) / 2, top = Math.max(b.from, b.to), bot = Math.min(b.from, b.to);
        const d = b.kind === 'total' ? colPath(x, bw, y(0), y(b.to)) : b.kind === 'up' ? colPath(x, bw, y(b.from), y(b.to)) : colPath(x, bw, y(b.from), y(b.to));
        const lab = b.kind === 'total' ? f.num(b.to) : f.signed(b.delta);
        const show = () => setTip(tipAt(x + bw / 2, y(top) - 8, b.label, [{ value: lab, label: b.kind === 'total' ? T.ui.wf.total : b.kind === 'up' ? T.ui.wf.up : T.ui.wf.down, color: col(b) }, ...(b.kind !== 'total' ? [{ value: f.num(b.to), label: T.ui.wf.after }] : [])]));
        return (
          <g key={k}>
            <path d={d} fill={col(b)} />
            {k < n - 1 && <line x1={x + bw} x2={L + band * (k + 1) + (band - bw) / 2} y1={y(b.to)} y2={y(b.to)} stroke={BASE} strokeWidth="1" />}
            {!mini && band > textW(lab, 10.5) && <Txt x={x + bw / 2} y={b.kind === 'down' ? y(bot) + 14 : y(top) - 6} anchor="middle" size={10.5} color={INK.secondary}>{lab}</Txt>}
            {!mini && <Txt x={L + band * k + band / 2} y={H - B + 18} anchor="middle" size={10.5}>{wrap(b.label, band - 4, 10.5, 3).map((l, j) => <tspan key={j} x={L + band * k + band / 2} dy={j ? 12.5 : 0}>{l}</tspan>)}</Txt>}
            {!mini && <rect x={L + band * k} y={Tp} width={band} height={H - B - Tp} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}

export function Funnel({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const rows = m.rows, n = rows.length, row = mini ? 20 : 48, bh = mini ? 12 : 20;
  const labW = mini ? 0 : Math.min(W * 0.38, Math.max(...rows.map(r => textW(r.label, 12))) + 14), endW = mini ? 4 : 150;
  const H = n * row + (mini ? 4 : 6), x = scale(0, rows[0].value || 1, labW, W - endW);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {rows.map((r, k) => {
        const yy = k * row + (mini ? 4 : 8), fromPrev = k ? r.value / rows[k - 1].value : 1, fromFirst = r.value / rows[0].value;
        const show = () => setTip(tipAt(x(r.value) / 2 + labW / 2, yy - 4, r.label, [{ value: f.num(r.value), label: m.valueName, color: SERIES[0] }, { value: f.pct(fromPrev, 1), label: T.ui.fromPrev }, { value: f.pct(fromFirst, 1), label: T.ui.fromFirst }]));
        return (
          <g key={k}>
            {!mini && <Txt x={labW - 10} y={yy + bh / 2 + 4} anchor="end" color={INK.secondary} size={12}>{fit(r.label, labW - 14, 12)}</Txt>}
            <path d={barPath(yy, bh, x(0), Math.max(x(0) + 2, x(r.value)))} fill={SERIES[0]} fillOpacity={1 - k * (0.5 / Math.max(1, n - 1))} />
            {!mini && <Txt x={Math.max(x(0) + 2, x(r.value)) + 8} y={yy + bh / 2 + 4} color={INK.primary} weight={600}>{f.num(r.value)}</Txt>}
            {!mini && k > 0 && <Txt x={W - 4} y={yy + bh / 2 + 4} anchor="end" size={11.5}>{T.ui.convShort(f.pct(fromPrev))}</Txt>}
            {!mini && <rect x={0} y={yy - 6} width={W} height={row} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}

// Шкала згоди: розбіжні складені смуги з центром посередині нейтральної відповіді
function likertColors(k) {
  if (k === 2) return [DIV.neg1, DIV.pos1];
  if (k === 3) return [DIV.neg1, DIV.mid, DIV.pos1];
  if (k === 4) return [DIV.neg2, DIV.neg1, DIV.pos1, DIV.pos2];
  if (k === 5) return [DIV.neg2, DIV.neg1, DIV.mid, DIV.pos1, DIV.pos2];
  if (k === 6) return [DIV.neg2, DIV.neg1, '#8E5C7A', '#5A7FB8', DIV.pos1, DIV.pos2];
  return [DIV.neg2, DIV.neg1, '#8E5C7A', DIV.mid, '#5A7FB8', DIV.pos1, DIV.pos2];
}
export function Likert({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const K = m.levels.length, cols = likertColors(K), odd = K % 2 === 1, mid = Math.floor(K / 2);
  const qs = mini ? m.qs.slice(0, 6) : m.qs, row = mini ? 16 : 36, bh = mini ? 10 : 20;
  const labW = mini ? 0 : Math.min(W * 0.34, Math.max(...qs.map(q => textW(q, 12))) + 14);
  const Tp = mini ? 4 : 8, B = mini ? 4 : 28, H = Tp + qs.length * row + B;
  const shares = qs.map((q, i) => { const t = m.v[i].reduce((s, v) => s + v, 0) || 1; return m.v[i].map(v => v / t); });
  const left = shares.map(s => s.slice(0, mid).reduce((a, b) => a + b, 0) + (odd ? s[mid] / 2 : 0));
  const right = shares.map(s => s.slice(odd ? mid + 1 : mid).reduce((a, b) => a + b, 0) + (odd ? s[mid] / 2 : 0));
  const ext = Math.min(1, Math.ceil(Math.max(...left, ...right) * 4) / 4 + 0.0001);
  const x = scale(-ext, ext, labW, W - (mini ? 4 : 10)), x0 = x(0);
  const ticks = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].filter(v => Math.abs(v) <= ext + 1e-9);
  return (
    <Frame refEl={ref} w={W} h={H} label={T.ui.likert} tip={tip} mini={mini} onLeave={() => setTip(null)}
      legend={<Legend items={m.levels.map((l, k) => ({ label: l, color: cols[k] }))} />}>
      {!mini && ticks.map(v => <g key={v}><VLine x={x(v)} y1={Tp} y2={H - B + 4} color={v === 0 ? BASE : GRID} /><Txt x={x(v)} y={H - 8} anchor="middle">{f.pct(Math.abs(v))}</Txt></g>)}
      {qs.map((q, i) => {
        const yy = Tp + i * row + (row - bh) / 2;
        let cur = x0 - (x(left[i]) - x0);
        const show = () => setTip(tipAt(x0, yy - 4, q, m.levels.map((l, k) => ({ value: f.pct(shares[i][k]), label: l + ' · ' + f.num(m.v[i][k]), color: cols[k] })).reverse()));
        return (
          <g key={i}>
            {!mini && <Txt x={labW - 10} y={yy + bh / 2 + 4} anchor="end" color={INK.secondary} size={12}>{fit(q, labW - 14, 12)}</Txt>}
            {shares[i].map((s, k) => {
              const w = (x(s) - x0), x1 = cur; cur += w;
              const lab = f.pct(s);
              return <g key={k}>
                <rect x={x1 + 1} y={yy} width={Math.max(0, w - 2)} height={bh} rx="2" fill={cols[k]} />
                {!mini && w > textW(lab, 10.5) + 8 && <Txt x={x1 + w / 2} y={yy + bh / 2 + 4} anchor="middle" size={10.5} weight={600} color={inkOn(cols[k])}>{lab}</Txt>}
              </g>;
            })}
            {!mini && <rect x={0} y={Tp + i * row} width={W} height={row} fill="transparent" tabIndex="0" onPointerMove={show} onFocus={show} onBlur={() => setTip(null)} />}
          </g>
        );
      })}
    </Frame>
  );
}
