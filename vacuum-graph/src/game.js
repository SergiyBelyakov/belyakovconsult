// Рушій гри «Пилосос і граф»: лабіринт-граф, рух коридорами як у Pac-Man (буфер повороту на вузлі),
// дії пилососа (втягнути, розрізати, сканер, закрити джерело), баги-привиди, капсула капібари,
// облік рішень для розбору й живий підрахунок мостів і компонент справжнього графа.
// Координати моделі в одиницях сітки (7×4), на екран переводить layout(); малювання в draw.js.
import { LEVELS, place, TEST_NAMES, variantName, PLACEHOLDERS } from './levels.js';
import { articulation, components, shortest, rng } from './graph.js';
import { BUG_COLS } from './sprites.js';
import { sfx } from './audio.js';
import { drawGame } from './draw.js';

const SPEED = 1.25;    // швидкість пилососа, одиниць сітки за секунду
const REACH = 0.3;     // наскільки близько до вузла можна його втягнути
const HIT = 0.27;      // відстань зіткнення з багом
const POWER = 7, SCAN = 5.5, RULE_STEP = 0.2, SCAN_STEP = 0.12, SCAN_DUST = 1 / 45;
// hunt: на якій відстані баг помічає пилосос; scatter: секунди полювання й розсипання по кутах
const MODE = {
  normal: { ufo: [16, 34], scatter: [13, 6], hunt: 2.2, timer: true },
  calm: { ufo: [11, 26], scatter: [8, 9], hunt: 1.8, timer: false },
};
const dot = (a, b) => a.x * b.x + a.y * b.y;
const DOB = /^\d\d\.\d\d\.\d{4}$/;

export { LEVELS };

export class Game {
  constructor({ lang, T, mode = 'normal', emit, reduced = false }) {
    this.lang = lang; this.L = lang === 'en' ? 1 : 0; this.T = T; this.mode = mode; this.emit = emit || (() => {}); this.reduced = reduced;
    this.score = 0; this.lives = 3; this.combo = 0; this.best = 0; this.history = [];
    this.phase = 'idle'; this.t = 0; this.hover = null; this.dpr = 1; this.uidN = 0; this.uidE = 0; this.xn = 0;
    this.layout(960, 600);
  }

  // --- розмітка екрана ---
  layout(W, H, dpr = this.dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    this.portrait = W < 760; this.compact = W < 600;
    const top = 28, bottom = this.compact ? 62 : 54;
    const padX = this.portrait ? 40 : 66, padT = top + (this.portrait ? 18 : 24), padB = bottom + (this.portrait ? 30 : 34);
    this.cols = this.portrait ? 3 : 6; this.rows = this.portrait ? 6 : 3;
    this.bx = padX; this.by = padT; this.bw = W - 2 * padX; this.bh = H - padT - padB;
    this.cx = this.bw / this.cols; this.cy = this.bh / this.rows;
    this.unit = Math.min(this.cx, this.cy);
    const snap = v => Math.max(1, Math.round(v * dpr)) / dpr;
    this.P = snap(Math.min(2, Math.max(1, this.unit / (this.portrait ? 62 : 104))));
    this.PB = snap(this.P * 1.3);
    this.stars = Array.from({ length: Math.round(W * H / 11000) }, (_, k) => ({ x: (k * 97.13) % W, y: (k * 57.7) % H, s: k % 7 === 0 ? 2 : 1, ph: k * 1.7 }));
    this.labelsDirty = true;
  }
  // сітка → екран
  sx(x, y) { return this.portrait ? this.bx + y * this.cx : this.bx + x * this.cx; }
  sy(x, y) { return this.portrait ? this.by + x * this.cy : this.by + y * this.cy; }
  np(id) { const n = this.N[id]; return { x: n.lx + n.ox, y: n.ly + n.oy }; }
  ns(id) { const p = this.np(id); return { x: this.sx(p.x, p.y), y: this.sy(p.x, p.y) }; }
  other(e, id) { return e.a === id ? e.b : e.a; }
  elen(e) { const a = this.np(e.a), b = this.np(e.b); return Math.hypot(b.x - a.x, b.y - a.y); }
  sdir(a, b) { const p = this.ns(a), q = this.ns(b), d = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: (q.x - p.x) / d, y: (q.y - p.y) / d }; }
  corr(id) { return this.N[id].adj.map(i => this.E[i]).filter(e => e.active); }
  pace(k) { return k === 'speed' ? this.cfg.speed[this.mode === 'calm' ? 1 : 0] : this.cfg[k][this.mode === 'calm' ? 1 : 0]; }

  // --- рівень ---
  startLevel(n, seed = 0) {
    this.lv = n; this.cfg = LEVELS[n - 1]; this.seed = seed;
    this.R = rng(7919 * (seed + 1) + n * 101 + (this.mode === 'calm' ? 17 : 0));
    this.build(this.cfg);
    this.items = new Map(); this.logic = []; this.fx = []; this.texts = [];
    this.elapsed = 0; this.power = 0; this.eatN = 0; this.scanT = 0; this.scan = this.cfg.scanFull ? 1 : 0;
    this.rule = 0; this.ruleReady = false; this.sealed = !this.cfg.source; this.pumpT = this.cfg.source ? 6 : 0;
    this.broke = false; this.shake = 0; this.endT = 0; this.overT = 0; this.endSent = false; this.last = null;
    this.ufo = null; this.cap = null; this.ufoT = MODE[this.mode].ufo[0];
    this.spawned = 0; this.scatter = 0;
    this.lives = 3; this.combo = 0; this.score0 = this.score;
    const s = this.cfg.start;
    this.rb = { at: s, e: null, from: s, to: s, u: 0, hx: 1, hy: 0, want: null, path: null, inv: 1.2, eye: 0, eyeC: null, dir: 1, last: null, queued: null };
    this.bugs = this.cfg.bugs.map((b, k) => ({ k, ai: b.ai, home: b.home, at: b.home, e: null, from: b.home, to: b.home, u: 0, state: 'wait', wait: b.delay, last: null,
      col: BUG_COLS[k % 3], cd: this.spawnEvery() * (0.7 + 0.3 * this.R()), pi: k % 4, hx: 0, hy: 0 }));
    this.bugJunk = 0;
    // облік рішень: сміття (треба прибрати) і пастки (треба не чіпати)
    for (const n of Object.values(this.N)) {
      if (n.slot || !n.rec) continue;
      if (n.role === 'junk') this.addItem(n, 'orphan', 'suck');
      else if (n.role === 'new') this.addItem(n, 'new', 'keep');
      else if (n.role === 'dup') this.addItem(n, 'dup', 'merge');
      else if (n.role === 'twin') this.addItem(n, 'namesake', 'keep');
      if (n.bridge) n.bitem = this.addItem(n, 'bridge', 'keep', 'b');
    }
    for (const e of Object.values(this.E)) { if (e.fake) this.addEdgeItem(e, 'fake', 'cut'); else if (e.decoy) this.addEdgeItem(e, 'decoy', 'keep'); }
    if (this.cfg.source) this.items.set('seal', { key: 'seal', type: 'seal', label: this.N[this.cfg.source].rec.n, attr: this.N[this.cfg.source].rec.a, correct: 'seal', you: null, credit: null, why: '' });
    this.refresh(); this.comps0 = this.comps;
    this.banner = { text: this.T.levelBanner(n), sub: this.T.levels[n - 1].title, t: 0 };
    this.phase = 'play';
    this.labelsDirty = true;
    this.hud(true);
  }
  spawnEvery() { return this.cfg.spawn.every[this.mode === 'calm' ? 1 : 0]; }

  build(lv) {
    this.N = {}; this.E = {};
    const mk = (spec, slot) => {
      const [lx, ly] = place(lv, spec);
      const n = { id: spec.id, k: spec.k || 'p', lx, ly, ox: 0, oy: 0, tx: 0, ty: 0, adj: [], slot: !!slot, live: !slot, born: -9, uid: ++this.uidN, merged: 0 };
      if (slot) { n.role = 'slot'; n.to = spec.to; n.rec = null; }
      else { n.rec = this.record(spec); n.role = spec.role || (spec.k === 'src' ? 'src' : spec.k === 'dock' ? 'dock' : 'core'); n.bridge = !!spec.bridge; n.of = spec.of; n.twin = spec.twin; }
      n.core = !slot && !['junk', 'new', 'src', 'dock'].includes(n.role);
      this.N[n.id] = n;
    };
    lv.nodes.forEach(s => mk(s)); lv.slots.forEach(s => mk(s, true));
    this.groups = new Map();
    for (const n of Object.values(this.N)) if (n.role === 'dup') { const g = this.N[n.of]; if (g.role === 'core') g.role = 'gold'; g.grp = g.id; this.groups.set(n.of, { surv: n.of }); }
    let k = 0;
    const edge = (a, b, kind, o = {}) => {
      const e = { id: 'e' + k++, a, b, kind, active: true, uid: ++this.uidE, revealed: false, ...o };
      this.E[e.id] = e; this.N[a].adj.push(e.id); this.N[b].adj.push(e.id);
      this.mkDust(e);
    };
    lv.links.forEach(l => edge(l.a, l.b, 'data', { t: l.t, v: l.v, fake: !!l.fake, decoy: !!l.decoy }));
    lv.ducts.forEach(([a, b]) => edge(a, b, 'duct'));
    lv.slots.forEach(s => s.to.forEach(t => edge(s.id, t, 'duct', { active: false, slotDuct: true })));
  }
  record(spec) {
    const L = this.L, pick = v => (Array.isArray(v) ? v[L] : v);
    return { n: pick(spec.n), a: pick(spec.a) || '', x: spec.x ? spec.x[L] : '', created: spec.created || '', k: spec.k || 'p', thin: !!spec.thin };
  }
  mkDust(e) {
    e.dust = [];
    if (e.kind !== 'data') return;
    const len = this.elen(e), n = Math.max(1, Math.round(len / 0.2) - 1);
    for (let k = 0; k < n; k++) { const u = (k + 1) / (n + 1); if (u > 0.14 && u < 0.86) e.dust.push({ u, got: false }); }
  }

  // --- облік рішень ---
  attrText(rec) {
    const F = this.T.f;
    if (rec.k === 'c') return `${F.code} ${rec.a}`;
    if (rec.k === 'p' && DOB.test(rec.a)) return `${F.dob} ${rec.a}`;
    return rec.a;
  }
  basis(e) { return this.T.basis[e.t] ? this.T.basis[e.t](e.v) : ''; }
  edgeLabel(e) { const a = this.N[e.a].rec, b = this.N[e.b].rec; return `${a ? a.n : '·'} ↔ ${b ? b.n : '·'}`; }
  addItem(n, type, correct, suffix = '') {
    const key = 'n' + n.uid + suffix;
    this.items.set(key, { key, type, label: n.rec.n, attr: this.attrText(n.rec), node: n.id, uid: n.uid, correct, you: null, credit: null, why: '', rec: n.rec, spawned: !!n.slot });
    if (!suffix) n.item = key;
    return key;
  }
  addEdgeItem(e, type, correct) {
    const key = 'e' + e.uid;
    this.items.set(key, { key, type, label: this.edgeLabel(e), attr: this.basis(e), edge: e.id, correct, you: null, credit: null, why: '', spawned: !!e.spawned });
    e.item = key;
    return key;
  }
  extra(type, label, attr, you, why) {
    const key = 'x' + ++this.xn;
    this.items.set(key, { key, type, label, attr, correct: 'keep', you, credit: 0, why, t: this.elapsed });
  }
  decide(key, you, credit, why) {
    const it = this.items.get(key);
    if (!it || it.you) return;
    it.you = you; it.credit = credit; it.why = why; it.t = this.elapsed;
    if (credit === 1) this.charge(true);
  }
  charge(decision) {
    if (this.cfg.scanner && this.scanT <= 0) { const was = this.scan >= 1; this.scan = Math.min(1, this.scan + (decision ? SCAN_STEP : SCAN_DUST)); if (!was && this.scan >= 1) this.hud(true); }
    if (decision && this.cfg.source && !this.sealed && !this.ruleReady) {
      this.rule = Math.min(1, this.rule + RULE_STEP);
      if (this.rule >= 1) { this.ruleReady = true; this.say('info', this.T.msg.ruleReady, this.T.msg.ruleReadyText); this.hud(true); }
    }
  }
  junkLeft() { let n = 0; for (const it of this.items.values()) if (!it.you && it.correct !== 'keep') n++; return n; }

  // --- справжній граф: мости й компоненти ---
  refresh() {
    const ids = Object.values(this.N).filter(n => n.live && n.core).map(n => n.id), set = new Set(ids);
    const adj = new Map(ids.map(i => [i, new Set()]));
    const link = (a, b) => { if (set.has(a) && set.has(b) && a !== b) { adj.get(a).add(b); adj.get(b).add(a); } };
    for (const e of Object.values(this.E)) if (e.active && e.kind === 'data' && !e.fake) link(e.a, e.b);
    for (const l of this.logic) link(l.a, l.b);
    const A = new Map([...adj].map(([k, v]) => [k, [...v]]));
    this.aps = articulation(ids, A);
    this.compList = components(ids, A);
    this.comps = this.compList.length;
    // великі мости відрізають щонайменше два вузли, малі лише один листок
    this.bigAps = new Set();
    for (const v of this.aps) {
      const rest = ids.filter(i => i !== v), B = new Map(rest.map(i => [i, A.get(i).filter(j => j !== v)]));
      const parts = components(rest, B);
      if (parts.length > this.comps && parts.slice(1).some(c => c.length >= 2)) this.bigAps.add(v);
    }
    this.degree = new Map([...adj].map(([k, v]) => [k, v.size]));
  }
  linksOf(id) {
    let n = 0;
    for (const e of this.corr(id)) if (e.kind === 'data') n++;
    for (const l of this.logic) if (l.a === id || l.b === id) n++;
    return n;
  }

  // --- керування ---
  setWant(x, y) {
    const r = this.rb, d = Math.hypot(x, y);
    if (!d) return;
    const w = { x: x / d, y: y / d };
    if (!r.want || dot(r.want, w) < 0.9) r.queued = null;
    r.want = w; r.path = null; r.hold = false;
  }
  goTo(id) {
    const r = this.rb;
    if (!this.N[id] || this.phase !== 'play') return false;
    const next = v => this.corr(v).map(e => ({ to: this.other(e, v), w: this.elen(e) }));
    r.hold = false;
    if (!r.e) { const p = shortest(r.at, id, next); if (!p) return false; r.path = p.slice(1); r.want = null; if (!r.path.length) { r.path = null; r.hold = true; } return true; }
    const e = this.E[r.e], len = this.elen(e);
    const pa = shortest(r.to, id, next), pb = shortest(r.from, id, next);
    const cost = p => p.slice(1).reduce((s, v, k) => s + Math.hypot(this.np(v).x - this.np(p[k]).x, this.np(v).y - this.np(p[k]).y), 0);
    const ca = pa ? (1 - r.u) * len + cost(pa) : Infinity, cb = pb ? r.u * len + cost(pb) : Infinity;
    if (cb < ca) this.reverse();
    const p = cb < ca ? pb : pa;
    if (!p) return false;
    r.path = p.slice(1); r.want = null;
    return true;
  }
  reverse() {
    const r = this.rb;
    if (!r.e) return;
    [r.from, r.to] = [r.to, r.from]; r.u = 1 - r.u; r.hx = -r.hx; r.hy = -r.hy; r.queued = null;
    if (r.path && r.path.length) r.path = null;
  }
  act(type) {
    if (this.phase !== 'play') return;
    if (type === 'suck') return this.trySuck();
    if (type === 'cut') return this.tryCut();
    if (type === 'scan') return this.tryScan();
    if (type === 'seal') return this.trySeal();
  }
  nearNode() {
    const r = this.rb;
    if (!r.e) return r.at;
    const len = this.elen(this.E[r.e]);
    if (r.u * len <= REACH) return r.from;
    if ((1 - r.u) * len <= REACH) return r.to;
    return null;
  }
  trySuck() {
    const r = this.rb, M = this.T.msg;
    const id = this.nearNode();
    if (!id) {
      if (r.e && (1 - r.u) * this.elen(this.E[r.e]) < 0.8) { r.queued = r.to; return; }
      return this.say('info', M.noNode, M.noNodeText);
    }
    const n = this.N[id];
    if (n.k === 'src') { if (this.ruleReady && !this.sealed) return this.seal(); if (!this.sealed) this.say('info', M.srcNo, M.srcNoText); return; }
    if (n.k === 'dock') return;
    if (!n.live || !n.rec) return this.say('info', M.emptyNode, '');
    this.suck(n);
  }
  tryCut() {
    const r = this.rb, M = this.T.msg;
    if (!r.e) return this.say('info', M.notOnEdge, M.notOnEdgeText);
    const e = this.E[r.e];
    if (e.kind !== 'data') return this.say('info', M.duct, M.ductText);
    this.cut(e);
  }
  tryScan() {
    const M = this.T.msg;
    if (!this.cfg.scanner) return this.say('info', M.noScanner, '');
    if (this.scanT > 0) return;
    if (this.scan < 1) return this.say('info', M.scanEmpty, M.scanEmptyText);
    this.scanT = SCAN; this.scan = 0;
    for (const e of Object.values(this.E)) if (e.fake && e.active) e.revealed = true;
    this.rb.eye = 0.6; this.rb.eyeC = '#FFB020';
    sfx.scan(); this.say('info', M.scan, M.scanText); this.hud(true);
  }
  trySeal() {
    if (!this.cfg.source || this.sealed) return;
    const M = this.T.msg;
    if (!this.ruleReady) return this.say('info', M.srcNo, M.srcNoText);
    if (this.nearNode() === this.cfg.source) return this.seal();
    this.say('info', M.ruleReady, M.ruleReadyText);
  }

  // --- наслідки дій ---
  say(tone, title, text) { this.emit({ type: 'msg', tone, title, text }); }
  float(id, text, color) { const p = this.np(id); this.texts.push({ x: p.x, y: p.y, text, color, t: 0 }); }
  good(id, pts, label) {
    this.combo++; this.best = Math.max(this.best, this.combo);
    const mult = this.combo >= 10 ? 4 : this.combo >= 6 ? 3 : this.combo >= 3 ? 2 : 1;
    this.score += pts * mult;
    this.float(id, `+${pts * mult}${label ? ' ' + label : ''}`, '#2DD4BF');
    sfx.good();
    this.hud();
  }
  bad(id, pts, title, why) {
    this.combo = 0; this.score = Math.max(0, this.score - pts);
    this.float(id, `−${pts}`, '#FF6076');
    this.say('bad', title, why);
    sfx.bad();
    this.hud();
  }
  eyes(c, t = 0.35) { this.rb.eye = t; this.rb.eyeC = c; }

  suck(n) {
    const T = this.T, W = T.why, M = T.msg, rec = n.rec;
    const p = this.np(n.id);
    this.fx.push({ kind: 'suck', x: p.x, y: p.y, k: n.k, t: 0, dur: 0.45 });
    sfx.suck();
    if (n.role === 'junk') {
      this.remove(n);
      this.decide(n.item, 'suck', 1, W.orphanOk(rec.n));
      this.eyes('#2DD4BF'); this.good(n.id, 100);
      return this.say('good', M.junk, M.junkText(rec.n));
    }
    if (n.role === 'new') {
      this.remove(n);
      const why = W.newSucked(rec.created);
      this.decide(n.item, 'suck', 0, why);
      this.eyes('#FF6076'); return this.bad(n.id, 150, M.newSucked, why);
    }
    if (n.role === 'dup') {
      const g = this.groups.get(n.of), s = g && this.N[g.surv];
      if (s && s.live && s.id !== n.id) {
        const moved = this.mergeInto(n, s);
        const key = rec.k === 'c' ? `${T.f.code} ${rec.a}` : `${T.f.dob} ${rec.a}`;
        this.decide(n.item, 'merge', 1, W.dupOk(key));
        this.eyes('#C084FC'); this.good(n.id, 200);
        this.say('good', M.merged, M.mergedText(key, T.f.links(moved)));
        return this.afterChange(n);
      }
      this.remove(n);
      this.decide(n.item, 'suck', 1, W.orphanOk(rec.n));
      return this.good(n.id, 100);
    }
    if (n.role === 'gold') {
      const gk = n.grp || n.id, g = this.groups.get(gk), dups = Object.values(this.N).filter(d => d.live && d.role === 'dup' && d.of === gk);
      if (g && dups.length) {
        const d = dups.sort((a, b) => (a.slot - b.slot) || a.uid - b.uid)[0];
        this.mergeInto(n, d);
        d.role = 'gold'; d.grp = gk; d.rec = { ...d.rec, lost: true }; d.core = true; g.surv = d.id;
        this.decide(d.item, 'gold', 0.5, W.goldSucked);
        this.labelsDirty = true;
        this.eyes('#FFB020'); this.bad(n.id, 80, M.gold, W.goldSucked);
        return this.afterChange(n);
      }
    }
    if (n.role === 'twin') {
      const tw = this.resolve(n.twin);
      if (tw && tw.live) {
        const why = rec.k === 'c' ? W.namesakeC(tw.rec.a, rec.a) : W.namesakeP(tw.rec.a, rec.a);
        this.mergeInto(n, tw, true);
        tw.rec = { ...tw.rec, mixed: true };
        this.decide(n.item, 'merge', 0, why);
        this.eyes('#FF6076'); this.bad(n.id, 250, M.namesake, why);
        return this.afterChange(n);
      }
    }
    // справжній запис (зокрема міст): видалення разом зі зв’язками
    const links = this.linksOf(n.id), wasAP = this.aps.has(n.id), before = this.comps;
    this.remove(n, true);
    this.refresh();
    const split = this.comps > before;
    const why = split ? W.bridge(this.comps) : W.core(links);
    if (n.bitem && !this.items.get(n.bitem).you) this.decide(n.bitem, 'suck', 0, why);
    else if (n.item && this.items.get(n.item) && !this.items.get(n.item).you) this.decide(n.item, 'suck', 0, why);
    else this.extra(split || wasAP ? 'bridge' : 'core', rec.n, this.attrText(rec), 'suck', why);
    this.eyes('#FF6076'); this.bad(n.id, split ? 300 : 150, split ? M.bridge : M.core, why);
    if (split) this.breakGraph(n.id);
    this.hud(true);
  }
  // злиття: дані зв’язки src переходять до dst (коридори стають службовими, стрілки летять до dst)
  mergeInto(src, dst, wrong = false) {
    let moved = 0;
    const a = this.np(src.id), b = this.np(dst.id);
    for (const e of this.corr(src.id)) {
      if (e.kind !== 'data') continue;
      const o = this.other(e, src.id);
      const wasFake = e.fake;
      e.kind = 'duct'; e.dust = []; e.merged = true;
      if (wasFake) { if (e.item) this.decide(e.item, 'missed', 0, this.T.why.fakeMissed(this.basis(e))); e.fake = false; continue; }
      if (o !== dst.id && !this.logic.some(l => (l.a === dst.id && l.b === o) || (l.b === dst.id && l.a === o))) this.logic.push({ a: dst.id, b: o, t: e.t, v: e.v, wrong });
      moved++;
      const op = this.np(o);
      this.fx.push({ kind: 'fly', ox: op.x, oy: op.y, ax: a.x, ay: a.y, bx: b.x, by: b.y, t: 0, dur: this.reduced ? 0.35 : 0.8, c: wrong ? '#FF6076' : '#C084FC' });
    }
    for (const l of this.logic) { if (l.a === src.id) l.a = dst.id; if (l.b === src.id) l.b = dst.id; }
    this.logic = this.logic.filter(l => l.a !== l.b);
    dst.merged += 1 + (src.merged || 0); dst.flash = 1; dst.flashC = wrong ? '#FF6076' : '#C084FC';
    src.live = false; src.gone = this.t; src.into = dst.id;
    this.labelsDirty = true;
    return moved;
  }
  // куди потрапив запис після злиття (тезка еталона, злитого в дубль, тепер тезка нового еталона)
  resolve(id) {
    let n = this.N[id], k = 0;
    while (n && !n.live && n.into && k++ < 12) n = this.N[n.into];
    return n && n.live ? n : null;
  }
  remove(n, real = false) {
    n.live = false; n.gone = this.t;
    for (const e of this.corr(n.id)) if (e.kind === 'data') { e.kind = 'duct'; e.dust = []; if (real) e.lost = true; }
    this.logic = this.logic.filter(l => l.a !== n.id && l.b !== n.id);
    if (!real) this.refresh();
    this.labelsDirty = true;
  }
  afterChange() { this.refresh(); this.hud(true); }
  cut(e) {
    const T = this.T, W = T.why, M = T.msg, r = this.rb, s = this.basis(e);
    const pa = this.np(r.from), pb = this.np(r.to);
    this.fx.push({ kind: 'snip', x: pa.x + (pb.x - pa.x) * r.u, y: pa.y + (pb.y - pa.y) * r.u, t: 0, dur: 0.6 });
    sfx.cut();
    const at = r.u < 0.5 ? r.from : r.to;
    if (e.fake) {
      e.kind = 'duct'; e.fake = false; e.wasFake = true; e.dust = []; e.revealed = false;
      this.decide(e.item, 'cut', 1, W.fakeOk(s));
      this.eyes('#FF6076', 0.25); this.good(at, 150);
      return this.say('good', M.cutOk, M.cutOkText(s));
    }
    const before = this.comps, label = this.edgeLabel(e);
    e.kind = 'duct'; e.dust = []; e.lost = true;
    this.refresh();
    const split = this.comps > before;
    const why = split ? `${W.realCut(s)} ${W.bridgeEdge(this.comps)}` : W.realCut(s);
    if (e.item && this.items.get(e.item) && !this.items.get(e.item).you) this.decide(e.item, 'cut', 0, why);
    else this.extra('realEdge', label, s, 'cut', why);
    this.eyes('#FF6076'); this.bad(at, split ? 300 : 150, M.cutReal, why);
    if (split) { const p = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }; this.breakGraph(null, p); }
    this.hud(true);
  }
  // граф розпався: менші компоненти відпливають від місця розриву
  breakGraph(id, at) {
    this.broke = true;
    const c = at || this.np(id);
    for (const comp of this.compList.slice(1)) {
      let mx = 0, my = 0;
      comp.forEach(i => { const p = this.np(i); mx += p.x; my += p.y; });
      mx /= comp.length; my /= comp.length;
      let dx = mx - c.x, dy = my - c.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      for (const i of comp) {
        const n = this.N[i];
        n.tx = Math.max(-0.3 - n.lx, Math.min(6.3 - n.lx, n.tx + dx * 0.24));
        n.ty = Math.max(-0.28 - n.ly, Math.min(3.28 - n.ly, n.ty + dy * 0.24));
      }
    }
    if (!this.reduced) this.shake = 0.5;
    this.banner = { text: this.T.hud.broken, sub: this.T.hud.comps(this.comps), t: 0, bad: true };
    sfx.split();
  }
  seal() {
    const T = this.T, src = this.cfg.source;
    this.sealed = true; this.ruleReady = false;
    this.N[src].rec = { ...this.N[src].rec, n: T.srcSealed[0], a: T.srcSealed[1] };
    this.decide('seal', 'sealed', 1, T.why.sealOk);
    this.score += 1000; this.float(src, '+1000', '#2DD4BF');
    const p = this.np(src); this.fx.push({ kind: 'seal', x: p.x, y: p.y, t: 0, dur: 1.2 });
    sfx.seal(); this.eyes('#2DD4BF', 0.8);
    this.say('good', T.msg.sealed, T.msg.sealedText);
    this.labelsDirty = true; this.hud(true);
  }

  // --- нове сміття від багів і джерела ---
  freeSlots(near) { return Object.values(this.N).filter(n => n.slot && !n.live && (!near || n.to.includes(near) || n.id === near)); }
  legit(n) { return n && n.live && n.rec && ['core', 'gold'].includes(n.role) && !n.bridge && (n.k === 'p' || n.k === 'c'); }
  fakeCandidates(near) {
    const ok = n => n && n.live && n.rec && ['core', 'gold', 'twin'].includes(n.role) && n.k !== 'src' && n.k !== 'dock';
    const r = this.rb, busy = r.e;
    return Object.values(this.E).filter(e => e.active && e.kind === 'duct' && !e.slotDuct && e.id !== busy && ok(this.N[e.a]) && ok(this.N[e.b]) && !e.merged && !e.lost && (!near || e.a === near || e.b === near));
  }
  spawnAt(slot, kind, by) {
    const T = this.T, L = this.L;
    let rec;
    if (kind === 'dup') {
      const cands = slot.to.map(i => this.N[i]).filter(n => this.legit(n));
      if (!cands.length) kind = 'orphan';
      else {
        const o = cands[Math.floor(this.R() * cands.length)], gk = o.grp || o.id;
        rec = { ...o.rec, n: variantName(o.rec.n, o.k, this.spawned + slot.uid), x: by === 'src' ? T.f.fromImport : T.f.fromBug, lost: false, mixed: false, created: '14.11.2026' };
        slot.k = o.k; slot.rec = rec; slot.role = 'dup'; slot.of = gk;
        if (o.role === 'core') o.role = 'gold';
        o.grp = gk;
        if (!this.groups.has(gk)) this.groups.set(gk, { surv: o.id });
      }
    }
    if (kind === 'orphan') {
      const t = TEST_NAMES[(this.spawned + slot.uid) % TEST_NAMES.length];
      rec = { n: t[L], a: t[2], x: by === 'src' ? T.f.fromImport : T.f.fromBug, created: '14.11.2026', k: 'p' };
      slot.k = 'p'; slot.rec = rec; slot.role = 'junk'; slot.of = null;
    }
    slot.live = true; slot.core = false; slot.born = this.t; slot.uid = ++this.uidN; slot.merged = 0; slot.flash = 0;
    for (const i of slot.adj) this.E[i].active = true;
    this.addItem(slot, slot.role === 'dup' ? 'dup' : 'orphan', slot.role === 'dup' ? 'merge' : 'suck');
    this.labelsDirty = true; this.spawned++;
    const p = this.np(slot.id); this.fx.push({ kind: 'spawn', x: p.x, y: p.y, t: 0, dur: 0.8 });
    return rec;
  }
  fakeAt(e) {
    e.kind = 'data'; e.fake = true; e.t = PLACEHOLDERS[Math.floor(this.R() * PLACEHOLDERS.length)]; e.v = null; e.spawned = true; e.uid = ++this.uidE; e.revealed = false; e.lost = false; e.wasFake = false;
    this.mkDust(e); this.addEdgeItem(e, 'fake', 'cut');
    const a = this.np(e.a), b = this.np(e.b); this.fx.push({ kind: 'spawn', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, dur: 0.8 });
    this.spawned++;
  }
  bugSpawn(b, at) {
    const sp = this.cfg.spawn, max = sp.max[this.mode === 'calm' ? 1 : 0];
    if (this.power > 0 || this.bugJunk >= max || sp.kind === 'none') return false;
    const M = this.T.msg;
    if (sp.kind === 'fake') {
      const c = this.fakeCandidates(at);
      if (!c.length) return false;
      this.fakeAt(c[Math.floor(this.R() * c.length)]); this.bugJunk++;
      this.say('info', M.bugFake, ''); sfx.pump();
      return true;
    }
    const s = this.freeSlots(at);
    if (!s.length) return false;
    const rec = this.spawnAt(s[Math.floor(this.R() * s.length)], sp.kind, 'bug'); this.bugJunk++;
    this.say('info', M.bugJunk, M.bugJunkText(rec.n)); sfx.pump();
    return true;
  }
  pump() {
    const M = this.T.msg, slots = this.freeSlots(), fakes = this.fakeCandidates();
    const src = this.np(this.cfg.source);
    if (!slots.length && !fakes.length) return false;
    let target;
    if (slots.length && (!fakes.length || this.R() < 0.72)) {
      const s = slots[Math.floor(this.R() * slots.length)];
      const rec = this.spawnAt(s, this.R() < 0.5 ? 'dup' : 'orphan', 'src');
      target = this.np(s.id);
      this.say('info', M.pump, M.pumpText(rec.n));
    } else {
      const e = fakes[Math.floor(this.R() * fakes.length)];
      this.fakeAt(e);
      const a = this.np(e.a), b = this.np(e.b); target = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.say('info', M.pumpFake, this.basis(e));
    }
    this.fx.push({ kind: 'pipe', ax: src.x, ay: src.y, bx: target.x, by: target.y, t: 0, dur: 0.9 });
    sfx.pump();
    return true;
  }

  // --- крок симуляції ---
  hud(force) {
    const h = { scan: Math.floor(this.scan * 10) / 10, scanReady: this.scan >= 1 && this.scanT <= 0, scanOn: this.scanT > 0, ruleReady: this.ruleReady, sealed: this.sealed, lives: this.lives, lv: this.lv, scanner: !!(this.cfg && this.cfg.scanner), source: !!(this.cfg && this.cfg.source) };
    const k = JSON.stringify(h);
    if (force || k !== this.hudKey) { this.hudKey = k; this.emit({ type: 'hud', game: this, hud: h }); }
  }
  update(dt) {
    dt = Math.max(0, dt || 0);
    this.t += dt;
    if (this.phase === 'idle') return;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 2.4) this.banner = null; }
    this.stepFx(dt);
    for (const n of Object.values(this.N)) {
      if (n.tx !== n.ox || n.ty !== n.oy) { const k = Math.min(1, dt * 3); n.ox += (n.tx - n.ox) * k; n.oy += (n.ty - n.oy) * k; if (Math.abs(n.tx - n.ox) < 0.001) n.ox = n.tx; if (Math.abs(n.ty - n.oy) < 0.001) n.oy = n.ty; }
      if (n.flash) n.flash = Math.max(0, n.flash - dt * 1.2);
    }
    this.shake = Math.max(0, this.shake - dt);
    if (this.phase === 'done') { this.endT += dt; if (this.endT > 0.8 && !this.endSent) { this.endSent = true; this.emit({ type: 'levelEnd', summary: this.last }); } return; }
    if (this.phase === 'over') { this.overT += dt; if (this.overT > 1 && !this.endSent) { this.endSent = true; this.emit({ type: 'gameover', summary: this.last }); } return; }
    if (this.phase !== 'play') return;
    this.elapsed += dt;
    const r = this.rb;
    r.inv = Math.max(0, r.inv - dt); r.eye = Math.max(0, r.eye - dt);
    if (this.scanT > 0) { this.scanT -= dt; if (this.scanT <= 0) { this.scanT = 0; this.hud(true); } }
    if (this.power > 0) { this.power -= dt; if (this.power <= 0) { this.power = 0; this.hud(true); } }
    this.moveRobot(dt);
    this.moveBugs(dt);
    this.stepUfo(dt);
    if (this.cfg.source && !this.sealed) { this.pumpT -= dt; if (this.pumpT <= 0) { this.pumpT = this.pump() ? this.pace('pump') * (0.85 + 0.3 * this.R()) : 2; } }
    if (this.phase !== 'play') return;
    if (MODE[this.mode].timer && this.elapsed >= this.cfg.time) { this.say('info', this.T.msg.time, this.T.msg.timeText); return this.finish(false); }
    if (this.junkLeft() === 0) this.finish(true);
    this.hud();
  }
  finish(clean) {
    if (clean && MODE[this.mode].timer) { const bonus = Math.max(0, Math.round(this.cfg.time - this.elapsed)) * 10; this.score += bonus; }
    this.phase = 'done'; this.endT = 0; this.endSent = false;
    this.last = this.summary(true, clean);
    this.history.push(this.last);
  }

  // пилосос: рух коридором, поворот на вузлі за буфером напрямку, розворот у коридорі
  pick(id, r, dry = false) {
    const opts = this.corr(id);
    if (r.path) {
      const e = r.path.length && opts.find(x => this.other(x, id) === r.path[0]);
      if (e) { if (!dry) r.path.shift(); return e; }
      // маршрут дотику чи кліку закінчився: пилосос стоїть на вузлі, доки не буде нового напрямку
      if (!dry) { r.path = null; r.hold = true; }
      return null;
    }
    if (r.hold) return null;
    let best = null, bd = -2;
    if (r.want) for (const e of opts) { const d = dot(this.sdir(id, this.other(e, id)), r.want); if (d > bd) { bd = d; best = e; } }
    if (best && bd >= 0.45) return best;
    if (r.last == null) return null;
    best = null; bd = -2;
    const h = { x: r.hx, y: r.hy };
    for (const e of opts) { if (e.id === r.last) continue; const d = dot(this.sdir(id, this.other(e, id)), h); if (d > bd) { bd = d; best = e; } }
    return best && bd >= 0.72 ? best : null;
  }
  depart(id) {
    const r = this.rb, e = this.pick(id, r);
    if (!e) return false;
    r.e = e.id; r.from = id; r.to = this.other(e, id); r.u = 0; r.at = null;
    const d = this.sdir(r.from, r.to); r.hx = d.x; r.hy = d.y;
    if (Math.abs(d.x) > 0.3) r.dir = d.x > 0 ? 1 : -1;
    return true;
  }
  moveRobot(dt) {
    const r = this.rb;
    if (!r.e && !this.depart(r.at)) return;
    if (r.want && !r.path && dot(r.want, { x: r.hx, y: r.hy }) < -0.6) this.reverse();
    let dist = SPEED * dt;
    while (dist > 0 && r.e) {
      const e = this.E[r.e], len = Math.max(0.05, this.elen(e)), left = (1 - r.u) * len;
      const u0 = r.u;
      if (dist < left) { r.u += dist / len; dist = 0; this.dust(e, r.from, u0, r.u); }
      else {
        this.dust(e, r.from, u0, 1); dist -= left;
        r.last = e.id; r.at = r.to; r.e = null; r.u = 0;
        this.arrive(r.at);
        if (this.phase !== 'play') return;
        if (!this.depart(r.at)) break;
      }
    }
    if (r.e) { const d = this.sdir(r.from, r.to); r.hx = d.x; r.hy = d.y; if (Math.abs(d.x) > 0.3) r.dir = d.x > 0 ? 1 : -1; }
  }
  arrive(id) {
    const r = this.rb;
    if (this.cap && this.cap.fall >= 1 && this.cap.node === id) this.eatCapsule();
    if (r.queued === id) { r.queued = null; this.trySuck(); }
  }
  dust(e, from, u0, u1) {
    if (!e.dust.length) return;
    const [a, b] = from === e.a ? [u0, u1] : [1 - u1, 1 - u0];
    let n = 0;
    for (const d of e.dust) if (!d.got && d.u >= a - 1e-6 && d.u <= b + 1e-6) { d.got = true; n++; }
    if (n) { this.score += 10 * n; for (let k = 0; k < n; k++) this.charge(false); sfx.dust(); }
  }
  robotPos() {
    const r = this.rb;
    if (!r.e) return this.np(r.at);
    const a = this.np(r.from), b = this.np(r.to);
    return { x: a.x + (b.x - a.x) * r.u, y: a.y + (b.y - a.y) * r.u };
  }
  // напрямок руху пилососа в одиницях сітки (для засідки)
  robotHeadingL() {
    const r = this.rb;
    if (!r.e) return { x: 0, y: 0 };
    const a = this.np(r.from), b = this.np(r.to), d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  }

  // баги: переслідувач, засідка й патруль; на вузлі обирають коридір, що веде ближче до цілі
  bugPos(b) {
    if (!b.e) return this.np(b.at);
    const a = this.np(b.from), c = this.np(b.to);
    return { x: a.x + (c.x - a.x) * b.u, y: a.y + (c.y - a.y) * b.u };
  }
  // баг полює лише тоді, коли пилосос близько; інакше обходить свій маршрут (на вузлах він і підкидає сміття)
  bugTarget(b) {
    const rp = this.robotPos(), pat = this.cfg.patrol, M = MODE[this.mode], bp = this.bugPos(b);
    const per = M.scatter[0] + M.scatter[1], scatter = ((this.elapsed + b.k * 3) % per) > M.scatter[0];
    const near = Math.hypot(rp.x - bp.x, rp.y - bp.y) < (b.ai === 'patrol' ? M.hunt * 0.6 : M.hunt);
    b.hunting = near && !scatter;
    if (b.hunting && b.ai === 'chase') return rp;
    if (b.hunting && b.ai === 'ambush') { const h = this.robotHeadingL(); return { x: Math.max(0, Math.min(6, rp.x + h.x * 1.4)), y: Math.max(0, Math.min(3, rp.y + h.y * 1.4)) }; }
    if (b.hunting) return rp;
    const p = this.np(pat[b.pi % pat.length]);
    if (Math.hypot(p.x - bp.x, p.y - bp.y) < 0.4) b.pi += b.ai === 'ambush' ? 3 : 1;
    return this.np(pat[b.pi % pat.length]);
  }
  bugPick(b, id) {
    const opts = this.corr(id);
    let c = opts.filter(e => e.id !== b.last);
    if (!c.length) c = opts;
    if (!c.length) return null;
    const rp = this.robotPos();
    const score = this.power > 0
      ? e => { const p = this.np(this.other(e, id)); return -Math.hypot(p.x - rp.x, p.y - rp.y) + this.R() * 0.6; }
      : (() => { const t = this.bugTarget(b); return e => { const p = this.np(this.other(e, id)); return Math.hypot(p.x - t.x, p.y - t.y) + this.R() * 0.25; }; })();
    return c.reduce((best, e) => { const s = score(e); return !best || s < best.s ? { e, s } : best; }, null).e;
  }
  moveBugs(dt) {
    const r = this.rb, rp = this.robotPos();
    for (const b of this.bugs) {
      if (b.state === 'wait') {
        b.wait -= dt;
        // баг не вилазить із гнізда, поки пилосос поруч: ніяких засідок просто на голову
        if (b.wait <= 0) { const h = this.np(b.home); if (Math.hypot(h.x - rp.x, h.y - rp.y) < 1.15) b.wait = 0.3; else { b.state = 'move'; b.at = b.home; b.e = null; b.last = null; } }
        continue;
      }
      if (b.state === 'out') { b.wait -= dt; if (b.wait <= 0) { b.state = 'wait'; b.wait = 1; b.at = b.home; b.e = null; b.u = 0; } continue; }
      b.cd -= dt;
      let dist = SPEED * this.pace('speed') * (this.power > 0 ? 0.62 : 1) * dt;
      let guard = 0;
      while (dist > 0 && guard++ < 6) {
        if (!b.e) {
          const e = this.bugPick(b, b.at);
          if (!e) break;
          b.e = e.id; b.from = b.at; b.to = this.other(e, b.at); b.u = 0;
        }
        const e = this.E[b.e];
        if (!e.active) { b.e = null; break; }
        const len = Math.max(0.05, this.elen(e)), left = (1 - b.u) * len;
        if (dist < left) { b.u += dist / len; dist = 0; }
        else {
          dist -= left; b.last = e.id; b.at = b.to; b.e = null; b.u = 0;
          if (b.cd <= 0) { b.cd = this.bugSpawn(b, b.at) ? this.spawnEvery() * (0.8 + 0.4 * this.R()) : 2.5; }
        }
      }
      if (b.e) { const d = this.sdir(b.from, b.to); b.hx = d.x; b.hy = d.y; }
      // зіткнення з пилососом
      const bp = this.bugPos(b);
      if (Math.hypot(bp.x - rp.x, bp.y - rp.y) < HIT) {
        if (this.power > 0) {
          b.state = 'out'; b.wait = 4; this.eatN++;
          const pts = 200 * 2 ** Math.min(3, this.eatN - 1); this.score += pts;
          this.texts.push({ x: bp.x, y: bp.y, text: `+${pts}`, color: '#FFB020', t: 0 });
          this.fx.push({ kind: 'boom', x: bp.x, y: bp.y, t: 0, dur: 0.9 });
          sfx.eat(); this.say('good', this.T.msg.bugEaten, '');
        } else if (r.inv <= 0) this.hitRobot(b, bp);
      }
    }
  }
  hitRobot(b, bp) {
    const r = this.rb;
    this.lives--; r.inv = 3; this.combo = 0;
    // як у Pac-Man: після влучання всі баги повертаються в гнізда, гравець має кілька секунд спокою
    for (const o of this.bugs) if (o.state === 'move') { o.state = 'out'; o.wait = o === b ? 2.5 : 1.8; }
    this.fx.push({ kind: 'boom', x: bp.x, y: bp.y, t: 0, dur: 0.9, big: true });
    if (!this.reduced) this.shake = 0.35;
    sfx.hurt();
    this.say('bad', this.T.msg.hit, this.T.msg.hitText);
    this.hud(true);
    if (this.lives <= 0) { this.phase = 'over'; this.overT = 0; this.endSent = false; this.last = this.summary(false); }
  }
  // капібара на тарілці скидає капсулу «Правило на вході» на вузол подалі від пилососа
  stepUfo(dt) {
    if (!this.ufo && !this.cap) {
      this.ufoT -= dt;
      if (this.ufoT <= 0) {
        const rp = this.robotPos();
        const c = Object.values(this.N).filter(n => !n.slot && n.k !== 'src' && Math.hypot(this.np(n.id).x - rp.x, this.np(n.id).y - rp.y) > 1.6 && this.corr(n.id).length >= 2);
        if (c.length) { this.ufo = { f: 0, drop: c[Math.floor(this.R() * c.length)].id, dropped: false }; this.say('info', this.T.msg.ufo, this.T.msg.ufoText); }
        else this.ufoT = 3;
      }
    }
    if (this.ufo) {
      this.ufo.f += dt / 6.5;
      const x = -60 + (this.W + 120) * this.ufo.f;
      if (!this.ufo.dropped && x >= this.ns(this.ufo.drop).x) { this.ufo.dropped = true; this.cap = { node: this.ufo.drop, t: 0, fall: 0, y0: 22 }; }
      if (this.ufo.f >= 1) this.ufo = null;
    }
    if (this.cap) {
      const c = this.cap;
      c.t += dt; c.fall = Math.min(1, c.fall + dt / 0.7);
      if (c.t > 16) { this.cap = null; this.ufoT = MODE[this.mode].ufo[1] * 0.5; return; }
      const rp = this.robotPos(), p = this.np(c.node);
      if (c.fall >= 1 && Math.hypot(p.x - rp.x, p.y - rp.y) < REACH) this.eatCapsule();
    }
  }
  eatCapsule() {
    if (!this.cap) return;
    const p = this.np(this.cap.node);
    this.cap = null; this.power = POWER; this.eatN = 0; this.score += 250;
    this.texts.push({ x: p.x, y: p.y, text: `+250 ${this.T.hud.power}`, color: '#FFB020', t: 0 });
    for (const b of this.bugs) if (b.state === 'move' && b.e) { [b.from, b.to] = [b.to, b.from]; b.u = 1 - b.u; b.last = null; }
    this.ufoT = MODE[this.mode].ufo[1];
    sfx.power(); this.eyes('#FFB020', 0.6);
    this.say('good', this.T.msg.power, this.T.msg.powerText); this.hud(true);
  }
  stepFx(dt) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.dur);
    for (const x of this.texts) x.t += dt;
    this.texts = this.texts.filter(x => x.t < 1.3);
  }

  // --- підсумок рівня ---
  summary(done, clean = false) {
    const W = this.T.why;
    for (const it of this.items.values()) {
      if (it.you) continue;
      if (it.correct === 'keep') {
        it.you = 'kept'; it.credit = 1;
        it.why = it.type === 'new' ? W.newKept(it.rec.created) : it.type === 'namesake' ? W.namesakeKept : it.type === 'decoy' ? W.decoyKept(it.attr) : W.bridgeKept;
      } else {
        it.you = 'missed'; it.credit = 0;
        it.why = it.type === 'orphan' ? W.orphanMissed(it.label) : it.type === 'dup' ? W.dupMissed(it.attr) : it.type === 'fake' ? W.fakeMissed(it.attr) : W.sealMissed;
      }
    }
    const list = [...this.items.values()];
    let q = list.reduce((s, x) => s + x.credit, 0) / Math.max(1, list.length);
    if (this.broke) q = Math.min(q, 0.6);
    let stars = q >= 0.95 ? 3 : q >= 0.85 ? 2 : q >= 0.7 ? 1 : 0;
    if (stars > 1 && MODE[this.mode].timer && this.elapsed > this.cfg.par) stars--;
    const sk = (...types) => { const xs = list.filter(x => types.includes(x.type)); return [xs.filter(x => x.credit === 1).length, xs.length]; };
    const rank = x => (x.you === 'missed' ? 2 : x.credit === 0.5 ? 1 : 0);
    const mistakes = list.filter(x => x.credit < 1).sort((a, b) => rank(a) - rank(b) || (a.t || 0) - (b.t || 0));
    return {
      lv: this.lv, mode: this.mode, done, clean, quality: q, stars, score: this.score, levelScore: this.score - this.score0, best: this.best,
      time: this.elapsed, broke: this.broke, parts: this.comps, sealed: this.sealed,
      skills: { orphans: sk('orphan'), legit: sk('new'), dups: sk('dup'), namesakes: sk('namesake'), fakes: sk('fake'), reals: sk('decoy', 'realEdge'), bridges: sk('bridge'), seal: sk('seal') },
      mistakes, log: list,
    };
  }

  draw(ctx) { drawGame(this, ctx); }
}
