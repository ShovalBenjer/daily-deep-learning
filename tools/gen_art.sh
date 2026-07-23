#!/bin/sh
# Painted-asset batch via Comfy Cloud (comfy generate).
# Prereq: `comfy cloud login` done once (or COMFY_API_KEY set).
# Prompts are locked to DESIGN.md: illuminated workshop ledger, ink+gold on
# near-black, engraved, dark academy. NO text in images, no watermarks.
# Output -> assets/art/raw/, then tools/slice_art.py post-processes.
set -e
cd "$(dirname "$0")/.."
mkdir -p assets/art/raw
G="comfy generate flux-ultra"
STYLE="dark fantasy game UI asset, antique gold leaf and warm parchment tones on near-black ink, engraved goldsmith line-work, candlelit, painterly, high detail, no text, no watermark, no letters"

$G --prompt "ornate square baroque picture frame, $STYLE, symmetric corner rosettes, empty pure black center, thin elegant border suitable for 9-slice UI scaling" \
   --width 1024 --height 1024 --download assets/art/raw/frame-hero-painted.png

$G --prompt "ancient carved dark walnut guild notice board texture, $STYLE, worn oiled wood grain, faint engraved filigree at corners, seamless tileable surface, empty" \
   --width 1024 --height 1024 --download assets/art/raw/board-bg.png

$G --prompt "circular engraved guild crest of a fortress tower with interlocking gears, $STYLE, wax-seal medallion, centered emblem on black" \
   --width 768 --height 768 --download assets/art/raw/crest-systems.png

$G --prompt "circular engraved guild crest of a smith hammer crossed with a quill pen, $STYLE, wax-seal medallion, centered emblem on black" \
   --width 768 --height 768 --download assets/art/raw/crest-craft.png

$G --prompt "circular engraved guild crest of a watchman lantern above a shield, $STYLE, wax-seal medallion, centered emblem on black" \
   --width 768 --height 768 --download assets/art/raw/crest-ops.png

$G --prompt "adorable small lantern spirit mascot, warm living flame with two bright eyes inside a brass lantern, $STYLE, painted game character portrait, glowing softly, centered on black" \
   --width 768 --height 768 --download assets/art/raw/spark-portrait.png

$G --prompt "ancient open ledger book on a scribe workbench, ink pot and gold leaf tools, $STYLE, wide painted game header scene, atmospheric depth" \
   --width 1152 --height 512 --download assets/art/raw/ledger-banner.png

echo "raw art done -> run: py tools/slice_art.py"
