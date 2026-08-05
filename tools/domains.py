"""Browse the cross-domain hot-topic map from the terminal.

Purpose: the curriculum needs a map of what is alive in every field, not only in
the operator's own. This is the read surface for domains.json: what is forming,
where, and whether it touches his goals.

Contracts: reads domains.json only, writes nothing. Maturity is one of forming,
incubating, mainstream. A topic with no venue evidence is displayed with a
warning marker rather than hidden, because silent omission hides bad data.

Agent-context: call main() or run it. Safe to run against a missing or partial
file; it says so instead of raising.

Typical usage::

    python tools/domains.py                     # every domain, with counts
    python tools/domains.py cs-theory           # one domain in full
    python tools/domains.py --forming           # only what is forming, everywhere
    python tools/domains.py --relevance high    # only what touches his goals
    python tools/domains.py --find conformal    # substring search over topics
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "domains.json"

MARK = {"forming": "NEW", "incubating": "2nd", "mainstream": "   "}
REL = {"high": "***", "medium": "** ", "low": "*  ", "none": "   "}


def load() -> dict:
    """Return the domain map, or an empty one with a printed explanation."""
    if not DATA.exists():
        print(f"  {DATA.name} not found. Run the all-domains sweep first.")
        return {"domains": []}
    try:
        return json.loads(DATA.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"  {DATA.name} is not valid JSON: {e}")
        return {"domains": []}


def topics_of(dom: dict) -> list[dict]:
    """Return a domain's topics with the domain key attached to each."""
    return [{**t, "_domain": dom.get("domain", "?")} for t in dom.get("hot_topics", [])]


def show_topic(t: dict, with_domain: bool = False) -> None:
    """Print one topic as a bordered terminal row."""
    ev = t.get("venue_evidence", "")
    flag = " [NO VENUE EVIDENCE]" if len(ev.strip()) < 8 else ""
    head = f"  {MARK.get(t.get('maturity',''), '   ')} {REL.get(t.get('relevance',''), '   ')} "
    if with_domain:
        head += f"{t.get('_domain','?'):<22} "
    print(head + t.get("topic", "?"))
    print(f"        {t.get('one_line','')[:110]}")
    print(f"        why now: {t.get('why_now','')[:104]}")
    print(f"        venue:   {ev[:104]}{flag}")
    print()


def overview(data: dict) -> None:
    """Print one line per domain with a maturity histogram."""
    print(f"  {'domain':<26} {'topics':>6}  {'new':>4} {'2nd':>4} {'main':>5}   top venues")
    for d in data.get("domains", []):
        ts = d.get("hot_topics", [])
        n_new = sum(1 for t in ts if t.get("maturity") == "forming")
        n_inc = sum(1 for t in ts if t.get("maturity") == "incubating")
        n_main = sum(1 for t in ts if t.get("maturity") == "mainstream")
        venues = ", ".join(d.get("top_venues", [])[:4])
        print(f"  {d.get('domain','?'):<26} {len(ts):>6}  {n_new:>4} {n_inc:>4} {n_main:>5}   {venues[:52]}")
    total = sum(len(d.get("hot_topics", [])) for d in data.get("domains", []))
    print(f"\n  {len(data.get('domains', []))} domains, {total} topics")
    print("  legend: NEW forming | 2nd incubating | *** high relevance to active goals")


def main() -> int:
    """Parse arguments and print the requested view."""
    ap = argparse.ArgumentParser(description="browse the cross-domain hot-topic map")
    ap.add_argument("domain", nargs="?", help="domain key to expand")
    ap.add_argument("--forming", action="store_true", help="only forming topics")
    ap.add_argument("--relevance", choices=["high", "medium", "low"], help="minimum relevance")
    ap.add_argument("--find", help="substring search over topic and one-liner")
    args = ap.parse_args()

    data = load()
    if not data.get("domains"):
        return 1

    if args.domain:
        for d in data["domains"]:
            if args.domain.lower() in d.get("domain", "").lower():
                print(f"\n  == {d['domain']}")
                print(f"  subdomains: {', '.join(d.get('subdomains', []))}")
                print(f"  venues:     {', '.join(d.get('top_venues', []))}\n")
                for t in d.get("hot_topics", []):
                    show_topic(t)
                return 0
        print(f"  no domain matching {args.domain!r}")
        return 1

    pool = [t for d in data["domains"] for t in topics_of(d)]
    if args.forming:
        pool = [t for t in pool if t.get("maturity") == "forming"]
    if args.relevance:
        order = {"high": 3, "medium": 2, "low": 1, "none": 0}
        floor = order[args.relevance]
        pool = [t for t in pool if order.get(t.get("relevance", "none"), 0) >= floor]
    if args.find:
        q = args.find.lower()
        pool = [t for t in pool if q in json.dumps(t).lower()]

    if args.forming or args.relevance or args.find:
        for t in sorted(pool, key=lambda x: x.get("_domain", "")):
            show_topic(t, with_domain=True)
        print(f"  {len(pool)} topic(s)")
        return 0

    overview(data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
