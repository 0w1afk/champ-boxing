import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Боевой домен из брифа (champ-box.ru) — для canonical, sitemap и OG URL.
  site: 'https://champ-box.ru',
  vite: {
    plugins: [tailwindcss()],
  },
});
