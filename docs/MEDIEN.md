# Bildquellen & Lizenzen

| Medium | Quelle | Lizenz |
|---|---|---|
| Übungsillustrationen (Muskelkarte, Vorder-/Rückseite) | Eigene SVG-Grafik, im Code erzeugt (`apps/web/src/components/MuscleMap.tsx`, `muscle-paths.ts`) | Projektlizenz |
| App-Icons, Favicon, Splash | Eigene Grafik (`apps/web/scripts/make-icons.py`, `public/favicon.svg`) | Projektlizenz |
| Schrift Inter | `@fontsource-variable/inter` (lokal gebündelt, kein Google-Fonts-Abruf) | SIL Open Font License 1.1 |
| Icons | Lucide (`lucide-react`) | ISC |
| Screenshots (`docs/screenshots`, Website) | Automatisch erzeugt aus der laufenden App (Playwright) | Projektlizenz |
| Nutzer-Uploads (Profil-/Übungsbilder) | Nutzer | Verantwortung der Nutzer; werden serverseitig neu kodiert, Metadaten (EXIF/GPS) entfernt, nur für den Uploader sichtbar |

Für die mitgelieferten 184 Übungen gibt es **keine Fotos**: SATZIO zeigt eine schematische Muskelgrafik und kennzeichnet sie als solche („Schematische Grafik – kein Übungsfoto vorhanden“). In der Datenbank sind diese Einträge als `ExerciseMedia.isPlaceholder = true` markiert. Es wurden keine fremden Bilder übernommen. Eigene Fotos können pro Übung hochgeladen werden.
