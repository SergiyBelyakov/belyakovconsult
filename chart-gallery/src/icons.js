// Іконки галереї: спільний набір дашборду + іконки демо аномалій + свої.
import { ICONS } from '../../dashboard/src/icons.jsx';
import '../../anomaly-demo/src/icons.js';

Object.assign(ICONS, {
  table: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9h18M3 14.5h18M9 9v11" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  gallery: <><rect x="3" y="3" width="8" height="8" rx="1" /><path d="M5.5 9V7M8.5 9V5.5" /><rect x="13" y="3" width="8" height="8" rx="1" /><path d="m14.5 9 2-2.5 1.5 1.5 1.5-2" /><rect x="3" y="13" width="8" height="8" rx="1" /><circle cx="7" cy="17" r="2.2" /><rect x="13" y="13" width="8" height="8" rx="1" /><circle cx="15.5" cy="18.5" r=".8" /><circle cx="17.5" cy="15.8" r=".8" /><circle cx="19" cy="18" r=".8" /></>,
  paw: <><circle cx="12" cy="15.5" r="3.6" /><circle cx="6.6" cy="10.4" r="1.7" /><circle cx="9.6" cy="6.8" r="1.7" /><circle cx="14.4" cy="6.8" r="1.7" /><circle cx="17.4" cy="10.4" r="1.7" /></>,
});
