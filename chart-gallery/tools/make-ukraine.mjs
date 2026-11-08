// Межі 27 регіонів України для карт галереї: Natural Earth 10m admin 1 (суспільне надбання),
// проєкція Альберса (рівновелика, площі не спотворюються), спрощення зі збереженням спільних меж.
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/nvkelso/natural-earth-vector
//   git -C natural-earth-vector sparse-checkout set --no-cone /geojson/ne_10m_admin_1_states_provinces.geojson
//   NODE_PATH=/opt/npm-tools/node_modules node chart-gallery/tools/make-ukraine.mjs <шлях до geojson>
// Результат: chart-gallery/src/ukraine-geo.js
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// d3-geo з NODE_PATH (ESM-імпорт його не бачить, require.resolve бачить)
const { geoConicEqualArea } = await import(pathToFileURL(createRequire(import.meta.url).resolve('d3-geo')).href);

const src = process.argv[2];
const all = JSON.parse(readFileSync(src, 'utf8'));
// Natural Earth за замовчуванням позначає Крим і Севастополь як де-факто; для карти України беремо всі 27 регіонів за ISO 3166-2
const feats = all.features.filter(f => String(f.properties.iso_3166_2 || '').startsWith('UA-'));
if (feats.length !== 27) throw new Error('expected 27 regions, got ' + feats.length);

const W = 1000;
const proj = geoConicEqualArea().parallels([45.5, 50.5]).rotate([-31.5, 0]);
proj.fitWidth(W, { type: 'FeatureCollection', features: feats });

// кільця в спроєктованих координатах; ключ точки з квантуванням, щоб спільні межі збігались точно
const Q = 1e5, key = p => Math.round(p[0] * Q) + ',' + Math.round(p[1] * Q);
const rings = [];
feats.forEach((f, fi) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  polys.forEach((poly, pi) => poly.forEach((ring, ri) => {
    const pts = ring.slice(0, -1);   // без повтору першої точки
    rings.push({ fi, pi, ri, keys: pts.map(key), ll: pts });
  }));
});
// для кожної точки: кільця, яким вона належить
const inc = new Map();
rings.forEach((r, k) => r.keys.forEach(q => { if (!inc.has(q)) inc.set(q, new Set()); inc.get(q).add(k); }));
const setKey = q => [...inc.get(q)].sort((a, b) => a - b).join('|');
// вузли: точка, де змінюється набір сусідніх кілець, або спільна для трьох і більше кілець
rings.forEach(r => {
  const n = r.keys.length;
  r.node = r.keys.map((q, i) => {
    const s = setKey(q);
    if (inc.get(q).size > 2) return true;
    return s !== setKey(r.keys[(i + n - 1) % n]) || s !== setKey(r.keys[(i + 1) % n]);
  });
});
// дуги між вузлами; однакові дуги (у будь-якому напрямку) спрощуються один раз
const arcs = new Map();
const rdp = (pts, eps) => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-12;
    let best = -1, bd = 0;
    for (let i = a + 1; i < b; i++) { const d = l > 1e-9 ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / l : Math.hypot(pts[i][0] - ax, pts[i][1] - ay); if (d > bd) { bd = d; best = i; } }
    if (bd > eps) { keep[best] = 1; st.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
};
const EPS = +(process.argv[3] || 0.35);   // допуск у пікселях при ширині 1000
function arcOf(keys, ll) {
  const fwd = keys.join(';'), rev = [...keys].reverse().join(';');
  const canon = fwd < rev ? fwd : rev, flip = canon !== fwd;
  if (!arcs.has(canon)) {
    const P = (flip ? [...ll].reverse() : ll).map(p => proj(p));
    arcs.set(canon, { pts: rdp(P, EPS), sets: setKey(keys[Math.floor(keys.length / 2)]) });
  }
  const a = arcs.get(canon).pts;
  return flip ? [...a].reverse() : a;
}
const outRings = rings.map(r => {
  const n = r.keys.length, nodes = r.node.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  if (!nodes.length) {
    // кільце без вузлів (острів або місто всередині області): канонічний початок у найменшій точці
    let s = 0; r.keys.forEach((q, i) => { if (q < r.keys[s]) s = i; });
    const keys = [...r.keys.slice(s), ...r.keys.slice(0, s), r.keys[s]], ll = [...r.ll.slice(s), ...r.ll.slice(0, s), r.ll[s]];
    return { ...r, pts: arcOf(keys, ll).slice(0, -1) };
  }
  const pts = [];
  nodes.forEach((a, j) => {
    const b = nodes[(j + 1) % nodes.length];
    const idx = []; for (let i = a; ; i = (i + 1) % n) { idx.push(i); if (i === b && idx.length > 1) break; if (idx.length > n + 1) break; }
    const seg = arcOf(idx.map(i => r.keys[i]), idx.map(i => r.ll[i]));
    pts.push(...seg.slice(0, -1));
  });
  return { ...r, pts };
});
const r1 = v => Math.round(v * 10) / 10;
const pathOf = pts => {
  let d = 'M' + r1(pts[0][0]) + ',' + r1(pts[0][1]), px = r1(pts[0][0]), py = r1(pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const x = r1(pts[i][0]), y = r1(pts[i][1]); const dx = r1(x - px), dy = r1(y - py); if (!dx && !dy) continue; d += 'l' + dx + ',' + dy; px = x; py = y; }
  return d + 'z';
};
const ISO2ID = { 'UA-07': 'vol', 'UA-56': 'riv', 'UA-18': 'zhy', 'UA-32': 'kyo', 'UA-74': 'chn', 'UA-59': 'sum', 'UA-46': 'lvi', 'UA-61': 'ter', 'UA-68': 'khm', 'UA-30': 'kyc', 'UA-53': 'pol', 'UA-63': 'kha', 'UA-09': 'luh', 'UA-21': 'zak', 'UA-26': 'ivf', 'UA-77': 'chv', 'UA-05': 'vin', 'UA-71': 'che', 'UA-12': 'dni', 'UA-14': 'don', 'UA-51': 'ode', 'UA-35': 'kir', 'UA-23': 'zap', 'UA-48': 'myk', 'UA-65': 'khe', 'UA-40': 'sev', 'UA-43': 'cri' };
const regions = feats.map((f, fi) => {
  const rs = outRings.filter(r => r.fi === fi && r.pts.length >= 3);
  const d = rs.map(r => pathOf(r.pts)).join('');
  // точка підпису: з Natural Earth (усередині полігона), спроєктована
  const lp = proj([f.properties.longitude, f.properties.latitude]);
  const xs = rs.flatMap(r => r.pts.map(p => p[0])), ys = rs.flatMap(r => r.pts.map(p => p[1]));
  return { id: ISO2ID[f.properties.iso_3166_2], d, lx: r1(lp[0]), ly: r1(lp[1]), box: [r1(Math.min(...xs)), r1(Math.min(...ys)), r1(Math.max(...xs)), r1(Math.max(...ys))] };
});
// державний кордон і узбережжя: дуги, що належать лише одному кільцю
const border = [...arcs.values()].filter(a => !a.sets.includes('|')).map(a => { const p = a.pts; return pathOf(p).slice(0, -1); }).join('');
const H = Math.ceil(Math.max(...regions.map(r => r.box[3])));
const npts = outRings.reduce((s, r) => s + r.pts.length, 0);
const out = `// Згенеровано chart-gallery/tools/make-ukraine.mjs з Natural Earth 10m admin 1 (суспільне надбання).
// Рівновелика конічна проєкція Альберса, ширина ${W}, спільні межі спрощено один раз (допуск ${EPS} px). Точок: ${npts}.
export const UA_W = ${W}, UA_H = ${H};
export const UA_REGIONS = ${JSON.stringify(regions)};
export const UA_BORDER = ${JSON.stringify(border)};
`;
writeFileSync(new URL('../src/ukraine-geo.js', import.meta.url), out);
console.log('regions', regions.length, 'points', npts, 'arcs', arcs.size, 'bytes', out.length, 'H', H);
