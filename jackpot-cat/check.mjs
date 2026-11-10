// Перевірка математики гри «Котячий джекпот» без браузера: node jackpot-cat/check.mjs
// Запускати після будь-яких змін у стрічках, таблиці виплат чи дослідах (engine.js, lessons.js):
// тексти гри й статей спираються на ці числа (повернення 92,0%, аудит 1 з 1000, правильні відповіді прогнозів).
import assert from 'node:assert/strict';
import { MACHINES, KIND, simulate, spin, mulberry } from './src/engine.js';
import { Slot } from './src/game.js';
import { LESSON_IDS, LESSONS, correct, facts, newRun, feed, debrief } from './src/lessons.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} проти ${b}`);
for (const id of ['cat', 'capy']) {
  const M = MACHINES[id], S = M.stats;
  assert.deepEqual(M.L, [20, 20, 20], `${id}: стрічки по 20 позицій`);
  near(S.rtp, 0.92, 1e-9, `${id}: повернення 92,0%`);
  near(S.pAudit, 0.001, 1e-12, `${id}: аудит 1 з 1000`);
  near(S.rows.reduce((s, r) => s + r.contrib, 0), S.rtp, 1e-12, `${id}: внески рядків дають повернення`);
  // рушій обертів збігається з таблицями: 2 млн обертів
  const rand = mulberry(11); let paid = 0, audits = 0; const n = 2e6;
  for (let i = 0; i < n; i++) { const r = spin(M, rand); paid += r.pay; if (r.kind === KIND.audit) audits++; }
  near(paid / n, S.rtp, 0.012, `${id}: повернення в симуляції`);
  near(audits / n, S.pAudit, 0.0002, `${id}: частота аудиту в симуляції`);
}
assert.ok(MACHINES.cat.stats.sd > 2 * MACHINES.capy.stats.sd, '«Котик» має бути значно ризиковішим за «Капібару»');
near(MACHINES.cat.stats.pCatScreen / MACHINES.cat.stats.pCatLine, 27, 1e-9, 'три котики на екрані у 27 разів частіше, ніж на лінії');

// правильні відповіді прогнозів: якщо змінилися, перечитайте варіанти в i18n.js
assert.deepEqual(LESSON_IDS.map(correct), [1, 1, 1, 2, 1, 2], 'індекси правильних відповідей');
const f = facts();
assert.equal(f.evBack, 28); assert.equal(f.auditOdds, 1000); assert.equal(f.by1000, 63); assert.equal(f.nearRatio, 25);

// кожен дослід проходиться на справжній сесії й дає розбір без NaN
for (const id of LESSON_IDS) {
  const s = new Slot({ seed: 42 }), run = newRun(id);
  s.setMachine(LESSONS[id].machine);
  for (let guard = 0; !run.done && guard < 200000; guard++) {
    if (!s.canSpin()) { s.refill(); run.refills++; }
    if (id === 'risk' && run.by.capy.n >= LESSONS.risk.each) s.setMachine('cat');
    feed(run, s.spin());
  }
  assert.ok(run.done, `${id}: дослід завершується`);
  JSON.stringify(debrief(run), (k, v) => { if (typeof v === 'number') assert.ok(Number.isFinite(v), `${id}: ${k} не число`); return ArrayBuffer.isView(v) ? undefined : v; });
}
// баланс і каса сходяться: кредити = 100 + докинуте − каса автомата
{
  const s = new Slot({ seed: 7 });
  for (let i = 0; i < 50000; i++) { if (!s.canSpin()) s.refill(); s.spin(); }
  assert.equal(s.credits, 100 + s.v.refills * 100 - s.take, 'баланс і каса автомата сходяться');
  assert.ok(s.v.audits > 20, 'за 50 000 обертів аудит приходить десятки разів');
}
const { net } = simulate(MACHINES.cat, { players: 1000, spins: 100, seed: 1 });
assert.equal(net.length, 1000);
console.log('Математика гри в порядку: повернення 92,0% на обох автоматах, аудит 1 з 1000, шість дослідів проходяться.');
