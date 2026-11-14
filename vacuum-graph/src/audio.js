// Короткі 8-бітні звуки на WebAudio. Типово вимкнено, вмикається кнопкою.
let ctx = null, on = false, lastDust = 0;
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
  suck: () => { tone(900, 160, 0.22, 'sawtooth', 0.035); noise(0.18, 0.03); },
  merge: () => [392, 523, 659].forEach((f, k) => tone(f, f * 1.01, 0.09, 'triangle', 0.05, k * 0.06)),
  cut: () => { tone(2400, 1800, 0.04, 'square', 0.04); tone(2000, 1200, 0.05, 'square', 0.04, 0.06); },
  good: () => { tone(880, 880, 0.06, 'square', 0.04); tone(1320, 1320, 0.08, 'square', 0.04, 0.06); },
  bad: () => tone(180, 90, 0.25, 'sawtooth', 0.05),
  dust: () => { if (!on || !ctx || ctx.currentTime - lastDust < 0.07) return; lastDust = ctx.currentTime; tone(1500, 1500, 0.02, 'square', 0.012); },
  hurt: () => { noise(0.3, 0.08); tone(300, 60, 0.4, 'square', 0.05); },
  power: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, f, 0.08, 'square', 0.04, k * 0.07)),
  eat: () => tone(300, 1200, 0.15, 'square', 0.045),
  scan: () => { tone(300, 2200, 0.5, 'sine', 0.05); tone(600, 2600, 0.5, 'triangle', 0.02, 0.05); },
  split: () => { noise(0.6, 0.09); tone(160, 40, 0.7, 'sawtooth', 0.06); },
  seal: () => { tone(200, 1600, 0.5, 'sawtooth', 0.05); [523, 659, 784].forEach((f, k) => tone(f, f, 0.25, 'triangle', 0.04, 0.45 + k * 0.03)); },
  pump: () => { tone(220, 330, 0.12, 'square', 0.03); tone(330, 220, 0.12, 'square', 0.03, 0.12); },
  turn: () => tone(700, 700, 0.015, 'square', 0.01),
};
