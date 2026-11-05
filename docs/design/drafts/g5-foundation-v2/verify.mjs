// Одноразовая проверка дизайн-артефакта после правок по ревью (круг 2). Не тестовый код продукта.
// Запуск: node verify.mjs /абсолютный/путь/к/playwright/index.mjs
// Проверяет: хук — 1 rect у каждой строки на 1024/1280/1440; scrollWidth = вьюпорт на
// 1024/1280/1440/768/390; контурное слово вне текста и кнопок; полный тикер из 8 фактов;
// NBSP в биографиях; active:bg-press на живых кнопках; доступные имена; кнопку паузы тикера.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = await import(process.argv[2]);
const here = path.dirname(fileURLToPath(import.meta.url));
const captures = path.join(here, 'captures');
await mkdir(captures, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://127.0.0.1:58506/');
await page.evaluate(() => document.fonts.ready);
const results = { hook: {}, scrollWidths: [], contourOverlap: null, mobileTicker: {}, biosNbsp: {}, activePress: 0, h1Measured1440: null, aria: {}, tickerToggle: null, errors };

// Проверка хука: у каждой строки ровно 1 line-box (Range.getClientRects без нулевых)
const hookLineInfo = () => {
  const hook = document.querySelector('#hook-desktop');
  const fs = parseFloat(getComputedStyle(hook).fontSize);
  const col = Math.round(hook.parentElement.getBoundingClientRect().width);
  const lines = [...hook.querySelectorAll('.hook-line')].map((l) => {
    const range = document.createRange();
    range.selectNodeContents(l);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1);
    return { text: l.textContent.trim(), rects: rects.length, height: Math.round(rects[0].height), width: Math.round(rects[0].width) };
  });
  return { fontSize: fs, columnWidth: col, lines };
};

// 1. Хук: 1024 / 1280 / 1440 — по одному rect на строку
for (const width of [1024, 1280, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const info = await page.evaluate(hookLineInfo);
  results.hook[width] = info;
  const bad = info.lines.filter((l) => l.rects !== 1);
  if (bad.length) throw new Error(`Хук на ${width} не в две строки: ` + JSON.stringify(info));
}

// 2. scrollWidth = ширина вьюпорта
for (const width of [1440, 1280, 1024, 768, 390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const m = await page.evaluate((w) => ({ viewport: w, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth }), width);
  results.scrollWidths.push(m);
  if (m.scrollWidth > width) throw new Error(`Горизонтальное переполнение на ${width}: scrollWidth ${m.scrollWidth}`);
  await page.screenshot({ path: path.join(captures, `overview-${width}.png`), fullPage: true });
}

// 3. Контурное слово не пересекает текст и кнопки (desktop 1440)
await page.setViewportSize({ width: 1440, height: 1000 });
results.contourOverlap = await page.evaluate(() => {
  const word = document.querySelector('#contour-desktop').getBoundingClientRect();
  const targets = ['#cta-desktop', '#hook-desktop'].map((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    const overlap = !(word.right < r.left || word.left > r.right || word.bottom < r.top || word.top > r.bottom);
    return { selector: s, overlap };
  });
  return { word: { top: Math.round(word.top), left: Math.round(word.left) }, targets };
});
if (results.contourOverlap.targets.some((t) => t.overlap)) throw new Error('Контурное слово пересекает текст/кнопки');

// 4. Полный тикер из 8 фактов (тексты G4) — на 390 и 1440
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
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  results.mobileTicker[width] = await page.evaluate((items) => {
    const body = document.body.textContent;
    return items.map((t) => ({ fact: t.slice(0, 28) + '…', present: body.includes(t) }));
  }, TICKER);
  const missing = results.mobileTicker[width].filter((x) => !x.present);
  if (missing.length) throw new Error(`Тикер на ${width}: нет фактов ` + JSON.stringify(missing));
}

// 5. NBSP в биографиях тренеров: 3/4/4/5/5 — дословно из G4
results.biosNbsp = await page.evaluate(() => {
  const NB = '\u00a0';
  const expected = {
    'Евгений Лелеков': [`${NB}`, 3],
    'Виктор Кириченко': [`${NB}`, 4],
    'Константин Касьянов': [`${NB}`, 4],
    'Виктор Мартынов': [`${NB}`, 5],
    'Роман Ефанов': [`${NB}`, 5],
  };
  const out = {};
  for (const name of Object.keys(expected)) {
    const row = [...document.querySelectorAll('#components h3')].find((h) => h.textContent.trim() === name);
    if (!row) { out[name] = 'нет строки'; continue; }
    const bio = row.parentElement.querySelector('p.text-sm, p[class*="col-span-12"]').textContent;
    out[name] = (bio.match(new RegExp(NB, 'g')) || []).length;
  }
  return out;
});
const expectedCounts = { 'Евгений Лелеков': 3, 'Виктор Кириченко': 4, 'Константин Касьянов': 4, 'Виктор Мартынов': 5, 'Роман Ефанов': 5 };
for (const [name, need] of Object.entries(expectedCounts)) {
  if (results.biosNbsp[name] !== need) throw new Error(`NBSP у «${name}»: ${results.biosNbsp[name]}, ожидается ${need}`);
}

// 6. active:bg-press на всех живых flame-кнопках
results.activePress = await page.evaluate(() => document.querySelectorAll('a[class*="active:bg-press"][class*="bg-flame"]').length);
if (results.activePress !== 5) throw new Error('active:bg-press на ' + results.activePress + ' из 5 кнопок');

// 7. Фактический размер h1-образца на 1440 (подпись шкалы = факт)
await page.setViewportSize({ width: 1440, height: 1000 });
results.h1Measured1440 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#type .grid')];
  const h1row = rows.find((r) => r.textContent.includes('Начни в своём темпе.'));
  return Math.round(parseFloat(getComputedStyle(h1row.querySelector('div.lg\\:col-span-9, div[class*="lg:col-span-9"]')).fontSize));
});
if (results.h1Measured1440 !== 60) throw new Error('h1 на 1440 = ' + results.h1Measured1440 + ', подпись обещает 60');

// 8. Доступные имена
results.aria = await page.evaluate(() => {
  const logos = [...document.querySelectorAll('a[aria-label="CHAMP BOXING CLUB — на главную"]')].length;
  const coachLinks = [...document.querySelectorAll('a[aria-label^="Подробнее о тренере:"]')].length;
  const groups = [...document.querySelectorAll('[role="group"][aria-labelledby]')].length;
  const closeDisclosure = document.querySelector('button[aria-label="Закрыть: Частые вопросы"]') !== null;
  const wrongLogo = [...document.querySelectorAll('a[aria-label*="на главная"]')].length;
  const strokeHidden = [...document.querySelectorAll('.text-stroke-faint')].every((el) => el.closest('[aria-hidden="true"]') !== null || el.getAttribute('aria-hidden') === 'true');
  return { logos, coachLinks, groups, closeDisclosure, wrongLogo, strokeHidden, h3inRows: document.querySelectorAll('#components h3').length };
});
if (results.aria.logos !== 2 || results.aria.wrongLogo !== 0) throw new Error('Имя логотипа: ' + JSON.stringify(results.aria));
if (results.aria.coachLinks !== 5 || results.aria.groups < 3 || !results.aria.closeDisclosure || !results.aria.strokeHidden || results.aria.h3inRows < 11) throw new Error('aria: ' + JSON.stringify(results.aria));

// 9. Кнопка паузы тикера работает
await page.locator('#ticker-toggle').scrollIntoViewIfNeeded();
await page.locator('#ticker-toggle').click();
results.tickerToggle = await page.evaluate(() => ({
  playState: document.getElementById('ticker-marquee').style.animationPlayState,
  label: document.getElementById('ticker-toggle').getAttribute('aria-label'),
  text: document.getElementById('ticker-toggle-text').textContent.trim(),
}));
if (results.tickerToggle.playState !== 'paused' || results.tickerToggle.label !== 'Продолжить тикер') throw new Error('Кнопка паузы: ' + JSON.stringify(results.tickerToggle));

await browser.close();
await writeFile(path.join(here, 'verify-result.json'), JSON.stringify(results, null, 2));
console.log('VERIFY OK');
console.log(JSON.stringify({
  hook: Object.fromEntries(Object.entries(results.hook).map(([w, i]) => [w, { fontSize: i.fontSize, columnWidth: i.columnWidth, rects: i.lines.map((l) => l.rects), lineWidths: i.lines.map((l) => l.width) }])),
  scrollWidths: results.scrollWidths,
  contourOverlap: results.contourOverlap,
  mobileTickerFacts: Object.fromEntries(Object.entries(results.mobileTicker).map(([w, arr]) => [w, arr.filter((x) => x.present).length + '/' + arr.length])),
  biosNbsp: results.biosNbsp,
  activeBgPress: results.activePress,
  h1Measured1440: results.h1Measured1440,
  aria: results.aria,
  tickerToggle: results.tickerToggle,
  errors: results.errors,
}, null, 2));
