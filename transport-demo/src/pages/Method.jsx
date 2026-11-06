import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { CAR, BUS, WALK, DETOUR, CONN, WINDOW, BANDS, busSpeed, STOP_KM } from '../model.js';
import { CELL } from '../data.js';

const IN = ['places', 'roads', 'routes', 'facilities'];
const OUT = ['iso', 'coverage', 'catch', 'signals', 'scen'];

function DataModel({ T, motion }) {
  const W = 800, H = 300;
  const inY = i => 30 + i * 64, outY = i => 18 + i * 56;
  const eng = { x: 300, y: 108, w: 196, h: 84 };
  return (
    <svg className="data-model" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.dmAria}>
      {IN.map((k, i) => {
        const y = inY(i) + 20;
        const d = `M222 ${y} C262 ${y}, 262 ${eng.y + eng.h / 2}, ${eng.x} ${eng.y + eng.h / 2}`;
        return <g key={k}><path d={d} className="dm-edge" />{motion && <path d={d} pathLength="100" className="dm-pulse" style={{ animationDelay: i * -0.7 + 's' }} />}</g>;
      })}
      {OUT.map((k, i) => {
        const y = outY(i) + 19;
        const d = `M${eng.x + eng.w} ${eng.y + eng.h / 2} C${eng.x + eng.w + 50} ${eng.y + eng.h / 2}, 560 ${y}, 610 ${y}`;
        return <g key={k}><path d={d} className="dm-edge" />{motion && <path d={d} pathLength="100" className="dm-pulse" style={{ animationDelay: (i * -0.5 - 0.3) + 's' }} />}</g>;
      })}
      {IN.map((k, i) => (
        <g key={k} transform={`translate(16 ${inY(i)})`}>
          <rect width="206" height="40" rx="4" className="dm-box" />
          <text x="14" y="17" className="dm-label">{T.dm.in[k][0]}</text>
          <text x="14" y="31" className="dm-rel">{T.dm.in[k][1]}</text>
        </g>
      ))}
      <g transform={`translate(${eng.x} ${eng.y})`}>
        <rect width={eng.w} height={eng.h} rx="4" className="dm-box main" />
        <circle cx="16" cy="18" r="3.5" className="dm-dot" />
        <text x="28" y="22" className="dm-label">{T.dm.engine[0]}</text>
        <text x="16" y="44" className="dm-rel">{T.dm.engine[1]}</text>
        <text x="16" y="62" className="dm-rel">{T.dm.engine[2]}</text>
      </g>
      {OUT.map((k, i) => (
        <g key={k} transform={`translate(610 ${outY(i)})`}>
          <rect width="178" height="38" rx="4" className="dm-box" />
          <text x="14" y="24" className="dm-label">{T.dm.out[k]}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Method({ ctx }) {
  const { T, f, base, exportPlaces, exportRoutes, motion, placeName } = ctx;
  const roadKm = base.roads.reduce((a, r) => a + r.len, 0);
  const routes = base.routes.filter(r => r.kind !== 'drt');
  const stops = new Set(routes.flatMap(r => r.stops)).size;
  const counts = [
    [f.int(base.places.length), T.cnt.places], [f.int(base.total.all), T.cnt.pop], [f.int(roadKm), T.cnt.roadKm], [f.int(base.N), T.cnt.nodes],
    [f.int(routes.filter(r => !r.suspended).length), T.cnt.routes], [f.int(stops), T.cnt.stops], [f.int(10), T.cnt.facs], [f.int(base.gx * base.gy), T.cnt.cells],
  ];
  const stopName = id => (base.byId.has(id) ? placeName(base.byId.get(id)) : T.junction[id] || id);

  return (
    <>
      <div className="grid grid-main">
        <Panel title={T.dmTitle} sub={T.dmSub}>
          <DataModel T={T} motion={motion} />
          <div className="model-counts">{counts.map(([v, l], i) => <span key={i}><b>{v}</b><small>{l}</small></span>)}</div>
        </Panel>
        <Panel title={T.formulaTitle}>
          {T.formulas.map((x, i) => <p key={i} className="formula"><b>{x[0]}</b> {x[1]}</p>)}
          <p className="formula"><b>{T.paramsWord}</b> {T.params(f, { walk: WALK, detour: DETOUR, board: BUS.board, cap: BUS.waitCap, dwell: BUS.dwell, cell: CELL * 1000, stop: STOP_KM })}</p>
        </Panel>
      </div>

      <div className="grid grid-main">
        <Panel title={T.speedTitle} sub={T.speedSub}>
          <div className="table-scroll">
            <table className="data-table plain">
              <thead><tr><th>{T.cols.roadClass}</th><th className="num">{T.modes.car}</th><th className="num">{T.modes.pt}</th><th className="num">{T.modes.walk}</th></tr></thead>
              <tbody>
                {Object.keys(CAR).map(c => (
                  <tr key={c}><td><i className={'rd-sw rd-sw-' + c} />{T.roadClass[c]}</td><td className="num">{f.int(CAR[c])}</td><td className="num">{f.int(busSpeed(c))}</td><td className="num">{f.dec1(WALK)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{T.speedHint.replace('{c}', f.int(CONN.car)).replace('{w}', f.dec1(WALK))}</p>
        </Panel>
        <Panel title={T.checkTitle}>
          <ul className="check-list">{T.checks.map((t, i) => <li key={i}><Icon name="check" size={16} /><span>{t}</span></li>)}</ul>
        </Panel>
      </div>

      <Panel title={T.schedTitle} sub={T.schedSub.replace('{am}', WINDOW.am / 60).replace('{day}', WINDOW.day / 60).replace('{pm}', WINDOW.pm / 60)} className="flat-panel"
        aside={<div className="table-actions"><Button icon="download" onClick={exportRoutes}>{T.csvRoutes}</Button><Button icon="download" onClick={exportPlaces}>{T.csvPlaces}</Button></div>}>
        <div className="table-scroll">
          <table className="data-table plain sched">
            <thead><tr><th>{T.cols.route}</th><th>{T.cols.stops}</th><th className="num">{T.cols.km}</th><th className="num">{T.cols.oneWay}</th>
              <th className="num">{T.periods.am}</th><th className="num">{T.periods.day}</th><th className="num">{T.periods.pm}</th></tr></thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td className="strong">{T.routeName(r.id)}{r.suspended && <span className="reason warn">{T.suspended}</span>}</td>
                  <td className="why">{r.stops.map(stopName).join(' → ')}</td>
                  <td className="num">{f.dec1(r.km)}</td>
                  <td className="num">{f.min(r.oneWay)}</td>
                  {['am', 'day', 'pm'].map(p => <td key={p} className={'num' + (r.trips[p] <= 2 ? ' over' : '')}>{f.int(r.trips[p])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot"><span>{T.schedFoot}</span></div>
      </Panel>

      <div className="grid grid-main">
        <Panel title={T.limitsTitle}>
          <ul className="check-list warn-list">{T.limits.map((t, i) => <li key={i}><Icon name="info" size={16} /><span>{t}</span></li>)}</ul>
        </Panel>
        <Panel title={T.glossTitle}>
          <dl className="glossary">{T.gloss.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        </Panel>
      </div>
      <Panel className="cta-card flat-panel">
        <h3>{T.ctaTitle}</h3>
        <p>{T.ctaText}</p>
        <Button kind="primary" icon="mail" onClick={() => ctx.openLead('method')}>{T.ctaButton}</Button>
      </Panel>
    </>
  );
}
