# איחוד-מציאה
ידיד של ידיד שלך הוא ידיד שלך - Union-Find מממש בדיוק את ההיגיון הזה ב-O(1) בממוצע.

## מה תדע בסוף
תוכל לזהות בעיות קישוריות בגרפים, לממש DSU עם path compression ו-union by rank ב-Python, ולהסביר למה כל פעולה היא קרוב ל-O(1) בממוצע למרות שהמבנה הוא עץ.

## האינטואיציה
דמיין קבוצות חברים ברשת חברתית. כל אדם מתחיל לבד. כשאנשים נעשים חברים, הקבוצות שלהם מתמזגות. בכל עת ניתן לשאול: "האם X ו-Y מכירים אחד את השני דרך שרשרת חברויות?"

**Union-Find**, שנקרא גם **DSU (Disjoint Set Union, איחוד קבוצות זרות)**, הוא מבנה נתונים שעושה בדיוק זאת. לכל קבוצה יש "נציג" - הצומת השורש שמזהה אותה. כשמאחדים שתי קבוצות, שורש אחד הופך לילד של השני.

## ההגדרות המדויקות

**Disjoint Set Union (DSU, איחוד קבוצות זרות)**: מבנה נתונים לניהול מחיצה - חלוקה של n איברים לקבוצות שאין ביניהן חפיפה. שלוש פעולות:

- `makeset(x)`: יוצר קבוצה של x לבד. במימוש המערך, `parent[x] = x`.
- `find(x)`: מחזיר את השורש של הקבוצה של x.
- `union(x, y)`: מאחד את הקבוצות של x ו-y. מחזיר False אם כבר היו יחד.

**Path compression, דחיסת מסלול**: אופטימיזציה ב-`find`. אחרי שמצאנו את השורש, מעדכנים את ה-parent של כל הצמתים שעברנו ישירות לשורש. בקריאה הבאה - מסלול של צעד אחד.

**Union by rank, איחוד לפי דרגה**: אופטימיזציה ב-`union`. תמיד מחברים את העץ הנמוך מתחת לגבוה. כך העץ נשאר שטוח.

**מורכבות**: עם שתי האופטימיזציות יחד, כל פעולה היא \(O(\alpha(n))\) - פונקציית inverse-Ackermann, שקטנה מ-5 לכל n שימושי. למטרות ראיון: **O(1) בממוצע**.

```python
class DSU:
    def __init__(self, n: int):
        self.parent = list(range(n))  # parent[i] = i: כל צומת שורש של עצמו
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False  # כבר באותה קבוצה
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx  # rx תמיד הגבוה
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        return True

    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)
```

## דוגמה מחושבת

5 צמתים: 0, 1, 2, 3, 4. נריץ שלוש פעולות union ושאלת קישוריות:

```
d = DSU(5)
# parent = [0, 1, 2, 3, 4]   rank = [0, 0, 0, 0, 0]

d.union(0, 1)
# find(0)=0, find(1)=1. rank[0]==rank[1]==0 → parent[1]=0, rank[0]=1
# parent = [0, 0, 2, 3, 4]   rank = [1, 0, 0, 0, 0]

d.union(2, 3)
# find(2)=2, find(3)=3. rank[2]==rank[3]==0 → parent[3]=2, rank[2]=1
# parent = [0, 0, 2, 2, 4]   rank = [1, 0, 1, 0, 0]

d.union(0, 2)
# find(0)=0, find(2)=2. rank[0]==rank[2]==1 → parent[2]=0, rank[0]=2
# parent = [0, 0, 0, 2, 4]   rank = [2, 0, 1, 0, 0]

d.connected(1, 3)
# find(1): parent[1]=0, שורש 0
# find(3): parent[3]=2, parent[2]=0. path compression → parent[3]=0. שורש 0
# 0 == 0 → True

d.connected(0, 4)
# find(0)=0, find(4)=4 → 0 != 4 → False
```

```quiz
{"id":"u-m1-union-find-q1","tree":"systems","skill":"python","q":"מה מחזיר union(x, y) כאשר x ו-y כבר שייכים לאותה קבוצה?","options":["True - הקבוצה קיימת","False - לא בוצע איחוד","None","ValueError"],"answer":1,"explain":"כאשר find(x) == find(y) הצמתים כבר מחוברים. לא נדרש איחוד ולכן מחזירים False. זו גם הדרך לזהות מעגל: קשת שני קצותיה כבר מחוברים יוצרת מעגל."}
```

## המקרה שמפיל את האינטואיציה

**Union-Find לא מזהה מעגלים בגרפים מכוונים.** בגרף לא מכוון, אם `union(u, v)` מחזיר False, הצמתים כבר מחוברים וגילינו מעגל:

```python
def has_cycle(n: int, edges: list[tuple[int, int]]) -> bool:
    d = DSU(n)
    for u, v in edges:
        if not d.union(u, v):
            return True
    return False
```

אבל בגרף **מכוון** זה נכשל. קצה `0 -> 1` ו-`1 -> 2` ו-`2 -> 0` הם מעגל - אבל Union-Find, שמתעלם מכיוון, יזהה אותם כנכון. לגרף מכוון צריך DFS עם סימון "בביקור" (צבע אפור).

**Path compression ואיטרטיביות:** ה-`find` הרקורסיבי עלול ל-stack overflow על עצים עמוקים לפני שה-compression מתבצע. לבטחון על קלט עוין - ממשו `find` בלולאה:

```python
def find(self, x: int) -> int:
    root = x
    while self.parent[root] != root:
        root = self.parent[root]
    while self.parent[x] != root:  # path compression
        nxt = self.parent[x]
        self.parent[x] = root
        x = nxt
    return root
```

## טעויות נפוצות

**1. find ללא path compression:** כותבים `find` שרק עולה לשורש ולא מעדכן parent. כל קריאה עוברת את כל המסלול מחדש. הסיבוכיות מתדרדרת ל-O(n) בגרוע.

**2. union ישיר לפי index:** כותבים `self.parent[x] = y` במקום לקרוא ל-`find(x)` ו-`find(y)`. מחברים את הצומת x לצומת y, לא לשורש של הקבוצה של y. המבנה מתפרק.

**3. union by rank ללא החלפה:** כשrank[rx] < rank[ry] חייבים להחליף את rx ו-ry לפני האיחוד, לא אחריו. מי שוכח את ה-swap מחבר את העץ הגבוה מתחת לנמוך ומקבל עץ עמוק.

**4. rank במקום size:** rank אינו גודל הקבוצה. rank עולה רק כשמאחדים שני עצים שווי-rank. אם רוצים לדעת כמה איברים בקבוצה, מנהלים מערך size נפרד.

## מתי זה לא משנה

**כשצריך את הנתיב ולא רק קישוריות:** Union-Find עונה "האם מחוברים?" - לא "מה המסלול?". לנתיב צריך BFS או Dijkstra.

**כשהגרף מכוון:** DSU עובד על קישוריות לא-מכוונת בלבד. לרכיבים קשר חזק בגרף מכוון - Tarjan או Kosaraju.

**כשהגרף קטן (פחות מ-20 צמתים):** BFS/DFS פשוטים יותר לכתיבה ולנפוי. אל תתחכמו לשווא.

**בראיון:** כשהמראיין שואל "מספר רכיבי קישוריות", "minimal spanning tree" (Kruskal), "זיהוי מעגל בגרף לא מכוון" - Union-Find. כשהוא שואל "מסלול קצר" - BFS/Dijkstra.

## חיבור

Union-Find משלים את חבילת הגרפים שלמדת: Graph Traversal לסריקה, Shortest Path למרחקים, ועכשיו Union-Find לקישוריות. יחד שלישייה זו מכסה את רוב שאלות הגרפים בראיונות.

השלב הבא בM1: **DP 1D** - אם Union-Find היה על "קישור", DP הוא על "החלטות אופטימליות שצוברות לאחור".

```fillin
{"id":"u-m1-union-find-f1","tree":"systems","skill":"python","prompt":"ב-union by rank, לפני parent[ry] = rx מוודאים ש-rank[rx] >= rank[ry]. אם rank[rx] < rank[ry] כותבים ___","answer":"rx, ry = ry, rx","alt":["swap(rx, ry)","החלף את rx ו-ry"],"explain":"תמיד מחברים את העץ הנמוך מתחת לגבוה. אם rank[rx] < rank[ry], מחליפים ביניהם כך ש-rx יהיה השורש בעל הrank הגבוה יותר, ואז parent[ry] = rx יהיה נכון."}
```

```concepts
{"items":[{"id":"union-find","t":"Union-Find / DSU","he":"איחוד-מציאה","d":"מבנה נתונים לניהול קבוצות זרות עם find ו-union ב-O(alpha(n)) בממוצע","rel":["graph-traversal","shortest-path"],"node":"dsa"},{"id":"path-compression","t":"Path compression","he":"דחיסת מסלול","d":"אופטימיזציה ב-DSU: אחרי find, מעדכנים parent של כל צמתי המסלול לשורש","rel":["union-find"],"node":"dsa"},{"id":"union-by-rank","t":"Union by rank","he":"איחוד לפי דרגה","d":"אופטימיזציה ב-DSU: מחברים עץ נמוך מתחת לגבוה לשמירה על עץ שטוח","rel":["union-find"],"node":"dsa"}]}
```

<!-- audited -->
