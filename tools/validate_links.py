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

print(f"nodes={len(nodes)} skills={len(skill_ids)} concepts={len(concept_ids)} errors={len(errs)}")
for e in errs: print(" !", e)
sys.exit(1 if errs else 0)
