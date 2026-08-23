"""Mine the SQL book corpus into book-street drills.

Purpose: the game's content must come from the books, not from hand-authored
imitations of one coaching session. This walks the corpus at BOOKS_DIR,
extracts (section, prose, SQL example) triples, masks one load-bearing
clause per example, builds three distractors from the same clause family
elsewhere in the corpus, and emits game/bank/book-drills.json.

Output is gitignored with the rest of bank/: it contains book text and the
repository is public. Rerun any time; deterministic given the same corpus.

Contracts: stdlib only. Extraction is conservative: an example without a
clean mask candidate or without three distinct distractors is dropped, not
padded with fabrications. Caps excerpt prose at 600 chars.
"""
import hashlib
import json
import os
import re
from pathlib import Path

BOOKS = Path(os.environ.get("BOOKS_DIR", str(Path.home() / "claude-setup/docs/books")))
OUT = Path(__file__).resolve().parent.parent / "bank" / "book-drills.json"
MAX_DRILLS = 24

SQL_SOURCES = [
    "*SQL for Data Analysis*.txt", "ADVANCEDSQL*.txt", "ADAVANCEDSQL*.txt",
    "dist_sql*.txt", "amazon_aurora_sql*.txt",
]

# Each mask family: (name, regex over the SQL, human label for the blank)
MASKS = [
    ("window", re.compile(r"\b(row_number|rank|dense_rank|lag|lead|ntile|first_value|last_value|sum|avg|count|max|min)\s*\(\s*[^)]*\)\s+over\s*\(([^)]*)\)", re.I), "ה-window"),
    ("date_trunc", re.compile(r"\bdate_trunc\s*\(\s*'(\w+)'", re.I), "רזולוציית הזמן"),
    ("group_by", re.compile(r"\bgroup\s+by\s+([^\n;]+)", re.I), "ה-GROUP BY"),
    ("join_on", re.compile(r"\bjoin\s+[\w.]+(?:\s+\w+)?\s+on\s+([^\n;]+?)(?=\s+(?:left|right|inner|outer|join|where|group|order)\b|;|\n)", re.I), "תנאי ה-JOIN"),
    ("case_when", re.compile(r"\bcase\s+when\s+(.+?)\s+then\b", re.I | re.S), "תנאי ה-CASE"),
]


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def sql_blocks(text: str):
    """Yield (start, sql) for plausible SQL examples in book text."""
    for m in re.finditer(r"(?:^|\n)\s*((?:SELECT|WITH)\b[\s\S]{60,900}?;)", text, re.I):
        sql = m.group(1)
        # book text sometimes glues prose onto code; demand SQL-ish density
        if sql.count("\n") < 1 and len(sql) > 300:
            continue
        low = sql.lower()
        if "from" not in low:
            continue
        yield m.start(1), re.sub(r"\n{2,}", "\n", sql)


def section_for(text: str, pos: int) -> str:
    window = text[max(0, pos - 4000):pos]
    heads = re.findall(r"(?:^|\n)(Chapter [^\n]{3,80}|[A-Z][A-Za-z][^\n]{3,60})\n", window)
    head = clean(heads[-1]) if heads else ""
    # a heading that is really a SQL fragment is worse than none
    return "" if re.search(r"\b(FROM|SELECT|WHERE|GROUP)\b", head, re.I) else head


def prose_before(text: str, pos: int) -> str:
    window = text[max(0, pos - 2500):pos]
    # strip earlier code from the window, keep the last real paragraph(s)
    parts = [p for p in re.split(r"\n\s*\n", window) if not re.search(r"\bSELECT\b|\bFROM\b", p, re.I)]
    prose = clean(" ".join(parts[-2:]))
    return prose[-600:]


def collect():
    files: list[Path] = []
    for pat in SQL_SOURCES:
        files.extend(sorted(BOOKS.glob(pat)))
    pools: dict[str, list[str]] = {name: [] for name, _, _ in MASKS}
    raw = []
    for src in files:
        try:
            text = src.read_text(errors="ignore")
        except OSError:
            continue
        for pos, sql in sql_blocks(text):
            for name, rx, label in MASKS:
                m = rx.search(sql)
                if not m:
                    continue
                answer = clean(m.group(m.lastindex or 0) if m.lastindex else m.group(0))
                if not 3 <= len(answer) <= 90:
                    break
                if re.fullmatch(r"[\d,\s]+", answer):
                    break  # positional GROUP BY 1,2 teaches nothing as a blank
                pools[name].append(answer)
                raw.append({
                    "source": src.stem[:60], "section": section_for(text, pos),
                    "prose": prose_before(text, pos), "sql": sql.strip(),
                    "mask": name, "label": label, "answer": answer,
                    "span": [m.start(m.lastindex or 0) if m.lastindex else m.start(0),
                             m.end(m.lastindex or 0) if m.lastindex else m.end(0)],
                })
                break
    return raw, pools


def main() -> None:
    if not BOOKS.is_dir():
        raise SystemExit(f"BOOKS_DIR not found: {BOOKS}")
    raw, pools = collect()
    drills, seen = [], set()
    for r in raw:
        h = hashlib.sha1(r["sql"].encode()).hexdigest()[:10]
        if h in seen or not r["prose"]:
            continue
        seen.add(h)
        seen_l = {r["answer"].lower()}
        family = []
        for a in dict.fromkeys(pools[r["mask"]]):
            if a.lower() in seen_l or ":" in a or len(a.split()) > 12:
                continue  # prose leaks and near-duplicates make hollow distractors
            seen_l.add(a.lower())
            family.append(a)
        if len(family) < 3:
            continue
        # deterministic distractors: nearest three by length difference
        distractors = sorted(family, key=lambda a: abs(len(a) - len(r["answer"])))[:3]
        s, e = r["span"]
        masked = r["sql"][:s] + "________" + r["sql"][e:]
        options = sorted([r["answer"], *distractors])
        drills.append({
            "id": f"book-{h}", "source": r["source"], "section": r["section"],
            "prose": r["prose"], "sqlMasked": masked.strip(), "maskLabel": r["label"],
            "options": options, "correct": options.index(r["answer"]),
        })
        if len(drills) >= MAX_DRILLS:
            break
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(drills, ensure_ascii=False, indent=1))
    by_mask: dict[str, int] = {}
    for d in drills:
        k = d["maskLabel"]
        by_mask[k] = by_mask.get(k, 0) + 1
    print(f"{len(drills)} book drills -> {OUT}")
    print("by mask:", by_mask)
    for d in drills[:3]:
        print("--", d["source"], "|", d["section"][:40], "|", d["maskLabel"], "| ans:", d["options"][d["correct"]][:50])


if __name__ == "__main__":
    main()
