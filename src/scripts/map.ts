import { CONTACTS } from '../data/site';

/** Карта Яндекс.Конструктора в «Контактах»: скрипт грузится, когда секция
 *  подходит к вьюпорту; конструктор сам вставляет iframe в контейнер.
 *  При ошибке загрузки или если iframe не появился — остаётся фолбэк:
 *  адрес и ссылка на Яндекс.Карты. Без JS — тот же фолбэк. */
const container = document.querySelector<HTMLElement>('[data-map]');
if (container) {
  const mount = () => {
    const script = document.createElement('script');
    script.src = CONTACTS.mapScript;
    script.async = true;
    script.setAttribute('charset', 'utf-8');
    script.addEventListener('error', () => (container.dataset.mapState = 'fail'));
    script.addEventListener('load', () => {
      // конструктор вставляет iframe асинхронно — ждём его появления (до 8 с)
      let tries = 0;
      const timer = window.setInterval(() => {
        tries += 1;
        if (container.querySelector('iframe')) {
          container.dataset.mapState = 'ready';
          window.clearInterval(timer);
        } else if (tries > 16) {
          container.dataset.mapState = 'fail';
          window.clearInterval(timer);
        }
      }, 500);
    });
    container.appendChild(script);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      ([entry], io) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        mount();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(container);
  } else {
    mount();
  }
}
