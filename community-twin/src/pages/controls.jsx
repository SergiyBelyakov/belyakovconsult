// Спільні дрібні елементи сторінок двійника: статус, картка об'єкта з реєстру, перемикачі шарів.
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Button } from '../../../dashboard/src/ui.jsx';
import { STATUS_ICON, CAT_COLOR } from '../charts.jsx';
import { BY_ID, OBJ_BY, BLD_BY, SRC_BY, SHELTERS, POINTS, WATER, OKRUG_OF, floodAt, isStale } from '../world.js';
import { STAGE100, returnPeriod } from '../model.js';
import { DOM_OF, Glyph } from '../TwinMap.jsx';

export function StatusTag({ s, T, quiet }) {
  return <span className={'st-tag st-' + s + (quiet ? ' quiet' : '')}><Icon name={STATUS_ICON[s]} size={12} />{T.status[s]}</span>;
}
export const moduleHref = (m, onSite, lang) => {
  const p = (lang === 'en' ? '/en' : '') + '/cases/' + (m === 'transport' ? 'transport-accessibility' : 'community-terrain') + '/';
  return onSite ? p : 'https://www.belyakovconsult.com' + p;
};
export const unitOf = (x, T) => (x.fmt === 'pct' ? '' : T.units[x.unit] || '');

// Перемикачі шарів карти
export function LayerChips({ T, layers, setLayers, ids, counts = {} }) {
  const toggle = id => { const n = new Set(layers); if (n.has(id)) n.delete(id); else n.add(id); setLayers(n); };
  return (
    <div className="layer-chips" role="group" aria-label={T.map.layers}>
      {ids.map(id => (
        <button type="button" key={id} className={'chip lchip' + (layers.has(id) ? ' on' : '')} aria-pressed={layers.has(id)} onClick={() => toggle(id)}>
          {CAT_COLOR[id] ? <i className="lc-sw" style={{ background: CAT_COLOR[id] }} /> : <i className={'lc-sw lc-' + id} />}
          {T.layer[id]}{counts[id] != null && <b>{counts[id]}</b>}
        </button>
      ))}
    </div>
  );
}

const SRC_OF = { school: 'edu', kg: 'edu', health: 'health', shelter: 'shelter', point: 'points', admin: 'gis', water: 'water', culture: 'property' };

// Проблеми з даними та станом об'єкта
export function objIssues(o, T, f) {
  const out = [], b = BLD_BY.get(o.id);
  if (b) {
    if (!b.rights) out.push(T.map.iss.noRights);
    if (!b.cad) out.push(T.map.iss.noCad);
    if (!b.audit) out.push(T.map.iss.noAudit);
    if (b.areaDoc !== b.area) out.push(T.map.iss.areaDoc(f.int(b.area) + ' ' + T.m2, f.int(b.areaDoc) + ' ' + T.m2));
  }
  if (o.cat === 'school') { if (!o.shelterCap) out.push(T.map.iss.noShelter); else if (o.shelterCap - o.staff < o.pupils) out.push(T.map.iss.smallShelter); if (o.occ > 1) out.push(T.map.iss.over); }
  if (o.cat === 'health' && o.kind === 'fap' && !o.staff) out.push(T.map.iss.vacant);
  if (o.cat === 'point' && o.broken) out.push(T.map.iss.broken);
  if (o.cat === 'water') { if (!o.gen) out.push(T.map.iss.noGen); if (o.nitr) out.push(T.map.iss.nitr); }
  if (o.cat === 'shelter') { if (o.state === 'not') out.push(T.map.iss.notReady); const src = SRC_BY.get('shelter'); if (isStale(src)) out.push(T.map.iss.stale(f.date(src.updated))); }
  const s = floodAt(o.x, o.y);
  if (s > 0 && s <= STAGE100 && o.cat !== 'culture') out.push(T.map.iss.flood(f.dec1(s)));
  return out;
}

// Картка об'єкта з реєстру
export function ObjCard({ id, ctx, onPick, compact }) {
  const { T, f, objName, placeName, go } = ctx;
  const o = OBJ_BY.get(id);
  if (!o) return null;
  const p = BY_ID.get(o.place), b = BLD_BY.get(o.id), F = T.map.f;
  const yn = v => (v ? T.yes : T.no);
  const rows = [[F.place, placeName(p)], [F.okrug, T.okrugName(OKRUG_OF[o.place])]];
  if (o.cat === 'school') rows.push([F.type, T.schoolType[o.type]], [F.cap, f.int(o.cap)], [F.pupils, f.int(o.pupils)], [F.occ, f.pct(o.occ)], [F.classes, f.int(o.classes)], [F.perPupil, f.thou(o.perPupil)], [F.bus, f.int(o.bus)], [F.shelter, o.shelterCap ? f.int(o.shelterCap) + ' · ' + T.shelterState[o.shelterState] : T.none]);
  if (o.cat === 'kg') rows.push([F.cap, f.int(o.cap)], [F.kids, f.int(o.kids)], [F.occ, f.pct(o.occ)], [F.queue, f.int(o.queue)]);
  if (o.cat === 'health') {
    if (o.kind === 'hospital') rows.push([F.beds, f.int(o.beds)]);
    if (o.kind === 'amb') rows.push([F.doctors, f.int(o.doctors)], [F.decl, f.int(o.decl)], [F.perDoc, f.int(o.perDoc)], [F.cap, f.int(o.cap)]);
    if (o.kind === 'fap') rows.push([F.staff, o.staff ? T.yes : T.map.iss.vacant], [F.served, f.int(o.served)]);
  }
  if (o.cat === 'admin') rows.push([F.kind, T.adminKind[o.kind]], [F.services, f.int(o.services)]);
  if (o.cat === 'shelter') rows.push([F.kind, T.shelterKind[o.kind]], [F.cap2, f.int(o.cap)], [F.state, T.shelterState[o.state]], [F.host, T.host[o.host]], [F.inclusive, yn(o.inclusive)]);
  if (o.cat === 'point') rows.push([F.host, objName(OBJ_BY.get(o.host))], [F.kw, T.map.kw(o.kw)], [F.hours, T.map.hrs(o.hours)], [F.starlink, yn(o.starlink)], [F.heat, yn(o.heat)]);
  if (o.cat === 'water') { const served = WATER.filter(w => w.pump === o.id).reduce((a, w) => a + BY_ID.get(w.place).pop * w.share, 0); rows.push([F.wells, f.int(o.wells)], [F.gen, yn(o.gen)], [F.nitr, yn(o.nitr)], [F.served, f.int(served)]); }
  if (o.cat === 'culture') rows.push([F.kind, T.cultKind[o.kind]]);
  if (o.built) rows.push([F.built, String(o.built)]);
  if (b) rows.push([F.area, f.int(b.area) + ' ' + T.m2], [F.heatType, T.heatKind[b.heat]], [F.kwh, T.map.kwh(b.kwh)], [F.energy, f.thou(b.cost)], [F.audit, b.audit ? String(b.audit) : T.none]);
  const fl = floodAt(o.x, o.y);
  if (fl > 0 && fl < Infinity) rows.push([F.flood, T.scen.flood.m(f.dec1(fl)) + ' · ' + T.scen.flood.years(f.int(returnPeriod(fl)))]);
  const iss = objIssues(o, T, f);
  const linked = [];
  if (o.cat === 'school' && o.shelter) linked.push(o.shelter);
  const pt = POINTS.find(x => x.host === o.id); if (pt) linked.push(pt.id);
  if (o.cat === 'shelter' && o.school) linked.push(o.school);
  if (o.cat === 'point') linked.push(o.host);
  const src = SRC_BY.get(SRC_OF[o.cat]);
  return (
    <div className={'obj-card' + (compact ? ' compact' : '')}>
      <div className="oc-head">
        <svg width="26" height="26" viewBox="-13 -13 26 26" aria-hidden="true"><Glyph o={o} /></svg>
        <div><span className="oc-cat" style={{ color: CAT_COLOR[DOM_OF[o.cat]] }}>{T.catName[o.cat]}</span><strong>{objName(o)}</strong></div>
      </div>
      <dl className="oc-rows">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className={'oc-issues' + (iss.length ? '' : ' none')}>
        <h5>{T.map.issues}</h5>
        {iss.length ? <ul>{iss.map(t => <li key={t}><Icon name="warning" size={13} />{t}</li>)}</ul> : <p><Icon name="check" size={13} />{T.map.noIssues}</p>}
      </div>
      {linked.length > 0 && (
        <div className="oc-linked">
          <h5>{T.map.linked}</h5>
          {linked.map(l => <button type="button" key={l} className="link-btn" onClick={() => onPick && onPick(l)}><Icon name="link" size={13} />{objName(OBJ_BY.get(l))}</button>)}
        </div>
      )}
      <p className="oc-src">{T.map.source}: {src ? T.src[src.id] + ' · ' + f.date(src.updated) : T.src.gis}</p>
      {!compact && <Button icon="home" onClick={() => go('places', { place: o.place })}>{T.map.placePass}</Button>}
    </div>
  );
}
