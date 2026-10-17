# Mobile Nutzung

SATZIO ist primär eine **installierbare Progressive Web App**. Sie läuft offline, speichert aktive Trainings lokal und synchronisiert automatisch. Voraussetzung für die Installation: Aufruf über **HTTPS** (oder `localhost`).

## Android (Chrome, Edge, Samsung Internet)

1. SATZIO-Adresse in Chrome öffnen und anmelden.
2. Menü ⋮ → **„App installieren“** bzw. „Zum Startbildschirm hinzufügen“ (Chrome bietet es oft automatisch an).
3. SATZIO startet danach im Vollbild ohne Browserleiste. Vibration beim Abhaken und Benachrichtigungen (nach Erlaubnis) werden unterstützt.

## iPhone / iPad (Safari)

1. Adresse in **Safari** öffnen (andere Browser können auf iOS keine Web-Apps installieren).
2. Teilen-Symbol □↑ → **„Zum Home-Bildschirm“** → Hinzufügen.
3. SATZIO vom Home-Bildschirm starten (Safe Areas/Notch werden berücksichtigt).

Einschränkungen unter iOS (Plattform, nicht SATZIO): keine Vibrations-API; Web-Push nur ab iOS 16.4 für installierte Web-Apps; JavaScript wird im Hintergrund pausiert – der Pausentimer läuft korrekt weiter (absolute Endzeit), das Signal kommt aber erst, wenn die App wieder im Vordergrund ist. Browserdaten nicht löschen, solange die Sync-Anzeige ausstehende Änderungen zeigt.

## Native Apps (Capacitor)

`apps/mobile` enthält generierte Android- und iOS-Projekte, die die Web-App verpacken (App-ID `de.satzio.app`). Die Server-Adresse wird beim Build festgelegt:

```bash
cd apps/mobile
SATZIO_API_URL=https://satzio.netfusion-service.de pnpm run android:apk   # → dist/satzio-debug.apk
SATZIO_API_URL=https://satzio.netfusion-service.de pnpm run ios:sync && pnpm run ios:open   # Xcode (macOS)
```

**Cloud-Build:** Der GitHub-Workflow `.github/workflows/mobile.yml` baut bei jedem Push das Debug-APK (Artefakt `satzio-android-debug-apk`) und einen unsignierten iOS-Simulator-Build mit Xcode (Artefakt `satzio-ios-simulator-app`). Server-URL über die Repository-Variable `SATZIO_API_URL`.

Signierung, Release-Builds, App-Store/TestFlight: siehe [apps/mobile/README.md](../apps/mobile/README.md). Native Apps authentifizieren sich ohne Cookies (Refresh-Token im App-Speicher, Header `X-Satzio-Client: native`); die API erlaubt die Origins `capacitor://localhost` und `https://localhost`.
