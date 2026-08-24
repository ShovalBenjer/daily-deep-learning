"""Classify and route everything sitting in inbox.md, plus the WhatsApp capture.

Purpose: the operator captures constantly (75 GitHub links in his self-chat, 33
in July 2026 alone) and none of it reaches the platform. This turns raw capture
into routed work without asking him to change how he captures.

Contracts: routing is by SHAPE, never by asking him to tag. A line ending in "?"
is a knowledge gap and becomes a curriculum candidate, which is the whole point:
his own questions are the most honest syllabus signal available. Nothing is
deleted; digested items move to the Routed section with a date.

Agent-context: run with --dry to see routing without writing. The WhatsApp export
is marked SENSITIVE; only URLs and dates are read from it, never message text.

Typical usage::

    python tools/digest_inbox.py --dry
    python tools/digest_inbox.py
"""

from __future__ import annotations

import argparse
import datetime
import pathlib
import re
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent.parent
INBOX = ROOT / "inbox.md"
WA_EXPORT = pathlib.Path.home() / "wa-export-archive" / "SENSITIVE-self-chat" / "_chat.txt"

URL = re.compile(r"https?://\S+")
GH = re.compile(r"https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)")
ARXIV = re.compile(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5})")
TAG = re.compile(r"#([a-z0-9-]+)")

OPEN_MARK = "## Open"
ROUTED_MARK = "## Routed"


def classify(line: str) -> dict[str, Any]:
    """Route one captured line by its shape alone.

    Args:
        line: a raw inbox line, already stripped.

    Returns:
        A dict with kind, destination and a one-line reason.

    Examples:
        >>> classify("what does SSH stand for?")["kind"]
        'question'
        >>> classify("https://github.com/foo/bar")["destination"]
        'discoveries.json'
    """
    urgent = line.startswith("!")
    body = line.lstrip("! ").strip()
    tags = TAG.findall(body)

    if body.endswith("?"):
        return {
            "kind": "question",
            "destination": "curriculum.json as a unit candidate",
            "reason": "a question is a measured gap, not a note",
            "urgent": urgent,
            "tags": tags,
        }
    if ARXIV.search(body):
        return {
            "kind": "paper",
            "destination": "corpus_manifest.json paper_card_queue",
            "reason": "arxiv id found",
            "urgent": urgent,
            "tags": tags,
        }
    if GH.search(body):
        return {
            "kind": "repo",
            "destination": "discoveries.json",
            "reason": "github repo, dedupe against existing discoveries",
            "urgent": urgent,
            "tags": tags,
        }
    if URL.search(body):
        return {
            "kind": "link",
            "destination": "discoveries.json",
            "reason": "generic link",
            "urgent": urgent,
            "tags": tags,
        }
    return {
        "kind": "idea",
        "destination": "docs/ideas.md",
        "reason": "free text, kept as a product or content note",
        "urgent": urgent,
        "tags": tags,
    }


def open_items(text: str) -> list[str]:
    """Return the non-comment, non-blank lines in the Open section."""
    if OPEN_MARK not in text:
        return []
    body = text.split(OPEN_MARK, 1)[1]
    if ROUTED_MARK in body:
        body = body.split(ROUTED_MARK, 1)[0]
    return [
        ln.strip() for ln in body.splitlines()
        if ln.strip() and not ln.strip().startswith("<!--")
    ]


def wa_links() -> list[str]:
    """Return unique GitHub links from the WhatsApp export. URLs only."""
    if not WA_EXPORT.exists():
        return []
    seen, out = set(), []
    with WA_EXPORT.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            for m in GH.finditer(line):
                slug = m.group(1)
                if slug not in seen:
                    seen.add(slug)
                    out.append("https://github.com/" + slug)
    return out


def main() -> int:
    """Classify inbox and WhatsApp capture; optionally rewrite inbox.md."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="print routing, write nothing")
    ap.add_argument("--wa", action="store_true", help="include the WhatsApp capture stream")
    args = ap.parse_args()

    if not INBOX.exists():
        print("  inbox.md missing")
        return 1

    text = INBOX.read_text(encoding="utf-8")
    items = open_items(text)
    stream = wa_links() if args.wa else []

    if not items and not stream:
        print("  inbox empty, nothing to route")
        return 0

    today = datetime.datetime.now(tz=datetime.UTC).date().isoformat()
    routed = []
    counts: dict[str, int] = {}

    for line in items:
        c = classify(line)
        counts[c["kind"]] = counts.get(c["kind"], 0) + 1
        flag = "!" if c["urgent"] else " "
        print(f"  {flag} {c['kind']:<9} -> {c['destination']:<42} {line[:52]}")
        routed.append(f"- [{today}] `{c['kind']}` -> {c['destination']} :: {line}")

    if stream:
        print(f"\n  whatsapp capture: {len(stream)} unique repos (links only, no message text)")
        for u in stream[-8:]:
            print(f"    {u}")

    print("\n  " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())) if counts else "")

    if args.dry:
        print("  dry run, inbox.md untouched")
        return 0

    head, rest = text.split(OPEN_MARK, 1)
    tail = ROUTED_MARK + rest.split(ROUTED_MARK, 1)[1] if ROUTED_MARK in rest else ROUTED_MARK
    new = (
        head
        + OPEN_MARK
        + "\n\n<!-- append below this line. the council empties it. -->\n\n\n"
        + tail.rstrip()
        + "\n"
        + "\n".join(routed)
        + "\n"
    )
    INBOX.write_text(new, encoding="utf-8")
    print(f"  routed {len(routed)} item(s), inbox.md emptied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
