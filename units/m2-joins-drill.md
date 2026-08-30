# צירופים ואיך הם נכשלים: תרגול
JOIN אחד שגוי יכול להחזיר פי שלושה שורות ממה שציפית, בלי שגיאה וללא אזהרה.

## מה תדע בסוף
תוכל לכתוב INNER, LEFT, FULL OUTER ו-anti-join מהזיכרון ולהסביר את ההבדל; תזהה מתי WHERE מבטלת LEFT JOIN ותדע להעביר את התנאי ל-ON; תספור שורות ב-CROSS JOIN ותזהה row fanout כבאג.

## האינטואיציה
חשוב על שני ערימות קלפים: "עובדים" ו"מחלקות". INNER JOIN הוא הכניסה לחדר: רק מי שיש לו שם בשתי הערימות נכנס. LEFT JOIN הוא כיסא מובטח: כל עובד יושב, ואם אין לו מחלקה - הכיסא ממולו ריק (NULL). anti-join הוא ניגוד: "מי יושב עם כיסא ריק ממולו?" - LEFT JOIN ואז WHERE צד ימין IS NULL. row fanout הוא הפתעה: כשמפתח ה-JOIN אינו ייחודי, כל "קלף" שמאלי מתכפל עם כל ה"קלפים" הימניים שמתאימים לו.

## ההגדרות המדויקות

**anti-join, צירוף שלילי**: מציאת שורות בטבלה A שאין להן שורה מתאימה בטבלה B. כותבים LEFT JOIN ומסננים WHERE b.id IS NULL. NOT IN אינו אמין אם B מכילה NULL בעמודת ה-JOIN.

**row fanout, כפל שורות**: כאשר מצרפים על עמודה שאינה PRIMARY KEY בצד הימני, כל שורה שמאלית מתכפלת עם כל ההתאמות. תוצאה: COUNT(*) גדל; SUM לאחר מכן מוגדל שלא כדין.

**ON לעומת WHERE**: תנאי ב-ON מוחל לפני חיבור השורות; תנאי ב-WHERE מוחל אחרי. ב-INNER JOIN ההבדל פרקטי אינו קיים. ב-LEFT JOIN תנאי על הצד הימני ב-WHERE מסנן שורות NULL ומבטל את ה-LEFT.

## דוגמה מחושבת

### anti-join: מי לא הזמין?

```
users            orders
id  name         order_id  user_id
1   Alice        101       1
2   Bob          102       1
3   Carol        103       2
```

```sql
SELECT u.id, u.name
FROM   users  AS u
LEFT JOIN orders AS o ON u.id = o.user_id
WHERE  o.order_id IS NULL;
```

שלבים:

| u.id | u.name | o.order_id | o.user_id |
|------|--------|------------|-----------|
| 1    | Alice  | 101        | 1         |
| 1    | Alice  | 102        | 1         |
| 2    | Bob    | 103        | 2         |
| 3    | Carol  | NULL       | NULL      |

אחרי WHERE o.order_id IS NULL: נשארת רק שורת Carol.

תוצאה: `3 | Carol`

### WHERE שהורסת LEFT JOIN

```sql
-- ניסיון שגוי: "עובדים עם מחלקה בשם Engineering, כולל אם אין מחלקה"
SELECT e.name, d.dept_name
FROM   employees AS e
LEFT JOIN departments AS d ON e.dept_id = d.dept_id
WHERE  d.dept_name = 'Engineering';   -- ← מסנן NULL, מבטל LEFT!
```

Carol (ללא מחלקה) נעלמת מהתוצאה. הפתרון: להעביר ל-ON.

```sql
LEFT JOIN departments AS d ON e.dept_id = d.dept_id
                          AND d.dept_name = 'Engineering'
```

כעת Carol נשמרת עם NULL בעמודת dept_name.

### row fanout ו-SUM שגוי

```
employees           salaries
id  name            emp_id  month    amount
10  Dana            10      2026-01  8000
                    10      2026-02  8000
```

```sql
SELECT e.name, SUM(s.amount)
FROM   employees AS e
JOIN   salaries  AS s ON e.id = s.emp_id
GROUP BY e.name;
```

תוצאה: `Dana | 16000` - נכון, Dana מקבלת שתי שורות ו-SUM הוא 16000.

עכשיו נוסיף JOIN נוסף שיוצר כפל לא מתוכנן:

```sql
-- projects: emp_id, project (Dana שייכת ל-3 פרויקטים)
SELECT e.name, SUM(s.amount)
FROM   employees AS e
JOIN   salaries  AS s ON e.id = s.emp_id
JOIN   projects  AS p ON e.id = p.emp_id
GROUP BY e.name;
```

כעת Dana מופיעה \(2 \times 3 = 6\) פעמים: `SUM = 48000` - שגוי. הפתרון: לאגד משכורות לפני ה-JOIN עם projects.

### ספירת CROSS JOIN

שלושה צבעים (red, blue, green) ו-4 מידות (S, M, L, XL):

\[
\text{CROSS JOIN} = 3 \times 4 = 12 \text{ שורות}
\]

## המקרה שמפיל את האינטואיציה

NULL בצד שמאל של JOIN אינו ניתן להתאמה, אפילו ל-NULL בצד ימין.

```
orders            coupons
order_id  coupon_id   id   code
1         NULL        NULL FREEBIE
2         5           5    SALE20
```

```sql
SELECT o.order_id, c.code
FROM   orders   AS o
LEFT JOIN coupons AS c ON o.coupon_id = c.id;
```

תוצאה:

| order_id | code   |
|----------|--------|
| 1        | NULL   |
| 2        | SALE20 |

order 1 לא הצליח להתחבר ל-coupon עם id=NULL, כי הביטוי `NULL = NULL` מחזיר UNKNOWN ולא TRUE. שורת coupon הראשונה נעלמת לגמרי. אין שגיאה - זה SQL תקני.

## טעויות נפוצות

1. **NOT IN עם NULL מחזיר קבוצה ריקה**: `WHERE user_id NOT IN (SELECT user_id FROM orders)` - אם orders מכילה שורה אחת עם user_id=NULL, כל ה-NOT IN נהיה UNKNOWN ולא מוחזרת שום שורה. השתמש ב-NOT EXISTS או ב-anti-join עם LEFT JOIN / IS NULL.

2. **WHERE על הצד הימני הופכת LEFT ל-INNER**: תנאי `WHERE right_table.col = 'x'` מסנן את שורות ה-NULL שיצר ה-LEFT JOIN. הכלל: תנאי סינון על הצד הימני שייך ל-ON; תנאי סינון על הצד השמאלי שייך ל-WHERE.

3. **JOIN לפני GROUP BY מכפיל את ה-SUM**: הסדר הבטוח הוא: אגד (SUM, MAX) בתת-שאילתה או CTE לפני ה-JOIN, לא אחריו.

4. **CROSS JOIN בשגגה**: `FROM a, b` ללא ON. בטבלאות של מיליון שורות זה מייצר טריליון שורות.

## מתי זה לא משנה

כשעובדים על טבלה אחת ללא JOIN כלל, בחירת סוג ה-JOIN אינה רלוונטית. בטבלאות קטנות ומנוהלות ללא NULL, INNER ו-LEFT לעיתים יחזירו אותה תוצאה - אך לא כדאי לסמוך על זה בקוד ייצור. בראיון: "INNER הוא ברירת המחדל כשיודעים שהמפתח הזר אינו NULL; LEFT כשצריך לשמור שורות גם בהיעדר התאמה."

## חיבור

anti-join חוזר ב-m2-aggregation (לקוחות ללא רכישה) וב-m2-gaps-islands (ימים חסרים ברצף). row fanout הוא הסיבה לכלל "אגד לפני JOIN" שיחזור ב-m2-window-functions. הבנת שני הדפוסים האלה פותרת את מרבית בעיות ה-SQL בראיונות ב-DataLemur ברמת medium.

הבא: **m2-aggregation-drill** (אגרגציה וקיבוץ: תרגול).

```quiz
{"id":"u-m2-joins-drill-q1","tree":"systems","skill":"sql","q":"users מכיל שורות עם ids 1, 2, 3. orders מכיל שורות ל-user_id 1 ו-2 בלבד. מה תחזיר השאילתה?\nSELECT u.id FROM users u LEFT JOIN orders o ON u.id=o.user_id WHERE o.order_id IS NULL;","options":["1 ו-2","3 בלבד","1, 2 ו-3","שגיאת SQL"],"answer":1,"explain":"LEFT JOIN שומר את כל users. WHERE o.order_id IS NULL מחזיר רק את השורות שלא נמצאה להן התאמה ב-orders - user 3 בלבד. זהו דפוס anti-join."}
```

```quiz
{"id":"u-m2-joins-drill-q2","tree":"systems","skill":"sql","q":"LEFT JOIN בין employees ו-departments, ואחריו WHERE d.dept_name='Engineering'. מה התוצאה לעומת LEFT JOIN בלי WHERE?","options":["זהה לחלוטין","עובדים ללא מחלקה נשמרים עם dept_name=NULL","עובדים ללא מחלקה נעלמים - בפועל INNER JOIN","שגיאת syntax"],"answer":2,"explain":"WHERE על הצד הימני מסנן שורות NULL שנוצרו מה-LEFT JOIN. עובד ללא מחלקה מקבל NULL ב-dept_name ולכן נפסל ב-WHERE. הפתרון: להעביר את התנאי ל-ON."}
```

```quiz
{"id":"u-m2-joins-drill-q3","tree":"systems","skill":"sql","q":"employees (id=1, name='Ana') מצורפת ל-salaries שמכילה 3 שורות ל-emp_id=1, ול-projects שמכילה 2 שורות ל-emp_id=1. כמה שורות תייצר שרשרת ה-JOIN לפני GROUP BY?","options":["3","2","5","6"],"answer":3,"explain":"employees×salaries = 3 שורות; כל אחת מהן מוכפלת עם 2 projects, כך 3×2=6. SUM(salary) לאחר מכן יהיה כפול מהצפוי."}
```

```fillin
{"id":"u-m2-joins-drill-f1","tree":"systems","skill":"sql","prompt":"כתוב את המילים החסרות כדי למצוא מוצרים שמעולם לא הוזמנו. products(id, name), order_items(product_id).\n\nSELECT p.id, p.name\nFROM products p\n___ JOIN order_items oi ON p.id = oi.product_id\nWHERE oi.product_id ___;","answer":"LEFT / IS NULL","alt":["left / is null","LEFT / IS NULL","LEFT\nIS NULL"],"explain":"LEFT JOIN שומר את כל products. WHERE oi.product_id IS NULL מחזיר רק מוצרים שאין להם שורה תואמת ב-order_items - כלומר מוצרים שלא הוזמנו. anti-join קלאסי."}
```

```widget
{"type":"algviz","algo":"join-matcher","title":"JOIN Matcher: צפה כיצד שורות מתאימות ב-LEFT / INNER / FULL OUTER"}
```

```concepts
{"items":[{"id":"c-anti-join","t":"Anti-join","he":"צירוף שלילי","d":"LEFT JOIN WHERE right_id IS NULL: מחזיר שורות שאין להן התאמה בטבלה הימנית","rel":["c-left-join","c-null-in-join"],"node":"sql-core"},{"id":"c-join-fanout","t":"Join fanout","he":"כפל שורות","d":"צירוף על עמודה שאינה PRIMARY KEY מכפיל שורות; SUM לאחר מכן גדל שלא כדין","rel":["c-inner-join","c-left-join"],"node":"sql-core"}]}
```
