# Builds talents.json v2 per MASTER-PLAN: 42 nodes, 5 named tiers/tree,
# synergies, kinds, capstones, domain/skill connections. Old ids preserved.
import json, os

p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "talents.json")
old = json.load(open(p, encoding="utf-8"))
oldreq = {}
for t in old["trees"]:
    for tier in t["tiers"]:
        for n in tier["nodes"]:
            if n.get("req"):
                oldreq[n["id"]] = n["req"]

def N(id, name, en, line, kind, domains, skills=None, req=None):
    d = {"id": id, "name": name, "en": en, "line": line, "kind": kind, "domains": domains}
    if skills: d["skills"] = skills
    r = req or oldreq.get(id)
    if r: d["req"] = r
    return d

v2 = {
 "note": "v2 (2026-07-25): 42 nodes over 5 named tiers per tree, per MASTER-PLAN. Points EARNED from answers, SPENT by choice. Tier t opens at 3*t spent in tree AND learner level >= tier_levels[t]. Ranks 4-5 on skill-linked nodes are EVIDENCE-GATED by the ledger. Old node ids preserved (S.ranks survive).",
 "max_rank": 5, "tier_gate": 3, "tier_levels": [1, 2, 3, 5, 7],
 "synergies": [
  {"from": "sql-core", "to": "data-pipelines", "note": "שאילתות חזקות הן חצי מכל pipeline"},
  {"from": "math-la", "to": "optimization", "note": "בלי אלגברה אין גרדיאנטים"},
  {"from": "dsa", "to": "sysdesign", "note": "סיבוכיות היא שפת התכנון"},
  {"from": "llm-core", "to": "rag-search", "note": "הבנת הטוקנים קובעת את ה-chunking"},
  {"from": "rag-search", "to": "agents-loop", "note": "סוכן טוב הוא retrieval טוב עם ידיים"},
  {"from": "evals-obs", "to": "agents-loop", "note": "בלי evals אין שיפור מבוקר"},
  {"from": "containers", "to": "iac-infra", "note": "קונטיינר הוא היחידה שה-IaC מסדר"},
  {"from": "cicd-pipe", "to": "mlops", "note": "MLOps הוא CI/CD עם דאטה"},
  {"from": "secrets-auth", "to": "sec-gov", "note": "least privilege מתחיל בסודות"}
 ],
 "trees": [
  {"id": "systems", "name": "מערכות", "tiers": [
   {"name": "יסודות", "nodes": [
    N("os", "מערכות הפעלה", "Operating Systems", "תהליכים, זיכרון, מה קורה בין שתי שורות פייתון", "passive", ["cs"]),
    N("storage", "אחסון", "Storage", "קבצים, אינדקסים, איפה הדאטה באמת גר", "passive", ["cs", "db"]),
    N("dsa", "מבני נתונים ואלגוריתמים", "DS&A", "המחיר בזמן ובזיכרון של כל בחירה; שפת הראיונות", "active", ["cs", "interview"], ["python"]),
    N("math-la", "אלגברה לינארית", "Linear Algebra", "וקטורים, מטריצות, eigen/SVD: הגיאומטריה של הלמידה", "passive", ["math"])]},
   {"name": "רשתות", "nodes": [
    N("net", "רשתות", "Networking", "HTTP/TCP/DNS: איך ביטים חוצים את העולם", "passive", ["cs"]),
    N("search", "חיפוש", "Search & Retrieval", "אינדקסים הפוכים, BM25, וקטורים", "active", ["rag"], ["rag"]),
    N("sql-core", "ליבת SQL", "SQL Mastery", "joins, windows, CTEs, query plans: לקרוא דאטה כמו שפה", "active", ["db", "interview"], ["sql"], "storage"),
    N("concurrency", "מקביליות", "Concurrency & Async", "threads, async, races: לרוץ מהר בלי להתנגש", "passive", ["cs"], None, "os")]},
   {"name": "מנועים", "nodes": [
    N("lang", "שפות", "Languages & Compilers", "מה המהדר עושה למה שכתבת", "passive", ["cs"]),
    N("build", "בנייה", "Build Systems", "מה-Makefile ועד artifact: איך קוד הופך למוצר", "active", ["swe", "devops"], ["makefile", "toml", "yaml"]),
    N("data-pipelines", "צינורות דאטה", "Data Engineering", "ETL/ELT, batch/stream, medallion: דאטה בתנועה", "active", ["de"], ["spark", "pandas-da"], "sql-core"),
    N("prob-stats", "הסתברות וסטטיסטיקה", "Probability & Statistics", "בייס, CLT, מבחנים: לחשוב באי-ודאות", "passive", ["math"])]},
   {"name": "הנדסת-מערכת", "nodes": [
    N("distributed", "מערכות מבוזרות", "Distributed Systems", "CAP, תורים, idempotency, המיתוס של exactly-once", "passive", ["dist"]),
    N("db-prod", "בסיסי נתונים בפרודקשן", "Databases in Production", "מיגרציות, רפליקציה, pooling, RLS", "active", ["db"], ["postgresql"], "sql-core"),
    N("optimization", "אופטימיזציה", "Optimization", "קמירות, GD/SGD/Adam, למה זה מתכנס", "passive", ["math", "ml"], None, "math-la")]},
   {"name": "אדריכלות", "nodes": [
    N("sysdesign", "תכנון מערכות", "System Design Mastery", "קיבולת, trade-offs, איפה זה יישבר: הקאפסטון", "capstone", ["sysdes", "interview"], ["system-design"], "distributed")]}
  ]},
  {"id": "craft", "name": "מלאכה", "tiers": [
   {"name": "סדנה", "nodes": [
    N("api", "ממשקים", "APIs", "REST/GraphQL/gRPC: חוזים בין מערכות", "active", ["backend"], ["fastapi"]),
    N("frontend", "חזית", "Frontend Craft", "ה-DOM, ה-render loop, וה-juice", "active", ["swe"], ["react-next", "typescript"]),
    N("clean-code", "קוד נקי", "Software Craft", "SOLID, refactoring, testing pyramid: קוד שחיים איתו", "active", ["swe"], ["python"]),
    N("py-prod", "פייתון לפרודקשן", "Production Python", "packaging, typing, profiling: מעבר לסקריפט", "active", ["swe", "backend"], ["python"])]},
   {"name": "מכונות-חשיבה", "nodes": [
    N("arch", "ארכיטקטורה", "Architecture", "גבולות, שכבות, חוזים: הצורה של המערכת", "passive", ["sysdes"], None, "api"),
    N("aiux", "חוויית AI", "AI Experience", "ממשקים שמסבירים את עצמם, streaming, אמון", "active", ["fde", "swe"], None, "frontend"),
    N("llm-core", "ליבת LLM", "LLM Internals", "טוקנים, attention, KV cache, מתי LLM ומתי לא", "passive", ["llm"]),
    N("ts-web", "TypeScript", "TypeScript & the Web Platform", "טיפוסים כתיעוד חי; הפלטפורמה כ-framework", "active", ["swe"], ["typescript"])]},
   {"name": "אומנות", "nodes": [
    N("product", "מוצר", "Product Sense", "מי המשתמש, מה הכאב, מה המדד", "passive", ["fde"]),
    N("research", "מחקר", "Research Literacy", "לקרוא paper: baselines, ablations, מה אמיתי", "passive", ["research"], None, "arch"),
    N("rag-search", "RAG וחיפוש", "RAG & Search", "chunking, hybrid, reranking, faithfulness", "active", ["rag"], ["rag"], "llm-core"),
    N("agents-loop", "לולאת הסוכן", "Agent Harness", "tools, planning, memory, MCP: intent אל action מאומת", "active", ["agents", "harness"], ["agents-orch", "mcp"], "llm-core")]},
   {"name": "הנדסת-דעת", "nodes": [
    N("evals-obs", "הערכה ותצפית", "Evals & Observability", "golden sets, judges, traces: בלי זה אין שיפור", "active", ["evals"], ["evals"], "agents-loop"),
    N("ml-applied", "ML יישומי", "Applied ML", "baselines, leakage, calibration: המלאכה של המודלים", "active", ["ml"], ["ml-classic", "pytorch"]),
    N("fde", "הנדסה קדמית", "Forward-Deployed Craft", "מעמימות עסקית למערכת עובדת אצל לקוח", "passive", ["fde"], None, "product")]},
   {"name": "יצירת-מופת", "nodes": [
    N("craft-master", "AI כמוצר", "Productized AI Mastery", "מערכת AI בטוחה, מדידה, שמישהו משלם עליה: הקאפסטון", "capstone", ["fde", "agents", "harness"], ["agents-orch", "evals"], "evals-obs")]}
  ]},
  {"id": "ops", "name": "תפעול", "tiers": [
   {"name": "משמרת", "nodes": [
    N("sre", "אמינות", "SRE Basics", "SLI/SLO, on-call, מה נשבר קודם", "passive", ["devops"]),
    N("edge", "קצה וענן", "Cloud & Edge", "IaaS/PaaS/FaaS: סולם השליטה-מול-מהירות", "passive", ["cloud"]),
    N("git-flow", "זרימת גיט", "Git Internals & Flow", "branches, rebase, מה באמת קורה ב-.git", "active", ["devops"], ["git"]),
    N("containers", "קונטיינרים", "Containers", "images, layers, compose: היחידה הניידת", "active", ["devops"], ["docker"])]},
   {"name": "מסילות", "nodes": [
    N("finops", "כלכלת ענן", "FinOps", "cost attribution, מי שורף מה", "passive", ["cloud"], None, "sre"),
    N("platform", "פלטפורמה", "Platform Engineering", "golden paths: להפוך תשתית למוצר פנימי", "passive", ["devops"]),
    N("cicd-pipe", "מסועי CI/CD", "CI/CD Pipelines", "build-test-deploy: הדרך מהקומיט לפרוד", "active", ["devops"], ["cicd"], "git-flow"),
    N("config-lang", "שפות תצורה", "Config Languages", "TOML/YAML/Make: הדקדוק של התשתית", "active", ["devops"], ["toml", "yaml", "makefile"])]},
   {"name": "מצודה", "nodes": [
    N("org", "ארגון", "Org Dynamics", "Conway, ownership, איך החלטות באמת מתקבלות", "passive", ["fde"], None, "platform"),
    N("company", "חברה", "Company Building", "מהפרויקט למוצר לעסק", "passive", ["fde"], None, "finops"),
    N("azure-core", "ליבת Azure", "Azure Core", "Functions, Foundry, identities, KV: הבית שלך", "active", ["cloud"], ["azure-functions", "azure-foundry"]),
    N("secrets-auth", "סודות והזדהות", "Secrets & Auth", "OAuth, Entra, least privilege", "active", ["sec"], ["security-auth"])]},
   {"name": "הנדסת-מבצעים", "nodes": [
    N("iac-infra", "תשתית כקוד", "Infrastructure as Code", "Terraform/Bicep: הסביבה כקובץ מבוקר", "active", ["devops", "cloud"], ["iac"], "containers"),
    N("mlops", "MLOps", "MLOps", "registry, drift, canary: מודלים בפרודקשן", "active", ["mlops"], ["cicd"], "cicd-pipe"),
    N("sec-gov", "אבטחה וממשל", "Security & Governance", "threat model, OWASP, prompt injection", "active", ["sec"], ["pii", "security-auth"], "secrets-auth")]},
   {"name": "פיקוד", "nodes": [
    N("prod-own", "בעלות על פרודקשן", "Production Ownership", "merged+deployed+smoked: הקאפסטון של האמת", "capstone", ["devops", "cloud", "sec"], ["cicd", "docker"], "iac-infra")]}
  ]}
 ]
}

json.dump(v2, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
total = sum(len(tier["nodes"]) for t in v2["trees"] for tier in t["tiers"])
print("nodes:", total, "| synergies:", len(v2["synergies"]))
