# CTE ו-CTE רקורסיבי
עם WITH, שאילתה מקוננת מקבלת שם ואפשר לשאול אותה כמה פעמים בלי להעתיק כלום.

## מה תדע בסוף
תכתוב שאילתות WITH עם CTE אחד ויותר, תסנן תוצאות window function בעזרת CTE, תכתוב CTE רקורסיבי שעובר על היררכיה, ותדע מתי CTE פוגע בביצועים.

## האינטואיציה

תאר לעצמך שאתה כותב שאילתה שצריכה פעמיים את אותה רשימה של לקוחות שרכשו יותר מ-500 שקל. אפשר לכתוב את תת-השאילתה פעמיים, מה שמוביל לכפילות, קריאה קשה ותחזוקה בעייתית. **CTE, ביטוי טבלה משותף**, מאפשר לתת שם לתוצאה ולהשתמש בה כאילו היא טבלה רגילה בהמשך אותה שאילתה.

זה בדיוק כמו משתנה בשפת תכנות: מגדירים פעם אחת, קוראים כמה פעמים.

## ההגדרות המדויקות

**CTE, Common Table Expression, ביטוי טבלה משותף**: result set זמני עם שם שמוגדר בתחילת שאילתה עם סעיף WITH ותקף לאורך אותה שאילתה בלבד.

```sql
WITH cte_name AS (
    SELECT ...
    FROM ...
    WHERE ...
)
SELECT *
FROM cte_name
WHERE ...;
```

**CTEs מרובים**: מופרדים בפסיק, כל אחד יכול להתבסס על הקודם:

```sql
WITH
  a AS (SELECT ...),
  b AS (SELECT ... FROM a JOIN ...)
SELECT * FROM b;
```

**CTE רקורסיבי, Recursive CTE**: CTE שמתייחס לעצמו. מורכב מ:

- **Anchor term, חוליית עוגן**: שאילתה שאינה רקורסיבית. מספקת את שורות ההתחלה.
- **Recursive term, חוליה רקורסיבית**: שאילתה שקוראת ל-CTE עצמו. מוסיפה שורות בכל איטרציה.
- השניים מחוברים ב-`UNION ALL`.

```sql
WITH RECURSIVE counter(n) AS (
    SELECT 1                   -- anchor term
    UNION ALL
    SELECT n + 1               -- recursive term
    FROM counter
    WHERE n < 5
)
SELECT n FROM counter;
-- תוצאה: 1, 2, 3, 4, 5
```

מנוע ה-SQL מריץ את ה-anchor term פעם אחת, ואז מריץ את ה-recursive term שוב ושוב על תוצאות האיטרציה הקודמת, עד שהאיטרציה מחזירה אפס שורות.

הערה: ב-PostgreSQL הכינוי הוא `WITH RECURSIVE`; ב-SQL Server ו-SQLite מספיק `WITH` (הרקורסיה מזוהה אוטומטית); ב-MySQL נדרש `WITH RECURSIVE`.

## דוגמה מחושבת

**מקרה 1: סינון תוצאת window function**

בעיה שכיחה בראיונות: מצא את נציג המכירות המוביל בכל אזור. לא ניתן לסנן window function ישירות ב-WHERE (כפי שנלמד ביחידה הקודמת), אבל CTE פותר את זה:

```sql
WITH ranked AS (
    SELECT
        rep,
        region,
        amount,
        ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) AS rn
    FROM sales
)
SELECT rep, region, amount
FROM ranked
WHERE rn = 1;
```

תוצאה (מהדוגמה ביחידת window functions):

| rep  | region | amount |
|------|--------|--------|
| Bob  | North  | 500    |
| Dana | South  | 400    |

ה-CTE `ranked` מחשב את הדירוג; ה-SELECT החיצוני מסנן רק `rn = 1`.

**מקרה 2: CTE רקורסיבי על היררכיה**

טבלת עובדים עם מנהל (`manager_id`):

```
id | name    | manager_id
1  | Shoval  | NULL
2  | Dana    | 1
3  | Ori     | 2
4  | Mia     | 2
```

שאילתה שמחזירה את כל הכפופים ל-Shoval, בכל הרמות:

```sql
WITH RECURSIVE org AS (
    -- anchor: הנקודה ההתחלתית
    SELECT id, name, manager_id, 0 AS depth
    FROM employees
    WHERE id = 1

    UNION ALL

    -- recursive term: ירידה רמה אחת בכל פעם
    SELECT e.id, e.name, e.manager_id, org.depth + 1
    FROM employees e
    JOIN org ON e.manager_id = org.id
)
SELECT name, depth FROM org ORDER BY depth, name;
```

תוצאה:

| name   | depth |
|--------|-------|
| Shoval | 0     |
| Dana   | 1     |
| Mia    | 2     |
| Ori    | 2     |

האיטרציה הראשונה מחזירה את Shoval; השנייה מוצאת את Dana שמנהלה הוא Shoval; השלישית מוצאת את Ori ו-Mia שמנהלם הוא Dana; הרביעית מחזירה 0 שורות ומסיימת.

## המקרה שמפיל את האינטואיציה

**CTE כגדר אופטימיזציה ב-PostgreSQL לפני גרסה 12.**

עד PostgreSQL 11 (כולל), CTE תמיד חושב בנפרד ותוצאתו אוחסנה בזיכרון (materialization). השאילתה החיצונית לא יכלה לדחוף תנאי WHERE פנימה ל-CTE (predicate pushdown). ב-PostgreSQL 12 הוסף `AS MATERIALIZED` ו-`AS NOT MATERIALIZED` לשליטה מפורשת; ברירת המחדל השתנתה ל-inline (ללא חומרה).

תוצאה מעשית: שאילתה שרצה מהר ב-PostgreSQL 12 יכולה להיות איטית ב-11 בגלל שהמנוע מחשב את כל ה-CTE ולא מנצל index.

**SQL Server תמיד מוציל CTE**: גם ב-SQL Server CTE מוציל כברירת מחדל בגרסאות ישנות, אם כי ה-optimizer לעיתים מחליט בכל זאת להציב inline. ההתנהגות תלויה-גרסה ולא ניתן לסמוך עליה ללא בדיקה.

הפתרון: לביצועים קריטיים, בדוק את ה-query plan. אם ה-CTE חושב יותר פעמים ממה שציפית, שקול `temp table` במקום.

## טעויות נפוצות

1. **רקורסיה אינסופית**: שכחת תנאי עצירה ב-WHERE של ה-recursive term, או שהנתונים מכילים מעגל (עובד שמנהלו הוא עצמו). PostgreSQL ו-SQL Server יגבילו את עומק הרקורסיה ויזרקו שגיאה; MySQL גם כן. הפתרון: תמיד הוסף WHERE או `MAXRECURSION` ב-SQL Server.

2. **UNION במקום UNION ALL ב-recursive CTE**: `UNION` בודק כפילויות בכל איטרציה, מה שמאיט מאד ומשנה את ההתנהגות. ב-recursive CTE כמעט תמיד רוצים `UNION ALL`.

3. **מחשבים שה-CTE מהיר יותר מתת-שאילתה**: CTE הוא בעיקר כלי קריאות. בגרסאות שבהן הוא materialized הוא יכול להיות איטי יותר מ-subquery שה-optimizer יכול להציב inline.

4. **שימוש ב-CTE כשצריך temp table**: אם אותו CTE נשאל מאות פעמים באותה transaction, כדאי לחשב אותו פעם אחת לתוך temp table ולהוסיף index.

5. **שכחת הפסיק בין CTEs מרובים**: `WITH a AS (...) b AS (...)` גורמת לשגיאת syntax. צריך פסיק: `WITH a AS (...), b AS (...)`.

## מתי זה לא משנה

כשצריך את התוצאה פעם אחת בלבד ואין window function לסנן, subquery פשוטה לעיתים קריאה לא פחות. קצר יותר ואין עלות materialization:

```sql
SELECT * FROM (SELECT rep, amount FROM sales WHERE amount > 400) s;
-- לא חייבים CTE לזה
```

בראיון: אם שאלת ה-SQL מבקשת "top-N per group" או ניווט בהיררכיה, CTE הוא הכלי הנכון. לסינון פשוט, subquery מספיקה.

## חיבור

CTE מחבר בין **m2-window-functions** (שמצריך CTE לסינון) לבין **m2-subqueries** (שבה CTE מחליף subquery מקוננת לשיפור קריאות). לאחר יחידה זו: **m2-subqueries** תרחיב את ההבדל בין correlated ל-uncorrelated subquery.

```quiz
{"id":"u-m2-ctes-q1","tree":"systems","skill":"sql","q":"מהו הסדר הנכון של סעיפי WITH ו-SELECT?","options":["SELECT קודם, ואז WITH","WITH קודם, ואז SELECT","אפשר לשים WITH בכל מקום בשאילתה","WITH ו-SELECT צריכים להיות בשני קבצים נפרדים"],"answer":1,"explain":"CTE מוגדר תמיד לפני ה-SELECT שמשתמש בו: WITH name AS (...) SELECT ... FROM name. זה מה שמאפשר ל-SELECT להתייחס ל-CTE כאילו הוא טבלה רגילה."}
```

```quiz
{"id":"u-m2-ctes-q2","tree":"systems","skill":"sql","q":"מה ההבדל בין UNION לבין UNION ALL בתוך CTE רקורסיבי?","options":["אין הבדל, אפשר להשתמש בשניהם","UNION ALL מהיר יותר ושומר שורות כפולות; UNION בודק כפילויות בכל איטרציה ומאיט","UNION ALL אסור ב-recursive CTE","UNION שומר כפילויות ו-UNION ALL מסיר אותן"],"answer":1,"explain":"ב-recursive CTE כמעט תמיד רוצים UNION ALL. UNION מבצע distinct בכל איטרציה, מה שמאיט מאד ולעיתים שובר את הלוגיקה כשיש שורות זהות בכוונה."}
```

```quiz
{"id":"u-m2-ctes-q3","tree":"systems","skill":"sql","q":"למה לא ניתן לכתוב WHERE ROW_NUMBER() OVER (...) = 1 ישירות, ואיזה פתרון CTE נותן?","options":["כי ROW_NUMBER מחזיר טקסט ולא מספר","כי window function מחושבת אחרי WHERE; CTE מאפשר לחשב אותה בשלב הפנימי ואז לסנן בחיצוני","כי OVER אסור עם ORDER BY","כי WHERE מאפשר רק תנאי על עמודות גולמיות"],"answer":1,"explain":"סדר ביצוע SQL: FROM, WHERE, SELECT. Window function חיה ב-SELECT, ולכן WHERE לא יכול להשתמש בתוצאתה. CTE שם את ה-SELECT הפנימי (עם window function) בתוך WITH, ומאפשר לשאילתה החיצונית לסנן בWHERE."}
```

```concepts
{"items":[{"id":"c-cte","t":"Common Table Expression","he":"ביטוי טבלה משותף","d":"result set זמני עם שם, מוגדר ב-WITH ותקף לאורך אותה שאילתה","rel":["c-with-clause","c-recursive-cte"],"node":"sql-core"},{"id":"c-with-clause","t":"WITH clause","he":"סעיף WITH","d":"מגדיר CTE אחד או יותר לפני ה-SELECT; כל CTE יכול להתייחס לקודמים","rel":["c-cte","c-recursive-cte"],"node":"sql-core"},{"id":"c-recursive-cte","t":"Recursive CTE","he":"CTE רקורסיבי","d":"CTE המכיל anchor term וrecursive term מחוברים ב-UNION ALL; מאפשר ניווט בהיררכיות וייצור רצפים","rel":["c-cte","c-anchor-term"],"node":"sql-core"},{"id":"c-anchor-term","t":"Anchor term","he":"חוליית עוגן","d":"החלק הלא-רקורסיבי של recursive CTE; מייצר את השורות ההתחלתיות","rel":["c-recursive-cte"],"node":"sql-core"}]}
```
