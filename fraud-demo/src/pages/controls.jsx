import { Segmented } from '../../../dashboard/src/ui.jsx';
import { MODELS } from '../model.js';

// Вибір моделі й обсягу перевірок: спільні для огляду, моделі й черги
export function ModelBar({ ctx }) {
  const { T, f, model, setModel, cap, setCap, th, B } = ctx;
  const n = Math.round(B.rows.length * cap);
  return (
    <div className="model-bar glass">
      <div className="model-bar-item">
        <span className="muted small">{T.modelLabel}</span>
        <Segmented value={model} onChange={setModel} label={T.modelLabel} options={MODELS.map(m => ({ value: m, label: T.models[m] }))} />
        <small className="muted">{T.modelsHint[model]}</small>
      </div>
      <label className="model-bar-item cap">
        <span className="muted small">{T.capacity}: <b>{f.pct(cap, 1)}</b> <span className="muted">({T.capacityHint(n)})</span></span>
        <input type="range" min="0.005" max="0.1" step="0.005" value={cap} onChange={e => setCap(Number(e.target.value))} aria-label={T.capacity} />
        <small className="muted">{T.threshold}: {f.dec2(th)}</small>
      </label>
    </div>
  );
}
