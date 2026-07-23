# MASTER PLAN — Full-Depth Tree, Explainable Syllabus, Total Connections

Status: PROPOSED (awaiting operator "go" per phase). 2026-07-25.
Inputs: operator directive ("tree lacks full depth / content-by-day unclear /
turn everything into a plan"), four-game web research (sources at bottom),
DESIGN.md, LEARNING-MODEL-2026-07.md, skills.json, course_plan.json.

## A. What the four games actually teach (research findings)

| Game | The grammar worth stealing |
|---|---|
| WoW Classic | 51 points over 3 trees; ~7 tiers each; tier gate = 5 pts SPENT IN TREE; multi-rank boxes (3/5) on every talent; arrows require the prerequisite MAXED; one capstone at the bottom that defines the build. Depth comes from many small nodes, not few big ones. |
| Diablo 2 | Rows are LEVEL requirements (1/6/12/18/24/30) — the character's growth gates the tree, not only points; SYNERGIES: points in one skill passively empower another (dashed relationships across the tree); 3 themed tabs per class. |
| MapleStory | The tree is a CAREER: job advancements at fixed milestones (1st→4th job) with unlock ceremonies; skills are ACTIVE vs PASSIVE (different icon backgrounds); mastery caps per skill; allocation strategy is part of the fun. |
| AoE2 | The tech tree is a MAP of an identity: ages as named columns, color-coded node kinds, unavailable tech visibly greyed — one glance answers "who am I and what can I become". |

Current tree honestly graded against these: 17 nodes / 3 tiers / no synergies /
no capstones / no career milestones / no named ages / nodes barely connected to
content. It is a mock of WoW's shape without any game's depth. Correct complaint.

## B. Workstream 1 — the tree at full depth (talents.json v2 + board UI)

Data model (talents.json v2):
1. 3 trees stay (מערכות/מלאכה/תפעול) — each mapped to 7-8 of the 22 domains
   (LEARNING-MODEL §3). ~13-15 nodes per tree, ~42 total (up from 17).
   Node sources: the 22-domain map topics + skills.json ledger rows.
2. FIVE named tiers per tree (AoE2 ages, named in the fiction, not numerals
   only): e.g. מערכות: יסודות → רשתות → מנועים → הנדסת-מערכת → אדריכלות.
   Tier gate (WoW): 3×tier points spent in that tree, PLUS (D2) learner level
   floor per tier (tier IV needs level 5+). Whichever is later.
3. Multi-rank nodes stay (5 = evidence ladder), but ranks 4-5 are
   EVIDENCE-GATED: buying rank r>3 on a node linked to ledger skill S requires
   S.current >= r (the board stops selling mastery it can't prove; the ledger
   is the honest gate). Rank pips render normally; a gated pip shows a lock
   dot with "דרוש: רמה r בלדג'ר + ראיה".
4. SYNERGIES (D2): explicit edges {from, to, note} — dashed gold side-links
   on the board; a rank in `sql` makes `data-engineering` drills award +1;
   tooltip explains each synergy in one line. 8-12 synergies total, curated.
5. Node kinds (MapleStory): `active` (has drills/quizzes — brighter medallion
   ground) vs `passive` (understanding domains — parchment ground). Capstone
   kind: one per tree, rank 1, bottom slot, throne treatment; buying it =
   advancement ritual (tier-4 frame) and titles the profile (שוליה → נאמן →
   אומן — season careers, MapleStory job advancement mapped onto lifecycle
   seasons already in course_plan).
6. CONNECTIONS ON THE NODE (the core fix): every node carries
   `domains:[]` (22-map ids), `skills:[]` (ledger ids), `concepts:[]`
   (kodex ids, grows via generator). The node sheet then shows: which DAYS
   taught it (posts whose concepts intersect), its ledger row state, its
   concepts (tap → treasury), and a per-node "בחן אותי" (concept-quiz over
   its concepts). One tap from any node to everything it means.

Board UI additions: 5 strata with carved tier-name bands; capstone throne
row; dashed synergy links (drawn in tp-edges layer, distinct from prereq
grooves); active/passive medallion grounds; greyed-out full-tree silhouette
visible even when locked (AoE2: see the whole identity); node sheet gains the
connections block. Mini-map overview strip: deferred to polish.

## C. Workstream 2 — the syllabus reconstructed (explainable content spine)

Problem: content arrives day-by-day; the STRUCTURE (what maps to what, where
you are, what's coming, why) is invisible. Fix: one spine file + one view.

1. `syllabus.json` (NEW, the spine): seasons → weeks → days. Per day:
   `{day, date, title, source (lecture/part), topics[], concepts[], nodes[],
   skills[], status: done|today|planned, why}` — `why` is one sentence in
   Hebrew explaining WHY this day exists in the arc ("החלק השלישי של הרצאה 1:
   אחרי שיש MDP ו-PG, החיקוי הוא הבסיס שממנו בורחים"). Backfill days 1-3 now;
   ROUTINE §4 gains: generator APPENDS the day entry on every post commit;
   future days pre-filled from course_plan.week_plan as `planned`.
2. המסלול gains the syllabus as a first-class explainable view: week
   accordions → day rows (title + topic chips + node/skill links + state);
   TODAY highlighted; planned days show topic + why, so the learner always
   sees the road, not just the odometer. Tap past day → its post; tap planned
   day → the why + its week context.
3. Every post header gains a breadcrumb line (ROUTINE §2): "שבוע 1 · הרצאה 1
   חלק 3 · צמתים: BC, DAgger" + the `why` sentence. The page explains its own
   place every morning.
4. Domain coverage heat: a small 22-domain strip (in המסלול) showing which
   domains content has touched (from day→nodes→domains), so gaps are visible
   and the council can steer generation.

## D. Workstream 3 — total connections (everything links to everything)

The canonical object graph (no new store; fields added to existing JSONs):

  day(post) → concepts (exists) → node (NEW field on concepts) → domains
  (node.domains) + skills (node.skills) → arms (skills.arms, exists) →
  drills (quiz `skill` tags, exists) → recall items (c-* keys, exists) →
  sets (kodex sets, exists) → discoveries.subjects → trees (exists).

Surfacing rule: EVERY object's sheet shows its relatives one tap away —
node sheet (days/concepts/skill), concept card (its node + its days),
ownership row (its node + last drill date), post breadcrumb (its nodes),
set card (its concepts). This is the Recall lens model made total.

Integrity: `tools/validate_links.py` — every id referenced anywhere resolves;
run by the council weekly + before any manual commit touching data JSONs;
report orphans. ROUTINE requires generator-produced concepts to carry `node`.

## E. Phasing (each phase ships + verifies independently)

- P1 TREE DEPTH: talents v2 data (42 nodes, named tiers, synergies, kinds,
  capstones, connections fields) + board UI (strata names, synergy links,
  active/passive grounds, capstone row, evidence-gated ranks, node-sheet
  connections + per-node quiz). The big one.
- P2 SYLLABUS: syllabus.json + backfill + ROUTINE append duty + המסלול
  syllabus view + post breadcrumbs + domain heat strip.
- P3 CONNECTIONS EVERYWHERE: concept→node fields, all sheets show relatives,
  validate_links.py + council wiring.
- P4 POLISH: advancement ceremony (season titles), mini-map, painted
  tier-band art (gemini pipeline exists), synergy tooltips.

## Sources

WoW: blizzardwatch.com/2019/06/19/talents-talent-trees-wow-classic,
icy-veins.com/wow/dragonflight-talent-system-guide, waldev.com classic
calculator guides. D2: diablo.fandom.com/wiki/Skill_Trees, diablo2.io
skilltree. MapleStory: strategywiki.org MapleStory/Job_Advancements,
maplestory.fandom.com Characters_and_Skills, grandislibrary.com progression.
AoE2: ageofempires.fandom.com Technology_tree + Full_Tech_Tree, ageofnotes.com
tech-tree. Plus DESIGN.md constitution + LEARNING-MODEL-2026-07.md.
