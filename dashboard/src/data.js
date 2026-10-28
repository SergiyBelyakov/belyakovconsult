// Синтетичний набір даних і всі розрахунки дашборду.
// Дані детерміновані: однакові на кожному відкритті, без персональних даних.

export const DOMAINS = [
  { id: 'registry', short: 'REG', uk: 'Державні реєстри', en: 'Public registries', pt: 'Registos públicos' },
  { id: 'finance', short: 'FIN', uk: 'Фінансові потоки', en: 'Financial flows', pt: 'Fluxos financeiros' },
  { id: 'health', short: 'MED', uk: 'Охорона здоров’я', en: 'Healthcare', pt: 'Saúde' },
  { id: 'operations', short: 'OPS', uk: 'Операційні дані', en: 'Operations', pt: 'Operações' },
  { id: 'geo', short: 'GIS', uk: 'Геопросторові дані', en: 'Geospatial data', pt: 'Dados geoespaciais' },
];

export const REGIONS = [
  { id: 'kyiv', uk: 'м. Київ', en: 'Kyiv City', pt: 'Kyiv (cidade)' },
  { id: 'lviv', uk: 'Львівська', en: 'Lviv', pt: 'Lviv' },
  { id: 'dnipro', uk: 'Дніпропетровська', en: 'Dnipropetrovsk', pt: 'Dnipropetrovsk' },
  { id: 'odesa', uk: 'Одеська', en: 'Odesa', pt: 'Odesa' },
  { id: 'kharkiv', uk: 'Харківська', en: 'Kharkiv', pt: 'Kharkiv' },
  { id: 'volyn', uk: 'Волинська', en: 'Volyn', pt: 'Volyn' },
];

// Каталог джерел: одне джерело на напрям. Атрибути умовні, для демонстрації.
export const SOURCES = {
  registry: { system: { uk: 'Реєстр отримувачів послуг', en: 'Service recipients register', pt: 'Registo de beneficiários' }, mode: 'api', freq: 'daily', owner: { uk: 'Департамент соціальних послуг', en: 'Social services department', pt: 'Departamento de serviços sociais' } },
  finance: { system: { uk: 'Платежі та виплати', en: 'Payments and disbursements', pt: 'Pagamentos e desembolsos' }, mode: 'sftp', freq: 'daily', owner: { uk: 'Фінансовий департамент', en: 'Finance department', pt: 'Departamento financeiro' } },
  health: { system: { uk: 'Облік медичних послуг', en: 'Health services records', pt: 'Registo de serviços de saúde' }, mode: 'api', freq: 'hourly', owner: { uk: 'Управління охорони здоров’я', en: 'Health administration', pt: 'Administração de saúde' } },
  operations: { system: { uk: 'Операційний облік звернень', en: 'Case management system', pt: 'Sistema de gestão de casos' }, mode: 'db', freq: 'hourly', owner: { uk: 'Операційний відділ', en: 'Operations unit', pt: 'Unidade de operações' } },
  geo: { system: { uk: 'ГІС-шари та адресний довідник', en: 'GIS layers and address gazetteer', pt: 'Camadas SIG e diretório de moradas' }, mode: 'file', freq: 'weekly', owner: { uk: 'Відділ геоінформації', en: 'Geoinformation unit', pt: 'Unidade de geoinformação' } },
};

export const SLA = { availability: 99.0, availabilityCritical: 98.0, latency: 250 };
export const DEFAULT_TARGET = 97.0;

export const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 10 + i, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
});

// Умовні аномалії, щоб на демо було що знаходити: збій якості, проблема інтеграції, разовий провал.
const ANOMALIES = [
  { month: '2026-08', region: 'odesa', domain: 'health', quality: 0.938, incidents: 19 },
  { month: '2026-09', region: 'odesa', domain: 'health', quality: 0.951, incidents: 11 },
  { month: '2026-06', region: 'kharkiv', domain: 'geo', availability: 96.4, latency: 410, incidents: 6 },
  { month: '2026-07', region: 'kharkiv', domain: 'geo', availability: 97.6, latency: 330 },
  { month: '2026-03', region: 'volyn', domain: 'finance', quality: 0.954, incidents: 9 },
  { month: '2026-01', region: 'dnipro', domain: 'registry', availability: 97.9, latency: 295 },
];

export function demoRows() {
  const rows = [];
  MONTHS.forEach((month, m) => REGIONS.forEach((reg, r) => DOMAINS.forEach((dom, d) => {
    const processed = Math.floor((27500 + d * 7300 + r * 4600) * (1 + m * 0.043) * (1 + Math.sin((m + 2 * r + d) * 1.19) * 0.13));
    let q = Math.max(0.955, Math.min(0.995, 0.972 + d * 0.0026 - r * 0.0008 + Math.sin(m * 0.7 + d + r) * 0.0085));
    let incidents = Math.max(0, Math.round((1 - q) * 120 + ((m * r + d) % 5) - 2));
    let latency = Math.round(92 + ((r * 17 + d * 31 + m * 14) % 110));
    let availability = Number(Math.min(99.98, 99.05 + ((m * 7 + d * 11 + r * 3) % 10) / 11).toFixed(2));
    const a = ANOMALIES.find(x => x.month === month && x.region === reg.id && x.domain === dom.id);
    if (a) {
      if (a.quality) q = a.quality;
      if (a.incidents) incidents += a.incidents;
      if (a.latency) latency = a.latency;
      if (a.availability) availability = a.availability;
    }
    rows.push({ month, region: reg.id, domain: dom.id, processed, valid: Math.floor(processed * q), incidents, latency, availability });
  })));
  return rows;
}

export const COLUMNS = ['month', 'region', 'domain', 'processed', 'valid', 'incidents', 'latency', 'availability'];

const SUM = (a, k) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
export const pct = (a, b) => (b ? (100 * a) / b : 0);

export function label(list, id, lang) {
  const o = list.find(x => x.id === id);
  return o ? o[lang] || o.uk : id;
}

export function totals(rows) {
  const vol = SUM(rows, 'processed');
  const valid = SUM(rows, 'valid');
  const inc = SUM(rows, 'incidents');
  const avail = rows.length ? SUM(rows, 'availability') / rows.length : 0;
  const latency = rows.length ? SUM(rows, 'latency') / rows.length : 0;
  return { vol, valid, invalid: vol - valid, inc, avail, latency, quality: pct(valid, vol), rows: rows.length, incRate: vol ? (inc / vol) * 100000 : 0 };
}

export function monthsOf(rows) {
  return Array.from(new Set(rows.map(x => x.month))).sort();
}

export function byMonth(rows) {
  return monthsOf(rows).map(month => ({ month, ...totals(rows.filter(x => x.month === month)) }));
}

export function byDim(rows, key, list) {
  return list.map(d => ({ ...d, ...totals(rows.filter(x => x[key] === d.id)) }));
}

export function matrix(rows, metric = 'quality') {
  return REGIONS.map(r => ({
    region: r.id,
    cells: DOMAINS.map(d => {
      const t = totals(rows.filter(x => x.region === r.id && x.domain === d.id));
      return { domain: d.id, value: t.rows ? t[metric] : null, t };
    }),
  }));
}

export function growth(months) {
  if (months.length < 2) return 0;
  const a = months[0], b = months[months.length - 1];
  return a.vol ? ((b.vol - a.vol) / a.vol) * 100 : 0;
}

export function statusQuality(q, target) {
  if (q >= target) return 'healthy';
  if (q >= target - 1) return 'warning';
  return 'critical';
}

export function statusAvailability(a) {
  if (a >= SLA.availability) return 'healthy';
  if (a >= SLA.availabilityCritical) return 'warning';
  return 'critical';
}

export function filterRows(all, { period, region, domain, search }, lang) {
  const months = monthsOf(all).slice(-period);
  const q = (search || '').trim().toLowerCase();
  return all.filter(x => months.includes(x.month)
    && (region === 'all' || x.region === region)
    && (domain === 'all' || x.domain === domain)
    && (!q || [x.month, x.region, x.domain, label(REGIONS, x.region, lang), label(DOMAINS, x.domain, lang)]
      .some(s => String(s).toLowerCase().includes(q))));
}

// Сегменти «місяць × регіон × напрям» нижче цільового рівня, від найгіршого.
export function exceptions(rows, target) {
  return rows
    .map(r => ({ ...r, quality: pct(r.valid, r.processed) }))
    .filter(r => r.quality < target || r.availability < SLA.availability || r.latency > SLA.latency)
    .map(r => ({ ...r, severity: Math.max(0, target - r.quality) + Math.max(0, SLA.availability - r.availability) + Math.max(0, r.latency - SLA.latency) / 100 }))
    .sort((a, b) => b.severity - a.severity);
}

// Автоматичні висновки за поточною вибіркою. Повертає структуровані сигнали, текст формує i18n.
export function signals(rows, target) {
  if (!rows.length) return [];
  const t = totals(rows);
  const months = byMonth(rows);
  const out = [];
  const m = matrix(rows, 'quality').flatMap(r => r.cells.map(c => ({ region: r.region, ...c }))).filter(c => c.value != null);
  const worst = [...m].sort((a, b) => a.value - b.value)[0];
  if (worst && worst.value < target) out.push({ kind: 'worstSegment', level: statusQuality(worst.value, target), region: worst.region, domain: worst.domain, value: worst.value, avg: t.quality });
  const seg = exceptions(rows, target).filter(r => r.quality < target - 1)[0];
  if (seg) out.push({ kind: 'qualityDrop', level: 'critical', month: seg.month, region: seg.region, domain: seg.domain, value: seg.quality, incidents: seg.incidents });
  const avail = [...rows].sort((a, b) => a.availability - b.availability)[0];
  if (avail && avail.availability < SLA.availability) out.push({ kind: 'availability', level: statusAvailability(avail.availability), month: avail.month, region: avail.region, domain: avail.domain, value: avail.availability, latency: avail.latency });
  const dom = byDim(rows, 'domain', DOMAINS).filter(d => d.rows);
  const best = [...dom].sort((a, b) => b.quality - a.quality)[0];
  if (best) out.push({ kind: 'bestDomain', level: 'healthy', domain: best.id, value: best.quality });
  if (months.length > 1) out.push({ kind: 'growth', level: 'info', value: growth(months), from: months[0].month, to: months[months.length - 1].month });
  const reg = byDim(rows, 'region', REGIONS).filter(r => r.rows).sort((a, b) => b.vol - a.vol)[0];
  if (reg) out.push({ kind: 'topRegion', level: 'info', region: reg.id, value: reg.vol, share: pct(reg.vol, t.vol) });
  return out;
}

export function toCSV(rows) {
  return [COLUMNS.join(','), ...rows.map(x => COLUMNS.map(k => String(x[k] ?? '')).join(','))].join('\r\n');
}

export function parseCSV(text) {
  const txt = String(text).replace(/^﻿/, '').replace(/\r/g, '').trim();
  const lines = txt.split('\n').filter(Boolean);
  if (lines.length < 2) throw new Error('empty');
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const cols = lines.shift().split(sep).map(x => x.trim().toLowerCase());
  if (!COLUMNS.every(c => cols.includes(c))) throw new Error('fields');
  return lines.map((line, i) => {
    const cells = line.split(sep);
    const o = {};
    cols.forEach((k, j) => { o[k] = (cells[j] || '').trim(); });
    ['processed', 'valid', 'incidents', 'latency', 'availability'].forEach(k => { o[k] = Number(String(o[k]).replace(',', '.')); });
    const bad = !/^\d{4}-\d{2}$/.test(o.month) || !Number.isFinite(o.processed) || o.processed < 0 || !(o.valid >= 0) || o.valid > o.processed
      || !(o.availability >= 0 && o.availability <= 100) || !(o.incidents >= 0) || !(o.latency >= 0)
      || !REGIONS.some(r => r.id === o.region) || !DOMAINS.some(d => d.id === o.domain);
    if (bad) throw new Error('row ' + (i + 2));
    return o;
  });
}
