// Події гри для аналітики (без персональних даних): лише якщо на сайті є Cloudflare Zaraz або Plausible.
export function track(name, props = {}) {
  try {
    const detail = { demo: 'scooter-cat', ...props };
    if (window.zaraz && typeof window.zaraz.track === 'function') window.zaraz.track('scooter_' + name, detail);
    else if (typeof window.plausible === 'function') window.plausible('scooter_' + name, { props: detail });
    window.dispatchEvent(new CustomEvent('bc:demo-event', { detail: { name, ...detail } }));
  } catch { /* аналітика не повинна ламати гру */ }
}
