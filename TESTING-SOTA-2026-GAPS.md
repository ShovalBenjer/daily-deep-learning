# Testing SOTA 2026: gap analysis and open items

> Generated 2026-07-29 against `~/claude-setup/work-docs/SOTA-TESTING-CRITERIA-2026.md`.
> Status legend: have / partial / gap / n-a. Evidence is file:symbol.
>
> Written because the operator asked which tests review the tests. The honest
> answer on the morning of 2026-07-29 was "none": the suite was example-based
> only, nothing measured whether it could fail, and the rubric below was never
> consulted. This file records what was closed since and what is still open.

## 1. Project profile

- **Type:** static site with interactive UI (rubric 3.D), no bundler, no root
  `package.json`, by design.
- **Also:** an AI agent plane (3.B). `daemon/server.ts` runs the Claude Agent SDK
  with tools that WRITE learner state.
- **Risk surfaces:** prod-deployed (Cloudflare Pages, push to main deploys);
  network-exposed and untrusted-input (the daemon is reachable over a public
  cloudflared tunnel); distributed (browser to Worker to daemon, three hops).
- **Therefore applicable:** minimum bar L0 + L1 + L2 + L7 + L9, plus L3/L4/L6
  for external input and distribution, plus L10 for prod.
- **Not applicable:** no PII beyond the operator's own learner state, no money
  or CRM write surface.

## 2. Layer coverage

| Layer | Status | Evidence | Note |
|---|---|---|---|
| L0 static/formal | partial 0.5 | `quality-contract.json` types domain: `node --check`, `tools/check_inline_js.py`, `compileall`; security domain secret scan | No linter, no `tsc --strict`, no Semgrep/CodeQL/Gitleaks. The secret scan is real and caught a live defect (a private-key header committed in `units/m0-ssh.md`, fixed in 7b4bdfb) |
| L1 unit | have 1.0 | `tests/mentor.test.ts` 12, `tests/decks.test.ts` 8 | Hermetic, ~60ms. Lift source out of `index.html` rather than copying it, since the app has no module boundary |
| L2 property | have 1.0 | `tests/mutation.test.ts:violated` over 300 seeded generations | Hand-rolled seeded generator, no `fast-check`: "no npm at the root" is a stated non-goal. No shrinking, so a failure reports its seed rather than a minimal case |
| L3 fuzz | have 1.0 | `tests/fuzz.test.ts`, 2000 hostile bodies + every nasty value in every field | Required the boundary to be extracted to `daemon/server_parse.ts` so it runs with no network, key or rate limiter |
| L4 mutation | partial 0.85 | `tests/mutation.test.ts:MUTANTS` (deck, 8 defects), `MENTOR_MUTANTS` (mentorQueue, 9), `GET_MISTAKES_MUTANTS` (daemon get_mistakes, 8, added 2026-08-30), `OPEN_BELIEF_MUTANTS` (daemon open_belief, 6, added 2026-08-30), all killed, each with a control mutant that must survive | Client renderers still have no mutation coverage |
| L5 component | gap 0 | none | No Testing Library, no Storybook. Renderers are only exercised through e2e |
| L6 contract | have 1.0 | `tests/contract.test.ts` | Consumer-driven: the payload is built by the REAL client code lifted from `index.html` and fed to the REAL parser. Found a live defect, see below |
| L7 integration | partial 0.75 | `tests/boundaries.test.ts`, 10 tests, plus `tests/worker.test.ts` (added 2026-08-29): the real Worker handler in-process over a stub KV, same boundary contract, no network, no key | The Worker side is now replayable without cassettes (the handler is a single import-free module, so running it beats replaying it). The daemon /chat roundtrip remains live-only |
| L8 e2e | partial 0.5 | e2e domain, waived to 2026-08-05 | Harness works; two dead toggles are real failures |
| L9 golden/regression | partial 0.5 | one proven regression oracle (`tests/mentor.test.ts`, belief suppression, shown to fail against the pre-fix logic) | No snapshot or visual baseline. Not every past bug became a test |
| L10 non-functional | partial 0.5 | `tests/budget.test.ts` (added 2026-08-29): enforced byte budgets for the inline script and the offline-install precache, plus precache existence and SHIP coverage | Field budgets (LCP/INP/CLS) still absent; they need the deployed site. No load, no chaos |

**Layer score: 8.1 / 11 applicable = 0.74** (was 8.0 before the 2026-08-30 daemon-tool mutations).

## 3. Frontend pack (rubric 3.D)

| Criterion | Status | Note |
|---|---|---|
| Design-token contrast valid light and dark | **have** | `tools/contrast_pass.py`, 34 pairs, exits non-zero on a required failure. Found and fixed two genuine AA failures in `--faded` on 2026-07-29 |
| Accessibility hard gate (axe-core, Lighthouse >= 95) | partial | The e2e/a11y domain measures it but is waived; 27 fail / 378 warn as of 2026-07-29 |
| prefers-reduced-motion hard gate | **have** | `tests/contract.test.ts` takes both branches, asserts `animate()` is never called when reduced, asserts it IS called when not (so a permanently broken helper cannot pass), and checks every `REDUCED()` call site is a guard rather than a discarded expression |
| prefers-color-scheme / forced-colors | partial | Both themes exist and are contrast-graded; forced-colors untested |
| Visual regression | gap | No `toHaveScreenshot`, no baseline |
| Performance budgets (LCP/INP/CLS, bundle size) | gap | None. The 135 KB inline script has no budget |
| Cross-browser matrix | gap | Chromium only |
| Keyboard operability, focus management | gap | Untested |

## 4. Agent pack (rubric 3.B), for the daemon

| Criterion | Status | Note |
|---|---|---|
| Guardrails / red-team on untrusted ingest | **have** | `tests/fuzz.test.ts`. Mandatory here per rubric 2.6 and previously absent |
| Prompt-as-code regression | partial | `tests/prompts.test.ts` (added 2026-08-29) pins the load-bearing clauses: refusal-to-presume ranked first, open_belief after confirmation with `from`, the four signal names matched against get_mistakes, thresholds matched against the client's MENTOR constants, the mentor's unconditional verifier pass. Behavioural evals against fixtures remain open |
| Eval control plane, pass@1 / pass^k | gap | No eval harness. The mentor's "ask before correcting" contract is enforced only by a runtime verifier pass, never measured |
| LLM-as-judge discipline | partial | The verifier pass is a judge with no calibration, no agreement measurement |
| Online evals / observability | gap | Nothing measures the mentor in use |

## 5. Maturity

**L2 managed**, per the rubric ladder. CI runs lint-equivalent, unit and some
integration; no eval harness is gated. Reaching **L3 defined** needs contract
tests, a gated a11y pass, and a regression suite that is more than one oracle.

## 6. Open items, in priority order

1. **Behavioural mentor evals (3.B).** The prompt clauses are pinned; whether
   the model obeys them is still only enforced by the runtime verifier pass,
   never measured against a fixture conversation set.
2. **Mutation for the client renderers (L4).** The deck, mentor, and daemon
   tool blocks are covered; the client renderers are not.
3. **Field performance budgets (L10).** Byte budgets exist; LCP/INP/CLS
   against the deployed site do not.
4. **Replayable daemon roundtrip (L7).** The Worker side runs hermetically;
   `/chat` against the SDK is still live-only.

### Closed 2026-08-30

5. **Daemon tool mutation (L4):** `tests/mutation.test.ts` daemon section:
   `GET_MISTAKES_MUTANTS` (8 planted defects in the four-signal classification,
   all killed) and `OPEN_BELIEF_MUTANTS` (6 planted defects in belief recording,
   all killed), each with a surviving control. Extracted the pure logic from
   `daemon/server.ts`, stripped TypeScript annotations, and ran through `new
   Function` against behavioural oracles.

### Closed 2026-08-29 (all four prior items, evidence in the hermetic slice)

1. **Replayable integration (L7):** `tests/worker.test.ts` runs the real
   `sadna-sync/worker.js` handler in-process over a stub KV. Running the
   single import-free module beat recording cassettes of it: a cassette pins
   yesterday's responses, this pins the handler itself. The live suite stays
   fail-closed per quality-contract.json.
2. **Prompt-as-code regression (3.B):** `tests/prompts.test.ts`, see section 4.
3. **Mutation beyond one block (L4):** `tests/mutation.test.ts` mentor section,
   9 planted defects killed, including the shipped suppression regression as a
   mutant, plus a surviving control.
4. **Performance budget (L10):** `tests/budget.test.ts`, byte budgets with the
   measured figure in the failure message, plus two install-integrity checks
   (every precached path exists; every precached path is SHIP-covered).

## 6a. Defect found by the contract layer, fixed

`schedulePush()` posted whole state with `fetch(...).catch(() => {})`. That
catches network failure only. A 413 over the Worker's 300 KB cap, or a 401 on a
stale key, RESOLVES normally, so a dead sync was indistinguishable from a healthy
one and could have stayed dead for weeks with no symptom on any surface. The
client now knows the cap (`SYNC_CAP`, asserted equal to the Worker's own 300000
in `sadna-sync/worker.js:16`), skips a push that is certain to be rejected, reads
`r.ok`, and surfaces the last failure on the home screen. This is exactly the
class of bug L6 exists to find: both sides were individually correct and disagreed
about what failure looked like.

## 7. Filed to lane B (claude-setup)

The gate has no domain for L2, L3, L4, L6 or L10, so everything in this file
above the line is invisible to `gate.py run` and stays advisory no matter how
good it gets. Filed as proposal rows in `tools/selfimprove/proposals.jsonl` on
2026-07-29 with the measured evidence, plus a section in
`docs/HANDOFF-FROM-LEARNING-2026-07-29.md`.

That handoff is the reason this file exists rather than a claim that testing is
handled: a project cannot gate itself against a rubric the gate does not know
about.
