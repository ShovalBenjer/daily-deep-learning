# תאריך ושעה
כל "כמה משתמשים נרשמו החודש" ו-"הכנסות לפי שבוע" מסתיר DATE_TRUNC אחת.

## מה תדע בסוף
תוכל לחלץ שנה, חודש ויום שבוע מעמודת תאריך; לעגל תאריך לתחילת שבוע או חודש באמצעות DATE_TRUNC; לחשב הפרש ימים בין שני תאריכים. תכיר את חמש הפונקציות שחוזרות בכל בעיית cohort בראיון SQL.

## האינטואיציה

תאריכים הם מספרים שלמים בהסוואה. **DATE, תאריך** מאוחסן כמספר הימים מאז נקודת ייחוס קבועה. **TIMESTAMP, חותמת זמן** מאוחסן כמיקרושניות. בגלל זה חיסור שני תאריכים נותן מספר שלם:

```sql
'2026-08-09'::date - '2026-08-01'::date   -- 8
```

כשאתה שואל "כמה משתמשים נרשמו כל שבוע", אתה עוגל כל תאריך ל"יום שני" של השבוע שלו ואז מונה. DATE_TRUNC עושה את העיגול.

## ההגדרות המדויקות

### סוגי נתונים

| סוג | מה מאוחסן | דוגמה |
|---|---|---|
| **DATE** | שנה, חודש, יום | `2026-08-09` |
| **TIMESTAMP** | תאריך וזמן עד מיקרושניות | `2026-08-09 14:30:00` |
| **TIMESTAMPTZ** | TIMESTAMP עם אזור זמן | `2026-08-09 14:30:00+03` |
| **INTERVAL, מרווח** | פרק זמן | `7 days`, `1 month` |

### חמש הפונקציות הכרחיות

**CURRENT_DATE** ו-**NOW()** מחזירות את הזמן הנוכחי:

```sql
SELECT CURRENT_DATE;   -- 2026-08-09  (DATE)
SELECT NOW();          -- 2026-08-09 14:30:00+03  (TIMESTAMPTZ)
```

**DATE_TRUNC(unit, value), קיצוץ לתחילת יחידה** מחזירה TIMESTAMP שבה כל היחידות שמתחת ל-unit אופסו:

```sql
DATE_TRUNC('week',  '2026-08-09'::date)   -- 2026-08-03 (יום ב')
DATE_TRUNC('month', '2026-08-09'::date)   -- 2026-08-01
DATE_TRUNC('year',  '2026-08-09'::date)   -- 2026-01-01
```

**EXTRACT(field FROM value), חילוץ שדה** מחזירה מספר שלם:

```sql
EXTRACT(year  FROM '2026-08-09'::date)   -- 2026
EXTRACT(month FROM '2026-08-09'::date)   -- 8
EXTRACT(dow   FROM '2026-08-09'::date)   -- 0 (ראשון) עד 6 (שבת)
```

`DATE_PART('month', date)` זהה ל-`EXTRACT(month FROM date)`, שפה ישנה יותר.

**חיסור תאריכים** ב-PostgreSQL מחזיר INTEGER (ימים):

```sql
'2026-09-01'::date - '2026-08-09'::date   -- 23
```

**INTERVAL, מרווח** מאפשר חיבור וחיסור:

```sql
CURRENT_DATE - INTERVAL '30 days'        -- לפני 30 ימים
'2026-08-09'::date + INTERVAL '1 month'  -- 2026-09-09
```

## דוגמה מחושבת

שאלה: "ספור הרשמות חדשות לפי שבוע, מ-30 הימים האחרונים."

```sql
SELECT
    DATE_TRUNC('week', signed_up_at)::date   AS week_start,
    COUNT(*)                                  AS new_users
FROM users
WHERE signed_up_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1;
```

ניתוח שורה אחרי שורה:

1. `DATE_TRUNC('week', signed_up_at)`: גם `2026-08-07` וגם `2026-08-09` הופכים ל-`2026-08-03` (יום שני של אותו שבוע).
2. `::date` ממיר את תוצאת DATE_TRUNC מ-TIMESTAMP ל-DATE לנוחות הקריאה.
3. `WHERE signed_up_at >= CURRENT_DATE - INTERVAL '30 days'` מסנן שורות ישנות לפני ה-GROUP BY.
4. `GROUP BY 1` קיצור ל-"העמודה הראשונה ב-SELECT", כלומר week_start.
5. `COUNT(*)` סופר שורות לכל שבוע.

פלט לדוגמה:

| week_start | new_users |
|---|---|
| 2026-07-13 | 88 |
| 2026-07-20 | 102 |
| 2026-07-27 | 119 |
| 2026-08-03 | 74 |

## המקרה שמפיל את האינטואיציה

**אזורי זמן שוברים את ה-cohort.** משתמש שנרשם ב-`2026-08-09 23:30` ב-New York (UTC-4) הוא `2026-08-10 03:30` ב-UTC. אם ה-DB מאחסן UTC ואתה מריץ `DATE_TRUNC('day', signed_up_at)` בלי המרה, הוא יחשב כנרשם ב-10 באוגוסט.

פתרון:

```sql
DATE_TRUNC('day', signed_up_at AT TIME ZONE 'America/New_York')
```

`AT TIME ZONE` ממירה את ה-TIMESTAMP לאזור הרצוי לפני ה-truncation.

## טעויות נפוצות

**1. השוואה ישירה TIMESTAMP לעמודה DATE**:
```sql
WHERE signed_up_at = '2026-08-09'         -- שגוי: 14:30:00 != 00:00:00
WHERE signed_up_at::date = '2026-08-09'   -- נכון ב-PostgreSQL
-- או טוב יותר לביצועים:
WHERE signed_up_at >= '2026-08-09' AND signed_up_at < '2026-08-10'
```

**2. Function על עמודת index מבטל שימוש ב-index**:
```sql
WHERE EXTRACT(year FROM created_at) = 2026  -- full scan
WHERE created_at >= '2026-01-01'
  AND created_at < '2027-01-01'             -- index range scan
```

**3. DATE_TRUNC עוגל תמיד כלפי מטה, לא לסמוך.** `DATE_TRUNC('month', '2026-08-29')` מחזיר `2026-08-01`, לא `2026-09-01`.

**4. DATE_TRUNC מחזירה TIMESTAMP, לא DATE.** לעיתים צריך cast מפורש:
```sql
DATE_TRUNC('month', signed_up_at)          -- 2026-08-01 00:00:00 (TIMESTAMP)
DATE_TRUNC('month', signed_up_at)::date    -- 2026-08-01 (DATE)
```

## מתי זה לא משנה

כשכל לוגיקת הסינון הכרונולוגי נמצאת בשכבת האפליקציה ולא ב-SQL, פונקציות אלו פחות דרושות. ב-pandas יש `.dt.floor`, `.dt.month`; ב-Polars יש `.dt.truncate`. בראיון SQL מצפים שתשתמש בפונקציות SQL ישירות גם אם ה-ORM הרגיל עושה את זה בשבילך.

## חיבור

DATE_TRUNC היא הגרסה הכרונולוגית של GROUP BY: במקום לקבץ לפי ערך מדויק, מקבצים לפי תקופה. היא חוזרת ב:

- **Window functions**: `PARTITION BY DATE_TRUNC('week', event_at)` לחלוקה לחלונות שבועיים.
- **Gaps and islands**: בדיקת רצף ימים ברצף משתמשת ב-`event_at::date - ROW_NUMBER()` ומחייבת cast מוקדם ל-DATE.

```quiz
{"id":"u-m2-date-time-q1","tree":"systems","skill":"sql","q":"מה מחזירה הקריאה DATE_TRUNC('month', '2026-08-09'::date)?","options":["2026-08-09","2026-08-01","2026-09-01","8"],"answer":1,"explain":"DATE_TRUNC עוגל תמיד כלפי מטה לתחילת היחידה הנתונה. 'month' פירושו תחילת החודש: 2026-08-01. לא 2026-09-01 (שזה הסוף), ולא 8 (שזה EXTRACT ולא DATE_TRUNC)."}
```

```quiz
{"id":"u-m2-date-time-q2","tree":"systems","skill":"sql","q":"איזו מהקריאות הבאות מחזירה את מספר החודש (8) מהתאריך '2026-08-09'::date?","options":["DATE_TRUNC('month', '2026-08-09')","EXTRACT(month FROM '2026-08-09'::date)","'2026-08-09'::date - INTERVAL '1 month'","NOW()"],"answer":1,"explain":"EXTRACT(month FROM date) מחזיר את שדה החודש כמספר שלם: 8. DATE_TRUNC מחזיר תאריך שלם (2026-08-01), לא מספר. החיסור מ-INTERVAL מחזיר תאריך חדש, לא מספר."}
```

```widget
{"type":"algviz","algo":"partition-row","title":"DATE_TRUNC: צפה כיצד תאריכים מתקבצים לקבוצות כשמקצצים ליחידת זמן"}
```

```concepts
{"items":[{"id":"c-date-trunc","t":"DATE_TRUNC","he":"קיצוץ תאריך","d":"מחזירה TIMESTAMP שבה כל יחידות הזמן שמתחת ל-unit אופסו; תמיד עוגלת כלפי מטה","rel":["c-timestamp","c-extract"],"node":"sql-core"},{"id":"c-timestamp","t":"TIMESTAMP","he":"חותמת זמן","d":"סוג נתונים המאחסן תאריך וזמן עד רמת מיקרושניות; TIMESTAMPTZ מוסיף אזור זמן","rel":["c-date-trunc","c-interval"],"node":"sql-core"},{"id":"c-extract","t":"EXTRACT","he":"חילוץ שדה","d":"מחלצת שדה אחד (year, month, dow, doy) מתאריך או TIMESTAMP ומחזירה מספר שלם","rel":["c-date-trunc"],"node":"sql-core"},{"id":"c-interval","t":"INTERVAL","he":"מרווח זמן","d":"סוג נתונים המייצג פרק זמן ('7 days', '1 month'); מאפשר חיבור וחיסור מתאריכים","rel":["c-timestamp","c-date-trunc"],"node":"sql-core"}]}
```
