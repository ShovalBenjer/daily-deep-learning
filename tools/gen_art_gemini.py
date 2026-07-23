"""Painted-asset batch via the Gemini API (image generation).

Key: GEMINI_API_KEY from new-recruit/.env (never committed).
Model: gemini-3.1-flash-image, fallback gemini-2.5-flash-image.
Prompts locked to DESIGN.md: antique gold + parchment on near-black ink,
engraved, candlelit, painterly. NO text in images.
Output: assets/art/raw/*.png  → post-process with tools/slice_art.py.
"""
import base64, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "art", "raw")
os.makedirs(OUT, exist_ok=True)

KEY = os.environ.get("GEMINI_API_KEY", "")
if not KEY:
    env = os.path.join(os.path.dirname(ROOT), "new-recruit", ".env")
    for line in open(env, encoding="utf-8", errors="replace"):
        if line.startswith("GEMINI_API_KEY"):
            KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
assert KEY, "GEMINI_API_KEY not found"

MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]
STYLE = ("dark fantasy game UI asset, antique gold leaf and warm parchment tones "
         "on near-black ink background, engraved goldsmith line-work, candlelit, "
         "painterly, high detail. Absolutely no text, no letters, no watermark.")

JOBS = [
    ("frame-hero-painted", "1:1",
     f"ornate square baroque picture frame, {STYLE} symmetric engraved corner rosettes, "
     "thin elegant gold border with empty pure-black center, designed as a 9-slice UI frame asset"),
    ("board-bg", "1:1",
     f"ancient carved dark walnut guild notice board surface, {STYLE} worn oiled wood grain, "
     "faint engraved filigree near the corners, empty seamless background texture"),
    ("crest-systems", "1:1",
     f"circular engraved guild crest of a fortress tower with interlocking gears, {STYLE} "
     "wax-seal medallion, centered emblem on black"),
    ("crest-craft", "1:1",
     f"circular engraved guild crest of a smith hammer crossed with a quill pen, {STYLE} "
     "wax-seal medallion, centered emblem on black"),
    ("crest-ops", "1:1",
     f"circular engraved guild crest of a watchman lantern above a shield, {STYLE} "
     "wax-seal medallion, centered emblem on black"),
    ("spark-portrait", "1:1",
     f"adorable small lantern spirit mascot: a warm living flame with two bright eyes inside "
     f"a brass lantern, {STYLE} painted game character portrait, glowing softly, centered on black"),
    ("ledger-banner", "16:9",
     f"ancient open ledger book on a scribe workbench with ink pot and gold leaf tools, {STYLE} "
     "wide painted game header scene with atmospheric depth"),
]

def gen(model, prompt, aspect):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}"
    for modalities in (["IMAGE"], ["TEXT", "IMAGE"]):
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": modalities,
                                 "imageConfig": {"aspectRatio": aspect}},
        }
        req = urllib.request.Request(url, json.dumps(body).encode(),
                                     {"content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.load(r)
            for cand in d.get("candidates", []):
                for part in cand.get("content", {}).get("parts", []):
                    blob = part.get("inlineData") or part.get("inline_data")
                    if blob and blob.get("data"):
                        return base64.b64decode(blob["data"])
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:200]
            print(f"    {model} {modalities}: HTTP {e.code} {err}", file=sys.stderr)
            if e.code in (400,):  # try next modalities shape
                continue
            raise
    return None

for name, aspect, prompt in JOBS:
    dest = os.path.join(OUT, name + ".png")
    if os.path.exists(dest):
        print(f"skip {name} (exists)"); continue
    ok = False
    for model in MODELS:
        print(f"gen {name} via {model}...")
        img = gen(model, prompt, aspect)
        if img:
            open(dest, "wb").write(img)
            print(f"  saved {name}.png {len(img)//1024}KB")
            ok = True
            break
    if not ok:
        print(f"  FAILED {name}")
    time.sleep(1.2)
print("batch done")
