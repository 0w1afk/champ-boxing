import EmblaCarousel from 'embla-carousel';
import AutoScroll from 'embla-carousel-auto-scroll';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { reduced } from './env';

/** Лента галереи: Embla с бесконечной прокруткой. AutoScroll двигает ленту
 *  непрерывно с постоянной скоростью (speed — px за шаг 1/60 с: 1.5 = 90 px/s),
 *  при наведении мыши останавливает сразу и продолжает с того же места.
 *  Свайп — с инерцией (dragFree), колёсико — только горизонтальное (тачпад,
 *  Shift+колесо), вертикальное листает страницу. Сетка и затемнение кадра
 *  снимаются через CSS. */
const viewport = document.querySelector<HTMLElement>('[data-gallery-embla]');
if (viewport && !reduced) {
  EmblaCarousel(viewport, { loop: true, dragFree: true, align: 'start' }, [
    AutoScroll({ speed: 1.5, startDelay: 0, stopOnMouseEnter: true, stopOnInteraction: false }),
    WheelGesturesPlugin({ forceWheelAxis: 'x' }),
  ]);
}

/** Лайтбокс на <dialog>: индекс кадра берём из data, а не из позиции
 *  (Embla переставляет колонки для бесконечной прокрутки). Стрелки и свайп листают, Esc закрывает,
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
