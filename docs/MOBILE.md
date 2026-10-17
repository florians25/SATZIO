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

## Plattform-Designs

Die App erkennt beim Start die Plattform (`apps/web/src/lib/platform.ts`, gesetzt als `<html data-platform="…">` schon vor dem ersten Paint) und spricht die jeweilige Designsprache – rein über CSS (`apps/web/src/platform.css`), die Seiten selbst bleiben unverändert:

- **iOS (App, Safari, Home-Bildschirm-App): Liquid Glass** – durchscheinende Glasflächen mit starkem Weichzeichner und Lichtkante, schwebende Kapsel-Tab-Bar über dem Home-Indikator mit gleitender „Linse“ für den aktiven Tab, Glas-Leisten für „Training läuft“ und den Pausentimer, transparente Navigationsleiste mit großem Titel, die beim Scrollen zu Glas wird, schwebende Glas-Sheets mit großen Radien, Kapsel-Buttons, SF-Systemschrift und federnde Animationen.
- **Android (App, Chrome, installierte PWA): Material Design 3** – Navigationsleiste (80 dp) mit Indikator-Pille und Beschriftung, Top App Bar mit Tonfläche beim Scrollen, Tonflächen statt Rahmen, Filled/Tonal/Outlined-Buttons, Material-Bottom-Sheets mit Ziehgriff, Wellen-Feedback beim Tippen, Roboto.
- **Desktop/sonstige:** bisheriges Design.
- Barrierefreiheit: Bei „Transparenz reduzieren“ werden Glasflächen massiv, bei „Bewegung reduzieren“ entfallen Animationen.
- Zum Testen lässt sich das Design erzwingen: `localStorage.setItem('satzio-platform-style', 'ios' | 'android' | 'web')` und neu laden.

Screenshots: `docs/screenshots/platform-ios-*.png`, `docs/screenshots/platform-android-*.png`.

## Native Gerätefunktionen (nur in den Apps)

Implementiert in `apps/web/src/lib/native.ts` (Plugins werden lazy geladen; im Browser passiert nichts):

- **Haptik:** echtes Taptic-/Vibrationsfeedback beim Abhaken und am Pausenende (Einstellung „Vibration“).
- **Pausentimer im Hintergrund:** Beim Start/Verlängern des Pausentimers wird eine lokale Benachrichtigung zur exakten Endzeit beim Betriebssystem geplant – sie kommt zuverlässig auch bei gesperrtem Gerät oder geschlossener App; Überspringen hebt sie auf. Die **Benachrichtigungs-Erlaubnis wird beim ersten Pausentimer abgefragt** (widerrufbar in den System-Einstellungen). Android nutzt `SCHEDULE_EXACT_ALARM`; hat der Nutzer exakte Alarme deaktiviert, fällt das System auf eine leicht ungenauere Zustellung zurück.
- **Display bleibt an,** solange ein Training läuft (nicht pausiert).
- **Android-Zurück-Taste:** schließt zuerst offene Sheets, navigiert dann zurück und minimiert die App auf der Startseite.
- **Statusleiste** folgt dem hellen/dunklen Design; iOS-Tastatur ohne Zubehörleiste, native Größenanpassung.

Nach dem Hinzufügen von Plugins: `pnpm --filter @satzio/mobile build` (Android) und `pnpm --filter @satzio/mobile ios:sync` (kopiert die Plugin-Quellen nach `ios/App/CapApp-SPM/Plugins`, damit das Xcode-Projekt eigenständig bleibt).
