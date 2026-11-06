import Swiper from 'swiper';
import { Autoplay, FreeMode } from 'swiper/modules';
import { reduced } from './env';

/** Бегущая строка под хиро: бесконечная лента Swiper (Autoplay).
 *  Пауза на hover, при reduced-motion не запускается. */
const el = document.querySelector<HTMLElement>('[data-ticker]');
if (el && !reduced) {
  new Swiper(el, {
    modules: [Autoplay, FreeMode],
    freeMode: true,
    slidesPerView: 'auto',
    spaceBetween: 0,
    loop: true,
    loopAdditionalSlides: 1,
    allowTouchMove: false,
    speed: 7000,
    autoplay: { delay: 0, disableOnInteraction: false, pauseOnMouseEnter: true },
  });
}
