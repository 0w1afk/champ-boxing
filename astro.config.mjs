import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// `astro dev` — сайт в корне localhost:4321/; сборка и `astro preview` — с подпутём,
// как на проде (preview и Lighthouse ловят ошибки путей под /champ-box/).
const dev = process.argv.includes('dev');

export default defineConfig({
  // Домен деплоя (решение пользователя от 06.11.2026): сайт клуба живёт
  // на подпути /champ-box домена gussy-pussy.ru; canonical, sitemap и OG — от него.
  site: 'https://gussy-pussy.ru',
  base: dev ? '/' : '/champ-box',
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
