// Іконки гри: спільний набір + іконки демо аномалій + звук.
import { ICONS } from '../../dashboard/src/icons.jsx';
import '../../anomaly-demo/src/icons.js';

Object.assign(ICONS, {
  sound: <><path d="M4 9.5h4l5-4v13l-5-4H4z" /><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /></>,
  gamepad: <><rect x="2.5" y="7" width="19" height="11" rx="4" /><path d="M7 11v3M5.5 12.5h3" /><circle cx="15.5" cy="11.5" r="1" /><circle cx="18" cy="13.5" r="1" /></>,
  gallery: <><rect x="3" y="3" width="8" height="8" rx="1" /><path d="M5.5 9V7M8.5 9V5.5" /><rect x="13" y="3" width="8" height="8" rx="1" /><path d="m14.5 9 2-2.5 1.5 1.5 1.5-2" /><rect x="3" y="13" width="8" height="8" rx="1" /><circle cx="7" cy="17" r="2.2" /><rect x="13" y="13" width="8" height="8" rx="1" /><circle cx="15.5" cy="18.5" r=".8" /><circle cx="17.5" cy="15.8" r=".8" /><circle cx="19" cy="18" r=".8" /></>,
});
