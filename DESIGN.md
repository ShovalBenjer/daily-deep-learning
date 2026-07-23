# DESIGN.md — the binding style contract of הסדנה

Status: BINDING. Every UI change (human or agent) obeys this file or updates it
first. This is the "lock-in" artifact: slop happens when each screen re-decides;
here the deciding is done once. Research basis:
docs/DESIGN-RESEARCH-NEXTGEN-2026-07.md (28 sourced claims). Approved direction
(operator, 2026-07-23): Performed Interface + Illustrated Academy ("B then A").

## The named direction (say it before you code)

**An illuminated workshop ledger in a game academy.** Tactile maximalism, not
glass. A scribe's desk: parchment, ink, gold line-work, wax seals, one living
spark. Every event is performed like a game, never announced like a website.
If a new surface can't be described in this fiction's language, it isn't
designed yet.

## Fiction map (diegetic taxonomy — classify every element)

| Element | Class | Treatment |
|---|---|---|
| Daily page | Diegetic (a ledger) | stitched binding, day-stamp chip, seal-marked sections |
| Section marks | Diegetic (wax seals) | rotated medallion, rubricated letter |
| Panel frames | Diegetic (goldsmith frames) | bespoke 9-slice, assets/ui/frame-*.svg |
| הניצוץ mascot | Spatial (inhabits the chrome) | lantern-spark; idle flicker, glad flare, dim tilt |
| Tabs, XP bar | Non-diegetic chrome | QUIET; glyph language, no drama |
| Shake on miss, streak-tier aura | Meta | body feels it; reduced-motion gated |
| Quiz/fillin/widgets | Diegetic (exercises in the ledger) | framed, performed feedback |

## Tokens (the single source is style.css :root — never invent inline)

- Ground `--bg #0f0d14`, panels `--panel/--panel-2`, ink `--ink #e7dcc2`,
  gold `--gold #c9a86a` / `--gold-hi #e8c988`, states green/red, trees
  oracle/architect/warden.
- Rarity ramp `--r0..--r4` = LEVELS ONLY (gray→green→blue→violet→gold).
  Color is grammar, never decoration.
- Type voices: Frank Ruhl Libre serif (display, ENGRAVED via --engrave-lo/hi;
  body); IBM Plex Mono for data/code. No third voice.
- Texture: film grain overlay (--grain-op) + baked feTurbulence parchment on
  framed surfaces. Texture over translucency, always.

## Motion contract (the Performed Interface)

1. ONE spring family: `--ease-spring` / JS `SPRING`. No other easings for
   entrances/settles (ease-out allowed for exits/fades only).
2. Events are PERFORMED: motion + counted numbers + particles (+ sound later)
   fired together, scaled by magnitude (`award()` → burst size + ptsFloat).
3. ONE fixed celebration ritual (`ritual()`); magnitude lives in the frame
   tier (`#overlay[data-tier]`, streak tiers 3/7/14/30). Never a second ritual.
4. Squash-stretch on every tappable; wrong answers shake; the spark reacts.
5. Everything gated on `prefers-reduced-motion`. No exceptions.

## Frames and assets

- Bespoke 9-slice frames: assets/ui/frame-plate(.light).svg (11px slice 24),
  frame-hero(.light).svg (14px slice 28). Extend by editing the generator
  pattern (goldsmith line-work: stepped brackets, diamond studs, rosettes on
  hero). New panel kinds reuse these; a new frame file needs a reason.
- Glyphs: one inline SVG sprite (#g-today/map/kodex/discover/ladder), stroke
  currentColor 1.7. New icons join the sprite in the same line language.
- Imagery: NO stock photos ever. Widgets, hand-authored SVG diagrams, and the
  frame/seal/spark language ARE the imagery.

## The avoid-list (named bans — Anthropic distributional-convergence fix)

Inter/Roboto/system-default display type · purple→blue gradients · glass
(backdrop-blur) as identity · uniform 16px radius cards · identical clone-card
grids · emoji as icons · stock photos · scattered random micro-interactions ·
decorative color · centered hero with vague copy · gradient banner headers.
These are the statistical defaults; naming them is what keeps them out.

## Process for ANY new UI surface (agents included)

1. Name the aesthetic direction in the fiction's language BEFORE coding.
2. Pull 3-5 reference screenshots (gameuidatabase.com / interfaceingame.com,
   not Dribbble) and say what technique each contributes.
3. Classify the element in the fiction map (diegetic/spatial/non-diegetic/meta).
4. Use the installed `frontend-design` skill for the pass; obey tokens; obey
   the motion contract.
5. Verify on the live site (CDP + screenshot at 390px), then LOCK the result
   back into this file if it added a pattern.
6. Wireframe function first (where things go), polish second.

## Rejection history (why this file exists)

Five rejected passes (slop-merge, non-WoW tree, compressed feel, generic-AI,
"lame" material pass) all shared one failure: decoration without fiction,
increments without an anchor. The operator's own corpus called it: "design
vocabulary anchored to something real", "gradient buttons scream template".
This file is the anchor.
