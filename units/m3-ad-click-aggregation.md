# צבירת קליקים
כל לחיצה על מודעה היא event בגודל בתים; הארכיטקטורה כולה עוסקת בשאלה: איך הופכים מיליארד events ביום לספרה אחת שמדויקת, זולה, ומתעדכנת בזמן-אמת.

## מה תדע בסוף
תוכל לתאר ולנמק ארכיטקטורת צבירת לחיצות על מודעות בראיון system design: הרכיבים המרכזיים, שלוש ההחלטות הגדולות שקובעות את שאר העיצוב, ואיפה הבעיות הלא-מתבקשות מסתתרות.

## האינטואיציה
חשוב על מונה תנועה על כביש מהיר. כל רכב שעובר מפעיל לחיצה (event). בסוף כל שעה מחשבים את הסכום ורושמים אותו בטבלה (aggregation). המונה עצמו לא שומר צילום של כל רכב; הוא שומר רק את הסכום.

הקושי: מיליוני רכבים בו-זמנית, מאות כבישים, וחלק מהרכבים מדווחים ביאחור. הארכיטקטורה צריכה להיות מדויקת גם כשהזרם אינו מסודר, וזולה גם כשהוא עצום. הרעיון שמחזיק את הכל: **חלק את הזמן לדליים, צבור כל event לדלי הנכון, שמור את הסכום בלבד.**

## ההגדרות המדויקות

**Click event, אירוע לחיצה** הוא הפרטיקל הבסיסי: `{ad_id, user_id, timestamp, ip, metadata}`. כל לחיצה על מודעה מייצרת event אחד. בסקאלה של גוגל: 10 מיליארד ביום, כ-115 אלף בשנייה.

**Ingestion layer, שכבת הקליטה** הם שרתי API שמקבלים events מהדפדפן: מאמתים (האם ה-ad_id קיים?), מייצרים idempotency key ייחודי לכל לחיצה, ודוחפים לתור הודעות. זהו ה-write path המהיר; הוא לא מחשב דבר.

**Message queue, תור הודעות** (Kafka בפועל) הוא הבאפר שמנתק בין קצב הקליטה לקצב העיבוד. אם הפרוצסור קורס, ה-events לא הולכים לאיבוד; הם מחכים בתור עם offset. Kafka מחלק events ל-partitions לפי ad_id כברירת-מחדל.

**Stream processor, מעבד הזרם** (Apache Flink, Spark Streaming) צורך את Kafka ומצבר events בחלונות זמן. לכל `(ad_id, minute_bucket)` הוא מחזיק מונה; בסוף כל חלון כותב את הסכום לאחסון.

**Tumbling window, חלון מתהפך** הוא חלון זמן קבוע שאינו מתחפף. חלון של דקה: 00:00-01:00, 01:00-02:00, וכן הלאה. כל event שייך לחלון אחד בלבד לפי ה-timestamp שלו. מתאים לbilling: כל דקה היא חשבון נפרד.

**Time-series store, מאגר סדרות זמן** (ClickHouse, Cassandra) שומר את הצברים לפי `(ad_id, time_bucket)`. שאילתה "כמה לחיצות קיבלה מודעה X בשעה האחרונה?" היא scan של 60 שורות ומחזירה תוך < 10ms.

**Deduplication key, מפתח לביטול כפילויות** מונע ספירה כפולה. הדפדפן מייצר `click_id` ייחודי; ה-stream processor בודק ב-Redis אם ה-id כבר עובד לפני שהוא מוסיף למונה. ב-Redis: `SETNX click_id 1 EX 86400`.

**Late-arriving event, אירוע מאוחר** הוא event שמגיע לאחר שחלון הזמן שלו כבר נסגר. סיבה שכיחה: mobile client שהיה offline ו-sync כשחזר לרשת. פתרון: **watermark** שמגדיר "חלון X נסגר רק X+5 דקות אחרי סופו הנומינלי". אירועים שמגיעים לאחר ה-watermark מופנים ל-dead letter queue לעיון ידני.

## דוגמה מחושבת

נניח מודעת ענק עם 1 מיליון לחיצות ביום.

**קצב כניסה:** 1,000,000 / 86,400 = ~11.5 לחיצות/שנייה. עם מאה מודעות: ~1,150 events/שנייה. שרת API אחד מטפל בעשרות אלפי בקשות לשנייה, כך שצוואר הבקבוק אינו שם.

**מה Flink עושה בחלון של דקה:**
1. קורא events מ-Kafka partition מסוים.
2. לכל event: בודק dedup ב-Redis (`SETNX click_id:abc123 1 EX 86400`). אם כבר קיים, מדלג.
3. מוסיף 1 למונה הפנימי עבור `(ad_id, minute_bucket)`.
4. ב-00:01:00: כותב `{ad_id: "X", bucket: "2026-11-21T00:00", clicks: 693}` ל-ClickHouse.
5. מנקה את המצב המקומי ומתחיל חלון חדש.

**שאילתת dashboard:**
```sql
SELECT SUM(clicks)
FROM ad_clicks
WHERE ad_id = 'X'
  AND bucket >= now() - INTERVAL 1 HOUR;
```
60 שורות, זמן תגובה < 10ms.

## המקרה שמפיל את האינטואיציה

**Hot partition, מחיצה חמה** הוא המקרה שמשבש ארכיטקטורה "פשוטה".

נניח שמודעת השקה ויראלית מקבלת 500 אלף לחיצות בשנייה. אם המפתח של Kafka הוא ad_id, כל ה-events של מודעה זו הולכים לpartition אחד. ה-Flink instance שאחראי עליו הופך לצוואר בקבוק; הוא לא מסוגל לעמוד בקצב.

פתרון: **two-phase aggregation, צבירה דו-שלבית.** מוסיפים random suffix למפתח: `ad_id_123_shard_7` במקום `ad_id_123`. כך ה-events מתפזרים על N partitions. Flink instance אחד מצבר shard אחד ומייצר תוצאה חלקית. שלב שני מאחד את N התוצאות לתוצאה סופית. המחיר: מורכבות מוגברת ועוד שלב latency.

```quiz
{"id":"u-m3-ad-click-aggregation-q1","tree":"systems","skill":"system-design","q":"מה תפקידו של message queue (Kafka) במערכת צבירת לחיצות על מודעות?","options":["לאחסן את תוצאות הצבירה לשאילתות dashboard","לנתק בין קצב קליטת events לקצב עיבודם ולמנוע אובדן events כשהפרוצסור קורס","לחשב aggregations בזמן-אמת ולכתוב תוצאות ל-ClickHouse","לאמת שהלחיצה מגיעה ממשתמש אמיתי ולא מbot"],"answer":1,"explain":"Kafka הוא באפר עמיד שמנתק ingestion מprocessing. אם Flink קורס, ה-events לא הולכים לאיבוד; הם מחכים עם offset מוגדר. זו הסיבה המרכזית להכניס message queue בין שרת ה-API לפרוצסור."}
```

## טעויות נפוצות

**לא לטפל באירועים מאוחרים.** מחשוב billing בזמן-אמת בלי watermark יחטיא 2-3% מה-events שמגיעים ביאחור ממכשירים ניידים. עבור billing, 1% שגיאה = כסף אמיתי.

**לספור clicks בלי deduplication.** רשת גרועה גורמת לדפדפן לשלוח אותו click פעמיים. בלי idempotency key, מפרסם ישלם כפליים.

**לשמור raw events ב-OLAP ישירות.** שאילתה על טבלה עם מיליארד שורות כל 24 שעות אינה סקלאבילית. הפתרון: pre-aggregate לפי חלון קטן ושמור רק צברים.

**להניח שclient timestamp אמין.** clients יכולים לזייף timestamp. יש לסמוך על server-side timestamp בכניסה ל-API, לא על הclient timestamp. timestamp מהclient משמש רק כרמז, לא כאמת.

**לשכוח שpartition mapping עלול להיות לא-אחיד.** ad פופולרי ימוטט partition אחד. בחן את תפלגות ה-events לפני שתבחר מפתח Kafka.

## מתי זה לא משנה

**בסקאלה קטנה (< 10M events/day):** PostgreSQL עם partitioning לפי יום, batch job שמצבר כל דקה, ו-Redis cache ל-dashboard. אין צורך ב-Kafka, Flink, ו-ClickHouse. תשיג 99% מהתוצאה ב-5% מהמורכבות.

**כשדיוק של 100% לא קריטי:** אם המטרה היא analytics פנימי בלבד, approximate counting עם HyperLogLog מספיק. עם שגיאה של 2% וזיכרון של 12KB לכל מודעה.

**ב-interview:** אל תתחיל עם Kafka ו-Flink. תתחיל עם "מה הסקאלה? מה ה-SLA של דיוק? האם real-time או batch?" ואז תבחר בהתאם. ה-interviewer רוצה לראות thinking, לא שמות כלים.

## חיבור

יחידה זו שייכת לאשכול **תכנון מערכות** (sysdesign). הארכיטקטורה שלה היא דוגמה מייצגת למערכות event-driven בנפח גבוה: ingestion מהיר, עיבוד async, ואחסון צבור.

היחידה שמבקרת לפניה: **Design a message queue** שם תלמד את Kafka לעומק. לאחריה: **Design a real-time leaderboard** שם אותו pattern עם Redis ו-sorted sets מחליף את ClickHouse.

```concepts
{"items":[{"id":"ad-click-event","t":"Click Event","he":"אירוע לחיצה","d":"הפרטיקל הבסיסי במערכת צבירת מודעות: {ad_id, user_id, timestamp, ip}; מגיע במאות אלפים לשנייה בסקאלה גדולה","rel":["hot-partition","late-arriving-event","tumbling-window-agg"],"node":"sysdesign"},{"id":"tumbling-window-agg","t":"Tumbling Window","he":"חלון מתהפך","d":"חלון זמן קבוע שאינו מתחפף; כל event שייך לחלון אחד בלבד; מתאים לbilling ולאגרגציה מדויקת","rel":["late-arriving-event","ad-click-event"],"node":"sysdesign"},{"id":"late-arriving-event","t":"Late-Arriving Event","he":"אירוע מאוחר","d":"event שמגיע לאחר שחלון הזמן שלו נסגר; נפוץ ממכשירים ניידים שחזרו לרשת; מטופל באמצעות watermark","rel":["tumbling-window-agg","ad-click-event"],"node":"sysdesign"},{"id":"hot-partition","t":"Hot Partition","he":"מחיצה חמה","d":"partition ב-Kafka שמקבל תעבורה גבוהה באופן לא-פרופורציונלי עקב mapping ad_id; פתרון: shard suffix אקראי וצבירה דו-שלבית","rel":["ad-click-event","tumbling-window-agg"],"node":"sysdesign"}]}
```
