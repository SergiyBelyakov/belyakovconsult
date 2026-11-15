// Пояснювальні графіки «що модель бачить у даних»: ваги минулих значень, складові (рівень, тренд, сезон),
// лінії Тета, коефіцієнти регресії, крива зростання, автокореляції, розклад ряду, рідкісний попит,
// траєкторії Монте-Карло, аналоги k-NN і учасники ансамблю.
import { useMemo, useRef, useState } from 'react';
import { useWidth, niceTicks, pathOf, areaOf, FC } from './charts.jsx';
import { SERIES, GRID, BASE } from '../../chart-gallery/src/palette.js';
import { quantile } from './engine/util.js';

const NEUTRAL = '#C9D0DA';

function Frame({ title, sub, children, aside }) {
  return (
    <div className="ex-frame">
      <div className="ex-head"><div><h5>{title}</h5>{sub && <small>{sub}</small>}</div>{aside}</div>
      {children}
    </div>
  );
}

// Кілька ліній на одній осі
function Lines({ series, height = 120, zero = false, xs, label, fmt, markX }) {
  const ref = useRef(null), W = useWidth(ref, 400);
  const all = series.flatMap(s => s.values.filter(Number.isFinite));
  if (zero) all.push(0);
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 3), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const N = Math.max(...series.map(s => (s.x0 || 0) + s.values.length));
  const M = { l: 44, r: 8, t: 6, b: 6 };
  const X = i => M.l + (i / Math.max(1, N - 1)) * (W - M.l - M.r), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  return (
    <div ref={ref} className="ex-lines">
      <svg width={W} height={height} role="img" aria-label={label}>
        {ticks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 && zero ? BASE : GRID} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt ? fmt(v) : v}</text></g>)}
        {markX != null && <line x1={X(markX)} x2={X(markX)} y1={M.t} y2={height - M.b} className="fc-today" />}
        {series.map((s, k) => s.band
          ? <path key={k} d={areaOf(s.values.map((_, i) => X((s.x0 || 0) + i)), s.lo.map(Y), s.hi.map(Y))} fill={s.color} opacity="0.18" />
          : <path key={k} d={pathOf(s.values.map((v, i) => [X((s.x0 || 0) + i), Y(v)]))} fill="none" stroke={s.color || NEUTRAL} strokeWidth={s.w || 1.6} strokeDasharray={s.dash || null} opacity={s.op || 1} />)}
      </svg>
    </div>
  );
}

// Стовпчики з підписами під ними (вертикальні)
function Bars({ values, labels, height = 120, fmt, color = FC, highlight, label, se }) {
  const ref = useRef(null), W = useWidth(ref, 400);
  const lo = Math.min(0, ...values.map((v, i) => v - (se?.[i] ? 1.96 * se[i] : 0)).filter(Number.isFinite));
  const hi = Math.max(0, ...values.map((v, i) => v + (se?.[i] ? 1.96 * se[i] : 0)).filter(Number.isFinite));
  const ticks = niceTicks(lo, hi, 3), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const M = { l: 44, r: 6, t: 6, b: labels ? 18 : 6 }, n = values.length, gap = n > 30 ? 1 : 2;
  const bw = (W - M.l - M.r) / n - gap, X = i => M.l + i * (bw + gap), Y = v => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (height - M.t - M.b);
  const every = Math.ceil(n / Math.max(1, Math.floor((W - M.l) / 34)));
  return (
    <div ref={ref} className="ex-bars">
      <svg width={W} height={height} role="img" aria-label={label}>
        {ticks.map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? BASE : GRID} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{fmt ? fmt(v) : v}</text></g>)}
        {values.map((v, i) => Number.isFinite(v) && (
          <g key={i}>
            <rect x={X(i)} y={Math.min(Y(0), Y(v))} width={Math.max(1, bw)} height={Math.max(0.5, Math.abs(Y(v) - Y(0)))} rx={bw > 6 ? 2 : 0} fill={highlight === i ? '#F4F6F8' : color} opacity={highlight == null || highlight === i ? 1 : 0.75} />
            {se?.[i] > 0 && <line x1={X(i) + bw / 2} x2={X(i) + bw / 2} y1={Y(v - 1.96 * se[i])} y2={Y(v + 1.96 * se[i])} className="ex-whisk" />}
            {labels && i % every === 0 && <text x={X(i) + bw / 2} y={height - 4} textAnchor="middle" className="fc-xtick">{labels[i]}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// Підпис позиції сезону: місяць, день тижня чи номер тижня
function seasonLabels(dates, m, freq, fmt, offset = 0) {
  return Array.from({ length: m }, (_, p) => {
    const d = dates[(p + offset) % dates.length] || dates[p];
    if (freq === 'M') return fmt.monShort(d);
    if (freq === 'D' && m === 7) return fmt.dowShort(d);
    return String(p + 1);
  });
}

export default function Explain({ id, r, S, T, fmt, h, params }) {
  const ex = r.explain || {}, E = T.ex, n = S.y.length;
  const [thr, setThr] = useState(null);
  switch (ex.kind) {
    case 'weights': {
      const L = Math.min(ex.seasonal ? Math.max(ex.w.length, 14) : 24, Math.max(ex.w.length, 12));
      const w = Array.from({ length: L }, (_, j) => ex.w[j] || 0).reverse();
      const labels = w.map((_, i) => (i === w.length - 1 ? '1' : (L - i) % (L > 12 ? 4 : 2) === 0 ? String(L - i) : ''));
      return <Frame title={E.weights} sub={E.weightsSub}><Bars values={w} labels={labels} fmt={v => fmt.pct0(v)} label={E.weights} /></Frame>;
    }
    case 'components': {
      const from = Math.max(0, n - (S.m > 1 ? 4 * S.m : 60));
      return (
        <div className="ex-grid">
          <Frame title={E.level}><Lines series={[{ values: S.y.slice(from), color: NEUTRAL, w: 1, op: 0.5 }, { values: ex.parts[0].v.slice(from), color: FC, w: 2 }]} fmt={fmt.axis} label={E.level} /></Frame>
          <Frame title={E.trend}><Lines series={[{ values: ex.parts[1].v.slice(from), color: SERIES[1], w: 2 }]} zero fmt={fmt.axis} label={E.trend} /></Frame>
          {ex.season && <Frame title={E.season} sub={ex.mult ? E.seasonMult : E.seasonAdd}>
            <Bars values={ex.mult ? ex.season.map(v => v - 1) : ex.season} labels={seasonLabels(S.dates, S.m, S.freq, fmt)} fmt={v => (ex.mult ? fmt.pctSigned(v) : fmt.axis(v))} label={E.season} />
          </Frame>}
        </div>
      );
    }
    case 'theta': {
      const from = Math.max(0, n - (S.m > 1 ? 4 * S.m : 60));
      const fcLine = ex.fcLine, ses = new Array(h).fill(ex.sesLevel);
      return (
        <Frame title={`${E.theta0} · ${E.theta2}`} sub={E.thetaF}>
          <Lines series={[
            { values: ex.sa.slice(from), color: NEUTRAL, w: 1.2 },
            { values: ex.lrl.slice(from), color: SERIES[1], w: 1.6 },
            { values: ex.th2.slice(from), color: SERIES[3], w: 1.2, op: 0.8 },
            { values: fcLine, x0: n - from, color: SERIES[1], w: 1.6, dash: '4 3' },
            { values: ses, x0: n - from, color: SERIES[3], w: 1.6, dash: '4 3' },
            { values: fcLine.map((v, k) => 0.5 * v + 0.5 * ses[k]), x0: n - from, color: FC, w: 2.4 },
          ]} height={170} fmt={fmt.axis} markX={n - 1 - from} label={E.thetaF} />
          <div className="fc-legend small"><span><i className="fc-sw" style={{ background: SERIES[1] }} />{E.theta0}</span><span><i className="fc-sw" style={{ background: SERIES[3] }} />{E.theta2}</span><span><i className="fc-sw fc" />{E.thetaF}</span></div>
        </Frame>
      );
    }
    case 'line': {
      const N = n + h, line = Array.from({ length: N }, (_, t) => ex.from[1] + ex.slope * t);
      return (
        <Frame title={E.driftLine} sub={E.driftSub}>
          <p className="ex-big"><b>{fmt.signed(ex.slope)}</b> {E.perPeriod(S.freq)}<small>{fmt.val(ex.from[1])} → {fmt.val(ex.to[1])}</small></p>
          <Lines series={[{ values: S.y, color: NEUTRAL, w: 1.4 }, { values: line, color: FC, w: 2, dash: '5 4' }, { values: [S.y[n - 1], ...r.fc.map(f => f.mean)], x0: n - 1, color: FC, w: 2.4 }]} height={150} fmt={fmt.axis} markX={n - 1} label={E.driftLine} />
        </Frame>
      );
    }
    case 'resid': {
      const c = ex.coef[0];
      return (
        <Frame title={E.resid}>
          <p className="ex-big"><b>{fmt.val(c.b)}</b> {E.perPeriod(S.freq)}<small>± {fmt.val(1.96 * c.se)} (95%)</small></p>
          <Lines series={[{ values: S.y, color: NEUTRAL, w: 1.4 }, { values: r.fitted, color: FC, w: 2 }]} fmt={fmt.axis} label={E.resid} />
        </Frame>
      );
    }
    case 'season': {
      const labels = seasonLabels(S.dates, S.m, S.freq, fmt);
      return (
        <Frame title={E.seasonEff} sub={`${E.slope}: ${fmt.val(ex.slope)} ${E.perPeriod(S.freq)}`}>
          <Bars values={ex.eff} labels={labels} se={S.m <= 12 ? ex.se : null} fmt={fmt.axis} label={E.seasonEff} />
        </Frame>
      );
    }
    case 'coef': {
      const rows = ex.coef;
      const lim = Math.max(...rows.map(c => Math.abs(c.b) + 1.96 * c.se)) || 1;
      return (
        <Frame title={E.coef} sub={E.coefSub} aside={<span className="ex-r2">R² {fmt.dec2(ex.r2)}</span>}>
          <ul className="ex-coef">
            {rows.map(c => {
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
          <p className="ex-note">{E.r2}</p>
        </Frame>
      );
    }
    case 'growth': {
      const N = Math.round(n + Math.max(h, n * 0.6)), curve = Array.from({ length: N }, (_, t) => ex.curve(t));
      const series = [{ values: S.y, color: NEUTRAL, w: 1.4 }, { values: curve, color: FC, w: 2 }];
      if (ex.shape === 'logistic') series.push({ values: new Array(N).fill(ex.K), color: SERIES[4], w: 1.2, dash: '5 4' });
      const inc = curve.map((v, t) => (t ? v - curve[t - 1] : NaN));
      return (
        <div className="ex-grid two">
          <Frame title={E.growthLong} sub={ex.shape === 'logistic' ? `${E.ceiling}: ${fmt.val(ex.K)} · ${E.inflection}: ${fmt.dateShort(S.dates[Math.max(0, Math.min(n - 1, Math.round(ex.t0)))] || '')}` : `${E.rate}: ${fmt.pct1(ex.rate)}`}>
            <Lines series={series} height={150} fmt={fmt.axis} markX={n - 1} label={E.growthLong} />
          </Frame>
          <Frame title={E.rate}><Bars values={inc} height={150} fmt={fmt.axis} label={E.rate} highlight={ex.shape === 'logistic' ? Math.round(ex.t0) : null} /></Frame>
        </div>
      );
    }
    case 'acf': {
      const lim = 1.96 / Math.sqrt(ex.n), labels = ex.acf.map((_, i) => ((i + 1) % (S.m > 1 && S.m <= 12 ? S.m : 4) === 0 ? String(i + 1) : ''));
      const ord = ex.order, eq = `ARIMA(${ord.p},${ord.d},${ord.q})${ord.D ? `(0,${ord.D},0)${ord.m}` : ''}`;
      return (
        <div className="ex-grid ex-arima">
          <Frame title={eq} sub={ex.steps.map(s => E.steps[s.id]).join(' → ')}>
            <div className="ex-steps">{ex.steps.map((s, k) => <div key={k}><small>{E.steps[s.id]}</small><Lines series={[{ values: s.v, color: k === ex.steps.length - 1 ? FC : NEUTRAL, w: 1.3 }]} height={70} zero={k > 0} fmt={fmt.axis} label={E.steps[s.id]} /></div>)}</div>
          </Frame>
          <Frame title={E.acf} sub={E.acfSub}><AcfBars r={ex.acf} lim={lim} labels={labels} label={E.acf} /></Frame>
          <Frame title={E.pacf} sub={E.acfSub}><AcfBars r={ex.pacf} lim={lim} labels={labels} label={E.pacf} /></Frame>
        </div>
      );
    }
    case 'decomp': {
      const labels = seasonLabels(S.dates, S.m, S.freq, fmt);
      return (
        <div className="ex-grid">
          <Frame title={E.trendC}><Lines series={[{ values: S.y, color: NEUTRAL, w: 1, op: 0.45 }, { values: ex.trend, color: FC, w: 2 }]} fmt={fmt.axis} label={E.trendC} /></Frame>
          <Frame title={E.seasonC} sub={ex.mult ? E.seasonMult : E.seasonAdd}><Bars values={ex.mult ? ex.idx.map(v => v - 1) : ex.idx} labels={labels} fmt={v => (ex.mult ? fmt.pctSigned(v) : fmt.axis(v))} label={E.seasonC} /></Frame>
          <Frame title={E.remC}><Bars values={ex.mult ? ex.remainder.map(v => v - 1) : ex.remainder} fmt={v => (ex.mult ? fmt.pctSigned(v) : fmt.axis(v))} color="#94A3B8" label={E.remC} /></Frame>
        </div>
      );
    }
    case 'intermittent': {
      return (
        <div className="ex-grid">
          <Frame title={S.id === 'own' ? T.legend.actual : T.datasets[S.id]?.name || T.legend.actual} sub={E.zeros(ex.zeros)}><Bars values={S.y} fmt={fmt.axis} color="#94A3B8" label={T.legend.actual} /></Frame>
          <Frame title={E.sizeZ} sub={fmt.val(ex.size)}><Lines series={[{ values: ex.Z, color: SERIES[1], w: 2 }]} fmt={fmt.axis} label={E.sizeZ} /></Frame>
          <Frame title={E.intP} sub={fmt.dec1(ex.interval)}><Lines series={[{ values: ex.P, color: SERIES[3], w: 2 }]} fmt={fmt.axis} label={E.intP} /></Frame>
        </div>
      );
    }
    case 'paths': {
      const tot = Float64Array.from(ex.totals).sort();
      const def = quantile(tot, 0.8), t = thr ?? def;
      const p = ex.totals.filter(v => v > t).length / ex.totals.length;
      const from = Math.max(0, n - Math.max(h * 2, 26));
      const series = [{ values: S.y.slice(from), color: NEUTRAL, w: 1.4 }, ...ex.sample.map(pt => ({ values: [S.y[n - 1], ...pt], x0: n - 1 - from, color: FC, w: 1, op: 0.16 }))];
      return (
        <div className="ex-grid two">
          <Frame title={E.paths} sub={E.pathsSub}><Lines series={series} height={170} fmt={fmt.axis} markX={n - 1 - from} label={E.paths} /></Frame>
          <Frame title={E.hist(ex.flow)} sub={E.prob(fmt.pct0(p), fmt.val(t))}>
            <Hist values={ex.totals} thr={t} fmt={fmt} />
            <label className="ex-thr"><span>{E.threshold}</span>
              <input type="range" min={tot[Math.floor(tot.length * 0.02)]} max={tot[Math.floor(tot.length * 0.98)]} step={(tot[tot.length - 1] - tot[0]) / 200 || 1} value={t} onChange={e => setThr(Number(e.target.value))} />
              <b>{fmt.val(t)}</b></label>
          </Frame>
        </div>
      );
    }
    case 'analogs': return <Analogs ex={ex} S={S} T={T} fmt={fmt} r={r} />;
    case 'members': {
      const from = Math.max(0, n - Math.max(h * 2, 24));
      const series = [{ values: S.y.slice(from), color: NEUTRAL, w: 1.4 }, ...ex.members.map((m, k) => ({ values: [S.y[n - 1], ...m.fc], x0: n - 1 - from, color: SERIES[(k + 1) % SERIES.length], w: 1.5 })), { values: [S.y[n - 1], ...r.fc.map(f => f.mean)], x0: n - 1 - from, color: FC, w: 3 }];
      return (
        <Frame title={E.members}>
          <Lines series={series} height={170} fmt={fmt.axis} markX={n - 1 - from} label={E.members} />
          <div className="fc-legend small">{ex.members.map((m, k) => <span key={m.id}><i className="fc-sw" style={{ background: SERIES[(k + 1) % SERIES.length] }} />{T.models[m.id].name}</span>)}<span><i className="fc-sw fc" />{E.ensembleWord}</span></div>
        </Frame>
      );
    }
    default: return null;
  }
}

function AcfBars({ r, lim, labels, label }) {
  const ref = useRef(null), W = useWidth(ref, 300), H = 110, M = { l: 30, r: 4, t: 6, b: 16 }, n = r.length;
  const bw = (W - M.l - M.r) / n - 2, X = i => M.l + i * (bw + 2), Y = v => M.t + (1 - (v + 1) / 2) * (H - M.t - M.b);
  return (
    <div ref={ref} className="ex-bars">
      <svg width={W} height={H} role="img" aria-label={label}>
        {[-1, 0, 1].map(v => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? BASE : GRID} /><text x={M.l - 4} y={Y(v) + 4} textAnchor="end" className="fc-ytick">{v}</text></g>)}
        {[lim, -lim].map(v => <line key={v} x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} className="fc-sigma" />)}
        {r.map((v, i) => <rect key={i} x={X(i)} y={Math.min(Y(0), Y(v))} width={Math.max(1, bw)} height={Math.max(0.5, Math.abs(Y(v) - Y(0)))} fill={Math.abs(v) > lim ? FC : '#475569'} rx={bw > 5 ? 1.5 : 0} />)}
        {labels.map((l, i) => l && <text key={i} x={X(i) + bw / 2} y={H - 3} textAnchor="middle" className="fc-xtick">{l}</text>)}
      </svg>
    </div>
  );
}

function Hist({ values, thr, fmt }) {
  const ref = useRef(null), W = useWidth(ref, 300), H = 120, M = { l: 6, r: 6, t: 6, b: 18 };
  const sorted = Float64Array.from(values).sort(), lo = sorted[0], hi = sorted[sorted.length - 1], K = 28, step = (hi - lo) / K || 1;
  const counts = new Array(K).fill(0); values.forEach(v => { counts[Math.min(K - 1, Math.floor((v - lo) / step))]++; });
  const mx = Math.max(...counts), bw = (W - M.l - M.r) / K - 1;
  const X = v => M.l + ((v - lo) / (hi - lo || 1)) * (W - M.l - M.r);
  return (
    <div ref={ref} className="ex-bars">
      <svg width={W} height={H} role="img" aria-label="histogram">
        {counts.map((c, i) => <rect key={i} x={M.l + i * (bw + 1)} y={M.t + (1 - c / mx) * (H - M.t - M.b)} width={Math.max(1, bw)} height={(c / mx) * (H - M.t - M.b)} fill={lo + (i + 0.5) * step > thr ? FC : '#475569'} rx="1.5" />)}
        <line x1={X(thr)} x2={X(thr)} y1={M.t} y2={H - M.b} className="ex-thr-line" />
        <text x={M.l} y={H - 4} className="fc-xtick">{fmt.axis(lo)}</text>
        <text x={W - M.r} y={H - 4} textAnchor="end" className="fc-xtick">{fmt.axis(hi)}</text>
      </svg>
    </div>
  );
}

function Analogs({ ex, S, T, fmt, r }) {
  const { L, nb, h } = ex, n = S.y.length, y = S.y;
  const cur = y.slice(n - L), cm = cur.reduce((a, b) => a + b, 0) / L;
  const series = nb.map((c, k) => {
    const w = y.slice(c.end - L + 1, c.end + 1 + h), m = y.slice(c.end - L + 1, c.end + 1).reduce((a, b) => a + b, 0) / L;
    return { values: w.map(v => (v / (m || 1)) * cm), color: SERIES[(k + 1) % SERIES.length], w: 1.1, op: 0.75 };
  });
  series.push({ values: cur, color: '#F4F6F8', w: 2.4 });
  series.push({ values: [cur[L - 1], ...r.fc.map(f => f.mean)], x0: L - 1, color: FC, w: 2.6 });
  return (
    <div className="ex-grid two">
      <div className="ex-frame">
        <div className="ex-head"><div><h5>{T.ex.analogs}</h5><small>k = {nb.length}, L = {L}</small></div></div>
        <Lines series={series} height={170} fmt={fmt.axis} markX={L - 1} label={T.ex.analogs} />
      </div>
      <div className="ex-frame">
        <div className="ex-head"><div><h5>{T.ex.analogList}</h5></div></div>
        <ol className="ex-analogs">{nb.map((c, k) => <li key={k}><i className="fc-sw" style={{ background: SERIES[(k + 1) % SERIES.length] }} />{fmt.dateShort(S.dates[c.end - L + 1])} … {fmt.dateShort(S.dates[c.end])}<small>d = {fmt.dec2(c.dist)}</small></li>)}</ol>
      </div>
    </div>
  );
}
