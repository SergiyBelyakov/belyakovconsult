// Додаткові іконки демо транспортної доступності: реєструються в спільному наборі дашборду.
import { ICONS } from '../../dashboard/src/icons.jsx';

Object.assign(ICONS, {
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  iso: <><circle cx="12" cy="12" r="2" /><path d="M12 6.5c3.6 0 5.8 2.3 5.5 5.6-.3 3.2-2.6 5.4-5.6 5.4-3.3 0-5.7-2.5-5.4-5.7.2-3 2.4-5.3 5.5-5.3Z" /><path d="M12 2.5c5.7 0 9.6 4.1 9.5 9.6-.1 5.4-4.3 9.4-9.6 9.4-5.6 0-9.5-4.3-9.4-9.7C2.6 6.4 6.6 2.5 12 2.5Z" /></>,
  bus: <><rect x="4" y="3" width="16" height="15" rx="3" /><path d="M4 11h16M8 18v3M16 18v3M8 14.5h.01M16 14.5h.01" /></>,
  car: <><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3zM7 19v2M17 19v2M5 11h14" /></>,
  walk: <><circle cx="13" cy="4" r="2" /><path d="M10 21l2-6 3 3v3M9 12l2-4 4 1 2 3M11 8l-2 4-3 1" /></>,
  hospital: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 7v10M7 12h10" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  zoomIn: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M10.5 7.5v6M7.5 10.5h6" /></>,
  zoomOut: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M7.5 10.5h6" /></>,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 4.5v15l12-7.5-12-7.5Z" />,
  route: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>,
  pin: <><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.8" r="2.3" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 10v10" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7.5 15h9" /></>,
  curve: <><path d="M3 20h18M3 20V4" /><path d="M5 17c3-1 4-8 7-9s5 1 8-4" /></>,
  bridge: <><path d="M3 15h18M5 15v4M19 15v4M3 15c3-5 15-5 18 0" /><path d="M9 12.2V15M15 12.2V15M12 11.5V15" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  chevronRight: <path d="m10 7 5 5-5 5" />,
  layersAlt: <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Zm-9 9 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
});
