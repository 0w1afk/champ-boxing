// Движение по docs/design/motion.md: hero-parallax (вау-момент), reveal-block, magnetic-cta.
// Только transform/opacity; всё отключается при prefers-reduced-motion; без JS контент виден.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// hero-parallax: перчатка уходит медленнее контента при скролле (глубина первого экрана).
const hero = document.getElementById('top');
const heroImg = hero?.querySelector<HTMLImageElement>('img');
if (hero && heroImg && !reduced) {
  heroImg.style.willChange = 'transform';
  heroImg.style.transform = 'scale(1.15)';
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = Math.min(window.scrollY, hero.offsetHeight);
    heroImg.style.transform = `scale(1.15) translateY(${(y * 0.07).toFixed(1)}px)`;
  };
  update();
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
}

// reveal-block: появление блоков сцен при входе в вьюпорт, один раз.
const revealEls = document.querySelectorAll('[data-reveal]');
if (!reduced && 'IntersectionObserver' in window && revealEls.length) {
  revealEls.forEach((el) => el.classList.add('reveal-init'));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
  );
  revealEls.forEach((el) => io.observe(el));
}

// magnetic-cta: притяжение главной кнопки к курсору, ±8 px, только точные указатели.
const cta = document.querySelector<HTMLElement>('#cta-hero a[href^="https://wa.me"]');
if (cta && !reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const loop = () => {
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    cta.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
    if (Math.abs(tx - cx) > 0.3 || Math.abs(ty - cy) > 0.3) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
    }
  };
  cta.addEventListener('mousemove', (e) => {
    const r = cta.getBoundingClientRect();
    tx = Math.max(-8, Math.min(8, (e.clientX - r.left - r.width / 2) * 0.2));
    ty = Math.max(-6, Math.min(6, (e.clientY - r.top - r.height / 2) * 0.2));
    if (!raf) raf = requestAnimationFrame(loop);
  });
  cta.addEventListener('mouseleave', () => {
    tx = 0;
    ty = 0;
    if (!raf) raf = requestAnimationFrame(loop);
  });
}
