/* Belyakov Consult service carousel, shared across UK / EN / PT homepages. */
(() => {
  'use strict';
  const dictionaries = {
    uk: {label:'Наші послуги',prev:'Попередня послуга',next:'Наступна послуга',position:'Показано послугу'},
    en: {label:'Our services',prev:'Previous service',next:'Next service',position:'Showing service'},
    pt: {label:'Os nossos serviços',prev:'Serviço anterior',next:'Serviço seguinte',position:'A mostrar serviço'}
  };
  const lang = document.documentElement.lang.toLowerCase().slice(0,2);
  const t = dictionaries[lang] || dictionaries.en;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('#services .services-grid').forEach(track => {
    if (track.classList.contains('bc-services-track')) return;
    const cards = Array.from(track.querySelectorAll(':scope > .service-card'));
    if (cards.length < 2) return;
    const section = track.closest('section');
    const shell = document.createElement('div');
    shell.className = 'bc-services-carousel';
    track.parentNode.insertBefore(shell, track);
    shell.append(track);
    track.classList.add('bc-services-track');
    track.setAttribute('role', 'region');
    track.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-label', t.label);
    track.tabIndex = 0;

    const controls = document.createElement('div');
    controls.className = 'bc-services-controls';
    const status = document.createElement('span');
    status.className = 'bc-services-status';
    status.setAttribute('aria-live', 'polite');
    const navigation = document.createElement('div');
    navigation.className = 'bc-services-navigation';
    const prev = document.createElement('button');
    prev.type = 'button'; prev.className = 'bc-services-arrow';
    prev.textContent = '‹'; prev.setAttribute('aria-label', t.prev);
    prev.setAttribute('aria-controls', 'services-track');
    const next = document.createElement('button');
    next.type = 'button'; next.className = 'bc-services-arrow';
    next.textContent = '›'; next.setAttribute('aria-label', t.next);
    next.setAttribute('aria-controls', 'services-track');
    track.id = 'services-track';
    navigation.append(prev, next);
    controls.append(status, navigation);
    shell.prepend(controls);

    const progress = document.createElement('div');
    progress.className = 'bc-services-progress';
    progress.setAttribute('aria-hidden', 'true');
    const progressFill = document.createElement('span');
    progress.append(progressFill);
    shell.append(progress);

    let active = 0;
    const nearest = () => {
      const offset = track.scrollLeft;
      const origin = cards[0].offsetLeft;
      let match = 0, distance = Infinity;
      cards.forEach((card, i) => {
        const d = Math.abs(card.offsetLeft - origin - offset);
        if (d < distance) { distance = d; match = i; }
      });
      return match;
    };
    const update = () => {
      active = nearest();
      const end = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft < 3;
      next.disabled = track.scrollLeft >= end - 3;
      status.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
      status.setAttribute('aria-label', t.position + ' ' + (active + 1) + ' / ' + cards.length);
      progressFill.style.width = (Math.min(1,Math.max(0, end ? track.scrollLeft / end : 1))*100) + '%';
    };
    const scrollToCard = index => {
      const target = cards[Math.max(0,Math.min(cards.length-1,index))];
      track.scrollTo({left: target.offsetLeft - cards[0].offsetLeft,
        behavior: reducedMotion.matches ? 'auto' : 'smooth'});
    };
    prev.addEventListener('click', () => scrollToCard(nearest() - 1));
    next.addEventListener('click', () => scrollToCard(nearest() + 1));
    track.addEventListener('keydown', event => {
      if (event.target !== track) return;
      if (event.key === 'ArrowRight') {event.preventDefault();scrollToCard(nearest()+1);}
      if (event.key === 'ArrowLeft') {event.preventDefault();scrollToCard(nearest()-1);}
      if (event.key === 'Home') {event.preventDefault();scrollToCard(0);}
      if (event.key === 'End') {event.preventDefault();scrollToCard(cards.length-1);}
    });
    let scheduled = false;
    track.addEventListener('scroll', () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; update(); });
      }
    }, {passive:true});
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
    else window.addEventListener('resize', update, {passive:true});
    update();

    /* ---------- Motion layer: entrance, in-view depth, autoplay, tilt ---------- */
    const motion = () => !reducedMotion.matches;
    const INTERVAL = 5200;          // ms per card in autoplay
    const IDLE_AFTER_USER = 9000;   // pause autoplay after manual interaction
    shell.classList.add('bc-anim');
    shell.style.setProperty('--bc-interval', INTERVAL + 'ms');
    cards.forEach((card, i) => {
      card.style.setProperty('--bc-d', String(Math.min(i, 4) * 95));
      const glare = document.createElement('span');
      glare.className = 'bc-glare'; glare.setAttribute('aria-hidden', 'true');
      card.append(glare);
    });

    // Countdown ring around the "next" arrow.
    next.classList.add('is-next');
    next.insertAdjacentHTML('beforeend',
      '<svg class="bc-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20.5"/></svg>');

    let inViewport = false, hovering = false, focused = false, idleUntil = 0, timer = null;
    const canPlay = () => motion() && inViewport && !hovering && !focused && !document.hidden && Date.now() >= idleUntil;
    const schedule = () => {
      clearTimeout(timer);
      shell.classList.remove('is-ticking');
      if (!canPlay()) {
        if (Date.now() < idleUntil) timer = setTimeout(schedule, idleUntil - Date.now() + 50);
        return;
      }
      void shell.offsetWidth;            // restart the CSS countdown
      shell.classList.add('is-ticking');
      timer = setTimeout(() => {
        const end = track.scrollWidth - track.clientWidth;
        if (track.scrollLeft >= end - 3) track.scrollTo({left: 0, behavior: 'smooth'});
        else scrollToCard(nearest() + 1);
        schedule();
      }, INTERVAL);
    };
    const userActed = () => { idleUntil = Date.now() + IDLE_AFTER_USER; schedule(); };
    prev.addEventListener('click', userActed);
    next.addEventListener('click', userActed);
    track.addEventListener('pointerdown', userActed, {passive: true});
    track.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) userActed(); }, {passive: true});
    track.addEventListener('keydown', userActed);
    shell.addEventListener('mouseenter', () => { hovering = true; schedule(); });
    shell.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    shell.addEventListener('focusin', () => { focused = true; schedule(); });
    shell.addEventListener('focusout', e => { if (!shell.contains(e.relatedTarget)) { focused = false; schedule(); } });
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener?.('change', schedule);

    if ('IntersectionObserver' in window) {
      // Cards fully in the window are lit; cards sliding in or out recede.
      const depth = new IntersectionObserver(entries => entries.forEach(entry =>
        entry.target.classList.toggle('is-inview', entry.intersectionRatio >= 0.6)),
        {root: track, threshold: [0, 0.3, 0.6, 0.9, 1]});
      cards.forEach(card => depth.observe(card));
      // Entrance once, then autoplay only while the section is on screen.
      const onScreen = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) shell.classList.add('is-entered');
        inViewport = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        schedule();
      }), {threshold: [0, 0.35, 0.6]});
      onScreen.observe(shell);
    } else {
      shell.classList.add('is-entered');
      cards.forEach(card => card.classList.add('is-inview'));
    }

    // Gentle 3D tilt and light glare under a fine pointer.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      cards.forEach(card => {
        let raf = 0;
        card.addEventListener('pointermove', e => {
          if (!motion()) return;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
            card.style.setProperty('--bc-ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
            card.style.setProperty('--bc-rx', ((0.5 - y) * 5).toFixed(2) + 'deg');
            card.style.setProperty('--bc-mx', (x * 100).toFixed(1) + '%');
            card.style.setProperty('--bc-my', (y * 100).toFixed(1) + '%');
          });
        });
        card.addEventListener('pointerleave', () => {
          cancelAnimationFrame(raf);
          ['--bc-rx', '--bc-ry'].forEach(v => card.style.setProperty(v, '0deg'));
        });
      });
    }

    section.dataset.servicesCarousel = 'ready';
  });
})();
