// Додаткові іконки розділу про прогнозування: реєструються в спільному наборі дашборду (stroke 1.7, 24×24).
import { ICONS } from '../../dashboard/src/icons.jsx';

Object.assign(ICONS, {
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5" /></>,
  table: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  fan: <><path d="M3 17c3-1 5-4 7-7s4-4 6-4" /><path d="M14 10c2.5-.3 4.6-1.6 7-4M14 10c2.5.6 4.6.6 7 0M14 10c2.4 1.5 4.5 3 7 6" /></>,
});
