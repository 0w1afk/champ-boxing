import { fine, reduced } from './env';

/** magnetic-cta: притяжение кнопок записи (точные указатели, ±8px, lerp). */
if (!reduced && fine) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-magnetic]')) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
      if (Math.abs(tx - cx) > 0.3 || Math.abs(ty - cy) > 0.3) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      tx = Math.max(-8, Math.min(8, ((e.clientX - r.left) / r.width - 0.5) * 16));
      ty = Math.max(-8, Math.min(8, ((e.clientY - r.top) / r.height - 0.5) * 16));
      kick();
    });
    el.addEventListener('mouseleave', () => {
      tx = 0;
      ty = 0;
      kick();
    });
  }
}
