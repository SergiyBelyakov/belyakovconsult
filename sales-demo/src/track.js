// Події поведінки відвідувачів демо (без персональних даних). Працює, лише якщо на сайті підключено інструмент
// аналітики з користувацькими подіями (Cloudflare Zaraz або Plausible); інакше нічого не робить.
export function track(name, props = {}) {
  try {
    const detail = { demo: 'sales-margin', ...props };
    if (window.zaraz && typeof window.zaraz.track === 'function') window.zaraz.track('sales_' + name, detail);
    else if (typeof window.plausible === 'function') window.plausible('sales_' + name, { props: detail });
    window.dispatchEvent(new CustomEvent('bc:demo-event', { detail: { name, ...detail } }));
  } catch { /* аналітика не повинна ламати демо */ }
}
