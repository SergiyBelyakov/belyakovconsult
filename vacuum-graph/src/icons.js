// Іконки гри: спільний набір, іконки інших ігор (звук, геймпад, котик, самокат) і свої: граф, пилосос, ножиці, сканер, баг.
import { ICONS } from '../../dashboard/src/icons.jsx';
import '../../scooter-cat/src/icons.js';

Object.assign(ICONS, {
  nodes: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8.5 6.2 15.5 6.8M7.2 8.3l3.6 7.4M16.9 9.3l-3.6 6.5" /></>,
  vacuum: <><ellipse cx="12" cy="14" rx="9" ry="5" /><path d="M3 14v1.5c0 2.8 4 5 9 5s9-2.2 9-5V14" /><circle cx="17" cy="12.5" r=".8" /><path d="M9 6.5c1-1.5 5-1.5 6 0" /></>,
  scissors: <><circle cx="6" cy="6.5" r="2.6" /><circle cx="6" cy="17.5" r="2.6" /><path d="M8.2 8 20 18M8.2 16 20 6" /></>,
  scan: <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></>,
  bugs: <><ellipse cx="12" cy="14" rx="4.5" ry="5.5" /><path d="M12 8.5v11M9 6.5a3 3 0 0 1 6 0M4 10l3.6 2M20 10l-3.6 2M4 20l3.8-2.6M20 20l-3.8-2.6M3.5 15h4M20.5 15h-4" /></>,
  seal: <><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><path d="m9.5 15.5 2 2 3.5-3.5" /></>,
});
