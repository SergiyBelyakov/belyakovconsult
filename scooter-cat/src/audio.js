// Звук на WebAudio: дві 8-бітні мелодії (основна і пекельна, обидві власні), гудіння мотора, лазер, точки, ворота і голоси героїв.
// Браузер дозволяє звук лише після дії гравця, тому контекст створює unlock() на першому натисканні.
let ctx = null, sfxOn = true, musicOn = true, eng = null, master = null, mus = null, pulse = null;

export function unlock() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    mus = ctx.createGain(); mus.gain.value = 0.55; mus.connect(master);
    // імпульсна хвиля зі шпаруватістю 25%: звук старих приставок
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    pulse = ctx.createPeriodicWave(re, im);
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (musicOn) startMusic();
}
export const setSound = v => { sfxOn = v; if (!v && eng && ctx) eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); };
export const setMusic = v => { musicOn = v; if (v) { if (ctx) startMusic(); } else stopMusic(); };
export const pauseAll = hidden => { if (!ctx) return; if (hidden) ctx.suspend(); else ctx.resume(); };

function osc(type, f, t, dur, gain, dest, slideTo) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (type === 'pulse') o.setPeriodicWave(pulse); else o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.setValueAtTime(gain, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, gain, dest, hp = 0) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = gain; s.buffer = b;
  if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; s.connect(f); f.connect(g); } else s.connect(g);
  g.connect(dest); s.start(t);
}

// ——— мелодії: такти по 8 восьмих; ноти MIDI-назвами, тривалість у восьмих ———
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = s => { const m = s.match(/^([A-G])(#?)(\d)$/); return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] ? 1 : 0); };
const hz = n => 440 * 2 ** ((n - 69) / 12);
function theme({ lead, chords, triad, bpm, play }) {
  const leadAt = new Map();
  lead.forEach((bar, b) => {
    const tok = bar.split(' ');
    let pos = 0;
    for (let k = 0; k < tok.length; k += 2) { const len = +tok[k + 1] * 2; leadAt.set(b * 16 + pos, { n: midi(tok[k]) - 12, len }); pos += len; }
  });
  return { leadAt, chords, triad, S16: 60 / bpm / 4, steps: lead.length * 16, play };
}
// основна: мажорна, 144 удари на хвилину, 16 тактів по колу
const MAIN = theme({
  lead: [
    'E5 2 G5 1 C6 1 B5 2 G5 2', 'D5 2 G5 1 B5 1 A5 2 G5 2', 'C5 1 E5 1 A5 2 G5 1 E5 1 A5 2', 'F5 2 A5 1 C6 1 D6 2 C6 2',
    'E6 2 D6 1 C6 1 G5 2 E5 2', 'D5 1 G5 1 B5 2 D6 2 B5 2', 'A5 1 C6 1 F6 2 E6 1 C6 1 A5 2', 'G5 2 B5 2 D6 4',
    'A5 2 C6 2 E6 2 C6 2', 'F5 2 A5 2 C6 2 A5 2', 'G5 1 A5 1 G5 1 E5 1 C5 2 E5 2', 'D5 2 F5 1 G5 1 B5 4',
    'C6 1 B5 1 A5 2 E5 2 A5 2', 'A5 1 G5 1 F5 2 C6 2 A5 2', 'B5 2 D6 2 G6 2 F6 2', 'E6 4 C6 4',
  ],
  // акорди тактів: корінь і тризвук (C, G, Am, F ...)
  chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'],
  triad: { C: [48, 52, 55], G: [43, 47, 50], Am: [45, 48, 52], F: [41, 45, 48] },
  bpm: 144,
  play(th, st, t, S16) {
    const bar = Math.floor(st / 16), s = st % 16, ch = th.triad[th.chords[bar]];
    const L = th.leadAt.get(st);
    if (L) osc('pulse', hz(L.n), t, L.len * S16 * 0.92, 0.05, mus);
    if (s % 2 === 0) { const e = s / 2, root = ch[0] - 12; osc('triangle', hz(e % 2 ? root + 12 : e === 4 ? root + 7 : root), t, S16 * 1.8, 0.11, mus); }
    osc('pulse', hz(ch[s % 3] + 12), t, S16 * 0.8, 0.012, mus);   // тихе арпеджіо шістнадцятими
    if (s === 0 || s === 8) osc('sine', 150, t, 0.12, 0.2, mus, 45);   // бочка
    if (s === 4 || s === 12) noise(t, 0.09, 0.06, mus, 1200);           // малий барабан
    if (s % 4 === 2) noise(t, 0.03, 0.02, mus, 6000);                   // хет
  },
});
// Адіще: мі мінор із фригійською секундою, 168 ударів, бас восьмими й бочка на кожну чверть
const HELL = theme({
  lead: [
    'E5 1 G5 1 B5 1 E6 1 D#6 2 B5 2', 'C6 1 B5 1 A5 1 G5 1 F#5 2 E5 2', 'G5 1 C6 1 E6 1 D6 1 C6 2 G5 2', 'F#5 1 A5 1 D6 1 C6 1 A5 2 F#5 2',
    'B5 2 E6 1 F6 1 E6 2 B5 2', 'C6 1 A5 1 E6 1 C6 1 B5 2 A5 2', 'G5 2 B5 1 C6 1 E6 2 G6 2', 'F#6 2 D#6 2 B5 2 A5 1 G5 1',
  ],
  chords: ['Em', 'Em', 'C', 'D', 'Em', 'Am', 'C', 'B'],
  triad: { Em: [52, 55, 59], C: [48, 52, 55], D: [50, 54, 57], Am: [45, 48, 52], B: [47, 51, 54] },
  bpm: 168,
  play(th, st, t, S16) {
    const bar = Math.floor(st / 16), s = st % 16, ch = th.triad[th.chords[bar]];
    const L = th.leadAt.get(st);
    if (L) osc('pulse', hz(L.n), t, L.len * S16 * 0.85, 0.05, mus);
    if (s % 2 === 0) { const root = ch[0] - 12; osc('triangle', hz(s % 4 === 2 ? root + 12 : root), t, S16 * 1.6, 0.12, mus); }   // бас восьмими
    osc('pulse', hz(ch[(s * 2) % 3] + 12), t, S16 * 0.7, 0.01, mus);
    if (s % 4 === 0) osc('sine', 165, t, 0.11, 0.22, mus, 40);          // бочка на кожну чверть
    if (s === 4 || s === 12) noise(t, 0.1, 0.07, mus, 1400);            // малий барабан
    if (s % 2 === 1) noise(t, 0.025, 0.016, mus, 7000);                 // хет шістнадцятими
  },
});
const THEMES = { main: MAIN, hell: HELL };
let TH = MAIN, timer = null, nextT = 0, step = 0;
// перемкнути мелодію (основна або пекельна): нова починає з першого такту
export function setTheme(name) {
  const th = THEMES[name] || MAIN;
  if (th === TH) return;
  TH = th; step = 0;
  if (ctx) nextT = Math.max(nextT, ctx.currentTime + 0.05);
}
function schedule() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.15) { TH.play(TH, step, nextT, TH.S16); nextT += TH.S16; step = (step + 1) % TH.steps; }
}
function startMusic() { if (timer || !ctx) return; nextT = ctx.currentTime + 0.06; step = 0; timer = setInterval(schedule, 25); schedule(); }
function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

// ——— мотор: пилка через фільтр, частота за швидкістю колеса, тихіше під музику ———
export function engine(speed, gas) {
  if (!sfxOn || !ctx) return;
  if (!eng) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 480; g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    eng = { o, f, g };
  }
  const t = ctx.currentTime, k = musicOn ? 0.55 : 1;
  eng.o.frequency.setTargetAtTime(55 + speed * 9, t, 0.05);
  eng.g.gain.setTargetAtTime(speed > 0.2 || gas ? (gas ? 0.03 : 0.012) * k : 0, t, 0.08);
}

// ——— голоси героїв при падінні ———
function voice(char) {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  f.type = 'bandpass'; f.Q.value = 1.4;
  if (char === 'capy') {   // капібара свистить: два короткі писки
    o.type = 'sine'; f.frequency.value = 1500;
    [0, 0.16].forEach(d => { o.frequency.setValueAtTime(900, t + d); o.frequency.linearRampToValueAtTime(1350, t + d + 0.07); o.frequency.linearRampToValueAtTime(950, t + d + 0.13); });
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  } else if (char === 'head') {   // голова аналітика: «ой»
    o.type = 'square'; f.frequency.value = 700;
    o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.32);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
  } else {   // котик: «мяу»
    o.type = 'sawtooth'; f.frequency.value = 1400;
    o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(880, t + 0.16); o.frequency.linearRampToValueAtTime(430, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  }
  lfo.frequency.value = 9; lg.gain.value = 12; lfo.connect(lg); lg.connect(o.frequency);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
}

const on = () => sfxOn && ctx;
export const sfx = {
  point: () => on() && osc('triangle', 1180, ctx.currentTime, 0.05, 0.03, master, 1480),
  checkpoint: () => on() && [660, 880, 1320].forEach((f, k) => osc('pulse', f, ctx.currentTime + k * 0.06, 0.07, 0.035, master)),
  gate: () => { if (!on()) return; osc('sine', 300, ctx.currentTime, 0.35, 0.05, master, 1200); osc('triangle', 600, ctx.currentTime + 0.05, 0.35, 0.02, master, 2400); },
  laser: () => on() && osc('square', 1500, ctx.currentTime, 0.1, 0.035, master, 360),
  zap: () => { if (!on()) return; noise(ctx.currentTime, 0.12, 0.05, master, 2000); osc('pulse', 900, ctx.currentTime, 0.12, 0.03, master, 1900); },
  bite: () => on() && osc('sawtooth', 240, ctx.currentTime, 0.18, 0.05, master, 110),
  crash: char => on() && voice(char),
  finish: () => on() && [523, 659, 784, 1047, 1319].forEach((f, k) => osc('pulse', f, ctx.currentTime + k * 0.08, 0.1, 0.04, master)),
};
