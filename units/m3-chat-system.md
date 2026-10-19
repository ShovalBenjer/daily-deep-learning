# תכנון מערכת צ'אט
כשהודעה מגיעה לטלפון שלך תוך פחות משנייה, שרת לא "בדק אם יש חדשות" - הוא מחזיק קשר פתוח אליך כל הזמן.

## מה תדע בסוף
תדע לתכנן מערכת צ'אט ל-50 מיליון משתמשים פעילים: לבחור את פרוטוקול התקשורת הנכון (**WebSocket**) ולנמק מדוע HTTP long-polling ו-SSE לא מספיקים; לתאר את הרכיבים המרכזיים (chat servers, presence service, notification service, message store); להסביר כיצד הודעה עוברת מנשלח לנמען; ולזהות את צוואר הבקבוק בקבוצות גדולות.

## האינטואיציה

דמיין שיחת טלפון. כשרון מתקשר לשירה, הטלפון מחייג, נוצר חיבור, ושניהם יכולים לדבר בו-זמנית. כשרון לא צריך "לבקש" שיגידו לו משהו - שירה פשוט מדברת.

HTTP הרגיל שונה לגמרי: הלקוח שולח בקשה, השרת עונה, החיבור נסגר. כמו לשלוח מכתב ולחכות למכתב חזרה - לא שיחה. בצ'אט, השרת צריך לדחוף הודעה ללקוח ברגע שמישהו שלח - לא לחכות שהלקוח ישאל.

**WebSocket, ווב-סוקט** פותר את זה: לאחר לחיצת-יד (**Handshake, לחיצת יד**) קצרה מעל HTTP, החיבור "מתרומם" לפרוטוקול דו-כיווני פתוח. שני הצדדים יכולים לשלוח בכל עת. החיבור נשאר חי עד שאחד מהם סוגר אותו.

## הפורמליזם

### שלושה פרוטוקולים בהשוואה

| פרוטוקול | כיוון | חיבור | מתאים ל |
|---|---|---|---|
| HTTP polling | לקוח שואל שרת | נסגר אחרי כל בקשה | נדיר, latency גבוה |
| SSE (Server-Sent Events) | שרת דוחף ללקוח | פתוח, חד-כיווני | real-time dashboard, לא צ'אט |
| WebSocket | דו-כיווני | פתוח לאורך | צ'אט, משחקים, מסחר |

**Long-polling** פותר חלק מהבעיה: הלקוח שולח בקשה, השרת "מחכה" לפני שהוא עונה (עד שיש חדשות, או עד timeout). עדיין פחות יעיל מ-WebSocket כי כל מסר פותח חיבור חדש עם HTTP overhead.

### רכיבי המערכת

```
מכשיר A --> Load Balancer --> Chat Server X --> Message Queue --> Chat Server Y --> מכשיר B
                                    |
                              API Servers
                                    |
                    ┌───────────────┴───────────────┐
                Key-Value Store (הודעות)    Presence Service
                                                    |
                                         Push Notification Service
```

**Chat Servers, שרתי צ'אט**: כל שרת מחזיק WebSocket connections פתוחים למכשירים. כשהודעה מגיעה משרת X ומכשיר B מחובר לשרת Y, ה-chat servers מתקשרים דרך **Message Queue** פנימי (Redis Pub/Sub או Kafka).

**API Servers, שרתי API**: פחות זמן-קריטי - טיפול בהתחברות, אחזור היסטוריה, ניהול קבוצות. HTTP רגיל מספיק.

**Key-Value Store**: הודעות נשמרות ב-NoSQL (HBase, Cassandra) ולא ב-SQL. הסיבה: מיליארדי שורות עם writes כבדים ו-reads לפי `(conversation_id, timestamp)`. Cassandra עם partition key = `conversation_id` מאפשרת לאחזר שיחה מהר.

**Message ID**: כל הודעה מקבלת ID ייחודי ומסודר לפי זמן. Snowflake ID (64 bits: timestamp + worker + sequence) מאפשר מיון ללא מסד נתונים מרכזי.

**Presence Service**: יודע מי מחובר. המכשיר שולח **Heartbeat, פעימת לב** כל 5 שניות דרך ה-WebSocket. אם לא מגיעה תוך 30 שניות - המשתמש "ירד". ה-presence service מאחסן `{user_id: last_heartbeat}` ב-Redis (TTL 30 שניות).

**Push Notification Service**: כשמשתמש אופליין, ה-chat server פונה ל-APNS (Apple) או FCM (Google) ושולח push notification.

### זרימת הודעה

1. A מקליד ושולח הודעה ל-chat server X דרך WebSocket.
2. X שומר את ההודעה ב-key-value store.
3. X בודק ב-presence service: האם B מחובר? לאיזה שרת?
4. אם B מחובר לשרת Y: X מפרסם את ההודעה לערוץ `user_B` ב-Redis. Y מאזין לאותו ערוץ ודוחף את ההודעה ל-B.
5. אם B אופליין: X קורא ל-Push Notification Service.

## דוגמה מחושבת

### Capacity Estimation

מערכת עם 50M משתמשים פעילים יומי, 40 הודעות ממוצע ליום, גודל הודעה 100 bytes:

**Write QPS**: \(\frac{50{,}000{,}000 \times 40}{86{,}400} \approx 23{,}000 \text{ messages/sec}\)

**אחסון ליום**: \(50{,}000{,}000 \times 40 \times 100 \text{ bytes} = 200 \text{ GB/day}\)

**WebSocket connections**: לכל chat server אפשר ~100K connections בו-זמנית (memory: ~50 bytes per connection = 5 MB). עבור 50M משתמשים פעילים בו-זמנית בשיא: \(\frac{50{,}000{,}000}{100{,}000} = 500\) chat servers.

### זרימה מלאה: רון שולח לשירה

```
רון (מחובר ל-Server-3) שולח "שלום"
  --> Server-3 מקבל via WebSocket
  --> Server-3 שומר ב-Cassandra (conv_id=ron_shira, msg_id=1234567, text="שלום")
  --> Server-3 בודק presence: שירה מחוברת ל-Server-7
  --> Server-3 מפרסם ב-Redis channel "user:shira": {msg_id: 1234567, ...}
  --> Server-7 מאזין לערוץ, מקבל ההודעה
  --> Server-7 דוחף ל-WebSocket של שירה
  --> שירה מקבלת "שלום" (latency כולל ~100ms)
```

## המקרה שמפיל את האינטואיציה

### Fan-out בקבוצות גדולות

בצ'אט אחד-על-אחד, ההודעה צריכה להגיע לאדם אחד. קל.

בקבוצה של 5,000 איש (כמו קבוצת WhatsApp ענקית), כל הודעה צריכה להגיע ל-5,000 מכשירים. אם כולם מחוברים ל-100 שרתים שונים, כל שרת צריך לבדוק presence ולשלוח ל-Redis 5,000 פעמים - **Fan-out, פיזור אחד-לרבים**.

**הבעיה**: 5,000 Redis writes * 23,000 messages/sec = 115 מיליון Redis operations/sec. זה הרג את הארכיטקטורה הפשוטה.

**הפתרון**: מגבילים גודל קבוצה (WhatsApp: 512, Telegram: 200,000). לקבוצות ענק (Telegram channels), עוברים לארכיטקטורת **Push-Pull hybrid**: השרת שולח notification קטן, כל לקוח מושך את ההודעות בעצמו.

זה ה-trade-off: בין **Push model** (שרת דוחף - latency נמוך, load גבוה) לבין **Pull model** (לקוח מושך - load נמוך, latency גבוה). צ'אט אחד-על-אחד תמיד push. קבוצות ענק - hybrid.

## טעויות נפוצות

**1. לאחסן הודעות ב-SQL**

SQL עובד מצוין עד כמה עשרות מיליוני שורות. מסד נתונים של צ'אט בגודל WhatsApp מכיל טריליוני הודעות. B-tree index לא מסתדר עם write throughput כזה. Cassandra LSM-tree מטפל ב-writes כבדים טוב יותר.

**2. לשכוח presence**

בלי presence service, כל הודעה דורשת ניסיון לשלוח ל-WebSocket, כשל, ואז push notification. זה מאט ומוסיף load. הפרדת presence לשירות נפרד עם Redis + heartbeat חוסכת latency ו-CPU.

**3. WebSocket ל-API שלא צריך real-time**

"אחזור היסטוריית שיחה" לא דורש WebSocket - HTTP GET עם pagination מספיק. WebSocket יקר (connection state בזיכרון). משתמשים בו רק לאיפה שה-latency והדחיפה חשובים.

**4. Message ID עם auto-increment של DB**

Single-node auto-increment הוא bottleneck. ב-distributed system, Snowflake ID (Twitter) או ULID נותנים uniqueness וסדר ללא נקודת כשל יחידה.

**5. לא לחשוב על message ordering**

שני שרתים יכולים לקבל הודעות בו-זמנית. אם client-A שולח הודעות 1,2,3 מהיר, הן עלולות להגיע שלא בסדר. הפתרון: sequence number per conversation, או timestamp מ-Snowflake ID שמבטיח סדר.

## מתי זה לא משנה

**כשהמערכת קטנה (< 10,000 users)**: Long-polling עם PostgreSQL פשוט כמו Supabase Realtime פועל מצוין, ללא overhead של Kafka ו-Cassandra.

**כשההודעות לא real-time**: מערכת תמיכה (support tickets) לא צריכה WebSocket. HTTP polling כל 30 שניות מספיק, ומפשט את הארכיטקטורה.

**כשה-use case הוא broadcast**: YouTube Live Chat שולח לכולם אותו דבר. שם SSE + CDN יעילים יותר מ-WebSocket לכל צופה.

**בראיון**: כשמראיין שואל "design a chat system", הוא מחפש שתוכל לבחור WebSocket ולנמק, לתאר זרימת הודעה end-to-end, ולדעת שהנקודה הכואבת היא קבוצות גדולות. Snowflake IDs ו-Cassandra הם נקודות bonus.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`). מבנה זה מסתמך על ידע מ-DSA (m1): הבנת trade-offs בין מבני נתונים היא שפת ה-system design.

**מה זה מאפשר**:
- **m3-notification-system**: push notifications הן רכיב מרכזי שראינו כאן
- **m3-key-value-store**: Cassandra ו-Redis שהופיעו כאן מוסברים לעומק שם
- **m3-message-queue**: Kafka ו-Redis Pub/Sub לפיצול שרתים

```quiz
{"id":"u-m3-chat-system-q1","tree":"systems","skill":"system-design","q":"מדוע WebSocket עדיף על HTTP long-polling לצ'אט אחד-על-אחד?","options":["כי WebSocket מהיר יותר להגדרה ראשונית","כי WebSocket מאפשר דחיפה דו-כיוונית עם חיבור יחיד פתוח, בלי overhead של HTTP headers בכל הודעה","כי HTTP long-polling לא תומך ב-SSL","כי WebSocket שומר הודעות אוטומטית במסד נתונים"],"answer":1,"explain":"WebSocket מרים חיבור אחד ושומר אותו פתוח. HTTP long-polling פותח חיבור חדש לכל מסר עם headers מלאים (~700 bytes) ו-TCP handshake. ב-23,000 messages/sec ההפרש ניכר. SSL תומך בשניהם. WebSocket לא אחראי על אחסון."}
```

```quiz
{"id":"u-m3-chat-system-q2","tree":"systems","skill":"system-design","q":"איזה רכיב מודיע ל-chat server Y שמשתמש B מחובר אליו ולא לשרת X?","options":["Key-Value Store","Push Notification Service","Presence Service","Load Balancer"],"answer":2,"explain":"ה-Presence Service מנהל מיפוי user_id -> server_id. כשרת X צריך לשלוח הודעה ל-B, הוא שואל את ה-presence service לאיזה שרת B מחובר ומפרסם ב-Redis channel המתאים. ה-Key-Value Store שומר הודעות. Push Notification הוא לאופליין."}
```

```quiz
{"id":"u-m3-chat-system-q3","tree":"systems","skill":"system-design","q":"מדוע Cassandra (NoSQL) עדיפה על PostgreSQL (SQL) לאחסון הודעות צ'אט בקנה מידה גדול?","options":["כי Cassandra לא דורשת schema","כי Cassandra זולה יותר לרישיון","כי Cassandra משתמשת ב-LSM-tree שמטפל היטב ב-write-heavy workload עם טריליוני שורות","כי PostgreSQL לא תומכת ב-UUID"],"answer":2,"explain":"Cassandra כותבת ל-LSM-tree (MemTable + SSTables) שמאוד יעיל ל-heavy writes. B-tree של PostgreSQL דורש random writes לדיסק שמאטים בנפחים גדולים. PostgreSQL מצוינת אבל לא נועדה ל-write throughput של מיליארדי הודעות ביום."}
```

```concepts
{"items":[{"id":"websocket","t":"WebSocket","he":"ווב-סוקט","d":"פרוטוקול תקשורת דו-כיווני עם חיבור פתוח. מתחיל ב-HTTP handshake ומתרומם לפרוטוקול משלו. משמש לצ'אט, משחקים ועדכונים real-time.","rel":["chat-system","sse","long-polling"],"node":"sysdesign"},{"id":"long-polling","t":"Long-Polling","he":"long-polling","d":"הלקוח שולח בקשת HTTP והשרת 'מחכה' לפני שעונה עד שיש חדשות. פחות יעיל מ-WebSocket בגלל overhead של חיבור חדש בכל מסר.","rel":["websocket","chat-system"],"node":"sysdesign"},{"id":"presence-service","t":"Presence Service","he":"שירות נוכחות","d":"רכיב שמנהל מיפוי user_id -> connected_server ואת סטטוס online/offline. מסתמך על heartbeats מהלקוח ו-TTL ב-Redis.","rel":["chat-system","heartbeat"],"node":"sysdesign"},{"id":"heartbeat","t":"Heartbeat","he":"פעימת לב","d":"הודעה קטנה שלקוח שולח לשרת מדי N שניות כדי להוכיח שהוא עדיין חי. אם לא מגיעה בזמן, השרת מסמן אותו כ-offline.","rel":["presence-service"],"node":"sysdesign"},{"id":"snowflake-id","t":"Snowflake ID","he":"מזהה Snowflake","d":"מזהה 64-bit ייחודי ומסודר לפי זמן: timestamp + worker ID + sequence. מאפשר IDs ייחודיים ב-distributed system ללא נקודת כשל יחידה.","rel":["chat-system","message-ordering"],"node":"sysdesign"},{"id":"fan-out","t":"Fan-out","he":"פיזור אחד-לרבים","d":"שליחת הודעה אחת לרשימת נמענים רבים. הבעיה המרכזית בקבוצות גדולות: O(n) operations לכל הודעה.","rel":["chat-system","pub-sub"],"node":"sysdesign"},{"id":"chat-system","t":"Chat System","he":"מערכת צ'אט","d":"מערכת real-time להעברת הודעות. רכיבי ליבה: chat servers עם WebSocket, presence service, key-value store לאחסון, push notifications לאופליין.","rel":["websocket","presence-service","fan-out","snowflake-id"],"node":"sysdesign"}]}
```
