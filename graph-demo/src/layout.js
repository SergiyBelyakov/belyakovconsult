// Розкладка графів силовим методом (d3-force). Рахується один раз і детерміновано,
// тож мережа щоразу виглядає однаково, а вузли не «стрибають» при зміні ваг чи фільтрів.
import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY } from 'd3-force';
import { TERRITORIES, rng } from './data.js';

const R = 232;
export const CENTERS = Object.fromEntries(TERRITORIES.map(t => {
  const a = (t.angle * Math.PI) / 180;
  return [t.id, { x: Math.cos(a) * R, y: Math.sin(a) * R, angle: a }];
}));

// [відстань, сила] для кожного типу зв'язку
const LINK = {
  household: [9, 1], family: [34, .3], care: [22, .6], support: [28, .3],
  social: [56, .05], clinic: [80, .004], rehab: [110, .003], duplicate: [16, .6],
};

export function layoutNetwork(base) {
  const nodes = base.nodes.map((n, i) => {
    const c = n.territory ? CENTERS[n.territory] : { x: 0, y: 0 };
    const ang = i * 2.39996, rad = 18 + (i % 41) * 2.2;
    const o = { id: n.id, kind: n.kind, territory: n.territory, x: c.x + Math.cos(ang) * rad, y: c.y + Math.sin(ang) * rad };
    o.r = n.kind === 'person' ? 8.2 : n.kind === 'rehab' ? 15 : 14;
    if (n.kind === 'clinic') { o.fx = c.x * 1.08; o.fy = c.y * 1.08; }
    if (n.kind === 'rehab') { o.fx = 0; o.fy = 0; }
    return o;
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  const links = base.edges.map(e => ({ source: e.s, target: e.t, type: e.type }));
  const cross = l => byId.get(l.source.id || l.source).territory !== byId.get(l.target.id || l.target).territory;
  // фахівці тяжіють до внутрішнього краю громади; якщо їх двоє, розводимо в боки
  const swShift = new Map();
  for (const n of base.nodes.filter(x => x.kind === 'sw')) {
    const same = base.nodes.filter(x => x.kind === 'sw' && x.territory === n.territory);
    const k = same.indexOf(n) - (same.length - 1) / 2;
    const c = CENTERS[n.territory];
    swShift.set(n.id, { x: -Math.sin(c.angle) * k * 64, y: Math.cos(c.angle) * k * 64 });
  }
  const tx = d => (d.territory ? CENTERS[d.territory].x * (d.kind === 'sw' ? .78 : 1) + (swShift.get(d.id)?.x || 0) : 0);
  const ty = d => (d.territory ? CENTERS[d.territory].y * (d.kind === 'sw' ? .78 : 1) + (swShift.get(d.id)?.y || 0) : 0);
  const sim = forceSimulation(nodes)
    .randomSource(rng(11))
    .force('link', forceLink(links).id(d => d.id).distance(l => LINK[l.type][0]).strength(l => (cross(l) && l.type !== 'clinic' && l.type !== 'rehab' ? .025 : LINK[l.type][1])))
    .force('charge', forceManyBody().strength(d => (d.kind === 'person' ? -19 : -120)).distanceMax(170))
    .force('x', forceX(tx).strength(d => (d.kind === 'person' ? .085 : .25)))
    .force('y', forceY(ty).strength(d => (d.kind === 'person' ? .085 : .25)))
    .force('collide', forceCollide(d => d.r + 1.8).iterations(2))
    .stop();
  for (let i = 0; i < 380; i++) sim.tick();
  const pos = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]));
  return { pos, bounds: boundsOf([...pos.values()], 22) };
}

export function boundsOf(points, pad = 20) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  if (!Number.isFinite(x0)) return { x: -10, y: -10, w: 20, h: 20 };
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

// Карта характеристик: вузли тяжіють до своєї групи, сильні співпадіння зближують.
export function layoutTraits(traits, pairs, minN, minLift) {
  const domains = ['d', 's', 'm'];
  const nodes = traits.map((t, i) => {
    const di = domains.indexOf(t.domain);
    const inDomain = traits.filter(x => x.domain === t.domain);
    const k = inDomain.indexOf(t);
    const a = (di / 3) * Math.PI * 2 - Math.PI / 2 + ((k - (inDomain.length - 1) / 2) * 0.32);
    return { id: t.id, domain: t.domain, i, x: Math.cos(a) * 220, y: Math.sin(a) * 220, a0: (di / 3) * Math.PI * 2 - Math.PI / 2 };
  });
  const links = pairs.filter(p => p.n >= minN && p.lift >= minLift).map(p => ({ source: p.a, target: p.b, lift: p.lift }));
  const sim = forceSimulation(nodes)
    .randomSource(rng(5))
    .force('link', forceLink(links).id(d => d.id).distance(l => 90 + 120 / l.lift).strength(l => Math.min(.35, .04 + (l.lift - 1) * .04)))
    .force('charge', forceManyBody().strength(-520).distanceMax(600))
    .force('ring', forceRadial(230).strength(.32))
    .force('x', forceX(d => Math.cos(d.a0) * 120).strength(.04))
    .force('y', forceY(d => Math.sin(d.a0) * 120).strength(.04))
    .force('collide', forceCollide(62).iterations(3))
    .stop();
  for (let i = 0; i < 420; i++) sim.tick();
  const pos = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]));
  return { pos, bounds: boundsOf([...pos.values()], 62) };
}
