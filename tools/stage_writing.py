"""Stage the writing site (the-bench) into a directory for deployment.

Purpose: writing/ stops shipping with the learning PWA (operator decision
2026-07-29: two Cloudflare Pages projects under one account) and deploys to the
existing `the-bench` Pages project instead. Same reasoning as stage_site.py:
Pages has no ignore mechanism, so publication is an ALLOWLIST staged before
upload, and a mistake fails here rather than on the public internet.

Contracts: SHIP maps repo paths to their location in the staged tree, because
the writing pages move UP a level (writing/index.html serves at /). FORBIDDEN
is re-checked against the staged tree afterwards; drafts are unpublished prose
and the build script is tooling, so either reaching the staged tree is a hard
failure. The output directory is synced, never merged blindly: stale files are
swept, matching stage_site.sweep()'s Windows rationale.

Typical usage::

    python tools/stage_writing.py dist-writing
    bun x wrangler pages deploy dist-writing --project-name the-bench
"""

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: repo path -> staged path. Directories copy recursively.
SHIP = {
    "writing/index.html": "index.html",
    "writing/the-bench.html": "the-bench.html",
    "writing/media": "media",
    "_headers": "_headers",
}

#: SHIP sources that may legitimately be absent.
OPTIONAL: set[str] = set()

#: Re-checked against the staged tree. A hit means SHIP is wrong.
#: the-bench-v5.html is the retired magenta/teal reskin (operator decision
#: 2026-08-07, restoring the 2026-07-29 reframe). It stays in the repo as the
#: record of a direction that was tried; it is named here so removing it from
#: SHIP cannot be silently undone by a later copy step.
FORBIDDEN = ["drafts", "v5_build.py", "the-bench-v5.html",
             "docs", "state", "tools", "daemon"]


def stage(out: Path) -> tuple[list[str], int]:
    """Sync every SHIP entry into `out` and sweep anything else.

    Args:
        out: destination directory, created if absent.

    Returns:
        The staged destination paths, and the count of stale files removed.

    Raises:
        FileNotFoundError: a required SHIP source is missing from the repo.
    """
    out.mkdir(parents=True, exist_ok=True)
    staged: list[str] = []
    keep: set[str] = set()
    for src_rel, dst_rel in SHIP.items():
        src = ROOT / src_rel
        if not src.exists():
            if src_rel in OPTIONAL:
                continue
            raise FileNotFoundError(f"SHIP source missing from the repo: {src_rel}")
        dst = out / dst_rel
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True)
            keep.update(p.relative_to(out).as_posix()
                        for p in dst.rglob("*") if p.is_file())
        else:
            shutil.copy2(src, dst)
            keep.add(dst_rel)
        staged.append(dst_rel)

    swept = 0
    for p in list(out.rglob("*")):
        if p.is_file() and p.relative_to(out).as_posix() not in keep:
            p.unlink()
            swept += 1
    return staged, swept


def audit(out: Path) -> list[str]:
    """Return FORBIDDEN paths that reached the staged tree (empty means clean)."""
    return [p for p in FORBIDDEN if (out / p).exists()]


def main() -> None:
    """Stage the writing site, audit it, and report. Exits non-zero on a leak."""
    out = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "dist-writing")
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
