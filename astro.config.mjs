import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Две цели сборки (deploy.sh собирает обе):
//   prod    — https://champ-box.ru/, сайт в корне домена;
//   preview — https://gussy-pussy.ru/champ-box/, временный адрес для проверки заказчиком
//             (noindex, без Метрики).
// Цель выбирается переменной SITE_TARGET (по умолчанию prod). `astro dev` — всегда в корне
// localhost:4321/; ошибки путей под подпутём ловит `npm run build:preview` (+ preview).
const TARGETS = {
  prod: { site: 'https://champ-box.ru', base: '/' },
  preview: { site: 'https://gussy-pussy.ru', base: '/champ-box' },
};
const target = TARGETS[process.env.SITE_TARGET ?? 'prod'];
if (!target) throw new Error(`SITE_TARGET: ожидается prod или preview, получено «${process.env.SITE_TARGET}»`);
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
