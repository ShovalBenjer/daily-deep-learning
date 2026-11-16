# תכנון Google Maps
מאחורי ניווט מתל אביב לירושלים עומדות שלוש מערכות שונות: מחסן תמונות, מנוע חישוב מסלול, ומאגר נתוני תנועה בזמן אמת.

## מה תדע בסוף

לתכנן את תשתית המיפוי ברמת ראיון בכיר: לתאר את ה-tile system ואת ה-preprocessing שמאפשר ניווט מהיר, לנמק למה Dijkstra לא סקיילאבלי בגרף עולמי, ולהסביר כיצד crowd-sourced GPS pings מייצרים ETA מדויק.

## האינטואיציה

חשוב על Google Maps כשלושה מוצרים שנראים כאחד. **הראשון**: ספריית תמונות ענק (tiles) שגדלה מדרגה עם כל zoom level. **השני**: מנוע ניווט שרץ על גרף של מיליארד קשתות, אך עונה תוך מילישניות כי המסלולים חושבו מראש. **השלישי**: מערכת telemetry שקולטת GPS pings ממאות מיליוני טלפונים ומעדכנת את משקלי הגרף בזמן אמת.

כשאתה לוחץ "נווט", הטלפון מוריד tiles מ-CDN, מקבל מסלול שחושב מראש על גרף דחוס, ומתעדכן בפקקים שמדווחים על ידי הנהגים שמסביבך.

## ההגדרות המדויקות

### דרישות המערכת

| פרמטר | ערך |
|-------|-----|
| משתמשים | 1 מיליארד |
| DAU | 400 מיליון |
| בקשות tiles לשנייה (שיא) | ~50,000 QPS |
| בקשות ניווט לשנייה | ~1,000 QPS |
| GPS pings לשנייה | ~1,000,000 msg/s |
| גודל גרף הכבישים | ~1 מיליארד קשתות |

**Non-functional**: latency מתחת ל-500ms לחישוב מסלול, tiles תוך 100ms מה-CDN, זמינות 99.99%.

---

**Map tile, אריח מפה**: ריבוע תמונה של 256×256 פיקסלים המייצג חלק מהמפה. המפה כולה מחולקת לרשת של tiles בכל zoom level. ב-zoom 0, כל העולם הוא tile אחד. בכל zoom level נוסף, כל tile מתחלק ל-4:

| Zoom | מספר tiles | שימוש |
|------|-----------|-------|
| 0 | 1 | עולם כולו |
| 5 | 1,024 | יבשות |
| 10 | 1,048,576 | ערים |
| 15 | ~1 מיליארד | שכונות |
| 20 | ~1,000 מיליארד | מבנים |

**Tile ID, מזהה אריח**: נקודה על המפה מתרגמת ל-tile ID על פי Mercator projection:
\[x = \left\lfloor\frac{\lambda + 180}{360} \cdot 2^z\right\rfloor, \quad y = \left\lfloor\frac{1 - \frac{\ln(\tan\phi + \sec\phi)}{\pi}}{2} \cdot 2^z\right\rfloor\]
כאשר \(\lambda\) = קו אורך, \(\phi\) = קו רוחב (ברדיאנים), \(z\) = zoom level.

**Vector tile, אריח וקטורי**: במקום תמונת PNG שטוחה, vector tile מכיל גאומטריה (קווים, פוליגונים, נקודות) שהלקוח מרנדר. גודל: 1-5KB לעומת ~20KB ל-PNG raster. מאפשר smooth zoom ו-rotation בלי re-request.

**Road graph, גרף כבישים**: גרף מכוון שבו צמתים הם צמתות כביש ועצמות הן מקטעי כביש. משקל קשת = זמן נסיעה צפוי, שמחושב מ: מרחק, דרגת כביש, שעה ביום, וצפיפות תנועה כרגע.

**Contraction Hierarchies (CH), היררכיות כיווץ**: precomputation שדוחס את גרף הכבישים. שלב הbuild (offline, שעות):
1. דרג כל צומת לפי "חשיבות" (עד כמה מסלולים עוברים דרכו).
2. הסר צומת v מהגרף; עבור כל זוג שכנים \((u, w)\) כך ש-shortest path עוברת דרך v, הוסף קשת shortcut \(u \to w\).
3. חזור על כל הצמתות בסדר עולה של חשיבות.

שלב השאילתה (online, מילישניות): הרץ bi-directional A* רק על הקשתות "כלפי מעלה" בהיררכיה. כמות הצמתות שנחקרת קטנה ב-3-4 סדרי גודל לעומת Dijkstra.

---

### API

```
POST /v1/directions
{
  "origin": {"lat": 32.0853, "lng": 34.7818},
  "destination": {"lat": 31.7683, "lng": 35.2137},
  "mode": "driving",
  "departure_time": "2026-11-16T08:00:00Z"
}
Response:
{
  "routes": [{"distance_m": 62000, "duration_s": 3600, "polyline": "..."}]
}

GET /v1/tiles/{z}/{x}/{y}.pbf   ← vector tile (Protocol Buffer)
GET /v1/tiles/{z}/{x}/{y}.png   ← raster tile fallback
```

---

### Tile pipeline

```
OSM + satellite imagery + street-level photos
        ↓
Map rendering engine (Mapnik / proprietary)
  → raster tiles zoom 0-14 (pre-rendered, stored in object store)
  → vector tiles zoom 0-20 (pre-rendered, stored in object store)
        ↓
Object store (S3-like, 2 PB+)
        ↓
CDN (Cloudflare / Akamai) ← 50K QPS נספגים כאן
        ↓
Client (browser / mobile)
```

Zoom 15+ ב-raster אין אפשרות לפרה-רנדר (too many tiles). בפועל, vector tiles מאפשרות client-side rendering לכל zoom level.

---

### Navigation pipeline

```
1. API Server: קולט origin, destination, constraints
2. Geocoding Service: כתובות → (lat, lng) אם צריך
3. Graph Service:
   a. מאתר entry / exit nodes הקרובים בגרף
   b. מריץ bi-directional A* with CH על גרף דחוס
   c. מחזיר רצף edge IDs + polyline
4. ETA Service: משקלל מרחק × פרופיל מהירות + live traffic
5. Response
```

### Traffic pipeline

```
GPS pings ממשתמשים (טלפונים)
        ↓
Kafka topic (~1M messages/s)
        ↓
Flink (stream processor, window 30s):
  - מחשב מהירות ממוצעת לכל מקטע כביש
  - מזהה אנומליות (תאונה, עבודות)
        ↓
Redis (cache של משקלי גרף, TTL 60s)
        ↓
Route Recalculation Service: שולח ETA update לנהגים מושפעים
```

## דוגמה מחושבת

### back-of-envelope לאחסון tiles

```
Zoom levels 0-15 (raster):
  sum_{z=0}^{15} 4^z ≈ 4^15 / 3 ≈ 360M tiles
  70% ocean/desert → ~110M tiles בפועל
  גודל ממוצע: 20KB (PNG raster)
  110M × 20KB = 2.2 TB ← ניתן לאחסון

Zoom 0-20 (vector tiles):
  4^20 / 3 ≈ 350B tiles כולם
  70% ריק → ~100B tiles
  5KB/tile → 500 TB ← גדול, אבל hot tiles נספגים ב-CDN
```

### למה לא Dijkstra לאירופה?

```
גרף אירופה: ~50 מיליון צמתות, ~100 מיליון קשתות
Dijkstra: O(E log V) = O(100M × log 50M) ≈ 2.6 מיליארד פעולות
  → ~20-30 שניות → לא מתקבל

Contraction Hierarchies:
  - Preprocessing: 2 שעות offline
  - Query: סורקת ~10,000 צמתות בלבד
  - → <10ms
```

### דוגמת ETA על ציר מס. 1

```
מקטע: חולון ↔ ירושלים, 60 ק"מ
  baseline (ריק): 45 דקות
  
GPS pings בין 08:00-09:00:
  average speed: 40 km/h (במקום 80)
  
ETA מחודש:
  60 / 40 = 90 דקות
  → "+45 min due to traffic" מוצג למשתמש
```

## המקרה שמפיל את האינטואיציה

**Contraction Hierarchies לא עובד עם תנועה משתנה.** CH precomputation מניח משקלי קשתות קבועים. כשמשקל משתנה (פקק פתאומי בכביש 1), ה-shortcuts שחושבו offline עלולים להיות לא תקפים.

**הפתרון**: **Time-dependent routing**. במקום משקל קבוע, כל קשת שומרת **פרופיל מהירות** לפי שעה (יום, שעה, יום בשבוע, חגים). CH נבנה על הפרופיל הממוצע; לסטיות real-time מריצים A* מוגבל על subgraph קטן מסביב לאינצידנט.

**תוצאה**: Google Maps יודע שב-08:00 ביום שלישי הכביש מהיר יותר מב-17:00 ביום שישי, גם לפני שהתנועה מדווחת.

## טעויות נפוצות

**לחשוב ש-Google Maps מריץ Dijkstra בזמן אמת.** גרף הכבישים העולמי הוא מיליארד קשתות. Dijkstra naive לוקח עשרות שניות ליבשת שלמה. CH precomputation הוא הסיבה שהניווט מהיר.

**להתעלם מ-tile system בראיון.** רוב הזמן מתמקדים בניווט ושוכחים שה-tile serving הוא 50K QPS ואחסון של מאות TB. זו שאלת CDN ו-storage, לא שאלת graph.

**לאחסן רק raster tiles.** Vector tiles קטנות פי 4-20 ומאפשרות client-side styling וzoom חלק. Google Maps עצמה עברה לvector tiles ב-2013. ראיון שמדבר רק על PNG שוכח עשור של development.

**לא לדבר על crowd-sourced data.** ETA המדויק של Maps מגיע מ-GPS pings של המשתמשים. ללא crowd-sourcing, Maps תהיה מפה מדויקת אבל לא "חיה".

## מתי זה לא משנה

**כשמנווטים בתוך עיר אחת:** PostGIS עם A* על graph של עיר (<100K צמתות) מספיק תוך אלפיות שנייה. CH לא נדרש.

**כשצריך "הנהג הקרוב ביותר" ולא מסלול:** Uber-like app צריך proximity search, לא routing. `GEOSEARCH` ב-Redis מספיק.

**כשהתוכנה עובדת offline:** אפליקציות ניווט offline (Waze offline, HERE) שומרות גרף דחוס מקומית. CH עדיין שם, אבל traffic pipeline לא קיים.

## חיבור

יחידה זו שייכת לבלוק M3, System Design Interview. `m3-proximity-service` מכסה את ה-spatial indexing (Geohash) ש-Google Maps משתמש בו ל-search-within-map. `m3-nearby-friends` מוסיפה את ה-real-time location tracking. `m3-ad-click-aggregation` רלוונטית ל-GPS ping stream processing שמתואר כאן. ב-M6 (סטטיסטיקה), A/B testing ו-calibration מחברים לאיכות ה-ETA.

```quiz
{"id":"u-m3-google-maps-q1","tree":"systems","skill":"system-design","q":"Google Maps מחשבת ניווט פריז → מדריד בפחות מ-500ms. מדוע Dijkstra naive לא מספיק לכך?","options":["Dijkstra לא תומך בגרפים מכוונים","גרף הכבישים של אירופה גדול מדי; O(E log V) לוקח עשרות שניות","Dijkstra אינו מוצא את הנתיב הקצר ביותר בגרפים גדולים","הבעיה היא latency הרשת ולא מהירות האלגוריתם"],"answer":1,"explain":"גרף אירופה מכיל ~100 מיליון קשתות. O(E log V) מביא לכ-2.6 מיליארד פעולות, שזה עשרות שניות. Contraction Hierarchies פותרת את הבעיה על ידי precomputation שמצמצם את החיפוש ל-~10,000 צמתות בלבד."}
```

```quiz
{"id":"u-m3-google-maps-q2","tree":"systems","skill":"system-design","q":"מה היתרון של vector tiles על פני raster tiles (PNG) ב-Google Maps?","options":["Vector tiles נטענות מהר יותר מה-CDN","Vector tiles קטנות יותר (1-5KB לעומת ~20KB) ומאפשרות smooth zoom בלי re-request","Vector tiles מדויקות גיאוגרפית יותר","Vector tiles מאפשרות חיפוש פנים-tile"],"answer":1,"explain":"Vector tiles מכילות גאומטריה ולא פיקסלים; הן קטנות פי 4-20 ומאפשרות ל-client לרנדר מחדש בכל zoom ו-rotation בלי לבקש tile חדשה. זה גם מה שמאפשר dark mode ו-custom styling."}
```

```fillin
{"id":"u-m3-google-maps-f1","tree":"systems","skill":"system-design","prompt":"Contraction Hierarchies פותרת את בעיית הסקלאביליות של ניווט על ידי ___ ה-shortcuts מראש (מילה אחת).","answer":"חישוב","alt":["precomputing","עיבוד","בניית"],"explain":"השלב הכבד (preprocessing/build) מתרחש offline. בזמן שאילתה, A* רץ על הגרף הדחוס עם ה-shortcuts ומגיע לתשובה במילישניות."}
```

```concepts
{"items":[{"id":"c-map-tile","t":"Map tile","he":"אריח מפה","d":"ריבוע תמונה 256×256 פיקסלים של המפה; המפה כולה מחולקת לרשת tiles בכל zoom level","rel":["c-vector-tile","c-zoom-level"],"node":"sysdesign"},{"id":"c-vector-tile","t":"Vector tile","he":"אריח וקטורי","d":"tile המכיל גאומטריה (קווים, פוליגונים) שהלקוח מרנדר; קטן פי 4-20 מ-PNG raster ומאפשר smooth zoom","rel":["c-map-tile"],"node":"sysdesign"},{"id":"c-zoom-level","t":"Zoom level","he":"רמת הגדלה","d":"ב-zoom z יש 4^z tiles; zoom 0 = עולם כולו, zoom 15 = שכונה. כל zoom level מכפיל מספר tiles ב-4","rel":["c-map-tile"],"node":"sysdesign"},{"id":"c-contraction-hierarchies","t":"Contraction Hierarchies","he":"היררכיות כיווץ","d":"precomputation לגרף כבישים שמוסיף shortcuts ומאפשר bi-directional A* בזמן מילישניות על גרפים של מיליארד קשתות","rel":["c-road-graph","c-time-dependent-routing"],"node":"sysdesign"},{"id":"c-road-graph","t":"Road graph","he":"גרף כבישים","d":"גרף מכוון שצמתיו הם צמתות כביש וקשתותיו הן מקטעי כביש עם משקל (זמן נסיעה צפוי)","rel":["c-contraction-hierarchies"],"node":"sysdesign"},{"id":"c-time-dependent-routing","t":"Time-dependent routing","he":"ניווט תלוי-זמן","d":"לכל קשת בגרף הכבישים שומרים פרופיל מהירות לפי שעה, יום, חגים; מאפשר ETA מדויק לפי שעת היציאה","rel":["c-contraction-hierarchies","c-road-graph"],"node":"sysdesign"}]}
```
