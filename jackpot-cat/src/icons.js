// Іконки гри: спільний набір, іконки інших ігор (звук, галерея, котик, самокат, автомат) і свої: досліди, математика, журнал, монети, баг, окуляри.
import { ICONS } from '../../dashboard/src/icons.jsx';
import '../../scooter-cat/src/icons.js';

Object.assign(ICONS, {
  flask: <><path d="M9 3h6M10 3v6.2L4.8 18.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L14 9.2V3" /><path d="M7.5 15h9" /></>,
  sigma: <path d="M17 5H7l6 7-6 7h10" />,
  journal: <><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" /><path d="M9 14l2.5-3 2 2 2.5-4" /></>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="2.6" /><path d="M3 7v5c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V7" /><path d="M3 12v5c0 1.4 2.7 2.6 6 2.6 1.2 0 2.3-.2 3.2-.4" /><ellipse cx="17.5" cy="16" rx="3.5" ry="1.8" /><path d="M14 16v2.5c0 1 1.6 1.8 3.5 1.8s3.5-.8 3.5-1.8V16" /></>,
  bug: <><ellipse cx="12" cy="14" rx="4.5" ry="5.5" /><path d="M12 8.5v11M9 6.5a3 3 0 0 1 6 0M4 10l3.6 2M20 10l-3.6 2M4 20l3.8-2.6M20 20l-3.8-2.6M3.5 15h4M20.5 15h-4" /></>,
  glasses: <><rect x="2.5" y="9" width="8" height="6" rx="1.5" /><rect x="13.5" y="9" width="8" height="6" rx="1.5" /><path d="M10.5 11.5h3M2.5 10 1 8.5M21.5 10 23 8.5" /></>,
  lockOpen: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.6-1.7" /></>,
});
