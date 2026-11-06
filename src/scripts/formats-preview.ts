import Swiper from 'swiper';
import { Autoplay, FreeMode } from 'swiper/modules';
import { fine, reduced } from './env';

/** Киноплёнка в превью формата: вертикальная лента Swiper из трёх кадров
 *  (Autoplay). Инстанс создаётся при первом показе ленты. Неактивные
 *  ленты прячутся через visibility, а не display:none: display:none отменяет
 *  CSS-переход, transitionend не приходит и Autoplay останавливается. */
const strips = [...document.querySelectorAll<HTMLElement>('[data-preview-strip]')];
const films = new Map<string, Swiper>();

const ensureSwiper = (strip: HTMLElement) => {
  const key = strip.dataset.previewStrip || '';
  const existing = films.get(key);
  if (existing) return existing;
  const root = strip.querySelector<HTMLElement>('.swiper');
  if (!root) return undefined;
  const swiper = new Swiper(root, {
    modules: [Autoplay, FreeMode],
    freeMode: true,
    direction: 'vertical',
    loop: true,
    loopAdditionalSlides: 2,
    slidesPerView: 1,
    allowTouchMove: false,
    speed: 8000,
    autoplay: { delay: 0, disableOnInteraction: false, reverseDirection: true },
  });
  films.set(key, swiper);
  return swiper;
};

const showFilm = (slug: string | null) => {
  for (const strip of strips) {
    strip.classList.toggle('invisible', strip.dataset.previewStrip !== slug);
  }
  if (!slug) return;
  const strip = strips.find((s) => s.dataset.previewStrip === slug);
  if (strip) ensureSwiper(strip);
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
