import { useMemo, useState } from 'react';
import { IND_BY, PARTNERS, REG } from '../data.js';
import { regionStats, hromadaStats } from '../model.js';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { Status } from '../parts.jsx';
import { UAMap, NeedReach, SEQ } from '../charts.jsx';

const BINS = { coverage: [0.06, 0.1, 0.14, 0.18], progress: [0.8, 0.9, 0.95, 1], perPerson: [120, 160, 200, 260] };
const colorOf = (m, v) => { const b = BINS[m]; let i = 0; while (i < b.length && v >= b[i]) i++; return SEQ[i]; };

export default function Regions({ ctx }) {
  const { T, f, k, region, setRegion, openInd, code, regionName, partnerName } = ctx;
  const [metric, setMetric] = useState('coverage');
  const RS = useMemo(() => regionStats(k), [k]);
  const H = useMemo(() => hromadaStats(k, region), [k, region]);
  const x = RS.by[region];
  const fmtM = (m, v) => (v == null ? '·' : m === 'coverage' ? f.pct(v * 100, 1) : m === 'progress' ? f.pct(v * 100) : f.eur(v));
  const legendLabels = m => (m === 'coverage' ? ['<6%', '≥18%'] : m === 'progress' ? ['<80%', '≥100%'] : ['<€120', '≥€260']);
  const sorted = RS.list.slice().sort((a, b) => a.coverage - b.coverage);
  const hs = H.slice().sort((a, b) => a.coverage - b.coverage);

  return (
    <>
      <div className="grid grid-2 me-reg">
        <Panel title={T.mapTitle} sub={T.mapSub}>
          <div className="panel-ctl"><Segmented value={metric} onChange={setMetric} label={T.reg.metric} options={Object.keys(BINS).map(m => ({ value: m, label: T.reg.metrics[m] }))} /></div>
          <UAMap
            values={Object.fromEntries(RS.list.map(r => [r.id, { color: colorOf(metric, r[metric]), label: fmtM(metric, r[metric]) }]))}
            marks={Object.fromEntries(RS.list.filter(r => r.relCov < 0.6).map(r => [r.id, 1]))}
            pick={region} onPick={setRegion} name={regionName} label={T.mapTitle}
            tipRows={id => { const r = RS.by[id]; return <><strong>{fmtM(metric, r[metric])}</strong><small>{T.reg.unique}: {f.int(r.unique)} / {f.int(r.pin)}</small></>; }}
            legend={<div className="map-legend"><span>{T.reg.metrics[metric]}</span><small>{legendLabels(metric)[0]}</small>{SEQ.map(c => <i key={c} style={{ background: c }} />)}<small>{legendLabels(metric)[1]}</small><span className="ml-mark"><b />{T.reg.white}</span><span className="ml-no"><b />{T.reg.legendNo}</span></div>}
          />
        </Panel>
        <Panel title={regionName(region)} sub={T.reg.pop + ': ' + f.int(x.pop) + ' · ' + T.reg.hromadas + ': ' + REG[region].hromadas.length}
          aside={x.relCov < 0.6 ? <Status level="critical" T={T} text={T.reg.white} /> : null}>
          <div className="reg-figs">
            <div><span>{T.reg.pin}</span><b>{f.int(x.pin)}</b></div>
            <div><span>{T.reg.unique}</span><b>{f.int(x.unique)}</b></div>
            <div className={x.relCov < 0.6 ? 'bad' : ''}><span>{T.reg.coverage}</span><b>{f.pct(x.coverage * 100, 1)}</b><small>{T.reg.median}: {f.pct(RS.median * 100, 1)}</small></div>
            <div><span>{T.reg.progress}</span><b>{x.progress == null ? '·' : f.pct(x.progress * 100)}</b></div>
            <div><span>{T.reg.spend}</span><b>{f.eur(x.spend)}</b></div>
            <div><span>{T.reg.perPerson}</span><b>{x.perPerson ? f.eur(x.perPerson) : '·'}</b></div>
          </div>
          <div className="reg-partners">
            <span>{T.reg.partners}</span>
            {x.partners.map(p => <i key={p} className="p-chip" style={{ '--c': PARTNERS[p].color }} title={partnerName(p)}><b>{p}</b>{T.sector[PARTNERS[p].sector]}</i>)}
          </div>
          <h4 className="reg-sub">{T.reg.behind}</h4>
          {x.crit.length ? (
            <ul className="reg-crit">
              {x.crit.map(id => <li key={id}><button type="button" className="link-btn" onClick={() => openInd(id)}><span className="code-tag">{code(IND_BY[id])}</span>{T.ind[id].s}<Icon name="arrowRight" size={13} /></button></li>)}
            </ul>
          ) : <p className="muted small">{T.reg.none}</p>}
        </Panel>
      </div>

      <Panel title={T.reg.needVsReach} sub={T.reg.needSub}>
        <NeedReach rows={sorted.map(r => ({ id: r.id, name: regionName(r.id, true), pin: r.pin, unique: r.unique, coverage: r.coverage, flag: r.relCov < 0.6 ? T.reg.white : null }))}
          fmt={f.int} pctFmt={v => f.pct(v * 100, 1)} picked={region} onPick={setRegion} median={RS.median} medianLabel={T.reg.median} label={T.reg.needVsReach} />
      </Panel>

      <Panel title={T.reg.hTable + ': ' + regionName(region)} sub={T.reg.hNote}>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead><tr><th>{T.reg.hCode}</th><th className="num">{T.reg.hPop}</th><th className="num">{T.reg.hPin}</th><th className="num">{T.reg.hReach}</th><th>{T.reg.hCov}</th><th>{T.reg.hParts}</th></tr></thead>
            <tbody>
              {hs.map(h => (
                <tr key={h.id}>
                  <td className="mono">{h.id}</td>
                  <td className="num">{f.int(h.pop)}</td>
                  <td className="num">{f.int(h.pin)}</td>
                  <td className="num">{f.int(h.unique)}</td>
                  <td><span className="cov-cell"><i style={{ width: Math.min(100, (h.coverage / 0.3) * 100) + '%', background: colorOf('coverage', h.coverage) }} />{f.pct(h.coverage * 100, 1)}</span></td>
                  <td>{h.partners.map(p => <i key={p} className="p-dot" style={{ '--c': PARTNERS[p].color }} title={partnerName(p)}>{p}</i>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
