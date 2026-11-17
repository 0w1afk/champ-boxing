# CHAMP BOXING CLUB

Сайт клуба бокса — Astro + TypeScript + Tailwind CSS 4, статический вывод, без серверной части.
Процесс работы и правила — в [AGENTS.md](AGENTS.md).

## Разработка

```sh
npm install
npm run dev             # дев-сервер, сайт в корне localhost:4321/
npm run check           # astro check (типы)
npm run build           # сборка для champ-box.ru в dist/
npm run build:preview   # сборка для landingmania.ru/champ-box/ (под подпутём)
npm run preview         # раздать последнюю сборку из dist/
```

## Адреса и цели сборки

| Цель | Адрес | base | Индексация | Метрика |
|---|---|---|---|---|
| `prod` | https://champ-box.ru/ | `/` | да | да, после согласия |
| `preview` | https://landingmania.ru/champ-box/ | `/champ-box` | `noindex` | нет |
| `dev` | https://champ.zimorodok-dev.ru/ | `/` | `noindex` | нет |

`preview` — прежний временный адрес на период проверки заказчиком. `dev` — основной
тестовый поддомен: он собирается в CI и выкладывается workflow Deploy. Цель выбирает переменная
`SITE_TARGET` (`astro.config.mjs`), по умолчанию `prod`. Одна сборка на оба адреса невозможна:
Astro пишет абсолютные пути от `base` (`/_astro/…`, `/privacy/`).

Поэтому в коде нельзя писать абсолютные пути (`/favicon.svg`, `/#top`) — только через
`withBase()` из `src/lib/base.ts`. Ошибки путей видны только под подпутём: проверять
через `npm run build:preview && npm run preview`.

`robots.txt` и `sitemap.xml` собираются под цель (`src/pages/robots.txt.ts`,
`sitemap.xml.ts`); новую страницу добавить в список `PAGES` в `sitemap.xml.ts`.
Яндекс Метрика (`METRIKA` в `src/data/site.ts`) грузится только после «Принять» в
cookie-баннере и только на `champ-box.ru` (`PROD_HOST` в `src/lib/base.ts`).

## Деплой

```sh
./deploy.sh            # prod + dev
./deploy.sh prod       # только champ-box.ru
./deploy.sh preview    # только landingmania.ru/champ-box/
./deploy.sh dev        # только champ.zimorodok-dev.ru
```

Скрипт собирает сайт локально и rsync-ит на сервер:

| Цель | Каталог на сервере |
|---|---|
| `prod` | `/srv/champ-box.ru/www/` |
| `preview` | `/srv/champ-box.ru/preview/` |
| `dev` | `/srv/zimorodok-dev.ru/champ/` |

Каждый деплой дополнительно снимает метрики Lighthouse с боевого адреса и обновляет
`https://champ.zimorodok-dev.ru/lighthouse/` — мобильный и десктопный прогоны,
рядом полные отчёты. Скрипт — `scripts/lighthouse-page.mjs`.

Для `dev` есть и штатный путь без локальной сборки: push в `main` → CI, затем
Actions → Deploy. Ключ Actions ограничен rrsync-каталогом `/srv/zimorodok-dev.ru`.
`dev`-сборка закрыта от индексации: `robots.txt` с `Disallow: /`, `noindex, nofollow`
в разметке и заголовок `X-Robots-Tag` в nginx.

Сборка намеренно локальная: у VPS 477 MiB RAM — `astro build` там падает по памяти;
на сервере только статика и nginx на хосте, без Docker (VPS Selectel, Россия).

Сервер — SSH-алиас `champ-box` в `~/.ssh/config` (другой алиас: `DEPLOY_HOST=… ./deploy.sh`):

```
Host champ-box
  HostName 81.163.30.117
  User root
  IdentityFile ~/.ssh/<ключ сервера>
```

nginx стоит на сервере (без Docker), сертификаты — certbot, продление автоматическое.
Конфиги:

| Домен | Конфиг в репо | На сервере |
|---|---|---|
| champ-box.ru | `deploy/nginx/champ-box.ru.conf` (этот репо) | `/etc/nginx/sites-available/champ-box.ru.conf` |
| landingmania.ru (+ `/champ-box/` → `preview`) | `~/Projects/landingmania.ru/deploy/nginx/landingmania.ru.conf` | `/etc/nginx/sites-available/landingmania.ru.conf` |
| champ.zimorodok-dev.ru (`dev`) | `site-fabric/deploy/nginx/zimorodok-dev.ru.conf` | `/etc/nginx/sites-available/zimorodok-dev.ru.conf` |

Правка конфига champ-box.ru:
```sh
rsync -a deploy/nginx/champ-box.ru.conf champ-box:/etc/nginx/sites-available/
ssh champ-box 'nginx -t && systemctl reload nginx'
```

### Запуск champ-box.ru (один раз, после смены DNS)

1. A-записи `champ-box.ru` и `www.champ-box.ru` → `81.163.30.117`; дождаться:
   `dig +short A champ-box.ru @1.1.1.1`.
2. Сертификат — проверку Let's Encrypt отвечает default_server из конфига landingmania, свой
   конфиг для этого ещё не нужен:
   `ssh champ-box 'certbot certonly --webroot -w /var/www/certbot -d champ-box.ru -d www.champ-box.ru'`
3. Включить сайт:
   ```sh
   rsync -a deploy/nginx/champ-box.ru.conf champ-box:/etc/nginx/sites-available/
   ssh champ-box 'ln -sf ../sites-available/champ-box.ru.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx'
   ```
4. `./deploy.sh prod` (сборка уже лежит в `/srv/champ-box.ru/www/`, если не было правок) и проверки ниже.
5. В Яндекс Метрике у счётчика 98114653 — адрес сайта champ-box.ru, Вебвизор выключен.

### Проверка после деплоя

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://champ-box.ru/                # 200
curl -s https://champ-box.ru/robots.txt                                       # Allow + Sitemap
curl -s -o /dev/null -w '%{http_code}\n' https://champ.zimorodok-dev.ru/      # 200
curl -s https://champ.zimorodok-dev.ru/robots.txt                             # Disallow: /
curl -sI https://champ.zimorodok-dev.ru/ | grep -i x-robots-tag               # noindex, nofollow
curl -s -o /dev/null -w '%{http_code}\n' https://landingmania.ru/champ-box/   # 200
```

## Проверки качества

```sh
npm run metrics              # build → Lighthouse (mobile + desktop) → плавность скролла
```

Бюджеты — `metrics/budgets.json`, отчёты Lighthouse — `metrics/lhci/<form>/`, замеры скролла — `metrics/scroll-{desktop,mobile}.json`. Старые отчёты формы удаляются перед прогоном, «салют» в HTML-отчётах выключен (`metrics/disable-fireworks.mjs`).

Web Vitals печатаются в консоль браузера: на dev — всегда, на сайте — с `?vitals` в адресе.
