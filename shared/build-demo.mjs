// Спільна збірка демо Лабораторії даних за маніфестом shared/demos.json.
//   node shared/build-demo.mjs                  → усі демо
//   node shared/build-demo.mjs graph-analytics  → одне демо
// Кожне демо: esbuild збирає <dir>/src/main.jsx в site/cases/<slug>/assets/app.{js,css},
// копіюються статичні файли, а для кожної мови з маніфесту пишеться index.html
// (мета-теги, hreflang, Open Graph мовою сторінки, хлібні крихти, noscript).
// Спільні компоненти (каркас, скло, кнопки, форма заявки) лежать у dashboard/src.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const BASE_URL = 'https://www.belyakovconsult.com';
export const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'shared', 'demos.json'), 'utf8'));

// Спільне для всіх демо за мовами
const LANG = {
  uk: { prefix: '', locale: 'uk_UA', html: 'uk', lab: 'Лабораторія даних', back: 'Повернутися до лабораторії' },
  en: { prefix: '/en', locale: 'en_GB', html: 'en', lab: 'Data Lab', back: 'Back to the Data Lab' },
  pt: { prefix: '/pt', locale: 'pt_PT', html: 'pt', lab: 'Laboratório de dados', back: 'Voltar ao laboratório' },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export async function buildDemo(demo) {
  const PATH = `/cases/${demo.slug}/`;
  const OUT = join(SITE, PATH);
  const ASSETS = join(OUT, 'assets');
  const OG = `/assets/cases/${demo.slug}-og.jpg`;
  const nodePaths = [join(ROOT, demo.dir, 'node_modules'), join(ROOT, 'dashboard', 'node_modules'), process.env.NODE_PATH, '/opt/npm-tools/node_modules'].filter(p => p && existsSync(p));

  rmSync(ASSETS, { recursive: true, force: true });
  mkdirSync(ASSETS, { recursive: true });
  await build({
    entryPoints: [join(ROOT, demo.build.entry)],
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
    ...(demo.build.charset ? { charset: demo.build.charset } : {}),
    logLevel: 'info',
  });
  for (const [from, to] of demo.build.copy) {
    const dest = join(ASSETS, to);
    mkdirSync(to.includes('.') && to !== '.' ? dirname(dest) : dest, { recursive: true });
    cpSync(join(ROOT, from), dest, { recursive: true });
  }

  const hash = f => createHash('sha1').update(readFileSync(join(ASSETS, f))).digest('hex').slice(0, 10);
  const v = { js: hash('app.js'), css: hash('app.css') };
  const langs = demo.langs.filter(l => demo.lang[l]);

  for (const lang of langs) {
    const t = { ...LANG[lang], ...demo.lang[lang] };
    const crumbs = ['Belyakov Consult', t.lab, t.name];
    const url = BASE_URL + t.prefix + PATH;
    const og = OG.replace('.jpg', lang === 'uk' ? '.jpg' : `-${lang}.jpg`); // прев'ю мовою сторінки
    const alt = langs.map(l => `<link rel="alternate" hreflang="${l}" href="${BASE_URL + LANG[l].prefix + PATH}"/>`).join('\n') +
      `\n<link rel="alternate" hreflang="x-default" href="${BASE_URL + PATH}"/>`;
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': url + '#webpage', url, name: t.title, description: t.description, inLanguage: lang, isPartOf: { '@id': BASE_URL + '/#website' }, primaryImageOfPage: BASE_URL + og },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: crumbs[0], item: BASE_URL + t.prefix + '/' },
          { '@type': 'ListItem', position: 2, name: crumbs[1], item: BASE_URL + t.prefix + '/cases/' },
          { '@type': 'ListItem', position: 3, name: crumbs[2], item: url },
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
<div id="root" data-site="1"><noscript><div style="max-width:640px;margin:15vh auto;padding:0 20px;font:16px/1.6 Inter,Arial,sans-serif;color:#F4F6F8"><h1 style="font:700 28px Montserrat,Arial,sans-serif">${esc(crumbs[2])}</h1><p>${esc(t.noscript)}</p><p><a style="color:#F4F6F8" href="${t.prefix}/cases/">${esc(t.back)}</a></p></div></noscript></div>
<script defer ${demo.attr} src="${PATH}assets/app.js?v=${v.js}"></script>
</body>
</html>
`;
    const dir = join(SITE, t.prefix, PATH);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    console.log('page', t.prefix + PATH);
  }
}

// Запуск із командного рядка
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const only = process.argv.slice(2);
  const list = MANIFEST.demos.filter(d => d.status === 'live' && (!only.length || only.includes(d.slug)));
  if (!list.length) { console.error('Немає демо з такою назвою:', only.join(', ')); process.exit(1); }
  for (const d of list) await buildDemo(d);
}
