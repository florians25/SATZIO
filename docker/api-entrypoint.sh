#!/bin/sh
# Startreihenfolge: Migrationen → Seed (idempotent, berührt keine Nutzerdaten) → API
set -e
# Schreibgeschütztes Dateisystem: Caches nach /tmp (tmpfs)
export HOME=/tmp NPM_CONFIG_CACHE=/tmp/.npm
echo "[satzio] Wende Datenbankmigrationen an …"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if out=$(./node_modules/.bin/prisma migrate deploy 2>&1); then echo "$out"; break; fi
  echo "$out"
  if echo "$out" | grep -q "P1000"; then
    echo "[satzio] Das Datenbank-Passwort passt nicht zu POSTGRES_PASSWORD in .env"
    echo "[satzio] (die Datenbank wurde früher mit einem anderen Passwort angelegt)."
    echo "[satzio] Lösung ohne Datenverlust:  ./scripts/db-password-sync.sh && docker compose restart api"
  fi
  echo "[satzio] Datenbank noch nicht bereit – neuer Versuch in 3 s ($i/10)"
  sleep 3
  if [ "$i" = "10" ]; then echo "[satzio] Migration fehlgeschlagen"; exit 1; fi
done
echo "[satzio] Aktualisiere Übungsbibliothek & Achievements …"
node dist/prisma/seed.js
echo "[satzio] Starte API …"
exec node dist/src/main.js
