# הסדנה — Full Enhancement Plan (2026-07-22)

Status: plan of record. Consolidates every discovery of the 07-20→07-22 build arc
plus the full Drive research corpus (all 18 docs now read). Each item is traced
to its source. Effort: S (<2h), M (half-day), L (own session). Stages: NOW
(this week), NEXT (weeks 2-4), BREAK (season retro week), CONT (continuous).

## Product thesis (unchanged, sharpened)

One continual learning system that learns you back: daily self-contained
lessons feed a knowledge codex and a talent economy; your performance feeds
tomorrow's page; everything serves the hire-by-30/09 arc first and a
years-long mastery climb after. Differentiators vs. Recall/market: teaching
depth, native interactivity, adaptive generation, honest metrics, zero
marginal cost.

## A. Content Engine

| # | Item | Source | Effort | Stage |
|---|---|---|---|---|
| A1 | Signal cards in מעקב: what/why/impact 0-5/verdict (עקוב-נסה-התעלם)/"try in 10 min" + my-stack line | GithubSignals + his intelligence-agent spec | S | NOW |
| A2 | Signal→Quest converter: high-impact signal becomes a same-day 15-min hands-on micro-quest | GithubSignals arc | M | NEXT |
| A3 | Widget catalog growth: bandit, distribution-sampler, value-iteration, policy-race | Course needs + widget-request channel | M | NEXT |
| A4 | algviz recipes: sorting, BFS/DFS-grid, gridworld value-iteration, PG-update | VisuAlgo reel | M | NEXT |
| A5 | Transcript→Lesson pipeline: council converts the cato lectures (digital-twin identity, MCP gateway, skills marketplace, memory contracts, generator+verifier loops) into a lesson module "ארכיטקטורת סוכנים ארגונית" | cato transcripts (papers 7-8) | L | BREAK |
| A6 | Hyperframes media: nightly 30s recap reel; per-day cover art; later audio lessons | hyperframes repo + Recall audio | L | BREAK |
| A7 | Authored-SVG diagram per עיון enforced by critic | UI research + no-stock rule | S | NOW |

## B. Knowledge System (הקודקס)

| # | Item | Source | Effort | Stage |
|---|---|---|---|---|
| B1 | Mastery dimensions per concept, auto-derived: recognize=quiz-hit, explain=teacher-graded, apply=drill/quest, connect=graph edges, challenge=judgment-hit | Living Codex §6 | M | NEXT |
| B2 | Spaced-forever engine: review queue with 2/7/21/60d intervals across all seasons, feeding raids and the player | Learning Stack + lifecycle | M | NEXT |
| B3 | Graph analytics: cluster cohesion on the concept graph; flag fragile (heterophilic, low-mastery) clusters for Sunday repair | computer sciene t (spectral methods) | M | BREAK |
| B4 | Notes→Concepts promotion: saved teacher notes suggest new codex entries ([[links]] in lessons) | Recall connections | S | NEXT |

## C. Assessment Integrity ("metrify me", the honesty layer)

| # | Item | Source | Effort | Stage |
|---|---|---|---|---|
| C1 | Min-n rules everywhere: no "weakest tree" under n<10 answers; no mastery claim under n<5 per concept; masked cells fall back to defaults | samples doc (≥50/cell rule) | S | NOW |
| C2 | G-Eval graded free-text in teacher with bias-corrected judge + a 50-example human calibration set (his labels) | Learning Stack + Wiley grill | L | NEXT |
| C3 | Verifier second-pass on every mock-interview grade (generator+verifier loop); disagreement → show both | agentic_creativity + cato 1-1 | M | NEXT |
| C4 | Test-retest + per-dimension audit trail on grading; temperature pinned; κ>0.6 target vs his own spot-labels | Wiley grill | M | BREAK |
| C5 | Uncertainty-routed compute: low-confidence/high-stakes grading escalates reasoning effort; easy paths stay cheap | agentic_creativity (budgeted search) | S | NEXT |

## D. Game & Motivation

| # | Item | Source | Effort | Stage |
|---|---|---|---|---|
| D1 | Economy tuning pass: point income vs rank costs vs 70-day arc; seasonal rank titles (Initiate→Keeper) | Living Codex ranks | S | NEXT |
| D2 | WoW art polish: per-domain engraved icon art, tree background scenes, maxed-node flourish | WoW anatomy ask | M | BREAK |
| D3 | 3D tree scene done properly with the graphics skills repo (branches ignite as ranks fill) | scottstts repo | L | BREAK |
| D4 | Flavor layer: named in-product agents (המורה, המבקר, המועצה) with visible "reputation" from their track record | contracts doc (EIP-8004 flavor) | S | BREAK |

## E. Agentic Infrastructure

| # | Item | Source | Effort | Stage |
|---|---|---|---|---|
| E1 | Daemon → full Agent SDK: tools read_state, grade_with_verifier, inject_quiz, save_note, deepen_lesson | PRODUCT-SPEC §6 | L | NEXT |
| E2 | Hardening: named tunnel + CF Access, daemon rate-limit, key rotation path | self-audit | M | NEXT |
| E3 | Cloud lane: read the probe session log (his 30s) → fix or formally retire; local lane stays primary | lane investigation | S | NOW |
| E4 | Council v2: gws Drive scope (his one-time consent), transcript ingestion, season proposals | corpus loop | S | NOW |
| E5 | Monthly adversarial agent: red-teams generator/critic/teacher prompts for loopholes (Metalhead pattern); findings become fixes | contracts doc | M | CONT |
| E6 | Quarantine formalized: any lane failing 2 consecutive days is flagged on the page header until green | contracts doc (sim quarantine) + lane flip | S | NEXT |
| E7 | Chat "thinking" status: rotating verbs + elapsed timer while the daemon works | terminal doc | S | NOW |

## F. Hire Engine Alignment (until 30/09 this outranks everything)

| # | Item | Source | Effort | Stage |
|---|---|---|---|---|
| F1 | Mock-interview protocol in teacher: weekly cadence, rubric with dimensions, verifier pass, κ-tracked | interview phase + Wiley grill | M | NOW |
| F2 | STAR bank: 8 stories generated from PROJECTS-MANIFEST + cato architecture material, drilled via spaced review | corpus | S | NOW |
| F3 | Weekly system-design rep grown from שיקול דעת scenarios (45-min guided) | curriculum decision trees | S | NEXT |
| F4 | Public signals feed (approval-gated per post) — positioning while learning | GithubSignals | M | BREAK |
| F5 | AI-103 sat by ~15/09; cert lane continues AZ-104 in season 2 | tracker + lifecycle | — | CONT |

## G. Platform Polish (Recall backlog)

| # | Item | Source | Effort | Stage |
|---|---|---|---|---|
| G1 | Day covers + tags; library feel for the archive | Recall home | M | BREAK |
| G2 | Audio playback of lessons (daemon TTS or hyperframes track) | Recall notebook audio | L | BREAK |
| G3 | Share Challenge: sharable quiz links | Recall quiz | M | later |
| G4 | Global search (posts+concepts+ladder) | Recall search | M | NEXT |

## H. Season-2+ Curriculum (council proposes ~day 60, he picks)

1. **המצע המתמטי** — Kolmogorov/MDL, PAC + CoT-information, Rademacher,
   wavelets, information geometry (computer sciene t) — pairs beautifully with
   season-1 RL.
2. **ארכיטקטורת סוכנים ארגונית** — the cato module (A5) + MCP/A2A + memory
   contracts + verification loops; doubles as interview prep.
3. **חזית הסוכנים** — agentic_creativity report + ladder papers (RM,
   omega-regular, Panini, ALMA) as a research-reading season.

## Sequencing summary

- **NOW**: A1, A7, C1, E3, E4, E7, F1, F2
- **NEXT**: A2-A4, B1, B2, B4, C2, C3, C5, D1, E1, E2, E6, F3, G4
- **BREAK** (retro week ~28/09, post-hire-push): A5, A6, B3, C4, D2-D4, F4, G1, G2
- **CONT**: E5, F5, council, economy tuning

## Addendum 2026-07-22 late: external audit adopted (GPT review)

The independent audit's P0s were implemented same-day: markdown sanitization
(DOMPurify, vendored) + CSP `_headers`; daemon on the Agent SDK with tool
allowlists, zero-tool verifier, rate limit, input caps; the REINFORCE baseline
order bug fixed in day 2; the storage judgment rewritten reasoning-first (rule
softened in judgment_map); AI-103 claims de-categoricalized + practice-
assessment removed + verified-dates added; streak now counts completed days
only; ranks relabeled investment-vs-evidence; honest tiered time commitment
(12/40/90) with per-section estimates; 5-tab grid nav for 375px; dialogs get
role/aria/Escape; boot degrades per-resource; graph capped pending worker.
ADOPTED DISCIPLINE: until 30/09, BREAK-stage items (3D, reels, audio, public
feed, graph analytics) are frozen; the daily ritual + interviews + AI-103 +
one portfolio project outrank everything. Remaining from the audit, scheduled:
scoped separate tokens + named tunnel + CF Access (E2), evidence-based mastery
(B1), tiered lesson paths as structure (not just copy), module split + unit
tests, content-validation/expiry automation, canvas keyboard alternatives.
Pushbacks recorded: five parallel sections stay (his own spec) but with time
chips now and collapsible secondary streams next; purchased ranks stay as the
agency mechanic per the Living Codex spec, relabeled honestly.

## Standing laws (from the whole arc, non-negotiable)

References are literal specs. Excavate before building. No stock imagery, no
unanchored palettes. Screenshot-verify every surface on real Chrome. Min-n
before metric claims. Never fabricate signals/links/paper statuses. The page
is the only mandatory ritual; everything else serves it.
