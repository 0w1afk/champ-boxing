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
