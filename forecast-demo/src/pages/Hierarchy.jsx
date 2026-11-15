// Узгоджений прогноз за рівнями: область → громади → послуги. Базові прогнози кожного вузла не сходяться,
// методи узгодження (знизу вгору, OLS, WLS, MinT) роблять суми нижчих рівнів рівними вищим.
import { useEffect, useMemo, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { ForecastChart, Legend } from '../charts.jsx';
import { Bars, UP, DOWN } from '../exparts.jsx';
import { Formula } from '../common.jsx';
import { makeFmt, futureDates } from '../format.js';
import { hierarchy } from '../data.js';
import { hierRun, hierAccuracy, METHODS } from '../engine/hier.js';

export default function HierPage({ ctx }) {
  const { T, track, openLead, navigate } = ctx, Q = T.hr;
  const H = useMemo(() => hierarchy(), []);
  const fmt = useMemo(() => makeFmt(T, 0), [T]);
  const [method, setMethod] = useState('mint');
  const [node, setNode] = useState('total');
  const [focus, setFocus] = useState(null);
  const [res, setRes] = useState(null);
  useEffect(() => { const t = setTimeout(() => setRes({ run: hierRun(H, H.h), acc: hierAccuracy(H) }), 40); return () => clearTimeout(t); }, [H]);
  const fdates = useMemo(() => futureDates(H.dates[H.dates.length - 1], H.h, H.freq), [H]);
  if (!res) return <Panel title={Q.loading}><div className="fc-lb-ph"><i /><i /><i /></div></Panel>;

  const idx = Object.fromEntries(H.nodes.map((x, i) => [x.id, i]));
  const fc = res.run.fc[method], base = res.run.fc.base, sum = v => v.reduce((a, b) => a + b, 0);
  const val = id => sum(fc[idx[id]]);
  const kids = id => H.nodes.filter(x => x.parent === id);
  const check = id => { const s = kids(id).reduce((a, c) => a + val(c.id), 0), p = val(id); return { s, p, gap: s - p, ok: Math.abs(s - p) < 0.5 }; };
  const name = x => (x.level === 0 ? Q.region : x.level === 1 ? Q.comm[x.id] : Q.serv[x.service]);
  const pick = id => { setNode(id); track('hier_node', { id }); };
  const setM = m => { setMethod(m); track('hier_method', { m }); };
  const cur = H.nodes[idx[node]];
  const n = H.dates.length, i0 = idx[node];
  const band = res.run.band[i0].map((b, k) => { const d = fc[i0][k] - base[i0][k]; return { ...b, mean: fc[i0][k], lo80: b.lo80 + d, hi80: b.hi80 + d, lo95: b.lo95 + d, hi95: b.hi95 + d }; });
  const overlays = method === 'base' ? [] : [{ id: 'base', label: Q.methods.base[0], color: '#94A3B8', from: n, values: base[i0] }];
  // розбіжність по місяцях: сума громад мінус прогноз області
  const gapM = fc[0].map((v, k) => H.nodes.filter(x => x.level === 1).reduce((a, x) => a + fc[idx[x.id]][k], 0) - v);
  const gapC = Math.max(...H.nodes.filter(x => x.level === 1).map(x => Math.max(...fc[idx[x.id]].map((v, k) => Math.abs(kids(x.id).reduce((a, c) => a + fc[idx[c.id]][k], 0) - v)))));
  const coherent = gapM.every(v => Math.abs(v) < 0.5) && gapC < 0.5;
  const acc = res.acc.acc, best = [0, 1, 2].map(lv => METHODS.reduce((b, m) => (acc[m][lv] < acc[b][lv] ? m : b), METHODS[0]));
  const Check = ({ id }) => {
    const c = check(id);
    return (
      <span className={'fc-hr-check ' + (c.ok ? 'ok' : 'bad')} title={Q.checkTip}>
        <Icon name={c.ok ? 'check' : 'warning'} size={12} />
        {c.ok ? Q.sumOk(fmt.val(c.s)) : Q.sumBad(fmt.val(c.s), (c.gap > 0 ? '+' : '−') + fmt.val(Math.abs(c.gap)))}
      </span>
    );
  };

  return (
    <>
      <Panel title={Q.methodTitle} sub={Q.methodSub} className="fc-hr-methods">
        <div className="fc-seg" role="radiogroup" aria-label={Q.methodTitle}>
          {METHODS.map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? 'on' : ''} onClick={() => setM(m)}>{Q.methods[m][0]}</button>)}
        </div>
        <p className="fc-sc-about">{Q.methods[method][1]}</p>
      </Panel>

      <Panel title={Q.treeTitle} sub={Q.treeSub(fmt.dateLong(fdates[0], 'M'), fmt.dateLong(fdates[fdates.length - 1], 'M'))} className="fc-hr-tree-panel">
        <div className="fc-hr-tree">
          <button type="button" className={'fc-hr-node lvl0' + (node === 'total' ? ' on' : '')} onClick={() => pick('total')}>
            <span className="fc-hr-name">{Q.region}</span><b>{fmt.val(val('total'))}</b><Check id="total" />
          </button>
          <div className="fc-hr-comms">
            {kids('total').map(c => (
              <div key={c.id} className="fc-hr-comm">
                <button type="button" className={'fc-hr-node lvl1' + (node === c.id ? ' on' : '')} onClick={() => pick(c.id)}>
                  <span className="fc-hr-name">{Q.comm[c.id]}</span><b>{fmt.val(val(c.id))}</b><Check id={c.id} />
                </button>
                <div className="fc-hr-servs">
                  {kids(c.id).map(sv => (
                    <button key={sv.id} type="button" className={'fc-hr-node lvl2' + (node === sv.id ? ' on' : '')} onClick={() => pick(sv.id)}>
                      <span className="fc-hr-name">{Q.serv[sv.service]}</span>
                      <span className="fc-hr-bar"><i style={{ width: (100 * val(sv.id)) / Math.max(...kids(c.id).map(x => val(x.id))) + '%' }} /></span>
                      <b>{fmt.val(val(sv.id))}</b>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className={'fc-hr-verdict ' + (coherent ? 'ok' : 'bad')}><Icon name={coherent ? 'check' : 'warning'} size={16} /><span>{coherent ? Q.verdictOk : Q.verdictBad}</span></p>
      </Panel>

      <div className="grid fc-two">
        <Panel title={`${name(cur)} · ${Q.methods[method][0]}`} sub={Q.nodeSub} className="fc-chart-panel">
          <ForecastChart dates={[...H.dates, ...fdates]} y={cur.y} fitted={null} fc={band} overlays={overlays} show={{ fitted: false, test: false }} freq="M" fmt={fmt} T={T}
            from={Math.max(0, n - 36)} height={260} fcLabel={Q.methods[method][0]} label={name(cur)} focus={focus} />
          <Legend focus={focus} setFocus={setFocus} items={[
            { key: 'actual', cls: 'actual', label: T.legend.actual },
            { key: 'fc', cls: 'fc', label: Q.methods[method][0] },
            { key: 'band', cls: 'band', label: T.legend.b80 },
            ...overlays.map(o => ({ key: o.id, color: o.color, label: o.label })),
          ]} />
        </Panel>
        <Panel title={Q.gapTitle} sub={Q.gapSub}>
          <Bars values={gapM} colors={gapM.map(v => (v >= 0 ? UP : DOWN))} labels={fdates.map(d => fmt.monShort(d))} xlab={i => fmt.dateLong(fdates[i], 'M')} height={170} fmt={v => (Math.abs(v) < 1e-9 ? '0' : (v > 0 ? '+' : '−') + fmt.int(Math.abs(v)))} label={Q.gapTitle} />
          <p className={'fc-hr-verdict small ' + (coherent ? 'ok' : 'bad')}>
            <Icon name={coherent ? 'check' : 'info'} size={15} />
            <span>{coherent ? Q.gapOk : Q.gapBad(fmt.val(Math.max(...gapM.map(Math.abs))), fmt.val(gapC))}</span>
          </p>
        </Panel>
      </div>

      <div className="grid fc-wide">
        <Panel title={Q.accTitle} sub={Q.accSub(res.acc.cut ? fmt.dateLong(H.dates[res.acc.cut], 'M') : '')}>
          <div className="table-scroll">
            <table className="data-table plain fc-hr-acc">
              <thead><tr><th>{Q.level}</th>{METHODS.map(m => <th key={m} className={'num' + (m === method ? ' on' : '')}>{Q.methods[m][0]}</th>)}</tr></thead>
              <tbody>{[0, 1, 2].map(lv => (
                <tr key={lv}>
                  <td className="strong">{Q.levels[lv]}</td>
                  {METHODS.map(m => <td key={m} className={'num' + (m === method ? ' on' : '') + (best[lv] === m ? ' best' : '')}>{fmt.dec2(acc[m][lv])}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="ex-note">{Q.accNote(res.run.lam != null ? fmt.dec2(res.run.lam) : '·')}</p>
        </Panel>
        <Panel title={T.howTitle}>
          <ol className="fc-steps cols wrapfx">
            {Q.how.map(([text, fx], i) => <li key={i}><span className="how-n">{i + 1}</span><div><p>{text}</p>{fx && <Formula s={fx} />}</div></li>)}
          </ol>
        </Panel>
      </div>

      <Panel className="cta-card flat-panel">
        <h3>{Q.ctaTitle}</h3>
        <p>{Q.ctaText}</p>
        <div className="fc-cta-actions">
          <Button kind="primary" icon="mail" onClick={() => openLead('hier')}>{T.ctaLong}</Button>
          <Button icon="sliders" onClick={() => navigate('scenario')}>{T.nav.scenario}</Button>
        </div>
      </Panel>
    </>
  );
}
