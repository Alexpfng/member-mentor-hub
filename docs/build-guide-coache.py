#!/usr/bin/env python3
"""Génère le PDF du guide coaché à partir de guide-coache.source.html.

Chromium ne peint pas les marges de page (@page margin) avec le fond du body :
chaque page ressortait encadrée de blanc. On imprime donc normalement, puis on
repeint le fond de chaque page SOUS le contenu existant, bord à bord.

Usage : python3 docs/build-guide-coache.py
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DOCS = Path(__file__).resolve().parent
SOURCE = DOCS / "guide-coache.source.html"
STYLE = DOCS / "guide-coache.style.css"
OUTPUT = DOCS / "ColoSmart-Training-Guide-Coache.pdf"

PAGE_BG = (0x14 / 255, 0x1C / 255, 0x17 / 255)
# Dégradé de la couverture (page 1), repris de l'ancien linear-gradient CSS.
COVER_GRADIENT = ((0x1B, 0x2A, 0x20), (0x14, 0x1C, 0x17), (0x10, 0x17, 0x11))
COVER_GRADIENT_MID = 0.55
GRADIENT_STEPS = 1024

CHROME_CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    "chromium",
    "google-chrome",
]


def gradient_color(t: float) -> tuple:
    """Interpole les 3 arrêts du dégradé de couverture pour t dans [0, 1]."""
    start, mid, end = COVER_GRADIENT
    if t <= COVER_GRADIENT_MID:
        a, b, local = start, mid, t / COVER_GRADIENT_MID
    else:
        a, b, local = mid, end, (t - COVER_GRADIENT_MID) / (1 - COVER_GRADIENT_MID)
    return tuple(round(a[i] + (b[i] - a[i]) * local) for i in range(3))


def bleed(page):
    """Déborde de quelques points hors de la page : un aplat calé pile sur le
    bord laissait un liseré gris d'un pixel (anti-aliasing). Le PDF rogne au
    format de page, le débord ne se voit pas."""
    import pymupdf

    return pymupdf.Rect(page.rect) + (-3, -3, 3, 3)


def paint_cover(page) -> None:
    """Le dégradé CSS s'arrêtait aux marges et dessinait un rectangle visible.
    On le peint ici bord à bord, sous forme d'image : en aplats empilés le PDF
    laissait apparaître des stries entre les bandes."""
    import pymupdf

    # Largeur > 1 px : un dégradé d'un seul pixel de large est mal étiré par
    # certains lecteurs PDF (il ressortait en trait vertical).
    width = 16
    rows = [
        bytes(gradient_color(step / (GRADIENT_STEPS - 1))) * width
        for step in range(GRADIENT_STEPS)
    ]
    pixmap = pymupdf.Pixmap(pymupdf.csRGB, width, GRADIENT_STEPS, b"".join(rows), 0)
    # keep_proportion=False : sinon l'image (haute et étroite) est encadrée dans
    # la page au lieu de la remplir, et sort en bande verticale.
    page.insert_image(bleed(page), pixmap=pixmap, overlay=False, keep_proportion=False)


def find_chrome() -> str:
    for candidate in CHROME_CANDIDATES:
        if Path(candidate).exists() or shutil.which(candidate):
            return candidate
    sys.exit("Chromium introuvable — adapte CHROME_CANDIDATES.")


def main() -> None:
    import pymupdf  # pip install pymupdf

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        # Le HTML référence « style.css » en relatif.
        shutil.copy(SOURCE, work / "index.html")
        shutil.copy(STYLE, work / "style.css")
        raw = work / "raw.pdf"

        subprocess.run(
            [
                find_chrome(),
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--no-pdf-header-footer",
                f"--print-to-pdf={raw}",
                "index.html",
            ],
            cwd=work,
            check=True,
            capture_output=True,
        )

        doc = pymupdf.open(raw)
        for index, page in enumerate(doc):
            # overlay=False → le fond passe SOUS le contenu déjà imprimé.
            if index == 0:
                paint_cover(page)
            else:
                page.draw_rect(bleed(page), color=None, fill=PAGE_BG, overlay=False)
        doc.save(OUTPUT, garbage=4, deflate=True)
        doc.close()

    print(f"{OUTPUT} — {OUTPUT.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
