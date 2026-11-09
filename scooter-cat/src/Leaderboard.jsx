// Рейтинг гравців: таблиця за групою рівнів і героєм, аватари героїв, форма ніка після проходження групи,
// кнопка «Поділитися». Таблиця й форма працюють і без сервера: тоді видно власні результати з цього браузера.
import { useEffect, useRef, useState } from 'react';
import { CHAR_IDS, SCOPE_IDS, SCOPES, cleanNick } from './catalog.js';
import { fetchBoard, boardUrl, loadPlayer, savePlayer, loadProgress, scopeStatus, subOf, submitScopes, flushPending } from './board.js';
import { drawAvatar } from './riders.js';
import { Icon } from '../../dashboard/src/icons.jsx';

export function Avatar({ char, size = 28 }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) drawAvatar(ref.current, char); }, [char, size]);
  return <canvas ref={ref} className="sc-ava" style={{ width: size, height: size }} aria-hidden="true" />;
}

// поділитися: системне меню на телефоні, інакше копія посилання
export function ShareButton({ T, url, kind = 'ghost', track }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    track && track('board_share', {});
    try { if (navigator.share) { await navigator.share({ title: T.board.shareText, url }); return; } } catch { /* скасовано */ }
    try { await navigator.clipboard.writeText(url); } catch {
      const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* немає доступу */ } t.remove();
    }
    setDone(true); setTimeout(() => setDone(false), 2200);
  };
  return <button type="button" className={'btn btn-' + kind} onClick={share}><Icon name="share" size={16} /><span>{done ? T.board.copied : T.board.share}</span></button>;
}

export default function Leaderboard({ T, lang, prefix, scope, char, onScope, onChar, big = false, highlight = null, track }) {
  const B = T.board, F = T.fmt;
  const [pl] = useState(() => loadPlayer());
  const [data, setData] = useState({ status: 'loading' });
  const who = highlight || pl.pid;
  useEffect(() => {
    let alive = true;
    setData(d => ({ ...d, status: 'loading' }));
    (async () => {
      await flushPending(pl, loadProgress(), lang).catch(() => null);   // спершу дослати те, що чекало
      const j = await fetchBoard(scope, char, who || pl.pid, big ? 50 : 15);
      if (alive) setData(j.ok ? { status: 'ok', ...j } : { status: j.error === 'storage' || j.error === 'offline' ? 'offline' : 'error' });
    })();
    return () => { alive = false; };
  }, [scope, char]);

  const maxStars = 3 * SCOPES[scope].length;
  const mark = highlight && highlight !== pl.pid ? B.shared : B.you;
  const row = (r, k) => (
    <li key={k} className={'sc-row' + (r.me ? ' me' : '') + (r.rank <= 3 ? ' top' + r.rank : '') + (r.wait ? ' wait' : '')}>
      <span className="sc-rank">{r.rank || '·'}</span>
      <Avatar char={r.char} size={big ? 34 : 30} />
      <span className="sc-nick"><b>{r.nick}</b><small>{T.chars[r.char].short}{r.calm ? ' · ' + B.calm : ''}</small>{r.me && <em>{mark}</em>}{r.wait && <em className="wait">{B.waiting}</em>}</span>
      <span className="sc-rstars" title={B.stars}>★ {r.stars}/{maxStars}</span>
      <span className="sc-total" title={B.time}>{F.time(r.total)}</span>
    </li>
  );
  // власні результати цього браузера (коли сервер недоступний)
  const prog = loadProgress();
  const local = (char ? [char] : CHAR_IDS).map(c => ({ c, st: scopeStatus(prog, c, scope) })).filter(x => x.st.complete)
    .map(({ c, st }) => ({ rank: 0, nick: pl.nick || B.noNick, char: c, total: st.total, stars: st.stars, calm: st.calm, me: true, wait: !!(subOf(pl, scope, c) || {}).pending })).sort((a, b) => a.total - b.total);
  const inTop = data.status === 'ok' && data.rows.some(r => r.me);

  return (
    <div className={'sc-board' + (big ? ' big' : '')}>
      <div className="sc-tabs" role="tablist" aria-label={B.title}>
        {SCOPE_IDS.map(s => <button key={s} type="button" role="tab" aria-selected={s === scope} className={'sc-tab' + (s === scope ? ' on' : '')} onClick={() => onScope(s)}>{B.scopes[s]}</button>)}
      </div>
      <div className="sc-chips" role="group" aria-label={T.ui.chooseChar}>
        <button type="button" className={'sc-chip' + (!char ? ' on' : '')} aria-pressed={!char} onClick={() => onChar(null)}><span className="sc-chip-all"><Icon name="trophy" size={14} /></span>{B.allChars}</button>
        {CHAR_IDS.map(c => <button key={c} type="button" className={'sc-chip' + (char === c ? ' on' : '')} aria-pressed={char === c} onClick={() => onChar(c)}><Avatar char={c} size={22} />{T.chars[c].short}</button>)}
      </div>
      <div className="sc-board-cols" aria-hidden="true"><span>{B.place}</span><span /><span>{B.player}</span><span>{B.stars}</span><span>{B.time}</span></div>
      {data.status === 'loading' && <p className="sc-board-note muted">{B.loading}</p>}
      {data.status === 'ok' && (data.rows.length ? <ol className="sc-rows">{data.rows.map(row)}</ol> : <p className="sc-board-note muted">{B.empty}</p>)}
      {data.status === 'ok' && data.me && !inTop && (
        <ol className="sc-rows sc-rows-me"><li className="sc-gap" aria-hidden="true">⋯</li>{row({ ...data.me, me: true }, 'me')}</ol>
      )}
      {data.status === 'ok' && <p className="sc-board-note muted">{B.players(data.count)}{data.me ? ' · ' + (highlight && highlight !== pl.pid ? B.sharedMine : B.mine)(data.me.rank, data.me.count, F.time(data.me.total)) : ''}</p>}
      {(data.status === 'offline' || data.status === 'error') && (
        <>
          <p className="sc-board-note">{data.status === 'offline' ? B.offline : B.error}</p>
          {local.length > 0 && <><p className="sc-board-sub muted">{B.local}</p><ol className="sc-rows">{local.map(row)}</ol></>}
        </>
      )}
    </div>
  );
}

// Форма ніка після проходження групи; з уже вписаним ніком результат іде в рейтинг сам
export function BoardSubmit({ T, lang, char, statuses, onOpen, track, prev = null, onResult }) {
  const B = T.board, F = T.fmt;
  const [pl] = useState(() => loadPlayer());
  const [nick, setNick] = useState(pl.nick || '');
  const [edit, setEdit] = useState(!pl.nick && !prev);
  const after = r => (r.ok ? 'done' : ['storage', 'offline', 'server'].includes(r.error) ? 'saved' : r.error === 'rate' ? 'rate' : 'bad');
  const [state, setState] = useState(prev ? after(prev) : pl.nick ? 'sending' : 'form');
  const [err, setErr] = useState('');
  const [res, setRes] = useState(prev);
  const send = async n => {
    const c = cleanNick(n);
    if (!c.ok) { setErr(B.nickBad[c.why] || B.nickBad.word); return; }
    setErr(''); pl.nick = c.nick; savePlayer(pl); setNick(c.nick); setEdit(false); setState('sending');
    const r = await submitScopes(pl, char, statuses, lang);
    track && track('board_submit', { char, scopes: statuses.map(s => s.scope).join(','), ok: !!r.ok });
    setRes(r);
    if (r.error === 'nick') { setErr(B.nickBad[r.why] || B.nickBad.word); setEdit(true); setState('form'); return; }
    setState(after(r)); onResult && onResult(r);
  };
  useEffect(() => { if (pl.nick && !prev) send(pl.nick); }, []);
  const first = statuses[statuses.length - 1].scope;
  return (
    <div className="sc-submit">
      <div className="sc-submit-head">
        <Icon name="trophy" size={20} />
        <div>{statuses.map(s => <strong key={s.scope}>{B.scopeDone[s.scope]}: {F.time(s.total)} <span className="sc-rstars">★ {s.stars}/{3 * s.n}</span></strong>)}</div>
      </div>
      {edit ? (
        <form className="sc-nick-form" onSubmit={e => { e.preventDefault(); send(nick); }}>
          <label htmlFor="sc-nick">{B.nickTitle}</label>
          <div className="sc-nick-row">
            <input id="sc-nick" value={nick} onChange={e => { setNick(e.target.value); setErr(''); }} maxLength={24} placeholder={B.nickPh} autoComplete="nickname" autoFocus spellCheck="false" />
            <button type="submit" className="btn btn-primary" disabled={state === 'sending'}>{state === 'sending' ? B.sending : B.send}</button>
          </div>
          <small className={err ? 'sc-nick-err' : 'muted'}>{err || B.nickHint}</small>
        </form>
      ) : (
        <div className="sc-submit-res">
          {state === 'sending' && <p className="muted">{B.sending}</p>}
          {state === 'done' && res && res.results.map(r => (
            <p key={r.scope}>{r.hidden ? B.hiddenRes : B.result(B.scopes[r.scope], T.chars[char].short, r.rank, r.count, r.rankAll, r.countAll)}</p>
          ))}
          {state === 'saved' && <p>{B.saved}</p>}
          {state === 'rate' && <p>{B.rate}</p>}
          {state === 'bad' && <p>{B.bad}</p>}
          <div className="sc-submit-actions">
            <button type="button" className="btn btn-ghost" onClick={() => onOpen(first)}><Icon name="trophy" size={16} /><span>{B.open}</span></button>
            <button type="button" className="btn btn-ghost sc-link" onClick={() => setEdit(true)}>{B.changeNick}: {pl.nick}</button>
          </div>
          {state === 'done' && <small className="muted">{B.auto}</small>}
        </div>
      )}
    </div>
  );
}
