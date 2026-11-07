// Як обрати: задачі з типами, шість принципів, помилки з кращими альтернативами.
import { Icon } from '../../../dashboard/src/icons.jsx';
import { Panel } from '../../../dashboard/src/ui.jsx';
import { TYPE, defOpts } from '../types.js';

export default function Choose({ ctx }) {
  const { T, TT, f, lang, samples, open } = ctx;
  const C = T.choose;
  const chip = id => (
    <a key={id} className="cg-typechip" href={'#chart&t=' + id} onClick={e => { e.preventDefault(); open(id); }}>
      <span className="cg-typechip-art" aria-hidden="true">{(() => { const t = TYPE[id], s = samples[id]; return !s.model.error && <t.Chart m={s.model} f={f} T={T} mini lang={lang} opts={defOpts(t)} />; })()}</span>
      <span>{TT[id].name}</span>
    </a>
  );
  return (
    <>
      <h2 className="cg-h2">{C.tasksTitle}</h2>
      <div className="cg-tasks">
        {C.tasks.map(([title, sub, ids], k) => (
          <section key={k} className="cg-task glass">
            <h3>{title}</h3>
            <p className="muted">{sub}</p>
            <div className="cg-typechips">{ids.map(chip)}</div>
          </section>
        ))}
      </div>
      <h2 className="cg-h2">{C.principlesTitle}</h2>
      <div className="cg-principles">
        {C.principles.map(([h, p], k) => <section key={k} className="glass cg-principle"><span className="cg-num big">{k + 1}</span><h3>{h}</h3><p className="muted">{p}</p></section>)}
      </div>
      <h2 className="cg-h2">{C.mistakesTitle}</h2>
      <Panel className="cg-mistakes">
        {C.mistakes.map(([h, p, ids], k) => (
          <div key={k} className="cg-mistake">
            <span className="cg-mistake-icon"><Icon name="x" size={14} /></span>
            <div>
              <strong>{h}</strong>
              <p className="muted">{p}</p>
              <span className="cg-alts">{ids.map(id => <a key={id} href={'#chart&t=' + id} onClick={e => { e.preventDefault(); open(id); }}>{TT[id].name}<Icon name="arrowRight" size={12} /></a>)}</span>
            </div>
          </div>
        ))}
      </Panel>
    </>
  );
}
