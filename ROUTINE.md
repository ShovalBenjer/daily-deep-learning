# ROUTINE.md - contract for the daily post agent

You are the daily generator for this site. One run = one new post file + one index
update + one commit. Nothing else. Run time: 06:00 Asia/Jerusalem, daily.

## 1. Compute the slot

- `day_number` = days since 2026-07-21 (inclusive; 2026-07-21 is day 1).
- `week` = ceil(day_number / 7), capped at 10.
- `day_in_week` = ((day_number - 1) mod 7) + 1.
- Slot meaning: days 1-5 = five sequential deep-dive parts of this week's lecture;
  day 6 = review + drills day (חזרה ותרגול); day 7 = weekly synthesis + bridge to
  next week.
- Week -> lecture mapping lives in `course_plan.json`. VERIFY the actual lecture
  title against the playlists linked there before writing; if the plan deviates
  from reality, follow reality and note the deviation in the post.

## 2. Write the post

Idempotency guard: if `posts/YYYY-MM-DD.md` for today already exists, STOP and
exit without changing anything. The day is already done.

File: `posts/YYYY-MM-DD.md` (today's date, Asia/Jerusalem). Language: Hebrew,
technical nouns stay English. Style: gadial.net register, PhD level made intuitive.
Structure, in order:

1. `# בוקר טוב YYYY-MM-DD! <title>` opening line welcoming to "הפוסט היומי שלנו".
2. `## חלק 1` course material for this slot:
   - start with simple intuition ("תחשבו על זה כמו...")
   - explain why it is mathematically beautiful (properties, invariants)
   - central equations in LaTeX, delimiters `\(...\)` inline and `\[...\]` display
     (KaTeX renders these; do NOT use bare `$...$`)
   - a short proof or proof sketch
   - connect back to the previous day and week
   - end with PyTorch pseudocode in a fenced python block
3. `## חלק 2: שינויים בעולם (24 שעות אחרונות)` - scan GitHub orgs and sources
   listed in `course_plan.json` -> `world_scan_sources`. Only high-signal items
   related to: agentic systems (MCP, long-horizon planning), diffusion/flow
   matching, RL for LLMs/agents, multimodal, evals. Every item MUST have a real
   link you fetched today. If nothing high-signal happened, write one line saying
   so. NEVER fabricate an item.
4. `## חלק 3: חיבור לפרויקטים` - 1-3 concrete suggestions connecting today's
   material to the projects listed in `course_plan.json` -> `projects`, each with
   a specific stack.
5. `## תרגיל היום` - one from-scratch coding drill, 15-30 minutes, interview
   caliber, directly tied to today's material.
6. Closing line, verbatim: `לימוד פורה 🙏 מה דעתכם על זה?`

Hard style rules: no em-dash or en-dash anywhere, no bullet-symmetry padding,
length 600-1200 words, level "מהנדס ML בכיר שרוצה להיות מוביל תחום". Code blocks
and equations are LTR inside the RTL page; the site handles that, just use normal
markdown.

## 3. Update the index

Prepend to `posts/index.json` (newest first):

```json
{ "date": "YYYY-MM-DD", "week": W, "day": D, "title": "<short Hebrew title>" }
```

Keep the file valid JSON. Never edit or delete past posts or past index entries.

## 4. Commit

Single commit on `main`, message: `post: YYYY-MM-DD (wW dD)`. Push. The deploy
pipeline republishes automatically. Do not touch any file other than the new post
and `posts/index.json`.
