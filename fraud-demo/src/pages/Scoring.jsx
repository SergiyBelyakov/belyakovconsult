import { Panel } from '../../../dashboard/src/ui.jsx';
import { confusion, roc, lift, histogram, thresholdFor, MODELS, FEATURES, RULES, RECOVERY } from '../model.js';
import { Curves, ScoreHist, Confusion, SignedBars, MODEL_COLOR, C } from '../charts.jsx';
import { ModelBar } from './controls.jsx';

export default function Scoring({ ctx }) {
  const { T, f, B, model, th, cap } = ctx;
  const c = confusion(B.test, model, th);
  const curves = MODELS.map(m => ({ m, r: roc(B.test, m) }));
  const cur = curves.find(x => x.m === model);
  const caps = Array.from({ length: 20 }, (_, i) => 0.005 * (i + 1));
  const ben = caps.map(k => [k, confusion(B.test, model, thresholdFor(B.test, model, k)).benefit / 0.3]);
  const best = ben.reduce((a, b) => (b[1] > a[1] ? b : a));
  const lf = lift(B.test, model);
  const coefItems = model === 'rules'
    ? RULES.map(r => ({ id: r.id, name: T.features[r.id], value: r.w }))
    : FEATURES.map((ft, j) => ({ id: ft.id, name: T.features[ft.id], value: B.M.w[j] })).sort((a, b) => b.value - a.value);
  return (
    <>
      <ModelBar ctx={ctx} />
      <div className="grid grid-main">
        <Panel title={T.rocTitle} sub={T.rocSub}>
          <Curves series={curves.map(({ m, r }) => ({ id: m, color: MODEL_COLOR[m], strong: m === model, pts: r.pts.map(p => [p.fpr, p.tpr]) }))}
            xDomain={[0, 0.3]} xFmt={v => f.pct(v, 0)} yFmt={v => f.pct(v, 0)} xLabel={T.rocAxis[0]} yLabel={T.rocAxis[1]} diagonal
            marks={[{ x: Math.min(0.3, c.fpr), y: c.recall, label: f.pct(c.recall, 0) }]} label={T.rocTitle} xTicks={6} />
          <div className="legend-row">{curves.map(({ m, r }) => <span key={m}><i style={{ background: MODEL_COLOR[m] }} />{T.models[m]} · AUC {f.dec2(r.auc)}</span>)}</div>
        </Panel>
        <div className="stack">
          <Panel title={T.confTitle} sub={T.confSub}>
            <Confusion c={c} T={T} f={f} />
            <div className="metric-row">
              <span><small>{T.cols.precision}</small><b>{f.pct(c.precision, 0)}</b></span>
              <span><small>{T.cols.recall}</small><b>{f.pct(c.recall, 0)}</b></span>
              <span><small>F1</small><b>{f.dec2(c.f1)}</b></span>
              <span><small>{T.cols.fpr}</small><b>{f.pct(c.fpr, 1)}</b></span>
            </div>
          </Panel>
          <Panel title={T.liftTitle}>
            <div className="lift">{lf.map(l => <div key={l.k}><small>{T.liftCol(f.pct(l.k, 0))}</small><b>{f.pct(l.captured, 0)}</b></div>)}</div>
          </Panel>
        </div>
      </div>
      <div className="grid grid-2">
        <Panel title={T.histTitle} sub={T.histSub}>
          <ScoreHist bins={histogram(B.test, model)} th={th} label={T.histTitle}
            tip={b => <>{f.dec2(b.from)}...{f.dec2(b.from + 0.05)}<br />{T.fraudWord}: {b.fraud}<br />{T.okWord}: {b.ok}</>} />
        </Panel>
        <Panel title={T.benefitTitle} sub={T.benefitSub(f.pct(RECOVERY, 0))}>
          <Curves series={[{ id: 'b', color: MODEL_COLOR[model], strong: true, pts: ben }]} xDomain={[0, 0.1]} yDomain={[Math.min(0, ...ben.map(b => b[1])), Math.max(...ben.map(b => b[1])) * 1.15]}
            xFmt={v => f.pct(v, 0)} yFmt={v => f.axisMoney(v)} xLabel={T.capacity} yLabel={T.mUnit} marks={[{ x: cap, y: c.benefit / 0.3, label: f.money(c.benefit / 0.3) }, ...(best[0] !== cap ? [{ x: best[0], y: best[1] }] : [])]} label={T.benefitTitle} height={260} />
        </Panel>
      </div>
      <Panel title={T.coefTitle[model]} sub={T.coefSub[model]}>
        <SignedBars items={coefItems} fmt={v => (model === 'rules' ? '+' + f.dec2(v) : (v > 0 ? '+' : v < 0 ? '−' : '') + f.dec2(Math.abs(v)))} />
      </Panel>
    </>
  );
}
