import { fine, reduced } from './env';

/** Кастомный курсор: точка+кольцо (lerp 0.16/0.2), рост над интерактивом. */
if (!reduced && fine && document.getElementById('cursor')) {
  document.documentElement.classList.add('has-cursor');
  const dot = document.querySelector<HTMLElement>('[data-cursor-dot]')!;
  const ring = document.querySelector<HTMLElement>('[data-cursor-ring]')!;
  let x = -100, y = -100, rx = -100, ry = -100, sc = 1, targetSc = 1;
  addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  }, { passive: true });
  document.addEventListener('mouseover', (e) => {
    targetSc = (e.target as Element).closest('a, button, summary') ? 1.8 : 1;
  });
  (function loop() {
    rx += (x - rx) * 0.16;
    ry += (y - ry) * 0.16;
    sc += (targetSc - sc) * 0.2;
    ring.style.left = `${rx}px`;
    ring.style.top = `${ry}px`;
    ring.style.scale = String(sc);
    requestAnimationFrame(loop);
  })();
}
