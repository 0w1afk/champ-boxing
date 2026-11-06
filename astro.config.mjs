import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Боевой домен из брифа (champ-box.ru) — для canonical, sitemap и OG URL.
  site: 'https://champ-box.ru',
  vite: {
    plugins: [tailwindcss()],
    // Ядро PhotoSwipe грузится лениво (import() при первом открытии лайтбокса),
    // поэтому dev-сервер не видит его при старте и пересобирает зависимости уже
    // на клике — открытая страница получает 504 Outdated Optimize Dep, лайтбокс
    // не открывается. Предсобираем ядро сразу.
    optimizeDeps: {
      include: ['photoswipe'],
    },
  },
});
