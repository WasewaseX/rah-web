#!/usr/bin/env python3
"""PWA icons for Rah (web): rounded dark square, teal road glyph - the same
brand the Tauri build uses. 192 + 512 + maskable 512 + apple 180."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = "/home/z/my-project/public/icons"
os.makedirs(OUT, exist_ok=True)

BG = (16, 19, 26, 255)         # #10131a (theme color)
ACCENT = (45, 212, 167, 255)   # #2dd4a7
ACCENT_DIM = (24, 94, 74, 255)
PANEL = (38, 48, 60, 255)

def make(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    if not maskable:
        # rounded square for the standard icons
        mask = Image.new("L", (size, size), 0)
        dm = ImageDraw.Draw(mask)
        dm.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
        base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        base.paste(img, (0, 0), mask)
        img = base
        d = ImageDraw.Draw(img)
        m = int(size * 0.045)
        try:
            d.rounded_rectangle([m, m, size - 1 - m, size - 1 - m], radius=int(size * 0.18),
                                outline=PANEL, width=max(1, size // 110))
        except Exception:
            pass
    # road glyph: two legs meeting at the top + cross rungs (safe zone aware)
    lw = max(3, size // 13)
    y1, y2 = size * 0.80, size * 0.26
    x0 = size * 0.5
    d.line([(size * 0.32, y1), (x0, y2)], fill=ACCENT, width=lw)
    d.line([(size * 0.68, y1), (x0, y2)], fill=ACCENT, width=lw)
    for t in (0.35, 0.55, 0.75):
        yy = y1 - (y1 - y2) * t
        half = (size * 0.17) * (1 - t) * 0.9
        d.line([(x0 - half * 0.35, yy), (x0 + half * 0.35, yy)],
               fill=ACCENT_DIM, width=max(1, size // 60))
    return img

make(192).save(f"{OUT}/icon-192.png")
make(512).save(f"{OUT}/icon-512.png")
make(512, maskable=True).save(f"{OUT}/maskable-512.png")
make(180).save(f"{OUT}/apple-touch-icon.png")
print("icons written:", os.listdir(OUT))
