# CHAMP BOXING CLUB

Сайт клуба бокса — Astro + TypeScript + Tailwind CSS 4, статический вывод, без серверной части.
Процесс работы и правила — в [AGENTS.md](AGENTS.md).

## Разработка

```sh
npm install
npm run dev      # дев-сервер
npm run check    # astro check (типы)
npm run build    # сборка в dist/
```

Важная особенность путей: в проде сайт живёт на подпути домена — `astro.config.mjs`
содержит `site: 'https://gussy-pussy.ru'` и `base: '/champ-box'`. Поэтому в коде
нельзя писать абсолютные пути (`/logo.png`, `/#top`) — только через хелпер
`withBase()` из `src/lib/base.ts`. На dev-сервере (`npm run dev`) base — `/`, сайт
открывается в корне `localhost:4321/`; сборка и `npm run preview` — под `/champ-box/`,
как на проде, поэтому ошибки путей проверять там (и в `npm run lighthouse`).

## Деплой

Сайт клуба: **https://gussy-pussy.ru/champ-box/** (корень домена — лендинг-визитка (гусь)).

```sh
./deploy.sh
```

Скрипт собирает сайт локально и rsync-ит `dist/` на сервер в `/srv/gussy-pussy/champ-box/`.
Сборка намеренно локальная: у VPS 477 MiB RAM — `astro build` там падает по памяти;
на сервере живёт только статика + nginx в Docker.

Сервер: `ssh zimorodok` (root@81.163.30.117, ключ `~/.ssh/zimorodok`).
Требуется доступ с этой машины — SSH-алиас настраивается в `~/.ssh/config`.

Инфраструктура домена (nginx + certbot, лендинг, выпуск/продление сертификата,
обновление nginx-конфига) — описана отдельно: `~/Projects/gussy-pussy/README.md`.

### Проверка после деплоя

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://gussy-pussy.ru/champ-box/   # 200
curl -s https://gussy-pussy.ru/robots.txt                                    # sitemap на /champ-box
```

`robots.txt` и `sitemap.xml` лежат в `public/` с абсолютными URL на
`gussy-pussy.ru/champ-box` — при смене домена править их вручную вместе с `site` в конфиге.
