# ROUTINE.md - contract for the unit generator (הסדנה)

One run = one unit body + one curriculum update + one commit.

**This contract replaced the dated-page contract on 2026-07-29.** The calendar is
retired. There is no day number, no week number, no Saturday ritual and no Sunday
ritual. The learner's position is the set of units he has closed, never the date.
Read `docs/PRODUCT-MODEL-2026-07-26.md` and `docs/SYSTEM-SPEC-2026-07-26.md`
before changing anything here.

The six dated pages under `posts/` stay readable at `#/history` and at
`#/YYYY-MM-DD`. Never edit them. Never write a new one.

## 0. What a unit is

`curriculum.json` holds every unit. A unit is one teachable thing, with an id
such as `m0-shell-terminal`. Its lesson lives at `units/<id>.md`. The app fetches
that file when the learner opens the unit, and treats the FILE as the truth about
whether a lesson exists.

`tools/build_curriculum.py` owns which units exist. This routine never adds,
renames or deletes a unit. It writes bodies for units that already exist.

## 1. Pick the unit

1. `git pull` first. The cloud routine clones from GitHub main, and a local file
   that was never pushed does not exist as far as this run is concerned.
2. Read the learner state from the sync endpoint (URL and bearer key come in the
   run instructions). It carries `unitState`, `answers`, `reviews`, `points`,
   `ranks`, `known` and `skillLevels`. If it is unreachable, continue without
   personalisation and say so in the commit body, never on the page.
3. Choose the highest-priority unit whose `units/<id>.md` does NOT exist, using
   the same ordering the app uses (`SYSTEM-SPEC` 2.1):

   `priority = goalPull * gapFactor * moscowFactor * availability`

   - `goalPull`: max over active goals in `goals.json` that the unit lists, each
     weighted by `weight / max(1, daysLeft/7)`.
   - `gapFactor`: mean of `(target - current) / 5` over the unit's skills, from
     `skills.json` with `skillLevels` overriding.
   - `moscowFactor`: must 1.0, should 0.45, could 0.15, wont 0.
   - `availability`: 0 unless every concept in `requires` is taught by a unit the
     learner has already closed, or listed in `known`.

   Ties break by the smaller `estMin`. A unit with `moscow: "wont"` is never
   generated.
4. **Idempotency: if `units/<id>.md` already exists, STOP and change nothing.**

## 2. Write the lesson

File `units/<id>.md`. Hebrew content, technical nouns in English.

**The self-contained bar:** a reader with zero prior exposure must be able to
master this unit from this file alone. Videos and links are enrichment, never a
prerequisite. Compressed notes are a defect.

Length follows the unit's own budget. `estMin` is the workout read. `depthEstMin`
is the full read. A unit with `depthEstMin` of 25 gets roughly 700 to 1200 words.
A unit with 45 gets roughly 1500 to 2500. Do not pad to reach a number.

Section order is FIXED, and the same in every unit. The learner retrieves by
picturing the page, so the shape must not vary:

```
# <the unit's Hebrew title>
<one line hook, drawn from the lesson itself>
## מה תדע בסוף
## האינטואיציה
## ההגדרות המדויקות     (or ## הפורמליזם when the unit carries mathematics)
## דוגמה מחושבת
## המקרה שמפיל את האינטואיציה
## טעויות נפוצות
## מתי זה לא משנה
## חיבור
```

Rules per section:

- **מה תדע בסוף**: the observable outcome, one or two sentences. Not a topic list.
- **האינטואיציה**: one concrete analogy, carried consistently. Do not switch
  metaphors mid-section.
- **ההגדרות המדויקות / הפורמליזם**: every term defined with its Hebrew gloss in
  bold on first use. Mathematics in KaTeX with `\(...\)` and `\[...\]`, never a
  bare `$`. Show the derivation, never a reference to one.
- **דוגמה מחושבת**: a small worked case with every step shown. For a mathematical
  unit this is arithmetic on real numbers. For a vocabulary or tooling unit it is
  a command and its actual output. A unit with nothing worked is a defect.
- **המקרה שמפיל את האינטואיציה**: the edge that breaks the naive reading. Prefer
  a case from the operator's own stack when one is real. Never invent one.
- **טעויות נפוצות**: at least three, each with why it is wrong.
- **מתי זה לא משנה**: when NOT to reach for this, and the trade-off against the
  main alternative. Interviews live here.
- **חיבור**: to the block this unit belongs to, and to what it unlocks next.

## 3. Interactive blocks

Every unit MUST carry at least one `quiz` and, for a `practice` unit, at least
one `fillin` that verifies the drill was actually run. A unit with no
interactive block is a defect.

Each fence holds a SINGLE LINE of valid JSON.

    ```quiz
    {"id":"u-<unitid>-q1","tree":"systems|craft|ops","skill":"<skills.json id>","q":"...","options":["","","",""],"answer":0,"explain":"..."}
    ```

    ```fillin
    {"id":"u-<unitid>-f1","tree":"...","skill":"...","prompt":"...","answer":"...","alt":["..."],"explain":"..."}
    ```

    ```widget
    {"type":"decay|gridworld|algviz","title":"..."}
    ```

    ```concepts
    {"items":[{"id":"kebab-id","t":"Term","he":"מונח","d":"one line","rel":["other-id"]}]}
    ```

Block rules:

- Ids start with `u-<unitid>-` and are unique forever.
- `tree` is the talent tree the points feed, and it must be the tree that owns
  the unit's `node` in `talents.json`: systems, craft or ops. Points must land
  where the work happened.
- Exactly one correct option, four options, and `explain` justifies the answer.
- Never leak an answer outside its block.
- Append every `concepts` item to the top-level `concepts.json` as well, skipping
  ids that already exist. Each new concept carries `"node": "<talents.json id>"`.
- Widgets: use one when the unit's idea has a moving part. If the catalog lacks a
  fitting one, end the file with `<!-- widget-request: <type>: <one line spec> -->`.

## 4. Adaptation

Read the state and let it shape the lesson. Say nothing about this on the page.

1. **Depth by measured level.** Total earned points map to levels through
   0/10/25/45/70/100/140/190/250/320. Levels 1 to 3 stay at intuition and use.
   Levels 4 to 6 add proof sketches and failure modes. Levels 7 to 10 wire in a
   2025 or 2026 paper.
2. **Difficulty near 85 percent.** If first-try accuracy over the last three days
   is above 90, harden the blocks. Below 70, ease them.
3. **Resurface what leaked.** The state's `reviews` carry `lapses` per item.
   Where a leaked item belongs to this unit's concepts, write a fresh block on
   the same idea with a new id.
4. **Evidence ladder.** Levels 0 to 2 may rise from unassisted quiz evidence.
   Levels 3 to 5 rise only from artifacts: a repo, a pull request, a deployed
   thing. Never imply a quiz can certify level 4. Assisted work never counts.

## 5. Close the run

1. Set the unit's `body` in `curriculum.json`: `status: "fresh"`, `generated` to
   the ISO timestamp, `hash` to a content hash of the file.
2. Append any new concepts to `concepts.json`.
3. Run `python tools/validate_links.py`. It must exit 0. It checks that every
   unit body maps to a real unit, and that node, skill and goal ids resolve.
4. One commit on main: `unit: <id>`, then push. Touch only `units/`,
   `curriculum.json` and `concepts.json`.

Never touch `posts/`, `posts/index.json` or `syllabus.json`. Those belong to the
retired contract.

## 6. Style

- A new technical term gets an inline Hebrew gloss in bold on first use:
  **Overdispersion, פיזור יתר**.
- No em-dash, no en-dash, no emoji.
- No stock photos ever. The imagery is the widgets, plus at most one
  hand-authored inline `<svg>` when the idea has a shape: `viewBox="0 0 320 180"`,
  `stroke="currentColor"`, theme-neutral, Hebrew labels.
- Any visual output obeys `DESIGN.md`, which is binding.
- Never narrate the pipeline to the learner. A degraded run still opens with a
  real hook.

## 7. The weekly council, unchanged in purpose

A separate Sunday run, not this one. It diffs the Drive corpus, ingests new
documents into the paper-card queue, updates `corpus_manifest.json`, runs
`py tools/sync_resume_skills.py` so a new resume claim becomes a tracked
`resume_risk` row, and runs `py tools/validate_links.py`. It reports new rows in
its commit message.

The council may also propose curriculum changes. It does so by editing the
enumeration in `tools/build_curriculum.py` and rerunning it, never by hand
editing `curriculum.json`.
