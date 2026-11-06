import { fine, reduced } from './env';

/** Слежение за курсором: элемент мягко смещается за указателем внутри своей плоскости
 *  (data-cursor-shift = сила смещения в px; точные указатели, без reduced-motion). */
if (!reduced && fine) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-cursor-shift]')) {
    const strength = parseFloat(el.dataset.cursorShift || '10');
    const area = el.parentElement;
    if (!area) continue;
    el.style.willChange = 'translate';
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
      if (Math.abs(tx - cx) > 0.2 || Math.abs(ty - cy) > 0.2) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    area.addEventListener('pointermove', (e) => {
      const r = area.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * strength * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * strength * 2;
      kick();
    });
    area.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
      kick();
    });
  }
}
