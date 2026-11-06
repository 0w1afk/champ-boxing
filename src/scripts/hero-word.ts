import { reduced } from './env';

/** Вау-момент: контурное слово «Бокс» уезжает на 38% и гаснет к 80% скролла hero. */
const hero = document.getElementById('top');
const word = document.querySelector<HTMLElement>('[data-hero-word]');
if (hero && word && !reduced) {
  word.style.willChange = 'transform, opacity';
  let ticking = false;
  const update = () => {
    ticking = false;
    const p = Math.min(scrollY / hero.offsetHeight, 1);
    word.style.transform = `translateY(${(p * 38).toFixed(2)}%)`;
    word.style.opacity = String(Math.max(1 - p / 0.8, 0));
  };
  update();
  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
}
