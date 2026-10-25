# מסלול קצר ביותר
כשמפות גוגל מוצאת נתיב תוך שניות, היא מריצה גרסה של האלגוריתם שתלמד כאן.

## מה תדע בסוף
תוכל להחליט מתי BFS מספיק ומתי צריך Dijkstra, לממש שניהם ב-Python, ולהסביר למה קשת אחת עם משקל שלילי שוברת את הגישה הרגילה לגמרי.

## האינטואיציה
דמיין מבוך עם חדרים ומנהרות. כל מנהרה לוקחת זמן מסוים לעבור. רצונך להגיע מחדר A לחדר Z במינימום זמן.

**גישה 1 (BFS):** אם כל המנהרות לוקחות בדיוק שנייה, הדרך הכי חכמה היא לפתוח את כל הדלתות הקרובות קודם, אחר כך את הבאות, וכן הלאה. הראשון שמגיע ל-Z ניצח. BFS עושה בדיוק זאת.

**גישה 2 (Dijkstra):** אם המנהרות שונות (חמש דקות, שלוש שניות, שעה), BFS ייכשל: הוא סופר קשתות ולא זמן. כאן Dijkstra אומר: "תמיד המשך מהחדר שהגעת אליו הכי מהר עד כה." זוהי גישת greedy שעובדת כל עוד אין זמן שלילי.

## ההגדרות המדויקות

**Shortest path, מסלול קצר ביותר**: נתיב בגרף \(G = (V, E)\) מצומת מקור \(s\) לצומת יעד \(t\) שמזעיר את סכום משקלי הקשתות לאורכו.

**\(\text{dist}[v]\)**: המשקל המינימלי הידוע מ-\(s\) ל-\(v\). באתחול \(\text{dist}[s] = 0\) וכל השאר \(\infty\).

**Relaxation, הרפיה**: הפעולה המרכזית של Dijkstra. לכל שכן \(u\) של \(v\) עם קשת במשקל \(w\):
\[\text{if } \text{dist}[v] + w < \text{dist}[u]: \quad \text{dist}[u] = \text{dist}[v] + w\]
אם מצאנו נתיב קצר יותר ל-\(u\) דרך \(v\), נעדכן.

**BFS, חיפוש לרוחב**: עובד על גרפים לא-ממושקלים (כל הקשתות שוות). מורכבות: \(O(V + E)\).

**Dijkstra's algorithm, אלגוריתם דייקסטרה**: עובד על גרפים עם משקלים אי-שליליים. משתמש ב-**priority queue, תור עדיפות** לתפוס תמיד את הצומת הלא-נעול עם ה-dist הנמוך ביותר. מורכבות עם binary heap: \(O((V + E) \log V)\).

**Priority queue, תור עדיפות**: מבנה נתונים שמחזיר תמיד את האלמנט עם המפתח הנמוך ביותר. ב-Python ממומש עם `heapq`, שהוא **min-heap, ערימת מינימום**.

```python
import heapq
from collections import deque

def dijkstra(graph: dict[int, list[tuple[int, int]]], src: int) -> dict[int, float]:
    """מחזיר מילון dist: node -> מרחק מינימלי מ-src."""
    dist = {node: float('inf') for node in graph}
    dist[src] = 0
    heap = [(0, src)]  # (distance, node)

    while heap:
        d, v = heapq.heappop(heap)
        if d > dist[v]:
            continue  # כניסה ישנה (stale), דלג
        for u, w in graph[v]:
            if dist[v] + w < dist[u]:
                dist[u] = dist[v] + w
                heapq.heappush(heap, (dist[u], u))

    return dist


def bfs_shortest(graph: dict[int, list[int]], src: int, dst: int) -> int:
    """גרף לא-ממושקל. מחזיר מספר קשתות, או -1 אם אין נתיב."""
    visited = {src}
    queue = deque([(src, 0)])

    while queue:
        node, hops = queue.popleft()
        if node == dst:
            return hops
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, hops + 1))

    return -1
```

## דוגמה מחושבת

גרף ממושקל עם 4 צמתים:

```
0 --(1)--> 1
0 --(4)--> 2
1 --(2)--> 2
1 --(5)--> 3
2 --(1)--> 3
```

נריץ Dijkstra מ-0. יעד: 3.

| שלב | pop | dist לאחר עדכון |
|-----|-----|----------------|
| 0 | (0,0) | dist[1]=1, dist[2]=4 |
| 1 | (1,1) | dist[2]=3 (שיפור!), dist[3]=6 |
| 2 | (3,2) | dist[3]=4 (שיפור!) |
| 3 | (4,2) | stale, דלג |
| 4 | (4,3) | אין שכנים |

**תוצאה:** `dist = {0:0, 1:1, 2:3, 3:4}`.

המסלול: `0 -> 1 -> 2 -> 3` עם עלות 4, לא `0 -> 2 -> 3` שעולה 5.

```quiz
{"id":"u-m1-shortest-path-q1","tree":"systems","skill":"python","q":"גרף לא-ממושקל (כל הקשתות שוות) עם 1000 צמתים ו-5000 קשתות. מה האלגוריתם הנכון למציאת מסלול קצר ביותר?","options":["BFS - O(V+E)","Dijkstra - O((V+E)logV)","Floyd-Warshall - O(V^3)","DFS - O(V+E)"],"answer":0,"explain":"BFS עובד על גרפים לא-ממושקלים ומחזיר מינימום קשתות ב-O(V+E). Dijkstra נכון גם הוא אך איטי יותר כי תור עדיפות יקר כשכל הקשתות שוות."}
```

## המקרה שמפיל את האינטואיציה

**משקל שלילי אחד שובר את Dijkstra.**

```
0 --(3)--> 1
0 --(5)--> 2
1 --((-4))--> 2
```

Dijkstra מוציא 0, קובע `dist[1]=3` ו-`dist[2]=5`. אחר כך מוציא 1 ומנסה להרפות 2: `3 + (-4) = -1 < 5`. נכון, אבל כאן הבעיה: Dijkstra כבר חסם את 2 ב-pop קודם ולא יחזור אליו נכון. (בממוש ה-stale-entry, הוא אכן ידחוף `-1` לתור, אבל מוציאים `(-1, 2)` אחרי `(5, 2)` הישן, ומאבדים הבטחות.)

הסיבה העמוקה: greedy של Dijkstra מניח שברגע שמוצאים dist[v], הוא אופטימלי ולא ישתפר. עם קשת שלילית, ייתכן שנגיע לאחד מ-v חוזרים ומשפרים. **Bellman-Ford** (שיאמד מאוחר יותר) פותר זאת ב-\(O(VE)\): הוא מריץ הרפיה \(V-1\) פעמים ואינו מניח כלום על סימן המשקל.

## טעויות נפוצות

**1. BFS על גרף ממושקל.** BFS מונה קשתות, לא משקלים. קשת במשקל 100 וקשת במשקל 1 שקולות עבורו. התוצאה תהיה שגויה.

**2. שכחת בדיקת stale entry ב-Dijkstra.** `heapq` ב-Python לא תומך ב-decrease-key. במקום זה דוחפים כניסה חדשה. ללא `if d > dist[v]: continue`, מעבדים כניסות ישנות ומסתכנים בפעולות כפולות.

**3. dist לא מאותחל לכל הצמתים.** אם בונים את `dist` בזמן ריצה, צמתים לא-מבוקרים עלולים ליפול ב-`KeyError`. עדיף לאתחל מלא מראש עם `float('inf')`.

**4. הנחה שהפלט הוא המסלול.** Dijkstra ו-BFS מחזירים מרחקים, לא נתיבים. לשחזור הנתיב צריך לשמור `prev[u] = v` בכל הרפיה ולעקוב אחורה מ-dst.

**5. שכחה שגרף לא-מכוון עם משקלים שונים עדיין דורש Dijkstra.** "לא-מכוון" אינו "לא-ממושקל".

## מתי זה לא משנה

**כשהגרף קטן מאוד (\(V < 100\)):** Floyd-Warshall ב-\(O(V^3)\) נותן את כל המסלולים הקצרים בין כל הזוגות ב-3 שורות:

```python
for k in range(n):
    for i in range(n):
        for j in range(n):
            dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
```

**כשצריך all-pairs shortest paths:** Dijkstra מ-k מקורות לוקח \(O(k(V+E)\log V)\). Floyd-Warshall לוקח \(O(V^3)\) ופשוט יותר לכתיבה, עדיף על גרפים צפופים.

**בראיונות:** השאלה הראשונה לגרף עם בקשת מסלול קצר: "יש משקלים שליליים?" כן = Bellman-Ford. לא = Dijkstra. לא-ממושקל = BFS.

## חיבור

M1 הגיע לכאן דרך arrays, hashing, two pointers, sliding window, binary search, stack, linked list, tree traversal, BST, trie, heap/top-k, backtracking וגרף-traversal. Dijkstra בנוי על heap (m1-heap-topk) ו-BFS בנוי על deque כמו ה-queue. השלב הבא:

- **m1-union-find**: מתי לא צריך מרחק אלא רק "האם מחוברים?"
- **m1-dp-1d**: כשהמבנה ניתן להפרדה לתת-בעיות חופפות
- Bellman-Ford (מאוחר יותר): כשמשקלים שליליים נכנסים לתמונה

```concepts
{"items":[{"id":"shortest-path-bfs","t":"BFS for shortest path","he":"BFS למסלול קצר","d":"מוצא מינימום קשתות בגרף לא-ממושקל ב-O(V+E)","rel":["graph-traversal"],"node":"dsa"},{"id":"dijkstra","t":"Dijkstra's algorithm","he":"אלגוריתם דייקסטרה","d":"מסלול קצר ביותר בגרף ממושקל עם משקלים אי-שליליים, O((V+E)logV)","rel":["relaxation","priority-queue-heap"],"node":"dsa"},{"id":"relaxation","t":"Edge relaxation","he":"הרפיית קשת","d":"עדכון dist[u] = dist[v]+w כשנמצא נתיב קצר יותר","rel":["dijkstra"],"node":"dsa"},{"id":"priority-queue-heap","t":"Priority queue (min-heap)","he":"תור עדיפות (ערימת מינימום)","d":"מבנה נתונים שמחזיר את המינימום ב-O(log n), ממומש ב-heapq ב-Python","rel":["heap-topk"],"node":"dsa"}]}
```
