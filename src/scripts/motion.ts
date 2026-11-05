/**
 * Движение по docs/design/motion.md (исполнение по референсу example).
 * Только transform/opacity; всё отключается при prefers-reduced-motion;
 * без JS контент и действия доступны. Реализация — vanilla.
 */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Параллакс плоскостей: translateY от -amount% до +amount% по прогрессу
 * элемента во вьюпорте, со сглаживанием (пружина 90/28/0.4 ≈ lerp 0.1).
 */
const parallaxEls = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
if (!reduced && parallaxEls.length) {
  const state = parallaxEls.map((el) => {
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
    let live = false;
    for (const s of state) {
      s.current += (s.target - s.current) * 0.1;
      if (Math.abs(s.target - s.current) > 0.05) live = true;
      s.el.style.transform = `translateY(${s.current.toFixed(2)}%)`;
    }
    requestAnimationFrame(tick);
    void live;
  };
  compute();
  addEventListener('scroll', compute, { passive: true });
  addEventListener('resize', compute, { passive: true });
  requestAnimationFrame(tick);
}

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

/** reveal-block: появление блоков один раз (порог −70px, как в example Reveal). */
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
    { rootMargin: '0px 0px -70px 0px', threshold: 0 },
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.remove('reveal-init'));
}

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

/** Плавающее превью формата за курсором (только точные указатели). */
const area = document.querySelector<HTMLElement>('[data-preview-area]');
const preview = document.querySelector<HTMLElement>('[data-preview]');
const previewCard = document.querySelector<HTMLElement>('[data-preview-card]');
const previewLabel = document.querySelector<HTMLElement>('[data-preview-label]');
if (!reduced && fine && area && preview && previewCard && previewLabel) {
  let x = 0, y = 0, px = 0, py = 0, raf = 0;
  const loop = () => {
    px += (x - px) * 0.12;
    py += (y - py) * 0.12;
    preview.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    raf = requestAnimationFrame(loop);
  };
  area.addEventListener('pointermove', (e) => {
    const r = area.getBoundingClientRect();
    x = e.clientX - r.left;
    y = e.clientY - r.top;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  const setActive = (row: Element | null) => {
    if (row) {
      previewLabel.textContent = row.getAttribute('data-slot') || '';
      previewCard.classList.add('is-active');
    } else {
      previewCard.classList.remove('is-active');
    }
  };
  for (const row of area.querySelectorAll('[data-slot]')) {
    row.addEventListener('mouseenter', () => setActive(row));
    row.addEventListener('mouseleave', () => setActive(null));
    row.addEventListener('focusin', () => setActive(row));
  }
  area.addEventListener('mouseleave', () => setActive(null));
  area.addEventListener('focusout', () => {
    if (!area.contains(document.activeElement) || !(document.activeElement as Element).closest('[data-slot]')) {
      setActive(null);
    }
  });
}

/** Мобильное меню (details): Escape и клик по ссылке закрывают. */
const menu = document.querySelector<HTMLDetailsElement>('.mobile-menu-trigger');
if (menu) {
  menu.querySelectorAll('[data-menu-close]').forEach((el) => {
    el.addEventListener('click', () => menu.removeAttribute('open'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      menu.removeAttribute('open');
      (menu.querySelector('summary') as HTMLElement)?.focus();
    }
  });
}
