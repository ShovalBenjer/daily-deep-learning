"""Close out a written unit body: ROUTINE section 5, steps 1 and 2, executably.

Purpose: a unit is not finished when its markdown is written. Its concepts have
to reach concepts.json and its body record has to reach curriculum.json, and
those two steps were prose in ROUTINE.md rather than a command. On 2026-07-29
the 03:39 generator run wrote units/m0-streams.md and skipped step 5.2, so five
taught concepts (stdin, stdout, stderr, exit-code, file-descriptor) existed in
the lesson and nowhere in the codex graph. tools/validate_links.py could not
catch it, because a concept that was never appended has no dangling reference to
report; it only surfaced when a LATER unit referenced those ids in `rel`.

Contracts: refuses rather than half-writes. A unit whose fences are multiline or
invalid JSON, a `practice` unit with no fillin proving the drill ran, a body with
an em-dash or en-dash, or an id that is not a real unit in curriculum.json all
exit non-zero with nothing written. Concept ids that already exist are skipped,
so rerunning is idempotent. The body hash is sha256 of the file's bytes,
truncated to 16 hex, matching what the generator has always written.

Agent-context: run it immediately after writing units/<id>.md, then run
tools/validate_links.py. It does not commit and does not touch units/.

Typical usage::

    python tools/close_unit.py m0-pipes os
    python tools/validate_links.py
"""

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: Fence kinds upgradeBlocks() understands. Each must hold ONE line of JSON.
FENCES = ("quiz", "fillin", "concepts", "widget")

#: Banned in body prose (CLAUDE.md style contract).
BANNED = (("—", "em-dash"), ("–", "en-dash"))


def parse_fences(md: str) -> tuple[dict[str, int], list[dict]]:
    """Read every fenced block, checking the single-line JSON contract.

    Args:
        md: the unit body.

    Returns:
        A count per fence kind, and every concept item found.

    Raises:
        ValueError: a fence spans lines or does not parse as JSON.
    """
    counts = {k: 0 for k in FENCES}
    concepts: list[dict] = []
    for kind in FENCES:
        for m in re.finditer("```" + kind + r"\n(.*?)\n```", md, re.DOTALL):
            body = m.group(1)
            if "\n" in body:
                raise ValueError(f"{kind} fence spans more than one line")
            data = json.loads(body)
            counts[kind] += 1
            if kind == "concepts":
                concepts.extend(data["items"])
    return counts, concepts


def main(unit_id: str, node: str) -> int:
    """Validate and close one unit.

    Args:
        unit_id: the unit id, matching units/<id>.md and curriculum.json.
        node: the talents.json node new concepts attach to.

    Returns:
        0 when both files were updated, 1 on any contract breach.
    """
    md_path = ROOT / "units" / f"{unit_id}.md"
    if not md_path.exists():
        print(f"FAIL {unit_id}: no body at units/{unit_id}.md")
        return 1
    md = md_path.read_text(encoding="utf-8")

    for bad, name in BANNED:
        if bad in md:
            print(f"FAIL {unit_id}: body contains an {name}")
            return 1
    try:
        counts, items = parse_fences(md)
    except ValueError as exc:
        print(f"FAIL {unit_id}: {exc}")
        return 1

    cur = json.loads((ROOT / "curriculum.json").read_text(encoding="utf-8"))
    unit = next((u for u in cur["units"] if u["id"] == unit_id), None)
    if unit is None:
        print(f"FAIL {unit_id}: not a unit in curriculum.json. "
              "Units come from tools/build_curriculum.py, never from here.")
        return 1
    if not counts["quiz"]:
        print(f"FAIL {unit_id}: every unit needs at least one quiz (ROUTINE 3)")
        return 1
    if unit["kind"] == "practice" and not counts["fillin"]:
        print(f"FAIL {unit_id}: a practice unit needs a fillin proving the drill ran")
        return 1

    talents = json.loads((ROOT / "talents.json").read_text(encoding="utf-8"))
    nodes = {n["id"] for t in talents["trees"] for tier in t["tiers"] for n in tier["nodes"]}
    if node not in nodes:
        print(f"FAIL {unit_id}: '{node}' is not a node in talents.json")
        return 1

    cpath = ROOT / "concepts.json"
    doc = json.loads(cpath.read_text(encoding="utf-8"))
    have = {c["id"] for c in doc["concepts"]}
    added = []
    for it in items:
        if it["id"] in have:
            continue
        doc["concepts"].append({**it, "node": node})
        have.add(it["id"])
        added.append(it["id"])
    if added:
        cpath.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")

    unit["body"] = {
        "status": "fresh",
        "generated": "2026-07-29T00:00:00Z",
        "hash": hashlib.sha256(md_path.read_bytes()).hexdigest()[:16],
    }
    (ROOT / "curriculum.json").write_text(
        json.dumps(cur, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"OK {unit_id}: {counts['quiz']} quiz, {counts['fillin']} fillin, "
          f"{len(added)} new concepts {added}, ~{len(md.split())} words "
          f"against a {unit['depthEstMin']} min budget")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    raise SystemExit(main(sys.argv[1], sys.argv[2]))
