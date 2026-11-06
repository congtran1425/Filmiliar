#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run the Filmiliar database backup as root.' >&2; exit 64; }
directory=/opt/apps/filmiliar/backups
install -d -m 700 "$directory"
exec 9>/run/lock/filmiliar-backup.lock
flock -w 60 9 || exit 75
backup="$directory/scheduled-$(date -u +%Y%m%dT%H%M%SZ).dump"
trap 'rm -f -- "$backup.tmp"' EXIT
docker exec filmiliar-db-1 pg_dump -U filmiliar -d filmiliar -Fc > "$backup.tmp"
test -s "$backup.tmp"
docker exec -i filmiliar-db-1 pg_restore --list < "$backup.tmp" >/dev/null
mv -- "$backup.tmp" "$backup"
find "$directory" -maxdepth 1 -type f -name 'scheduled-*.dump' -mtime +14 -delete
echo "Filmiliar backup verified: $backup"
