import { fine, reduced } from './env';

/** Киноплёнка в превью формата едет CSS-анимацией (.film-track) — здесь только
 *  выбор ленты. Неактивные ленты прячутся через visibility. */
const strips = [...document.querySelectorAll<HTMLElement>('[data-preview-strip]')];

const showFilm = (slug: string | null) => {
  for (const strip of strips) {
    strip.classList.toggle('invisible', strip.dataset.previewStrip !== slug);
  }
};

/** Плавающее превью формата за курсором (только точные указатели). */
const area = document.querySelector<HTMLElement>('[data-preview-area]');
const preview = document.querySelector<HTMLElement>('[data-preview]');
const previewCard = document.querySelector<HTMLElement>('[data-preview-card]');
const previewLabel = document.querySelector<HTMLElement>('[data-preview-label]');
if (!reduced && fine && area && preview && previewCard && previewLabel) {
  let x = 0, y = 0, px = 0, py = 0, raf = 0;
  const loop = () => {
    px += (x - px) * 0.12;
    py += (y - py) * 0.12;
    preview.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    raf = requestAnimationFrame(loop);
  };
  area.addEventListener('pointermove', (e) => {
    const r = area.getBoundingClientRect();
    x = e.clientX - r.left;
    y = e.clientY - r.top;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  const setActive = (row: Element | null) => {
    document.documentElement.classList.toggle('has-preview', Boolean(row));
    if (row) {
      previewLabel.textContent = row.getAttribute('data-slot') || '';
      previewCard.classList.add('is-active');
      showFilm(row.getAttribute('data-img'));
    } else {
      previewCard.classList.remove('is-active');
      showFilm(null);
    }
  };
  for (const row of area.querySelectorAll('[data-slot]')) {
    row.addEventListener('mouseenter', () => setActive(row));
    row.addEventListener('mouseleave', () => setActive(null));
    row.addEventListener('focusin', () => setActive(row));
  }
  area.addEventListener('mouseleave', () => setActive(null));
  area.addEventListener('focusout', () => {
    if (!area.contains(document.activeElement) || !(document.activeElement as Element).closest('[data-slot]')) {
      setActive(null);
    }
  });

  /** Кадры ленты грузим заранее, когда секция подходит к вьюпорту:
   *  превью возникает под курсором, ждать загрузку нельзя. Ленты лежат
   *  в скрытых слоях, на lazy-загрузку браузера не полагаемся. */
  if (matchMedia('(min-width: 1024px)').matches && 'IntersectionObserver' in window) {
    const warm = new IntersectionObserver(
      ([entry], io) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        for (const img of document.querySelectorAll<HTMLImageElement>('[data-preview-strip] img')) {
          img.loading = 'eager';
        }
      },
      { rootMargin: '600px 0px' },
    );
    warm.observe(area);
  }
}
