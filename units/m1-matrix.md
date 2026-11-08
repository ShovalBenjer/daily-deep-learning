# מטריצות
כשכל תא בגריד שואל "מה עם השכנים שלי?" - כמעט כל בעיית מטריצה היא שאלה על שכנות.

## מה תדע בסוף
תדע לייצג מטריצה ב-Python בצורה נכונה, לעבור עליה בשלוש דרכים (שורה-עמודה, DFS, BFS), לבצע rotation של 90 מעלות in-place, ולזהות איזה דפוס מתאים לכל בעיית גריד.

## האינטואיציה

דמיין לוח שחמט: 8x8 תאים, כל תא יודע את הקואורדינטות שלו (שורה, עמודה). כשנשאל "כמה איים יש בגריד?" - הוסף אבן למים: הגל הראשון מגיע לשכנים הישירים (למעלה, למטה, שמאל, ימין), הגל השני לשכניהם, וכך עד שכל האי נסקר.

כשרואים "grid" / "matrix" / "board" בבעיה - ברוב המקרים הפתרון מתבסס על אחד מארבעה דפוסים:

| דפוס | מתי | דוגמת בעיה |
|------|-----|-------------|
| BFS/DFS | ספירת רצפים מחוברים | Number of Islands |
| Traversal | סינון, חיפוש, הצבה | Set Matrix Zeroes |
| In-place rotation | שינוי מבנה | Rotate Image |
| Spiral | מיפוי לרשימה | Spiral Matrix |

## ההגדרות המדויקות

**Matrix, מטריצה**: רשימה של רשימות ב-Python. `matrix[row][col]` ניגש לתא בשורה `row` ועמודה `col`.

יצירה נכונה ושגויה:

```python
# נכון: n רשימות עצמאיות
matrix = [[0] * n for _ in range(m)]

# שגוי: כולן אותה רשימה!
matrix = [[0] * n] * m
```

ב-`[[0]*n]*m` כל השורות הן reference לאותו אובייקט. שינוי ב-`matrix[0][0]` ישנה גם את `matrix[1][0]`, `matrix[2][0]` וכו'.

**Dimensions, מימדים**: `rows = len(matrix)`, `cols = len(matrix[0])`.

**Directions, כיוונים**: הסטנדרט ל-BFS/DFS על גריד (ארבעה כיוונים):

```python
dirs = [(0, 1), (0, -1), (1, 0), (-1, 0)]  # ימין שמאל למטה למעלה
```

**In-bounds check, בדיקת גבולות**: `0 <= nr < rows and 0 <= nc < cols`.

**BFS על גריד**: אותו BFS רגיל, אבל במקום שכנים גרפיים - שכנים לפי `dirs`:

```python
from collections import deque

def bfs_grid(matrix, start_r, start_c):
    rows, cols = len(matrix), len(matrix[0])
    queue = deque([(start_r, start_c)])
    visited = {(start_r, start_c)}
    while queue:
        r, c = queue.popleft()
        for dr, dc in dirs:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in visited:
                visited.add((nr, nc))
                queue.append((nr, nc))
```

**In-place rotation (90 מעלות), סיבוב מקומי**: הטריק בשני שלבים:
1. **Transpose, שחלוף**: החלף `matrix[i][j]` עם `matrix[j][i]`.
2. **Reverse rows, היפוך שורות**: הפוך כל שורה.

```python
def rotate(matrix):
    n = len(matrix)
    # שלב א: transpose
    for i in range(n):
        for j in range(i + 1, n):
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    # שלב ב: reverse each row
    for row in matrix:
        row.reverse()
```

## דוגמה מחושבת

**Number of Islands** (LeetCode 200): ספור כמה אי-ים (`'1'`) יש בגריד.

```python
def numIslands(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    count = 0

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != '1':
            return
        grid[r][c] = '0'  # סמן כנסקר
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                dfs(r, c)
                count += 1
    return count
```

ריצה על:
```
1 1 0
0 1 0
0 0 1
```

- `(0,0)`: `'1'` - DFS מסמן `(0,0)`, `(0,1)`, `(1,1)`. count = 1.
- `(2,2)`: `'1'` - DFS מסמן `(2,2)`. count = 2.
- **תשובה: 2 איים.**

**מורכבות**: \(O(m \cdot n)\) זמן, \(O(m \cdot n)\) זיכרון (stack הרקורסיה).

**Rotate Image** (LeetCode 48): סובב מטריצה \(3 \times 3\) ימינה 90 מעלות:

```
קלט:        אחרי transpose:   אחרי reverse:
1 2 3        1 4 7             7 4 1
4 5 6   ->   2 5 8    ->       8 5 2
7 8 9        3 6 9             9 6 3
```

שתי הפעולות יחד = סיבוב 90 מעלות עם \(O(1)\) זיכרון נוסף.

## המקרה שמפיל את האינטואיציה

**Set Matrix Zeroes** (LeetCode 73): אם תא הוא 0 - הפוך את כל השורה והעמודה שלו ל-0.

הגישה הנאיבית: עבור על המטריצה, כל פעם שתא הוא 0 - שנה את השורה/עמודה כבר עכשיו.

הבעיה: תאים שהפכו ל-0 "תוך כדי הסריקה" נראים כ-0 מקורי בהמשך, וגורמים לאפסון נוסף שלא התכוונו אליו. הפתרון - שמירת ה-0 המקוריים תחילה:

```python
def setZeroes(matrix):
    rows, cols = len(matrix), len(matrix[0])
    zero_rows, zero_cols = set(), set()

    for r in range(rows):
        for c in range(cols):
            if matrix[r][c] == 0:
                zero_rows.add(r)
                zero_cols.add(c)

    for r in range(rows):
        for c in range(cols):
            if r in zero_rows or c in zero_cols:
                matrix[r][c] = 0
```

האינטואיציה "שנה on-the-fly" שוברת כי "0 שנוצר עכשיו" נסרק מחדש ואפסון מתפשט.

## טעויות נפוצות

**1. יצירת מטריצה עם `[[val]*n]*m`**: כל השורות חולקות אותו אובייקט. שינוי בשורה 0 ישנה את כל השורות. תמיד: `[[val]*n for _ in range(m)]`.

**2. גישה לתא לפני בדיקת גבולות**: `nr, nc = r + dr, c + dc` ואז `matrix[nr][nc]` ישר. תמיד בדוק `0 <= nr < rows and 0 <= nc < cols` קודם.

**3. BFS ללא `visited`**: בלי סימון, שני שכנים שונים יכולים שניהם להוסיף את אותו תא ל-queue לפני שהוא עובד. התא יעובד פעמיים ו-runtime הופך ל-\(O((m \cdot n)^2)\) במקרה גרוע. סמן את התא `visited` ברגע שמוסיפים אותו ל-queue, לא ב-popleft.

**4. DFS רקורסיבי על גריד גדול**: Python מגביל את עומק הרקורסיה (כ-1000 קריאות כברירת מחדל). גריד של 300x300 = 90,000 תאים - DFS עלול לקרוס. בגריד גדול, BFS עם `deque` בטוח יותר.

**5. Transpose שגוי**: `for j in range(n)` (ולא `range(i+1, n)`) גורם להחלפה כפולה שמבטלת את עצמה - מקבלים חזרה את המטריצה המקורית.

## מתי זה לא משנה

כשהמידע חד-ממדי ואין שכנות - אין צורך במטריצה. עבור גרף כללי (לא גריד), **Adjacency List, רשימת שכנות** יעיל הרבה יותר מייצוג מטריצת שכנות.

**מטריצת שכנות מול רשימת שכנות**: מטריצה תצרוך \(O(n^2)\) זיכרון גם לגרף עם 10 קשתות ו-1000 צמתים. רשימת שכנות תצרוך \(O(n + e)\) כאשר e מספר הקשתות.

בראיון: כשרואים grid של n > 300 - בדוק שה-BFS/DFS שלך הוא \(O(n \cdot m)\) ולא יותר. עומק DFS על גריד = שטח הגריד, לא גובה עץ, לכן BFS בטוח יותר.

## חיבור

יחידה זו שייכת ל-M1 (DSA). תבנית ה-BFS על גריד היא מקרה פרטי של Graph Traversal - יחידה `m1-graph-traversal` מרחיבה לגרפים כלליים. לאחריה `m1-shortest-path` מוסיפה משקלות ו-Dijkstra.

```quiz
{"id":"u-m1-matrix-q1","tree":"systems","skill":"python","q":"מה ייקרה אחרי הקוד: `m = [[0]*3]*2; m[0][0] = 9`?","options":["רק `m[0][0]` יהיה 9; שאר התאים יישארו 0","גם `m[1][0]` יהיה 9, כי שתי השורות חולקות אותו אובייקט","שגיאת runtime כי לא ניתן לשנות תא כך","רק `m[0]` תשתנה; `m[1]` תישאר ריפרנס מקורי"],"answer":1,"explain":"כפל רשימה ב-Python (`*2`) יוצר שתי הפניות לאותו אובייקט, לא שתי רשימות עצמאיות. `m[0]` ו-`m[1]` מצביעים על אותה רשימה. הפתרון: `[[0]*3 for _ in range(2)]`."}
```

```quiz
{"id":"u-m1-matrix-q2","tree":"systems","skill":"python","q":"בבעיית Number of Islands, מדוע מסמנים תא כ-visited ברגע שמוסיפים אותו ל-queue (ולא אחרי popleft)?","options":["זו סתם קונבנציה בלי השפעה","כדי לא להוסיף את אותו תא ל-queue פעמיים על ידי שני שכנים שונים","כדי שהתא לא ייסרק שוב אחרי שיצא מה-queue","כדי לחסוך זיכרון ב-visited set"],"answer":1,"explain":"אם מסמנים רק ב-popleft, שני שכנים של אותו תא יכולים שניהם להוסיף אותו ל-queue לפני שהוא מסומן. התא יעובד פעמיים - שגיאה בספירה ו-runtime גרוע יותר. סימון מיידי בעת ההוספה מונע כפילויות."}
```

```concepts
{"items":[{"id":"c-matrix-python","t":"Matrix (2D array)","he":"מטריצה","d":"רשימת רשימות ב-Python; גישה ב-matrix[row][col]; יצירה נכונה: list comprehension ולא כפל","rel":["c-bfs-grid","c-matrix-rotation"],"node":"dsa"},{"id":"c-bfs-grid","t":"BFS on grid","he":"BFS על גריד","d":"BFS עם 4 כיוונים; סימון visited בעת הוספה ל-queue מונע עיבוד כפול","rel":["c-matrix-python","c-graph-bfs"],"node":"dsa"},{"id":"c-matrix-rotation","t":"In-place matrix rotation","he":"סיבוב מטריצה מקומי","d":"Transpose ואחר כך reverse שורות = 90 מעלות עם O(1) זיכרון נוסף","rel":["c-matrix-python"],"node":"dsa"}]}
```
