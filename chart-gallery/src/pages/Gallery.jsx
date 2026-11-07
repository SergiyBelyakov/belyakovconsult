// Галерея: фільтр за задачею і картки з живими мініатюрами на зразках даних.
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Button } from '../../../dashboard/src/ui.jsx';
import { TYPES, GROUPS, defOpts } from '../types.js';

export default function Gallery({ ctx }) {
  const { T, TT, f, lang, group, setGroup, samples, open, downloadAll, navigate } = ctx;
  const list = TYPES.filter(t => group === 'all' || t.group === group);
  return (
    <>
      <div className="cg-filter" role="toolbar" aria-label={T.groups.all}>
        {['all', ...GROUPS].map(g => (
          <button type="button" key={g} className={'chip' + (group === g ? ' active' : '')} aria-pressed={group === g} onClick={() => setGroup(g)}>
            {T.groups[g]}<span className="cg-count">{g === 'all' ? TYPES.length : TYPES.filter(t => t.group === g).length}</span>
          </button>
        ))}
      </div>
      <div className="cg-grid">
        {list.map(t => {
          const s = samples[t.id];
          return (
            <a key={t.id} className="cg-card glass" href={'#chart&t=' + t.id} onClick={e => { e.preventDefault(); open(t.id); }}>
              <div className="cg-thumb" aria-hidden="true">{!s.model.error && <t.Chart m={s.model} f={f} T={T} mini lang={lang} opts={defOpts(t)} />}</div>
              <span className="cg-tag">{T.groups[t.group]}</span>
              <h3>{TT[t.id].name}</h3>
              <p>{TT[t.id].short}</p>
              <span className="cg-more">{T.d.open}<Icon name="arrowRight" size={14} /></span>
            </a>
          );
        })}
      </div>
      <div className="cg-band glass">
        <div>
          <strong>{T.d.allSamples}</strong>
          <p className="muted">{T.d.allSamplesHint}</p>
        </div>
        <div className="cg-band-actions">
          <Button icon="download" onClick={downloadAll}>{T.d.allSamples}</Button>
          <Button icon="upload" kind="primary" onClick={() => navigate('own')}>{T.nav.own}</Button>
        </div>
      </div>
    </>
  );
}
