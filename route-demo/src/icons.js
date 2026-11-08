// Додаткові іконки демо маршрутів: реєструються в спільному наборі дашборду.
import { ICONS } from '../../dashboard/src/icons.jsx';
import '../../community-twin/src/icons.js';
import '../../anomaly-demo/src/icons.js';
import '../../graph-demo/src/icons.js';

Object.assign(ICONS, {
  hand: <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5" /><path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M17 11a1.5 1.5 0 0 1 3 0v3.5A7.5 7.5 0 0 1 12.5 22h-.6a6.4 6.4 0 0 1-4.9-2.3L3.7 15.6a1.6 1.6 0 0 1 2.4-2.1L8 15.3" /></>,
  scissors: <><circle cx="6" cy="6" r="2.8" /><circle cx="6" cy="18" r="2.8" /><path d="M8.2 7.8 20 18M8.2 16.2 20 6M13.5 12h.01" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  rotL: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5" /></>,
  rotR: <><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" /><path d="M21 3v5h-5" /></>,
  volume: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>,
  mute: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m16 9 6 6M22 9l-6 6" /></>,
  truck: <><path d="M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  lorry: <><path d="M3 7h9v9H3zM12 10h4l3 3v3h-7" /><circle cx="6.5" cy="17.5" r="1.7" /><circle cx="16" cy="17.5" r="1.7" /></>,
  van: <><path d="M3 8h11l3.5 4H21v4H3V8Z" /><path d="M14 8v4h3.5" /><circle cx="7" cy="17" r="1.7" /><circle cx="17" cy="17" r="1.7" /></>,
  warehouse: <><path d="M3 21V9l9-5 9 5v12" /><path d="M7 21v-8h10v8M7 16h10" /></>,
  dice: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><circle cx="8.5" cy="8.5" r="1.2" /><circle cx="15.5" cy="15.5" r="1.2" /><circle cx="15.5" cy="8.5" r="1.2" /><circle cx="8.5" cy="15.5" r="1.2" /><circle cx="12" cy="12" r="1.2" /></>,
  fuel: <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10" /><path d="M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  graph: <><circle cx="5" cy="6" r="2.2" /><circle cx="19" cy="5" r="2.2" /><circle cx="12" cy="13" r="2.4" /><circle cx="5" cy="19" r="2.2" /><circle cx="19" cy="18" r="2.2" /><path d="m6.8 7.3 3.4 4M17.3 6.4l-3.6 4.8M6.7 17.6l3.6-3M14.2 14.4l3 2.4" /></>,
  dispatch: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18.5 6.5" /><circle cx="12" cy="12" r="1.2" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  magnet: <><path d="M5 4v8a7 7 0 0 0 14 0V4h-4v8a3 3 0 0 1-6 0V4H5Z" /><path d="M5 8h4M15 8h4" /></>,
  co2: <><path d="M6.5 18A4.5 4.5 0 0 1 6 9a6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18Z" /><path d="M9 14h6" /></>,
});
