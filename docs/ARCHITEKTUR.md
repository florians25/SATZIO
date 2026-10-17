# Architektur

```
┌────────────── Browser / PWA / Capacitor ──────────────┐        ┌──────── Docker ────────┐
│ React-UI ─ Zustand (aktives Training, optimistisch)   │        │ web (nginx, :8080)     │
│    │                    │                             │  HTTPS │   ├─ statische PWA     │
│ TanStack Query ◄─ persistiert in IndexedDB            │◄──────►│   └─ /api → api:3000   │
│    │                    ▼                             │        │ api (NestJS)           │
│    │            Dexie: workouts · outbox · conflicts  │        │   └─ Prisma            │
│    └─ Service Worker (App-Shell offline)              │        │ postgres (intern)      │
└───────────────────────────────────────────────────────┘        └────────────────────────┘
```

## Pakete

- **packages/shared** – reine TypeScript-Logik ohne Abhängigkeiten zu Browser/Server: Notizen-Parser, Übungs-Matcher, Smart Defaults, Progression, Rekorde (inkl. 1RM nach Epley), Wochen-Streaks, Trainingsplanung (flexibel/fest), Coach-Regeln, Achievements, Zod-Schemata (Validierung in App **und** API), Übungsbibliothek (184 Übungen) und 11 Vorlagen. Dieselben Regeln laufen offline im Client und auf dem Server.
- **apps/api** – NestJS-Module: `auth`, `users` (Profil, Einstellungen, Export/Import, Konto löschen), `exercises`, `plans`, `workouts` (inkl. Heute-Ansicht, Rekorde), `sync`, `analytics`, `body`, `achievements`, `meta`, `assistant` (nur Schnittstelle).
- **apps/web** – React-PWA. Routen werden per Code-Splitting geladen.

## Datenmodell (Prisma, PostgreSQL)

UUID-Schlüssel, `createdAt`/`updatedAt`, Gewichte intern in **kg** als `Decimal(9,4)` (verlustfreie lbs-Umrechnung).

| Bereich | Modelle |
|---|---|
| Konto | `User`, `UserProfile`, `UserSettings`, `AuthSession`, `RefreshToken`, `EmailVerificationToken`, `PasswordResetToken` |
| Übungen | `Exercise` (Bibliothek: `ownerId = null`; eigene: `ownerId`), `ExerciseMuscle`, `ExerciseMedia`, `ExerciseFavorite`, `UserExercise` (Gewichtsschritt, Standardwerte, Geräteeinstellung) |
| Pläne | `WorkoutPlan`, `WorkoutPlanDay`, `WorkoutPlanExercise`, `PlannedSet`, `WorkoutPlanVersion` (Snapshots), `TrainingSchedule` (Modus, Rotationszeiger, Pausiert, Einzeländerungen) |
| Trainings | `WorkoutSession`, `WorkoutSessionExercise` (**Schnappschuss** von Name/Muskel/Zielwerten), `WorkoutSet` (inkl. Ziel-Schnappschuss und Herkunft der Vorbelegung) |
| Auswertung | `PersonalRecord` (eindeutig je Nutzer/Übung/Rekordschlüssel), `BodyWeightEntry`, `Achievement`, `UserAchievement` |
| Sync | `SyncOperation` (eindeutig je Nutzer + opId) |

Plan-Sätze (`PlannedSet`) und tatsächliche Sätze (`WorkoutSet`) sind getrennt. Historische Trainings speichern ihre Werte selbst – spätere Plan- oder Übungsänderungen verändern sie nicht.

## Offline-First & Synchronisation

1. Jede Änderung im Training (Gewicht, Wdh., Abhaken, Satz/Übung hinzufügen …) aktualisiert sofort den Zustand und schreibt **in einer IndexedDB-Transaktion** die Arbeitskopie des Trainings und eine Operation in die **Outbox**. Schreibvorgänge sind serialisiert, Eingabefelder speichern auch beim Verlassen/Unmount → keine verlorenen Tastendrücke.
2. Jede Operation hat eine **eindeutige `opId`** (UUID), die Basisversion der Entität und die Geräte-ID. IDs neuer Trainings/Übungen/Sätze erzeugt der Client – damit sind Trainings vollständig offline anlegbar.
3. Die Sync-Engine sendet die Outbox geordnet an `POST /api/v1/sync` (max. 100 Operationen/Request), bei Netzwerkfehlern mit exponentiellem Backoff, bei `online`/Sichtbarkeit sofort.
4. Der Server prüft pro Operation `SyncOperation(userId, opId)`: schon verarbeitet → gespeichertes Ergebnis mit Status `duplicate` (kein doppelter Satz bei Retries/Parallel-Requests).
5. **Konfliktstrategie:** Jede Entität hat `version` und `lastDeviceId`. Konflikt, wenn `version > baseVersion` **und** die letzte Änderung von einem **anderen Gerät** stammt. Dann wird nichts angewendet; der Client erhält den Serverstand, markiert die Operation als Konflikt und zeigt beide Werte an („Meine Änderung behalten“ → erneut mit aktueller Basisversion senden, „Andere übernehmen“). Aufeinanderfolgende Änderungen desselben Geräts sind nie ein Konflikt. Reihenfolge-Änderungen von Übungen sind bewusst „last write wins“.
6. Zusammenführen: Noch **nie gesendete** Patches derselben Entität werden in der Outbox zusammengefasst; bereits versuchte Operationen werden nie verändert (Idempotenz bleibt korrekt).
7. Pläne werden per Auto-Save (`PUT /plans/:id`, entprellt) gespeichert; ungespeicherte Entwürfe liegen in IndexedDB und werden bei Verbindung nachgereicht. Lesedaten (Heute, Pläne, Übungen, Leistungsdaten) werden aus dem persistierten Query-Cache auch offline angezeigt.

## Rekorde

Rekorde werden je Übung **vollständig und deterministisch aus der Historie neu berechnet** (beim Abschluss und bei jeder Änderung an abgeschlossenen Trainings). Dadurch sind sie nach Korrekturen richtig und Syncs erzeugen keine Duplikate. „Neu“ ist ein Rekord nur, wenn er einen vorher existierenden Wert übertrifft. Live-Erkennung im Training vergleicht mit den gecachten Bestwerten.

## Sicherheit

- Passwörter: Argon2id (19 MiB, t=2, p=1), Rehash bei geänderten Parametern, Zeitausgleich bei unbekannten Konten.
- Access-Token: JWT (HS256, 15 min) nur im Arbeitsspeicher. Refresh-Token: zufällig (48 Byte), nur als SHA-256-Hash gespeichert, **rotierend**, Wiederverwendung (außerhalb 15 s Gnadenfrist) widerruft die ganze Sitzung. Web: HttpOnly-, SameSite=Strict-Cookie auf `/api/v1/auth`; native Apps: Token im App-Speicher.
- CSRF: Double-Submit-Token für die Cookie-Endpunkte (Refresh/Logout); alle anderen Endpunkte nutzen Bearer-Header.
- Jeder Request prüft die Sitzung in der DB → Logout/Widerruf wirkt sofort.
- Autorisierung serverseitig über `userId` in jeder Abfrage; Isolation durch Integrationstests (Nutzer A vs. B) abgesichert.
- Rate-Limits (global + streng für Auth), Helmet-Header, CSP (nginx), Body-Limits, sichere Uploads (Dekodierung & Neu-Kodierung mit sharp, EXIF entfernt, zufällige Dateinamen), CSV-Formel-Injection-Schutz im Export, einheitliche Fehler ohne interne Details, Logs ohne personenbezogene Daten, keine öffentliche Datenbank.

## KI-Assistent (vorbereitet, nicht aktiv)

`apps/api/src/assistant/assistant.ts` definiert die Schnittstelle `AssistantProvider` (Pläne erklären, Fortschritt zusammenfassen, Notizen strukturieren, Alternativen). `GET /api/v1/assistant/status` meldet `enabled: false`. Es gibt keine simulierten KI-Antworten; alle Funktionen arbeiten ohne KI.
