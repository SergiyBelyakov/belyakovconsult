'use strict';
/* Experience timeline on the About page.
   All texts live in the markup, so the same script serves every language.
   Without the script the list stays readable: names, years, notes and static bars. */
(() => {
  const root = document.querySelector('[data-exp]');
  if (!root) return;

  const axis = root.querySelector('.exp-axis');
  const body = root.querySelector('.exp-body');
  const detail = root.querySelector('.exp-detail');
  const rowEls = Array.from(root.querySelectorAll('.exp-row'));
  const chips = Array.from(root.querySelectorAll('.exp-chip'));
  if (!axis || !body || !detail || !rowEls.length) return;

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

  root.style.setProperty('--years', String(SPAN));
  root.style.setProperty('--now', pct(NOW - MIN));
  const byStart = rows.slice().sort((a, b) => a.start - b.start);
  rows.forEach(row => {
    row.el.style.setProperty('--l', pct(row.start - MIN));
    row.el.style.setProperty('--w', pct(row.end - row.start));
    row.el.style.setProperty('--i', String(byStart.indexOf(row)));
    row.el.classList.toggle('is-now', row.ongoing);
    row.el.classList.toggle('is-short', row.end - row.start < 0.6);
  });

  const todayLabel = axis.dataset.today || '';
  axis.textContent = '';
  for (let year = MIN; year < MAX; year += 2) {
    if (NOW - year < 1.7) continue; // leave room for the "today" label
    const tick = document.createElement('span');
    tick.textContent = String(year);
    tick.style.left = pct(year - MIN);
    axis.appendChild(tick);
  }
  if (todayLabel) {
    const mark = document.createElement('span');
    mark.className = 'exp-today';
    mark.textContent = todayLabel;
    mark.style.left = pct(NOW - MIN);
    axis.appendChild(mark);
  }

  /* --- State --- */
  const donorLabel = {};
  chips.forEach(chip => { if (chip.dataset.donor) donorLabel[chip.dataset.donor] = chip.textContent.trim(); });

  let selected = Math.max(0, rows.findIndex(row => row.el.hasAttribute('data-default')));
  let filter = '';

  const yearsEl = detail.querySelector('.exp-detail-years');
  const nameEl = detail.querySelector('.exp-detail-name');
  const noteEl = detail.querySelector('.exp-detail-note');
  const tagsEl = detail.querySelector('.exp-detail-tags');
  const matches = row => !filter || row.donors.includes(filter);

  function render() {
    const shown = rows[selected];
    rows.forEach((row, index) => {
      row.button.setAttribute('aria-pressed', String(index === selected));
      row.el.classList.toggle('is-dim', !matches(row));
    });
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
  }

  /* Pointing at a stage or focusing it selects it. A stage hidden by the donor filter
     is selected only by an explicit click, which also clears the filter. */
  function select(index, explicit) {
    if (!matches(rows[index])) {
      if (!explicit) return;
      filter = '';
    }
    if (index === selected && !explicit) return;
    selected = index;
    render();
  }

  rows.forEach((row, index) => {
    row.button.addEventListener('click', () => select(index, true));
    row.button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') select(index, false); });
    row.button.addEventListener('focus', () => select(index, false));
    row.button.addEventListener('keydown', event => {
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      const edge = { Home: 0, End: rows.length - 1 }[event.key];
      if (step === undefined && edge === undefined) return;
      event.preventDefault();
      const next = edge !== undefined ? edge : (index + step + rows.length) % rows.length;
      rows[next].button.focus();
    });
  });
  chips.forEach(chip => {
    const donor = chip.dataset.donor || '';
    chip.addEventListener('click', () => {
      filter = donor && donor !== filter ? donor : '';
      if (!matches(rows[selected])) selected = rows.findIndex(matches);
      render();
    });
    if (!donor) return;
    const hit = on => rows.forEach(row => row.el.classList.toggle('is-hit', on && row.donors.includes(donor)));
    chip.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hit(true); });
    chip.addEventListener('pointerleave', () => hit(false));
  });

  /* --- Year cursor: shows which stages ran in parallel (mouse only) --- */
  const cursor = document.createElement('div');
  cursor.className = 'exp-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const cursorLabel = document.createElement('span');
  cursor.appendChild(cursorLabel);
  body.appendChild(cursor);
  const firstTrack = rows[0].el.querySelector('.exp-track');
  const clearCursor = () => {
    cursor.classList.remove('is-on');
    rows.forEach(row => row.el.classList.remove('is-active'));
  };
  body.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const track = firstTrack.getBoundingClientRect();
    const x = event.clientX - track.left;
    if (x < 0 || x > track.width || track.width < 200) { clearCursor(); return; }
    const t = Math.min(MIN + x / track.width * SPAN, NOW);
    cursor.style.left = (track.left - body.getBoundingClientRect().left + (t - MIN) / SPAN * track.width) + 'px';
    cursorLabel.textContent = String(Math.floor(t));
    cursor.classList.add('is-on');
    rows.forEach(row => row.el.classList.toggle('is-active', t >= row.start && t <= row.end));
  });
  body.addEventListener('pointerleave', clearCursor);

  root.setAttribute('data-js', '');
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
