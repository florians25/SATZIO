# SATZIO – native Apps (Android & iOS)

Dieses Paket (`@satzio/mobile`) verpackt die Web-App aus `apps/web` mit
[Capacitor 7](https://capacitorjs.com/) als native App für Android und iOS.
Die Web-Dateien werden **lokal im App-Bundle** ausgeliefert (kein Remote-Laden),
nur die API wird über das Netz angesprochen.

| Eigenschaft     | Wert                                   |
| --------------- | -------------------------------------- |
| App-ID          | `de.satzio.app`                        |
| App-Name        | `SATZIO`                               |
| Web-Quelle      | `../web/dist` (siehe `capacitor.config.ts`) |
| Origin Android  | `https://localhost` (`androidScheme: 'https'`) |
| Origin iOS      | `capacitor://localhost`                |
| Farben          | Hintergrund `#0B0F0E`, Primär `#B7FF3C` |

## Versionen

| Paket                      | Version |
| -------------------------- | ------- |
| @capacitor/core / cli      | 7.6.9   |
| @capacitor/android / ios   | 7.6.9   |
| @capacitor/splash-screen   | 7.0.5   |
| @capacitor/status-bar      | 7.0.6   |
| @capacitor/haptics         | 7.0.5   |
| @capacitor/preferences     | 7.0.4   |
| @capacitor/assets (dev)    | 3.0.5   |

Android-Projekt (generiert): Android Gradle Plugin 8.7.2, Gradle 8.11.1,
`compileSdk`/`targetSdk` 35, `minSdk` 23 (`android/variables.gradle`).
iOS-Projekt (generiert): Swift Package Manager (kein CocoaPods), iOS ≥ 14.

## Verzeichnisstruktur

```
apps/mobile/
├── capacitor.config.ts   # App-ID, Splash-/Statusbar-Konfiguration
├── package.json          # Skripte (build:web, sync, android:apk, ios:open …)
├── resources/            # Quellbilder: icon.png (1024²), splash.png (2732²)
├── android/              # natives Android-Projekt (Gradle) – wird eingecheckt
└── ios/                  # natives iOS-Projekt (Xcode, SPM) – wird eingecheckt
```

Build-Ausgaben, kopierte Web-Assets (`android/app/src/main/assets/public`,
`ios/App/App/public`), `local.properties` usw. sind über die von Capacitor
generierten `android/.gitignore` und `ios/.gitignore` ausgeschlossen.
`dist/` (fertige APKs) sollte ebenfalls nicht eingecheckt werden.

## Voraussetzungen

Allgemein:

- Node.js ≥ 22.12 und pnpm 10 (`corepack enable`)
- Abhängigkeiten im Repo-Root installieren: `pnpm install`

Android:

- JDK 21 (oder 17), z. B. `openjdk-21-jdk-headless` bzw. das in Android Studio enthaltene JBR
- Android SDK mit `platforms;android-35`, `build-tools;35.0.0` (bzw. die Version,
  die das Android Gradle Plugin verlangt) und `platform-tools` (für `adb`).
  Am einfachsten über Android Studio, alternativ über die Command-line Tools:

  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk          # bzw. /opt/android-sdk
  sdkmanager --licenses
  sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
  ```

  Gradle findet das SDK über `ANDROID_HOME` oder über
  `android/local.properties` (`sdk.dir=/pfad/zum/sdk`, nicht einchecken).
- Netzwerkzugriff auf `dl.google.com` / `maven.google.com` (Google-Maven-Repository
  für das Android Gradle Plugin und AndroidX) sowie `repo.maven.apache.org` und
  `services.gradle.org`.

iOS:

- Mac mit aktuellem Xcode (≥ 16 empfohlen), Xcode Command Line Tools
- Apple-Developer-Account (für Gerät/TestFlight/App Store)
- CocoaPods wird **nicht** benötigt – das Projekt nutzt Swift Package Manager.

## 1. Server-URL festlegen (wichtig!)

In der nativen App gibt es keinen Reverse-Proxy – die API muss als **absolute URL**
in den Web-Build eingebaut werden. Das passiert über die Vite-Variable
`VITE_API_URL`, die das Skript `build:web` aus `SATZIO_API_URL` setzt:

```bash
# eigene Server-URL eintragen – OHNE abschließenden Slash
export SATZIO_API_URL=https://satzio.meine-domain.de
pnpm --filter @satzio/mobile build:web
```

Ohne `SATZIO_API_URL` verbindet sich die App mit dem Standardserver
`https://satzio.netfusion-service.de` (API unter `/api/v1`). Wer einen eigenen Server
betreibt, baut die App mit der eigenen URL.

Serverseitig muss die API die Origins `capacitor://localhost` (iOS) und
`https://localhost` (Android) per CORS erlauben (ist in SATZIO bereits so
vorgesehen) und per HTTPS mit gültigem Zertifikat erreichbar sein.

Die native Authentifizierung ist in der Web-App bereits umgesetzt: Erkennt sie
`window.Capacitor.isNativePlatform()`, sendet sie den Header
`X-Satzio-Client: native` und verwaltet das Refresh-Token selbst (statt per
HttpOnly-Cookie).

Hinweis: `build:web` schreibt nach `apps/web/dist` – also in denselben Ordner wie
der normale Web-Build. Vor einem Web-Deployment daher wieder regulär bauen.

## 2. Web-Build in die nativen Projekte kopieren

```bash
cd apps/mobile
pnpm run build        # = build:web + cap sync (Android und iOS)
# oder einzeln:
pnpm run build:web
pnpm run sync         # npx cap sync
```

`cap sync` kopiert `../web/dist` nach `android/app/src/main/assets/public` bzw.
`ios/App/App/public` und aktualisiert die Plugin-Registrierung
(`android/capacitor.settings.gradle`, `ios/App/CapApp-SPM/Package.swift`).
Diese Dateien enthalten Pfade in den pnpm-Store (`node_modules/.pnpm/...`) und
werden nach jedem Versions-Update von Capacitor-Plugins durch `cap sync` neu
geschrieben – nach `pnpm install` also immer `pnpm run sync` ausführen.

Hinweis Service Worker: `vite-plugin-pwa` erzeugt auch im App-Build eine `sw.js`.
Die Web-App registriert den Service Worker selbst; in der App ist er unnötig,
schadet aber nicht (Inhalte liegen ohnehin lokal).

## 3. Icons & Splash-Screens

Quellbilder liegen in `resources/` (`icon.png` 1024×1024, `splash.png` 2732×2732).
Neu erzeugen (Android-Mipmaps/Adaptive Icons und iOS-Asset-Catalog):

```bash
cd apps/mobile
pnpm run assets
```

Die generierten Bilder sind bereits im Repo enthalten.

## 4. Android: Debug-APK bauen

```bash
cd apps/mobile
SATZIO_API_URL=https://satzio.meine-domain.de pnpm run android:apk
# Ergebnis: apps/mobile/dist/satzio-debug.apk
```

Das Skript führt aus: Web-Build → `cap sync` → `./gradlew assembleDebug` →
Kopie von `android/app/build/outputs/apk/debug/app-debug.apk` nach `dist/`.

Manuell:

```bash
cd apps/mobile/android
./gradlew assembleDebug
```

Oder in Android Studio: `pnpm run android:open` (= `npx cap open android`).

### Installation per adb

```bash
adb devices                                   # Gerät mit aktiviertem USB-Debugging
adb install -r apps/mobile/dist/satzio-debug.apk
```

Alternativ direkt bauen und starten: `npx cap run android` (im Ordner `apps/mobile`).

## 5. Android: Release (signiert)

1. Keystore einmalig erzeugen und **sicher aufbewahren** (nicht einchecken!):

   ```bash
   keytool -genkeypair -v -keystore satzio-release.jks -alias satzio \
     -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Zugangsdaten außerhalb des Repos ablegen, z. B. in `~/.gradle/gradle.properties`:

   ```properties
   SATZIO_STORE_FILE=/pfad/zu/satzio-release.jks
   SATZIO_STORE_PASSWORD=...
   SATZIO_KEY_ALIAS=satzio
   SATZIO_KEY_PASSWORD=...
   ```

3. In `android/app/build.gradle` eine Signing-Konfiguration ergänzen:

   ```groovy
   android {
       signingConfigs {
           release {
               if (project.hasProperty('SATZIO_STORE_FILE')) {
                   storeFile file(SATZIO_STORE_FILE)
                   storePassword SATZIO_STORE_PASSWORD
                   keyAlias SATZIO_KEY_ALIAS
                   keyPassword SATZIO_KEY_PASSWORD
               }
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               // minifyEnabled false (Standard von Capacitor)
           }
       }
   }
   ```

4. Bauen:

   ```bash
   cd apps/mobile
   SATZIO_API_URL=https://satzio.meine-domain.de pnpm run android:release
   # APK: android/app/build/outputs/apk/release/app-release.apk
   # AAB (Play Store): android/app/build/outputs/bundle/release/app-release.aab
   ```

   Vor jedem Store-Upload `versionCode`/`versionName` in `android/app/build.gradle` erhöhen.

## 6. iOS: in Xcode öffnen, signieren, bauen

Das iOS-Projekt ist **eigenständig eingecheckt**: Web-App (`ios/App/App/public`,
verbunden mit `https://satzio.netfusion-service.de`) und Capacitor-Plugins
(`ios/App/CapApp-SPM/Plugins`) liegen im Repository. Auf dem Mac genügt:

1. `apps/mobile/ios/App/App.xcodeproj` in Xcode öffnen.
2. Warten, bis Xcode „Resolve Packages“ abgeschlossen hat (lädt nur
   `capacitor-swift-pm` von GitHub). Bei Problemen: *File → Packages → Reset Package Caches*.
3. Target **App** → *Signing & Capabilities*: „Automatically manage signing“,
   eigenes **Team** wählen. Bundle-ID `de.satzio.app` ggf. anpassen
   (dann auch `appId` in `capacitor.config.ts`).
4. Gerät oder Simulator wählen → **Run** (⌘R).
5. TestFlight/App Store: „Any iOS Device (arm64)“ → *Product → Archive* →
   *Distribute App*. Vorher Version/Build-Nummer unter *General* erhöhen.

**Fehler „Missing package product CapApp-SPM“** (ältere Stände): Das Projekt verwies
auf Plugins in `node_modules`, die auf dem Mac ohne `pnpm install` fehlen. Lösung:
aktuellen Stand holen – oder im Repo `pnpm install && pnpm --filter @satzio/mobile ios:sync`
ausführen und danach *File → Packages → Reset Package Caches*.

Web-App oder Server-URL geändert? Neu einbetten:

```bash
pnpm install                                                # im Repo-Root
SATZIO_API_URL=https://satzio.netfusion-service.de pnpm --filter @satzio/mobile ios:sync
# = Web-Build + cap sync ios + Plugins ins Projekt kopieren (scripts/vendor-ios.mjs)
```

> **Hinweis zum Test-Stand:** Das Projekt wird bei jedem Push in GitHub Actions auf
> macOS mit Xcode für den Simulator gebaut (unsigniert). Signierte Builds und Tests
> auf echten Geräten erfordern dein Apple-Developer-Konto und wurden nicht durchgeführt.

## Bekannte Einschränkungen

- **Push-Benachrichtigungen:** nicht eingebaut. Dafür wären
  `@capacitor/push-notifications`, Firebase Cloud Messaging (Android,
  `google-services.json`) bzw. APNs-Zertifikat/-Key (iOS) und serverseitiger
  Versand nötig. Web-Push der PWA funktioniert in der nativen WebView nicht.
- **Pausen-Timer im Hintergrund:** Der Timer läuft in JavaScript in der WebView.
  Wird die App in den Hintergrund geschickt oder der Bildschirm gesperrt, pausieren
  Android (Doze/App-Standby) und vor allem iOS die WebView nach kurzer Zeit. Die
  verbleibende Zeit wird beim Zurückkehren korrekt berechnet, sofern der Timer auf
  Zeitstempeln basiert – ein **Signal/Ton bei Ablauf im Hintergrund gibt es aber
  nicht**. Abhilfe wäre `@capacitor/local-notifications` (zum Zeitpunkt des
  Timer-Endes eine lokale Benachrichtigung planen); das ist noch nicht umgesetzt.
- **Offline:** Die App-Oberfläche liegt lokal im Bundle und startet immer; Daten
  werden wie in der PWA über IndexedDB (Dexie) gecacht und synchronisiert.
- **Server-URL ist fest eingebaut:** Ein Wechsel des Servers erfordert einen neuen
  Build (siehe Abschnitt 1).
- **Haptik / Preferences:** Die Plugins `@capacitor/haptics` und
  `@capacitor/preferences` sind installiert und registriert; ob die Web-App sie
  nutzt, hängt vom Web-Code ab (`window.Capacitor.Plugins.Haptics` …).

## Stand der Einrichtung in dieser Umgebung

Erledigt:

- `package.json`, `capacitor.config.ts`, Abhängigkeiten installiert (pnpm-Workspace)
- Web-Build mit `VITE_API_URL=https://satzio.netfusion-service.de` erzeugt
- `npx cap add android`, `npx cap add ios --packagemanager SPM`, `npx cap sync`
- Icons und Splash-Screens für Android und iOS mit `@capacitor/assets` generiert
  (Hintergrund `#0B0F0E`)
- Gradle-Wrapper (Gradle 8.11.1) mit JDK 21 lauffähig

**Nicht erledigt – Debug-APK wurde NICHT gebaut:** In der Build-Umgebung
(Cloud-Container hinter einem Egress-Proxy) wurde der Host `dl.google.com`
blockiert (HTTP 403). Damit fehlten:

1. das Android SDK (Command-line Tools / `sdkmanager`, `platforms;android-35`,
   `build-tools;35.0.0`, `platform-tools`) – Download nur von `dl.google.com`;
2. das Google-Maven-Repository (`google()` → `dl.google.com/dl/android/maven2`),
   aus dem Gradle das Android Gradle Plugin 8.7.2, `google-services` und AndroidX
   lädt. `./gradlew help` scheitert daher bereits beim Auflösen von
   `com.android.tools.build:gradle:8.7.2`.

Auf einem Rechner mit normalem Internetzugang (bzw. mit Android Studio) genügt:

```bash
pnpm install
cd apps/mobile
export ANDROID_HOME=$HOME/Android/Sdk
SATZIO_API_URL=https://satzio.meine-domain.de pnpm run android:apk
```
