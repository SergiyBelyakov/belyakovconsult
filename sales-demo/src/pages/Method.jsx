// Методика: формули, пісочниця з двома товарами, що важливо знати, файли (Excel з формулами, CSV) і словник
import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { PRODUCTS, CATS, CHANNELS, MANAGERS, MONTHS } from '../model/data.js';
import { toUnits, pvm } from '../model/pvm.js';
import { Bridge } from '../charts.jsx';
import { bridgeSteps, nm, regionName } from '../common.jsx';
import { xlsxBlob, saveBlob, csvBlob } from '../../../chart-gallery/src/xlsx.js';

const SB0 = { qA: 100, pA: 100, uA: 60, qB: 100, pB: 50, uB: 40 };
const SBR = { qA: [40, 200, 5], pA: [80, 130, 1], uA: [45, 85, 1], qB: [40, 260, 5], pB: [38, 66, 1], uB: [28, 56, 1] };

function Sandbox({ T, fmt }) {
  const [v, setV] = useState({ qA: 105, pA: 106, uA: 66, qB: 160, pB: 51, uB: 42 });
  const U = { n: 2, q0: [SB0.qA, SB0.qB], r0: [SB0.qA * SB0.pA, SB0.qB * SB0.pB], c0: [SB0.qA * SB0.uA, SB0.qB * SB0.uB], q1: [v.qA, v.qB], r1: [v.qA * v.pA, v.qB * v.pB], c1: [v.qA * v.uA, v.qB * v.uB] };
  const E = pvm(U);
  const last = useRef({});
  const slide = (k, x) => { const q = Math.round(x / SBR[k][2] / 4); if (last.current[k] !== q) { last.current[k] = q; try { navigator.vibrate && navigator.vibrate(3); } catch { /* */ } } setV(o => ({ ...o, [k]: x })); };
  return (
    <div className="sm-sandbox">
      <div className="sm-sb-ctl">
        {['A', 'B'].map((p, i) => (
          <div key={p} className="sm-sb-item">
            <b>{T.me.sbItems[i]}</b>
            <span className="muted small">{T.me.sbY[0]}: {SB0['q' + p]} × {SB0['p' + p]} · {T.me.sbU.toLowerCase()} {SB0['u' + p]}</span>
            {[['q', T.me.sbQ], ['p', T.me.sbP], ['u', T.me.sbU]].map(([k, lab]) => { const key = k + p, [lo, hi, st] = SBR[key]; return (
              <label key={key} className="sm-lever">
                <span className="sm-lever-top"><b>{lab}</b><em>{v[key]}</em></span>
                <input type="range" min={lo} max={hi} step={st} value={v[key]} onChange={e => slide(key, +e.target.value)} style={{ '--p': (v[key] - lo) / (hi - lo) * 100 + '%' }} />
              </label>
            ); })}
          </div>
        ))}
      </div>
      <Bridge steps={bridgeSteps(E.tot, T)} fmtV={(x, s) => (s ? (x >= 0 ? '+' : '−') + fmt.int(Math.abs(x)) : fmt.int(x))} fmtTick={x => fmt.int(x)} height={300} T={T} zoom={false} base={E.tot.GP0} />
      <p className="note">V = {fmt.dec2(E.tot.V)} · ḡ = {fmt.pct(E.tot.g)} · {T.bp.check}</p>
    </div>
  );
}

export default function Method({ ctx }) {
  const { T, fmt, lang, D, S, params, track, t0, t1 } = ctx;
  const filesRef = useRef(null);
  useEffect(() => { if (params.files && filesRef.current) setTimeout(() => filesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }, [params.files]);
  const per = `${MONTHS[t0]}..${MONTHS[t1]}`;

  const dlXlsx = () => {
    const U = toUnits(D, S, 'pc'), E = pvm(U), X = T.xl, rows = [];
    for (let i = 0; i < U.n; i++) {
      if (!E.cls[i]) continue;
      const r = rows.length + 2, p = PRODUCTS[U.prod[i]];
      const q0 = U.q0[i], r0 = U.r0[i], c0 = U.c0[i], q1 = U.q1[i], r1 = U.r1[i], c1 = U.c1[i], C = q0 > 0 && q1 > 0;
      const f = (fx, v) => ({ f: fx, v: Number.isFinite(v) ? v : 0, s: 'num' });
      rows.push([nm(p, lang), nm(CATS[p.ci], lang), '', nm(CHANNELS[U.ch[i]], lang), '', '', q0, +r0.toFixed(2), +c0.toFixed(2), q1, +r1.toFixed(2), +c1.toFixed(2),
        f(`IF(G${r}>0,H${r}/G${r},0)`, q0 ? r0 / q0 : 0), f(`IF(J${r}>0,K${r}/J${r},0)`, q1 ? r1 / q1 : 0), f(`IF(G${r}>0,I${r}/G${r},0)`, q0 ? c0 / q0 : 0), f(`IF(J${r}>0,L${r}/J${r},0)`, q1 ? c1 / q1 : 0),
        f(`IF(AND(G${r}>0,J${r}>0),(J${r}-G${r})*M${r}*'${X.sum}'!$B$2,0)`, E.vol[i]), f(`IF(AND(G${r}>0,J${r}>0),(J${r}-G${r})*(M${r}-O${r})-Q${r},0)`, E.mix[i]),
        f(`IF(AND(G${r}>0,J${r}>0),J${r}*(N${r}-M${r}),0)`, E.price[i]), f(`IF(AND(G${r}>0,J${r}>0),-J${r}*(P${r}-O${r}),0)`, E.cost[i]),
        f(`IF(AND(G${r}=0,J${r}>0),K${r}-L${r},0)`, E.nw[i]), f(`IF(AND(G${r}>0,J${r}=0),-(H${r}-I${r}),0)`, E.lost[i]),
        f(`IF(AND(G${r}>0,J${r}>0),J${r}*M${r},0)`, C ? q1 * r0 / q0 : 0), f(`IF(AND(G${r}>0,J${r}>0),H${r},0)`, C ? r0 : 0), f(`IF(AND(G${r}>0,J${r}>0),H${r}-I${r},0)`, C ? r0 - c0 : 0)]);
    }
    const n = rows.length + 1, d = `'${X.data}'!`, t = E.tot;
    // аркуш «Міст»: B2 ḡ (на неї посилаються формули обсягу), B3 V, B4 прибуток бази, B5..B10 впливи, B11 прибуток поточного періоду
    const sumRows = [
      [X.g, { f: `SUM(${d}Y2:Y${n})/SUM(${d}X2:X${n})`, v: t.g, s: 'num' }],
      [X.V, { f: `SUM(${d}W2:W${n})/SUM(${d}X2:X${n})`, v: t.V, s: 'num' }],
      [X.gp0, { f: `SUM(${d}H2:H${n})-SUM(${d}I2:I${n})`, v: t.GP0, s: 'num' }],
      ...['vol', 'mix', 'price', 'cost', 'nw', 'lost'].map((e, k) => [T.eff[e], { f: `SUM(${d}${String.fromCharCode(81 + k)}2:${String.fromCharCode(81 + k)}${n})`, v: t[e], s: 'num' }]),
      [X.gp1, { f: `SUM(${d}K2:K${n})-SUM(${d}L2:L${n})`, v: t.GP1, s: 'num' }],
      [X.check, { f: 'B4+SUM(B5:B10)-B11', v: 0, s: 'num' }],
      [T.levelLabel, T.levels.pc], [T.period.label, per],
    ];
    const blob = xlsxBlob([
      { name: X.sum, head: X.rows, rows: sumRows, widths: [36, 22] },
      { name: X.data, head: [...X.head, 'q1·p0', 'r0 (C)', 'gp0 (C)'], rows },
      { name: X.about, head: [X.about, ''], rows: [[X.note, ''], ...T.me.rows.map(r => [r[0] + ' = ' + r[1], r[2]])], wrap: true, widths: [60, 60] },
    ]);
    saveBlob(`sales-margin-pvm-${per.replace('..', '_')}.xlsx`, blob); track('download', { kind: 'xlsx' });
  };
  const dlCsv = () => {
    const X = T.xl, head = [X.head[0], X.head[1], X.head[2], X.head[3], X.head[4], X.head[5], X.head[6], X.head[7], X.head[8], X.head[9], X.head[10], X.head[11]];
    const rows = [];
    for (let i = 0; i < S.n; i++) {
      if (!(S.q0[i] > 0 || S.q1[i] > 0)) continue;
      const cu = D.customers[D.pairs.c[i]], p = PRODUCTS[D.pairs.p[i]];
      rows.push([nm(p, lang), nm(CATS[p.ci], lang), nm(cu, lang), nm(CHANNELS[cu.ci], lang), regionName(cu.region, lang), nm(MANAGERS[cu.mgr], lang), S.q0[i], S.r0[i].toFixed(2), S.c0[i].toFixed(2), S.q1[i], S.r1[i].toFixed(2), S.c1[i].toFixed(2)]);
    }
    saveBlob(`sales-margin-items-${per.replace('..', '_')}.csv`, csvBlob(head, rows)); track('download', { kind: 'csv' });
  };

  return (
    <>
      <div className="grid sm-two">
        <Panel title={T.me.formulas} sub={T.me.formulasSub}>
          <p className="sm-sym">{T.me.sym}</p>
          <table className="sm-formulas"><tbody>{T.me.rows.map(r => <tr key={r[0]}><th>{r[0]}</th><td><code>{r[1]}</code></td><td>{r[2]}</td></tr>)}</tbody></table>
          <p className="note">{T.me.sumNote}</p>
        </Panel>
        <Panel title={T.me.notes}>
          <dl className="glossary">{T.me.noteList.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
      </div>
      <Panel title={T.me.sandbox} sub={T.me.sandboxSub}>
        <Sandbox T={T} fmt={fmt} />
      </Panel>
      <div className="grid sm-two" ref={filesRef}>
        <Panel title={T.me.files} sub={T.me.filesSub}>
          <div className="sm-files">
            <div><Button icon="download" kind="primary" onClick={dlXlsx}>{T.me.dlXlsx}</Button><p>{T.me.dlXlsxHint}</p></div>
            <div><Button icon="download" onClick={dlCsv}>{T.me.dlCsv}</Button><p>{T.me.dlCsvHint}</p></div>
          </div>
        </Panel>
        <Panel title={T.me.glossary}>
          <dl className="glossary">{T.me.gl.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
      </div>
    </>
  );
}
