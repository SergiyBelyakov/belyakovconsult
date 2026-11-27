// Міст прибутку: показник, рівень аналізу, наближення; вибір впливу і внески груп; міст лише для обраної групи;
// той самий міст на трьох рівнях
import { useMemo, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { toUnits, pvm, DIMS, EFFECTS } from '../model/pvm.js';
import { Bridge, DivBars } from '../charts.jsx';
import { bridgeSteps, contribRows, groupName, Chips } from '../common.jsx';
import { EFF_COL } from '../colors.js';

// Підсумки лише для позицій однієї групи виміру: їхня частка в мосту компанії
function subsetTot(D, U, E, dim, key) {
  const def = DIMS[dim], o = { R0: 0, R1: 0, GP0: 0, GP1: 0 };
  for (const e of [...EFFECTS, 'volR', 'priceR', 'nwR', 'lostR']) o[e] = 0;
  for (let i = 0; i < U.n; i++) {
    if (!E.cls[i] || def.key(U, i, D) !== key) continue;
    o.R0 += U.r0[i]; o.R1 += U.r1[i]; o.GP0 += U.r0[i] - U.c0[i]; o.GP1 += U.r1[i] - U.c1[i];
    for (const e of [...EFFECTS, 'volR', 'priceR', 'nwR', 'lostR']) o[e] += E[e][i];
  }
  o.dGP = o.GP1 - o.GP0;
  return o;
}

const FORMULA = { vol: '(q₁ − q₀) · p₀ · ḡ', mix: '(q₁ − q₀) · (m₀ − p₀ · ḡ)', price: 'q₁ · (p₁ − p₀)', cost: '− q₁ · (u₁ − u₀)', nw: 'q₁ · m₁', lost: '− q₀ · m₀' };

export default function BridgePage({ ctx }) {
  const { T, fmt, lang, D, S, U, E, level, setLevel, params, track } = ctx;
  const [measure, setMeasure] = useState('gp');
  const [zoom, setZoom] = useState(true);
  const [eff, setEff] = useState(params.eff || null);
  const [dim, setDim] = useState(params.dim || 'ch');
  const [focus, setFocus] = useState(null);
  const dimOk = d => DIMS[d].levels.includes(level);
  const dimNow = dimOk(dim) ? dim : 'cat';
  const focusOk = focus && dimOk(focus.dim);
  const tot = useMemo(() => (focusOk ? subsetTot(D, U, E, focus.dim, focus.key) : E.tot), [E, focus, focusOk]);
  const steps = bridgeSteps(tot, T, measure);
  const effR = measure === 'rev' && eff ? (['vol', 'price', 'nw', 'lost'].includes(eff) ? eff + 'R' : null) : eff;
  const rows = useMemo(() => contribRows(D, U, E, dimNow, effR, lang, fmt, T), [E, dimNow, effR, lang]);
  // той самий міст на трьох рівнях
  const lvTot = useMemo(() => Object.fromEntries(['p', 'pc', 'pk'].map(l => [l, l === level ? E.tot : pvm(toUnits(D, S, l)).tot])), [S, level, E]);
  const pickEff = e => { setEff(e); if (e) track('effect', { eff: e }); };
  const base = measure === 'rev' ? tot.R0 : tot.GP0;
  const fv = (v, s) => (s ? fmt.moneyS(v) : fmt.money(v));

  return (
    <>
      <Panel className="sm-controls">
        <div className="sm-ctl-row">
          <Chips label={T.bp.measureLabel} value={measure} onChange={v => { setMeasure(v); if (v === 'rev' && eff === 'mix') setEff(null); }} options={[{ value: 'gp', label: T.bp.measure.gp }, { value: 'rev', label: T.bp.measure.rev }]} />
          <Chips label={T.levelLabel} value={level} onChange={setLevel} options={['p', 'pc', 'pk'].map(l => ({ value: l, label: T.levels[l] }))} />
          <Chips label={T.bp.zoomLabel} value={zoom ? 'z' : '0'} onChange={v => setZoom(v === 'z')} options={[{ value: 'z', label: T.bp.zoom }, { value: '0', label: T.bp.fromZero }]} />
        </div>
      </Panel>

      <Panel title={focusOk ? `${T.bp.focus}: ${groupName(focus.dim, focus.key, D, lang)}` : T.titles.bridge}
        sub={measure === 'rev' ? T.bp.revNote : T.bp.hint}
        aside={focusOk && <button type="button" className="sm-chip sm on" onClick={() => setFocus(null)}><Icon name="x" size={13} />{T.bp.clear}</button>}>
        <Bridge steps={steps} fmtV={fv} fmtTick={v => fmt.mln(v)} height={380} zoom={zoom} selected={eff} onSelect={pickEff} base={base} T={T} />
        {eff && (
          <div className="sm-formula" style={{ '--fc': EFF_COL[eff] }}>
            <span className="sm-formula-k"><i />{T.eff[eff]}</span>
            <code>Σ {FORMULA[eff]}</code>
            <b>= {fmt.moneyS(measure === 'rev' ? tot[eff + 'R'] ?? 0 : tot[eff])}</b>
            <span className="muted">{T.effNote[eff]}</span>
          </div>
        )}
        <p className="note"><Icon name="check" size={14} />{T.bp.check}: {fmt.money(base)} {(measure === 'rev' ? tot.R1 - tot.R0 : tot.GP1 - tot.GP0) >= 0 ? '+' : '−'} {fmt.money(Math.abs(measure === 'rev' ? tot.R1 - tot.R0 : tot.GP1 - tot.GP0))} = {fmt.money(measure === 'rev' ? tot.R1 : tot.GP1)}</p>
      </Panel>

      <Panel title={eff ? T.bp.drill(T.eff[eff]) : T.bp.drillAll} sub={T.bp.drillSub}
        aside={<Chips small value={dimNow} onChange={setDim} options={['cat', 'prod', 'ch', 'region', 'mgr', 'cust'].map(d => ({ value: d, label: T.dims[d], disabled: !dimOk(d), title: dimOk(d) ? undefined : T.bp.dimOff }))} />}>
        <div className="sm-eff-chips">
          <button type="button" className={'sm-chip sm' + (!eff ? ' on' : '')} onClick={() => pickEff(null)}>{T.k.gp}</button>
          {(measure === 'rev' ? ['vol', 'price', 'nw', 'lost'] : EFFECTS).map(e => <button type="button" key={e} className={'sm-chip sm' + (eff === e ? ' on' : '')} style={{ '--cc': EFF_COL[e] }} onClick={() => pickEff(e)}><i />{T.eff[e]}</button>)}
        </div>
        <DivBars rows={rows} fmtV={fmt.moneyS} T={T} picked={focusOk && focus.dim === dimNow ? focus.key : null}
          onPick={k => { setFocus(focusOk && focus.dim === dimNow && focus.key === k ? null : { dim: dimNow, key: k }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} limit={dimNow === 'cat' || dimNow === 'ch' ? 12 : 10} />
      </Panel>

      <Panel title={T.bp.levels} sub={T.bp.levelsSub}>
        <div className="sm-levels">
          {['p', 'pc', 'pk'].map(l => (
            <button type="button" key={l} className={'sm-level' + (level === l ? ' on' : '')} onClick={() => setLevel(l)}>
              <span className="sm-level-name">{T.levels[l]}</span>
              <Bridge steps={bridgeSteps(lvTot[l], T)} fmtV={(v, s) => (s ? fmt.mlnS(v) : fmt.mln(v))} fmtTick={v => fmt.mln(v)} height={200} compact T={T} />
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
