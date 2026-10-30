# מקצר כתובות

ב-2009 bit.ly עיבד מיליארד קישורים ביום; כל לחיצה עוברת lookup, redirect ותיעוד analytics בפחות ממאה מילישניות.

## מה תדע בסוף

לתכנן מקצר כתובות ברמת ראיון בכיר: לגזור את גודל ה-shortCode מ-back-of-envelope; לנמק 301 לעומת 302 ומה ההשלכה על analytics; לתאר schema, אסטרטגיית cache ו-eviction policy; ולהסביר כיצד מגדילים משרת יחיד ל-cluster שמטפל ב-100 מיליון כתובות ביום.

## האינטואיציה

דמיין ספרייה עם מיליוני ספרים. לכל ספר יש מספר ספרייה קצר (מדף-שורה-עמדה). מי שמחזיק את המספר מגיע לספר הנכון. מקצר כתובות הוא בדיוק זה: **shortCode, קוד קצר** בן 7 תווים שממפה ל-longUrl.

הלוגיקה זורמת בשני כיוונים:

- **כתיבה**: longUrl → hash → Base62 → shortCode → שמירה ב-DB
- **קריאה**: shortCode → lookup ב-cache, ואם miss ב-DB → HTTP 302 → longUrl

## ההגדרות המדויקות

**URL shortening, קיצור כתובת**: שירות שמקבל longUrl ומחזיר shortUrl, כגון `https://short.ly/Xk3mP9q`. לחיצה על ה-shortUrl מפנה את הדפדפן ל-longUrl המקורית.

**Base62 encoding, קידוד בסיס 62**: תווים `[0-9a-zA-Z]`, 62 סמלים ללא מקפים או תווים מיוחדים. shortCode בן 7 תווים מכסה \(62^7 \approx 3.5 \times 10^{12}\) שילובים.

**Hash collision, התנגשות hash**: שתי longUrl שונות שמייצרות את אותו shortCode. מטפלים בה על ידי בדיקה ב-DB ויצירה מחדש עם קלט שונה (salt).

**idempotency, אידמפוטנטיות**: אותה longUrl תמיד מחזירה אותו shortCode. מושגת על ידי בדיקת unique constraint ב-DB לפני שמירה.

**301 redirect, הפניה קבועה**: `HTTP 301 Moved Permanently`. הדפדפן שומר את המיפוי במטמון ולא פונה לשרת בלחיצות עתידיות. חוסך bandwidth אבל מסתיר analytics.

**302 redirect, הפניה זמנית**: `HTTP 302 Found`. כל לחיצה מגיעה לשרת; מאפשר analytics מלאה ושינוי היעד בעתיד.

### API

שתי נקודות קצה בלבד:

```
POST /api/v1/data/shorten
Body:     { "longUrl": "https://en.wikipedia.org/wiki/System_design" }
Response: { "shortUrl": "https://short.ly/Xk3mP9q" }

GET /{shortCode}
Response: HTTP 302
          Location: https://en.wikipedia.org/wiki/System_design
```

### אלגוריתם יצירת shortCode

**גישה 1: hash + truncate**

1. מחשבים SHA-256 על ה-longUrl.
2. לוקחים את 43 הביטים הראשונים (6 bytes ≈ 48 bits, מספיק) ומקודדים ב-Base62: מתקבלים 7 תווים.
3. בודקים ב-DB אם ה-shortCode תפוס.
4. אם תפוס: מוסיפים salt לקלט ומחשבים שוב עד 5 ניסיונות.

**גישה 2: auto-increment + Base62**

1. DB מייצר מזהה עולה (1, 2, 3, ...).
2. ממירים את המספר ל-Base62.
3. המספר 11,157 הופך ל-`2nH`.

יתרון: פשוט, ללא collisions. חיסרון: מספר רצפי חושף את גודל ה-DB; תוקף יכול לסרוק את כל ה-namespace.

בפרקטיקה: שרת יחיד עם auto-increment; cluster עם Snowflake ID שמומר ל-Base62 (ראו `m3-unique-id`).

### Schema

```sql
CREATE TABLE urls (
  id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
  short_code CHAR(7)      NOT NULL UNIQUE,
  long_url   VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  user_id    BIGINT,
  expires_at TIMESTAMP
);
CREATE INDEX idx_short_code ON urls(short_code);
```

בקנה מידה גדול יותר, NoSQL כמו DynamoDB עם short_code כ-partition key נפוץ: read latency נמוך, scale אוטומטי, ללא schema migrations.

### Cache

URL shortener הוא read-heavy: יחס קריאה/כתיבה של 10:1 עד 100:1 נפוץ. LRU cache (Redis) שמחזיק 20% מה-shortCodes הפופולריים מטפל בכ-80% מהתנועה (עיקרון Pareto).

```
GET /Xk3mP9q:
  1. Check Redis →
     HIT:  return longUrl directly (< 1ms)
     MISS: query MySQL/DynamoDB →
           store in Redis (TTL 24h) →
           return longUrl
```

eviction policy: LRU עם TTL. כתובות עם expires_at בעבר לא נשמרות מחדש ב-cache.

## דוגמה מחושבת

### הערכת גדלים (back-of-envelope)

```
נתון: 100 מיליון URL חדשות ביום

write QPS:  100,000,000 / 86,400 ≈ 1,160 כתיבות/שנייה
read QPS:   1,160 × 10 = 11,600 קריאות/שנייה (יחס 10:1)

גודל רשומה: short_code(7) + long_url(512) + metadata ≈ 600 bytes
אחסון ל-10 שנים:
  100M × 365 × 10 × 600 bytes = 219 TB
```

\[11{,}600 \text{ read QPS}\] עם cache hit rate של 80%: DB רואה \(2{,}320\) QPS בפועל. שרת MySQL סטנדרטי מטפל בכ-1,000 QPS. נדרשים read replicas.

### קידוד Base62

longUrl: `https://example.com/page`

SHA-256 (hex): `a3f7c2d1e5b8...`

6 bytes ראשונים (hex): `a3f7c2d1e5b8`

כמספר עשרוני: \(180{,}120{,}424{,}029{,}624\)

המרה לBase62:

```
180,120,424,029,624 ÷ 62 = 2,905,168,129,510  שארית 44 → s
2,905,168,129,510  ÷ 62 = 46,857,550,476     שארית 38 → m
46,857,550,476     ÷ 62 = 755,767,750        שארית 26 → Q
...
shortCode: "sMQ4k9r"  (7 תווים)
```

### collision resolution

```python
import hashlib

CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

def to_base62(n: int) -> str:
    if n == 0:
        return CHARS[0]
    result = []
    while n:
        result.append(CHARS[n % 62])
        n //= 62
    return "".join(reversed(result))

def generate_short_code(long_url: str, db) -> str:
    salt = ""
    for attempt in range(5):
        raw = hashlib.sha256((long_url + salt).encode()).digest()
        code = to_base62(int.from_bytes(raw[:6], "big"))[:7]
        if not db.exists(code):
            return code
        salt = str(attempt)
    raise ValueError("collision limit reached after 5 attempts")
```

## המקרה שמפיל את האינטואיציה

"נשתמש ב-301 כי זה יעיל: פחות בקשות לשרת ופחות עלויות."

לשירות marketing, BI או A/B testing, 301 הוא תקלה קריטית: הדפדפן לומד את היעד ולא מגיע אלינו שוב. כל הנתונים על מי לחץ, מאיפה, באיזה מכשיר, נעלמים לחלוטין. bit.ly, TinyURL ו-Bitly משתמשים ב-302 בדיוק מסיבה זו, למרות שזה מגדיל את העומס.

ההחלטה 301 מול 302 היא החלטה עסקית, לא טכנית בלבד.

## טעויות נפוצות

1. **לקחת 7 תווים מ-MD5 hex ישירות**: hex משתמש ב-16 תווים, לא 62. \(16^7 \approx 268\) מיליון שילובים לעומת \(62^7 \approx 3.5\) טריליון. אם צריך 100 מיליון URLs ביום, ה-namespace נגמר תוך 2.7 ימים.

2. **להניח שאין collisions**: birthday paradox מבטיח collision גבוהה לאחר \(\sqrt{N}\) רשומות. \(\sqrt{3.5 \times 10^{12}} \approx 1.87\) מיליון. אחרי 1.87 מיליון URLs, הסיכוי לcollision עולה ל-50%.

3. **auto-increment בכל DB node ב-cluster**: כל node מייצר 1, 2, 3 בנפרד, ויוצרים short_code זהים. הפתרון: Snowflake ID (m3-unique-id) או range partition (node A: 1-1B, node B: 1B-2B).

4. **cache ללא TTL**: URL שפג תוקפה (expires_at בעבר) תישמר ב-cache לנצח ותחזיר 410 Gone מה-DB אבל 302 מה-cache. TTL קצר מונע את זה.

## מתי זה לא משנה

לכלי פנימי בארגון שמשתמשים בו עשרה אנשים, אין צורך ב-cache, cluster, Snowflake ID, או collision resolution מלא. DB פשוט עם redirect וindex על short_code מספיק ומהיר.

Bloom filter לבדיקת כפילויות longUrl הוא אופטימיזציה מתקדמת, לא baseline.

בראיון, זו שאלה קלאסית ל-M3. הראיין מצפה: back-of-envelope עם QPS ואחסון, hash+Base62 עם collision handling, 302 עם נימוק analytics, cache LRU עם eviction policy. כל אחד מהארבעה חסר הוא תקלה. Bloom filter הוא bonus.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`). מניחה היכרות עם `caching-layer`, `back-of-envelope` ו-`interview-framework`.

**מה זה מאפשר**:
- **m3-web-crawler**: crawler שומר ומנרמל URLs בצורה דומה למה שנלמד כאן
- **m3-unique-id**: auto-increment ב-cluster דורש Snowflake ID כפתרון
- **m3-rate-limiter**: shortener חשוף למתקפות URL spam; rate limiter מגן עליו

```quiz
{"id":"u-m3-url-shortener-q1","tree":"systems","skill":"system-design","q":"מדוע שירות מקצר כתובות כמו bit.ly משתמש ב-302 ולא ב-301 redirect?","options":["כי 301 לא נתמך ב-HTTP/2","כי 302 מהיר יותר ב-20ms בממוצע","כי 302 שולח כל לחיצה לשרת ומאפשר לאסוף analytics ולשנות יעד בעתיד","כי 301 מצריך SSL ו-302 לא"],"answer":2,"explain":"עם 301 הדפדפן שומר את היעד ולא חוזר לשרת. השירות לא רואה את הלחיצה ולא יכול לתעד מי לחץ, מאיפה, ובאיזה מכשיר. עם 302, כל לחיצה עוברת דרך השרת: אפשר לספור, לנתח ולשנות יעד. ההחלטה היא עסקית, לא רק טכנית."}
```

```fillin
{"id":"u-m3-url-shortener-f1","tree":"systems","skill":"system-design","prompt":"shortCode בן 7 תווים ב-Base62 מכסה בערך כמה טריליון שילובים?","answer":"3.5","alt":["כ-3.5","שלוש וחצי","3.5 טריליון","3.5T"],"explain":"62^7 = 3,521,614,606,208 ≈ 3.5 טריליון. זה מספיק ל-100 מיליון URLs ביום במשך כ-96 שנה. לעומת זאת, 7 תווים hex נותנים 16^7 ≈ 268 מיליון: נגמר תוך 2.7 ימים."}
```

```concepts
{"items":[{"id":"url-shortener","t":"URL Shortener","he":"מקצר כתובות","d":"שירות שממפה longUrl לשבעה תווים Base62 ומפנה בHTTP 302","rel":["base62-encoding","hash-collision","302-redirect"],"node":"sysdesign"},{"id":"base62-encoding","t":"Base62 Encoding","he":"קידוד בסיס 62","d":"קידוד עם [0-9a-zA-Z]. 62^7 ≈ 3.5 טריליון שילובים לשבעה תווים","rel":["url-shortener","hash-collision"],"node":"sysdesign"},{"id":"hash-collision","t":"Hash Collision","he":"התנגשות hash","d":"שתי קלטות שונות שמייצרות אותו hash. מטפלים ע\"י salt ו-retry עד 5 ניסיונות","rel":["url-shortener","base62-encoding"],"node":"sysdesign"},{"id":"302-redirect","t":"302 Redirect","he":"הפניה זמנית","d":"HTTP 302 Found: הדפדפן לא שומר, כל לחיצה מגיעה לשרת. מאפשר analytics ושינוי יעד","rel":["url-shortener","301-redirect"],"node":"sysdesign"},{"id":"301-redirect","t":"301 Redirect","he":"הפניה קבועה","d":"HTTP 301 Moved Permanently: הדפדפן שומר ולא חוזר לשרת. חוסך bandwidth, מסתיר analytics","rel":["url-shortener","302-redirect"],"node":"sysdesign"}]}
```
