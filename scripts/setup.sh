#!/usr/bin/env bash
# SATZIO Ersteinrichtung: prüft Docker, erzeugt .env mit sicheren Secrets, erklärt Optionen.
# Optional mit Domain:  ./scripts/setup.sh satzio.netfusion-service.de
set -euo pipefail
DOMAIN="${1:-}"
cd "$(dirname "$0")/.."

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

echo "SATZIO – Ersteinrichtung"
echo "────────────────────────"

# 1. Docker verfügbar?
if ! command -v docker >/dev/null 2>&1; then
  red "Docker ist nicht installiert. Anleitung: https://docs.docker.com/engine/install/"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  red "Docker Compose (v2) fehlt. Bitte das Compose-Plugin installieren."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  red "Der Docker-Daemon läuft nicht oder du hast keine Berechtigung (ggf. 'sudo' oder Gruppe 'docker')."
  exit 1
fi
green "✓ Docker $(docker version --format '{{.Server.Version}}') und Compose gefunden"

# 2. Konfiguration vorhanden?
if [ ! -f .env ]; then
  cp .env.example .env
  green "✓ .env aus .env.example erstellt"
else
  green "✓ .env vorhanden – fehlende Werte werden ergänzt, vorhandene bleiben unverändert"
fi

gen() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-"$1"
  else head -c 96 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-"$1"; fi
}

set_if_empty() {
  local key="$1" value="$2"
  if grep -qE "^${key}=$" .env; then
    sed -i.bak "s|^${key}=$|${key}=${value}|" .env && rm -f .env.bak
    green "✓ ${key} sicher erzeugt"
  elif ! grep -qE "^${key}=" .env; then
    echo "${key}=${value}" >> .env
    green "✓ ${key} sicher erzeugt"
  fi
}

# Domain übernehmen (HTTPS hinter Reverse Proxy, Web-Container nur lokal binden)
if [ -n "$DOMAIN" ]; then
  sed -i.bak -e "s|^PUBLIC_URL=.*|PUBLIC_URL=https://${DOMAIN}/app|" -e "s|^WEB_BIND=.*|WEB_BIND=127.0.0.1|" .env && rm -f .env.bak
  green "✓ Domain gesetzt: https://${DOMAIN} (Web-App: /app/) – Web-Container lauscht nur auf 127.0.0.1 für den Reverse Proxy"
fi

# 3. Fehlende Secrets erzeugen
set_if_empty POSTGRES_PASSWORD "$(gen 40)"
set_if_empty JWT_ACCESS_SECRET "$(gen 64)"
chmod 600 .env

# 4. Hinweise zu notwendigen Angaben
PUBLIC_URL=$(grep -E '^PUBLIC_URL=' .env | cut -d= -f2-)
WEB_PORT=$(grep -E '^WEB_PORT=' .env | cut -d= -f2-); WEB_PORT=${WEB_PORT:-8080}
SMTP_HOST=$(grep -E '^SMTP_HOST=' .env | cut -d= -f2- || true)
echo
if [[ "$PUBLIC_URL" == http://localhost* ]]; then
  yellow "• PUBLIC_URL ist ${PUBLIC_URL} – für den Betrieb unter einer Domain: ./scripts/setup.sh deine-domain.de"
fi
if [ -z "$SMTP_HOST" ]; then
  yellow "• Kein SMTP konfiguriert: E-Mail-Bestätigung und Passwort-Reset per Mail sind deaktiviert."
  yellow "  Training & Registrierung funktionieren trotzdem. SMTP kann später in .env eingetragen werden."
fi

# 5. Start vorbereiten
echo
green "Fertig. Starte SATZIO mit:"
echo "    docker compose up -d --build"
echo
echo "Danach erreichbar unter:"
echo "    Website:           http://localhost:${WEB_PORT}/"
echo "    Web-App:           http://localhost:${WEB_PORT}/app/"
echo "    API-Dokumentation: http://localhost:${WEB_PORT}/api/docs"
echo "    Healthcheck:       http://localhost:${WEB_PORT}/api/v1/health"
if [ -n "$DOMAIN" ]; then
  echo
  echo "Öffentlich (nach Einrichtung von HTTPS/Reverse Proxy, siehe docs/BETRIEB.md):"
  echo "    https://${DOMAIN}/   ·   https://${DOMAIN}/app/"
fi
echo
echo "Logs: docker compose logs -f api web · Backup: ./scripts/backup.sh"
