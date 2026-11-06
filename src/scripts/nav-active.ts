/** Подсветка активного раздела в меню (шапка и мобильное меню). Активный —
 *  раздел, который пересекает линию на 40% высоты экрана; его ссылкам ставится
 *  aria-current="location" (стили — в Header.astro, тот же признак читают
 *  экранные дикторы). На первом экране и в подвале активного пункта нет. */
const links = [...document.querySelectorAll<HTMLAnchorElement>('header nav a[href*="#"]')];
const sections = [...new Set(links.map((a) => a.hash.slice(1)))]
  .map((id) => document.getElementById(id))
  .filter((s): s is HTMLElement => Boolean(s));

if (links.length && sections.length && 'IntersectionObserver' in window) {
  const visible = new Set<string>();
  const render = () => {
    const current = sections.find((s) => visible.has(s.id))?.id;
    for (const a of links) {
      if (current && a.hash === `#${current}`) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      }
      render();
    },
    { rootMargin: '-40% 0px -59% 0px' },
  );
  for (const s of sections) io.observe(s);
}
