// Іконки гри: спільний набір, іконки «Лазерного кошеняти» (звук, геймпад, галерея) і нахил котика.
import { ICONS } from '../../dashboard/src/icons.jsx';
import '../../laser-kitty/src/icons.js';

Object.assign(ICONS, {
  'lean-back': <><path d="M7 15a7 7 0 1 1 3 4.5" /><path d="M3.5 12.5 7 15.5l3-3.5" /></>,
  'lean-fwd': <><path d="M17 15a7 7 0 1 0-3 4.5" /><path d="m20.5 12.5-3.5 3-3-3.5" /></>,
  'pedal-gas': <><path d="M12 5 19 17H5z" /></>,
  'pedal-brake': <><path d="M12 19 5 7h14z" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  scooter: <><circle cx="5.5" cy="17.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" /><path d="M8 17.5h7l2-12h3M15.5 5.5h-2" /></>,
  kitty: <><path d="M5 9 4 3.5 9 6.5a8 8 0 0 1 6 0l5-3-1 5.5a7.5 7.5 0 1 1-14 0Z" /><circle cx="9.5" cy="12.5" r=".6" /><circle cx="14.5" cy="12.5" r=".6" /><path d="M11 15.5h2l-1 1z" /></>,
  trophy: <><path d="M8 21h8M12 16.5V21M7 3.5h10V9a5 5 0 0 1-10 0Z" /><path d="M7 5.5H4.5a3 3 0 0 0 3 4.5M17 5.5h2.5a3 3 0 0 1-3 4.5" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></>,
});
