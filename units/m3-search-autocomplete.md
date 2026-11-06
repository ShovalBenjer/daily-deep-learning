# השלמה אוטומטית בחיפוש

כשמקלידים "ar" ב-Google ומקבלים עשר הצעות תוך 100 מילישניות, מאחורי הקלעים עומד שירות typeahead שמחזיק מיליארדי קידומות בזיכרון ומחזיר את הרלוונטיות ביותר מהר מרמיצת עין.

## מה תדע בסוף

לתכנן שירות השלמה אוטומטית ברמת ראיון: להסביר מדוע Trie הוא מבנה הנתונים הטבעי לשאילתות תחילית; לתאר כיצד topK cache מבטל traversal מלא בכל הקלדה; ולהסביר כיצד מחלקים את ה-Trie בין עשרות שרתים כשהאינדקס גדל למיליארדי קידומות.

## האינטואיציה

דמיין ספרייה שבה כל מדף מסומן באות אחת: "A", "B", "C"... בתוך מדף "A" יש תתי-מדפים "Aa", "Ab", "Ac"... מי שמחפש "ar" ניגש ישר למדף "Ar" ומוצא שם את כל הספרים שמתחילים בהם.

זה בדיוק ה-**Trie (עץ תחיליות)**: עץ שבו כל קשת היא תו, ואורח שורש-לצומת מאיית קידומת. הצומת שמאיית "ar" יודע מה הן הדרכות הפופולריות מכאן.

כדי שלא תצטרך לסרוק את כל תת-העץ של "ar" בכל הקלדה, כל צומת מחזיק **topK cache**: רשימה מוכנה מראש של K ההצעות הפופולריות ביותר שעוברות דרכו. שאילתה מגיעה לצומת ומחזירה את הרשימה ישירות.

## ההגדרות המדויקות

**Typeahead Service, שירות השלמה אוטומטית**: שירות שמקבל קידומת (הקלדה חלקית) ומחזיר עד K הצעות ממוינות לפי ציון. הציון הנפוץ הוא **תדירות שאילתה** - כמה פעמים שאלו בדיוק את המחרוזת הזו בחלון זמן נתון.

**TrieNode, צומת תחיליות**: המבנה `{children: dict[char→TrieNode], is_end: bool, frequency: int, top_K: list[str]}`.

**topK cache, מטמון K הטובים**: שדה `top_K` בכל צומת שמחזיק מראש את K ההצעות הטובות ביותר מתת-העץ שלו. חושב offline וממוחזר לעתים קרובות. חוסך traversal מלא בכל שאילתה.

**Data Aggregation Pipeline, צינור איסוף נתוני שאילתות**: התהליך שקורא logs גולמיות, מצבר תדירויות, מסנן שאילתות פוגעניות ומעדכן את ה-Trie. אין עדכון ב-real-time; מעדכנים במחזורים - שבועי ל-long-tail, שעתי לאחר טרנדים.

### API

```
GET /v1/search/autocomplete?prefix=ar&limit=10

Response: {
  "suggestions": [
    {"query": "ariel",          "score": 1240000},
    {"query": "architecture",   "score":  980000},
    {"query": "arabic food",    "score":  760000}
  ]
}
```

### הארכיטקטורה: שתי שכבות

```
Client
  │
  └─→ Load Balancer
            │
            ↓
       Typeahead Service   ←── Trie Store (read replicas)
       (stateless workers)

   [offline, בנפרד]
   Log Collector → Aggregation Job → Trie Builder → Trie Store
```

ה-read path: stateless עם topK cache; ה-write path: batch offline.

## דוגמה מחושבת

### back-of-envelope לGoogle Search

```
5 מיליארד חיפושים ביום
כל חיפוש ≈ 10 הקלדות → 50 מיליארד בקשות autocomplete ביום
QPS: 50,000,000,000 / 86,400 ≈ 578,000

שרת עם capacity של 1,000 req/sec → נדרשים ≈ 580 שרתים
SLA: 100ms → topK cache חיוני; traversal מלא מחזיר latency שניות
```

### בניית Trie קטן עם topK cache

```
שאילתות ותדירויות:
  "coffee"      → 300
  "code"        → 500
  "coding"      → 150
  "coffeeshop"  → 200

Trie (K=2 לכל צומת):
c
└─ o
   ├─ d  → topK: ["code","coding"]
   │  └─ e*  (500)
   │     └─ i → n → g*  (150)
   └─ f  → topK: ["coffee","coffeeshop"]
      └─ f → e → e*  (300)
                └─ s → h → o → p*  (200)

שאילתה "co":
  מגיעים לצומת "o" תחת "c"
  topK = ["code", "coffee"]   (500 ו-300 הם הגבוהים)
  תוצאה: ["code", "coffee"]  ב-O(2) בלי traversal
```

### גודל Trie בקנה מידה גדול

```
5 מיליארד שאילתות ייחודיות
ממוצע אורך: 30 תווים
צמתים: 5B × 30 × 0.5 (שיתוף קידומות) = 75 מיליארד

גודל צומת:
  10 children pointers × 8 bytes  = 80 bytes
  frequency (8 bytes)              =  8 bytes
  is_end (1 byte)                  =  1 byte
  סה"כ ≈ 90 bytes

גודל כולל: 75B × 90 ≈ 6.75 TB
```

6.75 TB לא נכנסים לשרת אחד. פתרון: **Sharding** לפי תו ראשון. 26 shards ל-a-z; תו לא-לטיני מקבל shard ייעודי.

## המקרה שמפיל את האינטואיציה

**"נעדכן את ה-Trie ב-real-time עם כל שאילתה."**

הבעיה: Trie הוא read-heavy (578,000 QPS קריאות). עדכון topK ב-nodes מהשורש עד הצומת הוא \(O(L)\) writes על nodes משותפים. תחת 578,000 write-QPS זה lock contention שמשתק.

בנוסף, שאילתות גסות מזהמות מיידית: "hack" ו-"free bitcoin" עולים ל-topK לפני שמסננים. הפתרון: data aggregation job שמנרמל וסונן לפני כל עדכון.

Trending topics (ויראלי ב-30 דקות אחרונות) מחייבים פתרון נפרד: sliding window aggregation כל 30 דקות ל-top N trending, שמוזרק לצומת השורש בלבד.

## טעויות נפוצות

**טעות 1: traversal מלא בכל שאילתה.**

"נגיע לצומת הקידומת ואז נעשה BFS על כל תת-העץ לחיפוש K הגדולים."

תת-עץ של "a" מכיל עשרות מיליוני צמתים. BFS עליהם בכל הקלדה = latency של שניות.

הפתרון: topK cache בכל צומת, מחושב offline. עלות: עדכון שעתי. רווח: כל שאילתה היא \(O(P)\) read בלי traversal.

---

**טעות 2: להחזיר ריק כשאין prefix match.**

כשמקלידים "xzq" ואין שאילתות שמתחילות כך, אסור להחזיר ריק. פתרון: fallback ל-popular defaults, או fuzzy matching שמסיר תו אחד ומנסה שוב. בראיון מספיק לאמר "fallback ל-N הפופולריים ביותר."

---

**טעות 3: שכיחת filtering.**

Trie גולמי מחזיר שאילתות פוגעניות ו-PII. ה-aggregation job, לא ה-read path, הוא המקום לסנן. אל תציע filter על ה-Trie בזמן שאילתה - זה מאחר ב-latency ומורכב לתחזוקה.

---

**טעות 4: להתעלם מ-Trie שחצי ממנו ריק.**

Trie naif עם כל 26 slots בכל צומת בוזבז כשהקורפוס דליל. HashMap מ-char לצומת-בן חוסך זיכרון משמעותי; בראיון ציין שבחרת `children: HashMap<char, TrieNode>` לא `children: [TrieNode; 26]`.

## מתי זה לא משנה

**קורפוס קטן.** עד כמה עשרות אלפי הצעות (שמות ב-admin, חיפוש פנימי באפליקציה), linear scan על רשימה ממוינת הוא פשוט ומספיק.

**פתרון מדף קיים.** Elasticsearch ו-OpenSearch תומכים ב-completion suggester מובנה. Azure AI Search מציע autocomplete API. בפרקטיקה production אלה עדיפים על Trie self-built. בראיון כדאי לציין שתי גישות: in-house Trie (נלמד פה) ו-off-the-shelf ולנמק מתי בוחרים כל אחת.

## חיבור

יחידה זו שייכת לבלוק M3 (System Design). היא נסמכת על back-of-envelope מ-`m3-back-of-envelope` ועל Trie הבסיסי מ-`m1-trie`. הפרדת read path מ-write path (data aggregation) חוזרת גם ב-`m3-web-crawler` ו-`m3-ad-click-aggregation`.

```quiz
{"id":"u-m3-search-autocomplete-q1","tree":"systems","skill":"system-design","q":"מה מאפשר ל-Typeahead Service להחזיר K הצעות ב-O(P) בלי לסרוק את כל תת-העץ של הצומת?","options":["Redis cache חיצוני שמאחסן את כל הקידומות","topK cache - רשימה מחושבת מראש שמאוחסנת בכל צומת","BFS על כל תת-העץ של הקידומת","binary search על רשימה ממוינת של שאילתות"],"answer":1,"explain":"כל צומת מאחסן מראש את K ההצעות הפופולריות ביותר מתת-העץ שלו (חושב offline). שאילתה מגיעה לצומת הקידומת ב-O(P) ומחזירה את topK ישירות ללא traversal נוסף."}
```

```quiz
{"id":"u-m3-search-autocomplete-q2","tree":"systems","skill":"system-design","q":"למה מעדכנים את ה-Trie ב-batch offline ולא ב-real-time עם כל שאילתה?","options":["כי Trie לא תומך בעדכונים בזמן ריצה","כי עדכון real-time יגרום ל-lock contention ויזהם את topK לפני סינון","כי logs נשמרים רק ב-batch","כי real-time גורם לאיבוד נתונים ב-crash"],"answer":1,"explain":"Trie הוא read-heavy (מאות אלפי QPS). עדכון topK מהשורש לעלה על כל שאילתה גורם ל-lock contention. בנוסף, שאילתות פוגעניות מזהמות את topK לפני שמסנן - הפתרון הוא aggregation job שמנרמל וסונן לפני כל עדכון."}
```

```concepts
{"items":[{"id":"c-typeahead-service","t":"Typeahead Service","he":"שירות השלמה אוטומטית","d":"שירות שמקבל קידומת ומחזיר עד K הצעות ממוינות לפי תדירות שאילתה, מגובה ב-Trie עם topK cache.","rel":["c-trie","c-trie-prefix"],"node":"sysdesign"},{"id":"c-topk-trie-cache","t":"topK cache in Trie","he":"מטמון K הטובים בצומת","d":"שדה top_K בכל צומת Trie שמחזיק מראש K ההצעות הפופולריות מתת-העץ; מחושב offline ומאפשר החזרת הצעות ב-O(P).","rel":["c-typeahead-service","c-trie"],"node":"sysdesign"},{"id":"c-typeahead-aggregation","t":"Typeahead Data Aggregation","he":"צינור איסוף נתוני שאילתות","d":"pipeline offline שקורא search logs, מצבר תדירויות, מסנן תכנים פוגעניים ומעדכן את ה-Trie - מופעל שעתי/יומי, לא real-time.","rel":["c-typeahead-service"],"node":"sysdesign"}]}
```
