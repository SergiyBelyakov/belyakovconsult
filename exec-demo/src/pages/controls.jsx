import { Select } from '../../../dashboard/src/ui.jsx';

// Вибір підрозділу (уся компанія або один). onlyRevenue: без офісу (у нього немає виручки)
export function UnitPicker({ ctx, onlyRevenue }) {
  const { T, D, unit, setUnit, unitName } = ctx;
  const opts = [{ value: 'all', label: T.allUnits }, ...D.units.filter(u => !onlyRevenue || u.kind !== 'office').map(u => ({ value: u.id, label: unitName(u.id) }))];
  const value = opts.some(o => o.value === unit) ? unit : 'all';
  return <Select value={value} onChange={setUnit} options={opts} label={T.unitLabel} />;
}

export const NONE = '·';
export const withTicks = (rows, f) => rows.map(r => ({ ...r, key: r.m, tick: f.tick(r.m) }));
export const range = (vals, pad = 0.12, floor) => {
  const lo = Math.min(...vals), hi = Math.max(...vals), d = (hi - lo || Math.abs(hi) || 1) * pad;
  return [floor != null ? Math.max(floor, lo - d) : lo - d, hi + d];
};
