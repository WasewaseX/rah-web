#!/usr/bin/env python3
"""Generate Tauri app icons for Rah: rounded dark square, teal road glyph."""
from PIL import Image, ImageDraw
import os

OUT = "/home/z/my-project/rah-repo/src-tauri/icons"
os.makedirs(OUT, exist_ok=True)

BG = (15, 20, 27, 255)        # #0f141b
ACCENT = (45, 212, 167, 255)  # #2dd4a7
ACCENT_DIM = (24, 94, 74, 255)

def make(size: int) -> Image.Image:
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(s * 0.22)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=BG)
    m = int(s * 0.045)
    d.rounded_rectangle([m, m, s - 1 - m, s - 1 - m], radius=int(r * 0.82),
                        outline=(38, 48, 60, 255), width=max(1, s // 110))
    lw = max(2, s // 14)
    x0, y1, y2 = s * 0.5, s * 0.78, s * 0.24
    d.line([(s * 0.34, y1), (x0, y2)], fill=ACCENT, width=lw)
    d.line([(s * 0.66, y1), (x0, y2)], fill=ACCENT, width=lw)
    for t in (0.35, 0.55, 0.75):
        yy = y1 - (y1 - y2) * t
        half = (s * 0.16) * (1 - t) * 0.9
        d.line([(x0 - half * 0.35, yy), (x0 + half * 0.35, yy)],
               fill=ACCENT_DIM, width=max(1, s // 60))
    rr = max(2, s // 16)
    d.ellipse([x0 - rr, y2 - rr * 1.6, x0 + rr, y2 + rr * 0.4], fill=ACCENT)
    return img

master = make(512)
master.save(os.path.join(OUT, "icon.png"))
for sz, name in [(32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")]:
    master.resize((sz, sz), Image.LANCZOS).save(os.path.join(OUT, name))

ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
frames = [make(sz) for sz, _ in ico_sizes]
frames[-1].save(os.path.join(OUT, "icon.ico"), format="ICO",
                sizes=ico_sizes, append_images=frames[:-1])
print("icons written to", OUT, sorted(os.listdir(OUT)))
