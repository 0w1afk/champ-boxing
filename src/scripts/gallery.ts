import EmblaCarousel from 'embla-carousel';
import AutoScroll from 'embla-carousel-auto-scroll';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { reduced } from './env';
import { createLightbox } from './lightbox';

/** Лента галереи: Embla с бесконечной прокруткой. AutoScroll двигает ленту
 *  непрерывно с постоянной скоростью (speed — px за шаг 1/60 с: 1.5 = 90 px/s).
 *  Свайп — с инерцией (dragFree), колёсико — только горизонтальное (тачпад,
 *  Shift+колесо), вертикальное листает страницу. Сетка и затемнение кадра
 *  снимаются через CSS. */
const viewport = document.querySelector<HTMLElement>('[data-gallery-embla]');
const embla =
  viewport && !reduced
    ? EmblaCarousel(viewport, { loop: true, dragFree: true, align: 'start' }, [
        // встроенные паузы плагина выключены — ими управляет hold ниже: плагин
        // запускал ленту на mouseleave посреди перетаскивания (жест обрывался)
        // и на focusout, когда нажатие мышью переводит фокус с миниатюры на
        // миниатюру (лента ехала под курсором, захватить её было нельзя).
        // stopOnInteraction: true — плагин только останавливается на нажатии.
        AutoScroll({
          speed: 1.5,
          startDelay: 0,
          playOnInit: false,
          stopOnInteraction: true,
          stopOnMouseEnter: false,
          stopOnFocusIn: false,
        }),
        WheelGesturesPlugin({ forceWheelAxis: 'x' }),
      ])
    : undefined;
const autoScroll = embla?.plugins().autoScroll;

/** Лента стоит, пока выполнено хоть одно: над ней мышь (пауза мгновенная,
 *  продолжает с того же места), её тянут или она докатывается по инерции,
 *  фокус с клавиатуры на миниатюре, открыт лайтбокс. */
const hold = { hover: false, drag: false, settling: false, focus: false, open: false };
const sync = () => {
  if (!autoScroll) return;
  if (Object.values(hold).some(Boolean)) autoScroll.stop();
  else if (!autoScroll.isPlaying()) autoScroll.play();
};
if (viewport && embla) {
  const isTouch = (e: PointerEvent) => e.pointerType === 'touch';
  viewport.addEventListener('pointerenter', (e) => {
    if (isTouch(e)) return;
    hold.hover = true;
    sync();
  });
  viewport.addEventListener('pointerleave', (e) => {
    if (isTouch(e)) return;
    hold.hover = false;
    sync();
  });
  // перетаскивание мышью, свайп и колёсико (WheelGestures идёт тем же путём)
  embla.on('pointerDown', () => {
    hold.drag = true;
    hold.settling = false;
    sync();
  });
  embla.on('pointerUp', () => {
    hold.drag = false;
    hold.settling = true;
  });
  embla.on('settle', () => {
    if (!hold.settling) return;
    hold.settling = false;
    sync();
  });
  // фокус после нажатия мышью не :focus-visible — ленту не держит
  viewport.addEventListener('focusin', (e) => {
    hold.focus = (e.target as Element).matches(':focus-visible');
    sync();
  });
  viewport.addEventListener('focusout', (e) => {
    if (viewport.contains(e.relatedTarget as Node | null)) return;
    hold.focus = false;
    sync();
  });
  hold.hover = viewport.matches(':hover');
  sync();
}

/** Лайтбокс галереи (lightbox.ts). Кадры берём по индексу из data-атрибута,
 *  а не по позиции в DOM (Embla переставляет колонки). */
const thumbs = [...document.querySelectorAll<HTMLElement>('[data-gallery-photo]')].sort(
  (a, b) => Number(a.dataset.galleryPhoto) - Number(b.dataset.galleryPhoto),
);

if (thumbs.length) {
  const lightbox = createLightbox(thumbs, 'Фото галереи');

  // пока лайтбокс открыт, лента под ним стоит; после закрытия курсор может
  // оказаться над лентой без нового pointerenter — берём :hover
  lightbox.on('beforeOpen', () => {
    hold.open = true;
    sync();
  });
  lightbox.on('destroy', () => {
    hold.open = false;
    hold.hover = Boolean(viewport?.matches(':hover'));
    sync();
  });
}
