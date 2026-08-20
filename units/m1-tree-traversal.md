# סריקת עצים
כשאתה פוגש שאלת ראיון שמתחילה ב-"בצע פעולה על כל הצמתים", השאלה האמיתית היא: באיזה סדר?

## מה תדע בסוף
תדע לממש בPython ארבעה סוגי סריקה של עץ בינארי: pre-order, in-order, post-order ו-BFS (level-order); תבין מה מבנה הנתונים שעומד מאחורי כל אחד (stack לעומת queue); תוכל לזהות איזה traversal מתאים לבעיה נתונה בראיון.

## האינטואיציה

תאר לעצמך עץ משפחה. כל אדם יכול להיות לו ילד שמאלי וילד ימני. הדרך שבה אתה "מבקר" את כולם קובעת את סדר הביקורים.

**DFS, חיפוש לעומק** יורד כמה שיותר עמוק לפני שחוזר. שלושה וריאנטים לפי מתי מעבדים את השורש:

- **Pre-order, קדם-סדר**: קרא לעצמך קודם, ואז שלח לילדים. סדר: שורש, שמאל, ימין. שימושי לשיחזור העץ.
- **In-order, אמצע-סדר**: הילד השמאלי קודם, אחר כך אתה, אחר כך הימני. בעץ BST זה מייצר ערכים בסדר עולה.
- **Post-order, אחר-סדר**: הילדים קודם, ואז ההורה. שימושי כשצריך לחשב תוצאה מלמטה למעלה, כמו הערכת ביטוי מתמטי.

**BFS, חיפוש לרוחב** קורא רמה-רמה. כאילו אתה מצלם קבוצתית: כל האנשים בשורה הראשונה, אחר כך השורה השנייה.

הכלל שקל לזכור: DFS = **stack, מחסנית** (call stack של הרקורסיה). BFS = **queue, תור**.

## ההגדרות המדויקות

### מבנה הצומת

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
```

בכל שאלת LeetCode שעוסקת בעצים, `TreeNode` נתון מראש.

### Pre-order

```python
def preorder(root: TreeNode | None) -> list[int]:
    if root is None:
        return []
    return [root.val] + preorder(root.left) + preorder(root.right)
```

גרסה איטרטיבית עם stack מפורש:

```python
def preorder_iter(root: TreeNode | None) -> list[int]:
    if root is None:
        return []
    result, stack = [], [root]
    while stack:
        node = stack.pop()
        result.append(node.val)
        if node.right:
            stack.append(node.right)   # ימין נכנס ראשון, יוצא שני
        if node.left:
            stack.append(node.left)    # שמאל נכנס שני, יוצא ראשון
    return result
```

### In-order

```python
def inorder(root: TreeNode | None) -> list[int]:
    if root is None:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)
```

סדר ביקור: שמאל, שורש, ימין.

### Post-order

```python
def postorder(root: TreeNode | None) -> list[int]:
    if root is None:
        return []
    return postorder(root.left) + postorder(root.right) + [root.val]
```

סדר ביקור: שמאל, ימין, שורש.

### BFS / Level-order

```python
from collections import deque

def level_order(root: TreeNode | None) -> list[list[int]]:
    if root is None:
        return []
    result = []
    queue = deque([root])
    while queue:
        level_size = len(queue)
        level = []
        for _ in range(level_size):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result
```

`deque` מאפשר הוצאה מהראש ב-\(O(1)\). `list.pop(0)` הוא \(O(n)\) ולכן אסור ב-BFS.

### מורכבויות לכל ארבעת ה-traversals

- זמן: \(O(n)\) כי כל צומת נסרק בדיוק פעם אחת.
- זיכרון: \(O(h)\) לרקורסיה, כאשר h הוא גובה העץ. עץ מאוזן: \(O(\log n)\). עץ נטוי: \(O(n)\).

## דוגמה מחושבת

```
    1
   / \
  2   3
 / \
4   5
```

**Pre-order** (שורש, שמאל, ימין):

```
visit(1) -> ירידה שמאל -> visit(2) -> ירידה שמאל -> visit(4) -> חוזר -> ירידה ימין -> visit(5) -> חוזר ל-1 -> ירידה ימין -> visit(3)
תוצאה: [1, 2, 4, 5, 3]
```

**In-order** (שמאל, שורש, ימין):

```
עמוק שמאל עד 4 -> visit(4) -> חוזר -> visit(2) -> ירידה ימין -> visit(5) -> חוזר ל-1 -> visit(1) -> visit(3)
תוצאה: [4, 2, 5, 1, 3]
```

**Post-order** (שמאל, ימין, שורש):

```
visit(4) -> visit(5) -> visit(2) -> visit(3) -> visit(1)
תוצאה: [4, 5, 2, 3, 1]
```

**BFS** (רמה אחרי רמה):

```
רמה 0: [1]
רמה 1: [2, 3]
רמה 2: [4, 5]
תוצאה: [[1], [2, 3], [4, 5]]
```

**מעקב ידני אחרי ה-stack ב-pre-order איטרטיבי:**

| stack | פעולה | result |
|---|---|---|
| [1] | pop 1, push 3, push 2 | [1] |
| [3, 2] | pop 2, push 5, push 4 | [1, 2] |
| [3, 5, 4] | pop 4, אין ילדים | [1, 2, 4] |
| [3, 5] | pop 5, אין ילדים | [1, 2, 4, 5] |
| [3] | pop 3, אין ילדים | [1, 2, 4, 5, 3] |

## המקרה שמפיל את האינטואיציה

**עץ נטוי (skewed tree)** הוא מה שהרקורסיה הנאיבית מפחדת ממנו:

```
1
 \
  2
   \
    3
     \
      4  (n צמתים בשרשרת)
```

כאן גובה העץ הוא n ולא \(\log n\). רקורסיה עמוקה של n = 1,000 גורמת ל-`RecursionError` בPython (מגבלת ברירת מחדל: 1,000 frames). הפתרון הנקי הוא גרסה איטרטיבית עם stack מפורש, לא הגדלת מגבלת הרקורסיה.

בראיון: אם המראיין שואל "מה יקרה על עץ גדול מאד?", זו התשובה.

## טעויות נפוצות

**1. לא בודקים `None` לפני גישה ל-`.left` / `.right`**

```python
# שגוי: AttributeError אם root הוא None
def inorder_bad(root):
    return inorder_bad(root.left) + [root.val] + inorder_bad(root.right)

# נכון: תנאי עצירה ראשון
def inorder(root):
    if root is None:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)
```

**2. בלבול בין in-order לpre-order**

In-order ב-BST נותן סדר עולה; pre-order לא. אם השאלה שואלת "הדפס ערכים בסדר עולה" ואתה מחזיר pre-order, התשובה שגויה.

**3. שימוש ב-`list.pop(0)` במקום `deque.popleft()` ב-BFS**

```python
# O(n) לכל פעולה, BFS כולו הופך O(n^2)
queue = [root]
node = queue.pop(0)     # אסור

# O(1) לכל פעולה
from collections import deque
queue = deque([root])
node = queue.popleft()  # נכון
```

**4. שכחת להוסיף `None`-check לפני הוספה לתור ב-BFS**

```python
# שגוי: מוסיף None לתור, ואז queue.popleft() מחזיר None
queue.append(node.left)

# נכון
if node.left:
    queue.append(node.left)
```

**5. ניסיון לשנות את העץ תוך כדי traversal**

אם מוחקים צמתים במהלך הסריקה, תוצאות הסריקה לא מוגדרות. לבעיות "מחק כל עלה", תחזיר עץ שונה מ-post-order ואל תשנה את הצמתים in-place.

## מתי זה לא משנה

**כשהעץ קטן**: לעץ של 10 צמתים, כל traversal עובד מהר מספיק. אין סיבה להעדיף גרסה איטרטיבית.

**כשמחפשים צומת ספציפי**: לא חייבים לסרוק את כל העץ. DFS עם `early return` עדיפה על BFS שסורקת לפי רמות אם המטרה היא מציאת צומת.

**מה משנה בראיון**: המראיין מצפה להסבר. In-order לBST, post-order להערכת ביטויים, BFS למציאת הנתיב הקצר ביותר או לשאלות על רמות ספציפיות.

## חיבור

יחידה זו שייכת ל-M1 (מבני נתונים ואלגוריתמים). הבנת ארבעת ה-traversals היא תנאי הכרחי ל-**m1-bst** (Binary Search Tree), **m1-trie**, ו-**m1-graph-traversal**.

ה-pattern של post-order שמחזיר ערך מצמתי הילדים חוזר בדיוק אותו אופן ב-DP על עצים, שבה היחידה **m1-dp-1d** תיגע בהמשך.

```quiz
{"id":"u-m1-tree-traversal-q1","tree":"systems","skill":"python","q":"מהו ה-in-order traversal של העץ הבא? שורש=1, ילד-שמאל=2 (עם ילדים 4 ו-5), ילד-ימין=3","options":["[1, 2, 4, 5, 3]","[4, 2, 5, 1, 3]","[4, 5, 2, 3, 1]","[1, 2, 3, 4, 5]"],"answer":1,"explain":"In-order: שמאל, שורש, ימין. יורדים עמוק שמאל עד 4, חוזרים ל-2, ימין ל-5, חוזרים ל-1, אחר כך ימין ל-3. תוצאה: [4, 2, 5, 1, 3]."}
```

```quiz
{"id":"u-m1-tree-traversal-q2","tree":"systems","skill":"python","q":"איזה מבנה נתונים משתמש BFS (level-order traversal)?","options":["Stack (מחסנית)","Queue (תור)","Heap (ערמה)","Set (קבוצה)"],"answer":1,"explain":"BFS מוסיף ילדים לסוף התור ומוציא מהראש (FIFO). בPython משתמשים ב-collections.deque עם popleft(). DFS הוא זה שמשתמש ב-stack."}
```

```concepts
{"items":[{"id":"c-binary-tree-node","t":"TreeNode","he":"צומת עץ בינארי","d":"מבנה עם val, left ו-right. הבסיס של כל בעיות עץ ב-LeetCode.","rel":["c-preorder-traversal","c-inorder-traversal","c-postorder-traversal","c-level-order-traversal"],"node":"dsa"},{"id":"c-preorder-traversal","t":"Pre-order Traversal","he":"סריקת קדם-סדר","d":"DFS: שורש, שמאל, ימין. שימושי לשיחזור עץ.","rel":["c-binary-tree-node","c-inorder-traversal","c-tree-dfs-stack"],"node":"dsa"},{"id":"c-inorder-traversal","t":"In-order Traversal","he":"סריקת אמצע-סדר","d":"DFS: שמאל, שורש, ימין. ב-BST נותן ערכים בסדר עולה.","rel":["c-binary-tree-node","c-preorder-traversal","c-postorder-traversal"],"node":"dsa"},{"id":"c-postorder-traversal","t":"Post-order Traversal","he":"סריקת אחר-סדר","d":"DFS: שמאל, ימין, שורש. שימושי להערכת ביטויים ו-DP על עצים.","rel":["c-binary-tree-node","c-inorder-traversal","c-tree-dfs-stack"],"node":"dsa"},{"id":"c-level-order-traversal","t":"Level-order Traversal","he":"סריקת רמות (BFS)","d":"BFS על עץ. משתמש ב-queue; מבקר כל הצמתים ברמה לפני ירידה לרמה הבאה.","rel":["c-binary-tree-node","c-tree-dfs-stack"],"node":"dsa"},{"id":"c-tree-dfs-stack","t":"DFS with Stack","he":"DFS עם מחסנית","d":"גרסה איטרטיבית של DFS על עץ. stack מחליפה את ה-call stack של הרקורסיה; נמנעת מ-RecursionError בעצים נטויים.","rel":["c-preorder-traversal","c-postorder-traversal","c-level-order-traversal"],"node":"dsa"}]}
```
