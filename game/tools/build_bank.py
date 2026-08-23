"""Build the local study bank from the operator's own book corpus.

Purpose: each drill gets up to three short excerpts (<=420 chars) pulled by
keyword from the corpus at BOOKS_DIR. Output lands in game/bank/*.json,
which is gitignored on purpose: the repository and the Pages deploy are
public, and book text must never reach either. Run it locally, replay it
any time; deleting bank/ loses nothing that cannot be rebuilt.

Contracts: stdlib only; never copies files; excerpt cap enforced; a drill
with no hits gets an empty list rather than a fabricated quote.
"""
import json
import os
import re
from pathlib import Path

BOOKS = Path(os.environ.get("BOOKS_DIR", str(Path.home() / "claude-setup/docs/books")))
OUT = Path(__file__).resolve().parent.parent / "bank"

DRILL_KEYWORDS: dict[str, list[str]] = {
    "approval-rate": ["conditional aggregation", "CASE WHEN", "GROUP BY", "HAVING"],
    "monthly-rollup": ["DATE_TRUNC", "time series", "monthly", "rollup"],
    "window-top-per-category": ["window function", "ROW_NUMBER", "PARTITION BY", "RANK"],
    "case-file-1": ["card testing", "fraud triangle", "long firm", "distributed trust", "fraud"],
}

SOURCES = sorted(list(BOOKS.glob("ADVANCEDSQL*.txt")) + list(BOOKS.glob("ADAVANCEDSQL*.txt"))
                 + list(BOOKS.glob("*SQL for Data Analysis*.txt"))
                 + list(BOOKS.glob("*Lying*.txt")) + list(BOOKS.glob("*world go round*.txt")))


def excerpts_for(keywords: list[str]) -> list[dict]:
    hits: list[dict] = []
    for src in SOURCES:
        try:
            text = src.read_text(errors="ignore")
        except OSError:
            continue
        for kw in keywords:
            for m in re.finditer(re.escape(kw), text, re.IGNORECASE):
                start = text.rfind(".", 0, m.start()) + 1
                chunk = text[start:start + 420].strip()
                chunk = re.sub(r"\s+", " ", chunk)
                if len(chunk) > 120:
                    hits.append({"source": src.stem[:60], "excerpt": chunk})
                    break  # one excerpt per keyword per source
            if len(hits) >= 3:
                return hits[:3]
    return hits[:3]


def main() -> None:
    if not BOOKS.is_dir():
        raise SystemExit(f"BOOKS_DIR not found: {BOOKS}")
    OUT.mkdir(exist_ok=True)
    for drill, kws in DRILL_KEYWORDS.items():
        items = excerpts_for(kws)
        (OUT / f"{drill}.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
        print(f"{drill}: {len(items)} excerpts")


if __name__ == "__main__":
    main()
