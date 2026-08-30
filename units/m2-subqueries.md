# תת-שאילתות מול צירופים
כל "תן לי רק את..." שמחושב בתוך שאילתה אחרת הוא תת-שאילתה, וההחלטה מתי להשתמש בה קובעת אם השאילתה תרוץ במילישניות או בדקות.

## מה תדע בסוף
תוכל לכתוב תת-שאילתות סקלריות, מתואמות ועם EXISTS, להחליף ביניהן ובין JOIN כאשר שתי הגישות שקולות, ולזהות את מלכודת NULL בתוך NOT IN.

## האינטואיציה
תדמיין שני פתקים. בפתק הראשון כתוב "תחשב את ממוצע המשכורות". בפתק השני כתוב "הבא לי את כל העובדים שמרוויחים יותר מהמספר שכתוב בפתק הראשון". **תת-שאילתה, subquery** היא בדיוק זה: שאילתה פנימית שמחשבת ערך או קבוצת ערכים, ושאילתה חיצונית שמשתמשת בהם. SQL מאפשר לכתוב את שני הפתקים כביטוי אחד מקונן, בלי משתנה ביניים.

## ההגדרות המדויקות

**תת-שאילתה, subquery** היא בלוק `SELECT` שמופיע בתוך שאילתה אחרת. שלוש מיקומים אפשריים:

**בתוך WHERE:**
```sql
SELECT name FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
```

**בתוך FROM (נקראת גם inline view):**
```sql
SELECT dept_id, avg_sal
FROM (SELECT dept_id, AVG(salary) AS avg_sal FROM employees GROUP BY dept_id) AS dept_avgs;
```

**בתוך SELECT:**
```sql
SELECT name, (SELECT COUNT(*) FROM orders WHERE orders.emp_id = e.id) AS order_count
FROM employees e;
```

**תת-שאילתה סקלרית, scalar subquery** היא תת-שאילתה שמחזירה בדיוק שורה אחת ועמודה אחת, כלומר ערך יחיד. אם היא מחזירה יותר משורה אחת, מרבית מנועי SQL זורקים שגיאת ריצה.

**תת-שאילתה מתואמת, correlated subquery** מתייחסת לעמודה מהשאילתה החיצונית. כלומר, היא מורצת מחדש לכל שורה שהשאילתה החיצונית מעבדת. לדוגמה, השאילתה הבאה מחשבת לכל עובד את הממוצע של המחלקה שלו בלבד:

```sql
SELECT name
FROM employees e
WHERE salary > (
  SELECT AVG(salary)
  FROM employees
  WHERE department = e.department
);
```

הביטוי `e.department` מגיע מהשאילתה החיצונית, ולכן תת-השאילתה רצה מחדש לכל ערך של `e.department`.

**EXISTS** הוא אופרטור בוליאני שמחזיר TRUE אם תת-השאילתה מחזירה לפחות שורה אחת, ו-FALSE אם היא ריקה. לכן השאילתה הבאה מחזירה לקוחות שיש להם לפחות הזמנה אחת:

```sql
SELECT name FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders WHERE customer_id = c.id
);
```

שימו לב ל-`SELECT 1`: מה שתת-השאילתה מחזירה לא משנה, כי EXISTS בודק רק האם יש שורות.

**IN עם תת-שאילתה** בודק אם ערך שייך לקבוצה שתת-השאילתה מחזירה:

```sql
SELECT name FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE city = 'Tel Aviv');
```

## דוגמה מחושבת

שתי טבלאות:

```
employees: id | name  | dept_id | salary
           1  | Dana  | 10      | 8000
           2  | Oren  | 20      | 6000
           3  | Tali  | 10      | 9000

departments: id | name        | city
             10 | Engineering | Tel Aviv
             20 | Marketing   | Haifa
```

**משימה:** שמות העובדים שמחלקתם נמצאת ב-Tel Aviv.

**גישה 1: IN עם תת-שאילתה**

```sql
SELECT name FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE city = 'Tel Aviv');
```

תת-השאילתה `SELECT id FROM departments WHERE city = 'Tel Aviv'` מחזירה `{10}`.
השאילתה החיצונית מחזירה את Dana ו-Tali.

**גישה 2: INNER JOIN**

```sql
SELECT e.name
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE d.city = 'Tel Aviv';
```

אותה תוצאה: Dana, Tali. עם PostgreSQL ו-MySQL, מנוע השאילתות לרוב מייצר את אותה תוכנית ריצה לשתי הגישות, כי האופטימייזר מזהה ששתיהן שקולות.

```quiz
{"id":"u-m2-subqueries-q1","tree":"systems","skill":"sql","q":"מה יחזיר הקוד הבא?\nSELECT name FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);\nלטבלה: Dana=8000, Oren=6000, Tali=9000","options":["Dana בלבד","Dana ו-Tali","Oren בלבד","כל שלושת העובדים"],"answer":1,"explain":"ממוצע המשכורות הוא (8000+6000+9000)/3=7666.67. רק Dana (8000) ו-Tali (9000) גדולים ממנו."}
```

## המקרה שמפיל את האינטואיציה

**NULL הורס את NOT IN.**

נניח שטבלת `departments` מכילה שורה שבה `id = NULL`. השאילתה הבאה לא תחזיר שום שורה, גם אם כוונת הכותב היא להחזיר עובדים שמחלקתם לא ב-Haifa:

```sql
SELECT name FROM employees
WHERE dept_id NOT IN (SELECT id FROM departments WHERE city = 'Haifa');
```

הסיבה: SQL מחשב `dept_id NOT IN (10, NULL, ...)` כ-`dept_id <> 10 AND dept_id <> NULL AND ...`. ההשוואה `dept_id <> NULL` מחזירה NULL (לא FALSE), ו-`TRUE AND NULL` הוא NULL, כלומר השורה לא עוברת את הסינון.

הפתרון האמין הוא NOT EXISTS:

```sql
SELECT name FROM employees e
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.city = 'Haifa' AND d.id = e.dept_id
);
```

NOT EXISTS לא מתייחס לשוויון ערכים, ולכן NULL ב-`d.id` לא מפריע לו.

```quiz
{"id":"u-m2-subqueries-q2","tree":"systems","skill":"sql","q":"טבלת departments מכילה שורה עם id=NULL. מה יחזיר:\nSELECT name FROM employees WHERE dept_id NOT IN (SELECT id FROM departments);","options":["כל העובדים שאין להם מחלקה","אפס שורות, כי NOT IN עם NULL תמיד נכשל","שגיאת ריצה","רק עובדים שה-dept_id שלהם הוא NULL"],"answer":1,"explain":"NOT IN עם NULL בתת-שאילתה מחזיר אפס שורות. הסיבה: הביטוי dept_id <> NULL מחשיב NULL (לא FALSE), ולכן שום שורה לא עוברת. NOT EXISTS הוא הפתרון הנכון."}
```

## טעויות נפוצות

**1. תת-שאילתה מתואמת כשאפשר JOIN.** תת-שאילתה מתואמת רצה N פעמים, אחת לכל שורה חיצונית. JOIN מבוצע פעם אחת. לטבלה עם מיליון שורות ההבדל הוא בין שניות לשעות.

**2. שכחת alias ב-inline view.** `FROM (SELECT ...) AS sub` חייב alias אחרי הסוגריים. בלי alias PostgreSQL זורקת שגיאת תחביר.

**3. תת-שאילתה סקלרית שמחזירה יותר משורה אחת.** `WHERE salary > (SELECT salary FROM employees)` תזרוק שגיאה אם יש יותר משורה אחת בתוצאה. פתרון: הוסף `LIMIT 1` או השתמש ב-`MIN`/`MAX`.

**4. שכחת IS NOT NULL ב-NOT IN.** לפני שימוש ב-`col NOT IN (SELECT ...)` יש לוודא שתת-השאילתה לא מחזירה NULL, למשל עם `WHERE col IS NOT NULL` בתת-השאילתה.

## מתי זה לא משנה

כאשר תת-השאילתה אינה מתואמת וה-schema קטן (עד אלפי שורות), שתי הגישות (תת-שאילתה ו-JOIN) שקולות בביצועים; האופטימייזר מייצר את אותה תוכנית. בבחינות SQL ובמוקאפ DataLemur ניתן לבחור לפי קריאות ולא לפי ביצועים.

כאשר יש JOIN על מפתח ראשי (1:1 או 1:N), JOIN מכיר את ה-index טוב יותר מ-IN עם תת-שאילתה ועדיף גם לגבי הבהירות.

```quiz
{"id":"u-m2-subqueries-q3","tree":"systems","skill":"sql","q":"מה ההבדל בביצועים בין תת-שאילתה מתואמת ל-JOIN על אותם הנתונים?","options":["אין הבדל, האופטימייזר תמיד ממיר אחת לשנייה","תת-שאילתה מתואמת רצה פעם אחת; JOIN רץ N פעמים","JOIN רץ פעם אחת; תת-שאילתה מתואמת רצה N פעמים (אחת לכל שורה חיצונית)","תת-שאילתה תמיד מהירה יותר כי אין HASH JOIN"],"answer":2,"explain":"תת-שאילתה מתואמת תלויה בשורה חיצונית, ולכן מנוע ה-SQL מריץ אותה מחדש לכל שורה. JOIN מחשב את הצד הימני פעם אחת ומצרף בעזרת hash או index. ההפרש קריטי בטבלאות גדולות."}
```

## חיבור

יחידה זו שייכת לבלוק M2 (SQL). היא בונה על הידע בצירופים (m2-joins) ובאגרגציה (m2-aggregation). יחד עם CTE (m2-ctes), תת-שאילתות הן הכלי שמאפשר לפרק שאילתות מורכבות לשלבים קריאים. היחידה הבאה m2-ranking עושה שימוש כבד ב-EXISTS ו-NOT EXISTS לפתרון בעיות דירוג ומציאת כפילויות.

```widget
{"type":"algviz","algo":"join-matcher","title":"EXISTS Matcher: צפה כיצד שורות מתאימות ב-IN / EXISTS / NOT EXISTS"}
```

```concepts
{"items":[{"id":"subquery","t":"Subquery","he":"תת-שאילתה","d":"בלוק SELECT המוקן בתוך שאילתה אחרת, בWHERE, FROM או SELECT","rel":["correlated-subquery","scalar-subquery"],"node":"sql-core"},{"id":"correlated-subquery","t":"Correlated subquery","he":"תת-שאילתה מתואמת","d":"תת-שאילתה המתייחסת לעמודה מהשאילתה החיצונית ורצה מחדש לכל שורה","rel":["subquery"],"node":"sql-core"},{"id":"scalar-subquery","t":"Scalar subquery","he":"תת-שאילתה סקלרית","d":"תת-שאילתה המחזירה בדיוק שורה אחת ועמודה אחת","rel":["subquery"],"node":"sql-core"},{"id":"exists-subquery","t":"EXISTS","he":"EXISTS","d":"אופרטור בוליאני שמחזיר TRUE אם תת-שאילתה מחזירה לפחות שורה אחת","rel":["subquery","correlated-subquery"],"node":"sql-core"},{"id":"not-in-null","t":"NOT IN with NULL trap","he":"מלכודת NULL ב-NOT IN","d":"NOT IN עם תת-שאילתה שמחזירה NULL מחזיר אפס שורות, NOT EXISTS הוא הפתרון","rel":["subquery","exists-subquery"],"node":"sql-core"}]}
```
