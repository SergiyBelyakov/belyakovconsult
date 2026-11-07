// Запасний режим без WebGL: проєкція хмари зверху на canvas, ті самі кольори й межі норми, клік по точці.
import { useEffect, useRef } from 'react';

export default function Cloud2D({ ds, pos, D, th, dim, bases, sel, onPick, label, note }) {
  const ref = useRef(null), geom = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const w = cv.parentElement.clientWidth, h = cv.parentElement.clientHeight || 520, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < ds.n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const k = Math.min((w - 40) / (x1 - x0 || 1), (h - 40) / (z1 - z0 || 1)), ox = (w - (x1 - x0) * k) / 2 - x0 * k, oz = (h - (z1 - z0) * k) / 2 - z0 * k;
    geom.current = { k, ox, oz };
    bases.forEach(b => { ctx.strokeStyle = 'rgba(134,174,240,.35)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(ox + b.c[0] * k, oz + b.c[2] * k, b.r * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); });
    for (const hot of [false, true]) for (let i = 0; i < ds.n; i++) {
      const isHot = D[i] >= th;
      if (isHot !== hot) continue;
      const a = dim[ds.gi[i]];
      ctx.fillStyle = isHot ? `rgba(240,21,59,${a})` : `rgba(156,184,219,${0.45 * a})`;
      ctx.beginPath(); ctx.arc(ox + pos[i * 3] * k, oz + pos[i * 3 + 2] * k, isHot ? 3 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
    if (sel != null) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + pos[sel * 3] * k, oz + pos[sel * 3 + 2] * k, 8, 0, Math.PI * 2); ctx.stroke(); }
  }, [pos, D, th, dim, bases, sel]);
  const click = e => {
    const g = geom.current, r = ref.current.getBoundingClientRect(); if (!g) return;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 196;
    for (let i = 0; i < ds.n; i++) { const d2 = (g.ox + pos[i * 3] * g.k - x) ** 2 + (g.oz + pos[i * 3 + 2] * g.k - y) ** 2 * 1; if (d2 < bd) { bd = d2; best = i; } }
    if (best != null) onPick(best);
  };
  return (
    <div className="cloud2d">
      <canvas ref={ref} role="img" aria-label={label} onClick={click} />
      <p className="cloud2d-note">{note}</p>
    </div>
  );
}
