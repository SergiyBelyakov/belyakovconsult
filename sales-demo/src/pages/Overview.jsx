// Огляд: питання, відповідь моделі за вагою чинників, ножиці виручки й прибутку, мініміст, мінікарта і канали
import { useMemo } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { CHANNELS, CATS, MANAGERS, Y1, NM } from '../model/data.js';
import { rollup, REGIONS } from '../model/pvm.js';
import { Bridge, LineChart } from '../charts.jsx';
import { MapView } from '../MapView.jsx';
import { bridgeSteps, discDepth, Stat, nm, regionName, sum } from '../common.jsx';
import { EFF_COL, REV, GP, CH_COL, diverge, POS, NEG } from '../colors.js';

export default function Overview({ ctx }) {
  const { T, fmt, lang, D, M, S, Upk, Epk, go, setRange, a, b } = ctx;
  const t = Epk.tot;
  const dd = useMemo(() => discDepth(S), [S]);
  const byCh = useMemo(() => rollup(D, Upk, Epk, 'ch'), [Epk]);
  const byCat = useMemo(() => rollup(D, Upk, Epk, 'cat'), [Epk]);
  const byMgr = useMemo(() => rollup(D, Upk, Epk, 'mgr'), [Epk]);
  const byReg = useMemo(() => new Map(rollup(D, Upk, Epk, 'region').map(g => [REGIONS[g.k], g])), [Epk]);
  const drift = useMemo(() => {
    const out = MANAGERS.map(() => ({ L0: 0, L1: 0, d0: 0, d1: 0 }));
    for (let i = 0; i < S.n; i++) { const o = out[D.customers[D.pairs.c[i]].mgr]; o.L0 += S.L0[i]; o.L1 += S.L1[i]; o.d0 += S.dI0[i] + S.dP0[i] + S.dR0[i]; o.d1 += S.dI1[i] + S.dP1[i] + S.dR1[i]; }
    return out.map((o, k) => ({ k, ch: (o.L1 ? o.d1 / o.L1 : 0) - (o.L0 ? o.d0 / o.L0 : 0) })).sort((x, y) => y.ch - x.ch);
  }, [S]);

  // Відповідь: чинники за вагою впливу на прибуток
  const ins = useMemo(() => {
    const I = T.ov.ins, mS = fmt.moneyS, m = fmt.money;
    const worstCat = [...byCat].sort((x, y) => x.cost - y.cost)[0];
    const lowM = byCh.filter(g => g.gm0 != null && g.gm0 < t.g && g.r0 > 0).sort((x, y) => y.gr - x.gr)[0];
    const highM = byCh.filter(g => g.gm0 != null && g.gm0 > t.g && g.r0 > 0).sort((x, y) => x.gr - y.gr)[0];
    const extra = -sum(S.dD1);
    const list = [
      { id: 'cost', eff: 'cost', impact: t.price + t.cost, color: EFF_COL.cost, to: ['bridge', { eff: 'cost' }],
        text: t.price + t.cost < 0 ? I.cost(mS(t.price), mS(t.cost), nm(CATS[worstCat.k], lang).toLowerCase()) : I.priceWin(mS(t.price), mS(t.cost)) },
      { id: 'newlost', eff: 'nw', impact: t.nw + t.lost, color: EFF_COL.nw, to: ['customers', {}],
        text: I.newlost(m(t.nwR), mS(t.nw), fmt.pct(t.nwR ? t.nw / t.nwR : 0), m(-t.lostR), mS(t.lost), fmt.pct(t.lostR ? t.lost / t.lostR : 0)) },
      lowM && highM && { id: 'mix', eff: 'mix', impact: t.mix, color: EFF_COL.mix, to: ['channels', {}],
        text: I.mix(mS(t.mix), nm(CHANNELS[lowM.k], lang).toLowerCase(), fmt.pctS(lowM.gr, 0), fmt.pct(lowM.gm1, 0), nm(CHANNELS[highM.k], lang).toLowerCase(), fmt.pctS(highM.gr, 0), fmt.pct(highM.gm0, 0)) },
      { id: 'disc', eff: 'price', impact: extra, color: EFF_COL.price, to: ['managers', {}], text: I.disc(fmt.pct(dd.d0), fmt.pct(dd.d1), fmt.moneyS(extra), nm(MANAGERS[drift[0].k], lang), fmt.pp(drift[0].ch)) },
      { id: 'vol', eff: 'vol', impact: t.vol, color: EFF_COL.vol, to: ['bridge', { eff: 'vol' }], text: I.vol(mS(t.vol)) },
    ].filter(Boolean);
    return list.sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact));
  }, [Epk, lang]);
  const maxImp = Math.max(...ins.map(i => Math.abs(i.impact)));

  const months = Array.from({ length: NM - Y1 }, (_, i) => Y1 + i);
  const yoyR = months.map(m => M.r[m] / M.r[m - 12] - 1), yoyG = months.map(m => M.gp[m] / M.gp[m - 12] - 1);
  const maxAbs = Math.max(...[...byReg.values()].map(g => Math.abs(g.dgp)));

  return (
    <>
      <section className="sm-question glass">
        <div className="sm-q-text">
          <h2>{T.ov.q(fmt.pctS(t.R1 / t.R0 - 1), fmt.pctS(t.GP1 / t.GP0 - 1))}</h2>
          <p>{T.ov.qSub(fmt.pct(t.gm0), fmt.pct(t.gm1))}</p>
        </div>
        <div className="sm-stats">
          <Stat label={T.k.rev} value={t.R1} fmtV={fmt.money} delta={t.R1 - t.R0} deltaText={fmt.pctS(t.R1 / t.R0 - 1)} good sub={`${T.base}: ${fmt.money(t.R0)}`} icon="chart" />
          <Stat label={T.k.gp} value={t.GP1} fmtV={fmt.money} delta={t.GP1 - t.GP0} deltaText={fmt.pctS(t.GP1 / t.GP0 - 1)} good={t.GP1 >= t.GP0} sub={`${T.base}: ${fmt.money(t.GP0)}`} accent icon="coins" />
          <Stat label={T.k.gm} value={t.gm1} fmtV={v => fmt.pct(v)} delta={t.gm1 - t.gm0} deltaText={fmt.pp(t.gm1 - t.gm0)} good={t.gm1 >= t.gm0} sub={`${T.base}: ${fmt.pct(t.gm0)}`} icon="scale" />
          <Stat label={T.k.disc} value={dd.d1} fmtV={v => fmt.pct(v)} delta={dd.d1 - dd.d0} deltaText={fmt.pp(dd.d1 - dd.d0)} good={dd.d1 <= dd.d0} sub={`${T.base}: ${fmt.pct(dd.d0)}`} icon="wallet" />
        </div>
      </section>

      <div className="grid sm-ov-grid">
        <Panel title={T.ov.answer} sub={T.ov.answerSub} className="sm-answer">
          <ol className="sm-ins">
            {ins.map((it, i) => (
              <li key={it.id} style={{ '--ic': it.color, animationDelay: i * 0.07 + 's' }}>
                <span className="sm-ins-n">{i + 1}</span>
                <div className="sm-ins-body">
                  <p>{it.text}</p>
                  <span className="sm-ins-bar"><i style={{ width: Math.max(4, Math.abs(it.impact) / maxImp * 100) + '%' }} /></span>
                </div>
                <span className={'sm-ins-imp ' + (it.impact >= 0 ? 'pos' : 'neg')}>{fmt.moneyS(it.impact)}</span>
                <button type="button" className="sm-ins-go" onClick={() => go(...it.to)} aria-label={T.ov.go}><Icon name="arrowRight" size={16} /></button>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={T.ov.miniBridge} aside={<button type="button" className="link-btn" onClick={() => go('bridge')}>{T.ov.go}<Icon name="arrowRight" size={14} /></button>} className="sm-mini-bridge">
          <Bridge steps={bridgeSteps(t, T)} fmtV={(v, s) => (s ? fmt.mlnS(v) : fmt.mln(v))} fmtTick={v => fmt.mln(v)} height={250} compact T={T} onSelect={e => e && go('bridge', { eff: e })} />
          <p className="note">{T.bp.check}: {fmt.money(t.GP0)} {t.dGP >= 0 ? '+' : '−'} {fmt.money(Math.abs(t.dGP))} = {fmt.money(t.GP1)}</p>
        </Panel>
      </div>

      <Panel title={T.ov.scissors} sub={T.ov.scissorsSub}>
        <LineChart xs={months} series={[{ label: T.ov.yoyR, color: REV, values: yoyR }, { label: T.ov.yoyG, color: GP, values: yoyG, width: 2.6 }]} fillBetween={[0, 1]}
          yFmt={v => fmt.pctS(v, 0)} xFmt={m => fmt.mon(m)} tipTitle={i => fmt.monY(months[i])} T={T} height={270} onPick={i => setRange(i, i)} picked={a === b ? a : null} />
        <div className="sm-legend static"><span style={{ '--lc': REV }}><i />{T.ov.yoyR}</span><span style={{ '--lc': GP }}><i />{T.ov.yoyG}</span></div>
      </Panel>

      <div className="grid sm-ov-grid2">
        <Panel title={T.ov.miniMap} aside={<button type="button" className="link-btn" onClick={() => go('map')}>{T.ov.go}<Icon name="arrowRight" size={14} /></button>}>
          <MapView mini T={T} regionFill={id => { const g = byReg.get(id); return g ? diverge(g.dgp / (maxAbs || 1)) : null; }}
            regionTip={id => { const g = byReg.get(id); return { title: regionName(id, lang), rows: g ? [{ label: T.k.gp, value: fmt.moneyS(g.dgp) }, { label: T.k.rev, value: fmt.pctS(g.gr) }] : [] }; }}
            onSelect={id => go('map', { region: id })} showCities={false} />
          <div className="sm-divlegend"><i style={{ background: `linear-gradient(90deg, ${NEG}, #2A3342, ${POS})` }} /><span>{fmt.moneyS(-maxAbs)}</span><span>0</span><span>{fmt.moneyS(maxAbs)}</span></div>
        </Panel>
        <Panel title={T.ov.channels}>
          <div className="sm-chcards">
            {byCh.map(g => (
              <button type="button" key={g.k} className="sm-chcard" style={{ '--cc': CH_COL[g.k] }} onClick={() => go('channels', { ch: g.k })}>
                <span className="sm-chcard-name"><i />{nm(CHANNELS[g.k], lang)}</span>
                <span className="sm-chcard-row"><em>{T.ov.chGrow}</em><b className={g.gr >= 0 ? 'pos' : 'neg'}>{fmt.pctS(g.gr)}</b></span>
                <span className="sm-chcard-row"><em>{T.ov.chGp}</em><b className={g.dgp >= 0 ? 'pos' : 'neg'}>{fmt.pctS(g.ggp ?? NaN)}</b></span>
                <span className="sm-chcard-row"><em>{T.ov.chGm}</em><b>{fmt.pct(g.gm1)} <small>{fmt.pp(g.dgm)}</small></b></span>
                <span className="sm-chcard-bars"><i style={{ width: Math.min(100, Math.abs(g.gr) * 220) + '%' }} className={g.gr >= 0 ? 'pos' : 'neg'} /><i style={{ width: Math.min(100, Math.abs(g.ggp ?? 0) * 220) + '%' }} className={'gp ' + ((g.ggp ?? 0) >= 0 ? 'pos' : 'neg')} /></span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
