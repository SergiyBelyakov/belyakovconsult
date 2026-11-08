import { useState } from 'react';
import { Panel, Modal, Button } from '../../../dashboard/src/ui.jsx';
import { Icon } from '../../../dashboard/src/icons.jsx';
import { INDICATORS, IND_BY, STATUS_COUNTS, DOMAINS } from '../model.js';
import { TOTAL, S, SRC_BY, OBJ_BY, AS_OF, isStale, own, transfers } from '../world.js';
import { Spark, BenchStrip, StatusBar, Trend, HBars, STATUS_ICON } from '../charts.jsx';
import { StatusTag, moduleHref, unitOf } from './controls.jsx';

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

export function IndTile({ x, ctx, onOpen }) {
  const { T, f } = ctx;
  return (
    <button type="button" className={'ind-tile glass st-' + x.status} onClick={() => onOpen(x.id)}>
      <span className="it-top"><span className="it-dom">{T.dom[x.dom]}</span><StatusTag s={x.status} T={T} quiet={x.status === 'ok'} /></span>
      <span className="it-name">{T.ind[x.id].n}</span>
      <span className="it-val">{f.ind(x)}{unitOf(x, T) && <small>{unitOf(x, T)}</small>}</span>
      <span className="it-mid">
        {x.series ? <Spark values={x.series} /> : x.model ? <span className="it-model"><Icon name="layersAlt" size={13} />{T.pass.modules[x.model]}</span> : null}
      </span>
      {x.bench && <BenchStrip x={x} f={f} T={T} compact />}
      <span className="it-src">{x.src.length ? T.src[x.src[0]] : T.noOwner}{x.updated && <> · {f.date(x.updated)}</>}</span>
    </button>
  );
}

export function IndModal({ id, ctx, onClose }) {
  const { T, f, objName, go, onSite, lang } = ctx;
  const x = IND_BY.get(id);
  const t = T.ind[id];
  const brk = x.brk ? [...x.brk].sort((a, b) => b.v - a.v).map(b => ({ id: b.id, v: b.v, label: b.kind === 'okrug' ? T.okrugName(b.id) : objName(OBJ_BY.get(b.id)) })) : null;
  const fmt = v => f.indVal(x, v);
  return (
    <Modal title={t.n} onClose={onClose} wide T={T}>
      <div className="ind-modal">
        <div className="im-head">
          <div className="im-val"><b>{f.ind(x)}</b>{unitOf(x, T) && <small>{unitOf(x, T)}</small>}</div>
          <div className="im-status"><StatusTag s={x.status} T={T} /><p>{T.statusLong[x.status]}</p></div>
        </div>
        {x.conflict && (
          <div className="im-conflict">
            <Icon name="warning" size={16} />
            <div><strong>{T.pass.conflictTitle}: {fmt(x.conflict.v)} · {T.src[x.conflict.src]}</strong><p>{T.pass.twinNote} {T.ind.popEst.m}</p></div>
            <Button onClick={() => { onClose(); go('people'); }}>{T.pass.open}</Button>
          </div>
        )}
        {x.alt && <p className="im-alt"><Icon name="info" size={14} />{T.pass.altPc(f.ind(x), f.uah(x.alt.v))}</p>}
        <div className="grid grid-2 im-grid">
          <div>
            <h4>{T.pass.what}</h4><p>{t.d}</p>
            <h4>{T.pass.how}</h4><p>{t.m}</p>
            {x.model && <p className="im-module"><Icon name="layersAlt" size={14} />{T.pass.model}: <a href={moduleHref(x.model, onSite, lang)}>{T.pass.modules[x.model]}</a></p>}
          </div>
          <div>
            <h4>{T.pass.src}</h4>
            {x.src.length ? (
              <table className="data-table compact plain im-src">
                <tbody>
                  {x.src.map(s => { const src = SRC_BY.get(s); return (
                    <tr key={s}>
                      <td className="strong">{T.src[s]}<small>{src.owner ? T.owner[src.owner] : T.noOwner}</small></td>
                      <td>{T.freqText(src.freq)}<small>{T.access[src.access]}</small></td>
                      <td className="num">{f.date(src.updated)}<small><StatusTag s={isStale(src) ? 'stale' : 'ok'} T={T} quiet /></small></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            ) : <p className="muted">{T.statusLong.missing}</p>}
          </div>
        </div>
        {(x.series || x.bench) && (
          <div className={'grid im-grid' + (x.series && x.bench ? ' grid-2' : '')}>
            {x.series && <div><h4>{T.pass.history}</h4>{id === 'popEst' && <div className="mini-leg"><span><i style={{ background: '#3B82F6' }} />{t.n}</span><span><i className="sq" style={{ background: '#B47308' }} />{T.src.reg}</span></div>}<Trend years={YEARS} series={[{ key: 'v', values: x.series, name: t.n }, ...(id === 'popEst' ? [{ key: 'r', values: IND_BY.get('popReg').series, name: T.src.reg, color: '#B47308', dash: true }] : [])]} fmt={fmt} height={190} label={t.n} /></div>}
            {x.bench && <div><h4>{T.benchMed}</h4><BenchStrip x={x} f={f} T={T} /><p className="muted small">{T.benchNote}</p></div>}
          </div>
        )}
        {brk && (
          <div className="im-brk">
            <h4>{T.pass.breakdown}</h4>
            <HBars items={brk} fmt={fmt} label={t.n} />
          </div>
        )}
        {x.page && <div className="im-actions"><Button kind="primary" icon="arrowRight" onClick={() => { onClose(); go(x.page); }}>{T.pass.open}: {T.nav[x.page]}</Button></div>}
      </div>
    </Modal>
  );
}

export default function Passport({ ctx }) {
  const { T, f, dom, setDom, ind, setInd } = ctx;
  const [stat, setStat] = useState(null);
  const list = INDICATORS.filter(x => (!dom || x.dom === dom) && (!stat || x.status === stat));
  const okN = STATUS_COUNTS.find(s => s[0] === 'ok')[1];
  const attn = INDICATORS.filter(x => x.status !== 'ok');
  return (
    <>
      <div className="grid pass-top">
        <Panel className="pass-card" title={T.pass.card} aside={<span className="pass-id mono">UA-VR-0001</span>}>
          <div className="pc-name"><strong>{T.communityFull}</strong><span>{T.pass.center}: {T.center}</span></div>
          <dl className="pc-fields">
            <div><dt>{T.pass.area}</dt><dd>{f.int(S.area)} {T.units.km2}</dd></div>
            <div><dt>{T.pass.pop}</dt><dd>{f.int(TOTAL.pop)}<small>{T.pass.popNote}</small></dd></div>
            <div><dt>{T.pass.reg}</dt><dd>{f.int(TOTAL.reg)}<small className="over">{f.signedPct(TOTAL.reg / TOTAL.pop - 1)}</small></dd></div>
            <div><dt>{T.pass.places}</dt><dd className="small-dd">{T.pass.placesVal}</dd></div>
            <div><dt>{T.pass.okrugs}</dt><dd>9</dd></div>
            <div><dt>{T.pass.budget}</dt><dd className="small-dd">{T.pass.budgetVal(f.mln(own(5) + transfers(5)), f.mln(own(5)))}</dd></div>
          </dl>
          <p className="pc-asof"><Icon name="calendar" size={14} />{T.pass.asOf} {f.date(AS_OF)}</p>
        </Panel>
        <Panel title={T.pass.dataTitle} sub={T.pass.dataSub} className="pass-data">
          <div className="fresh-big"><b>{f.pctV(IND_BY.get('fresh').v, 0)}</b><span>{T.pass.freshBig(okN, INDICATORS.length)}</span></div>
          <StatusBar counts={STATUS_COUNTS} T={T} onPick={setStat} picked={stat} />
          <h4 className="attn-title">{T.pass.attention}</h4>
          <ul className="attn-list">
            {attn.map(x => (
              <li key={x.id}>
                <button type="button" onClick={() => setInd(x.id)}>
                  <span className={'st-ic st-' + x.status}><Icon name={STATUS_ICON[x.status]} size={12} /></span>
                  <span className="attn-name">{T.ind[x.id].n}</span>
                  <span className="attn-meta">{x.status === 'stale' ? f.date(x.updated) : T.status[x.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="dom-chips" role="group" aria-label={T.pass.all}>
        <button type="button" className={'chip' + (!dom ? ' on' : '')} onClick={() => setDom(null)}>{T.pass.all}<b>{INDICATORS.filter(x => !stat || x.status === stat).length}</b></button>
        {DOMAINS.map(d => (
          <button type="button" key={d} className={'chip' + (dom === d ? ' on' : '')} onClick={() => setDom(dom === d ? null : d)}>{T.dom[d]}<b>{INDICATORS.filter(x => x.dom === d && (!stat || x.status === stat)).length}</b></button>
        ))}
        {stat && <button type="button" className="chip chip-x" onClick={() => setStat(null)}><Icon name="x" size={12} />{T.status[stat]}</button>}
      </div>

      {list.length ? (
        <div className="ind-grid">{list.map(x => <IndTile key={x.id} x={x} ctx={ctx} onOpen={setInd} />)}</div>
      ) : <p className="muted empty-note">{T.pass.empty}</p>}

      {ind && <IndModal id={ind} ctx={ctx} onClose={() => setInd(null)} />}
    </>
  );
}
