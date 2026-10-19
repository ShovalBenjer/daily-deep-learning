# מגביל קצב

ב-2012 שלחו ספאמרים לאינסטגרם 18 מיליון בקשות תוך שעה. בלי rate limiter, כל השרתים קורסים. עם rate limiter, 429 ולדרך.

## מה תדע בסוף

לתכנן מגביל קצב ברמת ה-API: לבחור אלגוריתם מתוך חמישה ולנמק; לתאר כיצד Redis מאפשר מגבלות מדויקות ב-distributed system ללא race conditions; להסביר איפה ממקמים את המגביל ולמה gateway עדיף; ולדעת אילו כותרות מחזירים ללקוח שנחסם.

## האינטואיציה

דמיין ברז מים שמוגבל לליטר לדקה. לא משנה כמה מהר תפתח אותו, הזרם יוצא קבוע.

**Token Bucket, סל אסימונים** שונה: יש סל עם אסימונים. כל בקשה לוקחת אסימון אחד. הסל מתמלא מחדש בקצב קבוע. אם הסל ריק, הבקשה נדחית. אפשר לפרוץ מעל הממוצע לזמן קצר כל עוד הצטברו אסימונים.

## ההגדרות המדויקות

**Rate limiter, מגביל קצב**: רכיב שסופר בקשות לפי מפתח כמו user_id, IP או API key, ומסרב כשעוברים את הסף. מחזיר `HTTP 429 Too Many Requests` עם כותרת `Retry-After`.

**Throttling, מיגבול**: המדיניות הרחבה של הגבלת קצב, כולל soft limits, האטה, ו-hard limits, חסימה.

### חמשת האלגוריתמים

**Token Bucket (סל אסימונים)**: שני פרמטרים, קיבולת C ו-refill rate R אסימונים לשנייה. כל בקשה לוקחת אסימון אחד. אם אין, דחה. מאפשר burst קצר מעל הממוצע. נפוץ ב-AWS API Gateway ו-Stripe.

**Leaky Bucket (סל דולף)**: תור FIFO בגודל קבוע. בקשות נכנסות לתור. עיבוד יוצא מהתור בקצב קבוע. אם התור מלא, בקשה חדשה נדחית. פלט יציב לחלוטין, burst נדחה גם אם יש יכולת. נפוץ ב-Nginx.

**Fixed Window Counter (מונה חלון קבוע)**: מחלק את הזמן לחלונות, למשל כל דקה, ומונה בקשות בכל חלון. פשוט לממוש, אבל עם חולשה בגבול החלון: אפשר לשלוח את הסף פעמיים תוך שתי שניות.

**Sliding Window Log (יומן חלון גולש)**: שומר timestamp של כל בקשה. כשמגיעה בקשה חדשה, מוחק timestamps ישנים מחוץ לחלון ובודק כמה נשארו. מדויק לחלוטין. חסרון: צורך זיכרון גבוה.

**Sliding Window Counter (מונה חלון גולש)**: ממזג את שני הגישות. `count = current_window + prev_window * overlap_ratio`. דיוק גבוה עם זיכרון נמוך. הבחירה המאוזנת ביותר.

### איפה לשים את המגביל

| מיקום | יתרון | חסרון |
|---|---|---|
| Client-side | לא עומס שרת | ניתן לעקיפה מלאה |
| API Gateway | מרכזי, לפני הכול | הגדרה ופריסה |
| Application server | גמישות לוגיקה | מצריך שיתוף state |

**API Gateway** כמו Kong, Nginx או AWS API Gateway הוא המיקום הנפוץ: הלקוח לא מגיע לאפליקציה כלל.

### כותרות תגובה סטנדרטיות

```
X-Ratelimit-Limit: 100
X-Ratelimit-Remaining: 0
X-Ratelimit-Retry-After: 12
```

### Redis לסביבה מבוזרת

עם שרת יחיד, מונה ב-RAM. עם cluster, צריך מאגר מרכזי. Redis:

```
INCR user:123:2026-10-19-14:30
EXPIRE user:123:2026-10-19-14:30 60
```

**בעיית race condition**: בין INCR ל-EXPIRE יש פתח. הפתרון הנפוץ: Lua script אטומי ב-Redis שמריץ את שתי הפעולות כ-transaction אחד.

## דוגמה מחושבת

Token Bucket עם `capacity=5, refill_rate=2 אסימונים/שנייה`:

```
t=0.0   bucket=5
        בקשה 1: bucket=4  (200 OK)
        בקשה 2: bucket=3  (200 OK)
        בקשה 3: bucket=2  (200 OK)
        בקשה 4: bucket=1  (200 OK)
        בקשה 5: bucket=0  (200 OK)
        בקשה 6: bucket=0  (429)

t=1.0   +2 אסימונים: bucket=2
        בקשה 7: bucket=1  (200 OK)
        בקשה 8: bucket=0  (200 OK)
        בקשה 9:           (429)

t=2.5   +3 אסימונים: bucket=3
        בקשות 10-12: (200 OK) x3
```

**Fixed Window bug**: סף 5 בקשות לדקה. ב-00:59 נשלחות 5 בקשות, אושרו. ב-01:00 מתחיל חלון חדש: עוד 5 בקשות, אושרו. בפועל 10 בקשות ב-2 שניות, כפול הסף.

## המקרה שמפיל את האינטואיציה

"הוספנו rate limiter על כל שרת."

עם 4 שרתים ו-load balancer, כל שרת מגביל ל-10 בקשות לשנייה בנפרד. לקוח יכול לשלוח 40 בקשות בשנייה. הפתרון: Redis מרכזי שאליו כל שרת פונה לאותו מונה.

Sticky sessions לא עוזרות: load balancer יכול לשנות ניתוב בכל רגע.

## טעויות נפוצות

1. **Fixed Window בגבול API חיצוני**: Sliding Window Counter מדויק יותר ברוב המקרים ועלות הזיכרון דומה.
2. **Rate limit לפי IP בלבד**: מאחורי NAT, עשרות אלפי משתמשים חולקים IP אחד. להוסיף גם user_id.
3. **לא להחזיר Retry-After**: לקוח שקיבל 429 בלי הנחיה שולח retry loop ומחמיר את העומס.
4. **Rate limiter באפליקציה כשיש עומס**: אם הבקשה כבר הגיעה לאפליקציה, חלק מהנזק כבר נעשה. Gateway חוסם לפני כן.

## מתי זה לא משנה

לשירות פנימי שנקרא רק מאפליקציות ידועות, rate limiter מוסיף מורכבות ללא ערך. בין microservices, circuit breaker מספיק ועדיף.

בראיון, זו שאלת M3 קלאסית. הראיין מצפה: Token Bucket בהסבר, Redis עם Lua לסביבה מבוזרת, ו-429 עם Retry-After. הסבר כל חמשת האלגוריתמים הוא נקודת bonus.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`). מניחה היכרות עם Redis מ-`caching-layer`.

**מה זה מאפשר**:
- **m3-consistent-hashing**: כשיש cluster של Redis למגביל קצב, consistent hashing מחלק בין הצמתים
- **m3-key-value-store**: Redis מעמיק את token bucket מכאן
- **m3-api-design**: rate limiter הוא רכיב סטנדרטי ב-REST API

```quiz
{"id":"u-m3-rate-limiter-q1","tree":"systems","skill":"system-design","q":"מדוע rate limiter על כל שרת בנפרד אינו מספיק ב-distributed system?","options":["כי כל שרת עובד על מעבד שונה","כי load balancer יכול לשלוח בקשות ממשתמש אחד לשרתים שונים, ואז כל שרת מונה רק חלק מהבקשות","כי Redis לא עובד על שרתים מרוחקים","כי Fixed Window אינו תומך ב-cluster"],"answer":1,"explain":"Load balancer מחלק בקשות בין שרתים. משתמש ששולח 40 בקשות לשנייה יכול לקבל 10 לכל שרת. כל שרת מאשר את 10 שלו בנפרד, מה שמאפשר לעקוף את הסף הכולל. הפתרון הוא מונה מרכזי ב-Redis שאליו כל שרת פונה."}
```

```fillin
{"id":"u-m3-rate-limiter-f1","tree":"systems","skill":"system-design","prompt":"Token Bucket עם קיבולת 3 ו-refill 1 לשנייה. הסל מלא. 4 בקשות מגיעות ברצף מהיר. כמה מהן יאושרו?","answer":"3","alt":["שלוש","3 בקשות"],"explain":"הסל מתחיל עם 3 אסימונים. בקשות 1-3 לוקחות אסימון כל אחת, bucket=0. בקשה 4 מגיעה לסל ריק: 429. ה-refill rate לא עוזר כי הבקשות מגיעות מהר מהמילוי."}
```

```concepts
{"items":[{"id":"rate-limiter","t":"Rate Limiter","he":"מגביל קצב","d":"רכיב שסופר בקשות לפי מפתח (user_id, IP) ומחזיר 429 כשעוברים את הסף","rel":["token-bucket","leaky-bucket","sliding-window-counter"],"node":"sysdesign"},{"id":"token-bucket","t":"Token Bucket","he":"סל אסימונים","d":"אלגוריתם rate limiting עם capacity ו-refill rate. מאפשר burst קצר. נפוץ ב-AWS API Gateway.","rel":["rate-limiter","leaky-bucket"],"node":"sysdesign"},{"id":"leaky-bucket","t":"Leaky Bucket","he":"סל דולף","d":"תור FIFO בגודל קבוע עם עיבוד בקצב קבוע. פלט יציב לחלוטין, burst נדחה.","rel":["rate-limiter","token-bucket"],"node":"sysdesign"},{"id":"sliding-window-counter","t":"Sliding Window Counter","he":"מונה חלון גולש","d":"ממזג Fixed Window עם Sliding Log: count = current + prev * overlap. דיוק גבוה בזיכרון נמוך.","rel":["rate-limiter","fixed-window-counter"],"node":"sysdesign"},{"id":"fixed-window-counter","t":"Fixed Window Counter","he":"מונה חלון קבוע","d":"מחלק זמן לחלונות ומונה בקשות בכל חלון. פשוט אבל חשוף לבעיית גבול החלון.","rel":["rate-limiter","sliding-window-counter"],"node":"sysdesign"}]}
```
