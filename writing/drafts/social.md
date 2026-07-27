# Social drafts, ready to post

All of these link the canonical post. Post the canonical first, wait for the
Cloudflare deploy to be live, then these.

Canonical: `https://daily-deep-learning.pages.dev/writing/the-bench.html`

---

## X thread

Lead with the 42 vs 78,406 gap, not the bench. The bench is the punchline, not the hook.

**1/**
My AI agent spent 10 hours finding a park bench.

It wrote its own post-mortem, including the part where it read a joke as a street
address and searched a whole neighbourhood for it.

**2/**
It started as: "suggest replies to my unanswered messages."

One of them was a photo of two benches. Caption: "Memory laneeee". No location.

I refused to give it a single hint.

**3/**
First it did the right thing: pulled the raw bytes and parsed the JPEG structure
instead of squinting at the image.

APP0 present. DQT present. DHT present.

APP1, where GPS lives: absent. Stripped on send.

Ninety seconds to turn an assumption into a fact.

**4/**
Then five confident wrong answers in a row.

Reverse image search said "park bench", best match in another country.

It found a running route in the chat and mistook a habit for a place.

**5/**
My favourite: it found a message where one friend asks the other which of two
similarly-named streets he lives on.

It built a geographic theory on that.

It was a pun. The reply was "that's my name, not my street."

**6/**
Then it noticed the real problem.

The web client is a linked device. Linked devices don't hold history, they sync a
shallow window.

It had been theorising about a 20-year friendship from **42 messages**.

**7/**
So it decrypted the local desktop archive.

Machine ID, an OS-sealed static key, a client key carved out of a write-ahead log,
then key derivation into the keystore.

The proof it worked: sha1(clientKey) matched a directory name on disk exactly.

**8/**
78,406 messages. 597 conversations. 4 years.

The thread it had seen 42 messages of held 8,852.

[attach cliff.gif]

**9/**
And the thing that cracked it wasn't in the friendship thread.

It was a courier notification from months earlier: parcel left at the address,
"next to the bicycles".

There's a bicycle in the photo.

**10/**
Cost, parsed from the transcript:

10h 31m
1,652,199 output tokens
446,621,195 total through the model
287 shell commands
5 wrong answers
1 bench

**11/**
The part I actually wanted was the agent's own list of what this exposed:

it can't detect tone and doesn't know it
it doesn't index its own output (the answer was in its results twice)
it retrofits justification onto conclusions it already picked

**12/**
Best line in the whole thing, on why it eventually stopped over-claiming:

"An external constraint corrected a default I could not correct from inside."

A hook in my setup, not insight.

**13/**
Full write-up, with the diagrams running live:

https://daily-deep-learning.pages.dev/writing/the-bench.html

---

## Bluesky thread

Same spine, 300 char limit per post, fewer beats.

**1/**
My AI agent spent 10 hours finding a park bench, then wrote its own post-mortem.

Including the part where it read a joke as a street address and searched a whole
neighbourhood for it.

**2/**
It started as "suggest replies to my unanswered messages". One was a photo of two
benches, captioned "Memory laneeee". No location.

I gave it zero hints.

**3/**
It did one thing right immediately: parsed the JPEG structure rather than
squinting at pixels.

APP1, the segment holding GPS, was absent. Stripped on send.

An assumption turned into a fact in 90 seconds.

**4/**
Then it found a message where one friend asks the other which of two
similarly-named streets he lives on, and built a whole geographic theory on it.

It was a pun. "That's my name, not my street."

**5/**
The real problem: the web client only syncs a shallow window. It had been
theorising about a 20-year friendship from 42 messages.

So it decrypted the local desktop archive. 78,406 messages. That thread held 8,852.

[attach cliff.gif]

**6/**
What actually cracked it: a courier notification from months earlier. Parcel left
at the address, "next to the bicycles".

There's a bicycle in the photo.

**7/**
10h 31m. 446 million tokens. 287 shell commands. 5 wrong answers. 1 bench.

Its own verdict on what this exposed is the good part:
https://daily-deep-learning.pages.dev/writing/the-bench.html

---

## Reddit

**Do not post day one.** Wait to see if dev.to lands. If it does:

- **r/ClaudeAI** or **r/LocalLLaMA**: the honest-failure angle works there.
- **r/programming**: only the decryption walkthrough survives that crowd, and
  self-promotion gets punished. Consider a text post with the technical content
  inline and the link at the bottom, not a link post.

**Title:** I asked my AI agent to draft some replies. It spent 10 hours, decrypted my message archive, and wrote a post-mortem on its own architectural defects.

**Body:**

Full write-up is linked at the bottom, but here is the substance so you do not
need to click.

The task was mundane: suggest replies to unanswered messages. One was a photo of
two benches with the caption "Memory laneeee" and no location. I told it to find
where the photo was taken and refused to give hints.

What it got right immediately: instead of reasoning about the image, it pulled the
raw bytes and parsed the JPEG segment structure. No APP1 segment, meaning EXIF and
GPS were stripped on send. Ninety seconds to convert an assumption into a fact.

What it got wrong, five times: reverse image search returned "park bench" with
matches in another country. It found a running route in the chat history and
mistook a habit for a place. It found a message where one friend asks the other
which of two similarly named streets he lives on and built a geographic theory on
it, which turned out to be a pun ("that's my name, not my street").

The turn came when it realised why it kept failing. The web client is a linked
device and only syncs a shallow recent window, so it had been theorising about a
twenty year friendship from 42 messages. It reimplemented the documented
decryption chain for the desktop store: machine ID, an OS-sealed static key, a
client key carved from a write-ahead log, then key derivation into the keystore.
The verification step is the nice part, sha1 of the recovered client key matches a
session directory name on disk, which a wrong key cannot produce.

78,406 messages across 597 conversations. That one thread held 8,852. And the
thing that solved it was a courier notification from months earlier saying a
parcel had been left "next to the bicycles". There is a bicycle in the photo.

The reason I am posting it: I asked the agent to write the post-mortem itself, and
to be hard about it. Its own list of defects includes not being able to detect
tone while having identical confidence when right and wrong, not indexing its own
tool output (the correct answer appeared in its own results twice, hours before it
found it), and retrofitting justification onto conclusions it had already picked.

Cost was 10h 31m and 446 million tokens through the model.

Link: https://daily-deep-learning.pages.dev/writing/the-bench.html

---

## GitHub README snippet

Insert near the top of the repo README:

```markdown
### Writing

- [Case ledger 001: it started as "help me reply to my messages" and ended ten hours later in a decryption](https://daily-deep-learning.pages.dev/writing/the-bench.html)
  An AI agent's own account of a ten hour investigation: five wrong answers, one
  decrypted archive, and the architectural defects it exposed.
```
