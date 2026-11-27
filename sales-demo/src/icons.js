// Додаткові іконки демо «Продажі та маржа»: реєструються в спільному наборі дашборду (stroke 1.7, 24×24).
import { ICONS } from '../../dashboard/src/icons.jsx';

Object.assign(ICONS, {
  bridge: <><path d="M3.5 20.5h17" /><rect x="4.5" y="9" width="3" height="11.5" rx=".8" /><rect x="9" y="5" width="3" height="4" rx=".8" /><rect x="13.5" y="5" width="3" height="7" rx=".8" /><rect x="17.5" y="11" width="3" height="9.5" rx=".8" /></>,
  box: <><path d="M12 3.5 20 7.5v9L12 20.5 4 16.5v-9Z" /><path d="m4 7.5 8 4 8-4M12 11.5v9" /></>,
  flow: <><path d="M3.5 6h3c5 0 6 12 11 12h3M3.5 18h3c5 0 6-12 11-12h3" /></>,
  medal: <><circle cx="12" cy="14.5" r="5.5" /><path d="M8.5 9.8 6 3.5h4l2 4 2-4h4l-2.5 6.3" /><path d="m12 12 .9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  pause: <><path d="M9 5.5v13M15 5.5v13" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  table: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" /></>,
  hand: <><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0v7.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-3.9-1.9L4 14.5a1.6 1.6 0 0 1 2.4-2.1L8 14" /></>,
});
