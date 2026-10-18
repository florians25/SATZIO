# Produktivbetrieb

Zieladresse: **https://satzio.netfusion-service.de**

| Pfad | Inhalt |
|---|---|
| `/` | Produktwebsite (`apps/website`) |
| `/app/` | Web-App / PWA (installierbar) |
| `/api/v1/…` | REST-API – auch für die Android- und iOS-App |
| `/api/docs` | API-Dokumentation |

Alles läuft über den `web`-Container (nginx) auf Port 8080; ein Reverse Proxy mit TLS steht davor.

## 1. Domain & PUBLIC_URL

Schnellweg: `./scripts/setup.sh satzio.netfusion-service.de` setzt `PUBLIC_URL` und bindet den Web-Container nur an 127.0.0.1. Manuell in `.env`:

```env
PUBLIC_URL=https://satzio.netfusion-service.de/app   # Adresse der Web-App (Website liegt unter /)
WEB_BIND=127.0.0.1                      # Web-Container nur lokal binden, wenn ein Reverse Proxy davor sitzt
WEB_PORT=8080
```

`PUBLIC_URL` wird für E-Mail-Links, CORS und das `Secure`-Flag der Cookies verwendet (bei `https://` automatisch aktiv). Danach `docker compose up -d`.

## 2. HTTPS & Reverse Proxy

SATZIO selbst spricht HTTP auf Port 8080. TLS übernimmt ein vorgeschalteter Reverse Proxy. Service Worker und PWA-Installation funktionieren **nur über HTTPS** (Ausnahme: `localhost`).

**Caddy** (automatische Let’s-Encrypt-Zertifikate):

```caddyfile
satzio.netfusion-service.de {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8080
}
```

**nginx**:

```nginx
server {
  listen 443 ssl http2;
  server_name satzio.netfusion-service.de;
  ssl_certificate     /etc/letsencrypt/live/satzio.netfusion-service.de/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/satzio.netfusion-service.de/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
server { listen 80; server_name satzio.netfusion-service.de; return 301 https://$host$request_uri; }
```

Die API vertraut genau einem Proxy-Hop (`trust proxy 1`) für Rate-Limiting nach Client-IP.

## 3. SMTP (E-Mail-Bestätigung, Passwort-Reset)

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false        # true bei Port 465
SMTP_USER=no-reply@example.com
SMTP_PASSWORD=…
MAIL_FROM="SATZIO <no-reply@example.com>"
```

Ohne SMTP funktioniert SATZIO vollständig; nur E-Mails werden nicht versendet (Passwort-Reset dann nur über den Betreiber).

## 4. Registrierung steuern

`REGISTRATION_ENABLED=false` sperrt neue Konten (bestehende melden sich weiter an). Die App zeigt dann einen Hinweis statt des Registrieren-Buttons.

## 5. Backups

```bash
./scripts/backup.sh                         # → backups/satzio-db-<zeit>.dump + satzio-uploads-<zeit>.tar.gz
BACKUP_KEEP=30 BACKUP_DIR=/srv/backups ./scripts/backup.sh
```

- Datenbank: `pg_dump --format=custom` (konsistenter Snapshot im laufenden Betrieb)
- Uploads: Tar-Archiv des Volumes `satzio_uploads`
- Rotation: die neuesten `BACKUP_KEEP` (Standard 14) bleiben erhalten
- Empfohlen: täglicher Cronjob + Kopie außer Haus (z. B. `restic`, `borg`, rclone):

```cron
15 3 * * * cd /opt/satzio && ./scripts/backup.sh >> /var/log/satzio-backup.log 2>&1
```

## 6. Wiederherstellung

```bash
./scripts/restore.sh backups/satzio-db-20261017-030000.dump backups/satzio-uploads-20261017-030000.tar.gz
```

Stoppt API/Web, spielt den Dump mit `pg_restore --clean` ein, stellt optional Uploads wieder her und startet neu (Migrationen laufen automatisch). **Restore regelmäßig testen.**

## 7. Updates

Ein Befehl:

```bash
./scripts/update.sh
```

Das Skript erstellt ein Backup, holt den neuen Stand (`git pull --ff-only`), baut die Images neu, startet die Container, wartet auf den Healthcheck und räumt alte Images auf. Optionen: `--no-backup`, `--no-pull`, `--branch NAME`. Schlägt der Start fehl, zeigt es die Logs und den Befehl zum Zurückwechseln auf die vorherige Version.

Migrationen werden beim Start der API reproduzierbar angewendet (`prisma migrate deploy`). Clients erhalten neue Versionen über den Service Worker mit Hinweis „Neue Version verfügbar“ – es gibt **keinen automatischen Reload mitten im Training**. Lokale, noch nicht synchronisierte Änderungen bleiben in IndexedDB erhalten.

### Fehler „P1000: Authentication failed against database server“

Die API startet nicht und meldet in `docker compose logs api` den Fehler P1000. Dann passt das Datenbank-Passwort nicht zu `POSTGRES_PASSWORD` in `.env`. Das passiert, wenn `.env` neu erzeugt wurde (z. B. nach einem frischen Klon), das Datenbank-Volume aber noch aus der ersten Installation stammt – PostgreSQL übernimmt das Passwort nur beim allerersten Start. Lösung **ohne Datenverlust**:

```bash
./scripts/db-password-sync.sh      # setzt das DB-Passwort auf den Wert aus .env
docker compose restart api
```

`./scripts/update.sh` führt diesen Abgleich bei jedem Update automatisch aus. **Nicht** `docker compose down -v` verwenden – das löscht alle Daten.

## 8. Monitoring & Logs

```bash
docker compose ps                 # Healthchecks aller Dienste
docker compose logs -f api web    # Logs
curl -fsS https://satzio.netfusion-service.de/api/v1/health   # für Uptime-Monitoring (prüft auch die DB)
```

- API-Logs enthalten Methode, Pfad, Status, Dauer und Request-ID – keine Bodies, Query-Strings, IP-Adressen oder E-Mail-Adressen.
- nginx-Zugriffslog ohne IP-Adressen und Query-Strings.
- Fehlerantworten enthalten eine `requestId`, die sich im Log wiederfinden lässt.

## 9. Sicherheit im Betrieb

- Die Datenbank hat **keinen** veröffentlichten Port; nur die Web-App ist erreichbar.
- Container laufen ohne Root, mit `read_only`-Dateisystem, `no-new-privileges` und ohne Linux-Capabilities.
- Secrets nur in `.env` (Rechte 600), nie im Image. `JWT_ACCESS_SECRET` rotieren = alle Access-Tokens ungültig (Refresh funktioniert weiter).
- Swagger kann mit `SWAGGER_ENABLED=false` abgeschaltet werden.
- Hinter einem Firmen-Proxy mit eigener CA bauen: `docker buildx build --secret id=extra_ca,src=/pfad/ca.crt …` (die CA wird nur während des Builds genutzt).

## 10. Datenschutz

Vor öffentlicher Inbetriebnahme: rechtlich geprüfte Datenschutzerklärung, Impressum, ggf. Auftragsverarbeitungsverträge (Hosting, SMTP) und Verzeichnis von Verarbeitungstätigkeiten. Die Vorlagen in der App (`Profil → Datenschutz`) und auf der Website sind **keine Rechtsberatung**.
