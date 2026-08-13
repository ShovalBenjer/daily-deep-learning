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


def _match(script: str, start: int, opener: str, closer: str) -> int:
    """Index just past the ``closer`` matching the ``opener`` at ``start``.

    Skips quotes, template literals and both comment forms. Returns -1 when the
    delimiter never balances, which callers must treat as "no span" rather than
    guessing; `node --check` in the same gate domain already fails on genuinely
    unbalanced source, so reaching -1 means this scanner lost track, not that
    the file is broken.
    """
    depth, i, n, quote = 0, start, len(script), None
    while i < n:
        c = script[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "/" and i + 1 < n and script[i + 1] == "/":
            i = script.find("\n", i)
            if i < 0:
                return -1
        elif c == "/" and i + 1 < n and script[i + 1] == "*":
            i = script.find("*/", i)
            if i < 0:
                return -1
            i += 1
        elif c == opener:
            depth += 1
        elif c == closer:
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return -1


def _mask_comments(script: str) -> str:
    """Blank out comment bodies, preserving every character offset.

    A name written in prose is not a call. index.html has three comments that
    say the word "ritual" in English, plus one method literally named ``ritual``
    on the ``sfx`` object, and each of those counted as a reference to the
    ``ritual`` function. Verifying PR #4's own fix end to end is what surfaced
    this: the reviewer predicted that deleting all five of ``ritual``'s callers
    would leave the checker green, the body-span fix was supposed to close that,
    and the scenario STILL came back green because the three prose mentions kept
    the count above zero. One cause was fixed and a second was sitting behind it.

    String literals are deliberately NOT masked. This codebase builds markup in
    template literals and dispatches by name through string tables, so a name
    inside a string is often a real use. Masking them would trade a missed
    orphan for a false alarm, and a false alarm on a required gate domain is the
    more expensive error.
    """
    out = list(script)
    i, n, quote = 0, len(script), None
    while i < n:
        c = script[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "/" and i + 1 < n and script[i + 1] == "/":
            while i < n and script[i] != "\n":
                out[i] = " "
                i += 1
            continue
        elif c == "/" and i + 1 < n and script[i + 1] == "*":
            end = script.find("*/", i + 2)
            end = n if end < 0 else end + 2
            for j in range(i, end):
                if out[j] != "\n":
                    out[j] = " "
            i = end
            continue
        i += 1
    return "".join(out)


def _is_definition(script: str, after_name: int) -> bool:
    """True when the name at this position is being DEFINED, not called.

    Object-literal method shorthand (``ritual() { ... }`` on the ``sfx`` object
    in index.html) is a different function that happens to share a name, and
    counting it as a reference kept ``ritual`` above zero even with all five of
    its real callers deleted. That was the third and last cause of the false
    negative Claude Code Review predicted on PR #4; the body-span fix and the
    comment mask each removed one, and this one was sitting behind both.

    The test is that the matching ``)`` is immediately followed by ``{``. A call
    can never be: ``ritual({...})`` puts the brace INSIDE the parentheses, and
    ``ritual()`` followed by a bare block is legal JS that nobody writes. So
    this errs toward reporting an orphan only when the name has no real use
    left, without the false-alarm risk of matching on the preceding character
    (``, ritual(x)`` as a second argument looks exactly like method shorthand
    from the left).
    """
    i, n = after_name, len(script)
    # Newlines too, not just spaces and tabs. A name and its parenthesis split
    # across lines is unusual but legal, and the review of PR #4 was right that
    # stopping at " \t" would read such a definition as a call. Neither target
    # file has one; taking it anyway because the whole point of this function is
    # to not miscount a definition.
    while i < n and script[i] in " \t\r\n":
        i += 1
    if i >= n or script[i] != "(":
        return False
    close = _match(script, i, "(", ")")
    if close < 0:
        return False
    while close < n and script[close] in " \t\r\n":
        close += 1
    return close < n and script[close] == "{"


def _body_spans(script: str, name: str) -> list[tuple[int, int]]:
    """Character ranges of each ``function name(...) { ... }`` body.

    The parameter list is paren-matched first, THEN the body is brace-matched.
    Taking the first ``{`` after the name looked equivalent and was not: Claude
    Code Review caught it on PR #4 with two live cases in this checker's own
    target file, ``countUp`` (index.html:276) and ``ritual`` (index.html:490),
    both of which destructure their first parameter. For ``ritual`` the span
    collapsed to the 52 characters of the destructuring pattern, so
    ``sfx.ritual()`` inside its real body at index.html:494 counted as an
    external reference. All five of its real callers could have been deleted
    with this checker staying green, which is the exact false negative the
    own-body exclusion was added to remove.

    Known limit: a regex literal holding an unbalanced brace or paren would
    confuse the scan. Neither target file has one, and the failure mode is a
    wrong or missing span rather than a crash. A JS parser is a dependency this
    repo does not carry.
    """
    spans = []
    for m in re.finditer(rf"^[ \t]*(?:async[ \t]+)?function[ \t]+{re.escape(name)}\b",
                         script, re.M):
        paren_at = script.find("(", m.end())
        if paren_at < 0:
            continue
        after_params = _match(script, paren_at, "(", ")")
        if after_params < 0:
            continue
        open_at = script.find("{", after_params)
        if open_at < 0:
            continue
        end = _match(script, open_at, "{", "}")
        if end < 0:
            continue
        spans.append((m.start(), end))
    return spans


def uses(script: str, name: str) -> int:
    """Count references to ``name`` from OUTSIDE its own body.

    Counts bare identifier references, not just ``name(``, so a function passed
    to addEventListener or stored in a table still reads as used.

    References inside the function's own body do not count, which Kilo caught on
    PR #3 and which matters in both directions. The dangerous one is the false
    NEGATIVE: a recursive function that loses its last external caller still
    shows one reference from its own recursive call, so the orphan this checker
    exists to find would be invisible for exactly the functions most likely to
    have a single caller. The false positive Kilo named (removing a recursive
    call from a function that had no external caller anyway) cannot fire either,
    because such a function's external count was already 0 and ``orphans``
    requires ``was > 0``.

    "Its own body" is only as accurate as ``_body_spans``. That was a real
    qualifier and not a hedge until PR #4: the first version located the body by
    taking the next ``{`` after the name, so for a destructured parameter list
    the span covered the parameters instead of the body. When ``_body_spans``
    returns no span for a name, every reference counts as external, which fails
    toward a missed orphan rather than a false alarm.
    """
    return _uses_masked(_mask_comments(script), name)


def _uses_masked(script: str, name: str) -> int:
    """``uses`` over a script whose comments are already blanked.

    Split out because ``orphans`` walks every name in the file and masking is
    O(len(script)) each time; on index.html that was 96 names times two versions
    times 139 KB. Claude Code Review flagged the redundancy on PR #4.
    """
    spans = _body_spans(script, name)
    total = 0
    for m in re.finditer(rf"\b{re.escape(name)}\b", script):
        if any(lo <= m.start() < hi for lo, hi in spans):
            continue
        if _is_definition(script, m.end()):
            continue
        total += 1
    return total


def ambiguous(script: str) -> list[str]:
    """Names declared more than once, which this checker cannot reason about.

    Everything here is keyed by NAME, not by declaration, so two local functions
    that share one keeps the other's orphaning invisible: their references pool
    into a single count and both bodies get excluded. index.html has four such
    names today (``step`` x3, ``summary`` x3, ``next`` x2, ``reset`` x2), and
    Claude Code Review traced it on PR #4: deleting ``openConceptQuiz``'s only
    call to its local ``step()`` at index.html:2048 leaves the count above zero
    because two unrelated ``step()`` functions elsewhere still have callers.

    Separating them needs real scope analysis, which needs a JS parser this repo
    does not carry. So they are excluded from the check and COUNTED OUT LOUD by
    the caller instead. A checker that silently covers 92 of 96 names reads as
    covering all of them, which is the same shape of invisible gap the tool
    exists to catch.
    """
    counts: dict[str, int] = {}
    for name in _DEF.findall(_mask_comments(script)):
        counts[name] = counts.get(name, 0) + 1
    return sorted(n for n, c in counts.items() if c > 1)


def orphans(before: str, after: str) -> list[tuple[str, int]]:
    """Functions defined in both versions that lost every reference.

    Names declared more than once in either version are skipped; see
    ``ambiguous`` for why, and call it to report what was skipped.
    """
    mb, ma = _mask_comments(before), _mask_comments(after)
    skip = set(ambiguous(before)) | set(ambiguous(after))
    found = []
    for name in sorted(set(_DEF.findall(mb)) & set(_DEF.findall(ma))):
        if name in skip:
            continue
        was = _uses_masked(mb, name)
        now = _uses_masked(ma, name)
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

    # Recursion, both directions, from Kilo's review of PR #3.
    # The dangerous half: a recursive function that loses its last EXTERNAL
    # caller must still go red. Counting the self-call would hide it.
    rec_before = """
      function walk(n) { if (n) walk(n - 1); }
      function boot() { walk(3); }
    """
    rec_after = """
      function walk(n) { if (n) walk(n - 1); }
      function boot() { }
    """
    if [n for n, _ in orphans(rec_before, rec_after)] != ["walk"]:
        print("selftest FAILED: a recursive function that lost its only "
              "external caller must go red")
        return 1

    # The half Kilo named: a function with no external caller, whose recursive
    # call is then removed, is not a new orphan. Its external count was already
    # zero, so `was > 0` must keep it green.
    self_only = "function walk(n) { if (n) walk(n - 1); }\n"
    if orphans(self_only, "function walk(n) { return n; }\n"):
        print("selftest FAILED: dropping recursion from an already-uncalled "
              "function is not an orphaning")
        return 1

    # Destructured parameters, from Claude Code Review on PR #4. Modelled on the
    # real index.html:490 shape, `function ritual({ ... }, onclose)`, with a
    # same-named call inside its own body. If the span stops at the parameter
    # list's closing brace, that self-call reads as external and the orphaning
    # is missed. The version this replaced scored ritual's real body at 52
    # characters and would have stayed green with all five callers deleted.
    des_before = """
      function ritual({ kicker, title, tier = 0 }, onclose) {
        celebrate(kicker, onclose);
        sfx.ritual();
      }
      function boot() { ritual({ kicker: "x", title: "y" }, null); }
    """
    des_after = """
      function ritual({ kicker, title, tier = 0 }, onclose) {
        celebrate(kicker, onclose);
        sfx.ritual();
      }
      function boot() { }
    """
    if [n for n, _ in orphans(des_before, des_after)] != ["ritual"]:
        print("selftest FAILED: a destructured-parameter function that lost its "
              "only external caller must go red; the body span is probably "
              "stopping at the parameter list")
        return 1

    # Name collision with an object-literal method, the third and last cause of
    # the false negative Claude Code Review predicted on PR #4. Modelled on the
    # real `sfx = { ..., ritual() { ... } }` in index.html. A same-named method
    # is a different function, and counting it as a reference kept the real
    # function above zero even with every caller gone. Comments too, since a
    # name written in prose is not a call.
    col_before = """
      const sfx = { tone() { }, ritual() { beep(); } };
      /* the ritual is fixed; never perform a ritual during boot */
      function ritual(o) { sfx.ritual(); }
      function boot() { ritual({ k: 1 }); }
    """
    col_after = """
      const sfx = { tone() { }, ritual() { beep(); } };
      /* the ritual is fixed; never perform a ritual during boot */
      function ritual(o) { sfx.ritual(); }
      function boot() { }
    """
    if [n for n, _ in orphans(col_before, col_after)] != ["ritual"]:
        print("selftest FAILED: a function whose name is also an object method "
              "and appears in comments must still go red when its last real "
              "caller goes")
        return 1

    # Same-named local functions, the High finding on PR #4's third review.
    # Two functions called step() pool into one name-keyed count, so deleting
    # the only caller of one leaves the other's callers holding the count above
    # zero. This cannot be resolved without scope analysis, so the contract is
    # that such a name is EXCLUDED and reported, never silently half-checked.
    # Declarations go on their own lines because _DEF anchors to line start; a
    # `function` mid-line is not seen as a declaration at all, which is a
    # separate conservative limit (such a function is simply never checked).
    dup_before = """
      function quiz() {
        function step() { a(); }
        step();
      }
      function deck() {
        function step() { b(); }
        step();
      }
    """
    dup_after = """
      function quiz() {
        function step() { a(); }
      }
      function deck() {
        function step() { b(); }
        step();
      }
    """
    if orphans(dup_before, dup_after):
        print("selftest FAILED: a name with two declarations must be excluded, "
              "not guessed at")
        return 1
    if ambiguous(dup_before) != ["step"]:
        print(f"selftest FAILED: ambiguous() must name step, got "
              f"{ambiguous(dup_before)}")
        return 1

    print("selftest ok: 4 planted defects caught, 4 false-positive shapes "
          "rejected, extractor survives 2 tags that defeat a regex, "
          "duplicate names excluded and reported")
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
        b_js, a_js = inline_scripts(before_html), inline_scripts(after_html)
        found = orphans(b_js, a_js)
        for name, was in found:
            failures.append(f"{rel}: {name}() had {was} reference(s) at "
                            f"{args.base} and has none now, but its definition "
                            f"is still there")

        # Say what was NOT covered. A silent skip reads as coverage, which is
        # the exact shape of gap this tool exists to catch.
        skipped = sorted(set(ambiguous(b_js)) | set(ambiguous(a_js)))
        if skipped:
            total_names = len(set(_DEF.findall(_mask_comments(a_js))))
            print(f"{rel}: not covered, {len(skipped)} of {total_names} names are "
                  f"declared more than once and cannot be told apart without "
                  f"scope analysis: {', '.join(skipped)}")

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
