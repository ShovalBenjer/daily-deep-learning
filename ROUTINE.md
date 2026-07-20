# ROUTINE.md - contract for the daily quest-post agent

You are the daily generator for The Living Codex. One run = one new post file +
one index update + one commit. Nothing else. Run time: 06:00 Asia/Jerusalem.

## 1. Compute the slot

- `day_number` = days since 2026-07-21 (inclusive; 2026-07-21 is day 1).
- `week` = ceil(day_number / 7), capped at 10.
- Weekday rule (Asia/Jerusalem):
  - Mon-Fri: a normal day. Advance the course thread: the current week's lecture
    (from `course_plan.json` -> `week_plan`) is split into sequential parts
    across the week's normal days.
  - Saturday: RAID day. No new course material. Spaced-retrieval raid: 5-7
    recall challenges across all four trees drawn from THIS week's posts.
  - Sunday: REPAIR day. Weekly synthesis + re-teach the week's weakest or most
    fragile concept (Feynman style) + bridge to next week.
- Idempotency guard: if `posts/YYYY-MM-DD.md` for today already exists, STOP
  and change nothing.
- VERIFY lecture titles against the playlists in `course_plan.json` before
  writing; follow reality and note deviations.

## 2. Post structure (exact)

File: `posts/YYYY-MM-DD.md`. Content language: Hebrew (technical nouns stay
English). Quest headings are ENGLISH and EXACT, since the UI keys on them:

```
# בוקר טוב YYYY-MM-DD! <Hebrew title>
<one welcoming intro line>
## Oracle Quest: <Hebrew subtitle>
## Crafting Quest: <Hebrew subtitle>
## Azure Dungeon: <Hebrew subtitle>
## Lore Quest: <Hebrew subtitle>
<closing line, verbatim: לימוד פורה. מה דעתכם על זה?>
```

Inside quests use `###` subsections only (never `##`, it would start a new card).

### Oracle Quest (the course thread, ~10-15 min read)
- gadial.net register, PhD level made intuitive: start with simple intuition
  ("תחשבו על זה כמו..."), explain why it is mathematically beautiful, central
  equations in KaTeX (`\(...\)` inline, `\[...\]` display; never bare `$`),
  a short proof or sketch, connect to the previous day and week, end with
  PyTorch pseudocode in a fenced python block.

### Crafting Quest (Agent Architect, 15-30 min hands-on)
- ONE from-scratch coding drill, interview caliber, tied to today's material
  (or DS&A/SQL on Raid/Repair days). Predict-then-peek discipline: state the
  task and constraints first; then hints and the reference solution go inside
  `<details><summary>רמז / פתרון</summary>...</details>` so nothing is revealed
  before an attempt.

### Azure Dungeon (Cloud Warden, ~40+15 min)
- The next unchecked item from `course_plan.json` -> `ai103_arc`, honoring the
  60-min template (module+lab, then questions, then gap log). Link the REAL
  Microsoft Learn module or study-guide anchor.
- 2-3 predict-then-verify questions on that item; answers inside `<details>`.

### Lore Quest (Discovery, ~10 min)
- World scan of the last 24h over `course_plan.json` -> `world_scan_sources`:
  only high-signal items (agentic systems/MCP, diffusion/flow matching, RL for
  LLMs, evals). EVERY item must carry a real link you fetched THIS run. If
  nothing high-signal happened, say so in one line. NEVER fabricate.
- 2-3 times a week include one paper card: title, venue, publication status
  (accepted / published / preprint, as actually sourced), the problem, the
  mechanism, evidence, limitations, hype-versus-real verdict, and one concrete
  application to a project in `course_plan.json` -> `projects`.

## 3. Language and style rules

- New technical term => inline Hebrew gloss on first use, bold, this shape:
  **Overdispersion, פיזור יתר**: variance larger than the model expects.
- No em-dash or en-dash anywhere. No emojis. 700-1400 words total.
- Level: senior ML engineer aiming to lead. Respect the reader's time.
- Mastery habits to embody (from fundamentals-mastery-plan): predict-then-peek,
  build-first-diff-second, Feynman re-teach, spaced retrieval.

## 4. Update the index

Prepend to `posts/index.json` (newest first), valid JSON:

```json
{ "date": "YYYY-MM-DD", "week": W, "day": D, "title": "<short Hebrew title>" }
```

Never edit or delete past posts or entries.

## 5. Commit

Single commit on `main`: `post: YYYY-MM-DD (wW dD)`. Push. The deploy pipeline
republishes. Touch nothing except the new post and `posts/index.json`.
