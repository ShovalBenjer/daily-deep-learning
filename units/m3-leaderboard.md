# טבלת מובילים בזמן אמת

Duolingo מציגה את דירוגך בין 30 משתתפים בתוך 50 מילישניות, גם כשמיליוני אנשים מתרגלים בו-זמנית, בגלל בחירת מבנה נתונים אחד.

## מה תדע בסוף

לתכנן שירות דירוג שמטפל במיליוני משתמשים: לנמק מדוע Redis Sorted Set מוביל את עיצוב הקריאה, לתאר את נתיב הכתיבה מאירוע ניקוד ועד ל-cache ול-DB, להסביר כיצד מממשים לוח-שבועי ולוח-יומי לצד לוח כל-הזמנים, ולאבחן מתי הגישה מתפרקת.

## האינטואיציה

דמיין מרצדס-בנץ אריינה: על הלוח הגדול מוצגים שמות ותוצאות בסדר יורד. כל פעם שספורטאי מסיים סט, שדר עודכן את הלוח. זה עובד מצוין כשיש עשרות ספורטאים.

עכשיו דמיין שהתחרות היא World of Warcraft עם 10 מיליון שחקנים. הלוח הוותיק אומר: "אסתדר, אריץ `SELECT user_id, score FROM scores ORDER BY score DESC LIMIT 10`". בכל לחיצה. עם 10M שורות. תוצאה: full table scan בכל קריאה, latency של שניות, DB בהתמוטטות.

הפתרון הוא להחליף את "הלוח הרנדומלי" בלוח ממוין: **Sorted Set, קבוצה ממוינת** ב-Redis שמנהלת את הסדר בזמן ריצה. כל הוספה עולה \(O(\log N)\); כל שאילתת TOP-10 עולה \(O(K)\) כאשר K=10, ודירוג אחד עולה \(O(\log N)\) בלבד. ה-DB הופך למקור גיבוי, לא לנתיב החם.

## ההגדרות המדויקות

**Sorted Set (ZSET), קבוצה ממוינת** הוא מבנה נתונים של Redis שמאחסן זוגות `(member, score)`. הסדר הפנימי הוא תמיד לפי score (ואז לקסיקוגרפי לפי member בקשרים). Redis מממש ZSET בשכבה כפולה: skip list לשאילתות טווח ו-hash table לגישה ישירה.

```
ZADD leaderboard 9340 "alice"   # O(log N)
ZADD leaderboard 8810 "bob"
ZADD leaderboard NX 7200 "carol"  # NX = רק אם לא קיים עדיין
```

**ZREVRANK, דירוג הפוך** מחזיר את האינדקס של member בסדר יורד (0 = הראשון). כדי לקבל דירוג human-readable יש להוסיף 1:

```
ZREVRANK leaderboard "alice"   → 0 (מקום 1)
ZREVRANK leaderboard "bob"     → 1 (מקום 2)
```

**ZREVRANGE, טווח הפוך** מחזיר רשימה של members בסדר יורד לפי score. עם `WITHSCORES` מחזיר גם את הציונים:

```
ZREVRANGE leaderboard 0 9 WITHSCORES
→ ["alice","9340","bob","8810","carol","7200",...]  # TOP-10
```

**ZINCRBY, הוספה לציון** מגדיל ציון קיים ב-delta, טומי-חוזר את הציון החדש:

```
ZINCRBY leaderboard 500 "alice"   → "9840"
```

**Windowed Leaderboard, לוח חלון-זמן** הוא כמה ZSETים מקבילים לאותה מדינה: `lb:all`, `lb:week:2026-48`, `lb:day:2026-11-28`. ה-daily ו-weekly ZSETs מקבלים TTL כך שנמחקים אוטומטית אחרי שפג תוקפם.

**Write path, נתיב כתיבה** הוא:
1. אירוע (game score, XP earned, challenge solved) מגיע לשרת.
2. שרת מריץ `ZINCRBY` על ה-ZSET הרלוונטי ב-Redis.
3. בנפרד (async), שרת כותב את עדכון הציון ל-DB (PostgreSQL/MySQL) לתיעוד ולגיבוי.

**Read path, נתיב קריאה** הוא:
1. בקשת TOP-N: `ZREVRANGE lb:all 0 (N-1) WITHSCORES`.
2. בקשת הדירוג שלי: `ZREVRANK lb:all user_id`, ואז +1.
3. בקשת השכנים שלי (מקומות ±5): `ZREVRANK` → חישוב start/end → `ZREVRANGE`.

## דוגמה מחושבת

נניח משחק-פאזלים עם שלושה שחקנים. הסשן הוא:

```
t=0: alice סיימה סט עם 500 נקודות
t=1: bob   סיים סט עם 300 נקודות
t=2: carol סיימה סט עם 700 נקודות
t=3: alice סיימה עוד סט עם 200 נקודות
t=4: db    מבקש TOP-2
t=5: bob   שואל מה מקומו
```

פעולות Redis:

```bash
t=0:  ZINCRBY lb:all 500 "alice"   # alice: 500
t=1:  ZINCRBY lb:all 300 "bob"     # bob: 300
t=2:  ZINCRBY lb:all 700 "carol"   # carol: 700
t=3:  ZINCRBY lb:all 200 "alice"   # alice: 700

# עכשיו: carol=700, alice=700, bob=300
# קשר! carol ו-alice שווים ב-700. Redis שובר קשר לקסיקוגרפית: alice < carol
# אז: alice=700(1st), carol=700(2nd), bob=300(3rd)

t=4:  ZREVRANGE lb:all 0 1 WITHSCORES
      → ["alice","700","carol","700"]   # TOP-2

t=5:  ZREVRANK lb:all "bob"
      → 2 → מקום 3
```

נתיב כתיבה ל-DB (async, לא בנתיב החם):

```sql
INSERT INTO score_events (user_id, delta, ts)
VALUES ('alice', 500, NOW()),
       ('bob', 300, NOW()),
       ...
ON CONFLICT (user_id) DO UPDATE SET score = score + EXCLUDED.delta;
```

## המקרה שמפיל את האינטואיציה

**לוח גלובלי עם 500 מיליון משתמשים.**

ZSET יחיד עם 500M entries אפשרי מבחינת זיכרון (כ-40 בתים לאיבר = 20 GB) אבל גורם לשני כשלים:

1. **AOF / RDB snapshotting**: Redis ינסה לכתוב 20 GB לדיסק בכל snapshot. פוגע ב-latency ב-fork.
2. **שרד יחיד = נקודת כשל**: אם ה-Redis מת, הלוח כולו מת.

הפתרון: **Score-range sharding, חלוקה לפי טווח ציון**. כלל שרשרת: `shard = score // 10000`. שחקנים עם 0-9999 נקודות ב-`lb:shard:0`, 10000-19999 ב-`lb:shard:1`, וכן הלאה. שאילתת TOP-100 שואלת את ה-shards הגבוהים ביותר ומאחד (merge sort). ה-"מקום שלי" דורש לדעת כמה elements קיימים בכל shard מעל ה-shard שלי (שמור בנפרד ב-Redis כ-counter).

זה מורכב לתחזוקה. לכן שחקנים ב-tier 1 של העיצוב (ראיון ב-round 1) מדלגים על sharding ומציעים אותו רק כשנשאלים על scale.

## טעויות נפוצות

**טעות 1: שאילתת DB ישירות ל-ORDER BY בכל קריאה.**
זה עובד עד ~100K שורות. עם אינדקס על `score` PostgreSQL יריץ index scan ב-\(O(\log N)\) לשורה, אבל קריאת TOP-10 מחייבת traversal מלמעלה. ב-100M שורות ו-10K req/sec שרת DB יתמוטט.

**טעות 2: ZADD עם score מוחלט בכל פעם במקום ZINCRBY.**
שתי בקשות מקבילות: A כותבת score=100, B כותבת score=120. לפי הסדר B מנצחת. אבל אם מגיעות בסדר הפוך? A מחליפה ב-100 אחרי B. ZINCRBY היא atomic delta וחסינה לתנאי מרוץ.

**טעות 3: ZSET אחד לכל ה-time-windows.**
`lb:all` ו-`lb:week` מנהלים ציונים שונים. ציון שבועי צריך reset בכל שבוע. אם שמים הכל ב-ZSET יחיד עם metadata בנפרד, הקוד מסתבך ו-TTL לא עובד.

**טעות 4: להניח ש-ZREVRANK מחזיר מקום 1-indexed.**
`ZREVRANK` מחזיר 0 לראשון. אם מציגים ללא +1 המשתמש רואה "מקום 0".

**טעות 5: לשכוח שקשרים בציון נשברים לקסיקוגרפית.**
alice ו-carol עם אותו ציון: alice יהיה "ראשון" כי 'a' < 'c'. זה לא הוגן בהכרח. פתרון: encode timestamp ב-score כ-`score * 1e12 + timestamp` כך שמי שהגיע ראשון מקבל עדיפות.

## מתי זה לא משנה

**הלוח לא real-time.** אם מספיק לך לוח שמתעדכן פעם בשעה (leaderboard עונתי, top contributors שבועי), אין צורך ב-Redis. יש להריץ job מתוזמן: `SELECT user_id, SUM(score) ... GROUP BY ORDER BY LIMIT 100`, לשמור את התוצאה ב-JSON פשוט ב-S3 / CDN, וה-client מביא אותה. עלות אפס בהשוואה ל-Redis תמיד-פעיל.

**הלוח קטן.** פחות מ-10,000 משתמשים פעילים? PostgreSQL עם אינדקס מתאים עובד מצוין. אל תוסיף Redis רק כי זה "best practice". Redis זה dependency נוסף, OP, וסיכון inconsistency.

**הלוח הוא אנליטיקה, לא gameplay.** "Top 10 bloggers of the month" נבנה ב-query analytics (BigQuery, Redshift) ומוצג דרך dashboard. real-time ב-50ms לא נדרש שם.

## חיבור

יחידה זו שייכת ל-M3 (System Design). היא נשענת על `m3-key-value-store` לעקרונות Redis ועל `m3-back-of-envelope` לאומדן זיכרון. היא מאפשרת `m3-nearby-friends` (שגם שם score-window plays a role) ואת `m3-notification-system` (פעמון כשהמשתמש עולה דירוג).

בראיון, כשמגיעים ל-leaderboard, הסדר המצופה הוא: clarify requirements → back-of-envelope (כמה users, כמה writes/sec) → data model → Redis ZSET → windowed support → edge cases (ties, sharding). מי שמגיע ל-sharding לפני שהמראיין מבקש נחשב senior-track.

```quiz
{"id":"u-m3-leaderboard-q1","tree":"systems","skill":"system-design","q":"מדוע ZINCRBY עדיף על ZADD עם score מוחלט בעדכון ניקוד?","options":["ZINCRBY מהיר יותר ב-O(1) לעומת O(log N) של ZADD","ZINCRBY היא פעולה אטומית שמוסיפה delta ומונעת תנאי מרוץ כשכמה שרתים כותבים במקביל","ZADD לא תומך במספרים שליליים","ZINCRBY שומר היסטוריה ו-ZADD לא"],"answer":1,"explain":"ZADD עם score מוחלט יוצר race condition: שרת A קורא score=100, שרת B קורא score=100, A כותב 150, B כותב 130. התוצאה הסופית 130 מוחקת את עדכון A. ZINCRBY מבצעת את ה-read-modify-write בגרעין Redis כפעולה אטומית, כך שכל delta מתווסף נכון ללא race condition."}
```

```fillin
{"id":"u-m3-leaderboard-f1","tree":"systems","skill":"system-design","prompt":"פקודת Redis שמחזירה את מקום המשתמש (0-indexed מהגבוה) ב-Sorted Set נקראת _____.","answer":"ZREVRANK","alt":["zrevrank","Zrevrank"],"explain":"ZREVRANK מחזירה את המיקום בסדר יורד (highest score = index 0). לשאילתת TOP-N משתמשים ב-ZREVRANGE. ZRANK (ללא REV) מחזיר מיקום בסדר עולה, שהוא לרוב לא מה שרוצים בלוח דירוג."}
```

```concepts
{"items":[{"id":"leaderboard-zset","t":"Leaderboard Sorted Set","he":"לוח דירוג כקבוצה ממוינת","d":"שימוש ב-Redis ZSET כבסיס לשירות דירוג: ZINCRBY לעדכון, ZREVRANGE ל-top-N, ZREVRANK לדירוג אחד","rel":["redis-zadd","redis-zrevrank","windowed-leaderboard"],"node":"sysdesign"},{"id":"redis-zadd","t":"ZADD","he":"הוספה לקבוצה ממוינת","d":"פקודת Redis שמוסיפה (member, score) ל-ZSET ב-O(log N). עם NX מוסיפה רק אם לא קיים","rel":["leaderboard-zset","redis-zrevrank"],"node":"sysdesign"},{"id":"redis-zrevrank","t":"ZREVRANK","he":"דירוג הפוך","d":"פקודת Redis שמחזירה 0-indexed rank בסדר יורד. יש להוסיף 1 לתצוגת מקום human-readable","rel":["leaderboard-zset","redis-zadd"],"node":"sysdesign"},{"id":"windowed-leaderboard","t":"Windowed Leaderboard","he":"לוח חלון-זמן","d":"ZSETs נפרדים לכל חלון (all-time, weekly, daily) עם TTL על daily/weekly לאיפוס אוטומטי","rel":["leaderboard-zset"],"node":"sysdesign"}]}
```
<!-- audited -->
