// Вікно автомата на canvas: три барабани зі стрічками, оберт із гальмуванням і відскоком, підсвітка результату.
// Стрічки малюються в справжньому порядку, тож сусіди символу на лінії (і всі «майже») чесні.
import { drawSymbol, bossEyes, PAPER, PAPER_D, C } from './sprites.js';

const GAP = 6;
const mod = (n, m) => ((n % m) + m) % m;
const SPEED = {
  normal: { dur: [0.85, 1.25, 1.65], travel: [22, 34, 46], bounce: 0.18 },
  quick: { dur: [0.26, 0.34, 0.42], travel: [8, 11, 14], bounce: 0.1 },
  reduced: { dur: [0.12, 0.16, 0.2], travel: [3, 4, 5], bounce: 0 },
};

export class Reels {
  constructor({ labels, reduced = false, onTick, onStop } = {}) {
    this.labels = labels; this.reduced = reduced; this.onTick = onTick; this.onStop = onStop;
    this.strips = null; this.pos = [0, 0, 0]; this.speed = [0, 0, 0]; this.anim = null; this.hl = null; this.t = 0;
    this.W = 300; this.H = 240; this.layout(300, 240);
  }
  setStrips(strips, stops = [0, 0, 0]) { this.strips = strips; this.pos = stops.slice(); this.anim = null; this.hl = null; }
  set(stops) { this.pos = stops.slice(); this.anim = null; this.speed = [0, 0, 0]; this.hl = null; }
  get spinning() { return !!this.anim; }
  layout(W, H) {
    this.W = W; this.H = H; this.colW = (W - 2 * GAP) / 3; this.cellH = H / 2.4;
    this.P = Math.max(2, Math.floor(Math.min(this.colW, this.cellH) / 28));
  }
  // Оберт до зупинок stops. hold: третій барабан крутиться довше (на лінії вже два котики або два Data Boss).
  spinTo(stops, { mode = 'normal', hold = false } = {}) {
    const S = SPEED[this.reduced ? 'reduced' : mode], L = this.strips.map(s => s.length);
    this.hl = null;
    return new Promise(done => {
      this.anim = {
        t: 0, done,
        reels: stops.map((target, r) => {
          const from = mod(Math.round(this.pos[r]), L[r]), base = S.travel[r] + (hold && r === 2 && !this.reduced ? 30 : 0);
          return { from, target, travel: base + mod(target - (from + base), L[r]), dur: S.dur[r] + (hold && r === 2 && !this.reduced ? 1.1 : 0), bounce: S.bounce, stopped: false, settled: false };
        }),
      };
    });
  }
  update(dt) {
    this.t += dt;
    const a = this.anim; if (!a) return;
    a.t += dt;
    let all = true;
    a.reels.forEach((R, r) => {
      if (R.settled) return;
      const L = this.strips[r].length, before = this.pos[r];
      if (a.t < R.dur) {
        const u = a.t / R.dur; this.pos[r] = R.from + R.travel * (1 - (1 - u) ** 2.2);
        this.speed[r] = (this.pos[r] - before) / Math.max(dt, 1e-3);
        if (Math.floor(this.pos[r]) !== Math.floor(before) && this.onTick) this.onTick(r);
        all = false;
      } else {
        if (!R.stopped) { R.stopped = true; this.speed[r] = 0; if (this.onStop) this.onStop(r); }
        const v = R.bounce ? (a.t - R.dur) / R.bounce : 1;
        if (v < 1) { this.pos[r] = R.from + R.travel + 0.14 * Math.sin(Math.PI * v) * (1 - v); all = false; }
        else { this.pos[r] = mod(R.target, L); R.settled = true; }
      }
    });
    if (all) { this.anim = null; a.done(); }
  }
  // Підсвітка після зупинки: type 'win' | 'fake' | 'audit' | 'near' | 'boss2'; cells: [[барабан, ряд 0..2], …]
  highlight(hl) { this.hl = hl ? { ...hl, t0: this.t } : null; }

  draw(ctx) {
    const { W, H, colW, cellH, P, hl } = this, age = hl ? this.t - hl.t0 : 0;
    ctx.clearRect(0, 0, W, H);
    if (!this.strips) return;
    const isHl = (r, row) => hl && hl.cells.some(c => c[0] === r && c[1] === row);
    for (let r = 0; r < 3; r++) {
      const x0 = Math.round(r * (colW + GAP)), st = this.strips[r], L = st.length, pos = this.pos[r], base = Math.floor(pos), fast = Math.abs(this.speed[r]) > 12;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, Math.round(colW), H); ctx.clip();
      ctx.fillStyle = PAPER; ctx.fillRect(x0, 0, colW, H);
      for (let k = base - 2; k <= base + 3; k++) {
        const y = H / 2 - (k - pos) * cellH, row = 1 - (k - Math.round(pos)), settled = !this.anim || this.anim.reels[r].settled;
        ctx.fillStyle = PAPER_D; ctx.fillRect(x0, Math.round(y + cellH / 2), colW, 1);
        const lit = settled && isHl(r, row), hot = lit && (hl.type === 'win' || hl.type === 'audit');
        const bob = lit && hl.type === 'win' && !this.reduced ? Math.round(Math.sin(age * 12 + r) * 2) : 0;
        if (fast) ctx.globalAlpha = 0.82;
        if (lit && hl.type === 'fake' && age > 0.9) ctx.globalAlpha = 0.45;
        drawSymbol(ctx, st[mod(k, L)], x0 + colW / 2, y + bob, P, this.t, { hot, still: fast || this.reduced, labels: this.labels });
        ctx.globalAlpha = 1;
      }
      // циліндр: затемнення зверху і знизу, тонкий блік
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(5,7,10,.62)'); g.addColorStop(0.2, 'rgba(5,7,10,.06)'); g.addColorStop(0.5, 'rgba(255,255,255,.07)'); g.addColorStop(0.8, 'rgba(5,7,10,.06)'); g.addColorStop(1, 'rgba(5,7,10,.62)');
      ctx.fillStyle = g; ctx.fillRect(x0, 0, colW, H);
      ctx.restore();
    }
    // лінія виплат
    ctx.fillStyle = 'rgba(217,4,41,.32)'; ctx.fillRect(0, Math.round(H / 2), W, 1);
    if (!hl) return;
    const box = (r, row) => [Math.round(r * (colW + GAP)) + 3, Math.round(H / 2 + (row - 1) * cellH - cellH / 2) + 3, Math.round(colW) - 6, Math.round(cellH) - 6];
    const blink = this.reduced || Math.floor(age * 6) % 2 === 0;
    for (const [r, row] of hl.cells) {
      const [x, y, w, h] = box(r, row);
      if (hl.type === 'win') { ctx.strokeStyle = blink ? C.RUBY : C.RUBY_L; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); }
      else if (hl.type === 'boss2') { ctx.strokeStyle = 'rgba(217,4,41,.75)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); }
      else if (hl.type === 'near') { ctx.strokeStyle = '#C77700'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); }
      else if (hl.type === 'fake') {
        ctx.strokeStyle = age > 0.9 ? C.RUBY : '#C77700'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
        if (age > 0.9) { ctx.beginPath(); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + w - 6, y + h - 6); ctx.moveTo(x + w - 6, y + 6); ctx.lineTo(x + 6, y + h - 6); ctx.stroke(); }
      } else if (hl.type === 'audit') {
        ctx.strokeStyle = C.RUBY; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
        // лазери з окулярів униз, до лічильника кредитів
        const cx = Math.round(r * (colW + GAP)) + colW / 2, cy = H / 2 + (row - 1) * cellH, k = Math.min(1, age / 0.35);
        for (const [ex, ey] of bossEyes(cx, cy, P)) {
          ctx.strokeStyle = 'rgba(255,96,118,.35)'; ctx.lineWidth = P * 2.4; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + (ex - cx) * 0.4 * k, ey + (H - ey) * k); ctx.stroke();
          ctx.strokeStyle = '#FFF'; ctx.lineWidth = Math.max(1, P * 0.7); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + (ex - cx) * 0.4 * k, ey + (H - ey) * k); ctx.stroke();
        }
      }
    }
    if (hl.type === 'audit' && age < 0.5 && !this.reduced) { ctx.fillStyle = `rgba(217,4,41,${0.35 * (1 - age / 0.5)})`; ctx.fillRect(0, 0, W, H); }
  }
}
