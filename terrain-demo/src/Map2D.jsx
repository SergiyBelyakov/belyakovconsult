// Карта зверху на canvas: ті самі шари, що й у 3D, з відтіненням рельєфу. Запасний режим, якщо WebGL недоступний.
import { useEffect, useRef } from 'react';
import { GX, GY, STEP, WORLD } from './dem.js';
import { hillshade } from './layers.js';

const gamma = v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));

export default function Map2D({ T, colors, places, sites = [], height = 520, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !colors) return;
    const w = cv.parentElement.clientWidth, h = Math.min(height, (w * WORLD.h) / WORLD.w);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(GX, GY), hs = hillshade(T);
    for (let k = 0; k < GX * GY; k++) {
      const s = 0.55 + 0.6 * hs[k];
      img.data[k * 4] = Math.min(255, gamma(colors[k * 3]) * s); img.data[k * 4 + 1] = Math.min(255, gamma(colors[k * 3 + 1]) * s);
      img.data[k * 4 + 2] = Math.min(255, gamma(colors[k * 3 + 2]) * s); img.data[k * 4 + 3] = 255;
    }
    const off = document.createElement('canvas'); off.width = GX; off.height = GY; off.getContext('2d').putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const k = Math.min(w / WORLD.w, h / WORLD.h), ox = (w - WORLD.w * k) / 2, oy = (h - WORLD.h * k) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(off, ox, oy, GX * STEP * k, GY * STEP * k);
    const P = (x, y) => [ox + x * k, oy + y * k];
    ctx.strokeStyle = 'rgba(233,237,242,.5)'; ctx.lineWidth = 1;
    T.base.roads.forEach(r => { ctx.beginPath(); r.pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); });
    ctx.font = '600 11px Inter, Arial, sans-serif';
    places.forEach(p => {
      const [x, y] = P(p.x, p.y);
      ctx.fillStyle = p.state === 'hot' ? '#ff4d63' : p.state === 'dim' ? '#8a94a6' : '#f4f6f8';
      ctx.beginPath(); ctx.arc(x, y, p.kind === 'village' ? 3 : 4.5, 0, Math.PI * 2); ctx.fill();
      if (p.label) { ctx.fillStyle = 'rgba(5,7,10,.75)'; const tw = ctx.measureText(p.label).width; ctx.fillRect(x + 6, y - 9, tw + 8, 16); ctx.fillStyle = '#f4f6f8'; ctx.fillText(p.label, x + 10, y + 3); }
    });
    sites.forEach(s => {
      const [x, y] = P(s.x, s.y);
      if (s.ring) { ctx.strokeStyle = 'rgba(255,77,99,.6)'; ctx.beginPath(); ctx.arc(x, y, s.ring * k, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#d90429'; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 6, y + 3); ctx.lineTo(x - 6, y + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f6f8'; ctx.fillText(s.label, x + 8, y - 6);
    });
  }, [colors, places, sites]);
  return <div className="map2d"><canvas ref={ref} role="img" aria-label={label} /></div>;
}
