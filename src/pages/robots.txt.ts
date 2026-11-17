import type { APIRoute } from 'astro';
import { IS_PROD_SITE, withBase } from '../lib/base';

// robots.txt собирается под цель: на champ-box.ru — индексация и sitemap.
// На preview и dev робот получает «Disallow: /», плюс в разметке стоит
// <meta name="robots" content="noindex, nofollow"> (Base.astro).
export const GET: APIRoute = ({ site }) => {
  const body = IS_PROD_SITE
    ? `User-agent: *\nAllow: /\nDisallow: /500.html\n\nSitemap: ${new URL(withBase('/sitemap.xml'), site)}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
