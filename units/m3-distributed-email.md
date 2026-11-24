# שירות דואר מבוזר
כשמיליון אנשים לוחצים "שלח" בדיוק אותה שנייה, הם לא מקיימים שיחה ישירה עם השרת של הנמען, אלא מפקידים הודעה בתור שמנהל את המשלוח בנחת, גם כשהצד השני לא זמין.

## מה תדע בסוף

תדע לתאר את הזרימה המלאה של הודעת דואר אלקטרוני, מלחיצת "שלח" אצל השולח ועד לתצוגה בתיבת הדואר של הנמען. תבין את תפקיד ה-**SMTP**, ה-**MX Record** וה-**Message Queue** בתהליך, ותוכל לנמק מדוע **Blob Storage** מתאים לצרופות ו-**Metadata DB** לאינדקס. תדע להסביר את בעיית ה-**Email Fanout** בשליחה ל-10,000 נמענים ולהציע פתרון.

## האינטואיציה

חשוב על מערכת הדואר האנלוגית: כשאתה שולח מכתב מחיפה לניו יורק, הוא עובר מסניף הדואר השכונתי שלך אל מרכז מיון אזורי, אל טיסה, אל מרכז מיון בניו יורק, ולבסוף אל תיבת הדואר של הנמען. אף אחד מהגורמים לא "שואל" כל הזמן אם יש חדשות, הם מקבלים חבילה, מוסרים אותה לשלב הבא, ומכאן.

Email עובד בדיוק אותו עיקרון:

1. **סניף השכונה שלך**: שרת ה-SMTP שלך (smtp.gmail.com, smtp.outlook.com) שמקבל את ההודעה
2. **מרכז המיון**: Message Queue שמנתק שליחה מקבלה, ומאפשר ניסיון חוזר
3. **שלטי הכתובת**: רשומות MX ב-DNS שאומרות "דואר ל-company.com מגיע לשרת X"
4. **מרכז המיון של הנמען**: שרת ה-SMTP המקבל עם סינון ספאם
5. **הדוור המקומי**: IMAP שמאפשר לאפליקציה של הנמען לשלוף ולנהל הודעות

כל הודעה היא "חבילה" עם header כמו על מעטפה ו-body כמו גוף המכתב. צרוף גדול נוסע בחבילה נפרדת (Blob Storage) ורק ה-"כתובת" שלה (URL) נשמרת ב-header.

## ההגדרות המדויקות

**SMTP, פרוטוקול דואר פשוט** (Simple Mail Transfer Protocol): הפרוטוקול לשליחת דואר. פועל מעל TCP בפורטים 25 (שרת לשרת), 587 (לקוח לשרת עם אימות), או 465 (עם TLS). SMTP הוא push-only, השולח דוחף לשרת הבא. שליפת הודעות מתיבת הדואר היא לא SMTP.

**MX Record, רשומת MX** (Mail Exchanger): רשומת DNS שמגדירה אילו שרתים מקבלים דואר עבור דומיין. כל רשומה כוללת שם שרת ועדיפות (ערך מספרי נמוך = עדיפות גבוהה). שרת SMTP שולח מבצע DNS lookup על רשומת MX לפני שהוא פותח כל חיבור TCP לנמען:

```
DNS query:  MX gmail.com?
DNS answer: 10 smtp.google.com
            20 smtp2.google.com
```

**IMAP, פרוטוקול גישה לדואר** (Internet Message Access Protocol): הפרוטוקול לניהול תיבת דואר מרחוק. בניגוד ל-**POP3, פרוטוקול דואר**: IMAP משאיר הודעות על השרת ומסנכרן מצב (נקרא/לא נקרא, תיקיות, דגלים) בין מכשירים. בגדול, Gmail, Outlook וחברים חשפו HTTP REST API שעוטף את IMAP פנימי, עם WebSocket ו-FCM לצורך notifications.

**Message Queue, תור הודעות** בהקשר דואר: כל שליחה נכנסת לתור לפני ואחרי העברה. זה מאפשר:

- **ניסיון חוזר**: כשהשרת של הנמען לא זמין, ה-Worker מנסה שוב כל X דקות עד 72 שעות, ואז מחזיר bounce
- **זרם אחיד**: גם בשיא של "שנה טובה" כשכולם שולחים ברכות בו-זמנית
- **ניתוק**: בין שרת שקיבל את הבקשה לבין Worker שמבצע המשלוח בפועל

**Blob Storage, אחסון בינארי** (Object Storage): S3, GCS או Azure Blob לצרופות ולגופי הודעות גדולות. הודעת טקסט קצרה מאוחסנת ישירות ב-Metadata DB; צרוף של 15MB מאוחסן פעם אחת ב-Blob כקובץ עם URL ייחודי, ורק ה-URL מאוחסן ב-DB. הפרדה זו מאפשרת לכל שכבה לגדול בנפרד.

**Email Fanout, פיזור הודעה**: במשלוח ל-N נמענים (מailing list), אין צורך לשמור N עותקים של גוף ההודעה. במקום זאת שומרים את הגוף פעם אחת ב-Blob ויוצרים N שורות metadata שמצביעות אליו.

**SPF, Sender Policy Framework**: רשומת DNS שמגדירה אילו שרתים רשאים לשלוח בשם הדומיין. שרת מקבל בודק: "האם השרת הזה מורשה לשלוח מ-@company.com?" מנגנון בסיסי נגד **Email Spoofing, זיוף שולח**.

### ארכיטקטורת הרכיבים

```
                       [DNS MX Lookup]
                              |
[לקוח שולח]                   v
     |          [SMTP Gateway] --> [Queue] --> [Delivery Worker]
     |                                               |
     +----------------------------------------------+
                                                     |
                                             [SMTP Receiving]
                                                     |
                                             [Spam Filter]
                                                     |
                                             [Queue] --> [Storage Worker]
                                                              |
                                               [Metadata DB]  [Blob Storage]
                                               (user, subject, (attachments,
                                                read, uid)      large bodies)
                                                     ^
                                             [IMAP / HTTP API]
                                                     ^
                                              [לקוח נמען]
```

**Metadata DB**: בדרך כלל NoSQL מסוג Document או Column-family (Cassandra, DynamoDB) מחולק (shard) לפי `user_id`. שדות טיפוסיים: `message_id`, `from_addr`, `to_addr`, `subject`, `timestamp`, `is_read`, `folder_id`, `blob_url`.

**Delivery Worker**: Worker שמקבל job מהתור, מבצע DNS lookup, מתחבר לשרת SMTP של הנמען ומוסר את ההודעה. אם נכשל, מחזיר ל-queue עם backoff.

## דוגמה מחושבת

**Alice** (alice@company.com) שולחת ל-**Bob** (bob@gmail.com) הודעה עם קובץ PDF של 2MB.

### צד השולחת

1. Alice לוחצת שלח ב-Outlook. ה-client מתחבר ל-smtp.company.com:587 עם אימות
2. smtp.company.com שולח job לתור: `{from: alice, to: bob@gmail.com, body: ..., attach: pdf}`
3. Delivery Worker קורא את ה-job, שואל DNS: `MX gmail.com?`
4. DNS מחזיר: `mx1.google.com` (priority 10), `mx2.google.com` (priority 20)
5. Worker פותח TCP ל-mx1.google.com:25 ומתחיל dialog:

```
S: 220 mx1.google.com ESMTP
C: EHLO smtp.company.com
S: 250-Hello smtp.company.com, I am glad to meet you
C: MAIL FROM: <alice@company.com>
S: 250 OK
C: RCPT TO: <bob@gmail.com>
S: 250 OK
C: DATA
S: 354 End data with <CR><LF>.<CR><LF>
C: From: alice@company.com
C: To: bob@gmail.com
C: Subject: ...
C: Content-Type: multipart/mixed ...
C: [headers + text body + PDF encoded as Base64]
C: .
S: 250 OK: queued as xyz
C: QUIT
```

### צד הנמען (Gmail)

6. mx1.google.com מקבל → בודק SPF (האם smtp.company.com מורשה ל-@company.com?)
7. עובר Spam Filter
8. Storage Worker שומר:
   - PDF → Blob Storage: `gs://gmail-attachments/uuid.pdf`
   - metadata → DB shard של bob: `{message_id: xyz, from: alice, subject: "...", is_read: false, blob_url: "gs://...pdf"}`

### Bob פותח Gmail בנייד

9. HTTP GET `/api/threads?folder=inbox` → Server קורא Metadata DB (shard של bob)
10. Bob לוחץ על ההודעה → Server מחזיר metadata + גוף הטקסט
11. Bob לוחץ "הורד PDF" → Server מחזיר signed URL ל-Blob Storage, ה-PDF מורד ישירות

### Back-of-Envelope

| פרמטר | ערך |
|---|---|
| משתמשים פעילים יומי | 1B |
| שליחות ממוצע למשתמש ביום | 10 |
| Write QPS | \(\frac{1{,}000{,}000{,}000 \times 10}{86{,}400} \approx 115{,}000\)/sec |
| גודל הודעה ממוצע | 50 KB |
| אחסון ביום | \(115{,}000 \times 50\text{KB} \approx 5.5\text{ GB/sec}\) |
| שרתי SMTP עם 1K connections כל אחד | 115,000 / 1,000 = 115 שרתים |

## המקרה שמפיל את האינטואיציה

**Mailing list עם 500,000 נמענים.** שולח אחד לוחץ "שלח" פעם אחת.

**הטעות האינטואיטיבית**: "שמור 500,000 שורות ב-DB, כל אחת עם עותק של ה-HTML body של 200KB."

**מה שזה עולה**: \(500{,}000 \times 200\text{KB} = 100\text{ GB}\) בפעולה אחת, כפול בכל blast שבועי.

**הפתרון**: Email Fanout. שומרים את ה-HTML פעם אחת ב-Blob כ-`template.html`, ומייצרים 500,000 שורות metadata שכל אחת מצביעה לאותו Blob. Worker מייצר 500,000 jobs לתור ב-batches. כל job: "שלח לנמען X עם substitutions `{first_name: ...}`".

**נקודת כשל נסתרת**: אם Worker כתב 300,000 שורות מתוך 500,000 ואז קרס, איך ממשיכים מאיפה עצרנו ולא שולחים פעמיים ל-300,000 הראשונים? מכאן ה-**Idempotency Key, מפתח אידמפוטנטיות** לכל job, ו-cursor ב-DB שמסמן עד איפה הגיעו. זה מה שמבדיל Engineer בכיר ממתחיל: לחשוב על הכשל בבניית המערכת, לא אחריה.

## טעויות נפוצות

**1. "מאחסנים הכל ב-PostgreSQL אחד"**
PostgreSQL מצוינת, אבל horizontal sharding לפי `user_id` בין עשרות שרתים מורכב לתפעול. DynamoDB, Cassandra או Vitess (MySQL עם sharding שקוף) נבנו לתבנית זו. השגיאה: לבחור כלי לא לפי bottleneck אלא לפי מה שמכירים.

**2. "SMTP הוא synchronous כמו HTTP REST"**
השולח מקבל "250 OK" כשהשרת המקבל קיבל את ההודעה לתור שלו, לא כשהנמען קרא אותה. Delivery receipts (DSN) הם אופציונליים. SMTP end-to-end הוא async בעצמותו.

**3. "IMAP מספיק ל-mobile client"**
IMAP תוכנן ל-rich desktop clients שמנהלים state מלא באופן מקומי. mobile clients רוצים push notifications, REST API קל וסנכרון מהיר. לכן שירותים מודרניים חשפו HTTP REST + WebSocket מעל פנים שמשתמשות ב-IMAP באחסון, לא כחלון ישיר.

**4. "שולחים ישירות ללא queue לביצועים טובים יותר"**
בשיא (ינואר, Black Friday), שרתי הנמענים נגנבים. ללא queue: SMTP שלך מתחיל לקבל 421 (try again later) והחיבורים נתקעים. עם queue: הודעה נשמרת בביטחון, Worker מנסה שוב כל X דקות עד 72 שעות ואז מחזיר bounce message לשולח. ה-queue הוא safety net, לא עיכוב.

## מתי זה לא משנה

**כשמדובר בשליחה טרנזקציונלית בלבד**, לא בבניית שירות דואר מלא: Transactional email (password reset, invoice, alert, OTP) נשלח ממערכת אחת לנמען אחד. לא צריך IMAP, metadata DB מחולק, fanout או שרתי MX. מספיק API של SendGrid, Amazon SES, Postmark או Resend עם כמה שורות קוד.

**ב-system design interview**: כשהמראיין שואל "Design Gmail" אתה צריך את כל הארכיטקטורה שלעיל. כשהוא שואל "Design password reset emails" אתה מיד אומר "API של SES" ומסביר למה. הגדרת ה-scope ב-2 הדקות הראשונות של הראיון היא כישור שמוערך בפני עצמו.

**מול בניית צ'אט (m3-chat-system)**: Email הוא store-and-forward עם latency של שניות עד דקות. צ'אט הוא real-time עם latency של מילישניות. הארכיטקטורות שונות בתכלית: email צריך persistence מלא ו-retry; צ'אט צריך WebSocket פתוח ו-presence service. בחר את הכלי לפי ה-latency requirement.

## חיבור

יחידה זו היא חלק מ-**M3 System Design**, ה-block שמכסה את עשרת הארכיטקטורות הקלאסיות בראיונות. הרכיבים שלמדת כאן, Message Queue לאסינכרוניות, Blob Storage לקבצים גדולים, Metadata DB מחולק, ו-Fanout לצמצום עותקים, חוזרים בכמעט כל ארכיטקטורה מורכבת בהמשך.

**לפני יחידה זו**: הבנת Message Queue בכלל (c-message-queue-arch). **לאחריה**: Object Storage (m3-s3-storage) שמעמיק ב-Blob Storage ו-presigned URLs, ומערכת צ'אט (m3-chat-system) שמשווה ארכיטקטורה real-time לעומת store-and-forward.

```quiz
{"id":"u-m3-distributed-email-q1","tree":"systems","skill":"system-design","q":"שרת SMTP מנסה לשלוח הודעה ל-bob@gmail.com. מה הצעד הראשון שהוא מבצע לפני פתיחת חיבור TCP לשרת Gmail?","options":["פותח חיבור TCP ישירות ל-gmail.com:25 ומבקש את שם שרת הדואר","שואל DNS לרשומת MX של gmail.com כדי לגלות את שרת הדואר המקבל","שולח EHLO ל-gmail.com ומצפה לתשובה עם כתובת שרת הדואר","בודק SPF של gmail.com כדי לאמת שמותר לשלוח לדומיין"],"answer":1,"explain":"לפני כל חיבור SMTP בין-דומיין, השרת השולח מבצע DNS lookup על רשומת MX של הדומיין של הנמען. MX Record מחזיר את כתובות שרתי הדואר המקבלים עם עדיפויות. רק אחרי שמקבל את הכתובת פותח TCP לשרת המקבל. SPF נבדק אצל הצד המקבל, לא אצל השולח."}
```

```quiz
{"id":"u-m3-distributed-email-q2","tree":"systems","skill":"system-design","q":"מאחסנים קבצי PDF שמשתמשים מצרפים להודעות, 10 מיליון הודעות ביום. מהי הגישה המומלצת?","options":["שמירה ישירה ב-PostgreSQL כ-BYTEA column לפשטות","שמירה ב-Object Storage כמו S3 עם URL ב-Metadata DB","שמירה ב-Redis עם TTL של 30 יום לגישה מהירה","קידוד ה-PDF כ-Base64 ב-email header וכתיבה ל-Metadata DB"],"answer":1,"explain":"Object Storage (S3, GCS, Azure Blob) מיועד בדיוק לאחסון קבצים בינאריים גדולים בגדול. ב-PostgreSQL, BYTEA מכביד על ה-DB ופוגע ב-performance של queries על שדות metadata. Redis הוא in-memory ויקר מדי ל-PDFs, וגם TTL פוגע בנגישות. הפרדת storage מ-metadata מאפשרת לכל שכבה לגדול בנפרד ולשמש presigned URL לגישה ישירה."}
```

```concepts
{"items":[{"id":"smtp","t":"SMTP","he":"פרוטוקול דואר פשוט","d":"פרוטוקול TCP לשליחת דואר שרת לשרת, push-only, פורטים 25/587/465","rel":["mx-record","imap","message-queue-arch"],"node":"sysdesign"},{"id":"mx-record","t":"MX Record","he":"רשומת MX","d":"רשומת DNS שמפנה דואר לשרתי הדואר של דומיין, עם עדיפויות מספריות","rel":["smtp"],"node":"sysdesign"},{"id":"imap","t":"IMAP","he":"פרוטוקול גישה לדואר","d":"פרוטוקול לניהול תיבת דואר מרחוק תוך שמירת הודעות על השרת ומצב מסונכרן","rel":["smtp"],"node":"sysdesign"},{"id":"email-fanout","t":"Email fanout","he":"פיזור הודעה","d":"אחסון גוף ההודעה פעם אחת ב-Blob עם N שורות metadata המצביעות אליו, ללא שכפול","rel":["message-queue-arch","blob-storage"],"node":"sysdesign"}]}
```

<!-- widget-request: flowchart: email send/receive pipeline with animated message routing between SMTP servers via MX DNS lookup -->
