import { reduced } from './env';

/** reveal-block: появление блоков один раз (порог −70px, как в example Reveal). */
const els = document.querySelectorAll('[data-reveal]');
if (!reduced && 'IntersectionObserver' in window && els.length) {
  els.forEach((el) => el.classList.add('reveal-init'));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -70px 0px', threshold: 0 },
  );
  els.forEach((el) => io.observe(el));
} else {
  els.forEach((el) => el.classList.remove('reveal-init'));
}
