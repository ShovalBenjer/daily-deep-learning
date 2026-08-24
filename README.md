# daily-deep-learning

הסדנה: a personal, single-user RTL Hebrew learning PWA, gadial-style,
phone-first. A daily Hebrew post (working through Stanford CS224R and MIT
6.S184 among other tracks) sits inside a larger workshop: a 2D talent board, a
judgment map, a research ladder, quizzes, a teacher chat, and discoveries. Open
it on the iPhone, Share, Add to Home Screen, and it behaves like an app,
offline included.

## Structure

- `index.html`: the whole app in one inline-script hash-router SPA (post list,
  markdown via marked, math via KaTeX, board, ladder, chat, dark theme). No
  build step, no bundler, no root package.json.
- `posts/YYYY-MM-DD.md`, `posts/index.json`: daily posts and their manifest.
- `corpus/`: teacher-doc source rendered at the /#/doc routes.
- Root JSON (talents, concepts, skills, discoveries, research_ladder,
  judgment_map, syllabus, course_plan): the board and view data.
- `vendor/`: local KaTeX, marked, DOMPurify, and KaTeX fonts, so the app runs
  its libraries with no runtime CDN.
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA shell (offline, home screen).
- `daemon/`, `sadna-sync/`: the author-machine Bun daemon and the Cloudflare
  Worker that back sync and teacher chat over a quick tunnel.
- `ROUTINE.md`: the contract the scheduled daily agent follows.
- `DESIGN.md`: the visual and type system.
- `e2e/`: the self-contained Playwright lane (boot/render/interaction plus
  axe accessibility over the six routes, phone-sized viewport). Same command
  locally and in CI: `cd e2e && bun install && bun x playwright test`. This
  lane replaced the private-harness dependency that kept the e2e, a11y and
  pipeline gate waivers alive; the quality contract now carries none.
- `game/`: the City of Lamps POC (ADR-0002 stack: Bun + Babylon 9 +
  DuckDB-WASM). A night street of drill lamps; each opens a story-driven SQL
  or fraud-decisioning drill graded against a reference query run on the same
  in-browser database. Lamp brightness is live FSRS retrievability (ts-fsrs):
  a dimming lamp IS a due review; passes earn stability-days that bank into
  embers at end-of-shift, and an already-bright lamp earns nothing, so the
  economy cannot be farmed. The hired lamplighter (earned automation)
  refreshes the weakest lamp once per real day. `cd game && bun install && bun serve.ts` to play
  (serve.ts also serves the local study bank, which the bare HTML dev server
  cannot);
  `python3 game/tools/build_bank.py` builds the local, gitignored book-excerpt
  study bank. Not deployed: the Pages allowlist does not ship it.

For a full file-by-file and directory-by-directory map, plus the library and
CSP self-audit, see `docs/CODEBASE-MAP.md`. For gate status and the path to
green, see `docs/PLAN-GATE-TO-GREEN-2026-07-25.md`.

## Local preview

Any static server, e.g. `python -m http.server 8080`, then
http://localhost:8080. Note: a local server does not apply `_headers` (CSP), so
header-dependent behavior only shows on the deployed site.

## Deploy

Cloudflare Pages, project `daily-deep-learning`. Deploy the STAGED directory,
never the repo root: Pages has no ignore-file mechanism, so `pages deploy .`
publishes `docs/`, `state/` and `writing/drafts/`.

```
python tools/stage_site.py dist
bun x wrangler pages deploy dist --project-name daily-deep-learning
```

(needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment).
Pushes to `main` also deploy via the GitHub Action in `.github/workflows/`,
which runs the same stager. `tools/stage_site.py` carries the allowlist: a new
runtime asset must be named in `SHIP` or the deployed app 404s on it.

## Daily engine

A scheduled agent runs each morning (06:00 Asia/Jerusalem), follows
`ROUTINE.md`, commits the new post, and the deploy pipeline republishes.
