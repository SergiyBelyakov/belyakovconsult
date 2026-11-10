// Сторінка гри «Котячий джекпот»: бічне меню, автомат із дослідами, «Як грати», «Чого вчить», заявка на практикум.
import { useState } from 'react';
import { LANGS, STRINGS } from './i18n.js';
import { LESSON_IDS, facts } from './lessons.js';
import { Icon } from '../../dashboard/src/icons.jsx';
import { Button, Segmented } from '../../dashboard/src/ui.jsx';
import { LeadModal } from '../../dashboard/src/lead.jsx';
import GameView from './GameView.jsx';
import { track } from './track.js';

const NAV = [['game', 'slot'], ['how', 'book'], ['skills', 'check']];
const HOW_ICON = { spin: 'slot', pay: 'coins', bugs: 'bug', boss: 'glasses', lab: 'flask', free: 'shield' };
const val = (v, f) => (typeof v === 'function' ? v(f) : v);

export default function App({ initialLang, base: assetBase, onSite }) {
  const lang = initialLang, T = STRINGS[lang], f = facts();
  const [menu, setMenu] = useState(false);
  const [lead, setLead] = useState(null);
  const [active, setActive] = useState('game');
  const langPrefix = LANGS.find(l => l.id === lang).prefix;
  const site = onSite ? langPrefix : 'https://www.belyakovconsult.com' + langPrefix;
  const go = id => { setActive(id); setMenu(false); const el = document.getElementById('jc-' + id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' }); };
  const switchLang = id => {
    if (id === lang) return;
    const cur = LANGS.find(l => l.id === lang).prefix;
    const path = cur && location.pathname.startsWith(cur + '/') ? location.pathname.slice(cur.length) : location.pathname;
    location.href = LANGS.find(l => l.id === id).prefix + path + location.search;
  };
  const openLead = where => { setLead(where); track('lead_open', { where }); };
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
          {NAV.map(([id, icon]) => (
            <a key={id} href={'#' + id} className={'nav-item' + (active === id ? ' active' : '')} onClick={e => { e.preventDefault(); go(id); }}>
              <Icon name={icon} size={18} /><span>{T.nav[id]}</span>
            </a>
          ))}
        </nav>
        <p className="nav-caption">{T.related}</p>
        <nav>
          <a className="nav-item" href={site + '/cases/chart-gallery/'}><Icon name="gallery" size={18} /><span>{T.gallery}</span></a>
          <a className="nav-item" href={site + '/cases/laser-kitty/'}><Icon name="kitty" size={18} /><span>{T.kitty}</span></a>
          <a className="nav-item" href={site + '/cases/scooter-cat/'}><Icon name="scooter" size={18} /><span>{T.scooter}</span></a>
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

        <section className="hero jc-hero">
          <div className="hero-text">
            <div className="kicker"><span className="ruby-dot" />{T.kicker}<span className="demo-badge">{T.demo}</span></div>
            <h1>{T.title}</h1>
            <p>{T.intro}</p>
          </div>
        </section>

        <section id="jc-game" className="jc-section">
          <GameView T={T} lang={lang} onLead={openLead} track={track} assetBase={assetBase} />
        </section>

        <section id="jc-how" className="jc-section">
          <h2 className="jc-h2">{T.how.title}</h2>
          <div className="jc-how">
            {T.how.items.map(([k, h, p]) => (
              <div key={k} className="glass jc-how-card"><span className="jc-how-icon"><Icon name={HOW_ICON[k]} size={18} /></span><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
          <p className="jc-extra muted">{T.how.extra}</p>
        </section>

        <section id="jc-skills" className="jc-section">
          <h2 className="jc-h2">{T.skillsTitle}</h2>
          <p className="jc-extra muted">{T.skillsLead}</p>
          <div className="jc-levels">
            {LESSON_IDS.map((id, k) => {
              const l = T.lessons[id];
              return (
                <article key={id} className="glass jc-level-card">
                  <span className="jc-step">{T.lab.n(k + 1, LESSON_IDS.length)} · {l.name}</span>
                  <h3>{l.title}</h3>
                  <p>{val(l.card, f)}</p>
                  <div className="jc-tip small"><Icon name="info" size={14} /><p>{val(l.excel, f)}</p></div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="footer">
          <div className="foot-brand">
            <img src={assetBase + 'img/bc-negative.png'} alt="BC." width="64" height="33" />
            <div><strong>Belyakov Consult</strong><span>{T.foot}</span></div>
          </div>
          <p>{T.dataNote}</p>
          <div className="foot-actions"><Button kind="primary" onClick={() => openLead('footer')}>{T.ctaLong}</Button></div>
        </footer>
      </main>
      {lead && <LeadModal T={T} lang={lang} where={lead} source="jackpot-cat" onClose={() => setLead(null)} onSent={() => track('lead_sent', { where: lead })} />}
    </div>
  );
}
