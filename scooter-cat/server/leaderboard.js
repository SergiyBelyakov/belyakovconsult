// Рейтинг гри «Котик на самокаті» на Cloudflare Pages Functions з базою D1.
// Прив'язка бази в налаштуваннях проєкту Pages: змінна SCOOTER_DB. Таблиці створюються самі під час першого звернення.
// Без прив'язки функція відповідає { ok: false, error: 'storage' }, а гра тримає результати в браузері й надішле їх пізніше.
//
// GET  /api/scooter/leaderboard?scope=all|d1|d2|d3&char=cat|capy|head&pid=…&limit=20  → таблиця
// POST /api/scooter/leaderboard  { key, nick, char, lang, entries: [{ scope, times: { рівень: с }, stars, calm }] }
// Гравця визначає таємний ключ із браузера; публічний pid це хеш ключа, тож чужий результат за посиланням не переписати.
// Модерація: у консолі D1 «UPDATE scooter_scores SET hidden = 1 WHERE nick = '…'» ховає запис із рейтингу.
import { CHAR_IDS, SCOPE_IDS, SCOPES, FLOOR, CEIL, cleanNick } from '../src/catalog.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scooter_scores (
    pid TEXT NOT NULL, scope TEXT NOT NULL, char TEXT NOT NULL, nick TEXT NOT NULL,
    total REAL NOT NULL, stars INTEGER NOT NULL, calm INTEGER NOT NULL DEFAULT 0, times TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'uk', hidden INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL,
    PRIMARY KEY (pid, scope, char))`,
  'CREATE INDEX IF NOT EXISTS scooter_scores_char ON scooter_scores (scope, char, total)',
  'CREATE INDEX IF NOT EXISTS scooter_scores_all ON scooter_scores (scope, total)',
  'CREATE TABLE IF NOT EXISTS scooter_hits (ip TEXT NOT NULL, t INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS scooter_hits_ip ON scooter_hits (ip, t)',
];
const RATE = 40;   // надсилань з однієї адреси за годину

let ready = null;
function schema(db) {
  if (!ready) ready = db.batch(SCHEMA.map(q => db.prepare(q))).catch(e => { ready = null; throw e; });
  return ready;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
});
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const pidOf = async key => (await sha('scooter-player|' + key)).slice(0, 20);
const PID = /^[0-9a-f]{20}$/;
const r2 = v => Math.round(v * 100) / 100;

// фільтр таблиці: група, за потреби герой, без прихованих записів
function filter(scope, char) {
  return char ? { sql: 'scope = ? AND char = ? AND hidden = 0', args: [scope, char] } : { sql: 'scope = ? AND hidden = 0', args: [scope] };
}
async function placeOf(db, scope, char, total) {
  const f = filter(scope, char);
  const [a, b] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM scooter_scores WHERE ${f.sql} AND total < ?`).bind(...f.args, total),
    db.prepare(`SELECT COUNT(*) AS n FROM scooter_scores WHERE ${f.sql}`).bind(...f.args),
  ]);
  return { rank: a.results[0].n + 1, count: b.results[0].n };
}

export async function getBoard(request, env) {
  const db = env && env.SCOOTER_DB;
  if (!db) return json({ ok: false, error: 'storage' });
  try {
    const u = new URL(request.url), q = k => u.searchParams.get(k) || '';
    const scope = SCOPE_IDS.includes(q('scope')) ? q('scope') : 'all';
    const char = CHAR_IDS.includes(q('char')) ? q('char') : null;
    const limit = Math.max(1, Math.min(100, parseInt(q('limit'), 10) || 20));
    const pid = PID.test(q('pid')) ? q('pid') : null;
    await schema(db);
    const f = filter(scope, char);
    const [rows, cnt] = await db.batch([
      db.prepare(`SELECT pid, nick, char, total, stars, calm, RANK() OVER (ORDER BY total) AS rank FROM scooter_scores WHERE ${f.sql} ORDER BY total, updated LIMIT ${limit}`).bind(...f.args),
      db.prepare(`SELECT COUNT(*) AS n FROM scooter_scores WHERE ${f.sql}`).bind(...f.args),
    ]);
    let me = null;
    if (pid) {
      const mine = await db.prepare(`SELECT nick, char, total, stars, calm FROM scooter_scores WHERE pid = ? AND ${f.sql} ORDER BY total LIMIT 1`).bind(pid, ...f.args).first();
      if (mine) me = { ...mine, total: r2(mine.total), calm: !!mine.calm, ...(await placeOf(db, scope, char, mine.total)) };
    }
    return json({
      ok: true, scope, char, count: cnt.results[0].n, me,
      rows: rows.results.map(r => ({ rank: r.rank, nick: r.nick, char: r.char, total: r2(r.total), stars: r.stars, calm: !!r.calm, me: !!pid && r.pid === pid })),
    });
  } catch (e) {
    return json({ ok: false, error: 'server' }, 500);
  }
}

export async function submitScore(request, env) {
  const db = env && env.SCOOTER_DB;
  if (!db) return json({ ok: false, error: 'storage' });
  try {
    if (!(request.headers.get('content-type') || '').includes('application/json')) return json({ ok: false, error: 'type' }, 415);
    const text = await request.text();
    if (text.length > 6000) return json({ ok: false, error: 'size' }, 413);
    let b;
    try { b = JSON.parse(text); } catch { return json({ ok: false, error: 'json' }, 400); }
    const key = typeof b.key === 'string' && /^[A-Za-z0-9]{16,64}$/.test(b.key) ? b.key : null;
    if (!key) return json({ ok: false, error: 'key' }, 400);
    const nick = cleanNick(b.nick);
    if (!nick.ok) return json({ ok: false, error: 'nick', why: nick.why }, 422);
    const char = CHAR_IDS.includes(b.char) ? b.char : null;
    if (!char) return json({ ok: false, error: 'char' }, 400);
    const lang = b.lang === 'en' ? 'en' : 'uk';
    const list = Array.isArray(b.entries) ? b.entries.slice(0, 4) : [];
    const entries = [];
    for (const e of list) {
      if (!e || !SCOPE_IDS.includes(e.scope) || entries.some(x => x.scope === e.scope)) return json({ ok: false, error: 'scope' }, 400);
      const ids = SCOPES[e.scope], t = e.times || {};
      if (Object.keys(t).length !== ids.length) return json({ ok: false, error: 'times' }, 400);
      let total = 0;
      for (const id of ids) {
        const v = Number(t[id]);
        if (!Number.isFinite(v) || v < FLOOR[id] || v > CEIL) return json({ ok: false, error: 'times', level: id }, 422);
        total += v;
      }
      const stars = Math.max(ids.length, Math.min(3 * ids.length, Math.round(Number(e.stars)) || ids.length));
      entries.push({ scope: e.scope, total: r2(total), stars, calm: e.calm ? 1 : 0, times: JSON.stringify(Object.fromEntries(ids.map(id => [id, r2(Number(t[id]))]))) });
    }
    if (!entries.length) return json({ ok: false, error: 'entries' }, 400);
    await schema(db);
    // захист від засмічення: не більше RATE надсилань з однієї адреси за годину (адреса лише як хеш, хеші живуть добу)
    const now = Math.floor(Date.now() / 1000);
    const ip = (await sha('scooter-ip|' + (request.headers.get('cf-connecting-ip') || 'local') + '|' + ((env && env.SCOOTER_SALT) || ''))).slice(0, 16);
    const hits = await db.prepare('SELECT COUNT(*) AS n FROM scooter_hits WHERE ip = ? AND t > ?').bind(ip, now - 3600).first();
    if (hits && hits.n >= RATE) return json({ ok: false, error: 'rate' }, 429);
    const pid = await pidOf(key);
    const ops = [db.prepare('INSERT INTO scooter_hits (ip, t) VALUES (?, ?)').bind(ip, now)];
    if (Math.random() < 0.05) ops.push(db.prepare('DELETE FROM scooter_hits WHERE t < ?').bind(now - 86400));
    for (const e of entries) {
      ops.push(db.prepare(`INSERT INTO scooter_scores (pid, scope, char, nick, total, stars, calm, times, lang, created, updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (pid, scope, char) DO UPDATE SET
          nick = excluded.nick, lang = excluded.lang, updated = excluded.updated,
          stars = MAX(scooter_scores.stars, excluded.stars),
          calm = CASE WHEN excluded.total < scooter_scores.total THEN excluded.calm ELSE scooter_scores.calm END,
          times = CASE WHEN excluded.total < scooter_scores.total THEN excluded.times ELSE scooter_scores.times END,
          total = MIN(scooter_scores.total, excluded.total)`).bind(pid, e.scope, char, nick.nick, e.total, e.stars, e.calm, e.times, lang, now, now));
    }
    ops.push(db.prepare('UPDATE scooter_scores SET nick = ? WHERE pid = ?').bind(nick.nick, pid));   // один нік на всі записи гравця
    await db.batch(ops);
    const results = [];
    for (const e of entries) {
      const row = await db.prepare('SELECT total, hidden FROM scooter_scores WHERE pid = ? AND scope = ? AND char = ?').bind(pid, e.scope, char).first();
      const mine = await placeOf(db, e.scope, char, row.total), all = await placeOf(db, e.scope, null, row.total);
      results.push({ scope: e.scope, total: r2(row.total), best: e.total <= row.total, hidden: !!row.hidden, rank: mine.rank, count: mine.count, rankAll: all.rank, countAll: all.count });
    }
    return json({ ok: true, pid, nick: nick.nick, char, results });
  } catch (e) {
    return json({ ok: false, error: 'server' }, 500);
  }
}

// ——— посилання на рейтинг із карткою: заголовок і опис прев'ю з місцем гравця ———
const NAMES = {
  uk: { scope: { d1: 'легкі траси', d2: 'середні траси', d3: 'складні траси', all: 'усі 12 трас' }, char: { cat: 'котик на самокаті', capy: 'капібара на скейті', head: 'голова аналітика на моноколесі' } },
  en: { scope: { d1: 'easy tracks', d2: 'medium tracks', d3: 'hard tracks', all: 'all 12 tracks' }, char: { cat: 'Scooter Cat', capy: 'Skateboard Capybara', head: 'Head of Analytics on a unicycle' } },
};
export function fmtTime(s, lang) {
  const m = Math.floor(s / 60), r = s - m * 60, d = r.toFixed(1);
  return `${m}:${r < 10 ? '0' : ''}${lang === 'en' ? d : d.replace('.', ',')}`;
}
export async function shareMeta(request, env, lang) {
  const db = env && env.SCOOTER_DB;
  if (!db) return null;
  const u = new URL(request.url), pid = u.searchParams.get('p') || '', scope = u.searchParams.get('s') || '', c = u.searchParams.get('c') || '';
  if (!PID.test(pid) || !SCOPE_IDS.includes(scope)) return null;
  const char = CHAR_IDS.includes(c) ? c : null;
  await schema(db);
  const f = filter(scope, char);
  const row = await db.prepare(`SELECT nick, char, total FROM scooter_scores WHERE pid = ? AND ${f.sql} ORDER BY total LIMIT 1`).bind(pid, ...f.args).first();
  if (!row) return null;
  const { rank, count } = await placeOf(db, scope, char, row.total), N = NAMES[lang] || NAMES.uk, time = fmtTime(row.total, lang);
  return lang === 'en'
    ? { title: `${row.nick}: #${rank} of ${count} on the Scooter Cat leaderboard`, description: `${N.scope[scope][0].toUpperCase() + N.scope[scope].slice(1)}, ${N.char[row.char]}: ${time}. Try to beat it in a game about reading charts by Belyakov Consult.`, url: u.toString() }
    : { title: `${row.nick}: місце ${rank} з ${count} у рейтингу «Котика на самокаті»`, description: `${N.scope[scope][0].toUpperCase() + N.scope[scope].slice(1)}, ${N.char[row.char]}: ${time}. Спробуйте обігнати в грі про читання графіків від Belyakov Consult.`, url: u.toString() };
}
// сторінка рейтингу: статичний HTML, а для посилання гравця (?p=…) прев'ю з його місцем
export async function rewriteShare(ctx, lang) {
  const res = await ctx.next();
  let meta = null;
  try { meta = await shareMeta(ctx.request, ctx.env, lang); } catch { meta = null; }
  if (!meta || typeof HTMLRewriter === 'undefined' || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  const set = v => ({ element: el => el.setAttribute('content', v) });
  return new HTMLRewriter()
    .on('meta[property="og:title"]', set(meta.title)).on('meta[name="twitter:title"]', set(meta.title))
    .on('meta[property="og:description"]', set(meta.description)).on('meta[name="twitter:description"]', set(meta.description))
    .on('meta[property="og:url"]', set(meta.url))
    .transform(res);
}
