#!/bin/sh
# Startreihenfolge: Migrationen → Seed (idempotent, berührt keine Nutzerdaten) → API
set -e
# Schreibgeschütztes Dateisystem: Caches nach /tmp (tmpfs)
export HOME=/tmp NPM_CONFIG_CACHE=/tmp/.npm
echo "[satzio] Wende Datenbankmigrationen an …"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if ./node_modules/.bin/prisma migrate deploy; then break; fi
  echo "[satzio] Datenbank noch nicht bereit – neuer Versuch in 3 s ($i/10)"
  sleep 3
  if [ "$i" = "10" ]; then echo "[satzio] Migration fehlgeschlagen"; exit 1; fi
done
echo "[satzio] Aktualisiere Übungsbibliothek & Achievements …"
node dist/prisma/seed.js
echo "[satzio] Starte API …"
exec node dist/src/main.js
