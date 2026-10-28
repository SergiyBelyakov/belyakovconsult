import { useEffect, useRef } from 'react';
import { Icon, StatusIcon } from './icons.jsx';
import { Spark } from './charts.jsx';

export function Panel({ title, sub, aside, className = '', children, id }) {
  return (
    <section className={'panel glass ' + className} id={id}>
      {(title || aside) && (
        <div className="panel-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <p>{sub}</p>}
          </div>
          {aside && <div className="panel-aside">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Status({ level, T }) {
  return <span className={'status ' + level}><StatusIcon level={level} />{T.status[level]}</span>;
}

// KPI: велике число домінує, дельта зі стрілкою і знаком (не лише кольором).
export function Kpi({ icon, label, value, unit, delta, deltaText, goodWhenUp = true, context, spark, onClick, accent }) {
  const dir = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
  const good = dir === 'flat' ? 'neutral' : (dir === 'up') === goodWhenUp ? 'good' : 'bad';
  return (
    <button type="button" className={'kpi glass' + (accent ? ' kpi-accent' : '')} onClick={onClick}>
      <span className="kpi-top">
        <span className="kpi-icon"><Icon name={icon} size={18} /></span>
        <span className="kpi-label">{label}</span>
      </span>
      <span className="kpi-value">{value}{unit && <small>{unit}</small>}</span>
      <span className="kpi-bottom">
        {deltaText != null && (
          <span className={'kpi-delta ' + good}>
            {dir !== 'flat' && <Icon name={dir === 'up' ? 'arrowUp' : 'arrowDown'} size={12} />}
            {deltaText}
          </span>
        )}
        <span className="kpi-context">{context}</span>
      </span>
      <Spark values={spark} />
    </button>
  );
}

export function Select({ value, onChange, options, label }) {
  return (
    <label className="select glass-control">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="chevron" size={14} />
    </label>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented glass-control" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button type="button" key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ icon, children, onClick, kind = 'ghost', className = '', type = 'button', disabled, title, href }) {
  const cls = 'btn btn-' + kind + ' ' + className;
  const inner = <>{icon && <Icon name={icon} size={16} />}{children && <span>{children}</span>}</>;
  if (href) return <a className={cls} href={href} title={title}>{inner}</a>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title} aria-label={!children ? title : undefined}>{inner}</button>;
}

export function Modal({ title, onClose, children, wide, T }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => el.querySelectorAll('button, [href], input, select, textarea');
    (el.querySelector('[autofocus]') || focusables()[0])?.focus();
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); prev && prev.focus && prev.focus(); };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={'modal glass' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={T.close}><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ toast, onAction }) {
  if (!toast) return null;
  return (
    <div className="toast glass" role="status">
      <Icon name={toast.icon || 'info'} size={18} />
      <span>{toast.text}</span>
      {toast.action && <button type="button" className="toast-action" onClick={onAction}>{toast.action}</button>}
    </div>
  );
}

export function Empty({ T, onReset }) {
  return (
    <div className="empty">
      <p>{T.noData}</p>
      <Button icon="reset" onClick={onReset}>{T.clearFilters}</Button>
    </div>
  );
}
