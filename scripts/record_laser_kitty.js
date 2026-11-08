// Запис кадрів гри Laser Kitty для трейлера: сайт на localhost:8765 (python -m http.server -d site 8765), ?lkdebug, автопілот.
// Запуск: node scripts/record_laser_kitty.js '[[1,0,9],[3,5,7],[5,3,16]]'  (кадри в ./frames)
const { chromium } = require('playwright');
const fs = require('fs');
// сегменти: [рівень, пропустити секунд гри без запису, записати секунд]
const SEG = JSON.parse(process.argv[2] || '[[1,0,8],[3,4,7],[5,2,14]]');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8765/en/cases/laser-kitty/?lkdebug', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.getByRole('button', { name: 'Play', exact: true }).click();
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Start level' }).click();
  await p.waitForTimeout(300);
  await p.keyboard.press('p');                     // React-цикл лише малює, кроки симуляції робимо самі
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const KIND = { err: 'laser', fix: 'fix', dup: 'merge' };
    window.__step = (dt) => {
      const g = window.__lk;
      if (g.phase === 'play' && g.dead <= 0) {
        if (g.pipe && g.megaReady && !g.pipe.sealed) g.fire('mega');
        const live = g.bugs.filter(b => b.phase === 'form' || b.phase === 'dive');
        const front = b => !live.some(o => o !== b && o.y > b.y + 4 && Math.abs(o.x - b.x) < g.hitW + 6);
        let cand;
        if (g.tag && g.tag.phase !== 'gone' && g.tag.phase !== 'clean') cand = live.filter(b => b.rec.id === g.tag.rec.pair && front(b));
        if (!cand || !cand.length) cand = live.filter(b => b.rec.kind !== 'ok' && !b.rec.orphan && front(b) && (b.rec.kind !== 'dup' || !g.tag));
        cand.sort((a, c) => (c.phase === 'dive') - (a.phase === 'dive') || Math.abs(a.x - g.kx) - Math.abs(c.x - g.kx));
        const t = cand[0];
        if (t) {
          g.target = t.x;
          if (Math.abs(g.kx - t.x) < 5) g.fire(KIND[t.rec.kind] || 'laser');
        } else g.target = g.W / 2 + Math.sin(g.t) * 120;
      }
      g.update(dt);
      g.draw(document.querySelector('canvas').getContext('2d'));
    };
  });
  let n = 0;
  for (const [lv, skip, rec] of SEG) {
    await p.evaluate((lv) => window.__lk.startLevel(lv, 7), lv);
    await p.evaluate((k) => { for (let i = 0; i < k; i++) window.__step(1 / 30); }, Math.round(skip * 30));
    for (let i = 0; i < Math.round(rec * 30); i++) {
      const data = await p.evaluate(() => { window.__step(1 / 30); return document.querySelector('canvas').toDataURL('image/jpeg', 0.92); });
      fs.writeFileSync(`frames/f${String(n++).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
    }
    console.log('level', lv, 'frames', n, await p.evaluate(() => { const g = window.__lk; return { score: g.score, phase: g.phase, sealed: g.pipe && g.pipe.sealed, q: g.summary(false).quality.toFixed(2) }; }));
  }
  await b.close();
})();
