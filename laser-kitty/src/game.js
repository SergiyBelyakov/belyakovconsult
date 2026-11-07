// Рушій гри: строй записів-жуків, пікірування до сховища, три промені (лазер видаляє, виправлення нормалізує,
// об'єднання зливає дублікати), «#Н/Д» у відповідь, капібара з правилом перевірки, труба джерела на п'ятому рівні.
// Малювання на canvas у тому самому файлі: стан і відображення поруч, щоб легко звіряти координати.
import { makeLevel, sourceRecord, correct, LEVELS } from './records.js';
import { C, BUG_COLS, kitty, kittyEyes, kittyHead, bug, boom, ufo, capsule, pipe } from './sprites.js';
import { sfx } from './audio.js';

const PACE = {
  normal: { dive: [5.2, 4.6, 4.2, 3.8, 3.2], diveT: [10, 9.2, 8.6, 8, 7.2], pellet: [0, 3.8, 3.4, 3.0, 2.6], src: 3.4 },
  calm: { dive: [7.5, 6.8, 6.2, 5.6, 4.8], diveT: [14, 13, 12, 11.5, 10.5], pellet: [0, 0, 0, 0, 0], src: 4.6 },
};
const BEAM = { laser: C.RUBY_L, fix: C.FIX, merge: C.MERGE };
const FONT = "Inter, 'Segoe UI', Arial, sans-serif", MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
const ease = u => (u < 0 ? 0 : u > 1 ? 1 : 1 - (1 - u) ** 3);

export class Game {
  constructor({ lang, T, mode = 'normal', emit, reduced = false }) {
    this.lang = lang; this.T = T; this.mode = mode; this.emit = emit || (() => {}); this.reduced = reduced;
    this.score = 0; this.lives = 3; this.combo = 0; this.best = 0; this.history = [];
    this.phase = 'idle'; this.t = 0; this.stars = [];
    this.keys = { left: false, right: false }; this.target = null;
    this.layout(960, 600);
  }

  layout(W, H) {
    this.W = W; this.H = H;
    this.P = W >= 760 ? 3 : 2;
    this.cols = W >= 920 ? 5 : W >= 700 ? 4 : W >= 500 ? 3 : 2;
    this.rows = 2;
    // ряди зсунуті на пів кроку, як цегла: жук верхнього ряду не стоїть за жуком нижнього
    this.pitchX = (W - 16) / (this.cols + 0.5);
    this.cardW = Math.min(182, Math.floor(this.pitchX) - 12);
    this.hitW = Math.max(22, 7 * this.P + 8);
    this.cardH = 40;
    this.bugH = 12 * this.P;
    this.top = 44 + this.bugH;
    this.pitchY = this.bugH + this.cardH + 20;
    this.kittyY = H - 28;
    this.whY = H - 22;
    if (this.kx == null || this.kx > W) this.kx = W / 2;
    this.stars = Array.from({ length: Math.round(W * H / 9000) }, (_, k) => ({ x: (k * 97.13) % W, y: (k * 57.7) % H, v: 6 + (k % 5) * 5, s: k % 7 === 0 ? 2 : 1 }));
  }

  // ——— рівень ———
  startLevel(n, seed = 0) {
    this.lv = n; this.cfg = LEVELS[n - 1]; this.seed = seed;
    this.queue = makeLevel(n, this.lang, seed);
    this.total = this.queue.reduce((s, u) => s + u.length, 0);
    this.bugs = []; this.shots = []; this.pellets = []; this.fx = []; this.texts = [];
    this.ufo = null; this.caps = null; this.ufoDone = false; this.power = 0; this.tag = null;
    this.cool = 0; this.eyeT = 0; this.eyeC = null; this.invuln = 1.5; this.dead = 0;
    this.pipe = n === 5 ? { x: this.W / 2, y: 40, sealed: 0, beam: 0, every: PACE[this.mode].src, timer: 6, n: 0, told: false } : null;
    this.mega = 0; this.megaReady = false;
    this.diveTimer = 2.5; this.pelletTimer = 4;
    this.banner = { text: this.T.levelBanner(n), sub: this.T.levels[n - 1].title, t: 0 };
    this.ls = { cleanIn: 0, dirtyIn: 0, lost: 0, fixed: 0, deleted: 0, merged: 0, kept: 0, falseMerge: 0, srcFixed: 0, totals: { fix: 0, err: 0, dup: 0, ok: 0 }, mistakes: [], log: new Map(), score0: this.score };
    this.queue.flat().forEach(r => { this.ls.totals[r.kind === 'dup' ? 'dup' : r.kind]++; });
    this.ls.totals.dup /= 2;
    this.phase = 'play';
    this.spawnWave();
    this.emit({ type: 'hud', game: this });
  }
  pace(k) { return PACE[this.mode][k][this.lv - 1]; }
  progress() { const left = this.queue.reduce((s, u) => s + u.length, 0) + this.bugs.filter(b => !b.src && b.phase !== 'clean').length; return 1 - left / Math.max(1, this.total); }

  slot(c, r) { return { x: 8 + this.pitchX * (c + 0.5 + (r % 2) * 0.5) + this.sway, y: this.top + r * this.pitchY }; }
  spawnWave() {
    const cap = this.cols * this.rows, slots = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) slots.push([c, r]);
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    let used = 0, k = 0;
    while (this.queue.length && used + this.queue[0].length <= cap) {
      const u = this.queue.shift(); used += u.length;
      u.forEach(rec => { const [c, r] = slots[k]; this.bugs.push({ rec, c, r, x: 0, y: -50, phase: 'enter', t: -k * 0.13, side: k % 2 ? -1 : 1, col: BUG_COLS[rec.id % 3] }); k++; });
    }
  }

  // ——— керування ———
  fire(type) {
    if (this.phase !== 'play' || this.dead > 0) return;
    if (type === 'mega') return this.fireMega();
    if (this.cool > 0) return;
    this.cool = 0.22; this.eyeT = 0.14; this.eyeC = BEAM[type];
    this.shots.push({ type, x: this.kx, y: this.kittyY - 17 * this.P, vy: type === 'laser' ? 1150 : 880 });
    sfx[type]();
  }
  fireMega() {
    const p = this.pipe;
    if (!p || p.sealed > 0 || !this.megaReady) return;
    p.beam = 0.01; this.megaReady = false; this.mega = 0;
    sfx.mega();
    this.emit({ type: 'hud', game: this });
  }

  // ——— оцінка дій ———
  say(tone, title, text) { this.emit({ type: 'msg', tone, title, text }); }
  float(x, y, text, color) { this.texts.push({ x, y, text, color, t: 0 }); }
  good(b, pts, label) {
    this.combo++; this.best = Math.max(this.best, this.combo);
    const mult = this.combo >= 10 ? 4 : this.combo >= 6 ? 3 : this.combo >= 3 ? 2 : 1;
    this.score += pts * mult;
    this.float(b.x, b.y - this.bugH, `+${pts * mult} ${label}`, C.FIX);
    if (this.pipe && !this.pipe.sealed) { this.mega = Math.min(1, this.mega + 0.15); if (this.mega >= 1 && !this.megaReady) { this.megaReady = true; this.say('info', this.T.msg.megaReady, this.T.msg.megaReadyText); } }
    this.emit({ type: 'hud', game: this });
  }
  bad(b, pts, title, why, action) {
    this.combo = 0; this.score = Math.max(0, this.score - pts);
    this.float(b.x, b.y - this.bugH, `−${pts}`, C.RUBY_L);
    if (this.ls.mistakes.length < 40) this.ls.mistakes.push({ rec: b.rec, action, title, why });
    this.say('bad', title, why);
    sfx.bad();
    this.emit({ type: 'hud', game: this });
  }
  logAct(r, a) { this.ls.log.set(r.id, { rec: r, act: a }); }
  explode(b, big = false) { this.fx.push({ kind: 'boom', x: b.x, y: b.y, t: 0, big }); sfx.boom(); }
  why(r) { return this.T.explain[r.issue] || ''; }

  hit(b, type) {
    const r = b.rec, T = this.T.msg, X = this.T.short;
    if (type === 'laser') {
      this.explode(b); b.phase = 'gone';
      if (this.tag === b) this.tag = null;
      if (r.kind === 'err') { this.ls.deleted++; if (r.source) this.ls.srcFixed++; this.logAct(r, 'deleted'); this.good(b, 100, X[r.issue] || ''); this.say('good', T.deleted, this.why(r)); }
      else if (r.kind === 'ok') { this.ls.lost++; this.logAct(r, 'deleted'); this.bad(b, 150, T.delOk, this.why(r), 'del'); }
      else if (r.kind === 'fix') { this.ls.lost++; this.logAct(r, 'deleted'); this.bad(b, 100, T.delFix, this.why(r), 'del'); }
      else {
        this.ls.lost++; this.logAct(r, 'deleted');
        const twin = this.bugs.find(o => o.rec.id === r.pair && o.phase !== 'gone');
        if (twin) { twin.rec = { ...twin.rec, kind: 'ok', issue: 'ok', orphan: true }; }
        this.bad(b, 60, T.delDup, this.why(r), 'del');
      }
      return;
    }
    if (type === 'fix') {
      if (r.kind === 'fix') {
        b.rec = { ...r, name: r.fixName || r.name, value: r.fixValue || r.value, was: { name: r.name, value: r.value } };
        b.phase = 'clean'; b.t = 0; this.ls.fixed++; this.ls.cleanIn++; if (r.source) this.ls.srcFixed++;
        this.logAct(r, 'fixed');
        this.fx.push({ kind: 'spark', x: b.x, y: b.y, t: 0, c: C.FIX });
        this.good(b, 120, this.T.short[r.issue] || '');
        this.say('good', T.fixed, `${r.fixName ? r.name + ' → ' + r.fixName : r.value + ' → ' + r.fixValue}`);
        return;
      }
      if (r.kind === 'ok') return this.bad(b, 20, T.fixOk, this.why(r), 'fix');
      if (r.kind === 'err') return this.bad(b, 30, T.fixErr, this.why(r), 'fix');
      return this.bad(b, 30, T.fixDup, this.why(r), 'fix');
    }
    // об'єднання: перший постріл позначає, другий зливає
    if (!this.tag || this.tag.phase === 'gone' || this.tag.phase === 'clean') { this.tag = b; b.tagT = 0; this.float(b.x, b.y - this.bugH, T.tagged, C.MERGE); return; }
    if (this.tag === b) { this.tag = null; return; }
    const a = this.tag; this.tag = null;
    if (r.kind === 'dup' && a.rec.kind === 'dup' && r.pair === a.rec.id) {
      b.phase = 'merging'; b.t = 0; b.into = a;
      const keep = a.rec.canon ? a.rec : r;           // лишається канонічний запис пари
      this.logAct(r, 'merged'); this.logAct(a.rec, 'merged');
      a.rec = { ...keep, merged: true };
      a.phase = 'clean'; a.t = -0.3;
      this.ls.merged++; this.ls.cleanIn++;
      this.fx.push({ kind: 'spark', x: a.x, y: a.y, t: 0, c: C.MERGE });
      this.good(a, 200, this.T.short[r.issue] || '');
      this.say('good', T.merged, this.why(r));
      return;
    }
    this.ls.falseMerge++;
    this.bad(b, 150, T.falseMerge, r.issue === 'namesake' || a.rec.issue === 'namesake' ? this.T.explain.namesake : T.falseMergeText, 'merge');
  }

  pass(b) {
    const r = b.rec, T = this.T.msg;
    b.phase = 'gone';
    this.fx.push({ kind: 'drop', x: b.x, y: this.whY, t: 0, c: r.kind === 'ok' ? C.FIX : C.RUBY_L });
    if (r.kind === 'ok') { this.ls.cleanIn++; this.ls.kept++; this.logAct(r, 'kept'); this.good(b, 50, this.T.short.ok); return; }
    if (r.kind === 'dup') {
      // перший із пари в сховищі ще не біда, другий уже дублікат
      if (this.ls.log.get(r.pair)?.act === 'passed') { this.ls.dirtyIn++; this.logAct(r, 'passed'); this.bad(b, 50, T.passDup, this.why(r), 'pass'); }
      else { this.ls.cleanIn++; this.logAct(r, 'passed'); }
      return;
    }
    this.ls.dirtyIn++; this.logAct(r, 'passed');
    if (r.source) this.ls.srcMissed = (this.ls.srcMissed || 0) + 1;
    this.bad(b, r.kind === 'err' ? 100 : 50, r.kind === 'err' ? T.passErr : T.passFix, this.why(r), 'pass');
  }

  loseLife() {
    this.lives--; this.dead = 1.3; this.combo = 0;
    this.fx.push({ kind: 'boom', x: this.kx, y: this.kittyY - 12 * this.P, t: 0, big: true });
    sfx.hurt();
    this.say('bad', this.T.msg.hit, this.T.msg.hitText);
    this.emit({ type: 'hud', game: this });
    if (this.lives <= 0) { this.phase = 'over'; setTimeout(() => this.emit({ type: 'gameover', summary: this.summary(false) }), 900); }
  }

  summary(done) {
    const s = this.ls, q = s.cleanIn / Math.max(1, s.cleanIn + s.dirtyIn + s.lost);
    const stars = q >= 0.95 ? 3 : q >= 0.85 ? 2 : q >= 0.7 ? 1 : 0;
    // навички рахуємо за журналом дій; записи з труби джерела окремо, щоб не завищити частки
    const log = [...s.log.values()], own = x => !x.rec.source, cnt = f => log.filter(x => own(x) && f(x)).length;
    return { lv: this.lv, done, quality: q, stars, score: this.score, levelScore: this.score - s.score0, best: this.best,
      skills: {
        fix: [Math.min(s.totals.fix, cnt(x => x.act === 'fixed')), s.totals.fix],
        del: [Math.min(s.totals.err, cnt(x => x.act === 'deleted' && x.rec.kind === 'err')), s.totals.err],
        merge: [s.merged, s.totals.dup],
        keep: [Math.min(s.totals.ok, cnt(x => x.act === 'kept' && !x.rec.orphan)), s.totals.ok],
      },
      source: { cleaned: log.filter(x => x.rec.source && (x.act === 'fixed' || x.act === 'deleted')).length, missed: s.srcMissed || 0 },
      falseMerge: s.falseMerge, mistakes: s.mistakes, log };
  }

  // ——— крок симуляції ———
  update(dt) {
    this.t += dt;
    for (const s of this.stars) { s.y += s.v * dt; if (s.y > this.H) s.y -= this.H; }
    if (this.phase !== 'play' && this.phase !== 'over') return;
    this.sway = Math.sin(this.t * 0.7) * Math.min(14, this.pitchX * 0.06);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 2.2) this.banner = null; }
    // котик
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0 && this.lives > 0) { this.kx = this.W / 2; this.invuln = 2.5; } }
    else {
      const sp = 430 * dt;
      if (this.keys.left) this.kx -= sp;
      if (this.keys.right) this.kx += sp;
      if (this.target != null && !this.keys.left && !this.keys.right) this.kx += (this.target - this.kx) * Math.min(1, dt * 12);
      this.kx = Math.max(14 * this.P, Math.min(this.W - 14 * this.P, this.kx));
    }
    this.invuln = Math.max(0, this.invuln - dt); this.cool = Math.max(0, this.cool - dt); this.eyeT = Math.max(0, this.eyeT - dt); this.power = Math.max(0, this.power - dt);
    if (this.phase === 'over') { this.stepFx(dt); return; }
    // жуки
    for (const b of this.bugs) {
      b.t += dt;
      if (b.phase === 'enter') {
        const s = this.slot(b.c, b.r), u = ease(b.t / 1.1);
        if (b.t < 0) { b.x = s.x + b.side * 140; b.y = -60; continue; }
        b.x = s.x + b.side * 140 * (1 - u) * Math.cos(u * 3); b.y = -60 + (s.y + 60) * u;
        if (b.t >= 1.1) { b.phase = 'form'; }
      } else if (b.phase === 'form') { const s = this.slot(b.c, b.r); b.x = s.x; b.y = s.y + Math.sin(this.t * 2 + b.c) * 1.5; }
      else if (b.phase === 'dive') {
        const d = b.dive, u = b.t / d.dur;
        b.y = d.y0 + (this.whY + 4 - d.y0) * u;
        b.x = Math.max(this.cardW / 2 + 4, Math.min(this.W - this.cardW / 2 - 4, d.x0 + d.amp * Math.sin(u * Math.PI * d.freq) * d.dir));
        if (b.y >= this.whY) this.pass(b);
      } else if (b.phase === 'clean') {
        if (b.t > 0.55) { b.y += 300 * dt; if (b.y >= this.whY) { b.phase = 'gone'; this.fx.push({ kind: 'drop', x: b.x, y: this.whY, t: 0, c: C.FIX }); } }
      } else if (b.phase === 'merging') {
        const a = b.into, u = Math.min(1, b.t / 0.35);
        b.x += (a.x - b.x) * u; b.y += (a.y - b.y) * u;
        if (u >= 1) b.phase = 'gone';
      }
      if (b.tagT != null) b.tagT += dt;
    }
    if (this.tag && this.tag.tagT > 10) this.tag = null;
    this.bugs = this.bugs.filter(b => b.phase !== 'gone');
    // пікірування: пари летять разом
    this.diveTimer -= dt;
    const inForm = this.bugs.filter(b => b.phase === 'form').length;
    if (inForm && inForm <= 2 && this.diveTimer > 1.6) this.diveTimer = 1.6;
    const flying = this.bugs.filter(b => b.phase === 'dive').length;
    if (this.diveTimer <= 0 && flying < 3) {
      const form = this.bugs.filter(b => b.phase === 'form');
      if (form.length) {
        const b = form[Math.floor(Math.random() * form.length)];
        const group = [b, ...this.bugs.filter(o => o.phase === 'form' && o !== b && (o.rec.id === b.rec.pair || o.rec.id === b.rec.twin))];
        const dir = Math.random() < 0.5 ? -1 : 1;
        group.forEach((g, k) => { g.phase = 'dive'; g.t = -k * 0.25; g.dive = { x0: g.x, y0: g.y, dur: this.pace('diveT') * (0.9 + Math.random() * 0.2), amp: 30 + Math.random() * 70, freq: 1 + Math.random(), dir: k ? -dir : dir }; });
      }
      this.diveTimer = this.pace('dive') * (0.75 + Math.random() * 0.5);
    }
    // постріли
    for (const s of this.shots) {
      s.y -= s.vy * dt;
      const hitB = this.bugs.filter(b => (b.phase === 'form' || b.phase === 'dive' || b.phase === 'enter') && b.t >= 0 && Math.abs(s.x - b.x) <= this.hitW && s.y >= b.y - this.bugH * 0.7 && s.y <= b.y + this.bugH * 0.7).sort((a, c) => c.y - a.y)[0];
      if (hitB) { s.dead = true; this.hit(hitB, s.type); }
      if (s.y < -20) s.dead = true;
    }
    this.shots = this.shots.filter(s => !s.dead);
    // «#Н/Д» у відповідь від помилкових записів
    const pe = this.pace('pellet');
    if (pe) {
      this.pelletTimer -= dt;
      if (this.pelletTimer <= 0) {
        const src = this.bugs.filter(b => b.rec.kind === 'err' && (b.phase === 'form' || b.phase === 'dive'));
        if (src.length) { const b = src[Math.floor(Math.random() * src.length)]; this.pellets.push({ x: b.x, y: b.y + this.bugH * 0.5, vx: (this.kx - b.x) * 0.12, vy: 150 + this.lv * 10 }); }
        this.pelletTimer = pe * (0.7 + Math.random() * 0.6);
      }
    }
    for (const p of this.pellets) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (this.dead <= 0 && this.invuln <= 0 && Math.abs(p.x - this.kx) < 9 * this.P && p.y > this.kittyY - 24 * this.P && p.y < this.kittyY) { p.dead = true; this.loseLife(); }
      if (p.y > this.H) p.dead = true;
    }
    this.pellets = this.pellets.filter(p => !p.dead);
    // капібара з правилом перевірки
    if (!this.ufoDone && this.progress() > 0.38) { this.ufoDone = true; this.ufo = { x: -50, y: 30, dir: 1, drop: this.W * (0.25 + Math.random() * 0.5) }; this.say('info', this.T.msg.ufo, this.T.msg.ufoText); }
    if (this.ufo) {
      this.ufo.x += 120 * dt;
      if (!this.caps && this.ufo.x >= this.ufo.drop) this.caps = { x: this.ufo.x, y: this.ufo.y + 14 };
      if (this.ufo.x > this.W + 60) this.ufo = null;
    }
    if (this.caps) {
      this.caps.y += 100 * dt;
      if (Math.abs(this.caps.x - this.kx) < 14 * this.P && this.caps.y > this.kittyY - 26 * this.P && this.dead <= 0) { this.caps = null; this.power = 12; this.score += 250; sfx.power(); this.float(this.kx, this.kittyY - 30 * this.P, '+250 ' + this.T.msg.rule, C.AMBER); this.say('good', this.T.msg.ruleOn, this.T.msg.ruleText); this.emit({ type: 'hud', game: this }); }
      else if (this.caps.y > this.H) this.caps = null;
    }
    // труба джерела: ті самі помилки знову й знову, доки немає перевірки на вході
    const p = this.pipe;
    if (p) {
      p.x = this.W / 2;
      if (p.beam > 0) { p.beam += dt; if (p.beam > 0.6 && !p.sealed) { p.sealed = 0.01; this.score += 1000; this.say('good', this.T.msg.sealed, this.T.msg.sealedText); this.emit({ type: 'hud', game: this }); } if (p.beam > 1.2) p.beam = 0; }
      if (p.sealed > 0) p.sealed = Math.min(1, p.sealed + dt * 1.5);
      else if (!p.beam) {
        p.timer -= dt;
        if (p.timer <= 0) {
          const rec = sourceRecord(p.n++, this.lang);
          this.bugs.push({ rec, src: true, c: 0, r: 0, x: p.x, y: p.y + 20, phase: 'dive', t: 0, side: 1, col: BUG_COLS[rec.id % 3], dive: { x0: p.x, y0: p.y + 20, dur: this.pace('diveT') * 0.9, amp: 60 + Math.random() * 120, freq: 1 + Math.random(), dir: Math.random() < 0.5 ? -1 : 1 } });
          p.timer = p.every * (0.8 + Math.random() * 0.4);
          if (p.n === 6 && !p.told) { p.told = true; this.say('info', this.T.msg.again, this.T.msg.againText); }
        }
      }
    }
    // нова хвиля або кінець рівня
    const alive = this.bugs.filter(b => b.phase !== 'gone' && !b.src).length;
    const forming = this.bugs.some(b => b.phase === 'form' || b.phase === 'enter');
    if (!forming && this.queue.length && this.bugs.filter(b => b.phase === 'dive').length <= 2) this.spawnWave();
    const anyLeft = this.bugs.some(b => b.phase !== 'gone');
    if (!alive && !this.queue.length && !anyLeft && (!p || p.sealed >= 1)) {
      this.phase = 'done';
      this.history.push(this.summary(true));
      setTimeout(() => this.emit({ type: 'levelEnd', summary: this.history[this.history.length - 1] }), 700);
    }
    this.stepFx(dt);
  }
  stepFx(dt) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < (f.kind === 'boom' ? 0.9 : 0.7));
    for (const x of this.texts) x.t += dt;
    this.texts = this.texts.filter(x => x.t < 1.3);
  }

  // ——— малювання ———
  draw(ctx) {
    const { W, H, P } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.BG); g.addColorStop(1, C.BG2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const s of this.stars) { ctx.fillStyle = s.s > 1 ? 'rgba(240,242,246,.55)' : 'rgba(170,178,192,.35)'; ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s); }
    if (this.phase === 'idle') { this.drawAttract(ctx); return; }
    const T = this.T;
    // труба
    if (this.pipe) pipe(ctx, this.pipe.x, this.pipe.y, P * 0.7, T.pipe, this.pipe.sealed, T.pipeSealed);
    if (this.ufo) ufo(ctx, this.ufo.x, this.ufo.y + 6, P, this.t, 1);
    if (this.caps) { capsule(ctx, this.caps.x, this.caps.y, P * 0.8, this.t); this.label(ctx, T.msg.rule, this.caps.x, this.caps.y + 9 * P, C.AMBER, 10); }
    // лінії між двійниками, коли діє правило перевірки
    if (this.power > 0) {
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(192,132,252,.7)'; ctx.lineWidth = 1.5;
      for (const b of this.bugs) { if (b.rec.kind !== 'dup' || b.phase === 'gone') continue; const o = this.bugs.find(x => x.rec.id === b.rec.pair && x.phase !== 'gone'); if (o && o.rec.id > b.rec.id) { ctx.beginPath(); ctx.moveTo(b.x, b.y + this.bugH); ctx.lineTo(o.x, o.y + this.bugH); ctx.stroke(); } }
      ctx.restore();
    }
    // жуки й картки
    const order = this.bugs.filter(b => b.phase !== 'gone' && b.t >= 0).sort((a, b) => (a.phase === 'dive') - (b.phase === 'dive') || a.y - b.y);
    for (const b of order) this.drawBug(ctx, b);
    // постріли
    for (const s of this.shots) {
      if (s.type === 'laser') { ctx.fillStyle = C.RUBY; for (const dx of [-3.5 * P, 4 * P]) { ctx.fillRect(Math.round(s.x + dx - 1.5), s.y - 14, 3, 16); } ctx.fillStyle = C.WHITE; for (const dx of [-3.5 * P, 4 * P]) ctx.fillRect(Math.round(s.x + dx - 0.5), s.y - 13, 1, 14); }
      else if (s.type === 'fix') { ctx.fillStyle = C.FIX; ctx.beginPath(); ctx.moveTo(s.x, s.y - 9); ctx.lineTo(s.x + 5, s.y); ctx.lineTo(s.x, s.y + 9); ctx.lineTo(s.x - 5, s.y); ctx.fill(); ctx.fillStyle = C.WHITE; ctx.fillRect(s.x - 1, s.y - 4, 2, 8); }
      else { ctx.strokeStyle = C.MERGE; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = C.WHITE; ctx.fillRect(s.x - 1, s.y - 1, 2, 2); }
    }
    // «#Н/Д»
    ctx.font = `700 10px ${MONO}`; ctx.textAlign = 'center';
    for (const p of this.pellets) { ctx.fillStyle = 'rgba(255,176,32,.18)'; ctx.fillRect(p.x - 17, p.y - 9, 34, 14); ctx.fillStyle = C.AMBER; ctx.fillText(T.na, p.x, p.y + 1); }
    ctx.textAlign = 'left';
    // мегапромінь
    if (this.pipe && this.pipe.beam > 0) {
      const a = Math.min(1, this.pipe.beam * 3) * (this.pipe.beam > 0.9 ? 1 - (this.pipe.beam - 0.9) / 0.3 : 1);
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      const ey = this.kittyY - 17 * P;
      ctx.fillStyle = C.RUBY; ctx.beginPath(); ctx.moveTo(this.kx - 6 * P, ey); ctx.lineTo(this.kx + 6 * P, ey); ctx.lineTo(this.pipe.x + 10, this.pipe.y + 14); ctx.lineTo(this.pipe.x - 10, this.pipe.y + 14); ctx.fill();
      ctx.fillStyle = C.RUBY_L; ctx.beginPath(); ctx.moveTo(this.kx - 2 * P, ey); ctx.lineTo(this.kx + 2 * P, ey); ctx.lineTo(this.pipe.x + 4, this.pipe.y + 14); ctx.lineTo(this.pipe.x - 4, this.pipe.y + 14); ctx.fill();
      ctx.restore();
    }
    // котик
    if (this.dead <= 0 && !(this.invuln > 0 && Math.floor(this.t * 12) % 2)) kitty(ctx, this.kx, this.kittyY, P, this.t, this.eyeT > 0 ? this.eyeC : this.pipe && this.pipe.beam > 0 ? C.RUBY_L : null, this.t % 4 < 0.12);
    // ефекти
    for (const f of this.fx) {
      if (f.kind === 'boom') boom(ctx, f.x, f.y, P, f.t / 0.9, f.big);
      else if (f.kind === 'spark') { const u = f.t / 0.7; ctx.fillStyle = f.c; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = 6 + u * 34; ctx.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r), P, P); } }
      else if (f.kind === 'drop') { const u = f.t / 0.7; ctx.globalAlpha = 1 - u; ctx.fillStyle = f.c; ctx.fillRect(f.x - 20 * (1 - u) - 4, f.y - 2, 40 * (1 - u) + 8, 3); ctx.globalAlpha = 1; }
    }
    for (const x of this.texts) { ctx.globalAlpha = Math.max(0, 1 - x.t / 1.3); this.label(ctx, x.text, x.x, x.y - x.t * 26, x.color, 12, true); ctx.globalAlpha = 1; }
    this.drawHud(ctx);
    if (this.banner) {
      const a = Math.min(1, this.banner.t * 3, (2.2 - this.banner.t) * 2.5);
      ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
      ctx.fillStyle = C.RUBY_L; ctx.font = `800 ${Math.round(Math.min(34, W / 18))}px ${MONO}`; ctx.fillText(this.banner.text, W / 2, H * 0.52);
      ctx.fillStyle = C.WHITE; ctx.font = `700 ${Math.round(Math.min(18, W / 30))}px ${MONO}`; ctx.fillText(this.banner.sub.toUpperCase(), W / 2, H * 0.52 + 30);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
  }
  drawAttract(ctx) {
    const { W, H, P, t } = this, labels = ['NULL', 'DUP', this.T.na, '1900', 'TEST', '#REF!'];
    const n = Math.min(6, Math.max(3, Math.floor(W / 150)));
    ctx.globalAlpha = 0.55;
    for (let k = 0; k < n; k++) {
      const x = W * (k + 0.5) / n + Math.sin(t * 0.7) * 10, y = 70 + Math.sin(t * 2 + k) * 3;
      bug(ctx, x, y, P, t, BUG_COLS[k % 3]);
      this.label(ctx, labels[k % labels.length], x, y + 9 * P, C.SILVER, 11, true);
    }
    kitty(ctx, W / 2 + Math.sin(t * 0.9) * W * 0.18, H - 28, P, t, Math.floor(t * 1.5) % 3 === 0 ? C.RUBY_L : null, t % 4 < 0.12);
    ctx.globalAlpha = 1;
  }
  label(ctx, s, x, y, c, size = 11, bold = false) {
    ctx.font = `${bold ? 700 : 500} ${size}px ${MONO}`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,8,12,.85)'; ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  fit(ctx, s, w) { if (ctx.measureText(s).width <= w) return s; let t = s; while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
  drawBug(ctx, b) {
    const { P } = this, r = b.rec, hint = this.power > 0 && r.kind !== 'ok';
    const tagged = this.tag === b, clean = b.phase === 'clean';
    bug(ctx, b.x, b.y, P, this.t, b.col, { flash: b.phase === 'merging', eyes: clean ? C.FIX : tagged ? C.MERGE : undefined });
    const w = this.cardW, h = this.cardH, x = Math.round(b.x - w / 2), y = Math.round(b.y + this.bugH * 0.5 + 3);
    ctx.fillStyle = clean ? 'rgba(10,32,30,.94)' : 'rgba(14,19,27,.94)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = clean ? C.FIX : tagged ? C.MERGE : hint ? C.AMBER : 'rgba(255,255,255,.18)'; ctx.lineWidth = tagged || clean ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (tagged) { ctx.fillStyle = C.MERGE; ctx.fillRect(x - 3, y - 3, 8, 2); ctx.fillRect(x - 3, y - 3, 2, 8); ctx.fillRect(x + w - 5, y + h + 1, 8, 2); ctx.fillRect(x + w + 1, y + h - 5, 2, 8); }
    // значення не обрізаємо: помилка буває саме в кінці (адреса без домену), тож зменшуємо шрифт, доки не вміститься
    const room = w - 12 - (clean ? 12 : 0);
    let fs = 12;
    ctx.font = `600 ${fs}px ${FONT}`;
    while (ctx.measureText(r.name).width > room && fs > 9) { fs -= 0.5; ctx.font = `600 ${fs}px ${FONT}`; }
    ctx.fillStyle = hint && (r.issue === 'nameCase' || r.issue === 'placeholderName' || r.kind === 'dup') ? C.AMBER : C.WHITE;
    ctx.fillText(this.fit(ctx, r.name, room), x + 6, y + 16);
    let lab = w >= 150 ? this.T.fields[r.field] + ' ' : '';
    fs = 11.5; ctx.font = `500 ${fs}px ${MONO}`;
    const need = () => ctx.measureText(lab).width + ctx.measureText(r.value).width;
    while (need() > w - 12 && fs > 8) { fs -= 0.5; ctx.font = `500 ${fs}px ${MONO}`; }
    if (need() > w - 12) lab = '';
    ctx.fillStyle = C.SILVER; if (lab) ctx.fillText(lab, x + 6, y + 32);
    const lw = lab ? ctx.measureText(lab).width : 0;
    ctx.fillStyle = hint && r.kind !== 'dup' && r.issue !== 'nameCase' && r.issue !== 'placeholderName' ? C.AMBER : clean ? '#8FF5E5' : '#DCE2EA';
    ctx.fillText(this.fit(ctx, r.value, w - 12 - lw), x + 6 + lw, y + 32);
    if (clean) { ctx.fillStyle = C.FIX; ctx.font = `700 11px ${MONO}`; ctx.textAlign = 'right'; ctx.fillText(r.merged ? this.T.mergedTag : '✓', x + w - 6, y + 16); ctx.textAlign = 'left'; }
    else if (hint) {
      // ярлик правила перевірки на правому верхньому куті картки
      const tag = this.T.hintTag[r.kind === 'dup' ? 'dup' : r.kind === 'fix' ? 'fix' : /^placeholder/.test(r.issue) ? 'ph' : 'err'];
      ctx.font = `700 9.5px ${MONO}`; const tw = ctx.measureText(tag).width + 10;
      ctx.fillStyle = C.AMBER; ctx.fillRect(x + w - tw - 4, y - 7, tw, 13);
      ctx.fillStyle = C.DARK; ctx.fillText(tag, x + w - tw + 1, y + 3);
    }
  }
  drawHud(ctx) {
    const { W, H, P } = this, T = this.T;
    // сховище
    ctx.fillStyle = '#080B10'; ctx.fillRect(0, this.whY, W, H - this.whY);
    ctx.fillStyle = 'rgba(217,4,41,.55)'; ctx.fillRect(0, this.whY, W, 1);
    for (let k = 0; k < this.lives; k++) kittyHead(ctx, 14 + k * 22, this.whY + 13, 2);
    ctx.font = `700 11px ${MONO}`; ctx.fillStyle = C.SILVER;
    ctx.fillText(T.hud.warehouse, 14 + Math.max(3, this.lives) * 22 + 6, this.whY + 15);
    const s = this.ls, n = s ? s.cleanIn + s.dirtyIn + s.lost : 0, q = n ? s.cleanIn / n : 1;
    ctx.textAlign = 'right'; ctx.fillStyle = !n ? C.SILVER : q >= 0.85 ? '#8FF5E5' : q >= 0.7 ? C.AMBER : C.RUBY_L;
    ctx.fillText(`${T.hud.quality} ${n ? Math.round(q * 100) + '%' : '…'}`, W - 12, this.whY + 15); ctx.textAlign = 'left';
    if (this.pipe && !this.pipe.sealed) {
      const mw = Math.min(180, W * 0.3), mx = W / 2 - mw / 2, my = this.whY + 8;
      ctx.fillStyle = '#1C2A42'; ctx.fillRect(mx, my, mw, 7);
      ctx.fillStyle = this.megaReady ? (Math.floor(this.t * 6) % 2 ? C.RUBY_L : C.RUBY) : C.RUBY; ctx.fillRect(mx, my, mw * this.mega, 7);
      ctx.fillStyle = C.SILVER; ctx.font = `700 9px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText(this.megaReady ? T.hud.megaReady : T.hud.mega, W / 2, my - 2); ctx.textAlign = 'left';
    }
    // верхній рядок
    ctx.font = `700 12px ${MONO}`; ctx.fillStyle = C.RUBY_L;
    ctx.fillText(`${T.hud.level} ${this.lv}`, 12, 20);
    ctx.fillStyle = C.SILVER; ctx.fillText(this.fit(ctx, T.levels[this.lv - 1].title.toUpperCase(), W * 0.36), 12 + ctx.measureText(`${T.hud.level} ${this.lv}  `).width, 20);
    ctx.textAlign = 'right'; ctx.fillStyle = C.WHITE; ctx.fillText(`${T.hud.score} ${String(this.score).padStart(5, '0')}`, W - 12, 20);
    if (this.combo >= 3) { ctx.fillStyle = C.FIX; ctx.fillText(`×${this.combo >= 10 ? 4 : this.combo >= 6 ? 3 : 2} ${T.hud.combo} ${this.combo}`, W - 12, 36); }
    if (this.power > 0) { ctx.fillStyle = C.AMBER; ctx.fillText(`${T.msg.rule} ${Math.ceil(this.power)}`, W - 12, this.combo >= 3 ? 52 : 36); }
    ctx.textAlign = 'left';
  }
}
