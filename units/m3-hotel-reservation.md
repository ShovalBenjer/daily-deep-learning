# מערכת הזמנות מלון

כששני אורחים מנסים לתפוס את החדר האחרון ברגע אחד, בדיוק ה-database transaction מכריע מי מקבל אישור ומי מקבל שגיאה.

## מה תדע בסוף

לתכנן מערכת הזמנות מלון ברמת ראיון בכיר: להגדיר דרישות ולהעריך קנה מידה; לתאר data model, API ואסטרטגיית cache; ולהסביר כיצד DB transaction אטומי עם תנאי עדכון מונע double booking תחת עומס גבוה.

## האינטואיציה

דמיין מלתחה עם אמא שמנהלת ספר כחול. בספר כתוב כמה מעילים יש בכל מידה. כשלקוח רוצה מעיל, היא בודקת את הספר, מורידה 1 ומוסרת את המעיל בפעולה אחת. אם שני לקוחות באים ביחד, היא מטפלת בהם בתור: הראשון מקבל, השני שומע "אין יותר".

**room_inventory, מלאי חדרים** הוא אותו ספר כחול. כל שורה בטבלה היא חדר ביום: `(hotel_id, room_type_id, date)`. הפעולה "בדיקה + הורדה" חייבת להיות אטומית, אחרת שני לקוחות יקראו "1 פנוי" ושניהם יתקדמו לתפוס.

## ההגדרות המדויקות

### דרישות פונקציונליות

- חיפוש מלונות לפי עיר, תאריכים ומספר אורחים
- צפייה בחדרים ובמחירים
- הזמנת חדר ותשלום
- ביטול הזמנה וצפייה בהיסטוריית הזמנות

### דרישות לא פונקציונליות

- **אין double booking**: עדיפות לעקביות על פני זמינות כשמדובר בהזמנה
- **חיפוש מהיר**: זמן תגובה מתחת ל-500ms ל-99 אחוז מהבקשות
- **גודל**: 10 מיליון DAU, 5 מיליון מלונות, 1 מיליון חדרים

### הערכת גדלים (back-of-envelope)

```
10M DAU × 10% מבצעים הזמנה = 1M הזמנות ביום

write QPS:  1,000,000 / 86,400 ≈ 12 כתיבות/שנייה
read QPS:   10,000,000 × 10 פעולות / 86,400 ≈ 1,160 קריאות/שנייה

גודל הזמנה: ~500 bytes
אחסון שנתי: 1M × 365 × 500 ≈ 182 GB/שנה (קטן, DB יחיד מספיק לשנים)
```

### Data model

**`hotels`**: מידע סטטי של המלון

```sql
CREATE TABLE hotels (
  id          BIGINT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  star_rating TINYINT,
  description TEXT
);
```

**`room_types`**: סוג חדר (standard, deluxe, suite) ברמת מלון

```sql
CREATE TABLE room_types (
  id          BIGINT PRIMARY KEY,
  hotel_id    BIGINT NOT NULL REFERENCES hotels(id),
  name        VARCHAR(100),
  capacity    SMALLINT,
  price_night DECIMAL(10,2)
);
```

**`room_inventory`**: כמה חדרים מסוג X פנויים ביום D

```sql
CREATE TABLE room_inventory (
  hotel_id         BIGINT,
  room_type_id     BIGINT,
  date             DATE,
  total_inventory  SMALLINT NOT NULL,
  reserved_count   SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (hotel_id, room_type_id, date)
);
```

**`reservations`**: הזמנה מאושרת

```sql
CREATE TABLE reservations (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id          BIGINT NOT NULL,
  hotel_id         BIGINT NOT NULL,
  room_type_id     BIGINT NOT NULL,
  check_in_date    DATE NOT NULL,
  check_out_date   DATE NOT NULL,
  status           ENUM('PENDING','PAID','CANCELLED','REJECTED') DEFAULT 'PENDING',
  total_price      DECIMAL(12,2),
  idempotency_key  VARCHAR(64) UNIQUE,
  created_at       TIMESTAMP DEFAULT NOW()
);
```

### API

```
GET  /hotels?city=TLV&checkin=2026-12-01&checkout=2026-12-03&guests=2
     → רשימת מלונות עם זמינות וסכום ללילה

GET  /hotels/{id}/rooms?checkin=...&checkout=...
     → רשימת room_types עם מחיר וזמינות

POST /reservations
     body: { hotel_id, room_type_id, check_in_date, check_out_date, idempotency_key }
     → { reservation_id, status: "PENDING" }

DELETE /reservations/{id}
     → { status: "CANCELLED" }

GET  /reservations/{id}
     → פרטי הזמנה מלאים
```

**idempotency_key, מפתח אידמפוטנטיות**: מחרוזת ייחודית שהלקוח מייצר לפני הבקשה (UUID). אם הרשת נפסקת ו-retry נשלח, השרת מחזיר את אותה תשובה מבלי ליצור הזמנה כפולה.

### מניעת double booking

הבעיה: שני users קוראים `reserved_count = 4`, `total_inventory = 5`, שניהם מחליטים שיש מקום ומנסים להוסיף הזמנה. בלי הגנה, שניהם מצליחים ו-`reserved_count` מגיע ל-6.

**פתרון: UPDATE אטומי עם תנאי**

```sql
BEGIN;

-- שלב 1: תפוס שורות עבור כל התאריכים בין check_in ל-check_out (exclusive)
UPDATE room_inventory
SET    reserved_count = reserved_count + 1
WHERE  hotel_id      = :hotel_id
  AND  room_type_id  = :room_type_id
  AND  date >= :check_in_date
  AND  date  < :check_out_date
  AND  reserved_count < total_inventory;  -- ← תנאי המניעה

-- שלב 2: בדוק כמה שורות עודכנו
-- אם (check_out - check_in) ימים עודכנו: הצלחה
-- אם פחות: חלק מהתאריכים תפוסים, ROLLBACK

INSERT INTO reservations (user_id, hotel_id, room_type_id,
  check_in_date, check_out_date, status, total_price, idempotency_key)
VALUES (:uid, :hotel_id, :room_type_id,
  :check_in, :check_out, 'PENDING', :price, :key);

COMMIT;
```

ה-DB מריץ את ה-UPDATE אטומית בכל שורה. אם user_A ו-user_B רצים במקביל, הראשון שמגיע ל-row lock מצליח; השני מחכה, מקבל את השורה המעודכנת ורואה `reserved_count = total_inventory`, ולכן 0 שורות מתעדכנות. Transaction שלו עושה ROLLBACK.

### אסטרטגיית cache

| מידע | אסטרטגיה | נימוק |
|---|---|---|
| פרטי מלון (שם, תיאור, כתובת) | Redis TTL 24h + CDN | סטטי, עדכון נדיר |
| תמונות חדרים | CDN | binary assets |
| תוצאות חיפוש | Redis TTL 5 min | אפשר staleness קל |
| זמינות חדרים לאישור הזמנה | ללא cache | consistency חובה |

**כלל ברזל**: זמינות ל-booking path תמיד מה-DB primary, אף פעם לא מ-cache.

## דוגמה מחושבת

משתמש מזמין חדר Deluxe ב-Dan Tel-Aviv, 2 לילות (1 עד 3 בדצמבר).

```
check_in_date:  2026-12-01
check_out_date: 2026-12-03
לילות: 2 → שורות שצריך לעדכן ב-room_inventory: 2026-12-01 ו-2026-12-02
```

**לפני:**

| date       | total_inventory | reserved_count |
|------------|----------------|----------------|
| 2026-12-01 | 3              | 2              |
| 2026-12-02 | 3              | 3              |

**ריצת UPDATE:**

```sql
UPDATE room_inventory
SET reserved_count = reserved_count + 1
WHERE hotel_id = 42 AND room_type_id = 7
  AND date >= '2026-12-01' AND date < '2026-12-03'
  AND reserved_count < total_inventory;
```

שורה 2026-12-01: `reserved_count (2) < total_inventory (3)` → מתעדכן ל-3.

שורה 2026-12-02: `reserved_count (3) < total_inventory (3)` → FALSE, לא מתעדכן.

`rowsAffected = 1`, אבל צריך `2`. השרת מזהה חוסר ועושה ROLLBACK.

**תשובה ללקוח**: "אין זמינות לתאריך 02/12, בחר תאריכים אחרים או חדר אחר."

## המקרה שמפיל את האינטואיציה

"נשתמש ב-distributed lock ב-Redis: נועל את `room:{hotel_id}:{room_type_id}:{date}` לפני שמבצעים את העדכון ב-DB."

**הבעיה:** Redis lock ו-DB transaction הם שתי מערכות שונות. אם השרת קורס לאחר שהחדר עודכן ב-DB אבל לפני ש-Redis lock שוחרר, החדר נשאר "נעול" ב-Redis עד לפקיעת TTL (ואם ה-TTL ארוך, החדר יהיה "חסום" לשיקרא למשך שעות). גרוע יותר: אם Redis קורס בזמן שה-lock מוחזק ומגיע re-election, ייתכן ששני לקוחות ירכשו lock בו-זמנית (תרחיש GC pause ב-lock holder).

**הפתרון הנכון:** ה-DB עצמו הוא מנגנון ה-locking. ה-UPDATE האטומי עם תנאי `reserved_count < total_inventory` לא צריך Redis; ה-row lock של הDB מונע race condition ב-DB level.

Redis lock מתאים לתרחישים שמחוץ ל-DB (לדוגמה: מניעת ריצה כפולה של batch job). עבור inventory, DB transaction מספיק ועדיף.

## טעויות נפוצות

1. **שימוש ב-DATETIME במקום ב-DATE לתאריכי check-in/check-out**: "1 בדצמבר ב-23:59" ו-"2 בדצמבר ב-00:01" הם לילה אחד. מלונות מוכרים לפי לילה, לא שעות. DATETIME גורמת לבאגים בחישוב מחיר ובחפיפות.

2. **עדכון `reserved_count` ישירות בלי תנאי**: `SET reserved_count = reserved_count + 1` ללא `WHERE reserved_count < total_inventory` מאפשר overbooking. זה הבאג הקלאסי.

3. **חוסר idempotency**: הלקוח שולח שוב אחרי timeout. בלי `idempotency_key UNIQUE`, נוצרת הזמנה כפולה. עם unique constraint, ה-DB זורק duplicate error והשרת מחזיר את ההזמנה המקורית.

4. **PENDING reservations בלי timeout**: אם תהליך התשלום נגמר ולקוח לא סיים, `reserved_count` נשאר גבוה. צריך background job שמבצע ROLLBACK ל-PENDING ישנים (לאחר 10 דקות): `UPDATE reservations SET status='REJECTED'` ואז `UPDATE room_inventory SET reserved_count = reserved_count - 1`.

5. **cache של זמינות ב-booking path**: כתוב למעלה כלל ברזל, חוזר כאן כי זו הטעות הנפוצה ביותר בראיון. Cache יתן staleness; booking path חייב לקרוא מה-primary.

## מתי זה לא משנה

**מלון קטן עם אתר פנימי** (50 חדרים, מאה הזמנות ביום): DB יחיד עם בדיקה פשוטה ו-lock at application level (mutex) יספיק. אין צורך ב-room_inventory table נפרד, optimistic locking, background job לPENDING, או Redis.

**בראיון**: כשמועמד מתחיל בגדלים ומגיע ל-12 כתיבות/שנייה, הראיין יודע שה-DB יחיד מספיק. הערך של הדיון הוא להראות שאתה מבין את trade-off עקביות מול זמינות ומדוע room_inventory חייב להיות consistent. Overbooking prevention הוא הנושא המרכזי; scaling reads הוא secondary.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`). מניחה היכרות עם `m3-back-of-envelope`, `m3-interview-framework` ו-`m3-consistent-hashing`.

**מה זה מאפשר**:
- **m3-payment-system**: מערכת תשלום דורשת אותם עקרונות idempotency ו-PENDING → PAID flow
- **m3-digital-wallet**: wallet transaction כמו הזמנה: חייב להיות atomic, ללא double debit
- **m3-distributed-email**: confirmation email לאחר הזמנה מסופקת דרך notification service דומה

```quiz
{"id":"u-m3-hotel-reservation-q1","tree":"systems","skill":"system-design","q":"מה מונע double booking בתכנון מערכת הזמנות מלון?","options":["Redis distributed lock שנועל את החדר לאורך כל תהליך ההזמנה","UPDATE אטומי ב-DB עם תנאי reserved_count < total_inventory שגורם ל-0 שורות מעודכנות אם אין מקום","בדיקת זמינות ב-cache לפני פתיחת ה-transaction","unique constraint על reservation_id בלבד"],"answer":1,"explain":"ה-UPDATE עם תנאי הוא הפתרון הנכון: אם אין מקום, 0 שורות מתעדכנות ואפשר לעשות ROLLBACK. Redis lock אינו אטומי עם ה-DB ועלול להיכשל בקריסת שרת. cache לא מתאים ל-booking path כי נותן מידע לא עדכני."}
```

```fillin
{"id":"u-m3-hotel-reservation-f1","tree":"systems","skill":"system-design","prompt":"בטבלת room_inventory, UPDATE שמוסיף הזמנה צריך לכלול בתנאי: reserved_count ___ total_inventory","answer":"<","alt":["קטן מ","< total_inventory","smaller than"],"explain":"התנאי reserved_count < total_inventory מבטיח שהעדכון מתבצע רק אם יש עוד מקום. אם reserved_count שווה ל-total_inventory, התנאי שקרי, 0 שורות מתעדכנות, והשרת יודע שהחדר מלא."}
```

```concepts
{"items":[{"id":"room-inventory","t":"Room Inventory","he":"מלאי חדרים","d":"טבלת (hotel_id, room_type_id, date) שעוקבת אחר זמינות חדרים ליום ספציפי","rel":["double-booking","optimistic-locking-db"],"node":"sysdesign"},{"id":"double-booking","t":"Double Booking","he":"הזמנה כפולה","d":"שני לקוחות שמצליחים להזמין את אותו חדר ביום אחד בגלל race condition","rel":["room-inventory","optimistic-locking-db"],"node":"sysdesign"},{"id":"optimistic-locking-db","t":"Optimistic Locking (DB)","he":"נעילה אופטימיסטית בבסיס נתונים","d":"UPDATE אטומי עם תנאי מונע race condition בלי lock מפורש","rel":["double-booking","room-inventory"],"node":"sysdesign"},{"id":"idempotency-key","t":"Idempotency Key","he":"מפתח אידמפוטנטיות","d":"UUID שהלקוח שולח כדי למנוע יצירת כפילות ב-retry; מאוחסן עם UNIQUE constraint","rel":["double-booking"],"node":"sysdesign"},{"id":"pending-reservation-timeout","t":"Pending Reservation Timeout","he":"פקיעת הזמנה ממתינה","d":"background job שמבטל הזמנות PENDING ישנות ומשחרר inventory לאחר timeout","rel":["room-inventory","double-booking"],"node":"sysdesign"}]}
```
