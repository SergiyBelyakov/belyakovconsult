import { Select, Segmented } from '../../../dashboard/src/ui.jsx';
import { SERVICES, MODES, PERIODS } from '../model.js';

// Спільна панель керування: послуга, спосіб пересування, час доби, межа часу
export function Controls({ ctx, showMode = true, showPeriod = true, extra, before }) {
  const { T, f, service, setService, mode, setMode, period, setPeriod, th, setTh } = ctx;
  const periodOff = showMode && mode !== 'pt';
  return (
    <div className="toolbar tr-toolbar">
      {before}
      <Select value={service} onChange={setService} label={T.serviceLabel} options={SERVICES.map(s => ({ value: s, label: T.servicesLong[s] }))} />
      {showMode && <Segmented value={mode} onChange={setMode} label={T.modeLabel} options={MODES.map(m => ({ value: m, label: T.modes[m] }))} />}
      {showPeriod && (
        <div className={'period-wrap' + (periodOff ? ' off' : '')} title={periodOff ? T.periodOnlyPt : undefined}>
          <Segmented value={period} onChange={setPeriod} label={T.periodLabel} options={PERIODS.map(p => ({ value: p, label: T.periods[p] }))} />
        </div>
      )}
      <label className="th-control glass-control">
        <span>{T.thLabel}</span>
        <input type="range" min="10" max="90" step="5" value={th} onChange={e => setTh(Number(e.target.value))} aria-valuetext={f.min(th)} />
        <b>{f.min(th)}</b>
      </label>
      {extra}
    </div>
  );
}
