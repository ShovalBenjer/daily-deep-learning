# Seeds rank-quest chains (5 per node) for the most active nodes.
# Quest r is what buying rank r unlocks; matches the evidence ladder.
import json, os
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "talents.json")
t = json.load(open(p, encoding="utf-8"))
Q = {
 "sql-core": [
  "פתח את כרטיסי המושגים של SQL באוצר וענה על הבוחן שלהם.",
  "הסבר בקול (או בכתב להמורה): מה ההבדל בין WHERE ל-HAVING ולמה window function לא מסננת שורות.",
  "פתור 3 שאלות DataLemur ברמת medium עם window functions; הדבק פלט אחת להערות.",
  "בנה שאילתת ניתוח על דאטה אמיתי שלך (qc_analyzer): רצף, דירוג ו-CTE אחד לפחות; שמור אותה בריפו.",
  "הגן: מתי דה-נורמליזציה נכונה? תן מקרה אמיתי מהעבודה ומה היית מוותר."],
 "dsa": [
  "פתח את מושגי הסיבוכיות באוצר וענה על הבוחן.",
  "הסבר להמורה מתי binary search נשבר על דאטה לא ממוין ומה עולה sort מראש.",
  "פתור 5 בעיות Grind75 קלות (arrays/hash) עם ניסיון-לפני-רמז של 20 דקות.",
  "ממש LRU cache מאפס בפייתון עם בדיקות; דחוף לריפו.",
  "הגן: מתי O(n^2) הוא הבחירה הנכונה? תן דוגמה אמיתית."],
 "containers": [
  "פתח את מושגי הענן/קונטיינרים באוצר וענה על הבוחן.",
  "הסבר: מה ההבדל בין image ל-container ולמה שכבות חשובות ל-cache.",
  "כתוב Dockerfile להסדנה (daemon) שרץ נקי; הדבק docker run פלט.",
  "בנה compose עם שני שירותים (daemon + worker מדומה) ורשת פנימית; דחוף לריפו.",
  "הגן: מתי לא קונטיינר? מקרה שבו VM או Functions עדיפים."],
 "cicd-pipe": [
  "פתח את מושגי ה-CI/CD באוצר וענה על הבוחן.",
  "הסבר את ההבדל בין CI ל-CD ומה שובר cache בפייפליין.",
  "הוסף ל-daily-deep-learning ג'וב CI שמריץ את tools/validate_links.py על כל push.",
  "בנה פייפליין מלא לפרויקט אחר שלך: build, test, deploy עם סוד מנוהל.",
  "הגן: canary מול blue-green להסדנה של לקוח אמיתי; מה בחרת ולמה."],
 "agents-loop": [
  "פתח את מושגי הסוכנים באוצר וענה על הבוחן.",
  "הסבר להמורה את הלולאה: intent, tools, verify; איפה נכנס human-in-the-loop.",
  "הוסף tool חדש לדמון של הסדנה (SDK) עם schema ובדיקה אמיתית.",
  "בנה סוכן קטן עם 2 כלים, checkpoint, ו-recovery מנפילה; דחוף לריפו.",
  "הגן: מתי workflow דטרמיניסטי עדיף על סוכן? מקרה מהעבודה."],
 "rag-search": [
  "פתח את מושגי ה-RAG באוצר וענה על הבוחן.",
  "הסבר: למה chunking קובע recall ומה hybrid search פותר.",
  "ממש BM25 + vector על קורפוס הסדנה (corpus/) והשווה recall@5 על 5 שאילתות.",
  "בנה reranker קטן והראה שיפור מדוד על אותן שאילתות; שמור נוטבוק.",
  "הגן: מתי RAG הוא הפתרון הלא נכון? תן חלופה וסיבה."],
 "evals-obs": [
  "פתח את מושגי ההערכה באוצר וענה על הבוחן.",
  "הסבר: LLM-as-judge, מה מטה אותו, ואיך מכיילים אותו.",
  "כתוב 10 golden cases לצ'אט המורה והרץ אותם ידנית; תעד עובר/נופל.",
  "בנה eval אוטומטי (סקריפט) שמריץ את ה-golden set ומדווח רגרסיות.",
  "הגן: כמה evals זה יותר מדי? איפה עוצרים ולמה."],
 "py-prod": [
  "פתח את מושגי הפייתון באוצר וענה על הבוחן.",
  "הסבר: מה pyproject.toml מגדיר ולמה uv מהיר מ-pip.",
  "הוסף type hints מלאים ו-ruff לאחד הכלים ב-tools/; תקן כל אזהרה.",
  "ארוז כלי שלך כחבילה מותקנת (uv tool) עם entrypoint; דחוף לריפו.",
  "הגן: מתי סקריפט חד-פעמי עדיף על חבילה? הקו שלך."],
 "azure-core": [
  "פתח את מושגי הענן באוצר וענה על הבוחן.",
  "הסבר: managed identity מול connection string; למה KV ולא env בפרוד.",
  "פרוס Function חדשה קטנה ב-axia עם App Insights מחובר; הדבק trace חי.",
  "בנה alert אמיתי על שגיאות של אחד השירותים שלך בעבודה; צלם אותו עובד.",
  "הגן: Functions מול Container Apps לשירות הבא שלך; החלטה מנומקת."],
 "config-lang": [
  "פתח את מושגי התצורה באוצר וענה על הבוחן.",
  "הסבר: למה TOML לקונפיג ולא YAML, ומתי הפוך.",
  "כתוב Makefile להסדנה: make gen, make critic, make validate, make deploy.",
  "המר pipeline קיים שלך ל-YAML נקי עם anchors בלי כפילויות; דחוף.",
  "הגן: כמה אוטומציה ב-Make זה יותר מדי? איפה נגמר הקו."],
}
n = 0
for tr in t["trees"]:
    for tier in tr["tiers"]:
        for node in tier["nodes"]:
            if node["id"] in Q:
                node["quests"] = Q[node["id"]]; n += 1
json.dump(t, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("quest chains:", n)
