// Спільний годинник відтворення дня: карта рухає його щокадру, розклад і шкала читають напряму,
// щоб React не перемальовував усю сторінку 60 разів на секунду.
import { DAY } from './world.js';

export function createClock(t = 480) {
  let value = t, playing = false, speed = 1;
  const subs = new Set();
  const emit = () => subs.forEach(f => f(value, playing));
  return {
    get: () => value,
    set(v) { const nv = Math.max(DAY[0], Math.min(DAY[1], v)); if (nv !== value) { value = nv; emit(); } },
    get playing() { return playing; },
    play(v = !playing) { playing = v; if (playing && value >= DAY[1] - 1) value = DAY[0]; emit(); },
    get speed() { return speed; },
    setSpeed(v) { speed = v; emit(); },
    sub(f) { subs.add(f); return () => subs.delete(f); },
    tick(ms) { if (!playing) return; value = Math.min(DAY[1], value + ms * 0.0165 * speed); if (value >= DAY[1]) playing = false; emit(); },
  };
}
export const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
