import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon, StatusIcon } from '../../../dashboard/src/icons.jsx';
import { SIGNALS, SIG } from '../model.js';
import { BY_ID, OBJ_BY } from '../world.js';
import { DOM_OF } from '../TwinMap.jsx';

const LEVELS = ['critical', 'warning', 'info'];

export default function Signals({ ctx }) {
  const { T, f, sig, setSig, go, placeName, objName } = ctx;
  const cur = SIGNALS.find(s => s.id === sig) || SIGNALS.find(s => s.level === 'critical');
  const items = SIG[cur.id];
  const nameOf = x => (cur.kind === 'place' ? placeName(BY_ID.get(x.id)) : cur.kind === 'okrug' ? T.okrugName(x.id) : cur.kind === 'source' ? T.src[x.id] : objName(OBJ_BY.get(x.id)));
  const openItem = x => {
    if (cur.kind === 'place') go('places', { place: x.id });
    else if (cur.kind === 'object' || cur.kind === 'building') { const o = OBJ_BY.get(x.id); go('map', { mode: 'map', layers: ['pop', DOM_OF[o.cat]], sel: { kind: 'obj', id: x.id } }); }
    else if (cur.kind === 'okrug') go('finance');
    else go('method');
  };
  return (
    <div className="sig-layout">
      <Panel className="sig-list">
        {LEVELS.map(l => {
          const list = SIGNALS.filter(s => s.level === l);
          return (
            <div key={l} className="sig-group">
              <h4><span className={'status ' + l}><StatusIcon level={l} />{T.sigLevel[l]}</span><small>{T.sigs.count(list.length)}</small></h4>
              {list.map(s => (
                <button type="button" key={s.id} className={'sig-item' + (cur.id === s.id ? ' on' : '')} onClick={() => setSig(s.id)}>
                  <span className="si-title">{T.sig[s.id].t}</span>
                  <span className="si-meta">{T.dom[s.dom]} · {T.sigs.items(SIG[s.id].length)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </Panel>
      <Panel className="sig-detail">
        <div className="sd-head">
          <span className={'status ' + cur.level}><StatusIcon level={cur.level} />{T.sigLevel[cur.level]}</span>
          <span className="muted small">{T.dom[cur.dom]}</span>
        </div>
        <h2>{T.sig[cur.id].t}</h2>
        <div className="sd-blocks">
          <div><h5>{T.sigs.rule}</h5><p>{T.sig[cur.id].rule}</p></div>
          <div><h5>{T.sigs.why}</h5><p>{T.sig[cur.id].why}</p></div>
          <div className="sd-step"><h5><Icon name="arrowRight" size={14} />{T.sigs.step}</h5><p>{T.sig[cur.id].step}</p></div>
        </div>
        <h5 className="sd-list-h">{T.sigs.list}: {T.sigs.items(items.length)}</h5>
        <ul className="sd-items">
          {items.map(x => (
            <li key={x.id}><button type="button" onClick={() => openItem(x)}><strong>{nameOf(x)}</strong><span>{T.sigs.it[cur.id](x, f, T)}</span><Icon name="chevronRight" size={14} /></button></li>
          ))}
        </ul>
        <div className="sd-actions"><Button kind="primary" icon="arrowRight" onClick={() => go(cur.page)}>{T.sigs.open}: {T.nav[cur.page]}</Button></div>
      </Panel>
    </div>
  );
}
