import { Panel, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { DIMS, NALL, RELATED, answeredCount, gapShown } from '../model.js';
import { DIM_ICON } from '../icons.js';
import { Radar, RadarLegend, DimBars, Stairs } from '../charts.jsx';

export function NotDone({ ctx }) {
  const { T, mine, begin, openSample } = ctx;
  const n = answeredCount(mine);
  return (
    <Panel className="mt-notdone flat-panel">
      <span className="mt-dim-icon big"><Icon name="radar" size={26} /></span>
      <h3>{T.notDoneTitle}</h3>
      <p>{T.notDoneText(n, NALL)}</p>
      <div className="mt-live-n wide"><span className="mt-progress-track"><span style={{ width: (n / NALL) * 100 + '%' }} /></span><small>{T.progressOf(n, NALL)}</small></div>
      <div className="mt-notdone-actions">
        <Button kind="primary" icon={n ? 'play' : 'arrowRight'} onClick={begin}>{n ? T.continueBtn : T.startBtn}</Button>
        {['community', 'business', 'ngo'].map(id => <Button key={id} icon="eye" onClick={() => openSample(id)}>{T.samples[id]}</Button>)}
      </div>
    </Panel>
  );
}

export function ModeBanner({ ctx }) {
  const { T, shown, sample, own, navigate, adoptLink } = ctx;
  if (shown.kind === 'mine') return null;
  return (
    <div className="mt-banner glass-control" role="status">
      <Icon name={sample ? 'flask' : 'link'} size={17} />
      <span>{sample ? T.sampleBanner(T.samples[sample]) : T.linkBanner}</span>
      <div className="mt-banner-actions">
        {!sample && <Button icon="save" onClick={adoptLink}>{T.linkAdopt}</Button>}
        <Button kind="primary" icon="arrowRight" onClick={() => { own(); navigate('start'); }}>{T.sampleStart}</Button>
      </div>
    </div>
  );
}

export default function Results({ ctx }) {
  const { T, f, S, pr, anti, warn, strong, shown, complete, hl, setHl, pdf, share, busy, goStep, navigate, openLead, langPrefix, onSite } = ctx;
  if (!complete) return <><ModeBanner ctx={ctx} /><NotDone ctx={ctx} /></>;
  const L = T.levels[S.level - 1];
  const orgName = T.orgsShort[shown.org];
  const site = onSite ? langPrefix : 'https://www.belyakovconsult.com' + langPrefix;
  const editDim = d => (shown.kind === 'mine' ? goStep(DIMS.indexOf(d)) : setHl(d));
  const rel = [];
  pr.forEach(p => {
    const r = RELATED[p.id];
    const push = (kind, slug, href) => { if (!rel.some(x => x.href === href)) rel.push({ kind, slug, href, dim: p.id }); };
    if (r.demo) push('demo', r.demo, r.demo === 'data-journey' ? `${site}/data-journey/` : `${site}/cases/${r.demo}/`);
    if (r.game) push('game', r.game, `${site}/cases/${r.game}/`);
    push('service', r.service, `${site}/${r.service}/`);
  });

  return (
    <>
      <ModeBanner ctx={ctx} />
      <section className="mt-level glass">
        <div className="mt-level-art">
          <Stairs level={S.level} tLevel={S.tLevel} T={T} />
          <div className="legend-row mt-legend small">
            <span><i className="lg-here" />{T.youAreHere}</span>
            <span><i className="lg-flag" />{T.targetFor(orgName)}</span>
          </div>
        </div>
        <div className="mt-level-text">
          <span className="profile-kicker"><i className="kick-dot" />{T.levelKicker(S.level)}</span>
          <h2>{L.name}</h2>
          <p>{L.text}</p>
          <p className="mt-next"><Icon name="flag" size={16} /><span>{L.next}</span></p>
          <div className="mt-stats">
            <span><b>{f.int(S.index)}</b><small>{T.indexWord}, {T.ofHundred}</small></span>
            <span><b>{f.dec1(S.avg)}</b><small>{T.avgWord}, {T.ofFive}</small></span>
            <span><b>{f.dec1(S.tAvg)}</b><small>{T.targetFor(orgName)}</small></span>
            {S.unknown > 0 && <span><b>{f.int(S.unknown)}</b><small>{T.unknownWord}</small></span>}
          </div>
          <div className="mt-level-actions">
            <Button kind="primary" icon="pdf" onClick={pdf} disabled={busy}>{busy ? T.pdfBusy : T.pdf}</Button>
            <Button icon="link" onClick={share}>{T.share}</Button>
            {shown.kind === 'mine' && <Button icon="listCheck" onClick={() => goStep(0)}>{T.edit}</Button>}
          </div>
        </div>
      </section>

      {warn.length > 0 && (
        <div className="mt-warns">
          {warn.map(w => (
            <div key={w} className={'mt-warn glass' + (w === 'security' ? ' crit' : '')}>
              <Icon name="warning" size={18} />
              <div><strong>{T.warn[w].title}</strong><p>{T.warn[w].text}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid mt-charts">
        <Panel title={T.radarTitle} sub={T.radarSub(orgName)}>
          <Radar S={S} T={T} f={f} hl={hl} setHl={setHl} label={T.radarTitle} onPick={editDim} />
          <RadarLegend T={T} />
        </Panel>
        <Panel title={T.barsTitle} sub={T.barsSub}>
          <DimBars S={S} T={T} f={f} hl={hl} setHl={setHl} onPick={editDim} />
          {shown.kind === 'mine' && <p className="note"><Icon name="info" size={15} /><span>{T.barsHint}</span></p>}
        </Panel>
      </div>

      <Panel title={T.prioTitle} sub={T.prioSub} className="flat-panel"
        aside={<Button icon="route" onClick={() => navigate('roadmap')}>{T.toRoadmap}</Button>}>
        <div className="mt-prio">
          {pr.map((p, i) => {
            const x = S.dims[p.id];
            return (
              <article key={p.id} className="mt-prio-card" style={{ animationDelay: i * 0.08 + 's' }} onMouseEnter={() => setHl(p.id)} onMouseLeave={() => setHl(null)}>
                <div className="mt-prio-top">
                  <span className="mt-prio-rank">{f.int(i + 1)}</span>
                  <span className="mt-dim-icon"><Icon name={DIM_ICON[p.id]} size={19} /></span>
                  <h4>{T.dims[p.id].name}</h4>
                </div>
                <div className="mt-trans">
                  <span><small>{T.stepNow}</small><b>{f.int(p.from)} · {T.levels[p.from - 1].name}</b></span>
                  <Icon name="arrowRight" size={16} />
                  <span><small>{T.stepNext}</small><b>{f.int(p.to)} · {T.levels[p.to - 1].name}</b></span>
                </div>
                <p>{p.why.includes('grow') ? T.dims[p.id].strong : T.dims[p.id].weak}</p>
                <div className="chips">
                  {p.why.map(w => <span key={w} className={'tag' + (w === 'risk' || w === 'bottleneck' ? ' warn' : '')}>{T.why[w](f.dec1(gapShown(x)))}</span>)}
                </div>
                <p className="mt-prio-first"><b>{T.firstStep}</b> {T.dims[p.id].act[p.from][0]}</p>
              </article>
            );
          })}
        </div>
      </Panel>

      <div className="grid mt-two">
        <Panel title={T.strongTitle}>
          <ul className="mt-list">
            {strong.map(d => {
              const x = S.dims[d];
              const above = x.avg >= x.target - 0.05;
              return (
                <li key={d}>
                  <span className="mt-dim-icon"><Icon name={DIM_ICON[d]} size={18} /></span>
                  <div><strong>{T.dims[d].name} <span className={'status ' + (above ? 'healthy' : 'info')}>{above ? T.strongAbove : T.strongRel}</span></strong><p>{T.dims[d].strong}</p></div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title={T.antiTitle}>
          {anti.length ? (
            <ul className="mt-list anti">
              {anti.map(a => <li key={a}><span className="mt-stop"><Icon name="stop" size={18} /></span><p>{T.anti[a]}</p></li>)}
            </ul>
          ) : <p className="muted">{T.antiNone}</p>}
        </Panel>
      </div>

      <Panel title={T.relTitle} sub={T.relSub} className="flat-panel">
        <div className="mt-rel">
          {rel.map(r => (
            <a key={r.href} className="mt-rel-card" href={r.href}>
              <span className="mt-rel-kind">{T.relKind[r.kind]} · {T.dims[r.dim].short}</span>
              <strong>{r.kind === 'service' ? T.serviceNames[r.slug] : T.demoNames[r.slug]}</strong>
              <Icon name="arrowRight" size={16} />
            </a>
          ))}
        </div>
      </Panel>

      <Panel className="cta-card flat-panel">
        <h3>{T.ctaTitle}</h3>
        <p>{T.ctaText}</p>
        <Button kind="primary" icon="mail" onClick={() => openLead('results')}>{T.ctaBtn}</Button>
      </Panel>
    </>
  );
}
