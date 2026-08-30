# הסרת כפילויות
כפילות אחת ב-events table משנה את ה-DAU של מחר; DISTINCT לבד עובד רק כשכל העמודות זהות.

## מה תדע בסוף
תבחין בין כפילות מדויקת (כל העמודות זהות) לכפילות לפי מפתח עסקי (אותו user_id נרשם פעמיים עם נתונים שונים). תכתוב את שני הסוגים בעזרת DISTINCT ובעזרת ROW_NUMBER(). תוכל לפתור שאלת dedup טיפוסית מ-DataLemur בפחות מחמש דקות.

## האינטואיציה

דמיין טופס הרשמה שנשלח פעמיים עקב רענון דף. בדאטהבייס נוצרו שתי שורות עם אותו user_id, email ו-timestamp. אם ל-signup_id יש ערך אוטומטי שונה בכל שורה, DISTINCT לא יסיר אותן, כי אין שתי שורות זהות לחלוטין.

הפתרון הוא למנות referee: הגדר כלל ניצחון (שמור את הישנה ביותר, החדשה ביותר, הזולה ביותר), ותן לכל שורה מספר בתוך קבוצת הכפילויות שלה. השורה עם rn = 1 שורדת, כל השאר יוצאות.

## ההגדרות המדויקות

**Duplicate row, כפילות שורה**: שורה שחולקת ערכים בעמודות המפתח העסקי עם שורה אחרת לפחות. "מפתח עסקי" הוא הגדרה עסקית, לא טכנית: לעיתים user_id לבד, לעיתים (user_id, event_type) יחד.

**DISTINCT**: מילת מפתח שמורה רק שורות ייחודיות מהתוצאה. היא בודקת שוויון על כל עמודות שנבחרו ב-SELECT. שתי שורות הן כפולות לפי DISTINCT אם ורק אם כל ערכיהן זהים. שתי NULL באותה עמודה נחשבות שוות ל-DISTINCT (שונה מהשוואת WHERE שבה `NULL = NULL` מחזירה UNKNOWN).

**ROW_NUMBER(), ממספר שורות**: פונקציית חלון שמקצה מספר ייחודי עולה לכל שורה בתוך partition. אין שתי שורות באותה partition עם אותו rn. אם ORDER BY אינו ייחודי, הסדר בין שורות עם ערכים שווים אינו מובטח.

**PARTITION BY**: תת-סעיף ב-OVER(...) שמגדיר את הקבוצה. ללא PARTITION BY, כל הטבלה היא partition אחד.

**תבנית dedup עם ROW_NUMBER**:

```sql
WITH ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY <מפתח עסקי>
           ORDER BY     <כלל ניצחון>
         ) AS rn
  FROM   table_name
)
SELECT <עמודות>
FROM   ranked
WHERE  rn = 1;
```

```concepts
{"items":[{"id":"c-dedup","t":"Duplicate row","he":"כפילות שורה","d":"שורה שחולקת ערכי מפתח עסקי עם שורה אחרת; הגדרת המפתח עסקית, לא טכנית","rel":["c-rn-dedup"],"node":"sql-core"},{"id":"c-rn-dedup","t":"ROW_NUMBER deduplication","he":"דה-כפילות עם ROW_NUMBER","d":"PARTITION BY מפתח עסקי, ORDER BY כלל ניצחון; שמור rn=1 בלבד; tiebreaker ייחודי נדרש לדטרמיניזם","rel":["c-dedup"],"node":"sql-core"}]}
```

## דוגמה מחושבת

**טבלה**: signups(signup_id, user_id, email, created_at)

```
signup_id | user_id | email      | created_at
----------|---------|------------|--------------------
1         | 42      | a@x.com    | 2024-01-01 09:00
2         | 42      | a@x.com    | 2024-01-01 09:02
3         | 99      | b@x.com    | 2024-01-02 14:00
4         | 99      | bx@x.com   | 2024-01-03 10:00
```

שורות 1 ו-2 הן כפילות לפי מפתח עסקי (user_id=42, email זהה). שורות 3 ו-4 אינן כפילות מדויקות (email שונה), אבל הן שני רשומות לאותו user_id.

**שאלה A**: בחר את פרטי ההרשמה הראשונה של כל user_id.

```sql
WITH ranked AS (
  SELECT signup_id,
         user_id,
         email,
         created_at,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY     created_at ASC, signup_id ASC
         ) AS rn
  FROM   signups
)
SELECT signup_id, user_id, email, created_at
FROM   ranked
WHERE  rn = 1;
```

חישוב שלב אחר שלב:

עבור user_id = 42: שורה 1 (09:00) מקבלת rn=1, שורה 2 (09:02) מקבלת rn=2.
עבור user_id = 99: שורה 3 (14:00 ב-01-02) מקבלת rn=1, שורה 4 (10:00 ב-01-03) מקבלת rn=2.

תוצאה אחרי `WHERE rn = 1`:

```
signup_id | user_id | email   | created_at
----------|---------|---------|--------------------
1         | 42      | a@x.com | 2024-01-01 09:00
3         | 99      | b@x.com | 2024-01-02 14:00
```

**שאלה B**: ספור כמה users ייחודיים יש (כפילות מדויקת לפי user_id).

```sql
SELECT COUNT(DISTINCT user_id) FROM signups;
```

מחזיר 2. המנוע ספר user_id = 42 פעם אחת (למרות שמופיע בשורות 1 ו-2) ו-user_id = 99 פעם אחת.

## המקרה שמפיל את האינטואיציה

`SELECT DISTINCT user_id, email FROM signups` מחזיר 3 שורות, לא 2:

```
user_id | email
--------|----------
42      | a@x.com
99      | b@x.com
99      | bx@x.com
```

DISTINCT הסיר את הכפילות המדויקת של user 42 (שורות 1 ו-2 זהות לחלוטין ב-user_id ו-email), אבל user 99 מופיע פעמיים כי יש לו שני emails שונים. אם הרצון הוא "user אחד = שורה אחת", DISTINCT אינו מספיק; צריך ROW_NUMBER() עם PARTITION BY user_id.

```quiz
{"id":"u-m2-dedup-q1","tree":"systems","skill":"sql","q":"טבלת events (event_id, user_id, event_type, ts). מה מחזיר את כל עמודות השורה האחרונה לכל (user_id, event_type)?","options":["SELECT DISTINCT user_id, event_type FROM events","WITH r AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, event_type ORDER BY ts DESC) AS rn FROM events) SELECT * FROM r WHERE rn = 1","SELECT user_id, event_type, MAX(ts) FROM events GROUP BY user_id, event_type","SELECT * FROM events GROUP BY user_id, event_type"],"answer":1,"explain":"DISTINCT על עמודות נבחרות מחזיר רק אותן, לא את שאר עמודות השורה. MAX(ts) מחזיר את ה-ts הגדול אבל לא את event_id ושאר עמודות. GROUP BY ללא אגרגציה על כל העמודות הלא-מקובצות הוא שגיאת SQL ברוב המנועים. ROW_NUMBER עם PARTITION BY (user_id, event_type) ו-ORDER BY ts DESC מניח rn=1 על השורה האחרונה, ו-SELECT * מחזיר את כל עמודותיה."}
```

## טעויות נפוצות

**DISTINCT על עמודה אחת כשצריך שורה שלמה**: `SELECT DISTINCT user_id FROM signups` מחזיר ids ייחודיים בלבד. אם רוצים גם email ו-created_at של אותה שורה, צריך ROW_NUMBER() או אגרגציה, לא DISTINCT על user_id לבד.

**GROUP BY ללא אגרגציה**: `SELECT user_id, email FROM signups GROUP BY user_id` הוא שגיאת SQL ברוב המנועים כי email אינה ב-GROUP BY ואינה מאוגרגת. MySQL במצב `sql_mode` רלקסי מרשה זאת, אבל הערך שיוחזר ב-email הוא שרירותי.

**rn=1 לא דטרמיניסטי כשיש ties**: אם ORDER BY אינו ייחודי, שתי שורות עלולות לקבל rn=1 בהרצות שונות. הוסף תמיד primary key כ-tiebreaker אחרון (כמו `ORDER BY created_at ASC, signup_id ASC`).

**NULL ב-DISTINCT לעומת NULL בהשוואה**: ב-DISTINCT שתי שורות עם NULL באותה עמודה נחשבות זהות ואחת מוסרת. ב-WHERE הביטוי `col = NULL` תמיד מחזיר UNKNOWN (לא TRUE). בלבול בין הכללים יוביל לתוצאות שגויות.

## מתי זה לא משנה

כשהכפילויות הן חלק לגיטימי ממבנה הנתונים: בטבלאות audit log, CDC (Change Data Capture) ו-event streams, כל שורה מייצגת אירוע נפרד בזמן. "כפילות" שם היא זוג שינויים חוקי. מחיקת שורה תשבור את ה-history.

בראיונות: שאלות "ספור users ייחודיים" נפתרות עם COUNT(DISTINCT). שאלות "הצג את ה-X הראשון / האחרון / הגבוה ביותר לכל user" דורשות ROW_NUMBER().

## חיבור

יחידה זו משתמשת ב-window functions (ROW_NUMBER) מבלוק M2 ובידע ב-CTEs. היא סוגרת את עמוד sql-core בהיבט של ניקוי נתונים. היחידה הבאה היא m2-dedup-drill: שאלות DataLemur ממשיות שבהן תיישם את שתי הגישות תחת לחץ זמן.
