// Збірка гри «Котик на самокаті»: спільна збірка демо за маніфестом, а потім сторінка рейтингу
// (/cases/scooter-cat/rating/ і /en/…) з тієї самої збірки: свої заголовок, опис, картка прев'ю і data-view="rating".
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'scooter-cat'));

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const BASE = 'https://www.belyakovconsult.com';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const RATING = {
  uk: {
    prefix: '', og: '/assets/cases/scooter-cat-rating-og.jpg', lab: 'Лабораторія даних', game: 'Котик на самокаті: проїдь графік', back: 'Повернутися до гри',
    title: 'Рейтинг гравців: Котик на самокаті | Belyakov Consult', name: 'Рейтинг гравців «Котика на самокаті»',
    description: 'Хто найшвидше проїде графіки: рейтинг гри «Котик на самокаті» для кожного героя, легких, середніх і складних трас, пекельних трас Адіща і всіх 12 основних рівнів разом.',
    noscript: 'Рейтинг працює з увімкненим JavaScript. Увімкніть його, щоб побачити найшвидших гравців і своє місце.',
  },
  en: {
    prefix: '/en', og: '/assets/cases/scooter-cat-rating-og-en.jpg', lab: 'Data Lab', game: 'Scooter Cat: Ride the Chart', back: 'Back to the game',
    title: 'Leaderboard: Scooter Cat | Belyakov Consult', name: 'Scooter Cat leaderboard',
    description: 'Who rides the charts fastest: the Scooter Cat leaderboard for each rider, for the easy, medium and hard tracks, the Hell tracks and all 12 main levels together.',
    noscript: 'The leaderboard needs JavaScript. Turn it on to see the fastest players and your place.',
  },
};

for (const [lang, t] of Object.entries(RATING)) {
  const game = `${t.prefix}/cases/scooter-cat/`, path = `${game}rating/`, url = BASE + path;
  let h = readFileSync(join(SITE, game, 'index.html'), 'utf8');
  const sub = (re, to) => { if (!re.test(h)) throw new Error('немає в шаблоні: ' + re); h = h.replace(re, to); };
  sub(/<title>[^<]*<\/title>/, `<title>${esc(t.title)}</title>`);
  for (const [attr, key] of [['name', 'description'], ['property', 'og:description'], ['name', 'twitter:description']]) sub(new RegExp(`<meta ${attr}="${key}" content="[^"]*"/>`), `<meta ${attr}="${key}" content="${esc(t.description)}"/>`);
  for (const [attr, key] of [['property', 'og:title'], ['name', 'twitter:title']]) sub(new RegExp(`<meta ${attr}="${key}" content="[^"]*"/>`), `<meta ${attr}="${key}" content="${esc(t.title)}"/>`);
  for (const [attr, key] of [['property', 'og:image'], ['name', 'twitter:image']]) sub(new RegExp(`<meta ${attr}="${key}" content="[^"]*"/>`), `<meta ${attr}="${key}" content="${BASE + t.og}"/>`);
  // канонічна адреса, мовні версії й og:url ведуть на сторінку рейтингу
  sub(/(https:\/\/www\.belyakovconsult\.com(?:\/en)?\/cases\/scooter-cat\/)"/g, '$1rating/"');
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url + '#webpage', url, name: t.title, description: t.description, inLanguage: lang, isPartOf: { '@id': BASE + '/#website' }, primaryImageOfPage: BASE + t.og },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Belyakov Consult', item: BASE + t.prefix + '/' },
      { '@type': 'ListItem', position: 2, name: t.lab, item: BASE + t.prefix + '/cases/' },
      { '@type': 'ListItem', position: 3, name: t.game, item: BASE + game },
      { '@type': 'ListItem', position: 4, name: t.name, item: url },
    ] },
  ] };
  sub(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  sub(/<div id="root" data-site="1">/, '<div id="root" data-site="1" data-view="rating">');
  sub(/<noscript>[\s\S]*?<\/noscript>/, `<noscript><div style="max-width:640px;margin:15vh auto;padding:0 20px;font:16px/1.6 Inter,Arial,sans-serif;color:#F4F6F8"><h1 style="font:700 28px Montserrat,Arial,sans-serif">${esc(t.name)}</h1><p>${esc(t.noscript)}</p><p><a style="color:#F4F6F8" href="${game}">${esc(t.back)}</a></p></div></noscript>`);
  mkdirSync(join(SITE, path), { recursive: true });
  writeFileSync(join(SITE, path, 'index.html'), h);
  console.log('page', path);
}
