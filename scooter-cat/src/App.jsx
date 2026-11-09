// Сторінка гри «Котик на самокаті»: бічне меню, гра, «Як грати», «Чого вчить», заявка на практикум.
// Та сама збірка показує й сторінку рейтингу (data-view="rating"): таблицю, посилання й невеличку рекламу.
import { useEffect, useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { LEVEL_IDS, DIFF } from './levels.js';
import { CHAR_IDS, SCOPE_IDS } from './catalog.js';
import { loadPlayer, boardUrl } from './board.js';
import Leaderboard, { ShareButton } from './Leaderboard.jsx';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import GameView, { Diff } from './GameView.jsx';
import { track } from './track.js';

const NAV = [['game', 'gamepad'], ['how', 'book'], ['skills', 'check']];
const HOW_ICON = { gas: 'pedal-gas', lean: 'lean-fwd', points: 'target', laser: 'eye', cp: 'reset', board: 'trophy', hell: 'flame' };

// Сторінка рейтингу: група й герой з адреси (?s=…&c=…), підсвічений гравець за посиланням (?p=…)
function RatingMain({ T, lang, prefix, game, onLead }) {
  const R = T.rating, q = new URLSearchParams(location.search);
  const [scope, setScope] = useState(SCOPE_IDS.includes(q.get('s')) ? q.get('s') : 'all');
  const [char, setChar] = useState(CHAR_IDS.includes(q.get('c')) ? q.get('c') : null);
  const highlight = /^[0-9a-f]{20}$/.test(q.get('p') || '') ? q.get('p') : null;
  useEffect(() => {
    try { const u = new URL(location.href); u.searchParams.set('s', scope); u.searchParams.set('c', char || 'any'); history.replaceState(null, '', u); } catch { /* без адреси */ }
  }, [scope, char]);
  const pl = loadPlayer(), mine = pl.pid && Object.keys(pl.subs).some(k => k.startsWith(scope + ':') && (!char || k.endsWith(':' + char)));
  return (
    <>
      <section className="hero sc-hero">
        <div className="hero-text">
          <div className="kicker"><span className="ruby-dot" />{R.kicker}</div>
          <h1>{R.title}</h1>
          <p>{R.intro}</p>
          <div className="sc-hero-actions">
            <Button kind="primary" icon="play" href={game}>{R.play}</Button>
            <ShareButton T={T} url={boardUrl(prefix, scope, char, mine ? pl.pid : null)} track={track} />
          </div>
        </div>
      </section>
      <section id="sc-rating" className="sc-section glass sc-board-card">
        <Leaderboard T={T} lang={lang} prefix={prefix} scope={scope} char={char} onScope={setScope} onChar={setChar} big highlight={highlight} track={track} />
      </section>
      <section className="sc-section sc-rating-how">
        <div className="glass sc-how-card"><span className="sc-how-icon"><Icon name="trophy" size={18} /></span><h3>{R.how}</h3><p>{R.howText}</p></div>
        <div className="glass sc-how-card"><span className="sc-how-icon"><Icon name="share" size={18} /></span><h3>{R.shareTitle}</h3><p>{R.shareText}</p></div>
      </section>
      <section className="sc-section sc-ad glass" aria-label={R.adKicker}>
        <span className="sc-ad-kicker">{R.adKicker}</span>
        <h2 className="sc-h2">{R.adTitle}</h2>
        <p>{R.adText}</p>
        <div className="sc-actions">
          <Button kind="primary" icon="mail" onClick={() => onLead('rating')}>{R.adButton}</Button>
          <Button kind="ghost" href={prefix + '/business-intelligence/'}>{R.adLink}</Button>
        </div>
      </section>
    </>
  );
}

export default function App({ initialLang, base: assetBase, onSite, view = 'game' }) {
  const lang = initialLang, T = STRINGS[lang];
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [active, setActive] = useState('game');
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const site = onSite ? langPrefix : 'https://www.belyakovconsult.com' + langPrefix;
  const go = id => { setActive(id); setMenu(false); const el = document.getElementById('sc-' + id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' }); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search;
  };
  const openLead = where => { setLead(where); track('lead_open', { where }); };
  const gamePath = langPrefix + '/cases/scooter-cat/', ratingPath = langPrefix + '/cases/scooter-cat/rating/';
  const rating = view === 'rating';
  return (
    <div className="app motion">
      <div className="bg" aria-hidden="true"><div className="bg-wave" /><div className="bg-grid" /><div className="bg-glow g1" /><div className="bg-glow g2" /></div>
      <aside className={'sidebar glass' + (menu ? ' open' : '')} aria-label={T.navCaption}>
        <a className="side-brand" href={(site || '') + '/'} aria-label="Belyakov Consult">
          <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="102" height="52" />
          <span className="brand-name">Belyakov Consult</span>
          <span className="brand-caption">BI • Data Architecture • Data Governance</span>
        </a>
        <p className="nav-caption">{T.navCaption}</p>
        <nav>
          {rating ? (
            <a className="nav-item" href={gamePath}><Icon name="gamepad" size={18} /><span>{T.nav.game}</span></a>
          ) : NAV.map(([id, icon]) => (
            <a key={id} href={'#' + id} className={'nav-item' + (active === id ? ' active' : '')} onClick={e => { e.preventDefault(); go(id); }}>
              <Icon name={icon} size={18} /><span>{T.nav[id]}</span>
            </a>
          ))}
          <a className={'nav-item' + (rating ? ' active' : '')} href={ratingPath}><Icon name="trophy" size={18} /><span>{T.nav.rating}</span></a>
        </nav>
        <p className="nav-caption">{T.related}</p>
        <nav>
          <a className="nav-item" href={site + '/cases/chart-gallery/'}><Icon name="gallery" size={18} /><span>{T.gallery}</span></a>
          <a className="nav-item" href={site + '/cases/laser-kitty/'}><Icon name="kitty" size={18} /><span>{T.kitty}</span></a>
        </nav>
        <div className="side-cta">
          <span className="signal-line" />
          <strong>{T.ctaSide}</strong>
          <p>{T.ctaSideText}</p>
          <Button kind="primary" onClick={() => openLead('sidebar')}>{T.ctaSideButton}</Button>
        </div>
        <a className="side-back" href={site + '/cases/'}><Icon name="back" size={14} />belyakovconsult.com</a>
      </aside>
      {menu && <button type="button" className="scrim" aria-label={T.close} onClick={() => setMenu(false)} />}

      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label={T.menu} aria-expanded={menu}><Icon name="menu" size={20} /></button>
          <div className="topbar-right">
            <Segmented value={lang} onChange={switchLang} label={T.language} options={LANGS.map(l => ({ value: l.id, label: l.short }))} />
            <Button kind="primary" icon="mail" className="cta-top" onClick={() => openLead('topbar')}>{T.cta}</Button>
          </div>
        </header>

        {rating ? <RatingMain T={T} lang={lang} prefix={langPrefix} game={gamePath} onLead={openLead} /> : (<>
        <section className="hero sc-hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.title}</h1>
            <p>{T.intro}</p>
          </div>
        </section>

        <section id="sc-game" className="sc-section">
          <GameView T={T} lang={lang} onLead={openLead} track={track} />
        </section>

        <section id="sc-how" className="sc-section">
          <h2 className="sc-h2">{T.how.title}</h2>
          <div className="sc-how">
            {T.how.items.map(([k, h, p]) => (
              <div key={k} className="glass sc-how-card"><span className="sc-how-icon"><Icon name={HOW_ICON[k]} size={18} /></span><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
          <p className="sc-extra muted">{T.how.extra}</p>
        </section>

        <section id="sc-skills" className="sc-section">
          <h2 className="sc-h2">{T.skillsTitle}</h2>
          <p className="sc-extra muted">{T.skillsLead}</p>
          <div className="sc-levels">
            {LEVEL_IDS.map((id, k) => {
              const l = T.levels[id];
              return (
                <article key={id} className="glass sc-level-card">
                  <span className="sc-level">{T.ui.brief(k + 1)} · <span className={'sc-diff d' + DIFF[id]}><Diff d={DIFF[id]} />{T.ui.diff[DIFF[id]]}</span></span>
                  <h3>{l.title}</h3>
                  <p className="sc-level-chart">{T.chart[id]}</p>
                  <p>{l.brief}</p>
                  <strong className="sc-level-lesson">{l.lessonTitle}</strong>
                  <div className="sc-tip small"><Icon name="info" size={14} /><p>{l.tip}</p></div>
                </article>
              );
            })}
          </div>
        </section>
        </>)}

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote}</p>
          <div className="foot-actions"><Button kind="primary" onClick={() => openLead('footer')}>{T.ctaLong}</Button></div>
        </footer>
      </main>
      {lead && <LeadModal T={T} lang={lang} where={lead} source="scooter-cat" onClose={() => setLead(null)} onSent={() => track('lead_sent', { where: lead })} />}
    </div>
  );
}
