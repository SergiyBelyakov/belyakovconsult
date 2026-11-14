// Додаткові іконки оцінки зрілості: реєструються в спільному наборі дашборду (stroke 1.7, 24×24).
import { ICONS } from '../../dashboard/src/icons.jsx';

Object.assign(ICONS, {
  radar: <><path d="M12 2.8 20.6 9l-3.3 10.2H6.7L3.4 9 12 2.8Z" /><path d="M12 7.6 16 10.5l-1.5 4.8h-5L8 10.5l4-2.9Z" /><path d="M12 2.8V12M20.6 9 12 12M17.3 19.2 12 12M6.7 19.2 12 12M3.4 9 12 12" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5" /></>,
  registry: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7.5h8M8 11.5h8M8 15.5h5" /><circle cx="6.2" cy="7.5" r=".4" /></>,
  listCheck: <><path d="M10 6h10M10 12h10M10 18h10" /><path d="m3.5 6 1.5 1.5L7.5 4.5M3.5 12l1.5 1.5 2.5-3M3.5 18l1.5 1.5 2.5-3" /></>,
  route: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>,
  qual: <><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></>,
  stop: <><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  stairs: <path d="M3 20h5v-4h4v-4h4V8h5" />,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  print: <><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>,
});

export const DIM_ICON = {
  strategy: 'compass', governance: 'scale', quality: 'qual', architecture: 'database',
  master: 'registry', analytics: 'chart', culture: 'users', security: 'lock',
};
