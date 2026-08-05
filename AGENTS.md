# AGENTS.md

This file provides single-authority guidance to AI agents (Claude, Codex, etc.) working in this repository. CLAUDE.md is an @AGENTS.md include.

## What this is

הסדנה: a single-user, RTL Hebrew, phone-first learning PWA deployed as a static
Cloudflare Pages site (daily-deep-learning.pages.dev). One operator, one learner.
A scheduled agent writes a daily Hebrew lesson; the app turns fenced JSON blocks
inside that markdown into live quizzes, fill-ins and canvas widgets, awards XP
into a three-tree talent board, and syncs learner state through a Cloudflare
Worker. There is no bundler, no framework, and no root `package.json` by design.

## Commands

```bash
# serve locally (this is what the gate's app.url expects to be already up)
python -m http.server 8080

# content-graph integrity: the one check CI actually runs before deploy
python tools/validate_links.py

# syntax sweep (the "types" gate domain; there is no typecheck or lint config)
node --check sw.js && python tools/check_inline_js.py && python -m compileall -q tools

# boundary tests (bun). NOT hermetic: hits the LIVE Worker and localhost:8788
bun test tests/boundaries.test.ts
bun test tests/boundaries.test.ts -t "worker: POST oversize"   # single test

# teacher daemon (required by 4 of the 10 boundary tests, and by in-app chat)
cd daemon && bun run server.ts

# full quality gate (external, in claude-setup). RUN FROM POWERSHELL, NOT GIT BASH
python C:/Users/shova/claude-setup/tools/gate/gate.py run --project .

# screenshot the live or local site over CDP (Chrome must already be running)
python tools/cdp.py http://localhost:8080 shots/local
python tools/measure_shots.py shots/local      # route height in phone screens

# manual deploy (pushes to main also deploy via .github/workflows/deploy.yml)
bun x wrangler pages deploy . --project-name daily-deep-learning
```

Git Bash mangles a bare `/` route argument into a Windows path before the e2e
harness sees it, which surfaces as a bogus websocket failure. Reproduced three
times; use PowerShell for anything that passes routes as arguments.

## Architecture

**One file is the app.** `index.html` (~2079 lines) holds a ~113 KB inline
`<script>` that is the entire client: state store, hash router, all view
renderers, the quiz/fillin/widget builders, the SRS engine, the talent board and
the chat pane. `boot()` runs `Promise.allSettled` over nine root JSON files, so
each data source degrades independently and only `posts/index.json` is required.
`route()` dispatches `#/map`, `#/ladder`, `#/kodex`, `#/discover`, `#/doc/{slug}`,
`#/YYYY-MM-DD`, and otherwise renders today's post or the newest one.

**Content is markdown plus fenced JSON.** `posts/YYYY-MM-DD.md` carries five
`##` sections with exact Hebrew prefixes the UI keys on (עיון, תרגול, AI-103,
מעקב, שיקול דעת). `upgradeBlocks()` replaces ` ```quiz `, ` ```fillin `,
` ```widget ` and ` ```concepts ` fences with live components. Correct answers
call `award(tree, pts, ...)`, which is what feeds the board, so the `tree` field
in a block decides where points land. Full authoring contract: `ROUTINE.md`.

**The data graph is the product model.** `talents.json` (nodes, tiers, ranks,
quests), `skills.json` (0-5 mastery ledger, `resume_risk`, per-arm tags),
`concepts.json` (codex graph), `syllabus.json` (day spine), `course_plan.json`
(seasons, topic pools, scan sources), `judgment_map.json`, `research_ladder.json`,
`discoveries.json`. Ids cross-reference between files; `tools/validate_links.py`
is the only thing preventing orphans and it runs in CI, so any data edit should
be followed by it.

**State crosses a network boundary twice.** The browser keeps state in
`localStorage` under `sadna-state` and pushes it to the `sadna-sync` Cloudflare
Worker (`sadna-sync/worker.js`, bearer `SYNC_KEY`, single KV key, 300 KB cap).
The daily generator reads that same state to personalize the next lesson. The
in-app teacher posts to a Bun daemon (`daemon/server.ts`, Claude Agent SDK,
custom tools `get_state` / `get_today_page` / `save_note`) reached over a
cloudflared quick tunnel whose URL the daemon registers into sync state. The
daemon's bearer key lives in `daemon/.key`, gitignored, and the boundary tests
read it directly.

**Service worker.** `sw.js` precaches the shell and vendored libraries, serves
data files fresh and the shell network-first. Its cache constant `V` must be
bumped when shell assets change or phones keep the old build.

## Contracts that bind before you edit

- `DESIGN.md` — BINDING for every UI change. Name the direction in the fiction's
  language first, classify the element in the fiction map, obey the tokens in
  `style.css :root`, one spring family, everything reduced-motion gated. The
  avoid-list is explicit and is the point of the file.
- `ROUTINE.md` — the daily generator's contract: slot rules, personalization
  from learner state, per-section structure and word budgets, block JSON shapes,
  index/syllabus/concepts updates, the commit format.
- `docs/REQUIREMENTS-OF-RECORD-2026-07-26.md` — R1..R38, the operator's own
  words with MET/PARTIAL/UNMET status. This is the requirement source; do not
  invent product requirements next to it.
- `docs/ENGINEERING-STANDARDS-2026-07-26.md` — stack justification, Google-style
  docstrings with Purpose/Contracts/Agent-context, size budgets (function target
  20, hard 50), the measured gap table and its fix order.
- `docs/CODEBASE-MAP.md` — line-cited file map, kept current.
- `quality-contract.json` — what each gate domain runs and why, with the evidence
  from the run that produced it. Read the `_comment` fields before trusting or
  changing a domain.
- `docs/PRODUCT-MODEL-2026-07-26.md` and `docs/SYSTEM-SPEC-2026-07-26.md` are
  SPECIFIED, not built. Do not read them as descriptions of running code.

## Non-goals (stated so they stop being re-proposed)

No bundler, no framework, no npm at the root: a build step regresses the
offline-first posture. No native app, no multi-user, no auth beyond the existing
bearer keys, no server-side rendering. Libraries are vendored into `vendor/`
(KaTeX, marked, DOMPurify plus fonts) rather than loaded from a CDN.

## Known traps

- **Deploy the staged tree, never the repo root.** `wrangler pages deploy` has
  no ignore-file mechanism, so `pages deploy .` publishes `docs/`, `state/` and
  `writing/drafts/`. `tools/stage_site.py` builds `dist/` from a default-deny
  allowlist (`SHIP`) and exits non-zero if a forbidden path reaches it; both
  workflows run it. A new runtime asset must be added to `SHIP` or the deployed
  app 404s on it.
- **The GitHub remote is PUBLIC**, and the Pages allowlist does not protect it.
  Anything committed is published on github.com/ShovalBenjer/daily-deep-learning
  regardless of what the site serves. Planning documents under `docs/` are
  deliberately untracked for this reason. Never commit personal data (grades,
  transcripts, PII, private message drafts), and never commit a document that
  enumerates security exposure in other repositories.
- **The gate depends on untracked files.** `git ls-files tools/` returns 7 of the
  15 scripts present; `tools/check_inline_js.py` is required by the types domain
  and is not tracked, so CI cannot reproduce that domain today.
- **The local server does not apply `_headers`.** CSP and the security headers
  are only real on a deploy, so header-dependent behavior cannot be verified at
  localhost:8080.
- **`tree3d.js` is dead.** Nothing loads it; its only footholds are the `sw.js`
  precache list and the types gate, and its jsdelivr import is the sole reason
  CSP allows jsdelivr.
- **Known, dated debt:** the 113 KB inline script exceeds every module budget.
  Splitting it needs either the rejected bundler or ES modules, which changes
  the CSP and service-worker story.
- **Content style:** Hebrew body with English technical nouns, inline Hebrew
  gloss on first use, no em-dash or en-dash, no emoji, KaTeX delimiters `\(...\)`
  and `\[...\]` and never bare `$`. No stock photos anywhere in the product.
- Never edit past posts. A day's file is written once; if
  `posts/YYYY-MM-DD.md` exists the generator stops and changes nothing.
