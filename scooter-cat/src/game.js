// Ігровий цикл: рівень, герой, керування, фіксований крок фізики, ворота, контрольні точки, точки даних,
// баги даних і лазери з очей, падіння і фініш. Малювання винесено в draw.js; тут лише стан і правила.
import { buildLevel, LEVEL_IDS } from './levels.js';
import { Scooter, CHARACTERS } from './physics.js';
import { drawGame } from './draw.js';
import { sfx, engine } from './audio.js';

const DT = 1 / 600;
// ціль за часом, с: час автопілота котика на 10 м/с плюс 15%
export const PAR = { trend: 31, hist: 19, season: 30, pareto: 19, outliers: 29, axis: 22, stacked: 23, waterfall: 17, log: 33, control: 21, multiples: 25, forecast: 33 };
export const CHAR_IDS = ['cat', 'capy', 'head'];
const LASER = { cool: 0.28, range: 10, cone: Math.cos((40 * Math.PI) / 180), life: 0.16 };

export class Game {
  constructor({ T, lang, emit, reduced = false }) {
    this.T = T; this.lang = lang; this.emit = emit || (() => {}); this.reduced = reduced;
    this.mode = 'normal'; this.char = 'cat';
    this.input = { gas: false, brake: false, lean: 0 };
    this.keys = { gas: false, brake: false, back: false, fwd: false };
    this.W = 960; this.H = 560; this.acc = 0; this.t = 0;
    this.fx = []; this.cam = null; this.beams = [];
    this.load('trend');
    this.state = 'idle';
  }

  layout(W, H) { this.W = W; this.H = H; this.baseScale = Math.max(38, Math.min(70, Math.min(W / (W < 620 ? 9.5 : 11.5), H / 8.5))); }

  load(id, char = this.char) {
    this.char = char;
    this.L = buildLevel(id);
    this.id = id; this.par = PAR[id];
    this.sc = new Scooter(CHARACTERS[char]);
    this.sc.place(this.L.terrain, this.L.spawnX);
    this.cp = { x: this.L.spawnX, n: 0 };
    this.time = 0; this.started = false; this.crashes = 0; this.got = new Set(); this.pops = [];
    this.crashT = 0; this.rider = null; this.revealX = this.L.reveal ? this.L.reveal.x0 : Infinity;
    this.finished = false; this.finishT = 0; this.stuckT = 0; this.hint = null; this.tipT = 0;
    this.fx = []; this.beams = []; this.cam = null; this.acc = 0; this.cool = 0; this.eyeT = 0;
    this.zapped = 0; this.bitten = 0;
    this.L.gates.forEach(g => { g.started = false; g.morph.t = 0; });
    this.L.terrain.applyMorphs();
    this.state = 'ready';
  }

  start() { this.state = 'play'; }
  snd(name, arg) { if (!this.quiet) sfx[name](arg); }

  setKeys(k) {
    Object.assign(this.keys, k);
    const K = this.keys;
    this.input = { gas: K.gas, brake: K.brake, lean: (K.fwd ? 1 : 0) - (K.back ? 1 : 0) };
  }

  // Автопілот: тримає раму під схилом (моноколесо вертикально), рівну швидкість і стріляє в баги попереду
  // нахил поверхні під x: без стінок сходинок, а над проваллям це нахил дальнього краю, куди приземлятися
  surf(x, h = 0.6) {
    for (const p of this.L.pits) if (x > p.x0 - 0.3 && x < p.x1 + 0.3) x = p.x1 + 0.9;
    return this.L.terrain.slope(x, h);
  }

  autopilot(vTarget = 9) {
    const sc = this.sc, grounded = sc.grounded(), mono = !!sc.S.balance;
    if (mono) {
      // моноколесо: на крутому підйомі відхилитися назад (голова далі від схилу), у повітрі тримати раму вертикально
      const sl = this.surf(sc.x + 0.8, 0.7);
      let e = -sc.a; e = Math.atan2(Math.sin(e), Math.cos(e));
      const u = e - 0.15 * sc.w;
      const lean = grounded ? (sl > 0.22 ? -1 : sl < -0.3 ? 1 : 0) : u > 0.08 ? -1 : u < -0.08 ? 1 : 0;
      this.input = { gas: sc.vx < vTarget, brake: sc.vx > vTarget + 2.5, lean };
    } else {
      const tgt = this.surf(grounded ? sc.x + 0.5 : sc.x + sc.vx * 0.35, 0.6);
      let e = tgt - sc.a; e = Math.atan2(Math.sin(e), Math.cos(e));
      const u = e - 0.12 * sc.w;
      this.input = { gas: sc.vx < vTarget, brake: sc.vx > vTarget + 2.5, lean: u > 0.07 ? -1 : u < -0.07 ? 1 : 0 };
    }
    if (this.L.bugs.some(b => b.alive && b.x > sc.x + 0.8 && b.x < sc.x + 7.5)) this.fire();
  }

  respawn() {
    const L = this.L;
    this.sc.place(L.terrain, this.cp.x);
    this.rider = null; this.crashT = 0; this.stuckT = 0; this.tipT = 0; this.state = 'play';
    this.safeT = 0.6;
    this.emit({ type: 'respawn' });
  }

  // ——— лазер з очей: б'є найближчий баг попереду (автонаведення в конусі), інакше світить уперед до траси ———
  fire() {
    if (this.state !== 'play' || this.cool > 0) return false;
    this.cool = LASER.cool; this.eyeT = 0.18;
    const sc = this.sc, eyes = sc.eyesWorld(), [hx, hy] = sc.toWorld(...sc.headLocal());
    // куди дивиться герой: уздовж рами, а моноколесо (рама майже вертикальна) уздовж схилу під колесом
    const aim = sc.S.balance ? this.L.terrain.angle(sc.x + 0.6, 0.8) : sc.a;
    const fx = Math.cos(aim), fy = Math.sin(aim);
    let best = null, bd = Infinity;
    for (const b of this.L.bugs) {
      if (!b.alive) continue;
      const [bx, by] = this.bugPos(b), dx = bx - hx, dy = by - hy, d = Math.hypot(dx, dy);
      if (d < 0.4 || d > LASER.range || (dx * fx + dy * fy) / d < LASER.cone) continue;
      if (!this.sight(hx, hy, bx, by)) continue;
      if (d < bd) { bd = d; best = b; }
    }
    let tx, ty;
    if (best) { [tx, ty] = this.bugPos(best); best.alive = false; best.dead = 0; this.zapped++; this.pops.push({ x: tx, y: ty, t: 0, k: 'zap' }); }
    else {
      const a = aim - 0.12, dx = Math.cos(a), dy = Math.sin(a);
      let d = LASER.range;
      for (let s = 0.4; s <= LASER.range; s += 0.2) if (this.L.terrain.height(hx + dx * s) > hy + dy * s) { d = s; break; }
      tx = hx + dx * d; ty = hy + dy * d;
    }
    eyes.forEach(([ex, ey], k) => this.beams.push({ k, x0: ex, y0: ey, x1: tx + (ey - hy) * 0.3, y1: ty + (ey - hy) * 0.3, t: 0, hit: !!best }));
    this.snd('laser'); if (best) this.snd('zap');
    return true;
  }
  sight(x0, y0, x1, y1) {
    const T = this.L.terrain, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25);
    for (let k = 1; k < n; k++) { const u = k / n; if (T.height(x0 + (x1 - x0) * u) > y0 + (y1 - y0) * u + 0.05) return false; }
    return true;
  }
  bugPos(b) { return [b.x, this.L.terrain.height(b.x) + (b.fly ? 1.75 + Math.sin(this.t * 2.2 + b.x) * 0.25 : 0.2)]; }

  update(dt) {
    this.t += dt;
    const L = this.L, sc = this.sc;
    this.cool = Math.max(0, this.cool - dt); this.eyeT = Math.max(0, this.eyeT - dt);
    if (this.state === 'play' || this.state === 'crash' || this.state === 'finish') {
      if (this.state === 'play' && !this.started && (this.input.gas || this.input.lean || this.input.brake)) this.started = true;
      if (this.started && this.state !== 'finish') this.time += dt;
      // ворота: шкала ділянки попереду змінюється за dur секунд
      let morphing = false;
      for (const g of L.gates) {
        if (!g.started && sc.x > g.x) { g.started = true; this.emit({ type: 'gate', gate: g }); this.snd('gate'); }
        if (g.started && g.morph.t < 1) { g.morph.t = Math.min(1, g.morph.t + dt / g.dur); morphing = true; }
      }
      if (morphing) L.terrain.applyMorphs();
      // фізика фіксованим кроком
      const inp = this.state === 'play' ? this.input : { gas: false, brake: this.state === 'finish', lean: 0 };
      this.acc += Math.min(dt, 1 / 20);
      const assist = this.mode === 'calm' ? 1 : 0;
      while (this.acc >= DT) {
        sc.step(DT, inp, L.terrain, assist);
        if (this.rider) this.stepRider(DT);
        this.acc -= DT;
      }
      if (this.safeT > 0) { this.safeT -= dt; sc.crashed = false; }
      this.effects(dt);
      if (this.state === 'play') this.rules(dt);
      else if (this.state === 'crash') { this.crashT += dt; if (this.crashT > 1.25) this.respawn(); }
      else if (this.state === 'finish') { this.finishT += dt; if (this.finishT > 0.9 && !this.summarySent) { this.summarySent = true; this.emit({ type: 'finish', summary: this.summary() }); } }
      if (!this.quiet) engine(this.state === 'play' ? Math.abs(sc.wh[0].om) * sc.S.r : 0, this.state === 'play' && this.input.gas);
    } else engine(0, false);
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter(b => b.t < LASER.life);
    for (const b of L.bugs) if (b.dead != null) b.dead += dt;
    this.camera(dt);
  }

  rules(dt) {
    const L = this.L, sc = this.sc, T = L.terrain;
    for (const c of L.checkpoints) if (!c.hit && sc.x > c.x) {
      c.hit = true; this.cp = { x: c.x, n: L.checkpoints.indexOf(c) + 1 };
      this.emit({ type: 'checkpoint', n: this.cp.n }); this.snd('checkpoint');
    }
    // точки даних: збираються, коли герой проїжджає поруч (у стрибку над точкою вона лишається)
    const h0 = sc.S.r - sc.S.anchors[0][1];
    for (const s of L.samples) {
      if (this.got.has(s.i) || Math.abs(s.x - sc.x) > 1.1) continue;
      if (s.x > this.revealX + 0.5) continue;
      const y = T.height(s.x);
      if (Math.abs(sc.y - h0 - y) < 1.25) { this.got.add(s.i); this.pops.push({ x: s.x, y, t: 0 }); this.snd('point'); }
    }
    if (L.reveal) this.revealX = Math.max(this.revealX, sc.x + L.reveal.dist);
    // баги, яких не прибрали лазером, кусаються: герой спотикається
    const [hx, hy] = sc.toWorld(...sc.headLocal());
    for (const b of L.bugs) {
      if (!b.alive) continue;
      const [bx, by] = this.bugPos(b);
      if (Math.hypot(bx - sc.x, by - sc.y) < 0.62 || Math.hypot(bx - hx, by - hy) < 0.5) {
        b.alive = false; b.dead = 0; this.bitten++;
        sc.vx *= 0.55; sc.wh.forEach(W => { W.vx *= 0.55; W.om *= 0.55; });
        if (sc.grounded()) sc.vy += 1.4;
        this.pops.push({ x: bx, y: by, t: 0, k: 'bite' });
        this.emit({ type: 'bite', n: this.bitten }); this.snd('bite');
      }
    }
    // провалля між панелями: хто не долетів, той падає
    let pit = false;
    for (const p of L.pits) if (sc.x > p.x0 - 0.4 && sc.x < p.x1 + 0.4 && sc.y < p.y) { sc.crashed = true; pit = true; break; }
    if (sc.crashed) {
      this.state = 'crash'; this.crashes++; this.crashT = 0;
      const [x, y] = sc.toWorld(...sc.headLocal());
      this.rider = { x, y, vx: sc.vx * 0.8, vy: sc.vy * 0.6 + (pit ? 0 : 2.2), a: sc.a, w: -sc.vx * 1.2 + sc.w * 0.5, r: sc.S.crash[0].r };
      this.emit({ type: 'crash', n: this.crashes, pit }); this.snd('crash', this.char);
      return;
    }
    if (sc.x > L.finishX) {
      this.state = 'finish'; this.finished = true; this.finishT = 0; this.summarySent = false; this.snd('finish');
      return;
    }
    // герой став сторч і не рухається: вважаємо падінням
    let rel = sc.a - (sc.S.balance ? 0 : this.surf(sc.x, 1)); rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.tipT = Math.abs(rel) > 1.25 && sc.speed() < 0.8 ? this.tipT + dt : 0;
    if (this.tipT > 1) { sc.crashed = true; this.tipT = 0; }
    // застрягли: підказка про повернення на контрольну точку
    if (sc.speed() < 0.25 && this.started) this.stuckT += dt; else this.stuckT = 0;
    if (this.stuckT > 3.5 && !this.hint) { this.hint = 'stuck'; this.emit({ type: 'stuck' }); }
    if (this.stuckT < 0.1) this.hint = null;
    if (sc.y < -40 || sc.x < L.x0 - 30) this.respawn();
  }

  stepRider(dt) {
    const c = this.rider, T = this.L.terrain, g = this.sc.S.g;
    c.vy -= g * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.w * dt;
    const ct = T.contact(c.x, c.y, c.r);
    if (ct) {
      c.x += ct.nx * ct.pen; c.y += ct.ny * ct.pen;
      const vn = c.vx * ct.nx + c.vy * ct.ny;
      if (vn < 0) { c.vx -= 1.4 * vn * ct.nx; c.vy -= 1.4 * vn * ct.ny; c.vx *= 0.8; c.w *= 0.7; }
    }
  }

  effects(dt) {
    const sc = this.sc;
    // пил при гальмуванні й приземленні, іскри від деки
    if (!this.reduced) {
      if (sc.land > 2.5) { for (let k = 0; k < 8; k++) this.fx.push({ k: 'dust', x: sc.x + (Math.random() - 0.5) * 1.2, y: sc.y - 0.55, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 1.5, t: 0, life: 0.6 }); }
      if (this.input.brake && sc.grounded() && Math.abs(sc.vx) > 3 && Math.random() < 0.5) this.fx.push({ k: 'dust', x: sc.wh[0].x, y: sc.wh[0].y - sc.S.r + 0.02, vx: -sc.vx * 0.1, vy: Math.random(), t: 0, life: 0.5 });
      if (sc.scrape > 0 && Math.random() < 0.7) this.fx.push({ k: 'spark', x: sc.x, y: sc.y - 0.45, vx: -sc.vx * 0.3 + (Math.random() - 0.5) * 2, vy: Math.random() * 2, t: 0, life: 0.35 });
    }
    sc.land = 0;
    for (const p of this.fx) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 6 * dt; }
    this.fx = this.fx.filter(p => p.t < p.life);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter(p => p.t < 0.7);
  }

  camera(dt) {
    const sc = this.sc, sp = Math.min(1, Math.abs(sc.vx) / 14);
    const tx = (this.rider && this.state === 'crash' ? (sc.x + this.rider.x) / 2 : sc.x) + sc.vx * 0.32;
    const ty = sc.y + 0.6 - (this.L.camDrop || 0) + Math.max(-1.5, Math.min(1.5, sc.vy * 0.15));   // camDrop: показати більше графіка під героєм
    const ts = this.baseScale * (1 - 0.2 * sp);
    if (!this.cam) { this.cam = { x: tx, y: ty, s: ts }; return; }
    const k = 1 - Math.exp(-dt * 5), ks = 1 - Math.exp(-dt * 1.5);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k * 0.8; this.cam.s += (ts - this.cam.s) * ks;
  }

  summary() {
    const L = this.L, total = L.samples.length, pts = this.got.size, share = pts / total;
    const stars = 1 + (share >= 0.9 ? 1 : 0) + (this.time <= this.par ? 1 : 0);
    return { id: this.id, index: L.index, char: this.char, time: this.time, par: this.par, pts, total, share, crashes: this.crashes, stars, stats: L.stats,
      bugs: L.bugs.length, zapped: this.zapped, bitten: this.bitten };
  }

  draw(ctx) { drawGame(ctx, this); }
}

export { LEVEL_IDS };
