"""Resume claims -> ownership ledger sync.

Scans the resume generator (new-recruit/resumes_2026/gen.py) for technology
claims, diffs them against skills.json, and appends any claimed-but-untracked
skill as a resume_risk row (seeded current=1: a claim with no ledger evidence
is Recall-level until proven). Existing rows are never modified — the operator
owns levels; this script only closes the claim->ledger gap.

Run: py tools/sync_resume_skills.py            (from the repo root)
Wired into the weekly council (ROUTINE.md section 0).
"""
import json, re, sys, io
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEN = Path(r"C:/Users/shova/Downloads/new-recruit/resumes_2026/gen.py")
LEDGER = ROOT / "skills.json"

# canonical claim vocabulary: token pattern -> (skill id, name, area, default target)
VOCAB = {
    r"power ?bi":            ("power-bi", "Power BI (DAX, modeling, RLS)", "data", 4),
    r"looker( studio)?":     ("looker-studio", "Looker Studio", "data", 3),
    r"tableau":              ("tableau", "Tableau", "data", 2),
    r"salesforce":           ("salesforce", "Salesforce (API/CRM)", "backend", 2),
    r"hubspot":              ("hubspot", "HubSpot (API/CRM)", "backend", 2),
    r"chatwoot":             ("chatwoot", "Chatwoot (API)", "backend", 3),
    r"airflow":              ("airflow", "Airflow", "data", 3),
    r"snowflake":            ("snowflake", "Snowflake", "databases", 2),
    r"databricks":           ("databricks", "Databricks", "data", 2),
    r"kafka":                ("kafka", "Kafka", "data", 2),
    r"redis":                ("redis", "Redis", "databases", 3),
    r"mongodb|mongo":        ("mongodb", "MongoDB", "databases", 2),
    r"supabase":             ("supabase", "Supabase", "databases", 3),
    r"n8n":                  ("n8n", "n8n automation", "agents", 3),
    r"langchain":            ("langchain", "LangChain", "agents", 3),
    r"langgraph":            ("langgraph", "LangGraph", "agents", 3),
    r"terraform":            ("iac", None, None, None),        # maps onto existing iac row
    r"bicep":                ("iac", None, None, None),
    r"kubernetes|k8s":       ("kubernetes", None, None, None),
    r"spark":                ("spark", None, None, None),
    r"tensorflow":           ("tensorflow", "TensorFlow", "ml", 2),
    r"grafana":              ("grafana", "Grafana", "devops", 2),
    r"prometheus":           ("prometheus", "Prometheus", "devops", 2),
    r"elasticsearch":        ("elasticsearch", "Elasticsearch", "databases", 2),
    r"selenium|playwright":  ("e2e-testing", "E2E testing (Playwright)", "devops", 3),
    r"fastapi":              ("fastapi", None, None, None),
    r"graphql":              ("graphql", "GraphQL", "backend", 2),
    r"grpc":                 ("grpc", "gRPC", "backend", 2),
    r"websocket":            ("websockets", "WebSockets", "backend", 3),
}

def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    text = GEN.read_text(encoding="utf-8", errors="replace").lower()
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    have = {s["id"] for s in ledger["skills"]}
    added, seen = [], set()
    for pat, (sid, name, area, target) in VOCAB.items():
        if sid in seen or not re.search(pat, text):
            continue
        seen.add(sid)
        if sid in have or name is None:
            continue  # tracked already, or an alias onto an existing row
        added.append({
            "id": sid, "name": name, "area": area, "arms": [],
            "target": target, "current": 1, "resume_risk": True,
            "source": "resume-sync",
        })
    if added:
        ledger["skills"].extend(added)
        LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"claims scanned: {len(seen)} matched; new ledger rows: {len(added)}")
    for a in added:
        print(f"  + {a['id']} (target {a['target']}, resume_risk) — {a['name']}")

if __name__ == "__main__":
    main()
