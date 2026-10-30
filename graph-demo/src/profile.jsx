// Профіль вузла: людина (індекс, складові, фактори, зв'язки, сигнали) або фахівець / заклад.
import { Panel, Status } from '../../dashboard/src/ui.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';
import { COLORS, LevelPill, Meter } from './charts.jsx';
import { CASELOAD_NORM, COMPONENTS, FACTORS, KEY_IMPACT, SIGNALS } from './model.js';

const SEV = Object.fromEntries(SIGNALS.map(s => [s.id, s.severity]));

export function Profile({ ctx, p }) {
  const { T, f, base, model, select } = ctx;
  const s = model.sc(p.id);
  const hh = base.hhById.get(p.hh);
  const links = base.adj.get(p.id);
  const groups = [
    ['household', links.filter(x => x.type === 'household')],
    ['caredBy', links.filter(x => x.type === 'care' && !x.out)],
    ['cares', links.filter(x => x.type === 'care' && x.out)],
    ['family', links.filter(x => x.type === 'family')],
    ['support', links.filter(x => x.type === 'support')],
    ['services', links.filter(x => ['social', 'clinic', 'rehab'].includes(x.type))],
    ['duplicate', links.filter(x => x.type === 'duplicate')],
  ].filter(([, l]) => l.length);
  const factors = COMPONENTS.slice(0, 3).flatMap(k => FACTORS[k].filter(([id]) => p.factors[id]).map(([id, pts]) => ({ k, id, pts })));
  const sigs = model.signalsOf.get(p.id);
  const name = id => {
    const n = base.byId.get(id);
    return n.kind === 'person' ? `${n.id} · ${ctx.sexAge(n)}` : ctx.svcName(n);
  };
  return (
    <Panel className="profile">
      <div className="profile-head">
        <div>
          <span className="profile-kicker">{T.profile}</span>
          <h3>{p.id}</h3>
          <p className="muted">{ctx.sexAgeLong(p)} · {ctx.terrName(p.territory)}</p>
        </div>
        <button type="button" className="icon-btn" onClick={() => select(null)} aria-label={T.close}><Icon name="x" size={18} /></button>
      </div>
      {p.dupOf && <p className="dup-note"><Icon name="copy" size={14} />{T.dupNote.replace('{id}', p.dupOf)}</p>}
      <div className="profile-score">
        <span className="profile-big">{f.int(s.index)}</span>
        <span className="profile-score-meta">
          <LevelPill level={s.level} T={T} />
          <small>{T.rankOf.replace('{r}', f.int(s.rank)).replace('{n}', f.int(base.people.length))}</small>
        </span>
      </div>
      <div className="meters">
        {COMPONENTS.map(k => (
          <Meter key={k} value={p.sub[k]} color={COLORS[k]} label={T.comp[k]} valueText={f.int(p.sub[k])} />
        ))}
        <p className="meter-note">{T.weightsNow}: {COMPONENTS.map(k => `${T.compShort[k]} ${f.pct(model.w[k])}`).join(' · ')}</p>
      </div>

      {factors.length > 0 && (
        <div className="profile-block">
          <h4>{T.factorsTitle}</h4>
          <div className="chips">
            {factors.map(x => <span key={x.id} className="chip"><i style={{ background: COLORS[x.k] }} />{T.factors[x.id]}<b>+{x.pts}</b></span>)}
          </div>
        </div>
      )}

      <div className="profile-block">
        <h4>{T.networkTitle}</h4>
        <dl className="detail-list compact">
          <div><dt>{T.supportScore}</dt><dd>{f.int(p.support)} / 100</dd></div>
          <div><dt>{T.circle}</dt><dd>{f.int(p.circle)} {T.peopleWord(p.circle)}</dd></div>
          <div><dt>{T.informalTies}</dt><dd>{f.int(p.informalDegree)}</dd></div>
          <div><dt>{T.bridge}</dt><dd>{p.betweenness > 0 ? f.dec1(p.betweenness) : '0'}</dd></div>
        </dl>
        {p.cutImpact >= KEY_IMPACT && <p className="key-note"><Icon name="nodes" size={14} />{T.keyNote.replace('{n}', ctx.people(p.cutImpact))}</p>}
      </div>

      <div className="profile-block">
        <h4>{T.linksTitle}</h4>
        {!groups.length && <p className="muted small">{T.noLinks}</p>}
        {groups.map(([g, l]) => (
          <div key={g} className="link-group">
            <span className="link-group-name">{T.linkGroups[g]}</span>
            <div className="link-items">
              {l.map(x => (
                <button type="button" key={x.id + x.type} className="link-item" onClick={() => select(x.id, true)}>
                  {name(x.id)}{x.type === 'duplicate' && <em>{T.similarity} {f.pct(x.e.sim)}</em>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="muted small">{T.hhLine.replace('{id}', hh.id).replace('{n}', f.int(hh.members.length))}</p>
      </div>

      {sigs.length > 0 && (
        <div className="profile-block">
          <h4>{T.signalsTitle}</h4>
          <ul className="sig-mini">
            {sigs.map(id => (
              <li key={id}><Status level={SEV[id]} T={T} /><button type="button" className="link-btn" onClick={() => ctx.go('signals', { sig: id })}>{T.signals[id].title}</button></li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function ServiceProfile({ ctx, s }) {
  const { T, f, base, model, select } = ctx;
  const cases = s.cases.map(id => base.byId.get(id)).filter(n => n.kind === 'person')
    .sort((a, b) => model.sc(b.id).index - model.sc(a.id).index);
  const high = cases.filter(p => ['high', 'critical'].includes(model.sc(p.id).level)).length;
  const over = s.kind === 'sw' && s.load > CASELOAD_NORM;
  return (
    <Panel className="profile">
      <div className="profile-head">
        <div>
          <span className="profile-kicker">{T.kinds[s.kind]}</span>
          <h3>{ctx.svcName(s)}</h3>
          <p className="muted">{s.territory ? ctx.terrName(s.territory) : T.allTerr}{s.serves && s.serves.length > 1 ? ' · ' + T.servesAlso.replace('{t}', s.serves.slice(1).map(ctx.terrName).join(', ')) : ''}</p>
        </div>
        <button type="button" className="icon-btn" onClick={() => select(null)} aria-label={T.close}><Icon name="x" size={18} /></button>
      </div>
      <div className="profile-score">
        <span className="profile-big">{f.int(cases.length)}</span>
        <span className="profile-score-meta">
          <small>{s.kind === 'sw' ? T.casesWord : s.kind === 'clinic' ? T.declWord : T.referralsWord}</small>
          {s.kind === 'sw' && <Status level={over ? 'warning' : 'healthy'} T={T} />}
        </span>
      </div>
      <dl className="detail-list compact">
        {s.kind === 'sw' && <div><dt>{T.normLabel}</dt><dd>{f.int(CASELOAD_NORM)}</dd></div>}
        <div><dt>{T.highAmong}</dt><dd>{f.int(high)} · {f.pct(cases.length ? high / cases.length : 0)}</dd></div>
        {s.kind === 'clinic' && <div><dt>{T.chronicAmong}</dt><dd>{f.int(cases.filter(p => p.chronic >= 2).length)}</dd></div>}
        {s.kind === 'clinic' && <div><dt>{T.overdue}</dt><dd>{f.int(cases.filter(p => p.chronic >= 1 && (p.lastVisit == null || p.lastVisit > 12)).length)}</dd></div>}
        {s.kind === 'rehab' && <div><dt>{T.unmetRehab}</dt><dd>{f.int(model.sig.rehabGap.length)}</dd></div>}
      </dl>
      <div className="profile-block">
        <h4>{T.casesTitle}</h4>
        <div className="top-list">
          {cases.slice(0, 12).map(p => {
            const sc = model.sc(p.id);
            return (
              <button type="button" key={p.id} className="top-row" onClick={() => select(p.id, true)}>
                <span className="top-id"><strong>{p.id}</strong><small>{ctx.terrName(p.territory)} · {ctx.sexAge(p)}</small></span>
                <LevelPill level={sc.level} T={T} />
                <b className="top-val">{f.int(sc.index)}</b>
              </button>
            );
          })}
        </div>
        {cases.length > 12 && <p className="muted small">{T.andMore.replace('{n}', f.int(cases.length - 12))}</p>}
      </div>
    </Panel>
  );
}
