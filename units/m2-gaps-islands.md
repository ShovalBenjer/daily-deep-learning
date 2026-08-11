# פערים ואיים
כשהיומן מחפש פגישה פנויה, הוא פותר בראש את שאלת הפערים; כשמונה ימים רצופים של login, הוא סופר אי. SQL עושה את שניהם עם טריק חיסור אחד.

## מה תדע בסוף
תוכל לזהות טבלה שיש בה ריצות רצופות (איים) או ערכים חסרים (פערים), לכתוב שאילתה שמחשבת `id - ROW_NUMBER()` כדי לתייג כל אי, ולחלץ את תחילת וסוף כל אי עם `MIN` ו-`MAX` בתוך `GROUP BY`.

## האינטואיציה
תדמיין רצועת מדבקות ממוספרות מ-1 עד 10. יש לך מדבקות 1, 2, 3, ואחר כך חסרות 4 ו-5, ואחר כך יש לך 6, 7, 8, ואחר כך חסרות 9 ו-10.

**האיים** הם הבלוקים הרצופים: {1,2,3} ו-{6,7,8}.
**הפערים** הם החלקים שחסרים: {4,5} ו-{9,10}.

הטריק שמאפשר ל-SQL לזהות ריצה רצופה: `ROW_NUMBER()` עולה ב-1 עם כל שורה בדיוק כמו ה-id כאשר הוא רצוף. אם מחסירים אחד מהשני, מתקבל ערך קבוע לכל האי כולו.

| id | rn | id - rn |
|----|----|---------| 
| 1  | 1  | 0       |
| 2  | 2  | 0       |
| 3  | 3  | 0       |
| 6  | 4  | 2       |
| 7  | 5  | 2       |
| 8  | 6  | 2       |

שורות {1,2,3} נותנות `grp = 0`. שורות {6,7,8} נותנות `grp = 2`. קיבוץ לפי `grp` מחלץ כל אי.

## ההגדרות המדויקות

**אי, island** הוא ריצה רצופה של ערכים בעמודה ממוספרת. "רצוף" משמעו הפרש של בדיוק 1 בין ערך לעוקבו.

**פער, gap** הוא ערך או טווח ערכים שחסר מהרצף. אם id = 5 ואחריו id = 9, הפער הוא {6, 7, 8}.

**הטריק: `id - ROW_NUMBER() OVER (ORDER BY id)`** מניב ערך קבוע לכל שורה בריצה רצופה. כשיש פער, ה-id קופץ בגודל הפער אך ה-rn עולה ב-1 בלבד, ולכן הפרש גדל. כל קבוצה בעלת אותו הפרש היא אי שונה.

### מציאת איים

```sql
SELECT
  MIN(id)  AS island_start,
  MAX(id)  AS island_end,
  COUNT(*) AS island_size
FROM (
  SELECT id,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM   my_table
) t
GROUP BY grp
ORDER BY island_start;
```

### מציאת פערים עם LEAD

```sql
SELECT
  id + 1      AS gap_start,
  next_id - 1 AS gap_end
FROM (
  SELECT id,
         LEAD(id) OVER (ORDER BY id) AS next_id
  FROM   my_table
) t
WHERE next_id IS NOT NULL
  AND next_id > id + 1;
```

`LEAD(id)` מחזיר את ה-id של השורה הבאה. כשהיא גדולה מ-`id + 1`, יש פער.

### מציאת פערים עם generate_series (PostgreSQL)

```sql
SELECT s.n AS missing_id
FROM   generate_series(
         (SELECT MIN(id) FROM my_table),
         (SELECT MAX(id) FROM my_table)
       ) s(n)
LEFT JOIN my_table t ON t.id = s.n
WHERE t.id IS NULL;
```

גישה זו קריאה יותר אך עשויה להיות איטית ברצפים ארוכים מאוד.

## דוגמה מחושבת

טבלת `orders` עם `order_id`: 101, 102, 103, 106, 107, 110.

**שלב 1: ROW_NUMBER**

```sql
SELECT order_id,
       ROW_NUMBER() OVER (ORDER BY order_id) AS rn,
       order_id - ROW_NUMBER() OVER (ORDER BY order_id) AS grp
FROM orders;
```

תוצאה:

```
order_id | rn | grp
101      |  1 | 100
102      |  2 | 100
103      |  3 | 100
106      |  4 | 102
107      |  5 | 102
110      |  6 | 104
```

**שלב 2: GROUP BY grp**

```sql
SELECT MIN(order_id) AS island_start,
       MAX(order_id) AS island_end
FROM (
  SELECT order_id,
         order_id - ROW_NUMBER() OVER (ORDER BY order_id) AS grp
  FROM orders
) t
GROUP BY grp
ORDER BY island_start;
```

תוצאה:

```
island_start | island_end
101          | 103
106          | 107
110          | 110
```

שלוש ריצות: {101-103}, {106-107}, {110}. הפערים: {104,105} ו-{108,109}.

```widget
{"type":"algviz","algo":"gaps-islands","title":"id - ROW_NUMBER: צפה כיצד grp נשאר קבוע בתוך כל אי וקופץ בכל פער"}
```

## המקרה שמפיל את האינטואיציה

הטריק עובד רק כשה-id שלם, ייחודי, ו-`ROW_NUMBER` מסודר לפי id בדיוק. כפילויות מבלבלות אותו.

דוגמה: אם `orders` מכיל `order_id` = 102, 102, 103, ה-rn עולה ב-1 לכל שורה, אך ה-id עומד על מקומו:

```
order_id | rn | grp
102      |  1 | 101
102      |  2 | 100
103      |  3 | 100
```

השורה הראשונה עם 102 קיבלה `grp = 101` והשניה `grp = 100`, אף שהן "אותו" ערך. הפתרון: הוסף `SELECT DISTINCT id` לפני שאילתת הפנים.

## טעויות נפוצות

1. **ORDER BY בתוך OVER לא תואם לסדר החיצוני** - אם `GROUP BY grp` מסודר אחרת מ-`ORDER BY id`, ה-grp נכון אך הפלט מבלבל. תמיד הוסף `ORDER BY island_start` בחוץ.

2. **החלת הטריק על timestamp או float** - `timestamp - ROW_NUMBER()` הוא שגיאת type. צריך `EXTRACT(EPOCH FROM ts)::int` קודם, או לעבוד עם LAG/LEAD ישירות.

3. **שוכחים NULL** - שורות שה-id שלהן NULL מקבלות ROW_NUMBER אבל `NULL - rn = NULL`, ולכן `grp = NULL`. הן מתכנסות לאי NULL משלהן. הוסף `WHERE id IS NOT NULL` בשאילתת הפנים.

4. **NOT IN עם תת-שאילתה שמחזירה NULL** - בגישה שמחפשת פערים עם NOT IN, אם הטבלה מכילה NULL, כל ה-NOT IN מחזיר ריק. העדף LEFT JOIN ... WHERE IS NULL על פני NOT IN.

5. **מניחים שה"פער" הוא תמיד 1** - בנתונים שה-id קופץ ב-10 בכוונה (session blocks, batch IDs), "פער" של 5 עשוי להיות נורמלי. הגדרת gap תלויה בדומיין ולא ב-SQL.

## מתי זה לא משנה

כשה-primary key הוא UUID4 או hash, אין סדר טבעי ואין משמעות ל"רצף". הטריק רלוונטי רק לעמודות שלמות עם סמנטיקה סדרתית: order numbers, session IDs, audit log sequence numbers, תאריכים ביחידות שלמות.

כשרוצים לדעת רק אם **שורה מסוימת** פותחת פער, LAG/LEAD לבד מספיק ואין צורך ב-GROUP BY:

```sql
WHERE LEAD(id) OVER (ORDER BY id) > id + 1
```

בראיון: "מצא users שדילגו על login ביום" היא שאלת gaps. "מצא תקופות שבהן המשתמש היה פעיל ברציפות" היא שאלת islands. שתיהן נפתרות עם ROW_NUMBER או LAG/LEAD; ה-interviewer מחפש שתזהה את הטריק.

## חיבור

יחידה זו שייכת לבלוק M2 ולנוד `sql-core` בעץ `systems`. היא נשענת על `ROW_NUMBER` ו-`LAG/LEAD` מיחידת window functions, ועל CTEs לצירוף שאילתות מקוננות. היחידה הבאה `m2-gaps-islands-drill` מתרגלת את הטריק על בעיות DataLemur-style עם partition ועם timestamp.

```quiz
{"id":"u-m2-gaps-islands-q1","tree":"systems","skill":"sql","q":"Table `t` has id values 3, 4, 5, 8, 9. You compute id - ROW_NUMBER() OVER (ORDER BY id) AS grp. What grp values do you get?","options":["0, 0, 0, 0, 0","2, 2, 2, 4, 4","2, 2, 2, 5, 5","3, 3, 3, 4, 4"],"answer":1,"explain":"rn goes 1,2,3,4,5. id - rn: 3-1=2, 4-2=2, 5-3=2, 8-4=4, 9-5=4. The first island {3,4,5} gets grp=2 and the second island {8,9} gets grp=4."}
```

```quiz
{"id":"u-m2-gaps-islands-q2","tree":"systems","skill":"sql","q":"After computing LEAD(id) OVER (ORDER BY id) AS next_id, which WHERE clause correctly selects rows where a gap follows?","options":["WHERE next_id IS NULL","WHERE next_id > id + 1","WHERE next_id = id + 1","WHERE next_id - id = 0"],"answer":1,"explain":"A gap exists when the next id is not the immediate successor. next_id > id + 1 catches any skip of one or more values. IS NULL only catches the last row; the equality checks catch consecutive rows, not gaps."}
```

```fillin
{"id":"u-m2-gaps-islands-f1","tree":"systems","skill":"sql","prompt":"Complete the expression that assigns each row to its island group (column name: id):\n\nSELECT id, id - ________ OVER (ORDER BY id) AS grp FROM t;","answer":"ROW_NUMBER()","alt":["row_number()","ROW_NUMBER ()"],"explain":"Subtracting ROW_NUMBER() from a sequential integer id produces a constant for every consecutive run. This constant becomes the GROUP BY key that collects each island."}
```

```concepts
{"items":[{"id":"c-gaps-islands","t":"Gaps and islands","he":"פערים ואיים","d":"מחלקה של שאילתות SQL לזיהוי ריצות רצופות (איים) ומקטעים חסרים (פערים) ברצף שלם","rel":["c-row-number","c-lag-lead"],"node":"sql-core"},{"id":"c-island-subtraction","t":"Island subtraction trick","he":"טריק חיסור האי","d":"id - ROW_NUMBER() OVER (ORDER BY id) = קבוע לכל שורה בריצה רצופה; GROUP BY ערך זה אוסף כל אי","rel":["c-row-number","c-gaps-islands"],"node":"sql-core"}]}
```
