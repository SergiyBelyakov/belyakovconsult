// Короткі 8-бітні звуки на WebAudio. Типово вимкнено, вмикається кнопкою.
let ctx = null, on = false;
export const setSound = v => { on = v; if (v && !ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); };
function tone(f0, f1, dur, type = 'square', gain = 0.05, delay = 0) {
  if (!on || !ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, gain = 0.06) {
  if (!on || !ctx) return;
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = gain; s.buffer = b; s.connect(g); g.connect(ctx.destination); s.start();
}
export const sfx = {
  laser: () => tone(1400, 380, 0.09),
  fix: () => { tone(660, 990, 0.07, 'triangle', 0.06); tone(990, 1320, 0.07, 'triangle', 0.05, 0.06); },
  merge: () => tone(520, 820, 0.12, 'sawtooth', 0.035),
  good: () => { tone(880, 880, 0.06, 'square', 0.04); tone(1320, 1320, 0.08, 'square', 0.04, 0.06); },
  bad: () => tone(180, 90, 0.25, 'sawtooth', 0.05),
  boom: () => noise(0.22),
  power: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, f, 0.08, 'square', 0.04, k * 0.07)),
  mega: () => { tone(200, 1600, 0.6, 'sawtooth', 0.05); noise(0.5, 0.05); },
  hurt: () => { noise(0.3, 0.08); tone(300, 60, 0.4, 'square', 0.05); },
};
