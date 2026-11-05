# פיד חדשות

Twitter מפעיל פיד ל-500 מיליון ציוצים ביום; כל עדכון שלך מגיע לעשרות חברים תוך פחות ממאית שנייה.

## מה תדע בסוף

לתכנן פיד חדשות ברמת ראיון בכיר: לתאר שתי זרימות מנוגדות (פרסום ובנייה), לנמק מתי push, מתי pull ומתי hybrid; לתאר schema, cache, וטיפול ב-celebrities; ולגזור קיבולת מ-back-of-envelope.

## האינטואיציה

דמיין שאתה עורך עיתון שמדפיס מהדורה אישית לכל קורא. יש לך שתי אסטרטגיות:

**Push**: ברגע שכתב מפרסם ידיעה, מדפיסים עותק ומניחים אותו בתיבת הדואר של כל קורא. קריאה מהירה, אבל אם לכתב הפופולרי מאה אלף קוראים, מפעל הדפוס עמוס.

**Pull**: כשקורא פותח את העיתון, מאספים ידיעות מכל הכתבים שהוא עוקב עליהם. פרסום קל, אבל הפתיחה איטית: צריך לשאול מאה מקורות.

פיד חדשות אמיתי מכיל celebrities, ל-Kylie Jenner יש 400 מיליון עוקבים ול-חברך 500. Push לשניהם באותו אופן הוא הטעות שמפילה את המערכת.

## ההגדרות המדויקות

**News feed, פיד חדשות**: רצף פוסטים ממשתמשים שעוקבים אחריהם, ממוין לרוב לפי אלגוריתם רלוונטיות או זמן.

**Feed publishing, פרסום לפיד**: הזרימה שמתחילה כשמשתמש כותב פוסט ומסתיימת כשהפוסט מגיע לכל עוקביו.

**Feed building, בניית פיד**: הזרימה שמתחילה כשמשתמש פותח את האפליקציה ומסתיימת כשמוצגים לו הפוסטים.

**Fanout, פיזור-write**: פעולה שמשכפלת הודעה אחת ל-N יעדים. בהקשר של news feed: post אחד מתפשט לN תיבות נכנסות.

**Fanout on write, פיזור בזמן כתיבה**: כשמשתמש מפרסם פוסט, המערכת מיד כותבת את post_id לתיבות הנכנסות של כל עוקביו. קריאת פיד = lookup פשוט ב-cache. כתיבה כבדה, קריאה מהירה.

**Fanout on read, פיזור בזמן קריאה**: כשמשתמש פותח פיד, המערכת שואלת בזמן אמת "מי אתה עוקב?" ומביאה פוסטים עדכניים מכולם. כתיבה קלה, קריאה כבדה.

**Hybrid fanout, פיזור היברידי**: fanout on write למשתמשים רגילים (מעט עוקבים), fanout on read ל-celebrities (סף נפוץ: מעל מיליון עוקבים). מאזן את שני הקצוות.

**Celebrity problem, בעיית הסלבריטי**: משתמש עם N עוקבים שמפרסם גורם ל-N כתיבות מקבילות. ב-fanout on write, celebrity עם 400M עוקבים = 400 מיליון כתיבות ב-Redis תוך שניות. ה-fanout service מוצף.

**Social graph, גרף חברתי**: מבנה נתונים שמייצג follows. nodes = משתמשים, edges = "A עוקב אחרי B". מאוחסן ב-graph DB (Neo4j) או Redis sets ל-hot users.

### נקודות קצה עיקריות

```
POST /v1/me/feed
Body:     { "content": "Hello World", "auth_token": "..." }
Response: { "post_id": "1234567890" }

GET /v1/me/feed
Params:   auth_token
Response: { "posts": [{ "post_id": "...", "user_id": "...", "content": "...", "media_urls": [...] }] }
```

### Schema

```sql
CREATE TABLE users (
  user_id    BIGINT PRIMARY KEY,
  name       VARCHAR(100),
  email      VARCHAR(100) UNIQUE,
  created_at TIMESTAMP
);

CREATE TABLE posts (
  post_id    BIGINT PRIMARY KEY,
  user_id    BIGINT REFERENCES users(user_id),
  content    TEXT,
  media_urls TEXT,
  created_at TIMESTAMP
);

CREATE TABLE follows (
  follower_id BIGINT REFERENCES users(user_id),
  followee_id BIGINT REFERENCES users(user_id),
  PRIMARY KEY (follower_id, followee_id)
);
```

Feed cache ב-Redis: `feed:{user_id}` = sorted set של post_ids לפי timestamp. לא כל התוכן, רק מזהים.

בפרקטיקה: users ו-follows ב-relational DB; posts ב-Cassandra ל-write scaling; feed cache ב-Redis cluster.

### ארכיטקטורה כוללת

```
User → Web Servers → Post Service → Message Queue
                                          |
                              ┌───────────┴────────────┐
                              Fanout Service           Notification Service
                              |                                |
                     [regular users]  [celebrities]     Push notifications
                           |
                     Redis feed cache
                           |
                      Feed Service
                           |
                        GET feed
```

## דוגמה מחושבת

### back-of-envelope

```
300 מיליון משתמשים, 50% פעילים ביום = 150M DAU
כל משתמש פעיל פוסט 2 פוסטים ביום
כל משתמש פעיל גולל 100 פוסטים ביום

Write QPS:  150M × 2 / 86,400 ≈ 3,500 כתיבות/שנייה
Read  QPS:  150M × 100 / 86,400 ≈ 174,000 קריאות/שנייה
```

יחס קריאה/כתיבה: \(174{,}000 / 3{,}500 \approx 50:1\). פיד הוא read-heavy בצורה קיצונית; cache הוא המינוף הגדול.

קיבולת feed cache: נניח 500 post_ids לכל משתמש פעיל, כל post_id = 8 bytes.
\[150M \times 500 \times 8\ \text{bytes} = 600\ \text{GB}\]
Redis cluster של 3 node × 256 GB מספיק עם headroom.

### flow מלא: פרסום פוסט

1. Web server מקבל `POST /v1/me/feed`, מאמת JWT token.
2. Post service שומר פוסט ב-Cassandra ומחזיר post_id.
3. Post service שולח הודעה ל-Message Queue: `{ post_id, user_id, timestamp }`.
4. Fanout service צורך את ההודעה:
   a. שולף רשימת עוקבים מה-Graph cache (Redis set).
   b. בודק אם המפרסם הוא celebrity (follower_count > 1M).
   c. לעוקבים רגילים: `ZADD feed:{follower_id} timestamp post_id`.
   d. ל-celebrity: דולג, מסמן `celebrity_posts:{user_id}` ב-Redis עם TTL.
5. Notification service שולח push notifications ל-active followers.

### flow מלא: קריאת פיד

1. Web server מקבל `GET /v1/me/feed`, מאמת token.
2. Feed service שולף 20 post_ids מ-`feed:{user_id}` ב-Redis (`ZREVRANGE`).
3. Feed service בודק אם המשתמש עוקב אחרי celebrities: מביא את הפוסטים העדכניים שלהם ישירות (`ZREVRANGE celebrity_posts:{celeb_id}`).
4. ממזג ומסדר לפי timestamp.
5. Post service מביא תוכן מ-Post cache (Redis) / Cassandra לכל post_id שנבחר.
6. מחזיר payload מלא.

## המקרה שמפיל את האינטואיציה

"fanout on write תמיד עובד; הפיד מוכן מראש ומהיר."

**Celebrity problem בפועל**: Kylie Jenner עם 400M עוקבים מפרסמת. fanout on write = 400 מיליון כתיבות ל-Redis תוך דקות. ה-fanout service בעל 10 workers מתמודד עם backlog של שעות. בינתיים, 400 מיליון משתמשים לא רואים את הפוסט. זה קרה לTwitter בגדול ב-2012.

הפתרון ה-hybrid אינו ניחוש: סף 1M עוקבים מזהה ~100 celebrities מתוך 300M משתמשים. עבור 100 celebrities, pull בזמן קריאה = 100 שאילתות Redis נוספות לכל פתיחת פיד של כל משתמש שעוקב עליהם. עלות קטנה ומוגבלת.

## טעויות נפוצות

1. **fanout on read בלי cache**: אם למשתמש יש 5,000 follows, כל פתיחת פיד = 5,000 שאילתות ל-Cassandra. בראיון זה נשמע "פשוט", בפועל זה `Read QPS × avg_follows = 174,000 × 500 = 87M queries/sec`. לא סביר.

2. **שמירת תוכן הפוסט ב-feed cache**: feed cache אמור להחזיק רק post_ids. תוכן הפוסט (תמונות, טקסט, URLs) חי בנפרד ב-CDN / Post cache. ערבוב מגדיל Redis פי 20 לפחות.

3. **follows ב-MySQL עם JOIN בזמן fanout**: `SELECT follower_id FROM follows WHERE followee_id = ?` על טבלה של מיליארד שורות עם B-tree הוא O(log N) לכל שאילתה. בfanout של כל פוסט, זה create lock contention חמור. Redis set של follow lists ל-hot users הוא הפתרון.

4. **חושבים ש-notification חייבת להיות synchronous**: אם ה-notification service נופל, הפוסט לא יוצא? לא. notification רצה ב-Message Queue נפרד ביחד עם fanout. כשל ב-notification לא חוסם את פרסום הפוסט.

5. **שוכחים שסנכרון הצמתים של feed cache צריך consistency model**: fanout service כותב לN Redis nodes; משתמש שמחובר לnode שונה עדיין לא רואה פוסט. eventual consistency מקובל בפיד (latency של שניות בסדר); strong consistency לא נדרש ולא שווה את המחיר.

## מתי זה לא משנה

לאפליקציה עם פחות מ-10,000 משתמשים פעילים ביום, DB פשוט עם sorted index על `created_at` וjoin פשוט מספיק. אין צורך ב-Message Queue, fanout service, Redis cluster, או celebrity threshold.

בראיון, זו שאלה קלאסית ל-M3. הראיין מצפה: back-of-envelope עם Read:Write QPS, שתי הזרימות (publish ו-read), fanout strategy עם הסבר על celebrities, cache וschema בסיסי. hybrid fanout ו-notification queue הם bonus. עצירה ב-"פשוט נשמור הכל ב-MySQL" היא תקלה.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`).

**מה זה מאפשר**:
- **m3-message-queue**: fanout service מסתמך על message queue; ההמשך מסביר את ה-internals
- **m3-notification-system**: שכבת ה-notification מחוברת ישירות לפרסום פיד
- **m3-metrics-monitoring**: fanout pipeline הוא use case קלאסי למוניטורינג של throughput וlatency

```quiz
{"id":"u-m3-news-feed-q1","tree":"systems","skill":"system-design","q":"מדוע מערכת פיד חדשות בסדר גודל של Twitter משתמשת ב-hybrid fanout ולא ב-fanout on write לכולם?","options":["כי Redis לא תומך ב-fanout on write","כי celebrity עם מיליוני עוקבים גורמת למיליוני כתיבות מקבילות ומציפה את ה-fanout service","כי fanout on write דורש SQL ולא עובד עם Cassandra","כי pull מהיר יותר מ-push בכל מקרה"],"answer":1,"explain":"fanout on write ל-celebrity עם 400M עוקבים = 400 מיליון כתיבות ב-Redis תוך דקות. ה-fanout service נחנק ומייצר backlog של שעות. hybrid fanout פותר זאת: משתמשים רגילים מקבלים push, celebrities מדולגים ומוצגים דרך pull בזמן קריאה. עלות ה-pull קטנה כי יש מעט celebrities."}
```

```fillin
{"id":"u-m3-news-feed-q2","tree":"systems","skill":"system-design","prompt":"יחס קריאה/כתיבה בפיד חדשות כמו Twitter (100 גלילות ו-2 פוסטים ביום לכל משתמש פעיל) הוא בערך כמה?","answer":"50","alt":["50:1","כ-50","חמישים לאחד","~50"],"explain":"Read QPS = 150M × 100 / 86400 ≈ 174,000. Write QPS = 150M × 2 / 86400 ≈ 3,500. יחס ≈ 50:1. פיד הוא read-heavy בקיצוניות, ולכן cache הוא ההשקעה הנכונה, לא אופטימיזציה של writes."}
```

```concepts
{"items":[{"id":"news-feed","t":"News Feed","he":"פיד חדשות","d":"רצף פוסטים ממשתמשים שעוקבים אחריהם, ממוין לפי אלגוריתם או זמן","rel":["fanout-on-write","fanout-on-read","hybrid-fanout"],"node":"sysdesign"},{"id":"fanout-on-write","t":"Fanout on Write","he":"פיזור בזמן כתיבה","d":"בפרסום פוסט, המערכת כותבת את post_id לתיבות כל עוקביו. קריאה מהירה, כתיבה כבדה","rel":["news-feed","fanout-on-read","celebrity-problem"],"node":"sysdesign"},{"id":"fanout-on-read","t":"Fanout on Read","he":"פיזור בזמן קריאה","d":"בפתיחת פיד, שואלים בזמן אמת מי עוקבים ומביאים פוסטים. כתיבה קלה, קריאה כבדה","rel":["news-feed","fanout-on-write","hybrid-fanout"],"node":"sysdesign"},{"id":"hybrid-fanout","t":"Hybrid Fanout","he":"פיזור היברידי","d":"push למשתמשים רגילים, pull ל-celebrities מעל סף עוקבים. מאזן עלויות כתיבה וקריאה","rel":["fanout-on-write","fanout-on-read","celebrity-problem"],"node":"sysdesign"},{"id":"celebrity-problem","t":"Celebrity Problem","he":"בעיית הסלבריטי","d":"משתמש עם מיליוני עוקבים שמפרסם גורם למיליוני כתיבות מקבילות ומציף את ה-fanout service","rel":["hybrid-fanout","fanout-on-write"],"node":"sysdesign"},{"id":"social-graph-feed","t":"Social Graph","he":"גרף חברתי","d":"מבנה nodes=משתמשים ו-edges=follows. מאוחסן ב-graph DB או Redis sets ל-hot users","rel":["news-feed","fanout-on-write"],"node":"sysdesign"}]}
```

<!-- audited -->