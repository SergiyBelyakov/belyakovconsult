// Рівень 2: «Чому це відбувається?» Дерево причин відхилення EBITDA від плану, водоспад для вибраного вузла
// і внесок факторів (Парето). Клік по вузлу або стовпцю водоспаду веде глибше; шлях зберігається в посиланні.
import { Panel, Segmented, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { DecompTree, Pareto } from '../charts2.jsx';
import { Waterfall } from '../charts.jsx';
import { causeTree, autoPath, pathFrom, factorGroups, leafFor } from '../causes.js';
import { yearStart } from '../model.js';

export default function Causes({ ctx }) {
  const { T, f, ind, unit, i, per, setPer, causePath, setCausePath, openExplain, unitName, applyPresets } = ctx;
  const a = per === 'ytd' ? yearStart(i) : i;
  const tree = causeTree(ind, a, i);
  const valid = causePath && causePath.length && causePath.every(id => tree.index.has(id)) && (unit === 'all' || causePath[0] === unit);
  const path = valid ? causePath : autoPath(tree, unit);
  const focusLevel = Math.min(ctx.causeFocus ?? (unit !== 'all' ? 1 : 0), path.length);
  const focus = focusLevel === 0 ? tree.root : tree.index.get(path[focusLevel - 1]) || tree.root;

  const nodeName = n => {
    if (n.level === 0) return T.causes.company;
    if (n.level === 1) return unitName(n.key);
    if (n.level === 2) return T.products[ind][n.key];
    if (n.level === 3) return T.lines[n.key];
    return T.factors[ind][n.key];
  };
  const fullName = n => [unitName(n.unit), T.products[ind][n.product], T.lines[n.line], n.level === 4 ? T.factors[ind][n.key] : null].filter(Boolean).join(' · ');
  const pick = (c, n) => { setCausePath(pathFrom(tree, n.id)); ctx.setCauseFocus(c); };
  const pctOf = (n, c) => {
    const parent = c === 1 ? tree.root : tree.index.get(n.parent);
    const negSum = parent.children.filter(x => x.value < 0).reduce((s, x) => s + x.value, 0);
    return n.value < 0 && negSum ? ' · ' + Math.round((n.value / negSum) * 100) + '%' : '';
  };

  // водоспад вибраного вузла: план → гілки → факт (для статті: гілки → сума)
  const kids = focus.children;
  const steps = focus.plan != null
    ? [{ id: 'plan', value: focus.plan, total: true }, ...kids.map(k => ({ id: k.id, value: k.value })), { id: 'fact', value: focus.fact, total: true }]
    : [...kids.map(k => ({ id: k.id, value: k.value })), { id: 'sum', value: focus.value, total: true }];
  const stepName = id => (id === 'plan' ? T.plan : id === 'fact' ? T.actual : id === 'sum' ? T.causes.lineTotal : nodeName(tree.index.get(id)));

  // внесок: групи «підрозділ × фактор» (у межах підрозділу, якщо він вибраний); клік веде до найбільшої гілки групи
  const gs = factorGroups(tree).filter(g => unit === 'all' || g.unit === unit).map(g => ({ ...g, id: g.unit + '|' + g.factor }));
  const neg = gs.filter(g => g.value < 0).sort((x, y) => x.value - y.value);
  const negTotal = neg.reduce((s, l) => s + l.value, 0) || -1;
  let acc = 0, n80 = neg.length;
  for (let k = 0; k < neg.length; k++) { acc += neg[k].value; if (acc / negTotal >= 0.8) { n80 = k + 1; break; } }
  const items = [...neg.slice(0, 10), ...gs.filter(l => l.value > 0).sort((x, y) => y.value - x.value).slice(0, 3)];
  const groupName = g => (T.unitsShort[ind][g.unit] || unitName(g.unit)) + ' · ' + T.factors[ind][g.factor];
  const groupPick = g => { const leaf = leafFor(tree, g.unit, [g.factor]); if (leaf) { const p = pathFrom(tree, leaf.id); setCausePath(p); ctx.setCauseFocus(Math.max(0, p.length - 1)); } };
  const root = unit !== 'all' && tree.index.has(unit) ? tree.index.get(unit) : tree.root;
  const perLabel = per === 'ytd' ? T.causes.perYtd(f.month(ctx.D.company[a].m), f.month(ctx.D.company[i].m)) : f.month(ctx.D.company[i].m, true);
  const leafNode = tree.index.get(path[path.length - 1]);

  return (
    <>
      <div className="cause-sum glass">
        <div className="cause-figs">
          <div><span>{T.causes.fact}</span><b>{f.money(root.fact)}</b></div>
          <div><span>{T.plan}</span><b>{f.money(root.plan)}</b></div>
          <div><span>{T.causes.gap}</span><b className={root.value < 0 ? 'over' : 'good'}>{f.signedMoney(root.value)}</b><small>{f.signedPct(root.value / Math.abs(root.plan || 1))}</small></div>
          <div><span>{T.causes.explained}</span><b>{f.int(n80)}</b><small>{T.causes.explainedNote}</small></div>
        </div>
        <div className="cause-ctl">
          <Segmented value={per} onChange={v => { setPer(v); setCausePath(null); }} label={T.causes.period} options={[{ value: 'm', label: T.causes.month }, { value: 'ytd', label: T.causes.ytd }]} />
          <Button icon="bulb" onClick={() => openExplain({ per })}>{T.explain.button}</Button>
        </div>
      </div>

      <Panel title={T.causes.treeTitle(perLabel)} sub={T.causes.treeSub} className="dtree-panel">
        <p className="scroll-hint">{T.causes.scrollHint}</p>
        <div className="table-scroll" data-tour="tree">
          <DecompTree root={tree.root} index={tree.index} path={path} onPick={pick} name={nodeName} fmt={f.signedMoney} levels={T.causes.levels} pctOf={pctOf} />
        </div>
        {leafNode && (
          <div className="cause-leaf">
            <Icon name="info" size={16} />
            <p>{T.causes.leafText(fullName(leafNode), f.signedMoney(leafNode.value), T.factorHint[ind][leafNode.level === 4 ? leafNode.key : leafNode.factor || leafNode.key] || '')}</p>
            {T.causes.leafFix[ind][leafNode.level === 4 ? leafNode.key : leafNode.factor] && (
              <button type="button" className="link-btn" onClick={() => applyPresets(T.causes.leafFix[ind][leafNode.level === 4 ? leafNode.key : leafNode.factor])}><Icon name="flask" size={14} />{T.att.simulate}</button>
            )}
          </div>
        )}
      </Panel>

      <div className="grid grid-main start">
        <Panel title={T.causes.wfTitle(focusLevel === 0 ? T.causes.company : nodeName(focus))} sub={T.causes.wfSub}
          aside={focusLevel > 0 && <Button icon="back" onClick={() => ctx.setCauseFocus(focusLevel - 1)}>{T.causes.up}</Button>}>
          <Waterfall steps={steps} name={stepName} fmt={f.money} fmtShort={v => f.dec1(v / 1000)} label={T.causes.wfTitle(nodeName(focus))} height={300}
            onPick={kids.some(k => k.children.length) ? b => { const n = tree.index.get(b.id); if (n) { setCausePath(pathFrom(tree, n.id)); ctx.setCauseFocus(Math.min(4, focusLevel + 1)); } } : null}
            picked={path[focusLevel]} />
        </Panel>
        <Panel title={T.causes.paretoTitle} sub={T.causes.paretoSub(f.int(n80), f.int(neg.length))}>
          <Pareto items={items} fmt={f.signedMoney} name={groupName} sub={g => g.products.length > 1 ? T.causes.topProduct(T.products[ind][g.products[0].product]) : null} onPick={groupPick} />
          <p className="muted small pareto-note">{T.causes.paretoNote}</p>
        </Panel>
      </div>
      <p className="page-note muted small">{T.causes.note}</p>
    </>
  );
}
