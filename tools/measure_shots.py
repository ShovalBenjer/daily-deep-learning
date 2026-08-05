"""Report the rendered height of each captured route in phone screens.

Purpose: a route that renders fifteen viewports tall is a product defect that no
lint or a11y rule catches. This turns "the page feels endless" into a number.

Contracts: reads PNGs only, writes nothing. VIEWPORT is the reference phone
height used to convert pixels into screens.

Agent-context: point it at a shots directory produced by tools/cdp.py.

Typical usage::

    python tools/measure_shots.py shots/live-2026-07-27
"""

import pathlib
import sys

from PIL import Image

VIEWPORT = 844


def main(d: str) -> None:
    """Print a height table for every PNG in the directory."""
    rows = []
    for p in sorted(pathlib.Path(d).glob("*.png")):
        with Image.open(p) as im:
            w, h = im.size
        rows.append((p.stem, w, h, h / VIEWPORT))

    print(f"  {'route':<12} {'w':>5} {'height':>8} {'screens':>8}")
    for name, w, h, screens in sorted(rows, key=lambda r: -r[3]):
        flag = "  <-- excessive" if screens > 4 else ""
        print(f"  {name:<12} {w:>5} {h:>8} {screens:>8.1f}{flag}")

    worst = max(rows, key=lambda r: r[3])
    print()
    print(f"  worst: {worst[0]} at {worst[3]:.1f} screens")
    print(f"  total scroll across {len(rows)} routes: {sum(r[3] for r in rows):.1f} screens")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "shots")
