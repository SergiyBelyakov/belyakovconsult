// Спільне для сторінок: кроки мосту, назви груп, рядки внесків, картки показників і перемикачі
import { PRODUCTS, CHANNELS, MANAGERS, CATS } from './model/data.js';
import { CITIES } from './model/geo.js';
import { regionById } from '../../chart-gallery/src/geo.js';
import { REGIONS, EFFECTS, rollup, sum } from './model/pvm.js';
import { EFF_COL, TOT0, TOT1, CH_COL } from './colors.js';
import { Num } from './charts.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';

export { EFFECTS };
export const nm = (o, lang) => (o ? o[lang] || o.uk : '');
export const regionName = (id, lang) => { const r = regionById[id]; return r ? (lang === 'en' ? r[2] : r[1]) : id; };

// Кроки мосту прибутку (gp) або виручки (rev) з підсумків розкладання
export function bridgeSteps(tot, T, measure = 'gp') {
  const rev = measure === 'rev';
  const effs = rev ? ['vol', 'price', 'nw', 'lost'] : EFFECTS;
  const val = e => (rev ? tot[e + 'R'] ?? 0 : tot[e]);
  return [
    { id: 'gp0', label: T.tot[rev ? 'r0' : 'gp0'], short: T.totShort.gp0, value: rev ? tot.R0 : tot.GP0, total: true, color: TOT0 },
    ...effs.map(e => ({ id: e, label: T.eff[e], short: T.effShort[e], value: val(e), color: EFF_COL[e], note: T.effNote[e] })),
    { id: 'gp1', label: T.tot[rev ? 'r1' : 'gp1'], short: T.totShort.gp1, value: rev ? tot.R1 : tot.GP1, total: true, color: TOT1 },
  ];
}

// Назва групи виміру
export function groupName(dim, k, D, lang) {
  if (dim === 'cat') return nm(CATS[k], lang);
  if (dim === 'prod') return nm(PRODUCTS[k], lang);
  if (dim === 'ch') return nm(CHANNELS[k], lang);
  if (dim === 'mgr') return nm(MANAGERS[k], lang);
  if (dim === 'region') return regionName(REGIONS[k], lang);
  if (dim === 'city') return nm(CITIES[k], lang);
  if (dim === 'cust') return nm(D.customers[k], lang);
  return String(k);
}

// Рядки внесків груп у вплив eff (або зміну прибутку, якщо eff порожній)
export function contribRows(D, U, E, dim, eff, lang, fmt, T) {
  const G = rollup(D, U, E, dim);
  return G.filter(g => g.r0 || g.r1).map(g => ({
    key: g.k, label: groupName(dim, g.k, D, lang), value: eff ? g[eff] : g.dgp,
    sub: `${T.k.rev} ${fmt.pctS(g.gr ?? NaN, 0)} · ${T.k.gm} ${g.gm1 != null ? fmt.pct(g.gm1) : '·'}`,
  })).sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
}

// Частка знижок від прайсу за період (база і поточний), за бажанням лише для відібраних пар
export function discDepth(S, filter = null) {
  let L0 = 0, L1 = 0, d0 = 0, d1 = 0;
  for (let i = 0; i < S.n; i++) {
    if (filter && !filter(i)) continue;
    L0 += S.L0[i]; L1 += S.L1[i]; d0 += S.dI0[i] + S.dP0[i] + S.dR0[i]; d1 += S.dI1[i] + S.dP1[i] + S.dR1[i];
  }
  return { d0: L0 ? d0 / L0 : 0, d1: L1 ? d1 / L1 : 0 };
}

// Картка ключового показника з числом, що докручується
export function Stat({ label, value, fmtV, delta, deltaText, good, sub, accent, icon }) {
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <div className={'sm-stat glass' + (accent ? ' accent' : '')}>
      <span className="sm-stat-label">{icon && <Icon name={icon} size={15} />}{label}</span>
      <Num value={value} fmt={fmtV} className="sm-stat-value" />
      <span className="sm-stat-foot">
        {deltaText && <span className={'sm-delta ' + (good == null ? 'neutral' : good ? 'good' : 'bad')}>{dir !== 'flat' && <Icon name={dir === 'up' ? 'arrowUp' : 'arrowDown'} size={12} />}{deltaText}</span>}
        {sub && <span className="sm-stat-sub">{sub}</span>}
      </span>
    </div>
  );
}

// Чипи-перемикачі (кілька варіантів, один обраний)
export function Chips({ options, value, onChange, label, small }) {
  return (
    <div className="sm-chips" role="radiogroup" aria-label={label}>
      {label && <span className="sm-chips-label">{label}</span>}
      {options.map(o => (
        <button type="button" key={o.value} role="radio" aria-checked={value === o.value} disabled={o.disabled} title={o.title}
          className={'sm-chip' + (small ? ' sm' : '') + (value === o.value ? ' on' : '')} style={o.color ? { '--cc': o.color } : undefined} onClick={() => onChange(o.value)}>
          {o.color && <i />}{o.label}
        </button>
      ))}
    </div>
  );
}

export const chColor = k => CH_COL[k];
export { sum, EFF_COL, TOT0, TOT1 };
