// Товари: матриця «зростання виручки проти зміни маржі», ножиці ціни й собівартості обраного товару,
// міст прибутку товару й категорій
import { useMemo, useRef, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { PRODUCTS, CATS, NM } from '../model/data.js';
import { rollup, DIMS, EFFECTS } from '../model/pvm.js';
import { Bridge, DivBars, LineChart, Tip, useWidth, useSpring, niceTicks, useUid, Glow } from '../charts.jsx';
import { bridgeSteps, nm } from '../common.jsx';
import { diverge, BRAND, POS, NEG } from '../colors.js';

const subTot = (D, U, E, dim, key) => {
  const o = { R0: 0, R1: 0, GP0: 0, GP1: 0 }; for (const e of EFFECTS) o[e] = 0;
  for (let i = 0; i < U.n; i++) { if (!E.cls[i] || DIMS[dim].key(U, i, D) !== key) continue; o.R0 += U.r0[i]; o.R1 += U.r1[i]; o.GP0 += U.r0[i] - U.c0[i]; o.GP1 += U.r1[i] - U.c1[i]; for (const e of EFFECTS) o[e] += E[e][i]; }
  return o;
};

function Matrix({ items, T, fmt, lang, sel, onPick }) {
  const ref = useRef(null), W = useWidth(ref, 760), id = useUid('mx');
  const [hv, setHv] = useState(null), [tip, setTip] = useState(null);
  const narrow = W < 560, H = narrow ? 360 : 440, M = { l: narrow ? 44 : 56, r: 16, t: 16, b: 40 };
  const xs = items.map(d => d.x), ys = items.map(d => d.y);
  const tx = niceTicks(Math.min(-0.1, ...xs), Math.max(0.2, ...xs), 6), ty = niceTicks(Math.min(-0.02, ...ys), Math.max(0.01, ...ys), 5);
  const [x0, x1, y0, y1] = useSpring([tx[0], tx[tx.length - 1], ty[0], ty[ty.length - 1]], { stiff: 110, damp: 20 });
  const pos = useSpring(items.flatMap(d => [d.x, d.y, d.r]), { stiff: 150, damp: 17 });
  const X = v => M.l + (W - M.l - M.r) * (v - x0) / (x1 - x0 || 1), Y = v => M.t + (H - M.t - M.b) * (1 - (v - y0) / (y1 - y0 || 1));
  const maxR = Math.max(...items.map(d => d.r)) || 1, rad = r => 5 + (narrow ? 20 : 30) * Math.sqrt(r / maxR);
  const show = (e, d) => { const b = ref.current.getBoundingClientRect(); setHv(d.k); setTip({ x: e.clientX - b.left, y: Math.max(4, e.clientY - b.top - 80), title: d.name, rows: [
    { label: T.pr.x, value: fmt.pctS(d.x) }, { label: T.pr.y, value: fmt.pp(d.y) }, { label: T.k.rev, value: fmt.money(d.r) }, { label: T.k.gp, value: fmt.moneyS(d.dgp), color: d.dgp >= 0 ? POS : NEG }] }); };
  const qx = X(0), qy = Y(0);
  return (
    <div className="sm-matrix" ref={ref} onPointerLeave={() => { setHv(null); setTip(null); }}>
      <svg width={W} height={H} role="img" aria-label={T.pr.matrix}>
        <defs><Glow id={id + 'g'} W={W} H={H} s1={2} s2={8} /></defs>
        <rect x={qx} y={M.t} width={Math.max(0, W - M.r - qx)} height={Math.max(0, qy - M.t)} className="sm-q q0" />
        <rect x={qx} y={qy} width={Math.max(0, W - M.r - qx)} height={Math.max(0, H - M.b - qy)} className="sm-q q1" />
        <rect x={M.l} y={M.t} width={Math.max(0, qx - M.l)} height={Math.max(0, qy - M.t)} className="sm-q q2" />
        <rect x={M.l} y={qy} width={Math.max(0, qx - M.l)} height={Math.max(0, H - M.b - qy)} className="sm-q q3" />
        {!narrow && [[W - M.r - 8, M.t + 16, 'end', 0], [W - M.r - 8, H - M.b - 10, 'end', 1], [M.l + 8, M.t + 16, 'start', 2], [M.l + 8, H - M.b - 10, 'start', 3]].map(([x, y, an, q]) => <text key={q} x={x} y={y} textAnchor={an} className={'sm-qlab q' + q}>{T.pr.quad[q]}</text>)}
        {tx.filter(t => t >= x0 && t <= x1).map(t => <g key={'x' + t}><line x1={X(t)} x2={X(t)} y1={M.t} y2={H - M.b} className={t === 0 ? 'sm-zero' : 'sm-grid'} /><text x={X(t)} y={H - M.b + 16} textAnchor="middle" className="sm-axis">{fmt.pctS(t, 0)}</text></g>)}
        {ty.filter(t => t >= y0 && t <= y1).map(t => <g key={'y' + t}><line x1={M.l} x2={W - M.r} y1={Y(t)} y2={Y(t)} className={t === 0 ? 'sm-zero' : 'sm-grid'} /><text x={M.l - 8} y={Y(t) + 3.5} textAnchor="end" className="sm-axis">{fmt.pp(t, 0)}</text></g>)}
        <text x={W - M.r} y={H - 6} textAnchor="end" className="sm-axis-t">{T.pr.x} →</text>
        <text x={M.l} y={M.t - 4} className="sm-axis-t">↑ {T.pr.y}</text>
        {items.map((d, i) => {
          const cx = X(pos[i * 3]), cy = Y(pos[i * 3 + 1]), r = rad(pos[i * 3 + 2]), on = sel === d.k || hv === d.k;
          return (
            <g key={d.k} className={'sm-bub' + (on ? ' on' : '') + ((hv != null || sel != null) && !on ? ' dim' : '')} transform={`translate(${cx} ${cy})`}
              onPointerMove={e => show(e, d)} onClick={() => onPick(sel === d.k ? null : d.k)}>
              <circle r={r} fill={d.color} fillOpacity=".38" stroke={d.color} strokeWidth="1.4" filter={on ? `url(#${id}g)` : undefined} className="sm-bub-c" />
              {(d.big || on) && <text y={-r - 5} textAnchor="middle" className="sm-bub-t">{d.short}</text>}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} W={W} />
    </div>
  );
}

export default function Products({ ctx }) {
  const { T, fmt, lang, D, Upk, Epk, t0, t1, track } = ctx;
  const [cats, setCats] = useState(null);
  const [sel, setSel] = useState(null);
  const G = useMemo(() => rollup(D, Upk, Epk, 'prod'), [Epk]);
  const cont = G.filter(g => g.r0 > 0 && g.r1 > 0), maxAbs = Math.max(...cont.map(g => Math.abs(g.dgp)));
  const big = new Set([...cont].sort((x, y) => y.r1 - x.r1).slice(0, 7).map(g => g.k));
  const items = cont.filter(g => !cats || cats.has(PRODUCTS[g.k].ci)).map(g => {
    const p = PRODUCTS[g.k], name = nm(p, lang), head = name.split(',')[0];
    return { k: g.k, x: g.gr, y: g.dgm, r: g.r1, dgp: g.dgp, name, short: head.length > 16 ? head.slice(0, 15) + '…' : head, big: big.has(g.k), color: diverge(g.dgp / maxAbs) };
  });
  const newLost = G.filter(g => (g.r0 > 0) !== (g.r1 > 0));
  const pick = k => { setSel(k); if (k != null) track('product', { product: PRODUCTS[k].id }); };
  const p = sel != null ? PRODUCTS[sel] : null;
  const detail = useMemo(() => {
    if (sel == null) return null;
    const q = new Float64Array(NM), r = new Float64Array(NM), c = new Float64Array(NM), L = new Float64Array(NM);
    for (let i = 0; i < D.pairs.n; i++) { if (D.pairs.p[i] !== sel) continue; const b = i * NM; for (let t = 0; t < NM; t++) { q[t] += D.q[b + t]; r[t] += D.r[b + t]; c[t] += D.c[b + t]; L[t] += D.L[b + t]; } }
    const ok = Array.from(q, v => v > 0);
    const custs = [];
    for (let i = 0; i < Upk.n; i++) if (Upk.prod[i] === sel && Epk.cls[i]) custs.push({ key: Upk.cust[i], label: nm(D.customers[Upk.cust[i]], lang), value: Upk.r1[i] - Upk.c1[i] - (Upk.r0[i] - Upk.c0[i]), sub: `${T.k.rev} ${fmt.money(Upk.r1[i])} · ${T.k.gm} ${Upk.r1[i] ? fmt.pct(1 - Upk.c1[i] / Upk.r1[i]) : '·'}` });
    custs.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
    return { list: Array.from(L, (v, t) => (ok[t] ? v / q[t] : NaN)), net: Array.from(r, (v, t) => (ok[t] ? v / q[t] : NaN)), unit: Array.from(c, (v, t) => (ok[t] ? v / q[t] : NaN)), tot: subTot(D, Upk, Epk, 'prod', sel), custs };
  }, [sel, Epk]);
  const catTot = useMemo(() => CATS.map((_, k) => subTot(D, Upk, Epk, 'cat', k)), [Epk]);
  const months = Array.from({ length: NM }, (_, t) => t);
  const toggleCat = k => setCats(cs => { const s = new Set(cs || []); if (s.has(k)) s.delete(k); else s.add(k); return s.size ? s : null; });

  return (
    <>
      <Panel title={T.pr.matrix} sub={`${T.pr.size} · ${T.pr.color}`}
        aside={<div className="sm-chips">{[null, ...CATS.map((_, k) => k)].map(k => <button type="button" key={String(k)} className={'sm-chip sm' + ((k == null ? !cats : cats && cats.has(k)) ? ' on' : '')} onClick={() => (k == null ? setCats(null) : toggleCat(k))}>{k == null ? T.all : nm(CATS[k], lang)}</button>)}</div>}>
        <Matrix items={items} T={T} fmt={fmt} lang={lang} sel={sel} onPick={pick} />
        <div className="sm-divlegend wide"><i style={{ background: `linear-gradient(90deg, ${NEG}, #2A3342, ${POS})` }} /><span>{fmt.moneyS(-maxAbs)}</span><span>{T.k.gp} 0</span><span>{fmt.moneyS(maxAbs)}</span></div>
        {newLost.length > 0 && <div className="sm-newlost">{newLost.map(g => <button type="button" key={g.k} className={'sm-chip sm ' + (g.r1 > 0 ? 'new' : 'lost')} onClick={() => pick(g.k)}>{g.r1 > 0 ? T.pr.newProd : T.pr.lostProd}: {nm(PRODUCTS[g.k], lang)} <b>{fmt.moneyS(g.dgp)}</b></button>)}</div>}
      </Panel>

      {p && detail ? (
        <div className="grid sm-two">
          <Panel title={nm(p, lang)} sub={T.pr.scissors} aside={<button type="button" className="icon-btn" onClick={() => pick(null)} aria-label={T.close}><Icon name="x" size={16} /></button>}>
            <LineChart xs={months} series={[{ label: T.pr.list, color: BRAND.silver, values: detail.list, dash: '5 5', width: 1.6, glow: false, fmt: fmt.uah }, { label: T.pr.net, color: BRAND.cyan, values: detail.net, fmt: fmt.uah }, { label: T.pr.unit, color: BRAND.amber, values: detail.unit, fmt: fmt.uah }]}
              fillBetween={[1, 2]} yFmt={v => fmt.int(v)} xFmt={t => (t % 3 === 0 ? fmt.mon(t) + (t % 12 === 0 ? ' ' + (2025 + t / 12) : '') : '')} tipTitle={i => fmt.monY(i)} T={T} height={260} zeroLine={false} />
            <div className="sm-legend static"><span style={{ '--lc': BRAND.silver }}><i className="dash" />{T.pr.list}</span><span style={{ '--lc': BRAND.cyan }}><i />{T.pr.net}</span><span style={{ '--lc': BRAND.amber }}><i />{T.pr.unit}</span><span style={{ '--lc': BRAND.cyan }}><i className="area" />{T.pr.margin}</span></div>
          </Panel>
          <Panel title={T.titles.bridge} sub={`${fmt.monY(t0)} · ${fmt.monY(t1)}`}>
            <Bridge steps={bridgeSteps(detail.tot, T)} fmtV={(v, s) => (s ? fmt.moneyS(v) : fmt.money(v))} fmtTick={v => (Math.abs(v) >= 1e6 ? fmt.mln(v) : fmt.dec1(v / 1e6))} height={230} compact T={T} />
            <h4 className="sm-h4">{T.pr.top}</h4>
            <DivBars rows={detail.custs} fmtV={fmt.moneyS} T={T} limit={6} />
          </Panel>
        </div>
      ) : <p className="sm-pick"><Icon name="hand" size={16} />{T.pr.pick}</p>}

      <Panel title={T.pr.cats}>
        <div className="sm-levels six">
          {CATS.map((c, k) => (
            <button type="button" key={c.id} className={'sm-level' + (cats && cats.has(k) ? ' on' : '')} onClick={() => toggleCat(k)}>
              <span className="sm-level-name">{nm(c, lang)} <small>{fmt.moneyS(catTot[k].GP1 - catTot[k].GP0)}</small></span>
              <Bridge steps={bridgeSteps(catTot[k], T)} fmtV={(v, s) => (s ? fmt.mlnS(v) : fmt.mln(v))} fmtTick={v => fmt.mln(v)} height={170} compact T={T} />
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
