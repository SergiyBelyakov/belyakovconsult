// Збірка демо транспортної доступності в папку сайту.
//   node transport-demo/build.mjs   → site/cases/transport-accessibility/ (+ /en/, /pt/)
// Спільні компоненти (каркас, скло, кнопки, форма заявки) беруться з dashboard/src.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SITE = join(ROOT, 'site');
const PATH = '/cases/transport-accessibility/';
const OUT = join(SITE, PATH);
const ASSETS = join(OUT, 'assets');
const BASE_URL = 'https://www.belyakovconsult.com';
const OG = '/assets/cases/transport-accessibility-og.jpg';

const nodePaths = [join(HERE, 'node_modules'), join(ROOT, 'dashboard', 'node_modules'), process.env.NODE_PATH, '/opt/npm-tools/node_modules'].filter(p => p && existsSync(p));

rmSync(ASSETS, { recursive: true, force: true });
mkdirSync(ASSETS, { recursive: true });

await build({
  entryPoints: [join(HERE, 'src/main.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths,
  outfile: join(ASSETS, 'app.js'),
  external: ['img/*'],
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
});

mkdirSync(join(ASSETS, 'img'), { recursive: true });
for (const f of ['wave.webp', 'bc-negative.png']) cpSync(join(ROOT, 'dashboard', 'public', 'img', f), join(ASSETS, 'img', f));

const hash = f => createHash('sha1').update(readFileSync(join(ASSETS, f))).digest('hex').slice(0, 10);
const v = { js: hash('app.js'), css: hash('app.css') };

const L = {
  uk: {
    prefix: '', locale: 'uk_UA', html: 'uk',
    title: 'Демо аналізу транспортної доступності | Belyakov Consult',
    description: 'Інтерактивна карта ізохрон на синтетичних даних: час у дорозі до амбулаторії, лікарні і ЦНАП автомобілем, автобусом і пішки, покриття населення, зони обслуговування, сценарії і сигнали.',
    crumbs: ['Belyakov Consult', 'Кейси', 'Демо транспортної доступності'],
    noscript: 'Для роботи демо потрібен JavaScript. Демо показує карту зон транспортної доступності умовної громади, покриття населення, зони обслуговування закладів, сценарії змін мережі і сигнали на синтетичних даних.',
    back: 'Повернутися до кейсів',
  },
  en: {
    prefix: '/en', locale: 'en_GB', html: 'en',
    title: 'Transport accessibility analysis demo | Belyakov Consult',
    description: 'An interactive isochrone map on synthetic data: travel time to primary care, a hospital and an administrative service centre by car, by bus and on foot, population coverage, catchment areas, scenarios and signals.',
    crumbs: ['Belyakov Consult', 'Cases', 'Transport accessibility demo'],
    noscript: 'The demo needs JavaScript. It shows a map of travel time zones in a fictional community, population coverage, facility catchment areas, network scenarios and signals on synthetic data.',
    back: 'Back to cases',
  },
  pt: {
    prefix: '/pt', locale: 'pt_PT', html: 'pt',
    title: 'Demo de análise de acessibilidade de transportes | Belyakov Consult',
    description: 'Mapa interativo de isócronas com dados sintéticos: tempo de viagem até ao centro de saúde, ao hospital e ao balcão público de carro, de autocarro e a pé, cobertura da população, áreas de influência, cenários e sinais.',
    crumbs: ['Belyakov Consult', 'Casos', 'Demo de acessibilidade de transportes'],
    noscript: 'A demo precisa de JavaScript. Mostra um mapa das zonas de tempo de viagem de um município fictício, a cobertura da população, as áreas de influência dos serviços, cenários da rede e sinais com dados sintéticos.',
    back: 'Voltar aos casos',
  },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

for (const [lang, t] of Object.entries(L)) {
  const url = BASE_URL + t.prefix + PATH;
  const og = OG.replace('.jpg', lang === 'uk' ? '.jpg' : `-${lang}.jpg`); // прев'ю мовою сторінки
  const alt = Object.entries(L).map(([l, x]) => `<link rel="alternate" hreflang="${l}" href="${BASE_URL + x.prefix + PATH}"/>`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${BASE_URL + PATH}"/>`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url + '#webpage', url, name: t.title, description: t.description, inLanguage: lang, isPartOf: { '@id': BASE_URL + '/#website' }, primaryImageOfPage: BASE_URL + og },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.crumbs[0], item: BASE_URL + t.prefix + '/' },
        { '@type': 'ListItem', position: 2, name: t.crumbs[1], item: BASE_URL + t.prefix + '/cases/' },
        { '@type': 'ListItem', position: 3, name: t.crumbs[2], item: url },
      ] },
    ],
  };
  const html = `<!DOCTYPE html>
<html lang="${t.html}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<meta name="author" content="Sergiy Belyakov"/>
<meta name="theme-color" content="#05070A"/>
<meta name="color-scheme" content="dark"/>
<link rel="canonical" href="${url}"/>
${alt}
<meta property="og:locale" content="${t.locale}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Belyakov Consult"/>
<meta property="og:title" content="${esc(t.title)}"/>
<meta property="og:description" content="${esc(t.description)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${BASE_URL + og}"/>
<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(t.title)}"/>
<meta name="twitter:description" content="${esc(t.description)}"/>
<meta name="twitter:image" content="${BASE_URL + og}"/>
<link rel="icon" href="/favicon.ico" sizes="48x48"/><link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png"/><link rel="icon" href="/assets/favicon-192.png" sizes="192x192" type="image/png"/><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Montserrat:wght@600;700&amp;display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="${PATH}assets/app.css?v=${v.css}"/>
<link rel="preload" as="image" href="${PATH}assets/img/wave.webp"/>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<div id="root" data-site="1"><noscript><div style="max-width:640px;margin:15vh auto;padding:0 20px;font:16px/1.6 Inter,Arial,sans-serif;color:#F4F6F8"><h1 style="font:700 28px Montserrat,Arial,sans-serif">${esc(t.crumbs[2])}</h1><p>${esc(t.noscript)}</p><p><a style="color:#F4F6F8" href="${t.prefix}/cases/">${esc(t.back)}</a></p></div></noscript></div>
<script defer data-transport-demo src="${PATH}assets/app.js?v=${v.js}"></script>
</body>
</html>
`;
  const dir = join(SITE, t.prefix, PATH);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  console.log('page', t.prefix + PATH);
}
