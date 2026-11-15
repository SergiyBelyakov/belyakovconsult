// Події поведінки відвідувачів розділу (без вмісту файлів і персональних даних). Працює, лише якщо на сайті
// підключено інструмент аналітики з користувацькими подіями (Cloudflare Zaraz або Plausible); інакше нічого не робить.
export function track(name, props = {}) {
  try {
    const detail = { demo: 'forecast-models', ...props };
    if (window.zaraz && typeof window.zaraz.track === 'function') window.zaraz.track('forecast_' + name, detail);
    else if (typeof window.plausible === 'function') window.plausible('forecast_' + name, { props: detail });
    window.dispatchEvent(new CustomEvent('bc:demo-event', { detail: { name, ...detail } }));
  } catch { /* аналітика не повинна ламати розділ */ }
}
