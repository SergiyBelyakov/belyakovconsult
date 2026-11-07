// Поріг і перевірка: що буде з кількістю й складом сигналів, якщо змінити поріг, що знаходить кожен метод
// і як міняє картину норма «з групою» чи «з усіма». Розмітка синтетична, тому відомо, що за кожним сигналом.
import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { useWidth, C } from '../../../dashboard/src/charts.jsx';
import { METHODS, tally } from '../engine.js';
import { ModelBar } from './controls.jsx';

// Палітра типів (порядок стеку): перевірено валідатором dataviz для темного тла, суміжні пари проходять
const TYPE_COLOR = { error: '#3B82F6', risk: '#EC4899', benign: '#019586', normal: '#A855F7' };
const TYPES = ['error', 'risk', 'benign', 'normal'];
const CAUSES = {
  error: ['extraZero', 'lostZero', 'duplicate', 'miscoded', 'dateTypo'],
  risk: ['newVendor', 'split', 'offHours', 'overcharge'],
  benign: ['coldSnap', 'yearEnd', 'annual', 'emergency', 'batch', 'newCp'],
};
const XS = Array.from({ length: 51 }, (_, k) => 2 + k * 0.1);

function curve(ds, D) {
  // для кожного порогу: скільки записів кожного типу мають рівень не нижче
  const idx = Int32Array.from({ length: ds.n }, (_, i) => i).sort((a, b) => D[b] - D[a]);
  const out = XS.map(x => ({ x, error: 0, risk: 0, benign: 0, normal: 0 }));
  const acc = { error: 0, risk: 0, benign: 0, normal: 0 };
  let p = 0;
  for (let k = XS.length - 1; k >= 0; k--) {
    while (p < idx.length && D[idx[p]] >= XS[k]) { acc[ds.rows[idx[p]].truth]++; p++; }
    Object.assign(out[k], acc);
  }
  return out;
}

function StackedArea({ data, th, T, f, height = 280 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 46, R = 14, Tp = 12, B = 40, H = height;
  const max = Math.max(10, ...data.map(d => TYPES.reduce((s, t) => s + d[t], 0)));
  const stepY = [5, 10, 20, 25, 50, 100, 200, 250, 500].find(v => max / v <= 5) || 1000, nice = Math.ceil(max / stepY) * stepY;
  const ticks = Array.from({ length: Math.round(nice / stepY) + 1 }, (_, k) => k * stepY);
  const x = v => L + (W - L - R) * ((v - 2) / 5), y = v => Tp + (H - Tp - B) * (1 - v / nice);
  const layers = [];
  const base = data.map(() => 0);
  TYPES.forEach(t => {
    const top = data.map((d, k) => base[k] + d[t]);
    const path = data.map((d, k) => (k ? 'L' : 'M') + x(d.x).toFixed(1) + ',' + y(top[k]).toFixed(1)).join(' ') + ' ' + data.slice().reverse().map((d, k) => 'L' + x(d.x).toFixed(1) + ',' + y(base[data.length - 1 - k]).toFixed(1)).join(' ') + ' Z';
    layers.push({ t, path });
    top.forEach((v, k) => { base[k] = v; });
  });
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect(), vx = 2 + ((e.clientX - r.left - L) / (W - L - R)) * 5;
    const k = Math.max(0, Math.min(data.length - 1, Math.round((vx - 2) / 0.1)));
    setHi(k);
  };
  const d = hi != null ? data[hi] : null;
  return (
    <div className="chart an-area" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={T.tuning.curve} onPointerMove={move} onPointerLeave={() => setHi(null)}>
        {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{f.int(v)}</text></g>)}
        {[2, 3, 4, 5, 6, 7].map(v => <text key={v} x={x(v)} y={H - B + 16} className="axis" textAnchor="middle">{v}σ</text>)}
        <text x={(L + W - R) / 2} y={H - 4} className="axis" textAnchor="middle">{T.tuning.xLabel}</text>
        {layers.map(l => <path key={l.t} d={l.path} fill={TYPE_COLOR[l.t]} fillOpacity=".78" stroke="#0E131B" strokeWidth="1.5" strokeLinejoin="round" />)}
        <line x1={x(th)} x2={x(th)} y1={Tp - 4} y2={H - B} stroke={C.ruby} strokeWidth="2" />
        {d && <line x1={x(d.x)} x2={x(d.x)} y1={Tp} y2={H - B} stroke="rgba(255,255,255,.55)" strokeDasharray="3 3" />}
      </svg>
      {d && (
        <div className={'chart-tip' + (x(d.x) > W * 0.65 ? ' tip-r' : x(d.x) < W * 0.3 ? ' tip-l' : '')} style={{ left: x(d.x), top: 10 }} role="status">
          <b>{f.sigma(d.x)}</b>
          {TYPES.slice().reverse().map(t => <span key={t} className="tip-row"><i style={{ background: TYPE_COLOR[t] }} />{T.truth[t]}: {f.int(d[t])}</span>)}
        </div>
      )}
      <div className="legend-row">{TYPES.map(t => <span key={t}><i style={{ background: TYPE_COLOR[t] }} />{T.truth[t]}</span>)}</div>
    </div>
  );
}

export default function Tuning({ ctx }) {
  const { T, f, ds, E, res, D, th, feats, method, cx } = ctx;
  const [other, setOther] = useState(null);
  const data = useMemo(() => curve(ds, D), [D]);
  const t = useMemo(() => tally(ds, D, th), [D, th]);
  const totals = useMemo(() => { const o = { error: 0, risk: 0, benign: 0, normal: 0 }; ds.rows.forEach(x => { o[x.truth]++; }); return o; }, [ds]);
  const causeTotals = useMemo(() => { const o = {}; ds.rows.forEach(x => { if (x.cause) o[x.cause] = (o[x.cause] || 0) + 1; }); return o; }, [ds]);

  // усі методи для поточної норми й інша норма для порівняння: рахуємо після першого кадру
  useEffect(() => {
    setOther(null);
    const id = setTimeout(() => {
      E.ensure(res, 'iforest');
      const alt = E.run(cx === 'group' ? 'all' : 'group', [...feats]);
      E.ensure(alt, method);
      setOther({ res, alt });
    }, 30);
    return () => clearTimeout(id);
  }, [res, method]);

  const useful = t.byT.error + t.byT.risk, probs = totals.error + totals.risk;
  const kpis = [
    [T.tuning.kpis.signals, f.int(t.total), ''],
    [T.tuning.kpis.useful, t.total ? f.pct(useful / t.total) : '0%', T.tuning.usefulCtx],
    [T.tuning.kpis.found, f.pct(useful / probs), T.tuning.foundCtx(f.int(useful), f.int(probs))],
    [T.tuning.kpis.benign, f.int(t.byT.benign), T.tuning.benignCtx],
    [T.tuning.kpis.ordinary, f.int(t.byT.normal), T.tuning.ordinaryCtx],
    [T.tuning.kpis.hours, f.dec1((t.total * 8) / 60) + ' ' + T.tuning.hoursUnit, T.tuning.hoursCtx],
  ];
  const found = (Dm, cause) => { let k = 0; for (let i = 0; i < ds.n; i++) if (ds.rows[i].cause === cause && Dm[i] >= th) k++; return k; };
  const ordinary = Dm => { let k = 0; for (let i = 0; i < ds.n; i++) if (ds.rows[i].truth === 'normal' && Dm[i] >= th) k++; return k; };
  const groupCtx = other ? (cx === 'group' ? other.res : other.alt) : null, allCtx = other ? (cx === 'group' ? other.alt : other.res) : null;
  const tg = groupCtx ? tally(ds, groupCtx.D[method], th) : null, ta = allCtx ? tally(ds, allCtx.D[method], th) : null;
  const gmax = tg && ta ? Math.max(1, ...tg.byG, ...ta.byG) : 1;
  const common = useMemo(() => { if (!groupCtx || !allCtx) return 0; const a = groupCtx.D[method], b = allCtx.D[method]; let k = 0; for (let i = 0; i < ds.n; i++) if (a[i] >= th && b[i] >= th) k++; return k; }, [other, th, method]);

  return (
    <>
      <ModelBar ctx={ctx} compact />
      <div className="kpi-mini-row wide an-kpis glass">
        {kpis.map(([a, b, c]) => <div key={a}><span>{a}</span><b>{b}</b>{c && <small className="muted">{c}</small>}</div>)}
      </div>
      <Panel title={T.tuning.curve} sub={T.tuning.curveSub}>
        <StackedArea data={data} th={th} T={T} f={f} />
      </Panel>
      <div className="an-tuning-grid">
        <Panel title={T.tuning.methodsTitle} sub={T.tuning.methodsSub(f.sigma(th))}>
          {other ? (
            <div className="table-scroll">
              <table className="data-table plain compact an-methods">
                <thead><tr><th>{T.tuning.causeCol}</th>{METHODS.map(m => <th key={m} className={'num' + (m === method ? ' cur' : '')}>{T.methods[m]}</th>)}</tr></thead>
                <tbody>
                  {['error', 'risk', 'benign'].map(tp => [
                    <tr key={tp} className="an-sec"><td colSpan={4}><i style={{ background: TYPE_COLOR[tp] }} />{T.truth[tp]}</td></tr>,
                    ...CAUSES[tp].filter(c => causeTotals[c]).map(c => (
                      <tr key={c}>
                        <td>{T.causeNames[c]}</td>
                        {METHODS.map(m => { const k = found(other.res.D[m], c), n = causeTotals[c]; return <td key={m} className={'num' + (m === method ? ' cur' : '')}><span className="bar-cell"><span className="mini-track"><i style={{ width: `${(k / n) * 100}%`, background: TYPE_COLOR[tp] }} /></span>{k}/{n}</span></td>; })}
                      </tr>
                    )),
                  ])}
                  <tr className="an-sec"><td colSpan={4}><i style={{ background: TYPE_COLOR.normal }} />{T.truth.normal}</td></tr>
                  <tr><td>{T.tuning.ordinaryCtx}</td>{METHODS.map(m => <td key={m} className={'num' + (m === method ? ' cur' : '')}>{f.int(ordinary(other.res.D[m]))}</td>)}</tr>
                  <tr className="an-total"><td>{T.tuning.kpis.signals}</td>{METHODS.map(m => <td key={m} className={'num' + (m === method ? ' cur' : '')}>{f.int(tally(ds, other.res.D[m], th).total)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          ) : <p className="muted">{T.tuning.loading}</p>}
        </Panel>
        <Panel title={T.tuning.ctxTitle} sub={T.tuning.ctxSub}>
          {tg && ta ? (
            <>
              <div className="an-ctx-bars">
                {ds.groups.map((g, k) => (
                  <div className="an-ctx-row" key={g.id}>
                    <span className="an-ctx-name">{T.groupsShort[g.id]}</span>
                    <span className="an-ctx-pair">
                      <span className="an-ctx-bar"><i style={{ width: `${(tg.byG[k] / gmax) * 100}%`, background: '#3B82F6' }} /><b>{tg.byG[k]}</b></span>
                      <span className="an-ctx-bar"><i style={{ width: `${(ta.byG[k] / gmax) * 100}%`, background: '#019586' }} /><b>{ta.byG[k]}</b></span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="legend-row"><span><i style={{ background: '#3B82F6' }} />{T.tuning.ctxLegend.group}</span><span><i style={{ background: '#019586' }} />{T.tuning.ctxLegend.all}</span></div>
              <p className="muted small an-insight">{T.tuning.insight(ta.total, f.int(tg.total), f.int(common))}</p>
            </>
          ) : <p className="muted">{T.tuning.loading}</p>}
        </Panel>
      </div>
    </>
  );
}
