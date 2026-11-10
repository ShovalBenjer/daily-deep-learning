# תכנון YouTube
אחד ל-500 מיליון שעות: כך YouTube מגישה וידאו לכל משתמש תוך שניות מכל קצה של כדור הארץ.

## מה תדע בסוף
תוכל לשרטט את ה-pipeline המלא מהעלאת וידאו ועד הצגתו למשתמש, ולהסביר מדוע כל רכיב קיים ואיפה הוא עלול להישבר.

## האינטואיציה

דמיין ש-YouTube היא שילוב של שלושה דברים: **סטודיו עריכה**, **בית דואר** ו**רשת סניפים מקומיים**.

הסטודיו (שרת ה-transcoding) לוקח את הקובץ הגולמי שהמשתמש העלה ומייצר ממנו עשרה עותקים: 4K, 1080p, 720p, 480p, 360p, ועוד פורמטים לאנדרואיד ו-iOS. בית הדואר (ה-metadata store + search) יודע היכן כל סרטון מאוחסן ומי מורשה לראות אותו. הסניפים המקומיים (ה-CDN) מחזיקים עותקים של הסרטונים הפופולריים קרוב לכל משתמש כדי שהנסיעה ברשת תהיה קצרה ככל האפשר.

כשאתה לוחץ Play, הסרטון מגיע מהסניף הקרוב אליך, לא מהמחסן המרכזי.

## ההגדרות המדויקות

**Blob Storage, אחסון אובייקטים**: מאגר אחסון שמטפל בקבצים בינאריים גדולים. הממשק הוא PUT/GET לפי מפתח (נניח, `videos/abc123/720p.mp4`). S3, Azure Blob, GCS הם דוגמאות. לא מיועד לשאילתות SQL, לא לחיפוש פנימי בקובץ, לא לנעילות שורה.

**Transcoding, קידוד-מחדש**: המרת קובץ וידאו ממקור אחד למספר פורמטים ורזולוציות. תהליך עתיר CPU שיכול לקחת דקות לשעות על קובץ ארוך.

**DAG Processor, מעבד DAG**: רשת משימות בצורת גרף מכוון ללא מחזורים (Directed Acyclic Graph). כל משימה מתחילה רק לאחר שהמשימות שהיא תלויה בהן סיימו. אצל YouTube: פירוק לפריימים ← (חילוץ thumbnail || ווטרמארק || קידוד ל-1080p || קידוד ל-480p) ← אחסון. המשימות המקבליות רצות בו-זמנית.

**Presigned URL, URL חתום**: URL זמני שמכיל אישורי גישה מוטמעים. ה-API Server מייצר אותו בלי להעביר קבצים דרך עצמו: `GET /presigned-upload?filename=raw.mp4` מחזיר URL ל-S3 שתקף 15 דקות. הלקוח מעלה ישירות ל-S3, חוסך עומס מהאפליקציה.

**Adaptive Bitrate Streaming (ABR), הזרמה אדפטיבית**: הלקוח בוחר באופן דינמי איזה קטע (chunk) להוריד לפי רוחב הסרט הנוכחי. HLS ו-DASH הם הפרוטוקולים הנפוצים. כך שדרת ה-5G מקבלת 4K ו-Wi-Fi חלש מקבל 360p מאותו CDN.

**Eventual Consistency, עקביות סופית**: אחרי שהעלאת סרטון, הוא לא מופיע מיד בתוצאות החיפוש של כל המשתמשים. ה-metadata store מתעדכן בהדרגה. זה בסדר: YouTube בחרה בזמינות גבוהה על פני עקביות מיידית.

## דוגמה מחושבת

**מסלול העלאה, שלב אחר שלב:**

```
1. User          → POST /upload/init
2. API Server    ← presigned URL (תקף 15 דק' ל-S3)
3. User          → PUT raw_video.mp4  to S3 (ישירות!)
4. S3            → event: "upload complete" → Message Queue
5. Transcoding   ← pulls job from queue
                  → DAG: decode | thumbnail | encode-1080p | encode-480p
                  → stores in Blob Storage: /processed/abc123/
6. API Server    ← notification: "ready"
7. CDN           ← pulls popular content proactively (prefetch)
8. Viewer        → Play → CDN edge node → ABR chunks
```

**מספרים אמיתיים:** ב-2023 YouTube קיבלה כ-500 שעות וידאו לדקה. קובץ וידאו גולמי של שעה שוקל בין 50 ל-100 GB. לאחר transcoding ל-6 איכויות: כ-15 GB. הכפל ב-500 שעות / 60 דקות = כ-125 GB של transcoded video בדקה. ה-transcoding farm הוא מכונת ה-compute הגדולה ביותר ב-YouTube.

## המקרה שמפיל את האינטואיציה

**"למה לא לשרת ישירות מה-Blob Storage?"**

זה עובד עבור 100 משתמשים. אבל S3 גובה כ-\(0.09\) דולר לכל GB יוצא. CDN גובה כ-\(0.01\) דולר ל-GB, כלומר \(9\times\) זול יותר. בעומס של YouTube: \(100 \text{ GB/min} \times 60 \times 24 \approx 144 \text{ TB/day}\). הכפל ב-9: הבדל של עשרות מיליוני דולרים לחודש.

מעבר לעלות, Blob Storage לא מותאם לאלפי חיבורים במקביל לאותו קובץ. CDN edge nodes אופטימיזציות לעשרות אלפי חיבורים בו-זמנית, עם TCP tuning ו-HTTP/2 multiplexing.

**"למה לא לשמור metadata בבסיס הנתונים עם ה-video bytes?"**

Blob Storage מאחסן files, לא שורות. לא ניתן לשאול "כל הסרטונים של ערוץ X עם תגית Y שפורסמו ב-7 ימים האחרונים" ישירות על S3. ה-metadata (כותרת, תיאור, ספירת צפיות, לייקים) גר ב-MySQL שרד ל-cassandra לפי use case, וה-bytes גרים ב-Blob Storage.

## טעויות נפוצות

**טעות 1: להחזיר "הצלחה" ללקוח לפני שה-transcoding גמר.**
הלקוח מנסה לצפות ומקבל 404 כי ה-processed files עדיין לא קיימים. הפתרון: status page שמראה "processing" עד שה-DAG הסתיים.

**טעות 2: transcoding סינכרוני בתוך בקשת ה-HTTP.**
Transcoding לוקח דקות. שרת HTTP מצפה מקסימום עשרות שניות. חייבים להעביר לתור (Message Queue) ולעבד אסינכרוני.

**טעות 3: להניח שה-CDN מנהל את עצמו.**
CDN cache expiration חייב להיות מוגדר: סרטון חדש לא יופיע אם ה-TTL ישן. וידאו שנמחק חייב להיות invalidated בכל ה-edge nodes. לא מדובר ב-"set and forget".

**טעות 4: שרת API אחד לכל הבקשות.**
Upload traffic ו-view traffic הם פרופילים שונים. uploads עתירי I/O ל-S3. views עתירי קריאת metadata. כדאי להפריד את ה-service layers.

## מתי זה לא משנה

**מדוע לא לתכנן ככה מהיום הראשון:**
עבור חברה עם 10,000 משתמשים, הארכיטקטורה הזו היא over-engineering. S3 + presigned URL + Lambda לצורכי thumbnail מספיקים. CDN אפשר להוסיף כש-bandwidth costs מתחילים לכאוב.

**האלטרנטיבה הפשוטה:** Cloudinary או Mux לצורכי transcoding כ-service. עלות גבוהה יותר, אבל אפס תחזוקה של transcoding infrastructure. בחר את הארכיטקטורה המורכבת רק כשה-economics מצדיקים אותה.

**בראיון:** אם המראיין שואל "Design YouTube" הוא לא מצפה ל-IaC code. הוא מצפה שתכסה: upload flow + processing pipeline + storage separation + CDN. תן עדיפות לעומק על פני רוחב.

## חיבור

יחידה זו ממשיכה את **cdn** ו-**message-queue-arch** שנלמדו בבלוק M3. ה-DAG Processor הוא הרחבה של מה שלמדת על אסינכרוניות.

**מה היא פותחת:** m3-google-drive (אחסון קבצים בהיקף - overlap בין Blob Storage ל-sync), m3-s3-storage (deep dive על עיצוב Blob Storage עצמו).

```quiz
{"id":"u-m3-youtube-q1","tree":"systems","skill":"system-design","q":"מה התפקיד של ה-Message Queue בתהליך העלאת הוידאו?","options":["מאחסן את ה-bytes של הוידאו הגולמי","מאפשר לשרת ה-API לחזור ללקוח מיד ולהעביר עיבוד ל-transcoding workers","מחליף את ה-CDN בהגשת הוידאו למשתמשים","מנהל הרשאות צפיה לפי ערוצים"],"answer":1,"explain":"ה-Message Queue מפריד בין קבלת הבקשה (מהיר) לעיבוד (איטי). ה-API Server מחזיר 200 OK מיד, ומשים job בתור. ה-transcoding workers שולפים מהתור בקצב שלהם. זה האבסטרקציה הקלאסית של async processing."}
```

```quiz
{"id":"u-m3-youtube-q2","tree":"systems","skill":"system-design","q":"מדוע YouTube שומרת video bytes ב-Blob Storage ולא במסד נתונים רגיל?","options":["Blob Storage זול יותר ומותאם לקבצים גדולים עם גישת PUT/GET פשוטה","מסד נתונים לא תומך בקבצים גדולים מ-1 MB","Blob Storage תומך בשאילתות SQL מהירות יותר","CDN יכול לקרוא רק מ-Blob Storage"],"answer":0,"explain":"Blob Storage (כמו S3) מיועד לקבצים גדולים עם ממשק פשוט: PUT/GET לפי key. מסדי נתונים רלציוניים אופטימיזציות לשורות קצרות ושאילתות מורכבות, לא לקבצים של GB. ה-metadata (כותרת, צפיות, לייקים) גר ב-DB; ה-bytes גרים ב-Blob."}
```

```concepts
{"items":[{"id":"blob-storage-yt","t":"Blob Storage","he":"אחסון אובייקטים","d":"מאגר PUT/GET לקבצים בינאריים גדולים; לא מיועד לשאילתות SQL","rel":["cdn","message-queue-arch"],"node":"sysdesign"},{"id":"video-transcoding","t":"Video Transcoding","he":"קידוד-מחדש","d":"המרת וידאו גולמי למספר פורמטים ורזולוציות; תהליך אסינכרוני עתיר CPU","rel":["dag-processor-yt","blob-storage-yt"],"node":"sysdesign"},{"id":"dag-processor-yt","t":"DAG Processor","he":"מעבד DAG","d":"רשת משימות מקבליות בגרף מכוון ללא מחזורים; ב-YouTube: thumbnail + encode + watermark","rel":["video-transcoding","message-queue-arch"],"node":"sysdesign"},{"id":"adaptive-bitrate","t":"Adaptive Bitrate (ABR)","he":"הזרמה אדפטיבית","d":"לקוח בוחר איכות וידאו דינמית לפי רוחב סרט; HLS/DASH","rel":["cdn","blob-storage-yt"],"node":"sysdesign"},{"id":"presigned-url","t":"Presigned URL","he":"URL חתום","d":"URL זמני עם אישורים מוטמעים; מאפשר העלאה ישירה ל-Blob Storage ללא העברת bytes דרך ה-API","rel":["blob-storage-yt"],"node":"sysdesign"}]}
```
