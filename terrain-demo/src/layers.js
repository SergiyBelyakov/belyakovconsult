// Кольори шарів для 3D-моделі й карти. Значення 0..1 у лінійному RGB (так їх чекає three.js).
// Безперервні шари: один відтінок від темного до світлого (на темному тлі світле = більше).
// Двополюсні (експозиція, температура): синій ↔ сірий ↔ помаранчевий. Категорії перевірено на розрізненність
// для дальтоніків (скрипт validate_palette, усі пари): ґрунти ΔE ≥ 8,3, земний покрив ΔE ≥ 11,9.
import { GX, GY } from './dem.js';
import { geo, SOILS, COVERS, MORPHS, EROSION_BREAKS, GW_BREAKS, classOf } from './geo.js';

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toLin = rgb => rgb.map(lin);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const DARK = [0.03, 0.035, 0.05];

// Гіпсометрична шкала під темний інтерфейс: зелені низини, оливкові схили, світлий камінь на вершинах
export const ELEV_HEX = ['#1d4a3c', '#2f5e3f', '#55683c', '#7c7448', '#9b8a62', '#c9c1ad'];
export const ELEV_STOPS = ELEV_HEX.map(hex);
const ramp = stops => t => {
  const n = stops.length - 1, x = Math.max(0, Math.min(1, t)) * n, i = Math.min(n - 1, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
};
export const elevColor = ramp(ELEV_STOPS);
const WATER = hex('#2f6fd6'), COVER = hex('#19b3a0'), S0 = hex('#2b5f6a'), S1 = hex('#f2c14e'), RIVER = hex('#3f7fd8');

function build(T, f) {
  const out = new Float32Array(GX * GY * 3);
  for (let k = 0; k < GX * GY; k++) {
    let c = elevColor((T.H[k] - T.min) / (T.max - T.min));
    if (T.D[k] < 0.12) c = RIVER;
    c = f(k, c);
    if (!T.INSIDE[k]) c = mix(c, DARK, 0.55);
    const l = toLin(c);
    out[k * 3] = l[0]; out[k * 3 + 1] = l[1]; out[k * 3 + 2] = l[2];
  }
  return out;
}

export const layerElev = T => build(T, (k, c) => c);
export const layerFlood = (T, W, strong) => build(T, (k, c) => (W[k] && T.D[k] >= 0.12 ? mix(c, WATER, strong ? 0.85 : 0.35) : mix(c, [0.05, 0.06, 0.08], 0.15)));
export const layerCover = (T, V) => build(T, (k, c) => (V.some(v => v[k]) ? mix(c, COVER, 0.6) : mix(c, [0.05, 0.06, 0.08], 0.35)));
export const layerSuit = (T, R, W) => build(T, (k, c) => (R.S[k] > 0 ? mix(S0, S1, Math.sqrt(R.S[k] / R.max)) : W[k] && T.D[k] >= 0.12 ? mix(c, WATER, 0.3) : mix(c, [0.05, 0.06, 0.08], 0.45)));

// ——— природні шари ———
export const GEO_GROUPS = [
  ['relief', ['elev', 'slope', 'aspect', 'morph']],
  ['climate', ['insol', 'temp', 'precip', 'frost']],
  ['soils', ['soil', 'bonitet', 'erosion']],
  ['water', ['cover', 'gw']],
];
export const GEO_LAYER_IDS = GEO_GROUPS.flatMap(([, l]) => l);
const RAMPS = {
  slope: ['#362c20', '#6b4f2f', '#a67537', '#db9d4f', '#fece96'],
  insol: ['#393221', '#6b5829', '#a2822a', '#d9ae36', '#feda7f'],
  precip: ['#18313f', '#1b5978', '#2584b2', '#57afe0', '#9ddafe'],
  frost: ['#243225', '#395d3a', '#4d8b50', '#67bb6b', '#99e89b'],
  bonitet: ['#2c301f', '#4f5828', '#75832e', '#9db03d', '#c8de63'],
  div: ['#4589d2', '#56779d', '#616366', '#a06d4d', '#e18344'],
};
export const MORPH_HEX = ['#3080bc', '#6a98b9', '#6e7276', '#988979', '#cc9967', '#f4c26a'];
export const EROSION_HEX = ['#5b483f', '#9f6344', '#e07e47', '#ffae84'];
export const GW_HEX = ['#88d6fe', '#37a4d5', '#19759b', '#2a4d5e'];

// Опис шару: як отримати значення клітинки і як його фарбувати. range повертає [мін, макс, середнє]
export function layerDef(T, id) {
  const G = geo(T);
  switch (id) {
    case 'elev': return { kind: 'seq', hexes: ELEV_HEX, value: k => T.H[k], range: [T.min, T.max], unit: 'm', dec: 0 };
    case 'slope': return { kind: 'seq', hexes: RAMPS.slope, value: k => T.SLOPE[k], range: G.range.SLOPE, curve: Math.sqrt, unit: '°', dec: 1 };
    case 'aspect': return { kind: 'div', hexes: RAMPS.div, value: k => G.SF[k], range: [-1, 1] };
    case 'morph': return { kind: 'cat', hexes: MORPH_HEX, value: k => G.MORPH[k], ids: MORPHS };
    case 'insol': return { kind: 'seq', hexes: RAMPS.insol, value: k => G.INSOL[k], range: G.range.INSOL, unit: 'kwh', dec: 0 };
    case 'temp': { const [lo, hi, m] = G.range.TEMP, d = Math.max(m - lo, hi - m); return { kind: 'div', hexes: RAMPS.div, value: k => G.TEMP[k], range: [m - d, m + d, m], unit: '°C', dec: 1 }; }
    case 'precip': return { kind: 'seq', hexes: RAMPS.precip, value: k => G.PREC[k], range: G.range.PREC, unit: 'mm', dec: 0 };
    case 'frost': return { kind: 'seq', hexes: RAMPS.frost, value: k => G.FFD[k], range: G.range.FFD, unit: 'days', dec: 0 };
    case 'soil': return { kind: 'cat', hexes: SOILS.map(s => s.color), value: k => G.SOIL[k], ids: SOILS.map(s => s.id) };
    case 'bonitet': return { kind: 'seq', hexes: RAMPS.bonitet, value: k => G.BON[k], range: [20, 95], unit: 'pts', dec: 0 };
    case 'erosion': return { kind: 'ord', hexes: EROSION_HEX, value: k => (G.LC[k] === 0 || G.LC[k] === 1 || G.LC[k] === 5 ? 255 : classOf(G.EROS[k], EROSION_BREAKS)), breaks: EROSION_BREAKS, unit: 'tha' };
    case 'cover': return { kind: 'cat', hexes: COVERS.map(c => c.color), value: k => G.LC[k], ids: COVERS.map(c => c.id) };
    case 'gw': return { kind: 'ord', hexes: GW_HEX, value: k => (T.D[k] < 0.12 ? 255 : classOf(G.GW[k], GW_BREAKS)), breaks: GW_BREAKS, unit: 'm' };
    default: return layerDef(T, 'elev');
  }
}

// Кольори природного шару. focus: індекс класу, який підсвічуємо (інші приглушуємо)
export function layerGeo(T, id, focus = null) {
  const D = layerDef(T, id), stops = D.hexes.map(hex);
  const out = new Float32Array(GX * GY * 3), gray = [0.16, 0.17, 0.19];
  const f = D.kind === 'seq' || D.kind === 'div' ? ramp(stops) : null;
  const [lo, hi] = D.range || [0, 1];
  for (let k = 0; k < GX * GY; k++) {
    let c;
    if (T.D[k] < 0.12 && id !== 'cover') c = RIVER;
    else {
      const v = D.value(k);
      if (f) { let t = (v - lo) / (hi - lo || 1); if (D.curve) t = D.curve(Math.max(0, t)); c = f(t); }
      else if (v === 255) c = id === 'soil' ? RIVER : gray;
      else { c = stops[v]; if (focus != null && v !== focus) c = mix(c, DARK, 0.72); }
    }
    if (!T.INSIDE[k]) c = mix(c, DARK, 0.55);
    const l = toLin(c);
    out[k * 3] = l[0]; out[k * 3 + 1] = l[1]; out[k * 3 + 2] = l[2];
  }
  return out;
}

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
