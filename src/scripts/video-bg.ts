import { reduced } from './env';

/** Видео-фон секции цен: играет только пока секция на экране; при reduced-motion
 *  не запускается — остаётся статичный постер под затемнением. */
const video = document.querySelector<HTMLVideoElement>('[data-bg-video]');
if (video && !reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        void video.play().catch(() => {}); // нет кодека/автоплея — постер остаётся
      } else {
        video.pause();
      }
    },
    { threshold: 0.15 },
  );
  io.observe(video);
}
