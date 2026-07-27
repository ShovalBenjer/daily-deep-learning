# Syndication plan: one post, seven surfaces

Handoff for the next session. Nothing here is posted yet. The canonical article
is live at `https://daily-deep-learning.pages.dev/writing/the-bench`.

## The principle: POSSE, and one source of truth

Publish on the Own Site, Syndicate Elsewhere. The canonical URL is always the
pages.dev article. Every syndicated copy carries `rel=canonical` back to it, so
search engines credit the original and the copies do not compete with it.

**The thing to build is a projection, not seven documents.** Seven hand-written
variants drift the moment the article changes, and a hardcoded per-platform
string table is the same problem wearing a different hat. What the next session
should build instead:

- The article is annotated once with **semantic spans** that mark what each
  fragment *is*: `claim`, `number`, `failure`, `method`, `reversal`, `punchline`,
  `artifact-link`.
- Each platform declares a **budget and a shape**: character ceiling, whether
  threads are allowed, whether markdown renders, whether links are penalised.
- A **projector** selects spans to fill that shape. Change the article, re-run,
  every surface updates.

That is the "not hardcoded, dynamic" requirement, made concrete.

## Hook strategies, per platform

The hook is the first 1-2 lines and it is the whole game on social. Different
surfaces reward different openings, and the same opening on all of them is the
tell that a bot posted it.

| surface | hook strategy | why |
| --- | --- | --- |
| **X** | **Cold number, no context.** "78,406 messages. One bench. Ten hours." Withholding the subject is what buys the second line. | Feed is scanned; a complete first sentence is a reason to scroll past |
| **Bluesky** | **Wry admission.** "I gave an AI agent a photo of a bench and no hints. It went to Turkey." Self-deprecating, conversational. | Smaller, more forgiving, tech-literate audience that punishes marketing cadence |
| **dev.to** | **Problem statement.** "WhatsApp Desktop encrypts its local store. Here is the chain, and what it cost to walk it." Concrete technical promise. | Readers arrive wanting a technique they can reuse |
| **Medium** | **Narrative in-media-res.** Open on the moment of the wrong answer, not the setup. | Rewards essay pacing; the audience is broader and less technical |
| **Reddit** | **No hook at all. State the artifact plainly and ask for critique.** | Any hook reads as self-promotion and gets removed. r/LocalLLaMA and r/ClaudeAI both punish it |
| **GitHub README** | **What it is and how to run it,** first line. No narrative. | Readers are evaluating whether to clone |
| **LinkedIn** (optional) | **The methodology,** not the story: withheld ground truth, external gate, cost accounting. | Frame as evaluation protocol; skip if it reads as bragging |

## Which part of the article goes where

Do not post the same excerpt everywhere. Each surface gets the fragment it is
actually good at carrying.

- **X thread**: the route of wrong answers (Yarkon → Weiner → Turkey → the false
  address → the archive). It is a five-beat sequence, which is exactly a thread.
- **Bluesky**: single post plus one reply. The Turkey detour and the goat.
- **dev.to**: the decryption chain and the FAGEN failure mapping. The full
  technical body, canonical set to pages.dev.
- **Medium**: the narrative arc with the interactive figures replaced by static
  images. Use Medium's **import tool**, which sets `rel=canonical` automatically.
- **Reddit**: r/LocalLLaMA gets the decryption and cost accounting; r/ClaudeAI
  gets the failure taxonomy. Different excerpts, and **only if dev.to lands
  first** so there is a track record.
- **GitHub README**: the tooling, not the story. `whatsapp-query`,
  `voice-metrics`, `case-ledger-post`, with the measured numbers.

## Tooling to evaluate

Prefer assembling from these over writing a publisher from scratch.

- **dev.to**: official Articles API, `POST /api/articles`, key from
  Settings → Extensions. Supports `canonical_url` and `published:false` for a
  draft-first flow. Already have `DEVTO_API_KEY` in `.env`.
- **Bluesky**: AT Protocol. `atproto` (Python) or `@atproto/api` (TS).
  App-password auth, already in `.env`. Note the 300-grapheme limit and that
  link cards render, so the bare URL should not also be pasted.
- **Medium**: the writer API is retired. **Import tool only**, which is manual
  but preserves canonical. Do not plan an automated path.
- **X**: API v2 free tier is write-limited and the paid tiers are expensive.
  **Plan for manual posting** with a generated thread file.
- **Reddit**: PRAW. Rate-limited and subreddit rules vary; treat as manual-first.
- **POSSE reference**: [wpowiertowski/posse](https://github.com/wpowiertowski/posse)
  syndicates Ghost → Mastodon/Bluesky with per-account tag filters and image
  compression. Not directly usable (no Ghost here) but the shape is worth copying.
- **Voice check**: run every draft through `voice-metrics` with `--profile none
  --rules x|bluesky|devto|github_readme`. Those rule sets already exist and carry
  the per-surface ceilings.

## Order of operations

1. **dev.to first.** It is the lowest-risk surface, has a real API, and produces
   a citable link the others can reference.
2. **GitHub README** next; it is fully under our control.
3. **Bluesky** once dev.to is live.
4. **X** manually, using the generated thread.
5. **Medium** via import, manual.
6. **Reddit last, and only if the earlier posts landed.** Read each subreddit's
   self-promotion rule the same day; they change.

## Open questions for the next session

- Is the interactive figure set worth reproducing as GIFs for Medium, or should
  Medium just link out at that point?
- Does the article need an English-only pass? Some quoted operator messages are
  Hebrew and render without translation.
- Reddit account age and karma: check before drafting, since several relevant
  subreddits gate on both.

## State

- Article: live, mobile and desktop verified at 390 and 1440, no horizontal
  overflow. Boxed-card treatment removed; desktop margin now carries a rail.
- Drafts: `devto.md`, `social.md` exist but predate the layout change and the
  FAGEN reframe is only partly applied. **Re-audit both against the prose-tell
  catalogue in `case-ledger-post` before posting.**
- Credentials: `DEVTO_API_KEY`, `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` in
  `.env`. Nothing has been posted anywhere.
- Nothing in this plan is authorised to publish. Publication is a separate
  decision, per surface.
