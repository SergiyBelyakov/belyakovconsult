import { DOMAINS, REGIONS, SLA, label, statusQuality } from '../data.js';
import { C, Columns, Heatmap, SmallMultiples } from '../charts.jsx';
import { Icon } from '../icons.jsx';
import { Kpi, Panel, Status } from '../ui.jsx';

export const TINT = { healthy: 'rgba(16,185,129,.20)', warning: 'rgba(255,176,32,.24)', critical: 'rgba(255,107,107,.30)' };

export function TargetControl({ ctx }) {
  const { T, f, target, setTarget } = ctx;
  return (
    <label className="target-control glass-control">
      <span>{T.targetLabel}</span>
      <input type="range" min="95" max="99" step="0.1" value={target} onChange={e => setTarget(Number(e.target.value))} aria-valuetext={f.pct(target, 1)} />
      <b>{f.pct(target, 1)}</b>
    </label>
  );
}

export function reasonsOf(r, target) {
  const out = [];
  if (r.quality < target) out.push('quality');
  if (r.availability < SLA.availability) out.push('availability');
  if (r.latency > SLA.latency) out.push('latency');
  return out;
}

export default function Quality({ ctx }) {
  const { T, f, lang, m, setFilter, setModal } = ctx;
  const months = m.monthIds;
  const series = m.domainMonths.map(d => ({ id: d.id, name: label(DOMAINS, d.id, lang), color: C.series[d.id], values: d.months.map(x => (x.rows ? x.quality : null)) }));
  const all = series.flatMap(s => s.values).filter(v => v != null);
  const lo = Math.floor(Math.min(m.target - 1, ...all) * 2) / 2, hi = Math.ceil(Math.max(m.target + 0.5, ...all) * 2) / 2;
  const worst = m.worstCell;
  const inc = m.months.map(x => ({ ...x, key: x.month, tick: f.month(x.month) }));
  return (
    <>
      <div className="toolbar"><TargetControl ctx={ctx} /></div>
      <div className="kpi-grid">
        <Kpi icon="shield" label={T.kpi.quality} value={f.dec2(m.t.quality)} unit="%" delta={m.delta.quality} deltaText={f.signed(m.delta.quality, 2) + ' ' + T.kpi.pp}
          context={T.kpi.ofTarget + ' ' + f.pct(m.target, 1)} spark={m.months.map(x => x.quality)} onClick={() => ctx.openMetric('quality')} accent />
        <Kpi icon="x" label={T.qkpi.invalid} value={f.compact(m.t.invalid)} context={f.pct(100 - m.t.quality) + ' ' + T.records} spark={m.months.map(x => x.invalid)} onClick={() => ctx.openMetric('quality')} />
        <Kpi icon="warning" label={T.qkpi.below} value={f.int(m.below.length)} context={f.pct(m.belowShare, 1) + ' · ' + T.kpi.ofTarget + ' ' + f.pct(m.target, 1)} />
        <Kpi icon="pulse" label={T.qkpi.worst} value={worst ? f.dec2(worst.value) : '—'} unit={worst ? '%' : ''}
          context={worst ? label(REGIONS, worst.region, lang) + ' · ' + label(DOMAINS, worst.domain, lang) : ''}
          onClick={() => worst && setFilter({ region: worst.region, domain: worst.domain })} />
      </div>
      <div className="grid grid-main">
        <Panel title={T.heat} sub={T.heatSub} className="span-wide">
          <Heatmap corner={T.cols.region} picked={ctx.filters}
            rows={REGIONS.map(r => ({ id: r.id, name: label(REGIONS, r.id, lang) }))}
            cols={DOMAINS.map(d => ({ id: d.id, name: label(DOMAINS, d.id, lang), short: label(DOMAINS, d.id, lang) }))}
            cell={(r, c) => {
              const cell = m.matrixQuality.find(x => x.region === r.id).cells.find(x => x.domain === c.id);
              if (cell.value == null) return { text: '—', bg: 'transparent' };
              const lvl = statusQuality(cell.value, m.target);
              return { text: f.dec2(cell.value), bg: TINT[lvl], level: lvl, title: `${r.name} · ${c.name}: ${f.pct(cell.value)} · ${T.status[lvl]}` };
            }}
            onCell={(r, c) => setFilter(ctx.filters.region === r.id && ctx.filters.domain === c.id ? { region: 'all', domain: 'all' } : { region: r.id, domain: c.id })} />
          <div className="heat-legend">
            {['healthy', 'warning', 'critical'].map(l => <span key={l}><i style={{ background: TINT[l], borderColor: C.status[l] }} /><Status level={l} T={T} /></span>)}
            <span className="muted">{T.pdf.legendStatus.replace('{target}', f.dec1(m.target))}</span>
          </div>
        </Panel>
        <Panel title={T.incTrend} sub={T.incTrendSub}>
          <Columns data={inc} value={d => d.inc} fmtAxis={f.int} label={T.incTrend} color={C.neutral} height={230}
            tip={d => (<><b>{f.monthLong(d.month)}</b><strong>{f.int(d.inc)}</strong><small>{f.dec1(d.incRate)} {T.kpi.perK}</small></>)} />
        </Panel>
        <Panel title={T.qTrend} sub={T.qTrendSub} className="span-all">
          <SmallMultiples series={series} months={months} tick={f.month} domain={[lo, hi]} refLine={m.target} fmt={v => f.pct(v)} fmtScale={v => f.pct(v, 1)}
            tip={(s, mo, v) => (<><b>{s.name}</b><strong>{f.pct(v)}</strong><small>{f.monthLong(mo)}</small></>)} />
        </Panel>
        <Panel title={T.exceptions} sub={T.exceptionsSub} className="span-all" aside={<span className="count-pill">{f.int(m.exceptions.length)}</span>}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{T.cols.month}</th><th>{T.cols.region}</th><th>{T.cols.domain}</th><th className="num">{T.cols.quality}</th><th className="num">{T.gap}</th><th className="num">{T.cols.availability}</th><th className="num">{T.cols.latency}</th><th className="num">{T.cols.incidents}</th><th>{T.reason}</th></tr>
              </thead>
              <tbody>
                {m.exceptions.slice(0, 12).map(r => (
                  <tr key={r.month + r.region + r.domain} onClick={() => setModal({ type: 'row', row: r })}>
                    <td>{f.monthYear(r.month)}</td>
                    <td>{label(REGIONS, r.region, lang)}</td>
                    <td><span className="dot" style={{ background: C.series[r.domain] }} />{label(DOMAINS, r.domain, lang)}</td>
                    <td className="num strong">{f.pct(r.quality)}</td>
                    <td className="num">{f.signed(r.quality - m.target, 2)} {T.kpi.pp}</td>
                    <td className="num">{f.pct(r.availability)}</td>
                    <td className="num">{f.ms(r.latency)}</td>
                    <td className="num">{f.int(r.incidents)}</td>
                    <td>{reasonsOf(r, m.target).map(k => <span key={k} className={'reason reason-' + k}><Icon name={k === 'quality' ? 'shield' : k === 'availability' ? 'pulse' : 'clock'} size={12} />{T.reasons[k]}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!m.exceptions.length && <p className="empty-line">{T.noData}</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
