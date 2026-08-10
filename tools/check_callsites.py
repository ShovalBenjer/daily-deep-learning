#!/usr/bin/env python3
"""Catch a function whose definition survived an edit but whose last caller did not.

Purpose:
    A 2517-line inline script has no module boundary between a function and the
    code that calls it, so a cut can remove every call site and leave the
    definition standing. Nothing existing catches that. ``node --check`` still
    exits 0 because the syntax is valid, ``tools/check_inline_js.py`` still
    reports ok for the same reason, and a DOM assertion still finds the
    container because the container is markup, not script. The feature simply
    stops appearing on the page.

    Measured instance, 2026-08-07, writing/the-bench.html: a cut ran from
    ``function counters`` to the closing ``})();`` and both ``counters(...)``
    invocations lived between those two points. The definition survived. The
    cost readout silently vanished from the page the operator was then asked to
    review, and every check in the repo passed.

Contracts:
    Delta-based, never absolute. "Every function must have a caller" would go
    red on genuinely dead code that someone is halfway through removing, and on
    a definition added in the same commit as its future caller. The rule here is
    narrower and has no such false positive: a function that HAD callers before
    the edit and HAS NONE after it, while its own definition is untouched, is an
    orphan the author did not intend to create.

    Exit 0 when no function was orphaned. Exit 1 when one was, naming it.
    Exit 2 when the check could not measure (no git, bad ref, unreadable file),
    which is the repo convention for "cannot run here" rather than "failed".

Agent-context:
    Run it against the working tree before committing, or against any two refs.
    ``--selftest`` replays the 2026-08-07 cut as a planted defect and asserts
    the checker goes red on it; a checker with no red case is not a checker.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

# Files carrying an inline <script> that this repo hand-edits.
TARGETS = ("index.html", "writing/the-bench.html")

_DEF = re.compile(r"^[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)", re.M)


class _ScriptCollector(HTMLParser):
    """Collect the text of every inline <script>, skipping ones with src=.

    A regex was the obvious way to do this and it is what tools/check_inline_js.py
    still uses. CodeQL's py/bad-tag-filter flagged it here as high severity and
    it was right to, for a reason that matters more than the XSS framing suggests
    (nothing here renders anything, the input is this repo's own markup). A regex
    of the shape `<script[^>]*>` mis-parses a `>` inside a quoted attribute and
    anything inside an HTML comment, so it can silently return the wrong script
    body. This checker exists to catch a defect that hides behind checks that
    pass, so a parser that can quietly miss a block is the one thing it must not
    be built on. The stdlib parser handles script as CDATA and costs no
    dependency.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.blocks: list[str] = []
        self._depth = 0
        self._keep = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "script":
            return
        self._depth += 1
        self._keep = not any(k.lower() == "src" for k, _ in attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self._depth = max(0, self._depth - 1)
            self._keep = False

    def handle_data(self, data: str) -> None:
        if self._depth and self._keep:
            self.blocks.append(data)


def inline_scripts(html: str) -> str:
    """Concatenate every inline script block in a document."""
    p = _ScriptCollector()
    p.feed(html)
    p.close()
    return "\n".join(p.blocks)


def uses(script: str, name: str) -> int:
    """Count references to ``name`` that are not its own declaration.

    Counts bare identifier references, not just ``name(``, so a function passed
    to addEventListener or stored in a table still reads as used. Overcounting
    is the safe direction here: it can only suppress a red, never invent one.
    """
    total = len(re.findall(rf"\b{re.escape(name)}\b", script))
    declared = len(re.findall(rf"^[ \t]*(?:async[ \t]+)?function[ \t]+{re.escape(name)}\b",
                              script, re.M))
    return total - declared


def orphans(before: str, after: str) -> list[tuple[str, int]]:
    """Functions defined in both versions that lost every reference."""
    defs_before = set(_DEF.findall(before))
    defs_after = set(_DEF.findall(after))
    found = []
    for name in sorted(defs_before & defs_after):
        was = uses(before, name)
        now = uses(after, name)
        if was > 0 and now == 0:
            found.append((name, was))
    return found


def git_show(ref: str, path: str) -> str | None:
    """Read a path at a ref, or None when the ref or path is not there."""
    try:
        out = subprocess.run(["git", "show", f"{ref}:{path}"],
                             capture_output=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return out.stdout.decode("utf-8", "replace")


def selftest() -> int:
    """Replay the 2026-08-07 cut and assert the checker goes red on it."""
    before = """
      function counters(id, list) { render(id, list); }
      function boot() {
        counters("corpuscount", [{v: 78406}]);
        counters("counters", [{v: 10.5}]);
      }
    """
    # The planted defect: the cut ran from `function counters` through the
    # closing brace of boot(), taking both invocations with it. The definition
    # is re-emitted above the cut, exactly as the real edit left it.
    after = """
      function counters(id, list) { render(id, list); }
      function boot() {
      }
    """
    red = orphans(before, after)
    if [n for n, _ in red] != ["counters"]:
        print(f"selftest FAILED: expected counters to go red, got {red}")
        return 1

    # And the check must stay green when the function is deleted outright,
    # which is an intentional removal rather than an orphaning.
    deleted = "function boot() {\n}\n"
    if orphans(before, deleted):
        print("selftest FAILED: deleting a function with its callers is not an orphan")
        return 1

    # And green when a function is added with no caller yet, since an absolute
    # rule would go red here and this one must not.
    added = before + "\n function future() { return 1; }\n"
    if orphans(before, added):
        print("selftest FAILED: a newly added uncalled function is not an orphan")
        return 1

    # The extractor itself needs a red case, because a parser that silently
    # returns the wrong script body would make every check above pass on
    # nothing. Both shapes below defeat the `<script[^>]*>` regex this used to
    # use: a `>` inside a quoted attribute truncates the opening tag, and an
    # external script has no body to take.
    tricky = (
        '<script src="app.js"></script>'
        '<script data-x="a>b" type="text/javascript">function kept(){}</script>'
    )
    got = inline_scripts(tricky)
    if "function kept(){}" not in got:
        print(f"selftest FAILED: parser lost a script body, got {got!r}")
        return 1
    if "app.js" in got:
        print("selftest FAILED: parser pulled in an external script's src")
        return 1

    print("selftest ok: 1 planted defect caught, 2 false-positive shapes "
          "rejected, extractor survives 2 tags that defeat a regex")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--base", default=None,
                    help="ref to compare against (default: HEAD, or HEAD~1 "
                         "when the working tree is clean)")
    ap.add_argument("--head", default=None,
                    help="ref to compare (default: the working tree)")
    ap.add_argument("--selftest", action="store_true",
                    help="run the planted-defect check and exit")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    root = Path(__file__).resolve().parent.parent

    # The gate runs after the final commit, so on a clean tree "working tree vs
    # HEAD" is an empty diff and would be green by construction. Fall back to
    # the last commit, which is the edit the gate is actually grading. Without
    # this the check would pass in the one context it most needs to run.
    if args.base is None:
        args.base = "HEAD"
        if args.head is None:
            dirty = subprocess.run(["git", "status", "--porcelain"] + list(TARGETS),
                                   capture_output=True, timeout=30)
            if dirty.returncode == 0 and not dirty.stdout.strip():
                args.base = "HEAD~1"
                print("working tree is clean for the target files, "
                      "grading HEAD~1..HEAD instead")
    failures = []
    measured = 0

    for rel in TARGETS:
        before_html = git_show(args.base, rel)
        if before_html is None:
            print(f"skip {rel}: not readable at {args.base}")
            continue

        if args.head is None:
            path = root / rel
            if not path.exists():
                print(f"skip {rel}: absent from the working tree")
                continue
            after_html = path.read_text(encoding="utf-8", errors="replace")
        else:
            after_html = git_show(args.head, rel)
            if after_html is None:
                print(f"skip {rel}: not readable at {args.head}")
                continue

        measured += 1
        found = orphans(inline_scripts(before_html), inline_scripts(after_html))
        for name, was in found:
            failures.append(f"{rel}: {name}() had {was} reference(s) at "
                            f"{args.base} and has none now, but its definition "
                            f"is still there")

    if measured == 0:
        print("could not measure: no target file readable at both ends")
        return 2

    if failures:
        print(f"orphaned function(s) found in {measured} file(s):")
        for line in failures:
            print(f"  {line}")
        print("\nA function whose last caller was deleted while its definition "
              "survived is almost always an accidental cut. If the removal was "
              "intended, delete the definition too.")
        return 1

    print(f"call-site delta ok: {measured} file(s) compared against {args.base}, "
          "no function lost its last caller")
    return 0


if __name__ == "__main__":
    sys.exit(main())
