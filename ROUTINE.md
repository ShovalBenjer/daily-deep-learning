# ROUTINE.md - contract for the daily page generator (הסדנה)

One run = one new post + one index update + one commit. Run: 06:00 Asia/Jerusalem.

## 0. Lifecycle: this system does not end at day 70

הסדנה is CONTINUAL. Time is organized as SEASONS of 10 weeks with a retro week
between. Five streams are permanent across all seasons:
1. עיון: the deep-course spine ROTATES per season (season 1: Deep RL + Flow
   Matching). 2. תרגול: craft forever. 3. הסמכות: cert lane AI-103 -> AZ-104 ->
   AZ-400. 4. מעקב: signals + corpus, forever. 5. שיקול דעת: the 17-domain
   judgment map, a multi-year climb.
- The syllabus SOURCE is the living corpus: the Drive folder in
  course_plan.json -> lifecycle.corpus (mirrored locally at
  new-recruit/Perplexity research). corpus_manifest.json records what has been
  ingested. A weekly COUNCIL (Sunday morning, separate run) diffs the folder,
  ingests new docs into topic_pools / ladder / paper-card queue / judgment
  scenarios, and updates the manifest.
- The spaced-review pool GROWS FOREVER: Saturday raids draw from the entire
  history (all seasons) with widening intervals (2d / 7d / 21d / 60d), not
  just the current week.
- Season transition (after day 70): a retro week of synthesis pages and a
  full-history raid; propose 3 next-season spines from the corpus + goals;
  Shoval picks; append the new season to course_plan.seasons and continue.
  Day numbering continues (day 71, 72, ...) - the streak never resets.

## 1. Slot

- `day_number` = days since 2026-07-21 (day 1). `week` = ceil(day_number/7), cap 10.
- Mon-Fri: normal day; the week's lecture (course_plan.json -> week_plan) advances
  in sequential parts across the week's normal days.
- Saturday: retrieval day. No new material; 5-7 spaced-recall challenges over this
  week's pages, answers in `<details>`.
- Sunday: repair day. Weekly synthesis + Feynman re-teach of the week's weakest
  concept + bridge to next week.
- Idempotency: if `posts/YYYY-MM-DD.md` exists, STOP, change nothing.
- Verify lecture titles against the playlists; follow reality, note deviations.

## 1b. Read the learner state (this is what makes the page personal)

GET the sync endpoint (URL + bearer key are provided in your run instructions).
It returns the learner's full state: `answers` (per block id: ok, attempts,
conf 0-100, tree, date), `points`, `ranks`, `ladder`, `read`. If unreachable,
generate without personalization and say so in one line at the top.

Adaptation rules, applied every run:
1. **Resurface**: any answer with ok=false OR conf<50 from 2 days ago and from
   7 days ago -> write a NEW quiz on the same concept (rephrased, new id,
   same tree) inside the matching section. 1-3 resurfaces per day, oldest first.
2. **Target weakness**: שיקול דעת picks its domain from the tree with the
   lowest first-try accuracy (min 3 answers); tie -> lowest total points.
3. **Coverage**: new quiz topics come from course_plan.json -> topic_pools,
   preferring topics that never appeared in any previous post (grep posts/).
4. **Depth by level**: total earned points -> level thresholds
   0/10/25/45/70/100/140/190/250/320 (levels 1-10). Levels 1-3: intuition and
   use; 4-6: add proof sketches and failure modes; 7-10: wire in a 2025-26
   paper. State the level you generated for in the opening line.
5. **One thread**: the page has ONE central concept; עיון teaches it, תרגול
   implements it, שיקול דעת decides with it when possible; AI-103 ends with one
   bridge line to the thread. Five unrelated sections = defect.

## 2. Page structure (exact)

File `posts/YYYY-MM-DD.md`. Hebrew content, technical nouns English. Section
headings are `##` with these EXACT Hebrew prefixes before the colon (the UI keys
on them); `###` only inside sections:

```
# בוקר טוב YYYY-MM-DD! <כותרת>
<שורת פתיחה אחת>
## עיון: <תת-כותרת>
## תרגול: <תת-כותרת>
## AI-103: <תת-כותרת>
## מעקב: <תת-כותרת>
## שיקול דעת: <תת-כותרת>
<שורת סיום: לימוד פורה. מה דעתכם על זה?>
```

## 2b. Interactive blocks (the UI turns these into live components)

Two fenced-block kinds, each a SINGLE LINE of valid JSON inside the fence:

    ```quiz
    {"id":"dN-...-qK","tree":"systems|craft|ops","q":"...","options":["...","...","...","..."],"answer":0,"explain":"..."}
    ```

    ```fillin
    {"id":"dN-...","tree":"...","prompt":"...","answer":"...","alt":["..."],"explain":"..."}
    ```

A third kind, `widget`, mounts an EXPLORABLE or MICRO-GAME from the app's
catalog (the interactive IS the lesson; prose supports it):

    ```widget
    {"type":"decay","gamma":0.9,"title":"..."}
    ```

Catalog today: `decay` (discount-factor explorable: bars, sum, effective
horizon), `gridworld` (playable MDP: goal/trap/step-cost, live discounted
return), `algviz` (WATCH-THE-ALGORITHM player, the VisuAlgo pattern: state
canvas + pseudocode with the current line highlighted + play/step/speed;
`{"type":"algviz","algo":"<recipe>", ...params}`; recipes available:
`binary-search` (params arr, target), `returns-backward` (params rewards[],
gamma)). Every עיון SHOULD open or close with one widget when the day's
concept fits one, and every drill whose algorithm has an algviz recipe SHOULD
embed it; if the catalog lacks a fitting widget or recipe, note it at the end
of the post as `<!-- widget-request: <type>: <one line spec> -->` so it gets
built. When the day's drill maps to a classic DSA algorithm, also link the
matching visualizer page on https://visualgo.net as enrichment.

Imagery rule: NO stock photos, ever. The page's imagery is (a) the widgets,
(b) ONE hand-authored inline `<svg>` diagram in עיון when the concept has a
shape (an MDP loop, an architecture, a flow): small, viewBox 0 0 320 180,
stroke="currentColor", theme-neutral, labels in Hebrew, wrapped in a plain
paragraph. Raw inline SVG passes through markdown untouched.

Rules: ids unique forever (prefix with the day, e.g. d14-az-q2). `tree` is the
talent tree the points feed: systems | craft | ops (course/drill -> craft or
systems by topic; AI-103 -> ops; judgment -> the domain's tree per
judgment_map/talents). Exactly ONE correct option; 4 options; explain must
justify the answer. Correct answers award points automatically, so never leak
the answer outside the block. Every section below MUST include its interactive
blocks; a page with no interactives is a defect.

### עיון (the course thread, 20-30 min read, 1500-2500 words on its own)
THE SELF-CONTAINED BAR: a reader with zero prior exposure to today's topic must
be able to MASTER it from this section alone. The videos are enrichment, never
a prerequisite. "Compressed session notes" are a defect. Required structure
(h3 subsections, in order):
1. **פתיחה מאפס**: define every term used today as if seen for the first time,
   each with its Hebrew gloss.
2. **האינטואיציה**: gadial register ("תחשבו על זה כמו...").
3. **הפורמליזם המלא**: central equations in KaTeX (`\(...\)` / `\[...\]`,
   never bare `$`), with a full derivation or proof, not a sketch reference.
4. **דוגמה מחושבת ביד**: a small NUMERIC example computed step by step, every
   arithmetic step shown (e.g., a 2-state MDP, a 3-arm bandit with concrete
   numbers). This is mandatory; a lesson with no worked numbers is a defect.
5. **דוגמה שנייה או מקרה קצה**: a second worked case or the edge that breaks
   naive intuition.
6. **טעויות נפוצות**: at least 3, each with why it is wrong.
7. **חיבור**: to yesterday, to the week, and one line to his projects.
Embed the day's widget where it teaches best; PyTorch code in a fenced block
with line-by-line explanation after it; end with ONE Hebrew `quiz`.

### תרגול (15-30 min, from scratch)
One interview-caliber drill tied to today's material (DS&A/SQL on Sat/Sun).
Predict-then-peek: task and constraints first; hints and reference solution only
inside `<details><summary>רמז, ואז פתרון</summary>`. Then ONE `fillin` block that
verifies the drill was actually RUN: ask for a concrete output value of the
solution on a given input (answer normalized: whitespace/quotes stripped,
lowercase; provide `alt` spellings).

### AI-103 (~40+15 min, 400-800 words of TEACHING)
TEACH the day's exam topic inline, self-contained: the actual facts, tables,
decision rules and gotchas an exam question needs, written out (never "go read
the module" as the content). The Microsoft Learn link is the deepening, after.
Then 2-3 `quiz` blocks IN ENGLISH, exam register: scenario stems, 4 plausible
options, one correct. Wrong-answered questions from earlier days resurface
within 2 days (check recent posts for ids you repeated).

### מעקב (~10 min)
Last-24h scan over course_plan.json -> world_scan_sources. Only items with real
links fetched THIS run; if quiet, one honest line. 2-3x weekly: one paper card
(title, venue, sourced publication status, problem, mechanism, evidence,
limitations, hype-versus-real, one application to course_plan.json -> projects).
NEVER fabricate.

### שיקול דעת (the judgment rep, ~5 min)
One concrete decision scenario from the Principal Engineer Curriculum territory
(judgment_map.json rules). Format: 2-3 sentences of specific situation with real
constraints, then ONE `quiz` block (Hebrew): 4 plausible architecture/tool
choices, one correct per the curriculum rule; `explain` states the decision AND
the rule it derives from, including when the runner-up would be right. Rotate
domains day to day. This is predict-then-peek applied to judgment, which is the
point of the whole curriculum.

## 3. Style

- New technical term => inline Hebrew gloss, bold: **Overdispersion, פיזור יתר**: ...
- No em-dash or en-dash. No emojis. PAGE TOTAL 2500-4500 words: a full
  self-contained lesson, not session notes. Depth over brevity; every claim
  explained, never just asserted. The reader chose a 25-40 minute deep session.
- Habits to embody: predict-then-peek, build-first-diff-second, Feynman, spaced
  retrieval (docs/fundamentals-mastery-plan.md in new-recruit).

## 4. Index + commit

Prepend `{ "date", "week", "day", "title" }` to `posts/index.json` (valid JSON,
newest first). Never edit past posts. One commit on main:
`post: YYYY-MM-DD (wW dD)`, push. Touch nothing else.
