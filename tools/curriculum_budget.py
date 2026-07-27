"""Check the derived curriculum against the stated daily standard.

Purpose: the unit counts and hour budgets quoted in the planning documents were
arithmetic done in prose. This makes them an executable check so a wrong number
fails loudly instead of surviving in a table.

Contracts: this no longer carries its own hand-written enumeration. The units of
record are curriculum.json, built by tools/build_curriculum.py; changing what
exists means editing that builder's enumeration, not a constant here. The hour
budget is reported as a RANGE from the units' own declared minutes: the low
bound is workout time (estMin), the high bound adds the full self-contained
lesson (depthEstMin). The verdict is taken against the high bound, so a pass
here is the conservative reading.

Agent-context: run it, read stdout. No writes, no network, no arguments. Exits
non-zero when the Must set no longer fits the time to the deadline.

Typical usage::

    python tools/curriculum_budget.py
"""

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEADLINE = date(2026, 9, 30)
HOURS_PER_DAY = 3.0


def load() -> list[dict]:
    """Return the units of record.

    Returns:
        Every unit in curriculum.json.

    Raises:
        SystemExit: curriculum.json is missing, i.e. the builder never ran.
    """
    path = ROOT / "curriculum.json"
    if not path.exists():
        sys.exit("curriculum.json missing. Run tools/build_curriculum.py first.")
    return json.loads(path.read_text(encoding="utf-8"))["units"]


def main() -> None:
    """Print the budget table and the verdict against the deadline."""
    units = load()
    must = [u for u in units if u["moscow"] == "must"]

    blocks: dict[str, int] = {}
    for u in units:
        blocks[u["block"]] = blocks.get(u["block"], 0) + 1
    for b in sorted(blocks):
        print(f"  {b:<6} {blocks[b]:>4}")

    print()
    for cls in ("must", "should", "could", "wont"):
        n = sum(1 for u in units if u["moscow"] == cls)
        share = f"{n / len(units):>6.1%}" if cls != "wont" else "  dated"
        print(f"  {cls.upper():<7} {n:>4}  {share}")
    print(f"  {'TOTAL':<7} {len(units):>4}")

    days = (DEADLINE - date.today()).days
    available = days * HOURS_PER_DAY
    low = sum(u["estMin"] for u in must) / 60
    high = sum(u["estMin"] + u["depthEstMin"] for u in must) / 60

    print()
    print(f"  days to {DEADLINE}: {days}")
    print(f"  available at {HOURS_PER_DAY}h/day: {available:.0f} h")
    print(f"  MUST at workout depth only: {low:.0f} h")
    print(f"  MUST with the full lesson on every unit: {high:.0f} h")
    print()
    verdict = "REACHABLE" if available > high else "NOT REACHABLE AT FULL DEPTH"
    print("  VERDICT:", verdict)
    print(f"  slack against the full-depth read: {available - high:.0f} h")
    if available <= high:
        print(f"  depth must be pulled, not pushed, on at least "
              f"{(high - available) / (high / len(must)):.0f} of {len(must)} units")
    sys.exit(0 if available > low else 1)


if __name__ == "__main__":
    main()
