#!/bin/sh
# Деплой сайта клуба: сборка здесь, rsync на VPS.
#   prod    https://champ-box.ru/                → /srv/champ-box.ru/www/ (base /)
#   preview https://landingmania.ru/champ-box/   → /srv/champ-box.ru/preview/ (base /champ-box)
#   dev     https://champ.zimorodok-dev.ru/      → /srv/zimorodok-dev.ru/champ/ (base /)
# Одна сборка на несколько адресов невозможна: Astro пишет абсолютные пути от base
# (/_astro/…, /privacy/), под /champ-box/ сборка для корня ломается.
# Сервер — SSH-алиас из ~/.ssh/config (по умолчанию champ-box), переопределяется DEPLOY_HOST.
# Сборка локальная: у VPS 477 MiB RAM — astro build там падает по памяти.
#
#   ./deploy.sh            prod + dev
#   ./deploy.sh prod       только champ-box.ru
#   ./deploy.sh preview    только landingmania.ru/champ-box
#   ./deploy.sh dev        только champ.zimorodok-dev.ru
set -eu
cd "$(dirname "$0")"

HOST="${DEPLOY_HOST:-champ-box}"
DEV_HOST="${DEPLOY_HOST_DEV:-root@81.163.30.117}"

build_and_sync() { # цель, хост, каталог на сервере, адрес
  SITE_TARGET="$1" npm run build
  rsync -a --delete dist/ "$2:$3/"
  echo "Готово: $4"
}

case "${1:-all}" in
  prod) build_and_sync prod "$HOST" /srv/champ-box.ru/www https://champ-box.ru/ ;;
  preview) build_and_sync preview "$HOST" /srv/champ-box.ru/preview https://landingmania.ru/champ-box/ ;;
  dev) build_and_sync dev "$DEV_HOST" /srv/zimorodok-dev.ru/champ https://champ.zimorodok-dev.ru/ ;;
  all)
    build_and_sync prod "$HOST" /srv/champ-box.ru/www https://champ-box.ru/
    build_and_sync dev "$DEV_HOST" /srv/zimorodok-dev.ru/champ https://champ.zimorodok-dev.ru/
    ;;
  *) echo "Цель: prod | preview | dev | без аргумента — prod и dev" >&2; exit 1 ;;
esac
