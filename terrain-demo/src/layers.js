// Кольори шарів для 3D-моделі й карти: висоти, вода, покриття, придатність. Значення 0..1 (лінійний RGB для three.js).
import { GX, GY } from './dem.js';

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toLin = rgb => rgb.map(lin);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Гіпсометрична шкала під темний інтерфейс: зелені низини, оливкові схили, світлий камінь на вершинах
export const ELEV_STOPS = ['#1d4a3c', '#2f5e3f', '#55683c', '#7c7448', '#9b8a62', '#c9c1ad'].map(hex);
export function elevColor(t) {
  const n = ELEV_STOPS.length - 1, x = Math.max(0, Math.min(1, t)) * n, i = Math.min(n - 1, Math.floor(x));
  return mix(ELEV_STOPS[i], ELEV_STOPS[i + 1], x - i);
}
const WATER = hex('#2f6fd6'), COVER = hex('#19b3a0'), S0 = hex('#2b5f6a'), S1 = hex('#f2c14e'), RIVER = hex('#3f7fd8');

function build(T, f) {
  const out = new Float32Array(GX * GY * 3);
  for (let k = 0; k < GX * GY; k++) {
    let c = elevColor((T.H[k] - T.min) / (T.max - T.min));
    if (T.D[k] < 0.12) c = RIVER;
    c = f(k, c);
    if (!T.INSIDE[k]) c = mix(c, [0.03, 0.035, 0.05], 0.55);
    const l = toLin(c);
    out[k * 3] = l[0]; out[k * 3 + 1] = l[1]; out[k * 3 + 2] = l[2];
  }
  return out;
}

export const layerElev = T => build(T, (k, c) => c);
export const layerFlood = (T, W, strong) => build(T, (k, c) => (W[k] && T.D[k] >= 0.12 ? mix(c, WATER, strong ? 0.85 : 0.35) : mix(c, [0.05, 0.06, 0.08], 0.15)));
export const layerCover = (T, V) => build(T, (k, c) => (V.some(v => v[k]) ? mix(c, COVER, 0.6) : mix(c, [0.05, 0.06, 0.08], 0.35)));
export const layerSuit = (T, R, W) => build(T, (k, c) => (R.S[k] > 0 ? mix(S0, S1, Math.sqrt(R.S[k] / R.max)) : W[k] && T.D[k] >= 0.12 ? mix(c, WATER, 0.3) : mix(c, [0.05, 0.06, 0.08], 0.45)));

// Відтінення рельєфу для карти зверху (світло з північного заходу)
export function hillshade(T) {
  if (T.cache.has('hs')) return T.cache.get('hs');
  const out = new Float32Array(GX * GY), z = 10;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const at = (a, b) => T.H[Math.max(0, Math.min(GY - 1, b)) * GX + Math.max(0, Math.min(GX - 1, a))];
    const dx = (at(i + 1, j) - at(i - 1, j)) * z / 500, dy = (at(i, j + 1) - at(i, j - 1)) * z / 500;
    const nx = -dx, ny = -dy, nz = 1, l = Math.hypot(nx, ny, nz);
    out[j * GX + i] = Math.max(0, (nx * -0.6 + ny * -0.6 + nz * 0.55) / l);
  }
  T.cache.set('hs', out);
  return out;
}
