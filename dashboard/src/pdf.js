// Векторний PDF-звіт A4 у світлій темі бренду (документи: B1 на світлому фоні).
// jsPDF і шрифти завантажуються лише після натискання кнопки, щоб не важчала сама сторінка.
import { DOMAINS, REGIONS, SLA, SOURCES, label, pct, statusAvailability, statusQuality } from './data.js';
import { niceMax } from './format.js';
import { SECTION_IDS, filterSummary } from './pages/Reports.jsx';
import { reasonsOf } from './pages/Quality.jsx';

const INK = [5, 7, 10];
const MUTED = [74, 82, 98];      // підписи: темніший за Slate, щоб дрібний текст мав контраст ≥ 4.5:1
const AXIS = [100, 116, 139];    // Slate: осі та сітка
const LINE = [224, 227, 232];
const SOFT = [244, 246, 248];
const RUBY = [217, 4, 41];
const COBALT = [59, 130, 246];
const SERIES = { registry: [59, 130, 246], finance: [1, 149, 134], health: [168, 85, 247], operations: [236, 72, 153], geo: [13, 151, 171] };
const STATUS = { healthy: [16, 185, 129], warning: [255, 176, 32], critical: [255, 107, 107], info: [148, 163, 184] };
const TINT = { healthy: mix(STATUS.healthy, 0.2), warning: mix(STATUS.warning, 0.28), critical: mix(STATUS.critical, 0.3) };

function mix(c, a) { return c.map(v => Math.round(255 - (255 - v) * a)); }

const PAGE = { w: 210, h: 297, mx: 16, top: 16, bottom: 18 };
const CW = PAGE.w - PAGE.mx * 2;

let jsPDFReady = null;
function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = ok; s.onerror = () => fail(new Error('script ' + src));
    document.head.appendChild(s);
  });
}

async function bin(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return s;
}

async function dataUrl(url) {
  const r = await fetch(url);
  const b = await r.blob();
  return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); });
}

async function setup(base) {
  if (!jsPDFReady) {
    jsPDFReady = (async () => {
      if (!window.jspdf) await loadScript(base + 'vendor/jspdf.umd.min.js');
      const fonts = await Promise.all(['Montserrat-Bold', 'Montserrat-SemiBold', 'Inter-Regular', 'Inter-SemiBold'].map(n => bin(base + 'pdf-fonts/' + n + '.ttf')));
      const logo = await dataUrl(base + 'img/bc-positive.png');
      return { fonts, logo };
    })().catch(e => { jsPDFReady = null; throw e; });
  }
  return jsPDFReady;
}

export async function buildPdf(ctx, base) {
  const { fonts, logo } = await setup(base);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  [['MontB', 0], ['MontSB', 1], ['Inter', 2], ['InterSB', 3]].forEach(([name, i]) => {
    doc.addFileToVFS(name + '.ttf', fonts[i]);
    doc.addFont(name + '.ttf', name, 'normal', undefined, 'Identity-H');
  });
  const r = new Report(doc, ctx, logo);
  r.render();
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`Belyakov_Consult_dashboard_report_${ctx.lang}_${stamp}.pdf`);
}

const clean = s => String(s ?? '').replace(/ /g, ' ');

class Report {
  constructor(doc, ctx, logo) {
    this.doc = doc; this.ctx = ctx; this.logo = logo;
    this.T = ctx.T; this.f = ctx.f; this.m = ctx.m; this.lang = ctx.lang;
    this.y = PAGE.top;
  }

  // ——— примітиви ———
  font(name, size, color = INK) { this.doc.setFont(name, 'normal'); this.doc.setFontSize(size); this.doc.setTextColor(...color); }
  text(s, x, y, opt) { this.doc.text(clean(s), x, y, opt); }
  width(s) { return this.doc.getTextWidth(clean(s)); }
  fit(s, w) {
    s = clean(s);
    if (this.width(s) <= w) return s;
    while (s.length > 1 && this.width(s + '…') > w) s = s.slice(0, -1);
    return s + '…';
  }
  // Перенос лише між словами (jsPDF рве довгі слова посередині); задовге слово скорочується з «…».
  wrapWords(s, w, max = 2) {
    const words = clean(s).split(/\s+/);
    const lines = [];
    let cur = '';
    words.forEach(word => {
      const t = cur ? cur + ' ' + word : word;
      if (!cur || this.width(t) <= w) cur = t; else { lines.push(cur); cur = word; }
    });
    if (cur) lines.push(cur);
    if (lines.length > max) { lines.length = max; lines[max - 1] += ' …'; }
    return lines.map(l => this.fit(l, w));
  }
  fill(c) { this.doc.setFillColor(...c); }
  stroke(c, w = 0.2) { this.doc.setDrawColor(...c); this.doc.setLineWidth(w); }
  need(h) { if (this.y + h > PAGE.h - PAGE.bottom) this.page(); }
  page() { this.doc.addPage(); this.y = PAGE.top + 4; this.runningHead(); }

  runningHead() {
    this.font('InterSB', 7.5, MUTED);
    this.text('Belyakov Consult', PAGE.mx, PAGE.top - 4);
    this.font('Inter', 7.5, MUTED);
    this.text(this.title, PAGE.w - PAGE.mx, PAGE.top - 4, { align: 'right' });
    this.stroke(LINE, 0.2); this.doc.line(PAGE.mx, PAGE.top - 1.5, PAGE.w - PAGE.mx, PAGE.top - 1.5);
    this.y = PAGE.top + 4;
  }

  heading(title, sub) {
    this.need(sub ? 30 : 24);
    this.y += 3;
    this.fill(RUBY); this.doc.rect(PAGE.mx, this.y, 9, 0.9, 'F');
    this.y += 5.6;
    this.font('MontSB', 12.5); this.text(title, PAGE.mx, this.y);
    this.y += 1.6;
    if (sub) { this.y += 3.6; this.font('Inter', 8, MUTED); this.text(this.fit(sub, CW), PAGE.mx, this.y); }
    this.y += 4.6;
  }

  paragraph(s, size = 8.5, color = INK, w = CW, lh = 1.45) {
    this.font('Inter', size, color);
    const lines = this.doc.splitTextToSize(clean(s), w);
    const step = size * 0.3528 * lh;
    this.need(lines.length * step + 2);
    lines.forEach(l => { this.text(l, PAGE.mx, this.y + step * 0.75); this.y += step; });
  }

  statusChip(level, x, y) {
    this.fill(STATUS[level]); this.doc.circle(x + 1.1, y - 1.05, 1.1, 'F');
    this.font('Inter', 7.5, INK); this.text(this.T.status[level], x + 3.2, y);
  }

  // Таблиця з повтором шапки на новій сторінці. cols: [{w, title, align, render(row) → string | {draw(x,y,w)}}]
  table(cols, rows, { rowH = 6.4, head = true, font = 7.8, zebra = true } = {}) {
    const drawHead = () => {
      this.font('InterSB', 6.9, MUTED);
      const heads = cols.map(c => this.wrapWords(c.title, c.w - 3, 2));
      const hh = heads.some(h => h.length > 1) ? rowH + 3 : rowH;
      this.fill(SOFT); this.doc.rect(PAGE.mx, this.y, CW, hh, 'F');
      let x = PAGE.mx;
      cols.forEach((c, i) => {
        const tx = c.align === 'right' ? x + c.w - 2 : x + 2;
        const lines = heads[i].map(l => this.fit(l, c.w - 3));
        const y0 = this.y + (hh - (lines.length - 1) * 3) / 2 + 1.1;
        lines.forEach((l, k) => this.text(l, tx, y0 + k * 3, { align: c.align === 'right' ? 'right' : 'left' }));
        x += c.w;
      });
      this.y += hh;
    };
    this.need(rowH * 3);
    if (head) drawHead();
    rows.forEach((row, i) => {
      if (this.y + rowH > PAGE.h - PAGE.bottom) { this.page(); if (head) drawHead(); }
      if (zebra && i % 2 === 1) { this.fill([250, 251, 252]); this.doc.rect(PAGE.mx, this.y, CW, rowH, 'F'); }
      this.stroke(LINE, 0.15); this.doc.line(PAGE.mx, this.y + rowH, PAGE.mx + CW, this.y + rowH);
      let x = PAGE.mx;
      cols.forEach(c => {
        const v = c.render(row, i);
        if (v && typeof v === 'object' && v.draw) v.draw(x, this.y, c.w, rowH);
        else {
          this.font(c.bold ? 'InterSB' : 'Inter', c.size || font, INK);
          const tx = c.align === 'right' ? x + c.w - 2 : x + 2;
          this.text(this.fit(v, c.w - 3), tx, this.y + rowH * 0.66, { align: c.align === 'right' ? 'right' : 'left' });
        }
        x += c.w;
      });
      this.y += rowH;
    });
    this.y += 2;
  }

  dotText(color, s) {
    return { draw: (x, y, w, h) => { this.fill(color); this.doc.circle(x + 3, y + h / 2, 1.1, 'F'); this.font('Inter', 7.8, INK); this.text(this.fit(s, w - 7), x + 5.5, y + h * 0.66); } };
  }
  status(level) { return { draw: (x, y, w, h) => this.statusChip(level, x + 2, y + h * 0.66) }; }
  shareBar(v, max) {
    return {
      draw: (x, y, w, h) => {
        const bw = w - 16;
        this.fill([236, 239, 243]); this.doc.rect(x + 2, y + h / 2 - 1, bw, 2, 'F');
        this.fill(COBALT); this.doc.rect(x + 2, y + h / 2 - 1, Math.max(0.4, (bw * v) / max), 2, 'F');
        this.font('Inter', 7.4, INK); this.text(this.f.pct(v, 1), x + w - 1.5, y + h * 0.66, { align: 'right' });
      },
    };
  }

  // ——— сторінки ———
  render() {
    const { T, ctx } = this;
    this.title = clean(ctx.report.title || T.reportTitleDefault);
    this.doc.setProperties({ title: this.title, subject: T.pdf.report, author: 'Belyakov Consult', creator: 'belyakovconsult.com', keywords: 'data quality, BI, dashboard' });
    this.cover();
    const s = ctx.report.sections;
    if (s.summary) this.summary();
    if (s.trend) this.trend();
    if (s.structure) this.structure();
    if (s.quality) this.quality();
    if (s.sources) this.sources();
    if (s.detail) this.detail();
    if (s.method) this.method();
    this.footers();
  }

  cover() {
    const { doc, T } = this;
    // B1: знак BC., нейтральний роздільник, назва і підпис компетенцій. Під B1 червоної риски немає.
    const lh = 10.5, lw = (lh * 291) / 139;
    doc.addImage(this.logo, 'PNG', PAGE.mx, PAGE.top - 4, lw, lh, 'logo', 'FAST');
    this.stroke([200, 205, 212], 0.25); doc.line(PAGE.mx + lw + 4, PAGE.top - 3.5, PAGE.mx + lw + 4, PAGE.top + 6);
    this.font('MontSB', 10.5); this.text('Belyakov Consult', PAGE.mx + lw + 8, PAGE.top + 0.6);
    this.font('Inter', 7, MUTED); this.text('BI • Data Architecture • Data Governance', PAGE.mx + lw + 8, PAGE.top + 4.6);
    this.font('InterSB', 8, INK); this.text(T.pdf.report, PAGE.w - PAGE.mx, PAGE.top + 0.6, { align: 'right' });
    const now = new Date();
    this.font('Inter', 7.5, MUTED); this.text(`${T.pdf.generated}: ${now.toLocaleDateString(T.locale, { day: 'numeric', month: 'long', year: 'numeric' })}`, PAGE.w - PAGE.mx, PAGE.top + 4.6, { align: 'right' });
    this.y = PAGE.top + 22;
    this.font('MontB', 20);
    const tl = doc.splitTextToSize(this.title, CW);
    tl.forEach(l => { this.text(l, PAGE.mx, this.y); this.y += 8.2; });
    // Плашка про синтетичні дані: чесно, на першій сторінці.
    this.font('InterSB', 7.4, INK);
    const bw = this.width(T.pdf.demoBadge) + 8;
    this.stroke(RUBY, 0.3); doc.roundedRect(PAGE.mx, this.y - 2.2, bw, 6, 1.2, 1.2, 'S');
    this.fill(RUBY); doc.circle(PAGE.mx + 2.8, this.y + 0.8, 0.9, 'F');
    this.text(T.pdf.demoBadge, PAGE.mx + 5, this.y + 1.8);
    this.y += 9;
    // Фільтри звіту
    const items = filterSummary(this.ctx);
    const colW = CW / items.length;
    this.stroke(LINE, 0.2); doc.line(PAGE.mx, this.y, PAGE.w - PAGE.mx, this.y);
    items.forEach(([k, v], i) => {
      const x = PAGE.mx + colW * i;
      this.font('Inter', 6.8, MUTED); this.text(this.fit(k, colW - 3), x, this.y + 4.4);
      this.font('InterSB', 8, INK); this.text(this.fit(v, colW - 3), x, this.y + 8.6);
    });
    this.y += 12;
    doc.line(PAGE.mx, this.y, PAGE.w - PAGE.mx, this.y);
    this.y += 2;
  }

  kpis() {
    const { doc, T, f, m } = this;
    const t = m.t, d = m.delta;
    const tiles = [
      [T.kpi.processed, f.compact(t.vol), `${f.signed(d.vol)}% ${T.kpi.fromStart}`, d.vol >= 0 ? 'healthy' : 'critical'],
      [T.kpi.quality, f.pct(t.quality), `${f.signed(d.quality, 2)} ${T.kpi.pp} · ${T.kpi.ofTarget} ${f.pct(m.target, 1)}`, statusQuality(t.quality, m.target)],
      [T.kpi.availability, f.pct(t.avail), `${f.signed(d.avail, 2)} ${T.kpi.pp} · SLA ${f.pct(SLA.availability, 1)}`, statusAvailability(t.avail)],
      [T.kpi.incidents, f.int(t.inc), `${f.dec1(t.incRate)} ${T.kpi.perK}`, 'info'],
    ];
    const gap = 3.5, w = (CW - gap * 3) / 4, h = 25;
    this.need(h + 4);
    tiles.forEach(([lab, val, sub, lvl], i) => {
      const x = PAGE.mx + i * (w + gap);
      this.stroke(LINE, 0.25); this.fill([255, 255, 255]); doc.rect(x, this.y, w, h, 'FD');
      if (i === 1) { this.fill(RUBY); doc.rect(x, this.y, 7, 0.8, 'F'); }
      this.font('Inter', 7.4, MUTED); this.text(this.fit(lab, w - 6), x + 3.5, this.y + 6);
      this.font('MontB', 16, INK); this.text(val, x + 3.5, this.y + 14.5);
      this.fill(STATUS[lvl]); doc.circle(x + 4.4, this.y + 19.6, 0.9, 'F');
      this.font('Inter', 6.6, INK); this.text(this.fit(sub, w - 9), x + 6.5, this.y + 20.4);
    });
    this.y += h + 4;
  }

  summary() {
    const { T, f, lang, m } = this;
    this.heading(T.pdf.kpis);
    this.kpis();
    if (!m.signals.length) return;
    this.heading(T.pdf.conclusions);
    m.signals.forEach(s => {
      const [title, text] = T.signalsText[s.kind]({
        r: s.region && label(REGIONS, s.region, lang), d: s.domain && label(DOMAINS, s.domain, lang),
        v: s.kind === 'growth' ? f.signed(s.value) + '%' : s.kind === 'topRegion' ? f.compact(s.value) : f.pct(s.value),
        avg: s.avg != null ? f.pct(s.avg) : '', m: s.month && f.monthYear(s.month), inc: s.incidents, lat: s.latency != null ? f.ms(s.latency) : '',
        from: s.from && f.monthYear(s.from), to: s.to && f.monthYear(s.to), share: s.share != null ? f.pct(s.share, 1) : '',
      });
      this.need(10);
      this.fill(STATUS[s.level] || STATUS.info); this.doc.circle(PAGE.mx + 1.2, this.y + 1.6, 1.1, 'F');
      this.font('InterSB', 8.6, INK); this.text(title, PAGE.mx + 4.5, this.y + 2.6);
      const tw = this.width(title);
      this.font('Inter', 8.6, INK);
      const rest = this.doc.splitTextToSize(clean(': ' + text), CW - 6 - tw);
      this.text(rest[0], PAGE.mx + 4.5 + tw, this.y + 2.6);
      this.y += 5;
      rest.slice(1).forEach(l => { this.text(l, PAGE.mx + 4.5, this.y + 2.6); this.y += 4.2; });
    });
    this.y += 2;
  }

  // Стовпчики однієї серії: обсяг за місяцями. Підпис значення лише на останньому.
  columns(data, value, h, fmtAxis, fmtLast, color = COBALT) {
    const { doc, f } = this;
    this.need(h + 10);
    const L = PAGE.mx + 14, R = PAGE.w - PAGE.mx, T0 = this.y + 4, B = this.y + h;
    const max = niceMax(Math.max(1, ...data.map(value)) * 1.08);
    const y = v => B - (B - T0) * (v / max);
    [0, 0.5, 1].forEach(fr => {
      this.stroke(LINE, 0.15); doc.line(L, y(max * fr), R, y(max * fr));
      this.font('Inter', 6.6, AXIS); this.text(fmtAxis(max * fr), L - 2, y(max * fr) + 1, { align: 'right' });
    });
    const band = (R - L) / data.length, bw = Math.min(7, band * 0.58);
    data.forEach((d, i) => {
      const cx = L + band * i + band / 2, v = value(d);
      this.fill(i === data.length - 1 ? RUBY : color);
      const top = y(v), r = Math.min(0.8, (B - top) / 2);
      doc.roundedRect(cx - bw / 2, top, bw, B - top + r, r, r, 'F');
      this.fill([255, 255, 255]); doc.rect(cx - bw / 2 - 0.2, B, bw + 0.4, r + 0.2, 'F');
      this.font('Inter', 6.6, AXIS); this.text(f.month(d.month), cx, B + 4, { align: 'center' });
      if (i === data.length - 1 && fmtLast) { this.font('InterSB', 7.2, INK); this.text(fmtLast(d), cx, top - 1.8, { align: 'center' }); }
    });
    this.y = B + 8;
  }

  // Лінія однієї серії з пунктирною ціллю (окремий графік, не друга вісь).
  lineChart(data, value, h, lo, hi, ref, fmtAxis, color = COBALT, refLabel) {
    const { doc, f } = this;
    this.need(h + 10);
    const L = PAGE.mx + 14, R = PAGE.w - PAGE.mx, T0 = this.y + 4, B = this.y + h;
    const x = i => L + (R - L) * (data.length === 1 ? 0.5 : i / (data.length - 1));
    const y = v => B - (B - T0) * ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo));
    [lo, (lo + hi) / 2, hi].forEach(v => {
      this.stroke(LINE, 0.15); doc.line(L, y(v), R, y(v));
      this.font('Inter', 6.6, AXIS); this.text(fmtAxis(v), L - 2, y(v) + 1, { align: 'right' });
    });
    if (ref != null) {
      this.stroke(AXIS, 0.3); doc.setLineDashPattern([1.2, 1.2], 0); doc.line(L, y(ref), R, y(ref)); doc.setLineDashPattern([], 0);
      if (refLabel) { this.font('Inter', 6.6, MUTED); this.text(refLabel, R, y(ref) - 1.4, { align: 'right' }); }
    }
    this.stroke(color, 0.6);
    for (let i = 1; i < data.length; i++) doc.line(x(i - 1), y(value(data[i - 1])), x(i), y(value(data[i])));
    data.forEach((d, i) => {
      this.font('Inter', 6.6, AXIS); this.text(f.month(d.month), x(i), B + 4, { align: 'center' });
    });
    const li = data.length - 1;
    this.fill([255, 255, 255]); doc.circle(x(li), y(value(data[li])), 1.5, 'F');
    this.fill(RUBY); doc.circle(x(li), y(value(data[li])), 1, 'F');
    this.font('InterSB', 7.2, INK); this.text(f.pct(value(data[li])), x(li) - 2, y(value(data[li])) - 2.4, { align: 'right' });
    this.y = B + 8;
  }

  trend() {
    const { T, f, m } = this;
    if (!m.months.length) return;
    this.heading(T.trend, T.trendSub.split(';')[0]);
    this.columns(m.months, d => d.vol, 37, f.axis, d => f.compact(d.vol));
    const qs = m.months.map(x => x.quality);
    const lo = Math.floor(Math.min(m.target - 0.5, ...qs) * 2) / 2, hi = Math.ceil(Math.max(m.target + 0.5, ...qs) * 2) / 2;
    this.need(36); this.font('InterSB', 8.6, INK); this.text(T.qTrend, PAGE.mx, this.y + 2); this.y += 3;
    this.lineChart(m.months, d => d.quality, 24, lo, hi, m.target, v => f.dec1(v) + '%', COBALT, `${T.pdf.target} ${f.pct(m.target, 1)}`);
  }

  structure() {
    const { T, f, lang, m } = this;
    this.heading(T.pdf.structure);
    const maxShare = Math.max(...m.domains.map(d => pct(d.vol, m.t.vol)), 1);
    this.table([
      { w: 46, title: T.cols.domain, render: d => this.dotText(SERIES[d.id], label(DOMAINS, d.id, lang)) },
      { w: 26, title: T.cols.processed, align: 'right', render: d => f.int(d.vol) },
      { w: 32, title: T.share, render: d => this.shareBar(pct(d.vol, m.t.vol), maxShare) },
      { w: 20, title: T.cols.quality, align: 'right', bold: true, render: d => d.rows ? f.pct(d.quality) : '—' },
      { w: 20, title: T.cols.availability, align: 'right', render: d => d.rows ? f.pct(d.avail) : '—' },
      { w: 14, title: T.pdf.incShort, align: 'right', render: d => f.int(d.inc) },
      { w: 20, title: T.cols.status, render: d => d.rows ? this.status(statusQuality(d.quality, m.target)) : '—' },
    ], m.domains);
    this.heading(T.pdf.regionsT);
    const maxR = Math.max(...m.regions.map(r => pct(r.vol, m.t.vol)), 1);
    const ch = Object.fromEntries(m.regionChange.map(r => [r.id, r.rel]));
    this.table([
      { w: 40, title: T.cols.region, render: r => label(REGIONS, r.id, lang) },
      { w: 26, title: T.cols.processed, align: 'right', render: r => f.int(r.vol) },
      { w: 32, title: T.share, render: r => this.shareBar(pct(r.vol, m.t.vol), maxR) },
      { w: 18, title: T.growthCol, align: 'right', render: r => f.signed(ch[r.id] || 0) + '%' },
      { w: 20, title: T.cols.quality, align: 'right', bold: true, render: r => r.rows ? f.pct(r.quality) : '—' },
      { w: 20, title: T.cols.latency, align: 'right', render: r => r.rows ? f.ms(r.latency) : '—' },
      { w: 22, title: T.cols.status, render: r => r.rows ? this.status(statusQuality(r.quality, m.target)) : '—' },
    ], [...m.regions].sort((a, b) => b.vol - a.vol));
  }

  quality() {
    const { doc, T, f, lang, m } = this;
    this.heading(T.pdf.qualityMatrix, T.pdf.legendStatus.replace('{target}', f.dec1(m.target)));
    const first = 36, cw = (CW - first) / DOMAINS.length, rh = 8.2;
    this.need(rh * (REGIONS.length + 1) + 12);
    this.font('InterSB', 7, MUTED);
    DOMAINS.forEach((d, j) => {
      const lines = doc.splitTextToSize(label(DOMAINS, d.id, lang), cw - 2);
      lines.slice(0, 2).forEach((l, k) => this.text(l, PAGE.mx + first + cw * j + cw / 2, this.y + 3 + k * 3, { align: 'center' }));
    });
    this.y += 8;
    m.matrixQuality.forEach(row => {
      this.font('Inter', 7.8, INK); this.text(this.fit(label(REGIONS, row.region, lang), first - 2), PAGE.mx, this.y + rh * 0.62);
      row.cells.forEach((c, j) => {
        const x = PAGE.mx + first + cw * j;
        if (c.value == null) { this.font('Inter', 7.8, AXIS); this.text('—', x + cw / 2, this.y + rh * 0.62, { align: 'center' }); return; }
        const lvl = statusQuality(c.value, m.target);
        this.fill(TINT[lvl]); doc.rect(x + 0.5, this.y + 0.5, cw - 1, rh - 1, 'F');
        this.font(lvl === 'healthy' ? 'Inter' : 'InterSB', 8, INK); this.text(f.pct(c.value), x + cw / 2, this.y + rh * 0.62, { align: 'center' });
      });
      this.y += rh;
    });
    this.y += 3;
    let lx = PAGE.mx;
    ['healthy', 'warning', 'critical'].forEach(l => {
      this.fill(TINT[l]); doc.rect(lx, this.y, 5, 3.4, 'F');
      this.font('Inter', 7.2, INK); this.text(T.status[l], lx + 6.5, this.y + 2.7);
      lx += 10 + this.width(T.status[l]) + 4;
    });
    this.y += 7;
    const ex = m.exceptions.slice(0, 14);
    if (!ex.length) return;
    this.heading(T.pdf.exceptionsT, T.exceptionsSub);
    this.table([
      { w: 19, title: T.cols.month, render: r => f.monthYear(r.month) },
      { w: 27, title: T.cols.region, render: r => label(REGIONS, r.region, lang) },
      { w: 34, title: T.cols.domain, render: r => this.dotText(SERIES[r.domain], label(DOMAINS, r.domain, lang)) },
      { w: 16, title: T.cols.quality, align: 'right', bold: true, render: r => f.pct(r.quality) },
      { w: 19, title: T.gap, align: 'right', render: r => f.signed(r.quality - m.target, 2) + ' ' + T.kpi.pp },
      { w: 17, title: T.pdf.availShort, align: 'right', render: r => f.pct(r.availability) },
      { w: 15, title: T.pdf.latShort, align: 'right', render: r => f.int(r.latency) },
      { w: 31, title: T.reason, size: 6.8, render: r => reasonsOf(r, m.target).map(k => T.reasons[k]).join(', ') },
    ], ex);
  }

  sources() {
    const { T, f, lang, m } = this;
    this.heading(T.pdf.sourcesT, T.sourceCardsSub);
    this.table([
      { w: 34, title: T.cols.domain, render: d => this.dotText(SERIES[d.id], label(DOMAINS, d.id, lang)) },
      { w: 47, title: T.systemCol, render: d => SOURCES[d.id].system[lang] },
      { w: 27, title: T.integration, render: d => T.modes[SOURCES[d.id].mode] },
      { w: 18, title: T.frequency, render: d => T.freqs[SOURCES[d.id].freq] },
      { w: 17, title: T.pdf.availShort, align: 'right', bold: true, render: d => d.rows ? f.pct(d.avail) : '—' },
      { w: 15, title: T.cols.latency, align: 'right', render: d => d.rows ? f.int(d.latency) + ' ' + T.ms : '—' },
      { w: 20, title: 'SLA', render: d => d.rows ? this.status(statusAvailability(d.avail)) : '—' },
    ], m.domains, { rowH: 7 });
    this.paragraph(`SLA: ${T.cols.availability.toLowerCase()} ${f.pct(SLA.availability, 1)}, ${T.cols.latency.toLowerCase()} ${f.ms(SLA.latency)}.`, 7.6, MUTED);
  }

  detail() {
    const { T, f, lang, m } = this;
    const N = 40;
    const rows = [...m.rows].map(r => ({ ...r, quality: pct(r.valid, r.processed) })).sort((a, b) => b.processed - a.processed).slice(0, N);
    this.heading(T.pdf.detailT, T.pdf.detailNote.replace('{n}', Math.min(N, m.rows.length)).replace('{total}', f.int(m.rows.length)));
    this.table([
      { w: 22, title: T.cols.month, render: r => f.monthYear(r.month) },
      { w: 32, title: T.cols.region, render: r => label(REGIONS, r.region, lang) },
      { w: 38, title: T.cols.domain, render: r => this.dotText(SERIES[r.domain], label(DOMAINS, r.domain, lang)) },
      { w: 22, title: T.cols.processed, align: 'right', render: r => f.int(r.processed) },
      { w: 18, title: T.cols.quality, align: 'right', bold: true, render: r => f.pct(r.quality) },
      { w: 15, title: T.pdf.incShort, align: 'right', render: r => f.int(r.incidents) },
      { w: 31, title: T.cols.status, render: r => this.status(statusQuality(r.quality, m.target)) },
    ], rows, { rowH: 5.8, font: 7.4 });
  }

  method() {
    const { doc, T, f, m } = this;
    this.heading(T.pdf.methodT);
    T.pdf.method.forEach((s, i) => {
      const txt = s.replace('{sla}', f.dec1(SLA.availability)).replace('{target}', f.dec1(m.target));
      this.font('InterSB', 8.4, INK);
      this.need(8);
      this.text(String(i + 1) + '.', PAGE.mx, this.y + 3);
      this.font('Inter', 8.4, INK);
      const lines = doc.splitTextToSize(clean(txt), CW - 7);
      lines.forEach(l => { this.text(l, PAGE.mx + 6, this.y + 3); this.y += 4.3; });
      this.y += 1;
    });
    this.paragraph(T.dataNote, 7.8, MUTED);
    // Блок звернення: один стриманий CTA наприкінці звіту.
    this.y += 4;
    this.need(30);
    const h = 26;
    this.stroke(LINE, 0.3); this.fill(SOFT); doc.rect(PAGE.mx, this.y, CW, h, 'FD');
    this.fill(RUBY); doc.rect(PAGE.mx, this.y, 9, 0.9, 'F');
    this.font('MontSB', 11.5); this.text(T.pdf.contactT, PAGE.mx + 6, this.y + 8);
    this.font('Inter', 8.4, INK);
    const lines = doc.splitTextToSize(clean(T.pdf.contact), CW - 12);
    lines.forEach((l, i) => this.text(l, PAGE.mx + 6, this.y + 13.5 + i * 4.2));
    const url = 'https://www.belyakovconsult.com' + this.ctx.langPrefix + '/cases/data-quality-dashboard/?utm_source=pdf&utm_medium=report&utm_campaign=dashboard-demo';
    this.font('InterSB', 8.4, RUBY);
    doc.textWithLink('belyakovconsult.com', PAGE.mx + 6, this.y + 13.5 + lines.length * 4.2 + 0.6, { url });
    doc.link(PAGE.mx, this.y, CW, h, { url });
    this.y += h + 4;
  }

  footers() {
    const { doc, T } = this;
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      const y = PAGE.h - 9;
      this.stroke(LINE, 0.2); doc.line(PAGE.mx, y - 4, PAGE.w - PAGE.mx, y - 4);
      this.font('Inter', 7, MUTED);
      this.text('Belyakov Consult · belyakovconsult.com · ' + T.pdf.demoBadge, PAGE.mx, y);
      this.text(`${T.pdf.page} ${i} ${T.pdf.of} ${n}`, PAGE.w - PAGE.mx, y, { align: 'right' });
    }
  }
}

export { SECTION_IDS };
