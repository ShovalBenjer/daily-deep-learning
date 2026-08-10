# ADR-0001: Python for the authoring tools, and not Rust, Go, or Bun

- **Status:** accepted
- **Date:** 2026-08-10
- **Supersedes:** the one-line justification in
  `docs/ENGINEERING-STANDARDS-2026-07-26.md` section 1, which read "7 tracked
  scripts. Corpus default for scripting and data work." That is an appeal to a
  default rather than an argument, and it was stale: there are 18 scripts now.

## Context

`tools/` holds 18 Python files, 2,461 lines. The import census across all of
them is stdlib except two entries:

```
pathlib 13   sys 11   json 9   re 4   shutil 2   datetime 2   argparse 2
urllib 1   tempfile 1   subprocess 1   os 1   hashlib 1   base64 1
third-party: PIL, playwright
```

They read JSON and markdown, walk an id graph across nine data files, copy an
allowlist into `dist/`, parse the inline script out of `index.html`, drive
Chrome over CDP, and slice art. Every one is a short-lived batch script invoked
once per commit or once per CI job.

The repo already runs two other language toolchains: TypeScript on Bun
(`daemon/server.ts`, all six files under `tests/`) and JavaScript on Cloudflare
Workers (`sadna-sync/worker.js`). The corpus rule this project claims to follow
is C4, "one boring language unless proven otherwise", and the project runs
three.

So the question is real and was never properly answered: why Python for this
surface, rather than Rust, Go, or folding the tools into the Bun toolchain that
is already here.

## Measurements

Measured 2026-08-10 on the WSL host, single runs rather than a distribution:

| Command | Wall time |
|---|---|
| `python3 tools/validate_links.py` | 37 ms |
| `python3 tools/check_inline_js.py` | 149 ms |
| `python3 tools/curriculum_budget.py` | 37 ms |
| `python3 tools/stage_site.py dist` | 57 ms |

Interpreter startup floor, same host:

| Runtime | Startup |
|---|---|
| `python3 -c pass` | 20 ms |
| `bun -e ''` | 98 ms |
| `node -e ''` | 100 ms |

`validate_links.py` covers 48 nodes, 49 skills, 241 concepts and 355 units
across `curriculum.json` (253 KB) and `domains.json` (269 KB) in 37 ms, of
which 20 ms is the interpreter booting. The actual work is about 17 ms.

## Decision

Keep Python for `tools/`. Add the toolchain that was specified fifteen days ago
and never installed: `pyproject.toml`, Ruff, mypy.

## Alternatives, and why each loses here

**Rust.** Its four real advantages, checked one at a time.

*Throughput*: the prize is 17 ms becoming roughly 1 ms, on a script that runs
once per commit. *Memory safety in a long-running process*: there is no
long-running Python here; the only daemon is already TypeScript. *Single binary
with no runtime*: this reverses, because `ubuntu-latest` and WSL both ship
`python3`, so the tools cost zero install today, while a Rust tool costs either
a cargo toolchain in CI or per-platform binaries committed to the repo.
*Compile-time guarantees over the schema*: the strongest argument, and the one
that nearly wins. `tools/validate_links.py` exists only because ids
cross-reference between nine JSON files with nothing enforcing it, and serde
over typed structs would make most of that impossible by construction.

What defeats it is churn, not effort. The content model changed from
`posts/YYYY-MM-DD.md` to `units/<id>.md` on 2026-07-29, and `curriculum.json`
went from 322 to 355 units on 2026-08-08. A schema still moving weekly turns a
compile-time contract into a recompile tax on every content decision. Rust pays
off after the schema stabilises, not while it is the thing being designed.

Note for the next reader, because the first draft of this argument got it
wrong: a Rust binary in `tools/` does **not** violate the stated non-goals.
`AGENTS.md` bans "no bundler, no framework, no npm at the root", and all three
are about the shipped client. The authoring side already carries `PIL`,
`playwright`, `tools/gen_art.sh` and `daemon/bun.lock`. The case against Rust
here is cost against benefit, not a rule.

**Bun and TypeScript.** The strongest competitor, not Rust, because it would
take three languages to two and `tests/contract.test.ts` already parses
`index.html` so a tool could share that code instead of reimplementing it. The
measurement kills it: 98 ms of startup against 20 ms, five times the floor, on
scripts whose runtime is majority startup. The four tools CI runs would go from
about 280 ms to about 1.2 s in exchange for a rewrite that buys nothing.

**Go.** The better single-binary option if that ever becomes the requirement:
fast compile, stdlib JSON, no borrow checker over a moving schema. Same
zero-benefit problem as Rust at this scale, without Rust's serde upside.

**A schema language instead of a checker.** Found by a prior-art search on
2026-08-10 and recorded here because it is the alternative that most nearly
dissolves the question. Plain JSON Schema cannot express cross-document foreign
keys, and that is the spec's own documented scope decision rather than an
oversight (json-schema-org spec wiki, "Scope of JSON Schema Validation";
discussion #934). But Frictionless Data's Data Package spec has `foreignKeys`
with a `reference.resource` field aimed at exactly this, and CUE converts JSON
Schema constraints into CUE ones and can express relationships JSON Schema
cannot.

Rejected for now, not on principle: it would replace one script of eighteen.
`build_curriculum.py` (671 lines), `stage_site.py`, `check_inline_js.py` and
the CDP tools are not schema validation. Untested assumption, stated so it is
not mistaken for a finding: that either format can encode a graph spanning nine
files of heterogeneous shape. Nobody has attempted the encoding.

## Consequences

- `tools/` stays Python. Stop re-proposing a rewrite without new measurements.
- The real gap is not the language. 2,461 lines of Python have no lint, no
  formatter, no type checker and no declared dependency set. The only `.toml`
  in the repo is `sadna-sync/wrangler.toml`.
- `.gitattributes` is needed for a separate reason: `index.html` is 151,408
  bytes of which 144,667 (95.5%) is one inline `<script>`, so linguist reports
  a JavaScript application as 78.3% HTML and Python at 10.4% looks larger in
  the bar than it is in the repo.

## Falsifiers

Any one of these reopens the decision. None holds today.

1. The id graph grows roughly 100x, to about 35,000 units. It is at 355.
2. A tool becomes a watch-mode process running per keystroke. None is.
3. The tools have to run on a machine that is not the operator's. One
   operator, one machine.
4. The content schema stops changing and `validate_links.py` goes a full
   season untouched. It changed this week.
