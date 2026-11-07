import EmblaCarousel from 'embla-carousel';
import { fine, reduced } from './env';
import { createLightbox } from './lightbox';

/** Кадры форматов на тач-экранах: в каждой строке «Тренировок» своя лента Embla
 *  под текстом — один кадр на слайд, по кругу, свайп. Полоски под лентой
 *  показывают текущий кадр. На точных указателях ленты скрыты CSS (там превью
 *  за курсором, formats-preview.ts) и не создаются.
 *
 *  Автопрокрутка: раз в INTERVAL лента листает на следующий кадр — только пока
 *  она на экране, вкладка видима и лайтбокс закрыт; после свайпа отсчёт
 *  начинается заново. Ленты стартуют со сдвигом, чтобы не листались разом.
 *  При reduced-motion автопрокрутки нет.
 *
 *  Нажатие на кадр открывает лайтбокс с кадрами этого формата (lightbox.ts);
 *  после перетаскивания клик гасит сама Embla. */
const INTERVAL = 4000;
const STAGGER = 700;

if (!fine) {
  const viewports = [...document.querySelectorAll<HTMLElement>('[data-format-embla]')];
  for (const [i, viewport] of viewports.entries()) {
    const dots = [...(viewport.parentElement?.querySelectorAll<HTMLElement>('[data-format-dot]') ?? [])];
    const embla = EmblaCarousel(viewport, { loop: true, align: 'start' });
    const paint = () => {
      const cur = embla.selectedScrollSnap();
      dots.forEach((dot, n) => dot.toggleAttribute('data-active', n === cur));
    };
    embla.on('select', paint);
    embla.on('reInit', paint);
    paint();

    const hold = { offscreen: true, drag: false, open: false };
    let timer = 0;
    const schedule = (delay = INTERVAL) => {
      clearTimeout(timer);
      if (reduced || document.hidden || Object.values(hold).some(Boolean)) return;
      timer = window.setTimeout(() => {
        embla.scrollNext();
        schedule();
      }, delay);
    };
    embla.on('pointerDown', () => {
      hold.drag = true;
      schedule();
    });
    embla.on('pointerUp', () => {
      hold.drag = false;
      schedule();
    });
    new IntersectionObserver(([entry]) => {
      hold.offscreen = !entry?.isIntersecting;
      schedule(INTERVAL + i * STAGGER);
    }).observe(viewport);
    document.addEventListener('visibilitychange', () => schedule());

    const thumbs = [...viewport.querySelectorAll<HTMLElement>('[data-format-photo]')];
    if (thumbs.length) {
      const lightbox = createLightbox(thumbs, viewport.dataset.formatEmbla || 'Фото формата');
      lightbox.on('beforeOpen', () => {
        hold.open = true;
        schedule();
      });
      // лайтбокс могли пролистать — лента встаёт на последний открытый кадр
      lightbox.on('close', () => {
        const idx = lightbox.pswp?.currIndex;
        if (idx !== undefined) embla.scrollTo(idx, true);
      });
      lightbox.on('destroy', () => {
        hold.open = false;
        schedule();
      });
    }
  }
}
