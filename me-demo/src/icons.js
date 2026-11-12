// Додаткові іконки демо M&E: реєструються в спільному наборі дашборду.
import { ICONS } from '../../dashboard/src/icons.jsx';
import '../../community-twin/src/icons.js';
import '../../exec-demo/src/icons.js';

Object.assign(ICONS, {
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
});
