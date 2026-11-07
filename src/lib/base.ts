/**
 * Базовый путь сайта. В сборке и `astro preview` сайт живёт под /champ-box
 * (как на домене gussy-pussy.ru), на dev-сервере — в корне (astro.config: base).
 * withBase('/x') — путь для ссылок и файлов из public/ в разметке.
 */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export const withBase = (path: string) => `${BASE}${path}`;
