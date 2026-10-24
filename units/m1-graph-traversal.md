# סריקת גרפים (Graph traversal)
כשלינקדאין שואלת "האם אתה מכיר את X?", היא מבצעת סריקת גרף מציוניך; כל גרסה של השאלה הזו נפתרת בשתי שיטות בלבד: BFS ו-DFS.

## מה תדע בסוף

תוכל לממש BFS ו-DFS על גרף שמיוצג כרשימת שכנות, לדעת בדיוק מה כל אחד מחזיר ומה הוא מפספס, ולבחור בין השיטות לפי טבע הבעיה. תטפל בגרפים מנותקים ותחשב זמן ומרחב בצורה נכונה.

## האינטואיציה

דמיין שאתה מחפש חפץ במחסן גדול. שתי אסטרטגיות:

**BFS (Breadth-First Search, חיפוש לרוחב)**: שולח עוזרים לכל המסדרונות הסמוכים בו-זמנית. אחרי שכולם חזרו, שולח אותם עוד צעד קדימה. כמו גלים במים שמתפשטים לפי מרחק.

**DFS (Depth-First Search, חיפוש לעומק)**: הולך במסדרון אחד עד הסוף, חוזר, עובר למסדרון הבא. כמו חוקר שעובד שיטתית.

האנלוגיה לכל הפרק: **גלים מול חוקר בודד**. BFS הוא הגלים; DFS הוא החוקר.

## הפורמליזם

**Graph, גרף**: זוג \((V, E)\) שבו:
- \(V\) הוא קבוצת **Vertices (nodes), צמתים**.
- \(E\) הוא קבוצת **Edges, קשתות** שמחברות זוגות צמתים.

גרף **לא-מכוון (undirected)**: הקשת \((u, v)\) זהה ל-\((v, u)\).
גרף **מכוון (directed)**: הקשת מ-\(u\) ל-\(v\) אינה מכילה בהכרח קשת חזרה מ-\(v\) ל-\(u\).

**Adjacency list, רשימת שכנות**: ייצוג הגרף כ-`dict[node, list[node]]`. לכל צומת רשימת שכניו. יעיל לגרפים **דלילים (sparse)** שבהם \(|E| \ll |V|^2\).

**Visited set, קבוצת ביקורים**: קבוצה שמכילה צמתים שכבר ביקרנו. חיונית בגרפים עם מעגלים כדי למנוע לולאה אינסופית.

### BFS

```python
from collections import deque

def bfs(graph: dict, start: int) -> list[int]:
    visited = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()           # FIFO: always take from front
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)    # mark on enqueue, not on visit
                queue.append(neighbor)
    return order
```

מבנה נתונים: **Queue, תור** (FIFO). BFS מבקר קודם בצמתים הקרובים יותר ל-`start`.

**מורכזות זמן**: \(O(V + E)\). כל צומת נכנס לתור פעם אחת, כל קשת נבדקת פעם אחת.
**מורכזות מרחב**: \(O(V)\). התור עשוי להחזיק שכבה שלמה.

### DFS

```python
def dfs(graph: dict, start: int) -> list[int]:
    visited = set()
    order = []

    def explore(node: int) -> None:
        visited.add(node)
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                explore(neighbor)

    explore(start)
    return order
```

מבנה נתונים: **Call stack, מחסנית הקריאות** (רקורסיה), או Stack מפורש.

**מורכזות זמן**: \(O(V + E)\). זהה ל-BFS.
**מורכזות מרחב**: \(O(V)\). עומק הרקורסיה עשוי להגיע ל-\(O(V)\) בגרף שהוא מסלול ישר.

```quiz
{"id":"u-m1-graph-traversal-q1","tree":"systems","skill":"python","q":"באיזו שיטה תמצא את מספר הקשתות המינימלי בין שני צמתים בגרף לא-ממושקל?","options":["DFS כי הוא עמוק יותר","BFS כי הוא חוקר לפי שכבות מרחק","שתי השיטות שקולות לכך","Dijkstra בלבד פותר את זה"],"answer":1,"explain":"BFS חוקר לפי מרחק בשכבות: שכבה 0 היא start, שכבה 1 שכניו, שכבה 2 שכני שכניו. הביקור הראשון בצומת היעד מגיע דרך המסלול הקצר ביותר במספר קשתות. DFS מוצא מסלול כלשהו."}
```

## דוגמה מחושבת

גרף לא-מכוון:

```
0 -- 1 -- 3
|    |
2    4
```

```python
graph = {
    0: [1, 2],
    1: [0, 3, 4],
    2: [0],
    3: [1],
    4: [1],
}
```

**BFS מ-0**: מתחילים עם `queue=[0]`, `visited={0}`.

```
pop 0  -> order=[0]; enqueue 1,2  -> visited={0,1,2}
pop 1  -> order=[0,1]; enqueue 3,4 -> visited={0,1,2,3,4}
pop 2  -> order=[0,1,2]; 0 כבר ב-visited
pop 3  -> order=[0,1,2,3]; 1 כבר ב-visited
pop 4  -> order=[0,1,2,3,4]
```

סדר BFS: `[0, 1, 2, 3, 4]`. שכבה 1: צמתים 1 ו-2. שכבה 2: צמתים 3 ו-4.

**DFS מ-0**: `explore(0)` -> `explore(1)` -> `explore(3)` -> חזרה -> `explore(4)` -> חזרה חזרה -> `explore(2)`.

סדר DFS: `[0, 1, 3, 4, 2]`. DFS ירד עמוק דרך 1 לפני שחזר ל-2.

**מסלול מ-0 ל-3**: BFS מחזיר 0->1->3 (2 קשתות, הקצר ביותר). DFS מוצא גם 0->1->3, אך זה מקרי.

## המקרה שמפיל את האינטואיציה

**"DFS מוצא מסלול, זה מספיק"**: נכון רק אם לא אכפת לנו מאורך.

הוסיפו קשת ישירה מ-0 ל-3 לגרף הנ"ל. DFS עלול להגיע ל-3 דרך 0->1->3 (2 קשתות) ולא דרך 0->3 (1 קשת), תלוי בסדר הרשימה. BFS ימצא תמיד 0->3 כי יבדוק את כל שכני 0 לפני שיכנס לעומק.

**גרף מנותק (disconnected graph)**: קריאה אחת ל-BFS/DFS מ-`start` תגיע רק לרכיב המקושר שלו. כדי לסרוק את כל הגרף:

```python
def connected_components(graph: dict) -> list[list[int]]:
    visited = set()
    components = []
    for node in graph:
        if node not in visited:
            component = []
            def explore(n):
                visited.add(n)
                component.append(n)
                for nb in graph[n]:
                    if nb not in visited:
                        explore(nb)
            explore(node)
            components.append(component)
    return components
```

```quiz
{"id":"u-m1-graph-traversal-q2","tree":"systems","skill":"python","q":"גרף עם 5 צמתים ושני רכיבים מקושרים. BFS מצומת 0 מחזיר:","options":["את כל 5 הצמתים","רק את הצמתים ברכיב המקושר של 0","שגיאה כי הגרף מנותק","רשימה ריקה"],"answer":1,"explain":"BFS ו-DFS מבקרים רק בצמתים שניתן להגיע אליהם מ-start. רכיב שני אינו נגיש מ-0. כדי לסרוק את כל הגרף צריך לולאה חיצונית על כל הצמתים."}
```

## טעויות נפוצות

**1. שכחת visited set בגרף עם מעגלים:**
```python
# שגוי
def bad_dfs(graph, node):
    for neighbor in graph[node]:
        bad_dfs(graph, neighbor)  # לולאה אינסופית בגרף עם מעגל
```
הוסיפו `visited` ובדקו לפני הכניסה לרקורסיה.

**2. הוספת שכן ל-visited רק בעת ביקור, לא בעת הכנסה לתור:**
```python
# בעייתי ב-BFS
while queue:
    node = queue.popleft()
    visited.add(node)              # מאוחר מדי
    for neighbor in graph[node]:
        if neighbor not in visited:
            queue.append(neighbor) # אותו שכן יכנס לתור פעמיים
```
יכניס את אותו שכן לתור כמה פעמים לפני שמגיע אליו תורו. הוסיפו ל-`visited` בזמן `queue.append`.

**3. שימוש ב-DFS לחיפוש מסלול קצר ביותר:**
DFS מוצא מסלול כלשהו. למסלול קצר ביותר (לפי מספר קשתות) השתמשו ב-BFS.

**4. אי-טיפול בגרף מנותק:**
קראתם ל-BFS/DFS מצומת אחד ומניחים שראיתם את כל הגרף. בגרף מנותק צריך לולאה חיצונית.

## מתי זה לא משנה

**בגרף ממושקל**: BFS ו-DFS לא מחשבים מסלול קצר ממושקל. השתמשו ב-Dijkstra (משקלים חיוביים) או Bellman-Ford (כולל שליליים).

**ב-DAG (Directed Acyclic Graph, גרף מכוון ללא מעגלים)**: DFS עם topological sort הוא הכלי הנכון לתלויות, תזמון ו-build systems.

**כשצריך all-pairs shortest paths**: Floyd-Warshall מחשב מסלולים בין כל זוג צמתים ב-\(O(V^3)\), יעיל לגרפים קטנים וצפופים.

**כלל ראיון**: "האם X מגיע ל-Y?" - BFS או DFS. "מה המסלול הקצר ביותר מ-X ל-Y?" - BFS (לא ממושקל) או Dijkstra (ממושקל). "כמה רכיבים מקושרים?" - DFS על כל הצמתים.

## חיבור

Graph traversal שייך ל-M1 ומשלים את tree traversal על גרפים כלליים. שניים נפתחים ישירות:

- **Shortest path**: Dijkstra ו-Bellman-Ford בנויים על BFS עם priority queue ועלות קשתות.
- **Union-Find**: חלופה ל-DFS לחישוב רכיבים מקושרים, יעילה יותר בהוספת קשתות דינמית.

```concepts
{"items":[{"id":"c-graph-bfs","t":"BFS (Breadth-First Search)","he":"חיפוש לרוחב","d":"סריקת גרף שחוקרת לפי שכבות מרחק מ-start; מוצאת מסלול קצר ביותר (מספר קשתות) בגרף לא-ממושקל","rel":["c-graph-dfs","c-adjacency-list","c-visited-set"],"node":"dsa"},{"id":"c-graph-dfs","t":"DFS (Depth-First Search)","he":"חיפוש לעומק","d":"סריקת גרף שעוקבת אחרי מסלול עד הסוף לפני שחוזרת; מוצאת מסלול כלשהו, לא בהכרח הקצר","rel":["c-graph-bfs","c-adjacency-list","c-visited-set"],"node":"dsa"},{"id":"c-adjacency-list","t":"Adjacency List","he":"רשימת שכנות","d":"ייצוג גרף כ-dict[node, list[node]]; יעיל לגרפים דלילים","rel":["c-graph-bfs","c-graph-dfs"],"node":"dsa"},{"id":"c-visited-set","t":"Visited Set","he":"קבוצת ביקורים","d":"קבוצה שמונעת ביקור כפול בצמתים בסריקת גרף; חיונית בגרפים עם מעגלים","rel":["c-graph-bfs","c-graph-dfs"],"node":"dsa"}]}
```

<!-- audited -->
