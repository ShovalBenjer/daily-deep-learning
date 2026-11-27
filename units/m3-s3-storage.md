# אחסון אובייקטים

Amazon S3 מאחסן מעל 350 טריליון אובייקטים; כל PUT ו-GET עובר דרך namespace שטוח שאינו מדע-בדיוני, אלא עיצוב מכוון שמאפשר scale כמעט אינסופי.

## מה תדע בסוף

לתכנן שירות אחסון אובייקטים ברמת ראיון בכיר: לגזור קיבולת מ-back-of-envelope; להסביר את הפרדת שכבת ה-metadata משכבת הנתונים; לנמק erasure coding מול replication; ולתאר את זרימת ה-multipart upload.

## האינטואיציה

דמיין מחסן דואר ענקי. כל חבילה (אובייקט) מקבלת כתובת מדויקת: **שם מדף (bucket)** ו-**מספר משבצת (key)**. הכתובת מודפסת על הקופסה עצמה. עובדי המחסן לא פותחים את הקופסאות ולא מסדרים אותן בתתי-תיקיות; הם רק מניחים ומאחזרים לפי כתובת.

קטלוג המחסן (metadata service) שומר את כל הכתובות ומיקומן במחסן. תוכן הקופסאות עצמן (data nodes) יושב בנפרד. ההפרדה הזו היא מה שמאפשר לשרת מיליוני בקשות במקביל בלי שכל בקשה צריכה לסרוק תוכן.

## ההגדרות המדויקות

**Object store, אחסון אובייקטים**: שירות PUT/GET/DELETE לאובייקטים בלתי-ניתנים לשינוי in-place, המזוהים לפי bucket + key. אין תיקיות אמיתיות, אין נעילות, אין קריאה חלקית של bytes שרירותיים.

**Bucket, דלי**: מיכל לוגי עם מדיניות גישה, region, versioning ו-lifecycle משלו. שם ה-bucket חייב להיות ייחודי גלובלית.

**Object key, מפתח אובייקט**: מחרוזת UTF-8 של עד 1,024 bytes שמזהה ייחודית את האובייקט בתוך ה-bucket. הפסיקים (`/`) מדמים תיקיות אך אינן ישויות אמיתיות.

**ETag, תגית ישות**: hash MD5 של תוכן האובייקט, מוחזר בכותרות ה-GET. משמש לאימות שלמות ו-cache validation.

**Presigned URL, URL חתום מראש**: URL עם פרמטרי אימות מוטבעים ותאריך תפוגה. מאפשר ל-client להעלות ישירות ל-storage בלי לעבור דרך שרת ה-API שלנו. חיוני ל-performance כשמעלים קבצים גדולים.

**Multipart upload, העלאה מקוטעת**: חלוקת אובייקט לחלקים (כל חלק לפחות 5 MB, חוץ מהאחרון), העלאה מקבילית, ואיחוד אטומי בסיום. מאפשר recovery של חלק שנכשל בלי העלאה מחדש של הכל.

**Erasure coding, קידוד מחיקה**: נתונים מחולקים ל-k shards רגילים ו-m shards של parity. כל תקלה של עד m nodes מאפשרת שחזור מלא. S3 משתמש ב-6+3 בתוך כל storage node. עלות אחסון \(\frac{k+m}{k} = 1.5\times\) לעומת 3-way replication שעולה \(3\times\).

**Content addressing, כתובת לפי תוכן**: אחסון קובץ תחת ה-hash שלו. תוכן זהה משתף עותק אחד. Git ו-Docker layers משתמשים בזה; Artifact Repository (s2-artifact-repo) מסביר זאת ביחס ל-build artifacts.

## דוגמה מחושבת

### הערכת גדלים

```
נתון: שירות שיתוף תמונות, 1 מיליון uploads ביום, ממוצע 1 MB לתמונה

Write QPS:  1,000,000 / 86,400 ≈ 12 כתיבות/שנייה
Read QPS:   12 × 100 = 1,200 קריאות/שנייה (יחס 100:1 לתמונות)

אחסון ל-5 שנים:
  1M × 1MB × 365 × 5 = 1,825 TB ≈ 1.8 PB (נתונים גולמיים)

עם erasure coding 6+3:  1.8 PB × 1.5 = 2.7 PB
עם 3-way replication:   1.8 PB × 3.0 = 5.4 PB
```

\(\text{חיסכון erasure coding} = 5.4 - 2.7 = 2.7 \text{ PB}\), כמעט חצי העלות לאחסון לאורך זמן.

### זרימת multipart upload לקובץ של 100 MB

```
שלב 1: POST /uploads/{bucket}/{key} → uploadId = "abc123"

שלב 2: העלאה מקבילית (4 threads):
  PUT /uploads/abc123/1  (MB 1-25)   → ETag: "e1a2..."
  PUT /uploads/abc123/2  (MB 26-50)  → ETag: "b3f4..."
  PUT /uploads/abc123/3  (MB 51-75)  → ETag: "c5d6..."
  PUT /uploads/abc123/4  (MB 76-100) → ETag: "7e8f..."

שלב 3: POST /uploads/abc123/complete
        Body: [{partNumber:1,ETag:"e1a2"}, ..., {partNumber:4,ETag:"7e8f"}]
        → 200 OK, final ETag חדש
```

כישלון ב-thread 2 בשלב 2 → retry חלק 2 בלבד, שאר החלקים כבר נשמרו.

### ארכיטקטורה בגרסה מינימלית

```
Client
  |
  ↓ PUT /bucket/key
API Gateway
  |
  ├─→ Metadata Service (MySQL/DynamoDB)
  |     ב- key: (bucket, key)
  |     ב- value: { data_node_ids, size, ETag, created_at }
  |
  └─→ Data Service (erasure-coded shards)
        → Shard 1 (node A)
        → Shard 2 (node B)
        → ...
        → Parity shard (node G)
```

Metadata Service מכסה בדרך כלל 1% מהנפח; Data Service מכסה 99%. הפרדה זו מאפשרת לשדרג כל שכבה בנפרד.

## המקרה שמפיל את האינטואיציה

"אניח שהמפתח הוא נתיב בתיקיות, אז אוכל לעשות rename לתיקיה שלמה בפעולה אחת."

ב-object store אין rename. `rename("photos/2024/", "archive/2024/")` מתורגמת ל-copy + delete של כל אובייקט בנפרד. ב-S3 עם 10 מיליון קבצים בתיקיה, `rename` לוקח שעות ועולה כסף. POSIX semantics לא קיימות: אין קישורים קשים, אין נעילות, אין `mmap`. קוד שמסתמך על אחד מאלה צריך refactor מלא לפני שמעבירים ל-object store.

## טעויות נפוצות

1. **שימוש ב-object store לworkload של מסד נתונים**: object store לא תומך בשאילתות, עדכון שדות, או join. לשורות DB השתמש ב-DB; לblobs השתמש ב-object store.

2. **אחסון מאות אלפי אובייקטים קטנים מאוד (< 1 KB)**: לכל אובייקט יש overhead של metadata (כ-100 bytes ב-DynamoDB). 10 מיליון קבצים של 100 bytes יעלו 10 GB ב-metadata, יותר מהנתונים עצמם. פתרון: aggregate קבצים קטנים לתוך גדולים (לדוגמה, parquet שורות רבות בקובץ אחד).

3. **הנחה שמחיקה מיידית**: versioning ב-S3 לא מוחק קבצים ישנים, רק מסמן אותם. lifecycle rules חייבות להיות מוגדרות מפורשות.

4. **שכחת ניהול multipart upload שלא הושלם**: חלקים שהועלו אך ה-upload לא הושלם (crash, timeout) צוברים עלויות. lifecycle rule שמבטלת multipart uploads ישנים מונעת הפתעות בחשבון.

## מתי זה לא משנה

לפחות מ-100 MB סה"כ: קובץ מקומי או BLOB column ב-SQLite הם פשוטים, אפס תשתית. לפחות מ-10 GB: managed S3 ישירות, ללא ארכיטקטורה מותאמת אישית.

בראיון, שאלת object store מופיעה כחלק מ-YouTube, Google Drive, Dropbox, או Slack. הראיין מצפה: הערכת אחסון מ-back-of-envelope, Metadata Service נפרד מ-Data Service, erasure coding עם נימוק עלות, ו-presigned URL לצמצום עומס ה-API. multipart upload הוא bonus שמראה עומק.

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`, tree `systems`). מרחיבה את `m3-google-drive` ואת `m3-youtube` שאחסון האובייקטים הוא הלב שלהם.

**מה זה מאפשר**:
- **m3-google-drive**: Google Drive הוא object store + metadata layer + sharing layer
- **m5-ai-search**: Azure Blob Storage כמקור ה-RAG, ingest לאינדקס מ-object store
- **s2-artifact-repo**: artifact repos מממשים content addressing מעל object store

```quiz
{"id":"u-m3-s3-storage-q1","tree":"systems","skill":"system-design","q":"מה ההבדל הבסיסי ביותר בין אחסון אובייקטים (object store) לאחסון קבצים (file system)?","options":["אחסון אובייקטים תומך בתיקיות אמיתיות ומאפשר rename מהיר; file system לא","אחסון אובייקטים הוא namespace שטוח עם PUT/GET; אין תיקיות אמיתיות ואין עדכון in-place","object store מהיר יותר תמיד כי הוא מאחסן ב-RAM","object store לא תומך בהרשאות גישה כלל"],"answer":1,"explain":"Object store הוא namespace שטוח: bucket + key מזהים את האובייקט. '/' ב-key הוא סימולציה של תיקיה, לא ישות אמיתית. rename היא copy+delete בפועל. file system תומך ב-POSIX: תיקיות ממשיות, rename אטומי, נעילות ו-mmap. בחירה בין השניים מכתיבה את עיצוב הקוד."}
```

```fillin
{"id":"u-m3-s3-storage-f1","tree":"systems","skill":"system-design","prompt":"העלאת multipart חוסכת זמן כי אפשר להעלות חלקים ___. במקרה של כישלון, צריך לחזור רק על החלק שנכשל.","answer":"במקביל","alt":["בו-זמנית","בצורה מקבילית","בparallel","parallel"],"explain":"multipart upload מחלק קובץ גדול לחלקים עצמאיים שניתן להעלות במקביל (4-8 threads בדרך כלל). כישלון בחלק אחד לא מחייב העלאה מחדש של הכל, רק של החלק שנכשל. ב-S3 כל חלק חייב להיות לפחות 5 MB (חוץ מהאחרון)."}
```

```concepts
{"items":[{"id":"object-store","t":"Object Store","he":"אחסון אובייקטים","d":"namespace שטוח PUT/GET/DELETE לאובייקטים בלתי-ניתנים לשינוי in-place, מזוהים לפי bucket+key","rel":["presigned-url","multipart-upload","erasure-coding"],"node":"sysdesign"},{"id":"presigned-url","t":"Presigned URL","he":"URL חתום מראש","d":"URL עם אימות מוטבע ותאריך תפוגה, מאפשר העלאה ישירה ל-storage ללא שרת ביניים","rel":["object-store"],"node":"sysdesign"},{"id":"multipart-upload","t":"Multipart Upload","he":"העלאה מקוטעת","d":"חלוקת אובייקט לחלקים (min 5 MB), העלאה מקבילית, איחוד אטומי. חלק שנכשל: retry בלבד","rel":["object-store"],"node":"sysdesign"},{"id":"erasure-coding","t":"Erasure Coding","he":"קידוד מחיקה","d":"k data shards + m parity shards; ניתן לשחזור מתקלה של עד m nodes. עלות 1.5x לעומת 3x replication","rel":["object-store"],"node":"sysdesign"},{"id":"content-addressing","t":"Content Addressing","he":"כתובת לפי תוכן","d":"אחסון קובץ תחת ה-hash שלו; תוכן זהה משתף עותק אחד","rel":["object-store"],"node":"sysdesign"}]}
```
