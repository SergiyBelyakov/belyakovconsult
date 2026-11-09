// Фізика героя на колесах, як у старих мотогонках: жорстка рама (транспорт і герой разом), колеса на пружинах,
// мотор, гальмо, нахил героя крутить раму (і на землі, і в повітрі). Моноколесо тримає рівновагу саме:
// мотор колеса розганяє його під центр мас, а газ і гальмо задають нахил, як на справжньому моноколесі.
// Герой падає, коли головою чи тулубом торкається траси. Одиниці: метри, секунди; вісь y угору; рама дивиться вздовж +x.

const BASE = {
  g: 12, mu: 1.05, e: 0.1, muBody: 0.35, airAngDamp: 0.15, rollDamp: 0.04, leanRate: 7, pr: 0.035,
  droop: 0.06, kStop: 3000, cStop: 40, brakeReact: 0.5, drive: 0, balance: null,
};

// Три герої: котик на самокаті, капібара на електроскейті, голова аналітика на моноколесі
export const CHARACTERS = {
  cat: {
    ...BASE,
    M: 1, I: 0.2, mw: 0.15, r: 0.2,
    anchors: [[-0.5, -0.34], [0.5, -0.34]],
    kx: 700, cx: 12, ky: 170, cy: 5.5, travel: 0.09,
    motorT: 2.2, vmax: 13.5, motorReact: 0.6, brakeT: 2.4, leanT: 2.6,
    points: [[-0.6, -0.38], [-0.05, -0.39], [0.38, -0.38]],
    // голова, тулуб, лапи на кермі; lx, ly: зсув за нахилом
    crash: [{ x: 0.16, y: 0.52, lx: 0.14, ly: -0.05, r: 0.16 }, { x: 0, y: 0.22, lx: 0.08, ly: 0, r: 0.15 }, { x: 0.44, y: 0.6, lx: 0, ly: 0, r: 0.07 }],
    eyes: [[0.078, 0.04], [0.11, 0.045]],
  },
  capy: {
    ...BASE,
    M: 1.3, I: 0.34, mw: 0.12, r: 0.16,
    anchors: [[-0.4, -0.27], [0.4, -0.27]],
    kx: 900, cx: 14, ky: 260, cy: 7, travel: 0.05,
    motorT: 2.35, vmax: 12, motorReact: 0.45, brakeT: 2.2, leanT: 2.7,
    points: [[-0.58, -0.17], [0, -0.2], [0.58, -0.17]],
    crash: [{ x: 0.4, y: 0.3, lx: 0.1, ly: -0.04, r: 0.17 }, { x: -0.08, y: 0.24, lx: 0.05, ly: 0, r: 0.22 }],
    eyes: [[0.07, 0.07], [0.1, 0.075]],
  },
  head: {
    ...BASE,
    M: 0.9, I: 0.13, mw: 0.25, r: 0.25,
    anchors: [[0, -0.42]],
    kx: 900, cx: 16, ky: 420, cy: 10, travel: 0.06, droop: 0.03,
    motorT: 0, vmax: 13.5, motorReact: 0, brakeT: 0, leanT: 2.3, airAngDamp: 0.2,
    points: [[-0.15, -0.5], [0.15, -0.5]],
    crash: [{ x: 0, y: 0.25, lx: 0.12, ly: -0.03, r: 0.29 }],
    eyes: [[0.1, 0.06], [0.23, 0.045]],
    // саморівновага: момент колеса за відхиленням нахилу від цільового
    balance: { kp: 11, kd: 1.6, tmax: 6, tiltGas: -0.3, tiltBrake: 0.28, tiltLean: 0.18, tiltBack: 0.12, coyote: 0.08 },
  },
};
export const SPEC = CHARACTERS.cat;

export class Scooter {
  constructor(spec = SPEC) {
    this.S = { ...spec, J: 0.5 * spec.mw * spec.r * spec.r };
    const S = this.S;
    this.mEff = 1 / (1 / S.mw + (S.r * S.r) / S.J);
    this.wh = S.anchors.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, om: 0, phi: 0, ground: 0, comp: 0, fx: 0, fy: 0 }));
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.a = 0; this.w = 0;
    this.lean = 0; this.crashed = false; this.scrape = 0; this.land = 0; this.air = 0; this.tilt = 0;
  }

  // Поставити героя на трасу в точці x (колеса трохи над землею, без швидкості)
  place(terrain, x) {
    const S = this.S, one = S.anchors.length === 1;
    const half = one ? 0.5 : S.anchors[1][0], ay = S.anchors[0][1];
    const hr = terrain.height(x - half), hf = terrain.height(x + half);
    this.a = one ? 0 : Math.atan2(hf - hr, 2 * half);
    const c = Math.cos(this.a), s = Math.sin(this.a);
    const my = (one ? terrain.height(x) : (hr + hf) / 2) + S.r + 0.03;
    this.x = x - s * -ay; this.y = my + c * -ay;   // центр мас над серединою між колесами
    this.vx = this.vy = this.w = 0;
    S.anchors.forEach(([lx, ly], i) => {
      const W = this.wh[i];
      W.x = this.x + c * lx - s * ly; W.y = this.y + s * lx + c * ly;
      W.vx = W.vy = W.om = 0; W.ground = 0; W.comp = 0;
    });
    this.lean = 0; this.crashed = false; this.scrape = 0; this.land = 0; this.air = 0; this.tilt = 0;
  }

  speed() { return Math.hypot(this.vx, this.vy); }
  grounded() { return this.wh.some(W => W.ground > 0); }
  toWorld(x, y) { const c = Math.cos(this.a), s = Math.sin(this.a); return [this.x + c * x - s * y, this.y + s * x + c * y]; }

  // Точки героя, що не мають торкатися траси (перша голова), з урахуванням нахилу
  crashPoints() {
    const L = this.lean;
    return this.S.crash.map(p => ({ p: this.toWorld(p.x + p.lx * L, p.y + p.ly * Math.abs(L)), r: p.r }));
  }
  // Центр голови і очі (для лазерів)
  headLocal() { const h = this.S.crash[0], L = this.lean; return [h.x + h.lx * L, h.y + h.ly * Math.abs(L)]; }
  eyesWorld() { const [hx, hy] = this.headLocal(); return this.S.eyes.map(([dx, dy]) => this.toWorld(hx + dx, hy + dy)); }

  // Один крок інтегрування. input: { gas, brake, lean: -1 (назад) | 0 | 1 (вперед) }, assist: допомога з рівновагою (спокійний режим)
  step(dt, input, terrain, assist = 0) {
    const S = this.S, c = Math.cos(this.a), s = Math.sin(this.a);
    let Fx = 0, Fy = -S.M * S.g, T = 0;

    // пружини підвіски
    for (let i = 0; i < this.wh.length; i++) {
      const W = this.wh[i], [lx, ly] = S.anchors[i];
      const rx = c * lx - s * ly, ry = s * lx + c * ly;
      const dx = W.x - (this.x + rx), dy = W.y - (this.y + ry);
      const dvx = W.vx - (this.vx - this.w * ry), dvy = W.vy - (this.vy + this.w * rx);
      const dlx = c * dx + s * dy, dly = -s * dx + c * dy, dvlx = c * dvx + s * dvy, dvly = -s * dvx + c * dvy;
      const flx = -S.kx * dlx - S.cx * dvlx;
      let fly = -S.ky * dly - S.cy * dvly;
      if (dly > S.travel) fly -= S.kStop * (dly - S.travel) + S.cStop * dvly;
      else if (dly < -S.droop) fly -= S.kStop * (dly + S.droop) + S.cStop * dvly;
      const fx = c * flx - s * fly, fy = s * flx + c * fly;
      W.fx = fx; W.fy = fy; W.comp = dly;
      Fx -= fx; Fy -= fy; T += rx * -fy - ry * -fx;
    }

    // нахил героя: плавно до натиснутого
    const L = input.lean || 0;
    this.lean += Math.max(-S.leanRate * dt, Math.min(S.leanRate * dt, L - this.lean));
    const inAir = !this.grounded();
    const B = S.balance;
    if (B) {
      // моноколесо: газ нахиляє вперед, гальмо назад; мотор колеса розганяє його під центр мас (реакція мотора
      // повертає раму), на швидкості колесо саме відхиляє назад, як справжнє
      const W = this.wh[0], v = -W.om * S.r;
      let tilt = (input.gas ? B.tiltGas : 0) + (input.brake ? B.tiltBrake : 0) - L * B.tiltLean;
      if (v > S.vmax * 0.92) tilt += (v - S.vmax * 0.92) * B.tiltBack;
      if (v < -1.5) tilt += (v + 1.5) * B.tiltBack;   // назад майже не їде
      this.tilt += (tilt - this.tilt) * Math.min(1, dt * 6);
      if (!inAir || this.air < B.coyote) {
        let da = this.a - this.tilt; da = Math.atan2(Math.sin(da), Math.cos(da));
        const tq = Math.max(-B.tmax, Math.min(B.tmax, B.kp * da + B.kd * this.w));
        W.om += (tq / S.J) * dt;
        T -= tq;
      }
      if (inAir) T += -L * S.leanT;
    } else {
      T += -L * S.leanT;
      const R = this.wh[S.drive];
      if (input.gas) {
        const v = -R.om * S.r, k = Math.max(0, Math.min(1, 1 - v / S.vmax));
        const tq = S.motorT * k;
        R.om -= (tq / S.J) * dt;
        T += tq * S.motorReact;
      }
      if (input.brake) {
        for (const W of this.wh) {
          const d = Math.sign(W.om) * Math.min(Math.abs(W.om), (S.brakeT / S.J) * dt);
          W.om -= d;
          this.w += (S.J * d * S.brakeReact) / S.I;
        }
      }
    }
    if (assist && inAir) {   // спокійний режим: м'яко вирівнює раму під схил унизу (моноколесо: вертикально)
      const target = B ? 0 : terrain.angle(this.x + this.vx * 0.25, 0.8);
      let da = target - this.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      T += assist * S.I * 5 * (6 * da - 1.2 * this.w);
    }

    // інтегрування (напівнеявний Ейлер)
    this.vx += (Fx / S.M) * dt; this.vy += (Fy / S.M) * dt; this.w += (T / S.I) * dt;
    if (inAir) this.w *= 1 - S.airAngDamp * dt;
    this.x += this.vx * dt; this.y += this.vy * dt; this.a += this.w * dt;
    for (const W of this.wh) {
      W.vx += (W.fx / S.mw) * dt; W.vy += (W.fy / S.mw - S.g) * dt;
      W.om *= 1 - S.rollDamp * dt;
      W.x += W.vx * dt; W.y += W.vy * dt; W.phi += W.om * dt;
    }

    // колеса й траса: удар, тертя, кочення
    let landing = 0;
    for (const W of this.wh) {
      if (W.ground > 0) W.ground -= dt;
      for (let k = 0; k < 2; k++) {
        const ct = terrain.contact(W.x, W.y, S.r);
        if (!ct) break;
        W.x += ct.nx * ct.pen; W.y += ct.ny * ct.pen;
        const vn = W.vx * ct.nx + W.vy * ct.ny;
        let jn = 0;
        if (vn < 0) {
          jn = -vn * S.mw;
          W.vx += (ct.nx * jn * (1 + S.e)) / S.mw; W.vy += (ct.ny * jn * (1 + S.e)) / S.mw;
          if (W.ground <= 0) landing = Math.max(landing, -vn);
        }
        const tx = ct.ny, ty = -ct.nx;
        const slip = W.vx * tx + W.vy * ty + W.om * S.r;
        const lim = S.mu * jn;
        const P = Math.max(-lim, Math.min(lim, -slip * this.mEff));
        W.vx += (tx * P) / S.mw; W.vy += (ty * P) / S.mw;
        W.om += (P * S.r) / S.J;
        W.ground = 0.06;
      }
    }
    if (landing > 0) this.land = Math.max(this.land, landing);

    // рама об трасу (дека, педалі): ковзає з тертям, без падіння
    this.scrape = Math.max(0, this.scrape - dt);
    const c2 = Math.cos(this.a), s2 = Math.sin(this.a);
    for (const [lx, ly] of S.points) {
      const rx = c2 * lx - s2 * ly, ry = s2 * lx + c2 * ly;
      const ct = terrain.contact(this.x + rx, this.y + ry, S.pr);
      if (!ct) continue;
      this.x += ct.nx * ct.pen; this.y += ct.ny * ct.pen;
      const vpx = this.vx - this.w * ry, vpy = this.vy + this.w * rx, vn = vpx * ct.nx + vpy * ct.ny;
      if (vn >= 0) continue;
      const rn = rx * ct.ny - ry * ct.nx, kN = 1 / S.M + (rn * rn) / S.I;
      const jn = (-1.1 * vn) / kN;
      this.vx += (ct.nx * jn) / S.M; this.vy += (ct.ny * jn) / S.M; this.w += (rn * jn) / S.I;
      const tx = ct.ny, ty = -ct.nx;
      const vt = (this.vx - this.w * ry) * tx + (this.vy + this.w * rx) * ty;
      const rt = rx * ty - ry * tx, kT = 1 / S.M + (rt * rt) / S.I;
      const jt = Math.max(-S.muBody * jn, Math.min(S.muBody * jn, -vt / kT));
      this.vx += (tx * jt) / S.M; this.vy += (ty * jt) / S.M; this.w += (rt * jt) / S.I;
      if (Math.abs(vt) > 1.5) this.scrape = 0.12;
    }
    this.air = this.grounded() ? 0 : this.air + dt;

    // герой торкнувся траси головою або тулубом
    if (!this.crashed) for (const { p, r } of this.crashPoints()) if (terrain.contact(p[0], p[1], r)) { this.crashed = true; break; }
  }
}
