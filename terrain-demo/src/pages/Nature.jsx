// Природні умови громади: шари на 3D-моделі, клімат за місяцями, роза вітрів, ґрунти, земний покрив,
// форми рельєфу й експозиція, ерозія, ґрунтові води, повторюваність паводків, умови в населених пунктах.
import { useMemo, useState } from 'react';
import { Panel, Segmented } from '../../../dashboard/src/ui.jsx';
import { useWidth, C, BarList } from '../../../dashboard/src/charts.jsx';
import { geo, CLIMATE, T0, P0, HTC, SOILS, COVERS, MORPHS, returnPeriod } from '../geo.js';
import { layerGeo, GEO_GROUPS, MORPH_HEX, EROSION_HEX, GW_HEX } from '../layers.js';
import { SceneBox, GeoLegend, scenePlaces, fmtChance } from './controls.jsx';

const TEMP_C = '#e18344', PREC_C = '#57afe0';

export default function Nature({ ctx }) {
  const { T, f, T3, layer, setLayer, focus, setFocus, placeName, go } = ctx;
  const G = geo(T3), S = G.summary;
  const group = GEO_GROUPS.find(([, l]) => l.includes(layer))[0];
  const colors = useMemo(() => layerGeo(T3, layer, focus), [layer, focus]);
  const places = useMemo(() => scenePlaces(ctx), [ctx.lang]);
  const show = (id, i) => {
    setLayer(id); setFocus(i);
    const box = document.querySelector('.scene-box');
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const pick = id => { setLayer(id); setFocus(null); };
  return (
    <>
      <SceneBox ctx={ctx} colors={colors} places={places} legend={<GeoLegend ctx={ctx} id={layer} focus={focus} setFocus={setFocus} />} note={T.layerNote[layer]}>
        <div className="layer-pick">
          <Segmented value={group} onChange={g => pick(GEO_GROUPS.find(([id]) => id === g)[1][0])} label={T.layerGroup} options={GEO_GROUPS.map(([id]) => ({ value: id, label: T.groups[id] }))} />
          <Segmented value={layer} onChange={pick} label={T.layerName} options={GEO_GROUPS.find(([id]) => id === group)[1].map(id => ({ value: id, label: T.layers[id] }))} />
        </div>
      </SceneBox>

      <div className="kpi-mini-row wide glass">
        <div><span>{T.nat.kpi.temp}</span><b>{f.dec1(T0)} °C</b><small>{T.nat.kpi.tempRange(f.dec1(G.range.TEMP[0]), f.dec1(G.range.TEMP[1]))}</small></div>
        <div><span>{T.nat.kpi.prec}</span><b>{f.int(P0)} {T.mm}</b><small>{T.nat.kpi.range(f.int(G.range.PREC[0]), f.int(G.range.PREC[1]))}</small></div>
        <div><span>{T.nat.kpi.frost}</span><b>{f.int(CLIMATE.frostFree)} {T.days}</b><small>{T.nat.kpi.range(f.int(G.range.FFD[0]), f.int(G.range.FFD[1]))}</small></div>
        <div><span>{T.nat.kpi.active}</span><b>{f.int(CLIMATE.activeSum)} °C</b><small>{T.nat.kpi.activeNote}</small></div>
        <div><span>{T.nat.kpi.insol}</span><b>{f.int(CLIMATE.insol)}</b><small>{T.kwh} · {T.nat.kpi.sunshine(f.int(CLIMATE.sunshine))}</small></div>
        <div><span>{T.nat.kpi.htc}</span><b>{f.dec1(HTC)}</b><small>{T.nat.kpi.htcNote}</small></div>
      </div>

      <div className="grid grid-2">
        <Panel title={T.nat.climoTitle} sub={T.nat.climoSub}>
          <Climograph T={T} f={f} />
        </Panel>
        <Panel title={T.nat.windTitle} sub={T.nat.windSub(f.int(CLIMATE.wind.calm))}>
          <Rose T={T} f={f} values={CLIMATE.wind.freq} extra={CLIMATE.wind.speed} center={T.nat.calm(f.int(CLIMATE.wind.calm))} tip={(i, v, s) => T.nat.windTip(T.compass[i], f.int(v), f.dec1(s))} label={T.nat.windTitle} highlight />
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={T.nat.soilTitle} sub={T.nat.soilSub(f.int(S.erosion.arableKm2))}>
          <div className="table-scroll">
            <table className="data-table compact plain soil-table">
              <thead><tr><th>{T.nat.cols.soil}</th><th>{T.nat.cols.share}</th><th className="num">{T.nat.cols.humus}</th><th className="num">pH</th><th className="num">{T.nat.cols.bon}</th></tr></thead>
              <tbody>
                {SOILS.map((s, i) => (
                  <tr key={s.id} tabIndex="0" className={layer === 'soil' && focus === i ? 'picked' : ''} onClick={() => show('soil', i)} onKeyDown={e => { if (e.key === 'Enter') show('soil', i); }}>
                    <td className="strong"><i className="hud-sw" style={{ background: s.color }} />{T.soils[s.id]}<small className="soil-tex">{T.textures[s.id]}</small></td>
                    <td><span className="share-bar"><i style={{ width: Math.max(2, S.soil[i].share * 100 / 0.35) + '%' }} /></span><small>{f.pct(S.soil[i].share, 0)}</small></td>
                    <td className="num">{f.dec1(s.humus)}%</td>
                    <td className="num">{f.dec1(s.ph)}</td>
                    <td className="num">{s.bon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small panel-note">{T.nat.soilNote}</p>
        </Panel>
        <Panel title={T.nat.coverTitle} sub={T.nat.coverSub}>
          <BarList items={COVERS.map((c, i) => ({ id: c.id, name: T.covers[c.id], value: S.cover[i].share, color: c.color }))} fmt={v => f.pct(v, 0) + ' · ' + f.int(v * S.area) + ' ' + T.km2}
            picked={layer === 'cover' && focus != null ? COVERS[focus].id : null} onPick={id => show('cover', COVERS.findIndex(c => c.id === id))} />
          <p className="muted small panel-note">{T.nat.coverNote}</p>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={T.nat.morphTitle} sub={T.nat.morphSub}>
          <div className="morph-wrap">
            <BarList items={MORPHS.map((m, i) => ({ id: m, name: T.morphs[m], value: S.morph[i].share, color: MORPH_HEX[i] }))} fmt={v => f.pct(v, 0)}
              picked={layer === 'morph' && focus != null ? MORPHS[focus] : null} onPick={id => show('morph', MORPHS.indexOf(id))} />
            <div className="aspect-box">
              <span className="muted small">{T.nat.aspectTitle}</span>
              <Rose T={T} f={f} values={S.aspect.slice(0, 8).map(v => v * 100)} center={T.nat.flatShare(f.pct(S.aspect[8], 0))} tip={(i, v) => T.nat.aspectTip(T.compass[i], f.int(v))} label={T.nat.aspectTitle} size={190} color="#cc9967" />
            </div>
          </div>
        </Panel>
        <Panel title={T.nat.erosTitle} sub={T.nat.erosSub(f.int(S.erosion.arableKm2))}>
          <div className="kpi-mini-row flat">
            <div><span>{T.nat.erosMean}</span><b>{f.dec1(S.erosion.mean)} {T.tha}</b></div>
            <div><span>{T.nat.erosTotal}</span><b>{f.int(S.erosion.total / 1000)} {T.kt}</b></div>
            <div><span>{T.nat.erosOver}</span><b>{f.pct(S.erosion.classes[2].share + S.erosion.classes[3].share, 0)}</b></div>
          </div>
          <BarList items={EROSION_HEX.map((h, i) => ({ id: 'e' + i, name: T.classNames.erosion[i], value: S.erosion.classes[i].share, color: h }))} fmt={(v, it) => f.pct(v, 0) + ' · ' + f.int(S.erosion.classes[+it.id.slice(1)].km2) + ' ' + T.km2}
            picked={layer === 'erosion' && focus != null ? 'e' + focus : null} onPick={id => show('erosion', +id.slice(1))} />
          <p className="muted small panel-note">{T.nat.erosNote}</p>
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title={T.nat.waterTitle} sub={T.nat.waterSub}>
          <div className="kpi-mini-row flat">
            <div><span>{T.nat.riverLen}</span><b>{f.int(S.water.riverKm)} {T.km}</b></div>
            <div><span>{T.nat.streamLen}</span><b>{f.int(S.water.streamKm)} {T.km}</b></div>
            <div><span>{T.nat.density}</span><b>{f.dec2(S.water.density)}</b><small>{T.km}/{T.km2}</small></div>
          </div>
          <span className="muted small">{T.legendTitle.gw}</span>
          <BarList items={GW_HEX.map((h, i) => ({ id: 'g' + i, name: T.classNames.gw[i], value: S.gw[i].share, color: h }))} fmt={v => f.pct(v, 0)}
            picked={layer === 'gw' && focus != null ? 'g' + focus : null} onPick={id => show('gw', +id.slice(1))} />
          <p className="muted small panel-note">{T.nat.gwNote}</p>
        </Panel>
        <Panel title={T.nat.recTitle} sub={T.nat.recSub}>
          <div className="table-scroll">
            <table className="data-table compact plain">
              <thead><tr><th className="num">{T.nat.cols.stage}</th><th>{T.nat.cols.period}</th><th className="num">{T.nat.cols.area}</th><th className="num">{T.nat.cols.villages}</th><th className="num">{T.nat.cols.people}</th></tr></thead>
              <tbody>
                {S.recurrence.map(r => (
                  <tr key={r.stage} tabIndex="0" onClick={() => go('flood', { stage: r.stage })} onKeyDown={e => { if (e.key === 'Enter') go('flood', { stage: r.stage }); }}>
                    <td className="num strong">+{f.int(r.stage)} {T.m}</td>
                    <td>{T.oncePer(r.period)} <small className="muted">({fmtChance(f, r.chance)})</small></td>
                    <td className="num">{f.int(r.area)} {T.km2}</td>
                    <td className="num">{f.int(r.places)}{r.isolated ? <small className="muted"> +{r.isolated}</small> : null}</td>
                    <td className="num">{f.int(r.pop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small panel-note">{T.nat.recNote}</p>
        </Panel>
      </div>

      <Panel title={T.nat.placesTitle} sub={T.nat.placesSub}>
        <PlacesTable ctx={ctx} rows={S.places} />
      </Panel>
    </>
  );
}

function PlacesTable({ ctx, rows }) {
  const { T, f, placeName } = ctx;
  const [sort, setSort] = useState('pop');
  const key = { pop: r => -r.p.pop, h: r => -r.h, gw: r => r.gw, ffd: r => -r.ffd, eros: r => -r.eros };
  const list = [...rows].sort((a, b) => key[sort](a) - key[sort](b));
  return (
    <>
      <div className="toolbar">
        <Segmented value={sort} onChange={setSort} label={T.nat.sortBy} options={['pop', 'h', 'gw', 'ffd', 'eros'].map(id => ({ value: id, label: T.nat.sorts[id] }))} />
      </div>
      <div className="table-scroll short">
        <table className="data-table compact plain">
          <thead><tr><th>{T.cols.place}</th><th className="num">{T.cols.pop}</th><th className="num">{T.cols.h}</th><th>{T.nat.cols.soil}</th><th className="num">{T.nat.cols.gw}</th><th className="num">{T.nat.cols.ffd}</th><th className="num">{T.nat.cols.eros}</th><th>{T.nat.cols.flood}</th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.p.id}>
                <td className="strong">{placeName(r.p)}</td>
                <td className="num">{f.int(r.p.pop)}</td>
                <td className="num">{f.int(r.h)} {T.m}</td>
                <td><i className="hud-sw" style={{ background: SOILS[r.soil].color }} />{T.soils[SOILS[r.soil].id]}</td>
                <td className={'num' + (r.gw < 1.5 ? ' over' : '')}>{f.dec1(r.gw)} {T.m}</td>
                <td className="num">{f.int(r.ffd)}</td>
                <td className={'num' + (r.eros > 4 ? ' over' : '')}>{f.dec1(r.eros)}</td>
                <td>{r.stage != null ? T.oncePer(returnPeriod(Math.max(r.stage, 0.2))) : <span className="muted">{T.nat.safe}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Клімат за місяцями: температура і опади на двох вирівняних графіках зі спільною віссю місяців (без двох шкал на одному)
function Climograph({ T, f }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 40, R = 10, H1 = 132, H2 = 104, GAP = 30, TOP = 22, B = 22, H = TOP + H1 + GAP + H2 + B;
  const band = (W - L - R) / 12, x = i => L + band * (i + 0.5);
  const tLo = -8, tHi = 24, y1 = v => TOP + H1 * (1 - (v - tLo) / (tHi - tLo));
  const pHi = 100, y2 = v => TOP + H1 + GAP + H2 * (1 - v / pHi);
  const line = CLIMATE.t.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y1(v).toFixed(1)).join(' ');
  const bw = Math.min(22, band * 0.6);
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={T.nat.climoTitle}>
        <text x={L} y={13} className="axis axis-title">{T.nat.tempAxis}</text>
        {[-5, 0, 10, 20].map(v => <g key={v}><line x1={L} x2={W - R} y1={y1(v)} y2={y1(v)} stroke={v === 0 ? 'rgba(255,255,255,.22)' : C.grid} /><text x={L - 6} y={y1(v) + 4} className="axis" textAnchor="end">{v}</text></g>)}
        <path d={line} fill="none" stroke={TEMP_C} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {CLIMATE.t.map((v, i) => <circle key={i} cx={x(i)} cy={y1(v)} r={hi === i ? 5 : 3.2} fill={hi === i ? C.ruby : TEMP_C} stroke={C.surface} strokeWidth="2" />)}
        <text x={L} y={TOP + H1 + GAP - 9} className="axis axis-title">{T.nat.precAxis}</text>
        {[0, 50, 100].map(v => <g key={v}><line x1={L} x2={W - R} y1={y2(v)} y2={y2(v)} stroke={C.grid} /><text x={L - 6} y={y2(v) + 4} className="axis" textAnchor="end">{v}</text></g>)}
        {CLIMATE.p.map((v, i) => {
          const top = y2(v), base = y2(0), r = Math.min(4, (base - top) / 2), x0 = x(i) - bw / 2, x1 = x(i) + bw / 2;
          return <path key={i} d={`M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${base} Z`} fill={hi === i ? C.ruby : PREC_C} opacity={hi == null || hi === i ? 1 : 0.6} />;
        })}
        {T.monthsShort.map((m, i) => (band >= 26 || i % 2 === 0) && <text key={m} x={x(i)} y={H - 6} className="axis" textAnchor="middle">{m}</text>)}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={TOP} y2={H - B} stroke="rgba(244,246,248,.3)" />}
        {CLIMATE.t.map((_, i) => <rect key={i} x={x(i) - band / 2} y={TOP} width={band} height={H - TOP - B + 14} fill="transparent" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)} />)}
      </svg>
      {hi != null && <div className={'chart-tip' + (x(hi) < W * 0.3 ? ' tip-l' : x(hi) > W * 0.7 ? ' tip-r' : '')} style={{ left: x(hi), top: 0 }} role="status"><b>{T.monthsLong[hi]}</b><span>{f.dec1(CLIMATE.t[hi])} °C · {f.int(CLIMATE.p[hi])} {T.mm}</span></div>}
    </div>
  );
}

// Роза: 8 секторів (румбів), довжина пропорційна значенню. Для вітру і для експозиції схилів
function Rose({ T, f, values, extra, center, tip, label, size = 230, color = C.primary, highlight }) {
  const [hi, setHi] = useState(null);
  const cx = size / 2, R = size / 2 - 26, max = Math.max(...values), top = Math.ceil(max / 5) * 5;
  const rr = v => 18 + (R - 18) * (v / top);
  const best = values.indexOf(max);
  const wedge = (i, r) => {
    const a0 = ((i * 45 - 19) * Math.PI) / 180, a1 = ((i * 45 + 19) * Math.PI) / 180, p = (a, rad) => [cx + rad * Math.sin(a), cx - rad * Math.cos(a)];
    const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r), [x2, y2] = p(a1, 18), [x3, y3] = p(a0, 18);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} L${x2},${y2} A18,18 0 0 0 ${x3},${y3} Z`;
  };
  return (
    <div className="rose" style={{ width: size }}>
      <svg width={size} height={size} role="img" aria-label={label}>
        {[top / 2, top].map(v => <circle key={v} cx={cx} cy={cx} r={rr(v)} fill="none" stroke={C.grid} />)}
        <text x={cx + 3} y={cx - rr(top) + 11} className="axis axis-faint">{f.int(top)}%</text>
        {values.map((v, i) => (
          <path key={i} d={wedge(i, rr(v))} fill={hi === i || (highlight && hi == null && i === best) ? C.ruby : color} opacity={hi == null || hi === i ? 0.95 : 0.5}
            onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(i)} style={{ cursor: 'pointer' }} />
        ))}
        {T.compass.map((c, i) => { const a = (i * 45 * Math.PI) / 180, r = R + 14; return <text key={c} x={cx + r * Math.sin(a)} y={cx - r * Math.cos(a) + 4} className="axis" textAnchor="middle">{c}</text>; })}
      </svg>
      <div className="rose-center">{center}</div>
      {hi != null && <div className="chart-tip rose-tip" role="status">{tip(hi, values[hi], extra ? extra[hi] : null)}</div>}
    </div>
  );
}
