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
import * as P3 from './prep3.js';
import { Fan } from './charts/fan.jsx';
import { Control } from './charts/spc.jsx';
import { Cohort } from './charts/cohort.jsx';
import { Decomp } from './charts/decomp.jsx';
import { Mekko } from './charts/mekko.jsx';
import * as P4 from './prep4.js';
import { Stream } from './charts/stream.jsx';
import { Sunburst } from './charts/sunburst.jsx';
import { BiMap } from './charts/bimap.jsx';
import { Iso } from './charts/iso.jsx';

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
  { id: 'stream', group: 'time', roles: [r('date', 'date'), r('series', 'text'), r('value', 'num')], opts: [o('view', ['stream', 'stacked'])], prep: P4.prepStream, Chart: Stream },
  { id: 'fan', group: 'time', roles: [r('date', 'date'), r('value', 'num')], opts: [o('horizon', ['12', '6', '24']), o('model', ['auto', 'trend', 'season'])], prep: P3.prepFan, Chart: Fan },
  { id: 'cohort', group: 'time', roles: [r('id', 'text'), r('date', 'date')], opts: [o('period', ['month', 'week']), o('metric', ['pct', 'count'])], prep: P3.prepCohort, Chart: Cohort },
  { id: 'gantt', group: 'time', roles: [r('task', 'text'), r('start', 'date'), r('end', 'date'), r('group', 'text', 1)], opts: [o('sort', ['start', 'file'])], prep: P.prepGantt, Chart: Gantt },
  { id: 'donut', group: 'part', roles: [r('cat', 'text'), r('value', 'num')], opts: [o('view', ['donut', 'bar', 'ranked'])], prep: P.prepDonut, Chart: Donut },
  { id: 'treemap', group: 'part', roles: [r('group', 'text', 1), r('cat', 'text'), r('value', 'num')], opts: [], prep: P.prepTreemap, Chart: Treemap },
  { id: 'waterfall', group: 'part', roles: [r('step', 'text'), r('value', 'num')], opts: [o('first', ['start', 'delta'])], prep: P.prepWaterfall, Chart: Waterfall },
  { id: 'funnel', group: 'part', roles: [r('stage', 'text'), r('value', 'num')], opts: [], prep: P.prepFunnel, Chart: Funnel },
  { id: 'sunburst', group: 'part', roles: [r('level1', 'text'), r('level2', 'text'), r('level3', 'text', 1), r('value', 'num')], opts: [o('view', ['sunburst', 'icicle'])], prep: P4.prepSun, Chart: Sunburst },
  { id: 'mekko', group: 'part', roles: [r('cat', 'text'), r('series', 'text'), r('value', 'num')], opts: [o('sort', ['value', 'file'])], prep: P3.prepMekko, Chart: Mekko },
  { id: 'decomp', group: 'part', roles: [r('value', 'num')], multi: 'text', opts: [o('agg', ['sum', 'count'])], prep: P3.prepDecomp, Chart: Decomp, noExport: true },
  { id: 'likert', group: 'part', roles: [r('question', 'text'), r('answer', 'text'), r('count', 'num', 1)], opts: [], prep: P.prepLikert, Chart: Likert },
  { id: 'histogram', group: 'dist', roles: [r('value', 'num')], opts: [o('bins', ['auto', '10', '20', '40'])], prep: P.prepHistogram, Chart: Histogram },
  { id: 'box', group: 'dist', roles: [r('group', 'text', 1), r('value', 'num')], opts: [o('points', ['off', 'on']), o('sort', ['file', 'median'])], prep: P.prepBox, Chart: Box },
  { id: 'violin', group: 'dist', roles: [r('group', 'text', 1), r('value', 'num')], opts: [o('view', ['rain', 'violin', 'swarm']), o('sort', ['file', 'median'])], prep: P2.prepViolin, Chart: Violin },
  { id: 'ridge', group: 'dist', roles: [r('group', 'text'), r('value', 'num')], opts: [o('scale', ['shared', 'own']), o('sort', ['file', 'median'])], prep: P2.prepRidge, Chart: Ridge },
  { id: 'scatter', group: 'rel', roles: [r('x', 'num'), r('y', 'num'), r('group', 'text', 1), r('label', 'text', 1)], opts: [o('logx', ['lin', 'log']), o('trend', ['off', 'on']), o('view', ['one', 'small'])], prep: P.prepScatter, Chart: Scatter },
  { id: 'bubble', group: 'rel', roles: [r('x', 'num'), r('y', 'num'), r('size', 'num'), r('label', 'text', 1), r('group', 'text', 1)], opts: [], prep: P.prepBubble, Chart: Bubble },
  { id: 'heatmap', group: 'rel', roles: [r('row', 'text'), r('col', 'text'), r('value', 'num')], opts: [], prep: P.prepHeatmap, Chart: Heatmap },
  { id: 'parallel', group: 'rel', roles: [r('label', 'text', 1), r('group', 'text', 1)], multi: 'num', opts: [], prep: P2.prepParallel, Chart: Parallel },
  { id: 'sankey', group: 'flow', roles: [r('from', 'text'), r('to', 'text'), r('value', 'num')], opts: [], prep: P.prepSankey, Chart: Sankey },
  { id: 'network', group: 'flow', roles: [r('from', 'text'), r('to', 'text'), r('weight', 'num', 1)], opts: [], prep: P.prepNetwork, Chart: Network },
  { id: 'chord', group: 'flow', roles: [r('from', 'text'), r('to', 'text'), r('value', 'num')], opts: [], prep: P2.prepChord, Chart: Chord },
  { id: 'map', group: 'geo', roles: [r('region', 'text'), r('value', 'num')], opts: [], prep: prepMap, Chart: TileMap },
  { id: 'bimap', group: 'geo', roles: [r('region', 'text'), r('ind1', 'num'), r('ind2', 'num')], opts: [o('view', ['bi', 'x', 'y'])], prep: P4.prepBimap, Chart: BiMap },
  { id: 'iso', group: 'geo', roles: [r('label', 'text', 1), r('lon', 'num'), r('lat', 'num'), r('time', 'num'), r('pop', 'num', 1)], opts: [o('limit', ['30', '15', '45', '60']), o('coords', ['auto', 'deg', 'plane'])], prep: P4.prepIso, Chart: Iso },
  { id: 'kpi', group: 'kpi', roles: [r('date', 'date'), r('value', 'num')], opts: [o('better', ['less', 'more'])], prep: P.prepKpi, Chart: Kpi },
  { id: 'spc', group: 'kpi', roles: [r('date', 'date'), r('value', 'num')], opts: [o('rules', ['basic', 'all']), o('base', ['first20', 'all']), o('mr', ['off', 'on'])], prep: P3.prepSpc, Chart: Control },
  { id: 'meter', group: 'kpi', roles: [r('cat', 'text'), r('actual', 'num'), r('target', 'num')], opts: [], prep: P.prepMeter, Chart: Meter },
  { id: 'radar', group: 'kpi', roles: [r('axis', 'text'), r('series', 'text', 1), r('value', 'num')], opts: [o('view', ['radar', 'bars'])], prep: P.prepRadar, Chart: Radar },
  { id: 'table', group: 'kpi', roles: [r('label', 'text')], multi: 'num', opts: [], prep: P.prepTable, Chart: Table, noExport: true },
];
export const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));
export const defOpts = t => Object.fromEntries(t.opts.map(x => [x.id, x.def]));
