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
    section.dataset.servicesCarousel = 'ready';
  });
})();
