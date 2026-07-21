# הסדנה — Product Spec v1 (2026-07-21)

Status: active. Owner: Shoval. This is the product rethink demanded after three
UI/content rejections. Every section answers a named question.

## 1. What this product is

A personal learning system with one honest claim: **it learns you back.**
Three loops, three speeds:

| Loop | Cadence | Mechanism |
|---|---|---|
| Practice | daily, ~25 min | The daily page: one concept thread, interactive checks, judgment rep |
| Adaptation | nightly | Generator reads your state (answers, confidence, mistakes) and writes tomorrow accordingly |
| Direction | weekly | Saturday raid from YOUR error pool; Sunday repair of YOUR weakest node; ladder re-prioritized |

## 2. "How is this learning? Updating? Customized?" — the adaptive loop

The flaw until now: state lived in the phone's localStorage; the nightly
generator was blind. The fix is the **sync spine**:

```
PWA (answers, attempts, confidence, time, ranks)
  -> POST state.json to sadna-sync Worker (Cloudflare, R2-backed, bearer key)
  -> nightly generator GETs state before writing the page:
       - wrong/low-confidence items resurface at +2d and +7d (real spaced repetition)
       - שיקול דעת targets the weakest tree/domain by first-try accuracy
       - topic pools are filtered by coverage (what you have NOT seen yet)
       - depth scales with your level (see 4)
  -> the page you open at 06:02 was written FROM yesterday's you
```

This is the deterministic core of the measurement stack from the Futuristic
Learning Stack doc (coverage gaps -> next content), implemented without any
paid infra. Embedding-based gap detection and G-Eval judging join in phase 2.

## 3. Dynamic grading and metrics ("metrify me")

Tracked per interaction: correct/wrong, attempts, **confidence 0-100**
(slider before checking), time-of-day, domain, tree. Derived metrics, shown in
the app and fed to the generator:

- First-try accuracy per tree and per domain (the mastery signal)
- **Calibration**: |confidence - correctness| (the Brier-style gap; his Codex
  spec asked for exactly this)
- Coverage: % of topic pool touched; % of ladder done
- Streak (no-guilt), level (see 4), points economy

Free-text grading (explain-in-your-own-words judged by Claude) requires the
agent daemon (6) and is phase 2.

## 4. Learning levels

Level = f(total earned points), thresholds 0/10/25/45/70/100/140/190/250/320
-> רמה 1..10. Levels gate depth, not access: the generator writes the same
concept deeper as the level rises (רמה 1-3: intuition+use; 4-6: proofs+failure
modes; 7-10: SOTA papers wired into the thread). Ladder items carry a
recommended level so "what should I do now" is always answerable.

## 5. Content architecture (the de-slop rule)

**One thread per day.** The page has ONE central concept. עיון teaches it,
תרגול implements it, שיקול דעת decides with it; AI-103 stays a parallel track
but must end with one bridge line to the thread. A page whose five sections
do not share a spine is a defect (ROUTINE.md enforces this).

SOTA depth bar: every עיון must contain at least one of {proof sketch, failure
mode, 2025-26 paper connection}; מעקב paper cards carry sourced status and a
"apply to my projects" line. Sources of truth: the two curriculum docs +
course playlists + topic pools (7).

## 6. Chat with Claude inside the app + Agent SDK control

Architecture (matches the hiring-machine command-center pattern):

```
PWA chat pane -> cloudflared tunnel -> local daemon on the always-on PC
  daemon = Claude Agent SDK session, subscription OAuth (claude setup-token)
  tools: read_state, grade_answer (free text), explain_deeper, add_quiz,
         update_metrics, write_note_to_generator
  auth: Cloudflare Access in front of the tunnel
```

Zero marginal token cost (subscription), full SDK agency: it can grade you,
re-explain at your level, inject a follow-up quiz into today's page, and leave
notes the nightly generator must honor. **Blocked only on: `claude
setup-token` run by Shoval (interactive) + one OK.** Until then the app ships
a "שאל את קלוד" button per section that opens claude.ai with the day's context
prefilled (zero infra, works today).

## 7. Coverage ("is all topics and research papers in?")

In: the 17-domain curriculum (map+rules), the Learning Stack ladder incl. all
its papers (RM/omega-regular/GRPO/Panini/G-Eval/TF-GRPO/ALMA/Oxford/Letta),
CS224R+6.S184 week plan, AI-103 full arc, mastery habits.
Added tonight (were missing): the Living Codex starter topic pools
(probability/architect/cloud lists), MatchIQ CONCEPTS topics. Still OUT,
deliberately: the daily market-intelligence agent (separate automation, not
learning), agentic_creativity report papers (fold into מעקב cards as the
generator reaches them). The generator MUST draw from `topic_pools` and mark
coverage; pools are the syllabus contract.

## 8. UI/engagement direction

Identity stays ink-paper-rubrication (approved anchor), but the app must EARN
daily return: points fly to the header, rank-ups pulse, views crossfade,
answers give immediate colored verdicts, the ladder opens with ONE "הבא בתור"
action card. The 3D layer: rebuild העץ as a Three.js scene using
scottstts/Threejs-Awesome-Graphics-Agent-Skills (installable agent skills:
procedural geometry, atmosphere, materials) — a dedicated build session, done
properly: the tree as a physical object (engraved standing stones / growing
tree, branches light up as ranks fill), not decorative particles.

## 9. Build order

1. (tonight) Sync Worker + state schema + confidence slider + actionable
   ladder + levels + topic pools + motion pass + שאל-את-קלוד links
2. Generator v2: state-driven resurfacing + weakest-domain targeting (ROUTINE
   updated tonight; first adaptive page = next 06:02 run after sync key exists)
3. Agent daemon (SDK + tunnel + Access) — needs Shoval's setup-token
4. Three.js tree with the graphics skills
5. G-Eval graded free-text + embedding coverage maps (the full measurement
   stack from the Learning Stack doc)
