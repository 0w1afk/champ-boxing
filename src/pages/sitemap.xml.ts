import type { APIRoute } from 'astro';
import { withBase } from '../lib/base';

// Все индексируемые страницы сайта; адреса — от site + base текущей цели сборки.
const PAGES = ['/', '/privacy/'];

export const GET: APIRoute = ({ site }) => {
  const urls = PAGES.map((p) => `  <url>\n    <loc>${new URL(withBase(p), site)}</loc>\n  </url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
