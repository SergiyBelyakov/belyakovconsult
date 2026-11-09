// Запис кадрів гри Scooter Cat для промо: сайт на localhost:8766 (python -m http.server -d site 8766), ?scdebug, автопілот гри.
// Запуск: node scripts/record_scooter_cat.js '[["trend","cat",10,3,5],["season","capy",9,6,5],["waterfall","head",8,3,5],["multiples","cat",10,5,5],["candles","cat",15,0.5,6]]' frames
const { chromium } = require('playwright');
const fs = require('fs');
// SEG: [рівень, герой, швидкість автопілота, пропустити с, записати с]
const SEG = JSON.parse(process.argv[2]);
const OUT = process.argv[3] || 'frames';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8766/en/cases/scooter-cat/?scdebug', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => { const g = window.__sc; const c = document.querySelector('canvas'); return { ok: !!g, W: g && g.W, H: g && g.H, cw: c.width, ch: c.height }; }));
  await p.evaluate(() => {
    const g = window.__sc;
    g._upd = g.update; g._ap = g.autopilot; g.update = () => {}; g.autopilot = () => {}; g.quiet = true;
    window.__step = (v) => { g._ap.call(g, v); g._upd.call(g, 1 / 30); };
  });
  let n = 0;
  for (const [lv, ch, v, skip, rec] of SEG) {
    await p.evaluate(([lv, ch]) => { const g = window.__sc; g.load(lv, ch); g.start(); }, [lv, ch]);
    await p.evaluate(([k, v]) => { for (let i = 0; i < k; i++) window.__step(v); }, [Math.round(skip * 30), v]);
    for (let i = 0; i < Math.round(rec * 30); i++) {
      await p.evaluate((v) => window.__step(v), v);
      await p.waitForTimeout(0);
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
      const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.9));
      fs.writeFileSync(`${OUT}/f${String(n++).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
    }
    console.log(lv, ch, 'frames', n, await p.evaluate(() => { const g = window.__sc; return { state: g.state, x: g.sc.x.toFixed(1), tries: g.tries, time: g.time.toFixed(1) }; }));
  }
  await b.close();
})();
