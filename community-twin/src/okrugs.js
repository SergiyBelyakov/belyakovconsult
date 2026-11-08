// Старостинські округи умовної громади «Велика Рута»: які населені пункти до них належать.
// Спільне для зрізу даних (snapshot.mjs) і моделі двійника.
export const OKRUGS = [
  { id: 'city', center: 'vrc', places: ['vrc', 'vrn', 'vrw', 'vre'] },
  { id: 'dub', center: 'dub', places: ['dub', 'ver', 'sos', 'lis', 'hly'] },
  { id: 'yas', center: 'yas', places: ['yas', 'lyp', 'ter', 'buz'] },
  { id: 'kle', center: 'kle', places: ['kle', 'sta', 'hai'] },
  { id: 'yab', center: 'yab', places: ['yab', 'mal', 'kov', 'vys'] },
  { id: 'luh', center: 'luh', places: ['luh', 'zap', 'ste'] },
  { id: 'ber', center: 'ber', places: ['ber', 'ost', 'lis2', 'mez'] },
  { id: 'yan', center: 'yan', places: ['yan', 'pid', 'vrr'] },
  { id: 'kal', center: 'kal', places: ['kal', 'top'] },
  { id: 'oze', center: 'oze', places: ['oze', 'luk', 'zal'] },
];
export const OKRUG_OF = Object.fromEntries(OKRUGS.flatMap(o => o.places.map(p => [p, o.id])));
