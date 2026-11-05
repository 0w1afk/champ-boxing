// Одноразовая проверка дизайн-артефакта, не тестовый код продукта.
// Запуск: node verify.mjs /абсолютный/путь/к/playwright/index.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = await import(process.argv[2]);
const here = path.dirname(fileURLToPath(import.meta.url));
const captures = path.join(here, 'captures');
await mkdir(captures, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { viewports: [], themes: [], errors: [], fonts: [] };
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
page.on('pageerror', error => results.errors.push(error.message));
await page.goto('http://127.0.0.1:58505/');
await page.evaluate(() => document.fonts.ready);
for (const width of [1440, 768, 390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const metrics = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, displayFont: getComputedStyle(document.querySelector('.display')).fontFamily, bodyFont: getComputedStyle(document.body).fontFamily }));
  results.viewports.push(metrics);
  if (metrics.documentWidth > width) throw new Error(`Переполнение на ${width}: ${metrics.documentWidth}`);
  await page.screenshot({ path: path.join(captures, `overview-${width}.png`), fullPage: true });
  await page.locator('#components').screenshot({ path: path.join(captures, `components-${width}.png`) });
  if (width === 1440) {
    for (const section of ['palette', 'type', 'grid']) await page.locator(`#${section}`).screenshot({ path: path.join(captures, `${section}-1440.png`) });
  }
}
const cdp = await page.context().newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument');
for (const selector of ['.display-glyphs', '.body-glyphs']) {
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const fonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  results.fonts.push({ selector, fonts: fonts.fonts });
}
await page.setViewportSize({ width: 1440, height: 1000 });
for (const theme of ['signal', 'ember', 'flash']) {
  await page.locator(`input[value="${theme}"]`).check();
  results.themes.push(await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { theme: document.documentElement.dataset.theme, bg: style.getPropertyValue('--bg').trim(), action: style.getPropertyValue('--action').trim(), actionText: style.getPropertyValue('--action-text').trim() };
  }));
}
await page.locator('input[value="signal"]').check();
await page.locator('#menu-toggle').click();
if (await page.locator('#menu-demo').isHidden()) throw new Error('Меню не открылось');
await page.locator('#menu-toggle').click();
if (await page.locator('#menu-demo').isVisible()) throw new Error('Меню не закрылось');
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const opener = page.locator('.overlay-guidelines [data-open="prices"]');
  await opener.click();
  await page.locator('#details-dialog').waitFor({ state: 'visible' });
  if (await page.evaluate(() => document.activeElement.id) !== 'dialog-close') throw new Error('Начальный фокус не у закрытия');
  await page.keyboard.press('Shift+Tab');
  if (await page.evaluate(() => !document.querySelector('dialog').contains(document.activeElement))) throw new Error('Фокус вышел из dialog');
  const overflow = await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth);
  if (overflow) throw new Error(`Горизонтальное переполнение dialog ${width}`);
  await page.screenshot({ path: path.join(captures, `dialog-prices-${width}.png`) });
  await page.keyboard.press('Escape');
  if (await page.locator('dialog').isVisible()) throw new Error('Escape не закрыл dialog');
  if (!(await opener.evaluate(el => el === document.activeElement))) throw new Error('Фокус не вернулся инициатору');
}
await page.emulateMedia({ reducedMotion: 'reduce' });
const reduced = await page.locator('.map-loading').evaluate(el => getComputedStyle(el).animationName);
if (reduced !== 'none') throw new Error('Reduced motion не отключил вращение');
results.reducedMotion = reduced;
results.dialog = 'Desktop/mobile, focus containment, Escape, focus return: PASS';
if (results.errors.length) throw new Error(results.errors.join('\n'));
await writeFile(path.join(captures, 'verification.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
