# תוכניות ריצה ואינדקסים
`EXPLAIN ANALYZE` מגלה אם PostgreSQL קרא כל שורה בטבלה או קפץ ישר לאחת.

## מה תדע בסוף
תפעיל `EXPLAIN ANALYZE` על שאילתה, תפרש את ההבדל בין Seq Scan לבין Index Scan, ותיצור אינדקס B-tree בעמודה הנכונה כדי להאיץ שאילתה.

## האינטואיציה

דמיין ספרייה עם מאה אלף ספרים. אם תחפש ספר לפי שם המחבר ואין קטלוג, תעבור על כל הספרים אחד אחד. זה **Seq Scan, סריקה רציפה**: PostgreSQL קורא כל שורה בסדר הפיזי בדיסק.

עכשיו דמיין קטלוג כרטיסיות ממוין לפי שם. תפתח בעמוד האמצעי, תשאל "אחרי ה-M או לפני?", תחצה, שוב ושוב. זה בדיוק Binary search, חיפוש בינארי ממש כפי שלמדת ביחידת Binary Search. אינדקס **B-tree** של PostgreSQL בנוי על אותו עיקרון: כל צומת מחלק את מרחב הערכים לשניים עד שמגיעים לשורות הספציפיות.

## ההגדרות המדויקות

**Query plan, תוכנית ריצה**: הרצף שה-Planner של PostgreSQL בוחר לביצוע שאילתה. הוא מחשב עלות משוערת לכל אופציה ובוחר את הזולה.

**EXPLAIN**: מדפיס את התוכנית המשוערת ועלותה בלי לבצע את השאילתה.

**EXPLAIN ANALYZE**: מבצע את השאילתה ומוסיף את הזמן האמיתי שכל שלב לקח.

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42;
```

פלט טיפוסי ללא אינדקס:

```
Seq Scan on orders  (cost=0.00..3450.00 rows=3 width=60)
                    (actual time=0.042..28.4 ms rows=3 loops=1)
  Filter: (customer_id = 42)
  Rows Removed by Filter: 99997
Planning Time: 0.5 ms
Execution Time: 28.9 ms
```

**Seq Scan, סריקה רציפה**: קריאת כל השורות בסדר פיזי. `Rows Removed by Filter: 99997` אומר ש-PostgreSQL קרא מאה אלף שורות כדי להחזיר שלוש.

**Index Scan, סריקת אינדקס**: הליכה בעץ ה-B-tree לאיתור מצביע השורה, ואז קריאת השורה הספציפית. שני שלבים, אבל קוראים הרבה פחות נתונים.

**B-tree index, אינדקס עץ בינארי מאוזן**: מבנה עץ שמאפשר חיפוש, הכנסה ומחיקה ב-\(O(\log n)\). מתאים לכל שוואה: `=`, `<`, `>`, `BETWEEN`, `LIKE 'prefix%'`.

יצירת אינדקס:

```sql
CREATE INDEX idx_orders_customer ON orders(customer_id);
```

אחרי היצירה, תוכנית הריצה משתנה:

```
Index Scan using idx_orders_customer on orders
                    (cost=0.42..12.50 rows=3 width=60)
                    (actual time=0.031..0.055 ms rows=3 loops=1)
  Index Cond: (customer_id = 42)
Execution Time: 0.1 ms
```

זמן הביצוע ירד מ-28.9ms ל-0.1ms.

**Composite index, אינדקס מורכב**: אינדקס על יותר מעמודה אחת. כלל האצבע: שים את עמודת הסינון השווה (`=`) ראשונה, ואחריה עמודת הטווח (`<`, `>`, `BETWEEN`).

```sql
CREATE INDEX idx_orders_cust_date ON orders(customer_id, created_at);
```

## דוגמה מחושבת

**טבלה:** `events(id, user_id, event_type, created_at)` עם מיליון שורות.

**שאילתה:** "כל האירועים של user 7 מאוקטובר 2026"

```sql
EXPLAIN ANALYZE
SELECT * FROM events
WHERE user_id = 7
  AND created_at >= '2026-10-01'
  AND created_at <  '2026-11-01';
```

**ללא אינדקס:** Seq Scan, קורא מיליון שורות.

```
Seq Scan on events  (cost=0.00..28330.00 rows=12 width=88)
  Filter: (user_id = 7 AND created_at >= ...)
  Rows Removed by Filter: 999988
Execution Time: 420 ms
```

**עם אינדקס מורכב:**

```sql
CREATE INDEX idx_ev_user_date ON events(user_id, created_at);
```

```
Index Scan using idx_ev_user_date on events
  Index Cond: ((user_id = 7) AND (created_at >= ...) AND (created_at < ...))
Execution Time: 0.3 ms
```

קפיצה של 1400x בביצועים.

```quiz
{"id":"u-m2-query-plans-q1","tree":"systems","skill":"sql","q":"מה ההבדל בין EXPLAIN לבין EXPLAIN ANALYZE?","options":["EXPLAIN מבצע את השאילתה; EXPLAIN ANALYZE רק מדפיס את התוכנית המשוערת","EXPLAIN ANALYZE מבצע את השאילתה ומוסיף את הזמן האמיתי; EXPLAIN בלבד רק מדפיס את התוכנית המשוערת","EXPLAIN ANALYZE יוצר אינדקסים אוטומטיים; EXPLAIN לא","EXPLAIN עובד רק על SELECT; EXPLAIN ANALYZE עובד על כל סוגי השאילתות"],"answer":1,"explain":"EXPLAIN לבד לא מריץ את השאילתה, רק מחשב ומדפיס את תוכנית הריצה עם עלות משוערת. EXPLAIN ANALYZE מבצע את השאילתה בפועל ומוסיף actual time לכל שלב."}
```

## המקרה שמפיל את האינטואיציה

**אינדקס על עמודה עם cardinality נמוכה לא עוזר.**

**Cardinality, עוצמת הבחנה**: מספר הערכים הייחודיים בעמודה ביחס לסך השורות. `user_id` עם מיליון ערכים שונים: cardinality גבוהה. `status` עם שלושה ערכים אפשריים: cardinality נמוכה.

נניח `orders.status` מכיל רק `'pending'`, `'shipped'`, `'cancelled'`. אתה יוצר אינדקס ומצפה לשאילתה מהירה:

```sql
SELECT * FROM orders WHERE status = 'pending';
```

אבל PostgreSQL בוחר ב-Seq Scan. למה?

כמעט שליש מהשורות הן `'pending'`. הליכה ב-B-tree וקריאת שליש מה-heap pages בסדר לא-ליניארי (random I/O) יקרה יותר מקריאה ישרה של הדיסק. ה-Planner שומר סטטיסטיקות בטבלה הפנימית `pg_statistic`, ואם מעל כ-10-20% מהשורות תואמות, seq scan ינצח בדרך כלל.

**המסקנה:** אינדקס עוזר כשהוא *סלקטיבי*, כלומר מסנן את רוב השורות.

## טעויות נפוצות

1. **אינדקס על כל עמודה**: כל `INSERT`, `UPDATE`, `DELETE` מעדכן את כל האינדקסים הרלוונטיים. יותר מדי אינדקסים מאטים כתיבות ותופסים דיסק.

2. **לשכוח `ANALYZE` אחרי טעינת דאטה**: ה-Planner מחשב selectivity מ-`pg_statistic`. אם הטבלה השתנתה ולא ריצת `ANALYZE`, ה-Planner עובד עם סטטיסטיקות ישנות ועלול לבחור תוכנית גרועה.

3. **סדר עמודות הפוך באינדקס מורכב**: `CREATE INDEX ON orders(created_at, customer_id)` לא יסייע לשאילתה שמסננת ב-`WHERE customer_id = ?`. הסדר בעץ נקבע מהעמודה הראשונה.

4. **`EXPLAIN` בלי `ANALYZE`**: עלות משוערת בלי למדוד בפועל אינה מדידה. השתמש ב-`EXPLAIN ANALYZE` על דאטה מייצגת.

## מתי זה לא משנה

- **טבלאות קטנות (פחות מכ-1000 שורות)**: Seq Scan תמיד מנצח; עלות traversal ב-B-tree גבוהה יותר מקריאה ישרה.
- **ETL ו-bulk inserts**: לעיתים כדאי להוריד אינדקסים לפני טעינה מסיבית ולבנות אותם מחדש אחר כך.
- **OLAP ו-full scans בכוונה**: שאילתות אנליטיות קוראות לעיתים קרובות את כל הטבלה; Column Store (Redshift, BigQuery, Snowflake) מחליף אינדקסים שם.
- **ראיון**: מי שמפעיל `EXPLAIN ANALYZE` ומסביר Seq Scan מול Index Scan נראה מוכן יותר מרוב המועמדים.

## חיבור

יחידה זו מחברת את כל מה שלמדת במודול M2: צירופים, Window Functions ו-CTEs יוצרים שאילתות מורכבות, אך ה-Planner מחליט אם לרוץ אותן בצורה יעילה. `EXPLAIN ANALYZE` הוא הכלי שמגשר בין כתיבת SQL נכון לבין כתיבת SQL מהיר.

היחידה הבאה הטבעית היא **Keyset Pagination** (m2-keyset-pagination): שם האינדקס על עמודת ה-cursor הוא המרכיב שהופך פגינציה מ-\(O(n)\) ל-\(O(\log n)\).

```concepts
{"items":[{"id":"c-query-plan","t":"Query plan","he":"תוכנית ריצה","d":"רצף הצעדים שה-Planner בוחר לביצוע שאילתה; כולל סוג הסריקה, צירופים ועלות משוערת","rel":["c-seq-scan","c-index-scan"],"node":"sql-core"},{"id":"c-seq-scan","t":"Seq Scan","he":"סריקה רציפה","d":"קריאת כל שורות הטבלה בסדר פיזי; עדיפה כשאחוז גבוה מהשורות תואם או הטבלה קטנה","rel":["c-query-plan","c-index-scan"],"node":"sql-core"},{"id":"c-index-scan","t":"Index Scan","he":"סריקת אינדקס","d":"מעבר ב-B-tree לאיתור מצביע השורה ואז קריאת ה-heap tuple; עדיפה כשהאינדקס סלקטיבי","rel":["c-query-plan","c-seq-scan","c-btree-index"],"node":"sql-core"},{"id":"c-btree-index","t":"B-tree index","he":"אינדקס עץ בינארי מאוזן","d":"מבנה נתונים מאוזן ב-O(log n) לשוויון, טווחים ומיון; סוג האינדקס הדיפולטי ב-PostgreSQL","rel":["c-index-scan"],"node":"sql-core"},{"id":"c-index-cardinality","t":"Index cardinality","he":"סלקטיביות אינדקס","d":"כמה ייחודית עמודה; cardinality נמוכה כמו status עם 3 ערכים גורמת ל-Planner לבחור seq scan גם עם אינדקס","rel":["c-seq-scan","c-btree-index"],"node":"sql-core"}]}
```
