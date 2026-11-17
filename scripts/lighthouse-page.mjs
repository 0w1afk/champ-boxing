// Страница /lighthouse: сводка двух отчётов Lighthouse (мобильный и десктопный).
//
//   node scripts/lighthouse-page.mjs <каталог-с-отчётами> <адрес-сайта>
//
// В каталоге ожидаются mobile.report.json / mobile.report.html и такие же desktop.*
// (так их пишет `lighthouse --output=json --output=html --output-path=<каталог>/mobile`).
// Скрипт собирает index.html с оценками и метриками Core Web Vitals, рядом кладёт
// полные отчёты как mobile.html и desktop.html. Никаких внешних запросов у страницы нет.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [dir = 'lighthouse', site = ''] = process.argv.slice(2);

const CATEGORIES = [
  ['performance', 'Скорость'],
  ['accessibility', 'Доступность'],
  ['best-practices', 'Практики'],
  ['seo', 'SEO'],
];

const METRICS = [
  ['first-contentful-paint', 'FCP · первая отрисовка'],
  ['largest-contentful-paint', 'LCP · основной контент'],
  ['speed-index', 'Speed Index'],
  ['total-blocking-time', 'TBT · блокировка'],
  ['cumulative-layout-shift', 'CLS · сдвиги вёрстки'],
];

const FORMS = [
  ['mobile', 'Мобильный'],
  ['desktop', 'Десктоп'],
];

const escape = (value) =>
  String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

function readReport(form) {
  for (const name of [`${form}.report.json`, `${form}.json`]) {
    const file = path.join(dir, name);
    if (!existsSync(file)) continue;
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function scoreGrade(score) {
  if (score >= 90) return ['good', 'хорошо'];
  if (score >= 50) return ['ok', 'средне'];
  return ['bad', 'плохо'];
}

function milliseconds(value) {
  if (!Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace('.', ',')} с` : `${Math.round(value)} мс`;
}

function metricValue(audit) {
  if (!audit) return '—';
  if (audit.id === 'cumulative-layout-shift' || audit.scoreDisplayMode === 'numeric') {
    const numeric = audit.numericValue;
    if (!Number.isFinite(numeric)) return '—';
    return audit.id === 'cumulative-layout-shift' ? numeric.toFixed(2).replace('.', ',') : milliseconds(numeric);
  }
  return '—';
}

const reports = Object.fromEntries(FORMS.map(([form]) => [form, readReport(form)]));
const captured = Object.values(reports).find(Boolean);
const capturedAt = captured?.fetchTime ? new Date(captured.fetchTime) : null;

function formatDate(date) {
  return date
    ? date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
    : '—';
}

function scoreBlock(score) {
  if (!Number.isFinite(score)) return '<span class="score score-empty">—</span>';
  const rounded = Math.round(score);
  const [grade] = scoreGrade(rounded);
  return `<span class="score score-${grade}">${rounded}<span class="sr"> баллов</span></span>`;
}

function categoryTable(report) {
  const rows = CATEGORIES.map(([key, label]) => {
    const score = Math.round((report?.categories?.[key]?.score ?? NaN) * 100);
    const [, word] = Number.isFinite(score) ? scoreGrade(score) : ['bad', 'нет данных'];
    return `<tr><th scope="row">${label}</th><td>${scoreBlock(score)}</td><td class="verdict">${word}</td></tr>`;
  }).join('');
  return `<table><caption class="sr">Оценки по категориям</caption><tbody>${rows}</tbody></table>`;
}

function metricTable(report) {
  const rows = METRICS.map(([key, label]) => {
    const audit = report?.audits?.[key];
    return `<tr><th scope="row">${label}</th><td class="value">${metricValue(audit)}</td></tr>`;
  }).join('');
  return `<table><caption class="sr">Ключевые метрики</caption><tbody>${rows}</tbody></table>`;
}

function card(form, title, report) {
  const hasReport = Boolean(report);
  const link = hasReport && existsSync(path.join(dir, `${form}.html`))
    ? `<p class="report"><a href="${form}.html">Полный отчёт · ${title.toLowerCase()}</a></p>`
    : '';
  return `<section class="card" aria-labelledby="h-${form}">
      <h2 id="h-${form}">${title}</h2>
      ${hasReport ? `${categoryTable(report)}${metricTable(report)}${link}` : '<p class="empty">Отчёта пока нет — он появится после ближайшего деплоя.</p>'}
    </section>`;
}

for (const [form] of FORMS) {
  const source = path.join(dir, `${form}.report.html`);
  if (existsSync(source)) copyFileSync(source, path.join(dir, `${form}.html`));
}

const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Метрики Lighthouse · ${escape(new URL(site || 'https://example.com').host)}</title>
    <style>
      :root { color-scheme: dark; --ink: #ece7df; --muted: #a9a39a; --line: #2b2926; --bg: #111110; --good: #83d6ac; --ok: #f5cb36; --bad: #ff9fbd; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: clamp(1.5rem, 5vw, 4rem) 1.25rem 4rem; background: var(--bg); color: var(--ink);
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; line-height: 1.55; }
      main { width: 100%; max-width: 60rem; margin: 0 auto; }
      .kicker { margin: 0 0 1rem; font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
      h1 { margin: 0 0 0.75rem; font-size: clamp(1.75rem, 5vw, 2.75rem); line-height: 1.05; letter-spacing: -0.03em; font-weight: 500; }
      .lead { margin: 0 0 2.5rem; color: var(--muted); max-width: 44rem; }
      .grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
      .card { border: 1px solid var(--line); padding: 1.25rem 1.25rem 1.5rem; }
      h2 { margin: 0 0 1rem; font-size: 1rem; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
      table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
      table + table { margin-top: 1rem; }
      th, td { text-align: left; padding: 0.45rem 0; border-bottom: 1px solid var(--line); font-weight: 400; }
      th { color: var(--muted); }
      td { text-align: right; }
      td.verdict { color: var(--muted); width: 5rem; }
      .score { display: inline-block; min-width: 2.75rem; padding: 0.1rem 0.35rem; text-align: center; font-weight: 600; color: #111110; }
      .score-good { background: var(--good); }
      .score-ok { background: var(--ok); }
      .score-bad { background: var(--bad); }
      .score-empty { color: var(--muted); }
      .value { font-variant-numeric: tabular-nums; }
      .report { margin: 1.25rem 0 0; }
      a { color: var(--ink); text-underline-offset: 0.25em; }
      a:hover, a:focus-visible { text-decoration-thickness: 2px; }
      a:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
      .note { margin: 2.5rem 0 0; padding-top: 1.25rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--muted); }
      .sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    </style>
  </head>
  <body>
    <main>
      <p class="kicker">${escape(new URL(site || 'https://example.com').host)}</p>
      <h1>Метрики Lighthouse</h1>
      <p class="lead">
        Мобильный и десктопный прогоны этой сборки. Снято автоматически при деплое${capturedAt ? `, ${escape(formatDate(capturedAt))} по Москве` : ''}.
        Оценки — от 0 до 100, зелёные от 90, жёлтые от 50.
      </p>
      <div class="grid">
        ${card('mobile', 'Мобильный', reports.mobile)}
        ${card('desktop', 'Десктоп', reports.desktop)}
      </div>
      <p class="note">
        ${captured?.lighthouseVersion ? `Lighthouse ${escape(captured.lighthouseVersion)}. ` : ''}
        Страница и отчёты закрыты от индексации. Сайт — тестовая сборка zimorodok-dev.
      </p>
    </main>
  </body>
</html>
`;

writeFileSync(path.join(dir, 'index.html'), html);
console.log(`lighthouse: страница собрана в ${path.join(dir, 'index.html')}`);
