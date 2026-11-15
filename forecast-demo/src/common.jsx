// Спільне для сторінок: формули з індексами, ряди прикладів, перемикачі параметрів, плитки точності, ознаки моделі.
import { Fragment } from 'react';
import { Icon } from '../../dashboard/src/icons.jsx';
import { dataset } from './data.js';
import { BY_ID, applies } from './engine/models.js';
import { seriesInfo } from './engine/evaluate.js';
import { futureDates } from './format.js';

// «ŷ_{t+1} = α · y_{t}» → нижні й верхні індекси
export function Formula({ s, className = 'fx' }) {
  const parts = [];
  const re = /([_^])\{([^}]*)\}/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(<Fragment key={k++}>{s.slice(last, m.index)}</Fragment>);
    parts.push(m[1] === '_' ? <sub key={k++}>{m[2]}</sub> : <sup key={k++}>{m[2]}</sup>);
    last = re.lastIndex;
  }
  if (last < s.length) parts.push(<Fragment key={k++}>{s.slice(last)}</Fragment>);
  return <code className={className}>{parts}</code>;
}

// Ряд прикладу з усім потрібним для моделей і графіків; сценарій змінює майбутні фактори
export function seriesFor(id, scenario) {
  const d = dataset(id);
  let drivers = d.drivers || null;
  if (drivers && scenario) {
    const Xf = drivers.Xf.map(([temp, price, promo]) => [Math.round((temp + scenario.temp) * 10) / 10, Math.round(price * (1 + scenario.price / 100) * 100) / 100, scenario.promo ? promo : 0]);
    drivers = { ...drivers, Xf };
  }
  return { ...d, drivers };
}
export const futureOf = (S, h) => (S.drivers && S.drivers.fdates ? S.drivers.fdates.slice(0, h) : futureDates(S.dates[S.dates.length - 1], h, S.freq));

export function applicability(id, S, H) {
  if (id === 'ensemble') return true;
  const info = seriesInfo(S);
  return applies(BY_ID[id], { ...info, n: info.n - (H || 0) });
}

export function Caps({ caps, T }) {
  return (
    <span className="fc-caps">
      {['trend', 'season', 'multi', 'drivers', 'events', 'intermittent'].filter(k => k === 'trend' || k === 'season' || caps[k]).map(k => (
        <span key={k} className={'fc-cap' + (caps[k] ? ' on' : '')} title={T.caps[k]}>
          <Icon name={caps[k] ? 'check' : 'x'} size={12} />{T.caps[k]}
        </span>
      ))}
    </span>
  );
}

// Повзунок параметра з перемикачем «Авто»
export function ParamControl({ spec, value, used, onChange, T, fmt }) {
  const lab = T.params[spec.id] || [spec.id, ''];
  if (spec.type === 'toggle') {
    return (
      <label className="fc-toggle">
        <input type="checkbox" checked={value ?? !!spec.def} onChange={e => onChange(e.target.checked)} />
        <span className="fc-switch" aria-hidden="true" />
        <span><b>{lab[0]}</b>{lab[1] && <small>{lab[1]}</small>}</span>
      </label>
    );
  }
  if (spec.type === 'select') {
    const opt = T.params[spec.id + 'Opt'] || {};
    return (
      <div className="fc-param">
        <div className="fc-param-head"><b>{lab[0]}</b></div>
        <div className="fc-seg" role="radiogroup" aria-label={lab[0]}>
          {spec.options.map(o => <button key={o} type="button" role="radio" aria-checked={(value ?? spec.def) === o} className={(value ?? spec.def) === o ? 'on' : ''} onClick={() => onChange(o)}>{opt[o] || o}</button>)}
        </div>
      </div>
    );
  }
  const isAuto = spec.auto && value == null;
  const shown = isAuto ? used : value ?? spec.def;
  const dec = spec.step < 1 ? 2 : 0;
  return (
    <div className={'fc-param' + (isAuto ? ' auto' : '')}>
      <div className="fc-param-head">
        <b>{lab[0]}</b>
        <span className="fc-param-val">{Number.isFinite(shown) ? (dec ? fmt.dec2(shown) : fmt.int(shown)) : '·'}</span>
        {spec.auto && (
          <label className="fc-auto"><input type="checkbox" checked={isAuto} onChange={e => onChange(e.target.checked ? null : Math.round((used ?? spec.min) * 100) / 100)} />{T.autoWord}</label>
        )}
      </div>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={Number.isFinite(shown) ? shown : spec.min}
        onChange={e => onChange(Number(e.target.value))} aria-label={lab[0]} />
      {lab[1] && <small>{lab[1]}</small>}
    </div>
  );
}

// Плитки точності на відкладених даних
export function MetricTiles({ m, T, fmt }) {
  if (!m) return null;
  const tiles = [
    ['mase', Number.isFinite(m.mase) ? fmt.dec2(m.mase) : '·', m.mase < 1 ? 'good' : m.mase < 1.05 ? '' : 'bad'],
    ['mape', Number.isFinite(m.mape) ? fmt.pct1(m.mape) : '·', ''],
    ['mae', fmt.val(m.mae), ''],
    ['bias', fmt.signed(m.bias), ''],
    ['cover', Number.isFinite(m.cover80) ? fmt.pct0(m.cover80) : T.noBand, ''],
  ];
  return (
    <div className="fc-metrics">
      {tiles.map(([k, v, cls]) => (
        <div key={k} className={'fc-metric ' + cls} title={T.metric[k][1]}>
          <small>{T.metric[k][0]}</small>
          <b>{v}</b>
          <p>{T.metric[k][1]}</p>
        </div>
      ))}
    </div>
  );
}

export function Code({ children }) {
  return <pre className="fc-code"><code>{children}</code></pre>;
}
