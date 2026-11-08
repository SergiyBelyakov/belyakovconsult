// Реєстр типів візуалізацій: група, ролі колонок, параметри, підготовка даних і компонент.
import * as P from './prep.js';
import { prepMap } from './geo.js';
import { Column, Bar, Grouped, Stacked, Dumbbell, Bullet, Meter } from './charts/compare.jsx';
import { Line, Area, Kpi, Calendar, Gantt } from './charts/time.jsx';
import { Donut, Treemap, Waterfall, Funnel, Likert } from './charts/part.jsx';
import { Histogram, Box } from './charts/dist.jsx';
import { Scatter, Bubble, Heatmap } from './charts/rel.jsx';
import { Sankey, Network } from './charts/flow.jsx';
import { TileMap } from './charts/geo.jsx';
import { Radar, Table } from './charts/other.jsx';
import * as P2 from './prep2.js';
import { Bump } from './charts/bump.jsx';
import { Violin, Ridge } from './charts/dist2.jsx';
import { Parallel } from './charts/parallel.jsx';
import { Chord } from './charts/chord.jsx';
import { Small } from './charts/small.jsx';

export const GROUPS = ['compare', 'time', 'part', 'dist', 'rel', 'flow', 'geo', 'kpi'];
const r = (id, kind, opt) => ({ id, kind, opt: !!opt });
const o = (id, values) => ({ id, values, def: values[0] });

export const TYPES = [
  { id: 'column', group: 'compare', roles: [r('cat', 'text'), r('value', 'num')], opts: [o('sort', ['file', 'value'])], prep: P.prepColumn, Chart: Column },
  { id: 'bar', group: 'compare', roles: [r('cat', 'text'), r('value', 'num')], opts: [o('sort', ['value', 'file'])], prep: P.prepBar, Chart: Bar },
  { id: 'grouped', group: 'compare', roles: [r('cat', 'text'), r('series', 'text'), r('value', 'num')], opts: [o('view', ['grouped', 'small'])], prep: P.prepGrouped, Chart: Grouped },
  { id: 'stacked', group: 'compare', roles: [r('cat', 'text'), r('series', 'text'), r('value', 'num')], opts: [o('mode', ['abs', 'pct'])], prep: P.prepStacked, Chart: Stacked },
  { id: 'dumbbell', group: 'compare', roles: [r('cat', 'text'), r('before', 'num'), r('after', 'num')], opts: [o('sort', ['after', 'change', 'file'])], prep: P.prepDumbbell, Chart: Dumbbell },
  { id: 'bullet', group: 'compare', roles: [r('cat', 'text'), r('actual', 'num'), r('target', 'num')], opts: [], prep: P.prepBullet, Chart: Bullet },
  { id: 'small', group: 'compare', roles: [r('facet', 'text'), r('date', 'date'), r('value', 'num')], opts: [o('sort', ['file', 'last', 'change']), o('scale', ['shared', 'own'])], prep: P2.prepSmall, Chart: Small },
  { id: 'line', group: 'time', roles: [r('date', 'date'), r('series', 'text', 1), r('value', 'num')], opts: [o('view', ['lines', 'small'])], prep: P.prepLine, Chart: Line },
  { id: 'area', group: 'time', roles: [r('date', 'date'), r('value', 'num')], opts: [o('smooth', ['none', 'ma'])], prep: P.prepArea, Chart: Area },
  { id: 'calendar', group: 'time', roles: [r('date', 'date'), r('value', 'num')], opts: [], prep: P.prepCalendar, Chart: Calendar },
  { id: 'bump', group: 'time', roles: [r('period', 'text'), r('item', 'text'), r('value', 'num')], opts: [o('rank', ['desc', 'asc'])], prep: P2.prepBump, Chart: Bump },
  { id: 'gantt', group: 'time', roles: [r('task', 'text'), r('start', 'date'), r('end', 'date'), r('group', 'text', 1)], opts: [o('sort', ['start', 'file'])], prep: P.prepGantt, Chart: Gantt },
  { id: 'donut', group: 'part', roles: [r('cat', 'text'), r('value', 'num')], opts: [o('view', ['donut', 'bar', 'ranked'])], prep: P.prepDonut, Chart: Donut },
  { id: 'treemap', group: 'part', roles: [r('group', 'text', 1), r('cat', 'text'), r('value', 'num')], opts: [], prep: P.prepTreemap, Chart: Treemap },
  { id: 'waterfall', group: 'part', roles: [r('step', 'text'), r('value', 'num')], opts: [o('first', ['start', 'delta'])], prep: P.prepWaterfall, Chart: Waterfall },
  { id: 'funnel', group: 'part', roles: [r('stage', 'text'), r('value', 'num')], opts: [], prep: P.prepFunnel, Chart: Funnel },
  { id: 'likert', group: 'part', roles: [r('question', 'text'), r('answer', 'text'), r('count', 'num', 1)], opts: [], prep: P.prepLikert, Chart: Likert },
  { id: 'histogram', group: 'dist', roles: [r('value', 'num')], opts: [o('bins', ['auto', '10', '20', '40'])], prep: P.prepHistogram, Chart: Histogram },
  { id: 'box', group: 'dist', roles: [r('group', 'text', 1), r('value', 'num')], opts: [o('points', ['off', 'on']), o('sort', ['file', 'median'])], prep: P.prepBox, Chart: Box },
  { id: 'violin', group: 'dist', roles: [r('group', 'text', 1), r('value', 'num')], opts: [o('view', ['rain', 'violin', 'swarm']), o('sort', ['file', 'median'])], prep: P2.prepViolin, Chart: Violin },
  { id: 'ridge', group: 'dist', roles: [r('group', 'text'), r('value', 'num')], opts: [o('scale', ['shared', 'own']), o('sort', ['file', 'median'])], prep: P2.prepRidge, Chart: Ridge },
  { id: 'scatter', group: 'rel', roles: [r('x', 'num'), r('y', 'num'), r('group', 'text', 1), r('label', 'text', 1)], opts: [o('logx', ['lin', 'log']), o('trend', ['off', 'on']), o('view', ['one', 'small'])], prep: P.prepScatter, Chart: Scatter },
  { id: 'bubble', group: 'rel', roles: [r('x', 'num'), r('y', 'num'), r('size', 'num'), r('label', 'text', 1), r('group', 'text', 1)], opts: [], prep: P.prepBubble, Chart: Bubble },
  { id: 'heatmap', group: 'rel', roles: [r('row', 'text'), r('col', 'text'), r('value', 'num')], opts: [], prep: P.prepHeatmap, Chart: Heatmap },
  { id: 'parallel', group: 'rel', roles: [r('label', 'text', 1), r('group', 'text', 1)], multi: true, opts: [], prep: P2.prepParallel, Chart: Parallel },
  { id: 'sankey', group: 'flow', roles: [r('from', 'text'), r('to', 'text'), r('value', 'num')], opts: [], prep: P.prepSankey, Chart: Sankey },
  { id: 'network', group: 'flow', roles: [r('from', 'text'), r('to', 'text'), r('weight', 'num', 1)], opts: [], prep: P.prepNetwork, Chart: Network },
  { id: 'chord', group: 'flow', roles: [r('from', 'text'), r('to', 'text'), r('value', 'num')], opts: [], prep: P2.prepChord, Chart: Chord },
  { id: 'map', group: 'geo', roles: [r('region', 'text'), r('value', 'num')], opts: [], prep: prepMap, Chart: TileMap },
  { id: 'kpi', group: 'kpi', roles: [r('date', 'date'), r('value', 'num')], opts: [o('better', ['less', 'more'])], prep: P.prepKpi, Chart: Kpi },
  { id: 'meter', group: 'kpi', roles: [r('cat', 'text'), r('actual', 'num'), r('target', 'num')], opts: [], prep: P.prepMeter, Chart: Meter },
  { id: 'radar', group: 'kpi', roles: [r('axis', 'text'), r('series', 'text', 1), r('value', 'num')], opts: [o('view', ['radar', 'bars'])], prep: P.prepRadar, Chart: Radar },
  { id: 'table', group: 'kpi', roles: [r('label', 'text')], multi: true, opts: [], prep: P.prepTable, Chart: Table, noExport: true },
];
export const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));
export const defOpts = t => Object.fromEntries(t.opts.map(x => [x.id, x.def]));
