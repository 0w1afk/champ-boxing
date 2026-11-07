/** Web Vitals (LCP, INP, CLS, FCP, TTFB) — только в консоль браузера, никуда не
 *  отправляются. Включены на dev-сервере всегда, на проде — по параметру ?vitals
 *  в адресе (https://gussy-pussy.ru/champ-box/?vitals). Без него библиотека
 *  даже не загружается. Сборка attribution: к замеру приложены подробности —
 *  какой элемент дал LCP, на чём был медленный отклик (INP), что сдвинулось (CLS).
 *  reportAllChanges: значение печатается при каждом изменении, а не только итог
 *  при уходе со страницы — удобно смотреть вживую. */
const enabled = import.meta.env.DEV || new URLSearchParams(location.search).has('vitals');

if (enabled) {
  void import('web-vitals/attribution').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    const colors = { good: '#0cce6b', 'needs-improvement': '#ffa400', poor: '#ff4e42' } as const;
    type Metric = Parameters<Parameters<typeof onLCP>[0]>[0] | Parameters<Parameters<typeof onCLS>[0]>[0]
      | Parameters<Parameters<typeof onINP>[0]>[0] | Parameters<Parameters<typeof onFCP>[0]>[0]
      | Parameters<Parameters<typeof onTTFB>[0]>[0];
    const log = (m: Metric) => {
      const value = m.name === 'CLS' ? m.value.toFixed(3) : `${Math.round(m.value)} ms`;
      console.log(
        `%c${m.name}%c ${value} — ${m.rating}`,
        `background:${colors[m.rating]};color:#000;padding:1px 6px;border-radius:3px;font-weight:600`,
        'color:inherit',
        m.attribution,
      );
    };
    const opts = { reportAllChanges: true };
    onTTFB(log, opts);
    onFCP(log, opts);
    onLCP(log, opts);
    onCLS(log, opts);
    onINP(log, opts);
  });
}
