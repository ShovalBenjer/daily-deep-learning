# היפוך טבלה
כל הדאטה שלך הוא בשורות - עד שמישהו רוצה לראות אותו בעמודות.

## מה תדע בסוף
תכתוב pivot סטטי בגישת CASE WHEN על כל מסד נתונים SQL; תסביר למה SQL Standard לא כולל PIVOT; ותבחין בין pivot סטטי לדינמי.

## האינטואיציה

פתח גיליון אלקטרוני עם שלוש עמודות: מוצר, חודש, הכנסה. כל שורה היא מכירה אחת.

כשאתה מבקש pivot_table ב-Excel, אתה גורר את "חודש" לשורת הכותרות ואת "הכנסה" לגוף. הגיליון מחשב סכום לכל צלב. המשמעות: שורות שהיו "ינואר, 500" ו-"ינואר, 300" הופכות לעמודה `jan` עם ערך 800.

SQL עושה בדיוק את זה, אבל בשפה אחרת: במקום לגרור, אתה כותב `CASE WHEN month = 'Jan' THEN revenue END` בתוך `SUM(...)`, ומחזיר עמודה אחת לכל ערך שתרצה. התהליך נקרא **Pivoting, היפוך טבלה**.

## ההגדרות המדויקות

**Pivoting, היפוך טבלה**: הפיכת ערכים ייחודיים בעמודה (למשל 'Jan', 'Feb', 'Mar') לכותרות עמודות בפלט. הפעולה ההפוכה היא **Unpivoting, ביטול ההיפוך**: הפיכת עמודות חזרה לשורות.

**Conditional Aggregation, אגרגציה מותנית**: הכלי שמאחורי כל pivot ב-SQL. מכניסים ביטוי CASE WHEN בתוך פונקציית אגרגציה כגון SUM, MAX, COUNT. שורות שאינן עומדות בתנאי מחזירות NULL, ו-SUM/MAX/COUNT מתעלמות מ-NULL באופן טבעי.

```sql
SUM(CASE WHEN month = 'Jan' THEN revenue ELSE 0 END) AS jan
```

ניתן לכתוב ב-PostgreSQL גם עם **FILTER, מסנן**: תחביר קצר יותר שעושה בדיוק אותו דבר.

```sql
SUM(revenue) FILTER (WHERE month = 'Jan') AS jan
```

**Static Pivot, היפוך סטטי**: הערכים שהופכים לכותרות ידועים בזמן כתיבת השאילתה ומוקלדים ידנית.

**Dynamic Pivot, היפוך דינמי**: הערכים אינם ידועים. צריך קודם לשאול את ה-DB על הערכים הייחודיים, לבנות מחרוזת SQL בקוד, ואז להריץ אותה. לא ניתן ב-SQL Standard לבד.

## דוגמה מחושבת

טבלה `sales`:

| product | month | revenue |
|---------|-------|---------|
| A       | Jan   | 500     |
| A       | Feb   | 300     |
| B       | Jan   | 200     |
| B       | Feb   | 400     |
| B       | Mar   | 100     |

מטרה: שורה לכל מוצר, עמודה לכל חודש.

```sql
SELECT
    product,
    SUM(CASE WHEN month = 'Jan' THEN revenue ELSE 0 END) AS jan,
    SUM(CASE WHEN month = 'Feb' THEN revenue ELSE 0 END) AS feb,
    SUM(CASE WHEN month = 'Mar' THEN revenue ELSE 0 END) AS mar
FROM sales
GROUP BY product;
```

פלט:

| product | jan | feb | mar |
|---------|-----|-----|-----|
| A       | 500 | 300 |   0 |
| B       | 200 | 400 | 100 |

שים לב ל-`ELSE 0`: אם מוצר A לא מכר בחודש מסוים, נרצה 0 ולא NULL. ללא ELSE, SUM מתעלמת מ-NULL ותחזיר NULL לאותה שורה, לא 0.

```quiz
{"id":"u-m2-pivoting-q1","tree":"systems","skill":"sql","q":"בשאילתת pivot עם CASE WHEN, מה יקרה אם תשכח לעטוף את ה-CASE בפונקציית אגרגציה (SUM/MAX/COUNT) ותשתמש בו ישירות ב-SELECT עם GROUP BY?","options":["הפלט יהיה תקין כי CASE כבר בוחר ערך יחיד","שגיאה: עמודה שאינה ב-GROUP BY ואינה אגרגטית לא מותרת ב-SELECT","שגיאת syntax כי CASE אסור בלי OVER","NULL יכסה את כל השורות"],"answer":1,"explain":"ב-GROUP BY כל ביטוי ב-SELECT חייב להיות פונקציית אגרגציה או עמודה שמופיעה ב-GROUP BY. CASE לבדו מחזיר ערך שורה-שורה ומפר את הכלל; רוב המנועים יזרקו שגיאה, ו-MySQL הישן יבחר ערך שרירותי ללא אזהרה."}
```

## המקרה שמפיל את האינטואיציה

נניח שחודשי המכירות אינם ידועים בזמן כתיבת הקוד. אולי ה-DB כולל ינואר עד אוקטובר היום, ובחודש הבא יתוסף נובמבר.

ב-SQL סטטי אין פתרון. צריך dynamic SQL בשלושה שלבים:

```sql
-- שלב א: שאל מה הערכים הייחודיים
SELECT DISTINCT month FROM sales ORDER BY month;
-- --> Jan, Feb, Mar, ...

-- שלב ב: קוד Python בונה את הביטוי:
-- SUM(CASE WHEN month='Jan' THEN revenue ELSE 0 END) AS jan, ...

-- שלב ג: מריצים את השאילתה שנבנתה דינמית
```

זו לא כשל של SQL; זו מגבלה מבנית: ה-schema של SQL (מספר עמודות ושמות) חייב להיות ידוע בזמן ה-parse. ביטוי CASE יכול לבחור ערכים - לא להגדיר מספר עמודות.

## טעויות נפוצות

**שכחת פונקציית האגרגציה**: `CASE WHEN month='Jan' THEN revenue END` ב-SELECT עם GROUP BY יזרוק שגיאה. CASE חייב להיות בתוך SUM/MAX/COUNT.

**SUM כשצריך MAX**: אם ברצונך להחזיר ערך שאינו מספרי (למשל סטטוס 'approved'), השתמש ב-`MAX(CASE WHEN cond THEN status END)`. SUM על VARCHAR יזרוק שגיאה.

**NULL במקום 0**: ללא `ELSE 0`, מוצר שאין לו שום מכירה בחודש מסוים יחזיר NULL ולא 0. הנמענים מצפים לרוב ל-0 בדוחות. הוסף `ELSE 0` או עטוף ב-`COALESCE(..., 0)`.

**GROUP BY על העמודה הלא-נכונה**: שאל: "מה הוא השורה הייחודית בפלט?" - זה הולך ל-GROUP BY. "מה הופך לעמודות?" - זה הולך לכותרות ה-CASE. הפוך אחד מהשניים ותקבל pivot בכיוון הלא-נכון.

## מתי זה לא משנה

**כשהאפליקציה עושה טוב יותר**: `pandas.pivot_table()` פותר pivot דינמי בשורה אחת. אם הנמען הוא dashboard ב-Python, אין סיבה לאלץ SQL לעשות את העבודה.

**כשיש הרבה ערכים**: pivot של 50 חודשים יוצר שאילתה ארוכה שקשה לתחזק. SQL מתאים לpivot של 3 עד 12 ערכים ידועים.

**ב-ראיון**: pivot דינמי ב-SQL הוא שאלת "ידע על מגבלות" ולא שאלת "כתוב את זה". ענה: "אני יודע ש-SQL Standard לא תומך בזה ישירות; בפועל אני בונה את השאילתה בקוד."

## חיבור

יחידה זו בנויה על אגרגציה (m2-aggregation) וביטויי CASE. הפעולה ההפוכה, Unpivoting, מופיעה בדפוס gaps-and-islands (m2-gaps-islands) כשמעלים שורות-ממספרים לרשימה. ב-SQL Server ו-Oracle קיים תחביר מובנה `PIVOT`/`UNPIVOT`; ב-BigQuery קיים `PIVOT` מאז 2021. ב-PostgreSQL וב-open-source engines: CASE WHEN בלבד.

היחידה הבאה לאחר שתסגור את זו: m2-query-plans, שתסביר למה pivot_table גדול יכול להיות איטי ואיך לקרוא EXPLAIN ANALYZE.

```concepts
{"items":[{"id":"sql-pivot","t":"Pivoting","he":"היפוך טבלה","d":"הפיכת ערכים ייחודיים בעמודה לעמודות-פלט נפרדות באמצעות אגרגציה מותנית.","rel":["sql-cond-agg","sql-dynamic-pivot"],"node":"sql-core"},{"id":"sql-cond-agg","t":"Conditional Aggregation","he":"אגרגציה מותנית","d":"שימוש ב-CASE WHEN בתוך SUM/MAX/COUNT להחיל אגרגציה על תת-קבוצה של שורות בלבד.","rel":["sql-pivot"],"node":"sql-core"},{"id":"sql-dynamic-pivot","t":"Dynamic Pivot","he":"היפוך דינמי","d":"pivot שעמודות הפלט שלו אינן ידועות בזמן ה-parse ומחייב בניית SQL בקוד ריצה.","rel":["sql-pivot"],"node":"sql-core"}]}
```
