"""WCAG contrast over the declared token pairs, without a browser.

Purpose: the a11y_ux gate domain needs a rendered page and a Chrome CDP endpoint,
so on a machine with no browser running it cannot report anything at all and the
whole domain sits behind a waiver. But a large share of real contrast failures is
decided entirely by :root in style.css: an ink token on a panel token, resolved
by arithmetic that needs no layout. This turns that share into numbers that can
be checked any time, on any machine, in under a second.

Contracts: reads style.css only, never writes. It grades the pairs listed in
PAIRS, each of which is a foreground token used on a background token somewhere
in the product, per theme block. Ratios follow WCAG 2.1 relative luminance with
the sRGB transfer function. Thresholds: 4.5 for body text, 3.0 for large text and
for user-interface component boundaries. Exits non-zero when any required pair
fails, so it can become a gate command rather than advice.

This is a LOWER BOUND on contrast problems, and the output says so. It cannot see
a colour produced by a gradient, by color-mix(), by opacity stacking, or by an
element that renders over an unexpected ancestor. The 2026-07-29 audit's gold
buttons are exactly that case: they declared only a gradient, so a token-level
check would have called them fine. Rendered auditing stays necessary.

Agent-context: run it after any change to the :root blocks in style.css.

Typical usage::

    python tools/contrast_pass.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: (foreground token, background token, WCAG minimum, where it is used).
#: Each entry is a pair the product actually renders; a pair nobody paints is
#: not evidence of anything and is deliberately absent.
#:
#: REQUIRED is text, WCAG 1.4.3 at AA: 4.5 for body, 3.0 for large. There is no
#: judgement call in these and a failure is a defect.
REQUIRED = [
    ("ink", "bg", 4.5, "body text on the ground"),
    ("ink", "panel", 4.5, "body text inside a plate"),
    ("ink", "panel-2", 4.5, "body text on a raised panel"),
    ("ink", "well", 4.5, "text in a recessed niche"),
    ("faded", "bg", 4.5, "muted text on the ground"),
    ("faded", "panel", 4.5, "muted text inside a plate, .finish-hint and .m-meta"),
    ("faded", "panel-2", 4.5, "muted text on a raised panel"),
    ("gold", "bg", 3.0, "gold headings, large text"),
    ("gold", "panel", 3.0, "gold headings on a plate"),
    ("green", "panel", 3.0, "correct-answer state text"),
    ("red", "panel", 3.0, "wrong-answer state text"),
]

#: ADVISORY is non-text, WCAG 1.4.11. That clause applies to visual information
#: REQUIRED TO IDENTIFY a component or its state, not to every painted edge. A
#: hairline between two ledger rows carries no information the layout does not
#: already carry, so grading it as a failure would be measuring the wrong thing
#: and would push the tokens away from the direction DESIGN.md binds us to.
#: These are printed with their numbers and do not affect the exit code. If a
#: border ever becomes the ONLY way to see a control, move it up to REQUIRED.
ADVISORY = [
    ("line", "panel", 3.0, "panel hairlines, decorative separation"),
    ("line-soft", "panel", 3.0, "softer hairlines"),
    ("gold-hi", "panel", 3.0, "bright gold accent, decorative"),
    ("oracle", "panel", 3.0, "tree identity: oracle"),
    ("architect", "panel", 3.0, "tree identity: architect"),
    ("warden", "panel", 3.0, "tree identity: warden"),
]


def channel(c: float) -> float:
    """Linearise one sRGB channel, per WCAG 2.1 relative luminance."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    """Relative luminance of a #rgb or #rrggbb colour.

    Args:
        hex_colour: with or without the leading hash.

    Returns:
        Relative luminance in [0, 1].
    """
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def ratio(fg: str, bg: str) -> float:
    """Contrast ratio between two hex colours, 1.0 to 21.0."""
    a, b = luminance(fg), luminance(bg)
    lo, hi = sorted((a, b))
    return (hi + 0.05) / (lo + 0.05)


def themes(css: str) -> dict[str, dict[str, str]]:
    """Pull every token block that declares hex colours.

    Args:
        css: the whole stylesheet.

    Returns:
        Theme label -> {token name without dashes: hex}. The label comes from the
        selector, so the dark and light blocks are graded separately rather than
        the later one silently overwriting the earlier.
    """
    out: dict[str, dict[str, str]] = {}
    for m in re.finditer(r"(?P<sel>[^{}]+)\{(?P<body>[^{}]*?)\}", css, re.S):
        body = m.group("body")
        tokens = dict(re.findall(r"--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})", body))
        if not tokens or "bg" not in tokens:
            continue
        sel = " ".join(m.group("sel").split())[:60]
        out[sel] = tokens
    return out


def main() -> int:
    """Grade every pair in every theme. Returns 1 if any required pair fails."""
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    blocks = themes(css)
    if not blocks:
        print("no token block with a --bg declaration found in style.css")
        return 1

    failures = 0
    checked = 0
    for label, tok in blocks.items():
        print(f"\n{label}")
        for kind, pairs in (("REQUIRED", REQUIRED), ("advisory", ADVISORY)):
            bad = []
            for fg, bg, need, where in pairs:
                if fg not in tok or bg not in tok:
                    continue
                r = ratio(tok[fg], tok[bg])
                checked += 1
                if r < need:
                    bad.append((fg, bg, r, need, where))
                    if kind == "REQUIRED":
                        failures += 1
            tag = "FAIL" if kind == "REQUIRED" else "note"
            print(f"  {kind}: {len(bad)} below threshold")
            for fg, bg, r, need, where in bad:
                print(f"    {tag} {r:5.2f}:1  need {need}  --{fg} on --{bg}"
                      f"  ({tok[fg]} on {tok[bg]})  {where}")

    print(f"\n{checked} token pairs graded, {failures} REQUIRED failures.")
    print("LOWER BOUND: this reads declared tokens only. A colour produced by a "
          "gradient, color-mix(), opacity stacking, or an unexpected ancestor is "
          "invisible here and still needs the rendered audit.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
