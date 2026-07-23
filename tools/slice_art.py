"""Post-process Comfy raw art into shippable UI assets.

- frame-hero-painted: center-crop, downscale to 384px, verify dark center
  (border-image uses only the edges; center is discarded).
- board-bg / ledger-banner: downscale + webp for weight.
- crests / spark: downscale to 256, trim to circle-safe square.
Run after tools/gen_art.sh. Requires: uv pip install pillow (or py -m pip).
"""
from pathlib import Path
from PIL import Image

RAW = Path(__file__).resolve().parent.parent / "assets/art/raw"
OUT = RAW.parent

def save(img, name, q=88):
    p = OUT / name
    img.save(p, quality=q)
    print(name, img.size, f"{p.stat().st_size // 1024}KB")

def main():
    jobs = {
        "frame-hero-painted.png": ("frame-hero-painted.png", 384),
        "board-bg.png": ("board-bg.webp", 768),
        "ledger-banner.png": ("ledger-banner.webp", 1152),
        "crest-systems.png": ("crest-systems.webp", 256),
        "crest-craft.png": ("crest-craft.webp", 256),
        "crest-ops.png": ("crest-ops.webp", 256),
        "spark-portrait.png": ("spark-portrait.webp", 320),
    }
    for src, (dst, size) in jobs.items():
        f = RAW / src
        if not f.exists():
            print("missing:", src); continue
        img = Image.open(f).convert("RGB")
        w, h = img.size
        if dst.startswith("frame"):
            side = min(w, h)
            img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
        ratio = size / max(img.size)
        if ratio < 1:
            img = img.resize((round(img.width * ratio), round(img.height * ratio)), Image.LANCZOS)
        save(img, dst)
    print("done -> wire in style.css (frame-hero-painted via border-image; board-bg on .talent-panel; crests on .tree-tab; spark-portrait in ritual)")

if __name__ == "__main__":
    main()
