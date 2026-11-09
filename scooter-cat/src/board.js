// Рейтинг у браузері: рекорди кожного героя за рівнями, гравець (таємний ключ, нік, надіслані результати),
// стан груп рівнів і звернення до функції рейтингу (/api/scooter/leaderboard). Якщо функція недоступна,
// результати лишаються тут із позначкою «чекає» і йдуть у рейтинг під час наступної спроби.
import { LEVEL_IDS, CHAR_IDS, SCOPE_IDS, SCOPES, DIFF } from './catalog.js';

const PROG = 'bc-scooter-cat-v2', OLD = 'bc-scooter-cat-v1', PLAYER = 'bc-scooter-cat-player';
export const API = '/api/scooter/leaderboard';
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватне вікно */ } };

// ——— рекорди: { v: 2, chars: { cat: { trend: { best, stars, calm } } } } ———
export function loadProgress() {
  let p = read(PROG, null);
  if (!p || !p.chars) {
    // перехід із першої версії: там був один рекорд рівня і герой, яким його зроблено
    p = { v: 2, chars: {} };
    const old = read(OLD, {}) || {};
    for (const [id, r] of Object.entries(old)) {
      if (!r || r.best == null || !LEVEL_IDS.includes(id)) continue;
      const c = CHAR_IDS.includes(r.char) ? r.char : 'cat';
      (p.chars[c] = p.chars[c] || {})[id] = { best: r.best, stars: r.stars || 1, calm: false };
    }
    write(PROG, p);
  }
  for (const c of CHAR_IDS) p.chars[c] = p.chars[c] || {};
  return p;
}

// фініш рівня: рекорд героя, зірки (найбільше з усіх спроб), чи рекорд поставлено в спокійному режимі
export function recordFinish(p, char, id, time, stars, calm) {
  const cur = p.chars[char][id] || {}, better = cur.best == null || time < cur.best;
  p.chars[char][id] = { best: better ? time : cur.best, stars: Math.max(cur.stars || 0, stars), calm: better ? !!calm : !!cur.calm };
  write(PROG, p);
  return { better, old: cur.best == null ? null : cur.best, best: p.chars[char][id].best };
}

// стан групи рівнів для героя
export function scopeStatus(p, char, scope) {
  const ids = SCOPES[scope], rec = p.chars[char] || {};
  const done = ids.filter(id => rec[id] && rec[id].best != null), complete = done.length === ids.length;
  return {
    scope, char, n: ids.length, done: done.length, complete,
    total: complete ? ids.reduce((s, id) => s + rec[id].best, 0) : null,
    stars: done.reduce((s, id) => s + (rec[id].stars || 0), 0),
    calm: done.some(id => rec[id].calm),
    times: complete ? Object.fromEntries(ids.map(id => [id, Math.round(rec[id].best * 1000) / 1000])) : null,
  };
}
export const scopesOf = id => ['d' + DIFF[id], 'all'];

// ——— гравець: таємний ключ (лише в цьому браузері), публічний pid від сервера, нік, надіслані результати ———
function newKey() {
  try { return crypto.randomUUID().replace(/-/g, ''); } catch { return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }
}
export function loadPlayer() {
  let pl = read(PLAYER, null);
  if (!pl || typeof pl.key !== 'string' || pl.key.length < 16) { pl = { key: newKey(), pid: null, nick: '', subs: {} }; write(PLAYER, pl); }
  pl.subs = pl.subs || {};
  return pl;
}
export const savePlayer = pl => write(PLAYER, pl);
const subKey = (scope, char) => scope + ':' + char;
export const subOf = (pl, scope, char) => pl.subs[subKey(scope, char)] || null;

// надіслати групи, які герой пройшов; повертає відповідь сервера або { ok: false, error }
export async function submitScopes(pl, char, list, lang) {
  if (!list.length) return { ok: true, results: [] };
  const body = { key: pl.key, nick: pl.nick, char, lang, entries: list.map(s => ({ scope: s.scope, times: s.times, stars: s.stars, calm: s.calm })) };
  let res = null;
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    res = await r.json().catch(() => null);
    if (!res || typeof res !== 'object') res = { ok: false, error: 'offline' };
  } catch { res = { ok: false, error: 'offline' }; }
  const wait = !res.ok && ['storage', 'offline', 'server'].includes(res.error);
  for (const s of list) {
    const got = res.ok ? (res.results || []).find(x => x.scope === s.scope) : null, prev = subOf(pl, s.scope, char) || {};
    if (res.ok || wait) pl.subs[subKey(s.scope, char)] = { total: got ? got.total : Math.min(s.total, prev.total || Infinity), at: Date.now(), pending: wait, rank: got ? got.rank : prev.rank || null, count: got ? got.count : prev.count || null };
  }
  if (res.ok && res.pid) pl.pid = res.pid;
  savePlayer(pl);
  return res;
}

// групи, що чекають на рейтинг, або пройдені, але кращі за надіслане (наприклад, після рекорду рівня)
export function pendingScopes(pl, p) {
  const out = [];
  if (!pl.nick) return out;
  for (const char of CHAR_IDS) {
    const list = SCOPE_IDS.map(sc => scopeStatus(p, char, sc)).filter(st => {
      const sub = subOf(pl, st.scope, char);
      return st.complete && sub && (sub.pending || st.total < sub.total - 0.005);
    });
    if (list.length) out.push({ char, list });
  }
  return out;
}
export async function flushPending(pl, p, lang) {
  let any = null;
  for (const { char, list } of pendingScopes(pl, p)) any = await submitScopes(pl, char, list, lang);
  return any;
}

// таблиця з сервера
export async function fetchBoard(scope, char, pid, limit = 20) {
  const q = new URLSearchParams({ scope, limit: String(limit) });
  if (char) q.set('char', char);
  if (pid) q.set('pid', pid);
  try {
    const r = await fetch(API + '?' + q, { headers: { accept: 'application/json' } });
    const j = await r.json().catch(() => null);
    return j && typeof j === 'object' ? j : { ok: false, error: 'offline' };
  } catch { return { ok: false, error: 'offline' }; }
}

// посилання на сторінку рейтингу: група, герой (any: усі), за наявності гравець для прев'ю з його місцем
export function boardUrl(prefix, scope, char, pid) {
  const q = new URLSearchParams({ s: scope, c: char || 'any' });
  if (pid) q.set('p', pid);
  return `${location.origin}${prefix}/cases/scooter-cat/rating/?${q}`;
}
