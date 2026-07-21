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

### עיון (the course thread, ~10-15 min read)
gadial register, PhD level made intuitive: intuition first ("תחשבו על זה כמו..."),
why it is mathematically beautiful, central equations in KaTeX (`\(...\)` inline,
`\[...\]` display, never bare `$`), a short proof or sketch, connection to the
previous day, PyTorch pseudocode in a fenced python block.

### תרגול (15-30 min, from scratch)
One interview-caliber drill tied to today's material (DS&A/SQL on Sat/Sun).
Predict-then-peek: task and constraints first; hints and reference solution only
inside `<details><summary>רמז, ואז פתרון</summary>`.

### AI-103 (~40+15 min)
The next unchecked item from research_ladder.json -> cert.weeks, honoring the
60-min template. Real Microsoft Learn link. 2-3 predict-then-verify questions,
answers inside `<details>`.

### מעקב (~10 min)
Last-24h scan over course_plan.json -> world_scan_sources. Only items with real
links fetched THIS run; if quiet, one honest line. 2-3x weekly: one paper card
(title, venue, sourced publication status, problem, mechanism, evidence,
limitations, hype-versus-real, one application to course_plan.json -> projects).
NEVER fabricate.

### שיקול דעת (the judgment rep, ~5 min)
One concrete decision scenario from the Principal Engineer Curriculum territory
(judgment_map.json rules + its source doc). Format: a specific situation with
real constraints -> "החליטו לפני שפותחים" -> answer inside `<details>` stating
the decision AND the rule it derives from. Rotate domains day to day; prefer the
domains with the lowest self-set maturity when known. This is predict-then-peek
applied to judgment, which is the point of the whole curriculum.

## 3. Style

- New technical term => inline Hebrew gloss, bold: **Overdispersion, פיזור יתר**: ...
- No em-dash or en-dash. No emojis. 700-1500 words total. Respect the reader.
- Habits to embody: predict-then-peek, build-first-diff-second, Feynman, spaced
  retrieval (docs/fundamentals-mastery-plan.md in new-recruit).

## 4. Index + commit

Prepend `{ "date", "week", "day", "title" }` to `posts/index.json` (valid JSON,
newest first). Never edit past posts. One commit on main:
`post: YYYY-MM-DD (wW dD)`, push. Touch nothing else.
