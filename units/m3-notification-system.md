# מערכת התראות

כשWhatsApp שולחת "הודעה חדשה" למיליארדי טלפונים, אין שרת בודד שיכול להחזיק את כולם, ולכן כל ערוץ, iOS, Android, ו-SMS, יש לו שרת שולח משלו.

## מה תדע בסוף

לתכנן מערכת התראות ברמת ראיון: לפרק ל-components, להסביר מה תפקיד ה-message queue בתוכה, לנמק כיצד מאפשרים retry ללא כפילויות, ולבחור ערוץ שליחה מתאים לכל סוג הודעה.

## האינטואיציה

דמיין דואר ראשון עם שלושה סוגי שליחים: מיידי (push לטלפון), SMS, ואימייל. כל שליח לוקח מכתב מתיבה מרכזית ומוסר לנמען לפי כתובתו. המערכת לא יודעת אם ההודעה הגיעה, רק אם השליח קיבל אותה. אם השליח נפל בדרך, צריך לשלוח מחדש, אבל בלי לשלוח פעמיים.

## ההגדרות המדויקות

**Notification system, מערכת התראות**: תשתית שמקבלת בקשות שליחה משירותים פנימיים ומממסרת אותן לנמענים דרך ערוצים חיצוניים.

**Push notification, התראת דחיפה**: הודעה שנשלחת לטלפון גם כשהאפליקציה סגורה, דרך תשתית של iOS (APNs) או Android (FCM).

**APNs, Apple Push Notification Service**: שרת Apple שמקבל הודעות מהספק שלנו ומעביר לטלפוני iOS. דורש device token ותעודה ייחודית לאפליקציה.

**FCM, Firebase Cloud Messaging**: שרת Google המקביל לאנדרואיד. עובד גם לאפליקציות web.

**Message queue, תור הודעות**: רכיב שמנתק את הכותב מהקורא. הכותב שם הודעה בתור, והקורא מוציא ומעבד. Kafka ו-SQS הם דוגמאות נפוצות.

**Worker, עובד**: שירות שמוציא הודעות מהתור ושולח לספק החיצוני (APNs, FCM, Twilio, SendGrid).

**Idempotency key, מפתח אידמפוטנטיות**: מזהה ייחודי לכל הודעה. כשworker שולח שוב לאחר כשל, הספק מזהה שכבר קיבל הודעה זו ולא שולח פעמיים.

### ספקים לכל ערוץ

| ערוץ | ספק |
|---|---|
| iOS push | APNs |
| Android push | FCM |
| SMS | Twilio, Amazon SNS |
| Email | SendGrid, Mailchimp |

### Flow בסיסי

```
Service → Notification Service → Message Queue → Workers → Providers → Device
```

1. שירות עסקי (למשל: שירות הזמנות) שולח `POST /notify` עם payload.
2. Notification service מאחזר העדפות משתמש ממסד נתונים: אילו ערוצים פעילים, device token, כתובת אימייל.
3. Notification service שם הודעה בתור נפרד לכל ערוץ שהמשתמש הפעיל.
4. Worker מוציא הודעה מהתור ושולח לספק.
5. ספק מוסר לנמען ומחזיר קוד הצלחה.

## דוגמה מחושבת

מערכת e-commerce שצריכה לשלוח אישור הזמנה:

**Input** (שירות הזמנות שולח):
```json
{
  "user_id": "u-7772",
  "event": "order_confirmed",
  "order_id": "ord-991",
  "msg_id": "m-1234"
}
```

**Notification service**:
1. שולף מ-DB: `u-7772` מחזיר `device_token: "abc123"`, `email: "user@example.com"`, `sms_phone: "+972500000000"`, preferences: `push=true, sms=false, email=true`
2. מחיל template: "ההזמנה ord-991 אושרה, תודה על הרכישה."
3. שם בתור iOS: `{"to":"abc123","body":"ההזמנה ord-991 אושרה","msg_id":"m-1234"}`
4. שם בתור email: `{"to":"user@example.com","subject":"אישור הזמנה ord-991","msg_id":"m-1234"}`
5. לא שם בתור SMS: preferences.sms=false

**iOS Worker**:
1. מוציא `{"to":"abc123","msg_id":"m-1234"}` מהתור
2. קורא APNs עם `apns-collapse-id: m-1234`
3. APNs מחזיר `200 OK`, מסמן בDB: `m-1234 -> delivered at 14:32:01`

**תוצאה**: המשתמש מקבל push ואימייל, ללא SMS.

## המקרה שמפיל את האינטואיציה

"Worker קרס באמצע שליחה. שלחנו שוב. המשתמש קיבל שתי הודעות."

הבעיה: Worker שלח לAPNs, APNs העביר לטלפון, אבל Worker קרס לפני שסימן "הצלחה" בתור. Message queue מחזיר את ההודעה לאחר timeout, Worker שני שולח שוב.

הפתרון: **idempotency key**. Worker שולח לAPNs עם `apns-collapse-id: m-1234`. APNs מזהה שכבר ראה מזהה זה ומחזיר 200 בלי לשלוח פעמיים.

**At-least-once vs exactly-once**: message queues מבטיחים at-least-once. הספקים אחראים על exactly-once דרך idempotency key. בלי idempotency key, כפילויות הן בלתי נמנעות.

## טעויות נפוצות

1. **שליחה ישירה בלי queue**: אם הספק איטי או ירד, שרת הNotification תקוע עד שה-timeout עובר. Queue מנתק את זה לחלוטין.

2. **שמירת device token ב-DB ללא ניקוי**: טלפון ישן שהאפליקציה נמחקה ממנו מחזיר שגיאה מAPNs. צריך לנקות tokens שנותנים שגיאות חוזרות, אחרת הDB מלא ב-tokens מתים.

3. **לא לבדוק preferences לפני שליחה**: שלחת SMS למשתמש שביקש רק push. הוא כועס, מבטל opt-in ומגיש תלונה GDPR.

4. **Retry ללא exponential backoff**: Worker שולח שוב כל שנייה לספק שירד. גורם ל-thundering herd שמחמיר את הנפילה במקום לאפשר לה להחלים.

## מתי זה לא משנה

לשליחה פנימית בין microservices, push notification הוא overhead. משתמשים ב-gRPC event או Kafka event ישיר בין שירותים.

בראיון, הכוונה היא תמיד לתשתית לקצה-המשתמש. הראיין מצפה: high-level flow עם queue ו-workers, delivery guarantees עם idempotency, וההבדל בין APNs ל-FCM. מה שמבדל תשובה טובה: לדעת לנמק את השימוש ב-queue ולא להסתפק ב"כי הוא סקיילבל".

## חיבור

יחידה זו שייכת ל-M3 (System Design, node `sysdesign`).

**מה זה מאפשר**:
- **m3-message-queue**: מעמיק את Kafka ו-SQS שנרמזו כאן
- **m3-rate-limiter**: rate limiting לשליחות push לאותו משתמש ב-timeframe
- **m3-news-feed**: מנגנון push לעדכון feed מחייב מערכת התראות

```quiz
{"id":"u-m3-notification-system-q1","tree":"systems","skill":"system-design","q":"למה notification system משתמש ב-message queue ולא שולח ישירות לספק (APNs/FCM)?","options":["כי APNs לא מקבל חיבורים ישירים מחוץ ל-Apple","כי queue מנתק את זמן השליחה מזמן הבקשה ומאפשר retry בלי לחסום את השירות השולח","כי FCM דורש שליחה דרך Kafka בלבד","כי רק queue תומך ב-idempotency"],"answer":1,"explain":"Queue מנתק producer מ-consumer: השירות השולח רק שם הודעה בתור ומסיים. אם APNs ירד, ה-worker מחכה ומנסה שוב בלי להשפיע על השירות המקורי. בלי queue, שליחה ישירה חוסמת את ה-thread עד שהספק מגיב."}
```

```fillin
{"id":"u-m3-notification-system-f1","tree":"systems","skill":"system-design","prompt":"Worker שלח push לAPNs, APNs העביר לטלפון, אבל Worker קרס לפני שסימן הצלחה. Queue מחזיר את ההודעה. כיצד מונעים שהמשתמש יקבל את אותה ההתראה פעמיים?","answer":"idempotency key","alt":["idempotency","מפתח אידמפוטנטיות","apns-collapse-id","collapse-id"],"explain":"Worker שולח עם idempotency key (כגון apns-collapse-id). כשworker שני שולח שוב, הספק מזהה את אותו key ומחזיר הצלחה בלי שליחה כפולה."}
```

```concepts
{"items":[{"id":"notification-system","t":"Notification System","he":"מערכת התראות","d":"תשתית שמקבלת בקשות שליחה משירותים ומממסרת לנמענים דרך push, SMS, email","rel":["push-notification","message-queue","notification-idempotency"],"node":"sysdesign"},{"id":"push-notification","t":"Push Notification","he":"התראת דחיפה","d":"הודעה שנשלחת לטלפון דרך APNs (iOS) או FCM (Android) גם כשהאפליקציה סגורה","rel":["notification-system","apns","fcm"],"node":"sysdesign"},{"id":"apns","t":"APNs","he":"Apple Push Notification Service","d":"שרת Apple לשליחת push notifications לאייפון. דורש device token ותעודה.","rel":["push-notification","fcm"],"node":"sysdesign"},{"id":"fcm","t":"FCM","he":"Firebase Cloud Messaging","d":"שרת Google לשליחת push notifications לאנדרואיד ולאפליקציות web.","rel":["push-notification","apns"],"node":"sysdesign"},{"id":"notification-idempotency","t":"Notification Idempotency","he":"אידמפוטנטיות הודעה","d":"שימוש ב-idempotency key בעת שליחה חוזרת כדי שהספק לא ישלח הודעה כפולה","rel":["notification-system","message-queue"],"node":"sysdesign"}]}
```

<!-- audited -->
