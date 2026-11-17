# תור הודעות מבוזר
כשמיליון אירועים צריכים להגיע בלי שהשולח ימתין לנמען, תור ההודעות הוא הצינור שמנתק ומייצב את המערכת כולה.

## מה תדע בסוף
תוכל לתכנן תור הודעות מבוזר: לבחור מספר partitions, replication factor ומדיניות retention, להסביר כיצד producer ו-consumer נפגשים דרך broker, ולהצדיק את ה-trade-off בין at-least-once ל-at-most-once.

## האינטואיציה
דמיין סניף דואר: אתה משלח מכתב, מוסר אותו לסניף, וממשיך לסדר היום. הנמען מגיע בזמן שלו, מוצא את המכתב בתא, ומוציא אותו. אף אחד לא המתין לשני. תור ההודעות הוא הסניף הזה, רק עבור bytes.

שלושה שחקנים מנהלים את ה"דואר":

- **Producer (מפיק)**: השולח. כותב הודעה ומפרסם ל-topic.
- **Broker (מתווך)**: שרת ה-storage. מחזיק הודעות על disk, מנהל replicas, עונה לשאלות.
- **Consumer (צרכן)**: הנמען. קורא הודעות מ-topic בקצב שלו, ללא תלות בשולח.

האינטואיציה המרכזית: **decoupling, ניתוק**. השולח לא יודע אם יש נמען, כמה יש, או באיזה קצב הם עובדים. זה מה שמאפשר לכתוב שירות `order-service` שרק מפרסם אירועים, בלי שידע שקיימים `billing-service` ו-`inventory-service` שקוראים אותם.

## ההגדרות המדויקות

**Message Queue, תור הודעות**: מנגנון async שמנתק producer מ-consumer, שומר הודעות ל-retention window, ומאפשר צריכה מרובת שחקנים ומרובת סבבים.

**Topic (נושא)**: יחידת ארגון לוגית. כל הודעה שייכת ל-topic. למשל: `orders`, `payment-events`, `user-logins`. topic הוא שם; ה-data בפועל חי ב-partitions.

**Partition (מחיצה)**: נגזרת של topic. topic מתחלק ל-N partitions, שכל אחד הוא **append-only log**: הודעות נוספות רק לסוף ולא נערכות. בתוך partition, הסדר מובטח.

**Offset (אופסט)**: מספר שלם עולה (0, 1, 2, ...) בתוך partition. consumer מכיר את ה-offset שהוא עיבד ושומר אותו. לאחר crash הוא יודע בדיוק מאיפה להמשיך.

**Consumer Group (קבוצת צרכנים)**: קבוצת processes ששותפות ב-topic. כל partition ניתן **לצרכן אחד בלבד** בתוך קבוצה. זה מאפשר parallelism: 3 partitions ומשתמשים ב-3 consumers = כל אחד מעבד \(\frac{1}{3}\) מהעומס.

**Replication Factor (גורם שכפול)**: כמה עותקים של כל partition נשמרים ב-brokers שונים. factor=3 אומר שהמערכת שורדת נפילת שני brokers.

**Retention (שמירה)**: כמה זמן הודעות נשמרות - לפי זמן (7 ימים) או גודל (100 GB). לאחר מגבלה, הודעות ישנות נמחקות.

**At-least-once delivery (מסירה לפחות פעם)**: consumer מאשר קריאה (commit offset) רק לאחר עיבוד מוצלח. crash לפני commit = הודעה תישלח שוב. handlers חייבים להיות **idempotent, אידמפוטנטיים** - אפשר להריץ פעמיים בלי נזק.

**At-most-once delivery (מסירה לכל היותר פעם)**: consumer מאשר ברגע הקריאה, לפני עיבוד. crash = הודעה אובדת לנצח. מתאים כשאיבוד נסבל, למשל metrics.

**Exactly-once (בדיוק פעם)**: אפשרי עם transactional producers ו-consumers, אך בעל עלות ביצועים. בפועל, at-least-once עם handlers idempotent הוא הפשרה הנפוצה.

## דוגמה מחושבת

**שאלה**: Design a message queue for a food delivery app: 1 million order events per day, 1 KB per message, retention 7 days, 3 consumer services.

**שלב 1 - throughput**:
\[1{,}000{,}000 \text{ msg/day} \div 86{,}400 \text{ sec} \approx 11.6 \text{ msg/sec}\]
כתיבה: \(11.6 \text{ KB/sec}\). עומס נמוך מאוד לפי סטנדרטים של Kafka.

**שלב 2 - storage**:
\[10^6 \text{ msg} \times 1 \text{ KB} \times 7 \text{ days} = 7 \text{ GB raw}\]
עם replication factor 3: \(7 \times 3 = 21 \text{ GB}\).

**שלב 3 - partitions**:
3 consumer services, כל אחד צריך לעבד במקביל. בחרנו **6 partitions**: כל service מקבל 2 partitions, וגמישות להוספת instances.

**שלב 4 - partition key**:
משתמשים ב-`restaurant_id` כ-key. כל ההזמנות מאותו מסעדה מגיעות לאותו partition = ordering per-restaurant מובטח.

**שלב 5 - API**:
```
# Producer: פרסום הזמנה
POST /publish
{
  "topic": "orders",
  "key": "restaurant_42",
  "value": "{\"order_id\": 7891, \"amount\": 85, \"status\": \"new\"}"
}

# Consumer: קריאת batch
GET /consume?topic=orders&group=billing-service&partition=0&offset=1500&limit=100
```

**שלב 6 - broker topology**:
3 brokers, replication factor 3. ה-**leader** של כל partition מקבל כתיבות וקריאות. ה-**followers** מסנכרנים. אם leader נופל, follower עם ה-offset המעודכן ביותר מתמנה ל-leader תוך שניות (הפסד זמן-תגובה, לא הפסד data).

```quiz
{"id":"u-m3-message-queue-q1","tree":"systems","skill":"system-design","q":"מה מבטיח ordering של הודעות בתוך Kafka topic?","options":["ה-topic עצמו","ה-partition","ה-consumer group","ה-broker leader"],"answer":1,"explain":"בתוך partition אחד, ה-offset הוא מספר עולה שמבטיח FIFO מלא. בין partitions שונים אין ערובה לסדר. ה-topic הוא רק ארגון לוגי; ה-consumer group מנהל parallelism; ה-broker leader מקבל כתיבות אבל לא מבטיח cross-partition ordering."}
```

## המקרה שמפיל את האינטואיציה

**הנחת FIFO מלאה על כל ה-topic - שגויה**.

אם consumer A קורא מ-partition 0 ו-consumer B קורא מ-partition 1, אין ערובה לסדר **בין** שתי ה-partitions. עבור אפליקציית payments:

- הודעה "debit $100 from account X" נשלחה עם key=`account_X` → partition 0.
- הודעה "credit $50 to account X" נשלחה מ-service אחר עם key שונה → partition 1.
- Consumer B עיבד credit לפני ש-consumer A עיבד debit → יתרה שלילית רגעית.

**הפתרון**: אחידות ב-partition key לפי entity שדורשת ordering. כל הפעולות של אותו account → אותו partition → סדר מובטח.

**מקרה שני - offset commit שגוי**: consumer שקורא batch של 100 הודעות ומבצע commit offset **לפני** עיבוד. crash = כל 100 הודעות אבדות. תמיד commit **אחרי** עיבוד מוצלח.

```fillin
{"id":"u-m3-message-queue-f1","tree":"systems","skill":"system-design","prompt":"המספר השלם העולה שמסמן את מיקום הודעה בתוך Kafka partition נקרא ___","answer":"offset","alt":["אופסט"],"explain":"ה-offset הוא מספר שלם לא שלילי שעולה ב-1 עם כל הודעה. consumer שומר את ה-offset האחרון שעיבד (committed offset) כדי לדעת מאיפה להמשיך אחרי restart. זה מה שמאפשר at-least-once delivery: אם commit לא הושלם, consumer יקרא שוב מ-offset האחרון."}
```

## טעויות נפוצות

1. **שימוש בתור כ-RPC**: "שולח בקשה, מחכה לתשובה". זה request-response, לא message queue. לתשובה סינכרונית: gRPC או HTTP. תור מתאים לאסינכרוניות שבה לא צריך תשובה מיידית.

2. **הנחת ordering על כל ה-topic**: FIFO מובטח רק **בתוך** partition. consumers מרובים על partitions מרובים = ordering חלקי בלבד. תכנן partition key לפי entity.

3. **הזנחת retention policy**: ברירת מחדל ב-Kafka היא 7 ימים. בלי מדיניות ברורה, disks מתמלאים. consumers שמפגרים אחרי retention window **יפספסו הודעות** ולא יקבלו שגיאה.

4. **at-most-once בלי מחשבה**: "אם הודעה אבדה, זה בסדר" - לא תמיד. ב-orders, אבדן הודעה = הזמנה שלא עובדה. בחר semantics בהתאם לביזנס, לא נוחות.

5. **יותר consumers מ-partitions**: בתוך consumer group, partition אחד ניתן לצרכן אחד. עם 3 partitions ו-5 consumers - 2 consumers בטלים לחלוטין. תכנן partitions לפי max concurrency צפוי.

## מתי זה לא משנה

**שירות קטן עם task queue פשוט**: אם queue שלך הוא רשימה של background jobs בתוך שירות אחד, Redis Sorted Set, Celery עם Redis backend, או שורת DB עם status column מתאימים ופשוטים יותר. Kafka מביא עמו ZooKeeper, schema registry, monitoring - overhead ניהולי גבוה.

**קריאה סינכרונית בין שירותים**: שני שירותים שדורשים תשובה מיידית → gRPC או HTTP. תור מוסיף latency (עשרות ms) ומורכבות ה-consumer בלי ערך.

**Scale נמוך עם state מורכב**: אם אתה צריך לדעת שההודעה עובדה point-to-point ולנהל state מורכב, service bus עם transactions (SQS, Azure Service Bus) עדיף: הם מנהלים visibility timeout ו-dead-letter queue out-of-the-box.

**ראיון**: ה-interviewer ישאל "למה לא HTTP?" - 4 תשובות: (א) decoupling - producer לא יודע על consumers, (ב) buffering לעומסי peak, (ג) replayability - אפשר לקרוא מחדש עם offset אחר, (ד) fan-out - consumers מרובים על אותן הודעות.

```quiz
{"id":"u-m3-message-queue-q2","tree":"systems","skill":"system-design","q":"Which delivery guarantee requires idempotent message handlers?","options":["At-most-once","Best-effort","At-least-once","Fire-and-forget"],"answer":2,"explain":"At-least-once commits the offset only after successful processing. If the consumer crashes before commit, the message is redelivered. Handlers must therefore be idempotent — running them twice must produce the same result. At-most-once commits immediately on receipt, so a crash loses the message; idempotency is not needed but data loss is accepted."}
```

## חיבור

יחידה זו שייכת ל-block M3 - System Design Interview. היא מכסה את תבנית ה-async messaging שעומדת בבסיס עשרות עיצובי מערכת.

**מה זה פותח מיד**: יחידות M3 אחרות כמו Notification System ו-News Feed משתמשות בתור כמרכיב מרכזי. כשתכנן אותן, partition key ו-consumer group הם כלים מוכנים.

**חיבור ל-block M2**: LSM tree ו-B-tree מ-storage הם מנגנוני ה-persistence שמאחורי Kafka's log segments. ה-append-only design של partition הוא בדיוק LSM write path.

**חיבור ל-math**: תורי Poisson מדלים load בתורי הודעות - arrival rate \(\lambda\), service rate \(\mu\), ניצולת \(\rho = \lambda / \mu\). כאשר \(\rho \to 1\) latency פורחת. זה מסביר למה partitions נוספים עוזרים: הם מורידים \(\rho\) per-partition.

```concepts
{"items":[{"id":"c-mq-partition","t":"Partition","he":"מחיצה","d":"append-only log בתוך topic; מבטיח FIFO בתוך עצמו; ביחידת parallelism של consumer group","rel":["message-queue-arch","c-mq-offset"],"node":"sysdesign"},{"id":"c-mq-offset","t":"Offset","he":"אופסט","d":"מספר שלם עולה שמסמן מיקום הודעה בתוך partition; consumer שומר committed offset להמשך אחרי crash","rel":["c-mq-partition"],"node":"sysdesign"},{"id":"c-consumer-group","t":"Consumer Group","he":"קבוצת צרכנים","d":"קבוצת processes שחולקות partition-ים; כל partition מוקצה לצרכן אחד בלבד לאיזון עומס","rel":["message-queue-arch","c-mq-partition"],"node":"sysdesign"},{"id":"c-mq-broker","t":"Message Broker","he":"מתווך הודעות","d":"שרת שמחזיק partitions על disk, מנהל replication ומשמש כנקודת כניסה ל-producers ו-consumers","rel":["message-queue-arch","c-mq-partition"],"node":"sysdesign"},{"id":"c-mq-replication","t":"Replication Factor","he":"גורם שכפול","d":"מספר העותקים של כל partition על brokers שונים; factor=3 שורד נפילת 2 brokers ללא אובדן data","rel":["c-mq-broker","c-mq-partition"],"node":"sysdesign"}]}
```
