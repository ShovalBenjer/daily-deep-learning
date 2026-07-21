# ROUTINE.md - contract for the daily page generator (הסדנה)

One run = one new post + one index update + one commit. Run: 06:00 Asia/Jerusalem.

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

Rules: ids unique forever (prefix with the day, e.g. d14-az-q2). `tree` is the
talent tree the points feed: systems | craft | ops (course/drill -> craft or
systems by topic; AI-103 -> ops; judgment -> the domain's tree per
judgment_map/talents). Exactly ONE correct option; 4 options; explain must
justify the answer. Correct answers award points automatically, so never leak
the answer outside the block. Every section below MUST include its interactive
blocks; a page with no interactives is a defect.

### עיון (the course thread, ~10-15 min read)
gadial register, PhD level made intuitive: intuition first ("תחשבו על זה כמו..."),
why it is mathematically beautiful, central equations in KaTeX (`\(...\)` inline,
`\[...\]` display, never bare `$`), a short proof or sketch, connection to the
previous day, PyTorch pseudocode in a fenced python block. End with ONE `quiz`
block checking the deepest idea of the day (Hebrew).

### תרגול (15-30 min, from scratch)
One interview-caliber drill tied to today's material (DS&A/SQL on Sat/Sun).
Predict-then-peek: task and constraints first; hints and reference solution only
inside `<details><summary>רמז, ואז פתרון</summary>`. Then ONE `fillin` block that
verifies the drill was actually RUN: ask for a concrete output value of the
solution on a given input (answer normalized: whitespace/quotes stripped,
lowercase; provide `alt` spellings).

### AI-103 (~40+15 min)
The next unchecked item from research_ladder.json -> cert.weeks, honoring the
60-min template. Real Microsoft Learn link. Then 2-3 `quiz` blocks IN ENGLISH,
exam register (the real exam is English): scenario-style stems, 4 plausible
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
- No em-dash or en-dash. No emojis. 700-1500 words total. Respect the reader.
- Habits to embody: predict-then-peek, build-first-diff-second, Feynman, spaced
  retrieval (docs/fundamentals-mastery-plan.md in new-recruit).

## 4. Index + commit

Prepend `{ "date", "week", "day", "title" }` to `posts/index.json` (valid JSON,
newest first). Never edit past posts. One commit on main:
`post: YYYY-MM-DD (wW dD)`, push. Touch nothing else.
