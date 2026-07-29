# Link integrity for the connections graph (MASTER-PLAN W3).
# Every id referenced anywhere must resolve. Run by the council weekly and
# before manual data commits. Exit 1 on orphans.
import json, sys, io, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda f: json.load(open(os.path.join(R, f), encoding="utf-8"))

talents, skills, concepts = J("talents.json"), J("skills.json"), J("concepts.json")
syllabus = J("syllabus.json")
DOMAINS = {"cs","math","swe","backend","db","de","ml","dl","llm","rag","agents","evals",
           "mlops","cloud","devops","sec","dist","sysdes","fde","interview","research","harness"}

nodes = {n["id"]: n for t in talents["trees"] for tier in t["tiers"] for n in tier["nodes"]}
skill_ids = {s["id"] for s in skills["skills"]}
concept_ids = {c["id"] for c in concepts["concepts"]}
errs = []

for nid, n in nodes.items():
    for d in n.get("domains", []):
        if d not in DOMAINS: errs.append(f"node {nid}: unknown domain '{d}'")
    for s in n.get("skills", []):
        if s not in skill_ids: errs.append(f"node {nid}: unknown skill '{s}'")
    if n.get("req") and n["req"] not in nodes: errs.append(f"node {nid}: req '{n['req']}' missing")
for s in talents.get("synergies", []):
    for k in ("from", "to"):
        if s[k] not in nodes: errs.append(f"synergy {s}: '{s[k]}' missing")
for c in concepts["concepts"]:
    if c.get("node") and c["node"] not in nodes: errs.append(f"concept {c['id']}: node '{c['node']}' missing")
    for r in c.get("rel", []):
        if r not in concept_ids: errs.append(f"concept {c['id']}: rel '{r}' missing")
for season in syllabus["seasons"]:
    for w in season["weeks"]:
        for d in w["days"]:
            for nid in d.get("nodes", []):
                if nid not in nodes: errs.append(f"syllabus day {d['day']}: node '{nid}' missing")
            for sid in d.get("skills", []):
                if sid not in skill_ids: errs.append(f"syllabus day {d['day']}: skill '{sid}' missing")

# curriculum.json + goals.json (SYSTEM-SPEC 4.2 step 3). Checked against what is
# ON DISK, not against the builder's in-memory output, so a hand-edit or a stale
# file fails here rather than rendering an empty node sheet.
TREE_BY_MOSCOW = {"must": "pvp", "should": "between", "could": "pve", "wont": "pve"}
cur_path = os.path.join(R, "curriculum.json")
units = []
if os.path.exists(cur_path):
    units = J("curriculum.json")["units"]
    goal_ids = {g["id"] for g in J("goals.json")["goals"]}
    unit_ids, taught = set(), set()
    for u in units:
        taught.update(u.get("teaches", []))
    for u in units:
        if u["id"] in unit_ids: errs.append(f"unit {u['id']}: duplicate id")
        unit_ids.add(u["id"])
        if u["node"] not in nodes: errs.append(f"unit {u['id']}: node '{u['node']}' missing")
        for s in u.get("skills", []):
            if s not in skill_ids: errs.append(f"unit {u['id']}: skill '{s}' missing")
        for g in u.get("goals", []):
            if g not in goal_ids: errs.append(f"unit {u['id']}: goal '{g}' missing")
        for c in u.get("requires", []):
            if c not in taught: errs.append(f"unit {u['id']}: requires '{c}', which no unit teaches")
        if u["tree"] != TREE_BY_MOSCOW[u["moscow"]]:
            errs.append(f"unit {u['id']}: tree '{u['tree']}' does not derive from moscow '{u['moscow']}'")
        if u["volatile"] and u["staleAfterDays"] is None:
            errs.append(f"unit {u['id']}: volatile without staleAfterDays")

    # A lesson file with no unit behind it is unreachable: the app only fetches
    # units/<id>.md for ids that exist in curriculum.json.
    udir = os.path.join(R, "units")
    bodies = [f[:-3] for f in os.listdir(udir) if f.endswith(".md")] if os.path.isdir(udir) else []
    for b in bodies:
        if b not in unit_ids: errs.append(f"units/{b}.md: no unit '{b}' in curriculum.json")

print(f"nodes={len(nodes)} skills={len(skill_ids)} concepts={len(concept_ids)} "
      f"units={len(units)} bodies={len(bodies) if 'bodies' in dir() else 0} errors={len(errs)}")
for e in errs: print(" !", e)
sys.exit(1 if errs else 0)
