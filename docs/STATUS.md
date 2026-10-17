# Umsetzungsstand

## Umgesetzt und geprüft

- Registrierung direkt in der App, Login (E-Mail oder Benutzername), Angemeldet bleiben, Logout, Sitzungsverwaltung/-widerruf, Passwort ändern/vergessen/zurücksetzen, E-Mail-Verifizierung (optional, blockiert nichts), E-Mail ändern, Profilbild, Konto löschen, Datenexport JSON/CSV, Import JSON/CSV
- Onboarding (Ziel, Level, Trainingstage, Startoption) – später im Profil änderbar
- Heute-Ansicht mit Tagesplan inkl. vorbelegter Werte, Start/Fortsetzen, freies Training, anderer Tag, Ruhetag, verpasste Einheit nachholen, Wochenleiste, Serie, Warnung bei doppelt gestarteten Trainings
- **Notes-first-Workout-Editor**: Satzzeilen „☐ 80 kg × 8“, Inline-Eingabe, One-Tap-Abhaken (erneut tippen = zurücksetzen), Schnellaktionen ±Gewicht (konfigurierbar, pro Übung), Satz hinzufügen/duplizieren/löschen/Satzart/RPE, Übung hinzufügen/ersetzen/entfernen/sortieren, Notizen, Supersätze, Texteingabe („Bankdrücken 3x10 80kg“), Auto-Save ohne Speichern-Button
- Smart Defaults mit nachvollziehbarer Herkunft; Übernahme in den nächsten leeren Satz beim Abhaken
- Geführter Modus (gleiche Daten, frei springen/überspringen), Pausentimer mit absoluter Endzeit, ±/Überspringen, Vibration/Ton/Benachrichtigung (soweit Plattform unterstützt)
- SATZIO Coach (Aus/Dezent/Normal/Intensiv), nicht blockierend; Live-Rekorderkennung
- Abschluss-Zusammenfassung aus echten Daten inkl. Vergleich, Rekorde, Achievements, Vorschläge fürs nächste Mal, Teilen
- Trainingspläne: mehrere Pläne, aktiv, duplizieren, archivieren, löschen, Tage verwalten/duplizieren/sortieren, Satz-/Wdh.-Bereiche, Zielgewichte, Pausen, Aufwärm-/Arbeits-/Drop-/Versagenssätze, Supersätze, Notizen, Auto-Save mit Versionsverlauf & Wiederherstellung, Export/Import (JSON), Text-Export, 11 Vorlagen
- Planung: flexible Rotation oder feste Wochentage, Pausieren, Überspringen/nächster Tag wählbar, verpasste Einheit verschieben (Tauschen in der Logik vorhanden)
- Notizen-Import mit Vorschau, Korrektur, Zuordnung, Gewicht/Wdh.-Tausch, Originaltext bleibt erhalten
- Übungsbibliothek (184 Übungen) mit Suche, Filtern, Favoriten, Details, eigenen Übungen & Bildern, Alternativen, individuellen Einstellungen, Verlauf, „Zu Plan hinzufügen“; anatomische Muskelkarte als eigene Grafik
- Historie (Liste, Suche, Zeitraum, Kalender, erneut starten, nachträglich bearbeiten, löschen), Fortschritt (Kennzahlen, Volumen/Frequenz pro Woche, Kraftentwicklung inkl. geschätztem 1RM, Rekorde, Muskelgruppen, Zeiträume 7 T–Gesamt), Körpergewicht & Maße, Achievements
- Offline-First mit IndexedDB-Outbox, idempotentem Sync, Konfliktdialog, Sync-Status, App-Shell-Caching, persistentem Query-Cache
- Einstellungen (Einheit kg/lbs, Pausenzeit, Auto-Timer, Gewichtsschritte, Progression, Coach, Gamification, Vibration, Ton, Benachrichtigungen, Dark/Light/System, Sprache, Ansicht, Zeitzone)
- Docker Compose (Website `/`, Web-App `/app/`, API, PostgreSQL), Setup-, Backup-, Restore-Skripte, CI
- Capacitor-Projekte Android & iOS; APK und iOS-Simulator-Build per GitHub Actions gebaut
- Produktwebsite
- **Freunde & Gruppentraining**: Freunde per Benutzername oder persönlichem Link, Trainingseinladungen mit Termin/Ort/Plan-Tag, Zusagen, Beitrittslink mit Freigabe durch den Gastgeber, Live-Fortschritt der Gruppe im laufenden Training, Privatsphäre-Einstellungen
- **Plattform-Design**: iOS im Liquid-Glass-Stil, Android in Material 3, native Funktionen in den Apps (Haptik, Pausen-Benachrichtigung, Bildschirm bleibt an, Statusleiste, Android-Zurück-Taste, Tastatur)
- **Eingabe**: eigene Zahlentastatur, Wiederholungs-Chips, Scheibenrechner, Wischgesten, Long-Press
- `scripts/update.sh`: Backup → `git pull` → Images bauen → Neustart → Healthcheck

## Bekannte Einschränkungen

- **Native Apps auf echten Geräten**: Liquid Glass/Material 3 und die nativen Plugins wurden im Browser (Screenshots) und per `cap sync` geprüft, aber nicht auf echten Geräten. Systemschriften (SF/Roboto) fehlen in den Linux-Screenshots.
- **Gruppentraining**: kein QR-Code, keine Blockier-Funktion; Live-Ansicht aktualisiert per Polling alle 5 s (kein WebSocket).

- **iOS**: Das Xcode-Projekt kompiliert in GitHub Actions (Simulator, unsigniert). Signierte Builds, Geräte-Tests und App-Store/TestFlight erfordern ein Apple-Developer-Konto und wurden **nicht** durchgeführt.
- **Android-APK lokal**: In der Entwicklungsumgebung war `dl.google.com` (Android-SDK/Google-Maven) gesperrt; das APK wird daher über GitHub Actions gebaut. Das CI-APK ist ein **Debug-Build** (nicht für den Play Store signiert) und verbindet sich mit `https://satzio.netfusion-service.de`.
- **Hintergrund-Timer**: Browser (v. a. iOS) pausieren JavaScript im Hintergrund. Im Browser bleibt der Timer korrekt (absolute Endzeit), das Signal kommt ggf. erst beim Zurückkehren. In den Apps kommt eine native lokale Benachrichtigung – auf echten Geräten noch nicht getestet.
- **Englisch**: Architektur vorhanden (`apps/web/src/lib/i18n.ts`), übersetzt sind Navigation und Kernbegriffe; die meisten Texte sind deutsch.
- **Übungsfotos**: Für die Bibliothek gibt es keine Fotos/Videos, sondern eine schematische Muskelkarte (gekennzeichnet). Eigene Bilder sind möglich.
- **Tausch zweier Termine** im festen Wochenplan ist in der Logik umgesetzt und getestet, in der Oberfläche gibt es „verpasste Einheit auf heute verschieben“ und die Wochentagszuordnung, aber noch keinen eigenen Tausch-Dialog.
- **Drag & Drop** zum Sortieren gibt es nicht; Sortieren erfolgt über „Nach oben/unten“.
- **E-Mail-Versand** wurde mit abgefangenem Versand (Test-Doubles) geprüft, nicht gegen einen echten SMTP-Server.
- **Rechtliches**: Datenschutzerklärung und Impressum sind Vorlagen und müssen vor dem öffentlichen Betrieb rechtlich geprüft werden.
- **KI-Assistent**: nur Schnittstelle, keine Funktion (bewusst).

## Nächste sinnvolle Schritte

1. Deployment auf `satzio.netfusion-service.de` (Reverse Proxy + TLS, `./scripts/setup.sh satzio.netfusion-service.de`), SMTP eintragen
2. Release-Signierung für Android (Keystore als GitHub-Secret) und iOS (Apple-Team) in den Workflow aufnehmen
3. Native Funktionen und Plattform-Design auf echten iPhones/Android-Geräten prüfen
4. Vollständige englische Übersetzung
