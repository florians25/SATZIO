# SATZIO – Produktwebsite

Statische Produktseite für SATZIO. Reines HTML, eine CSS-Datei, wenige Zeilen JavaScript.
Kein Build-Schritt, keine Abhängigkeiten, keine externen Ressourcen (keine Google Fonts, kein CDN, kein Tracking).

## Dateien

| Datei | Zweck |
| --- | --- |
| `index.html` | Startseite |
| `impressum.html`, `datenschutz.html` | **Vorlagen** – vom Betreiber auszufüllen (Platzhalter in `[eckigen Klammern]`) |
| `styles.css` | Gesamtes Styling, Dark Mode Standard, Light Mode über `prefers-color-scheme` |
| `main.js` | Link-Ziel der Web-App, Kopieren-Buttons |
| `assets/*.webp` | Screenshots der App (aus `docs/screenshots`, auf 540 px Breite verkleinert) |
| `favicon.svg` | Icon (aus `apps/web/public`) |
| `preview-*.png` | Vorschau-Screenshots der Seite; werden nicht verlinkt und müssen nicht deployt werden |

## Link „Web-App öffnen“ konfigurieren

Das Ziel wird an **einer Stelle** festgelegt, am Anfang von `main.js`:

```js
const APP_URL = '/app/';
```

Beispiele: `'/app/'` (gleiche Domain), `'https://app.example.de/'`, `'http://localhost:8080'` (lokales Docker-Setup).
Alle Elemente mit dem Attribut `data-app-link` übernehmen diesen Wert. Ohne JavaScript zeigen die Links auf `/app/`.

## Lokal ansehen

`index.html` direkt im Browser öffnen oder:

```sh
cd apps/website
python3 -m http.server 4000
# http://localhost:4000
```

## Deployment

Der Ordnerinhalt kann auf jeden statischen Host kopiert werden (nginx, Caddy, Apache, GitHub Pages, Netlify, S3 …).

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name satzio.example.de;

    root /var/www/satzio-website;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(css|js|webp|svg)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # Optional: Web-App unter /app/ auf denselben Host legen
    # location /app/ {
    #     proxy_pass http://127.0.0.1:8080/;
    # }
}
```

Hochladen, z. B.:

```sh
rsync -av --exclude 'preview-*.png' --exclude README.md apps/website/ server:/var/www/satzio-website/
```

## Vor dem Veröffentlichen

1. `impressum.html` und `datenschutz.html` ausfüllen und rechtlich prüfen lassen.
2. Im Footer von `index.html` die Platzhalter `[Betreiber eintragen]` und `[Lizenz eintragen]` ersetzen.
3. Im Self-Hosting-Abschnitt `<repo-url>` durch die echte Repository-Adresse ersetzen (Text und `data-copy`-Attribut).
4. `APP_URL` in `main.js` setzen.

## Screenshots aktualisieren

Neue Screenshots aus `docs/screenshots/` verkleinern, z. B. mit Python/Pillow:

```sh
python3 -c "
from PIL import Image; import glob, os
for f in glob.glob('docs/screenshots/*.png'):
    im = Image.open(f).convert('RGB')
    im = im.resize((540, round(im.height * 540 / im.width)), Image.LANCZOS)
    im.save('apps/website/assets/' + os.path.basename(f)[:-4] + '.webp', 'WEBP', quality=82, method=6)
"
```
