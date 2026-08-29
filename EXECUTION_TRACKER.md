# EXECUTION_TRACKER.md

Live backlog ledger for autonomous execution sessions. Extracted from every
tracked requirement-bearing document in this repository. Items whose source is
the local-only `docs/` population (BACKLOG.md, REQUIREMENTS-OF-RECORD) are NOT
listed here: that tree is deliberately untracked and invisible to a fresh
checkout (AGENTS.md), so a remote session must not guess at its contents.
Update this file immediately before and after every action.

## Master Task Backlog

- [x] L7-REPLAY: [TESTING-SOTA-2026-GAPS.md:74] Replayable integration for the
  sync boundary. `tests/boundaries.test.ts` mutates LIVE production state.
  - Status: VERIFIED
  - Acceptance Criteria: the Worker's boundary contract (401 unauthorized,
    400 bad JSON with state untouched, 413 oversize, roundtrip without
    corruption, CORS pin) is testable with no network, no key, no live state.
  - Verification: `bun test tests/worker.test.ts` (hermetic, in-process
    `sadna-sync/worker.js` with a stub KV; also in ci.yml's hermetic slice).
  - Note: the live suite stays as-is per quality-contract.json (fail-closed on
    purpose); the hermetic suite is the replayable layer the rubric asks for.

- [x] PROMPT-REG: [TESTING-SOTA-2026-GAPS.md:77] Prompt-as-code regression.
  `MENTOR` and `SYSTEM` prompts are load-bearing and were untested.
  - Status: VERIFIED
  - Acceptance Criteria: deleting or rewording the mentor's
    refusal-to-presume rule, the open-belief-after-confirmation rule, the
    `from` requirement, or any of the four signal responses fails a test;
    the daemon's `get_mistakes` thresholds cannot drift from the client's
    `MENTOR` constants unnoticed.
  - Verification: `bun test tests/prompts.test.ts`.

- [x] L4-MENTOR: [TESTING-SOTA-2026-GAPS.md:80] Mutation coverage beyond the
  deck block. `mentorQueue` decides what the learner is told about their own
  mistakes and had no mutation coverage.
  - Status: VERIFIED
  - Acceptance Criteria: planted defects in the mentorQueue block (threshold
    flips, suppression keyed on the belief id alone, dropped retest gate,
    dropped lapse floor, broken priority order) are all killed by an oracle;
    a harmless control edit survives.
  - Verification: `bun test tests/mutation.test.ts` (mentor section).

- [x] L10-BUDGET: [TESTING-SOTA-2026-GAPS.md:82] Performance budget.
  Prod-deployed, ~140 KB inline script, no budget existed.
  - Status: VERIFIED
  - Acceptance Criteria: the inline script and the boot-critical shell have
    enforced byte budgets that fail a test when exceeded, with the measured
    figure in the failure message so the budget is renegotiated consciously
    rather than deleted.
  - Verification: `bun test tests/budget.test.ts`.

- [x] E2E-HERMETIC: [e2e/playwright.config.ts:2, README.md:26] The
  "self-contained" e2e lane still depended on fonts.googleapis.com being
  reachable: a font CDN outage or an egress-filtered runner fails the
  console-error oracle with a third-party artifact.
  - Status: VERIFIED
  - Acceptance Criteria: app boot specs stub the two font origins; the
    console oracle stays strict for every same-origin resource.
  - Verification: `cd e2e && bun x playwright test` with no third-party
    egress available (reproduced in this session's sandbox).

## Verified out of scope for a remote session

- ROUTINE.md daily unit generation: belongs to the scheduled morning agent;
  the idempotency rule (AGENTS.md Known traps) forbids regenerating existing
  units and `inbox.md` has no open items to digest.
- The gate's `review` domain and `docs` control plane: depend on the operator's
  local `claude-setup` tree and local-only `docs/` population.
- `tests/boundaries.test.ts` live runs and the daemon roundtrip: need
  `daemon/.key` (gitignored) and a running daemon; deliberately fail closed.
- L5 component layer, cross-browser matrix, visual regression
  [TESTING-SOTA-2026-GAPS.md:51-54]: need Storybook/Testing Library or WebKit
  system deps, both named non-goals or sudo-blocked backlog rows.

## Baseline (this session, 2026-08-29)

- build: `python3 tools/validate_links.py` exit 0 (errors=0).
- types: full sweep exit 0, including `cd game && bun x tsc --noEmit`.
- unit (hermetic slice): 38 pass, 0 fail before this session's additions.
- e2e: 7 pass locally; 6 boot specs failed only on third-party font egress,
  fixed by E2E-HERMETIC above.
