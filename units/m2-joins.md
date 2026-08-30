# צירופים ואיך הם נכשלים
שאילתה שמחזירה שורות כפולות ממקור שמכיל כל אחת פעם אחת היא באג JOIN.

## מה תדע בסוף
תדע להבחין בין INNER, LEFT, RIGHT, FULL OUTER ו-CROSS JOIN; תזהה מה קורה כשמפתח ה-JOIN אינו ייחודי; תוכל לאתר שורות שנעלמו בגלל NULL.

## האינטואיציה
דמיין שתי רשימות: עובדים ומחלקות. **INNER JOIN** הוא ועידה בחדר קטן: רק מי שמופיע בשתי הרשימות נכנס פנימה. **LEFT JOIN** הוא שיחת יצוא: כל עובד מקבל כיסא, ואם אין לו מחלקה הכיסא ממולו נשאר ריק (NULL). RIGHT הוא אותו רעיון עם הכיוון הפוך. **FULL OUTER JOIN** הוא האיחוד: כולם נכנסים לחדר, ועמודות שאין להם מקבילה מתמלאות ב-NULL. **CROSS JOIN** הוא שוק סיני: כל עובד פוגש כל מחלקה, ויוצא זוג אחד לכל שילוב.

## ההגדרות המדויקות

**INNER JOIN, צירוף פנימי**: מחזיר בדיוק את השורות שיש להן התאמה בשתי הטבלאות על פי תנאי ה-ON.

**LEFT [OUTER] JOIN, צירוף שמאלי**: מחזיר את כל שורות הטבלה השמאלית. שורות שאין להן התאמה בטבלה הימנית מקבלות NULL בכל עמודות הטבלה הימנית.

**RIGHT [OUTER] JOIN, צירוף ימני**: כמו LEFT, אך כל שורות הטבלה הימנית נשמרות.

**FULL OUTER JOIN, צירוף חיצוני מלא**: שומר שורות משתי הטבלאות; NULL ממלא את הצד שלא נמצאה לו התאמה.

**CROSS JOIN, מכפלה קרטזית**: כל שורה בטבלה השמאלית מצורפת לכל שורה בטבלה הימנית. תוצאה: \(|L| \times |R|\) שורות ללא תנאי סינון.

## דוגמה מחושבת

```sql
-- employees (id, name, dept_id)
-- 1  Alice  10
-- 2  Bob    10
-- 3  Carol  NULL   -- לא שייכת למחלקה

-- departments (dept_id, dept_name)
-- 10  Engineering
-- 20  Marketing    -- אין עובדים כאן

SELECT e.name, d.dept_name
FROM   employees AS e
LEFT JOIN departments AS d ON e.dept_id = d.dept_id;
```

תוצאה:

| name  | dept_name   |
|-------|-------------|
| Alice | Engineering |
| Bob   | Engineering |
| Carol | NULL        |

Carol שמורה בגלל LEFT. Marketing נעלמת כי אף עובד לא מצביע אליה.

INNER JOIN: רק Alice ו-Bob.
FULL OUTER JOIN: מוסיף שורה רביעית `NULL | Marketing`.

```sql
-- בדיקה: מי ממחלקות ש"עזב" (ב-departments אבל לא ב-employees)?
SELECT d.dept_name
FROM   departments AS d
LEFT JOIN employees AS e ON d.dept_id = e.dept_id
WHERE  e.id IS NULL;   -- Marketing
```

## המקרה שמפיל את האינטואיציה

JOIN על מפתח שאינו ייחודי מכפיל שורות.

```sql
-- orders (order_id, customer_id)
-- 100  5
-- 101  5

-- customers (customer_id, name)
-- 5  Dana

SELECT c.name, o.order_id
FROM   customers AS c
JOIN   orders    AS o ON c.customer_id = o.customer_id;
```

תוצאה:

| name | order_id |
|------|----------|
| Dana | 100      |
| Dana | 101      |

שתי שורות לDana, למרות ש-customers מכיל אותה פעם אחת. `orders` הוא הצד שמכיל יותר משורה אחת לאותו customer_id.

אם אחר-כך כותבים `SUM(salary)` על תוצאת JOIN שכוללת כפל, מקבלים סכום מוגדל שגוי. הפתרון: לוודא שהעמודה שמצרפים עליה היא PRIMARY KEY בצד אחד לפחות, או לאגד לפני ה-JOIN.

## טעויות נפוצות

1. **WHERE הופך LEFT ל-INNER**: `LEFT JOIN departments AS d ... WHERE d.dept_name = 'Engineering'` מסנן את שורות ה-NULL ומבטל את ה-LEFT. הפתרון: העבר את התנאי ל-ON, או השתמש ב-`WHERE d.dept_name = 'Engineering' OR d.dept_name IS NULL`.

2. **JOIN לפני GROUP BY מכפיל**: אם מצרפים טבלה שמרחיבה שורות ואז מחשבים SUM, הסכום גדל בהתאם לכפל. בדוק תמיד `COUNT(*)` לפני ולאחר JOIN בשאילתות aggregation.

3. **CROSS JOIN בשגגה**: `FROM a, b` ללא ON הוא CROSS JOIN. בבסיסי נתונים של מיליוני שורות זה קוטל שרתים.

4. **NULL לא שווה ל-NULL**: `ON a.id = b.id` לא יצרף שורות שבהן שני הצדדים הם NULL, כי `NULL = NULL` מחזיר UNKNOWN ולא TRUE.

## מתי זה לא משנה

כשעובדים עם טבלה יחידה שאין לה קשרי מפתח-זר, JOIN כלל אינו רלוונטי.

בראיון: "ה-INNER JOIN הוא ברירת המחדל הנכונה כשיודעים שהשדה הזר לעולם לא NULL. LEFT JOIN נכון כשצריך לשמור שורות גם בהיעדר התאמה." אם מראיין שואל "מתי תשתמש ב-FULL OUTER", התשובה הנכונה היא "כשמחפש פערים משני הכיוונים, למשל user_id שקיים ב-events אבל לא ב-users, ולהיפך."

```widget
{"type":"algviz","algo":"join-matcher","title":"JOIN Matcher: צפה כיצד שורות מתאימות ב-LEFT / INNER / FULL OUTER"}
```

## חיבור

m2-joins הוא הבסיס לכל M2. אגרגציה פועלת על מה ש-JOIN מחזיר, window functions פועלות על אותה קבוצת שורות, ו-CTEs מפשטות JOIN מורכבים. אחרי שמבינים שMFOUTER JOIN הוא כלי לגילוי פערים ולא סתם "יותר שורות", כל שאר ה-M2 נופל למקום.

הבא: **m2-aggregation** (אגרגציה וקיבוץ).

```quiz
{"id":"u-m2-joins-q1","tree":"systems","skill":"sql","q":"איזה סוג JOIN מחזיר את כל השורות מהטבלה השמאלית, גם כשאין להן התאמה בטבלה הימנית?","options":["INNER JOIN","LEFT JOIN","CROSS JOIN","RIGHT JOIN"],"answer":1,"explain":"LEFT JOIN שומר את כל שורות הצד השמאלי ומוסיף NULL בעמודות הצד הימני היכן שאין התאמה."}
```

```quiz
{"id":"u-m2-joins-q2","tree":"systems","skill":"sql","q":"לטבלת A יש 4 שורות ולטבלת B יש 3 שורות; כמה שורות יחזיר CROSS JOIN ביניהן?","options":["3","4","7","12"],"answer":3,"explain":"CROSS JOIN מחזיר מכפלה קרטזית: כל שורה מ-A מצורפת לכל שורה מ-B, כך |A|×|B|=4×3=12."}
```

```concepts
{"items":[{"id":"c-inner-join","t":"INNER JOIN","he":"צירוף פנימי","d":"מחזיר רק שורות שיש להן התאמה בשתי הטבלאות","rel":["c-left-join","c-null-in-join"],"node":"sql-core"},{"id":"c-left-join","t":"LEFT JOIN","he":"צירוף שמאלי","d":"שומר את כל שורות הטבלה השמאלית; שורות ללא התאמה מקבלות NULL בעמודות הצד הימני","rel":["c-inner-join","c-full-outer-join"],"node":"sql-core"},{"id":"c-full-outer-join","t":"FULL OUTER JOIN","he":"צירוף חיצוני מלא","d":"שורות מכל טבלה; NULL ממלא את הצד שאין לו זוג","rel":["c-left-join","c-inner-join"],"node":"sql-core"},{"id":"c-cross-join","t":"CROSS JOIN","he":"מכפלה קרטזית","d":"כל שילוב של שורה שמאלית ושורה ימנית; מחזיר |L|×|R| שורות","rel":["c-inner-join"],"node":"sql-core"},{"id":"c-null-in-join","t":"NULL in JOIN","he":"NULL בצירוף","d":"NULL שווה לאף ערך כולל NULL עצמו; תנאי WHERE מסנן שורות NULL בלי אזהרה","rel":["c-left-join","c-inner-join"],"node":"sql-core"}]}
```
