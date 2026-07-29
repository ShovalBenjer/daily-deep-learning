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
| L4 mutation | partial 0.5 | `tests/mutation.test.ts:MUTANTS`, 8 planted defects, all killed, plus a control mutant that must survive | Covers the deck/seed block ONLY. `mentorQueue`, the daemon tools and the client renderers have no mutation coverage |
| L5 component | gap 0 | none | No Testing Library, no Storybook. Renderers are only exercised through e2e |
| L6 contract | gap 0 | none | Three hops, zero contract tests. See open item 1 |
| L7 integration | partial 0.5 | `tests/boundaries.test.ts`, 10 tests | NOT replayable. Hits the LIVE production Worker and a local daemon. The rubric calls replayability mandatory; there are no cassettes |
| L8 e2e | partial 0.5 | e2e domain, waived to 2026-08-05 | Harness works; two dead toggles are real failures |
| L9 golden/regression | partial 0.5 | one proven regression oracle (`tests/mentor.test.ts`, belief suppression, shown to fail against the pre-fix logic) | No snapshot or visual baseline. Not every past bug became a test |
| L10 non-functional | gap 0 | `perf` domain is N/A, no budget exists | Prod-deployed with no LCP/INP/CLS budget, no load, no chaos |

**Layer score: 6.0 / 11 applicable = 0.55.**

## 3. Frontend pack (rubric 3.D)

| Criterion | Status | Note |
|---|---|---|
| Design-token contrast valid light and dark | **have** | `tools/contrast_pass.py`, 34 pairs, exits non-zero on a required failure. Found and fixed two genuine AA failures in `--faded` on 2026-07-29 |
| Accessibility hard gate (axe-core, Lighthouse >= 95) | partial | The e2e/a11y domain measures it but is waived; 27 fail / 378 warn as of 2026-07-29 |
| prefers-reduced-motion hard gate | **gap** | `REDUCED()` is checked throughout `index.html` and nothing tests it. Every animation is gated on a branch no test exercises |
| prefers-color-scheme / forced-colors | partial | Both themes exist and are contrast-graded; forced-colors untested |
| Visual regression | gap | No `toHaveScreenshot`, no baseline |
| Performance budgets (LCP/INP/CLS, bundle size) | gap | None. The 135 KB inline script has no budget |
| Cross-browser matrix | gap | Chromium only |
| Keyboard operability, focus management | gap | Untested |

## 4. Agent pack (rubric 3.B), for the daemon

| Criterion | Status | Note |
|---|---|---|
| Guardrails / red-team on untrusted ingest | **have** | `tests/fuzz.test.ts`. Mandatory here per rubric 2.6 and previously absent |
| Prompt-as-code regression | gap | `MENTOR` and `SYSTEM` prompts are load-bearing and untested. Changing one silently changes behaviour |
| Eval control plane, pass@1 / pass^k | gap | No eval harness. The mentor's "ask before correcting" contract is enforced only by a runtime verifier pass, never measured |
| LLM-as-judge discipline | partial | The verifier pass is a judge with no calibration, no agreement measurement |
| Online evals / observability | gap | Nothing measures the mentor in use |

## 5. Maturity

**L2 managed**, per the rubric ladder. CI runs lint-equivalent, unit and some
integration; no eval harness is gated. Reaching **L3 defined** needs contract
tests, a gated a11y pass, and a regression suite that is more than one oracle.

## 6. Open items, in priority order

1. **Contract tests (L6).** Three hops, no contract. The browser posts a shape to
   the daemon and another to the Worker; the Worker enforces a 300 KB cap and a
   bearer; the daemon now declares its shape in `daemon/server_parse.ts`. Nothing
   asserts the client and server agree. A field rename ships green.
2. **Replayable integration (L7).** `tests/boundaries.test.ts` mutates LIVE
   production state to test. It self-restores, and that is one bug away from not
   restoring. Record cassettes.
3. **prefers-reduced-motion (3.D hard gate).** A branch that gates every
   animation in the product and is never taken in any test.
4. **Prompt-as-code regression (3.B).** Pin the mentor's refusal-to-presume
   behaviour to a fixture set so a prompt edit that breaks it fails a test rather
   than a conversation.
5. **Mutation beyond one block (L4).** `mentorQueue` decides what the learner is
   told about their own mistakes and has no mutation coverage.
6. **Performance budget (L10).** Prod-deployed, 135 KB inline script, no budget.

## 7. Filed to lane B (claude-setup)

The gate has no domain for L2, L3, L4, L6 or L10, so everything in this file
above the line is invisible to `gate.py run` and stays advisory no matter how
good it gets. Filed as proposal rows in `tools/selfimprove/proposals.jsonl` on
2026-07-29 with the measured evidence, plus a section in
`docs/HANDOFF-FROM-LEARNING-2026-07-29.md`.

That handoff is the reason this file exists rather than a claim that testing is
handled: a project cannot gate itself against a rubric the gate does not know
about.
