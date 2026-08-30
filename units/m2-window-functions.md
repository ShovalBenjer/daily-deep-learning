# פונקציות חלון
GROUP BY מקפל שורות לסיכום; window function מחזירה את הסיכום ואת כל שורה המקורית בו-זמנית.

## מה תדע בסוף
תכתוב שאילתות עם ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD ו-SUM/AVG OVER; תסביר את ההבדל בין PARTITION BY ל-GROUP BY; תידע מתי window function גורמת לבאג שקט.

## האינטואיציה

דמיין לוח תוצאות של מרוץ. יש חמישה רצים, לכל אחד זמן גמר. GROUP BY היה לוקח את הזמנים ומחזיר רק שורה אחת: "הממוצע הוא 42 שניות." הלוח נסגר. `ROW_NUMBER() OVER (ORDER BY time)` שומר את חמשת השורות, מוסיף עמודה חדשה שאומרת "מקום 1, מקום 2, מקום 3..." ומחזיר את כל הרצים עם כל פרטיהם.

**החלון** הוא הקבוצה של שורות שהפונקציה "רואה" בזמן שהיא חושבת את ערך השורה הנוכחית. הגדרת החלון רשומה ב-OVER().

## ההגדרות המדויקות

**Window function, פונקציית חלון**: פונקציה שרצה על חלון של שורות, מוסיפה עמודה מחושבת לכל שורה, ואינה מקפלת את השורות.

**OVER(), מעל**: הסעיף שמגדיר את החלון. ריק: `OVER()` = כל טבלת התוצאה כחלון אחד. עם תת-סעיפים:

```
OVER (
  PARTITION BY <עמודה>   -- חלק לקבוצות, כמו GROUP BY ללא כיווץ
  ORDER BY    <עמודה>   -- קובע סדר בתוך החלון
)
```

**PARTITION BY, חלוקה**: מפצל את השורות לתתי-חלונות לפי ערך עמודה. הפונקציה מחושבת מחדש בכל תת-חלון.

**ORDER BY בתוך OVER**: מוסיף סדר לתוך החלון ומפעיל ברירת מחדל של frame מצטבר (ראה "המקרה שמפיל").

פונקציות נפוצות:

| פונקציה | מה היא עושה |
|---------|------------|
| `ROW_NUMBER()` | מספר שורות ברצף ייחודי; קשרים שוברים באקראי |
| `RANK()` | מספר עם קפיצות בקשרים: 1, 1, 3 |
| `DENSE_RANK()` | מספר ללא קפיצות: 1, 1, 2 |
| `LAG(col, n)` | ערך השורה n שורות לאחור; NULL בשורה הראשונה |
| `LEAD(col, n)` | ערך השורה n שורות קדימה; NULL בשורה האחרונה |
| `SUM(col) OVER (...)` | סכום מצטבר על החלון |
| `AVG(col) OVER (...)` | ממוצע על החלון |

## דוגמה מחושבת

```sql
-- sales (rep, region, amount)
-- Alice  North  300
-- Bob    North  500
-- Carol  South  200
-- Dana   South  400
-- Eve    South  100
```

**שאילתה: דירוג בתוך אזור, סכום מצטבר לפי דירוג, והפרש מהמכירה הקודמת:**

```sql
SELECT
    rep,
    region,
    amount,
    ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC)
        AS rank_in_region,
    SUM(amount)  OVER (PARTITION BY region ORDER BY amount DESC
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        AS running_total,
    LAG(amount)  OVER (PARTITION BY region ORDER BY amount DESC)
        AS prev_amount
FROM sales
ORDER BY region, rank_in_region;
```

תוצאה:

| rep   | region | amount | rank_in_region | running_total | prev_amount |
|-------|--------|--------|----------------|---------------|-------------|
| Bob   | North  | 500    | 1              | 500           | NULL        |
| Alice | North  | 300    | 2              | 800           | 500         |
| Dana  | South  | 400    | 1              | 400           | NULL        |
| Carol | South  | 200    | 2              | 600           | 400         |
| Eve   | South  | 100    | 3              | 700           | 200         |

`PARTITION BY region` גורם לדירוג להתאפס בכל אזור. Bob מקום 1 ב-North; Dana מקום 1 ב-South. `LAG` מחזיר NULL בשורה הראשונה של כל תת-חלון כי אין שורה "לפני".

## המקרה שמפיל את האינטואיציה

**ברירת המחדל של frame עם ORDER BY היא RANGE UNBOUNDED PRECEDING**, לא ROWS UNBOUNDED PRECEDING. ל-SUM עם ערכי עניין זה יכול לייצר תוצאה לא צפויה כשיש ערכים שווים.

דוגמה: שתי שורות עם `amount = 300`.

```sql
SUM(amount) OVER (ORDER BY amount)  -- frame ברירת מחדל: RANGE
```

לשתי השורות עם `amount = 300` ה-SUM יחזיר את הסכום של **כל** השורות שיש להן `amount <= 300`, כולל שתיהן, לא מצטבר שורה אחת ואז שתיים. לכן שתי השורות תקבלנה אותו running_total אף שהן "שונות" בסדר.

הפתרון: `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` מסיר את האמביגואיות.

## טעויות נפוצות

1. **window function ב-WHERE**: `WHERE ROW_NUMBER() OVER (...) = 1` גורמת לשגיאה. הפונקציה מחושבת אחרי WHERE. הפתרון: עטוף בCTE או בתת-שאילתה ואז סנן.

2. **בלבול PARTITION BY עם GROUP BY**: `PARTITION BY region` לא מסיר עמודות מ-SELECT ולא מחייב אגרגציה. `GROUP BY region` מסיר את כל העמודות שאינן מקובצות או מאוגרגות. בחר PARTITION BY כשרוצים לשמור את השורות המקוריות.

3. **RANK בראיון כשרוצים DENSE_RANK**: מחזיר 1, 1, 3 כשרוצים 1, 1, 2. הכי שכיח בשאלת "מצא את המוצר השני הנמכר ביותר".

4. **LAG ללא ערך ברירת מחדל**: `LAG(amount)` מחזיר NULL בשורה הראשונה. `LAG(amount, 1, 0)` יחזיר 0 שם. כשמבצעים חישוב `amount - LAG(amount)`, NULL מכנה כל ביטוי ל-NULL.

5. **window function מציבה ערך אחרי SELECT, לפני ORDER BY הסופי**: לא ניתן להתייחס ל-alias שמוגדר באותו SELECT בתוך פונקציית החלון של אותו SELECT. יש להשתמש בCTE.

## מתי זה לא משנה

כשצריך רק ערך יחיד לכל קבוצה (סכום, מקסימום, ספירה) ואין צורך בשורות המקוריות, GROUP BY + aggregate פשוטה ומהירה יותר. מנועי בסיסי נתונים מבצעים אגרגציה לרוב עם scan אחד ומיזוג פשוט; window functions לעיתים דורשות מיון נוסף לפי כל PARTITION BY.

בראיון: אם השאלה מבקשת "top-N per group", window function היא הפתרון הנכון. אם היא מבקשת "סך מכירות לפי אזור", GROUP BY מספיק.

## חיבור

פונקציות חלון יושבות בין m2-aggregation לm2-ctes. aggregation מקפל שורות; window function שומרת אותן. CTE הוא הכלי שמאפשר לסנן תוצאת window function (`WITH ranked AS (...) SELECT * FROM ranked WHERE rank_in_region = 1`). לאחר יחידה זו: **m2-ctes** (Common Table Expressions).

```quiz
{"id":"u-m2-window-functions-q1","tree":"systems","skill":"sql","q":"מה ההבדל המרכזי בין פונקציית חלון לבין GROUP BY?","options":["פונקציית חלון עובדת רק על עמודות מסוג מספר","GROUP BY שומר את כל השורות המקוריות","פונקציית חלון מוסיפה עמודה מחושבת ושומרת את כל שורות הקלט; GROUP BY מקפל שורות","פונקציית חלון דורשת PARTITION BY בהכרח"],"answer":2,"explain":"Window function מחשבת ערך לכל שורה על בסיס 'חלון' של שורות ומחזירה אותה השורה עם עמודה נוספת. GROUP BY מיזג שורות לקבוצות ומחזיר שורה אחת לקבוצה."}
```

```quiz
{"id":"u-m2-window-functions-q2","tree":"systems","skill":"sql","q":"שלוש עובדות עם משכורת 5000, 5000, 3000. מה יחזיר RANK() ומה DENSE_RANK() לכל שורה בסדר יורד?","options":["RANK: 1,1,2 / DENSE_RANK: 1,1,2","RANK: 1,2,3 / DENSE_RANK: 1,1,2","RANK: 1,1,3 / DENSE_RANK: 1,1,2","RANK: 1,1,2 / DENSE_RANK: 1,1,3"],"answer":2,"explain":"RANK מדלג: שתי השורות הראשונות מקבלות 1, השלישית מקבלת 3 (קפיצה). DENSE_RANK לא מדלג: שתי הראשונות מקבלות 1, השלישית 2."}
```

```quiz
{"id":"u-m2-window-functions-q3","tree":"systems","skill":"sql","q":"מדוע `WHERE ROW_NUMBER() OVER (ORDER BY ts) = 1` גורמת לשגיאה?","options":["ROW_NUMBER דורש PARTITION BY","Window functions מחושבות אחרי WHERE, ולכן אינן זמינות ב-WHERE","ROW_NUMBER מחזיר NULL ב-WHERE","Window functions אסורות בשאילתות עם ORDER BY"],"answer":1,"explain":"סדר הביצוע: FROM -> WHERE -> SELECT. פונקציית חלון מחושבת בשלב SELECT, לאחר WHERE. הפתרון: עטוף ב-CTE ואז סנן ב-WHERE של השאילתה החיצונית."}
```

```widget
{"type":"algviz","algo":"partition-row","title":"Window ROW_NUMBER: צפה כיצד ROW_NUMBER ממספר שורות בכל partition"}
```

```concepts
{"items":[{"id":"c-window-function","t":"Window function","he":"פונקציית חלון","d":"פונקציית SQL שרצה על חלון שורות, מוסיפה עמודה לכל שורה ואינה מקפלת את הקלט","rel":["c-over-clause","c-aggregate-function"],"node":"sql-core"},{"id":"c-over-clause","t":"OVER()","he":"סעיף חלון","d":"מגדיר את חלון השורות שפונקציית חלון רואה; יכול לכלול PARTITION BY ו-ORDER BY","rel":["c-window-function","c-partition-by-win"],"node":"sql-core"},{"id":"c-partition-by-win","t":"PARTITION BY (window)","he":"חלוקה בחלון","d":"מפצל את שורות החלון לתתי-קבוצות; הפונקציה מאופסת בכל קבוצה ללא כיווץ שורות","rel":["c-over-clause","c-group-by-clause"],"node":"sql-core"},{"id":"c-row-number","t":"ROW_NUMBER()","he":"מספור שורות","d":"מחזיר מספר רץ ייחודי בתוך החלון; קשרים שוברים באקראי","rel":["c-window-function","c-rank-dense-rank"],"node":"sql-core"},{"id":"c-rank-dense-rank","t":"RANK / DENSE_RANK","he":"דירוג","d":"RANK מדלג בקשרים (1,1,3); DENSE_RANK לא מדלג (1,1,2)","rel":["c-row-number","c-window-function"],"node":"sql-core"},{"id":"c-lag-lead","t":"LAG / LEAD","he":"שורה קודמת/הבאה","d":"LAG מחזיר ערך n שורות אחורה; LEAD n שורות קדימה; NULL בקצוות","rel":["c-window-function","c-over-clause"],"node":"sql-core"}]}
```
