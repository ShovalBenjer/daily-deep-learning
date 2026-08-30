# דירוג
שלוש פונקציות, שם אחד: כולן קוראות "ראשון", אבל מסכימות שלוש פעמים שונות על מה לעשות עם שוויון.

## מה תדע בסוף
תבחין בין RANK, DENSE_RANK ו-ROW_NUMBER; תכתוב שאילתת top-N per group עם CTE ותסביר למה RANK לבדה לא מספיקה לצורך זה.

## האינטואיציה

דמיין תחרות ריצה של ארבעה ספורטאים. שניים מהם חוצים את הקו בדיוק באותו הזמן.

שופט ראשון (RANK) אומר: "שניכם במקום שלישי, הבא אחריכם יהיה חמישי." מקום רביעי מוחמץ.

שופט שני (DENSE_RANK) אומר: "שניכם במקום שלישי, הבא אחריכם יהיה רביעי." אין קפיצה.

שופט שלישי (ROW_NUMBER) אומר: "אחד מכם יקבל שלישי ואחד יקבל רביעי. אנחנו יבחר לפי סדר ההגעה לפי מצלמה." אין שוויון רשמי.

שלושת השופטים רואים את אותו מרוץ. הם חלוקים רק על מה לעשות עם הקשר.

## ההגדרות המדויקות

**RANK(), דירוג עם קפיצות**: מייעד אותו מספר לכל השורות השוות ב-ORDER BY, ואז קופץ מספרים. שתי שורות בדירוג 3 → השורה הבאה מקבלת 5.

**DENSE_RANK(), דירוג צפוף**: כמו RANK אבל ללא קפיצה. שתי שורות בדירוג 3 → השורה הבאה מקבלת 4.

**ROW_NUMBER(), מספר שורה**: מספר ייחודי ורצוף לכל שורה. שורות שוות מקבלות מספרים שרירותיים לפי סדר פנימי של המנוע.

**NTILE(n), חלוקה לדליים**: מחלק את השורות ל-n קבוצות שוות ומייעד מספר קבוצה (1 עד n). שימושי להגדרת "רבעון עליון" או "עשירון".

**PERCENT_RANK(), דירוג באחוזים**: \(\frac{rank - 1}{rows - 1}\), מחזיר ערך בין 0 ל-1. השורה הנמוכה ביותר מקבלת 0.

כל פונקציות הדירוג הן **window functions, פונקציות חלון**: הן פועלות על חלון שמוגדר ב-`OVER (PARTITION BY ... ORDER BY ...)` ואינן מכווצות שורות.

```sql
RANK()       OVER (PARTITION BY dept ORDER BY salary DESC)
DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC)
ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC, emp_id)
```

`PARTITION BY` מאפס את המספור לכל ערך של העמודה, כמו GROUP BY עבור חלונות. ללא PARTITION BY, כל השורות שייכות לחלון אחד.

## דוגמה מחושבת

טבלה `emp`:

| emp_id | dept | salary |
|--------|------|--------|
| 1      | eng  | 90     |
| 2      | eng  | 90     |
| 3      | eng  | 70     |
| 4      | eng  | 60     |
| 5      | mkt  | 80     |
| 6      | mkt  | 75     |

```sql
SELECT emp_id, dept, salary,
  RANK()       OVER w AS rnk,
  DENSE_RANK() OVER w AS drnk,
  ROW_NUMBER() OVER w AS rn
FROM emp
WINDOW w AS (PARTITION BY dept ORDER BY salary DESC);
```

תוצאה:

| emp_id | dept | salary | rnk | drnk | rn |
|--------|------|--------|-----|------|----|
| 1      | eng  | 90     | 1   | 1    | 1  |
| 2      | eng  | 90     | 1   | 1    | 2  |
| 3      | eng  | 70     | 3   | 2    | 3  |
| 4      | eng  | 60     | 4   | 3    | 4  |
| 5      | mkt  | 80     | 1   | 1    | 1  |
| 6      | mkt  | 75     | 2   | 2    | 2  |

שורות 1 ו-2 קשורות ב-90: RANK נותנת שתיהן 1 ומדלגת ל-3. DENSE_RANK נותנת שתיהן 1 ועוברת ל-2. ROW_NUMBER מייעדת 1 ו-2 בסדר שרירותי.

**תבנית top-N per group** (שאלה קלאסית בראיונות):

```sql
WITH ranked AS (
  SELECT emp_id, dept, salary,
    ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn
  FROM emp
)
SELECT emp_id, dept, salary
FROM ranked
WHERE rn <= 2;
```

תוצאה: שני המשתכרים הגבוהים ביותר בכל מחלקה, בדיוק שתי שורות לכל מחלקה.

## המקרה שמפיל את האינטואיציה

אם משתמשים ב-RANK במקום ROW_NUMBER לתבנית top-N ויש שוויון בגבול:

```sql
WITH ranked AS (
  SELECT emp_id, dept, salary,
    RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rnk
  FROM emp
)
SELECT * FROM ranked WHERE rnk <= 2;
```

בטבלה שלנו, שתי שורות מקבלות דירוג 1 בצוות eng. `WHERE rnk <= 2` יחזיר שלוש שורות עבור eng (1, 1, ו-3 הבא נחסם), לא שתיים. אם חמישה אנשים קשורים בדירוג 1, הפילטר `rnk <= 2` יחזיר חמישה. ROW_NUMBER מבטיחה בדיוק N שורות, אך הבחירה בין הקשורים שרירותית.

## טעויות נפוצות

1. **RANK ללא PARTITION BY על טבלה מרובת-קבוצות** מייצרת דירוג גלובלי לכל הטבלה, לא דירוג לפי קבוצה. תמיד לשאול: "האם הדירוג אמור להתאפס לכל קבוצה?"

2. **ROW_NUMBER עם ORDER BY לא-דטרמיניסטי** (ללא tiebreaker ייחודי) מחזירה תוצאות שונות בריצות שונות ב-PostgreSQL. להוסיף עמודת id כ-tiebreaker כשצריך יציבות.

3. **פילטור פונקציית חלון ב-WHERE ישיר** נכשל כי פונקציות חלון מחושבות אחרי WHERE. יש לעטוף ב-CTE או תת-שאילתה ולפלטר בשכבה החיצונית.

4. **שימוש ב-RANK לשאלת "מקום שני"** כשיש שוויון במקום הראשון: שתי שורות קיבלו דירוג 1, אז לא קיים דירוג 2 כלל. DENSE_RANK תיתן 2 לשורה הבאה. ROW_NUMBER תיתן תמיד 2 לשורה השנייה. הבחירה תלויה בדרישה.

## מתי זה לא משנה

אם צריך רק את הערך המקסימלי בכל קבוצה (לא האיזה עובד), `GROUP BY` עם `MAX()` פשוט יותר ובדרך כלל מהיר יותר. פונקציות דירוג נחוצות כשצריך את המיקום האורדינלי של השורה, top-N, או חלוקה לאחוזונים.

**שאלת ראיון נפוצה**: "החזר את השכר השני בגובהו בכל מחלקה." הכלי הנכון הוא ROW_NUMBER (לא self-join ולא subquery מקוננת).

## חיבור

דירוג שייך לצומת `sql-core` בעץ המערכות. הוא מרחיב את מה שלמדת ב-window functions (OVER, PARTITION BY, ORDER BY) לתבניות שנבחנות בכל ראיון SQL. היחידה הבאה, `m2-ranking-drill`, תחזור על התבניות האלה על נתונים שונים.

```quiz
{"id":"u-m2-ranking-q1","tree":"systems","skill":"sql","q":"Two employees share the same salary in a dept. RANK gives them both rank 1. What rank does the next employee receive?","options":["2","3","4","1"],"answer":1,"explain":"RANK skips positions equal to the number of tied rows. Two rows at rank 1 means rank 2 is skipped; the next distinct salary gets rank 3. DENSE_RANK would give 2 without skipping."}
```

```quiz
{"id":"u-m2-ranking-q2","tree":"systems","skill":"sql","q":"You need exactly 2 rows per department, picking the top earners. Ties at the boundary are possible. Which function guarantees exactly 2 rows?","options":["RANK()","DENSE_RANK()","ROW_NUMBER()","MAX() with GROUP BY"],"answer":2,"explain":"ROW_NUMBER assigns a unique number to every row even when salaries are equal, so the filter rn <= 2 always returns exactly 2 per partition. RANK and DENSE_RANK can return more than 2 when there are ties at the boundary."}
```

```fillin
{"id":"u-m2-ranking-f1","tree":"systems","skill":"sql","prompt":"Complete the function name that divides rows into 4 equal buckets:\n\nSELECT emp_id, salary, ________(4) OVER (ORDER BY salary DESC) AS quartile FROM emp;","answer":"NTILE","alt":["ntile"],"explain":"NTILE(n) divides rows into n equal groups and assigns each row a bucket number from 1 to n. NTILE(4) creates four quartiles ordered by salary descending."}
```

```widget
{"type":"algviz","algo":"partition-row","title":"Ranking: צפה כיצד ROW_NUMBER, RANK ו-DENSE_RANK ממספרים שורות"}
```

```concepts
{"items":[{"id":"topn-per-group","t":"Top-N per group","he":"N ראשונים לכל קבוצה","d":"תבנית CTE+ROW_NUMBER לחילוץ N השורות בעלות הערך הגבוה ביותר לכל ערך partition","rel":["c-row-number","c-rank-dense-rank","c-window-function"],"node":"sql-core"},{"id":"ntile","t":"NTILE(n)","he":"חלוקה לדליים","d":"מחלק שורות ל-n קבוצות שוות ומחזיר מספר קבוצה; שימושי לאחוזונים","rel":["c-rank-dense-rank","topn-per-group"],"node":"sql-core"}]}
```
