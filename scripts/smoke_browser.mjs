// Перевірка сайту в справжньому браузері: ключові сторінки трьома мовами й усі демо.
// Ловить помилки JavaScript, відсутні файли нашого сайту і демо, що не відмалювалися.
//
// Запуск: node scripts/smoke_browser.mjs          (сам піднімає локальний сервер з site/)
// Потрібен Playwright з Chromium: npm i playwright && npx playwright install --with-deps chromium
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const LANGS = ['', '/en', '/pt'];
const PAGES = ['/', '/cases/', '/sergiy-belyakov/', '/insights/', '/data-strategy/', '/financial-analytics/'];
// демо беруться з маніфесту Лабораторії даних; кожне перевіряється мовами, які в нього є
const MANIFEST = JSON.parse(readFileSync(fileURLToPath(new URL('../shared/demos.json', import.meta.url)), 'utf8'));
const DEMO_URLS = MANIFEST.demos.filter(d => d.status === 'live').flatMap(d => d.langs.map(l => ({ uk: '', en: '/en', pt: '/pt' })[l] + `/cases/${d.slug}/`));
const DEMOS = MANIFEST.demos.map(d => `/cases/${d.slug}/`);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };

const server = createServer((req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let f = join(SITE, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(SITE) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const problems = [];
const urls = [...LANGS.flatMap(l => PAGES.map(p => l + p)), '/data-journey/', '/en/data-journey/', ...DEMO_URLS];

for (const path of urls) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const bad = [];
  page.on('pageerror', e => bad.push(`помилка JS: ${e.message.split('\n')[0]}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) bad.push(`console.error: ${m.text().slice(0, 160)}`); });
  page.on('response', r => { if (r.url().startsWith(ORIGIN) && r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(ORIGIN.length)}`); });
  try {
    const resp = await page.goto(ORIGIN + path, { waitUntil: 'load', timeout: 30000 });
    if (!resp || resp.status() !== 200) bad.push(`сторінка відповіла ${resp && resp.status()}`);
    await page.waitForTimeout(800);
    if (DEMOS.some(d => path.endsWith(d))) {
      // демо має відмалювати інтерфейс: у #root щось більше за <noscript>
      const ok = await page.waitForFunction(() => {
        const r = document.getElementById('root');
        return r && [...r.children].some(c => c.tagName !== 'NOSCRIPT') && r.innerText.trim().length > 200;
      }, null, { timeout: 15000 }).then(() => true, () => false);
      if (!ok) bad.push('демо не відмалювалося');
    } else if (!(await page.locator('h1').count())) bad.push('немає h1');
  } catch (e) { bad.push(`не відкрилася: ${e.message.split('\n')[0]}`); }
  if (bad.length) problems.push(`${path}\n  ${[...new Set(bad)].join('\n  ')}`);
  else console.log('ok', path);
  await page.close();
}

await browser.close();
server.close();
if (problems.length) {
  console.log(`\nSmoke у браузері: проблеми на ${problems.length} сторінках\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`\nSmoke у браузері: ок, ${urls.length} сторінок`);
