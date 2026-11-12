# תכנון Google Drive

כל קובץ שאתה מעלה ל-Drive מחולק לחתיכות, מדדוס בנפרד, ומוצפן לפני שהוא נוגע בדיסק; כך 2 מיליארד משתמשים ו-2 פטאבייט נוספים ביום נשמרים בלי לאבד בייט אחד.

## מה תדע בסוף

לתכנן שירות אחסון קבצים ברמת ראיון בכיר: לגזור back-of-envelope עם QPS ואחסון; לתאר ארכיטקטורת block storage עם metadata DB נפרד; להסביר מדוע chunking + delta sync חוסכים עד 90% מהתעבורה; ולנמק את פתרון conflict resolution בשיטת last-write-wins לעומת CRDT.

## האינטואיציה

דמיין ספרייה ציבורית עם שני מדלפקים נפרדים: מדלפק קטלוג (יודע היכן כל ספר) ומחסן ספרים (מחזיק את הדפים עצמם). כשאתה מחפש ספר אתה פונה לקטלוג; כשאתה רוצה לקרוא אתה הולך למחסן.

Google Drive עובד בדיוק כך:

- **Metadata DB, בסיס נתוני מטאדטה**: שם הקובץ, גודל, בעלים, הרשאות, היסטוריית גרסאות. מסד נתוני SQL מהיר לחיפוש.
- **Block storage, אחסון בלוקים**: תוכן הקובץ בפועל, מחולק לחתיכות ומאוחסן ב-object storage (S3-compatible). הנתונים כבדים; הקטלוג קל.

ההפרדה היא המפתח לסקייל.

## ההגדרות המדויקות

**File chunking, חלוקת קבצים לחתיכות**: קובץ של 100 MB מחולק ל-50 chunks בני 2 MB כל אחד. כל chunk מקבל hash (SHA-256). אם השתנה רק chunk אחד, רק אותו chunk עולה מחדש.

**Block server, שרת בלוקים**: שרת ביניים שמקבל את הקובץ מהלקוח, מחלק אותו ל-chunks, מחשב hash לכל chunk, ומעביר ל-object storage. הלקוח לא כותב ישירות ל-storage.

**Metadata server, שרת מטאדטה**: API layer לעדכון ה-metadata DB. מנהל גרסאות ורשאויות, שולח notifications לקיינטים אחרים שצריכים לסנק.

**Delta sync, סינכרון דיפרנציאלי**: במקום להעלות את הקובץ כולו בכל שינוי, הלקוח מחשב אילו chunks השתנו על פי hash ומעלה רק אותם. עבור עריכת מסמך של 50 MB שבה שונו 3 שורות, delta sync מעלה chunk אחד בלבד (2 MB) במקום 50 MB.

**Conflict resolution, פתרון קונפליקטים**: כששני לקוחות שינו את אותו קובץ ב-offline ואז התחברו לרשת. שתי אסטרטגיות:

- **Last-write-wins (LWW), ניצחון האחרון שכתב**: הגרסה עם timestamp מאוחר יותר מנצחת; הגרסה הישנה יותר נשמרת כ-conflict copy. פשוט, לא מאבדים נתונים, אך עלול להפתיע.
- **CRDT, Conflict-free Replicated Data Type**: מבנה נתונים שמאפשר מיזוג אוטומטי ללא קונפליקט. נדרש תמיכה בפעולות ניתנות לסדרה (commutative). Google Docs משתמש בגרסה של זה; Google Drive לא.

**Deduplication, כפילות נתונים**: אם שני משתמשים מעלים את אותו קובץ (hash זהה), ה-object storage שומר רק עותק אחד ומפנה שניהם אליו. חוסך עד 30% בנפח.

**Presigned URL, כתובת חתומה מראש**: כדי שהלקוח יעלה ישירות ל-object storage, ה-metadata server מייצר כתובת URL זמנית (תוקף 15 דקות) עם חתימה cryptographic. הלקוח מעלה לכתובת הזו ישירות ולא דרך ה-API servers, שחוסך bandwidth.

### APIs

```
POST /files/upload/init
Body: { "name": "report.pdf", "size": 10485760, "parent_id": "folder_abc" }
Response: { "file_id": "f_xyz", "upload_urls": [ { "chunk_id": 0, "url": "https://storage.example.com/..." }, ... ] }

PUT <presigned_url>
Body: <raw chunk bytes>

POST /files/upload/complete
Body: { "file_id": "f_xyz", "chunk_hashes": ["sha256_a", "sha256_b", ...] }

GET /files/{file_id}/download
Response: redirect to presigned download URL
```

### מבנה טבלאות

```sql
-- metadata DB (MySQL / PostgreSQL)
CREATE TABLE files (
  id          BIGINT PRIMARY KEY,
  name        VARCHAR(512) NOT NULL,
  owner_id    BIGINT NOT NULL,
  parent_id   BIGINT,                   -- folder hierarchy
  size        BIGINT NOT NULL,
  checksum    CHAR(64),                 -- SHA-256 of full file
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL,
  updated_at  TIMESTAMP NOT NULL,
  is_deleted  BOOL NOT NULL DEFAULT FALSE
);

CREATE TABLE file_chunks (
  file_id     BIGINT NOT NULL,
  chunk_index INT NOT NULL,
  chunk_hash  CHAR(64) NOT NULL,        -- content address
  storage_key VARCHAR(256) NOT NULL,    -- path in object store
  PRIMARY KEY (file_id, chunk_index)
);

CREATE TABLE shares (
  file_id     BIGINT NOT NULL,
  user_id     BIGINT NOT NULL,
  permission  ENUM('view','edit') NOT NULL,
  PRIMARY KEY (file_id, user_id)
);
```

### ארכיטקטורה

```
Client
  │
  ├─► API Servers  ──► Metadata DB (SQL, 3 replicas)
  │       │
  │       └─► Message Queue (notification fan-out)
  │                │
  │                └─► Notification Service ──► Client (long-poll / WebSocket)
  │
  └─► Block Servers ──► Object Storage (S3-compatible)
                                │
                                └─► CDN (download hot files)
```

ה-block server שומר על כך שה-API servers לא נוגעים בנתונים כבדים. ה-notification service מאפשר ל-client אחר לסנק ברגע שקובץ השתנה.

## דוגמה מחושבת

### back-of-envelope

```
משתמשים: 500 מיליון, 10 מיליון active concurrently
קבצים לאחסון: 10 קבצים ממוצעים למשתמש × 500M = 5 מיליארד קבצים
גודל ממוצע: 500 KB
אחסון כולל: 5 × 10^9 × 500KB = 2.5 PB

Upload QPS:   10M active / 10 min avg session = ~16,700 uploads/sec
Download QPS: יחס קריאה/כתיבה 1:10 → 167,000 downloads/sec
              CDN מטפל ב-80% → DB רואה 33,400 QPS
```

\[\text{Storage growth per year} = 500 \times 10^6 \times 2 \text{ files/yr} \times 500 \text{ KB} = 500 \text{ TB/yr}\]

### חישוב חיסכון ב-delta sync

קובץ Markdown של 1 MB עם 500 chunks בני 2 KB. המשתמש עורך פסקה אחת:

```
בלי delta sync:  upload 1 MB per save
עם delta sync:   שינוי 1 chunk × 2 KB = 0.002 MB per save
חיסכון:          99.8%
```

עבור 10 מיליון עריכות ביום × 1 MB: חיסכון של **9.98 TB/day** בתעבורה.

### conflict resolution בפועל

```
t=0: Alice מורידה "budget.xlsx" (version=5)
t=1: Bob מוריד "budget.xlsx" (version=5)
t=2: Alice עורכת ומעלה (version=6) → metadata DB: version=6
t=3: Bob עורך ומעלה (version=5+1=6) → server מזהה conflict: local_version(5) < server_version(6)
t=4: Drive שומר את גרסת Bob בתור "budget (Bob's conflicted copy 2026-11-12).xlsx"
     ומגיע ל-Alice עם גרסה 7 (שמשלבת את שתי הפעולות כ-last-write-wins)
```

## המקרה שמפיל את האינטואיציה

"chunk size קטן יותר = delta sync יעיל יותר".

בפועל, chunk קטן מדי יוצר overhead גדול: כל chunk צריך metadata (hash, storage key, chunk index), ורשומה ב-`file_chunks`. קובץ של 1 GB עם chunks של 1 KB = מיליון רשומות metadata. עלות ה-metadata עולה על החיסכון ב-bandwidth.

Drive משתמש ב-chunks של 4-8 MB לקבצים גדולים ו-variable-size chunks (content-defined chunking) לקבצים שמוסיפים תוכן באמצע (כמו מסמכים), שם insertion בתחילת הקובץ זזה לא את כל ה-chunks שאחריה.

## טעויות נפוצות

1. **לשמור קבצים ב-metadata DB**: BLOB column ב-SQL מגדיל את ה-DB ב-petabytes, הורס את ביצועי השאילתות ואת היכולת לשים read replicas. Object storage נועד לזה. ה-DB שומר רק את ה-storage_key.

2. **להעלות קבצים דרך API server**: אם ה-API server הוא middleman לביטים, כל instance צריך bandwidth לא מוגבל. presigned URL מאפשר ל-client להעלות ישירות ל-object storage, ו-API server רואה רק metadata.

3. **לא לטפל ב-resumable uploads**: קובץ של 2 GB ב-connection גרוע יתנתק. בלי resumable upload, הכל עולה מחדש. Drive מחלק לחלקים ומאפשר להמשיך מאיפה שנעצר על ידי שמירת chunk_index.

4. **conflict resolution ב-DB בלבד**: lock pessimistic על הקובץ כולו הורג concurrency. LWW עם conflict copy נותן חוויית משתמש סבירה. CRDT מתאים רק לעריכה collaborative real-time (Docs), לא לסנק של קבצים.

## מתי זה לא משנה

לכלי פנימי עם 50 משתמשים ו-10 GB אחסון: SQLite עם blob storage, single server, ללא chunking, ללא CDN. פשטות גוברת על הנדסת סקייל.

ב-startup ברמת POC: S3 ישירות עם metadata ב-DynamoDB ו-presigned URLs. ה-block server הנוסף הוא overhead.

בראיון, הראיין מצפה: back-of-envelope, הפרדת metadata ו-data, chunking + delta sync עם נימוק, presigned URL, conflict resolution. כל אחד חסר הוא תקלה. CRDT הוא bonus.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`). מניחה היכרות עם caching, CDN, SQL schema, ו-object storage.

**מה זה מאפשר**:
- **m3-s3-storage**: אחסון אובייקטים שמספק את שכבת ה-block storage שלנו
- **m3-message-queue**: notification fan-out מסנק לכל הקלאיינטים
- **m3-distributed-email**: pattern דומה של metadata + blob, fans-out להרבה קופסאות

```quiz
{"id":"u-m3-google-drive-q1","tree":"systems","skill":"system-design","q":"מדוע Drive לא מעלה קבצים דרך ה-API server אלא משתמש ב-presigned URL?","options":["כי API servers לא תומכים ב-HTTPS","כי object storage לא מקבל חיבורים ישירים","כי API server כ-middleman לביטים דורש bandwidth בלתי מוגבל בכל instance, presigned URL מאפשר upload ישיר","כי presigned URL מהיר יותר ב-10ms בממוצע"],"answer":2,"explain":"כשה-API server מעביר את הביטים, כל request עובר דרכו פעמיים (client→server→storage). עם presigned URL, הלקוח כותב ישירות ל-object storage. ה-API server רואה רק metadata וחותם על ה-URL. זה חוסך bandwidth, מוריד עומס מה-API layer ומאפשר להוסיף API servers בלי לדאוג ל-bandwidth."}
```

```fillin
{"id":"u-m3-google-drive-f1","tree":"systems","skill":"system-design","prompt":"קובץ Markdown של 1 MB עם 500 chunks בני 2 KB. המשתמש עורך פסקה אחת. delta sync מעלה כמה chunks?","answer":"1","alt":["chunk אחד","אחד","1 chunk"],"explain":"delta sync מחשב hash לכל chunk לפני ולאחר השינוי. רק ה-chunk שהשתנה (1 × 2 KB = 0.002 MB) עולה, במקום 1 MB. חיסכון של 99.8%."}
```

```concepts
{"items":[{"id":"file-chunking","t":"File Chunking","he":"חלוקת קבצים לחתיכות","d":"פיצול קובץ ל-chunks בגודל קבוע (4-8 MB); כל chunk מזוהה ב-hash. מאפשר delta sync ו-deduplication","rel":["delta-sync","block-server"],"node":"sysdesign"},{"id":"delta-sync","t":"Delta Sync","he":"סינכרון דיפרנציאלי","d":"העלאת רק ה-chunks ששינו את ה-hash שלהם; חוסך עד 99.8% bandwidth בעריכות מקומיות","rel":["file-chunking","block-server"],"node":"sysdesign"},{"id":"block-server","t":"Block Server","he":"שרת בלוקים","d":"שרת ביניים שמחלק קבצים ל-chunks, מחשב hashes ומעביר ל-object storage; מונע מ-API servers להיות bottleneck","rel":["file-chunking","presigned-url"],"node":"sysdesign"},{"id":"presigned-url","t":"Presigned URL","he":"כתובת חתומה מראש","d":"URL זמני עם חתימה cryptographic המאפשר upload ישיר ל-object storage בלי לעבור דרך ה-API server","rel":["block-server","file-chunking"],"node":"sysdesign"},{"id":"last-write-wins","t":"Last-Write-Wins","he":"ניצחון האחרון שכתב","d":"conflict resolution: הגרסה עם timestamp מאוחר מנצחת; הגרסה הוותיקה נשמרת כ-conflict copy","rel":["file-chunking","delta-sync"],"node":"sysdesign"}]}
```
<!-- audited -->
