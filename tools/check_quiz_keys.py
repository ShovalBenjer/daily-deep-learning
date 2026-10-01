#!/usr/bin/env python3
"""Deterministic oracle for the lesson pipeline's scored values.

Research basis: Executive_MCP_Research.md Finding B ("never let the LLM do
math", Tableau Pulse design rule) — LLMs hallucinate numbers at production
rates (documented 10x errors, e.g. Power BI Copilot reporting 3% for 0.3%).
This repo's daily lesson agent hand-writes the fenced ```quiz / ```fillin
JSON that drives quizzes and drills. tools/close_unit.py validates fence
*counts* and JSON *parseability*, but never the scored content: a wrong
`answer` index teaches the learner the wrong thing, silently.

This checker is the deterministic guard: it recomputes nothing, it *verifies*
the LLM-invented scored values against the schema contract. Hermetic, stdlib
only, no secrets. Exit 1 on any breach.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ("units", "posts")

#: Fence kinds this oracle judges. widget/concepts are out of scope:
#: widgets render, they do not score.
FENCES = ("quiz", "fillin")

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)
    print("FAIL " + msg)


def check_quiz(data: dict, where: str) -> None:
    qid = data.get("id", "?")
    tag = f"{where} quiz {qid}"
    if not isinstance(data.get("id"), str) or not data["id"].strip():
        fail(f"{tag}: missing id")
    if not isinstance(data.get("q"), str) or not data["q"].strip():
        fail(f"{tag}: missing question text")
    options = data.get("options")
    if not isinstance(options, list) or len(options) < 2:
        fail(f"{tag}: need >= 2 options, got {options!r}")
        return
    if any(not isinstance(o, str) or not o.strip() for o in options):
        fail(f"{tag}: every option must be a non-empty string")
    if len({o.strip() for o in options}) != len(options):
        fail(f"{tag}: duplicate options")
    answer = data.get("answer")
    # The Finding-B core: the scored value must point at a real option.
    if not isinstance(answer, int) or isinstance(answer, bool):
        fail(f"{tag}: answer must be an option index, got {answer!r}")
    elif not 0 <= answer < len(options):
        fail(f"{tag}: answer index {answer} out of range for "
             f"{len(options)} options")
    if not isinstance(data.get("explain"), str) or not data["explain"].strip():
        fail(f"{tag}: missing explanation")


def check_fillin(data: dict, where: str) -> None:
    fid = data.get("id", "?")
    tag = f"{where} fillin {fid}"
    if not isinstance(data.get("id"), str) or not data["id"].strip():
        fail(f"{tag}: missing id")
    if not isinstance(data.get("prompt"), str) or not data["prompt"].strip():
        fail(f"{tag}: missing prompt")
    answer = data.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        fail(f"{tag}: missing answer string")
        return
    alt = data.get("alt", [])
    if not isinstance(alt, list) or any(
            not isinstance(a, str) or not a.strip() for a in alt):
        fail(f"{tag}: alt must be a list of non-empty strings")


def main() -> int:
    seen_ids: dict[str, str] = {}
    n_quiz = n_fillin = 0
    for dname in SCAN_DIRS:
        d = ROOT / dname
        if not d.is_dir():
            continue
        for path in sorted(d.glob("*.md")):
            md = path.read_text(encoding="utf-8")
            for kind in FENCES:
                for m in re.finditer("```" + kind + r"\n(.*?)\n```", md, re.S):
                    body = m.group(1)
                    where = f"{dname}/{path.name}"
                    if "\n" in body:
                        fail(f"{where} {kind}: fence spans more than one line")
                        continue
                    try:
                        data = json.loads(body)
                    except json.JSONDecodeError as exc:
                        fail(f"{where} {kind}: invalid JSON: {exc}")
                        continue
                    if not isinstance(data, dict):
                        fail(f"{where} {kind}: top level must be an object")
                        continue
                    fid = data.get("id")
                    if isinstance(fid, str) and fid:
                        if fid in seen_ids:
                            fail(f"{where}: duplicate id {fid!r} "
                                 f"(also in {seen_ids[fid]})")
                        else:
                            seen_ids[fid] = where
                    if kind == "quiz":
                        n_quiz += 1
                        check_quiz(data, where)
                    else:
                        n_fillin += 1
                        check_fillin(data, where)
    if failures:
        print(f"{len(failures)} quiz-key breach(es); "
              f"checked {n_quiz} quiz + {n_fillin} fillin blocks")
        return 1
    print(f"OK quiz keys: {n_quiz} quiz + {n_fillin} fillin blocks, "
          f"{len(seen_ids)} unique ids")
    return 0


if __name__ == "__main__":
    sys.exit(main())
