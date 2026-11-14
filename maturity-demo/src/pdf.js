// PDF-звіт самооцінки A4 у світлій темі бренду. jsPDF і шрифти завантажуються лише після натискання кнопки.
// Сторінка 1: рівень, сходинки, профіль (пелюстка і таблиця вимірів), сильні сторони й застереження.
// Сторінка 2: три пріоритети, дорожня карта на 30, 90 і 180 днів, чого не робити, методика і контакт.
import { DIMS, gapShown } from './model.js';

const INK = [5, 7, 10];
const MUTED = [74, 82, 98];
const AXIS = [100, 116, 139];
const LINE = [224, 227, 232];
const SOFT = [244, 246, 248];
const RUBY = [217, 4, 41];
const COBALT = [59, 130, 246];
const STATUS = { healthy: [16, 185, 129], warning: [255, 176, 32], critical: [255, 107, 107], info: [148, 163, 184] };
const mix = (c, a) => c.map(v => Math.round(255 - (255 - v) * a));
const TINT = mix(COBALT, 0.16);

const PAGE = { w: 210, h: 297, mx: 16, top: 16, bottom: 18 };
const CW = PAGE.w - PAGE.mx * 2;

let ready = null;
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
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const b = await r.blob();
  return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); });
}
async function setup(base) {
  if (!ready) {
    ready = (async () => {
      if (!window.jspdf) await loadScript(base + 'vendor/jspdf.umd.min.js');
      const fonts = await Promise.all(['Montserrat-Bold', 'Montserrat-SemiBold', 'Inter-Regular', 'Inter-SemiBold'].map(n => bin(base + 'pdf-fonts/' + n + '.ttf')));
      const logo = await dataUrl(base + 'img/bc-positive.png');
      return { fonts, logo };
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

export async function buildPdf(ctx, base) {
  const { fonts, logo } = await setup(base);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  [['MontB', 0], ['MontSB', 1], ['Inter', 2], ['InterSB', 3]].forEach(([name, i]) => {
    doc.addFileToVFS(name + '.ttf', fonts[i]);
    doc.addFont(name + '.ttf', name, 'normal', undefined, 'Identity-H');
  });
  new Report(doc, ctx, logo).render();
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`Belyakov_Consult_data_maturity_${ctx.lang}_${stamp}.pdf`);
}

const clean = s => String(s ?? '').replace(/ /g, ' ');

class Report {
  constructor(doc, ctx, logo) {
    this.doc = doc; this.ctx = ctx; this.logo = logo;
    this.T = ctx.T; this.P = ctx.T.pdfT; this.f = ctx.f; this.S = ctx.S;
    this.y = PAGE.top;
  }

  font(name, size, color = INK) { this.doc.setFont(name, 'normal'); this.doc.setFontSize(size); this.doc.setTextColor(...color); }
  text(s, x, y, opt) { this.doc.text(clean(s), x, y, opt); }
  width(s) { return this.doc.getTextWidth(clean(s)); }
  fit(s, w) {
    s = clean(s);
    if (this.width(s) <= w) return s;
    while (s.length > 1 && this.width(s + '…') > w) s = s.slice(0, -1);
    return s + '…';
  }
  wrap(s, w, max = 99) {
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
  page() { this.doc.addPage(); this.runningHead(); }
  runningHead() {
    this.font('InterSB', 7.5, MUTED);
    this.text('Belyakov Consult', PAGE.mx, PAGE.top - 4);
    this.font('Inter', 7.5, MUTED);
    this.text(this.P.title, PAGE.w - PAGE.mx, PAGE.top - 4, { align: 'right' });
    this.stroke(LINE, 0.2); this.doc.line(PAGE.mx, PAGE.top - 1.5, PAGE.w - PAGE.mx, PAGE.top - 1.5);
    this.y = PAGE.top + 4;
  }
  heading(title) {
    this.need(22);
    this.y += 3;
    this.fill(RUBY); this.doc.rect(PAGE.mx, this.y, 9, 0.9, 'F');
    this.y += 5.6;
    this.font('MontSB', 12.5); this.text(title, PAGE.mx, this.y);
    this.y += 6;
  }
  // абзац із переносом; повертає висоту
  para(s, x, w, size = 8.4, color = INK, lh = 1.42, fontName = 'Inter') {
    this.font(fontName, size, color);
    const lines = this.wrap(s, w);
    const step = size * 0.3528 * lh;
    lines.forEach((l, i) => this.text(l, x, this.y + step * (i + 0.75)));
    return lines.length * step;
  }
  polygon(pts, style) {
    const [x0, y0] = pts[0];
    const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    this.doc.lines(rel, x0, y0, [1, 1], style, true);
  }

  render() {
    const { T, P } = this;
    this.doc.setProperties({ title: P.title, subject: P.report, author: 'Belyakov Consult', creator: 'belyakovconsult.com', keywords: 'data maturity, data governance, data strategy' });
    this.cover();
    this.level();
    this.profile();
    this.notes();
    this.page();
    this.priorities();
    this.roadmap();
    this.anti();
    this.closing();
    this.footers();
  }

  cover() {
    const { doc, T, P, ctx } = this;
    const lh = 10.5, lw = (lh * 291) / 139;
    doc.addImage(this.logo, 'PNG', PAGE.mx, PAGE.top - 4, lw, lh, 'logo', 'FAST');
    this.stroke([200, 205, 212], 0.25); doc.line(PAGE.mx + lw + 4, PAGE.top - 3.5, PAGE.mx + lw + 4, PAGE.top + 6);
    this.font('MontSB', 10.5); this.text('Belyakov Consult', PAGE.mx + lw + 8, PAGE.top + 0.6);
    this.font('Inter', 7, MUTED); this.text('BI • Data Architecture • Data Governance', PAGE.mx + lw + 8, PAGE.top + 4.6);
    this.font('InterSB', 8, INK); this.text(P.report, PAGE.w - PAGE.mx, PAGE.top + 0.6, { align: 'right' });
    this.font('Inter', 7.5, MUTED); this.text(`${P.generated}: ${ctx.f.date(new Date())}`, PAGE.w - PAGE.mx, PAGE.top + 4.6, { align: 'right' });
    this.y = PAGE.top + 22;
    this.font('MontB', 20); this.text(P.title, PAGE.mx, this.y);
    this.y += 7.5;
    const badge = ctx.shown.kind === 'sample' ? P.sampleBadge : P.badge;
    this.font('InterSB', 7.4, INK);
    const bw = this.width(badge) + 8;
    this.stroke(RUBY, 0.3); doc.roundedRect(PAGE.mx, this.y - 2.2, bw, 6, 1.2, 1.2, 'S');
    this.fill(RUBY); doc.circle(PAGE.mx + 2.8, this.y + 0.8, 0.9, 'F');
    this.text(badge, PAGE.mx + 5, this.y + 1.8);
    this.y += 8;
    const sh = ctx.shown;
    const items = [[P.org, T.orgs[sh.org]], [P.size, sh.size ? T.sizes[sh.size] : T.notSet], [P.amb, T.amb[sh.amb]], [P.answers, P.answersV(32, this.S.unknown)]];
    const colW = CW / items.length;
    this.stroke(LINE, 0.2); doc.line(PAGE.mx, this.y, PAGE.w - PAGE.mx, this.y);
    items.forEach(([k, v], i) => {
      const x = PAGE.mx + colW * i;
      this.font('Inter', 6.8, MUTED); this.text(this.fit(k, colW - 3), x, this.y + 4.4);
      this.font('InterSB', 8, INK); this.text(this.fit(v, colW - 3), x, this.y + 8.6);
    });
    this.y += 12;
    doc.line(PAGE.mx, this.y, PAGE.w - PAGE.mx, this.y);
    this.y += 5;
  }

  // Сходинки 1..5 ліворуч, текст рівня праворуч.
  level() {
    const { doc, T, S, f } = this;
    const L = T.levels[S.level - 1];
    const top = this.y, sw = 10.5, gap = 1.6, base = top + 36;
    for (let l = 1; l <= 5; l++) {
      const x = PAGE.mx + (l - 1) * (sw + gap), h = 7 + (l - 1) * 6.4;
      if (l < S.level) { this.fill(TINT); doc.rect(x, base - h, sw, h, 'F'); }
      else if (l === S.level) { this.fill(COBALT); doc.rect(x, base - h, sw, h, 'F'); }
      else { this.stroke(LINE, 0.3); this.fill([255, 255, 255]); doc.rect(x, base - h, sw, h, 'FD'); }
      this.font('InterSB', 8, l === S.level ? [255, 255, 255] : l < S.level ? COBALT : AXIS);
      this.text(String(l), x + sw / 2, base - h + 4.6, { align: 'center' });
      if (l === S.tLevel) {
        this.stroke(INK, 0.3); doc.line(x + sw - 2.4, base - h - 1, x + sw - 2.4, base - h - 6.4);
        this.fill(RUBY); doc.triangle(x + sw - 2.4, base - h - 6.4, x + sw + 1.4, base - h - 5.2, x + sw - 2.4, base - h - 4, 'F');
      }
    }
    this.font('Inter', 6.6, MUTED);
    this.text(`${T.youAreHere}: ${S.level}  ·  ${T.targetWord}: ${S.tLevel}`, PAGE.mx, base + 4);
    // текст
    const tx = PAGE.mx + 66, tw = CW - 66;
    this.font('Inter', 7.6, MUTED); this.text(`${T.levelWord} ${S.level} ${T.ofFive}`, tx, top + 3);
    this.font('MontB', 17); this.text(L.name, tx, top + 10.5);
    this.font('InterSB', 8.2, INK);
    this.text(`${T.indexWord}: ${f.int(S.index)} ${T.ofHundred}   ·   ${T.avgWord}: ${f.dec1(S.avg)} ${T.ofFive}   ·   ${T.targetWord}: ${f.dec1(S.tAvg)}`, tx, top + 16.5);
    this.y = top + 19;
    this.y += this.para(L.text, tx, tw, 8.3) + 1.2;
    this.fill(RUBY); doc.rect(tx, this.y + 1, 1, 7.5, 'F');
    this.y += this.para(L.next, tx + 3.5, tw - 3.5, 8.3, INK, 1.42, 'InterSB');
    this.y = Math.max(this.y, base + 6) + 2;
  }

  profile() {
    const { doc, T, S, f, P } = this;
    this.heading(P.profile);
    const top = this.y;
    // пелюстка
    const R = 27, cx = PAGE.mx + 38, cy = top + 37;
    const pt = (r, i) => [cx + r * Math.cos(-Math.PI / 2 + (i * Math.PI) / 4), cy + r * Math.sin(-Math.PI / 2 + (i * Math.PI) / 4)];
    for (let l = 1; l <= 5; l++) { this.stroke(LINE, l === 5 ? 0.3 : 0.2); this.polygon(DIMS.map((d, i) => pt((R * l) / 5, i)), 'S'); }
    DIMS.forEach((d, i) => { const [x, y] = pt(R, i); this.stroke(LINE, 0.2); doc.line(cx, cy, x, y); });
    const now = DIMS.map((d, i) => pt((R * S.dims[d].avg) / 5, i));
    this.fill(TINT); this.polygon(now, 'F');
    doc.setLineDashPattern([1.1, 0.9], 0);
    this.stroke(AXIS, 0.35); this.polygon(DIMS.map((d, i) => pt((R * S.target[d]) / 5, i)), 'S');
    doc.setLineDashPattern([], 0);
    this.stroke(COBALT, 0.55); this.polygon(now, 'S');
    now.forEach(([x, y]) => { this.fill(COBALT); doc.circle(x, y, 0.75, 'F'); });
    DIMS.forEach((d, i) => {
      const [x, y] = pt(R + 4.5, i);
      const align = Math.abs(x - cx) < 1 ? 'center' : x > cx ? 'left' : 'right';
      this.font('InterSB', 6.6, INK);
      this.text(T.dims[d].short, x, y + (y < cy - R * 0.6 ? -0.6 : y > cy + R * 0.6 ? 2.6 : 1), { align });
    });
    // легенда
    const ly = cy + R + 13;
    this.fill(COBALT); doc.rect(PAGE.mx + 8, ly - 1.6, 5, 1.6, 'F');
    this.font('Inter', 6.8, MUTED); this.text(T.you, PAGE.mx + 14.5, ly);
    doc.setLineDashPattern([1.1, 0.9], 0); this.stroke(AXIS, 0.4); doc.line(PAGE.mx + 30, ly - 0.8, PAGE.mx + 36, ly - 0.8); doc.setLineDashPattern([], 0);
    this.text(T.target, PAGE.mx + 37.5, ly);

    // таблиця вимірів праворуч
    const tx = PAGE.mx + 82, tw = CW - 82, rowH = 8.4;
    const cols = [['', 30], [P.score, 28], [P.level, 10], [P.target, 10], [P.gap, tw - 78]];
    let x = tx;
    this.fill(SOFT); doc.rect(tx, top, tw, 6, 'F');
    this.font('InterSB', 6.6, MUTED);
    cols.forEach(([h, w]) => { this.text(h, x + 1.5, top + 4); x += w; });
    DIMS.forEach((d, i) => {
      const y = top + 6 + i * rowH;
      const v = S.dims[d];
      if (i % 2) { this.fill([250, 251, 252]); doc.rect(tx, y, tw, rowH, 'F'); }
      this.stroke(LINE, 0.15); doc.line(tx, y + rowH, tx + tw, y + rowH);
      let cx2 = tx;
      this.font('InterSB', 7.4, INK); this.text(this.fit(T.dims[d].short, cols[0][1] - 2), cx2 + 1.5, y + 5.3); cx2 += cols[0][1];
      // смуга 0..5 і риска цілі
      const bw = cols[1][1] - 9;
      this.fill([236, 239, 243]); doc.rect(cx2 + 1.5, y + 3.4, bw, 1.8, 'F');
      this.fill(COBALT); doc.rect(cx2 + 1.5, y + 3.4, (bw * v.avg) / 5, 1.8, 'F');
      this.stroke(INK, 0.45); doc.line(cx2 + 1.5 + (bw * v.target) / 5, y + 2.4, cx2 + 1.5 + (bw * v.target) / 5, y + 6.2);
      this.font('Inter', 7.4, INK); this.text(f.dec1(v.avg), cx2 + cols[1][1] - 0.5, y + 5.3, { align: 'right' }); cx2 += cols[1][1];
      this.text(String(v.level), cx2 + 5, y + 5.3, { align: 'center' }); cx2 += cols[2][1];
      this.text(String(v.target), cx2 + 5, y + 5.3, { align: 'center' }); cx2 += cols[3][1];
      const g = gapShown(v);
      const lv = g <= 0.05 ? 'healthy' : g <= 1 ? 'warning' : 'critical';
      this.fill(STATUS[lv]); doc.circle(cx2 + 3, y + 4.3, 1, 'F');
      this.font('Inter', 7.2, INK); this.text(g <= 0.05 ? T.gapOk : f.dec1(g), cx2 + 5.5, y + 5.3);
    });
    this.y = Math.max(ly + 4, top + 6 + DIMS.length * rowH + 4);
  }

  bullets(items, color = INK, dot = COBALT) {
    items.forEach(([title, text]) => {
      this.font('Inter', 8.2);
      const lines = this.wrap((title ? title + '. ' : '') + text, CW - 10);
      const h = lines.length * 4.1 + 1.6;
      this.need(h);
      this.fill(dot); this.doc.circle(PAGE.mx + 1.2, this.y + 2.1, 0.9, 'F');
      lines.forEach((l, i) => {
        if (i === 0 && title) {
          this.font('InterSB', 8.2, color); this.text(title + '.', PAGE.mx + 4.5, this.y + 3);
          const tw = this.width(title + '. ');
          this.font('Inter', 8.2, color); this.text(l.slice(title.length + 2), PAGE.mx + 4.5 + tw, this.y + 3);
        } else { this.font('Inter', 8.2, color); this.text(l, PAGE.mx + 4.5, this.y + 3 + i * 4.1); }
      });
      this.y += h;
    });
  }

  notes() {
    const { T, P, S, ctx } = this;
    this.heading(P.strong);
    this.bullets(ctx.strong.map(d => [T.dims[d].name, T.dims[d].strong]), INK, STATUS.healthy);
    if (ctx.warn.length) {
      this.heading(P.warn);
      this.bullets(ctx.warn.map(w => [T.warn[w].title, T.warn[w].text]), INK, STATUS.warning);
    }
  }

  priorities() {
    const { doc, T, P, S, f, ctx } = this;
    this.heading(P.prio);
    ctx.pr.forEach((p, i) => {
      const v = S.dims[p.id];
      const why = p.why.map(w => T.why[w](f.dec1(gapShown(v)))).join(' · ');
      this.font('Inter', 8.2);
      const body = this.wrap(p.why.includes('grow') ? T.dims[p.id].strong : T.dims[p.id].weak, CW - 12);
      const h = 15 + body.length * 4;
      this.need(h + 2);
      this.stroke(LINE, 0.25); this.fill([255, 255, 255]); doc.rect(PAGE.mx, this.y, CW, h, 'FD');
      this.fill(i === 0 ? RUBY : COBALT); doc.rect(PAGE.mx, this.y, 0.9, h, 'F');
      this.font('MontB', 13, i === 0 ? RUBY : COBALT); this.text(String(i + 1), PAGE.mx + 4.5, this.y + 7.6);
      this.font('MontSB', 10.5); this.text(T.dims[p.id].name, PAGE.mx + 11, this.y + 6.2);
      this.font('InterSB', 7.6, MUTED);
      this.text(`${p.from} · ${T.levels[p.from - 1].name}  →  ${p.to} · ${T.levels[p.to - 1].name}`, PAGE.w - PAGE.mx - 3, this.y + 6.2, { align: 'right' });
      this.font('Inter', 7.2, MUTED); this.text(this.fit(why, CW - 14), PAGE.mx + 11, this.y + 10.6);
      this.font('Inter', 8.2, INK);
      body.forEach((l, k) => this.text(l, PAGE.mx + 11, this.y + 15 + k * 4));
      this.y += h + 2.4;
    });
  }

  roadmap() {
    const { doc, T, P, ctx } = this;
    this.heading(P.roadmap);
    const gap = 3.5, w = (CW - gap * 2) / 3;
    const cols = [30, 90, 180].map((h, i) => ({ h, items: ctx.pr.map(p => ({ dim: p.id, text: T.dims[p.id].act[p.from][i] })) }));
    this.font('Inter', 7.6);
    const blocks = cols.map(c => c.items.map(it => this.wrap(it.text, w - 6)));
    const hs = blocks.map(b => 11 + b.reduce((a, lines) => a + 4.4 + lines.length * 3.5 + 2.2, 0));
    const h = Math.max(...hs);
    this.need(h + 2);
    cols.forEach((c, ci) => {
      const x = PAGE.mx + ci * (w + gap);
      this.stroke(LINE, 0.25); this.fill(SOFT); doc.rect(x, this.y, w, h, 'FD');
      this.fill(COBALT); doc.rect(x, this.y, 7, 0.8, 'F');
      this.font('MontSB', 10); this.text(T.horizons[c.h][0], x + 3, this.y + 6.4);
      this.font('Inter', 7, MUTED); this.text(T.horizons[c.h][1], x + w - 3, this.y + 6.4, { align: 'right' });
      let y = this.y + 11;
      c.items.forEach((it, k) => {
        this.stroke([190, 197, 207], 0.25); this.fill([255, 255, 255]); doc.rect(x + 3, y - 0.2, 2.6, 2.6, 'FD');
        this.font('InterSB', 6.8, COBALT); this.text(T.dims[it.dim].short, x + 7, y + 2);
        y += 4.4;
        this.font('Inter', 7.6, INK);
        blocks[ci][k].forEach(l => { this.text(l, x + 3, y + 0.6); y += 3.5; });
        y += 2.2;
      });
    });
    this.y += h + 2;
  }

  anti() {
    const { T, P, ctx } = this;
    this.heading(P.anti);
    if (ctx.anti.length) this.bullets(ctx.anti.map(a => ['', T.anti[a]]), INK, RUBY);
    else this.bullets([['', T.antiNone]]);
  }

  closing() {
    const { doc, P, ctx } = this;
    this.y += 1;
    this.font('Inter', 7.4, MUTED);
    const m = this.wrap(P.method, CW);
    this.need(m.length * 3.4 + 34);
    m.forEach((l, i) => this.text(l, PAGE.mx, this.y + 3 + i * 3.4));
    this.y += m.length * 3.4 + 4;
    const h = 24;
    this.stroke(LINE, 0.3); this.fill(SOFT); doc.rect(PAGE.mx, this.y, CW, h, 'FD');
    this.fill(RUBY); doc.rect(PAGE.mx, this.y, 9, 0.9, 'F');
    this.font('MontSB', 11.5); this.text(P.contactT, PAGE.mx + 6, this.y + 8);
    this.font('Inter', 8.2, INK);
    const lines = this.wrap(P.contact, CW - 12);
    lines.forEach((l, i) => this.text(l, PAGE.mx + 6, this.y + 13.2 + i * 4));
    const url = 'https://www.belyakovconsult.com' + ctx.langPrefix + '/cases/data-maturity/?utm_source=pdf&utm_medium=report&utm_campaign=data-maturity';
    this.font('InterSB', 8.2, RUBY);
    doc.textWithLink('belyakovconsult.com', PAGE.mx + 6, this.y + 13.2 + lines.length * 4 + 0.6, { url });
    doc.link(PAGE.mx, this.y, CW, h, { url });
    this.y += h + 3;
  }

  footers() {
    const { doc, P } = this;
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      const y = PAGE.h - 9;
      this.stroke(LINE, 0.2); doc.line(PAGE.mx, y - 4, PAGE.w - PAGE.mx, y - 4);
      this.font('Inter', 7, MUTED);
      this.text('Belyakov Consult · belyakovconsult.com · ' + (this.ctx.shown.kind === 'sample' ? P.sampleBadge : P.badge), PAGE.mx, y);
      this.text(`${P.page} ${i} ${P.of} ${n}`, PAGE.w - PAGE.mx, y, { align: 'right' });
    }
  }
}
