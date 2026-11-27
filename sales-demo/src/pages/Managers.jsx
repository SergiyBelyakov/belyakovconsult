// Менеджери: рейтинг за виручкою проти рейтингу за прибутком, симулятор бази бонусу з плавним перестроюванням,
// знижки 2025 проти 2026 і ціновий вплив
import { useMemo, useRef, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { MANAGERS } from '../model/data.js';
import { rollup } from '../model/pvm.js';
import { useWidth, useUid, Glow } from '../charts.jsx';
import { nm } from '../common.jsx';
import { BRAND, POS, NEG } from '../colors.js';

const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* */ } };

function Slope({ rows, T, fmt, lang }) {
  const ref = useRef(null), W = useWidth(ref, 760), id = useUid('sl');
  const [hv, setHv] = useState(null);
  const narrow = W < 600, n = rows.length, rowH = narrow ? 30 : 34, H = n * rowH + 40, lw = narrow ? 118 : 210, x0 = lw, x1 = W - lw;
  const byR = [...rows].sort((a, b) => b.gr - a.gr), byG = [...rows].sort((a, b) => b.ggp - a.ggp);
  const yR = k => 30 + byR.findIndex(r => r.k === k) * rowH, yG = k => 30 + byG.findIndex(r => r.k === k) * rowH;
  return (
    <div className="sm-slope" ref={ref} onPointerLeave={() => setHv(null)}>
      <svg width={W} height={H} role="img" aria-label={T.mg.slope}>
        <defs><Glow id={id + 'g'} W={W} H={H} s1={2} s2={6} /></defs>
        <text x={x0 - 10} y={14} textAnchor="end" className="sm-sl-h">{T.mg.left}</text>
        <text x={narrow ? W - 2 : x1 + 10} y={14} textAnchor={narrow ? 'end' : 'start'} className="sm-sl-h">{T.mg.right}</text>
        {rows.map(r => {
          const a = yR(r.k), b = yG(r.k), d = (b - a) / rowH, c = d < -0.5 ? POS : d > 0.5 ? NEG : BRAND.slate, on = hv === r.k;
          return (
            <g key={r.k} className={'sm-sl' + (on ? ' on' : '') + (hv != null && !on ? ' dim' : '')} onPointerEnter={() => setHv(r.k)}>
              <rect x={0} y={Math.min(a, b) - rowH / 2} width={W} height={Math.abs(b - a) + rowH} fill="transparent" />
              <path d={`M${x0} ${a}C${(x0 + x1) / 2} ${a} ${(x0 + x1) / 2} ${b} ${x1} ${b}`} stroke={c} strokeWidth={on ? 3.2 : 2} fill="none" filter={on ? `url(#${id}g)` : undefined} className="sm-sl-p" />
              <circle cx={x0} cy={a} r="4.5" fill={c} /><circle cx={x1} cy={b} r="4.5" fill={c} />
              <text x={x0 - 10} y={a + 4} textAnchor="end" className="sm-sl-t"><tspan className="sm-sl-n">{byR.findIndex(x => x.k === r.k) + 1}</tspan> {nm(MANAGERS[r.k], lang)} <tspan className={r.gr >= 0 ? 'pos' : 'neg'}>{fmt.pctS(r.gr, 0)}</tspan></text>
              <text x={x1 + 10} y={b + 4} className="sm-sl-t"><tspan className={r.ggp >= 0 ? 'pos' : 'neg'}>{fmt.pctS(r.ggp, 0)}</tspan> {nm(MANAGERS[r.k], lang)} <tspan className="sm-sl-n">{byG.findIndex(x => x.k === r.k) + 1}</tspan></text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Managers({ ctx }) {
  const { T, fmt, lang, D, S, Upk, Epk, track } = ctx;
  const [w, setW] = useState(1);
  const G = useMemo(() => rollup(D, Upk, Epk, 'mgr'), [Epk]);
  const disc = useMemo(() => {
    const o = MANAGERS.map(() => ({ L0: 0, L1: 0, d0: 0, d1: 0 }));
    for (let i = 0; i < S.n; i++) { const m = o[D.customers[D.pairs.c[i]].mgr]; m.L0 += S.L0[i]; m.L1 += S.L1[i]; m.d0 += S.dI0[i] + S.dP0[i] + S.dR0[i]; m.d1 += S.dI1[i] + S.dP1[i] + S.dR1[i]; }
    return o.map(m => ({ d0: m.L0 ? m.d0 / m.L0 : 0, d1: m.L1 ? m.d1 / m.L1 : 0 }));
  }, [S]);
  const rows = G.map(g => ({ k: g.k, gr: g.gr ?? 0, ggp: g.ggp ?? 0, dr: g.dr, dgp: g.dgp, r0: g.r0, price: g.price, ...disc[g.k] }));
  const tot = Epk.tot, fund = Math.max(0, tot.GP1) * 0.02;
  // фонд ділиться пропорційно частці менеджера у виручці (w) і у валовому прибутку (1 − w) поточного періоду
  const sR = G.reduce((s, g) => s + Math.max(0, g.r1), 0) || 1, sG = G.reduce((s, g) => s + Math.max(0, g.gp1), 0) || 1;
  const bonus = G.map(g => ({ k: g.k, v: fund * (w * Math.max(0, g.r1) / sR + (1 - w) * Math.max(0, g.gp1) / sG), v1: fund * Math.max(0, g.r1) / sR }));
  const order = [...bonus].sort((a, b) => b.v - a.v), maxB = Math.max(...bonus.map(b => Math.max(b.v, b.v1))) || 1, rowH = 36;
  const last = useRef(w);
  const onW = v => { const q = Math.round(v * 10); if (q !== Math.round(last.current * 10)) buzz(4); last.current = v; setW(v); };
  const dmax = Math.max(...rows.map(r => Math.max(r.d0, r.d1))) * 1.1;

  return (
    <>
      <Panel title={T.mg.slope} sub={T.mg.slopeSub}>
        <Slope rows={rows} T={T} fmt={fmt} lang={lang} />
      </Panel>
      <div className="grid sm-two">
        <Panel title={T.mg.bonus} sub={T.mg.bonusSub}>
          <div className="sm-bonus-ctl">
            <span>{T.mg.baseG}</span>
            <input type="range" min="0" max="1" step="0.01" value={w} onChange={e => onW(+e.target.value)} onPointerUp={() => track('bonus', { w })} aria-label={T.mg.base} style={{ '--p': w * 100 + '%' }} />
            <span>{T.mg.baseR}</span>
          </div>
          <p className="sm-bonus-mix">{T.mg.base}: <b>{fmt.pct(w, 0)}</b> {T.mg.baseR.toLowerCase()} · <b>{fmt.pct(1 - w, 0)}</b> {T.mg.baseG.toLowerCase()} · {T.mg.pool} {fmt.money(fund)}</p>
          <div className="sm-bonus" style={{ height: order.length * rowH }}>
            {bonus.map(b => {
              const idx = order.findIndex(o => o.k === b.k), d = b.v - b.v1;
              return (
                <div key={b.k} className="sm-bonus-row" style={{ transform: `translateY(${idx * rowH}px)` }}>
                  <span className="sm-bonus-name">{nm(MANAGERS[b.k], lang)}<small>{T.mg.team[MANAGERS[b.k].team]}</small></span>
                  <span className="sm-bonus-track"><i className="v1" style={{ width: b.v1 / maxB * 100 + '%' }} /><i className="v" style={{ width: b.v / maxB * 100 + '%' }} /></span>
                  <span className="sm-bonus-val">{fmt.money(b.v)}<small className={d >= 0 ? 'pos' : 'neg'}>{Math.abs(d) > 1 ? fmt.moneyS(d) : ''}</small></span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title={T.mg.disc} sub={T.mg.real}>
          <div className="sm-dumb">
            {[...rows].sort((a, b) => (b.d1 - b.d0) - (a.d1 - a.d0)).map(r => (
              <div key={r.k} className="sm-dumb-row">
                <span className="sm-dumb-name">{nm(MANAGERS[r.k], lang)}</span>
                <span className="sm-dumb-track">
                  <i className="line" style={{ left: Math.min(r.d0, r.d1) / dmax * 100 + '%', width: Math.abs(r.d1 - r.d0) / dmax * 100 + '%', background: r.d1 > r.d0 ? NEG : POS }} />
                  <i className="d0" style={{ left: r.d0 / dmax * 100 + '%' }} title={'2025 ' + fmt.pct(r.d0)} />
                  <i className="d1" style={{ left: r.d1 / dmax * 100 + '%', background: r.d1 > r.d0 ? NEG : POS }} title={'2026 ' + fmt.pct(r.d1)} />
                </span>
                <span className="sm-dumb-val">{fmt.pct(r.d1)}<small className={r.d1 > r.d0 ? 'neg' : 'pos'}>{fmt.pp(r.d1 - r.d0)}</small></span>
                <span className="sm-dumb-real">{fmt.pct(r.r0 ? r.price / r.r0 : 0)}</span>
              </div>
            ))}
          </div>
          <div className="sm-legend static"><span style={{ '--lc': BRAND.silver }}><i className="dot" />2025</span><span style={{ '--lc': NEG }}><i className="dot" />2026</span><span className="muted">{T.mg.real}</span></div>
        </Panel>
      </div>
    </>
  );
}
