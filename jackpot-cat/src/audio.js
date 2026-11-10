// Звуки автомата на WebAudio в дусі 80-х: стукіт барабанів, монети, фанфари джекпота, сирена аудиту.
// Типово вимкнено; контекст створюється на першому ввімкненні (браузер дозволяє звук лише після дії гравця).
let ctx = null, on = false, lastTick = 0;
export const setSound = v => { on = v; if (v && !ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); };
function tone(f0, f1, dur, type = 'square', gain = 0.05, delay = 0) {
  if (!on || !ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, gain = 0.06, delay = 0) {
  if (!on || !ctx) return;
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = gain; s.buffer = b; s.connect(g); g.connect(ctx.destination); s.start(ctx.currentTime + delay);
}
const arp = (notes, step, dur = 0.09, gain = 0.045, type = 'square') => notes.forEach((f, k) => tone(f, f, dur, type, gain, k * step));
export const sfx = {
  pull: () => { tone(220, 90, 0.16, 'sawtooth', 0.05); noise(0.08, 0.04, 0.02); },
  tick: () => { if (!ctx) return; const t = ctx.currentTime; if (t - lastTick < 0.045) return; lastTick = t; tone(720, 620, 0.018, 'square', 0.014); },
  stop: r => { noise(0.07, 0.07); tone(150 - r * 14, 70, 0.11, 'triangle', 0.09); },
  coin: n => { for (let k = 0; k < Math.min(n, 10); k++) { tone(1568, 1568, 0.05, 'square', 0.035, k * 0.075); tone(2093, 2093, 0.07, 'square', 0.03, k * 0.075 + 0.035); } },
  big: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.085, 0.11, 0.05),
  jackpot: () => { arp([523, 659, 784, 1047, 1319, 1568, 2093, 1568, 2093, 2637], 0.09, 0.13, 0.05); for (let k = 0; k < 14; k++) tone(2093, 2093, 0.04, 'square', 0.025, 1 + k * 0.06); },
  fake: () => { arp([523, 659, 784], 0.08); tone(392, 150, 0.5, 'sawtooth', 0.05, 0.85); tone(196, 75, 0.5, 'sawtooth', 0.04, 0.85); },
  near: () => tone(330, 300, 0.12, 'triangle', 0.04),
  tease: () => { tone(110, 110, 0.18, 'sawtooth', 0.05); tone(117, 117, 0.18, 'sawtooth', 0.04, 0.2); },
  audit: () => { for (let k = 0; k < 3; k++) { tone(880, 880, 0.14, 'square', 0.05, k * 0.3); tone(587, 587, 0.14, 'square', 0.05, k * 0.3 + 0.15); } tone(1500, 180, 0.35, 'sawtooth', 0.06, 0.2); noise(0.5, 0.07, 0.3); tone(420, 38, 1.1, 'sawtooth', 0.06, 0.95); },
  click: () => tone(900, 700, 0.03, 'square', 0.03),
  refill: () => arp([392, 523, 659], 0.06, 0.07, 0.04, 'triangle'),
  good: () => { tone(880, 880, 0.06, 'square', 0.04); tone(1320, 1320, 0.08, 'square', 0.04, 0.06); },
  bad: () => tone(180, 90, 0.25, 'sawtooth', 0.05),
};
