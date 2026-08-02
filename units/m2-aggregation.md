# אגרגציה וקיבוץ
COUNT(*) סופר שורות; COUNT(עמודה) מדלג על NULL; SUM מדלגת על NULL בשקט לחלוטין.

## מה תדע בסוף
תכתוב שאילתות GROUP BY עם פונקציות COUNT, SUM, AVG, MIN, MAX; תבין מתי להשתמש ב-HAVING לעומת WHERE; תדע מה קורה ל-NULL בתוך כל פונקציית אגרגציה.

## האינטואיציה

דמיין מחסן דואר. אלפי מכתבים מגיעים כל יום. המיין לפי עיר (GROUP BY) מניח כל מכתב בערימה נפרדת. COUNT() סופר כמה מכתבים בכל ערימה. SUM() שוקל אותן. AVG() מחשב את המשקל הממוצע. אחרי שכל הערימות מוכנות, מסנן ב-HAVING את הערמות הגדולות מ-100 מכתב.

WHERE, לעומת זאת, הוא השומר בפתח: הוא עוצר מכתבים פגומים לפני שנכנסים למחסן. HAVING הוא המנהל שבוחן את הערימות המוכנות בסוף תהליך המיון.

## ההגדרות המדויקות

**Aggregate function, פונקציית אגרגציה**: פונקציה שמקבלת קבוצת ערכים ומחזירה ערך סקלרי אחד.

הפונקציות הסטנדרטיות:

| פונקציה | מה היא עושה | NULL |
|---------|------------|------|
| COUNT(*) | סופר כל השורות בקבוצה | לא מדלגת |
| COUNT(col) | סופר שורות שבהן col אינה NULL | מדלגת |
| COUNT(DISTINCT col) | סופר ערכים שונים ב-col | מדלגת |
| SUM(col) | מסכם את כל הערכים | מדלגת, מחזירה NULL אם הקבוצה ריקה |
| AVG(col) | ממוצע: SUM(col)/COUNT(col) | מדלגת |
| MIN(col) | הערך הקטן ביותר | מדלגת |
| MAX(col) | הערך הגדול ביותר | מדלגת |

**GROUP BY, קיבוץ**: הסעיף שמחלק את שורות הטבלה לקבוצות. כל שורה ב-SELECT חייבת להיות עמודת GROUP BY או פונקציית אגרגציה.

**HAVING, סינון קבוצות**: מסנן קבוצות אחרי האגרגציה. שוני מ-WHERE: WHERE פועל על שורות בודדות לפני GROUP BY, HAVING פועל על תוצאת הקבוצות.

**סדר הביצוע (לא סדר הכתיבה)**:
\[ \text{FROM} \to \text{WHERE} \to \text{GROUP BY} \to \text{HAVING} \to \text{SELECT} \to \text{ORDER BY} \to \text{LIMIT} \]

## דוגמה מחושבת

```sql
-- orders (order_id, product, amount, customer_id, status)
-- 1  'laptop'  1200  7  'shipped'
-- 2  'mouse'    25   7  'shipped'
-- 3  'laptop'  1200  9  'pending'
-- 4  'cable'    15   9  'shipped'
-- 5  'mouse'    25   9  NULL        -- status חסר
```

**שאילתה 1: כמה הזמנות לכל מוצר, וסך ההכנסות?**

```sql
SELECT   product,
         COUNT(*)          AS order_count,
         COUNT(status)     AS with_status,
         SUM(amount)       AS revenue
FROM     orders
GROUP BY product
ORDER BY revenue DESC;
```

תוצאה:

| product | order_count | with_status | revenue |
|---------|-------------|-------------|---------|
| laptop  | 2           | 2           | 2400    |
| mouse   | 2           | 1           | 50      |
| cable   | 1           | 1           | 15      |

מוצר "mouse": `order_count=2` כי שתי שורות, אבל `with_status=1` כי שורה 5 מכילה NULL ב-status. SUM(amount) כולל את שתי הרכישות (50), כי amount עצמה אינה NULL.

**שאילתה 2: רק מוצרים שהניבו מעל 100:**

```sql
SELECT   product, SUM(amount) AS revenue
FROM     orders
GROUP BY product
HAVING   SUM(amount) > 100;
```

תוצאה:

| product | revenue |
|---------|---------|
| laptop  | 2400    |

mouse ו-cable נספרו אבל נפלו מ-HAVING. לא ניתן לכתוב `WHERE SUM(amount) > 100` כי WHERE רץ לפני שה-SUM חושב.

## המקרה שמפיל את האינטואיציה

`AVG` מחזיר ממוצע על שורות שאינן NULL, ולא ממוצע על כל השורות בקבוצה.

```sql
-- scores (student_id, score)
-- 1  90
-- 2  80
-- 3  NULL   -- לא ניגש לבחינה

SELECT AVG(score) FROM scores;
-- מחזיר 85.0, לא 56.67
-- (90+80)/2 = 85, לא (90+80+0)/3
```

אם ה-NULL מייצג 0 (סטודנט שנכשל ולא הגיע), התוצאה שגויה. הפתרון:

```sql
SELECT AVG(COALESCE(score, 0)) FROM scores;
-- מחזיר 56.67
```

**כלל**: תמיד שאל "מה אני רוצה שיקרה ל-NULL?" לפני כל AVG/SUM.

## טעויות נפוצות

1. **WHERE עם aggregate**: `WHERE COUNT(*) > 2` גורם לשגיאת תחביר. WHERE רץ לפני GROUP BY ולפני שה-COUNT מחושב. יש להחליף ב-HAVING.

2. **עמודה שאינה ב-GROUP BY ב-SELECT**: `SELECT product, status, COUNT(*) FROM orders GROUP BY product` לא חוקי ב-PostgreSQL/MySQL strict mode. `status` לא מוגדרת באיזה ערך להחזיר כשיש כמה. יש לוסיף ל-GROUP BY או לעטוף ב-aggregate (MIN(status), ANY_VALUE(status)).

3. **COUNT(DISTINCT col) עם הרבה ערכים**: על טבלאות גדולות COUNT(DISTINCT) יקר, כי בסיס הנתונים מחזיק בזיכרון את כל הערכים הייחודיים. HyperLogLog או approximate_count_distinct (BigQuery/Spark) הם חלופות כשדיוק מוחלט אינו הכרחי.

4. **GROUP BY על alias מ-SELECT**: ב-PostgreSQL מותר `GROUP BY revenue_bucket` כשrevenue_bucket מוגדר ב-SELECT; ב-MySQL אסור; ב-SQL Server אסור. כדי להיות ניידים, חזור על הביטוי המלא ב-GROUP BY.

5. **NULL = NULL בתנאי GROUP BY**: GROUP BY מקבץ כל ה-NULL ביחד כאילו הם אותו ערך. `GROUP BY status` יצור קבוצה אחת לכל ה-NULL. זה שונה מ-WHERE שבו `NULL = NULL` הוא UNKNOWN.

## מתי זה לא משנה

כשכל שאילתה מחזירה שורה אחת ולא מקובצת (SELECT MAX(ts) FROM events), GROUP BY לא נדרש. כשעובדים עם טבלה של שורה אחת לכל ישות ורוצים פשוט לקחת עמודה, aggregation אינה השלב הנכון.

בראיון: "מה ההבדל בין WHERE ל-HAVING?" היא שאלת מסמן. הדגש: WHERE סינון שורות לפני קיבוץ, HAVING סינון קבוצות אחרי קיבוץ. "מה COUNT(*) מחזיר אם כל השורות הן NULL?" תשובה: COUNT(*) אינו מושפע מ-NULL, מחזיר את מספר השורות. "מה SUM מחזיר על עמודה של NULL בלבד?" תשובה: NULL, לא 0.

## חיבור

אגרגציה היא הצעד השני של M2. m2-joins מגדיר אילו שורות נכנסות לשאילתה; אגרגציה מקפלת אותן לסיכומים. Window functions (m2-window-functions) עושות דבר דומה אבל בלי לקפל השורות, ולכן אפשר לראות גם את הפרטים וגם את הסיכום בשורה אחת. CTEs (m2-ctes) מאפשרות לכתוב תת-שאילתה עם GROUP BY ולהתייחס אליה בשם נקי.

```quiz
{"id":"u-m2-aggregation-q1","tree":"systems","skill":"sql","q":"מה יחזיר SUM(col) כאשר כל ערכי col בקבוצה הם NULL?","options":["0","NULL","שגיאת ריצה","COUNT(*)"],"answer":1,"explain":"SUM מדלגת על NULL; כאשר אין ערכים שאינם NULL, התוצאה היא NULL ולא 0."}
```

```quiz
{"id":"u-m2-aggregation-q2","tree":"systems","skill":"sql","q":"למה `WHERE COUNT(*) > 5` גורם לשגיאה?","options":["COUNT אסור ב-WHERE","WHERE רץ לפני GROUP BY ולפני ש-COUNT מחושב","תחביר לא תקין ב-MySQL בלבד","צריך להשתמש ב-HAVING COUNT(*) > 5 רק ב-PostgreSQL"],"answer":1,"explain":"סדר הביצוע: FROM -> WHERE -> GROUP BY -> HAVING. WHERE רץ לפני שה-aggregate מחושב, ולכן אינו יכול להתייחס לתוצאתו."}
```

```quiz
{"id":"u-m2-aggregation-q3","tree":"systems","skill":"sql","q":"לטבלה עם שורות: score=90, 80, NULL. מה מחזיר AVG(score)?","options":["56.67","85.0","NULL","שגיאה"],"answer":1,"explain":"AVG מחשבת (90+80)/2=85.0 כי NULL מודלגת. אם NULL מייצג 0, יש להשתמש ב-AVG(COALESCE(score,0))."}
```

```concepts
{"items":[{"id":"c-aggregate-function","t":"Aggregate function","he":"פונקציית אגרגציה","d":"פונקציה שמקבלת קבוצת שורות ומחזירה ערך סקלרי: COUNT, SUM, AVG, MIN, MAX","rel":["c-group-by-clause","c-having-clause"],"node":"sql-core"},{"id":"c-group-by-clause","t":"GROUP BY","he":"קיבוץ","d":"מחלק שורות לקבוצות לפי ערכי עמודה; כל עמודה ב-SELECT חייבת להיות ב-GROUP BY או בתוך aggregate","rel":["c-aggregate-function","c-having-clause"],"node":"sql-core"},{"id":"c-having-clause","t":"HAVING","he":"סינון קבוצות","d":"מסנן קבוצות אחרי GROUP BY; יכול להשתמש ב-aggregate; WHERE לא יכול","rel":["c-group-by-clause","c-aggregate-function"],"node":"sql-core"},{"id":"c-count-null","t":"COUNT(*) vs COUNT(col)","he":"ספירה עם NULL","d":"COUNT(*) סופר כל השורות; COUNT(col) מדלג על NULL; SUM/AVG/MIN/MAX מדלגים גם הם","rel":["c-aggregate-function"],"node":"sql-core"}]}
```
