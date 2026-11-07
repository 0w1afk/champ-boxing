/**
 * Базовый путь и домен сайта (astro.config: цели prod и preview).
 * prod — champ-box.ru в корне; preview — gussy-pussy.ru/champ-box; dev — корень localhost.
 * withBase('/x') — путь для ссылок и файлов из public/ в разметке.
 */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export const withBase = (path: string) => `${BASE}${path}`;

/** Основной домен клуба: на нём индексация и Метрика; любой другой адрес — временный. */
export const PROD_HOST = 'champ-box.ru';

/** Сборка для основного домена (не preview). В dev — тоже true: dev отдаёт сайт в корне. */
export const IS_PROD_SITE = new URL(import.meta.env.SITE).hostname === PROD_HOST;
