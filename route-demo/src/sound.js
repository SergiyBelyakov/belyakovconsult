// Тактильний відгук: короткі синтезовані звуки (вимкнені, доки людина їх не ввімкне) і вібрація на телефоні.
let ac = null, on = false;
try { on = localStorage.getItem('bc-route-sound') === '1'; } catch { on = false; }

function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
function tone(freq, dur, type = 'sine', gain = 0.05, to = null) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, f0, f1, gain = 0.06) {
  const a = ctx();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
  bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.value = gain; src.buffer = buf; src.connect(bp).connect(g).connect(a.destination); src.start(t);
}
export const haptic = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* немає вібрації */ } };

export const sfx = {
  get on() { return on; },
  set(v) { on = !!v; try { localStorage.setItem('bc-route-sound', on ? '1' : '0'); } catch { /* сховище недоступне */ } if (on) tone(880, 0.06, 'sine', 0.04, 1320); },
  tick() { haptic(6); if (on) tone(2400, 0.018, 'square', 0.018); },
  snap() { haptic(14); if (on) { tone(520, 0.05, 'triangle', 0.06, 880); setTimeout(() => tone(1040, 0.04, 'sine', 0.03), 35); } },
  drop() { haptic([10, 30, 16]); if (on) tone(300, 0.16, 'sine', 0.08, 120); },
  cut() { haptic(18); if (on) noise(0.12, 3200, 700, 0.07); },
  heal() { haptic(8); if (on) tone(660, 0.12, 'sine', 0.05, 990); },
  pop() { haptic(5); if (on) tone(700, 0.05, 'sine', 0.04, 1100); },
  done() { if (on) { tone(740, 0.06, 'sine', 0.035); setTimeout(() => tone(988, 0.08, 'sine', 0.03), 70); } },
};
