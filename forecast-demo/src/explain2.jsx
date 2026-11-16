// Пояснення для Prophet, TBATS, SARIMAX, бустингу з SHAP і порівняння варіантів Кростона.
import { useMemo, useState } from 'react';
import { FC, BRAND, xTicks } from './charts.jsx';
import { Frame, Lines, Bars, HBars, Waterfall, Lollipop, StackBars, dateLab, NEUTRAL, UP, DOWN } from './exparts.jsx';
import { holdout } from './engine/evaluate.js';
import { defaultParams } from './engine/models.js';
import { futureOf } from './common.jsx';

const ticksFrom = (dates, from, to, freq, fmt) => xTicks(dates, from, to, freq, fmt).map(t => ({ i: t.i - from, label: t.label }));
const isWeek = P => Math.abs(P - 7) < 0.01;
const isYear = P => P > 50;
const pct = (fmt, lam) => v => (lam === 0 ? fmt.pctSigned(v) : fmt.axis(v));

// Один цикл компоненти в календарному порядку: дні тижня з понеділка, місяці з січня
function cycleBars(comp, S, n, P, fmt) {
  const L = Math.round(P), idx = Array.from({ length: L }, (_, k) => n - L + k);
  const key = t => (S.freq === 'D' ? (new Date(S.dates[t] + 'T00:00:00Z').getUTCDay() + 6) % 7 : Number(S.dates[t].slice(5, 7)) - 1);
  const order = idx.slice().sort((a, b) => key(a) - key(b));
  return { values: order.map(t => comp[t]), labels: order.map(t => (S.freq === 'D' ? fmt.dowShort(S.dates[t]) : fmt.monShort(S.dates[t]))) };
}

// Останній повний календарний рік історії: від 1 січня, після якого є ще 364 дні даних
function lastYear(S, n) {
  for (let i = n - 1; i >= 0; i--) if (S.dates[i].endsWith('-01-01') && i + 364 < n) return i;
  return Math.max(0, n - 365);
}

function offLabel(o, E) { return o === 0 ? E.evDay : o < 0 ? E.evBefore(-o) : E.evAfter(o); }

// ——— Prophet ———
export function ProphetEx({ ex, S, T, fmt, h }) {
  const E = T.ex, n = S.y.length, N = n + h;
  const all = useMemo(() => [...S.dates, ...futureOf(S, h)], [S, h]);
  // найбільші зломи тренду, не ближче за 12% ширини один до одного, щонайбільше 4
  const sgn2 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt.dec2(Math.abs(v));
  const marks = useMemo(() => {
    const sl = i => ex.trend[Math.min(N - 1, i + 2)] - ex.trend[Math.min(N - 2, i + 1)];
    const big = ex.cps.filter(c => ex.big.includes(c.i)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)), out = [];
    for (const c of big) { if (out.length < 4 && out.every(o => Math.abs(o.x - c.i) > 0.12 * N)) out.push({ x: c.i, label: sgn2(sl(c.i)) + E.perStep(S.freq) }); }
    return out.sort((a, b) => a.x - b.x);
  }, [ex, N]);
  const slope0 = ex.trend[1] - ex.trend[0], sInt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt.int(Math.abs(Math.round(v)));
  const weekly = ex.seasons.find(q => isWeek(q.P)), yearly = ex.seasons.find(q => isYear(q.P) || q.P === 12);
  const y0 = yearly && (S.freq === 'D' ? lastYear(S, n) : Math.max(0, n - Math.round(yearly.P)));
  const yLen = yearly ? (S.freq === 'D' ? 365 : Math.round(yearly.P)) : 0;
  const evRows = ex.events.slice().sort((a, b) => b.total - a.total).map(e => ({
    id: e.id, name: T.events[e.id] || e.id, value: e.total, color: e.total >= 0 ? UP : DOWN,
    sub: e.eff.map(x => `${offLabel(x.o, E)} ${sInt(x.b)}`).join(' · '),
  }));
  return (
    <div className="ex-stack-grid">
      <Frame title={E.pTrend} sub={E.pTrendSub(sgn2(slope0) + E.perStep(S.freq), marks.length)}>
        <Lines series={[{ values: ex.trend.slice(0, n), color: FC, w: 2.2, name: E.trendC }, { values: ex.trend.slice(n - 1), x0: n - 1, color: FC, w: 2.2, dash: '5 4', name: E.trendC }]} height={170} fmt={fmt.axis}
          markX={n - 1} marks={marks} xlab={dateLab(S, 0, fmt)} ticks={ticksFrom(all, 0, N - 1, S.freq, fmt)} label={E.pTrend} />
      </Frame>
      <div className="ex-grid">
        {weekly && (() => { const c = cycleBars(weekly.v, S, n, 7, fmt); return <Frame title={E.pWeek} sub={E.pAdd}><Bars values={c.values} labels={c.labels} fmt={fmt.axis} label={E.pWeek} /></Frame>; })()}
        {yearly && (yearly.P === 12
          ? (() => { const c = cycleBars(yearly.v, S, n, 12, fmt); return <Frame title={E.pYear} sub={E.pAdd}><Bars values={c.values} labels={c.labels} fmt={fmt.axis} label={E.pYear} /></Frame>; })()
          : <Frame title={E.pYear} sub={E.pAdd}><Lines series={[{ values: yearly.v.slice(y0, y0 + yLen), color: BRAND.cyan, w: 2 }]} zero fmt={fmt.axis} xlab={dateLab(S, y0, fmt)} ticks={ticksFrom(S.dates, y0, Math.min(n - 1, y0 + yLen - 1), S.freq, fmt)} label={E.pYear} /></Frame>)}
      </div>
      {evRows.length > 0 && (
        <Frame title={E.pEvents} sub={E.pEventsSub}>
          <HBars rows={evRows} fmt={sInt} label={E.pEvents} />
        </Frame>
      )}
      {ex.regs.length > 0 && (
        <Frame title={E.coef} sub={E.pRegsSub}>
          <HBars rows={ex.regs.map(c => ({ id: c.id, name: T.drivers[c.id] || c.id, value: c.b, color: c.b >= 0 ? UP : DOWN }))} fmt={v => fmt.signed(v)} label={E.coef} />
        </Frame>
      )}
    </div>
  );
}

// ——— TBATS ———
export function TbatsEx({ ex, S, T, fmt, h }) {
  const E = T.ex, n = S.y.length, N = n + h, lam = ex.lam;
  const inv = v => (lam === 1 ? v : lam === 0 ? Math.exp(v) : Math.pow(Math.max(lam * v + 1, 0), 1 / lam));
  const all = useMemo(() => [...S.dates, ...futureOf(S, h)], [S, h]);
  const comps = ex.comps.slice().sort((a, b) => b.P - a.P);
  const from = Math.max(0, n - (S.freq === 'D' ? 120 : S.freq === 'W' ? 104 : 48));
  const colors = [BRAND.amber, BRAND.teal, FC];
  const layers = [{ name: E.tLevel, v: ex.level }];
  comps.forEach((c, k) => { const prev = layers[layers.length - 1].v; layers.push({ name: E.tPlus(T.periodName(c.P, S.freq)), v: prev.map((x, t) => x + c.v[t]) }); });
  const series = [{ values: S.y.slice(from), color: NEUTRAL, w: 1, op: 0.45 }, ...layers.map((L, k) => ({ values: L.v.slice(from).map(inv), color: k === layers.length - 1 ? FC : colors[k % colors.length], w: k === layers.length - 1 ? 2.2 : 1.6, name: k === layers.length - 1 ? `${L.name} = ${E.tModel}` : L.name }))];
  const effFmt = pct(fmt, lam), eff = v => (lam === 0 ? Math.exp(v) - 1 : v);
  const g3 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(3).replace('.', T.locale.startsWith('uk') ? ',' : '.');
  return (
    <div className="ex-stack-grid">
      <Frame title={E.tBuild} sub={E.tBuildSub}>
        <Lines series={series} height={180} fmt={fmt.axis} markX={n - 1 - from} xlab={dateLab(S, from, fmt)} ticks={ticksFrom(all, from, N - 1, S.freq, fmt)} label={E.tBuild} />
        <div className="fc-legend small">
          <span><i className="fc-sw actual" />{T.legend.actual}</span>
          {layers.map((L, k) => <span key={k}><i className="fc-sw" style={{ background: k === layers.length - 1 ? FC : colors[k % colors.length], height: k === layers.length - 1 ? 3 : 2 }} />{k === layers.length - 1 ? `${L.name} = ${E.tModel}` : L.name}</span>)}
        </div>
      </Frame>
      <div className="ex-grid">
        {comps.map(c => {
          const nm = T.periodName(c.P, S.freq), sub = `${E.tHarm(c.K)} · ${lam === 0 ? E.tMult : E.tAdd}`;
          if (isYear(c.P) && S.freq !== 'M') {
            return <Frame key={c.P} title={E.tCycle(nm)} sub={sub}><Lines series={[{ values: c.v.map(eff), color: BRAND.cyan, w: 1.8 }]} zero fmt={effFmt} markX={n - 1} xlab={dateLab(S, 0, fmt)} ticks={ticksFrom(all, 0, N - 1, S.freq, fmt)} label={nm} /></Frame>;
          }
          const cb = cycleBars(c.v, S, n, c.P, fmt);
          return <Frame key={c.P} title={E.tCycle(nm)} sub={sub}><Bars values={cb.values.map(eff)} labels={cb.labels} fmt={effFmt} label={nm} /></Frame>;
        })}
      </div>
      <Frame title={E.tChoice} sub={E.tChoiceSub}>
        <div className="ex-chips">
          <span>{lam === 0 ? E.tLog : lam === 1 ? E.tNoBc : `λ = ${fmt.dec2(lam)}`}</span>
          <span>{ex.damped ? E.tDamped(fmt.dec2(ex.phi)) : E.tNoTrend}</span>
          <span>α = {fmt.dec2(ex.alpha)}</span>
          {comps.map(c => <span key={c.P}>{T.periodName(c.P, S.freq)}: γ₁ = {g3(c.g1)}, γ₂ = {g3(c.g2)}</span>)}
        </div>
        <table className="data-table plain ex-aic">
          <thead><tr><th>{E.tVariant}</th><th className="num">AIC</th></tr></thead>
          <tbody>{ex.tried.map((x, k) => <tr key={k} className={k === 0 ? 'fc-row-on' : ''}><td>{(x.lam === 0 ? E.tLog : E.tNoBc) + ' · ' + (x.trend ? E.tDampedShort : E.tNoTrend)}</td><td className="num">{fmt.int(Math.round(x.aic))}</td></tr>)}</tbody>
        </table>
      </Frame>
    </div>
  );
}

// ——— SARIMAX ———
export function SarimaxEx({ ex, S, T, fmt, h, ho }) {
  const E = T.ex, n = S.y.length, H = S.H;
  const cmp = useMemo(() => {
    try {
      const a = holdout('arima', S, defaultParams('arima', S), H), d = holdout('drivers', S, defaultParams('drivers', S), H);
      return { a, d };
    } catch { return null; }
  }, [S]);
  const from = Math.max(0, n - H - Math.max(2 * H, 26)), cut = n - H;
  const promoIdx = S.drivers.names.indexOf('promo');
  const marksTest = promoIdx >= 0 ? S.drivers.X.slice(cut).map((x, k) => (x[promoIdx] ? { x: cut + k - from, label: E.promoMark } : null)).filter(Boolean) : [];
  const lines = cmp && ho ? [
    { id: 'arima', name: E.sNoX, color: BRAND.amber, fc: cmp.a.r.fc, mase: cmp.a.m.mase },
    { id: 'drivers', name: E.sReg, color: BRAND.teal, fc: cmp.d.r.fc, mase: cmp.d.m.mase },
    { id: 'sarimax', name: E.sBoth, color: FC, fc: ho.r.fc, mase: ho.m.mase },
  ] : [];
  const ord = o => `ARIMA(${o.p},${o.d},${o.q})${o.D ? `(0,${o.D},0)${o.m}` : ''}`;
  const all = useMemo(() => [...S.dates, ...futureOf(S, h)], [S, h]);
  const fFrom = Math.max(0, n - Math.max(2 * h, 26));
  const nonneg = S.y.every(v => v >= 0), clip = v => (nonneg ? Math.max(0, v) : v);
  const promoF = promoIdx >= 0 ? S.drivers.Xf.slice(0, h).map((x, k) => (x[promoIdx] ? { x: n + k - fFrom, label: E.promoMark } : null)).filter(Boolean) : [];
  const lim = Math.max(...ex.coef.map(c => Math.abs(c.b) + 1.96 * c.se)) || 1;
  return (
    <div className="ex-stack-grid">
      {lines.length > 0 && (
        <Frame title={E.sTest} sub={E.sTestSub}>
          <Lines series={[{ values: S.y.slice(from), color: NEUTRAL, w: 1.4, name: T.legend.actual }, ...lines.map(L => ({ values: [S.y[cut - 1], ...L.fc.map(f => f.mean)], x0: cut - 1 - from, color: L.color, w: L.id === 'sarimax' ? 2.4 : 1.6, name: L.name }))]}
            height={180} fmt={fmt.axis} markX={cut - 1 - from} marks={marksTest} xlab={dateLab(S, from, fmt)} ticks={ticksFrom(S.dates, from, n - 1, S.freq, fmt)} label={E.sTest} />
          <div className="fc-legend small">
            <span><i className="fc-sw actual" />{T.legend.actual}</span>
            {lines.map(L => <span key={L.id}><i className="fc-sw" style={{ background: L.color, height: L.id === 'sarimax' ? 3 : 2 }} />{L.name}<b className="ex-mase">MASE {fmt.dec2(L.mase)}</b></span>)}
          </div>
        </Frame>
      )}
      <div className="ex-grid">
        <Frame title={E.sFuture} sub={E.sFutureSub}>
          <Lines series={[{ values: S.y.slice(fFrom), color: NEUTRAL, w: 1.4, name: T.legend.actual }, { values: [S.y[n - 1], ...ex.plain.map(clip)], x0: n - 1 - fFrom, color: BRAND.amber, w: 1.6, name: E.sNoX }, { values: [S.y[n - 1], ...ex.xb.map((v, k) => clip(v + ex.eta[k]))], x0: n - 1 - fFrom, color: FC, w: 2.4, name: E.sBoth }]}
            height={160} fmt={fmt.axis} markX={n - 1 - fFrom} marks={promoF} xlab={dateLab(S, fFrom, fmt)} ticks={ticksFrom(all, fFrom, n - 1 + h, S.freq, fmt)} label={E.sFuture} />
          <div className="fc-legend small"><span><i className="fc-sw" style={{ background: BRAND.amber, '--sw': BRAND.amber }} />{E.sNoX}: {ord(ex.plainOrder)}</span><span><i className="fc-sw fc" />{E.sBoth}</span></div>
        </Frame>
        <Frame title={E.coef} sub={`${E.sErrors}: ${ord(ex.order)}`}>
          <ul className="ex-coef">
            {ex.coef.map(c => {
              const L = 50 + (50 * (c.b - 1.96 * c.se)) / lim, R = 50 + (50 * (c.b + 1.96 * c.se)) / lim, B = 50 + (50 * c.b) / lim;
              const sig = c.b - 1.96 * c.se > 0 || c.b + 1.96 * c.se < 0;
              return (
                <li key={c.id}>
                  <span className="ex-coef-name">{T.drivers[c.id] || c.id}</span>
                  <span className="ex-coef-track"><i className="ex-coef-zero" /><i className={'ex-coef-ci' + (sig ? ' sig' : '')} style={{ left: L + '%', width: Math.max(0.5, R - L) + '%' }} /><i className="ex-coef-dot" style={{ left: B + '%' }} /></span>
                  <b>{fmt.signed(c.b)}</b>
                </li>
              );
            })}
          </ul>
          <p className="ex-note">{E.sCoefNote}</p>
        </Frame>
      </div>
    </div>
  );
}

// ——— Бустинг і SHAP ———
const GROUP = { lag1: 'lags', lag2: 'lags', lagm: 'lags', pos: 'season' };
// групи ознак SHAP у кольорах бренд-буку (пара з тренду Slate і трьох серій перевірена валідатором)
const GROUP_COLOR = { trend: BRAND.slate, lags: BRAND.violet, season: BRAND.amber, drivers: BRAND.cyan };

export function ShapEx({ ex, S, T, fmt, h, r }) {
  const E = T.ex, n = S.y.length;
  const [k, setK] = useState(0);
  if (!ex.steps) return null;
  const all = [...S.dates, ...futureOf(S, h)];
  const valueAt = t => (t < n ? S.y[t] : r.fc[t - n]?.mean);
  const fname = id => (id === 'lag1' ? E.fLag(1, S.freq) : id === 'lag2' ? E.fLag(2, S.freq) : id === 'lagm' ? E.fLagM(S.m, S.freq) : id === 'pos' ? E.fPos(S.freq, S.m) : T.drivers[id] || id);
  const fval = (id, j, step) => {
    const x = step.x[j];
    if (id === 'lag1' || id === 'lag2' || id === 'lagm') { const L = id === 'lag1' ? 1 : id === 'lag2' ? 2 : S.m; return fmt.val(valueAt(step.t - L)); }
    if (id === 'pos') return S.freq === 'M' ? fmt.monShort(all[step.t]) : S.freq === 'D' && S.m === 7 ? fmt.dowShort(all[step.t]) : `${E.weekNo} ${Math.round(x) + 1}`;
    if (id === 'promo') return x ? T.yes : T.no;
    return fmt.dec1(x);
  };
  const groupsOrder = ['trend', 'lags', 'season', 'drivers'];
  const groups = groupsOrder.map(g => ({
    id: g, name: E.fGroup[g], color: GROUP_COLOR[g],
    values: ex.steps.map(st => (g === 'trend' ? (ex.detrend ? st.trendC : 0) : ex.feats.reduce((s, id, j) => s + ((GROUP[id] || 'drivers') === g ? st.phi[j] : 0), 0))),
  })).filter(g => g.values.some(v => Math.abs(v) > 1e-9));
  const st = ex.steps[Math.min(k, ex.steps.length - 1)];
  const deltas = ex.feats.map((id, j) => ({ name: fname(id), sub: fval(id, j, st), value: st.phi[j], kind: 'delta' }));
  if (ex.detrend) deltas.push({ name: E.fGroup.trend, sub: E.fTrendSub, value: st.trendC, kind: 'delta' });
  deltas.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const steps = [{ name: E.shapBase, sub: E.shapBaseSub, value: ex.base, kind: 'start' }, ...deltas.filter(d => Math.abs(d.value) > 1e-9), { name: E.shapPred, sub: fmt.dateLong(all[st.t], S.freq), value: st.pred, kind: 'end' }];
  const imp = ex.feats.map((id, j) => ({ id, name: fname(id), value: ex.imp[j], color: GROUP_COLOR[GROUP[id] || 'drivers'] })).sort((a, b) => b.value - a.value);
  const every = Math.max(1, Math.ceil(ex.steps.length / 5));
  const ticks = ex.steps.map((s, i) => (i % every === 0 ? { i, label: fmt.dm(all[s.t]) } : null)).filter(Boolean);
  return (
    <div className="ex-stack-grid">
      <div className="ex-grid ex-shap">
        <Frame title={E.shapSteps} sub={E.shapStepsSub}>
          <StackBars groups={groups} fmt={fmt.axis} sel={k} onSel={setK} ticks={ticks} xlab={i => fmt.dateLong(all[ex.steps[i].t], S.freq)} label={E.shapSteps} />
          <div className="fc-legend small">{groups.map(g => <span key={g.id}><i className="fc-sw" style={{ background: g.color, height: 8 }} />{g.name}</span>)}</div>
          <label className="ex-thr"><span>{E.shapPick}</span>
            <input type="range" min={0} max={ex.steps.length - 1} step={1} value={k} onChange={e => setK(Number(e.target.value))} aria-label={E.shapPick} />
            <b>{fmt.dateShort(all[st.t])}</b></label>
        </Frame>
        <Frame title={E.shapWf} sub={fmt.dateLong(all[st.t], S.freq)}>
          <Waterfall steps={steps} fmt={fmt.val} label={E.shapWf} zero />
        </Frame>
      </div>
      <Frame title={E.shapImp} sub={E.shapImpSub}>
        <HBars rows={imp} fmt={fmt.val} label={E.shapImp} />
        <p className="ex-note">{E.shapNote}</p>
      </Frame>
    </div>
  );
}

// ——— Кростон, SBA і TSB ———
export function IntermittentEx({ ex, S, T, fmt, h }) {
  const E = T.ex, n = S.y.length;
  const cmp = useMemo(() => ['croston', 'sba', 'tsb'].map(v => {
    try { const ho = holdout('croston', S, { variant: v }, S.H); return { v, mae: ho.m.mae, bias: ho.m.bias, tot: ho.m.totalErr }; } catch { return { v }; }
  }), [S]);
  const ticks = ticksFrom(S.dates, 0, n - 1, S.freq, fmt);
  const share = 1 - ex.zeros;
  return (
    <div className="ex-stack-grid">
      <Frame title={E.iOrders} sub={E.iOrdersSub(fmt.pct0(ex.zeros), fmt.dec2(ex.rate), T.params.variantOpt[ex.variant])}>
        <Lollipop values={S.y} rate={ex.rate} fmt={fmt.axis} ticks={ticks} xlab={dateLab(S, 0, fmt)} names={{ v: T.legend.actual, rate: E.iRate }} label={E.iOrders} />
      </Frame>
      <div className="ex-grid">
        <Frame title={E.iProb} sub={E.iProbSub(fmt.pct0(ex.prob), fmt.pct0(share))}>
          <Lines series={[{ values: ex.Q.map(v => (Number.isFinite(v) ? v : NaN)), color: BRAND.teal, w: 2, name: 'TSB' }, { values: new Array(n).fill(share), color: NEUTRAL, w: 1.2, dash: '4 4' }]} fmt={fmt.pct0} zero ticks={ticks} xlab={dateLab(S, 0, fmt)} label={E.iProb} />
        </Frame>
        <Frame title={E.iGap} sub={E.iGapSub(fmt.dec1(ex.interval))}>
          <Lines series={[{ values: ex.P, color: BRAND.cyan, w: 2 }]} zero fmt={fmt.axis} vfmt={fmt.dec1} xlab={dateLab(S, 0, fmt)} dots={ex.gaps.map(g => ({ x: g.t, y: g.gap, color: NEUTRAL, r: 2.6 }))} ticks={ticks} label={E.iGap} />
        </Frame>
      </div>
      <Frame title={E.iCmp} sub={E.iCmpSub(T.per(S.H, S.freq, T))}>
        <div className="table-scroll">
          <table className="data-table plain ex-cmp">
            <thead><tr><th>{E.iVariant}</th><th className="num">{E.iRate}</th><th className="num">{T.cmpCols.mae}</th><th className="num">{E.iTotal}</th></tr></thead>
            <tbody>{cmp.map(c => (
              <tr key={c.v} className={c.v === ex.variant ? 'fc-row-on' : ''}>
                <td className="strong">{T.params.variantOpt[c.v]}<small className="ex-cmp-note">{E.iWhy[c.v]}</small></td>
                <td className="num">{fmt.dec2(ex.rates[c.v])}</td>
                <td className="num">{Number.isFinite(c.mae) ? fmt.dec2(c.mae) : '·'}</td>
                <td className="num">{Number.isFinite(c.tot) ? fmt.pctSigned(c.tot) : '·'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="ex-note">{E.iNote}</p>
      </Frame>
    </div>
  );
}
