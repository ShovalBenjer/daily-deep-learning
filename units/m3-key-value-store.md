# מאגר מפתח-ערך
בכל פעם שאפליקציה צריכה לשמור session של משתמש ולמשוך אותה ב-1ms, היא משתמשת במאגר מפתח-ערך ולא ב-SQL.

## מה תדע בסוף

לתאר את הארכיטקטורה של מאגר מפתח-ערך מבוזר: איך נתונים מתפרסים בין nodes בעזרת consistent hashing, איך replication מגן על נתונים בכשל, ואיזה trade-offs מכתיב CAP theorem בין עקביות וזמינות.

## האינטואיציה

מאגר מפתח-ערך הוא ספר טלפונים ענק. שם (key) מצביע על מספר (value). מחפש שם, מקבל מספר. מחפש שם שאינו קיים, מקבל "לא קיים". זהו.

כל השאר בunit זה הוא תשובה לשאלה: מה קורה כשספר הטלפונים גדל מ-1 ספר על השולחן לדסק ספריות שפרוס על פני עשר ערים?

אם שרת אחד מחזיק 100 GB נתונים ונופל, כל ה-data נעלמת. הפתרון הוא לפצל: כל שרת מחזיק חלק, ולכל חלק יש עוד כמה עותקים. אבל ריבוי עותקים יוצר שאלה: מה קורה כשעותק A ועותק B מחזיקים גרסאות שונות של אותו key?

## ההגדרות המדויקות

### API בסיסי

**Key-value store, מאגר מפתח-ערך** מגדיר שלוש פעולות:

- `put(key, value)`: מאחסן ערך תחת מפתח
- `get(key)`: מחזיר ערך לפי מפתח, או null אם לא קיים
- `delete(key)`: מסיר זוג

`key` הוא מחרוזת ייחודית. `value` יכול להיות כל דבר: string, JSON, bytes. המאגר לא מפרש את המבנה הפנימי של ה-value. זה מה שמבדיל אותו מ-SQL: אין schema, אין joins, אין queries על שדות פנימיים.

דוגמאות לyielded products: Redis, Memcached, DynamoDB (AWS), Cassandra.

### מהשרת היחיד למבוזר

**שרת יחיד**: hash table בזיכרון (RAM). גישה ב-\(O(1)\). בעיה אחת: RAM מוגבל. בעיה שנייה: שרת יחיד הוא **single point of failure, נקודת כשל יחידה**.

**Sharding, פיצול**: מפצלים את ה-keyspace בין שרתים. אבל איך? פיצול פשוט `key_hash % N` שובר הכל כשמוסיפים שרת, כי `N` משתנה ו-90% מה-keys עוברים לשרת אחר.

**Consistent hashing, גיבוב עקבי** (ראה unit נפרד) פותר את זה. ממפים שרתים ו-keys לטבעת מספרית. הוספת שרת זזה רק \(\frac{1}{n}\) מה-keys, לא את כולם.

```
Ring [0 ... 360]:
  Node A: 0-120
  Node B: 120-240
  Node C: 240-360

  key "session:abc" → hash → 170 → Node B
  key "session:xyz" → hash → 300 → Node C
```

### Replication, שכפול

כל key נשמר ב-**N** שרתים (בדרך כלל N=3). ה-node "הבעלים" (primary) ממלא גם את שני ה-replicas הבאים עליו ב-ring.

אם Node B נופל, Node A ו-Node C עדיין מחזיקים את הנתונים של `session:abc`.

**Replication factor, גורם שכפול**: ה-N בהגדרה. N=1 אין הגנה. N=3 סטנדרט. N=5 לנתונים קריטיים.

### Consistency models, מודלי עקביות

כאשר N=3, כמה שרתים חייבים לאשר פעולה לפני שחוזרים ל-client?

- **W** (write quorum, מניין כתיבה): מספר אישורי כתיבה הנדרשים.
- **R** (read quorum, מניין קריאה): מספר שרתים שחייבים להסכים בקריאה.

**כלל ה-quorum**: אם \(W + R > N\), מובטח שקריאה תמצא לפחות replica אחת עם הנתון העדכני. זו **strong consistency, עקביות חזקה**.

דוגמה: N=3, W=2, R=2. \(2+2=4>3\). כל קריאה חופפת לפחות replica שהכתיבה עברה דרכה.

אם \(W + R \leq N\), יתכנו קריאות שמחזירות ערך ישן. זו **eventual consistency, עקביות סופית**. לרוב מהירה יותר.

### CAP theorem, משפט CAP

**CAP theorem** קובע שמערכת מבוזרת יכולה להבטיח שניים בלבד מתוך שלושה:

- **C** (Consistency, עקביות): כל קריאה מחזירה את הכתיבה האחרונה.
- **A** (Availability, זמינות): כל בקשה מקבלת תשובה (גם אם לא עדכנית לחלוטין).
- **P** (Partition tolerance, סובלנות לפיצול): המערכת ממשיכת לפעול גם כשיש network partition (חלק מה-nodes לא מדברים זה עם זה).

בפועל, P חובה: network partitions קורות. לכן הבחירה היא **CP** לעומת **AP**:

- **CP**: עדיפות לעקביות. קריאה עשויה לחכות עד שכל replicas מסכימות. אם partition, מעדיף להחזיר שגיאה ולא נתון ישן. דוגמה: etcd, ZooKeeper.
- **AP**: עדיפות לזמינות. מחזיר תשובה מיד, עלולה להיות ישנה. דוגמה: Cassandra, DynamoDB (בmode רגיל).

### גישת כתיבה וקריאה

**Write path, נתיב כתיבה**:

1. Client שולח `put(key, value)` ל-coordinator (שרת כלשהו שמתפקד כ-proxy)
2. Coordinator מחשב על-פי consistent hashing אילו N nodes אחראים
3. שולח כתיבה ל-N nodes במקביל
4. ממתין ל-W אישורים
5. מחזיר OK ל-client. שאר ה-replicas יתעדכנו ברקע.

**Read path, נתיב קריאה**:

1. Coordinator שולח בקשה ל-R nodes
2. אם R>1, משווה versions ובוחר העדכני
3. מחזיר ל-client

### זיהוי כשלים: gossip protocol, פרוטוקול רכילות

כיצד Node A יודע ש-Node B נפל? אם שואל ישירות ולא מקבל תשובה, אולי B נפל ואולי יש network issue ביניהם.

**Gossip protocol**: כל node שומר רשימה של כל ה-nodes עם timestamp "ראיתי-אותו-לאחרונה". כל כמה שניות, כל node בוחר node אחר אקראי ומחליף עדכוני בריאות. חדשות על כשל מתפשטות ב-\(O(\log N)\) סבבים בלי coordinator מרכזי.

### Hinted handoff וSloppy quorum

**Sloppy quorum, מניין רך**: אם node אחראי לא זמין, coordinator שולח את הכתיבה ל-node אחר זמני כדי לעמוד ב-W.

**Hinted handoff, מסירה מוסווית**: ה-node הזמני מוסיף לכתיבה "hint" שמציין: "שלח את הנתון הזה ל-Node B כשהוא חוזר". כשB חוזר לאוויר, הנתון מועבר אליו אוטומטית.

### Vector clocks וקונפליקטים

שני clients כותבים לאותו key במקביל ל-replicas שונות:

```
Client A: put(user:5, {name: "שרה"}) → Node 1
Client B: put(user:5, {name: "Sara"}) → Node 2
```

שתי הכתיבות הצליחו (W=1). Node 1 ו-Node 2 מחלוקים.

**Vector clock, שעון וקטורי** הוא מנגנון שמאפשר לזהות "מי קדם למי" ללא שעון גלובלי. כל value נישא עם vector שמציין מספר גרסה לכל node. אם הסדר ברור, הגרסה החדשה "מנצחת". אם אין סדר ברור, עולה conflict.

בפועל, רוב מימושים בוחרים **last write wins**: ה-timestamp עצמו מכריע. פשוט, אבל עלול לאבד נתונים בconcurrent writes.

## דוגמה מחושבת

**מקרה**: session cache ל-100 מיליון משתמשים פעילים.

דרישות:
- `get(session_id)` חייב להחזיר תשובה ב-10ms
- כתיבה: 1 מיליון sessions ביום (כניסות חדשות)
- גודל session: 2 KB
- שמירה 7 ימים (TTL=604800 שניות)

**הערכת גודל**:
\[1M \times 2\text{ KB} \times 7 = 14\text{ GB}\]

עם N=3 (כל session ב-3 nodes):
\[14 \times 3 = 42\text{ GB סה"כ אחסון}\]

שלושה nodes עם 16 GB RAM כל אחד = 48 GB capacity. מספיק.

**בחירת W ו-R**: session לא קריטי לstrong consistency. אם משתמש מקבל session ישן ב-100ms, העולם לא נגמר. בחירה: W=1, R=1, eventual consistency.

**Write path ל-`session:abc123`**:
1. `hash("session:abc123") = 0x7A3F` → נופל על Node 2
2. Coordinator שולח כתיבה ל-Node 2, Node 3, Node 1 (N=3)
3. Node 2 מאשר (W=1). מחזיר OK. ב-2ms.
4. Node 3 ו-Node 1 מתעדכנים ברקע ב-10ms.

**כשל**: Node 2 נופל.
1. Gossip protocol מזהה תוך 10 שניות
2. קריאות ל-`session:abc123` מופנות ל-Node 3 (sloppy quorum)
3. כתיבות חדשות הולכות ל-Node 3 עם hint "העבר ל-Node 2"
4. כשNode 2 חוזר, Node 3 מעביר לו את ה-sessions שנכתבו בזמן הכשל

## המקרה שמפיל את האינטואיציה

**בנק ו-eventual consistency**: מישהו מחליט להשתמש ב-key-value store עם W=1 לחשבון בנק:

```
put("balance:user5", 1000)
```

שני ATM מבצעים משיכה במקביל:

```
ATM A: get("balance:user5") → 1000. put("balance:user5", 700)  
ATM B: get("balance:user5") → 1000. put("balance:user5", 800)
```

עם eventual consistency, שתי הכתיבות "מצליחות". last write wins בוחר 800. המשתמש משך 300 שקל ו-200 שקל אבל המאזן הסופי 800 במקום 500. הבנק הפסיד 300 שקל.

זו לא כשל במימוש. זו תוצאה מובנת של AP בבעיה שדורשת CP. transactions פיננסיות דורשות strong consistency וatomic operations. SQL ו-ACID databases נולדו לזה.

## טעויות נפוצות

1. **key-value store לנתונים relational**: "מצא את כל ה-sessions של משתמש 5" דורש secondary index נפרד. key-value store לא "יודע" מה בתוך ה-value. SQL עושה זה אוטומטית.

2. **הנחה שeventual consistency תמיד בסדר**: בחשבון בנק, בspotify play count, בkafka offsets, עקביות חזקה לפעמים הכרחית.

3. **שכחת TTL**: בלי TTL (Time To Live), sessions ישנים לא נמחקים. ה-store מתמלא. `put(key, val, ttl=86400)` הוא חלק מה-API.

4. **key ארוך מאוד**: key של 1 MB עם value של 10 bytes הוא עיצוב שגוי. key צריך להיות קצר ו-unique: UUID, integer id, או compound key בסגנון `entity_type:id:field`.

5. **N=1 ב-production**: שרת יחיד ב-production ללא replication הוא single point of failure. נפל השרת, נגמרה הזמינות. N=3 לפחות.

## מתי זה לא משנה

**SQL מתאים יותר כאשר**:
- נדרשות queries על fields פנימיים ("כל sessions שנוצרו ב-24 השעות האחרונות")
- נדרשות multi-key transactions: "העבר 500 שקל מחשבון A לB atomically"
- הנתונים strongly relational: users, orders, products עם joins
- Scale קטן (מתחת ל-GB) ששרת יחיד מספיק

**בראיון**: כאשר שואלים "למה לא SQL?", תשובה מדויקת: "SQL מצטיין בqueries מורכבות ובtransactions. כאן צריכים latency של 1ms ל-simple reads בscale של מיליארד keys. Key-value store מייעל לזה. המחיר: לא ניתן לשאול 'כל users שנרשמו ב-2024' בלי secondary index נפרד."

## חיבור

unit זה שייך לblock M3 של system design. הוא מתבסס על:

- **מסגרת הראיון** (`m3-interview-framework`): Step 1 של requirements gathering ו-Step 3 של deep dive חלים כאן ישירות
- **Consistent hashing** (`m3-consistent-hashing`): מנגנון ה-partition של key-value store מבוזר

הunit פותח:
- **Message queue** (`m3-message-queue`): בנוי על אותה ארכיטקטורה מבוזרת עם replication
- **שרת back-of-envelope** (`m3-back-of-envelope`): הערכות גודל כמו חישוב ה-42 GB למעלה

```quiz
{"id":"u-m3-key-value-store-q1","tree":"systems","skill":"system-design","q":"מאגר מפתח-ערך מוגדר עם N=3, W=2, R=2. האם מובטחת strong consistency?","options":["כן, כי W+R=4 גדול מ-N=3, ולכן כל קריאה תפגוש לפחות replica אחת עם הנתון העדכני","לא, כי vector clocks לא הופעלו","כן, אבל רק אם gossip protocol פועל","לא, CAP theorem אוסר strong consistency בכל מצב"],"answer":0,"explain":"הכלל הוא W+R > N. כאן 2+2=4 > 3, ולכן כל קריאה חופפת לפחות replica אחת שה-write עבר דרכה. זה מבטיח שהערך המוחזר הוא העדכני ביותר. CAP theorem לא אוסר strong consistency, הוא אומר שב-partition צריך לבחור בין C ל-A."}
```

```quiz
{"id":"u-m3-key-value-store-q2","tree":"systems","skill":"system-design","q":"באיזה תרחיש key-value store עדיף על SQL?","options":["אחסון פרופיל משתמש עם שדות name, email, address","caching של session tokens עם TTL של 24 שעות","מעקב אחר transactions בנקאיות שחייבות להיות ACID","חישוב כמות ההזמנות לכל לקוח בחודש האחרון"],"answer":1,"explain":"Session cache הוא use case קלאסי ל-key-value store: key פשוט (session_id), value אטומי (blob), TTL טבעי, latency קריטי, ואין צורך ב-queries על תוכן ה-value. כל שאר האפשרויות דורשות relational queries, ACID transactions, או joins שSQL מוצלח בהם הרבה יותר."}
```

```concepts
{"items":[{"id":"c-cap-theorem","t":"CAP theorem","he":"משפט CAP","d":"מערכת מבוזרת יכולה להבטיח שניים בלבד: Consistency, Availability, Partition tolerance","rel":["c-consistent-hashing","c-kv-consistency"],"node":"sysdesign"},{"id":"c-gossip-protocol","t":"Gossip protocol","he":"פרוטוקול רכילות","d":"מנגנון לזיהוי כשלים מבוזר: כל node מחליף עדכוני בריאות עם node אקראי כל כמה שניות","rel":["c-cap-theorem"],"node":"sysdesign"},{"id":"c-hinted-handoff","t":"Hinted handoff","he":"מסירה מוסווית","d":"node זמני שומר write עם hint, ומעביר לnode האחראי כשחוזר לאוויר","rel":["c-sloppy-quorum"],"node":"sysdesign"},{"id":"c-vector-clock","t":"Vector clock","he":"שעון וקטורי","d":"מנגנון לזיהוי סדר אירועים ב-distributed system ללא שעון גלובלי","rel":["c-cap-theorem"],"node":"sysdesign"},{"id":"c-sloppy-quorum","t":"Sloppy quorum","he":"מניין רך","d":"שליחת write לnode זמני זמין במקום node האחראי שנפל, כדי לשמור על availability","rel":["c-hinted-handoff","c-cap-theorem"],"node":"sysdesign"},{"id":"c-kv-consistency","t":"Quorum consistency","he":"עקביות מניין","d":"W+R>N מבטיח strong consistency; W+R<=N מאפשר eventual consistency","rel":["c-cap-theorem"],"node":"sysdesign"}]}
```

<!-- widget-request: ring: consistent-hashing ring showing key-to-node mapping with N=3 replication as nodes are added or removed -->
