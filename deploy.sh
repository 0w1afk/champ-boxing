#!/bin/sh
# Деплой сайта клуба: две сборки здесь, rsync на VPS в два каталога.
#   prod    https://champ-box.ru/            → /srv/champ-box.ru/www/      (base /)
#   preview https://gussy-pussy.ru/champ-box/ → /srv/champ-box.ru/preview/  (base /champ-box)
# Одна сборка на оба адреса невозможна: Astro пишет абсолютные пути от base
# (/_astro/…, /privacy/), под /champ-box/ сборка для корня ломается.
# Сервер — SSH-алиас из ~/.ssh/config (по умолчанию champ-box), переопределяется DEPLOY_HOST.
# Сборка локальная: у VPS 477 MiB RAM — astro build там падает по памяти.
#
#   ./deploy.sh            обе цели
#   ./deploy.sh prod       только champ-box.ru
#   ./deploy.sh preview    только gussy-pussy.ru/champ-box
set -eu
cd "$(dirname "$0")"

HOST="${DEPLOY_HOST:-champ-box}"
ROOT=/srv/champ-box.ru

deploy() { # цель, каталог на сервере, адрес
  SITE_TARGET="$1" npm run build
  rsync -a --delete dist/ "$HOST:$ROOT/$2/"
  echo "Готово: $3"
}

case "${1:-all}" in
  prod) deploy prod www https://champ-box.ru/ ;;
  preview) deploy preview preview https://gussy-pussy.ru/champ-box/ ;;
  all)
    deploy prod www https://champ-box.ru/
    deploy preview preview https://gussy-pussy.ru/champ-box/
    ;;
  *) echo "Цель: prod | preview | без аргумента — обе" >&2; exit 1 ;;
esac
