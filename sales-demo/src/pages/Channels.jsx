// Канали: водоспад від прайсу до внеску на кожні 100 гривень, потоки виручки канал → категорія, таблиця каналів
import { useMemo, useRef, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { CHANNELS, CATS, PRODUCTS } from '../model/data.js';
import { rollup } from '../model/pvm.js';
import { Bridge, Tip, useWidth, useUid, Glow } from '../charts.jsx';
import { Chips, nm, discDepth } from '../common.jsx';
import { CH_COL, BRAND } from '../colors.js';

function Sankey({ flows, T, fmt, lang }) {
  const ref = useRef(null), W = useWidth(ref, 760), id = useUid('sk');
  const [hv, setHv] = useState(null), [tip, setTip] = useState(null);
  const narrow = W < 560, H = narrow ? 380 : 430, pad = 10, nw = 12, L = narrow ? 96 : 150, R = narrow ? 92 : 140;
  const left = CHANNELS.map((_, k) => ({ k, v: flows.filter(f => f.ch === k).reduce((s, f) => s + f.v, 0) })).filter(n => n.v > 0).sort((a, b) => b.v - a.v);
  const right = CATS.map((_, k) => ({ k, v: flows.filter(f => f.cat === k).reduce((s, f) => s + f.v, 0) })).filter(n => n.v > 0).sort((a, b) => b.v - a.v);
  const tot = left.reduce((s, n) => s + n.v, 0) || 1;
  const sc = (H - pad * (Math.max(left.length, right.length) - 1) - 20) / tot;
  let y = 10; left.forEach(n => { n.y = y; n.h = n.v * sc; y += n.h + pad; });
  y = 10 + (H - 20 - (right.reduce((s, n) => s + n.v * sc, 0) + pad * (right.length - 1))) / 2; right.forEach(n => { n.y = y; n.h = n.v * sc; y += n.h + pad; });
  const xl = L, xr = W - R;
  const lo = Object.fromEntries(left.map(n => [n.k, n.y])), ro = Object.fromEntries(right.map(n => [n.k, n.y]));
  const rank = (arr, k) => arr.findIndex(n => n.k === k);
  const links = flows.slice().sort((a, b) => rank(left, a.ch) - rank(left, b.ch) || rank(right, a.cat) - rank(right, b.cat)).map(f => {
    const h = f.v * sc, y0 = lo[f.ch], y1 = ro[f.cat];
    lo[f.ch] += h; return { ...f, h, y0, y1 };
  });
  // праві кінці впорядковуємо за порядком лівих вузлів, щоб потоки менше перетиналися
  const byCat = {}; links.slice().sort((a, b) => rank(right, a.cat) - rank(right, b.cat) || rank(left, a.ch) - rank(left, b.ch)).forEach(l => { const o = byCat[l.cat] ?? ro[l.cat]; l.y1 = o; byCat[l.cat] = o + l.h; });
  const ribbon = l => { const mx = (xl + nw + xr) / 2; return `M${xl + nw} ${l.y0}C${mx} ${l.y0} ${mx} ${l.y1} ${xr} ${l.y1}L${xr} ${l.y1 + l.h}C${mx} ${l.y1 + l.h} ${mx} ${l.y0 + l.h} ${xl + nw} ${l.y0 + l.h}Z`; };
  const on = l => !hv || (hv.t === 'l' ? hv.ch === l.ch && hv.cat === l.cat : hv.t === 'ch' ? hv.k === l.ch : hv.k === l.cat);
  const tipOf = (e, title, rows) => { const r = ref.current.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: Math.max(4, e.clientY - r.top - 70), title, rows }); };
  return (
    <div className="sm-sankey" ref={ref} onPointerLeave={() => { setHv(null); setTip(null); }}>
      <svg width={W} height={H} role="img" aria-label={T.ch.sankey}>
        <defs>
          <Glow id={id + 'g'} W={W} H={H} s1={2} s2={7} />
          {links.map((l, i) => <linearGradient key={i} id={id + 'l' + i} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor={CH_COL[l.ch]} stopOpacity=".75" /><stop offset="1" stopColor={CH_COL[l.ch]} stopOpacity=".28" /></linearGradient>)}
        </defs>
        {links.map((l, i) => (
          <path key={i} d={ribbon(l)} fill={`url(#${id}l${i})`} className={'sm-rib' + (on(l) ? '' : ' dim') + (hv && hv.t === 'l' && on(l) ? ' on' : '')}
            onPointerMove={e => { setHv({ t: 'l', ch: l.ch, cat: l.cat }); tipOf(e, `${nm(CHANNELS[l.ch], lang)} → ${nm(CATS[l.cat], lang)}`, [{ label: T.k.rev, value: fmt.money(l.v), color: CH_COL[l.ch] }, { label: T.k.gm, value: fmt.pct(l.gm) }, { label: T.vsBase, value: fmt.pctS(l.gr) }]); }} />
        ))}
        {left.map(n => (
          <g key={'L' + n.k} onPointerMove={e => { setHv({ t: 'ch', k: n.k }); tipOf(e, nm(CHANNELS[n.k], lang), [{ label: T.k.rev, value: fmt.money(n.v), color: CH_COL[n.k] }]); }}>
            <rect x={xl} y={n.y} width={nw} height={Math.max(1, n.h)} rx="3" fill={CH_COL[n.k]} filter={`url(#${id}g)`} />
            <text x={xl - 8} y={n.y + n.h / 2 - 3} textAnchor="end" className="sm-sk-l">{nm(CHANNELS[n.k], lang)}</text>
            <text x={xl - 8} y={n.y + n.h / 2 + 11} textAnchor="end" className="sm-sk-v">{fmt.money(n.v)}</text>
          </g>
        ))}
        {right.map(n => (
          <g key={'R' + n.k} onPointerMove={e => { setHv({ t: 'cat', k: n.k }); tipOf(e, nm(CATS[n.k], lang), [{ label: T.k.rev, value: fmt.money(n.v) }]); }}>
            <rect x={xr} y={n.y} width={nw} height={Math.max(1, n.h)} rx="3" className="sm-sk-r" />
            <text x={xr + nw + 8} y={n.y + n.h / 2 - 3} className="sm-sk-l">{nm(CATS[n.k], lang)}</text>
            <text x={xr + nw + 8} y={n.y + n.h / 2 + 11} className="sm-sk-v">{fmt.money(n.v)}</text>
          </g>
        ))}
      </svg>
      <Tip tip={tip} W={W} />
    </div>
  );
}

export default function Channels({ ctx }) {
  const { T, fmt, lang, D, S, Upk, Epk, CV, params } = ctx;
  const [ch, setCh] = useState(params.ch ?? -1);
  const [year, setYear] = useState(1);
  // водоспад на 100 гривень прайсу
  const wf = useMemo(() => {
    const o = [0, 1].map(() => ({ L: 0, inv: 0, promo: 0, retro: 0, r: 0, c: 0, cts: 0 }));
    for (let i = 0; i < S.n; i++) {
      const k = D.customers[D.pairs.c[i]].ci; if (ch >= 0 && k !== ch) continue;
      for (const y of [0, 1]) { const s = o[y]; s.L += S['L' + y][i]; s.inv += S['dI' + y][i]; s.promo += S['dP' + y][i]; s.retro += S['dR' + y][i]; s.r += S['r' + y][i]; s.c += S['c' + y][i]; }
    }
    CV.forEach(x => { const k = D.customers[x.k].ci; if (ch >= 0 && k !== ch) return; o[0].cts += x.cts0; o[1].cts += x.cts1; });
    return o.map(s => { const f = s.L ? 100 / s.L : 0; return { list: 100, inv: -s.inv * f, promo: -s.promo * f, retro: -s.retro * f, net: s.r * f, cogs: -s.c * f, gp: (s.r - s.c) * f, cts: -s.cts * f, cm: (s.r - s.c - s.cts) * f }; });
  }, [S, CV, ch]);
  const w = wf[year];
  const COL = { list: BRAND.silver, inv: BRAND.coral, promo: BRAND.magenta, retro: BRAND.violet, net: BRAND.cobalt, cogs: BRAND.amber, gp: BRAND.ruby, cts: BRAND.pale, cm: BRAND.cyan };
  const steps = ['list', 'inv', 'promo', 'retro', 'net', 'cogs', 'gp', 'cts', 'cm'].map(id => ({ id, label: T.ch.steps[id], short: T.ch.stepsShort[id], value: w[id], total: ['list', 'net', 'gp', 'cm'].includes(id), color: COL[id] }));
  const ghost = Object.fromEntries(Object.entries(wf[1 - year]).map(([k, v]) => [k, v]));
  const flows = useMemo(() => {
    const m = new Map();
    for (let i = 0; i < Upk.n; i++) {
      if (!Epk.cls[i]) continue;
      const key = Upk.ch[i] * 10 + PRODUCTS[Upk.prod[i]].ci, f = m.get(key) || { ch: Upk.ch[i], cat: PRODUCTS[Upk.prod[i]].ci, v: 0, gp: 0, r0: 0 };
      f.v += Upk.r1[i]; f.gp += Upk.r1[i] - Upk.c1[i]; f.r0 += Upk.r0[i]; m.set(key, f);
    }
    return [...m.values()].filter(f => f.v > 0).map(f => ({ ...f, gm: f.gp / f.v, gr: f.r0 ? f.v / f.r0 - 1 : NaN }));
  }, [Epk]);
  const G = useMemo(() => rollup(D, Upk, Epk, 'ch'), [Epk]);
  const rows = G.map(g => {
    const dd = discDepth(S, i => D.customers[D.pairs.c[i]].ci === g.k);
    let cts = 0, cm = 0; CV.forEach(x => { if (D.customers[x.k].ci === g.k) { cts += x.cts1; cm += x.cm1; } });
    return { g, dd, cts: g.r1 ? cts / g.r1 : 0, cm: g.r1 ? cm / g.r1 : 0 };
  });

  return (
    <>
      <Panel title={T.ch.wf} sub={T.ch.wfSub}
        aside={<Chips small value={year} onChange={setYear} label={T.ch.year} options={[{ value: 0, label: '2025' }, { value: 1, label: '2026' }]} />}>
        <Chips value={ch} onChange={setCh} options={[{ value: -1, label: T.all }, ...CHANNELS.map((c, k) => ({ value: k, label: nm(c, lang), color: CH_COL[k] }))]} small />
        <Bridge steps={steps} fmtV={(v, s) => (s ? (v >= 0 ? '+' : '−') + fmt.dec1(Math.abs(v)) : fmt.dec1(v))} fmtTick={v => fmt.int(v)} height={360} zoom={false} ghost={ghost} T={T} />
        <p className="note">{T.k.cm}: <b>{fmt.dec1(wf[0].cm)}</b> → <b>{fmt.dec1(wf[1].cm)}</b> · {T.k.gp}: <b>{fmt.dec1(wf[0].gp)}</b> → <b>{fmt.dec1(wf[1].gp)}</b> · {T.k.disc}: <b>{fmt.dec1(-(wf[0].inv + wf[0].promo + wf[0].retro))}</b> → <b>{fmt.dec1(-(wf[1].inv + wf[1].promo + wf[1].retro))}</b></p>
      </Panel>
      <Panel title={T.ch.sankey} sub={T.ch.sankeySub}>
        <Sankey flows={flows} T={T} fmt={fmt} lang={lang} />
      </Panel>
      <Panel title={T.ch.table}>
        <div className="table-scroll">
          <table className="data-table sm-table">
            <thead><tr>{T.ch.cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ g, dd, cts, cm }) => (
                <tr key={g.k} className={ch === g.k ? 'on' : ''} onClick={() => setCh(ch === g.k ? -1 : g.k)}>
                  <td><span className="sm-dot" style={{ background: CH_COL[g.k] }} />{nm(CHANNELS[g.k], lang)}</td>
                  <td>{fmt.money(g.r1)}</td>
                  <td className={g.gr >= 0 ? 'pos' : 'neg'}>{fmt.pctS(g.gr)}</td>
                  <td>{fmt.pct(g.gm1)}</td>
                  <td className={g.dgm >= 0 ? 'pos' : 'neg'}>{fmt.pp(g.dgm)}</td>
                  <td>{fmt.pct(dd.d1)} <small className="muted">{fmt.pp(dd.d1 - dd.d0)}</small></td>
                  <td>{fmt.pct(cts)}</td>
                  <td className={cm >= 0 ? '' : 'neg'}>{fmt.pct(cm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
