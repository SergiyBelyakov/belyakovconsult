// Плиткова карта України: однакові плитки, колір за класами значень (послідовна шкала), «немає даних» окремо.
import { useWidth, useTip, niceScale, Txt, Frame, fit, textW } from './kit.jsx';
import { REGIONS } from '../geo.js';
import { SEQ, INK, GRID, inkOn } from '../palette.js';

const CLS = [SEQ[0], SEQ[2], SEQ[3], SEQ[4], SEQ[6]];
export function TileMap({ m, f, T, mini, lang }) {
  const [ref, W] = useWidth(mini ? 240 : 640);
  const [tip, setTip] = useTip();
  const pitch = mini ? Math.min(28, (W - 4) / 8, 112 / 6) : Math.min(86, (W - 2) / 8), gap = mini ? 2 : 4, tile = pitch - gap;
  const gridW = pitch * 8, ox = (W - gridW) / 2;
  const sc = niceScale(m.min, m.max, 5, m.min >= 0 && m.min < m.max * 0.2);
  const br = sc.ticks.slice(1, -1).slice(0, 4);
  while (br.length < 4) br.push(Infinity);
  const cls = v => br.filter(b => v >= b).length;
  const bands = [sc.lo, ...br.filter(Number.isFinite), sc.hi].map((v, k, a) => (k < a.length - 1 ? [v, a[k + 1]] : null)).filter(Boolean);
  const col = c => CLS[bands.length > 1 ? Math.round((c * (CLS.length - 1)) / (bands.length - 1)) : CLS.length - 1];
  const H = pitch * 6 + (mini ? 0 : 54);
  return (
    <Frame refEl={ref} w={W} h={H} label={m.valueName} tip={tip} mini={mini} onLeave={() => setTip(null)}>
      {REGIONS.map(r => {
        const v = m.values.get(r[0]), has = v != null, fill = has ? col(Math.min(bands.length - 1, cls(v))) : GRID;
        const x = ox + r[4] * pitch, y = r[5] * pitch, ink = has ? inkOn(fill) : INK.faint;
        const name = lang === 'en' ? r[2] : r[1], short = lang === 'en' ? r[7] : r[6];
        const show = () => setTip({ x: x + tile / 2, y: y - 4, title: name, rows: [{ value: has ? f.num(v) : T.ui.noData, label: m.valueName, color: has ? fill : null }] });
        return (
          <g key={r[0]}>
            <rect x={x} y={y} width={tile} height={tile} rx={mini ? 2 : 4} fill={fill} tabIndex={mini ? undefined : 0} onPointerMove={mini ? undefined : show} onFocus={mini ? undefined : show} onBlur={() => setTip(null)} />
            {!mini && <Txt x={x + 6} y={y + 16} size={tile > 70 ? 10 : 9} color={ink} style={{ pointerEvents: 'none' }}>{fit(short, tile - 10, tile > 70 ? 10 : 9)}</Txt>}
            {!mini && <Txt x={x + 6} y={y + tile - 10} size={tile > 60 ? 15 : 12} weight={600} color={ink} style={{ pointerEvents: 'none' }}>{has ? f.num(v) : T.ui.na}</Txt>}
          </g>
        );
      })}
      {!mini && <g transform={`translate(${ox},${pitch * 6 + 18})`}>
        {bands.map(([a, b], k) => (
          <g key={k} transform={`translate(${k * Math.min(96, gridW / (bands.length + 1))},0)`}>
            <rect x={0} y={0} width={18} height={12} rx="2" fill={col(k)} />
            <Txt x={24} y={10} size={10.5}>{f.num(a)}{k === bands.length - 1 ? '+' : ''}</Txt>
          </g>
        ))}
        <g transform={`translate(${bands.length * Math.min(96, gridW / (bands.length + 1))},0)`}><rect x={0} y={0} width={18} height={12} rx="2" fill={GRID} /><Txt x={24} y={10} size={10.5}>{T.ui.noData}</Txt></g>
      </g>}
    </Frame>
  );
}
