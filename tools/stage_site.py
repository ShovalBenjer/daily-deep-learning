"""Stage the shippable site into a directory for deployment.

Purpose: `wrangler pages deploy .` uploads the repo root, which publishes
`docs/`, `state/`, planning documents and personal drafts at
daily-deep-learning.pages.dev. Cloudflare Pages has no ignore-file mechanism
(`.assetsignore` is a Workers static-assets feature; the Pages request,
workers-sdk#2961, is not shipped), so exclusion has to happen before upload.

Contracts: SHIP is an ALLOWLIST, so anything added to the repo later is private
by default and has to be named here to become public. A missing required entry
is a hard failure, never a silent partial deploy. FORBIDDEN is re-checked
against the staged tree afterwards, so a mistake in SHIP fails here rather than
on the public internet. The output directory is replaced, never merged.

Agent-context: call main() or run it. Deploy the staged directory, never the
repo root. Adding a runtime asset means adding it to SHIP, or the deployed app
404s on it.

Typical usage::

    python tools/stage_site.py dist
    bun x wrangler pages deploy dist --project-name daily-deep-learning
"""

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: Every path the deployed app serves. Derived from what index.html fetches and
#: references, the sw.js precache list, and style.css url() references.
SHIP = [
    "index.html", "style.css", "sw.js", "manifest.webmanifest", "_headers",
    "concepts.json", "course_plan.json", "discoveries.json", "judgment_map.json",
    "research_ladder.json", "skills.json", "syllabus.json", "talents.json",
    "curriculum.json", "goals.json",
    "icons", "vendor", "assets", "posts", "corpus", "writing", "units",
]

#: Pruned from inside shipped directories. Source art is 6.8 MB of raw PNG the
#: site never serves; drafts are unpublished prose sitting under a published
#: subsite, reachable by direct URL even though nothing links them.
PRUNE = {"assets/art/raw", "writing/drafts"}

#: Entries in SHIP that may legitimately be absent (added by a later build step).
OPTIONAL = {"curriculum.json", "goals.json", "units"}

#: Re-checked against the staged tree. A hit means SHIP or PRUNE is wrong.
FORBIDDEN = ["docs", "state", "tools", "tests", "daemon", "sadna-sync", "shots",
             ".github", ".wrangler", "writing/drafts", "assets/art/raw"]


def _prune(directory: str, names: list[str]) -> set[str]:
    """Return the names shutil.copytree must skip inside `directory`.

    Args:
        directory: absolute path of the directory being copied.
        names: its entries, supplied by copytree.

    Returns:
        The subset of `names` whose repo-relative path is in PRUNE.
    """
    rel = Path(directory).resolve().relative_to(ROOT).as_posix()
    return {n for n in names if f"{rel}/{n}".lstrip("./") in PRUNE}


def expected(names: list[str]) -> set[str]:
    """Return every repo-relative file path the staged tree should contain.

    Args:
        names: SHIP entries that exist in the repo.

    Returns:
        Posix-style relative paths, with PRUNE subtrees excluded.
    """
    out = set()
    for name in names:
        src = ROOT / name
        if src.is_file():
            out.add(name)
            continue
        for p in src.rglob("*"):
            rel = p.relative_to(ROOT).as_posix()
            if p.is_file() and not any(rel.startswith(f"{d}/") for d in PRUNE):
                out.add(rel)
    return out


def sweep(out: Path, keep: set[str]) -> int:
    """Delete staged files that are no longer shipped.

    The tree is synced rather than deleted and rebuilt: on Windows a directory
    whose files were just written stays in delete-pending state well past 30
    seconds, so `rmtree` fails on the directory even once it is empty. Removing
    individual files does not hit that, and a leftover empty directory is inert
    (it publishes nothing, and audit() still fails loudly if a forbidden path
    is present).

    Args:
        out: the staged directory.
        keep: repo-relative paths that belong there.

    Returns:
        How many stale files were removed.
    """
    removed = 0
    for p in list(out.rglob("*")):
        if p.is_file() and p.relative_to(out).as_posix() not in keep:
            p.unlink()
            removed += 1
    return removed


def stage(out: Path) -> tuple[list[str], int]:
    """Sync every SHIP entry into `out` and remove anything else.

    Args:
        out: destination directory, created if absent. Its contents are brought
            into line with SHIP rather than deleted and rebuilt; see sweep().

    Returns:
        The entries staged in SHIP order, and the count of stale files removed.

    Raises:
        FileNotFoundError: a required SHIP entry is missing from the repo.
    """
    out.mkdir(parents=True, exist_ok=True)

    staged = []
    for name in SHIP:
        src = ROOT / name
        if not src.exists():
            if name in OPTIONAL:
                continue
            raise FileNotFoundError(f"SHIP entry missing from the repo: {name}")
        if src.is_dir():
            shutil.copytree(src, out / name, ignore=_prune, dirs_exist_ok=True)
        else:
            shutil.copy2(src, out / name)
        staged.append(name)
    return staged, sweep(out, expected(staged))


def audit(out: Path) -> list[str]:
    """Return FORBIDDEN paths that reached the staged tree.

    Args:
        out: the staged directory.

    Returns:
        Repo-relative paths that must not be published but were staged. Empty
        means the staged tree is clean.

    Examples:
        >>> audit(Path("dist"))
        []
    """
    return [p for p in FORBIDDEN if (out / p).exists()]


def main() -> None:
    """Stage the site, audit it, and report. Exits non-zero on a leak."""
    out = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "dist")
    staged, swept = stage(out)
    leaked = audit(out)

    files = sum(1 for p in out.rglob("*") if p.is_file())
    mb = sum(p.stat().st_size for p in out.rglob("*") if p.is_file()) / 1e6
    print(f"staged {len(staged)} entries, {files} files, {mb:.1f} MB -> {out}"
          + (f", swept {swept} stale" if swept else ""))

    if leaked:
        print("LEAK: forbidden paths reached the staged tree:", file=sys.stderr)
        for p in leaked:
            print(f"  {p}", file=sys.stderr)
        sys.exit(1)
    print("audit: clean, no forbidden path staged")


if __name__ == "__main__":
    main()
