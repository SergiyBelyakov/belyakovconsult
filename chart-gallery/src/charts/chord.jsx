// Хордова діаграма спрямованих потоків: дуга учасника пропорційна всім його потокам (вихідним і вхідним).
// Кожен напрямок А → Б окрема стрічка кольору відправника: вона починається у «вихідному» відрізку дуги А
// і закінчується у «вхідному» відрізку дуги Б, тому видно і хто надсилає, і хто отримує.
// Понад п'ять учасників: один колір і виділення наведенням (кольорів для категорій не більше п'яти).
import { useMemo, useState } from 'react';
import { useWidth, useTip, Txt, Frame, Legend, fit, textW } from './kit.jsx';
import { SERIES, OTHER, EMPH, INK, SURFACE } from '../palette.js';

const MONO = '#3B82F6', MONO_RIB = '#5B7DB8';
const pt = (r, a) => [r * Math.sin(a), -r * Math.cos(a)];
const f1 = v => v.toFixed(1);
function ribbon(r, s0, s1, t0, t1) {
  const [ax, ay] = pt(r, s0), [bx, by] = pt(r, s1), [cx, cy] = pt(r, t0), [dx, dy] = pt(r, t1);
  return `M${f1(ax)},${f1(ay)}A${r},${r} 0 ${s1 - s0 > Math.PI ? 1 : 0} 1 ${f1(bx)},${f1(by)}Q0,0 ${f1(cx)},${f1(cy)}A${r},${r} 0 ${t1 - t0 > Math.PI ? 1 : 0} 1 ${f1(dx)},${f1(dy)}Q0,0 ${f1(ax)},${f1(ay)}Z`;
}
function arcBand(r0, r1, a0, a1) {
  const big = a1 - a0 > Math.PI ? 1 : 0, [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M${f1(x0)},${f1(y0)}A${r1},${r1} 0 ${big} 1 ${f1(x1)},${f1(y1)}L${f1(x2)},${f1(y2)}A${r0},${r0} 0 ${big} 0 ${f1(x3)},${f1(y3)}Z`;
}
// розкладка: у дузі кожного учасника для кожного партнера поруч вихідний і вхідний відрізки;
// партнери від найближчого проти годинникової стрілки, щоб стрічки менше перетиналися
function layout(m, pad) {
  const n = m.names.length, k = (2 * Math.PI - n * pad) / (2 * m.total || 1);
  const groups = [], outS = m.names.map(() => new Array(n)), inS = m.names.map(() => new Array(n));
  let a = 0;
  for (let i = 0; i < n; i++) {
    const a0 = a;
    for (let s = 1; s < n; s++) {
      const j = (i - s + n) % n;
      outS[i][j] = [a, a + m.mat[i][j] * k]; a += m.mat[i][j] * k;
      inS[i][j] = [a, a + m.mat[j][i] * k]; a += m.mat[j][i] * k;
    }
    groups.push({ i, a0, a1: a }); a += pad;
  }
  const ribs = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && m.mat[i][j] > 0) ribs.push({ i, j, s: outS[i][j], t: inS[j][i] });
  return { groups, ribs };
}

export function Chord({ m, f, T, mini }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const [hg, setHg] = useState(null);
  const [hr, setHr] = useState(null);
  const n = m.names.length, mono = n > 5;
  const color = i => (m.otherLast && i === n - 1 ? OTHER : mono ? MONO : SERIES[i]);
  const labPad = mini ? 4 : Math.min(130, Math.max(...m.names.map(s => textW(s, 11.5))) + 16);
  const H = mini ? 118 : Math.max(340, Math.min(540, W * 0.78));
  const Ro = Math.max(40, Math.min(W / 2 - labPad, H / 2 - (mini ? 4 : 26))), Ri = Ro - (mini ? 6 : 13);
  const lay = useMemo(() => layout(m, mini ? 0.06 : 0.035), [m, mini]);
  const cx = W / 2, cy = H / 2;
  const activeRib = r => (hr != null ? r === hr : hg != null ? r.i === hg || r.j === hg : null);
  const showG = g => {
    const mid = (g.a0 + g.a1) / 2, [px, py] = pt(Ro + 6, mid);
    setHg(g.i); setHr(null);
    setTip({ x: cx + px, y: cy + py - 10, title: m.names[g.i], rows: [
      { value: f.num(m.out[g.i]), label: T.ui.outgoing, color: color(g.i) },
      { value: f.num(m.inn[g.i]), label: T.ui.incoming },
      { value: f.signed(m.inn[g.i] - m.out[g.i]), label: T.ui.netIn },
    ] });
  };
  const showR = (r, e) => {
    const b = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    setHr(r); setHg(null);
    const a = m.names[r.i], bb = m.names[r.j], v = m.mat[r.i][r.j], back = m.mat[r.j][r.i];
    setTip({ x: e.clientX - b.left, y: e.clientY - b.top - 14, title: a + ' → ' + bb, rows: [
      { value: f.num(v), label: m.valueName, color: color(r.i) },
      { value: f.num(back), label: T.ui.backFlow(bb, a), color: color(r.j) },
    ], note: v !== back ? T.ui.chordNet(v > back ? a : bb, f.num(Math.abs(v - back))) : null });
  };
  const leave = () => { setTip(null); setHg(null); setHr(null); };
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={leave}
      legend={!mini && !mono && <Legend items={m.names.map((nm, i) => ({ label: nm, color: color(i) }))} />}>
      <g transform={`translate(${cx},${cy})`}>
        {lay.ribs.map((r, k) => {
          const a = activeRib(r);
          return <path key={k} d={ribbon(Ri, r.s[0], r.s[1], r.t[0], r.t[1])} fill={a && mono ? EMPH : mono ? MONO_RIB : color(r.i)}
            fillOpacity={a == null ? (mini ? 0.6 : 0.58) : a ? 0.88 : 0.07} stroke={SURFACE} strokeWidth={mini ? 0.4 : 0.8}
            onPointerMove={mini ? undefined : e => showR(r, e)} onPointerLeave={() => setHr(null)} />;
        })}
        {lay.groups.map(g => {
          const mid = (g.a0 + g.a1) / 2, right = mid < Math.PI, [lx, ly] = pt(Ro + 8, mid);
          return (
            <g key={g.i}>
              <path d={arcBand(Ri + 2, Ro, g.a0, Math.max(g.a0 + 0.002, g.a1))} fill={hg === g.i ? EMPH : color(g.i)} tabIndex={mini ? undefined : 0}
                onPointerMove={mini ? undefined : () => showG(g)} onFocus={mini ? undefined : () => showG(g)} onBlur={leave} style={{ cursor: mini ? undefined : 'pointer' }} />
              {!mini && <Txt x={lx} y={ly + 4} anchor={Math.abs(Math.sin(mid)) < 0.18 ? 'middle' : right ? 'start' : 'end'} size={11.5} color={hg == null || hg === g.i ? INK.primary : INK.faint}
                stroke={SURFACE} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{fit(m.names[g.i], labPad - 10, 11.5)}</Txt>}
            </g>
          );
        })}
      </g>
    </Frame>
  );
}
