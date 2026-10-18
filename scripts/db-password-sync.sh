#!/usr/bin/env bash
# Setzt das Passwort des Datenbank-Benutzers auf den Wert aus .env (POSTGRES_PASSWORD).
# Nötig, wenn .env neu erzeugt wurde, das Datenbank-Volume aber älter ist – PostgreSQL
# übernimmt POSTGRES_PASSWORD nur beim allerersten Start. Symptom in den API-Logs:
#   Error: P1000: Authentication failed against database server
# Daten bleiben unverändert. Nutzt die lokale Socket-Verbindung im Container (ohne Passwort).
set -euo pipefail
cd "$(dirname "$0")/.."

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

[ -f .env ] || { red ".env fehlt – zuerst ./scripts/setup.sh ausführen."; exit 1; }

docker compose up -d postgres >/dev/null
for i in $(seq 1 30); do
  docker compose exec -T postgres sh -c 'pg_isready -q -U "$POSTGRES_USER"' 2>/dev/null && break
  sleep 2
  [ "$i" = 30 ] && { red "Datenbank startet nicht: docker compose logs postgres"; exit 1; }
done

# Werte aus der Container-Umgebung (= aktuelle .env); psql-Variablen quoten sicher.
if docker compose exec -T postgres sh -c '
  printf "%s\n" "ALTER ROLE :\"u\" WITH PASSWORD :'"'"'pw'"'"';" |
    psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -v u="$POSTGRES_USER" -v pw="$POSTGRES_PASSWORD"
' >/dev/null; then
  green "✓ Datenbank-Passwort mit .env abgeglichen"
else
  red "✗ Passwort konnte nicht gesetzt werden. Wurde POSTGRES_USER in .env geändert?"
  red "  Vorhandene Rollen: docker compose exec postgres psql -U postgres -c '\\du'"
  exit 1
fi
