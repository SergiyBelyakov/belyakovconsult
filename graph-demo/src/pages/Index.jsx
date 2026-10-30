import { useMemo, useState } from 'react';
import { Panel, Kpi, Button } from '../../../dashboard/src/ui.jsx';
import { COLORS, Histogram, LevelPill, Scatter, SegBar, StackedBars } from '../charts.jsx';
import { COMPONENTS, PRESETS, THRESHOLDS, levelOf } from '../model.js';

const QUAD = { x: 35, y: 30 };

export default function IndexPage({ ctx }) {
  const { T, f, base, model, weights, setWeights } = ctx;
  const [all, setAll] = useState(false);
  const preset = Object.entries(PRESETS).find(([, w]) => COMPONENTS.every(k => w[k] === weights[k]))?.[0];
  const values = useMemo(() => base.people.map(p => model.sc(p.id).index), [base, model]);
  const max = Math.max(60, Math.ceil(Math.max(...values) / 10) * 10);
  const points = useMemo(() => base.people.map((p, i) => {
    const s = model.sc(p.id);
    const j = ((i * 37) % 17) / 17 - .5, k = ((i * 53) % 13) / 13 - .5;
    return { id: p.id, x: Math.min(99.5, s.need + j * 1.6), y: Math.max(.5, Math.min(99.5, p.support + k * 2.6)), color: COLORS.level[s.level], s, p };
  }), [base, model]);
  const quadN = points.filter(p => p.s.need >= QUAD.x && p.p.support <= QUAD.y).length;
  const xMax = Math.max(60, Math.ceil(Math.max(...points.map(p => p.x)) / 10) * 10 + 10);
  const mix = useMemo(() => {
    const avgOf = list => Object.fromEntries(COMPONENTS.map(k => [k, list.reduce((a, p) => a + model.sc(p.id).contrib[k], 0) / Math.max(1, list.length)]));
    const hi = base.people.filter(p => ['high', 'critical'].includes(model.sc(p.id).level));
    return [
      { id: 'hi', name: T.mixHigh, parts: avgOf(hi) },
      { id: 'all', name: T.mixAll, parts: avgOf(base.people) },
    ];
  }, [base, model, T]);
  const list = all ? model.ranked : model.ranked.slice(0, 20);
  const lc = model.levelCounts;

  return (
    <>
      <div className="grid grid-index">
        <Panel title={T.weightsTitle} sub={T.weightsSub} className="weights-panel">
          <div className="preset-row" role="group" aria-label={T.presetsLabel}>
            {Object.keys(PRESETS).map(id => (
              <button type="button" key={id} className={'preset' + (preset === id ? ' on' : '')} aria-pressed={preset === id} onClick={() => setWeights(PRESETS[id])}>{T.presets[id]}</button>
            ))}
          </div>
          {COMPONENTS.map(k => (
            <label key={k} className="slider weight">
              <span><span className="w-name"><i style={{ background: COLORS[k] }} />{T.comp[k]}</span><b>{f.pct(model.w[k])}</b></span>
              <input type="range" min="0" max="60" step="5" value={weights[k]} onChange={e => setWeights({ ...weights, [k]: Number(e.target.value) })} aria-label={T.comp[k]} />
              <small>{T.compHint[k]}</small>
            </label>
          ))}
          <p className="hint">{T.weightsNote}</p>
        </Panel>
        <div className="stack">
          <div className="kpi-grid kpi-3">
            <Kpi icon="gauge" label={T.kpi.avg} value={f.int(model.avg)} context={T.kpi.avgCtx} />
            <Kpi icon="target" label={T.kpi.high} value={f.int(lc.high + lc.critical)} unit={' · ' + f.pct((lc.high + lc.critical) / base.people.length)} context={T.kpi.criticalCtx.replace('{n}', f.int(lc.critical))} accent />
            <Kpi icon="reset" label={T.kpi.changed} value={f.int(model.changed)} context={model.changed ? T.kpi.changedCtx.replace('{up}', f.int(model.up)).replace('{down}', f.int(model.down)) : T.kpi.changedNone} />
          </div>
          <Panel title={T.histTitle} sub={T.histSub.replace('{a}', THRESHOLDS[0]).replace('{b}', THRESHOLDS[1]).replace('{c}', THRESHOLDS[2])}>
            <Histogram values={values} max={max} thresholds={THRESHOLDS} levelOf={levelOf} fmt={f.int} label={T.histTitle}
              thresholdLabel={t => T.levels[levelOf(t)]}
              tip={b => (<><b>{T.indexShort} {f.int(b.x0)} {T.toWord} {f.int(b.x1)}</b><strong>{f.int(b.n)}</strong><small>{T.peopleWord(b.n)}</small></>)} />
          </Panel>
        </div>
      </div>

      <div className="grid grid-main">
        <Panel title={T.scatterTitle} sub={T.scatterSub}>
          <Scatter points={points} quad={QUAD} quadLabel={T.quadLabel.replace('{n}', f.int(quadN))} xLabel={T.axisNeed} yLabel={T.axisSupport} fmt={f.int}
            label={T.scatterTitle} xMax={xMax} onPick={id => ctx.go('network', { id })}
            tip={pt => (<><b>{ctx.terrName(pt.p.territory)} · {ctx.sexAge(pt.p)}</b><strong>{pt.id}</strong><small>{T.axisNeed} {f.int(pt.s.need)} · {T.axisSupport} {f.int(pt.p.support)}</small><small>{T.levels[pt.s.level]} · {T.indexShort} {f.int(pt.s.index)}</small></>)} />
          <p className="hint">{T.scatterHint}</p>
        </Panel>
        <Panel title={T.levelsTitle} sub={T.levelsSub}>
          <div className="level-bars">
            {['critical', 'high', 'moderate', 'low'].map(l => {
              const base0 = base.people.filter(p => model.sc(p.id).baseLevel === l).length;
              return (
                <div key={l} className="level-bar">
                  <span className="level-bar-name"><i className={'lv lv-' + l} />{T.levels[l]}</span>
                  <span className="bar-track"><i style={{ width: (lc[l] / base.people.length) * 100 + '%', background: COLORS.level[l] }} /><s style={{ left: (base0 / base.people.length) * 100 + '%' }} title={T.baseMark} /></span>
                  <b>{f.int(lc[l])}</b>
                  <small className={lc[l] > base0 ? 'up' : lc[l] < base0 ? 'down' : ''}>{lc[l] === base0 ? '·' : (lc[l] > base0 ? '+' : '−') + f.int(Math.abs(lc[l] - base0))}</small>
                </div>
              );
            })}
          </div>
          <p className="hint">{T.levelsHint}</p>
          <div className="mix-block">
            <h4>{T.mixTitle}</h4>
            <p className="muted small">{T.mixSub}</p>
            <StackedBars rows={mix} keys={COMPONENTS} colors={COLORS} names={T.comp} fmt={v => f.dec1(v)} label={T.mixTitle} />
            <div className="legend-inline">{COMPONENTS.map(k => <span key={k}><i style={{ background: COLORS[k] }} />{T.compShort[k]}</span>)}</div>
          </div>
        </Panel>
      </div>

      <Panel title={T.priorityTitle} sub={T.prioritySub} className="flat-panel"
        aside={<div className="legend-inline">{COMPONENTS.map(k => <span key={k}><i style={{ background: COLORS[k] }} />{T.compShort[k]}</span>)}</div>}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th className="num">#</th><th>{T.cols.id}</th><th>{T.cols.terr}</th><th className="num">{T.cols.age}</th><th>{T.cols.level}</th><th className="num">{T.cols.index}</th><th>{T.cols.contrib}</th><th>{T.cols.signalsList}</th></tr></thead>
            <tbody>
              {list.map(p => {
                const s = model.sc(p.id);
                const sigs = model.signalsOf.get(p.id);
                return (
                  <tr key={p.id} tabIndex="0" onClick={() => ctx.go('network', { id: p.id })} onKeyDown={e => { if (e.key === 'Enter') ctx.go('network', { id: p.id }); }}>
                    <td className="num muted">{s.rank}</td>
                    <td className="strong">{p.id}{p.dupOf && <span className="reason">{T.dupShort}</span>}</td>
                    <td>{ctx.terrName(p.territory)}</td>
                    <td className="num">{ctx.sexAge(p)}</td>
                    <td><LevelPill level={s.level} T={T} />{s.level !== s.baseLevel && <span className="was">{T.wasLevel.replace('{l}', T.levels[s.baseLevel].toLowerCase())}</span>}</td>
                    <td className="num strong">{f.int(s.index)}</td>
                    <td><SegBar parts={s.contrib} keys={COMPONENTS} colors={COLORS} max={80} width={130} /></td>
                    <td className="sig-cell">{sigs.slice(0, 2).map(id => <span key={id} className="reason">{T.signals[id].short}</span>)}{sigs.length > 2 && <span className="reason">+{sigs.length - 2}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>{T.priorityFoot}</span>
          <div className="table-actions"><Button onClick={() => setAll(!all)}>{all ? T.showLess : T.showAll.replace('{n}', f.int(base.people.length))}</Button></div>
        </div>
      </Panel>
    </>
  );
}
