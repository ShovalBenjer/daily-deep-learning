# שירות קרבה
מאחורי "מסעדות קרובות אליי" עומדת שאלת ראיון קלאסית: כיצד מאחסנים ומחפשים מיליוני עסקים לפי מיקום ביעילות?

## מה תדע בסוף

לתכנן שירות קרבה ברמת ראיון בכיר: לגזור את גדל ה-dataset מ-back-of-envelope, לנמק את בחירת Geohash לעומת Quad-tree, לתאר schema ו-read path מלא, ולהסביר את בעיית גבול ה-geohash ופתרונה בחיפוש ב-9 תאים.

## האינטואיציה

דמיין שהמפה כולה מחולקת לרבועים כמו לוח שחמט. לכל רבוע יש קוד קצר. רבועים שחולקים קידומת של הקוד הם שכנים גיאוגרפיים: `sv8wzb` ו-`sv8wzc` נמצאים צמודים, בדיוק כמו שמספרי בית עוקבים מציינים בניינים סמוכים.

זה בדיוק **Geohash, גיאוהאש**: קידוד של קו רוחב ואורך למחרוזת שמאפשר חיפוש שכנים על ידי prefix בלבד. הרווח: חיפוש מרחבי דו-ממדי הופך לשאילתת `IN` פשוטה על מחרוזות, שאינדקס B-tree רגיל מטפל בה מצוין.

## ההגדרות המדויקות

### דרישות המערכת

| פרמטר | ערך |
|-------|-----|
| עסקים במאגר | 200 מיליון |
| משתמשים נוכחיים | 100 מיליון |
| בקשות חיפוש לשנייה | כ-5000 QPS |
| latency יעד | 200ms p99 |

**Non-functional requirements**: זמינות גבוהה (99.9%), חיפוש מדויק לכל עסק בתוך הרדיוס, עדכוני מיקום עסק בזמן סביר (שניות ולא מיידי).

---

**Geohash, גיאוהאש**: אלגוריתם שמקודד קואורדינטות גיאוגרפיות למחרוזת בסיס 32. ה-encoding בונה את המחרוזת על ידי חלוקה סירוגין (interleaving) של ביטי הרוחב והאורך. ככל שהמחרוזת ארוכה יותר, כך האזור המיוצג קטן יותר.

| אורך Geohash | שטח משוער |
|-------------|-----------|
| 4 | 40 × 20 ק"מ |
| 5 | 5 × 5 ק"מ |
| 6 | 1.2 × 0.6 ק"מ |
| 7 | 150 × 150 מ' |

לחיפוש עסקים ברדיוס של 1 ק"מ מתאים precision=6; לרדיוס 100 מ' מתאים precision=7.

**Quad-tree, עץ רבעי**: מבנה נתונים עצי שמחלק את המפה לארבעה רבעים רקורסיבית עד שכל עלה מכיל פחות מ-N עסקים. מדויק יותר מ-Geohash לאזורים עם צפיפות לא אחידה, אך מורכב הרבה יותר לתחזוקה: הוספת עסק עלולה לחלק תא, ושינוי עלול לדרוש איזון מחדש של עץ בזיכרון.

**Haversine distance, מרחק הוורסין**: נוסחה לחישוב מרחק בין שתי נקודות על פני כדור:
\[d = 2r \cdot \arcsin\!\left(\sqrt{\sin^2\!\frac{\Delta\phi}{2} + \cos\phi_1\cos\phi_2\sin^2\!\frac{\Delta\lambda}{2}}\right)\]
יקר לחישוב על כל עסק; לכן Geohash משמש כ-filter ראשוני ו-Haversine רק לסינון סופי.

---

### API

שתי נקודות קצה עיקריות:

```
GET /v1/search/nearby?lat=32.085&lng=34.782&radius=1000
Response: {
  "businesses": [
    { "id": "biz-7482", "name": "קפה נמרוד", "lat": 32.084, "lng": 34.781, "distance": 240 },
    ...
  ]
}

GET /v1/businesses/{id}
Response: { full business object }
```

---

### Schema

```sql
CREATE TABLE businesses (
  business_id  BIGINT        PRIMARY KEY,
  name         VARCHAR(255)  NOT NULL,
  lat          DECIMAL(9,7)  NOT NULL,
  lng          DECIMAL(10,7) NOT NULL,
  geohash6     CHAR(6)       NOT NULL,
  address      TEXT,
  created_at   TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX idx_geohash6 ON businesses(geohash6);
```

**למה לא אינדקס מרחבי?** MySQL InnoDB תומך ב-SPATIAL INDEX, אבל הוא עובד טוב רק עם geometry columns ולא עם DECIMAL. PostGIS (PostgreSQL) תומך היטב, אבל ל-read-heavy service בקנה מידה גדול, Redis Geo Cache או שאילתת IN על geohash6 מנצחות ב-latency.

---

### Read path

```
1. Client: GET /nearby?lat=X&lng=Y&radius=R
2. Location Service:
   a. compute_geohash(X, Y, precision=6) → "sv8wzb"
   b. get_neighbors("sv8wzb") → ["sv8wzc","sv8wzd",...] (8 neighbors)
   c. Redis GEORADIUS hit? → return cached result
   d. DB: SELECT * FROM businesses
          WHERE geohash6 IN ('sv8wzb','sv8wzc',...) [9 values]
   e. Filter: Haversine(biz.lat, biz.lng, X, Y) <= R
   f. Return sorted by distance
   g. Cache result in Redis (TTL 60s)
```

## דוגמה מחושבת

### back-of-envelope

```
200M עסקים
גודל שורה: ~200 bytes
גודל DB: 200M × 200 = 40 GB
  → 40 GB נכנס ב-read replica אחד (instance גדול)
  → 2-3 read replicas מספיקים

QPS שיא:
  100M משתמשים × 5 חיפושים ביום = 500M חיפושים/יום
  500M / 86400 ≈ 5800 QPS
  → 3 application servers עם LB
```

### דוגמת geohash encoding לתל אביב

קואורדינטות: `32.0853, 34.7818`

ה-encoding מחלק את הטווח של הרוחב והאורך לסירוגין לביטים:
```
lat ∈ [-90, 90]: 32.0853 → ביטים: 1 0 1 1 1 0 1 ...
lng ∈ [-180, 180]: 34.7818 → ביטים: 1 0 1 1 1 1 0 ...
Interleave: 11 00 11 11 11 01 10 ...
כל 5 ביטים → תו Base32
```

תוצאה: `Geohash(32.0853, 34.7818, precision=6) = "sv8wzb"`

שכנים:
```python
import geohash2
neighbors = geohash2.neighbors("sv8wzb")
# → {'n': 'sv8wze', 'ne': 'sv8wzf', 'e': 'sv8wzc', 'se': 'sv8wy3',
#     's': 'sv8wy2', 'sw': 'sv8wy0', 'w': 'sv8wz8', 'nw': 'sv8wzd'}
```

שאילתת ה-DB:
```sql
SELECT business_id, name, lat, lng
FROM businesses
WHERE geohash6 IN (
  'sv8wzb', 'sv8wze', 'sv8wzf', 'sv8wzc',
  'sv8wy3', 'sv8wy2', 'sv8wy0', 'sv8wz8', 'sv8wzd'
);
-- מחזיר עסקים מ-9 תאים; מסנן אח"כ עם Haversine
```

## המקרה שמפיל את האינטואיציה

**בעיית הגבול (boundary problem)**: שתי מסעדות שנמצאות 10 מטר זו מזו, אחת ממש מצפון לקו גבול geohash ואחת ממש מדרום לו, מקבלות geohash6 שונה לחלוטין.

```
מסעדה א: lat=32.0860, lng=34.7820 → geohash6 = "sv8wzb"
מסעדה ב: lat=32.0855, lng=34.7820 → geohash6 = "sv8wy2"  (תא שכן דרומי)
מרחק בין א לב: 55 מטר
```

חיפוש על "sv8wzb" בלבד יחמיץ את מסעדה ב, למרות שהיא 55 מטר ממקום המשתמש.

**הפתרון היחיד**: לתמיד לחפש ב-9 תאים, התא עצמו ו-8 שכניו. עלות: 9× גדול יותר מרשימת geohash אחד, אך זניח לעומת עלות חיפוש Haversine על כל 200M רשומות.

**בעיה נוספת: אי-אחידות גיאוגרפית.** geohash precision=6 מייצג 1.2 × 0.6 ק"מ ליד קו המשווה, אבל ליד הקוטב הצפוני אותו precision מייצג שטח קטן בהרבה. שירות שפועל ב-Scandinavia צריך לבדוק אם precision=6 מכסה את הרדיוס הרצוי.

## טעויות נפוצות

**לא לחפש בשכנים.** זו הטעות הנפוצה ביותר. חיפוש על geohash6 של המשתמש בלבד יחמיץ עסקים ממש מעבר לגבול תא. תמיד מחפשים ב-9 תאים.

**לבחור precision גבוה מדי.** precision=8 (תאים של ~40×20 מ') לחיפוש ברדיוס של 5 ק"מ פירושו מאות שכנים לסרוק ומאות שאילתות. precision צריך להתאים ל-use case: מסעדות קרובות precision=6, חיפוש בתוך עיר precision=4.

**לאחסן רק lat/lng ולחפש עם `BETWEEN`.** `WHERE lat BETWEEN x1 AND x2 AND lng BETWEEN y1 AND y2` דורש סריקת שני אינדקסים נפרדים ואז intersection, שהמנוע אינו עושה בצורה יעילה. ב-5000 QPS זה ייפול.

**לסמוך על Redis GEO בלבד.** Redis `GEORADIUS` ו-`GEOSEARCH` עובדים מצוין, אבל Redis הוא in-memory ו-single-threaded לכתיבות. עדכוני מיקום תכופים (עסקים שנסגרים, נפתחים) דורשים write pipeline נפרד עם buffering לפני העדכון ב-Redis.

## מתי זה לא משנה

**Dataset קטן (<500K עסקים)**: PostGIS עם `ST_DWithin` יכול לסרוק את כל הטבלה תוך אלפיות שנייה. ה-engineering complexity של Geohash לא מוצדקת, ו-PostGIS תומך גם ב-polygon queries.

**כשהשאילתות הן פוליגונים**: "כל העסקים בתוך שכונת פלורנטין" הוא polygon containment. Geohash לא מתאים לזה. PostGIS עם `ST_Contains` הוא הכלי הנכון.

**כשהקרבה היא זמן נסיעה ולא מרחק אוירי**: "המסעדה הקרובה ביותר לפי זמן נהיגה" דורש graph traversal על רשת הכבישים ולא spatial index. לזה משתמשים ב-Routing Engine (OSRM, Valhalla) או Google Maps Routes API.

## חיבור

יחידה זו שייכת לבלוק M3, System Design Interview. היא מניחה היכרות עם `m3-back-of-envelope` לחישובי גדלים ועם `m3-key-value-store` לביסוס ה-Redis cache layer. `m3-consistent-hashing` מסביר כיצד מחלקים את טבלת ה-businesses ל-shards כשה-40 GB כבר לא נכנסים בשרת יחיד. `m3-rate-limiter` רלוונטי לשמירת ה-API מפני scraping.

```quiz
{"id":"u-m3-proximity-service-q1","tree":"systems","skill":"system-design","q":"שירות קרבה מחפש עסקים ב-geohash של המשתמש בלבד ומחמיץ עסק שנמצא 30 מטר ממנו. מה הסיבה?","options":["ה-precision של ה-geohash נמוך מדי","העסק נמצא בתא geohash שכן מעבר לגבול","ה-Haversine distance חושבה לא נכון","ה-cache פג תוקף"],"answer":1,"explain":"בעיית הגבול: שתי נקודות צמודות יכולות להיות בתאי geohash שונים לחלוטין אם הן משני צידי קו גבול. הפתרון הוא תמיד לחפש ב-9 תאים: התא עצמו ו-8 השכנים."}
```

```quiz
{"id":"u-m3-proximity-service-q2","tree":"systems","skill":"system-design","q":"לחיפוש עסקים ברדיוס של 1 ק\"מ, מה precision geohash מתאים?","options":["precision=3 (שטח של 600×300 ק\"מ)","precision=5 (שטח של 5×5 ק\"מ)","precision=6 (שטח של 1.2×0.6 ק\"מ)","precision=9 (שטח של ~5×5 מ')"],"answer":2,"explain":"precision=6 מייצג שטח של 1.2×0.6 ק\"מ, שמתאים לרדיוס של 1 ק\"מ. precision=5 גדול מדי (עלול להחזיר עסקים רחוקים מאוד). precision=9 קטן מדי (עסק צמוד עלול להיות בתא אחר עם מאות שכנים לסרוק)."}
```

```fillin
{"id":"u-m3-proximity-service-f1","tree":"systems","skill":"system-design","prompt":"בחיפוש proximity עם geohash, כדי לפתור את בעיית הגבול מחפשים תמיד ב-___ תאים (המספר).","answer":"9","alt":["תשעה"],"explain":"התא עצמו ועוד 8 שכנים (צפון, צפון-מזרח, מזרח, דרום-מזרח, דרום, דרום-מערב, מערב, צפון-מערב) = 9 תאים סה\"כ."}
```

```concepts
{"items":[{"id":"c-geohash","t":"Geohash","he":"גיאוהאש","d":"קידוד קואורדינטות גיאוגרפיות למחרוזת Base32 שבה קידומת משותפת = שכנות גיאוגרפית","rel":["c-quad-tree","c-proximity-service"],"node":"sysdesign"},{"id":"c-quad-tree","t":"Quad-tree","he":"עץ רבעי","d":"מבנה נתונים מרחבי שמחלק מפה לארבעה רבעים רקורסיבית עד שכל עלה מכיל פחות מ-N עסקים","rel":["c-geohash"],"node":"sysdesign"},{"id":"c-proximity-service","t":"Proximity service","he":"שירות קרבה","d":"שירות שמחזיר רשומות גיאוגרפיות (עסקים, מקומות) בתוך רדיוס נתון ממיקום משתמש","rel":["c-geohash","c-haversine"],"node":"sysdesign"},{"id":"c-haversine","t":"Haversine distance","he":"מרחק הוורסין","d":"נוסחה לחישוב המרחק הגדול-עיגולי בין שתי נקודות על כדור, בהינתן קואורדינטותיהן","rel":["c-proximity-service"],"node":"sysdesign"},{"id":"c-geohash-boundary","t":"Geohash boundary problem","he":"בעיית גבול גיאוהאש","d":"שתי נקודות צמודות יכולות להיות בתאי geohash שונים אם הן משני צידי קו גבול; הפתרון: לחפש ב-9 תאים","rel":["c-geohash"],"node":"sysdesign"}]}
```
