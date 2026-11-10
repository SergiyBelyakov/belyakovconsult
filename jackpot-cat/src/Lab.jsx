// Панель поруч з автоматом: досліди (прогноз, завдання, розбір), математика за задньою кришкою і журнал.
import { Icon } from '../../dashboard/src/icons.jsx';
import { LESSON_IDS, LESSONS, correct, facts, progress, RTP_AXIS, NET_AXIS } from './lessons.js';
import { MACHINES } from './engine.js';
import { Hist, Bars, Survival, JournalChart } from './charts.jsx';
import { MathPanel, ComboIcons } from './Cabinet.jsx';

const TABS = [['lab', 'flask'], ['math', 'sigma'], ['journal', 'journal']];
const val = (v, f) => (typeof v === 'function' ? v(f) : v);

// Графік до розбору кожного досліду
function DebriefChart({ id, d, T, F, icons }) {
  const C = T.ch;
  if (id === 'ev') {
    const max = Math.max(...d.rows.map(r => r.contrib));
    return (
      <div className="jc-contrib">
        {d.rows.map(r => (
          <div key={r.key} className="jc-contrib-row">
            <ComboIcons k={r.key} icons={icons} size={20} /><span className="jc-contrib-odds">{T.math.odds(Math.round(1 / r.p))} · ×{r.pay}</span>
            <span className="jc-td-bar"><i style={{ width: `${(r.contrib / max) * 100}%` }} /><b>{F.n(r.contrib * 100, 1)}</b></span>
          </div>
        ))}
        <div className="jc-contrib-row total"><span>{T.math.total}</span><b>{F.n(d.rtp, 1)}</b></div>
        <div className="jc-contrib-row total edge"><span>{T.math.edge}</span><b>{F.n(d.edge, 1)}</b></div>
      </div>
    );
  }
  if (id === 'sample') {
    return (
      <div className="jc-multiples">
        {d.sets.map((s, k) => (
          <div key={s.n} className="jc-multi">
            <div className="jc-multi-head"><strong>{C.spins(s.n)}</strong><span>{C.plus(s.plus)} · {C.range(F.pct(s.p10), F.pct(s.p90))}</span></div>
            <Hist bins={s.bins} axis={RTP_AXIS} ticks={[0, 50, 100, 150, 200, 250]} fmt={v => F.pct(v)} height={k ? 104 : 124} label={`${C.spins(s.n)}: ${C.rtpAxis}`}
              refLine={{ x: d.rtp, label: k ? '' : `${C.table} ${F.pct(d.rtp, 1)}` }} mark={k ? null : { x: d.pct, label: `${C.you}: ${F.pct(d.pct)}` }}
              tip={(a, b, n, first, last) => (last ? `${C.more(F.pct(a))}: ${F.n(n)}` : C.bin(F.pct(a), F.pct(b), n))} caption={k === d.sets.length - 1 ? C.rtpAxis : ' '} />
          </div>
        ))}
      </div>
    );
  }
  if (id === 'memory') return <Bars title={C.winShare} max={Math.max(d.all, d.after) * 1.6} rows={[{ name: C.overall, v: d.all, text: F.pct(d.all, 1) }, { name: C.streak, v: d.after, text: F.pct(d.after, 1) }]} />;
  if (id === 'near') return <Bars title={C.spinShare} max={Math.max(60, d.screen * 1.15)} rows={[{ name: C.line, v: d.line, text: F.pct(d.line, 1) }, { name: C.screen, v: d.screen, text: F.pct(d.screen) }]} />;
  if (id === 'risk') {
    return (
      <div className="jc-multiples">
        {['capy', 'cat'].map((m, k) => {
          const s = d.sim[m];
          return (
            <div key={m} className="jc-multi">
              <div className="jc-multi-head"><strong><img src={icons[m === 'cat' ? 0 : 1]} width="20" height="20" alt="" />{T.machines[m].name}</strong><span>{C.range(F.signed(s.p10), F.signed(s.p90))} · {C.lose(s.lose, d.loss)}</span></div>
              <Hist bins={s.bins} axis={NET_AXIS} ticks={[-80, -40, 0, 40, 80, 120]} fmt={v => F.signed(v)} height={k ? 104 : 124} label={`${T.machines[m].name}: ${C.netAxis}`}
                refLine={{ x: d.mean, label: k ? '' : `${C.table} ${F.signed(d.mean)}` }}
                tip={(a, b, n, first, last) => (last ? `${C.more(F.signed(a))}: ${F.n(n)}` : first ? `${C.less(F.signed(b))}: ${F.n(n)}` : C.bin(F.signed(a), F.signed(b), n))} caption={k ? C.netAxis : ' '} />
            </div>
          );
        })}
      </div>
    );
  }
  return <Survival p={d.p} you={d.at} T={T} F={F} />;
}

function LessonList({ T, save, current, onStart }) {
  return (
    <ol className="jc-lessons">
      {LESSON_IDS.map((id, k) => {
        const done = save.done[id];
        return (
          <li key={id} className={(done ? 'done' : '') + (k === current ? ' cur' : '')}>
            <button type="button" onClick={() => onStart(k)}>
              <span className="jc-lesson-n">{k + 1}</span>
              <span className="jc-lesson-name">{T.lessons[id].name}</span>
              {done && <span className={'jc-lesson-st ' + (done.ok ? 'ok' : 'no')} title={done.ok ? T.lab.right : T.lab.wrong}><Icon name={done.ok ? 'check' : 'x'} size={13} /><em>{done.ok ? T.lab.doneOk : T.lab.doneNo}</em></span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default function Lab({ T, F, tab, onTab, ls, save, slot, tick, icons, shown, turbo, onStart, onPick, onNext, onFree, onRetry, onOpenBack, onTurbo, onLead }) {
  const L = T.lab, f = facts();
  const nextIdx = LESSON_IDS.findIndex(id => !save.done[id]);
  const body = () => {
    if (ls.mode === 'lesson') {
      const id = LESSON_IDS[ls.idx], X = T.lessons[id], head = <><span className="jc-step">{L.n(ls.idx + 1, LESSON_IDS.length)}</span><h3>{X.name}</h3></>;
      const opts = X.options(f);
      if (ls.phase === 'predict') {
        return (
          <div className="jc-pane">
            {head}
            <p className="jc-task"><Icon name="target" size={16} /><span>{X.task}</span></p>
            <p className="jc-q">{X.q(f)}</p>
            <div className="jc-options" role="group" aria-label={L.predict}>
              {opts.map((o, k) => <button key={k} type="button" className="jc-option" onClick={() => onPick(k)}><span>{String.fromCharCode(65 + k)}</span>{o}</button>)}
            </div>
            <p className="muted small">{L.predictHint}</p>
          </div>
        );
      }
      if (ls.phase === 'play') {
        const p = ls.prog || { now: 0, of: LESSONS[id].spins || 0 };
        const label = id === 'memory' ? (p.armed ? L.memoryArmed : L.memory(p.now, p.of)) : id === 'risk' ? L.risk(p.capy || 0, p.cat || 0, LESSONS.risk.each) : id === 'boss' ? T.msg.turbo(p.now, 0) : L.progress(p.now, p.of);
        return (
          <div className="jc-pane">
            {head}
            <p className="jc-task"><Icon name="target" size={16} /><span>{X.task}</span></p>
            {id === 'boss' ? (
              <div className="jc-turbo">
                <button type="button" className="btn btn-primary jc-big" onClick={onTurbo} disabled={turbo}><Icon name="play" size={18} /><span>{turbo ? L.bossRunning : L.bossBtn}</span></button>
                <p className="muted small">{L.bossHint}</p>
              </div>
            ) : (
              <div className="jc-progress" role="progressbar" aria-valuemin="0" aria-valuemax={p.of} aria-valuenow={p.now} aria-label={label}><i style={{ width: `${p.of ? (p.now / p.of) * 100 : 0}%` }} /></div>
            )}
            <p className="jc-progress-label">{label}</p>
            {p.live && id !== 'boss' && <p className="jc-live">{L.live(p.live)}{id === 'near' ? ` · ${L.liveNear(p.live.nears)}` : ''}</p>}
            <p className="jc-picked"><span>{L.pick}:</span> {opts[ls.pick]}</p>
          </div>
        );
      }
      // розбір
      const ok = ls.pick === correct(id), d = ls.d, last = ls.idx === LESSON_IDS.length - 1;
      return (
        <div className="jc-pane jc-debrief">
          <span className="jc-step">{L.n(ls.idx + 1, LESSON_IDS.length)} · {X.name}</span>
          <div className={'jc-verdict ' + (ok ? 'ok' : 'no')}>
            <Icon name={ok ? 'check' : 'x'} size={18} />
            <div><strong>{ok ? L.right : L.wrong}</strong><span>{ok ? `${L.pick}: ${opts[ls.pick]}` : `${L.answer}: ${opts[correct(id)]}`}</span></div>
          </div>
          <h3 className="jc-lesson-title">{X.title}</h3>
          <h4>{L.you}</h4><p>{X.you(d)}</p>
          <DebriefChart id={id} d={d} T={T} F={F} icons={icons} />
          <h4>{L.why}</h4><p>{X.why(d)}</p>
          <h4>{L.biz}</h4><p>{X.biz}</p>
          <div className="jc-tip"><Icon name="info" size={16} /><div><strong>{L.excel}</strong><p>{val(X.excel, f)}</p></div></div>
          {id === 'ev' && <p className="jc-opened"><Icon name="lockOpen" size={15} />{L.backOpened}</p>}
          <div className="jc-actions">
            <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>{last ? L.finish : L.next}</button>
            <button type="button" className="btn btn-ghost" onClick={() => onRetry(ls.idx)}>{L.retry}</button>
            <button type="button" className="btn btn-ghost" onClick={onFree}>{L.toFree}</button>
          </div>
        </div>
      );
    }
    if (ls.mode === 'final') {
      const ok = LESSON_IDS.filter(id => save.done[id] && save.done[id].ok).length, v = slot.v;
      return (
        <div className="jc-pane jc-final">
          <h3>{T.final.title}</h3>
          <p>{T.final.text(ok, { spins: v.spins, wagered: v.wagered, paid: v.paid, take: slot.take })}</p>
          <p className="jc-punch">{T.final.punch}</p>
          <LessonList T={T} save={save} current={-1} onStart={onStart} />
          <div className="jc-actions">
            <button type="button" className="btn btn-primary" onClick={() => onLead('final')}><Icon name="mail" size={16} /><span>{T.final.cta}</span></button>
            <button type="button" className="btn btn-ghost" onClick={onFree}>{T.final.free}</button>
          </div>
        </div>
      );
    }
    const free = ls.mode === 'free';
    return (
      <div className="jc-pane">
        <h3>{free ? L.freeTitle : L.introTitle}</h3>
        <p>{free ? L.freeText : L.introText}</p>
        <LessonList T={T} save={save} current={nextIdx} onStart={onStart} />
        <div className="jc-actions">
          <button type="button" className="btn btn-primary jc-big" onClick={() => onStart(nextIdx < 0 ? 0 : nextIdx)}><Icon name="flask" size={18} /><span>{nextIdx < 0 ? L.again : nextIdx > 0 ? L.resume(nextIdx + 1) : L.start}</span></button>
          {!free && <button type="button" className="btn btn-ghost" onClick={onFree}>{L.free}</button>}
        </div>
        <p className="jc-note"><Icon name="info" size={14} />{L.note}</p>
      </div>
    );
  };

  const journal = () => {
    const v = slot.v, J = T.journal, M = MACHINES[shown.machine];
    return (
      <div className="jc-pane">
        <div className="jc-kpis">
          <div><span>{J.spins}</span><b>{F.n(v.spins)}</b></div>
          <div><span>{J.wagered}</span><b>{F.n(v.wagered)}</b></div>
          <div><span>{J.paid}</span><b>{F.n(v.paid)}</b></div>
          <div><span>{J.rtp}</span><b>{v.wagered ? F.pct((100 * v.paid) / v.wagered) : '·'}</b><small>{J.theory(F.pct(M.stats.rtp * 100, 1))}</small></div>
          <div className="take"><span>{J.take}</span><b>{F.signed(slot.take)}</b><small>{J.takeHint}</small></div>
          <div><span>{J.audits}</span><b>{v.audits}</b></div>
          <div><span>{J.nears}</span><b>{v.nears}</b></div>
          <div><span>{J.fakes}</span><b>{v.fakes}</b></div>
        </div>
        <JournalChart series={slot.series} T={T} F={F} />
        <p className="muted small">{J.note}</p>
        {save.life.spins > v.spins && <p className="muted small">{J.life(save.life.spins, save.life.wagered - save.life.paid + save.life.burned)}</p>}
      </div>
    );
  };

  return (
    <section className="jc-lab glass" aria-label={L.tabs[tab]}>
      <div className="jc-tabs" role="tablist">
        {TABS.map(([id, icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)}><Icon name={icon} size={16} /><span>{L.tabs[id]}</span></button>)}
      </div>
      {tab === 'lab' && body()}
      {tab === 'math' && (save.back
        ? <div className="jc-pane"><MathPanel T={T} machine={shown.machine} icons={icons} F={F} /></div>
        : <div className="jc-pane jc-cover"><span className="jc-cover-icon"><Icon name="lock" size={22} /></span><h3>{T.math.coverTitle}</h3><p>{T.math.coverText}</p><button type="button" className="btn btn-primary" onClick={onOpenBack}><Icon name="lockOpen" size={16} /><span>{T.math.open}</span></button></div>)}
      {tab === 'journal' && journal()}
    </section>
  );
}
