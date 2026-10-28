import { DOMAINS, REGIONS, label } from '../data.js';
import { Icon } from '../icons.jsx';
import { Button, Panel } from '../ui.jsx';

export const SECTION_IDS = ['summary', 'trend', 'structure', 'quality', 'sources', 'detail', 'method'];

export function filterSummary(ctx) {
  const { T, f, lang, filters, m } = ctx;
  const months = m.monthIds;
  return [
    [T.pdf.period, months.length ? `${f.monthYear(months[0])} … ${f.monthYear(months[months.length - 1])}` : '—'],
    [T.pdf.regions, filters.region === 'all' ? T.pdf.all : label(REGIONS, filters.region, lang)],
    [T.pdf.domains, filters.domain === 'all' ? T.pdf.all : label(DOMAINS, filters.domain, lang)],
    [T.pdf.search, filters.search ? '«' + filters.search + '»' : T.pdf.none],
    [T.targetLabel, f.pct(m.target, 1)],
  ];
}

export default function Reports({ ctx }) {
  const { T, report, setReport, makePdf, pdfBusy, exportCSV, importCSV, sampleCSV, restoreDemo, uploaded, openLead, m } = ctx;
  const toggle = id => setReport({ ...report, sections: { ...report.sections, [id]: !report.sections[id] } });
  const any = SECTION_IDS.some(id => report.sections[id]);
  return (
    <div className="grid grid-reports">
      <Panel title={T.reportBuilder} sub={T.reportBuilderSub} className="report-builder">
        <label className="field">
          <span>{T.reportTitleLabel}</span>
          <input type="text" value={report.title} maxLength={90} onChange={e => setReport({ ...report, title: e.target.value })} placeholder={T.reportTitleDefault} />
        </label>
        <fieldset className="section-picks">
          {SECTION_IDS.map((id, i) => (
            <label key={id} className={'pick' + (report.sections[id] ? ' on' : '')}>
              <input type="checkbox" checked={!!report.sections[id]} onChange={() => toggle(id)} />
              <span className="pick-n">{String(i + 1).padStart(2, '0')}</span>
              <span>{T.sections[id]}</span>
              <Icon name="check" size={15} className="pick-check" />
            </label>
          ))}
        </fieldset>
        <div className="filters-summary">
          <strong>{T.filtersInReport}</strong>
          <dl>{filterSummary(ctx).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
        <div className="report-actions">
          <Button kind="primary" icon="pdf" onClick={makePdf} disabled={pdfBusy || !any || !m.rows.length}>{pdfBusy ? T.pdfBuilding : T.pdfButton}</Button>
          <Button icon="download" onClick={exportCSV} disabled={!m.rows.length}>{T.csvExport}</Button>
        </div>
      </Panel>
      <div className="stack">
        <Panel title={T.ownData} sub={T.ownDataText}>
          <div className="report-actions wrap">
            <Button icon="upload" onClick={importCSV}>{T.csvImport}</Button>
            <Button icon="file" onClick={sampleCSV}>{T.csvSample}</Button>
            {uploaded && <Button icon="reset" onClick={restoreDemo}>{T.csvRestore}</Button>}
          </div>
          <p className="hint mono">{T.csvHint}</p>
        </Panel>
        <section className="cta-card glass">
          <span className="signal-line" />
          <h3>{T.ctaLong}</h3>
          <p>{T.lead.text}</p>
          <Button kind="primary" icon="mail" onClick={() => openLead('reports')}>{T.ctaSideButton}</Button>
        </section>
      </div>
    </div>
  );
}
