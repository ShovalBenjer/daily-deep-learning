# עימוד לפי מפתח
`OFFSET 10000` גורם לבסיס הנתונים לקרוא עשרת אלפים שורות ולזרוק אותן; keyset pagination קופץ ישירות לנקודת ההמשך.

## מה תדע בסוף
לכתוב שאילתת עימוד לפי מפתח שרצה ב-O(log n) גם בדף מיליון, ולהסביר מדוע OFFSET נשבר על טבלאות גדולות.

## האינטואיציה

דמיין ספר עב שאתה קורא בפגישות. כל פגישה אתה פותח מהעמוד האחרון שסיימת, לא סופר עמודים מההתחלה. זה בדיוק keyset pagination.

OFFSET אומר לבסיס הנתונים: "קרא n שורות, זרוק את כולן, תן לי את הבאות." ככל שהמספר גדל, הזבל גדל. Keyset pagination אומר: "תמשיך מהשורה שבה עצרתי," ומשתמש באינדקס כדי לנחות שם ישירות.

המפתח הוא שמירת הערך האחרון שראית, ולא המיקום שלו.

## ההגדרות המדויקות

**Keyset pagination, עימוד לפי מפתח**: שיטת עימוד שבה תנאי ה-WHERE של כל דף מייצג את הגבול שנשמר מהדף הקודם, במקום OFFSET מספרי.

**Sort key, מפתח המיון**: העמודה (או הצמד) שלפיה הסדרה מוגדרת. לשלמות המעקב, ה-sort key חייב להיות ייחודי, ולכן כמעט תמיד כולל עמודה כמו `id`.

**Cursor, סמן**: הערך שנשמר בין הדפים. הלקוח שולח אותו לשרת בכל בקשת "הדף הבא". לרוב מקודד ב-base64 כדי לטשטש את המבנה.

**Row value constructor, בנאי ערך שורה**: תחביר SQL שמשווה tuple של עמודות לתנאי מורכב בשורה אחת: `(a, b) < (x, y)` שקול ל-`(a < x) OR (a = x AND b < y)`.

צורת השאילתה:

```sql
-- דף ראשון
SELECT id, created_at, title
FROM posts
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- כל דף הבא
SELECT id, created_at, title
FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

עבור המעבר הזה לעבוד ביעילות, נדרש אינדקס מורכב:

```sql
CREATE INDEX idx_posts_cursor ON posts (created_at DESC, id DESC);
```

עם האינדקס, הבסיס נתונים מבצע index seek לנקודת ההמשך ב-\(O(\log n)\) במקום full scan.

## דוגמה מחושבת

נניח טבלת `events` עם 500,000 שורות. רוצים דפים של 5.

### שאילתת OFFSET (גרסה ישנה)

```sql
-- דף 10,000 (עמוד 50,000 ב-OFFSET)
SELECT id, ts, name
FROM events
ORDER BY ts DESC, id DESC
LIMIT 5 OFFSET 50000;
```

`EXPLAIN ANALYZE` יראה: "Rows Removed by Filter: 50000". הבסיס קרא 50,005 שורות.

### שאילתת Keyset

```sql
-- דף ראשון
SELECT id, ts, name FROM events ORDER BY ts DESC, id DESC LIMIT 5;
-- תוצאה: שורה אחרונה ts='2024-03-15 10:00:00', id=98712

-- דף שני
SELECT id, ts, name
FROM events
WHERE (ts, id) < ('2024-03-15 10:00:00', 98712)
ORDER BY ts DESC, id DESC
LIMIT 5;
```

`EXPLAIN ANALYZE` יראה: "Index Scan using idx_events_cursor on events, Index Cond: ((ts, id) < (...))". הבסיס קרא בדיוק 5 שורות.

### הפרש זמן ריאלי

| גישה | דף 1 | דף 10,000 |
|------|-------|-----------|
| OFFSET | 2ms | 800ms |
| Keyset | 2ms | 2ms |

## המקרה שמפיל את האינטואיציה

**מה שנראה:** אם `created_at` מספיקה כמפתח יחיד, למה צריך `id`?

**מה קורה בפועל:** בטבלאות עסקיות, עשרות שורות עשויות לשאת אותו `created_at` בדיוק (batch writes, import jobs). אם המיון הוא רק `ORDER BY created_at DESC`, הסדר בין הטיז לא קבוע. ה-WHERE `created_at < :last` יקפוץ ישר מעל כל הטיז, ושורות תאבדנה.

```sql
-- BUG: sort key לא ייחודי
WHERE created_at < '2024-03-15 10:00:00'
-- אם היו 50 שורות עם created_at='2024-03-15 10:00:00',
-- כולן ייעלמו מכל הדפים.
```

הפתרון הוא תמיד לכלול עמודה ייחודית בסוף ה-sort key:

```sql
WHERE (created_at, id) < ('2024-03-15 10:00:00', 98712)
-- כל הטיז ב-created_at מסוננות נכון על פי id
```

## טעויות נפוצות

**1. sort key שאינו ייחודי.** ראה למעלה. שורות נבלעות ללא שגיאה. הסימפטום הוא ספירה כוללת שאינה מתאחדת.

**2. אינדקס על העמודות בסדר שגוי.** אינדקס `(id, created_at)` לא מקרב את `WHERE (created_at, id) < (...)`. האינדקס חייב להיות מורכב בסדר זהה לה-ORDER BY.

**3. שינוי כיוון המיון בדפים שונים.** אם הלקוח מחליף בין ASC ל-DESC, ה-cursor אינו תקף. כיוון המיון קבוע לאורך כל הסשן.

**4. השוואה עם `<=` במקום `<`.** `(created_at, id) <= (:last_created_at, :last_id)` יחזיר את השורה האחרונה של הדף הקודם בראש הדף הנוכחי.

**5. ניסיון לדלג ישירות לדף 500.** Keyset pagination לא תומך בדילוג. כדי להגיע לדף 500 חייבים לעבור דרך 499 הדפים הקודמים או לשמור cursor ישן.

## מתי זה לא משנה

**Keyset לא מתאים כשצריך:**
- **ניווט חופשי** ("קפוץ לדף 47"): OFFSET או שמירה מפורשת של cursors תקופתיים עדיפים.
- **טבלאות קטנות** (מאות שורות): OFFSET ב-10ms זהה ל-keyset ב-10ms.
- **דפים שמשנים סדר בין בקשות** (sorting דינמי מהמשתמש): ה-cursor תלוי בסדר; שינוי עמודת המיון פוסל את כל ה-cursors הקיימים.
- **API שחייב לספור עמודים** ("עמוד 3 מתוך 47"): keyset לא מספק ספירת עמודים כוללת ביעילות.

בראיונות: שאלת "מדוע לא OFFSET" היא שאלת benchmark קלאסית. התשובה הקצרה: "OFFSET n דורש קריאת n שורות שמוחזרות לפח; keyset מבצע index seek."

## חיבור

יחידה זו שייכת לבלוק M2 (SQL analytique). היא יושבת אחרי שאילתות בסיסיות וה-query plan (m2-query-plans), ומניחה שיודעים לקרוא EXPLAIN. היא פותחת את הדרך לנושאים כמו cursor-based replication ו-change data capture, שבהם אותה אידיאה של "המשך מנקודה ידועה" מופיעה ברמת הסטורג'.

```quiz
{"id":"u-m2-keyset-pagination-q1","tree":"systems","skill":"sql","q":"מדוע OFFSET 50000 אטי יותר מ-keyset pagination על אותו הדף?","options":["OFFSET לא יכול להשתמש באינדקסים כלל","OFFSET גורם לבסיס לקרוא 50000 שורות ולזרוק אותן לפני שמחזיר את התוצאה","Keyset משתמש ב-cache מיוחד של בסיס הנתונים","OFFSET לא תקני ב-SQL"],"answer":1,"explain":"OFFSET n דורש שהבסיס יקרא n שורות ויסנן אותן; הוא אינו יכול לדלג עליהן ישירות גם עם אינדקס. Keyset מבצע index seek לנקודת ההמשך ב-O(log n)."}
```

```concepts
{"items":[{"id":"c-keyset-pagination","t":"Keyset Pagination","he":"עימוד לפי מפתח","d":"שיטת עימוד שבה ה-WHERE של כל דף מייצג את הגבול שנשמר מהדף הקודם; יעיל ב-O(log n) גם על טבלאות גדולות בניגוד ל-OFFSET","rel":["c-btree-index"],"node":"sql-core"},{"id":"c-sort-key-uniqueness","t":"Sort Key Uniqueness","he":"ייחודיות מפתח המיון","d":"כאשר עמודת המיון אינה ייחודית, שורות עם ערכים זהים עלולות להאבד בעימוד לפי מפתח; הפתרון הוא הוספת עמודה ייחודית כ-tiebreaker","rel":["c-keyset-pagination"],"node":"sql-core"}]}
```

<!-- audited -->
