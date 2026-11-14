# חברים בסביבה
כשהאפליקציה מראה "רחל נמצאת 2 ק"מ ממך", היא לא שאלה את רחל - היא עשתה query על מחרוזת אחת ב-Redis שמייצגת ריבוע על פני כדור הארץ.

## מה תדע בסוף
תדע לתכנן מערכת Nearby Friends לרמת ראיון: לחשב כמה עדכוני מיקום לשנייה מגיעים לשרת ב-100M משתמשים פעילים; לנמק מדוע **Geohash, גיאוהאש** עדיף על range query רגיל; לתאר ארכיטקטורה עם Location Service, Redis geospatial ו-WebSocket; לפתור את בעיית גבול התא; ולהסביר את trade-off הפיצור כשחבר זזה.

## האינטואיציה

ניקח מפה של ת"א ונחלק אותה לאזורי מיקוד: 60000 (מרכז), 60100 (צפון), 60200 (דרום). שני אנשים עם אותו מיקוד בוודאי קרובים. שני אנשים עם מיקוד שמתחיל ב-60 כנראה באגן גוש דן.

Geohash עושה בדיוק את זה, אבל לכל כדור הארץ. הוא מחלק את המפה לריבוע גדול, מחלק כל ריבוע לשמונה עשרה תאים, ממשיך וממיין - ומחליף כל שלב בתו ASCII אחד. תוצאה: `sv8wr` = מרכז ת"א, `sv8wx` = קצת צפונה.

**הרגע "וואו"**: שאילתת "מצא חברים ב-5 ק"מ" מתורגמת ל"מצא מחרוזות שמתחילות באותן 5 תווים". range query דו-ממדי (lat, lng) הפך ל-prefix lookup חד-ממדי. ואת זה Redis עושה ב-\(O(\log n)\).

## הפורמליזם

### דרישות ברמת ראיון

**Functional Requirements:**
- הצג חברים שהם ≤ R ק"מ ממני, מתעדכן כל 30 שניות
- שמור היסטוריית מיקום 24 שעות אחרונות
- פרטיות: אפשרות לא להופיע

**Non-Functional Requirements:**
- 1 מיליארד משתמשים, 10% פעילים בו-זמנית = 100M משתמשים
- כל משתמש שולח מיקום כל 30 שניות:

\[\text{Write QPS} = \frac{100{,}000{,}000}{30} \approx 3{,}300{,}000 \text{ עדכונים/שנייה}\]

- Latency: רענון רשימת חברים עד 60 שניות (soft real-time, לא hard)

### גיאוהאש - טבלת דיוק

| אורך | גודל תא | שימוש |
|---|---|---|
| 4 | 40km × 20km | עיר |
| 5 | 5km × 5km | שכונה - מתאים ל-5 ק"מ radius |
| 6 | 1km × 0.6km | רחוב |
| 7 | 150m × 75m | בניין |

ל-"חברים ב-5 ק"מ" - precision 5 מספיק, ומקטין את מספר המועמדים לסינון.

### ארכיטקטורה

```
מכשיר --> API Gateway --> Location Service --> Redis Geo + Cassandra
                                 |
                         Kafka (location-updates)
                                 |
                         Notification Service --> WebSocket Server --> מכשיר
```

**Location Service, שירות מיקום**: מקבל `{user_id, lat, lng, timestamp}` מכל מכשיר כל 30 שניות:
1. מחשב geohash מה-lat/lng
2. שומר ב-Redis: `GEOADD user_locations <lng> <lat> <user_id>` (TTL 10 דקות)
3. מפרסם event ל-Kafka topic `location-updates`
4. שומר ב-Cassandra (partition key = `user_id`, sort key = `timestamp`, TTL = 24 שעות) לתצוגת ציר זמן

**Nearby Query, שאילתת שכנות**: כשמשתמש A פותח את האפליקציה:
1. שרת מביא רשימת חברים של A
2. מריץ ב-Redis: `GEOSEARCH user_locations FROMLONLAT <lng> <lat> BYRADIUS 5 km ASC`
3. מסנן לחברים בלבד (intersection עם friends list)
4. מחזיר רשימה מדורגת לפי מרחק עם TTL לכל מיקום

**Real-time Push, דחיפה בזמן אמת**: כשחבר זזה לאזור חדש:
1. Location Service פרסם ל-Kafka `location-updates`
2. Consumer בדק: האם geohash השתנה? (אם לא - אין טעם לשלוח)
3. Consumer שלח push דרך WebSocket לכל מי ש-A הוא חבר שלהם ופתוח כרגע
4. לקוח מעדכן רשימה מקומית

**Location History, היסטוריית מיקום** ב-Cassandra:

```
partition key = user_id
sort key = timestamp
TTL = 86,400 שניות (24 שעות)
```

כל עדכון שמור; Cassandra מטפלת ב-write-heavy workload עם LSM-tree ומוחקת TTL-expired rows בגיבוב.

### Trade-off: Polling מול Event-driven

| גישה | יתרון | חיסרון |
|---|---|---|
| Polling (לקוח שואל כל 30 שניות) | פשוט, stateless | 100M requests/min גם כשאין שינוי |
| WebSocket push | עדכון רק כשיש שינוי | state בזיכרון, reconnect logic |
| SSE | פשוט יותר מ-WS, חד-כיווני | לא מספיק לאפליקציות דו-כיווניות |

## דוגמה מחושבת

### back-of-envelope

```
משתמשים פעילים:   100M
עדכון כל:         30 שניות
Write QPS:         100M / 30 = ~3.3M writes/sec

גודל עדכון: user_id (8 bytes) + lat (8) + lng (8) + ts (8) = 32 bytes
Write bandwidth:   3.3M × 32 = ~105 MB/sec

Redis GEOADD throughput: ~100K commands/sec לשרת יחיד
שרתי Redis נדרשים:      3.3M / 100K = 33 שרתים
```

Sharding: מחלקים לפי geohash prefix של האזור - כל region על שרת Redis נפרד.

### שאילתת Redis

```bash
# עדכון מיקום: GEOADD key <longitude> <latitude> <member>
GEOADD user_locations 34.7818 32.0853 "user_42"

# חיפוש ב-5 ק"מ
GEOSEARCH user_locations FROMLONLAT 34.7818 32.0853 BYRADIUS 5 km ASC

# תוצאה: ["user_17", "user_42", "user_89", ...]
# סינון נוסף בשכבת האפליקציה: רק מי שבחברים של המשתמש
```

### זרימה מלאה

```
רחל נמצאת ב-32.0853, 34.7818
  --> Location Service מחשב: geohash = "sv8wr" (precision 5)
  --> GEOADD user_locations 34.7818 32.0853 "rachel"
  --> Kafka publish: {user_id: "rachel", geohash: "sv8wr", lat: ..., lng: ...}

שחר (חבר של רחל) פותח אפליקציה:
  --> GET /nearby-friends
  --> שרת: friends_of(shahar) = [rachel, amit, dina, ...]
  --> GEOSEARCH user_locations FROMLONLAT <shahar_lng> <shahar_lat> BYRADIUS 5 km
  --> intersection: רחל קרובה, amit לא בטווח, dina קרובה
  --> Response: [{user: "rachel", distance: "2.1 km"}, {user: "dina", distance: "3.8 km"}]
```

## המקרה שמפיל את האינטואיציה

### בעיית גבול התא

שני אנשים עומדים ברחוב אחד - אחד בצד ימין של "גבול" ריבוע, אחד בצד שמאל. המרחק ביניהם: 10 מטר. הגיאוהאש שלהם: `sv8wr` ו-`sv8wq` - שתי מחרוזות שונות לגמרי.

**הבעיה**: בחיפוש prefix רגיל, הם לא יופיעו יחד.

**הפתרון**: במקום לחפש רק בתא הנוכחי, מחפשים ב-9 תאים - התא שלי + 8 השכנים (צפון, דרום, מזרח, מערב, וארבעה אלכסונים):

```python
import geohash2

center = geohash2.encode(32.0853, 34.7818, precision=5)
neighbors = geohash2.neighbors(center)
cells_to_check = [center] + neighbors  # 9 תאים
```

זה מכפיל את הבדיקות ב-9 - אבל עם Redis pipeline זה עדיין O(1) בפועל.

**כלל אצבע**: אם ה-radius גדול מחצי הרוחב של תא, תמיד בדוק שכנים. ל-5 ק"מ radius ו-precision 5 (תא 5km × 5km) - תמיד צריך לבדוק שכנים.

## טעויות נפוצות

**1. עדכון מיקום כל שנייה**

כל שנייה × 100M משתמשים = 100M writes/sec. Redis לא יסתדר. כל 30 שניות מספיק לרוב ה-use cases. לאפליקציות כמו Uber (מכונית זזה מהר) - כל 4 שניות.

**2. לאחסן מיקומים ב-PostgreSQL**

`SELECT * WHERE distance(lat, lng, ...) < 5km` ב-100M שורות סורק הכל גם עם spatial index ב-write QPS של 3.3M/sec. Redis geospatial עם Sorted Set מנצל lookup בלי scan.

**3. לשכוח fan-out scale**

כשמשתמש עם 500 חברים זזה, כל 500 עלולים לרצות עדכון. 100M משתמשים × ממוצע 200 חברים = potential 20 מיליארד notifications לשנייה. פתרון: רק חברים שפתוחים כרגע (presence service) + פרסום ל-Kafka ולא direct push.

**4. Redis Sorted Set אחד לכל המשתמשים**

GEOADD עם 100M entries ב-Sorted Set אחד = כולם על אותו Redis node. פתרון: shard לפי geohash prefix של האזור - כל region על שרת נפרד.

**5. לא לממש privacy**

"חבר" לא שווה "חבר שרוצה שאראה מיקומו". כל עדכון מיקום צריך לעבור privacy lookup: האם user B הסכים ש-A יראה אותו? טבלת cache ב-Redis `privacy:{user_id}:{friend_id}` עם TTL 5 דקות.

## מתי זה לא משנה

**אפליקציה עם < 100K משתמשים**: PostGIS extension ל-PostgreSQL מספיק. `SELECT * FROM users WHERE ST_DWithin(location, $point, 5000)` - פשוט, מדויק, ללא infrastructure נוסף.

**כשהמיקום לא real-time**: אתר שמראה "חנויות ב-10 ק"מ ממך" (static data) - Google Maps API או pre-computed quadtrees מספיקים.

**בראיון**: הראיין מחפש שתדע לנמק geohash/Redis מול SQL, שתחשב QPS ותגזור מספר שרתים, ושתכיר את בעיית הגבול. fan-out problem הוא bonus.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`). היא מסתמכת על:
- **Geohash** (c-geohash): עיקרון ה-prefix encoding
- **Redis geospatial**: אותה Redis שהופיעה ב-m3-chat-system כ-Pub/Sub
- **m3-proximity-service**: הציגה quadtree כחלופה ל-geohash

**מה זה מאפשר**:
- **m3-google-maps**: תשתית מיקום בקנה מידה גדול יותר - routing וטיילים
- **m3-hotel-reservation**: geospatial search לחדרים "ב-5 ק"מ ממני"
- **m3-message-queue**: Kafka כתשתית ה-event streaming שראינו כאן

```quiz
{"id":"u-m3-nearby-friends-q1","tree":"systems","skill":"system-design","q":"100M משתמשים פעילים שולחים עדכון מיקום כל 30 שניות. כמה writes/sec נדרשים?","options":["100K","330K","3.3M","33M"],"answer":2,"explain":"100,000,000 / 30 ≈ 3,300,000 writes/sec. זהו back-of-envelope בסיסי בראיון: (users / interval). 100K יהיה 1M משתמשים / 10 שניות. 33M יהיה עדכון כל 3 שניות."}
```

```quiz
{"id":"u-m3-nearby-friends-q2","tree":"systems","skill":"system-design","q":"שני משתמשים נמצאים 10 מטר זה מזה, אבל בצדי גבול שונים של תא geohash. מה הפתרון הנכון?","options":["להגדיל precision ל-9 תווים","לחפש ב-9 תאים: התא הנוכחי + 8 שכנים","לעבור ל-quadtree במקום geohash","להשתמש ב-PostgreSQL PostGIS שמחשב מרחק מדויק"],"answer":1,"explain":"בעיית הגבול היא מובנית בכל תרשים grid. הפתרון הסטנדרטי: לחפש ב-9 תאים - התא הנוכחי + 8 שכניו. הגדלת precision מקטינה את הבעיה אבל לא פותרת אותה (תמיד יש גבולות). PostGIS פותר אבל לא מתאים ל-scale."}
```

```quiz
{"id":"u-m3-nearby-friends-q3","tree":"systems","skill":"system-design","q":"מדוע לא כדאי לשמור כל 100M מיקומי משתמשים ב-Redis Sorted Set אחד?","options":["כי Redis Sorted Set מוגבל ל-10M איברים","כי כל 100M entries חייבים לשבת על אותו Redis node ויוצרים hotspot","כי Sorted Set לא תומך ב-geospatial queries","כי Redis לא שומר TTL על Sorted Sets"],"answer":1,"explain":"Redis Sorted Set יכול להכיל מיליארדי איברים, אבל הם כולם על node אחד. ב-100M משתמשים עם 3.3M writes/sec - node אחד לא יסתדר. פתרון: sharding לפי geohash prefix, כל region על node נפרד. TTL תקין ב-Redis Sorted Sets."}
```

```concepts
{"items":[{"id":"nearby-friends","t":"Nearby Friends System","he":"מערכת חברים בסביבה","d":"מערכת שמציגה חברים גיאוגרפיים בזמן אמת. מבוססת geohash לחיפוש שכנות, Redis GEOADD לאחסון, Kafka ל-event streaming ו-WebSocket לדחיפה.","rel":["c-geohash","redis-geospatial","fan-out","websocket"],"node":"sysdesign"},{"id":"redis-geospatial","t":"Redis Geospatial","he":"Redis גיאוגרפי","d":"Redis Sorted Set שמקודד קואורדינטות כ-geohash. GEOADD מוסיף נקודה, GEOSEARCH מחזיר כל מה שבתוך radius. O(log n) על N משתמשים.","rel":["c-geohash","nearby-friends"],"node":"sysdesign"},{"id":"location-service","t":"Location Service","he":"שירות מיקום","d":"שירות שמקבל עדכוני GPS ממכשירים, מחשב geohash, מעדכן Redis ו-Cassandra, ומפרסם events ל-Kafka. TTL קצר ב-Redis כדי שמשתמשים לא פעילים לא יופיעו בתוצאות.","rel":["nearby-friends","redis-geospatial","c-geohash"],"node":"sysdesign"}]}
```
