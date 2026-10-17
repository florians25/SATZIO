"""Erzeugt die SATZIO-App-Icons (PWA, Apple, Capacitor) aus einer Vektorbeschreibung.
Eigene Grafik – keine fremden Bildrechte. Aufruf: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw
import os

BG = (11, 15, 14, 255)
SURFACE = (21, 27, 25, 255)
LIME = (183, 255, 60, 255)
MUTED = (155, 166, 160, 255)
HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "..", "public")


def draw_icon(size, padding_ratio=0.0, rounded=True):
    scale = 4  # Supersampling für glatte Kanten
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)
    pad = s * padding_ratio
    inner = s - 2 * pad

    def P(x, y):
        return (pad + x * inner, pad + y * inner)

    # Notizzeilen (Sätze)
    lw = int(inner * 0.065)
    for i, y in enumerate([0.30, 0.50, 0.70]):
        x0 = 0.44 if i < 2 else 0.44
        d.rounded_rectangle([*P(x0, y - 0.035), *P(0.80, y + 0.035)], radius=lw // 2, fill=SURFACE if i == 2 else MUTED)
    # Häkchen-Kästchen
    box = [P(0.18, 0.22), P(0.36, 0.40)]
    d.rounded_rectangle([*box[0], *box[1]], radius=int(inner * 0.04), fill=LIME)
    # Haken im Kästchen
    d.line([P(0.215, 0.315), P(0.26, 0.36), P(0.33, 0.265)], fill=BG, width=int(inner * 0.035), joint="curve")
    box2 = [P(0.18, 0.42), P(0.36, 0.60)]
    d.rounded_rectangle([*box2[0], *box2[1]], radius=int(inner * 0.04), fill=LIME)
    d.line([P(0.215, 0.515), P(0.26, 0.56), P(0.33, 0.465)], fill=BG, width=int(inner * 0.035), joint="curve")
    box3 = [P(0.18, 0.62), P(0.36, 0.80)]
    d.rounded_rectangle([*box3[0], *box3[1]], radius=int(inner * 0.04), outline=MUTED, width=int(inner * 0.02))
    return img.resize((size, size), Image.LANCZOS)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print("geschrieben:", os.path.relpath(path, os.path.join(HERE, "..")))


save(draw_icon(192), os.path.join(PUBLIC, "icons", "icon-192.png"))
save(draw_icon(512), os.path.join(PUBLIC, "icons", "icon-512.png"))
save(draw_icon(512, padding_ratio=0.12, rounded=False), os.path.join(PUBLIC, "icons", "icon-maskable-512.png"))
save(draw_icon(180, rounded=False), os.path.join(PUBLIC, "apple-touch-icon.png"))
save(draw_icon(1024, padding_ratio=0.0, rounded=False), os.path.join(HERE, "..", "..", "mobile", "resources", "icon.png"))
# Splash (Capacitor): Icon mittig auf dunklem Grund
splash = Image.new("RGBA", (2732, 2732), BG)
icon = draw_icon(600)
splash.paste(icon, ((2732 - 600) // 2, (2732 - 600) // 2), icon)
save(splash, os.path.join(HERE, "..", "..", "mobile", "resources", "splash.png"))
