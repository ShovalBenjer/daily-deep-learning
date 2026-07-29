# Inbox

Drop anything here. No format required, no thinking required. One item per line.
The council digests this and routes each item; digested lines move to the log at
the bottom so the top stays empty.

Three kinds are recognised, by shape alone:

- A **link** on its own line. Paper, repo, article, video, anything.
- A **question**, meaning the line ends with a question mark. This is the
  important one: a question you ask is measured evidence of a gap, and it
  becomes a curriculum candidate rather than a note.
- **Anything else** is an idea, kept as a product or content note.

Optional: prefix a line with `!` to mark it urgent, or `#tag` anywhere to force
a subject. Neither is required.

## Open

<!-- append below this line. the council empties it. -->
!#design How do you build an interface a language model would never generate by default? Every model converges on the same few looks (cream-serif, dark-neon, riso data-journalism, dashboard-infographic); "distinctive" AI design is still inside that distribution. LOOP-ESCAPE FINDING (multi-persona analysis, 2026-07-29): the slop does NOT live in the palette. It lives in the connective prose (the "not X, it's Y" antithesis engine, which is the model's own voice) and the information architecture (re-representing the same content as stylized figures; even-length sections). Swapping to a fifth palette is the "new look, new name" trap. The genuine escape is content substitution: make the one un-fakeable material the spine (for that post, the human operator's verbatim one-line corrections; for the platform, the learner's own errors/answers), and demote the model's confident prose to the thing being corrected. Real artifacts (raw gifs, raw terminal output) cannot look generated and are denser than the figures that re-tell them. This directly sharpens DESIGN.md's "named direction, say it before you code": the direction must be owned and material-derived, not a generatable identity.
#a11y Designing by eye fails hard measurable checks: a hero number that "looked fine" measured 2.28:1 contrast (WCAG needs 3:1 large, 4.5:1 text). Add a WCAG contrast pass over every fg/bg pair to the gate-to-green; the math is ~15 lines and would convert some of the 46 fail / 382 warn from guesses to numbers.
#a11y shots.py (in ~/.claude/skills/case-ledger-post/) renders a page and audits horizontal overflow, content clipped inside an overflow:auto container, and elements stuck at opacity 0 while in the viewport, plus --measure for ancestor-width debugging. Most of these are invisible in the CSS and only appear in a render; wire it into the a11y gate.
#design The SOTA Subtle UI/UX psychology doc (work-docs/) empirically backs the Performed Interface: count-up numbers = "live data" dopamine, microinteractions resolve under 300ms, progressive disclosure in three visibility tiers, ambient pulse for status not popups, and the hard rule that motion must communicate a state change and never decorate (it explicitly warns against gratuitous loops and parallax as cognitive load). Fold the specific figures into DESIGN.md's motion contract.
#design A scroll-reveal that unobserves after firing leaves any section the observer misses (deep-link mid-page, fast flick scroll) invisible forever. Bulletproof pattern: threshold 0 + rootMargin, plus a load/scroll sweep that reveals anything at or above the viewport bottom. Directly relevant to the platform's scroll-driven animations.

https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills
https://arxiv.org/abs/2605.22791
! the talent tree still has no lines between nodes #design
is item response theory the right model for placement?


## Routed

<!-- the council moves digested items here with a date and a destination. -->
- 2026-07-29 `what does SSH actually stand for and what did it replace?` -> answered by `units/m0-ssh.md`. Secure Shell; replaced telnet, rlogin, rsh and FTP, all of which sent credentials in cleartext.
