# AI Search: אינדוקס וחיפוש

הצינור שמוצא מסמך רלוונטי בתוך ים של טקסט - ב-Azure הוא שירות עצמאי עם שלוש שכבות חיפוש שאפשר לשלב.

## מה תדע בסוף

תדע לתאר את מבנה ה-Index ב-Azure AI Search ואת תכונות השדות שלו, להבחין בין חיפוש מילות מפתח (BM25), חיפוש וקטורי ו-hybrid search, ולהסביר מה ה-Semantic Ranker מוסיף ומה הוא לא עושה. תדע מתי לבחור כל מצב ומה קורה כשמשלבים את שלושתם.

## האינטואיציה

דמיין ספריה עם ארבעה מנגנוני חיפוש:

1. **ספר הביבליוגרפי** (BM25): מחפש מילות מפתח מדויקות. מצוין כשאתה יודע מה לשאול, אבל "רכב" לא ימצא "אוטו".
2. **מפה של קרבה** (vector search): ממיר כל מסמך לנקודה במרחב משמעות. "רכב" ו-"אוטו" קרובים, אז שניהם יימצאו.
3. **שילוב שניהם** (hybrid): מחפש גם בביבליוגרפי גם בוקטורי, ממזג את הדירוגים בנוסחה.
4. **עורך מדעי** (Semantic Ranker): מסתכל על 50 התוצאות הראשונות שהגיעו מהשכבות הקודמות ומסדר אותן מחדש לפי הבנת משמעות.

כל שאילתה עוברת דרך השכבות שבחרת, בסדר הזה - ה-Semantic Ranker תמיד אחרון.

## ההגדרות המדויקות

**Azure AI Search, שירות חיפוש** הוא managed service של Azure שמאחסן indexes, מריץ indexers, מבצע enrichment דרך skillsets ומחזיר תוצאות חיפוש.

**Index, אינדקס** הוא הטבלה הווירטואלית שמאחסנת את המסמכים. כל שדה מוגדר עם תכונות בוליאניות:

| תכונה | תפקיד |
|---|---|
| `searchable` | ניתן לחפש בטקסט חופשי (BM25) |
| `filterable` | ניתן לסנן לפי ערך מדויק (`$filter=category eq 'legal'`) |
| `sortable` | ניתן למיין לפיו (`$orderby=date desc`) |
| `facetable` | ניתן לקבץ לחישוב aggregation |
| `retrievable` | יוחזר בתוצאות (אם `false`, רק לחיפוש פנימי) |

שדה וקטורי מוגדר בנפרד עם מימד ה-embedding ופרופיל ה-HNSW שלו.

**BM25, ציון רלוונטיות מילות מפתח** (Best Match 25) מחשב כמה מילות השאילתה מופיעות במסמך, עם נרמול לפי אורך:

\[\text{score}(d,q) = \sum_{t \in q} \text{idf}(t) \cdot \frac{f(t,d) \cdot (k_1+1)}{f(t,d) + k_1 \cdot \left(1-b+b \cdot \frac{|d|}{\text{avgdl}}\right)}\]

\(k_1 = 1.2\) שולט בשבוע ה-term frequency, \(b = 0.75\) שולט בנרמול האורך. מסמך קצר שמכיל מילה נדירה מקבל ציון גבוה.

**Vector field, שדה וקטורי** מאחסן embedding המייצג את משמעות המסמך. בעת שאילתה, גם השאילתה ממוירת ל-embedding (באמצעות אותו מודל), והחיפוש מוצא וקטורים קרובים ב-cosine similarity. האינדקס משתמש ב-**HNSW, גרף היירארכי** (Hierarchical Navigable Small World) שמאפשר חיפוש approximate ב-\(O(\log n)\) במקום סריקה מלאה ב-\(O(n)\).

**Hybrid search, חיפוש היברידי** מריץ BM25 ו-vector search במקביל ומאחד את הדירוגים בעזרת **RRF, מיזוג דירוגים הדדי** (Reciprocal Rank Fusion):

\[\text{RRF}(d) = \sum_{r \in \text{rankers}} \frac{1}{k + \text{rank}_r(d)}\]

כאשר \(k=60\) כברירת מחדל. מסמך שמדורג ראשון בשני הדירוגים מקבל \(\frac{1}{61} + \frac{1}{61} \approx 0.033\), בעוד מסמך שמדורג 50 בשניהם מקבל \(\frac{1}{110} + \frac{1}{110} \approx 0.018\). התוצאה: מסמכים שמופיעים גבוה בשניהם עולים, גם אם לא ראשונים בדירוג בודד.

**Semantic Ranker, מדרגן סמנטי** הוא שירות נפרד (S1 tier ומעלה) שמקבל עד 50 תוצאות מהחיפוש הקודם ומסדר אותן מחדש עם מודל cross-encoder (transformer בסגנון BERT). הוא גם מחלץ captions ו-answers מן המסמכים. חשוב: הוא לא מחפש, הוא רק מסדר מחדש. ציון ה-Semantic Ranker נע בין 0 ל-4, בשדה `@search.reranker_score`.

**Indexer, מאנדקס** הוא תהליך מתוזמן שמושך נתונים ממקור (Blob Storage, Azure SQL, Cosmos DB) ל-index. הוא עובד עם **Skillset, צינור העשרה** שמריץ enrichment של AI (OCR, key phrase extraction, entity recognition) על הנתונים לפני האינדוקס.

## דוגמה מחושבת

יצירת index עם שדה וקטורי וחיפוש היברידי:

```python
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex, SimpleField, SearchableField,
    SearchFieldDataType, VectorSearch,
    HnswAlgorithmConfiguration, VectorSearchProfile, SearchField
)
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from azure.identity import DefaultAzureCredential

ENDPOINT = "https://my-search.search.windows.net"
INDEX    = "docs"
cred     = DefaultAzureCredential()

# --- יצירת index ---
fields = [
    SimpleField(name="id", type=SearchFieldDataType.String, key=True),
    SearchableField(name="content", type=SearchFieldDataType.String),
    SimpleField(name="category",
                type=SearchFieldDataType.String,
                filterable=True, facetable=True),
    SearchField(
        name="content_vector",
        type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
        vector_search_dimensions=1536,         # text-embedding-3-small
        vector_search_profile_name="hnsw-profile",
    ),
]
vector_search = VectorSearch(
    algorithms=[HnswAlgorithmConfiguration(name="hnsw-algo")],
    profiles=[VectorSearchProfile(name="hnsw-profile",
                                  algorithm_configuration_name="hnsw-algo")],
)
idx_client = SearchIndexClient(endpoint=ENDPOINT, credential=cred)
idx_client.create_or_update_index(
    SearchIndex(name=INDEX, fields=fields, vector_search=vector_search)
)

# --- חיפוש היברידי ---
search_client = SearchClient(endpoint=ENDPOINT, index_name=INDEX, credential=cred)
query_vector = get_embedding("מה ההבדל בין supervised ל-unsupervised learning?")

results = search_client.search(
    search_text="supervised unsupervised learning",   # BM25
    vector_queries=[VectorizedQuery(
        vector=query_vector,
        k_nearest_neighbors=50,
        fields="content_vector",
    )],
    query_type="semantic",                            # הפעל Semantic Ranker
    semantic_configuration_name="my-semantic-cfg",
    top=5,
    select="id,content,category",
)

for r in results:
    print(r["id"],
          "rrf:", round(r["@search.score"], 3),
          "sem:", round(r.get("@search.reranker_score", 0), 3))
```

פלט טיפוסי (5 תוצאות):

```
doc-42  rrf: 0.031  sem: 3.82
doc-17  rrf: 0.029  sem: 3.71
doc-05  rrf: 0.033  sem: 3.40
doc-91  rrf: 0.018  sem: 3.22
doc-03  rrf: 0.027  sem: 2.95
```

שים לב: doc-05 היה הגבוה ביותר ב-RRF (0.033) אבל ה-Semantic Ranker הורידו למקום שלישי.

## המקרה שמפיל את האינטואיציה

**הנחה שגויה**: "Semantic Ranker ימצא מסמכים שהחיפוש הראשוני פספס."

בפועל, Semantic Ranker מסדר תוצאות שכבר הגיעו מהחיפוש הראשוני. אם מסמך לא נכנס ל-50 התוצאות הראשונות של BM25 ו-vector יחד, הוא בלתי נגיש ל-Semantic Ranker. ה-recall נקבע על ידי שכבת ה-BM25/vector, לא על ידי ה-reranker.

זה בלבל פרויקטים שהוסיפו Semantic Ranker בציפייה לתוצאות חדשות - וגילו שהוא רק משפר את הסדר בתוך מה שכבר הגיע.

## טעויות נפוצות

**הגדרת `filterable=True` על שדות טקסט ארוכים**. Filter מאחסן את הערך המלא. על שדה `content` של אלפי מילים, `filterable=True` מכפיל את גודל ה-index ועלויותיו, מבלי שום תועלת בפועל. Filter מיועד לשדות עם cardinality נמוך: category, status, author.

**ציפייה שחיפוש וקטורי יחזיר "לא נמצא"**. חיפוש וקטורי תמיד מחזיר k הוקטורים הקרובים ביותר, גם אם הם אינם רלוונטיים. ללא minimum score threshold, צינור ה-RAG יקבל תוצאות שגויות. הוסף בדיקת ציון מינימלי בצינור.

**שכחה לעדכן embedding כשמסמך משתנה**. Indexer מריץ מחדש enrichment רק על מסמכים ששונו, ורק אם מוגדר `change_detection_policy` על ה-datasource. בלי זה, blob שעודכן ב-Storage לא יתעדכן ב-index.

**ערבוב `@search.score` (RRF) עם `@search.reranker_score` (semantic)**. השניים בסקאלות שונות לחלוטין: RRF הוא בין 0 ל-~0.05, semantic הוא בין 0 ל-4. השוואה ישירה בין השניים חסרת משמעות.

## מתי זה לא משנה

אם הנתונים מונים מאות מסמכים, BM25 פשוט (בחינם ב-Azure AI Search עד 3 indexes קטנים) מספיק. Semantic Ranker עולה כסף (S1+) ומוסיף latency של 100-300ms לשאילתה; כדאי רק כשאיכות הדירוג חשובה יותר ממהירות.

לראיון: "מה ההבדל בין keyword ל-vector search?" - keyword מוצא מילים, vector מוצא משמעות; "מה עדיף?" - hybrid עם RRF, כי הם משלימים.

## חיבור

יחידה זו ממשיכה את m5-rag-on-azure - שם ה-index הוא ה-vector store שמחזיר chunks לצינור ה-RAG. היא ממשיכה גם את m5-foundry-sdk-apps ד`AIProjectClient` יכול להתחבר ל-index. היא פותחת את m5-agent-approval שבו agent משתמש ב-AI Search כ-tool לאחזור ידע לפני שהוא מציע פעולה הדורשת אישור אנושי.

```quiz
{"id":"u-m5-ai-search-q1","tree":"ops","skill":"azure-foundry","q":"מה עושה ה-Semantic Ranker ב-Azure AI Search?","options":["מחפש מסמכים חדשים שלא נמצאו בחיפוש הראשוני","מסדר מחדש עד 50 תוצאות שהגיעו מהחיפוש הראשוני","ממיר שאילתות לוקטורי embedding","ממזג תוצאות BM25 ו-vector עם RRF"],"answer":1,"explain":"ה-Semantic Ranker לא מחפש - הוא מקבל עד 50 תוצאות מהשכבות הקודמות (BM25, vector או hybrid) ומסדר אותן מחדש עם cross-encoder transformer. ה-recall נקבע לפני הגעה אליו."}
```

```quiz
{"id":"u-m5-ai-search-q2","tree":"ops","skill":"azure-foundry","q":"נוסחת RRF ממזגת דירוגים. אם מסמך מדורג ראשון ב-BM25 וראשון ב-vector (k=60), מה ציון ה-RRF שלו?","options":["1.0","0.5","כ-0.033","כ-0.016"],"answer":2,"explain":"RRF(d) = 1/(60+1) + 1/(60+1) = 2/61 ≈ 0.033. נוסחת RRF: לכל ranker מחשבים 1/(k+rank), ואז מסכמים. k=60 כברירת מחדל ב-Azure AI Search."}
```

```fillin
{"id":"u-m5-ai-search-f1","tree":"ops","skill":"azure-foundry","prompt":"ציון ה-Semantic Ranker ב-Azure AI Search נמצא בשדה _____ ונע בין _____ ל-_____.","answer":"@search.reranker_score, 0, 4","alt":["reranker_score, 0, 4","@search.reranker_score, 0 ל-4"],"explain":"ה-Semantic Ranker מחזיר @search.reranker_score בין 0 ל-4. ציון ה-RRF (hybrid) נמצא ב-@search.score ונע בין 0 לכ-0.05."}
```

```concepts
{"items":[{"id":"ai-search-index","t":"Azure AI Search Index","he":"אינדקס חיפוש","d":"טבלה וירטואלית ב-Azure AI Search המאחסנת מסמכים עם שדות מוגדרים; תכונות שדה (searchable, filterable, vectorSearchable) קובעות מה אפשר לעשות עם כל שדה.","rel":["c-azure-file-search","ai-search-hybrid"],"node":"azure-core"},{"id":"ai-search-hybrid","t":"Hybrid Search","he":"חיפוש היברידי","d":"מצב חיפוש ב-Azure AI Search שמריץ BM25 ו-vector search במקביל ומאחד את הדירוגים עם Reciprocal Rank Fusion.","rel":["ai-search-index","ai-search-semantic-ranker","ai-search-rrf"],"node":"azure-core"},{"id":"ai-search-rrf","t":"Reciprocal Rank Fusion","he":"מיזוג דירוגים הדדי","d":"נוסחה המחשבת RRF(d) = sum(1/(k+rank_r(d))) על פני כל הדירוגים; k=60 כברירת מחדל. מסמך שגבוה בכמה דירוגים מקבל boost.","rel":["ai-search-hybrid"],"node":"azure-core"},{"id":"ai-search-semantic-ranker","t":"Semantic Ranker","he":"מדרגן סמנטי","d":"שירות Azure (S1+) שמסדר מחדש עד 50 תוצאות חיפוש ראשוני עם cross-encoder transformer; מחזיר @search.reranker_score בין 0 ל-4.","rel":["ai-search-hybrid","ai-search-index"],"node":"azure-core"},{"id":"ai-search-hnsw","t":"HNSW","he":"גרף היירארכי לחיפוש וקטורי","d":"Hierarchical Navigable Small World: אלגוריתם approximate nearest-neighbor ב-O(log n) המשמש את Azure AI Search לחיפוש וקטורי.","rel":["ai-search-index"],"node":"azure-core"}]}
```

<!-- audited -->
