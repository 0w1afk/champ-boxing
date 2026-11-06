/** Тикер едет CSS-анимацией (.marquee-track). Здесь только скорость: длительность
 *  цикла = ширина одной копии / px в секунду. Ширина меняется после загрузки
 *  шрифтов и на ресайзе — пересчитываем через ResizeObserver. */
const PX_PER_SEC = 75;

const track = document.querySelector<HTMLElement>('[data-ticker-track]');
if (track && 'ResizeObserver' in window) {
  const fit = () => {
    const copy = track.scrollWidth / 2;
    if (copy > 0) track.style.setProperty('--marquee-duration', `${(copy / PX_PER_SEC).toFixed(2)}s`);
  };
  new ResizeObserver(fit).observe(track);
}
