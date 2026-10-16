# REVIEW.md

Judging policy for reviewers of this repository (human or agent: Claude Code
Review, Kilo Code Review, or anything else wired to pull requests). This file
is about **what to reject**, not how to build. Build facts live in
[AGENTS.md](./AGENTS.md); this file links to it and does not restate it.

Per the Kilo Code convention this file is committed to `main`, the base branch
pull requests target, so a branch cannot alter the criteria it is judged by.

## Severity calibration

**Blocking (request changes):**
- A weakened oracle: any change that makes a test, checker, or CI gate pass
  more easily without the underlying defect class shrinking. Diff size is
  irrelevant — a one-line oracle weakening blocks.
- Broken boot path or a route that stops rendering (the callsite-oracle class).
- Invalid scored content: quiz `answer` out of range, duplicate options/ids,
  empty fillin answers (`tools/check_quiz_keys.py` is the oracle).
- Secrets or credentials committed; new outbound network calls from the
  static site without an allowlist entry.
- Publication-boundary violations: anything that puts a forbidden path into
  the staged site (`tools/stage_site.py` is the oracle).

**Advisory (comment, do not block):**
- Hebrew prose polish in lessons, naming bikesheds, micro-performance.

## Paths to skip for style comment

Do not nitpick generated or machine-maintained files: `posts/index.json`
(derived from `posts/*.md`), `corpus_manifest.json`, `**/bun.lock`, and the
machine-written sections of `curriculum.json` / `concepts.json` (updated by
`tools/close_unit.py`). Judge them only on: do they parse, and does the
generator that wrote them still pass its oracle.

## Verification expected

- CI green is required for merge. The `checks`, `e2e`, `secret-scan`, and
  `pr-link-check` jobs must pass.
- A change that touches the lesson pipeline (`units/`, `posts/`, `tools/`)
  must show the quiz-key oracle and link validator passing.
- A change that touches routes or the app shell must show the `e2e` job.
- Never approve on the basis of "CI will catch it" when CI is red for
  unrelated reasons: say which failures are pre-existing and why.

## Summary style

Short, terse, the operator reads Hebrew. Order findings by severity
(blocking first), one line each, with diff evidence cited for every finding
or marked "possible issue". Max 5 nits; count the rest in the summary.
Do not report style that CI already enforces.

## Reviewer panel and bias

This repo runs more than one review bot. Treat them as a panel, not an
oracle: a single reviewer suffers position, length, and self-preference bias.
Corroborate a blocking finding across reviewers or evidence before acting on
it; a lone nit from one reviewer is advisory until confirmed.

## Sub-agent budget

Scale review effort to diff size: under ~200 changed lines, one pass.
Above that, split by concern (app shell / lesson content / tooling / CI) and
cap parallel review sub-agents at 3. A reviewer that cannot finish its pass
is not a reviewer — report the cap hit instead of a partial verdict.
