'use strict';
/* Experience line on the About page.
   Wide screens: one horizontal line from the first year to today, a node per stage at the month it began.
   Narrow screens: the same stages as a vertical list, newest first.
   All texts live in the markup, so the same script serves every language.
   Without the script the list stays readable: names, years and notes. */
(() => {
  const root = document.querySelector('[data-exp]');
  if (!root) return;

  const stage = root.querySelector('.exp-stage');
  const line = root.querySelector('.exp-line');
  const list = root.querySelector('.exp-rows');
  const card = root.querySelector('.exp-card');
  const rowEls = Array.from(root.querySelectorAll('.exp-row'));
  const chips = Array.from(root.querySelectorAll('.exp-chip'));
  if (!stage || !line || !list || !card || !rowEls.length) return;

  /* --- Scale: from the first year to the end of the current one --- */
  const today = new Date();
  const NOW = today.getFullYear() + (today.getMonth() + (today.getDate() - 1) / 31) / 12;
  const MIN = Number(root.dataset.min) || 2012;
  const MAX = Math.floor(NOW) + 1;
  const SPAN = MAX - MIN;
  const pct = value => (value / SPAN * 100).toFixed(3) + '%';

  const rows = rowEls.map(el => {
    const start = Number(el.dataset.start);
    const ongoing = !el.dataset.end;
    return {
      el,
      start,
      end: ongoing ? NOW : Number(el.dataset.end),
      ongoing,
      button: el.querySelector('.exp-item'),
      donors: (el.dataset.donors || '').split(' ').filter(Boolean),
      name: el.querySelector('.exp-name').textContent,
      years: el.querySelector('.exp-years').textContent,
      note: el.querySelector('.exp-note').textContent,
    };
  });
  const byTime = rows.slice().sort((a, b) => a.start - b.start);

  root.style.setProperty('--years', String(SPAN));
  root.style.setProperty('--now', pct(NOW - MIN));
  rows.forEach(row => {
    row.el.style.setProperty('--x', pct(row.start - MIN));
    row.el.style.setProperty('--i', String(byTime.indexOf(row)));
    row.el.classList.toggle('is-now', row.ongoing);
  });

  /* --- State --- */
  const wide = window.matchMedia('(min-width: 1100px)');
  const donorLabel = {};
  chips.forEach(chip => { if (chip.dataset.donor) donorLabel[chip.dataset.donor] = chip.textContent.trim(); });

  let selected = Math.max(0, rows.findIndex(row => row.el.hasAttribute('data-default')));
  let filter = '';

  const yearsEl = card.querySelector('.exp-detail-years');
  const nameEl = card.querySelector('.exp-detail-name');
  const noteEl = card.querySelector('.exp-detail-note');
  const tagsEl = card.querySelector('.exp-detail-tags');
  const prevBtn = card.querySelector('.exp-prev');
  const nextBtn = card.querySelector('.exp-next');
  const matches = row => !filter || row.donors.includes(filter);
  /* The order the eye follows: left to right in time on the line, top to bottom in the list. */
  const visible = () => (wide.matches ? byTime : rows).filter(matches);

  function render() {
    const shown = rows[selected];
    rows.forEach((row, index) => {
      const on = index === selected;
      row.button.setAttribute('aria-pressed', String(on));
      row.button.tabIndex = on ? 0 : -1;
      row.el.classList.toggle('is-selected', on);
      row.el.classList.toggle('is-dim', !matches(row));
    });
    line.style.setProperty('--sx', pct(shown.start - MIN));
    line.style.setProperty('--sw', pct(shown.end - shown.start));
    line.classList.toggle('is-open', shown.ongoing);
    chips.forEach(chip => {
      const donor = chip.dataset.donor || '';
      chip.setAttribute('aria-pressed', String(donor === filter));
      chip.classList.toggle('is-linked', Boolean(donor) && shown.donors.includes(donor));
    });
    yearsEl.textContent = shown.years;
    nameEl.textContent = shown.name;
    noteEl.textContent = shown.note;
    tagsEl.textContent = '';
    shown.donors.forEach(donor => {
      if (!donorLabel[donor]) return;
      const tag = document.createElement('span');
      tag.textContent = donorLabel[donor];
      tagsEl.appendChild(tag);
    });
    const order = visible();
    const at = order.indexOf(shown);
    prevBtn.disabled = at <= 0;
    nextBtn.disabled = at < 0 || at >= order.length - 1;
  }

  /* Pointing at a stage or focusing it selects it. A stage hidden by the donor filter
     is selected only by an explicit click, which also clears the filter. */
  function select(row, explicit) {
    if (!matches(row)) {
      if (!explicit) return;
      filter = '';
    }
    const index = rows.indexOf(row);
    if (index === selected && !explicit) return;
    selected = index;
    render();
  }

  function step(delta, focus) {
    const order = visible();
    const at = order.indexOf(rows[selected]);
    const next = order[Math.min(order.length - 1, Math.max(0, (at < 0 ? 0 : at) + delta))];
    if (!next) return;
    select(next, false);
    if (focus) next.button.focus();
  }

  rows.forEach(row => {
    row.button.addEventListener('click', () => select(row, true));
    row.button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') select(row, false); });
    row.button.addEventListener('focus', () => select(row, false));
    row.button.addEventListener('keydown', event => {
      const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (delta !== undefined) { event.preventDefault(); step(delta, true); return; }
      if (event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const order = visible();
      const target = order[event.key === 'Home' ? 0 : order.length - 1];
      if (target) { select(target, false); target.button.focus(); }
    });
  });
  prevBtn.addEventListener('click', () => step(-1, false));
  nextBtn.addEventListener('click', () => step(1, false));

  chips.forEach(chip => {
    const donor = chip.dataset.donor || '';
    chip.addEventListener('click', () => {
      filter = donor && donor !== filter ? donor : '';
      if (!matches(rows[selected])) selected = rows.indexOf(visible()[0]);
      render();
    });
    if (!donor) return;
    const hit = on => rows.forEach(row => row.el.classList.toggle('is-hit', on && row.donors.includes(donor)));
    chip.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hit(true); });
    chip.addEventListener('pointerleave', () => hit(false));
  });

  /* --- The line itself: a year cursor shows what ran in parallel, a click picks the stage --- */
  const cursor = document.createElement('span');
  cursor.className = 'exp-cursor';
  const cursorYear = document.createElement('b');
  cursor.appendChild(cursorYear);
  line.appendChild(cursor);

  const timeAt = event => {
    const box = line.getBoundingClientRect();
    if (box.width < 200) return null;
    const t = MIN + (event.clientX - box.left) / box.width * SPAN;
    return t < MIN || t > NOW ? null : t;
  };
  const clearCursor = () => {
    cursor.classList.remove('is-on');
    list.classList.remove('has-cursor');
    rows.forEach(row => row.el.classList.remove('is-active'));
  };
  line.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const t = timeAt(event);
    if (t === null) { clearCursor(); return; }
    line.style.setProperty('--cx', pct(t - MIN));
    cursorYear.textContent = String(Math.floor(t));
    cursor.classList.add('is-on');
    list.classList.add('has-cursor');
    rows.forEach(row => row.el.classList.toggle('is-active', t >= row.start && t <= row.end));
  });
  line.addEventListener('pointerleave', clearCursor);
  line.addEventListener('click', event => {
    const t = timeAt(event);
    if (t === null) return;
    /* the stage that began last among those running at that moment, otherwise the nearest start */
    const running = byTime.filter(row => t >= row.start && t <= row.end);
    const pick = running.length
      ? running[running.length - 1]
      : byTime.reduce((best, row) => (Math.abs(row.start - t) < Math.abs(best.start - t) ? row : best));
    select(pick, true);
  });

  /* Every label takes the room it really has: up to the next label on its side of the line,
     or to the edge of the panel for the last one. */
  const fitLabels = () => {
    const length = line.getBoundingClientRect().width;
    if (!(length > 0)) return;
    const room = stage.getBoundingClientRect().width - length;
    const at = row => (row.start - MIN) / SPAN * length;
    ['is-up', 'is-down'].forEach(side => {
      const same = byTime.filter(row => row.el.classList.contains(side));
      const width = new Map();
      same.forEach((row, k) => { // hangs to the left of its node: a bit more than half of the gap behind it
        if (!row.el.classList.contains('is-end')) return;
        const behind = k ? at(row) - at(same[k - 1]) : at(row);
        width.set(row, Math.min(250, Math.max(130, behind * 0.55 - 8)));
      });
      same.forEach((row, k) => {
        if (width.has(row)) return;
        const next = same[k + 1];
        const free = next ? at(next) - at(row) - (width.get(next) || 0) : length - at(row) + room;
        width.set(row, Math.min(210, Math.max(120, free - 12)));
      });
      width.forEach((value, row) => row.el.style.setProperty('--lw', Math.round(value) + 'px'));
    });
  };
  if ('ResizeObserver' in window) new ResizeObserver(fitLabels).observe(stage);
  const relayout = () => { fitLabels(); clearCursor(); render(); };
  if (wide.addEventListener) wide.addEventListener('change', relayout);

  root.setAttribute('data-js', '');
  fitLabels();
  render();

  /* --- Entrance --- */
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !calm) {
    root.classList.add('is-anim');
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      root.classList.add('is-in');
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(root);
  }
})();
