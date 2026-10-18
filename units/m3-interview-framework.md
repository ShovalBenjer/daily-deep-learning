# מסגרת הראיון

ראיין מסתכל בשעון: "תכנן מערכת הודעות כמו WhatsApp." בלי מסגרת, 45 דקות נעלמות בין חפירה בפרטים ושכחת התמונה הגדולה.

## מה תדע בסוף

לנווט כל שאלת system design בארבעה שלבים מובנים, לחלק את הזמן נכון, ולספק תשובה שמשדרת בגרות הנדסית ולא רק ידע טכני.

## האינטואיציה

דמיין ארכיטקט שמקבל בקשה לבנות בניין. הוא לא מתחיל לחשב עמודות בטון לפני שהוא שואל: כמה דיירים? כמה קומות? איפה הכניסות? תקציב?

שאלת system design בראיון פועלת אותו הדבר. המשפט הפותח, "תכנן X", הוא לא מפרט. הוא שם של בעיה. **המסגרת, interview framework** היא חוזה בין הראיין למרואיין: תחילה מסכימים מה בונים, ורק אז בונים.

ארכיטקט שמתחיל לבנות לפני שסיכם עם הלקוח יבנה קומה שלמה שצריך להרוס. מרואיין שמתחיל לצייר שרתים לפני שהגדיר scale יתכנן למיליון משתמשים כשהמערכת תצטרך לשרת מיליארד.

## ההגדרות המדויקות

### Step 1: Understand the problem, הגדרת הבעיה (3-10 דקות)

המטרה: להבין מה בונים לפני שבונים.

**Functional requirements, דרישות פונקציונליות (FR)**: מה המערכת עושה? מה פעולות הליבה? בשירות הודעות: משתמש שולח הודעה, מקבל הודעה, רואה היסטוריה. אלה ה-features שהמשתמש חווה ישירות.

**Non-functional requirements, דרישות לא-פונקציונליות (NFR)**: כמה, כמה מהר, כמה אמינה. NFR כוללות:
- Scale: כמה משתמשים פעילים? כמה בקשות לשנייה?
- Latency: מה זמן תגובה מקסימלי מקובל?
- Availability: מה uptime מינימלי? 99.9%? 99.99%?
- Consistency: האם נתון ישן מקובל זמנית?
- Durability: האם אסור לאבד נתונים?

**Scale estimation, הערכת גודל**: חישוב back-of-envelope מהיר. מתוך scale נגזרים כל ההחלטות הארכיטקטוניות. DAU (Daily Active Users) כפול פעולות ממוצעות למשתמש ליום מחולק ב-86400 שניות = QPS (Queries Per Second). אחסון: כמה bytes לרשומה כפול כמה רשומות ביום כפול כמה ימי שמירה.

שאלות טובות לשאול בStep 1:
- "כמה DAU?"
- "מה יחס קריאות לכתיבות?"
- "האם תמיכה ב-mobile? web? שניהם?"
- "מה ה-SLA הנדרש לlatency?"
- "האם נדרש strong consistency, או eventual consistency מספיק?"

### Step 2: High-level design, תכנון ברמה גבוהה (10-15 דקות)

המטרה: sketch ראשוני שמקבל אישור מהראיין לפני שמעמיקים.

**API design**: אילו endpoints? REST או WebSocket? מה הפרמטרים המינימליים? לא צריך document API מלא, רק את ה-signatures הקריטיים.

**Data model**: אילו tables ו-documents? מה ה-schema הבסיסי? key entities ויחסים ביניהם. לא צריך כל column, רק את ה-primary keys ו-foreign keys.

**High-level diagram**: קופסאות ועוגנים. Client, Load Balancer, Service, Database, Cache. ללא פרטי implementation עדיין. המטרה היא שהראיין יראה שאתה מבין את הזרימה הכללית.

חשוב: לאחר ה-sketch שואלים את הראיין "האם אנחנו מסכימים על הכיוון לפני שאני מעמיק?" הסכמה מפורשת כאן מונעת בזבוז זמן על כיוון שגוי.

### Step 3: Design deep dive, ירידה לפרטים (10-25 דקות)

המטרה: להעמיק בחלקים שהראיין רוצה לשמוע עליהם, ובצווארי הבקבוק שמזוהים.

בStep 3 בוחרים 2-3 נושאים ומעמיקים בהם לגמרי, לא מנסים לכסות הכול:
- Database choice ולמה: SQL לעומת NoSQL, trade-offs
- Caching strategy: read-through, write-back, TTL
- Sharding ו-consistent hashing לנתונים בgigabytes+
- Message queue לניתוק services
- Rate limiting להגנה על API
- Failover ו-replication

האפן הנכון: "אני רוצה להתעמק בבעיית ה-ID generation. יש שלוש גישות..." ולהצגת כל גישה עם trade-offs.

### Step 4: Wrap up, סיכום וביקורת עצמית (3-5 דקות)

המטרה: להראות חשיבה של מהנדס senior שמבין שכל תכנון הוא trade-off.

נושאים לStep 4:
- מה ה-bottlenecks בתכנון הנוכחי ואיך אפשר לטפל בהם?
- מה ה-failure modes? מה קורה כשה-database נופל? כשה-cache נופל?
- מה monitoring? אילו metrics קריטיים?
- איזה חלק היית מאחסן אחרת עם עוד זמן?

### חלוקת הזמן בראיון של 45 דקות

Step 1 (5-7 דקות) לStep 2 (10-15 דקות) לStep 3 (15-20 דקות) לStep 4 (3-5 דקות). השגיאה הנפוצה ביותר היא Step 1 שמתמשך ל-20 דקות ומשאיר 5 דקות ל-deep dive.

### מה הראיין בוחן

ראיין system design בוחן ארבעה דברים:

1. **Clarity of thought, בהירות מחשבה**: האם ניתן לארגן רעיונות לתשובה קוהרנטית תחת לחץ?
2. **Trade-off awareness, מודעות ל-trade-offs**: "בחרתי PostgreSQL" לעומת "בחרתי PostgreSQL כי הנתונים relational, הטרנזקציות קריטיות, וNoSQL לא מוסיף כאן."
3. **Back-of-envelope estimation**: האם יודעים לחשב גדלי מערכות ולגזור החלטות ארכיטקטוניות?
4. **Communication**: האם עובדים עם הראיין ומתייעצים, או עובדים לבד בשתיקה?

## דוגמה מחושבת

שאלה: "תכנן שירות URL shortener כמו bit.ly"

**Step 1 (6 דקות)**:

FR: משתמש מזין URL ארוך ומקבל URL קצר. לחיצה על URL קצר מפנה לURL הארוך. ניהול URLs לא בראיון הזה.

NFR: 100 מיליון URLs נוצרים ביום. יחס קריאות:כתיבות = 10:1. Availability 99.9%. Latency של redirect מתחת ל-100ms.

הערכת גודל:
- כתיבות: \(100 \times 10^6 / 86400 \approx 1160\) QPS
- קריאות: \(1160 \times 10 = 11{,}600\) QPS
- אחסון: כל URL בערך 100 bytes, שנה = \(100M \times 365 \times 100 = 3.65\) TB

**Step 2 (12 דקות)**:

API:
- `POST /api/v1/urls` עם body `{longUrl}`, מחזיר `{shortUrl}`
- `GET /{code}` מחזיר HTTP 301 redirect ל-longUrl

Data model:

```
urls(id BIGINT PK, short_code CHAR(7), long_url VARCHAR(2048), created_at TIMESTAMP)
```

High-level: Client לLoad Balancer לURL Service ל(Redis Cache + MySQL).

**Step 3 (18 דקות)**:

Short code generation: 7 תווים מ-`[a-zA-Z0-9]` נותנים \(62^7 \approx 3.5 \times 10^{12}\) combinations. שתי גישות:
- Hash של ה-URL: לוקחים 7 תווים ראשונים מ-MD5. חיסרון: collisions אפשריים.
- Base62 encoding של global counter: מספר רץ, ממיר לbase62. חיסרון: ה-counter הוא single point of failure. פתרון: Snowflake ID שמחלק counter בין machines.

Redirect caching: 20% מה-URLs מייצרים 80% מהתנועה. Redis cache עם TTL של שעה. read-through: בדוק cache, אם אין לך לבדוק DB ולשמור בcache.

Database: MySQL. הנתונים relational ופשוטים, הטרנזקציות קריטיות לייחודיות ה-short code.

**Step 4 (4 דקות)**:

Bottlenecks: ה-counter service כ-single point of failure ב-Snowflake approach. Monitoring: redirect latency p99, cache hit rate, error rate.

זה תשובה של 8 מתוך 10.

## המקרה שמפיל את האינטואיציה

"אני יודע הרבה על databases, אז אתחיל ישר מ-database design."

השגיאה: מדלגים על Step 1 כי "ברור מה רוצים". זה מוביל לתשובה טכנית מוצלחת לשאלה הלא נכונה.

כשהראיין שואל "תכנן Twitter Feed", הוא לא תמיד שואל על אותה בעיה. לפעמים הוא רוצה לדון ב-fan-out on write לעומת fan-out on read. לפעמים על global timeline. לפעמים רק על ה-API design. בלי Step 1 מפורש, אפשר לדבר על X בזמן שהוא מצפה לשמוע על Y.

הביטוי המסגיר: "כן, כן, אבל מה עם scale?" מהראיין. זה בדרך כלל סימן שדילגת על NFR בStep 1.

## טעויות נפוצות

1. **פתרון לפני הגדרה**: מתחילים לצייר ארכיטקטורה לפני Step 1. הראיין רואה את זה כסימן לחשיבה לא מסודרת ולחוסר יכולת לנהל אי-ודאות.

2. **Step 1 ארוך מדי**: 20 דקות על דרישות ו-5 דקות על תכנון. הראיין רוצה לראות עומק הנדסי, לא שאלונים מפורטים. 5-7 דקות לStep 1 ואז קדימה.

3. **שתיקה ועבודה לבד**: System design הוא dialog, לא מבחן כתוב. עדכון הראיין כל 5 דקות ושאילת אישור לפני deep dive = נקודות תקשורת.

4. **Deep dive בכל מקום**: מנסים לכסות הכול בStep 3 ומסיימים עם כלום מעמיק. 2-3 נושאים בעומק עדיפים על 8 נושאים ברדיחות.

5. **הצהרות ללא trade-offs**: "בחרתי NoSQL" בלי הסבר אינה תשובה. "בחרתי Cassandra כי הנתונים unstructured, write-heavy, ואני מוכן לוותר על strong consistency" מראה הבנה.

## מתי זה לא משנה

לחברות סטארטאפ קטנות, ראיונות system design מתנהגים אחרת. לפעמים שואלים על codebase קיים, לפעמים על בעיה ספציפית מה-product. המסגרת עדיין שימושית אך פחות פורמלית.

עבור senior roles, Step 4 הופך לחלק המרכזי. הם מצפים לזיהוי עצמי של חולשות ב-design שהוצג ולהצעת שיפורים עתידיים. "אם היו לי עוד חודשיים, הייתי מוסיף X כי Y."

ב-Google (L5-L6+) המסגרת NALSD (Needles, Availability, Latency, Scale, Debugging) מוסיפה שכבה על המסגרת הכללית. אבל כל מסגרת מתחילה מאותה נקודה: הגדר לפני שתבנה.

## חיבור

מסגרת הראיון היא ה-scaffolding לכל יחידות M3. כל case study בבלוק, ממסגרת הראיון דרך m3-url-shortener ועד m3-stock-exchange, מיישם את ארבעת השלבים. אחרי שהמסגרת ברורה, כל יחידה חדשה מוסיפה עומק בתחום ספציפי: consistent hashing, rate limiting, message queues.

הדבר הראשון לתרגל: לבד, בזמן מדוד, לפתוח שאלת system design ולכתוב תשובה לפי המסגרת לפני קריאת ה-solution. הראיין בוחן process, לא product.

```quiz
{"id":"u-m3-interview-framework-q1","tree":"systems","skill":"system-design","q":"מרואיין מקבל את השאלה 'תכנן Twitter Feed'. הוא מתחיל מיד לתאר כיצד database sharding יעבוד עם consistent hashing. מה הטעות?","options":["הוא לא הציע API design לפני database design","הוא דילג על Step 1 ולא הגדיר אם הראיין רוצה דיון ב-fan-out, ב-timeline, או ב-API","הוא בחר consistent hashing לפני שבדק אם DynamoDB מספיק","הוא עבד בשתיקה ולא עדכן את הראיין"],"answer":1,"explain":"בלי Step 1, המרואיין מניח שהוא יודע מה הראיין רוצה. 'Twitter Feed' יכולה להיות שאלה על fan-out on write לעומת fan-out on read, על global timeline, על notification system, או על API design. לכל אחת מהן deep dive שונה לחלוטין. Step 1 מסכים על איזו בעיה בדיוק פותרים."}
```

```quiz
{"id":"u-m3-interview-framework-q2","tree":"systems","skill":"system-design","q":"ב-step 1 של ראיון system design, מה ההבדל בין functional requirement לnon-functional requirement?","options":["FR הוא מה המערכת עושה; NFR הוא כמה טוב היא עושה את זה","FR הוא עבור developers; NFR הוא עבור business stakeholders","FR נבדק ביחידת בדיקות; NFR נבדק בintegration tests","FR תמיד ניתן לאימות; NFR הוא רק מטרה"],"answer":0,"explain":"Functional requirements מגדירים את הפעולות שהמערכת מבצעת: מה inputs, outputs, ו-behaviors. Non-functional requirements מגדירים איכות הביצועים: latency, availability, throughput, consistency, durability. שניהם נבדקים ושניהם ניתנים לאימות, אבל עם כלים שונים."}
```

```concepts
{"items":[{"id":"interview-framework","t":"Interview framework","he":"מסגרת הראיון","d":"ארבעה שלבים לשאלת system design: הגדרת בעיה, תכנון ראשוני, deep dive, סיכום","rel":["functional-requirements","nonfunctional-requirements","back-of-envelope"],"node":"sysdesign"},{"id":"functional-requirements","t":"Functional requirements","he":"דרישות פונקציונליות","d":"מה המערכת עושה: הפעולות, הinputs והoutputs שהמשתמש חווה","rel":["nonfunctional-requirements","interview-framework"],"node":"sysdesign"},{"id":"nonfunctional-requirements","t":"Non-functional requirements","he":"דרישות לא-פונקציונליות","d":"כמה טוב המערכת עובדת: scale, latency, availability, consistency, durability","rel":["functional-requirements","interview-framework","back-of-envelope"],"node":"sysdesign"}]}
```
