import { DOMAINS, REGIONS, SOURCES, SLA, label, statusAvailability, totals } from '../data.js';
import { C, Heatmap, SmallMultiples, Spark } from '../charts.jsx';
import { Icon } from '../icons.jsx';
import { Panel, Status } from '../ui.jsx';
import { TINT } from './Quality.jsx';

export default function Sources({ ctx }) {
  const { T, f, lang, m, setFilter } = ctx;
  const lastMonth = m.monthIds[m.monthIds.length - 1];
  const series = m.domainMonths.map(d => ({ id: d.id, name: label(DOMAINS, d.id, lang), color: C.series[d.id], values: d.months.map(x => (x.rows ? x.avail : null)) }));
  const all = series.flatMap(s => s.values).filter(v => v != null);
  const lo = Math.floor(Math.min(SLA.availability - 0.5, ...all) * 2) / 2;
  return (
    <>
      <Panel title={T.sourceCards} sub={T.sourceCardsSub} className="flat-panel">
        <div className="source-grid">
          {m.domains.map(d => {
            const src = SOURCES[d.id];
            const lvl = d.rows ? statusAvailability(d.avail) : 'info';
            const last = totals(m.rows.filter(r => r.domain === d.id && r.month === lastMonth));
            return (
              <article key={d.id} className="source-card glass">
                <header>
                  <span className="source-key" style={{ borderColor: C.series[d.id] }}><i style={{ background: C.series[d.id] }} />{d.short}</span>
                  {d.rows > 0 && <Status level={lvl} T={T} />}
                </header>
                <h4>{label(DOMAINS, d.id, lang)}</h4>
                <p className="source-system">{src.system[lang]}</p>
                <dl>
                  <div><dt>{T.cols.availability}</dt><dd>{d.rows ? f.pct(d.avail) : '—'}</dd></div>
                  <div><dt>{T.cols.latency}</dt><dd>{d.rows ? f.ms(d.latency) : '—'}</dd></div>
                  <div><dt>{T.cols.quality}</dt><dd>{d.rows ? f.pct(d.quality) : '—'}</dd></div>
                  <div><dt>{T.cols.processed}</dt><dd>{f.compact(d.vol)}</dd></div>
                </dl>
                <Spark values={m.domainMonths.find(x => x.id === d.id).months.map(x => x.avail).filter(Boolean)} w={180} h={34} />
                <ul className="source-meta">
                  <li><Icon name="plug" size={14} />{T.modes[src.mode]}</li>
                  <li><Icon name="clock" size={14} />{T.frequency}: {T.freqs[src.freq]}</li>
                  <li><Icon name="user" size={14} />{src.owner[lang]}</li>
                  {last.rows > 0 && <li><Icon name="database" size={14} />{T.lastLoad}: {f.monthYear(lastMonth)}</li>}
                </ul>
                <button type="button" className="link-btn" onClick={() => setFilter({ domain: d.id })}>{T.details} <Icon name="arrowRight" size={13} /></button>
              </article>
            );
          })}
        </div>
      </Panel>
      <div className="grid grid-main">
        <Panel title={T.availTrend} sub={T.availTrendSub} className="span-all">
          <SmallMultiples series={series} months={m.monthIds} tick={f.month} domain={[lo, 100]} refLine={SLA.availability} fmt={v => f.pct(v)} fmtScale={v => f.pct(v, 1)}
            tip={(s, mo, v) => (<><b>{s.name}</b><strong>{f.pct(v)}</strong><small>{f.monthLong(mo)}</small></>)} />
        </Panel>
        <Panel title={T.latencyMatrix} sub={T.latencyMatrixSub} className="span-all">
          <Heatmap corner={T.cols.region} picked={ctx.filters}
            rows={REGIONS.map(r => ({ id: r.id, name: label(REGIONS, r.id, lang) }))}
            cols={DOMAINS.map(d => ({ id: d.id, name: label(DOMAINS, d.id, lang), short: label(DOMAINS, d.id, lang) }))}
            cell={(r, c) => {
              const cell = m.matrixLatency.find(x => x.region === r.id).cells.find(x => x.domain === c.id);
              if (cell.value == null) return { text: '—', bg: 'transparent' };
              const lvl = cell.value > SLA.latency ? 'critical' : cell.value > SLA.latency * 0.8 ? 'warning' : 'healthy';
              return { text: f.int(cell.value), bg: lvl === 'healthy' ? 'rgba(148,163,184,.10)' : TINT[lvl], level: lvl, title: `${r.name} · ${c.name}: ${f.ms(cell.value)}` };
            }}
            onCell={(r, c) => setFilter(ctx.filters.region === r.id && ctx.filters.domain === c.id ? { region: 'all', domain: 'all' } : { region: r.id, domain: c.id })} />
          <p className="hint">SLA {f.ms(SLA.latency)} · {T.kpi.sla} {T.cols.availability.toLowerCase()} {f.pct(SLA.availability, 1)}</p>
        </Panel>
      </div>
    </>
  );
}
