/**
 * Lighthouse CI — аудит скорости, доступности, практик и SEO.
 *
 *   npm run lighthouse           собрать сайт и проверить локально (мобильный профиль)
 *   npm run lighthouse:desktop   то же, десктоп-профиль
 *   npm run lighthouse:prod      проверить прод https://gussy-pussy.ru/champ-box/
 *   npm run lighthouse:open      открыть в браузере отчёты медианных прогонов
 *
 * Локально сайт раздаёт `astro preview` (с base /champ-box, как на проде).
 * Каждая страница прогоняется 3 раза, в отчёт идёт медианный прогон.
 * Отчёты (HTML + JSON) — в tmp/lighthouse/, перед каждым запуском папка очищается.
 * В manifest.json медианный прогон каждой страницы помечен isRepresentativeRun.
 * Мобильный профиль Lighthouse по умолчанию: эмуляция телефона среднего класса,
 * медленный 4G, CPU замедлен в 4 раза.
 *
 * Переменные: LH_URL — проверить внешний адрес без локального сервера;
 * LH_PRESET=desktop — десктоп-профиль.
 */
const PORT = 4329;
const external = process.env.LH_URL;
const desktop = process.env.LH_PRESET === 'desktop';

const local = `http://localhost:${PORT}/champ-box`;

module.exports = {
  ci: {
    collect: {
      ...(external
        ? { url: [external] }
        : {
            url: [`${local}/`, `${local}/privacy/`],
            startServerCommand: `npx astro preview --port ${PORT}`,
            startServerReadyPattern: 'ready|Local',
          }),
      numberOfRuns: 3,
      settings: desktop ? { preset: 'desktop' } : {},
    },
    // Пороги: категории — по шкале Lighthouse (0–1), метрики — границы «хорошо»
    // из Core Web Vitals. error — команда завершается с ошибкой, warn — только
    // предупреждение. Скорость в лаборатории зависит от машины, поэтому по ней warn.
    assert: {
      // сравнивать с порогами медианный прогон, а не лучший (по умолчанию —
      // optimistic: один удачный прогон из трёх скрывал проблему)
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: 'tmp/lighthouse',
    },
  },
};
