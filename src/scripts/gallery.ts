import Swiper from 'swiper';
import { Autoplay, FreeMode, Mousewheel } from 'swiper/modules';
import { reduced } from './env';

/** Лента галереи: бесконечная лента Swiper (Autoplay), колонки по два кадра.
 *  На hover лента замирает, сетка и затемнение кадра снимаются через CSS;
 *  горизонтальное колёсико (тачпад, Shift+колесо) листает ленту. */
const strip = document.querySelector<HTMLElement>('[data-gallery-swiper]');
if (strip && !reduced) {
  new Swiper(strip, {
    modules: [Autoplay, FreeMode, Mousewheel],
    freeMode: true,
    slidesPerView: 'auto',
    spaceBetween: 5,
    loop: true,
    loopAdditionalSlides: 2,
    loopPreventsSliding: false,
    speed: 4500,
    autoplay: { delay: 0, disableOnInteraction: false, pauseOnMouseEnter: true },
    mousewheel: { forceToAxis: true },
  });
}

/** Лайтбокс на <dialog>: карточки дублируются Swiper-ом, поэтому индекс кадра
 *  берём из data, а не из позиции. Стрелки и свайп листают, Esc закрывает,
 *  соседние кадры греем заранее. */
const dialog = document.querySelector<HTMLDialogElement>('[data-gallery-dialog]');
const thumbs = [...document.querySelectorAll<HTMLElement>('[data-gallery-photo]')];
if (dialog && thumbs.length) {
  const full = dialog.querySelector<HTMLImageElement>('[data-gallery-full]');
  const counter = dialog.querySelector<HTMLElement>('[data-gallery-counter]');
  const photos = new Map<number, HTMLElement>();
  for (const thumb of thumbs) photos.set(Number(thumb.dataset.galleryPhoto), thumb);
  const total = photos.size;
  let current = 0;

  const show = (index: number) => {
    current = (index + total) % total;
    const thumb = photos.get(current);
    if (!full || !thumb) return;
    full.src = thumb.dataset.full || '';
    full.alt = thumb.querySelector('img')?.alt || '';
    if (counter) counter.textContent = `${current + 1} / ${total}`;
    for (const step of [-1, 1]) {
      const src = photos.get((current + step + total) % total)?.dataset.full;
      if (src) void fetch(src, { priority: 'low' }).catch(() => {});
    }
  };

  for (const thumb of thumbs) {
    thumb.addEventListener('click', () => {
      show(Number(thumb.dataset.galleryPhoto));
      dialog.showModal();
    });
  }

  const step = (delta: number) => show(current + delta);
  dialog.querySelector('[data-gallery-prev]')?.addEventListener('click', () => step(-1));
  dialog.querySelector('[data-gallery-next]')?.addEventListener('click', () => step(1));
  dialog.querySelector('[data-gallery-close]')?.addEventListener('click', () => dialog.close());

  // клик мимо кадра (по подложке) закрывает; свайп листает
  let pointerX: number | null = null;
  dialog.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return;
    pointerX = e.clientX;
  });
  dialog.addEventListener('pointerup', (e) => {
    if (pointerX === null) return;
    const dx = e.clientX - pointerX;
    pointerX = null;
    if (Math.abs(dx) > 48) {
      step(dx < 0 ? 1 : -1);
    } else if (e.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
}
