// Складові демо M&E: смуга звітного кварталу, статус, паспорт показника (шухляда) і звіт донору.
import { useMemo } from 'react';
import { NOW, NQ, QS, IND_BY, MILESTONES, DISABILITY_POP, DIS } from './data.js';
import { statusOf, forecast, explain, reach, summary, finance, dqa } from './model.js';
import { Icon, StatusIcon } from '../../dashboard/src/icons.jsx';
import { Button, Modal } from '../../dashboard/src/ui.jsx';
import { Drawer } from '../../exec-demo/src/parts.jsx';
import { TimeChart } from './charts.jsx';

export function Status({ level, T, text }) {
  return <span className={'status ' + level}><StatusIcon level={level} />{text || T.status[level]}</span>;
}
export function Meter({ value, level, max = 1.2 }) {
  const w = Math.max(0, Math.min(max, value || 0)) / max;
  return (
    <span className={'meter ' + (level || '')} aria-hidden="true">
      <i style={{ width: w * 100 + '%' }} />
      <s style={{ left: (1 / max) * 100 + '%' }} />
    </span>
  );
}

// ——— звітний квартал: 12 кварталів програми, майбутні недоступні ———
export function QuarterBar({ T, f, k, setK }) {
  const ms = MILESTONES.filter(m => ['baseline', 'midline', 'endline', 'mtr'].includes(m.id));
  return (
    <div className="mq-bar glass" role="group" aria-label={T.asOf}>
      <div className="mq-head"><Icon name="calendar" size={15} /><b>{T.asOf}</b><span>{f.q(k)}</span><small className="hide-sm">{T.asOfHint}</small></div>
      <div className="mq-track">
        {QS.map(q => {
          const fut = q.i > NOW, m = ms.find(x => x.k === q.i);
          return (
            <button type="button" key={q.i} className={'qcell' + (q.i === k ? ' on' : '') + (q.i <= k ? ' past' : '') + (fut ? ' fut' : '') + (q.i === NOW ? ' now' : '')}
              disabled={fut} aria-pressed={q.i === k} onClick={() => setK(q.i)} title={f.q(q.i) + (m ? ' · ' + T.milestone[m.id] : '') + (fut ? ' · ' + T.future : '')}>
              <span className="qc-y">{q.q === 1 ? q.y : ''}</span>
              <span className="qc-q">{f.qShort(q.i)}</span>
              {m && <i className={'qc-m ' + m.id} />}
              {q.i === NOW && <em>{T.now}</em>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ——— паспорт показника: значення, графік, причини, дезагрегація, PIRS ———
export function IndicatorDrawer({ ctx, id, onClose }) {
  const { T, f, k, code, partnerName, regionName, go } = ctx;
  const d = IND_BY[id], t = T.ind[id];
  const st = statusOf(d, k), fc = forecast(d, k), ex = explain(d, k);
  const R = id === 'p11' ? reach(k) : null;
  const points = QS.map(q => {
    const fp = fc.path.find(p => p.k === q.i);
    return { k: q.i, plan: d.plan[q.i], actual: q.i <= k && d.actual ? d.actual[q.i] : null, ...(fp || {}) };
  });
  const fv = v => f.value(d, v);
  const tip = (p, fut) => (
    <>
      <b>{f.q(p.k)}</b>
      {!fut && p.actual != null && <strong>{fv(p.actual)}</strong>}
      {fut && p.mean != null && <strong>{fv(p.mean)}</strong>}
      {fut && p.lo80 != null && <small>{T.drw.tip.range}: {fv(p.lo80)} … {fv(p.hi80)}</small>}
      {p.plan != null && <small>{T.drw.tip.plan}: {fv(p.plan)}</small>}
    </>
  );
  const disRows = d.dis ? Object.entries(T.drw.disRow) : [];
  const shares = d.dis ? DIS[d.dis] : null;
  const showWhy = !!T.why[id] || ((st.level === 'warning' || st.level === 'critical') && ex.parts.length > 1);
  const pace = fc.need != null && fc.perf != null && d.kind === 'cum' ? T.drw.pace(f.pct(fc.need * 100), f.pct(fc.perf * 100)) : null;
  return (
    <Drawer title={code(d) + ' · ' + t.s} onClose={onClose} T={T} wide>
      <div className="ind-head">
        <h4>{t.n}</h4>
        <div className="ind-tags">
          <span className="tag">{T.lvl[d.lvl]}</span>
          {d.out && <span className="tag">{T.outcome[d.out]}</span>}
          <Status level={st.level} T={T} />
        </div>
      </div>
      <div className="ind-figs">
        <div><span>{T.tbl.actual} · {st.at != null ? f.q(st.at) : f.q(k)}</span><b>{fv(st.v)}</b><small>{st.ratio != null ? f.pct(st.ratio * 100) + ' ' + T.ofPlan : ''}</small></div>
        <div><span>{T.tbl.plan}</span><b>{st.plan == null ? '·' : fv(st.plan)}</b><small>{T.tbl.base}: {d.base != null ? fv(d.base) : d.kind === 'cum' ? '0' : '·'}</small></div>
        <div><span>{T.tbl.target} · {f.q(NQ - 1)}</span><b>{fv(d.target)}</b><small>{st.v != null ? f.pct((st.v / d.target) * 100) + ' ' + T.tbl.ofTarget.replace('% ', '') : ''}</small></div>
        <div><span>{T.tbl.fcLong}</span><b>{fc.end == null ? '·' : fv(fc.end)}</b><small>{fc.pReach == null ? T.tbl.noFc : T.tbl.pReach + ': ' + f.pct(fc.pReach * 100)}</small></div>
      </div>
      <section className="ind-sec">
        <h5>{T.drw.chart}</h5>
        <TimeChart points={points} asOf={d.kind === 'survey' ? Math.min(k, 5) : k} tick={f.tick} fmtAxis={v => (d.unit === 'pct' ? Math.round(v) + '%' : f.compact(v))} tip={tip}
          names={T.drw.names} label={t.n} target={d.target} targetLabel={T.tbl.target} zero={d.unit !== 'pct' || d.target < 40} pct={d.unit === 'pct'} />
        {d.kind === 'survey' && <p className="note"><Icon name="info" size={14} />{T.drw.surveyNote} <button type="button" className="link-btn" onClick={() => { onClose(); go('evaluation'); }}>{T.nav.evaluation} →</button></p>}
        {fc.pReach != null && <p className="note"><Icon name="target" size={14} />{T.drw.pReach(f.pct(fc.pReach * 100))}{pace ? ' ' + pace : ''}</p>}
        {R && <p className="note warn"><Icon name="warning" size={14} />{T.drw.verified(f.int(d.actual[k]), f.int(d.actual[k] - R.dupD - R.unconfirmed))}</p>}
        {d.wip && <p className="note"><Icon name="clock" size={14} />{T.drw.wip(d.wip[Math.min(k, d.wip.length - 1)])}</p>}
      </section>
      {showWhy && (
        <section className="ind-sec">
          <h5>{T.drw.why}</h5>
          {T.why[id] && <p className="why-text">{T.why[id]}</p>}
          {ex.parts.length > 1 && st.level !== 'info' && (
            <div className="gap-list">
              <p className="sub">{T.drw.byRegion}. {T.drw.byRegionSub}</p>
              {ex.parts.map(p => (
                <div key={p.r} className="gap-row">
                  <span className="gap-name">{regionName(p.r, true)}</span>
                  <span className="gap-val">{fv(p.a)} <small>/ {fv(p.p)}</small></span>
                  <span className={'gap-ratio ' + (p.ratio == null ? '' : p.ratio >= 0.9 ? 'ok' : p.ratio >= 0.75 ? 'mid' : 'low')}>{p.ratio == null ? '·' : f.pct(p.ratio * 100)}</span>
                  <span className="gap-bar"><i style={{ width: p.share * 100 + '%' }} /></span>
                  <span className="gap-share">{p.share > 0 ? f.pct(p.share * 100) : ''}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {shares && (
        <section className="ind-sec">
          <h5>{T.drw.disTitle}</h5>
          <p className="sub">{T.drw.disSub}</p>
          <div className="dis-grid">
            {disRows.filter(([key]) => !(shares[key] === 0 && (key === 'child'))).map(([key, name]) => {
              const v = shares[key], ref = key === 'dis' ? DISABILITY_POP : null;
              const low = ref != null && v < ref * 0.75;
              return (
                <div key={key} className={'dis-row' + (low ? ' low' : '')}>
                  <span>{name}</span>
                  <span className="dis-bar"><i style={{ width: Math.min(100, v) + '%' }} />{ref != null && <s style={{ left: ref + '%' }} title={T.drw.popRef} />}</span>
                  <b>{f.pct(v, v < 10 && v % 1 ? 1 : 0)}</b>
                  {ref != null && <small>{f.pct(ref)} {T.drw.popRef}</small>}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="ind-sec pirs">
        <h5>{T.drw.passport}</h5>
        <dl>
          <dt>{T.drw.def}</dt><dd>{t.d}</dd>
          <dt>{T.drw.calc}</dt><dd>{t.m}</dd>
          <dt>{T.drw.dis}</dt><dd>{t.dis}</dd>
          <dt>{T.drw.src}</dt><dd>{T.src[d.src]}</dd>
          <dt>{T.drw.freq}</dt><dd>{T.freq[d.freq]}</dd>
          <dt>{T.drw.who}</dt><dd>{d.partners.length ? d.partners.map(p => partnerName(p)).join('; ') : T.partner('M')}</dd>
        </dl>
      </section>
    </Drawer>
  );
}

// ——— звіт донору: чернетка з даних моніторингу ———
export function ReportModal({ ctx, onClose }) {
  const { T, f, k, code, indName, exportIptt, notify } = ctx;
  const data = useMemo(() => {
    const S = summary(k), R = reach(k), F = finance(k), Q = dqa(k);
    const devs = S.st.filter(x => x.s.level === 'critical' || x.s.level === 'warning').sort((a, b) => (a.s.ratio || 0) - (b.s.ratio || 0));
    return { S, R, F, Q, devs };
  }, [k]);
  const { S, R, F, Q, devs } = data;
  const n = S.st.filter(x => x.s.level !== 'info').length;
  const sec = [
    [T.rep.s1, [T.rep.summary({ q: f.q(k), reach: f.int(R.unique), reachPct: f.pct(R.ratio * 100), on: S.counts.healthy, n, crit: S.counts.critical, spent: f.pct(F.tot.spent * 100), time: f.pct(F.tot.time * 100) })]],
    [T.rep.s2, devs.map(x => T.rep.dev(code(x.d) + ' ' + T.ind[x.d.id].s, f.pct((x.s.ratio || 0) * 100), T.why[x.d.id]))],
    [T.rep.s3, [T.rep.dq({ index: f.int(Q.index), worst: Q.worst.score < 85 ? Q.worst.p : null, worstScore: f.int(Q.worst.score), verified: f.int(R.verified) })]],
    [T.rep.s4, [T.rep.fin({ cpi: f.dec2(F.tot.cpi), spi: f.dec2(F.tot.spi), eac: f.eur(F.tot.eac), vac: (F.tot.vac < 0 ? T.fin.over : T.fin.under) + ' ' + f.eur(Math.abs(F.tot.vac)) })]],
    [T.rep.s5, T.rep.next],
  ];
  const text = T.rep.title(f.q(k)) + '\n\n' + sec.map(([h, ps]) => h + '\n' + ps.map(p => '• ' + p).join('\n')).join('\n\n');
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); notify(T.rep.copied); } catch { /* буфер недоступний */ }
  };
  return (
    <Modal title={T.rep.title(f.q(k))} onClose={onClose} T={T} wide>
      <div className="rep">
        <p className="rep-lead">{T.rep.lead}</p>
        {sec.map(([h, ps]) => (
          <section key={h}>
            <h4>{h}</h4>
            <ul>{ps.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>
        ))}
        <div className="rep-actions">
          <Button icon="copy" onClick={copy}>{T.rep.copy}</Button>
          <Button kind="primary" icon="download" onClick={exportIptt}>{T.rep.xlsx}</Button>
        </div>
      </div>
    </Modal>
  );
}
