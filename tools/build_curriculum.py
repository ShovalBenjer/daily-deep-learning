"""Derive curriculum.json and goals.json from the published enumerations.

Purpose: SYSTEM-SPEC-2026-07-26 section 4.2 step 1 requires the unit spine to be
DERIVED, deterministically, from lists that already exist in public tables of
contents and in this repo. Generation writes unit bodies later; nothing here
invents curriculum. This file is the enumeration of record for WHICH units
exist, the way tools/curriculum_budget.py is for how many.

Contracts: every topic below traces to a named source. `tree` is derived from
`moscow` and is never set independently (must->pvp, should->between,
could/wont->pve), per spec 1.1. Node and skill ids are validated against
talents.json and skills.json before writing, so a typo fails here rather than
rendering an empty node sheet. Rerunning is idempotent: same input, same file.

Agent-context: run it after editing an enumeration. It overwrites curriculum.json
and goals.json wholesale, so hand-edits to those files do not survive. Unit
bodies live in body.status/generated/hash and are carried across a rerun by
carry_bodies(), unconditionally. This file previously documented a --keep-bodies
flag that was never implemented; measured on 2026-07-29, a plain rerun reset all
three written bodies to pending.

Typical usage::

    python tools/build_curriculum.py
    python tools/validate_links.py
"""

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent

TREE_BY_MOSCOW = {"must": "pvp", "should": "between", "could": "pve", "wont": "pve"}

#: Goals are the only thing that orders the map (spec 1.3). A unit no active
#: goal points at sinks on its own rather than being special-cased.
GOALS = [
    {"id": "hire-2026-09-30", "deadline": "2026-09-30", "weight": 1.0, "active": True,
     "he": "חתימה על חוזה עד סוף ספטמבר"},
    {"id": "ai103-sit", "deadline": "2026-09-15", "weight": 0.7, "active": True,
     "he": "לגשת למבחן AI-103"},
    {"id": "interviews-3wk", "cadence": "weekly", "target": 3, "weight": 0.9, "active": True,
     "he": "שלושה ראיונות בשבוע"},
    {"id": "msc-application", "deadline": "2027-03-01", "weight": 0.4, "active": True,
     "he": "מועמדות לתואר שני"},
]

HIRE = ["hire-2026-09-30"]

# Topic tuples are (slug, english, hebrew, drill). drill=True emits a second
# `practice` unit so the workout composer can ask for one teach plus one drill
# without parsing content (spec 1.1, adopted from Exercism).
BLOCKS = [
    {
        "id": "M0", "moscow": "must", "node": "os", "skills": ["sdlc"], "difficulty": 2,
        "title": "The vocabulary of the machine", "he": "אוצר המילים של המכונה",
        "source": {"kind": "gap", "name": "CURRICULUM-MOSCOW-2026-07-26 M0"},
        "estMin": 6, "depthEstMin": 25, "goals": HIRE,
        "topics": [
            ("shell-terminal", "Shell, terminal, console, prompt", "מעטפת, טרמינל, קונסולה, שורת פקודה", False),
            ("process", "What a process is", "מהו תהליך", False),
            ("streams", "stdin, stdout, stderr, exit codes", "זרמי קלט ופלט וקודי יציאה", True),
            ("pipes", "Pipes and redirection", "צינורות והפניה", True),
            ("path-lookup", "PATH and how a command is found", "PATH ואיך פקודה נמצאת", False),
            ("compiling", "What compiling is, and why Python and TypeScript feel different", "מהי קומפילציה", False),
            ("binary", "What a binary is", "מהו קובץ בינארי", False),
            ("ssh", "SSH: what it replaced, keys versus passwords, the fingerprint prompt", "SSH: מפתחות מול סיסמאות", False),
            ("ports-localhost", "Ports and localhost, why 127.0.0.1 and ::1 differ", "פורטים ו-localhost", True),
            ("env-vars", "Environment variables and where secrets actually live", "משתני סביבה וסודות", False),
            ("package-manager", "What a package manager does", "מה עושה מנהל חבילות", False),
            ("fs-paths", "Filesystem paths and permissions, POSIX versus Windows", "נתיבים והרשאות", False),
        ],
    },
    {
        "id": "M1", "moscow": "must", "node": "dsa", "skills": ["python"], "difficulty": 6,
        "title": "From-scratch code", "he": "קוד מאפס",
        "source": {"kind": "index", "name": "Grind75 and NeetCode 150 pattern taxonomy"},
        "estMin": 10, "depthEstMin": 40, "goals": HIRE,
        "topics": [
            ("arrays-hashing", "Arrays and hashing", "מערכים וגיבוב", True),
            ("two-pointers", "Two pointers", "שני מצביעים", True),
            ("sliding-window", "Sliding window", "חלון מחליק", True),
            ("binary-search", "Binary search and its variants", "חיפוש בינארי וגרסאותיו", True),
            ("stack", "Stack", "מחסנית", True),
            ("linked-list", "Linked list", "רשימה מקושרת", True),
            ("tree-traversal", "Tree traversal", "סריקת עצים", True),
            ("bst", "Binary search tree", "עץ חיפוש בינארי", True),
            ("trie", "Trie", "עץ תחיליות", True),
            ("heap-topk", "Heap and top-k", "ערימה ו-top-k", True),
            ("backtracking", "Backtracking", "נסיגה", True),
            ("graph-traversal", "Graph traversal", "סריקת גרפים", True),
            ("shortest-path", "Shortest path", "מסלול קצר ביותר", True),
            ("union-find", "Union-find", "איחוד-מציאה", True),
            ("dp-1d", "Dynamic programming, one dimension", "תכנון דינמי חד-ממדי", True),
            ("dp-2d", "Dynamic programming, two dimensions", "תכנון דינמי דו-ממדי", True),
            ("intervals", "Intervals", "קטעים", True),
            ("greedy", "Greedy", "חמדני", True),
            ("bit-manipulation", "Bit manipulation", "מניפולציית ביטים", True),
            ("matrix", "Matrix", "מטריצות", True),
        ],
    },
    {
        "id": "M2", "moscow": "must", "node": "sql-core", "skills": ["sql"], "difficulty": 5,
        "title": "SQL to ownership", "he": "SQL לבעלות מלאה",
        "source": {"kind": "index", "name": "DataLemur register, CURRICULUM-MOSCOW M2"},
        "estMin": 10, "depthEstMin": 35, "goals": HIRE,
        "topics": [
            ("joins", "Joins and their failure modes", "צירופים ואיך הם נכשלים", True),
            ("aggregation", "Aggregation and grouping", "אגרגציה וקיבוץ", True),
            ("window-functions", "Window functions", "פונקציות חלון", True),
            ("ctes", "CTEs and recursive CTEs", "CTE ו-CTE רקורסיבי", True),
            ("subqueries", "Subqueries versus joins", "תת-שאילתות מול צירופים", False),
            ("ranking", "Ranking", "דירוג", True),
            ("gaps-islands", "Gaps and islands", "פערים ואיים", True),
            ("date-time", "Date and time", "תאריך ושעה", True),
            ("pivoting", "Pivoting", "היפוך טבלה", False),
            ("dedup", "Deduplication", "הסרת כפילויות", True),
            ("query-plans", "Query plans and indexes", "תוכניות ריצה ואינדקסים", False),
            ("keyset-pagination", "Keyset pagination", "עימוד לפי מפתח", False),
        ],
    },
    {
        "id": "M3", "moscow": "must", "node": "sysdesign", "skills": ["system-design"], "difficulty": 7,
        "title": "System design, interview grade", "he": "תכנון מערכות ברמת ראיון",
        "source": {"kind": "index", "name": "ByteByteGo System Design Interview, published TOC"},
        "estMin": 12, "depthEstMin": 45, "goals": HIRE,
        "topics": [
            ("scale-zero-to-millions", "Scale from zero to millions", "מאפס למיליוני משתמשים", False),
            ("back-of-envelope", "Back-of-envelope estimation", "הערכה על גב מעטפה", True),
            ("interview-framework", "The interview framework", "מסגרת הראיון", False),
            ("chat-system", "Design a chat system", "תכנון מערכת צ'אט", False),
            ("rate-limiter", "Design a rate limiter", "מגביל קצב", False),
            ("consistent-hashing", "Consistent hashing", "גיבוב עקבי", False),
            ("key-value-store", "Design a key-value store", "מאגר מפתח-ערך", False),
            ("unique-id", "Unique ID generator", "מחולל מזהים ייחודיים", False),
            ("url-shortener", "Design a URL shortener", "מקצר כתובות", False),
            ("web-crawler", "Design a web crawler", "סורק אתרים", False),
            ("notification-system", "Design a notification system", "מערכת התראות", False),
            ("news-feed", "Design a news feed", "פיד חדשות", False),
            ("search-autocomplete", "Design search autocomplete", "השלמה אוטומטית בחיפוש", False),
            ("youtube", "Design YouTube", "תכנון YouTube", False),
            ("google-drive", "Design Google Drive", "תכנון Google Drive", False),
            ("proximity-service", "Design a proximity service", "שירות קרבה", False),
            ("nearby-friends", "Design nearby friends", "חברים בסביבה", False),
            ("google-maps", "Design Google Maps", "תכנון Google Maps", False),
            ("message-queue", "Design a distributed message queue", "תור הודעות מבוזר", False),
            ("metrics-monitoring", "Design metrics monitoring", "ניטור מדדים", False),
            ("ad-click-aggregation", "Design ad click aggregation", "צבירת קליקים", False),
            ("hotel-reservation", "Design a hotel reservation system", "מערכת הזמנות מלון", False),
            ("distributed-email", "Design a distributed email service", "שירות דואר מבוזר", False),
            ("s3-storage", "Design an S3-like object store", "אחסון אובייקטים", False),
            ("leaderboard", "Design a real-time leaderboard", "טבלת מובילים בזמן אמת", False),
            ("payment-system", "Design a payment system", "מערכת תשלומים", False),
            ("digital-wallet", "Design a digital wallet", "ארנק דיגיטלי", False),
            ("stock-exchange", "Design a stock exchange", "בורסה", False),
        ],
    },
    {
        "id": "M4", "moscow": "must", "node": "agents-loop",
        "skills": ["agents-orch", "mcp", "evals"], "difficulty": 7,
        "title": "Agents, MCP and evals to level 5", "he": "סוכנים, MCP והערכות לרמה 5",
        "source": {"kind": "ledger", "name": "skills.json level 4 to 5 targets"},
        "estMin": 12, "depthEstMin": 45, "goals": HIRE,
        "topics": [
            ("agent-architecture", "Agent architecture", "ארכיטקטורת סוכן", True),
            ("agent-orchestration", "Multi-agent orchestration", "תזמור רב-סוכנים", True),
            ("tool-schema-design", "Tool schema design", "עיצוב סכמת כלים", True),
            ("mcp-server", "MCP server internals", "מבנה שרת MCP", True),
            ("mcp-client", "MCP client internals", "מבנה לקוח MCP", True),
            ("mcp-transport", "MCP transport", "תעבורת MCP", False),
            ("trust-tiering", "Trust tiering for tools", "דירוג אמון בכלים", True),
            ("eval-design", "Eval design", "עיצוב הערכות", True),
            ("llm-judge", "LLM-judge calibration", "כיול שופט LLM", True),
            ("regression-tracking", "Regression tracking", "מעקב רגרסיות", True),
            ("observability", "Observability", "תצפיתיות", True),
            ("tracing", "Tracing", "מעקב ריצה", False),
            ("prompt-injection", "Prompt injection defenses", "הגנה מהזרקת פרומפט", True),
            ("rag-retrieval-quality", "RAG retrieval quality", "איכות אחזור ב-RAG", True),
        ],
    },
    {
        "id": "M5", "moscow": "must", "node": "azure-core",
        "skills": ["azure-foundry"], "difficulty": 5,
        "title": "AI-103", "he": "AI-103",
        "source": {"kind": "objectives", "name": "course_plan.json ai103_arc, 64 published objectives grouped"},
        "estMin": 10, "depthEstMin": 30, "goals": ["hire-2026-09-30", "ai103-sit"],
        "topics": [
            ("foundry-model-selection", "Foundry service and model selection", "בחירת שירות ומודל ב-Foundry", False),
            ("deployment-cicd", "Deployment options and CI/CD", "אפשרויות פריסה ו-CI/CD", False),
            ("identity-rbac", "Managed Identity, keyless auth, private networking, RBAC", "זהות מנוהלת והרשאות", False),
            ("responsible-ai", "Responsible AI: filters, guardrails, evaluators", "AI אחראי: מסננים ומעקות", False),
            ("monitoring-drift", "Monitoring: drift, safety, grounding", "ניטור: סחיפה, בטיחות, עיגון", False),
            ("audit-provenance", "Audit, provenance, approval workflows", "ביקורת, מקור ואישורים", False),
            ("foundry-sdk-apps", "Foundry SDK generative apps", "אפליקציות גנרטיביות ב-SDK", False),
            ("rag-on-azure", "RAG on Azure", "RAG על Azure", False),
            ("tool-augmented-flows", "Multistep tool-augmented flows", "זרימות רב-שלביות עם כלים", False),
            ("eval-fabrication", "Eval: fabrication, relevance, safety", "הערכה: בדיה, רלוונטיות, בטיחות", False),
            ("agents-roles-memory", "Agents: roles, tools, memory", "סוכנים: תפקידים, כלים, זיכרון", False),
            ("agent-approval", "Multi-agent orchestration and autonomous-with-approval", "תזמור ואוטונומיה עם אישור", False),
            ("token-analytics", "Observability, tracing, token analytics", "תצפיתיות וניתוח טוקנים", False),
            ("image-video-gen", "Image and video generation, multimodal understanding", "יצירת תמונה ווידאו", False),
            ("content-understanding", "Content Understanding, prompt injection in images, watermarks", "הבנת תוכן וסימני מים", False),
            ("extraction", "Entity, topic and JSON extraction, sentiment", "חילוץ ישויות וסנטימנט", False),
            ("translation-speech", "Translator, LLM translation, speech", "תרגום ודיבור", False),
            ("ai-search", "AI Search: ingest, index, semantic, hybrid, vector", "AI Search: אינדוקס וחיפוש", False),
            ("ocr-layout", "OCR, layout, document extraction", "OCR ומסמכים", False),
            ("exam-readiness", "Exam readiness: sandbox, gap list, schedule", "מוכנות למבחן", False),
        ],
    },
    {
        "id": "M6", "moscow": "must", "node": "prob-stats", "skills": ["ml-classic"], "difficulty": 6,
        "title": "Statistics for interviews", "he": "סטטיסטיקה לראיונות",
        "source": {"kind": "index", "name": "Machine_Learning_Study_Guidebook plus interview canon"},
        "estMin": 10, "depthEstMin": 35, "goals": HIRE,
        "topics": [
            ("probability-conditional", "Probability and conditional probability", "הסתברות והסתברות מותנית", False),
            ("distributions", "Distributions", "התפלגויות", False),
            ("expectation-variance", "Expectation and variance", "תוחלת ושונות", False),
            ("hypothesis-testing", "Hypothesis testing", "בדיקת השערות", True),
            ("confidence-intervals", "Confidence intervals", "רווחי סמך", False),
            ("ab-test-design", "A/B test design and pitfalls", "תכנון מבחן A/B", True),
            ("power", "Statistical power", "עוצמה סטטיסטית", True),
            ("calibration-brier", "Calibration and Brier score", "כיול וציון Brier", True),
            ("bias-variance", "Bias and variance", "הטיה מול שונות", False),
            ("leakage", "Leakage", "דליפת מידע", False),
            ("bootstrap", "Bootstrap", "בוטסטרפ", False),
        ],
    },
    {
        "id": "M7", "moscow": "must", "node": "llm-core", "skills": ["pytorch"], "difficulty": 8,
        "title": "Modern LLM architecture and inference", "he": "ארכיטקטורת LLM מודרנית והרצה",
        "source": {"kind": "repo", "name": "rasbt/LLMs-from-scratch ch04, Apache-2.0"},
        "estMin": 12, "depthEstMin": 45, "goals": HIRE,
        "volatile": True, "staleAfterDays": 90,
        "topics": [
            ("kv-cache", "KV cache as the bottleneck", "KV cache כצוואר הבקבוק", False),
            ("mha-mqa-gqa", "MHA to MQA to GQA", "מ-MHA ל-MQA ל-GQA", False),
            ("mla", "Multi-head latent attention", "MLA", False),
            ("sliding-window-attn", "Sliding window attention", "קשב חלון מחליק", False),
            ("sparse-attention", "Sparse attention", "קשב דליל", False),
            ("kv-sharing", "KV sharing across layers", "שיתוף KV בין שכבות", False),
            ("linear-attention", "Linear attention and the fixed-size recurrent state", "קשב לינארי", False),
            ("delta-rule", "The delta rule", "כלל הדלתא", False),
            ("gated-deltanet", "Gated DeltaNet and Gated DeltaNet-2", "Gated DeltaNet", False),
            ("kda-kimi-linear", "KDA and Kimi Linear", "KDA ו-Kimi Linear", False),
            ("hybrid-attention", "Hybrid attention layouts", "פריסות קשב היברידיות", False),
            ("ssm-mamba", "SSMs: Mamba-2 and Mamba-3", "מודלי מצב: Mamba", False),
            ("moe-routing", "MoE routing, active versus total parameters", "ניתוב MoE", False),
            ("moe-load-balancing", "MoE load balancing", "איזון עומסים ב-MoE", False),
            ("long-context", "Long context and what degrades at 1M", "הקשר ארוך ומה נשבר", False),
            ("quantization", "Quantization: PTQ versus QAT", "קוונטיזציה", False),
            ("quant-formats", "INT4, AWQ, GGUF, MXFP4", "פורמטי קוונטיזציה", False),
            ("inference-batching", "PagedAttention, continuous batching", "אצווה רציפה", True),
            ("speculative-decoding", "Speculative decoding, prefix caching, prefill and decode disaggregation", "פענוח ספקולטיבי", False),
        ],
    },
    {
        "id": "M8", "moscow": "must", "node": "agents-loop",
        "skills": ["agents-orch", "sdlc"], "difficulty": 6,
        "title": "The harness he already built", "he": "המערכת שהוא כבר בנה",
        "source": {"kind": "repo", "name": "RUC-NLPIR/Awesome-Long-Horizon-Agents Pillar I, plus claude-setup"},
        "estMin": 10, "depthEstMin": 35, "goals": HIRE,
        "topics": [
            ("loops-workflows", "Loops and workflows", "לולאות וזרימות עבודה", True),
            ("context-memory", "Context and memory", "הקשר וזיכרון", True),
            ("tools-mcp-skills", "Tools, MCP and skills", "כלים, MCP ומיומנויות", True),
            ("orchestration", "Orchestration", "תזמור", True),
            ("hooks-middleware", "Hooks and middleware", "hooks ו-middleware", True),
            ("verification", "Verification", "אימות", True),
            ("engineering-standards", "Engineering standards as the code-quality half", "תקני הנדסה", False),
            ("maturity-ladder", "The code maturity ladder, POC to production", "סולם הבשלות", False),
        ],
    },
    {
        "id": "S1", "moscow": "should", "node": "py-prod", "skills": ["python", "fastapi", "toml"],
        "difficulty": 5, "title": "Python in production", "he": "Python בייצור",
        "source": {"kind": "ledger", "name": "skills.json resume-risk rows"},
        "estMin": 10, "depthEstMin": 30, "goals": HIRE,
        "topics": [
            ("typing", "Typing", "טיפוסים", True),
            ("packaging-uv", "Packaging with uv", "אריזה עם uv", True),
            ("pyproject", "pyproject and TOML", "pyproject ו-TOML", True),
            ("testing-fixtures", "Testing and fixtures", "בדיקות ו-fixtures", True),
            ("fastapi-patterns", "FastAPI patterns", "תבניות FastAPI", True),
            ("error-handling", "Error handling", "טיפול בשגיאות", True),
            ("logging", "Logging", "לוגים", True),
            ("profiling", "Profiling", "פרופיילינג", False),
        ],
    },
    {
        "id": "S2", "moscow": "should", "node": "cicd-pipe",
        "skills": ["docker", "cicd", "yaml", "makefile", "iac"], "difficulty": 4,
        "title": "Ship and operate", "he": "לשלוח ולתפעל",
        "source": {"kind": "ledger", "name": "research_ladder.json foundations phase"},
        "estMin": 10, "depthEstMin": 30, "goals": HIRE,
        "topics": [
            ("artifact-repo", "Artifact repository versus version control",
             "מאגר ארטיפקטים מול ניהול גרסאות", False,
             {"kind": "gap", "name": "operator request 2026-07-29, JFrog binary versus git"}),
            ("docker-images", "Docker images", "אימג'ים של Docker", True),
            ("docker-compose", "Docker compose and local stacks", "Docker compose", True),
            ("cicd-anatomy", "CI/CD anatomy", "אנטומיה של CI/CD", True),
            ("yaml", "YAML", "YAML", True),
            ("makefile", "Makefile", "Makefile", True),
            ("iac-basics", "IaC basics", "יסודות IaC", True),
            ("secrets-identity", "Secrets and identity", "סודות וזהות", True),
            ("rollback", "Rollback and runbooks", "גלגול לאחור ו-runbooks", True),
        ],
    },
    {
        "id": "S3", "moscow": "should", "node": "rag-search", "skills": ["rag"], "difficulty": 6,
        "title": "RAG depth", "he": "עומק ב-RAG",
        "source": {"kind": "ledger", "name": "skills.json rag level 3 target 5"},
        "estMin": 10, "depthEstMin": 30, "goals": HIRE,
        "topics": [
            ("chunking", "Chunking", "חיתוך למקטעים", True),
            ("hybrid-search", "Hybrid search", "חיפוש היברידי", True),
            ("vector-search", "Vector search", "חיפוש וקטורי", True),
            ("reranking", "Reranking", "דירוג מחדש", True),
            ("grounding-eval", "Grounding evaluation", "הערכת עיגון", False),
            ("rag-failure-taxonomy", "RAG failure taxonomy", "טקסונומיית כשלים", False),
        ],
    },
    {
        "id": "S4", "moscow": "should", "node": "azure-core",
        "skills": ["azure-functions", "security-auth"], "difficulty": 4,
        "title": "Azure beyond the exam", "he": "Azure מעבר למבחן",
        "source": {"kind": "ledger", "name": "CURRICULUM-MOSCOW S4"},
        "estMin": 8, "depthEstMin": 25, "goals": HIRE,
        "topics": [
            ("functions-triggers", "Functions triggers", "טריגרים ב-Functions", True),
            ("functions-bindings", "Functions bindings", "bindings ב-Functions", True),
            ("identity-managed", "Managed identity", "זהות מנוהלת", False),
            ("identity-rbac-azure", "RBAC", "RBAC", False),
            ("networking-private", "Private endpoints", "נקודות קצה פרטיות", False),
            ("networking-vnet", "VNet integration", "שילוב VNet", False),
            ("cost-model", "The cost model", "מודל העלות", False),
            ("cost-optimization", "Cost optimization", "אופטימיזציית עלות", False),
        ],
    },
    {
        "id": "S5", "moscow": "should", "node": "frontend",
        "skills": ["game-ui", "game-feel"], "difficulty": 4,
        "title": "Interface depth from games", "he": "עומק ממשק מעולם המשחקים",
        "source": {"kind": "index", "name": "Game UI Database screen-type taxonomy, gameuidatabase.com"},
        "estMin": 8, "depthEstMin": 25, "goals": HIRE,
        "topics": [
            ("hud-hierarchy", "HUD hierarchy: what is read first and what is pushed to the periphery", "היררכיית HUD", True),
            ("diegetic-ui", "Diegetic versus non-diegetic UI, and the cost of each", "ממשק דיאגטי מול לא-דיאגטי", False),
            ("skill-tree-layout", "Skill and talent tree layouts: gating, legibility, regret", "פריסת עצי כישרון", True),
            ("inventory-grids", "Inventory grids, slots and spatial constraint as a mechanic", "רשתות מלאי", False),
            ("progression-feedback", "Progression feedback: XP, levels, and why the curve is visible", "משוב התקדמות", True),
            ("map-navigation", "Maps and navigation: fog, markers, and orientation cost", "מפות וניווט", False),
            ("onboarding-tutorial", "Onboarding without a tutorial wall", "כניסה למשחק בלי קיר הדרכה", False),
            ("juice-easing", "Juice: easing curves, anticipation, follow-through", "juice ועקומות האטה", True),
            ("tactile-state", "Tactile state machines: idle, hover, press, success, failure", "מכונת מצבים טקטילית", True),
            ("error-feedback", "Failure feedback that does not punish", "משוב כישלון שלא מעניש", False),
            ("reduced-motion", "Reduced motion and accessibility as a design constraint", "תנועה מופחתת ונגישות", False),
            ("rtl-game-ui", "RTL and Hebrew in interfaces designed left to right", "RTL ועברית בממשקים", False),
        ],
    },
    {
        "id": "S6", "moscow": "should", "node": "aiux",
        "skills": ["render-modes", "realtime-viz"], "difficulty": 6,
        "title": "Render paradigms and real-time visuals", "he": "מצבי רינדור וויזואליזציה בזמן אמת",
        "source": {"kind": "index", "name": "retained/immediate/GPU paradigm matrix, egui and wgpu published docs"},
        "estMin": 10, "depthEstMin": 30, "goals": HIRE,
        "topics": [
            ("retained-dom", "Retained mode: the DOM, reflow, and where its ceiling actually is", "מצב שמור: ה-DOM ותקרת הביצועים", True),
            ("immediate-mode", "Immediate mode: rebuilt per frame, and what that buys", "מצב מיידי", True),
            ("gpu-native", "GPU native: uniforms, shaders, and zero-copy transfer", "רינדור נייטיב על GPU", False),
            ("frame-budget", "The frame budget: 16ms, and how to measure yours", "תקציב הפריים", True),
            ("layout-engines", "Layout: reflow versus post-order traversal versus force-directed", "מנועי פריסה", False),
            ("force-directed", "Force-directed graph layout and its convergence failures", "פריסה מונעת כוחות", True),
            ("canvas-vs-dom", "Canvas versus DOM for dense views, measured not assumed", "Canvas מול DOM", True),
            ("text-rendering", "Text rendering outside the DOM: shaping, kerning, fallback", "רינדור טקסט מחוץ ל-DOM", False),
            ("animation-loop", "The animation loop: rAF, delta time, and frame pacing", "לולאת האנימציה", True),
            ("streaming-ui", "Streaming UI: partial output, trust, and the waiting state", "ממשק זורם ומצב המתנה", False),
        ],
    },
    {
        "id": "C2", "moscow": "could", "node": "math-la", "skills": ["ml-classic"], "difficulty": 7,
        "title": "Formal maths repair", "he": "תיקון המתמטיקה הפורמלית",
        "source": {"kind": "gap", "name": "degree transcript, weakest band"},
        "estMin": 12, "depthEstMin": 45, "goals": ["msc-application"],
        "topics": [
            ("la-vector-spaces", "Vector spaces", "מרחבים וקטוריים", False),
            ("la-matrix-ops", "Matrix operations", "פעולות מטריצה", False),
            ("la-rank", "Rank and independence", "דרגה ואי-תלות", False),
            ("la-eigen", "Eigenvalues and eigenvectors", "ערכים ווקטורים עצמיים", False),
            ("la-svd", "SVD", "פירוק SVD", False),
            ("la-projections", "Projections and least squares", "היטלים וריבועים פחותים", False),
            ("la-orthogonality", "Orthogonality", "אורתוגונליות", False),
            ("la-decompositions", "Decompositions", "פירוקים", False),
            ("prob-axioms", "Probability axioms", "אקסיומות הסתברות", False),
            ("prob-random-vars", "Random variables", "משתנים מקריים", False),
            ("prob-joint", "Joint and marginal distributions", "התפלגויות משותפות ושוליות", False),
            ("prob-expectation-proofs", "Expectation, proved", "תוחלת עם הוכחות", False),
            ("prob-inequalities", "Inequalities", "אי-שוויונות", False),
            ("prob-clt", "LLN and CLT", "חוק המספרים הגדולים ומשפט הגבול", False),
            ("prob-mgf", "Moment generating functions", "פונקציות יוצרות מומנטים", False),
            ("prob-markov-chains", "Markov chains", "שרשראות מרקוב", False),
            ("calc-limits", "Limits and continuity", "גבולות ורציפות", False),
            ("calc-derivatives", "Derivatives and the chain rule", "נגזרות וכלל השרשרת", False),
            ("calc-integrals", "Integrals", "אינטגרלים", False),
            ("calc-multivariable", "Multivariable calculus", "חשבון רב-משתני", False),
            ("calc-taylor", "Taylor expansion", "טור טיילור", False),
            ("calc-vector", "Vector calculus", "חשבון וקטורי", False),
            ("opt-convexity", "Convexity", "קמירות", False),
            ("opt-gradients", "Gradients and descent", "גרדיאנטים וירידה", False),
            ("opt-lagrange", "Lagrange multipliers", "כופלי לגראנז'", False),
            ("opt-constrained", "Constrained optimization", "אופטימיזציה עם אילוצים", False),
            ("opt-convergence", "Convergence", "התכנסות", False),
            ("opt-stochastic", "Stochastic optimization", "אופטימיזציה סטוכסטית", False),
        ],
    },
    {
        "id": "C3", "moscow": "could", "node": "ts-web",
        "skills": ["typescript", "react-next"], "difficulty": 4,
        "title": "Frontend and TypeScript", "he": "פרונטאנד ו-TypeScript",
        "source": {"kind": "arm", "name": "arm F only"},
        "estMin": 8, "depthEstMin": 25, "goals": HIRE,
        "topics": [
            ("ts-types", "TypeScript types", "טיפוסים ב-TypeScript", False),
            ("ts-generics", "Generics", "גנריות", False),
            ("ts-narrowing", "Narrowing", "צמצום טיפוס", False),
            ("react-components", "Components", "רכיבים", False),
            ("react-state", "State", "מצב", False),
            ("react-effects", "Effects", "אפקטים", False),
            ("react-data", "Data fetching", "משיכת נתונים", False),
            ("next-routing", "Routing", "ניתוב", False),
            ("next-rendering", "Rendering modes", "מצבי רינדור", False),
            ("web-perf", "Web performance", "ביצועי web", False),
        ],
    },
    {
        "id": "W1", "moscow": "wont", "node": "ml-applied", "skills": ["rl", "pytorch"], "difficulty": 8,
        "title": "Deep RL and flow matching", "he": "Deep RL והתאמת זרימה",
        "source": {"kind": "index", "name": "CS224R and MIT 6.S184, season 1 spine, demoted"},
        "estMin": 12, "depthEstMin": 45, "goals": [],
        "promoteAfter": "hire-2026-09-30",
        "reason": "No active arm interviews on it. Operator: RL shouldnt come first.",
        "topics": [
            ("mdp", "MDPs", "תהליכי החלטה מרקוביים", False),
            ("reinforce", "REINFORCE", "REINFORCE", False),
            ("behavior-cloning", "Behavior cloning", "שכפול התנהגות", False),
            ("value-advantage", "V, Q and advantage", "V, Q ויתרון", False),
            ("actor-critic", "Actor-critic", "שחקן-מבקר", False),
            ("td-gae", "TD and GAE", "TD ו-GAE", False),
            ("flow-matching", "Flow matching", "התאמת זרימה", False),
        ],
    },
    {
        "id": "W2", "moscow": "wont", "node": "data-pipelines", "skills": ["tableau"], "difficulty": 3,
        "title": "Long-tail tool claims", "he": "כלים בזנב הארוך",
        "source": {"kind": "ledger", "name": "skills.json level 1 resume-risk rows"},
        "estMin": 6, "depthEstMin": 20, "goals": [],
        "promoteAfter": "interview-asks",
        "reason": "None interviewed in arms A, E or B. An interview asking is the signal to promote.",
        "topics": [
            ("tableau", "Tableau", "Tableau", False),
            ("hubspot", "HubSpot", "HubSpot", False),
            ("chatwoot", "Chatwoot", "Chatwoot", False),
            ("salesforce", "Salesforce", "Salesforce", False),
            ("databricks", "Databricks", "Databricks", False),
            ("spark", "Spark", "Spark", False),
            ("tensorflow", "TensorFlow", "TensorFlow", False),
            ("looker", "Looker", "Looker", False),
        ],
    },
]


def _unit(block: dict, slug: str, en: str, he: str, kind: str,
          source: dict | None = None) -> dict:
    """Build one unit record.

    Args:
        block: the block definition the unit belongs to.
        slug: topic slug, unique within the block.
        en: English title.
        he: Hebrew title.
        kind: "concept" (teaches something new) or "practice" (drills it).
        source: provenance for this one topic. Defaults to the block's, which
            is right when the whole block came from one enumeration and wrong
            when a single topic was added from somewhere else.

    Returns:
        A unit dict conforming to SYSTEM-SPEC section 1.1.
    """
    suffix = "-drill" if kind == "practice" else ""
    volatile = block.get("volatile", False)
    return {
        "id": f"{block['id'].lower()}-{slug}{suffix}",
        "title": en if kind == "concept" else f"{en}: drill",
        "he": he if kind == "concept" else f"{he}: תרגול",
        "block": block["id"],
        "moscow": block["moscow"],
        "tree": TREE_BY_MOSCOW[block["moscow"]],
        "node": block["node"],
        "kind": kind,
        "status": "active",
        "difficulty": block["difficulty"] + (1 if kind == "practice" else 0),
        "skills": block["skills"],
        "goals": block["goals"],
        "teaches": [slug] if kind == "concept" else [],
        "requires": [slug] if kind == "practice" else [],
        "objectives": [],
        "volatile": volatile,
        "staleAfterDays": block.get("staleAfterDays") if volatile else None,
        "source": source or block["source"],
        "estMin": block["estMin"] if kind == "concept" else block["estMin"] + 4,
        "depthEstMin": block["depthEstMin"],
        "body": {"status": "pending", "generated": None, "hash": None},
    }


def expand(block: dict) -> list[dict]:
    """Expand one block into its concept and practice units.

    Args:
        block: a BLOCKS entry.

    Returns:
        Units in enumeration order, each concept immediately followed by its
        drill when the topic is flagged for one.
    """
    units = []
    for topic in block["topics"]:
        slug, en, he, drill = topic[:4]
        source = topic[4] if len(topic) > 4 else None
        units.append(_unit(block, slug, en, he, "concept", source))
        if drill:
            units.append(_unit(block, slug, en, he, "practice", source))
    return units


def judgment_units() -> list[dict]:
    """Build C1 from judgment_map.json, one decision unit per domain.

    Returns:
        One `concept` unit per judgment domain, keyed to the talent node of the
        same id. The prose claim of 47 subsections is not in the file, so this
        derives 18 real units rather than inventing the difference.
    """
    jmap = json.loads((ROOT / "judgment_map.json").read_text(encoding="utf-8"))
    block: dict[str, Any] = {
        "id": "C1", "moscow": "could", "node": None, "skills": [], "difficulty": 7,
        "estMin": 6, "depthEstMin": 20, "goals": [],
        "source": {"kind": "index", "name": "judgment_map.json, Principal Engineer Curriculum"},
    }
    units = []
    for d in jmap["domains"]:
        block["node"] = d["id"]
        u = _unit(block, d["id"], d["en"], d["name"], "concept")
        u["objectives"] = [d["rule"]]
        units.append(u)
    return units


def validate(units: list[dict]) -> list[str]:
    """Check every unit against the id vocabulary and the tree derivation rule.

    Args:
        units: the full unit list.

    Returns:
        Human-readable errors. Empty means the spine is internally consistent.
    """
    talents = json.loads((ROOT / "talents.json").read_text(encoding="utf-8"))
    skills = json.loads((ROOT / "skills.json").read_text(encoding="utf-8"))
    nodes = {n["id"] for t in talents["trees"] for tier in t["tiers"] for n in tier["nodes"]}
    skill_ids = {s["id"] for s in skills["skills"]}
    goal_ids = {g["id"] for g in GOALS}

    errs, seen = [], set()
    for u in units:
        if u["id"] in seen:
            errs.append(f"duplicate unit id: {u['id']}")
        seen.add(u["id"])
        if u["node"] not in nodes:
            errs.append(f"{u['id']}: unknown node '{u['node']}'")
        for s in u["skills"]:
            if s not in skill_ids:
                errs.append(f"{u['id']}: unknown skill '{s}'")
        for g in u["goals"]:
            if g not in goal_ids:
                errs.append(f"{u['id']}: unknown goal '{g}'")
        if u["tree"] != TREE_BY_MOSCOW[u["moscow"]]:
            errs.append(f"{u['id']}: tree does not derive from moscow")
        if u["volatile"] and u["staleAfterDays"] is None:
            errs.append(f"{u['id']}: volatile without staleAfterDays")
    return errs


def carry_bodies(units: list[dict]) -> int:
    """Copy written-body state from the previous curriculum.json onto a rebuild.

    Purpose: a rebuild re-derives every unit record from the enumeration, so
    without this the `body` block resets to pending and the record of which
    lessons already have a written file is destroyed. The ordering function then
    proposes units that were already written.

    Contracts: `units/<id>.md` is the truth about whether a lesson exists
    (ROUTINE section 0), so a body is carried only when that file is present.
    That keeps the invariant "body.status is not pending implies the file
    exists" true even if a lesson file was deleted between runs.

    Args:
        units: freshly derived units. Mutated in place.

    Returns:
        How many bodies were carried.

    Agent-context: unconditional, no flag. Nothing else restores this state.
    """
    path = ROOT / "curriculum.json"
    if not path.exists():
        return 0
    previous = {u["id"]: u.get("body") for u
                in json.loads(path.read_text(encoding="utf-8"))["units"]}
    carried = 0
    for u in units:
        body = previous.get(u["id"])
        if not body or body.get("status") == "pending":
            continue
        if not (ROOT / "units" / f"{u['id']}.md").exists():
            continue
        u["body"] = body
        carried += 1
    return carried


def main() -> None:
    """Build both files, report per-block counts, exit non-zero on any error."""
    units = []
    for block in BLOCKS:
        units.extend(expand(block))
    units.extend(judgment_units())

    errs = validate(units)
    counts: dict[str, int] = {}
    for u in units:
        counts[u["block"]] = counts.get(u["block"], 0) + 1
    for cls in ("must", "should", "could", "wont"):
        n = sum(1 for u in units if u["moscow"] == cls)
        blocks = " ".join(f"{b}={counts[b]}" for b in counts
                          if next(u["moscow"] for u in units if u["block"] == b) == cls)
        print(f"  {cls.upper():<7} {n:>4}   {blocks}")
    print(f"  {'TOTAL':<7} {len(units):>4}")

    if errs:
        print(f"\n{len(errs)} errors:", file=sys.stderr)
        for e in errs:
            print("  !", e, file=sys.stderr)
        sys.exit(1)

    carried = carry_bodies(units)

    (ROOT / "curriculum.json").write_text(
        json.dumps({"version": 1, "units": units}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    (ROOT / "goals.json").write_text(
        json.dumps({"goals": GOALS}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    print(f"\nwrote curriculum.json and goals.json, carried {carried} written bodies")


if __name__ == "__main__":
    main()
