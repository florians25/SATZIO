#!/usr/bin/env bash
# Sichert Datenbank (pg_dump, komprimiert) und hochgeladene Bilder nach ./backups.
# Aufbewahrung: BACKUP_KEEP (Standard 14) neueste Sicherungen.
set -euo pipefail
cd "$(dirname "$0")/.."
# .env nicht "sourcen" (Werte mit Leerzeichen/<>), nur benötigte Schlüssel lesen
env_get() { [ -f .env ] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
POSTGRES_USER=${POSTGRES_USER:-$(env_get POSTGRES_USER)}
POSTGRES_DB=${POSTGRES_DB:-$(env_get POSTGRES_DB)}
STAMP=$(date +%Y%m%d-%H%M%S)
DIR=${BACKUP_DIR:-./backups}
KEEP=${BACKUP_KEEP:-14}
mkdir -p "$DIR"
echo "→ Datenbank-Backup …"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-satzio}" -d "${POSTGRES_DB:-satzio}" --format=custom --no-owner > "$DIR/satzio-db-$STAMP.dump"
echo "→ Upload-Backup …"
docker compose run --rm --no-deps -T --entrypoint sh -v "$(pwd)/$DIR:/backup" api -c "tar czf /backup/satzio-uploads-$STAMP.tar.gz -C /data uploads" 2>/dev/null \
  || docker run --rm -v satzio_uploads:/data/uploads:ro -v "$(cd "$DIR" && pwd):/backup" alpine tar czf "/backup/satzio-uploads-$STAMP.tar.gz" -C /data uploads
chmod 600 "$DIR"/satzio-*-"$STAMP".* || true
echo "✓ Gesichert: $DIR/satzio-db-$STAMP.dump, $DIR/satzio-uploads-$STAMP.tar.gz"
# Alte Sicherungen entfernen
ls -1t "$DIR"/satzio-db-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DIR"/satzio-uploads-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
