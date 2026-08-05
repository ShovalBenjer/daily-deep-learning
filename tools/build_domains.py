"""Assemble domains.json from an all-domains sweep workflow journal.

Purpose: the sweep returns per-domain records across many agents. This collects
them into the single file tools/domains.py reads, and folds in the critic
verdicts so an overstated "forming" claim is demoted rather than believed.

Contracts: never invents a topic. A topic the critic marked overstated is
demoted to incubating and keeps the critic's note, so the downgrade is visible
rather than silent. Unchecked verdicts leave maturity alone.

Agent-context: point it at a workflow run directory. Writes domains.json at the
repo root and prints a summary.

Typical usage::

    python tools/build_domains.py <run-dir>
    python tools/domains.py
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "domains.json"


def walk(obj):
    """Yield every dict nested anywhere inside obj."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk(v)


def collect(journal: pathlib.Path) -> tuple[list[dict], dict[str, dict]]:
    """Return (domain records, verdicts keyed by topic) found in the journal."""
    domains: dict[str, dict] = {}
    verdicts: dict[str, dict] = {}
    for line in journal.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        for d in walk(rec):
            if {"domain", "hot_topics", "top_venues"} <= d.keys():
                domains.setdefault(d["domain"], d)
            if {"topic", "status"} <= d.keys():
                verdicts[d["topic"][:80]] = d
    return list(domains.values()), verdicts


def apply_verdicts(domains: list[dict], verdicts: dict[str, dict]) -> dict[str, int]:
    """Demote overstated forming claims in place. Returns a count summary."""
    counts = {"demoted": 0, "confirmed": 0, "unchecked": 0}
    for dom in domains:
        for t in dom.get("hot_topics", []):
            v = verdicts.get(t.get("topic", "")[:80])
            if not v:
                continue
            if v["status"] == "overstated" and t.get("maturity") == "forming":
                t["maturity"] = "incubating"
                t["critic_note"] = v.get("note", "")
                counts["demoted"] += 1
            elif v["status"] == "confirmed-forming":
                counts["confirmed"] += 1
            else:
                counts["unchecked"] += 1
    return counts


def main() -> int:
    """Read the journal, apply verdicts, write domains.json."""
    if len(sys.argv) < 2:
        print("  usage: python tools/build_domains.py <workflow-run-dir>")
        return 1
    journal = pathlib.Path(sys.argv[1]) / "journal.jsonl"
    if not journal.exists():
        print(f"  no journal at {journal}")
        return 1

    domains, verdicts = collect(journal)
    if not domains:
        print("  journal parsed but contained no domain records")
        return 1

    counts = apply_verdicts(domains, verdicts)
    domains.sort(key=lambda d: d.get("domain", ""))
    total = sum(len(d.get("hot_topics", [])) for d in domains)

    OUT.write_text(
        json.dumps(
            {
                "note": "Hot-topic map across academic domains. Built by tools/build_domains.py "
                        "from an all-domains sweep. Maturity marked forming was audited by a "
                        "critic; demotions carry critic_note.",
                "domains": domains,
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"  {len(domains)} domains, {total} topics -> {OUT.name}")
    print(f"  critic: {counts['confirmed']} confirmed, {counts['demoted']} demoted, "
          f"{counts['unchecked']} unchecked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
