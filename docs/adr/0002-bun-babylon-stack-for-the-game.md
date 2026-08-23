# ADR-0002: Bun toolchain + Babylon.js 9 for the game the site becomes

- **Status:** accepted (operator decision, recorded the same night)
- **Date:** 2026-08-24
- **Supersedes:** the "no bundler, no framework, no npm at the root"
  non-goal in AGENTS.md, which this ADR revokes deliberately rather than
  eroding silently.

## Context

The operator decided the site IS the game: הסדנה evolves into a full
incremental learning game (spine: City of Lamps, recorded in the local
design docs), with a real-time 3D world layer, mobile-first, at a modern
dynamic-lighting bar. The existing posture — one 139KB inline script, a
hand-rolled service worker, no typechecking, syntax-only gates — was
already at its own documented limits (AGENTS.md dates the inline-script
debt; the types gate's own contract calls itself parse-only), and a 3D
world layer cannot be hand-vendored into an inline script.

## Decision

- **Bun end-to-end.** Bun already runs this repo's tests, wrangler, and
  the teacher daemon. Its bundler takes index.html as the entrypoint
  directly, serves a dev server with HMR, and `bun build` produces the
  deploy artifact. No Vite, no webpack: one toolchain the repo already
  trusts.
- **Babylon.js 9 for the world layer.** Released 2026-03-31: clustered
  lighting, volumetric lighting, textured area lights, OpenPBR, WebGPU
  optimizations, WebGL2 fallback in the same build. WebGPU is on by
  default in iOS 26 Safari, so the lighting bar is a real phone target.
  The DOM keeps the content layer (RTL Hebrew lessons, quizzes): no
  engine renders Hebrew text better than the DOM, so the game is a
  hybrid, not an engine takeover.
- **TypeScript strict** for all new/migrated modules (the inline script
  is strangled out module by module, not rewritten).
- **Workbox** replaces the hand-rolled sw.js and its manual V-bump trap.
- **Playwright** is the e2e lane: a CI step and the identical local
  command (the fallback when GitHub Actions minutes run out). This
  removes the pipeline waiver's dependency on the private claude-setup
  repo's harness.
- **No UI framework in step one.** Svelte 5 is the named candidate if
  the DOM layer later earns a rewrite; adopting bundler and framework in
  one migration doubles the risk for no day-one gain.

## Alternatives rejected

- **Vite**: its edge was the plugin ecosystem; Bun's HTML-entrypoint
  bundler closes the gap and drops a dependency the repo never had.
- **Bevy/Rust to WASM**: strongest agent-authored-mechanics story, but
  browser WebGPU support is experimental (and excludes the WebGL2
  fallback in the same build), wasm payloads measured in the multiple MB
  hurt a phone PWA's boot, every touch of learner state crosses a
  wasm-bindgen boundary, and the compile loop is minutes where Bun's is
  milliseconds.
- **Three.js**: same browser lane as Babylon with more hand-assembly for
  PBR/lighting; Babylon 9's built-in clustered/volumetric stack is the
  point.
- **Staying no-bundler**: the game does not fit in an inline script, and
  the posture's offline-first rationale survives the change (Workbox is
  the industry's offline-first tool).

## Consequences

- AGENTS.md's non-goals section must be rewritten in the migration PR
  (P0); until then, this ADR is the authority on the conflict.
- The deploy contract moves from stage_site.py's allowlist of loose
  files to `bun build`'s output directory; stage_site.py's default-deny
  role (never publish docs/, state/, drafts) must be preserved in the
  new pipeline, not dropped.
- The sw.js V-bump rule dies with sw.js; until Workbox lands, it still
  binds.
- CSP tightens: bundled assets remove the need for 'unsafe-inline'
  script-src once the inline script is fully strangled.

## Falsifiers

- If `bun build`'s HTML-entrypoint pipeline cannot reproduce today's deploy
  (stage_site.py's default-deny posture, the _headers file, the vendored
  KaTeX/marked/DOMPurify assets) by the P0 exit, the Vite comparison reopens
  with that measured gap as the input.
- If Babylon 9's clustered/volumetric lighting cannot hold 60fps on a
  mid-range phone for the City of Lamps scene at P1, the fidelity bar drops
  first (fewer dynamic lights, baked fallbacks); the engine choice reopens
  only if the reduced bar still misses.
- If the world layer ever needs ECS-scale entity counts (thousands of
  simulated actors), Bevy is re-evaluated with numbers, per the taste
  ledger's own falsifier on the 1-or-4 fork.
