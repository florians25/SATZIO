#!/usr/bin/env bash
# Stellt eine Sicherung wieder her:  ./scripts/restore.sh backups/satzio-db-YYYYMMDD-HHMMSS.dump [uploads.tar.gz]
# ACHTUNG: Ersetzt den aktuellen Datenbankinhalt vollständig.
set -euo pipefail
cd "$(dirname "$0")/.."
# .env nicht "sourcen" (Werte mit Leerzeichen/<>), nur benötigte Schlüssel lesen
env_get() { [ -f .env ] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
POSTGRES_USER=${POSTGRES_USER:-$(env_get POSTGRES_USER)}
POSTGRES_DB=${POSTGRES_DB:-$(env_get POSTGRES_DB)}
DUMP=${1:?Pfad zur .dump-Datei angeben}
UPLOADS=${2:-}
[ -f "$DUMP" ] || { echo "Datei nicht gefunden: $DUMP"; exit 1; }
read -r -p "Aktuelle SATZIO-Datenbank wird überschrieben. Fortfahren? (ja/nein) " ok
[ "$ok" = "ja" ] || { echo "Abgebrochen."; exit 1; }
echo "→ API stoppen …"
docker compose stop api web
echo "→ Datenbank wiederherstellen …"
docker compose exec -T postgres pg_restore -U "${POSTGRES_USER:-satzio}" -d "${POSTGRES_DB:-satzio}" --clean --if-exists --no-owner < "$DUMP"
if [ -n "$UPLOADS" ]; then
  echo "→ Uploads wiederherstellen …"
  docker run --rm -v satzio_uploads:/data/uploads -v "$(cd "$(dirname "$UPLOADS")" && pwd):/backup:ro" alpine \
    sh -c "rm -rf /data/uploads/* && tar xzf /backup/$(basename "$UPLOADS") -C /data"
fi
echo "→ Starten (Migrationen laufen automatisch) …"
docker compose up -d
echo "✓ Wiederherstellung abgeschlossen."
