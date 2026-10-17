#!/usr/bin/env bash
# SATZIO aktualisieren – ein Befehl:
#   ./scripts/update.sh            # Backup → git pull → neu bauen → neu starten → Healthcheck
# Optionen:
#   --no-backup     kein Backup vorher (nicht empfohlen)
#   --no-pull       ohne git pull (z. B. nach manuellem Code-Update)
#   --branch NAME   bestimmten Branch holen (Standard: aktueller Branch)
set -euo pipefail
cd "$(dirname "$0")/.."

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

BACKUP=1; PULL=1; BRANCH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-backup) BACKUP=0 ;;
    --no-pull) PULL=0 ;;
    --branch) BRANCH="${2:?Branch-Name fehlt}"; shift ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) red "Unbekannte Option: $1"; exit 1 ;;
  esac
  shift
done

[ -f .env ] || { red ".env fehlt – zuerst ./scripts/setup.sh ausführen."; exit 1; }
docker compose version >/dev/null 2>&1 || { red "Docker Compose nicht gefunden."; exit 1; }

env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
WEB_PORT=$(env_get WEB_PORT); WEB_PORT=${WEB_PORT:-8080}
OLD_REV=$(git rev-parse --short HEAD 2>/dev/null || echo "unbekannt")

echo "SATZIO-Update (aktuell: $OLD_REV)"
echo "────────────────────────────────"

# 1. Backup (nur wenn die Datenbank läuft)
if [ "$BACKUP" = 1 ]; then
  if docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
    echo "→ Backup …"
    ./scripts/backup.sh
  else
    yellow "• Datenbank läuft nicht – Backup übersprungen."
  fi
fi

# 2. Neuen Stand holen
if [ "$PULL" = 1 ] && [ -d .git ]; then
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    red "Lokale Änderungen im Repository – bitte committen/verwerfen oder mit --no-pull aktualisieren."
    git status --short --untracked-files=no
    exit 1
  fi
  echo "→ Neuen Stand holen …"
  if [ -n "$BRANCH" ]; then
    git fetch origin "$BRANCH" && git checkout "$BRANCH" && git pull --ff-only origin "$BRANCH"
  else
    git pull --ff-only
  fi
fi
NEW_REV=$(git rev-parse --short HEAD 2>/dev/null || echo "unbekannt")

# 3. Neu bauen & starten (Migrationen laufen beim API-Start automatisch)
echo "→ Images bauen …"
docker compose build --pull
echo "→ Neu starten …"
docker compose up -d --remove-orphans

# 4. Healthcheck
echo -n "→ Warte auf SATZIO "
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/v1/health" >/dev/null 2>&1; then
    echo; green "✓ SATZIO läuft ($OLD_REV → $NEW_REV)"
    break
  fi
  echo -n "."; sleep 3
  if [ "$i" = 60 ]; then
    echo; red "✗ SATZIO antwortet nicht. Logs:"
    docker compose logs --tail=80 api
    echo
    yellow "Zurück zur vorherigen Version: git checkout $OLD_REV && ./scripts/update.sh --no-pull"
    yellow "Daten wiederherstellen (falls nötig): ./scripts/restore.sh backups/<neuestes>.dump"
    exit 1
  fi
done

# 5. Aufräumen: alte, ungenutzte Images entfernen
docker image prune -f >/dev/null 2>&1 || true
docker compose ps
echo
echo "Website: http://localhost:${WEB_PORT}/  ·  Web-App: http://localhost:${WEB_PORT}/app/"
