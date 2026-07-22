# LEARNING-MODEL — the canonical spec (2026-07)

Status: active. This is the spine the whole platform is refactored around.
Sources: Shoval's mastery-ladder spec (2026-07-21), the "Next Level AI Engineering"
knowledge map (ChatGPT session 2026-07-10), and a sourced learning-science sweep
(2026-07-22, citations at bottom). ROUTINE.md implements this; skills.json is the
live ledger; the ownership board in המסלול renders it.

---

## 1. The mastery ladder (0–5)

| רמה | שם | מה זה אומר | הוכחה נדרשת |
|---|---|---|---|
| 0 | Recognition | מזהה כשרואה | — |
| 1 | Recall | שולף הגדרות ופקודות | quiz/fillin נכון ללא עזרה |
| 2 | Explanation | מסביר במילים שלך, כולל מול חלופות | הסבר חופשי שנבדק |
| 3 | Application | השתמשת במשימה אמיתית בהכוונה | תרגיל/פרויקט מודרך |
| 4 | Engineering Ownership | בונה, מדבג, מפעיל ומתחזק לבד | artifact שרץ: repo/PR/deploy |
| 5 | Design Maturity | בוחר ארכיטקטורה, trade-offs, מתי לא | הגנה על החלטת תכנון |

**חוק הרזומה: מונח ברזומה אינו בבעלותך עד רמה 4.** מתחת לזה הוא סיכון בראיון.

The ladder has a seam the evidence confirms (Bloom/SOLO vs Dreyfus/SFIA mapping):
levels 0–2 are *knowledge states* — proven by recall and explanation checks; levels
3–5 are *responsibility states* — proven only by artifacts, debugging, and design
defense. Different levels need different proof types; a quiz can never certify L4.

Evidence ladder (per concept): Watched → Explained → Quizzed → Built → Tested → Retained.

## 2. Target tiers (the priority policy)

- **L5 — תחומי זהות מקצועית**: Agents & agentic systems, harness architecture,
  evaluation & observability, MCP/A2A, Azure AI, productized AI systems.
- **L4 — יכולת הנדסית עצמאית**: Backend & APIs, databases, data engineering,
  DevOps/CI-CD/IaC, cloud, security, ML & MLOps, system design.
- **L3 — רוחב תומך**: Frontend, distributed-systems depth, advanced math,
  research-frontier subjects. מתמטיקה עולה ל-L4–5 כשהיא משרתת מודל/אופטימיזציה שאתה בונה.

## 3. The 22-domain knowledge map (from 2026-07-10, canonical taxonomy)

Tier in brackets. Every lesson, quiz, side-quest and skill row belongs to exactly one domain.

1. **CS Foundations** [3→4]: processes/threads, memory/stack/heap, filesystems, networking,
   HTTP/TCP/DNS, concurrency & async, OS, complexity, data structures, algorithms,
   serialization, caching, queues, idempotency.
2. **Mathematics & Statistics** [3, →4-5 when project-bound]: linear algebra (rank, basis,
   eigen/SVD/PCA, norms, PD matrices, kernels), calculus (chain rule, Jacobian/Hessian,
   Taylor), optimization (convexity, GD/SGD/Adam, Lagrange/KKT), probability (Bayes,
   LLN/CLT, MLE/MAP), statistics (CIs incl. Wilson, hypothesis testing, ANOVA, A/B,
   bootstrap, power, multiple testing, Bayesian, causal, time series), Fourier & convolution,
   Cramer's V, logistic-regression assumptions.
3. **Software Engineering** [4]: clean code, SOLID, patterns, error handling, logging,
   config, packaging, versioning, reviews, git workflows, testing pyramid, refactoring,
   debugging, profiling, tech debt. Files: pyproject.toml/TOML, YAML, JSON, .env,
   Makefile, Dockerfile, shell/PowerShell, GitHub Actions / Azure Pipelines.
4. **Backend & APIs** [4]: FastAPI, Flask, Node/TS, REST, GraphQL, WebSockets, gRPC,
   authn/authz, JWT, OAuth, rate limiting, validation, pagination, workers, webhooks,
   OpenAPI contracts, idempotent endpoints.
5. **Databases** [4]: advanced SQL (joins, windows, CTEs, plans, indexing, transactions,
   isolation, locks), modeling (normal forms, partitioning), PostgreSQL, Supabase, Snowflake,
   Databricks SQL, document/vector/graph/KV stores, OLTP vs OLAP, migrations, backups,
   replication, pooling, RLS.
6. **Data Engineering** [4]: ETL/ELT, batch vs streaming, star schema, SCD, quality,
   lineage, orchestration, Spark, Kafka, Airflow/Prefect/ADF, Fabric/OneLake, Databricks,
   dbt, Parquet/Delta, medallion, data contracts.
7. **Machine Learning** [4]: formulation, baselines, features, leakage, CV, imbalance,
   metrics, calibration, explainability, error analysis, HPO, ensembles, drift,
   reproducibility; linear/logistic, trees, RF, boosting (LightGBM/XGBoost/CatBoost),
   clustering, dim-reduction, anomaly, forecasting.
8. **Deep Learning** [3→4]: backprop, init, activations, losses, regularization, optimizers,
   CNN/RNN/attention/transformers, embeddings, transfer, fine-tuning, quantization,
   distillation, LoRA, vision & detection.
9. **LLM & GenAI** [5]: tokenization, transformer internals, pretraining/SFT/preference-opt,
   prompting, structured output, tool use, context windows, KV cache, SLMs, routing,
   latency/cost, hallucinations, guardrails. The core judgment: LLM vs RAG vs fine-tune vs
   deterministic workflow.
10. **RAG & Search** [5]: chunking, vector search, BM25, hybrid, reranking, metadata filters,
    query rewriting, context compression, graph RAG, citation grounding, recall@k /
    precision@k / MRR / NDCG, faithfulness.
11. **Agents & Agentic Systems** [5]: agent loop, tool selection, planning, state machines,
    multi-agent, delegation, context management, memory, HITL, permissions, sandboxing,
    checkpointing, recovery, MCP, A2A, hooks, skills, schedulers, notification rails.
    Not "chatbot with tools" — a harness that takes intent and returns verified action.
12. **Evaluation & Observability** [5]: golden sets, unit/integration evals, LLM-as-judge,
    human eval, pairwise, regression tests, prompt/version tracking, tracing, token/cost,
    latency, failure taxonomy, hallucination testing, trajectory eval, tool-call correctness,
    safety evals, online vs offline. No evals → no controlled improvement.
13. **MLOps** [4]: experiment tracking, data versioning, registry, feature stores, pipelines,
    serving, batch/online inference, monitoring, drift, shadow/canary, rollback, MLflow.
14. **Cloud (Azure-native)** [4→5 for Azure AI]: RGs, IAM, storage, compute, networking,
    ACR, App Service, Container Apps, Functions, Key Vault, App Insights, Monitor,
    AI Foundry, ADF, Fabric, managed identities, cost, private endpoints, RBAC.
15. **DevOps, CI/CD & IaC** [4]: SDLC, branching, PRs, CI/CD, artifacts, registries, Docker,
    Compose, Kubernetes, Helm, Terraform, Bicep, Ansible, secrets, env promotion,
    blue-green/canary, rollbacks, infra testing, drift detection, policy as code.
16. **Security & Governance** [4]: threat modeling, least privilege, secrets, encryption,
    OWASP, dependency/container scanning, supply chain, audit logs, privacy, PII, prompt
    injection, tool injection, agent permissions, approval boundaries, responsible AI.
17. **Distributed Systems** [3]: CAP, consistency, replication, partitioning, distributed
    transactions, eventual consistency, queues, pub/sub, retries, backoff, DLQ,
    exactly-once myth, idempotency, consensus, circuit breakers.
18. **System Design** [4]: requirements, capacity, API design, DB selection, caching, queues,
    LB, scaling, availability, reliability, observability, security, cost, trade-offs.
    From "I can build a feature" to "I can design, operate, and predict where it breaks."
19. **Product & FDE** [4→5]: problem discovery, ambiguity→systems, prototyping, integration,
    demos, customer deployment, data investigation, stakeholder communication, adoption
    metrics, custom-vs-platform balance.
20. **Interviews, DS&A** [4]: arrays, hash maps, lists, stacks/queues, trees, graphs, heaps,
    sorting, binary search, recursion, DP, sliding window, two pointers, BFS/DFS, Big-O;
    SQL/ML/statistics/system-design interviews; behavioral stories. Closed questions,
    fill-in-the-blank, explain-without-notes, debugging drills, grilling.
21. **Research Literacy** [3]: abstract→methodology→baselines→leakage→ablations→significance;
    reproduce a result; connect paper to project; trend vs benchmark vs real contribution.
22. **Personal AI Harness** [5]: rules, hooks, skills, MCP servers, A2A bridges, subagents,
    schedulers, approvals, notifications, evidence discipline, memory, checkpoints, review
    fabric, learning engine, resume/publishing engine. The roadmap realizes itself through
    this system — הסדנה is itself domain-22 evidence.

## 4. The learning loop (how every topic is taught)

Learn → Recall → Explain → Solve → Build → Test → Teach → Retain.

Per-topic anatomy (every עיון must cover): Concept · Why it exists · How it works ·
When to use · **When NOT to use** · Minimal implementation · Production implementation ·
Failure modes · Trade-offs · Interview questions · Project evidence.

Daily rhythm — four anchors (Asia/Jerusalem): **08:00** עיון (learn), **12:00** תרגול
(solve/recall), **17:00** AI-103/build, **22:00** מעקב + שיקול דעת (retain/judge).
The page is one unit; the anchors are the recommended split, not a gate.

## 5. What the science says (the 12 principles, sourced)

Effect sizes are meta-analytic g/d; the platform bets on the big ones.

1. **Retrieval practice** g=0.61 — testing beats restudy (Adesope 2017). → nothing is
   revealed before an attempt; quizzes are the lesson, not the check.
2. **Spacing** g=0.74 — spaced retrieval beats massed (Latimier 2021); expanding vs uniform
   gaps don't reliably differ (Cepeda 2008). → resurface misses at ~1d/3d/7d; don't
   over-engineer the schedule, just space it.
3. **Interleaving** g=0.42 — mix confusable types after brief blocking (Brunmair & Richter
   2019). → block a new pattern 2–3 items, then mix into review sets.
4. **Generation** d=0.40 — even failed guesses + feedback beat passive reading (Bertsch
   2007; Richland 2009). → pretest questions before עיון sections.
5. **Elaborative interrogation** — "why is this true?" prompts (Dunlosky 2013).
6. **Self-explanation** g=0.55 — explaining beats receiving the explanation (Bisra 2018).
   → "הסבר במילים שלך" boxes; the chat's mock-interview grades them.
7. **Worked examples with fading** g=0.48 for novices; reverses for experts (Barbieri 2023;
   Sweller/Kalyuga). → L0–1 skills get worked examples; L3+ get problems first.
8. **Desirable difficulties** — optimal training accuracy ≈85% (Wilson 2019; Bjork). →
   difficulty targets ~85% rolling success; too-easy is a defect.
9. **Mastery learning** — tutoring d≈0.76–0.79 (VanLehn 2011); 2-sigma is an outlier claim.
   → promotion gates on unassisted performance + graded explanation, never time spent.
10. **Deliberate practice** — necessary not sufficient (Ericsson 1993; Macnamara 2014). →
    drills target the *current* weakest skill at the edge of ability.
11. **Calibration** — learners are chronically overconfident; calibration predicts retention
    (Dunlosky & Rawson 2012). → confidence slider before feedback; calibration curves shown.
12. **Cognitive load** — working memory is the bottleneck (Sweller 2019). → one thread per
    day; segment; cut decoration that isn't information.

**AI-tutor guardrails (the RCT evidence).** Purpose-built AI tutoring ≈ doubled learning
gains vs active class (Kestin, Sci Rep 2025). Guardrailed Socratic hints raised practice
+127% with no exam harm; *unrestricted answer-giving raised practice +48% but cut unassisted
exam performance −17%* (Bastani, PNAS 2025). Therefore המורה: hint ladder before solutions,
attempt-first, and **assisted work never counts as mastery evidence** — only unassisted
checkpoints move the skill ledger.

## 6. Interview drill protocol (arm-connected)

No RCTs on LeetCode drilling; it works where it instantiates the principles above.

- **SQL/Python for the data arms**: DataLemur, 3 questions/day (fn-datalemur in the ladder).
  Attempt 20–25 min before any hint; study others' solutions after. Beginners 3–6 months,
  experienced 30–60 days to interview-ready.
- **DS&A**: Grind75 pacing — ~75 curated problems, ~8 weeks at 1h/day, easy→hard by pattern.
- Structure: 1–2 new problems/day + re-solve queue of misses at 1d/3d/7d; brief blocking on a
  new pattern then interleave; weekly timed mock with think-aloud; hold ~85% via ramp.
- Every resume_risk skill in skills.json gets drills tagged `"skill"` so the ledger fills
  from real answers.

## 7. How the platform implements this (contract)

- **skills.json** — the ledger: 22-domain-aligned skills, current vs target, resume_risk,
  interview_bank. Board in המסלול renders it; operator overrides levels; evidence entries
  attach links. Levels only rise on evidence (Built/Tested), not vibes.
- **ROUTINE.md** — generators must: tag quiz/fillin blocks with `"skill"`, target the
  weakest resume_risk skills ≥2×/week (DataLemur-style for sql/pandas-da), weave basics
  (TOML/YAML/Make/IaC) as mini-sections until L3, follow the topic anatomy, keep ~85%
  difficulty, resurface 1d/3d/7d.
- **Page** — attempt-first widgets, confidence slider, calibration summary in the quiz
  player, one thread per day, four-anchor rhythm.
- **המורה (daemon)** — Socratic hint ladder, no full solutions on first ask, mock-interview
  verify pass; chat transcripts are never mastery evidence.

## Sources

Adesope 2017 (10.3102/0034654316689306) · Latimier 2021 (s10648-020-09572-8) · Cepeda 2008 ·
Brunmair & Richter 2019 · Bertsch 2007 · Bisra 2018 · Dunlosky 2013 (10.1177/1529100612453266) ·
Barbieri 2023 · Richland/Kornell/Kao 2009 · Wilson 2019 (s41467-019-12552-4) · VanLehn 2011 ·
Macnamara 2014 · Dunlosky & Rawson 2012 · Sweller/van Merriënboer/Paas 2019 · Dreyfus 1980 ·
revised Bloom · SOLO (Biggs) · SFIA 9 (2024) · Kestin 2025 (s41598-025-97652-6) · Bastani
PNAS 2025 (10.1073/pnas.2422633122) · Tutor CoPilot (arXiv:2410.03017) · Liu 2025 JCAL
(heterogeneous; one headline meta retracted; MIT "cognitive debt" preprint unreviewed) ·
Grind75 · DataLemur SQL guide.
