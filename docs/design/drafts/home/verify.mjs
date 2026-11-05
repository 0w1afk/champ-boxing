// Проверка дизайн-артефакта home (S6, контроль после круга 1). Не тестовый код продукта.
// Запуск: node verify.mjs /абсолютный/путь/к/playwright/index.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = await import(process.argv[2]);
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const captures = path.join(here, 'captures');
await mkdir(captures, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://127.0.0.1:58507/docs/design/drafts/home/');
await page.evaluate(() => document.fonts.ready);
const results = { scrollWidths: {}, hook: {}, links: {}, labelInName: {}, labels: {}, prices390: {}, focus: {}, ticker: {}, photos: {}, anchors: {}, errors };

// 1. Хук: 1 rect на строку (1024/1280/1440)
for (const width of [1440, 1024, 1280]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const lines = await page.evaluate(() => {
    const hook = document.querySelector('h1');
    const fs = parseFloat(getComputedStyle(hook).fontSize);
    return [...hook.querySelectorAll('.hook-line')].map((l) => {
      const range = document.createRange();
      range.selectNodeContents(l);
      return [...range.getClientRects()].filter((r) => r.width > 1).length;
    });
  });
  results.hook[width] = lines;
  if (lines.some((n) => n !== 1)) throw new Error(`Хук на ${width}: ` + JSON.stringify(lines));
}

// 2. scrollWidth = вьюпорт (1440/390 обязательны) + снимки
for (const width of [1440, 1024, 768, 390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  results.scrollWidths[width] = sw;
  if (sw > width) throw new Error(`Переполнение на ${width}: ${sw}`);
  await page.screenshot({ path: path.join(captures, `overview-${width}.png`), fullPage: true });
}

// 3. Ссылки записи: wa.me/tel
results.links = await page.evaluate(() => {
  const flame = [...document.querySelectorAll('main a[class*="bg-flame"], header a[class*="bg-flame"], footer a[class*="bg-flame"]')];
  const wa = [...document.querySelectorAll('a[href^="https://wa.me/79144234555"]')];
  const tel = [...document.querySelectorAll('a[href="tel:+79144234555"]')];
  const badFlame = flame.filter((a) => !a.href.startsWith('https://wa.me/79144234555')).length;
  const waWithText = wa.filter((a) => a.href.includes('text=')).length;
  const stubs = [...document.querySelectorAll('a[href="#"]')].map((a) => a.textContent.trim().slice(0, 30));
  return { flame: flame.length, wa: wa.length, waWithText, tel: tel.length, badFlame, stubs };
});
if (results.links.badFlame) throw new Error('bg-flame без wa.me');
if (results.links.waWithText !== 7) throw new Error('wa.me с текстом: ' + results.links.waWithText);
if (results.links.telCount < 6) throw new Error('tel-ссылок: ' + results.links.telCount);

// 4. Label in Name карточек тренера (контроль круга 2):
// видимый текст ⊆ доступное имя; имя следует за состоянием (display:none исключается из accname)
await page.setViewportSize({ width: 1440, height: 1000 });
results.labelInName = await page.evaluate(() => {
  const out = [];
  for (const details of [...document.querySelectorAll('#coaches article details')]) {
    const name = details.closest('article').querySelector('h3').textContent.trim();
    const summary = details.querySelector('summary');
    // Модель accname: спаны с display:none исключаются; sr-only (clip) участвует
    const accName = [...summary.querySelectorAll('span')]
      .filter((s) => getComputedStyle(s).display !== 'none')
      .map((s) => s.textContent.trim())
      .join('')
      .replace(/\s+/g, ' ').trim();
    const visibleNow = [...summary.querySelectorAll('span')]
      .filter((s) => getComputedStyle(s).display !== 'none' && !s.classList.contains('sr-only'))
      .map((s) => s.textContent.trim()).join('');
    const stateText = details.open ? 'Закрыть карточку тренера' : 'Подробнее о тренере';
    out.push({
      name,
      open: details.open,
      accName,
      visibleName: visibleNow,
      containsVisible: accName.includes(visibleNow),
      nameMatchesState: accName === `${stateText}: ${name}`,
      visibleMatchesState: visibleNow === stateText,
    });
  }
  return out;
});
for (const c of results.labelInName) {
  if (!(c.containsVisible && c.nameMatchesState && c.visibleMatchesState)) throw new Error('Label in Name: ' + JSON.stringify(c));
}

// 5. Дубли меток у раскрытий отсутствуют; сцены имеют метки
results.labels = await page.evaluate(() => {
  const eyebrowOf = (id) => {
    const h2 = document.querySelector(`${id} h2`);
    let prev = h2.previousElementSibling;
    return prev ? prev.textContent.trim() : null;
  };
  return {
    start: eyebrowOf('#start'),
    prices: eyebrowOf('#prices'),
    faq: eyebrowOf('#faq'),
    experience: eyebrowOf('#experience'),
    formats: eyebrowOf('#formats'),
    coaches: eyebrowOf('#coaches'),
    contacts: eyebrowOf('#contacts'),
  };
});
if (results.labels.start || results.labels.prices || results.labels.faq) throw new Error('Дубли меток: ' + JSON.stringify(results.labels));
for (const [id, expect] of [['#experience', true], ['#formats', true], ['#coaches', true], ['#contacts', true]]) {
  if (!results.labels[id.slice(1)]) throw new Error('Нет метки у сцены ' + id);
}

// 6. Цены на 390: блоки с полными подписями; таблица скрыта
await page.setViewportSize({ width: 390, height: 844 });
results.prices390 = await page.evaluate(() => {
  const table = document.querySelector('#prices table');
  const blocks = document.querySelector('#prices ul');
  const body = document.body.textContent;
  return {
    tableHidden: getComputedStyle(table.closest('div')).display === 'none',
    blocksVisible: getComputedStyle(blocks).display !== 'none',
    fullLabel: ['Разовое занятие — 700\u00a0₽', 'Разовое занятие — 1\u00a0400\u00a0₽', 'Разовое занятие — 2\u00a0000\u00a0₽'].every((n) => body.includes(n)),
    shortLabel: !body.includes('Разовое — '),
    allNumbers: ['20\u00a0000\u00a0₽', '14\u00a0000\u00a0₽'].every((n) => body.includes(n)),
  };
});
if (!Object.values(results.prices390).every(Boolean)) throw new Error('Цены 390: ' + JSON.stringify(results.prices390));

// 7. Фокус-токен на всех интерактивных, включая skip-link
await page.setViewportSize({ width: 1440, height: 1000 });
results.focus = await page.evaluate(() => {
  const els = [...document.querySelectorAll('main a, main button:not([disabled]), main summary, header a, header button, footer a, body > a[href="#main"]')];
  const missing = els.filter((el) => !el.className.includes('focus-visible:outline'));
  const skip = document.querySelector('a[href="#main"]');
  return { total: els.length, missing: missing.length, skipHasToken: skip.className.includes('focus-visible:outline-bright') };
});
if (results.focus.missing > 0 || !results.focus.skipHasToken) throw new Error('Фокус-токен: ' + JSON.stringify(results.focus));

// 8. Тикер: 8 фактов + пауза
const TICKER = [
  'Первое занятие в группе — бесплатно, кроме мини-групп',
  'Спарринги — только по желанию',
  'Пять тренеров: два мастера спорта и три кандидата в мастера спорта',
  'Абонемент на 12 занятий действует 45 дней',
  'Мини-группа — до 5 человек',
  'Детская группа — с 7 лет',
  'Хабаровск, Восточное шоссе, 41, 3 этаж',
  'Индивидуальная пробная — 1 500 ₽',
];
results.ticker.facts = (await page.evaluate((items) => items.map((t) => document.body.textContent.includes(t)), TICKER)).filter(Boolean).length;
if (results.ticker.facts !== 8) throw new Error('Тикер: ' + results.ticker.facts + '/8');
await page.locator('#ticker-toggle').scrollIntoViewIfNeeded();
await page.locator('#ticker-toggle').click();
results.ticker.toggle = await page.evaluate(() => document.getElementById('ticker-marquee').style.animationPlayState);
if (results.ticker.toggle !== 'paused') throw new Error('Пауза тикера');

// 9. Фото тренеров
results.photos = await page.evaluate(() => [...document.querySelectorAll('#coaches img')].map((img) => img.complete && img.naturalWidth > 0));
if (results.photos.length !== 5 || results.photos.some((p) => !p)) throw new Error('Фото: ' + JSON.stringify(results.photos));

// 10. Якоря
results.anchors = await page.evaluate(() => ['top', 'experience', 'formats', 'coaches', 'start', 'prices', 'faq', 'contacts', 'main'].map((id) => !!document.getElementById(id)));
if (results.anchors.some((a) => !a)) throw new Error('Якоря');

// 11. NBSP нормализация G4 + единственный JS
const g4 = await readFile(path.join(repo, 'docs/copy/home.md'), 'utf-8');
const html = await readFile(path.join(here, 'index.html'), 'utf-8');
results.nbspG4 = g4.includes('1\u00a0400\u00a0₽') && g4.includes('14\u00a0000\u00a0₽');
results.scripts = (html.match(/<script(?![^>]*src=)[^>]*>/g) || []).length;
if (!results.nbspG4 || results.scripts !== 2) throw new Error('NBSP G4 / скрипты');

await browser.close();
await writeFile(path.join(here, 'verify-result.json'), JSON.stringify(results, null, 2));
console.log('VERIFY OK');
console.log(JSON.stringify({
  scrollWidths: results.scrollWidths,
  hookRects: results.hook,
  links: results.links,
  labelInName: results.labelInName,
  labels: results.labels,
  prices390: results.prices390,
  focus: results.focus,
  ticker: { facts: results.ticker.facts, toggle: results.ticker.toggle },
  photosOk: results.photos.filter(Boolean).length + '/5',
  anchorsOk: results.anchors.filter(Boolean).length + '/9',
  nbspG4: results.nbspG4,
  inlineScripts: results.scripts,
  errors: results.errors,
}, null, 2));
