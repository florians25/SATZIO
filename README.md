# SATZIO

**Trainieren. Abhaken. Stärker werden.** – Fitness-Tracking so schnell wie eine Notizen-App, mit dem Funktionsumfang einer Premium-Trainings-App. Vollständig self-hosted, ohne Cloud-Zwang.

```
PUSH DAY
Bankdrücken
✓ 60 kg × 12
✓ 70 kg × 10
☐ 75 kg × 8
```

App öffnen → heutigen Plan sehen → Gewicht ggf. ändern → Satz abhaken → fertig. Alles andere (Speichern, Synchronisieren, Rekorde, Vorschläge) erledigt SATZIO im Hintergrund.

| | |
|---|---|
| Web-App / PWA | React 19, Vite, Tailwind CSS 4, Radix UI, TanStack Query, Zustand, Dexie (IndexedDB), Recharts, Motion |
| API | NestJS 11, Prisma 6, PostgreSQL 16, OpenAPI/Swagger, JWT + rotierende Refresh-Tokens, Argon2id |
| Mobil | Installierbare PWA (Android/iOS) · Capacitor-Projekte für Android und iOS (`apps/mobile`) |
| Betrieb | Docker Compose: `postgres`, `api`, `web` (+ optional `website`, `mailpit`) |

Screenshots: [`docs/screenshots`](docs/screenshots) · Produktwebsite: [`apps/website`](apps/website)

---

## Schnellstart (Docker)

Voraussetzung: Docker Engine ≥ 24 mit Compose-Plugin.

```bash
git clone <repo-url> satzio && cd satzio
./scripts/setup.sh            # prüft Docker, legt .env an, erzeugt sichere Secrets
docker compose up -d --build  # baut und startet Datenbank, API und Web-App
```

| Adresse | |
|---|---|
| **http://localhost:8080** | Web-App (Port per `WEB_PORT` in `.env`) |
| http://localhost:8080/api/docs | API-Dokumentation (Swagger) |
| http://localhost:8080/api/v1/health | Healthcheck |
| http://localhost:8090 | Produktwebsite (optional: `docker compose --profile website up -d --build`) |
| http://localhost:8025 | Mail-Testpostfach (optional: `docker compose --profile dev up -d`, dazu `SMTP_HOST=mailpit`, `SMTP_PORT=1025`) |

Beim Start wendet die API automatisch alle Datenbankmigrationen an und aktualisiert Übungsbibliothek und Achievements (idempotent – Nutzerdaten werden nie überschrieben). Es ist **keine manuelle Datenbankeinrichtung** und **kein manuell angelegter erster Benutzer** nötig: Ist `REGISTRATION_ENABLED=true`, registriert sich jeder direkt in der App.

### Registrierung

1. App öffnen → „Kostenlos registrieren“
2. Benutzername, E-Mail, Passwort (mind. 8 Zeichen, Buchstabe + Zahl) – Live-Validierung mit deutschen Hinweisen
3. Automatisch angemeldet → Onboarding (Ziel, Level, Trainingstage, Startoption) in unter einer Minute
4. Direkt zum heutigen Training. E-Mail-Bestätigung ist optional und blockiert nichts.

---

## Entwicklung

Voraussetzungen: Node.js ≥ 22, pnpm 10, PostgreSQL 16 (lokal oder `docker compose up -d postgres` mit freigegebenem Port).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env     # DATABASE_URL & JWT_ACCESS_SECRET anpassen
pnpm --filter @satzio/shared build
pnpm --filter @satzio/api exec prisma migrate deploy
pnpm --filter @satzio/api seed:dev
pnpm dev:api                               # http://localhost:3000
pnpm dev:web                               # http://localhost:5173 (Proxy /api → :3000)
```

### Tests

```bash
pnpm --filter @satzio/shared test   # Unit-Tests der Domänenlogik (Parser, Smart Defaults, 1RM, Rekorde, Streaks, …)
pnpm --filter @satzio/web test      # Unit-Tests der Offline-Outbox/Sync-Engine (fake-indexeddb)
pnpm --filter @satzio/api test      # Integrationstests gegen echte PostgreSQL (TEST_DATABASE_URL)
pnpm --filter @satzio/e2e test      # Playwright-E2E gegen laufende Instanz (E2E_BASE_URL, Standard :4173)
```

Details und Ergebnisse: [`docs/TESTS.md`](docs/TESTS.md).

---

## Projektstruktur

```
apps/
  api/        NestJS-API, Prisma-Schema, Migrationen, Seed, Integrationstests
  web/        React-PWA (Offline-First, Workout-Editor, Pläne, Statistiken)
  mobile/     Capacitor-Projekte (android/, ios/) für native Apps
  website/    Statische Produktwebsite
packages/
  shared/     Gemeinsame Logik & Daten: Notizen-Parser, Smart Defaults, Progression,
              Rekorde, Streaks, Planung, Zod-Schemata, 184 Übungen, 11 Vorlagen
docker/       Dockerfiles, nginx-Konfiguration, Entrypoint
scripts/      setup.sh, backup.sh, restore.sh
tests/e2e/    Playwright-Tests
docs/         Dokumentation, Screenshots
```

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/BETRIEB.md](docs/BETRIEB.md) | Produktivbetrieb: Domain, HTTPS, Reverse Proxy, SMTP, Backups, Restore, Updates, Monitoring, Logs |
| [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) | Architektur, Datenmodell, Offline-Sync & Konfliktstrategie, Sicherheit |
| [docs/API.md](docs/API.md) | REST-API-Überblick (vollständig: Swagger unter `/api/docs`) |
| [docs/MOBILE.md](docs/MOBILE.md) | PWA-Installation auf Android/iPhone, Capacitor-Builds |
| [docs/TESTS.md](docs/TESTS.md) | Teststrategie und Ergebnisse |
| [docs/STATUS.md](docs/STATUS.md) | Umsetzungsstand, bekannte Einschränkungen, offene Punkte |
| [docs/MEDIEN.md](docs/MEDIEN.md) | Bildquellen & Lizenzen |
| [apps/mobile/README.md](apps/mobile/README.md) | Native Builds im Detail |

> **Rechtlicher Hinweis:** Vor einer öffentlichen Inbetriebnahme sind ein rechtlich geprüftes Datenschutzkonzept, eine Datenschutzerklärung und ein Impressum erforderlich. Die mitgelieferten Texte sind Vorlagen. SATZIO gibt keine medizinischen Empfehlungen.
