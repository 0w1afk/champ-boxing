import EmblaCarousel from 'embla-carousel';
import AutoScroll from 'embla-carousel-auto-scroll';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { reduced } from './env';

/** Лента галереи: Embla с бесконечной прокруткой. AutoScroll двигает ленту
 *  непрерывно с постоянной скоростью (speed — px за шаг 1/60 с: 1.5 = 90 px/s),
 *  при наведении мыши останавливает сразу и продолжает с того же места.
 *  Свайп — с инерцией (dragFree), колёсико — только горизонтальное (тачпад,
 *  Shift+колесо), вертикальное листает страницу. Сетка и затемнение кадра
 *  снимаются через CSS. */
const viewport = document.querySelector<HTMLElement>('[data-gallery-embla]');
const embla =
  viewport && !reduced
    ? EmblaCarousel(viewport, { loop: true, dragFree: true, align: 'start' }, [
        AutoScroll({ speed: 1.5, startDelay: 0, stopOnMouseEnter: true, stopOnInteraction: false }),
        WheelGesturesPlugin({ forceWheelAxis: 'x' }),
      ])
    : undefined;

/** Лайтбокс — PhotoSwipe: свайп между кадрами, pinch-zoom и двойной тап,
 *  закрытие свайпом вниз, клавиатура (стрелки, Esc), фокус заперт внутри.
 *  Ядро грузится при первом открытии. Кадры берём из data-атрибутов по индексу,
 *  а не по позиции в DOM (Embla переставляет колонки); анимация открытия
 *  растёт из миниатюры (она подрезана object-cover — thumbCropped). */
const thumbs = [...document.querySelectorAll<HTMLElement>('[data-gallery-photo]')].sort(
  (a, b) => Number(a.dataset.galleryPhoto) - Number(b.dataset.galleryPhoto),
);
/** Иконки лайтбокса — как в шапке сайта: линия 1.5px, 18×18 (стили в global.css) */
const icon = (paths: string) =>
  `<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 18 18" width="18" height="18">${paths}</svg>`;

if (thumbs.length) {
  const lightbox = new PhotoSwipeLightbox({
    dataSource: thumbs.map((thumb) => {
      const img = thumb.querySelector('img');
      return {
        src: thumb.dataset.full,
        width: Number(thumb.dataset.fullW),
        height: Number(thumb.dataset.fullH),
        alt: img?.alt || '',
        msrc: img?.currentSrc || undefined,
        element: thumb,
        thumbCropped: true,
      };
    }),
    pswpModule: () => import('photoswipe'),
    showHideAnimationType: reduced ? 'none' : 'zoom',
    bgOpacity: 1,
    preload: [1, 2],
    // кадр не заходит под панель кнопок (сверху) и стрелки (по бокам, на десктопе;
    // на тач-экранах стрелок нет)
    paddingFn: (viewport) =>
      viewport.x >= 768
        ? { top: 92, bottom: 48, left: 100, right: 100 }
        : { top: 76, bottom: 24, left: 16, right: 16 },
    closeTitle: 'Закрыть',
    zoomTitle: 'Увеличить',
    arrowPrevTitle: 'Предыдущее фото',
    arrowNextTitle: 'Следующее фото',
    errorMsg: 'Не удалось загрузить фото',
    counter: false,
    arrowPrevSVG: icon('<path d="M11.5 3.5L6 9l5.5 5.5" />'),
    arrowNextSVG: icon('<path d="M11.5 3.5L6 9l5.5 5.5" />'),
    closeSVG: icon('<path d="M3 3l12 12M15 3L3 15" />'),
    zoomSVG: icon(
      '<circle cx="7.75" cy="7.75" r="5.25" /><path d="M11.5 11.5L16 16M5.25 7.75h5" /><path class="pswp__zoom-icn-bar-v" d="M7.75 5.25v5" />',
    ),
  });

  // счётчик в стиле сайта: «03 / 27» шрифтом заголовков, текущий номер золотом;
  // экранным дикторам — «Фото 3 из 27» (aria-live)
  lightbox.on('uiRegister', () => {
    lightbox.pswp?.ui?.registerElement({
      name: 'site-counter',
      className: 'pswp-count',
      order: 5,
      appendTo: 'bar',
      onInit: (el, pswp) => {
        el.setAttribute('aria-live', 'polite');
        const pad = (n: number) => String(n).padStart(2, '0');
        const render = () => {
          const cur = pswp.currIndex + 1;
          const all = pswp.getNumItems();
          el.innerHTML = `<span aria-hidden="true"><span class="pswp-count__cur">${pad(cur)}</span> / ${pad(all)}</span><span class="pswp-count__sr">Фото ${cur} из ${all}</span>`;
        };
        pswp.on('change', render);
        render();
      },
    });
  });

  // в разметке PhotoSwipe есть role="dialog", но нет aria-modal и имени окна
  lightbox.on('afterInit', () => {
    const el = lightbox.pswp?.element;
    el?.setAttribute('aria-modal', 'true');
    el?.setAttribute('aria-label', 'Фото галереи');
  });

  // пока лайтбокс открыт, лента под ним стоит; AutoScroll сам запускается на
  // mouseleave (курсор уходит на оверлей) — гасим такой запуск
  const autoScroll = embla?.plugins().autoScroll;
  let open = false;
  embla?.on('autoScroll:play', () => {
    if (open) queueMicrotask(() => autoScroll?.stop());
  });
  lightbox.on('beforeOpen', () => {
    open = true;
    autoScroll?.stop();
  });
  lightbox.on('destroy', () => {
    open = false;
    if (!viewport?.matches(':hover')) autoScroll?.play();
  });

  lightbox.init();

  for (const [index, thumb] of thumbs.entries()) {
    thumb.addEventListener('click', (e) => {
      // фокус возвращаем на миниатюру только при открытии с клавиатуры:
      // после клика мышью фокус на миниатюре остановил бы ленту (stopOnFocusIn)
      const byKeyboard = e.detail === 0;
      lightbox.options.returnFocus = byKeyboard;
      if (!byKeyboard) thumb.blur();
      lightbox.loadAndOpen(index);
    });
  }
}
