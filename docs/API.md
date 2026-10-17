# REST-API

Basis: `/api/v1` · Vollständige, interaktive Dokumentation (OpenAPI 3): **`/api/docs`**, JSON: `/api/docs/openapi.json`.

Authentifizierung: `Authorization: Bearer <accessToken>` (aus Login/Registrierung/Refresh). Fehlerformat einheitlich:

```json
{ "statusCode": 400, "code": "VALIDATION_FAILED", "message": "Die Eingaben sind ungültig.", "details": [...], "requestId": "…" }
```

| Bereich | Endpunkte |
|---|---|
| Meta | `GET /meta` · `GET /health` |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/logout-all` · `GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/verify-email` · `POST /auth/verify-email/resend` · `POST /auth/password/forgot` · `POST /auth/password/reset` · `POST /auth/password/change` |
| Nutzer | `GET /users/me` · `PATCH /users/me/profile` · `PATCH /users/me/settings` · `POST /users/me/onboarding` · `POST/DELETE /users/me/avatar` · `POST /users/me/email` · `POST /users/me/delete` · `GET /users/me/export.json` · `GET /users/me/export.csv` · `POST /users/me/import` |
| Übungen | `GET /exercises` (`q`, `muscle`, `equipment`, `favorites`) · `GET /exercises/performance` · `GET /exercises/:id` · `GET /exercises/:id/history` · `POST /exercises` · `PUT/DELETE /exercises/:id` · `PUT/DELETE /exercises/:id/favorite` · `PATCH /exercises/:id/settings` · `POST/DELETE /exercises/:id/images` |
| Pläne | `GET /plans` · `GET /plans/templates` · `POST /plans/from-template` · `POST /plans/import` · `POST /plans` · `GET/PUT/DELETE /plans/:id` · `POST /plans/:id/duplicate` · `POST /plans/:id/activate` · `POST /plans/deactivate` · `PATCH /plans/:id/archive` · `PATCH /plans/:id/favorite` · `GET /plans/:id/export` · `GET /plans/:id/versions` · `POST /plans/:id/versions/:v/restore` · `PATCH /plans/:id/schedule` |
| Training | `GET /today` · `GET /workouts` (Suche/Zeitraum) · `GET /workouts/active` · `POST /workouts` (Start mit Smart Defaults) · `GET/PATCH/DELETE /workouts/:id` · `GET /workouts/:id/summary` · `POST /workouts/:id/pause` · `POST /workouts/:id/resume` · `POST /workouts/:id/finish` · `POST /workouts/:id/exercises` · `PATCH/DELETE /workout-exercises/:id` · `POST /workout-exercises/:id/sets` · `PATCH/DELETE /workout-sets/:id` · `GET /records` |
| Sync | `POST /sync` · `GET /sync/status` |
| Statistik | `GET /analytics/overview` · `/weekly` · `/exercises` · `/exercises/:id` · `/muscles` · `/calendar` (`range`: 7d, 30d, 90d, 6m, 1y, all) |
| Körper | `GET/POST /body-weight` · `PUT/DELETE /body-weight/:id` |
| Erfolge | `GET /achievements` |
| Assistent | `GET /assistant/status` (immer `enabled: false`) |

### Beispiel: Offline-Sync

```http
POST /api/v1/sync
{ "deviceId": "web-123…", "operations": [
  { "opId": "6f1c…", "type": "set.update", "clientTs": "2026-10-17T18:00:00Z", "baseVersion": 1,
    "payload": { "id": "a7e2…", "patch": { "weightKg": 82.5, "completed": true } } } ] }
→ { "results": [ { "opId": "6f1c…", "status": "applied", "entityType": "set", "entityId": "a7e2…", "version": 2 } ], "serverTime": "…" }
```

Status: `applied`, `duplicate` (bereits verarbeitet), `conflict` (mit `serverEntity`), `not_found`, `rejected`.
