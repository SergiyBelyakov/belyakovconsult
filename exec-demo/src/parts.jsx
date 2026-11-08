// Складові інтерфейсу панелі: головний показник із шарами, картка уваги керівника, рівень упевненості,
// панель «Пояснити зміну», палітра команд, екскурсія і кроки рівнів «що відбувається → чому → що робити».
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, StatusIcon } from '../../dashboard/src/icons.jsx';
import { Spark } from '../../dashboard/src/charts.jsx';
import { Button } from '../../dashboard/src/ui.jsx';

export function Status({ level, T, text }) {
  return <span className={'status ' + level}><StatusIcon level={level} />{text || T.status[level]}</span>;
}
// Рівень упевненості: три риски + слово (не лише колір)
export function Conf({ level, T, note }) {
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <span className={'conf conf-' + level} title={note}>
      <span className="conf-bars" aria-hidden="true">{[1, 2, 3].map(k => <i key={k} className={k <= n ? 'on' : ''} />)}</span>
      {T.conf[level]}
    </span>
  );
}

// Число, що плавно доходить до нового значення (кінестетична віддача без зайвого руху)
export function useTween(value, ms = 450) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (value == null || !Number.isFinite(value) || matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(value); from.current = value; return; }
    const a = from.current ?? value, t0 = performance.now();
    let raf;
    const tick = t => {
      const p = Math.min(1, (t - t0) / ms), e = 1 - (1 - p) ** 3;
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return v;
}

// ——— головний показник: значення, зміна, прогноз на кінець року, фактори, ризик, «Чому?» ———
export function HeadKpi({ k, T, f, value, delta, fy, factors, onOpen, onWhy, onExplain, tour }) {
  if (k.na) {
    return (
      <article className="hk glass na" data-tour={tour}>
        <div className="hk-top"><span className="kpi-icon"><Icon name={k.icon} size={17} /></span><span className="hk-label">{T.head.labels[k.id]}</span></div>
        <p className="muted small">{T.head.na}</p>
      </article>
    );
  }
  return (
    <article className={'hk glass lvl-' + k.level} data-tour={tour}>
      <button type="button" className="hk-main" onClick={onOpen} aria-label={T.head.labels[k.id] + ': ' + value}>
        <span className="hk-top"><span className="kpi-icon"><Icon name={k.icon} size={17} /></span><span className="hk-label">{T.head.labels[k.id]}</span></span>
        <span className="hk-value">{value}</span>
        <span className="hk-delta">{delta}</span>
        <Spark values={k.spark} />
      </button>
      <div className="hk-layer">
        <div className="hk-row"><span>{T.head.fy[k.id]}</span><b>{fy}</b></div>
        {factors && factors.length > 0 && <div className="hk-row hk-factors"><span>{T.head.factors}</span><div>{factors.map(x => <em key={x}>{x}</em>)}</div></div>}
        <div className="hk-row"><span>{T.head.risk}</span><Status level={k.level} T={T} /></div>
      </div>
      <div className="hk-actions">
        <button type="button" className="link-btn" onClick={onWhy}><Icon name="why" size={14} />{T.head.why}</button>
        {onExplain && <button type="button" className="link-btn" onClick={onExplain}><Icon name="bulb" size={14} />{T.explain.button}</button>}
      </div>
    </article>
  );
}

// ——— бокова панель (діалог) ———
export function Drawer({ title, onClose, children, T, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => el.querySelectorAll('button, [href], input, select, textarea');
    (el.querySelector('[autofocus]') || focusables()[0])?.focus();
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const fs = focusables();
        if (!fs.length) return;
        if (e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); prev && prev.focus && prev.focus(); };
  }, []);
  return (
    <div className="drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside className={'drawer glass' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={T.close}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

// ——— палітра команд: пошук показників, сторінок, підрозділів, сценаріїв і дій ———
const norm = s => s.toLowerCase().replace(/[’'ʼ«»"]/g, '').replace(/ё/g, 'е');
export function CommandPalette({ items, onClose, T }) {
  const [q, setQ] = useState('');
  const [cur, setCur] = useState(0);
  const listRef = useRef(null);
  const found = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const hit = it => { const hay = norm(it.label + ' ' + (it.hint || '') + ' ' + (it.keys || '')); return words.every(w => hay.includes(w)); };
    return (words.length ? items.filter(hit) : items.filter(it => it.top)).slice(0, 40);
  }, [q, items]);
  useEffect(() => { setCur(0); }, [q]);
  useEffect(() => { const el = listRef.current?.querySelector('[aria-selected="true"]'); el && el.scrollIntoView({ block: 'nearest' }); }, [cur]);
  const run = it => { onClose(); setTimeout(() => it.run(), 0); };
  const key = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCur(c => Math.min(found.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCur(c => Math.max(0, c - 1)); }
    else if (e.key === 'Enter' && found[cur]) { e.preventDefault(); run(found[cur]); }
    else if (e.key === 'Escape') onClose();
  };
  let group = null;
  return (
    <div className="palette-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="palette glass" role="dialog" aria-modal="true" aria-label={T.palette.title}>
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={key} placeholder={T.palette.placeholder}
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={found[cur] ? 'pal-' + cur : undefined} aria-autocomplete="list" />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {found.map((it, k) => {
            const head = it.group !== group ? (group = it.group) : null;
            return (
              <li key={it.id} role="presentation">
                {head && <span className="palette-group">{T.palette.groups[head]}</span>}
                <button type="button" id={'pal-' + k} role="option" aria-selected={k === cur} className={k === cur ? 'cur' : ''} onMouseEnter={() => setCur(k)} onClick={() => run(it)}>
                  <Icon name={it.icon || 'chevronRight'} size={16} />
                  <span>{it.label}</span>
                  {it.hint && <small>{it.hint}</small>}
                </button>
              </li>
            );
          })}
          {!found.length && <li className="palette-empty">{T.palette.empty}</li>}
        </ul>
        <p className="palette-foot">{T.palette.foot}</p>
      </div>
    </div>
  );
}

// ——— екскурсія: підсвічує елемент сторінки і пояснює крок ———
export function Tour({ steps, step, setStep, onClose, T, navigate, view }) {
  const s = steps[step];
  const [rect, setRect] = useState(null);
  useEffect(() => { if (s.view !== view) navigate(s.view); }, [step]);
  useLayoutEffect(() => {
    let alive = true, tries = 0;
    const find = () => {
      if (!alive) return;
      const el = document.querySelector(s.sel);
      if (!el) { if (tries++ < 30) setTimeout(find, 80); return; }
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      setTimeout(() => { if (alive) { const r = el.getBoundingClientRect(); setRect({ x: r.left, y: r.top, w: r.width, h: r.height }); } }, 380);
    };
    setRect(null);
    find();
    const on = () => { const el = document.querySelector(s.sel); if (el) { const r = el.getBoundingClientRect(); setRect({ x: r.left, y: r.top, w: r.width, h: r.height }); } };
    window.addEventListener('resize', on); window.addEventListener('scroll', on, { passive: true });
    return () => { alive = false; window.removeEventListener('resize', on); window.removeEventListener('scroll', on); };
  }, [step, view]);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') step < steps.length - 1 && setStep(step + 1); if (e.key === 'ArrowLeft') step > 0 && setStep(step - 1); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [step]);
  const vw = window.innerWidth, vh = window.innerHeight;
  const pad = 8;
  const box = rect ? { left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 } : null;
  const below = rect ? rect.y + rect.h + 16 + 190 < vh : true;
  const cardStyle = rect ? { left: Math.max(12, Math.min(vw - 372, rect.x)), top: below ? Math.min(vh - 200, rect.y + rect.h + 16) : Math.max(12, rect.y - 206) } : { left: '50%', top: '40%', transform: 'translate(-50%, -50%)' };
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={T.tour.title}>
      {box ? <div className="tour-spot" style={box} /> : <div className="tour-dim" />}
      <div className="tour-card glass" style={cardStyle}>
        <span className="tour-step">{T.tour.step(step + 1, steps.length)}</span>
        <h4>{T.tour.steps[s.id].title}</h4>
        <p>{T.tour.steps[s.id].text}</p>
        <div className="tour-actions">
          <Button onClick={onClose}>{T.tour.skip}</Button>
          {step > 0 && <Button icon="back" onClick={() => setStep(step - 1)} title={T.tour.back} />}
          {step < steps.length - 1 ? <Button kind="primary" onClick={() => setStep(step + 1)}>{T.tour.next}</Button> : <Button kind="primary" onClick={onClose}>{T.tour.done}</Button>}
        </div>
      </div>
    </div>
  );
}

// ——— три рівні панелі: огляд → аналіз → рішення ———
export function LevelSteps({ level, T, go }) {
  return (
    <ol className="levels" aria-label={T.levelsLabel}>
      {T.levels.map((l, k) => (
        <li key={k} className={k === level ? 'on' : k < level ? 'done' : ''}>
          <button type="button" onClick={() => go(['overview', 'causes', 'scenarios'][k])} aria-current={k === level ? 'step' : undefined}>
            <i>{k + 1}</i><span>{l}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
