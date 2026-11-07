import { METRIKA } from '../data/site';
import { PROD_HOST } from '../lib/base';

/** Согласие на cookie и Яндекс Метрику. Выбор хранится в localStorage
 *  ('accepted' | 'declined'); пока его нет — показываем баннер. Метрика грузится
 *  только при согласии и на основном домене (PROD_HOST). «Настройки cookie»
 *  в подвале снова открывают баннер; отказ после согласия удаляет cookie Метрики
 *  и перезагружает страницу, чтобы счётчик выгрузился. */
type Choice = 'accepted' | 'declined';
const KEY = 'cookie-consent';

const read = (): Choice | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
};
const write = (v: Choice) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* приватный режим — выбор действует до закрытия страницы */
  }
};

let metrikaLoaded = false;
const loadMetrika = () => {
  const host = location.hostname.replace(/^www\./, '');
  if (host !== PROD_HOST || metrikaLoaded) return;
  metrikaLoaded = true;
  type Ym = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
  const w = window as unknown as { ym?: Ym };
  const ym: Ym = w.ym || Object.assign((...args: unknown[]) => (ym.a = ym.a || []).push(args), { l: Date.now() });
  w.ym = ym;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(s);
  ym(METRIKA.id, 'init', { ...METRIKA.options });
};

const dropMetrikaCookies = () => {
  const host = location.hostname;
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim();
    if (!name?.startsWith('_ym')) continue;
    for (const domain of ['', `; domain=${host}`, `; domain=.${host}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  }
};

const banner = document.querySelector<HTMLElement>('[data-consent]');
const show = () => banner && (banner.hidden = false);
const hide = () => banner && (banner.hidden = true);

if (read() === 'accepted') loadMetrika();
else if (read() === null) show();

banner?.querySelector('[data-consent-accept]')?.addEventListener('click', () => {
  write('accepted');
  hide();
  loadMetrika();
});
banner?.querySelector('[data-consent-decline]')?.addEventListener('click', () => {
  const wasAccepted = read() === 'accepted';
  write('declined');
  hide();
  if (wasAccepted) {
    dropMetrikaCookies();
    if (metrikaLoaded) location.reload();
  }
});

for (const btn of document.querySelectorAll<HTMLElement>('[data-consent-open]')) {
  btn.addEventListener('click', () => {
    show();
    banner?.querySelector<HTMLElement>('[data-consent-accept]')?.focus();
  });
}
