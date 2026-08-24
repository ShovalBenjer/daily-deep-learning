"""The docs control plane oracle: an untriaged idea is a failing check.

Purpose: docs/ is local-only (gitignored, the repo is public) and was a
write-only memory: 33 files, no statuses, nothing re-reading them, which is
how a complete research file sat unread while the wrong direction got
built (2026-08-24). This makes rot red instead of silent.

Contracts, checked in order:
1. Every *.md under docs/ (recursively, minus archives) appears as a row
   in docs/INDEX.md with a status from STATUSES.
2. INDEX.md contains no row pointing at a file that no longer exists.
3. docs/BACKLOG.md exists and every unchecked row names a source doc.
Exit 0 clean, 1 on violations (listed), 2 when it cannot measure.

Agent-context: runs in the local gate only; CI never sees docs/ because
the public repo must not carry it. That asymmetry is deliberate.
"""
import re
import sys
from pathlib import Path

# Anchor to the invoking tree, not this file's tree: the gate runs this in
# whichever checkout (worktree or main) is being graded, and each tree
# carries its own local-only docs/ population.
ROOT = Path.cwd()
DOCS = ROOT / "docs"
INDEX = DOCS / "INDEX.md"
BACKLOG = DOCS / "BACKLOG.md"

STATUSES = {"SPEC", "RESEARCH", "DECIDED", "RECORD", "SUPERSEDED", "LEDGER", "PROMPT", "HANDOFF"}
SKIP_DIRS = {"assets", "archive", "reference"}


def docs_files() -> list[str]:
    out = []
    for p in DOCS.rglob("*.md"):
        rel = p.relative_to(DOCS)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if rel.name in {"INDEX.md", "BACKLOG.md"}:
            continue
        out.append(str(rel))
    return sorted(out)


def tracked_docs() -> set[str]:
    import subprocess
    try:
        out = subprocess.run(["git", "ls-files", "docs"], cwd=ROOT, capture_output=True, text=True, timeout=20)
        return {p[len("docs/"):] for p in out.stdout.split() if p.startswith("docs/")}
    except Exception:
        return set()


def main() -> int:
    if not (ROOT / "AGENTS.md").exists():
        print("cannot measure: run from the repository root")
        return 2
    if not DOCS.is_dir():
        print("cannot measure: docs/ missing")
        return 2

    # Fresh-checkout rule (PR #8 review, High): INDEX.md and BACKLOG.md are
    # local-only, so a clone or new worktree has neither, and only tracked
    # docs (the ADRs). Failing there would reopen the gate-depends-on-
    # untracked-files trap. The control plane is INACTIVE until a local
    # (untracked) doc exists; the moment one does, triage is required.
    local_docs = [f for f in docs_files() if f not in tracked_docs()]
    if not INDEX.exists() and not local_docs:
        print("docs control plane inactive: fresh checkout, only tracked docs present")
        return 0

    problems: list[str] = []

    if not INDEX.exists():
        problems.append("docs/INDEX.md does not exist")
        indexed: dict[str, str] = {}
    else:
        indexed = {}
        for line in INDEX.read_text().splitlines():
            m = re.match(r"\|\s*`([^`]+)`\s*\|\s*(\w[\w-]*)\s*\|", line)
            if m:
                indexed[m.group(1)] = m.group(2)

    files = docs_files()
    for f in files:
        if f not in indexed:
            problems.append(f"not in INDEX.md: docs/{f} (triage it: add a row with a status)")
        elif indexed[f] not in STATUSES:
            problems.append(f"bad status '{indexed[f]}' for docs/{f} (allowed: {', '.join(sorted(STATUSES))})")
    for f in indexed:
        if f not in files:
            problems.append(f"INDEX.md row points at missing file: docs/{f}")

    if not BACKLOG.exists():
        problems.append("docs/BACKLOG.md does not exist")
    else:
        open_row = re.compile(r"^\s*[-*]\s+\[ \]")
        for i, line in enumerate(BACKLOG.read_text().splitlines(), 1):
            if open_row.match(line) and "`" not in line:
                problems.append(f"BACKLOG.md:{i} open row names no source doc in backticks")

    if problems:
        for p in problems:
            print(p)
        print(f"{len(problems)} docs-control-plane violation(s)")
        return 1
    print(f"docs index ok: {len(files)} docs triaged, backlog well-formed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
