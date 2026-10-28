import { DOMAINS, REGIONS, label, pct, statusQuality } from '../data.js';
import { BarList, C, Columns, Heatmap } from '../charts.jsx';
import { Panel, Status } from '../ui.jsx';
import { KpiRow } from './Overview.jsx';

export default function Analytics({ ctx }) {
  const { T, f, lang, m, setFilter, filters } = ctx;
  const months = m.months.map((x, i, a) => ({ ...x, key: x.month, tick: f.month(x.month), mom: i && a[i - 1].vol ? ((x.vol - a[i - 1].vol) / a[i - 1].vol) * 100 : null }));
  const maxVol = Math.max(1, ...m.matrixVol.flatMap(r => r.cells.map(c => c.value || 0)));
  const regionRank = [...m.regions].filter(r => r.rows).sort((a, b) => b.vol - a.vol);
  const changeByRegion = Object.fromEntries(m.regionChange.map(r => [r.id, r.rel]));
  const drivers = [...m.domainChange].sort((a, b) => b.abs - a.abs);
  return (
    <>
      <KpiRow ctx={ctx} />
      <div className="grid grid-main">
        <Panel title={T.monthly} sub={T.monthlySub} className="span-wide">
          <Columns data={months} value={d => d.vol} fmtAxis={f.axis} label={T.monthly}
            labelLast={d => f.compact(d.vol)}
            tip={d => (<><b>{f.monthLong(d.month)}</b><strong>{f.int(d.vol)}</strong><small>{d.mom != null ? f.signed(d.mom) + '% · ' : ''}{T.cols.quality}: {f.pct(d.quality)}</small></>)} />
          <p className="hint">{T.chartHint}</p>
        </Panel>
        <Panel title={T.drivers} sub={T.driversSub}>
          <BarList items={drivers.map(d => ({ id: d.id, name: label(DOMAINS, d.id, lang), value: Math.max(0, d.abs), abs: d.abs, rel: d.rel }))}
            fmt={(v, it) => (it.abs >= 0 ? '+' : '−') + f.compact(Math.abs(it.abs)) + ' · ' + f.signed(it.rel) + '%'}
            picked={filters.domain !== 'all' ? filters.domain : null} onPick={id => setFilter({ domain: filters.domain === id ? 'all' : id })} />
        </Panel>
        <Panel title={T.mix} sub={T.mixSub} className="span-wide">
          <Heatmap corner={T.cols.region} picked={ctx.filters}
            rows={REGIONS.map(r => ({ id: r.id, name: label(REGIONS, r.id, lang) }))}
            cols={DOMAINS.map(d => ({ id: d.id, name: label(DOMAINS, d.id, lang), short: label(DOMAINS, d.id, lang) }))}
            cell={(r, c) => {
              const cell = m.matrixVol.find(x => x.region === r.id).cells.find(x => x.domain === c.id);
              if (cell.value == null) return { text: '—', bg: 'transparent' };
              const a = 0.12 + 0.68 * (cell.value / maxVol);
              return { text: f.compact(cell.value), bg: `rgba(59,130,246,${a.toFixed(2)})`, title: `${r.name} · ${c.name}: ${f.int(cell.value)}` };
            }}
            onCell={(r, c) => setFilter(ctx.filters.region === r.id && ctx.filters.domain === c.id ? { region: 'all', domain: 'all' } : { region: r.id, domain: c.id })} />
        </Panel>
        <Panel title={T.latencyTitle} sub={T.latencySub}>
          <BarList items={m.regions.map(r => ({ id: r.id, name: label(REGIONS, r.id, lang), value: r.latency }))} fmt={f.ms}
            refLine={m.sla.latency} refLabel={'SLA ' + f.ms(m.sla.latency)} max={Math.max(m.sla.latency * 1.15, ...m.regions.map(r => r.latency))}
            color={C.neutral} picked={filters.region !== 'all' ? filters.region : null}
            onPick={id => setFilter({ region: filters.region === id ? 'all' : id })} />
        </Panel>
        <Panel title={T.ranking} className="span-all">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>{T.cols.region}</th><th className="num">{T.cols.processed}</th><th className="num">{T.share}</th><th className="num">{T.growthCol}</th><th className="num">{T.cols.quality}</th><th className="num">{T.perK}</th><th className="num">{T.cols.latency}</th><th>{T.cols.status}</th></tr>
              </thead>
              <tbody>
                {regionRank.map((r, i) => (
                  <tr key={r.id} onClick={() => setFilter({ region: r.id })}>
                    <td className="muted">{i + 1}</td>
                    <td>{label(REGIONS, r.id, lang)}</td>
                    <td className="num">{f.int(r.vol)}</td>
                    <td className="num">{f.pct(pct(r.vol, m.t.vol), 1)}</td>
                    <td className="num">{f.signed(changeByRegion[r.id] || 0)}%</td>
                    <td className="num strong">{f.pct(r.quality)}</td>
                    <td className="num">{f.dec1(r.incRate)}</td>
                    <td className="num">{f.ms(r.latency)}</td>
                    <td><Status level={statusQuality(r.quality, m.target)} T={T} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
