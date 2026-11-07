import type { APIRoute } from 'astro';
import { IS_PROD_SITE, withBase } from '../lib/base';

// robots.txt собирается под цель: на champ-box.ru — индексация и sitemap.
// На preview (gussy-pussy.ru/champ-box) файл лежит не в корне домена и поисковиками не
// читается — там индексацию закрывает <meta name="robots" content="noindex"> (Base.astro).
export const GET: APIRoute = ({ site }) => {
  const body = IS_PROD_SITE
    ? `User-agent: *\nAllow: /\nDisallow: /500.html\n\nSitemap: ${new URL(withBase('/sitemap.xml'), site)}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
