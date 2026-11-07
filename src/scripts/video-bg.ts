import { fine, reduced } from './env';

/** Видео-фон секции цен — только на десктопе (точный указатель, ширина от 1024px):
 *  src из data-src ставится, когда секция впервые подходит к экрану, дальше
 *  видео играет, пока секция видна. На тач-экранах, при reduced-motion и без JS
 *  видео не скачивается — остаётся статичный постер под затемнением. */
const video = document.querySelector<HTMLVideoElement>('[data-bg-video]');
const desktop = fine && matchMedia('(min-width: 1024px)').matches;
if (video && desktop && !reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (!video.src && video.dataset.src) video.src = video.dataset.src;
        void video.play().catch(() => {}); // нет кодека/автоплея — постер остаётся
      } else {
        video.pause();
      }
    },
    { threshold: 0.15 },
  );
  io.observe(video);
}
