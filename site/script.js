'use strict';
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
function closeMenu() { nav.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open); });
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
 const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('reveal'); observer.unobserve(entry.target); } }); }, {threshold:0.12});
 document.querySelectorAll('.interactive-card, .case-card, .section-title').forEach(card => observer.observe(card));
}

/* Current-section navigation underline. */
(() => {
  const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  if (!links.length) return;

  const pairs = links
    .map(link => {
      const selector = link.getAttribute('href');
      return { link, section: document.querySelector(selector) };
    })
    .filter(item => item.section);

  const setActive = link => {
    links.forEach(item => item.classList.toggle('is-active', item === link));
  };

  const updateActive = () => {
    const probe = window.scrollY + Math.min(window.innerHeight * 0.36, 300);
    let current = pairs[0];

    pairs.forEach(pair => {
      if (pair.section.offsetTop <= probe) current = pair;
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 16) {
      current = pairs[pairs.length - 1];
    }

    if (current) setActive(current.link);
  };

  pairs.forEach(pair => {
    pair.link.addEventListener('click', () => setActive(pair.link));
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateActive();
      ticking = false;
    });
  }, { passive:true });

  window.addEventListener('resize', updateActive, { passive:true });
  updateActive();
})();

