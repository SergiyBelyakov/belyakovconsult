import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Select, Button } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { PLACES, BY_ID, OKRUGS, OKRUG_OF, sumAge, carT } from '../world.js';
import { placeSignals, placeServices, SIGNALS, returnPeriod, BASE_NET } from '../model.js';
import { Glyph } from '../TwinMap.jsx';
import { xlsxBlob, saveBlob } from '../../../chart-gallery/src/xlsx.js';


export function PlacePassport({ id, ctx }) {
  const { T, f, placeName, objName, go, notify } = ctx;
  const p = BY_ID.get(id), sv = placeServices(id), sigs = placeSignals(id);
  const k = sumAge(p.age, 0, 17) / p.pop, o = sumAge(p.age, 65, 90) / p.pop, w = 1 - k - o;
  const tt = (car, bus) => <span className="tt"><span><b>{f.min(car)}</b><small>{T.places.car}</small></span>{bus !== undefined && <span><b>{bus == null ? T.places.none : f.min(bus)}</b><small>{T.places.bus}</small></span>}</span>;
  const ts = t => (t < 0.5 ? <span className="tt"><span><b>{T.places.here}</b></span></span> : <span className="tt"><span><b>{f.min(t)}</b><small>{T.places.schoolBus}</small></span></span>);
  const schoolT = s => (s.place === id ? 0 : carT(id, s.place) / 0.8 + 4);
  const fl = p.flood;
  const rows = [
    [T.places.to.primary, tt(p.t.primaryCar, p.t.primaryPt), T.fac[p.fac.primary]],
    [T.places.to.hospital, tt(p.t.hospitalCar, p.t.hospitalPt), T.fac[p.fac.hospital]],
    [T.places.to.cnap, tt(p.t.cnapCar, p.t.cnapPt), T.fac[p.fac.cnap]],
    [T.places.to.school1, ts(schoolT(sv.school.primary)), objName(sv.school.primary)],
    [T.places.to.school2, ts(schoolT(sv.school.basic)), objName(sv.school.basic)],
    [T.places.to.school3, ts(schoolT(sv.school.senior)), objName(sv.school.senior)],
    [T.places.to.kg, sv.kg.o.place === id ? ts(0) : tt(sv.kg.t), objName(sv.kg.o)],
    [T.places.to.fap, sv.fap.o.place === id ? ts(0) : tt(sv.fap.t), objName(sv.fap.o)],
    [T.places.to.point, sv.point.o.place === id ? ts(0) : tt(sv.point.t), objName(sv.point.o)],
    [T.places.to.fire, tt(sv.fire), ''],
  ];
  const exportPlace = () => {
    const L = ctx.lang === 'uk';
    const kv = [
      [L ? 'Населений пункт' : 'Settlement', placeName(p)], [L ? 'Тип' : 'Type', T.kindsPlace[p.kind]], [L ? 'Округ' : 'District', T.okrugName(OKRUG_OF[id])],
      [T.places.est, p.pop], [T.places.reg, p.src.reg], [T.places.idp, p.src.idp], [T.places.decl, p.src.decl], [T.places.meters, p.src.meters],
      [T.places.ages.kids, Math.round(k * 1000) / 10 + '%'], [T.places.ages.old, Math.round(o * 1000) / 10 + '%'],
      ...rows.map(r => [r[0], r[2] || '', '']),
      [T.places.water, Math.round(sv.water.share * 100) + '%'], [T.places.light, Math.round(sv.light * 100) + '%'], [T.places.shelter, sv.shelter],
      [T.places.flood, fl == null ? T.places.never : '+' + fl], [T.places.siren, p.siren ? T.places.sirenYes : T.places.sirenNo],
      ...sigs.map(s => [T.places.sigs, T.sig[s].t]),
    ];
    saveBlob('BC_twin_' + id + '.xlsx', xlsxBlob([{ name: L ? 'Паспорт пункту' : 'Settlement passport', head: [L ? 'Поле' : 'Field', L ? 'Значення' : 'Value'], rows: kv.map(r => [r[0], r[1]]), widths: [40, 60] }]));
    notify(T.method.done);
  };
  return (
    <div className="pp">
      <div className="pp-head">
        <span className="oc-cat">{T.kindsPlace[p.kind]} · {T.okrugName(OKRUG_OF[id])}</span>
        <h2>{placeName(p)}</h2>
        <div className="pp-pop"><b>{f.int(p.pop)}</b><span>{T.places.est}<small>{T.places.range} {f.int(p.range[0])}…{f.int(p.range[1])}</small></span></div>
        <div className="pp-src">
          <span><b>{f.int(p.src.reg)}</b>{T.places.reg} <em className={p.src.reg / p.pop - 1 >= 0.25 ? 'over' : ''}>{f.signedPct(p.src.reg / p.pop - 1)}</em></span>
          <span><b>{f.int(p.src.idp)}</b>{T.places.idp}</span>
          <span><b>{f.int(p.src.decl)}</b>{T.places.decl}</span>
          <span><b>{f.int(p.src.meters)}</b>{T.places.meters}</span>
        </div>
      </div>
      <div className="pp-sec">
        <h4>{T.places.age}</h4>
        <div className="age-bar" role="img" aria-label={T.places.age}>
          <i style={{ width: k * 100 + '%' }} className="ab-k" /><i style={{ width: w * 100 + '%' }} className="ab-w" /><i style={{ width: o * 100 + '%' }} className="ab-o" />
        </div>
        <div className="age-leg"><span><i className="ab-k" />{T.places.ages.kids} <b>{f.pct(k)}</b></span><span><i className="ab-w" />{T.places.ages.work} <b>{f.pct(w)}</b></span><span><i className="ab-o" />{T.places.ages.old} <b>{f.pct(o)}</b></span></div>
      </div>
      <div className="pp-sec">
        <h4>{T.places.services}</h4>
        {sv.objs.length ? (
          <div className="pp-objs">
            {sv.objs.map(ob => (
              <button type="button" key={ob.id} className="pp-obj" onClick={() => go('map', { mode: 'map', sel: { kind: 'obj', id: ob.id } })}>
                <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true"><Glyph o={ob} /></svg>{objName(ob)}
              </button>
            ))}
          </div>
        ) : <p className="muted">{T.places.noServices}</p>}
      </div>
      <div className="pp-sec">
        <h4>{T.places.access}</h4>
        <table className="data-table compact plain pp-tt">
          <tbody>{rows.map(r => <tr key={r[0]}><td>{r[0]}<small>{r[2]}</small></td><td className="num">{r[1]}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="grid grid-2 pp-two">
        <div className="pp-sec">
          <h4>{T.places.infra}</h4>
          <dl className="oc-rows">
            <div><dt>{T.places.water}</dt><dd>{f.pct(sv.water.share)}</dd></div>
            <div><dt>{T.places.light}</dt><dd>{f.pct(sv.light)}</dd></div>
            <div><dt>{T.places.shelter}</dt><dd>{f.int(sv.shelter)}</dd></div>
            <div><dt>{T.places.stop}</dt><dd>{f.km(p.stop)}</dd></div>
          </dl>
        </div>
        <div className="pp-sec">
          <h4>{T.places.risks}</h4>
          <dl className="oc-rows">
            <div><dt>{T.places.flood}</dt><dd className={fl != null && fl <= 6.1 ? 'over' : ''}>{fl == null ? T.places.never : T.places.floodYears(f.dec1(fl), f.int(returnPeriod(fl)))}</dd></div>
            <div><dt>{T.places.siren}</dt><dd className={p.siren ? '' : 'over'}>{p.siren ? T.places.sirenYes : T.places.sirenNo}</dd></div>
            <div><dt>{T.places.gw}</dt><dd>{T.places.gwV(f.dec1(p.gw))}</dd></div>
            <div><dt>{T.places.frost}</dt><dd>{T.places.frostV(p.frost)}</dd></div>
          </dl>
        </div>
      </div>
      <div className="pp-sec">
        <h4>{T.places.sigs}</h4>
        {sigs.length ? (
          <ul className="pp-sigs">
            {sigs.map(s => { const d = SIGNALS.find(x => x.id === s); return (
              <li key={s}><button type="button" onClick={() => go('signals', { sig: s })}><span className={'status ' + d.level}><StatusIcon level={d.level} />{T.sigLevel[d.level]}</span>{T.sig[s].t}</button></li>
            ); })}
          </ul>
        ) : <p className="muted">{T.places.noSigs}</p>}
      </div>
      <div className="pp-actions">
        <Button icon="download" onClick={exportPlace}>{T.places.xlsx}</Button>
        <Button icon="map" onClick={() => go('map', { mode: 'map', sel: { kind: 'place', id } })}>{T.places.openMap}</Button>
      </div>
    </div>
  );
}

export default function Places({ ctx }) {
  const { T, f, place, setPlace, okrug, setOkrug, placeName } = ctx;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(['gap', -1]);
  const cardRef = useRef(null);
  const rows = useMemo(() => PLACES.map(p => ({
    p, id: p.id, name: placeName(p), okrug: T.okrugName(OKRUG_OF[p.id]), est: p.pop, gap: p.src.reg / p.pop - 1, old: p.old,
    amb: p.t.primaryPt == null ? 999 : p.t.primaryPt, flood: p.flood == null ? 99 : p.flood, sig: placeSignals(p.id).length,
  })), [ctx.lang]);
  const list = rows.filter(r => (!okrug || OKRUG_OF[r.id] === okrug) && (!q || r.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => { const [k, d] = sort; const va = a[k], vb = b[k]; return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * d; });
  const first = useRef(true);
  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    el.scrollTop = 0;
    if (first.current) { first.current = false; return; }
    if (window.innerWidth <= 1180) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [place]);
  const head = (k, cls = '') => (
    <th className={cls}><button type="button" className={'th-sort' + (sort[0] === k ? ' on' : '')} onClick={() => setSort([k, sort[0] === k ? -sort[1] : k === 'name' || k === 'okrug' ? 1 : -1])}>{T.places.cols[k]}{sort[0] === k && <Icon name={sort[1] > 0 ? 'arrowUp' : 'arrowDown'} size={11} />}</button></th>
  );
  return (
    <div className="places-layout">
      <Panel className="places-table">
        <div className="toolbar">
          <Select value={okrug || ''} onChange={v => setOkrug(v || null)} label={T.places.filter} options={[{ value: '', label: T.places.all }, ...OKRUGS.map(o => ({ value: o.id, label: T.okrugName(o.id) }))]} />
          <label className="search glass-control"><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={T.places.search} aria-label={T.places.search} /></label>
          <span className="muted small">{T.places.count(list.length)}</span>
        </div>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead><tr>{head('name')}{head('est', 'num')}{head('gap', 'num')}{head('old', 'num')}{head('amb', 'num')}{head('flood', 'num')}{head('sig', 'num')}</tr></thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className={place === r.id ? 'picked' : ''} onClick={() => setPlace(r.id)} tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPlace(r.id))}>
                  <td className="strong">{r.name}<small>{r.okrug}</small></td>
                  <td className="num">{f.int(r.est)}</td>
                  <td className={'num' + (r.gap >= 0.25 ? ' over' : '')}>{f.signedPct(r.gap, 0)}</td>
                  <td className="num">{f.pct(r.old)}</td>
                  <td className={'num' + (r.amb > 45 ? ' over' : '')}>{r.amb >= 999 ? T.places.none : f.min(r.amb)}</td>
                  <td className={'num' + (r.flood <= 6.1 ? ' over' : '')}>{r.flood >= 99 ? '' : '+' + f.dec1(r.flood)}</td>
                  <td className="num">{r.sig || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="panel glass places-card" ref={cardRef}><PlacePassport id={place} ctx={ctx} /></div>
    </div>
  );
}
