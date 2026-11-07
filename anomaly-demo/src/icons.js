// Додаткові іконки демо виявлення аномалій: реєструються в спільному наборі дашборду.
import { ICONS } from '../../dashboard/src/icons.jsx';

Object.assign(ICONS, {
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>,
  cloud: <><circle cx="12" cy="12" r="1.6" /><circle cx="6" cy="8" r="1.1" /><circle cx="17.5" cy="7" r="1.1" /><circle cx="7.5" cy="16.5" r="1.1" /><circle cx="16" cy="17" r="1.1" /><circle cx="19.5" cy="12.5" r=".9" /><circle cx="4" cy="13" r=".9" /><circle cx="12" cy="12" r="7.5" strokeDasharray="2 3" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18.5 5.5" /><circle cx="16" cy="9" r="1.2" /></>,
  tune: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  compress: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  bars: <path d="M5 20V11M10 20V6M15 20v-8M20 20V9M3 20h18" />,
  chevronLeft: <path d="m14 7-5 5 5 5" />,
  chevronRight: <path d="m10 7 5 5-5 5" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
});
