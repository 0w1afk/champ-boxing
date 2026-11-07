#!/bin/sh
# Деплой сайта клуба на сервер: сборка здесь, rsync на VPS в /srv/gussy-pussy/champ-box/.
# URL: https://gussy-pussy.ru/champ-box/  Сервер: ssh zimorodok (root@81.163.30.117).
# Сборка локальная: у VPS 477 MiB RAM — astro build там падает по памяти (см. README gussy-pussy).
set -eu
cd "$(dirname "$0")"

npm run build

# dist целиком = содержимое URL /champ-box/ (Astro 5 с base пишет страницы плоско)
rsync -a --delete dist/ zimorodok:/srv/gussy-pussy/champ-box/

echo "Деплой готов: https://gussy-pussy.ru/champ-box/"
