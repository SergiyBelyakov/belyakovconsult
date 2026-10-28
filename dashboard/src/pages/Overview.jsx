import { useState } from 'react';
import { DOMAINS, REGIONS, label, pct, statusQuality } from '../data.js';
import { AreaTrend, BarList, C, Donut } from '../charts.jsx';
import { Icon } from '../icons.jsx';
import { Button, Kpi, Panel, Status } from '../ui.jsx';

export function KpiRow({ ctx }) {
  const { T, f, m, openMetric } = ctx;
  const { t, months, delta } = m;
  return (
    <div className="kpi-grid">
      <Kpi icon="layers" label={T.kpi.processed} value={f.compact(t.vol)} delta={delta.vol} deltaText={f.signed(delta.vol) + '%'}
        context={T.kpi.fromStart} spark={months.map(x => x.vol)} onClick={() => openMetric('processed')} />
      <Kpi icon="shield" label={T.kpi.quality} value={f.dec2(t.quality)} unit="%" delta={delta.quality} deltaText={f.signed(delta.quality, 2) + ' ' + T.kpi.pp}
        context={T.kpi.ofTarget + ' ' + f.pct(m.target, 1)} spark={months.map(x => x.quality)} onClick={() => openMetric('quality')} accent />
      <Kpi icon="pulse" label={T.kpi.availability} value={f.dec2(t.avail)} unit="%" delta={delta.avail} deltaText={f.signed(delta.avail, 2) + ' ' + T.kpi.pp}
        context={T.kpi.sla + ' ' + f.pct(m.sla.availability, 1)} spark={months.map(x => x.avail)} onClick={() => openMetric('availability')} />
      <Kpi icon="warning" label={T.kpi.incidents} value={f.int(t.inc)} delta={delta.inc} deltaText={f.signed(delta.inc) + '%'} goodWhenUp={false}
        context={f.dec1(t.incRate) + ' ' + T.kpi.perK} spark={months.map(x => x.inc)} onClick={() => openMetric('incidents')} />
    </div>
  );
}

export function Signals({ ctx, limit = 4 }) {
  const { T, f, lang, m, go } = ctx;
  const items = m.signals.slice(0, limit);
  const icon = { worstSegment: 'shield', qualityDrop: 'warning', availability: 'pulse', bestDomain: 'check', growth: 'chart', topRegion: 'globe' };
  const target = { worstSegment: 'quality', qualityDrop: 'quality', availability: 'sources', bestDomain: 'quality', growth: 'analytics', topRegion: 'analytics' };
  return (
    <Panel title={T.signals} sub={T.signalsSub} className="span-all">
      <div className="signal-list">
        {items.map((s, i) => {
          const [title, text] = T.signalsText[s.kind]({
            r: s.region && label(REGIONS, s.region, lang), d: s.domain && label(DOMAINS, s.domain, lang),
            v: s.kind === 'growth' ? f.signed(s.value) + '%' : s.kind === 'topRegion' ? f.compact(s.value) : f.pct(s.value),
            avg: s.avg != null ? f.pct(s.avg) : '', m: s.month && f.monthYear(s.month), inc: s.incidents, lat: s.latency != null ? f.ms(s.latency) : '',
            from: s.from && f.monthYear(s.from), to: s.to && f.monthYear(s.to), share: s.share != null ? f.pct(s.share, 1) : '',
          });
          return (
            <button type="button" key={i} className="signal" onClick={() => go(target[s.kind], { region: s.region, domain: s.domain })}>
              <span className={'signal-icon lvl-' + s.level}><Icon name={icon[s.kind]} size={16} /></span>
              <span className="signal-body"><strong>{title}</strong><small>{text}</small></span>
              {s.level !== 'info' && <Status level={s.level} T={T} />}
              <Icon name="arrowRight" size={14} className="signal-go" />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function Explorer({ ctx, limit = 12 }) {
  const { T, f, lang, m, setModal } = ctx;
  const [sort, setSort] = useState({ k: 'processed', desc: true });
  const [all, setAll] = useState(false);
  const rows = m.rows.map(r => ({ ...r, quality: pct(r.valid, r.processed) }));
  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.k], y = b[sort.k];
    return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * (sort.desc ? -1 : 1);
  });
  const shown = all ? sorted : sorted.slice(0, limit);
  const cols = [['month', T.cols.month], ['region', T.cols.region], ['domain', T.cols.domain], ['processed', T.cols.processed, 'num'], ['quality', T.cols.quality, 'num'], ['incidents', T.cols.incidents, 'num'], ['availability', T.cols.availability, 'num'], ['status', T.cols.status]];
  return (
    <Panel title={T.explorer} sub={T.explorerSub} className="span-all" aside={<span className="count-pill">{f.int(rows.length)} {T.records}</span>}>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map(([k, name, cls]) => (
                <th key={k} className={cls} aria-sort={sort.k === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                  {k === 'status' ? name : (
                    <button type="button" onClick={() => setSort({ k, desc: sort.k === k ? !sort.desc : true })}>
                      {name}{sort.k === k ? (sort.desc ? ' ↓' : ' ↑') : ''}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.month + r.region + r.domain} onClick={() => setModal({ type: 'row', row: r })} tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setModal({ type: 'row', row: r })}>
                <td>{f.monthYear(r.month)}</td>
                <td>{label(REGIONS, r.region, lang)}</td>
                <td><span className="dot" style={{ background: C.series[r.domain] }} />{label(DOMAINS, r.domain, lang)}</td>
                <td className="num">{f.int(r.processed)}</td>
                <td className="num strong">{f.pct(r.quality)}</td>
                <td className="num">{f.int(r.incidents)}</td>
                <td className="num">{f.pct(r.availability)}</td>
                <td><Status level={statusQuality(r.quality, m.target)} T={T} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>{T.csvHint}</span>
        <span className="table-actions">
          {rows.length > limit && <Button onClick={() => setAll(!all)}>{all ? T.showLess : T.showAll + ' (' + f.int(rows.length) + ')'}</Button>}
          <Button icon="download" onClick={ctx.exportCSV}>{T.csvExport}</Button>
        </span>
      </div>
    </Panel>
  );
}

export default function Overview({ ctx }) {
  const { T, f, lang, m, filters, setFilter } = ctx;
  const months = m.months.map(x => ({ ...x, key: x.month, tick: f.month(x.month) }));
  const dom = m.domains.map(d => ({ id: d.id, name: label(DOMAINS, d.id, lang), value: d.vol, color: C.series[d.id], quality: d.quality }));
  const maxQ = 100;
  return (
    <>
      <KpiRow ctx={ctx} />
      <div className="grid grid-main">
        <Panel title={T.trend} sub={T.trendSub} className="span-wide">
          <AreaTrend data={months} value={d => d.vol} fmtAxis={f.axis} label={T.trend}
            highlight={months.length - 1} valueLabel={d => f.compact(d.vol)}
            tip={d => (<><b>{f.monthLong(d.month)}</b><strong>{f.int(d.vol)}</strong><small>{T.validSeries}: {f.int(d.valid)} · {f.pct(d.quality)}</small></>)} />
          <p className="hint">{T.chartHint}</p>
        </Panel>
        <Panel title={T.domains} sub={T.domainsSub}>
          <div className="donut-layout">
            <Donut items={dom} label={T.domains} picked={filters.domain !== 'all' ? filters.domain : null}
              onPick={id => setFilter({ domain: filters.domain === id ? 'all' : id })}
              center={a => (<><span>{a ? a.name : T.total}</span><strong>{f.compact(a ? a.value : m.t.vol)}</strong><small>{a ? f.pct(pct(a.value, m.t.vol), 1) : T.records}</small></>)} />
            <div className="legend-list">
              {dom.map(d => (
                <button type="button" key={d.id} className={'legend-row' + (filters.domain === d.id ? ' picked' : '')} onClick={() => setFilter({ domain: filters.domain === d.id ? 'all' : d.id })}>
                  <i style={{ background: d.color }} /><span>{d.name}</span><b>{f.pct(pct(d.value, m.t.vol), 1)}</b>
                </button>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title={T.regions} sub={T.regionsSub} className="span-wide">
          <BarList items={m.regions.map(r => ({ id: r.id, name: label(REGIONS, r.id, lang), value: r.vol }))} fmt={f.compact}
            picked={filters.region !== 'all' ? filters.region : null} onPick={id => setFilter({ region: filters.region === id ? 'all' : id })} />
        </Panel>
        <Panel title={T.qualityByDomain} sub={T.qualityByDomainSub}>
          <div className="qbars">
            {m.domains.map(d => {
              const lvl = statusQuality(d.quality, m.target);
              const lo = 94;
              const w = v => Math.max(0, Math.min(100, ((v - lo) / (maxQ - lo)) * 100));
              return (
                <button type="button" key={d.id} className="qbar" onClick={() => ctx.go('quality', { domain: d.id })}>
                  <span className="qbar-name"><i style={{ background: C.series[d.id] }} />{label(DOMAINS, d.id, lang)}</span>
                  <b>{d.rows ? f.pct(d.quality) : '—'}</b>
                  <span className="qbar-track"><s style={{ left: w(m.target) + '%' }} />{d.rows > 0 && <i className={'lvl-' + lvl} style={{ left: w(d.quality) + '%' }} />}</span>
                </button>
              );
            })}
          </div>
          <div className="qscale"><span>{f.pct(94, 0)}</span><span>{T.pdf.legendStatus.replace('{target}', f.dec1(m.target))}</span><span>{f.pct(100, 0)}</span></div>
        </Panel>
        <Signals ctx={ctx} />
        <Explorer ctx={ctx} />
      </div>
    </>
  );
}
