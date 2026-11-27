// Клієнти: крива кита з повзунком уздовж кривої, розмір клієнта проти маржі, статуси й картка клієнта
// з витратами на обслуговування
import { useMemo, useRef, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { CHANNELS, MANAGERS, PRODUCTS, CTS, RATE, NM } from '../model/data.js';
import { CITY } from '../model/geo.js';
import { Tip, useWidth, useSpring, niceTicks, useUid, Glow, DivBars } from '../charts.jsx';
import { Chips, nm } from '../common.jsx';
import { CH_COL, BRAND, POS, NEG } from '../colors.js';

const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* */ } };

function Whale({ list, measure, T, fmt, lang, D, onPick, sel }) {
  const ref = useRef(null), W = useWidth(ref, 760), id = useUid('wh');
  const narrow = W < 560, H = narrow ? 300 : 360, M = { l: narrow ? 40 : 52, r: 14, t: 18, b: 44 };
  const total = list.reduce((s, o) => s + o.v, 0) || 1;
  const cum = []; let run = 0; list.forEach(o => { run += o.v; cum.push(run / total); });
  const n = list.length, peak = Math.max(...cum), peakI = cum.indexOf(peak);
  const ty = niceTicks(0, Math.max(1.05, peak), 5);
  const [y1] = useSpring([ty[ty.length - 1]], { stiff: 110, damp: 20 });
  const cs = useSpring(cum, { stiff: 140, damp: 20 });
  const X = i => M.l + (W - M.l - M.r) * (i + 1) / n, Y = v => M.t + (H - M.t - M.b) * (1 - v / (y1 || 1));
  const [cut, setCut] = useState(null), [tip, setTip] = useState(null);
  const ci = cut ?? peakI;
  const d = 'M' + M.l + ' ' + Y(0) + cs.map((v, i) => 'L' + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const area = d + `L${X(n - 1)} ${Y(0)}Z`;
  const fromPx = px => Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / (W - M.l - M.r)) * n - 1)));
  const drag = e => {
    e.preventDefault();
    const r = ref.current.getBoundingClientRect();
    let last = -1;
    const mv = ev => { const i = fromPx(ev.clientX - r.left); if (i !== last) { last = i; setCut(i); if (i % 10 === 0) buzz(3); const o = list[i]; setTip({ x: X(i), y: Math.max(6, Y(cum[i]) - 90), title: nm(D.customers[o.k], lang), rows: [{ label: T.cu.measure[measure], value: fmt.moneyS(o.v), color: CH_COL[D.customers[o.k].ci] }] }); } };
    mv(e);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); setTip(null); buzz(8); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const share = cum[ci], restN = n - ci - 1;
  const neg = list.filter(o => o.v < 0).length;
  return (
    <div className="sm-whale" ref={ref}>
      <p className="sm-whale-cut" aria-live="polite">{T.cu.cut(ci + 1, fmt.pct(share, 0), restN, fmt.pct(Math.abs(1 - share), 0), share > 1)} <span className="muted">{T.cu.loss(neg)}</span></p>
      <svg width={W} height={H} role="img" aria-label={T.cu.whale} onPointerDown={drag} style={{ touchAction: 'none', cursor: 'ew-resize' }}>
        <defs>
          <Glow id={id + 'g'} W={W} H={H} s1={2} s2={8} />
          <linearGradient id={id + 'a'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={BRAND.ruby} stopOpacity=".45" /><stop offset="1" stopColor={BRAND.ruby} stopOpacity=".02" /></linearGradient>
          <clipPath id={id + 'k'}><rect x={M.l} y={0} width={Math.max(0, X(ci) - M.l)} height={H} /></clipPath>
        </defs>
        {ty.filter(t => t <= y1 + 1e-9).map(t => <g key={t}><line x1={M.l} x2={W - M.r} y1={Y(t)} y2={Y(t)} className={Math.abs(t - 1) < 1e-9 ? 'sm-zero' : 'sm-grid'} /><text x={M.l - 8} y={Y(t) + 3.5} textAnchor="end" className="sm-axis">{fmt.pct(t, 0)}</text></g>)}
        <path d={area} fill={`url(#${id}a)`} opacity=".45" />
        <path d={area} fill={`url(#${id}a)`} clipPath={`url(#${id}k)`} />
        <path d={d} fill="none" stroke={BRAND.ruby} strokeWidth="2.4" filter={`url(#${id}g)`} className="sm-path" />
        {/* штрихкод клієнтів за каналом */}
        {list.map((o, i) => <rect key={o.k} x={X(i - 1)} y={H - M.b + 6} width={Math.max(1, (W - M.l - M.r) / n)} height="10" fill={CH_COL[D.customers[o.k].ci]} opacity={sel === o.k ? 1 : o.v < 0 ? 0.45 : 0.8} onClick={() => onPick(o.k)} />)}
        <line x1={X(ci)} x2={X(ci)} y1={M.t} y2={H - M.b + 16} className="sm-cut" />
        <g className="sm-cut-h" transform={`translate(${X(ci)} ${Y(cs[ci] ?? 0)})`}><circle r="11" className="sm-cut-ring" /><circle r="5.5" /></g>
        <text x={X(peakI)} y={Y(peak) - 10} textAnchor="middle" className="sm-peak">{fmt.pct(peak, 0)}</text>
        <text x={M.l} y={H - 8} className="sm-axis">1</text><text x={W - M.r} y={H - 8} textAnchor="end" className="sm-axis">{n}</text>
      </svg>
      <div className="sm-legend static">{CHANNELS.map((c, k) => <span key={c.id} style={{ '--lc': CH_COL[k] }}><i className="sq" />{nm(c, lang)}</span>)}</div>
      <Tip tip={tip} W={W} />
    </div>
  );
}

function Scatter({ list, T, fmt, lang, D, onPick, sel }) {
  const ref = useRef(null), W = useWidth(ref, 640), id = useUid('sc');
  const [tip, setTip] = useState(null), [hv, setHv] = useState(null);
  const narrow = W < 560, H = narrow ? 300 : 340, M = { l: narrow ? 40 : 50, r: 12, t: 12, b: 36 };
  const pts = list.filter(o => o.r1 > 0);
  const lx = pts.map(o => Math.log10(o.r1)), ly = pts.map(o => Math.max(-0.4, Math.min(0.45, o.cm1 / o.r1)));
  const xmin = Math.floor(Math.min(...lx) * 2) / 2, xmax = Math.ceil(Math.max(...lx) * 2) / 2, ty = niceTicks(Math.min(...ly), Math.max(...ly), 5);
  const X = v => M.l + (W - M.l - M.r) * (v - xmin) / (xmax - xmin || 1), Y = v => M.t + (H - M.t - M.b) * (1 - (v - ty[0]) / (ty[ty.length - 1] - ty[0] || 1));
  const xt = []; for (let v = Math.ceil(xmin); v <= xmax; v++) xt.push(v);
  return (
    <div className="sm-scatter" ref={ref} onPointerLeave={() => { setTip(null); setHv(null); }}>
      <svg width={W} height={H} role="img" aria-label={T.cu.scatter}>
        <defs><Glow id={id + 'g'} W={W} H={H} s1={1.5} s2={5} /></defs>
        {ty.map(t => <g key={t}><line x1={M.l} x2={W - M.r} y1={Y(t)} y2={Y(t)} className={t === 0 ? 'sm-zero' : 'sm-grid'} /><text x={M.l - 8} y={Y(t) + 3.5} textAnchor="end" className="sm-axis">{fmt.pct(t, 0)}</text></g>)}
        {xt.map(v => <text key={v} x={X(v)} y={H - 12} textAnchor="middle" className="sm-axis">{fmt.money(10 ** v)}</text>)}
        <rect x={M.l} y={Y(0)} width={W - M.l - M.r} height={Math.max(0, Y(ty[0]) - Y(0))} className="sm-lossband" />
        {pts.map((o, i) => { const cu = D.customers[o.k], on = sel === o.k || hv === o.k; return (
          <circle key={o.k} cx={X(lx[i])} cy={Y(ly[i])} r={on ? 7 : 4.2} fill={CH_COL[cu.ci]} fillOpacity={on ? 1 : 0.7} stroke={on ? '#fff' : 'none'} filter={on ? `url(#${id}g)` : undefined} className="sm-pt"
            onPointerMove={e => { const r = ref.current.getBoundingClientRect(); setHv(o.k); setTip({ x: e.clientX - r.left, y: Math.max(4, e.clientY - r.top - 70), title: nm(cu, lang), rows: [{ label: T.k.rev, value: fmt.money(o.r1), color: CH_COL[cu.ci] }, { label: T.k.cm, value: `${fmt.money(o.cm1)} · ${fmt.pct(o.cm1 / o.r1)}` }] }); }}
            onClick={() => onPick(o.k)} />); })}
      </svg>
      <Tip tip={tip} W={W} />
    </div>
  );
}

export default function Customers({ ctx }) {
  const { T, fmt, lang, D, CV, Upk, Epk, t0, t1, track } = ctx;
  const [measure, setMeasure] = useState('cm');
  const [sel, setSel] = useState(null);
  const list = useMemo(() => CV.filter(o => o.r1 > 0).map(o => ({ k: o.k, v: measure === 'cm' ? o.cm1 : o.gp1 })).sort((a, b) => b.v - a.v), [CV, measure]);
  const st = useMemo(() => { const s = { cont: [0, 0, 0], new: [0, 0, 0], lost: [0, 0, 0] }; CV.forEach(o => { if (!s[o.status]) return; s[o.status][0]++; s[o.status][1] += o.status === 'lost' ? o.r0 : o.r1; s[o.status][2] += o.status === 'lost' ? o.gp0 : o.gp1; }); return s; }, [CV]);
  const pick = k => { setSel(k); if (k != null) track('customer'); };
  const card = useMemo(() => {
    if (sel == null) return null;
    const cu = D.customers[sel], o = CV[sel], s = CTS[cu.ch], parts = { log: 0, merch: 0, fin: 0, fixed: 0 }, prods = [];
    const rev = new Float64Array(NM);
    for (let i = 0; i < D.pairs.n; i++) if (D.pairs.c[i] === sel) for (let t = t0; t <= t1; t++) rev[t] += D.r[i * NM + t];
    for (let t = t0; t <= t1; t++) { if (!(rev[t] > 0)) continue; const km = D.hubKm[cu.cityI][t]; parts.log += rev[t] * s.log * (1 + km / s.km); parts.merch += rev[t] * (s.merch + (cu.fee ?? s.fee)); parts.fin += rev[t] * (s.days / 365) * RATE; parts.fixed += s.fixed; }
    for (let i = 0; i < Upk.n; i++) if (Upk.cust[i] === sel && Epk.cls[i]) prods.push({ key: Upk.prod[i], label: nm(PRODUCTS[Upk.prod[i]], lang), value: Upk.r1[i] - Upk.c1[i] - (Upk.r0[i] - Upk.c0[i]), sub: `${T.k.rev} ${fmt.money(Upk.r1[i])}` });
    prods.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { cu, o, parts, prods };
  }, [sel, CV, Epk]);

  return (
    <>
      <Panel title={T.cu.whale} sub={T.cu.whaleSub} aside={<Chips small value={measure} onChange={setMeasure} options={[{ value: 'cm', label: T.cu.measure.cm }, { value: 'gp', label: T.cu.measure.gp }]} />}>
        <Whale list={list} measure={measure} T={T} fmt={fmt} lang={lang} D={D} onPick={pick} sel={sel} />
        <p className="note"><Icon name="hand" size={14} />{T.cu.drag}</p>
      </Panel>
      <div className="grid sm-two">
        <Panel title={T.cu.scatter} sub={`${T.cu.sx} · ${T.cu.sy}`}>
          <Scatter list={CV} T={T} fmt={fmt} lang={lang} D={D} onPick={pick} sel={sel} />
          <div className="sm-legend static">{CHANNELS.map((c, k) => <span key={c.id} style={{ '--lc': CH_COL[k] }}><i className="dot" />{nm(c, lang)}</span>)}</div>
        </Panel>
        {card ? (
          <Panel title={nm(card.cu, lang)} sub={`${nm(CHANNELS[card.cu.ci], lang)} · ${nm(CITY[card.cu.city], lang)} · ${T.cu.mgr}: ${nm(MANAGERS[card.cu.mgr], lang)}`} aside={<button type="button" className="icon-btn" onClick={() => pick(null)} aria-label={T.close}><Icon name="x" size={16} /></button>}>
            <div className="sm-reg-kpi">
              <span><small>{T.k.rev}</small><b>{fmt.money(card.o.r1)}</b><em className={card.o.r1 >= card.o.r0 ? 'pos' : 'neg'}>{card.o.r0 ? fmt.pctS(card.o.r1 / card.o.r0 - 1) : T.cu.status.new}</em></span>
              <span><small>{T.k.gp}</small><b>{fmt.money(card.o.gp1)}</b><em>{fmt.pct(card.o.gp1 / card.o.r1)}</em></span>
              <span><small>{T.k.cm}</small><b className={card.o.cm1 >= 0 ? 'pos' : 'neg'}>{fmt.money(card.o.cm1)}</b><em>{fmt.pct(card.o.cm1 / card.o.r1)}</em></span>
            </div>
            <div className="sm-ctsbar">
              {[['gp', card.o.gp1, BRAND.cyan], ...Object.entries(card.parts).map(([k, v], i) => [k, -v, [BRAND.amber, BRAND.magenta, BRAND.violet, BRAND.slate][i]])].map(([k, v, c]) => (
                <span key={k} style={{ '--cc': c }}><em>{k === 'gp' ? T.k.gp : T.cu.ctsParts[k]}</em><i style={{ width: Math.min(100, Math.abs(v) / Math.max(1, card.o.gp1) * 100) + '%' }} /><b>{fmt.moneyS(v)}</b></span>
              ))}
            </div>
            <DivBars rows={card.prods} fmtV={fmt.moneyS} T={T} limit={6} />
          </Panel>
        ) : (
          <Panel title={T.cu.statusSub}>
            <div className="sm-status">
              {['cont', 'new', 'lost'].map(s => <div key={s} className={'sm-status-c ' + s}><small>{T.cu.status[s]}</small><b>{st[s][0]}</b><span>{T.k.rev} {fmt.money(st[s][1])}</span><span>{T.k.gm} {st[s][1] ? fmt.pct(st[s][2] / st[s][1]) : '·'}</span></div>)}
            </div>
            <p className="sm-pick"><Icon name="hand" size={16} />{T.cu.pick}</p>
          </Panel>
        )}
      </div>
    </>
  );
}
