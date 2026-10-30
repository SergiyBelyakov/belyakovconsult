// Лінійні іконки інтерфейсу: однакова товщина штриха, колір від тексту.
// Набір іконок відкритий для розширення: інші демо додають свої через Object.assign(ICONS, …).
export const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  chart: <path d="M3 19V9m6 10V4m6 15v-7m6 7V6" />,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 11 2.2 2.2L16 8.7" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></>,
  report: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M10 2h4l.7 3 2.5 1.1 2.7-1.4 2.1 3.4-2.2 2.1v3.6l2.2 2.1-2.1 3.4-2.7-1.4-2.5 1.1L14 22h-4l-.7-3-2.5-1.1-2.7 1.4L2 15.9l2.2-2.1v-3.6L2 8.1l2.1-3.4 2.7 1.4L9.3 5z" /></>,
  sliders: <path d="M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M16 4v4M10 10v4M18 16v4" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  layers: <path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5" />,
  warning: <path d="M10.3 3 1.6 18a2 2 0 0 0 1.7 3h17.4a2 2 0 0 0 1.7-3L13.7 3a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01" />,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c3.3 3.5 3.3 16.5 0 20M12 2c-3.3 3.5-3.3 16.5 0 20" /></>,
  pulse: <path d="M2 12h4l3-7 5 14 3-7h5" />,
  download: <path d="M12 2v13m-5-5 5 5 5-5M4 18v3h16v-3" />,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 18v3h16v-3" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M5 5l14 14M19 5 5 19" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
  reset: <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-6v6h6" />,
  pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  arrowUp: <path d="M7 17 17 7M9 7h8v8" />,
  arrowDown: <path d="M7 7l10 10M17 9v8H9" />,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  check: <path d="m5 12 5 5L20 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plug: <path d="M9 2v6m6-6v6M6 8h12v4a6 6 0 0 1-12 0V8Zm6 10v4" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
};

export function Icon({ name, size = 18, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || ICONS.grid}
    </svg>
  );
}

export function StatusIcon({ level, size = 12 }) {
  const name = level === 'healthy' ? 'check' : level === 'warning' ? 'warning' : level === 'critical' ? 'warning' : 'info';
  return <Icon name={name} size={size} />;
}
