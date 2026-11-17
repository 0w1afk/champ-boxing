import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Цели сборки (deploy.sh собирает нужную):
//   prod    — https://champ-box.ru/, боевой сайт в корне домена;
//   preview — https://landingmania.ru/champ-box/, старый временный адрес (noindex);
//   dev     — https://champ.zimorodok-dev.ru/, тестовый поддомен (noindex, без Метрики);
//   pages   — https://0w1afk.github.io/champ-boxing/, демо на GitHub Pages
//             (noindex: IS_PROD_SITE проверяет домен, см. src/lib/base.ts).
// Цель выбирается переменной SITE_TARGET (по умолчанию prod). `astro dev` — всегда в корне
// localhost:4321/; ошибки путей под подпутём ловят build:preview и build:pages.
const TARGETS = {
  prod: { site: 'https://champ-box.ru', base: '/' },
  preview: { site: 'https://landingmania.ru', base: '/champ-box' },
  dev: { site: 'https://champ.zimorodok-dev.ru', base: '/' },
  pages: { site: 'https://0w1afk.github.io', base: '/champ-boxing' },
};
const target = TARGETS[process.env.SITE_TARGET ?? 'prod'];
if (!target) {
  throw new Error(
    `SITE_TARGET: ожидается prod, preview, dev или pages, получено «${process.env.SITE_TARGET}»`,
  );
}
const dev = process.argv.includes('dev');

export default defineConfig({
  site: target.site,
  base: dev ? '/' : target.base,
  vite: {
    plugins: [tailwindcss()],
    // Ядро PhotoSwipe грузится лениво (import() при первом открытии лайтбокса),
    // поэтому dev-сервер не видит его при старте и пересобирает зависимости уже
    // на клике — открытая страница получает 504 Outdated Optimize Dep, лайтбокс
    // не открывается. Предсобираем ядро сразу. То же для web-vitals (vitals.ts).
    optimizeDeps: {
      include: ['photoswipe', 'web-vitals/attribution'],
    },
  },
});
