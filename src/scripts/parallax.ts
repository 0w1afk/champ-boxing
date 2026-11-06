import { reduced } from './env';

/** Параллакс плоскостей: translateY от −amount% до +amount% по прогрессу элемента
 *  во вьюпорте, со сглаживанием (пружина 90/28/0.4 ≈ lerp 0.1). */
const els = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
if (!reduced && els.length) {
  const state = els.map((el) => {
    el.style.willChange = 'transform';
    return { el, amount: parseFloat(el.dataset.parallax || '7'), target: 0, current: 0 };
  });
  const compute = () => {
    const vh = innerHeight;
    for (const s of state) {
      const r = s.el.parentElement!.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const p = (vh - r.top) / (vh + r.height); // 0..1 — старт снизу, конец сверху
      s.target = (Math.min(Math.max(p, 0), 1) * 2 - 1) * s.amount;
    }
  };
  const tick = () => {
    for (const s of state) {
      s.current += (s.target - s.current) * 0.1;
      s.el.style.transform = `translateY(${s.current.toFixed(2)}%)`;
    }
    requestAnimationFrame(tick);
  };
  compute();
  addEventListener('scroll', compute, { passive: true });
  addEventListener('resize', compute, { passive: true });
  requestAnimationFrame(tick);
}
