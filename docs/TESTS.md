# Tests

Stand: 17.10.2026 – alle Ergebnisse stammen aus tatsächlich ausgeführten Läufen (lokal und in GitHub Actions).

| Suite | Werkzeug | Umfang | Ergebnis |
|---|---|---|---|
| `packages/shared` | Vitest | Gewichtsumrechnung kg/lbs, Dezimalzahlen, Volumen, Wiederholungsbereiche, 1RM, Rekorde inkl. Neuberechnung, Smart Defaults, Progression inkl. Stagnation, Streaks, Trainingsplanung (flexibel/fest, verpasst, tauschen), Coach, Achievements, Notizen-Parser (Inline & Block, Dezimal, lbs, Häkchen, Datumszeilen, Mehrdeutigkeit), Datenqualität der 184 Übungen & 11 Vorlagen | **73/73 bestanden** |
| `apps/web` | Vitest + fake-indexeddb | Outbox: Zusammenführen, keine Änderung gesendeter Ops, Reihenfolge; Sync: Versionen übernehmen, Retry mit gleicher opId, Konflikt → Nutzerentscheidung | **6/6 bestanden** |
| `apps/api` | Vitest + Supertest, echte PostgreSQL | Registrierung, Validierung, Login (E-Mail/Benutzername), Refresh-Rotation & Wiederverwendungserkennung, CSRF, Logout, native Clients, Sitzungen, Passwort vergessen/zurücksetzen (Einmal-Token), E-Mail-Verifizierung, Passwort ändern, Profil/Einstellungen, Konto löschen; Übungen, Filter, eigene Übungen, Favoriten; Pläne (erstellen, versionieren, duplizieren, archivieren, teilen), Vorlagen ohne Gewichte; Workout-Ablauf mit Smart Defaults, Pause, Abschluss, Rotation, Historie & Suche, Rekord-Neuberechnung, Statistik; Körpergewicht, Export/Import ohne Duplikate, Achievements; **Account-Isolation A/B** (Pläne, Workouts, Sätze, Sync, eigene Übungen, Körperdaten, Statistik, Export); **Sync**: geordnete Offline-Queue, doppelte und parallele Requests, Konflikt zwischen Geräten & Auflösung, Validierung | **36/36 bestanden** |
| `tests/e2e` | Playwright (Chromium), Viewports Pixel 7 & iPhone 14 | 16-Schritte-Workflow (öffnen → registrieren → Onboarding → Vorlage → Training → Gewicht/Wdh. → abhaken → Satz hinzufügen → abschließen → Historie → Diagramme → Logout → Login → Daten prüfen → Smart Defaults); Offline: Training ohne Netz fortsetzen, App offline neu laden, Wiederherstellung, Sync nach Reconnect; ungültige Eingaben & Netzwerkfehler | **6/6 bestanden** (gegen Vite-Preview und gegen den Docker-Stack unter `/app/`) |
| Docker | Compose | Build aller Images, Start mit Healthchecks, Migration + Seed, Website `/`, App `/app/`, API; Daten nach `down`/`up` vorhanden; Backup-Skript | manuell geprüft ✔ · CI-Job `docker` |
| Mobile | GitHub Actions | Android-Debug-APK (Gradle) und iOS-Simulator-Build (Xcode, unsigniert) | Workflow-Lauf erfolgreich ✔ |

## Ausführen

```bash
pnpm --filter @satzio/shared test
pnpm --filter @satzio/web test
TEST_DATABASE_URL=postgresql://satzio:satzio@localhost:5432/satzio_test pnpm --filter @satzio/api test
# E2E gegen Docker-Stack:
E2E_BASE_URL=http://localhost:8080 E2E_APP_PATH=/app pnpm --filter @satzio/e2e test
# Doku-Screenshots neu erzeugen:
SCREENSHOTS=1 pnpm --filter @satzio/e2e exec playwright test screenshots --project=mobile-chrome
```

Die API-Tests löschen keine Daten: Migrationen werden nicht-destruktiv angewendet, jeder Test nutzt eigene, zufällig benannte Konten.
