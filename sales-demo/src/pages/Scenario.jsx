// Сценарії: важелі ціни, знижок, промо, закупівлі, еластичності й порогу маржі; міст від факту до сценарію;
// повний міст до 2025 року поверх факту з ручками на стовпцях «Ціна» і «Собівартість»
import { useMemo, useRef, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { scenario, toUnits, pvm } from '../model/pvm.js';
import { Bridge } from '../charts.jsx';
import { bridgeSteps, Stat } from '../common.jsx';
import { BRAND, EFF_COL, TOT1 } from '../colors.js';

const DEF = { price: 0, disc: 0, promo: 0, proc: 0, elast: 1.2, floor: -1 };
const SMART = { ...DEF, price: 0.02, disc: 0.5, promo: 0.3, proc: 0.015 };
const RANGE = { price: [-0.05, 0.12, 0.005], disc: [0, 1, 0.05], promo: [0, 1, 0.05], proc: [0, 0.1, 0.005], elast: [0, 2.5, 0.1], floor: [-0.06, 0.2, 0.01] };
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* */ } };

export default function Scenario({ ctx }) {
  const { T, fmt, D, S, Epk, track } = ctx;
  const [lv, setLv] = useState(SMART);
  const [dragging, setDragging] = useState(null);
  const run = l => { const sc = scenario(D, S, { ...l, floor: l.floor > -0.055 ? l.floor : null }); const E2 = pvm(toUnits(D, sc.S2, 'pk')); return { ...sc, E2 }; };
  const res = useMemo(() => run(lv), [S, lv]);
  const t = Epk.tot, t2 = res.E2.tot;
  const set = (k, v) => setLv(o => ({ ...o, [k]: v }));
  const tick = useRef({});
  const onSlide = (k, v) => { const st = RANGE[k][2] * 4, q = Math.round(v / st); if (tick.current[k] !== q) { tick.current[k] = q; buzz(3); } set(k, v); };
  // ручки на повному мосту: лінійне наближення залежності впливу від важеля, оцінене на початку перетягування
  const slope = useRef({});
  const dragFor = (eff, key) => ({
    min: -Infinity, max: Infinity, snap: 1e6, step: 1e6,
    onDrag: v => {
      let s = slope.current[eff];
      if (!s || s.lv !== lv) { const h = key === 'price' ? 0.01 : 0.005, f0 = run(lv).E2.tot[eff], f1 = run({ ...lv, [key]: lv[key] + h }).E2.tot[eff]; s = { lv, x0: lv[key], f0, k: (f1 - f0) / h }; slope.current[eff] = s; }
      const [lo, hi] = RANGE[key], x = Math.max(lo, Math.min(hi, s.x0 + (v - s.f0) / (s.k || 1)));
      setLv(o => ({ ...o, [key]: x }));
    },
  });
  // повернути маржу 2025 року: підбір зміни цін бісекцією за поточних інших важелів
  const restore = () => {
    const from = { ...DEF, elast: lv.elast };
    let lo = -0.05, hi = 0.3;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2, r = run({ ...from, price: mid }).E2.tot; if (r.gm1 < t.gm0) lo = mid; else hi = mid; }
    setLv({ ...from, price: Math.min(RANGE.price[1], hi) }); track('scenario_preset', { p: 'restore' }); buzz(12);
  };
  const preset = p => { setLv(p === 'discipline' ? { ...DEF, disc: 1, promo: 0.4 } : SMART); track('scenario_preset', { p }); buzz(10); };
  const lbr = res.br;
  const leverSteps = [
    { id: 'act', label: T.sc.steps.act, short: '2026', value: t.GP1, total: true, color: BRAND.silver },
    ...['price', 'disc', 'promo', 'proc', 'volume', 'drop'].map(k => ({ id: k, label: T.sc.steps[k], short: T.sc.steps[k].split('\n')[0].slice(0, 7), value: lbr[k], color: k === 'volume' ? EFF_COL.vol : k === 'drop' ? EFF_COL.lost : k === 'proc' ? EFF_COL.cost : k === 'promo' ? EFF_COL.mix : EFF_COL.price })),
    { id: 'scen', label: T.sc.steps.scen, short: T.sc.steps.scen.slice(0, 7), value: t2.GP1, total: true, color: TOT1 },
  ];
  const ghost = Object.fromEntries(bridgeSteps(t, T).map(s => [s.id, s.value]));
  const fv = (v, s) => (s ? fmt.moneyS(v) : fmt.money(v));
  const lvFmt = { price: v => fmt.pctS(v), disc: v => fmt.pct(v, 0), promo: v => fmt.pct(v, 0), proc: v => fmt.pct(v), elast: v => fmt.dec1(v), floor: v => (v <= -0.055 ? T.sc.off : fmt.pct(v, 0)) };

  return (
    <>
      <div className="grid sm-sc-grid">
        <Panel title={T.sc.levers} aside={<button type="button" className="sm-chip sm" onClick={() => { setLv(DEF); buzz(8); }}><Icon name="reset" size={13} />{T.sc.reset}</button>}>
          <div className="sm-levers">
            {Object.keys(RANGE).map(k => { const [lo, hi, st] = RANGE[k], v = lv[k], p = (v - lo) / (hi - lo) * 100; return (
              <label key={k} className={'sm-lever' + (v !== DEF[k] ? ' on' : '')}>
                <span className="sm-lever-top"><b>{T.sc.lv[k][0]}</b><em>{lvFmt[k](v)}</em></span>
                <input type="range" min={lo} max={hi} step={st} value={v} onChange={e => onSlide(k, +e.target.value)} onPointerUp={() => track('lever', { k })} style={{ '--p': p + '%' }} />
                <small>{T.sc.lv[k][1]}</small>
              </label>
            ); })}
          </div>
          <div className="sm-presets col">
            <button type="button" className="sm-chip" onClick={restore}><Icon name="target" size={14} />{T.sc.presets.restore}</button>
            <button type="button" className="sm-chip" onClick={() => preset('discipline')}><Icon name="shield" size={14} />{T.sc.presets.discipline}</button>
            <button type="button" className="sm-chip" onClick={() => preset('smart')}><Icon name="bulb" size={14} />{T.sc.presets.smart}</button>
          </div>
        </Panel>
        <div className="side-stack">
          <div className="sm-stats three">
            <Stat label={T.k.rev} value={t2.R1} fmtV={fmt.money} delta={t2.R1 - t.R1} deltaText={fmt.moneyS(t2.R1 - t.R1)} good={t2.R1 >= t.R1} sub={`${T.sc.steps.act.replace('\n', ' ')}: ${fmt.money(t.R1)}`} />
            <Stat label={T.k.gp} value={t2.GP1} fmtV={fmt.money} delta={t2.GP1 - t.GP1} deltaText={fmt.moneyS(t2.GP1 - t.GP1)} good={t2.GP1 >= t.GP1} sub={`${T.vsBase}: ${fmt.pctS(t2.GP1 / t.GP0 - 1)}`} accent />
            <Stat label={T.k.gm} value={t2.gm1} fmtV={v => fmt.pct(v)} delta={t2.gm1 - t.gm1} deltaText={fmt.pp(t2.gm1 - t.gm1)} good={t2.gm1 >= t.gm1} sub={T.sc.gmTarget(fmt.pct(t.gm0))} />
          </div>
          <Panel title={T.sc.bridge} sub={T.sc.bridgeSub}>
            <Bridge steps={leverSteps} fmtV={fv} fmtTick={v => fmt.mln(v)} height={300} T={T} />
            {res.nDrop > 0 && <p className="note"><Icon name="info" size={14} />{T.sc.dropped(res.nDrop, fmt.money(res.dropR))}</p>}
          </Panel>
        </div>
      </div>
      <Panel title={T.sc.full} sub={T.sc.fullSub}>
        <Bridge steps={bridgeSteps(t2, T)} fmtV={fv} fmtTick={v => fmt.mln(v)} height={360} ghost={ghost} base={t2.GP0} T={T}
          drag={{ price: dragFor('price', 'price'), cost: dragFor('cost', 'proc') }} dragging={dragging} setDragging={d => { setDragging(d); if (!d) { slope.current = {}; track('bridge_drag'); } }} />
      </Panel>
    </>
  );
}
